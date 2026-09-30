import { db } from "../lib/db.js";
import { sha256Hex } from "../lib/crypto.js";
import { optional } from "../lib/config.js";

export function keyFor(kind: string, value: string): string {
  return `${kind}:${sha256Hex(`${optional("RATE_LIMIT_SALT", "rkjh")}|${value.toLowerCase()}`).slice(0, 32)}`;
}

export async function hit(key: string, windowMinutes: number): Promise<number> {
  const r = await db().query<{ count: number }>(
    `INSERT INTO login_attempts (key, window_start, count)
     VALUES ($1, to_timestamp(floor(extract(epoch FROM now()) / ($2 * 60)) * ($2 * 60)), 1)
     ON CONFLICT (key, window_start) DO UPDATE SET count = login_attempts.count + 1
     RETURNING count`,
    [key, windowMinutes],
  );
  return r.rows[0]!.count;
}
