import { ArrowLeft, ChevronDown, Command, Database, Play, Plus, Table2, X } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QueryEditor } from "@/components/query-editor";
import { ResultsGrid } from "@/components/results-grid";
import { cn } from "@/lib/utils";
import { selectActiveConnection, selectActiveTab, useAppStore } from "@/store/use-app-store";

export function QueryWorkspace() {
  const state = useAppStore();
  const activeConnection = selectActiveConnection(state);
  const activeTab = selectActiveTab(state);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");

  if (!activeConnection || !activeTab) {
    return null;
  }

  const selectedSchemaNode = state.schemas.find((schema) => schema.name === state.selectedSchema) ?? state.schemas[0];
  const tableObjects = selectedSchemaNode?.tables ?? [];
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

  return (
    <div className="h-screen overflow-hidden bg-[var(--background)] p-3 text-[var(--foreground)]">
      <Card className="flex h-full w-full flex-row gap-0 overflow-hidden rounded-none bg-[#0f1114] py-0">
        <aside className="hidden w-[68px] shrink-0 border-r border-[var(--border)] bg-[#0b0c0f] lg:flex lg:flex-col lg:items-center lg:justify-between lg:py-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-8 items-center justify-center border border-[var(--border)] bg-[#1b6f4f] text-[13px] font-semibold text-white">
              H
            </div>
            <Button variant="ghost" size="icon">
              <Command className="size-4" />
            </Button>
          </div>
          <div className="text-[10px] text-[var(--muted-foreground)]">DB</div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1">
          <aside className="flex min-h-0 w-[280px] shrink-0 flex-col border-r border-[var(--border)] bg-[#111317]">
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
              <div className="mt-2">
                <Input placeholder="Search tables and objects" />
              </div>
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
                      {tableObjects.map((table) => (
                        <Button
                          key={table.name}
                          type="button"
                          variant="ghost"
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
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="px-2 pb-1 text-[11px] text-[var(--muted-foreground)]">Views</div>
                    <div className="px-2.5 py-2 text-[12px] text-[var(--muted-foreground)]">No views loaded yet.</div>
                  </div>

                  <div>
                    <div className="px-2 pb-1 text-[11px] text-[var(--muted-foreground)]">Functions</div>
                    <div className="px-2.5 py-2 text-[12px] text-[var(--muted-foreground)]">
                      No functions loaded yet.
                    </div>
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
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                  <span>Hormus</span>
                  <span>›</span>
                  <span>{activeConnection.name}</span>
                </div>
                <h1 className="mt-1 truncate text-[22px] font-semibold">{activeTab.title}</h1>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="h-6 rounded-md px-2 text-[11px]">
                  {activeConnection.readOnly ? "read only" : "read / write"}
                </Badge>
                <Button size="sm" onClick={() => void state.runTab(activeTab.id)} disabled={state.isRunningQuery}>
                  <Play className="size-4" />
                  {state.isRunningQuery ? "Running..." : "Run Query"}
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-1 border-b border-[var(--border)] px-3 py-2">
                <Tabs value={activeTab.id} onValueChange={(value) => void state.setActiveTab(value)} className="min-w-0 flex-1">
                  <TabsList className="h-auto max-w-full justify-start gap-1 overflow-hidden rounded-none bg-transparent p-0">
                    {state.queryTabs.map((tab) => (
                      <div
                        key={tab.id}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          startRenamingTab(tab);
                        }}
                        className={cn(
                          "group inline-flex min-w-0 items-center rounded-md text-[13px] transition-colors",
                          tab.id === activeTab.id
                            ? "bg-[var(--panel-elevated)] text-white"
                            : "text-muted-foreground hover:bg-[var(--panel-muted)] hover:text-foreground",
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
                            className="h-7 w-[160px] rounded-md text-[13px]"
                          />
                        ) : (
                          <TabsTrigger
                            value={tab.id}
                            onContextMenu={(event) => {
                              event.preventDefault();
                              startRenamingTab(tab);
                            }}
                            className="h-8 max-w-[180px] justify-start truncate rounded-r-none border-0 bg-transparent px-3 text-[13px] focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:text-inherit data-[state=active]:shadow-none"
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
                          className="mr-1 size-6 rounded-l-none text-inherit hover:bg-transparent hover:text-foreground focus-visible:ring-0"
                        >
                          <X className="size-3" />
                        </Button>
                      </div>
                    ))}
                  </TabsList>
                </Tabs>
                <Button size="icon" variant="ghost" onClick={state.createTab}>
                  <Plus className="size-4" />
                </Button>
              </div>

              <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2">
                <div className="flex items-center gap-2">
                  <Badge>⌘ Enter run</Badge>
                  <Badge>{state.selectedSchema || "schema"}</Badge>
                </div>
                <div className="text-[11px] text-[var(--muted-foreground)]">
                  {activeTab.lastRunAt ? `Last run ${activeTab.lastRunAt}` : "Not run yet"}
                </div>
              </div>

              <ResizablePanelGroup orientation="vertical" className="min-h-0 flex-1">
                <ResizablePanel defaultSize="50%" minSize="25%" maxSize="80%" className="min-h-[160px]">
                  <div className="h-full p-3">
                    <QueryEditor
                      value={activeTab.sql}
                      onChange={(next) => state.updateTabSql(activeTab.id, next)}
                      onSelectionChange={(selection) => state.updateTabSelection(activeTab.id, selection)}
                      onRun={() => void state.runTab(activeTab.id)}
                    />
                  </div>
                </ResizablePanel>

                <ResizableHandle withHandle className="bg-[var(--border)]" />

                <ResizablePanel minSize="20%" className="min-h-[180px] overflow-hidden bg-[var(--panel)]">
                  <ResultsGrid
                    result={state.result ?? undefined}
                    error={state.queryError ?? undefined}
                    queryText={state.lastRunQueryByTab[activeTab.id]}
                    outputHistory={state.outputHistoryByTab[activeTab.id] ?? []}
                    isLoading={state.isRunningQuery}
                    onPageChange={(pageOffset) => void state.runTabPage(activeTab.id, pageOffset)}
                  />
                </ResizablePanel>
              </ResizablePanelGroup>
            </div>
          </main>
        </div>
      </Card>
    </div>
  );
}
