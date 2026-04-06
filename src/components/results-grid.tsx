import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef } from "ag-grid-community";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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

function estimateColumnWidth(column: string, rows: QueryResult["rows"]) {
  const valueLengths = rows.slice(0, 100).map((row) => String(row[column] ?? "").length);
  const maxLength = Math.max(column.length, ...valueLengths);
  return Math.min(360, Math.max(52, maxLength * 8 + 28));
}

export function ResultsGrid({ result, error, queryText, outputHistory = [], isLoading, onPageChange }: ResultsGridProps) {
  const [activePanel, setActivePanel] = useState<ResultsPanelTab>("output");
  const [isResultsTabClosed, setIsResultsTabClosed] = useState(false);
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

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setActivePanel("output")}
            className={cn(
              "px-3 py-1.5 text-[13px] transition-colors",
              activePanel === "output"
                ? "bg-[var(--panel-elevated)] text-white"
                : "text-[var(--muted-foreground)] hover:bg-[var(--panel-muted)] hover:text-white",
            )}
          >
            Output
          </button>
          {showResultsTab ? (
            <div
              className={cn(
                "group inline-flex items-center gap-2 px-3 py-1.5 text-[13px] transition-colors",
                activePanel === "results"
                  ? "bg-[var(--panel-elevated)] text-white"
                  : "text-[var(--muted-foreground)] hover:bg-[var(--panel-muted)] hover:text-white",
              )}
            >
              <button type="button" onClick={() => setActivePanel("results")}>
                Results
              </button>
              <button
                type="button"
                aria-label="Close Results tab"
                onClick={() => {
                  setIsResultsTabClosed(true);
                  setActivePanel("output");
                }}
                className="inline-flex size-4 items-center justify-center text-[var(--muted-foreground)] hover:bg-[var(--panel-muted)] hover:text-white"
              >
                <X className="size-3" />
              </button>
            </div>
          ) : null}
        </div>
        <Badge className={error ? "border-red-500/30 bg-red-500/10 text-red-200" : undefined}>
          {error ? "error" : result ? "complete" : "idle"}
        </Badge>
      </div>
      <Separator />
      {activePanel === "output" ? (
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {outputHistory.length > 0 ? (
            <div className="space-y-4">
              {outputHistory.map((entry) => (
                <div key={entry.id} className="border border-[var(--border)] bg-[#0f1114]">
                  <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                    <p className={cn("text-[13px]", entry.status === "error" ? "text-red-300" : "text-[var(--foreground)]")}>
                      {entry.message}
                    </p>
                    <span className="text-[11px] text-[var(--muted-foreground)]">{entry.ranAt}</span>
                  </div>
                  <pre className="max-h-[180px] overflow-auto p-3 font-mono text-[12px] leading-5 text-[var(--foreground)]">
                    {entry.query}
                  </pre>
                </div>
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
                <pre className="mt-2 max-h-[220px] overflow-auto border border-[var(--border)] bg-[#0f1114] p-3 font-mono text-[12px] leading-5 text-[var(--foreground)]">
                  {queryText?.trim() ? queryText : "No query has been run yet."}
                </pre>
              </div>
            </div>
          )}
        </div>
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
              rowSelection={{ mode: "multiRow" }}
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
