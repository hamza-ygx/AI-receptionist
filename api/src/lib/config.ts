function read(name: string): string | undefined {
  const v = process.env[name];
  return v === undefined || v === "" ? undefined : v;
}

export function required(name: string): string {
  const v = read(name);
  if (v === undefined) throw new Error(`Missing required setting ${name}`);
  return v;
}

export function optional(name: string, fallback: string): string {
  return read(name) ?? fallback;
}

export function optionalInt(name: string, fallback: number): number {
  const v = read(name);
  if (v === undefined) return fallback;
  const n = Number.parseInt(v, 10);
  if (!Number.isFinite(n)) throw new Error(`Setting ${name} must be an integer`);
  return n;
}

export function flag(name: string, fallback = false): boolean {
  const v = read(name);
  if (v === undefined) return fallback;
  return v === "1" || v.toLowerCase() === "true";
}

export const appRole = (): "voice" | "dash" | "all" => {
  const r = optional("APP_ROLE", "all");
  if (r !== "voice" && r !== "dash" && r !== "all") throw new Error("APP_ROLE must be voice|dash|all");
  return r;
};

export const TZ = "Europe/Stockholm";
