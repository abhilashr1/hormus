import { contextBridge, ipcRenderer } from "electron";
import type {
  ConnectionCreateInput,
  ConnectionDeleteInput,
  ConnectionTestInput,
  ConnectionUpdateInput,
  HormusDesktopApi,
  QueryExportCsvInput,
  QueryRunInput,
  SchemaHydrateInput,
} from "../src/shared/ipc.js";

const api: HormusDesktopApi = {
  bootstrap: (connectionId?: string) => ipcRenderer.invoke("app:bootstrap", connectionId),
  listConnections: () => ipcRenderer.invoke("connections:list"),
  createConnection: (input: ConnectionCreateInput) => ipcRenderer.invoke("connections:create", input),
  updateConnection: (input: ConnectionUpdateInput) => ipcRenderer.invoke("connections:update", input),
  testConnection: (input: ConnectionTestInput) => ipcRenderer.invoke("connections:test", input),
  deleteConnection: (input: ConnectionDeleteInput) => ipcRenderer.invoke("connections:delete", input),
  listSchemaIndex: (connectionId: string) => ipcRenderer.invoke("schemas:index", connectionId),
  hydrateSchema: (input: SchemaHydrateInput) => ipcRenderer.invoke("schemas:hydrate", input),
  listHistory: (connectionId: string) => ipcRenderer.invoke("history:list", connectionId),
  getResults: (tabId: string) => ipcRenderer.invoke("results:get", tabId),
  runQuery: (input: QueryRunInput) => ipcRenderer.invoke("query:run", input),
  exportQueryCsv: (input: QueryExportCsvInput) => ipcRenderer.invoke("query:exportCsv", input),
  openConnectionWindow: (connectionId?: string) => ipcRenderer.invoke("window:openConnection", connectionId),
  openCollectionManagerWindow: () => ipcRenderer.invoke("window:openCollectionManager"),
  closeCurrentWindow: () => ipcRenderer.invoke("window:closeCurrent"),
};

contextBridge.exposeInMainWorld("hormus", api);
