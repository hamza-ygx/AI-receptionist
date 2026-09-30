import { DefaultAzureCredential } from "@azure/identity";
import { optional } from "../lib/config.js";

const credential = new DefaultAzureCredential();
export const EMBEDDING_DIMS = 1536;

export function embeddingsConfigured(): boolean {
  return Boolean(process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT);
}

async function authHeaders(): Promise<Record<string, string>> {
  if (process.env.AZURE_OPENAI_API_KEY) return { "api-key": process.env.AZURE_OPENAI_API_KEY };
  const t = await credential.getToken("https://cognitiveservices.azure.com/.default");
  return { authorization: `Bearer ${t.token}` };
}

export async function embed(inputs: string[], timeoutMs = 10_000): Promise<number[][]> {
  if (!inputs.length) return [];
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT!.replace(/\/$/, "");
  const deployment = process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT!;
  const apiVersion = optional("AZURE_OPENAI_API_VERSION", "2024-10-21");
  const res = await fetch(`${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/embeddings?api-version=${apiVersion}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({ input: inputs, dimensions: EMBEDDING_DIMS }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`Embeddings → ${res.status}`);
  const json = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export function toVector(v: number[]): string {
  return `[${v.join(",")}]`;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}
