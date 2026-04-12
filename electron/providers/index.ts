import type { Connection } from "../../src/shared/ipc.js";
import { mysqlProvider } from "./mysql.js";
import { postgresqlProvider } from "./postgresql.js";
import type { DatabaseProvider } from "./types.js";

const providers: Record<Connection["kind"], DatabaseProvider> = {
  postgresql: postgresqlProvider,
  mysql: mysqlProvider,
};

export function getDatabaseProvider(kind: Connection["kind"]) {
  return providers[kind];
}
