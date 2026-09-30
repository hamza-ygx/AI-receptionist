import { optional, required } from "../lib/config.js";

export class VapiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function vapiFetch<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const base = optional("VAPI_BASE_URL", "https://api.eu.vapi.ai").replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? "GET",
    headers: {
      authorization: `Bearer ${required("VAPI_API_KEY")}`,
      "content-type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new VapiError(res.status, `Vapi ${init.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function deleteVapiCall(callId: string): Promise<"deleted" | "gone"> {
  try {
    await vapiFetch(`/call/${encodeURIComponent(callId)}`, { method: "DELETE" });
    return "deleted";
  } catch (e) {
    if (e instanceof VapiError && e.status === 404) return "gone";
    throw e;
  }
}
