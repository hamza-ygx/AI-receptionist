import argon2 from "argon2";
import { createHash } from "node:crypto";

const OPTS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 } as const;
let dummyHash: Promise<string> | undefined;

export function hashPassword(pw: string): Promise<string> {
  return argon2.hash(pw, OPTS);
}

export async function verifyPassword(hash: string | null, pw: string): Promise<boolean> {
  dummyHash ??= argon2.hash("dummy-password-for-timing", OPTS);
  try {
    return await argon2.verify(hash ?? (await dummyHash), pw);
  } catch {
    return false;
  }
}

export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, OPTS);
}

export class PasswordPolicyError extends Error {
  constructor(public code: "too_short" | "too_long" | "contains_email" | "breached" | "breach_check_unavailable") {
    super(code);
  }
}

export async function pwnedCount(pw: string): Promise<number> {
  const sha1 = createHash("sha1").update(pw, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
    headers: { "Add-Padding": "true", "user-agent": "rkjh-receptionist-dashboard" },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`HIBP ${res.status}`);
  for (const line of (await res.text()).split("\n")) {
    const [s, c] = line.trim().split(":");
    if (s === suffix) return Number(c ?? 0);
  }
  return 0;
}

export async function assertPasswordPolicy(pw: string, email: string): Promise<void> {
  if ([...pw].length < 12) throw new PasswordPolicyError("too_short");
  if (pw.length > 256) throw new PasswordPolicyError("too_long");
  const local = email.split("@")[0]!.toLowerCase();
  if (local.length >= 4 && pw.toLowerCase().includes(local)) throw new PasswordPolicyError("contains_email");
  let count: number;
  try {
    count = await pwnedCount(pw);
  } catch {
    throw new PasswordPolicyError("breach_check_unavailable");
  }
  if (count > 0) throw new PasswordPolicyError("breached");
}
