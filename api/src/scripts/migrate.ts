import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../lib/db.js";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../../migrations");

async function main() {
  const pool = db();
  await pool.query("CREATE TABLE IF NOT EXISTS schema_migrations (id text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const applied = new Set((await pool.query<{ id: string }>("SELECT id FROM schema_migrations")).rows.map((r) => r.id));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = await readFile(join(dir, f), "utf8");
    const c = await pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(sql);
      await c.query("INSERT INTO schema_migrations (id) VALUES ($1)", [f]);
      await c.query("COMMIT");
      console.log(`applied ${f}`);
    } catch (e) {
      await c.query("ROLLBACK");
      throw e;
    } finally {
      c.release();
    }
  }
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
