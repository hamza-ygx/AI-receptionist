import { z } from "zod";

const SAFE_TEXT = /[\u0000-\u001f\u007f<>{}\\`]/g;

export const text = (min: number, max: number) =>
  z.string().transform((s) => s.replace(SAFE_TEXT, " ").replace(/\s+/g, " ").trim()).pipe(z.string().min(min).max(max));

export const optText = (max: number) =>
  z.string().optional().nullable().transform((s) => (s ?? "").replace(SAFE_TEXT, " ").replace(/\s+/g, " ").trim()).pipe(z.string().max(max))
    .transform((s) => (s === "" ? null : s));

export const staffIdSchema = z.string().regex(/^[a-z0-9-]{1,64}$/);
export const langSchema = z.enum(["sv", "en"]);
export const urgencySchema = z.enum(["low", "normal", "high"]);
