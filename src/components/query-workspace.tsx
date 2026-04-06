import { ArrowLeft, ChevronDown, Command, Database, Play, Plus, Search, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { QueryEditor } from "@/components/query-editor";
import { ResultsGrid } from "@/components/results-grid";
import { cn } from "@/lib/utils";
import { selectActiveConnection, selectActiveTab, useAppStore } from "@/store/use-app-store";

export function QueryWorkspace() {
  const state = useAppStore();
  const activeConnection = selectActiveConnection(state);
  const activeTab = selectActiveTab(state);

  if (!activeConnection || !activeTab) {
    return null;
  }

  const selectedSchemaNode = state.schemas.find((schema) => schema.name === state.selectedSchema) ?? state.schemas[0];
  const tableObjects = selectedSchemaNode?.tables ?? [];

  return (
    <div className="min-h-screen bg-[var(--background)] p-3 text-[var(--foreground)]">
      <div className="mx-auto flex min-h-[calc(100vh-0.75rem)] max-w-[1600px] overflow-hidden border border-[var(--border)] bg-[#0f1114]">
        <aside className="hidden w-[68px] shrink-0 border-r border-[var(--border)] bg-[#0b0c0f] lg:flex lg:flex-col lg:items-center lg:justify-between lg:py-4">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-8 items-center justify-center border border-[var(--border)] bg-[#1b6f4f] text-[13px] font-semibold text-white">
              H
            </div>
            <Button variant="ghost" size="icon">
              <Search className="size-4" />
            </Button>
            <Button variant="ghost" size="icon">
              <Command className="size-4" />
            </Button>
          </div>
          <div className="text-[10px] text-[var(--muted-foreground)]">DB</div>
        </aside>

        <div className="flex min-w-0 flex-1">
          <aside className="flex w-[280px] shrink-0 flex-col border-r border-[var(--border)] bg-[#111317]">
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
              <Select value={state.selectedSchema} onChange={(event) => state.setSelectedSchema(event.target.value)}>
                {state.schemas.map((schema) => (
                  <option key={schema.name} value={schema.name}>
                    {schema.name}
                  </option>
                ))}
              </Select>
              <div className="mt-2">
                <Input placeholder="Search tables and objects" />
              </div>
            </div>

            <div className="flex-1 overflow-auto px-2 py-3">
              <div className="px-2 pb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                Database Objects
              </div>

              <div className="space-y-4">
                <div>
                  <div className="px-2 pb-1 text-[11px] text-[var(--muted-foreground)]">Tables</div>
                  <div className="space-y-0.5">
                    {tableObjects.map((table) => (
                      <button
                        key={table.name}
                        className="flex w-full items-center justify-between px-2.5 py-2 text-left transition-colors hover:bg-[var(--panel-muted)]"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <Table2 className="size-3.5 shrink-0 text-[var(--accent)]" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-medium">{table.name}</p>
                            <p className="text-[11px] text-[var(--muted-foreground)]">{table.columns} columns</p>
                          </div>
                        </div>
                        <span className="pl-2 text-[11px] text-[var(--muted-foreground)]">{table.rowCount || " "}</span>
                      </button>
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

            <div className="border-t border-[var(--border)] p-3">
              <Button variant="ghost" size="sm" onClick={state.returnToCollectionManager} className="w-full justify-start">
                <ArrowLeft className="size-4" />
                Back to Connections
              </Button>
            </div>
          </aside>

          <main className="flex min-w-0 flex-1 flex-col">
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
                <span
                  className="h-6 rounded-[6px] px-2 text-[11px] leading-6 text-white"
                  style={{ backgroundColor: activeConnection.color }}
                >
                  {activeConnection.readOnly ? "read only" : "read / write"}
                </span>
                <Button size="sm" onClick={() => void state.runTab(activeTab.id)} disabled={state.isRunningQuery}>
                  <Play className="size-4" />
                  {state.isRunningQuery ? "Running..." : "Run Query"}
                </Button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-1 border-b border-[var(--border)] px-3 py-2">
                {state.queryTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      void state.setActiveTab(tab.id);
                    }}
                    className={cn(
                      "px-3 py-1.5 text-[13px] transition-colors",
                      tab.id === activeTab.id
                        ? "bg-[var(--panel-elevated)] text-white"
                        : "text-[var(--muted-foreground)] hover:bg-[var(--panel-muted)] hover:text-white",
                    )}
                  >
                    {tab.title}
                  </button>
                ))}
                <Button size="icon" variant="ghost" onClick={state.createTab}>
                  <Plus className="size-4" />
                </Button>
                <Button size="icon" variant="ghost">
                  <Search className="size-4" />
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

              <div className="min-h-0 flex-1 p-3">
                <QueryEditor value={activeTab.sql} onChange={(next) => state.updateTabSql(activeTab.id, next)} />
              </div>
            </div>

            <div className="min-h-[290px] border-t border-[var(--border)] bg-[var(--panel)]">
              <ResultsGrid result={state.result ?? undefined} error={state.queryError ?? undefined} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
