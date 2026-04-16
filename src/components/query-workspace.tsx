import { useEffect, useMemo, useState } from "react";

import { QueryEditor } from "@/components/query-editor";
import { QueryParameterDialog } from "@/components/query-parameter-dialog";
import { ResultsGrid } from "@/components/results-grid";
import { Card } from "@/components/ui/card";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { WorkspaceSidebar } from "@/components/workspace-sidebar";
import { WorkspaceTabBar } from "@/components/workspace-tab-bar";
import { getDesktopApi } from "@/lib/desktop";
import { quoteQualifiedName } from "@/shared/database";
import type { Connection, QueryTab } from "@/shared/ipc";
import { detectSqlParameters, substituteSqlParameters, type SqlParameterPlaceholder } from "@/shared/query";
import { selectActiveConnection, selectActiveTab, useAppStore } from "@/store/use-app-store";

function qualifiedTableName(kind: Connection["kind"], schema: string, table: string) {
  return quoteQualifiedName(kind, schema, table);
}

function buildViewTableSql(kind: Connection["kind"], schema: string, table: string) {
  return `select * from ${qualifiedTableName(kind, schema, table)};`;
}

export function QueryWorkspace() {
  const state = useAppStore();
  const activeConnection = selectActiveConnection(state);
  const activeTab = selectActiveTab(state);
  const [pendingParameterizedRun, setPendingParameterizedRun] = useState<{
    tabId: string;
    query: string;
    parameters: SqlParameterPlaceholder[];
  } | null>(null);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [objectSearch, setObjectSearch] = useState("");
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const combinedOutputHistory = useMemo(
    () =>
      activeConnection && activeTab
        ? [...(state.workspaceOutputByConnection[activeConnection.id] ?? []), ...(state.outputHistoryByTab[activeTab.id] ?? [])].sort(
            (left, right) => right.occurredAt.localeCompare(left.occurredAt),
          )
        : [],
    [activeConnection, activeTab, state.outputHistoryByTab, state.workspaceOutputByConnection],
  );
  useEffect(() => {
    if (!activeConnection) {
      return;
    }

    void getDesktopApi().setWindowTitle(`${activeConnection.name} - Hormus`);
  }, [activeConnection]);

  useEffect(() => {
    const handleShortcuts = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();

      if (key === "w") {
        event.preventDefault();
        if (activeTab) {
          void state.closeTab(activeTab.id);
        }
        return;
      }

      if (key === "t") {
        event.preventDefault();
        void state.createTab();
        return;
      }

      if (key === "q") {
        event.preventDefault();
        const shouldQuit = window.confirm("Are you sure you want to quit?");
        if (shouldQuit) {
          void getDesktopApi().quitApp();
        }
      }
    };

    window.addEventListener("keydown", handleShortcuts, true);
    return () => {
      window.removeEventListener("keydown", handleShortcuts, true);
    };
  }, [activeTab, state]);

  if (!activeConnection || !activeTab) {
    return null;
  }

  const canRunQuery = activeTab.sql.trim().length > 0 && !state.isRunningQuery;
  const startRenamingTab = (tab: QueryTab) => {
    setRenamingTabId(tab.id);
    setRenameDraft(tab.title);
  };
  const commitRename = () => {
    if (renamingTabId) {
      state.renameTab(renamingTabId, renameDraft);
    }
    setRenamingTabId(null);
    setRenameDraft("");
  };
  const openObjectQuery = async (schema: string, objectName: string) => {
    if (!schema) {
      return;
    }

    const sql = buildViewTableSql(activeConnection.kind, schema, objectName);

    await state.createTab({
      title: `View ${objectName}`,
      sql,
      run: true,
    });
  };
  const exportResultsCsv = async () => {
    const executedSql = state.lastRunQueryByTab[activeTab.id];
    if (!executedSql || isExportingCsv) {
      return;
    }

    setIsExportingCsv(true);
    try {
      await getDesktopApi().exportQueryCsv({
        connectionId: activeConnection.id,
        sql: executedSql,
        suggestedFileName: `${activeTab.title || "query-results"}.csv`,
      });
    } finally {
      setIsExportingCsv(false);
    }
  };
  const requestRun = async (tab: QueryTab, query: string) => {
    const parameters = detectSqlParameters(query);
    if (parameters.length === 0) {
      if (!tab.selection && query === tab.sql) {
        await state.runTab(tab.id);
      } else {
        await state.runTab(tab.id, query);
      }
      return;
    }

    setPendingParameterizedRun({
      tabId: tab.id,
      query,
      parameters,
    });
  };

  return (
    <div className="h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
      <Card
        className="flex h-full w-full flex-row gap-0 overflow-hidden rounded-none border-0 py-0 shadow-none backdrop-blur-sm"
        style={{ backgroundColor: "rgba(15, 17, 20, 0.82)" }}
      >
        <div className="flex min-h-0 min-w-0 flex-1">
          <WorkspaceSidebar
            activeConnection={activeConnection}
            objectSearch={objectSearch}
            onObjectSearchChange={setObjectSearch}
            schemas={state.schemas}
            selectedSchema={state.selectedSchema}
            setSelectedSchema={state.setSelectedSchema}
            ensureSchemaHydrated={(schemaName) => void state.ensureSchemaHydrated(activeConnection.id, schemaName)}
            onOpenObject={(schemaName, objectName) => void openObjectQuery(schemaName, objectName)}
            onBack={state.returnToCollectionManager}
          />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col">
                <WorkspaceTabBar
                  activeTabId={activeTab.id}
                  canRunQuery={canRunQuery}
                isRunningQuery={state.isRunningQuery}
                queryTabs={state.queryTabs}
                renamingTabId={renamingTabId}
                renameDraft={renameDraft}
                setRenameDraft={setRenameDraft}
                onStartRenamingTab={startRenamingTab}
                onCommitRename={commitRename}
                onCancelRename={() => {
                  setRenamingTabId(null);
                  setRenameDraft("");
                }}
                onSetActiveTab={(value) => void state.setActiveTab(value)}
                onCloseTab={(tabId) => void state.closeTab(tabId)}
                onCreateTab={() => void state.createTab()}
                onRunActiveTab={() => void requestRun(activeTab, activeTab.selection ?? activeTab.sql)}
              />

                <ResizablePanelGroup direction="vertical" className="min-h-0 flex-1">
                <ResizablePanel defaultSize="50%" minSize="25%" maxSize="80%" className="min-h-[160px]">
                  <div className="h-full p-3">
                    <QueryEditor
                      value={activeTab.sql}
                      onChange={(next) => state.updateTabSql(activeTab.id, next)}
                      onSelectionChange={(selection) => state.updateTabSelection(activeTab.id, selection)}
                      schemas={state.schemas}
                      selectedSchema={state.selectedSchema}
                      connectionKind={activeConnection.kind}
                      onRunQuery={(query) => {
                        if (query.trim()) {
                          void requestRun(activeTab, query);
                        }
                      }}
                      onRun={() => {
                        if (canRunQuery) {
                          void requestRun(activeTab, activeTab.selection ?? activeTab.sql);
                        }
                      }}
                    />
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle className="bg-[var(--border)]" />

                <ResizablePanel
                  minSize="20%"
                  className="min-h-[180px] overflow-hidden backdrop-blur-sm"
                  style={{ backgroundColor: "rgba(17, 19, 23, 0.78)" }}
                >
                  <ResultsGrid
                    result={state.result ?? undefined}
                    error={state.queryError ?? undefined}
                    queryText={state.lastRunQueryByTab[activeTab.id]}
                    outputHistory={combinedOutputHistory}
                    isLoading={state.isRunningQuery}
                    onPageChange={(pageOffset) => void state.runTabPage(activeTab.id, pageOffset)}
                    onExportCsv={() => void exportResultsCsv()}
                    isExportingCsv={isExportingCsv}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </main>
        </div>
      </Card>
      <QueryParameterDialog
        open={pendingParameterizedRun !== null}
        parameters={pendingParameterizedRun?.parameters ?? []}
        onCancel={() => setPendingParameterizedRun(null)}
        onSubmit={(values) => {
          if (!pendingParameterizedRun) {
            return;
          }

          const nextQuery = substituteSqlParameters(pendingParameterizedRun.query, values);
          const tabId = pendingParameterizedRun.tabId;
          setPendingParameterizedRun(null);
          void state.runTab(tabId, nextQuery);
        }}
      />
    </div>
  );
}
