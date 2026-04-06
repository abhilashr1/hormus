import { create } from "zustand";
import { getDesktopApi } from "@/lib/desktop";
import { getWindowConnectionId, getWindowScreen } from "@/lib/window-context";
import type {
  Connection,
  ConnectionCreateInput,
  ConnectionTestInput,
  ConnectionTestResult,
  ConnectionUpdateInput,
  DesktopSnapshot,
  QueryHistoryItem,
  QueryResult,
  QueryTab,
  SchemaNode,
} from "@/shared/ipc";

type SidebarView = DesktopSnapshot["sidebarView"];
type AppScreen = "collection-manager" | "workspace";

interface QueryOutputEntry {
  id: string;
  query: string;
  message: string;
  status: "success" | "error";
  ranAt: string;
}

interface CreateTabInput {
  title?: string;
  sql?: string;
  run?: boolean;
}

interface AppState {
  currentScreen: AppScreen;
  connections: Connection[];
  activeConnectionId: string;
  sidebarView: SidebarView;
  queryTabs: QueryTab[];
  activeTabId: string;
  schemas: SchemaNode[];
  selectedSchema: string;
  history: QueryHistoryItem[];
  result: QueryResult | null;
  queryError: string | null;
  lastRunQueryByTab: Record<string, string>;
  outputHistoryByTab: Record<string, QueryOutputEntry[]>;
  isBootstrapping: boolean;
  isRunningQuery: boolean;
  bootstrap: () => Promise<void>;
  openWorkspace: (connectionId: string) => Promise<void>;
  returnToCollectionManager: () => void;
  refreshConnections: () => Promise<void>;
  createConnection: (input: ConnectionCreateInput) => Promise<void>;
  updateConnection: (input: ConnectionUpdateInput) => Promise<void>;
  testConnection: (input: ConnectionTestInput) => Promise<ConnectionTestResult>;
  deleteConnection: (id: string) => Promise<void>;
  setSidebarView: (view: SidebarView) => void;
  setSelectedSchema: (schema: string) => void;
  setActiveTab: (id: string) => Promise<void>;
  updateTabSql: (id: string, sql: string) => void;
  updateTabSelection: (id: string, selection: string) => void;
  renameTab: (id: string, title: string) => void;
  closeTab: (id: string) => Promise<void>;
  createTab: (input?: CreateTabInput) => Promise<void>;
  runTab: (id: string) => Promise<void>;
  runTabPage: (id: string, pageOffset: number) => Promise<void>;
}

const STORAGE_KEY = "hormus-phase-2";

function createEmptyTab(index = 1): QueryTab {
  return {
    id: crypto.randomUUID(),
    title: `Query ${index}`,
    sql: "",
    status: "idle",
  };
}

function ensureTabs(queryTabs: QueryTab[], activeTabId?: string) {
  const tabs = queryTabs.length > 0 ? queryTabs : [createEmptyTab()];
  const nextActiveTabId = tabs.some((tab) => tab.id === activeTabId) ? activeTabId ?? tabs[0].id : tabs[0].id;

  return {
    queryTabs: tabs,
    activeTabId: nextActiveTabId,
  };
}

function getDefaultSchemaName(schemas: SchemaNode[], preferredSchema?: string) {
  const preferred = preferredSchema ? schemas.find((schema) => schema.name === preferredSchema) : undefined;
  return preferred?.name ?? schemas.find((schema) => schema.name === "public")?.name ?? schemas[0]?.name ?? "";
}

function loadPersistedState() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  return raw
    ? (JSON.parse(raw) as Partial<Pick<AppState, "activeConnectionId" | "activeTabId" | "queryTabs" | "sidebarView">>)
    : null;
}

function persist(state: Pick<AppState, "activeConnectionId" | "queryTabs" | "activeTabId" | "sidebarView">) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

const saved = loadPersistedState();

async function loadWorkspaceData(connectionId: string, activeTabId: string, preferredSchema?: string) {
  const api = getDesktopApi();
  const [schemas, history, result] = await Promise.all([
    api.listSchemas(connectionId),
    api.listHistory(connectionId),
    api.getResults(activeTabId),
  ]);

  return {
    schemas,
    history,
    result,
    selectedSchema: getDefaultSchemaName(schemas, preferredSchema),
  };
}

