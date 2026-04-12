import { ArrowLeft, ChevronDown, Database, Play, Plus, Search, Table2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryEditor } from "@/components/query-editor";
import { ResultsGrid } from "@/components/results-grid";
import { getDesktopApi } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { buildDescribeTableSql, quoteQualifiedName } from "@/shared/database";
import { selectActiveConnection, selectActiveTab, useAppStore } from "@/store/use-app-store";
import type { Connection, SchemaNode } from "@/shared/ipc";

type SchemaTable = SchemaNode["tables"][number];
type SchemaView = SchemaNode["views"][number];
type SchemaFunction = SchemaNode["functions"][number];
type TableContextMenu = {
  x: number;
  y: number;
  schema: string;
  table: SchemaTable;
};

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
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [objectSearch, setObjectSearch] = useState("");
  const [isObjectSearchVisible, setIsObjectSearchVisible] = useState(false);
  const [tableContextMenu, setTableContextMenu] = useState<TableContextMenu | null>(null);
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
  const selectedSchemaNode = state.schemas.find((schema) => schema.name === state.selectedSchema) ?? state.schemas[0];
  const tableObjects = selectedSchemaNode?.tables ?? [];
  const viewObjects = selectedSchemaNode?.views ?? [];
  const functionObjects = selectedSchemaNode?.functions ?? [];
  const objectFilter = objectSearch.trim().toLowerCase();
  const filteredTableObjects = useMemo(() => {
    if (!objectFilter) {
      return tableObjects;
    }

    return tableObjects.filter((table) =>
      [table.name, `${table.columns} columns`, table.rowCount].join(" ").toLowerCase().includes(objectFilter),
    );
  }, [objectFilter, tableObjects]);
  const filteredViewObjects = useMemo(() => {
    if (!objectFilter) {
      return viewObjects;
    }

    return viewObjects.filter((view) => [view.name, `${view.columns} columns`].join(" ").toLowerCase().includes(objectFilter));
  }, [objectFilter, viewObjects]);
  const filteredFunctionObjects = useMemo(() => {
    if (!objectFilter) {
      return functionObjects;
    }

    return functionObjects.filter((fn) => fn.name.toLowerCase().includes(objectFilter));
  }, [functionObjects, objectFilter]);

  useEffect(() => {
    if (!tableContextMenu) {
      return undefined;
    }

    const closeMenu = () => setTableContextMenu(null);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [tableContextMenu]);

  useEffect(() => {
    if (!activeConnection) {
      return;
    }

    void getDesktopApi().setWindowTitle(`${activeConnection.name} - Hormus`);
  }, [activeConnection]);

  if (!activeConnection || !activeTab) {
    return null;
  }

  const canRunQuery = activeTab.sql.trim().length > 0 && !state.isRunningQuery;
  const startRenamingTab = (tab: typeof activeTab) => {
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
  const openTableQuery = async (schema: string, table: SchemaTable, action: "view" | "describe") => {
    if (!schema) {
      return;
    }

    setTableContextMenu(null);
    const sql =
      action === "view"
        ? buildViewTableSql(activeConnection.kind, schema, table.name)
        : buildDescribeTableSql(activeConnection.kind, schema, table.name);

    await state.createTab({
      title: action === "view" ? `View ${table.name}` : `Describe ${table.name}`,
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
  const renderSecondaryObjectList = (
    objects: SchemaView[] | SchemaFunction[],
    kind: "view" | "function",
    emptyLabel: string,
  ) => {
    if (objects.length === 0) {
      return <div className="px-2.5 py-2 text-[12px] text-[var(--muted-foreground)]">{emptyLabel}</div>;
    }

    return (
      <div className="space-y-0.5">
        {objects.map((object) => (
          <Button
            key={object.name}
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start rounded-md px-2.5 py-2 text-left"
          >
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium">{object.name}</p>
              <p className="text-[11px] text-[var(--muted-foreground)]">
                {kind === "view" && "columns" in object ? `${object.columns} columns` : "Function"}
              </p>
            </div>
          </Button>
        ))}
      </div>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-[var(--background)] pt-[var(--window-titlebar-height)] text-[var(--foreground)]">
      <Card
        className="flex h-full w-full flex-row gap-0 overflow-hidden rounded-none border-0 py-0 shadow-none backdrop-blur-sm"
        style={{ backgroundColor: "rgba(15, 17, 20, 0.82)" }}
      >
        <div className="flex min-h-0 min-w-0 flex-1">
          <aside
            className="flex min-h-0 w-[280px] shrink-0 flex-col border-r border-[var(--border)] backdrop-blur-sm"
            style={{
              background: `linear-gradient(180deg, color-mix(in srgb, ${activeConnection.color} 32%, rgba(17, 19, 23, 0.8)) 0%, color-mix(in srgb, ${activeConnection.color} 16%, rgba(17, 19, 23, 0.76)) 55%, rgba(17, 19, 23, 0.72) 100%)`,
            }}
          >
            <div className="border-b border-[var(--border)] px-4 py-4">
              <div className="flex items-center gap-2">
                <div
                  className="flex size-6 items-center justify-center border border-[var(--border)] text-white"
                  style={{ backgroundColor: activeConnection.color }}
                >
                  <Database className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-semibold">{activeConnection.name}</p>
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: activeConnection.color }} />
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--muted-foreground)]">
                    <span>{activeConnection.kind}</span>
                    <span>•</span>
                    <span>{activeConnection.database}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                    {activeConnection.username}@{activeConnection.host}:{activeConnection.port}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-b border-[var(--border)] px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Schema</p>
                <ChevronDown className="size-3 text-[var(--muted-foreground)]" />
              </div>
              <Select value={state.selectedSchema} onValueChange={state.setSelectedSchema}>
                <SelectTrigger>
                  <SelectValue placeholder="Select schema" />
                </SelectTrigger>
                <SelectContent>
                  {state.schemas.map((schema) => (
                    <SelectItem key={schema.name} value={schema.name}>
                      {schema.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isObjectSearchVisible ? (
                <div className="mt-2">
                  <Input
                    autoFocus
                    value={objectSearch}
                    onChange={(event) => setObjectSearch(event.target.value)}
                    placeholder="Search tables and objects"
                  />
                </div>
              ) : (
                <div className="mt-2 flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Search tables and objects"
                    className="size-8"
                    onClick={() => setIsObjectSearchVisible(true)}
                  >
                    <Search className="size-4" />
                  </Button>
                </div>
              )}
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="px-2 py-3">
                <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Database Objects
                </div>

                <div className="space-y-4">
                  <div>
                    <div className="px-2 pb-1 text-[11px] text-[var(--muted-foreground)]">Tables</div>
                    <div className="space-y-0.5">
                      {filteredTableObjects.length > 0 ? (
                        filteredTableObjects.map((table) => (
                          <Button
                            key={table.name}
                            type="button"
                            variant="ghost"
                            onContextMenu={(event) => {
                              event.preventDefault();
                              setTableContextMenu({
                                x: event.clientX,
                                y: event.clientY,
                                schema: selectedSchemaNode?.name ?? state.selectedSchema,
                                table,
                              });
                            }}
                            className="h-auto w-full justify-between rounded-md px-2.5 py-2 text-left"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              <Table2 className="size-3.5 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium">{table.name}</p>
                                <p className="text-[11px] text-[var(--muted-foreground)]">{table.columns} columns</p>
                              </div>
                            </div>
                            <span className="pl-2 text-[11px] text-[var(--muted-foreground)]">{table.rowCount || " "}</span>
                          </Button>
                        ))
                      ) : (
                        <div className="px-2.5 py-2 text-[12px] text-[var(--muted-foreground)]">
                          {objectSearch.trim() ? "No matching tables." : "No tables loaded yet."}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="px-2 pb-1 text-[11px] text-[var(--muted-foreground)]">Views</div>
                    {renderSecondaryObjectList(
                      filteredViewObjects,
                      "view",
                      objectSearch.trim() ? "No matching views." : "No views loaded yet.",
                    )}
                  </div>

                  <div>
                    <div className="px-2 pb-1 text-[11px] text-[var(--muted-foreground)]">Functions</div>
                    {renderSecondaryObjectList(
                      filteredFunctionObjects,
                      "function",
                      objectSearch.trim() ? "No matching functions." : "No functions loaded yet.",
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>

            <div className="border-t border-[var(--border)] p-3">
              <Button variant="ghost" size="sm" onClick={state.returnToCollectionManager} className="w-full justify-start">
                <ArrowLeft className="size-4" />
                Back to Connections
              </Button>
            </div>
          </aside>

          <main className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col">
              <div
                className="flex h-11 items-end border-b border-[var(--border)] px-3 backdrop-blur-sm"
                style={{ backgroundColor: "rgba(16, 18, 22, 0.78)" }}
              >
                <Tabs value={activeTab.id} onValueChange={(value) => void state.setActiveTab(value)} className="min-w-0 flex-1">
                  <TabsList className="h-auto max-w-full justify-start gap-0 overflow-visible rounded-none bg-transparent p-0">
                    {state.queryTabs.map((tab) => (
                      <div
                        key={tab.id}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          startRenamingTab(tab);
                        }}
                        className={cn(
                          "group relative -mb-px inline-flex h-10 min-w-0 items-center border-r border-[var(--border)] text-[13px] transition-colors",
                          tab.id === activeTab.id
                            ? "z-10 border-x border-t border-b border-t-[var(--border)] border-b-white bg-[#0f1114] text-white after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-white after:content-['']"
                            : "border-b border-b-[var(--border)] text-muted-foreground hover:bg-[var(--panel-muted)] hover:text-foreground",
                        )}
                      >
                        {renamingTabId === tab.id ? (
                          <Input
                            autoFocus
                            value={renameDraft}
                            onChange={(event) => setRenameDraft(event.target.value)}
                            onBlur={commitRename}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                commitRename();
                              }
                              if (event.key === "Escape") {
                                setRenamingTabId(null);
                                setRenameDraft("");
                              }
                            }}
                            onClick={(event) => event.stopPropagation()}
                            className="h-7 w-[160px] rounded-none border-0 bg-transparent text-[13px] focus-visible:ring-0"
                          />
                        ) : (
                          <TabsTrigger
                            value={tab.id}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              startRenamingTab(tab);
                            }}
                            className="h-full max-w-[180px] justify-start truncate rounded-none border-0 bg-transparent px-4 text-[13px] hover:bg-transparent focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:text-inherit data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
                          >
                            <span className="truncate">{tab.title}</span>
                          </TabsTrigger>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Close ${tab.title}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            void state.closeTab(tab.id);
                          }}
                          className="mr-2 size-6 rounded-none bg-transparent text-inherit hover:bg-[var(--panel-elevated)] hover:text-foreground focus-visible:ring-0"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </TabsList>
                </Tabs>
                <Button size="icon" variant="ghost" onClick={() => void state.createTab()} className="mb-1 size-8 rounded-none">
                  <Plus className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => void state.runTab(activeTab.id)}
                  disabled={!canRunQuery}
                  aria-label={state.isRunningQuery ? "Running query" : "Run query"}
                  className="mb-1 size-8 rounded-none text-[#55c27a] hover:text-[#6fd68f] disabled:text-[#3d6b4b]"
                >
                  <Play className="size-4 fill-current" />
                </Button>
              </div>

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
                          void state.runTab(activeTab.id, query);
                        }
                      }}
                      onRun={() => {
                        if (canRunQuery) {
                          void state.runTab(activeTab.id);
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
      {tableContextMenu ? (
        <Card
          className="fixed z-50 w-44 gap-0 rounded-md border border-[var(--border)] bg-[var(--popover)] p-1 py-1 shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
          style={{ left: tableContextMenu.x, top: tableContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start rounded-[4px]"
            onClick={() => void openTableQuery(tableContextMenu.schema, tableContextMenu.table, "view")}
          >
            View
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full justify-start rounded-[4px]"
            onClick={() => void openTableQuery(tableContextMenu.schema, tableContextMenu.table, "describe")}
          >
            Describe
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
