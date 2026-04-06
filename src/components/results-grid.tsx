import { AgGridReact } from "ag-grid-react";
import type { ColDef } from "ag-grid-community";
import { useMemo } from "react";
import type { QueryResult } from "@/shared/ipc";
import "ag-grid-community/styles/ag-theme-quartz.css";

interface ResultsGridProps {
  result?: QueryResult;
  error?: string;
}

export function ResultsGrid({ result, error }: ResultsGridProps) {
  const columnDefs = useMemo<ColDef[]>(
    () =>
      (result?.columns ?? []).map((column: string) => ({
        field: column,
        sortable: true,
        resizable: true,
        minWidth: 140,
        flex: 1,
      })),
    [result],
  );

  return (
    <div className="flex min-h-0 flex-col overflow-hidden bg-[var(--panel)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
        <div>
          <p className="text-[13px] font-medium text-[var(--foreground)]">Results</p>
          <p className="text-[11px] text-[var(--muted-foreground)]">
            {error ? error : result ? `${result.rowCount.toLocaleString()} rows in ${result.durationMs}ms` : "Run a query to see rows"}
          </p>
        </div>
      </div>
      <div className="ag-theme-quartz h-[320px] w-full [--ag-background-color:transparent] [--ag-foreground-color:#e8eaed] [--ag-header-background-color:#15171b] [--ag-odd-row-background-color:rgba(255,255,255,0.015)] [--ag-border-color:rgba(255,255,255,0.06)] [--ag-row-hover-color:rgba(94,106,210,0.08)] [--ag-font-family:var(--font-sans)] [--ag-header-column-separator-color:rgba(255,255,255,0.04)]">
        <AgGridReact
          rowData={result?.rows ?? []}
          columnDefs={columnDefs}
          animateRows
          rowSelection={{ mode: "multiRow" }}
          defaultColDef={{
            sortable: true,
            filter: false,
            resizable: true,
          }}
        />
      </div>
    </div>
  );
}
