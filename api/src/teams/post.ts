import { DefaultAzureCredential } from "@azure/identity";
import { optional } from "../lib/config.js";

const credential = new DefaultAzureCredential();
const ALLOWED_HOST = /(\.logic\.azure\.com|\.powerplatform\.com|\.api\.powerplatform\.com|\.azure-api\.net)$/i;

export class TeamsConfigError extends Error {}

export function webhookUrl(ref: string): string {
  if (!/^TEAMS_WEBHOOK_[A-Z0-9_]+$/.test(ref)) throw new TeamsConfigError(`Invalid Teams webhook ref ${ref}`);
  const raw = process.env[ref];
  if (!raw) throw new TeamsConfigError(`Teams webhook ${ref} not configured`);
  const url = new URL(raw);
  if (url.protocol !== "https:" || !ALLOWED_HOST.test(url.hostname)) throw new TeamsConfigError(`Teams webhook ${ref} has a disallowed host`);
  return url.toString();
}

async function authHeader(): Promise<Record<string, string>> {
  if (optional("TEAMS_FLOW_AUTH", "none") !== "entra") return {};
  const aud = optional("TEAMS_FLOW_AUDIENCE", "https://service.flow.microsoft.com/");
  const t = await credential.getToken(`${aud.replace(/\/$/, "")}//.default`);
  return { authorization: `Bearer ${t.token}` };
}

export async function postCard(ref: string, card: unknown): Promise<void> {
  const url = webhookUrl(ref);
  const payload = {
    type: "message",
    attachments: [{ contentType: "application/vnd.microsoft.card.adaptive", contentUrl: null, content: card }],
  };
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...(await authHeader()) },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return;
      lastErr = new Error(`Teams webhook ${ref} → ${res.status}`);
      if (res.status >= 400 && res.status < 500 && res.status !== 429) break;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 500 * 2 ** attempt));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}
