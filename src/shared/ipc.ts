import { z } from "zod";

export const databaseKindSchema = z.enum(["postgresql", "mysql"]);
export const authenticationMethodSchema = z.enum(["username_password"]);
export const queryStatusSchema = z.enum(["idle", "running", "success", "error"]);

export const connectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: databaseKindSchema,
  host: z.string(),
  port: z.number().int().positive(),
  authMethod: authenticationMethodSchema,
  username: z.string(),
  database: z.string(),
  readOnly: z.boolean(),
  latencyMs: z.number(),
  color: z.string(),
  favorite: z.boolean().optional(),
});

export const schemaTableSchema = z.object({
  name: z.string(),
  rowCount: z.string(),
  columns: z.number(),
});

export const schemaNodeSchema = z.object({
  name: z.string(),
  tables: z.array(schemaTableSchema),
});

export const queryTabSchema = z.object({
  id: z.string(),
  title: z.string(),
  sql: z.string(),
  selection: z.string().optional(),
  status: queryStatusSchema,
  lastRunAt: z.string().optional(),
});

export const queryResultSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.record(z.unknown())),
  rowCount: z.number(),
  durationMs: z.number(),
  pageSize: z.number().optional(),
  pageOffset: z.number().optional(),
});

export const queryHistoryItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  ranAt: z.string(),
  durationMs: z.number(),
  preview: z.string(),
});

export const desktopSnapshotSchema = z.object({
  connections: z.array(connectionSchema),
  activeConnectionId: z.string(),
  queryTabs: z.array(queryTabSchema),
  activeTabId: z.string(),
});

export const connectionCreateInputSchema = connectionSchema.omit({ id: true, latencyMs: true }).extend({
  password: z.string().optional(),
});

export const connectionUpdateInputSchema = connectionSchema.partial().extend({
  id: z.string(),
  password: z.string().optional(),
});

export const connectionTestInputSchema = connectionSchema
  .pick({
    kind: true,
    host: true,
    port: true,
    authMethod: true,
    username: true,
    database: true,
  })
  .extend({
    id: z.string().optional(),
    password: z.string().optional(),
  });

export const connectionTestResultSchema = z.object({
  success: z.literal(true),
  durationMs: z.number(),
});

export const connectionDeleteInputSchema = z.object({
  id: z.string(),
});

export const queryRunInputSchema = z.object({
  connectionId: z.string(),
  tabId: z.string(),
  sql: z.string(),
  selection: z.string().optional(),
  pageOffset: z.number().int().nonnegative().optional(),
});

export const queryExportCsvInputSchema = z.object({
  connectionId: z.string(),
  sql: z.string(),
  suggestedFileName: z.string().optional(),
});

export type Connection = z.infer<typeof connectionSchema>;
export type SchemaNode = z.infer<typeof schemaNodeSchema>;
export type QueryTab = z.infer<typeof queryTabSchema>;
export type QueryResult = z.infer<typeof queryResultSchema>;
export type QueryHistoryItem = z.infer<typeof queryHistoryItemSchema>;
export type DesktopSnapshot = z.infer<typeof desktopSnapshotSchema>;
export type ConnectionCreateInput = z.infer<typeof connectionCreateInputSchema>;
export type ConnectionUpdateInput = z.infer<typeof connectionUpdateInputSchema>;
export type ConnectionTestInput = z.infer<typeof connectionTestInputSchema>;
export type ConnectionTestResult = z.infer<typeof connectionTestResultSchema>;
export type ConnectionDeleteInput = z.infer<typeof connectionDeleteInputSchema>;
export type QueryRunInput = z.infer<typeof queryRunInputSchema>;
export type QueryExportCsvInput = z.infer<typeof queryExportCsvInputSchema>;

export interface HormusDesktopBackend {
  bootstrap: (connectionId?: string) => Promise<DesktopSnapshot>;
  listConnections: () => Promise<Connection[]>;
  createConnection: (input: ConnectionCreateInput) => Promise<Connection>;
  updateConnection: (input: ConnectionUpdateInput) => Promise<Connection>;
  testConnection: (input: ConnectionTestInput) => Promise<ConnectionTestResult>;
  deleteConnection: (input: ConnectionDeleteInput) => Promise<{ success: true }>;
  listSchemas: (connectionId: string) => Promise<SchemaNode[]>;
  listHistory: (connectionId: string) => Promise<QueryHistoryItem[]>;
  getResults: (tabId: string) => Promise<QueryResult | null>;
  runQuery: (input: QueryRunInput) => Promise<{ tab: QueryTab; result: QueryResult | null }>;
  exportQueryCsv: (input: QueryExportCsvInput) => Promise<{ defaultFileName: string; csv: string }>;
}

export interface HormusDesktopApi {
  bootstrap: (connectionId?: string) => Promise<DesktopSnapshot>;
  listConnections: () => Promise<Connection[]>;
  createConnection: (input: ConnectionCreateInput) => Promise<Connection>;
  updateConnection: (input: ConnectionUpdateInput) => Promise<Connection>;
  testConnection: (input: ConnectionTestInput) => Promise<ConnectionTestResult>;
  deleteConnection: (input: ConnectionDeleteInput) => Promise<{ success: true }>;
  listSchemas: (connectionId: string) => Promise<SchemaNode[]>;
  listHistory: (connectionId: string) => Promise<QueryHistoryItem[]>;
  getResults: (tabId: string) => Promise<QueryResult | null>;
  runQuery: (input: QueryRunInput) => Promise<{ tab: QueryTab; result: QueryResult | null }>;
  exportQueryCsv: (input: QueryExportCsvInput) => Promise<{ canceled: boolean; path?: string }>;
  openConnectionWindow: (connectionId?: string) => Promise<void>;
  openCollectionManagerWindow: () => Promise<void>;
  closeCurrentWindow: () => Promise<void>;
}
