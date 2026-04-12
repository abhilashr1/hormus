import { ArrowLeft, ChevronDown, ChevronRight, Database, Eye, Play, Plus, Sigma, Table2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryEditor } from "@/components/query-editor";
import { ResultsGrid } from "@/components/results-grid";
import { getDesktopApi } from "@/lib/desktop";
import { cn } from "@/lib/utils";
import { quoteQualifiedName } from "@/shared/database";
import { selectActiveConnection, selectActiveTab, useAppStore } from "@/store/use-app-store";
import type { Connection } from "@/shared/ipc";
type ExplorerItem = {
  id: string;
  kind: "table" | "view" | "function";
  name: string;
  subtitle: string;
  queryable: boolean;
};
type ObjectContextMenu = {
  x: number;
  y: number;
  schema: string;
  itemName: string;
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
  const [expandedSchemas, setExpandedSchemas] = useState<Record<string, boolean>>({});
  const [objectContextMenu, setObjectContextMenu] = useState<ObjectContextMenu | null>(null);
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
  const objectFilter = objectSearch.trim().toLowerCase();
  const filteredSchemas = useMemo(
    () =>
      state.schemas
        .map((schema) => {
          const items: ExplorerItem[] = [
            ...schema.tables.map((table) => ({
              id: `table:${schema.name}:${table.name}`,
              kind: "table" as const,
              name: table.name,
              subtitle: [table.rowCount, `${table.columns} columns`].filter(Boolean).join(" • "),
              queryable: true,
            })),
            ...schema.views.map((view) => ({
              id: `view:${schema.name}:${view.name}`,
              kind: "view" as const,
              name: view.name,
              subtitle: `${view.columns} columns`,
              queryable: true,
            })),
            ...schema.functions.map((fn) => ({
              id: `function:${schema.name}:${fn.name}`,
              kind: "function" as const,
              name: fn.name,
              subtitle: "Function",
              queryable: false,
            })),
          ];

          if (!objectFilter) {
            return { ...schema, items };
          }

          const filteredItems = items.filter((item) => [item.name, item.subtitle, schema.name].join(" ").toLowerCase().includes(objectFilter));
          const matchesSchema = schema.name.toLowerCase().includes(objectFilter);

          if (matchesSchema) {
            return { ...schema, items };
          }

          return { ...schema, items: filteredItems };
        })
        .filter((schema) => !objectFilter || schema.name.toLowerCase().includes(objectFilter) || schema.items.length > 0)
        .sort((left, right) => {
          const leftPriority = left.name === state.selectedSchema || expandedSchemas[left.name] ? 0 : 1;
          const rightPriority = right.name === state.selectedSchema || expandedSchemas[right.name] ? 0 : 1;

          if (leftPriority !== rightPriority) {
            return leftPriority - rightPriority;
          }

          if (left.name === state.selectedSchema && right.name !== state.selectedSchema) {
            return -1;
          }

          if (right.name === state.selectedSchema && left.name !== state.selectedSchema) {
            return 1;
          }

          return left.name.localeCompare(right.name);
        }),
    [expandedSchemas, objectFilter, state.schemas, state.selectedSchema],
  );

  useEffect(() => {
    if (!objectContextMenu) {
      return undefined;
    }

    const closeMenu = () => setObjectContextMenu(null);
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
  }, [objectContextMenu]);

  useEffect(() => {
    if (!state.selectedSchema) {
      return;
    }

    setExpandedSchemas((current) => (current[state.selectedSchema] ? current : { ...current, [state.selectedSchema]: true }));
  }, [state.selectedSchema]);

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
  const openObjectQuery = async (schema: string, objectName: string) => {
    if (!schema) {
      return;
    }

    setObjectContextMenu(null);
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
  const toggleSchema = (schemaName: string) => {
    const nextExpanded = !expandedSchemas[schemaName];
    setExpandedSchemas((current) => ({ ...current, [schemaName]: nextExpanded }));
    state.setSelectedSchema(schemaName);

    if (nextExpanded && activeConnection) {
      void state.ensureSchemaHydrated(activeConnection.id, schemaName);
    }
  };

  const renderSchemaItems = (schemaName: string, items: ExplorerItem[]) => {
    if (items.length === 0) {
      return (
        <div className="px-2.5 py-2 text-[12px] text-[var(--muted-foreground)]">
          {objectFilter ? "No matching objects." : "No objects loaded yet."}
        </div>
      );
    }

    return (
      <div className="space-y-0.5">
        {items.map((item) => (
          <Button
            key={item.id}
            type="button"
            variant="ghost"
            onClick={() => state.setSelectedSchema(schemaName)}
            onContextMenu={
              item.queryable
                ? (event) => {
                    event.preventDefault();
                    setObjectContextMenu({
                      x: event.clientX,
                      y: event.clientY,
                      schema: schemaName,
                      itemName: item.name,
                    });
                  }
                : undefined
            }
            className="h-auto w-full justify-start rounded-md px-2.5 py-2 text-left"
          >
            <div className="flex min-w-0 items-center gap-2">
              {item.kind === "table" ? (
                <Table2 className="size-3.5 shrink-0 text-muted-foreground" />
              ) : item.kind === "view" ? (
                <Eye className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <Sigma className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{item.name}</p>
                <p className="text-[11px] text-[var(--muted-foreground)]">{item.subtitle}</p>
              </div>
            </div>
          </Button>
        ))}
      </div>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)]">
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
            <div className="border-b border-[var(--border)] px-4 pb-4 pt-[calc(var(--window-titlebar-height)+0.5rem)]">
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
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">Database</p>
              </div>
              <Select value={activeConnection.database} disabled>
                <SelectTrigger disabled>
                  <span className="truncate">{activeConnection.database}</span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={activeConnection.database}>{activeConnection.database}</SelectItem>
                </SelectContent>
              </Select>
              <div className="mt-2">
                <Input
                  value={objectSearch}
                  onChange={(event) => setObjectSearch(event.target.value)}
                  placeholder="Filter"
                />
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="px-2 py-3">
                <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Schemas
                </div>

                <div className="space-y-1">
                  {filteredSchemas.length > 0 ? (
                    filteredSchemas.map((schema) => {
                      const isExpanded = objectFilter ? true : Boolean(expandedSchemas[schema.name]);
                      const isSelected = schema.name === state.selectedSchema;

                      return (
                        <div key={schema.name} className="space-y-1">
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => toggleSchema(schema.name)}
                            className={cn(
                              "h-auto w-full justify-start rounded-md px-2 py-2 text-left",
                              isSelected && "bg-[var(--panel-muted)] text-foreground",
                            )}
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                              )}
                              <Database className="size-3.5 shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <p className="truncate text-[13px] font-medium">{schema.name}</p>
                                <p className="text-[11px] text-[var(--muted-foreground)]">{schema.items.length} objects</p>
                              </div>
                            </div>
                          </Button>

                          {isExpanded ? <div className="ml-4">{renderSchemaItems(schema.name, schema.items)}</div> : null}
                        </div>
                      );
                    })
                  ) : (
                    <div className="px-2.5 py-2 text-[12px] text-[var(--muted-foreground)]">
                      {objectFilter ? "No matching schemas or objects." : "No schemas loaded yet."}
                    </div>
                  )}
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
                className="flex h-[calc(2.75rem+var(--window-titlebar-height))] items-end border-b border-[var(--border)] px-3 backdrop-blur-sm"
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
      {objectContextMenu ? (
        <Card
          className="fixed z-50 w-40 gap-0 rounded-md border border-[var(--border)] bg-[var(--popover)] p-1 py-1 text-[12px] shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
          style={{ left: objectContextMenu.x, top: objectContextMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 w-full justify-start rounded-[4px] px-2 text-[12px]"
            onClick={() => void openObjectQuery(objectContextMenu.schema, objectContextMenu.itemName)}
          >
            View
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
