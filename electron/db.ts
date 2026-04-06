import { Client } from "pg";
import mysql from "mysql2/promise";
import type {
  Connection,
  QueryResult,
  SchemaNode,
  TableDescription,
} from "../src/shared/ipc.js";

type ConnectionWithSecret = Connection & { password?: string };

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

async function queryPostgres(connection: ConnectionWithSecret, sql: string): Promise<QueryResult> {
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
    const response = await client.query(sql);
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

async function queryMySql(connection: ConnectionWithSecret, sql: string): Promise<QueryResult> {
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
    const [rows, fields] = await client.query(sql);
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

    const tables = await client.query<{ schema: string; name: string; columns: string }>(`
      select c.table_schema as schema,
             c.table_name as name,
             count(*)::text as columns
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
       and t.table_name = c.table_name
      where c.table_schema not in ('information_schema', 'pg_catalog', 'pg_toast')
        and t.table_type = 'BASE TABLE'
      group by c.table_schema, c.table_name
      order by c.table_schema, c.table_name
    `);

    return buildSchemaNodes(schemas.rows, tables.rows);
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
             count(*) as columns
      from information_schema.columns c
      join information_schema.tables t
        on t.table_schema = c.table_schema
       and t.table_name = c.table_name
      where c.table_schema not in ('information_schema', 'mysql', 'performance_schema', 'sys')
        and t.table_type = 'BASE TABLE'
      group by c.table_schema, c.table_name
      order by c.table_schema, c.table_name
    `);

    return buildSchemaNodes(
      schemas as { name: string }[],
      (tables as { schema: string; name: string; columns: number | string }[]).map((row) => ({
        ...row,
        columns: String(row.columns),
      })),
    );
  } finally {
    await client.end();
  }
}

function buildSchemaNodes(
  schemas: { name: string }[],
  tables: { schema: string; name: string; columns: string }[],
): SchemaNode[] {
  const groupedTables = new Map<string, SchemaNode["tables"]>();

  for (const table of tables) {
    const entry = groupedTables.get(table.schema) ?? [];
    entry.push({
      name: table.name,
      columns: Number(table.columns),
      rowCount: "",
    });
    groupedTables.set(table.schema, entry);
  }

  return schemas.map((schema) => ({
    name: schema.name,
    tables: groupedTables.get(schema.name) ?? [],
  }));
}

async function describePostgresTable(connection: ConnectionWithSecret, schema: string, table: string): Promise<TableDescription> {
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
    const response = await client.query<{ name: string; type: string; nullable: "YES" | "NO" }>(
      `
        select column_name as name,
               data_type as type,
               is_nullable as nullable
        from information_schema.columns
        where table_schema = $1
          and table_name = $2
        order by ordinal_position
      `,
      [schema, table],
    );

    return {
      schema,
      table,
      columns: response.rows.map((column) => ({
        name: column.name,
        type: column.type,
        nullable: column.nullable === "YES",
      })),
    };
  } finally {
    await client.end();
  }
}

async function describeMySqlTable(connection: ConnectionWithSecret, schema: string, table: string): Promise<TableDescription> {
  const client = await mysql.createConnection({
    host: connection.host,
    port: connection.port || defaultPort(connection.kind),
    user: connection.username,
    password: connection.password,
    database: connection.database,
  });

  try {
    const [rows] = await client.query<mysql.RowDataPacket[]>(
      `
        select column_name as name,
               data_type as type,
               is_nullable as nullable
        from information_schema.columns
        where table_schema = ?
          and table_name = ?
        order by ordinal_position
      `,
      [schema, table],
    );

    return {
      schema,
      table,
      columns: rows.map((column: mysql.RowDataPacket) => ({
        name: String(column.name),
        type: String(column.type),
        nullable: String(column.nullable) === "YES",
      })),
    };
  } finally {
    await client.end();
  }
}

export async function runLiveQuery(connection: ConnectionWithSecret, sql: string) {
  assertReadAllowed(connection, sql);
  return connection.kind === "postgresql" ? queryPostgres(connection, sql) : queryMySql(connection, sql);
}

export async function listLiveSchemas(connection: ConnectionWithSecret) {
  return connection.kind === "postgresql" ? listPostgresSchemas(connection) : listMySqlSchemas(connection);
}

export async function describeLiveTable(connection: ConnectionWithSecret, schema: string, table: string) {
  return connection.kind === "postgresql"
    ? describePostgresTable(connection, schema, table)
    : describeMySqlTable(connection, schema, table);
}
