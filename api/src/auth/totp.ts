import { Secret, TOTP } from "otpauth";
import { createHash, randomBytes } from "node:crypto";
import { decrypt, encrypt } from "../lib/crypto.js";
import { required } from "../lib/config.js";

const key = () => required("TOTP_ENC_KEY");

function totp(secretB32: string, label: string): TOTP {
  return new TOTP({ issuer: "RKJH Receptionist", label, algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secretB32) });
}

export function newTotpSecret(label: string): { enc: string; uri: string } {
  const secret = new Secret({ size: 20 });
  return { enc: encrypt(secret.base32, key()), uri: totp(secret.base32, label).toString() };
}

export function verifyTotp(enc: string, code: string, lastStep: number | null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const secret = decrypt(enc, key());
  const t = totp(secret, "x");
  const delta = t.validate({ token: code, window: 1 });
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 1000 / 30) + delta;
  if (lastStep !== null && step <= lastStep) return null;
  return step;
}

export function newRecoveryCodes(): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: 10 }, () => {
    const raw = randomBytes(8).toString("hex").toUpperCase();
    return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}-${raw.slice(12)}`;
  });
  return { codes, hashes: codes.map(hashRecovery) };
}

export function hashRecovery(code: string): string {
  return createHash("sha256").update(code.replace(/[^0-9A-F]/gi, "").toUpperCase()).digest("hex");
}
