import { Client } from "pg";
import type { SchemaNode } from "../../src/shared/ipc.js";
import { getDatabaseDefaultPort } from "../../src/shared/database.js";
import {
  buildPaginatedSql,
  isPaginatableQuery,
  mapRows,
  rowsToCsv,
  totalCountFromValue,
} from "./shared.js";
import type { ConnectionWithSecret, DatabaseProvider, TestConnectionWithSecret } from "./types.js";

type SchemaObjectCountRow = { schema: string; name: string; columns: string };
type SchemaObjectColumnRow = { schema: string; name: string; columnName: string; ordinalPosition: number | string };
type SchemaRoutineRow = { schema: string; name: string };

function createClient(connection: ConnectionWithSecret | TestConnectionWithSecret, options?: { timeoutMs?: number }) {
  return new Client({
    host: connection.host,
    port: connection.port || getDatabaseDefaultPort(connection.kind),
    user: connection.username,
    password: connection.password,
    database: connection.database,
    application_name: "Hormus",
    connectionTimeoutMillis: options?.timeoutMs,
  });
}

function buildSchemaIndex(
  schemas: { name: string }[],
  tables: SchemaObjectCountRow[],
  views: SchemaObjectCountRow[],
  functions: SchemaRoutineRow[],
): SchemaNode[] {
  const groupedTables = new Map<string, SchemaNode["tables"]>();
  const groupedViews = new Map<string, SchemaNode["views"]>();
  const groupedFunctions = new Map<string, SchemaNode["functions"]>();

  for (const table of tables) {
    const entry = groupedTables.get(table.schema) ?? [];
    entry.push({
      name: table.name,
      columns: Number(table.columns),
      columnNames: [],
      rowCount: "",
    });
    groupedTables.set(table.schema, entry);
  }

  for (const view of views) {
    const entry = groupedViews.get(view.schema) ?? [];
    entry.push({
      name: view.name,
      columns: Number(view.columns),
      columnNames: [],
    });
    groupedViews.set(view.schema, entry);
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

function buildHydratedSchema(
  schemaName: string,
  tables: SchemaObjectColumnRow[],
  views: SchemaObjectColumnRow[],
  functions: SchemaRoutineRow[],
): SchemaNode {
  const buildObjects = <T extends SchemaNode["tables"][number] | SchemaNode["views"][number]>(
    rows: SchemaObjectColumnRow[],
    createEntry: (name: string, columnNames: string[]) => T,
  ) => {
    const grouped = new Map<string, SchemaObjectColumnRow[]>();
    for (const row of rows) {
      const entry = grouped.get(row.name) ?? [];
      entry.push(row);
      grouped.set(row.name, entry);
    }

    return Array.from(grouped.entries()).map(([name, objectRows]) =>
      createEntry(
        name,
        objectRows.map((row) => row.columnName),
      ),
    );
  };

  return {
    name: schemaName,
    tables: buildObjects(tables, (name, columnNames) => ({
      name,
      columns: columnNames.length,
      columnNames,
      rowCount: "",
    })),
    views: buildObjects(views, (name, columnNames) => ({
      name,
      columns: columnNames.length,
      columnNames,
    })),
    functions: functions.map((fn) => ({ name: fn.name })),
  };
}

async function queryAllRows(connection: ConnectionWithSecret, statements: string[]) {
  const client = createClient(connection);
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

export const postgresqlProvider: DatabaseProvider = {
  kind: "postgresql",

  async runQuery(connection, statements, pageOffset) {
    const client = createClient(connection);
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
  },

  async testConnection(connection) {
    const client = createClient(connection, { timeoutMs: 8000 });
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
  },

  async listSchemaIndex(connection) {
    const client = createClient(connection);
    await client.connect();

    try {
      const schemas = await client.query<{ name: string }>(`
        select schema_name as name
        from information_schema.schemata
        where schema_name not in ('information_schema', 'pg_catalog', 'pg_toast')
        order by schema_name
      `);

      const tables = await client.query<SchemaObjectCountRow>(`
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

      const views = await client.query<SchemaObjectCountRow>(`
        select c.table_schema as schema,
               c.table_name as name,
               count(*)::text as columns
        from information_schema.columns c
        join information_schema.views v
          on v.table_schema = c.table_schema
         and v.table_name = c.table_name
        where c.table_schema not in ('information_schema', 'pg_catalog', 'pg_toast')
        group by c.table_schema, c.table_name
        order by c.table_schema, c.table_name
      `);

      const functions = await client.query<SchemaRoutineRow>(`
        select routine_schema as schema,
               routine_name as name
        from information_schema.routines
        where routine_schema not in ('information_schema', 'pg_catalog', 'pg_toast')
          and routine_type = 'FUNCTION'
        order by routine_schema, routine_name
      `);

      return buildSchemaIndex(schemas.rows, tables.rows, views.rows, functions.rows);
    } finally {
      await client.end();
    }
  },

  async hydrateSchema(connection, schemaName) {
    const client = createClient(connection);
    await client.connect();

    try {
      const schemaResult = await client.query<{ name: string }>(
        `
          select schema_name as name
          from information_schema.schemata
          where schema_name = $1
            and schema_name not in ('information_schema', 'pg_catalog', 'pg_toast')
        `,
        [schemaName],
      );
      if (schemaResult.rows.length === 0) {
        return null;
      }

      const tables = await client.query<SchemaObjectColumnRow>(
        `
          select c.table_schema as schema,
                 c.table_name as name,
                 c.column_name as "columnName",
                 c.ordinal_position as "ordinalPosition"
          from information_schema.columns c
          join information_schema.tables t
            on t.table_schema = c.table_schema
           and t.table_name = c.table_name
          where c.table_schema = $1
            and t.table_type = 'BASE TABLE'
          order by c.table_name, c.ordinal_position
        `,
        [schemaName],
      );

      const views = await client.query<SchemaObjectColumnRow>(
        `
          select c.table_schema as schema,
                 c.table_name as name,
                 c.column_name as "columnName",
                 c.ordinal_position as "ordinalPosition"
          from information_schema.columns c
          join information_schema.views v
            on v.table_schema = c.table_schema
           and v.table_name = c.table_name
          where c.table_schema = $1
          order by c.table_name, c.ordinal_position
        `,
        [schemaName],
      );

      const functions = await client.query<SchemaRoutineRow>(
        `
          select routine_schema as schema,
                 routine_name as name
          from information_schema.routines
          where routine_schema = $1
            and routine_type = 'FUNCTION'
          order by routine_name
        `,
        [schemaName],
      );

      return buildHydratedSchema(schemaName, tables.rows, views.rows, functions.rows);
    } finally {
      await client.end();
    }
  },

  async exportQueryCsv(connection, statements) {
    const result = await queryAllRows(connection, statements);
    return rowsToCsv(result.rows as Record<string, unknown>[], result.columns);
  },
};
