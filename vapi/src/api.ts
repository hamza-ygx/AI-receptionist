export class VapiApi {
  constructor(private base: string, private key: string) {}

  async req<T = { id: string }>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: { authorization: `Bearer ${this.key}`, "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text.slice(0, 800)}`);
    return (text ? JSON.parse(text) : {}) as T;
  }
}
