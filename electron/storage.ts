import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { app, safeStorage } from "electron";
import type { Connection, ConnectionCreateInput, ConnectionUpdateInput, QueryHistoryItem, QueryResult } from "../src/shared/ipc.js";

type SecretRecord =
  | {
      mode: "safeStorage";
      value: string;
    }
  | {
      mode: "plain";
      value: string;
    };

type PersistedConnection = Connection & {
  secret?: SecretRecord;
};

interface PersistedDesktopState {
  version: 2;
  connections: PersistedConnection[];
  historyByConnection: Record<string, QueryHistoryItem[]>;
  resultsByTab: Record<string, QueryResult>;
}

const STORAGE_DIR = "state";
const STORAGE_FILE = "desktop.json";
const DEFAULT_CONNECTION_COLOR = "#2f80ed";

function clone<T>(value: T): T {
  return structuredClone(value);
}

function createSeedState(): PersistedDesktopState {
  return {
    version: 2,
    connections: [],
    historyByConnection: {},
    resultsByTab: {},
  };
}

function migrateState(raw: unknown): PersistedDesktopState {
  if (!raw || typeof raw !== "object") {
    return createSeedState();
  }

  const candidate = raw as {
    version?: number;
    connections?: Array<Partial<Connection> & { id?: string; secret?: SecretRecord }>;
    historyByConnection?: Record<string, QueryHistoryItem[]>;
    resultsByTab?: Record<string, QueryResult>;
  };

  const mockIds = new Set(["conn_prod", "conn_stage", "conn_dev"]);
  const migratedConnections: PersistedConnection[] = (candidate.connections ?? [])
    .filter((connection) => connection.id && !mockIds.has(connection.id))
    .map((connection) => ({
      id: connection.id!,
      name: connection.name ?? "",
      kind: connection.kind === "mysql" ? "mysql" : "postgresql",
      host: connection.host ?? "",
      port: typeof connection.port === "number" ? connection.port : connection.kind === "mysql" ? 3306 : 5432,
      authMethod: connection.authMethod === "username_password" ? connection.authMethod : "username_password",
      username: connection.username ?? "",
      database: connection.database ?? "",
      readOnly: Boolean(connection.readOnly),
      latencyMs: typeof connection.latencyMs === "number" ? connection.latencyMs : 0,
      color: typeof connection.color === "string" ? connection.color : DEFAULT_CONNECTION_COLOR,
      favorite: connection.favorite,
      secret: connection.secret,
    }));

  const historyByConnection = Object.fromEntries(
    Object.entries(candidate.historyByConnection ?? {}).filter(([connectionId]) => !mockIds.has(connectionId)),
  );

  return {
    version: 2,
    connections: migratedConnections,
    historyByConnection,
    resultsByTab: candidate.resultsByTab ?? {},
  };
}

function getStoragePath() {
  return path.join(app.getPath("userData"), STORAGE_DIR, STORAGE_FILE);
}

function encodeSecret(secret: string): SecretRecord {
  if (safeStorage.isEncryptionAvailable()) {
    return {
      mode: "safeStorage",
      value: safeStorage.encryptString(secret).toString("base64"),
    };
  }

  return {
    mode: "plain",
    value: secret,
  };
}

function decodeSecret(secret?: SecretRecord) {
  if (!secret) {
    return undefined;
  }

  if (secret.mode === "safeStorage") {
    return safeStorage.decryptString(Buffer.from(secret.value, "base64"));
  }

  return secret.value;
}

function publicConnection(connection: PersistedConnection): Connection {
  const { secret: _secret, ...rest } = connection;
  return rest;
}

export class DesktopStorage {
  private state: PersistedDesktopState | null = null;

  async load() {
    if (this.state) {
      return this.state;
    }

    const storagePath = getStoragePath();

    try {
      const raw = await readFile(storagePath, "utf8");
      this.state = migrateState(JSON.parse(raw));
      await this.save();
    } catch {
      this.state = createSeedState();
      await this.save();
    }

    return this.state;
  }

  async save() {
    if (!this.state) {
      return;
    }

    const storagePath = getStoragePath();
    await mkdir(path.dirname(storagePath), { recursive: true });
    await writeFile(storagePath, JSON.stringify(this.state, null, 2), "utf8");
  }

  async listConnections() {
    const state = await this.load();
    return state.connections.map(publicConnection);
  }

  async createConnection(input: ConnectionCreateInput) {
    const state = await this.load();
    const connection: PersistedConnection = {
      id: crypto.randomUUID(),
      name: input.name,
      kind: input.kind,
      host: input.host,
      port: input.port,
      authMethod: input.authMethod,
      username: input.username,
      database: input.database,
      readOnly: input.readOnly,
      favorite: input.favorite,
      latencyMs: Math.floor(Math.random() * 25) + 8,
      color: input.color,
      secret: input.password ? encodeSecret(input.password) : undefined,
    };

    state.connections.push(connection);
    await this.save();
    return publicConnection(connection);
  }

  async updateConnection(input: ConnectionUpdateInput) {
    const state = await this.load();
    const index = state.connections.findIndex((connection) => connection.id === input.id);

    if (index === -1) {
      throw new Error(`Connection ${input.id} not found`);
    }

    const current = state.connections[index];
    const { password, ...connectionPatch } = input;
    state.connections[index] = {
      ...current,
      ...connectionPatch,
      secret: password ? encodeSecret(password) : current.secret,
    };

    await this.save();
    return publicConnection(state.connections[index]);
  }

  async deleteConnection(id: string) {
    const state = await this.load();
    state.connections = state.connections.filter((connection) => connection.id !== id);
    delete state.historyByConnection[id];
    await this.save();
  }

  async listHistory(connectionId: string) {
    const state = await this.load();
    return clone(state.historyByConnection[connectionId] ?? []);
  }

  async prependHistory(connectionId: string, item: QueryHistoryItem) {
    const state = await this.load();
    state.historyByConnection[connectionId] = [item, ...(state.historyByConnection[connectionId] ?? [])].slice(0, 50);
    await this.save();
  }

  async getResult(tabId: string) {
    const state = await this.load();
    return clone(state.resultsByTab[tabId] ?? null);
  }

  async setResult(tabId: string, result: QueryResult) {
    const state = await this.load();
    state.resultsByTab[tabId] = clone(result);
    await this.save();
  }

  async getConnectionPassword(connectionId: string) {
    const state = await this.load();
    const connection = state.connections.find((item) => item.id === connectionId);
    return decodeSecret(connection?.secret);
  }

  async getConnection(connectionId: string) {
    const state = await this.load();
    const connection = state.connections.find((item) => item.id === connectionId);

    if (!connection) {
      return null;
    }

    return {
      ...publicConnection(connection),
      password: decodeSecret(connection.secret),
    };
  }
}
