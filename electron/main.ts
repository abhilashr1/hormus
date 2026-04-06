import path from "node:path";
import { app, BrowserWindow, ipcMain } from "electron";
import type { IpcMainInvokeEvent } from "electron";
import {
  connectionCreateInputSchema,
  connectionDeleteInputSchema,
  connectionUpdateInputSchema,
  type HormusDesktopBackend,
  describeTableInputSchema,
  listTablesInputSchema,
  queryRunInputSchema,
} from "../src/shared/ipc.js";
import { createElectronDesktopBackend } from "./backend.js";

let backend: HormusDesktopBackend | null = null;
const windows = new Map<string, BrowserWindow>();
const COLLECTION_MANAGER_KEY = "collection-manager";

function getRendererUrl() {
  if (process.env.VITE_DEV_SERVER_URL) {
    return process.env.VITE_DEV_SERVER_URL;
  }

  return `file://${path.join(process.cwd(), "dist", "index.html")}`;
}

function buildRendererUrl(screen: "collection-manager" | "workspace", connectionId?: string) {
  const url = new URL(getRendererUrl());
  url.searchParams.set("screen", screen);
  if (connectionId) {
    url.searchParams.set("connectionId", connectionId);
  }
  return url.toString();
}

function resolvePreloadPath() {
  return path.join(process.cwd(), "dist-electron", "electron", "preload.js");
}

async function createCollectionManagerWindow() {
  const existing = windows.get(COLLECTION_MANAGER_KEY);
  if (existing) {
    existing.focus();
    return existing;
  }

  const window = new BrowserWindow({
    width: 1480,
    height: 940,
    minWidth: 1200,
    minHeight: 760,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0f1115",
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.on("closed", () => {
    windows.delete(COLLECTION_MANAGER_KEY);
  });

  windows.set(COLLECTION_MANAGER_KEY, window);
  await window.loadURL(buildRendererUrl("collection-manager"));
  return window;
}

async function createConnectionWindow(connectionId?: string) {
  if (!backend) {
    throw new Error("Desktop backend is not ready");
  }

  const snapshot = await backend.bootstrap(connectionId);
  const activeConnectionId = snapshot.activeConnectionId;
  if (!activeConnectionId) {
    return createCollectionManagerWindow();
  }
  const existing = windows.get(activeConnectionId);
  if (existing) {
    existing.focus();
    return existing;
  }

  const window = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1200,
    minHeight: 760,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0f1115",
    webPreferences: {
      preload: resolvePreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.on("closed", () => {
    windows.delete(activeConnectionId);
  });

  windows.set(activeConnectionId, window);
  await window.loadURL(buildRendererUrl("workspace", activeConnectionId));
  return window;
}

function registerIpc() {
  if (!backend) {
    throw new Error("Desktop backend is not ready");
  }
  const desktopBackend = backend;

  const handle = <TArgs, TResult>(
    channel: string,
    fn: (_event: IpcMainInvokeEvent, args: TArgs) => Promise<TResult> | TResult,
  ) => {
    ipcMain.handle(channel, fn);
  };

  handle("app:bootstrap", async (_event, connectionId?: string) => desktopBackend.bootstrap(connectionId));
  handle("connections:list", async () => desktopBackend.listConnections());
  handle("connections:create", async (_event, input) => desktopBackend.createConnection(connectionCreateInputSchema.parse(input)));
  handle("connections:update", async (_event, input) => desktopBackend.updateConnection(connectionUpdateInputSchema.parse(input)));
  handle("connections:delete", async (_event, input) => desktopBackend.deleteConnection(connectionDeleteInputSchema.parse(input)));
  handle("schemas:list", async (_event, connectionId: string) => desktopBackend.listSchemas(connectionId));
  handle("tables:list", async (_event, input) => desktopBackend.listTables(listTablesInputSchema.parse(input)));
  handle("tables:describe", async (_event, input) => desktopBackend.describeTable(describeTableInputSchema.parse(input)));
  handle("history:list", async (_event, connectionId: string) => desktopBackend.listHistory(connectionId));
  handle("results:get", async (_event, tabId: string) => desktopBackend.getResults(tabId));
  handle("query:run", async (_event, input) => desktopBackend.runQuery(queryRunInputSchema.parse(input)));
  handle("window:openConnection", async (_event, connectionId?: string) => {
    await createConnectionWindow(connectionId);
  });
  handle("window:openCollectionManager", async () => {
    await createCollectionManagerWindow();
  });
  handle("window:closeCurrent", async (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close();
  });
}

async function start() {
  await app.whenReady();
  backend = await createElectronDesktopBackend();
  registerIpc();
  await createCollectionManagerWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createCollectionManagerWindow();
    }
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

void start();
