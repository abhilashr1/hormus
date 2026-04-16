import type { Connection } from "./ipc.js";

type DatabaseKind = Connection["kind"];
const SIMPLE_IDENTIFIER_PATTERN = /^[A-Za-z_][\w$]*$/;

type DatabaseMetadata = {
  label: string;
  defaultPort: number;
  quoteIdentifier: (identifier: string) => string;
  canUseBareIdentifier: (identifier: string) => boolean;
};

export const DATABASE_METADATA = {
  postgresql: {
    label: "PostgreSQL",
    defaultPort: 5432,
    quoteIdentifier: (identifier: string) => `"${identifier.replace(/"/g, '""')}"`,
    canUseBareIdentifier: (identifier: string) => /^[a-z_][a-z0-9_$]*$/.test(identifier),
  },
  mysql: {
    label: "MySQL",
    defaultPort: 3306,
    quoteIdentifier: (identifier: string) => `\`${identifier.replace(/`/g, "``")}\``,
    canUseBareIdentifier: (identifier: string) => SIMPLE_IDENTIFIER_PATTERN.test(identifier),
  },
} satisfies Record<DatabaseKind, DatabaseMetadata>;

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
  const metadata = DATABASE_METADATA[kind];

  if (options?.preserveSimple && metadata.canUseBareIdentifier(identifier)) {
    return identifier;
  }

  return metadata.quoteIdentifier(identifier);
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
