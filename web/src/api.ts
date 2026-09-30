let csrfToken = "";

export function setCsrf(token: string | undefined): void {
  if (token) csrfToken = token;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, public detail?: unknown) {
    super(code);
  }
}

export async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { accept: "application/json" };
  if (body !== undefined) headers["content-type"] = "application/json";
  if (method !== "GET" && csrfToken) headers["x-csrf-token"] = csrfToken;
  const res = await fetch(`/api/dash${path}`, {
    method,
    headers,
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (json && typeof json === "object" && "csrf" in json) setCsrf(json.csrf as string);
  if (!res.ok) {
    if (res.status === 401 && path !== "/auth/me" && !path.startsWith("/auth/")) window.dispatchEvent(new Event("rkjh:unauthorized"));
    throw new ApiError(res.status, json.error ?? "error", json.detail);
  }
  return json as T;
}

export function qs(params: Record<string, string | number | undefined | null>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
}
