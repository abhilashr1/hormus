import { QUERY_RESULT_PAGE_SIZE } from "../../src/shared/query.js";

export function normalizeCell(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return value.toString("utf8");
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return value;
}

export function mapRows(rows: Record<string, unknown>[]) {
  return rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, normalizeCell(value)])),
  );
}

function valueToClipboardText(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

function csvEscape(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function rowsToCsv(rows: Record<string, unknown>[], columns: string[]) {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(valueToClipboardText(row[column]))).join(",")).join("\n");
  return body ? `${header}\n${body}` : `${header}\n`;
}

export function normalizePageOffset(pageOffset?: number) {
  return Math.max(0, pageOffset ?? 0);
}

export function isPaginatableQuery(sql: string) {
  return /^(select|with)\b/i.test(sql);
}

export function buildPaginatedSql(statement: string, pageOffset?: number) {
  const offset = normalizePageOffset(pageOffset);

  return {
    dataSql: `select * from (${statement}) as hormus_query_page limit ${QUERY_RESULT_PAGE_SIZE} offset ${offset}`,
    countSql: `select count(*) as total_count from (${statement}) as hormus_query_count`,
    pageOffset: offset,
    pageSize: QUERY_RESULT_PAGE_SIZE,
  };
}

export function totalCountFromValue(value: unknown) {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}
