import type { Connection, QueryRunInput } from "../src/shared/ipc.js";
import { prepareStatementsForExecution } from "../src/shared/query.js";
import { getDatabaseProvider } from "./providers/index.js";
import type { ConnectionWithSecret, TestConnectionWithSecret } from "./providers/types.js";

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

export async function runLiveQuery(connection: ConnectionWithSecret, sql: string, pageOffset?: QueryRunInput["pageOffset"]) {
  const statements = prepareStatementsForExecution(sql);
  for (const statement of statements) {
    assertReadAllowed(connection, statement);
  }

  return getDatabaseProvider(connection.kind).runQuery(connection, statements, pageOffset);
}

export async function testLiveConnection(connection: TestConnectionWithSecret) {
  return getDatabaseProvider(connection.kind).testConnection(connection);
}

export async function listLiveSchemaIndex(connection: ConnectionWithSecret) {
  return getDatabaseProvider(connection.kind).listSchemaIndex(connection);
}

export async function hydrateLiveSchema(connection: ConnectionWithSecret, schemaName: string) {
  return getDatabaseProvider(connection.kind).hydrateSchema(connection, schemaName);
}

export async function exportLiveQueryToCsv(connection: ConnectionWithSecret, sql: string) {
  const statements = prepareStatementsForExecution(sql);
  for (const statement of statements) {
    assertReadAllowed(connection, statement);
  }

  return getDatabaseProvider(connection.kind).exportQueryCsv(connection, statements);
}
