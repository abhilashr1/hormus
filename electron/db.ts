import { Client } from "pg";
import mysql from "mysql2/promise";
import type {
  Connection,
  ConnectionTestInput,
  ConnectionTestResult,
  QueryRunInput,
  QueryResult,
  SchemaNode,
} from "../src/shared/ipc.js";
import { prepareStatementsForExecution, QUERY_RESULT_PAGE_SIZE } from "../src/shared/query.js";

type ConnectionWithSecret = Connection & { password?: string };
type TestConnectionWithSecret = ConnectionTestInput & { password?: string };
type SchemaObjectColumnRow = { schema: string; name: string; columnName: string; ordinalPosition: number | string };
type SchemaRoutineRow = { schema: string; name: string };

function normalizeCell(value: unknown): unknown {
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

function assertReadAllowed(connection: Connection, sql: string) {
  if (!connection.readOnly) {
    return;
  }

  const normalized = sql.trim().toLowerCase();
  const safePrefix = /^(select|with|show|describe|desc|explain)\b/;

  if (!safePrefix.test(normalized)) {
    throw new Error("This connection is marked read-only. Only read queries are allowed.");
  }
}

function defaultPort(kind: Connection["kind"]) {
  return kind === "postgresql" ? 5432 : 3306;
}

function mapRows(rows: Record<string, unknown>[]) {
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

function rowsToCsv(rows: Record<string, unknown>[], columns: string[]) {
  const header = columns.map(csvEscape).join(",");
  const body = rows.map((row) => columns.map((column) => csvEscape(valueToClipboardText(row[column]))).join(",")).join("\n");
  return body ? `${header}\n${body}` : `${header}\n`;
}

function normalizePageOffset(pageOffset?: number) {
  return Math.max(0, pageOffset ?? 0);
}

function isPaginatableQuery(sql: string) {
  return /^(select|with)\b/i.test(sql);
}

function buildPaginatedSql(statement: string, pageOffset?: number) {
  const offset = normalizePageOffset(pageOffset);

  return {
    dataSql: `select * from (${statement}) as hormus_query_page limit ${QUERY_RESULT_PAGE_SIZE} offset ${offset}`,
    countSql: `select count(*) as total_count from (${statement}) as hormus_query_count`,
    pageOffset: offset,
    pageSize: QUERY_RESULT_PAGE_SIZE,
  };
}

function totalCountFromValue(value: unknown) {
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

async function queryPostgres(connection: ConnectionWithSecret, statements: string[], pageOffset?: number): Promise<QueryResult> {
  const client = new Client({
    host: connection.host,
    port: connection.port || defaultPort(connection.kind),
    user: connection.username,
    password: connection.password,
    database: connection.database,
    application_name: "Hormus",
  });

  const startedAt = Date.now();
  await client.connect();

  try {
    for (const statement of statements.slice(0, -1)) {
      await client.query(statement);
    }

    const lastStatement = statements.at(-1);
    if (!lastStatement) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    if (isPaginatableQuery(lastStatement)) {
      const paginated = buildPaginatedSql(lastStatement, pageOffset);
      const countResponse = await client.query<{ total_count: string }>(paginated.countSql);
      const response = await client.query(paginated.dataSql);

      return {
        columns: response.fields.map((field: { name: string }) => field.name),
        rows: mapRows(response.rows as Record<string, unknown>[]),
        rowCount: totalCountFromValue(countResponse.rows[0]?.total_count),
        durationMs: Date.now() - startedAt,
        pageSize: paginated.pageSize,
        pageOffset: paginated.pageOffset,
      };
    }

    const response = await client.query(lastStatement);
    return {
      columns: response.fields.map((field: { name: string }) => field.name),
      rows: mapRows(response.rows as Record<string, unknown>[]),
      rowCount: typeof response.rowCount === "number" ? response.rowCount : response.rows.length,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await client.end();
  }
}

async function testPostgres(connection: TestConnectionWithSecret): Promise<ConnectionTestResult> {
  const client = new Client({
    host: connection.host,
    port: connection.port || defaultPort(connection.kind),
    user: connection.username,
    password: connection.password,
    database: connection.database,
    application_name: "Hormus",
    connectionTimeoutMillis: 8000,
  });

  const startedAt = Date.now();
  await client.connect();

  try {
    await client.query("select 1");
    return {
      success: true,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await client.end();
  }
}

async function queryPostgresAllRows(connection: ConnectionWithSecret, statements: string[]): Promise<QueryResult> {
  const client = new Client({
    host: connection.host,
    port: connection.port || defaultPort(connection.kind),
    user: connection.username,
    password: connection.password,
    database: connection.database,
    application_name: "Hormus",
  });

  const startedAt = Date.now();
  await client.connect();

  try {
    for (const statement of statements.slice(0, -1)) {
      await client.query(statement);
    }

    const lastStatement = statements.at(-1);
    if (!lastStatement) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    const response = await client.query(lastStatement);
    return {
      columns: response.fields.map((field: { name: string }) => field.name),
      rows: mapRows(response.rows as Record<string, unknown>[]),
      rowCount: typeof response.rowCount === "number" ? response.rowCount : response.rows.length,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await client.end();
  }
}

async function queryMySql(connection: ConnectionWithSecret, statements: string[], pageOffset?: number): Promise<QueryResult> {
  const client = await mysql.createConnection({
    host: connection.host,
    port: connection.port || defaultPort(connection.kind),
    user: connection.username,
    password: connection.password,
    database: connection.database,
    multipleStatements: true,
  });

  const startedAt = Date.now();

  try {
    for (const statement of statements.slice(0, -1)) {
      await client.query(statement);
    }

    const lastStatement = statements.at(-1);
    if (!lastStatement) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    if (isPaginatableQuery(lastStatement)) {
      const paginated = buildPaginatedSql(lastStatement, pageOffset);
      const [countRows] = await client.query<mysql.RowDataPacket[]>(paginated.countSql);
      const [rows, fields] = await client.query(paginated.dataSql);
      const rowArray = Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
      const columns = Array.isArray(fields)
        ? fields.map((field: { name: string }) => field.name)
        : Object.keys(rowArray[0] ?? {});

      return {
        columns,
        rows: mapRows(rowArray),
        rowCount: totalCountFromValue(countRows[0]?.total_count),
        durationMs: Date.now() - startedAt,
        pageSize: paginated.pageSize,
        pageOffset: paginated.pageOffset,
      };
    }

    const [rows, fields] = await client.query(lastStatement);
    const rowArray = Array.isArray(rows) ? rows : [];
    const lastRows = Array.isArray(rowArray[0]) ? (rowArray.at(-1) as Record<string, unknown>[]) : (rowArray as Record<string, unknown>[]);
    const lastFields = Array.isArray(fields?.[0]) ? fields.at(-1) ?? [] : fields ?? [];
    const columns = Array.isArray(lastFields)
      ? lastFields.map((field: { name: string }) => field.name)
      : Object.keys(lastRows[0] ?? {});

    return {
      columns,
      rows: mapRows(lastRows),
      rowCount: lastRows.length,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await client.end();
  }
}

async function testMySql(connection: TestConnectionWithSecret): Promise<ConnectionTestResult> {
  const startedAt = Date.now();
  const client = await mysql.createConnection({
    host: connection.host,
    port: connection.port || defaultPort(connection.kind),
    user: connection.username,
    password: connection.password,
    database: connection.database,
    connectTimeout: 8000,
  });

  try {
    await client.ping();
    return {
      success: true,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await client.end();
  }
}

async function queryMySqlAllRows(connection: ConnectionWithSecret, statements: string[]): Promise<QueryResult> {
  const client = await mysql.createConnection({
    host: connection.host,
    port: connection.port || defaultPort(connection.kind),
    user: connection.username,
    password: connection.password,
    database: connection.database,
    multipleStatements: true,
  });

  const startedAt = Date.now();

  try {
    for (const statement of statements.slice(0, -1)) {
      await client.query(statement);
    }

    const lastStatement = statements.at(-1);
    if (!lastStatement) {
      return {
        columns: [],
        rows: [],
        rowCount: 0,
        durationMs: Date.now() - startedAt,
      };
    }

    const [rows, fields] = await client.query(lastStatement);
    const rowArray = Array.isArray(rows) ? rows : [];
    const lastRows = Array.isArray(rowArray[0]) ? (rowArray.at(-1) as Record<string, unknown>[]) : (rowArray as Record<string, unknown>[]);
    const lastFields = Array.isArray(fields?.[0]) ? fields.at(-1) ?? [] : fields ?? [];
    const columns = Array.isArray(lastFields)
      ? lastFields.map((field: { name: string }) => field.name)
      : Object.keys(lastRows[0] ?? {});

    return {
      columns,
      rows: mapRows(lastRows),
      rowCount: lastRows.length,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await client.end();
  }
}

async function listPostgresSchemas(connection: ConnectionWithSecret): Promise<SchemaNode[]> {
  const client = new Client({
    host: connection.host,
    port: connection.port || defaultPort(connection.kind),
    user: connection.username,
    password: connection.password,
    database: connection.database,
    application_name: "Hormus",
  });

  await client.connect();

  try {
    const schemas = await client.query<{ name: string }>(`
      select schema_name as name
      from information_schema.schemata
      where schema_name not in ('information_schema', 'pg_catalog', 'pg_toast')
      order by schema_name
    `);

    const tables = await client.query<SchemaObjectColumnRow>(`
      select c.table_schema as schema,
             c.table_name as name,
             c.column_name as "columnName",
             c.ordinal_position as "ordinalPosition"
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
       and t.table_name = c.table_name
      where c.table_schema not in ('information_schema', 'pg_catalog', 'pg_toast')
        and t.table_type = 'BASE TABLE'
      order by c.table_schema, c.table_name, c.ordinal_position
    `);

    const views = await client.query<SchemaObjectColumnRow>(`
      select c.table_schema as schema,
             c.table_name as name,
             c.column_name as "columnName",
             c.ordinal_position as "ordinalPosition"
      from information_schema.columns c
      join information_schema.views v
        on v.table_schema = c.table_schema
       and v.table_name = c.table_name
      where c.table_schema not in ('information_schema', 'pg_catalog', 'pg_toast')
      order by c.table_schema, c.table_name, c.ordinal_position
    `);

    const functions = await client.query<SchemaRoutineRow>(`
      select routine_schema as schema,
             routine_name as name
      from information_schema.routines
      where routine_schema not in ('information_schema', 'pg_catalog', 'pg_toast')
        and routine_type = 'FUNCTION'
      order by routine_schema, routine_name
    `);

    return buildSchemaNodes(schemas.rows, tables.rows, views.rows, functions.rows);
  } finally {
    await client.end();
  }
}

async function listMySqlSchemas(connection: ConnectionWithSecret): Promise<SchemaNode[]> {
  const client = await mysql.createConnection({
    host: connection.host,
    port: connection.port || defaultPort(connection.kind),
    user: connection.username,
    password: connection.password,
    database: connection.database,
  });

  try {
    const [schemas] = await client.query<mysql.RowDataPacket[]>(`
      select schema_name as name
      from information_schema.schemata
      where schema_name not in ('information_schema', 'mysql', 'performance_schema', 'sys')
      order by schema_name
    `);

    const [tables] = await client.query<mysql.RowDataPacket[]>(`
      select c.table_schema as schema,
             c.table_name as name,
             c.column_name as columnName,
             c.ordinal_position as ordinalPosition
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
       and t.table_name = c.table_name
      where c.table_schema not in ('information_schema', 'mysql', 'performance_schema', 'sys')
        and t.table_type = 'BASE TABLE'
      order by c.table_schema, c.table_name, c.ordinal_position
    `);

    const [views] = await client.query<mysql.RowDataPacket[]>(`
      select c.table_schema as schema,
             c.table_name as name,
             c.column_name as columnName,
             c.ordinal_position as ordinalPosition
      from information_schema.columns c
      join information_schema.views v
        on v.table_schema = c.table_schema
       and v.table_name = c.table_name
      where c.table_schema not in ('information_schema', 'mysql', 'performance_schema', 'sys')
      order by c.table_schema, c.table_name, c.ordinal_position
    `);

    const [functions] = await client.query<mysql.RowDataPacket[]>(`
      select routine_schema as schema,
             routine_name as name
      from information_schema.routines
      where routine_schema not in ('information_schema', 'mysql', 'performance_schema', 'sys')
        and routine_type = 'FUNCTION'
      order by routine_schema, routine_name
    `);

    return buildSchemaNodes(
      schemas as { name: string }[],
      normalizeSchemaObjects(tables as SchemaObjectColumnRow[]),
      normalizeSchemaObjects(views as SchemaObjectColumnRow[]),
      functions as SchemaRoutineRow[],
    );
  } finally {
    await client.end();
  }
}

function normalizeSchemaObjects(rows: SchemaObjectColumnRow[]): SchemaObjectColumnRow[] {
  return rows.map((row) => ({
    schema: String(row.schema),
    name: String(row.name),
    columnName: String(row.columnName),
    ordinalPosition: typeof row.ordinalPosition === "number" ? row.ordinalPosition : Number(row.ordinalPosition),
  }));
}

function buildSchemaNodes(
  schemas: { name: string }[],
  tables: SchemaObjectColumnRow[],
  views: SchemaObjectColumnRow[],
  functions: SchemaRoutineRow[],
): SchemaNode[] {
  const groupedTables = new Map<string, SchemaNode["tables"]>();
  const groupedViews = new Map<string, SchemaNode["views"]>();
  const groupedFunctions = new Map<string, SchemaNode["functions"]>();

  const groupSchemaObjects = <T extends SchemaNode["tables"][number] | SchemaNode["views"][number]>(
    rows: SchemaObjectColumnRow[],
    buildEntry: (row: SchemaObjectColumnRow, columnNames: string[]) => T,
  ) => {
    const grouped = new Map<string, T[]>();
    const objectRows = new Map<string, SchemaObjectColumnRow[]>();

    for (const row of rows) {
      const key = `${row.schema}\u0000${row.name}`;
      const entry = objectRows.get(key) ?? [];
      entry.push(row);
      objectRows.set(key, entry);
    }

    for (const [key, objectColumns] of objectRows.entries()) {
      const [schemaName] = key.split("\u0000");
      const target = grouped.get(schemaName) ?? [];
      const sortedColumns = [...objectColumns]
        .sort((left, right) => Number(left.ordinalPosition) - Number(right.ordinalPosition))
        .map((column) => column.columnName);
      target.push(buildEntry(objectColumns[0], sortedColumns));
      grouped.set(schemaName, target);
    }

    return grouped;
  };

  const groupedTableObjects = groupSchemaObjects(tables, (row, columnNames) => ({
    name: row.name,
    columns: columnNames.length,
    columnNames,
    rowCount: "",
  }));
  const groupedViewObjects = groupSchemaObjects(views, (row, columnNames) => ({
    name: row.name,
    columns: columnNames.length,
    columnNames,
  }));

  for (const [schemaName, entries] of groupedTableObjects.entries()) {
    groupedTables.set(schemaName, entries);
  }

  for (const [schemaName, entries] of groupedViewObjects.entries()) {
    groupedViews.set(schemaName, entries);
  }

  for (const fn of functions) {
    const entry = groupedFunctions.get(fn.schema) ?? [];
    entry.push({ name: fn.name });
    groupedFunctions.set(fn.schema, entry);
  }

  return schemas.map((schema) => ({
    name: schema.name,
    tables: groupedTables.get(schema.name) ?? [],
    views: groupedViews.get(schema.name) ?? [],
    functions: groupedFunctions.get(schema.name) ?? [],
  }));
}

export async function runLiveQuery(connection: ConnectionWithSecret, sql: string, pageOffset?: QueryRunInput["pageOffset"]) {
  const statements = prepareStatementsForExecution(sql);
  for (const statement of statements) {
    assertReadAllowed(connection, statement);
  }
  return connection.kind === "postgresql"
    ? queryPostgres(connection, statements, pageOffset)
    : queryMySql(connection, statements, pageOffset);
}

export async function testLiveConnection(connection: TestConnectionWithSecret) {
  return connection.kind === "postgresql" ? testPostgres(connection) : testMySql(connection);
}

export async function listLiveSchemas(connection: ConnectionWithSecret) {
  return connection.kind === "postgresql" ? listPostgresSchemas(connection) : listMySqlSchemas(connection);
}

export async function exportLiveQueryToCsv(connection: ConnectionWithSecret, sql: string) {
  const statements = prepareStatementsForExecution(sql);
  for (const statement of statements) {
    assertReadAllowed(connection, statement);
  }

  const result =
    connection.kind === "postgresql"
      ? await queryPostgresAllRows(connection, statements)
      : await queryMySqlAllRows(connection, statements);

  return rowsToCsv(result.rows as Record<string, unknown>[], result.columns);
}
