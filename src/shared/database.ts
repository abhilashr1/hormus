import type { Connection } from "./ipc.js";

type DatabaseKind = Connection["kind"];

export const DATABASE_METADATA = {
  postgresql: {
    label: "PostgreSQL",
    defaultPort: 5432,
  },
  mysql: {
    label: "MySQL",
    defaultPort: 3306,
  },
} satisfies Record<DatabaseKind, { label: string; defaultPort: number }>;

const SIMPLE_IDENTIFIER_PATTERN = /^[A-Za-z_][\w$]*$/;

export function getDatabaseLabel(kind: DatabaseKind) {
  return DATABASE_METADATA[kind].label;
}

export function getDatabaseDefaultPort(kind: DatabaseKind) {
  return DATABASE_METADATA[kind].defaultPort;
}

export function quoteSqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function quoteIdentifier(
  kind: DatabaseKind,
  identifier: string,
  options?: { preserveSimple?: boolean },
) {
  if (options?.preserveSimple && SIMPLE_IDENTIFIER_PATTERN.test(identifier)) {
    return identifier;
  }

  if (kind === "mysql") {
    return `\`${identifier.replace(/`/g, "``")}\``;
  }

  return `"${identifier.replace(/"/g, '""')}"`;
}

export function quoteQualifiedName(
  kind: DatabaseKind,
  schema: string,
  objectName: string,
  options?: { preserveSimple?: boolean },
) {
  return `${quoteIdentifier(kind, schema, options)}.${quoteIdentifier(kind, objectName, options)}`;
}

export function buildDescribeTableSql(kind: DatabaseKind, schema: string, table: string) {
  if (kind === "mysql") {
    return `describe ${quoteQualifiedName(kind, schema, table)};`;
  }

  return [
    "select column_name, data_type, is_nullable, column_default",
    "from information_schema.columns",
    `where table_schema = ${quoteSqlString(schema)}`,
    `  and table_name = ${quoteSqlString(table)}`,
    "order by ordinal_position;",
  ].join("\n");
}
