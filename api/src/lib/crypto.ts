import { createHash, createHmac, randomBytes, timingSafeEqual, createCipheriv, createDecipheriv } from "node:crypto";

export function safeEqual(a: string | Buffer, b: string | Buffer): boolean {
  const ba = Buffer.isBuffer(a) ? a : Buffer.from(a, "utf8");
  const bb = Buffer.isBuffer(b) ? b : Buffer.from(b, "utf8");
  const ha = createHash("sha256").update(ba).digest();
  const hb = createHash("sha256").update(bb).digest();
  return timingSafeEqual(ha, hb) && ba.length === bb.length;
}

export function sha256Hex(s: string | Buffer): string {
  return createHash("sha256").update(s).digest("hex");
}

export function hmacHex(alg: "sha256" | "sha512" | "sha1", key: string | Buffer, payload: string | Buffer): string {
  return createHmac(alg, key).update(payload).digest("hex");
}

export function hmacB64(alg: "sha256" | "sha512" | "sha1", key: string | Buffer, payload: string | Buffer): string {
  return createHmac(alg, key).update(payload).digest("base64");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

function aesKey(b64: string): Buffer {
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("Encryption key must be 32 bytes (base64)");
  return key;
}

export function encrypt(plain: string, keyB64: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", aesKey(keyB64), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), enc.toString("base64url")].join(".");
}

export function decrypt(blob: string, keyB64: string): string {
  const [v, iv, tag, data] = blob.split(".");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Unsupported ciphertext");
  const d = createDecipheriv("aes-256-gcm", aesKey(keyB64), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([d.update(Buffer.from(data, "base64url")), d.final()]).toString("utf8");
}
