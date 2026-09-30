import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../lib/db.js";

function migrationsDir(): string {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  const here = dirname(fileURLToPath(import.meta.url));
  return [join(here, "../../migrations"), join(here, "../../../migrations")].find((d) => existsSync(d)) ?? join(here, "../../migrations");
}

export async function migrate(log: (msg: string) => void = console.log): Promise<string[]> {
  const pool = db();
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const applied = new Set((await pool.query<{ id: string }>("SELECT id FROM schema_migrations")).rows.map((r) => r.id));
  const dir = migrationsDir();
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  const done: string[] = [];
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = await readFile(join(dir, f), "utf8");
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query("SELECT pg_advisory_xact_lock(hashtext('schema_migrations'))");
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations (id) VALUES ($1)", [f]);
      await c.query("COMMIT");
      log(`applied ${f}`);
      done.push(f);
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  return done;
}
