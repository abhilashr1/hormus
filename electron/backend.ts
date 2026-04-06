import type {
  ConnectionCreateInput,
  ConnectionDeleteInput,
  ConnectionTestInput,
  ConnectionUpdateInput,
  DescribeTableInput,
  DesktopSnapshot,
  HormusDesktopBackend,
  ListTablesInput,
  QueryRunInput,
  QueryTab,
} from "../src/shared/ipc.js";
import { desktopSnapshotSchema } from "../src/shared/ipc.js";
import { describeLiveTable, listLiveSchemas, runLiveQuery, testLiveConnection } from "./db.js";
import { DesktopStorage } from "./storage.js";

interface BackendState {
  activeConnectionId: string;
  sidebarView: DesktopSnapshot["sidebarView"];
  queryTabs: QueryTab[];
  activeTabId: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createEmptyTab(index = 1): QueryTab {
  return {
    id: crypto.randomUUID(),
    title: `Query ${index}`,
    sql: "",
    status: "idle",
  };
}

function ensureTabs(state: BackendState) {
  if (state.queryTabs.length === 0) {
    const tab = createEmptyTab();
    state.queryTabs = [tab];
    state.activeTabId = tab.id;
    return;
  }

  if (!state.queryTabs.some((tab) => tab.id === state.activeTabId)) {
    state.activeTabId = state.queryTabs[0].id;
  }
}

export async function createElectronDesktopBackend(): Promise<HormusDesktopBackend> {
  const storage = new DesktopStorage();
  const connections = await storage.listConnections();
  const state: BackendState = {
    activeConnectionId: connections[0]?.id ?? "",
    sidebarView: "schemas",
    queryTabs: [createEmptyTab()],
    activeTabId: "",
  };
  ensureTabs(state);

  const listSchemas = async (connectionId: string) => {
    const connection = await storage.getConnection(connectionId);
    if (!connection) {
      throw new Error(`Connection ${connectionId} not found`);
    }

    return listLiveSchemas(connection);
  };

  return {
    async bootstrap(connectionId?: string) {
      const currentConnections = await storage.listConnections();

      if (connectionId && currentConnections.some((connection) => connection.id === connectionId)) {
        state.activeConnectionId = connectionId;
      } else if (!currentConnections.some((connection) => connection.id === state.activeConnectionId)) {
        state.activeConnectionId = currentConnections[0]?.id ?? "";
      }
      ensureTabs(state);

      return desktopSnapshotSchema.parse({
        connections: currentConnections,
        activeConnectionId: state.activeConnectionId,
        sidebarView: state.sidebarView,
        queryTabs: state.queryTabs,
        activeTabId: state.activeTabId,
      });
    },

    async listConnections() {
      return storage.listConnections();
    },

    async createConnection(input: ConnectionCreateInput) {
      const connection = await storage.createConnection(input);

      if (!state.activeConnectionId) {
        state.activeConnectionId = connection.id;
      }

      return connection;
    },

	    async updateConnection(input: ConnectionUpdateInput) {
	      return storage.updateConnection(input);
	    },

	    async testConnection(input: ConnectionTestInput) {
	      const storedConnection = input.id ? await storage.getConnection(input.id) : null;
	      return testLiveConnection({
	        ...input,
	        password: input.password ?? storedConnection?.password,
	      });
	    },
	
	    async deleteConnection(input: ConnectionDeleteInput) {
      await storage.deleteConnection(input.id);

      if (state.activeConnectionId === input.id) {
        const remaining = await storage.listConnections();
        state.activeConnectionId = remaining[0]?.id ?? "";
      }

      return { success: true as const };
    },

    async listSchemas(connectionId: string) {
      return listSchemas(connectionId);
    },

    async listTables(input: ListTablesInput) {
      const schemas = await listSchemas(input.connectionId);
      const schema = schemas.find((item) => item.name === input.schema);
      return clone(schema?.tables ?? []);
    },

    async describeTable(input: DescribeTableInput) {
      const connection = await storage.getConnection(input.connectionId);
      if (!connection) {
        throw new Error(`Connection ${input.connectionId} not found`);
      }

      return describeLiveTable(connection, input.schema, input.table);
    },

    async listHistory(connectionId: string) {
      return storage.listHistory(connectionId);
    },

    async getResults(tabId: string) {
      const result = await storage.getResult(tabId);
      return result;
    },

    async runQuery(input: QueryRunInput) {
      let index = state.queryTabs.findIndex((tab) => tab.id === input.tabId);
      if (index === -1) {
        state.queryTabs.push({
          id: input.tabId,
          title: `Query ${state.queryTabs.length + 1}`,
          sql: input.sql,
          selection: input.selection,
          status: "idle",
        });
        index = state.queryTabs.length - 1;
      }

      const connection = await storage.getConnection(input.connectionId);
      if (!connection) {
        throw new Error(`Connection ${input.connectionId} not found`);
      }

      const result = await runLiveQuery(connection, input.selection ?? input.sql);
      const tab: QueryTab = {
        ...state.queryTabs[index],
        sql: input.sql,
        selection: input.selection,
        status: "success",
        lastRunAt: "Just now",
      };

      state.queryTabs[index] = tab;
      await storage.setResult(input.tabId, result);
      await storage.prependHistory(input.connectionId, {
        id: crypto.randomUUID(),
        title: tab.title,
        ranAt: "Just now",
        durationMs: result.durationMs,
        preview: (input.selection ?? input.sql).split("\n").join(" ").slice(0, 72),
      });

      return {
        tab: clone(tab),
        result,
      };
    },
  };
}