async function loadWorkspaceDataSafe(connectionId: string, activeTabId: string, preferredSchema?: string) {
  try {
    const workspace = await loadWorkspaceData(connectionId, activeTabId, preferredSchema);
    return {
      ...workspace,
      queryError: null as string | null,
    };
  } catch (error) {
    return {
      schemas: [],
      history: [],
      result: null,
      selectedSchema: "",
      queryError: error instanceof Error ? error.message : "Failed to load connection metadata",
    };
  }
}

export const useAppStore = create<AppState>((set, get) => ({
  currentScreen: getWindowScreen(),
  connections: [],
  activeConnectionId: saved?.activeConnectionId ?? "",
  sidebarView: saved?.sidebarView ?? "schemas",
  queryTabs: saved?.queryTabs ?? [],
  activeTabId: saved?.activeTabId ?? "",
  schemas: [],
  selectedSchema: "",
  history: [],
  result: null,
  queryError: null,
  lastRunQueryByTab: {},
  outputHistoryByTab: {},
  isBootstrapping: true,
  isRunningQuery: false,

  bootstrap: async () => {
    set({ isBootstrapping: true });

    const snapshot = await getDesktopApi().bootstrap(saved?.activeConnectionId);
    const screen = getWindowScreen();
    const windowConnectionId = getWindowConnectionId();
    const activeConnectionId = windowConnectionId ?? saved?.activeConnectionId ?? snapshot.activeConnectionId;
    const tabs = ensureTabs(saved?.queryTabs?.length ? saved.queryTabs : snapshot.queryTabs, saved?.activeTabId ?? snapshot.activeTabId);

    const nextState = {
      currentScreen: screen,
      connections: snapshot.connections,
      activeConnectionId,
      sidebarView: snapshot.sidebarView,
      queryTabs: tabs.queryTabs,
      activeTabId: tabs.activeTabId,
      queryError: null,
    };

    if (screen === "workspace") {
      const workspace = activeConnectionId
        ? await loadWorkspaceDataSafe(
            activeConnectionId,
            tabs.activeTabId,
            snapshot.connections.find((connection) => connection.id === activeConnectionId)?.database,
          )
        : { schemas: [], history: [], result: null, selectedSchema: "", queryError: null };
      set({
        ...nextState,
        schemas: workspace.schemas,
        selectedSchema: workspace.selectedSchema,
        history: workspace.history,
        result: workspace.result,
        queryError: workspace.queryError,
        isBootstrapping: false,
      });
    } else {
      set({
        ...nextState,
        isBootstrapping: false,
      });
    }

    persist({
      activeConnectionId,
      activeTabId: tabs.activeTabId,
      queryTabs: tabs.queryTabs,
      sidebarView: snapshot.sidebarView,
    });
  },

  openWorkspace: async (connectionId) => {
    if (typeof window !== "undefined" && window.hormus) {
      await getDesktopApi().openConnectionWindow(connectionId);
      return;
    }

    const state = get();
    const tabs = ensureTabs(state.queryTabs, state.activeTabId);

    set({ isBootstrapping: true });
    const workspace = await loadWorkspaceDataSafe(
      connectionId,
      tabs.activeTabId,
      state.connections.find((connection) => connection.id === connectionId)?.database,
    );

    set((current) => ({
      ...current,
      currentScreen: "workspace",
      activeConnectionId: connectionId,
      queryTabs: tabs.queryTabs,
      activeTabId: tabs.activeTabId,
      schemas: workspace.schemas,
      selectedSchema: workspace.selectedSchema,
      history: workspace.history,
      result: workspace.result,
      queryError: workspace.queryError,
      isBootstrapping: false,
    }));

    persist({
      activeConnectionId: connectionId,
      activeTabId: tabs.activeTabId,
      queryTabs: tabs.queryTabs,
      sidebarView: get().sidebarView,
    });
  },

  returnToCollectionManager: () => {
    if (typeof window !== "undefined" && window.hormus) {
      void getDesktopApi().openCollectionManagerWindow();
      void getDesktopApi().closeCurrentWindow();
      return;
    }

    set({ currentScreen: "collection-manager" });
  },

  refreshConnections: async () => {
    const connections = await getDesktopApi().listConnections();
    set({ connections });
  },

  createConnection: async (input) => {
    const connection = await getDesktopApi().createConnection(input);
    set((state) => ({
      ...state,
      connections: [...state.connections, connection],
    }));
  },

	  updateConnection: async (input) => {
	    const updated = await getDesktopApi().updateConnection(input);
	    set((state) => ({
	      ...state,
	      connections: state.connections.map((connection) => (connection.id === updated.id ? updated : connection)),
	    }));
	  },

	  testConnection: async (input) => getDesktopApi().testConnection(input),
	
	  deleteConnection: async (id) => {
    await getDesktopApi().deleteConnection({ id });
    set((state) => ({
      ...state,
      connections: state.connections.filter((connection) => connection.id !== id),
      activeConnectionId: state.activeConnectionId === id ? "" : state.activeConnectionId,
      currentScreen: state.activeConnectionId === id ? "collection-manager" : state.currentScreen,
    }));
  },

  setSidebarView: (view) =>
    set((state) => {
      const next = { ...state, sidebarView: view };
      persist({
        activeConnectionId: next.activeConnectionId,
        activeTabId: next.activeTabId,
        queryTabs: next.queryTabs,
        sidebarView: next.sidebarView,
      });
      return next;
    }),

  setSelectedSchema: (schema) => set({ selectedSchema: schema }),

  setActiveTab: async (id) => {
    const result = await getDesktopApi().getResults(id);
    set((state) => {
      const next = { ...state, activeTabId: id, result, queryError: null };
      persist({
        activeConnectionId: next.activeConnectionId,
        activeTabId: next.activeTabId,
        queryTabs: next.queryTabs,
        sidebarView: next.sidebarView,
      });
      return next;
    });
  },

  updateTabSql: (id, sql) =>
    set((state) => {
      const queryTabs = state.queryTabs.map((tab) => (tab.id === id ? { ...tab, sql } : tab));
      const next = { ...state, queryTabs };
      persist({
        activeConnectionId: next.activeConnectionId,
        activeTabId: next.activeTabId,
        queryTabs: next.queryTabs,
        sidebarView: next.sidebarView,
      });
      return next;
    }),

  updateTabSelection: (id, selection) =>
    set((state) => {
      const nextSelection = selection.trim() ? selection : undefined;
      return {
        ...state,
        queryTabs: state.queryTabs.map((tab) => (tab.id === id ? { ...tab, selection: nextSelection } : tab)),
      };
    }),

  renameTab: (id, title) =>
    set((state) => {
      const nextTitle = title.trim();
      if (!nextTitle) {
        return state;
      }

      const queryTabs = state.queryTabs.map((tab) => (tab.id === id ? { ...tab, title: nextTitle } : tab));
      const next = { ...state, queryTabs };
      persist({
        activeConnectionId: next.activeConnectionId,
        activeTabId: next.activeTabId,
        queryTabs: next.queryTabs,
        sidebarView: next.sidebarView,
      });
      return next;
    }),

  closeTab: async (id) => {
    const state = get();
    const closedIndex = state.queryTabs.findIndex((tab) => tab.id === id);
    if (closedIndex === -1) {
      return;
    }

    const remainingTabs = state.queryTabs.filter((tab) => tab.id !== id);
    const queryTabs = remainingTabs.length > 0 ? remainingTabs : [createEmptyTab()];
    const fallbackTab = queryTabs[Math.max(0, Math.min(closedIndex, queryTabs.length - 1))];
    const activeTabId = state.activeTabId === id ? fallbackTab.id : state.activeTabId;
    const result = state.activeTabId === id ? await getDesktopApi().getResults(activeTabId) : state.result;

    set((current) => {
      const { [id]: _lastRunQuery, ...lastRunQueryByTab } = current.lastRunQueryByTab;
      const { [id]: _outputHistory, ...outputHistoryByTab } = current.outputHistoryByTab;
      const next = {
        ...current,
        queryTabs,
        activeTabId,
        result,
        queryError: current.activeTabId === id ? null : current.queryError,
        lastRunQueryByTab,
        outputHistoryByTab,
      };

      persist({
        activeConnectionId: next.activeConnectionId,
        activeTabId: next.activeTabId,
        queryTabs: next.queryTabs,
        sidebarView: next.sidebarView,
      });
      return next;
    });
  },

  createTab: async (input) => {
    let tabId = "";
    set((state) => {
      const tab: QueryTab = {
        id: crypto.randomUUID(),
        title: input?.title ?? `Query ${state.queryTabs.length + 1}`,
        sql: input?.sql ?? "",
        status: "idle",
      };
      tabId = tab.id;
      const next = {
        ...state,
        queryTabs: [...state.queryTabs, tab],
        activeTabId: tab.id,
        selectedSchema: getDefaultSchemaName(
          state.schemas,
          state.connections.find((connection) => connection.id === state.activeConnectionId)?.database,
        ),
        result: null,
        queryError: null,
        lastRunQueryByTab: state.lastRunQueryByTab,
        outputHistoryByTab: state.outputHistoryByTab,
      };
      persist({
        activeConnectionId: next.activeConnectionId,
        activeTabId: next.activeTabId,
        queryTabs: next.queryTabs,
        sidebarView: next.sidebarView,
      });
      return next;
    });

    if (input?.run && tabId) {
      await get().runTab(tabId);
    }
  },

  runTab: async (id) => {
    const state = get();
    const tab = state.queryTabs.find((item) => item.id === id);
    if (!tab) {
      return;
    }

    set({ isRunningQuery: true });
    const executedSql = tab.selection ?? tab.sql;
    try {
      const response = await getDesktopApi().runQuery({
        connectionId: state.activeConnectionId,
        tabId: id,
        sql: tab.sql,
        selection: tab.selection,
        pageOffset: 0,
      });

      const history = await getDesktopApi().listHistory(state.activeConnectionId);

      set((current) => {
        const queryTabs: QueryTab[] = current.queryTabs.map((item) => (item.id === id ? response.tab : item));
        const next = {
          ...current,
          queryTabs,
          result: response.result,
          history,
          queryError: null,
          lastRunQueryByTab: {
            ...current.lastRunQueryByTab,
            [id]: executedSql,
          },
          outputHistoryByTab: {
            ...current.outputHistoryByTab,
            [id]: [
              {
                id: crypto.randomUUID(),
                query: executedSql,
                message: response.result
                  ? `Returned ${response.result.rowCount.toLocaleString()} rows in ${response.result.durationMs}ms`
                  : "Query completed",
                status: "success" as const,
                ranAt: new Date().toLocaleString(),
              },
              ...(current.outputHistoryByTab[id] ?? []),
            ],
          },
          isRunningQuery: false,
        };
        persist({
          activeConnectionId: next.activeConnectionId,
          activeTabId: next.activeTabId,
          queryTabs: next.queryTabs,
          sidebarView: next.sidebarView,
        });
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Query failed";

      set((current) => ({
        ...current,
        queryTabs: current.queryTabs.map((item) => (item.id === id ? { ...item, status: "error" } : item)),
        result: null,
        queryError: message,
        lastRunQueryByTab: {
          ...current.lastRunQueryByTab,
          [id]: executedSql,
        },
        outputHistoryByTab: {
          ...current.outputHistoryByTab,
          [id]: [
            {
              id: crypto.randomUUID(),
              query: executedSql,
              message,
              status: "error" as const,
              ranAt: new Date().toLocaleString(),
            },
            ...(current.outputHistoryByTab[id] ?? []),
          ],
        },
        isRunningQuery: false,
      }));
    }
  },

  runTabPage: async (id, pageOffset) => {
    const state = get();
    const tab = state.queryTabs.find((item) => item.id === id);
    const executedSql = state.lastRunQueryByTab[id];
    if (!tab || !executedSql) {
      return;
    }

    set({ isRunningQuery: true });
    try {
      const response = await getDesktopApi().runQuery({
        connectionId: state.activeConnectionId,
        tabId: id,
        sql: tab.sql,
        selection: executedSql,
        pageOffset,
      });

      set((current) => {
        const queryTabs: QueryTab[] = current.queryTabs.map((item) =>
          item.id === id ? { ...response.tab, sql: item.sql, selection: item.selection } : item,
        );
        const next = {
          ...current,
          queryTabs,
          result: response.result,
          queryError: null,
          lastRunQueryByTab: {
            ...current.lastRunQueryByTab,
            [id]: executedSql,
          },
          isRunningQuery: false,
        };
        persist({
          activeConnectionId: next.activeConnectionId,
          activeTabId: next.activeTabId,
          queryTabs: next.queryTabs,
          sidebarView: next.sidebarView,
        });
        return next;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Query failed";

      set((current) => ({
        ...current,
        queryTabs: current.queryTabs.map((item) => (item.id === id ? { ...item, status: "error" } : item)),
        result: null,
        queryError: message,
        isRunningQuery: false,
      }));
    }
  },
}));

export function selectActiveConnection(state: AppState) {
  return state.connections.find((connection) => connection.id === state.activeConnectionId);
}

export function selectActiveTab(state: AppState) {
  return state.queryTabs.find((tab) => tab.id === state.activeTabId);
}
