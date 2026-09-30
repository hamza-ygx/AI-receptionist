import { z } from "zod";
import { db } from "../lib/db.js";
import { optional } from "../lib/config.js";
import { randomToken, sha256Hex } from "../lib/crypto.js";

const [email, ...nameParts] = process.argv.slice(2);
const parsed = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).refine((e) => e.endsWith("@rkjh.se"), "must be @rkjh.se"),
  name: z.string().trim().min(1),
}).safeParse({ email, name: nameParts.join(" ") });

if (!parsed.success) {
  console.error("Usage: npm run user:create-admin -- <name@rkjh.se> <Display Name>");
  process.exit(1);
}

const token = randomToken(32);
await db().query("UPDATE invites SET expires_at = now() WHERE email = $1 AND used_at IS NULL", [parsed.data.email]);
await db().query(
  "INSERT INTO invites (token_hash, email, display_name, role, expires_at) VALUES ($1, $2, $3, 'admin', now() + interval '24 hours')",
  [sha256Hex(token), parsed.data.email, parsed.data.name],
);
console.log(`Admin invite created (valid 24h). Open this link once, set a password, then enrol MFA at first login:\n${optional("DASHBOARD_BASE_URL", "http://localhost:5173")}/accept-invite#token=${token}`);
await db().end();
