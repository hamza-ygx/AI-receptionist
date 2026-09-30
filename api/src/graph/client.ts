import { ClientCertificateCredential, ClientSecretCredential, type TokenCredential } from "@azure/identity";
import { required } from "../lib/config.js";

let cred: TokenCredential | undefined;

function credential(): TokenCredential {
  if (cred) return cred;
  const tenant = required("GRAPH_TENANT_ID");
  const client = required("GRAPH_CLIENT_ID");
  const pem = process.env.GRAPH_CLIENT_CERT_PEM;
  if (pem) {
    cred = new ClientCertificateCredential(tenant, client, { certificate: pem.replace(/\\n/g, "\n") });
  } else {
    cred = new ClientSecretCredential(tenant, client, required("GRAPH_CLIENT_SECRET"));
  }
  return cred;
}

export class GraphError extends Error {
  constructor(public status: number, public code: string | undefined, message: string) {
    super(message);
  }
}

export async function graph<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}, timeoutMs = 8000): Promise<T> {
  const token = await credential().getToken("https://graph.microsoft.com/.default");
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers: { authorization: `Bearer ${token!.token}`, "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await res.text();
  if (!res.ok) {
    let code: string | undefined;
    try { code = JSON.parse(text)?.error?.code; } catch { /* non-json */ }
    throw new GraphError(res.status, code, `Graph ${method} ${path.split("?")[0]} → ${res.status} ${code ?? ""}`);
  }
  return (text ? JSON.parse(text) : undefined) as T;
}
