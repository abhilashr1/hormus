import type {
  Connection,
  ConnectionTestInput,
  ConnectionTestResult,
  QueryResult,
  SchemaNode,
} from "../../src/shared/ipc.js";

export type ConnectionWithSecret = Connection & { password?: string };
export type TestConnectionWithSecret = ConnectionTestInput & { password?: string };

export interface DatabaseProvider {
  kind: Connection["kind"];
  runQuery: (connection: ConnectionWithSecret, statements: string[], pageOffset?: number) => Promise<QueryResult>;
  testConnection: (connection: TestConnectionWithSecret) => Promise<ConnectionTestResult>;
  listSchemaIndex: (connection: ConnectionWithSecret) => Promise<SchemaNode[]>;
  hydrateSchema: (connection: ConnectionWithSecret, schemaName: string) => Promise<SchemaNode | null>;
  exportQueryCsv: (connection: ConnectionWithSecret, statements: string[]) => Promise<string>;
}
