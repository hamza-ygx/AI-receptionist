import pg from "pg";
import { DefaultAzureCredential } from "@azure/identity";
import { flag, optional, optionalInt } from "./config.js";

let pool: pg.Pool | undefined;
const credential = new DefaultAzureCredential();

async function entraToken(): Promise<string> {
  const t = await credential.getToken("https://ossrdbms-aad.database.windows.net/.default");
  return t.token;
}

export function db(): pg.Pool {
  if (pool) return pool;
  const useEntra = flag("PG_ENTRA_AUTH");
  const connectionString = process.env.DATABASE_URL;
  pool = new pg.Pool({
    ...(connectionString ? { connectionString } : {
      host: optional("PGHOST", "localhost"),
      port: optionalInt("PGPORT", 5432),
      database: optional("PGDATABASE", "rkjh"),
      user: optional("PGUSER", "rkjh"),
    }),
    password: useEntra ? entraToken : process.env.PGPASSWORD,
    ssl: flag("PGSSL", useEntra) ? { rejectUnauthorized: true } : undefined,
    max: optionalInt("PG_POOL_MAX", 10),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    application_name: `rkjh-${optional("APP_ROLE", "all")}`,
  });
  pool.on("error", () => undefined);
  return pool;
}

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export type Queryable = pg.Pool | pg.PoolClient;
