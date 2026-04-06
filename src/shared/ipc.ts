import { z } from "zod";

export const databaseKindSchema = z.enum(["postgresql", "mysql"]);
export const environmentSchema = z.enum(["production", "staging", "development"]);
export const sidebarViewSchema = z.enum(["connections", "schemas", "history"]);
export const queryStatusSchema = z.enum(["idle", "running", "success", "error"]);

export const connectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: databaseKindSchema,
  host: z.string(),
  port: z.number().int().positive(),
  username: z.string(),
  database: z.string(),
  environment: environmentSchema,
  readOnly: z.boolean(),
  latencyMs: z.number(),
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
});

export const queryHistoryItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  ranAt: z.string(),
  durationMs: z.number(),
  preview: z.string(),
});

export const tableDescriptionSchema = z.object({
  schema: z.string(),
  table: z.string(),
  columns: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      nullable: z.boolean(),
    }),
  ),
});

export const desktopSnapshotSchema = z.object({
  connections: z.array(connectionSchema),
  activeConnectionId: z.string(),
  sidebarView: sidebarViewSchema,
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

export const connectionDeleteInputSchema = z.object({
  id: z.string(),
});

export const listTablesInputSchema = z.object({
  connectionId: z.string(),
  schema: z.string(),
});

export const describeTableInputSchema = z.object({
  connectionId: z.string(),
  schema: z.string(),
  table: z.string(),
});

export const queryRunInputSchema = z.object({
  connectionId: z.string(),
  tabId: z.string(),
  sql: z.string(),
  selection: z.string().optional(),
});

export type Connection = z.infer<typeof connectionSchema>;
export type SchemaNode = z.infer<typeof schemaNodeSchema>;
export type QueryTab = z.infer<typeof queryTabSchema>;
export type QueryResult = z.infer<typeof queryResultSchema>;
export type QueryHistoryItem = z.infer<typeof queryHistoryItemSchema>;
export type DesktopSnapshot = z.infer<typeof desktopSnapshotSchema>;
export type TableDescription = z.infer<typeof tableDescriptionSchema>;
export type ConnectionCreateInput = z.infer<typeof connectionCreateInputSchema>;
export type ConnectionUpdateInput = z.infer<typeof connectionUpdateInputSchema>;
export type ConnectionDeleteInput = z.infer<typeof connectionDeleteInputSchema>;
export type ListTablesInput = z.infer<typeof listTablesInputSchema>;
export type DescribeTableInput = z.infer<typeof describeTableInputSchema>;
export type QueryRunInput = z.infer<typeof queryRunInputSchema>;

export interface HormusDesktopBackend {
  bootstrap: (connectionId?: string) => Promise<DesktopSnapshot>;
  listConnections: () => Promise<Connection[]>;
  createConnection: (input: ConnectionCreateInput) => Promise<Connection>;
  updateConnection: (input: ConnectionUpdateInput) => Promise<Connection>;
  deleteConnection: (input: ConnectionDeleteInput) => Promise<{ success: true }>;
  listSchemas: (connectionId: string) => Promise<SchemaNode[]>;
  listTables: (input: ListTablesInput) => Promise<SchemaNode["tables"]>;
  describeTable: (input: DescribeTableInput) => Promise<TableDescription>;
  listHistory: (connectionId: string) => Promise<QueryHistoryItem[]>;
  getResults: (tabId: string) => Promise<QueryResult | null>;
  runQuery: (input: QueryRunInput) => Promise<{ tab: QueryTab; result: QueryResult | null }>;
}

export interface HormusDesktopApi {
  bootstrap: (connectionId?: string) => Promise<DesktopSnapshot>;
  listConnections: () => Promise<Connection[]>;
  createConnection: (input: ConnectionCreateInput) => Promise<Connection>;
  updateConnection: (input: ConnectionUpdateInput) => Promise<Connection>;
  deleteConnection: (input: ConnectionDeleteInput) => Promise<{ success: true }>;
  listSchemas: (connectionId: string) => Promise<SchemaNode[]>;
  listTables: (input: ListTablesInput) => Promise<SchemaNode["tables"]>;
  describeTable: (input: DescribeTableInput) => Promise<TableDescription>;
  listHistory: (connectionId: string) => Promise<QueryHistoryItem[]>;
  getResults: (tabId: string) => Promise<QueryResult | null>;
  runQuery: (input: QueryRunInput) => Promise<{ tab: QueryTab; result: QueryResult | null }>;
  openConnectionWindow: (connectionId?: string) => Promise<void>;
  openCollectionManagerWindow: () => Promise<void>;
  closeCurrentWindow: () => Promise<void>;
}
