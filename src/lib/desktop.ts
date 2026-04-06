import type { HormusDesktopApi } from "@/shared/ipc";

declare global {
  interface Window {
    hormus?: HormusDesktopApi;
  }
}

function unavailable(): never {
  throw new Error("Hormus desktop API is unavailable. Launch the app through Electron.");
}

export function getDesktopApi(): HormusDesktopApi {
  if (typeof window !== "undefined" && window.hormus) {
    return window.hormus;
  }

  return {
    bootstrap: async () => ({ connections: [], activeConnectionId: "", sidebarView: "schemas", queryTabs: [], activeTabId: "" }),
    listConnections: async () => [],
    createConnection: async () => unavailable(),
    updateConnection: async () => unavailable(),
    deleteConnection: async () => unavailable(),
    listSchemas: async () => unavailable(),
    listTables: async () => unavailable(),
    describeTable: async () => unavailable(),
    listHistory: async () => [],
    getResults: async () => null,
    runQuery: async () => unavailable(),
    openConnectionWindow: async () => undefined,
    openCollectionManagerWindow: async () => undefined,
    closeCurrentWindow: async () => undefined,
  };
}
