import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type CellClickedEvent, type ColDef, type SelectionChangedEvent } from "ag-grid-community";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { QueryResult } from "@/shared/ipc";
import { QUERY_RESULT_PAGE_SIZE } from "@/shared/query";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

ModuleRegistry.registerModules([AllCommunityModule]);

interface ResultsGridProps {
  result?: QueryResult;
  error?: string;
  queryText?: string;
  outputHistory?: Array<{
    id: string;
    query: string;
    message: string;
    status: "success" | "error";
    ranAt: string;
  }>;
  isLoading?: boolean;
  onPageChange?: (pageOffset: number) => void;
}

type ResultsPanelTab = "output" | "results";
type ResultRow = QueryResult["rows"][number];

function estimateColumnWidth(column: string, rows: QueryResult["rows"]) {
  const valueLengths = rows.slice(0, 100).map((row) => String(row[column] ?? "").length);
  const maxLength = Math.max(column.length, ...valueLengths);
  return Math.min(360, Math.max(52, maxLength * 8 + 28));
}

function valueToClipboardText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function csvEscape(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function rowsToClipboardText(rows: ResultRow[], columns: string[]) {
  return rows.map((row) => columns.map((column) => csvEscape(valueToClipboardText(row[column]))).join(",")).join("\n");
}

export function ResultsGrid({ result, error, queryText, outputHistory = [], isLoading, onPageChange }: ResultsGridProps) {
  const [activePanel, setActivePanel] = useState<ResultsPanelTab>("output");
  const [isResultsTabClosed, setIsResultsTabClosed] = useState(false);
  const selectedRowsRef = useRef<ResultRow[]>([]);
  const lastClickedCellRef = useRef<string | null>(null);
  const hasResults = Boolean(result && result.columns.length > 0);
  const showResultsTab = hasResults && !isResultsTabClosed;
  const totalRows = result?.rowCount ?? 0;
  const pageSize = result?.pageSize ?? QUERY_RESULT_PAGE_SIZE;
  const currentOffset = result?.pageOffset ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(Math.floor(currentOffset / pageSize), pageCount - 1);
  const canGoBack = currentPage > 0 && !isLoading;
  const canGoForward = currentPage < pageCount - 1 && !isLoading;

  useEffect(() => {
    setActivePanel((current) => (current === "results" && !showResultsTab ? "output" : current));
  }, [showResultsTab]);

  useEffect(() => {
    if (error) {
      setActivePanel("output");
      return;
    }

    if (hasResults) {
      setIsResultsTabClosed(false);
      setActivePanel("results");
    }
  }, [error, hasResults, result]);

  useEffect(() => {
    selectedRowsRef.current = [];
    lastClickedCellRef.current = null;
  }, [result]);

  const columnDefs = useMemo<ColDef[]>(
    () =>
      (result?.columns ?? []).map((column: string) => ({
        field: column,
        colId: column,
        headerName: column,
        sortable: true,
        resizable: true,
        width: estimateColumnWidth(column, result?.rows ?? []),
        valueFormatter: ({ value }) => (value === null || value === undefined ? "" : String(value)),
      })),
    [result],
  );

  const resultSummary = error
    ? "Query failed"
    : result
      ? `Returned ${totalRows.toLocaleString()} rows in ${result.durationMs}ms`
      : "Run a query to see output";
  const copyResultsSelection = async (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (activePanel !== "results" || event.key.toLowerCase() !== "c" || (!event.metaKey && !event.ctrlKey)) {
      return;
    }

    const selectedRows = selectedRowsRef.current;
    const clipboardText =
      selectedRows.length > 0
        ? rowsToClipboardText(selectedRows, result?.columns ?? [])
        : lastClickedCellRef.current;

    if (clipboardText === null || clipboardText === undefined) {
      return;
    }

    event.preventDefault();
    try {
      await navigator.clipboard.writeText(clipboardText);
    } catch {
      // Clipboard writes can be denied by the host environment.
    }
  };

  return (
    <Card
      className="flex h-full min-h-0 flex-col gap-0 overflow-hidden rounded-none py-0"
      onKeyDownCapture={(event) => void copyResultsSelection(event)}
    >
      <div className="flex h-11 items-end justify-between border-b border-[var(--border)] bg-[#101216] px-3">
        <Tabs value={activePanel} onValueChange={(value) => setActivePanel(value as ResultsPanelTab)} className="min-w-0">
          <TabsList className="h-auto gap-0 rounded-none bg-transparent p-0">
            <div
              className={cn(
                "group relative -mb-px inline-flex h-10 min-w-0 items-center border-r border-[var(--border)] text-[13px] transition-colors",
                activePanel === "output"
                  ? "z-10 border-x border-t border-b border-t-[var(--border)] border-b-white bg-[var(--card)] text-white after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-white after:content-['']"
                  : "border-b border-b-[var(--border)] text-muted-foreground hover:bg-[var(--panel-muted)] hover:text-foreground",
              )}
            >
              <TabsTrigger
                value="output"
                className="h-full justify-start truncate rounded-none border-0 bg-transparent px-4 text-[13px] hover:bg-transparent focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:text-inherit data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
              >
                Output
              </TabsTrigger>
            </div>
            {showResultsTab ? (
              <div
                className={cn(
                  "group relative -mb-px inline-flex h-10 min-w-0 items-center border-r border-[var(--border)] text-[13px] transition-colors",
                  activePanel === "results"
                    ? "z-10 border-x border-t border-b border-t-[var(--border)] border-b-white bg-[var(--card)] text-white after:absolute after:inset-x-0 after:-bottom-px after:h-px after:bg-white after:content-['']"
                    : "border-b border-b-[var(--border)] text-muted-foreground hover:bg-[var(--panel-muted)] hover:text-foreground",
                )}
              >
                <TabsTrigger
                  value="results"
                  className="h-full justify-start truncate rounded-none border-0 bg-transparent px-4 text-[13px] hover:bg-transparent focus-visible:ring-0 data-[state=active]:bg-transparent data-[state=active]:text-inherit data-[state=active]:shadow-none dark:data-[state=active]:bg-transparent"
                >
                  Results
                </TabsTrigger>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close Results tab"
                  onClick={() => {
                    setIsResultsTabClosed(true);
                    setActivePanel("output");
                  }}
                  className="mr-2 size-6 rounded-none bg-transparent text-inherit hover:bg-[var(--panel-elevated)] hover:text-foreground focus-visible:ring-0"
                >
                  <X className="size-3" />
                </Button>
              </div>
            ) : null}
          </TabsList>
        </Tabs>
        <Badge
          variant={error ? "destructive" : "secondary"}
          className={cn(
            "mb-2",
            error ? "border-red-500/30 bg-red-500/10 text-red-200" : undefined,
          )}
        >
          {error ? "error" : result ? "complete" : "idle"}
        </Badge>
      </div>
      {activePanel === "output" ? (
        <ScrollArea className="min-h-0 flex-1">
          <div className="p-4">
          {outputHistory.length > 0 ? (
            <div className="space-y-4">
              {outputHistory.map((entry) => (
                <Card key={entry.id} className="gap-0 rounded-none bg-[#0f1114] py-0">
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                    <p className={cn("text-[13px]", entry.status === "error" ? "text-red-300" : "text-[var(--foreground)]")}>
                      {entry.message}
                    </p>
                    <span className="text-[11px] text-[var(--muted-foreground)]">{entry.ranAt}</span>
                  </div>
                  <ScrollArea className="max-h-[180px]">
                    <pre className="p-3 font-mono text-[12px] leading-5 text-[var(--foreground)]">{entry.query}</pre>
                  </ScrollArea>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Status
                </p>
                <p className={cn("mt-1 text-[13px]", error ? "text-red-300" : "text-[var(--foreground)]")}>
                  {error ?? resultSummary}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-foreground)]">
                  Query
                </p>
                <ScrollArea className="mt-2 max-h-[220px] border border-[var(--border)] bg-[#0f1114]">
                  <pre className="p-3 font-mono text-[12px] leading-5 text-[var(--foreground)]">
                    {queryText?.trim() ? queryText : "No query has been run yet."}
                  </pre>
                </ScrollArea>
              </div>
            </div>
          )}
          </div>
        </ScrollArea>
      ) : (
        <>
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <div className="text-[12px] text-[var(--muted-foreground)]">
              Page {currentPage + 1}, Total Results: {totalRows.toLocaleString()}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => onPageChange?.(0)} disabled={!canGoBack}>
                <ChevronsLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onPageChange?.(Math.max(0, currentOffset - pageSize))}
                disabled={!canGoBack}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onPageChange?.(currentOffset + pageSize)}
                disabled={!canGoForward}
              >
                <ChevronRight className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onPageChange?.((pageCount - 1) * pageSize)}
                disabled={!canGoForward}
              >
                <ChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="hormus-results-grid ag-theme-quartz min-h-0 w-full flex-1">
            <AgGridReact
              key={result ? `${result.durationMs}-${result.rowCount}-${result.columns.join("|")}` : "empty"}
              theme="legacy"
              rowData={result?.rows ?? []}
              columnDefs={columnDefs}
              animateRows
              overlayNoRowsTemplate="<span>No rows returned.</span>"
              rowSelection={{ mode: "multiRow", enableClickSelection: false }}
              onCellClicked={(event: CellClickedEvent<ResultRow>) => {
                lastClickedCellRef.current = valueToClipboardText(event.value);
              }}
              onSelectionChanged={(event: SelectionChangedEvent<ResultRow>) => {
                selectedRowsRef.current = event.api.getSelectedRows();
              }}
              defaultColDef={{
                sortable: true,
                filter: false,
                resizable: true,
              }}
            />
          </div>
        </>
      )}
    </Card>
  );
}
