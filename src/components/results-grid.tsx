import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  type CellClickedEvent,
  type CellContextMenuEvent,
  type ColDef,
  type SelectionChangedEvent,
} from "ag-grid-community";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Download, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  onExportCsv?: () => void;
  isExportingCsv?: boolean;
}

type ResultsPanelTab = "output" | "results";
type ResultRow = QueryResult["rows"][number];
type CellContextMenu = {
  x: number;
  y: number;
  column: string;
  value: unknown;
};
type ViewedCell = {
  title: string;
  content: string;
};

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

function formatCellValue(value: unknown) {
  if (value === null) {
    return "null";
  }

  if (value === undefined) {
    return "";
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      try {
        return JSON.stringify(JSON.parse(trimmed), null, 2);
      } catch {
        return value;
      }
    }
  }

  return String(value);
}

export function ResultsGrid({
  result,
  error,
  queryText,
  outputHistory = [],
  isLoading,
  onPageChange,
  onExportCsv,
  isExportingCsv,
}: ResultsGridProps) {
  const [activePanel, setActivePanel] = useState<ResultsPanelTab>("output");
  const [isResultsTabClosed, setIsResultsTabClosed] = useState(false);
  const [cellContextMenu, setCellContextMenu] = useState<CellContextMenu | null>(null);
  const [viewedCell, setViewedCell] = useState<ViewedCell | null>(null);
  const [pageInput, setPageInput] = useState("1");
  const selectedRowsRef = useRef<ResultRow[]>([]);
  const lastClickedCellRef = useRef<string | null>(null);
  const resultsPanelRef = useRef<HTMLDivElement>(null);
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
    setCellContextMenu(null);
    setViewedCell(null);
  }, [result]);

  useEffect(() => {
    setPageInput(String(currentPage + 1));
  }, [currentPage]);

  useEffect(() => {
    if (!cellContextMenu) {
      return undefined;
    }

    const closeMenu = () => setCellContextMenu(null);
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
  }, [cellContextMenu]);

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
  const openCellValue = (cell: CellContextMenu) => {
    setCellContextMenu(null);
    setViewedCell({
      title: cell.column,
      content: formatCellValue(cell.value),
    });
  };
  const commitPageInput = () => {
    const parsedPage = Number(pageInput);
    if (!Number.isInteger(parsedPage)) {
      setPageInput(String(currentPage + 1));
      return;
    }

    const clampedPage = Math.min(pageCount, Math.max(1, parsedPage));
    setPageInput(String(clampedPage));
    if (clampedPage !== currentPage + 1) {
      onPageChange?.((clampedPage - 1) * pageSize);
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
        <div ref={resultsPanelRef} className="relative flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-3 py-2">
            <div className="text-[12px] text-[var(--muted-foreground)]">{totalRows.toLocaleString()} results</div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={onExportCsv}
                disabled={!onExportCsv || isExportingCsv || !result || result.columns.length === 0}
                aria-label={isExportingCsv ? "Exporting results as CSV" : "Download all results as CSV"}
              >
                <Download className="size-4" />
              </Button>
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
              <div className="mx-1 flex items-center gap-2 text-[12px] text-[var(--muted-foreground)]">
                <span>Page</span>
                <Input
                  value={pageInput}
                  onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, ""))}
                  onBlur={commitPageInput}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      commitPageInput();
                    }
                  }}
                  inputMode="numeric"
                  aria-label="Current results page"
                  className="h-7 w-14 rounded-[6px] px-2 text-center text-[12px]"
                />
                <span>of {pageCount.toLocaleString()}</span>
              </div>
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
              selectionColumnDef={{
                width: 20,
                minWidth: 20,
                maxWidth: 20,
                resizable: false,
                sortable: false,
                suppressHeaderMenuButton: true,
                suppressMovable: true,
                pinned: "left",
                headerClass: "hormus-selection-gutter",
                cellClass: "hormus-selection-gutter",
              }}
              animateRows
              overlayNoRowsTemplate="<span>No rows returned.</span>"
              rowSelection={{ mode: "multiRow", checkboxes: true, headerCheckbox: true, enableClickSelection: true } as never}
              onCellClicked={(event: CellClickedEvent<ResultRow>) => {
                lastClickedCellRef.current = valueToClipboardText(event.value);
              }}
              onCellContextMenu={(event: CellContextMenuEvent<ResultRow>) => {
                if (!(event.event instanceof MouseEvent)) {
                  return;
                }

                event.event.preventDefault();
                const panelBounds = resultsPanelRef.current?.getBoundingClientRect();
                setCellContextMenu({
                  x: panelBounds ? event.event.clientX - panelBounds.left : event.event.clientX,
                  y: panelBounds ? event.event.clientY - panelBounds.top : event.event.clientY,
                  column: event.column.getColDef().headerName ?? String(event.column.getColId()),
                  value: event.value,
                });
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
          {cellContextMenu ? (
            <Card
              className="absolute z-40 w-36 gap-0 rounded-md border border-[var(--border)] bg-[var(--popover)] p-1 py-1 shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
              style={{ left: cellContextMenu.x, top: cellContextMenu.y }}
              onClick={(event) => event.stopPropagation()}
            >
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start rounded-[4px]"
                onClick={() => openCellValue(cellContextMenu)}
              >
                View
              </Button>
            </Card>
          ) : null}
          {viewedCell ? (
            <Card className="absolute inset-y-0 right-0 z-30 flex w-[min(520px,80%)] min-w-[360px] gap-0 overflow-hidden rounded-none border-y-0 border-r-0 border-l border-[var(--border)] bg-[var(--popover)] py-0 shadow-[-24px_0_80px_rgba(0,0,0,0.45)]">
              <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{viewedCell.title}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Close cell value"
                  className="size-7"
                  onClick={() => setViewedCell(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
              <ScrollArea className="min-h-0 flex-1">
                <pre className="whitespace-pre-wrap break-words p-4 font-mono text-[12px] leading-5 text-[var(--foreground)]">
                  {viewedCell.content}
                </pre>
              </ScrollArea>
            </Card>
          ) : null}
        </div>
      )}
    </Card>
  );
}
