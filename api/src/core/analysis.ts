import { DefaultAzureCredential } from "@azure/identity";
import { optional } from "../lib/config.js";

const credential = new DefaultAzureCredential();

export interface CallFields {
  callerName: string | null;
  company: string | null;
  callbackNumber: string | null;
  reason: string | null;
  language: "sv" | "en" | null;
  outcome: "faq_answered" | "booked" | "transferred" | "message_taken" | "abandoned" | null;
  urgency: "low" | "normal" | "high" | null;
}

export interface CallAnalysis { summarySv: string | null; fields: CallFields }

const nullable = (t: object) => ({ anyOf: [t, { type: "null" }] });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["summarySv", "callerName", "company", "callbackNumber", "reason", "language", "outcome", "urgency"],
  properties: {
    summarySv: { type: "string", description: "Saklig sammanfattning på svenska, 2–4 meningar: vem ringde, vad de ville, vad som hände. Inga råd." },
    callerName: nullable({ type: "string" }),
    company: nullable({ type: "string" }),
    callbackNumber: nullable({ type: "string", description: "Number the caller confirmed for callback, digits only." }),
    reason: nullable({ type: "string", description: "Short neutral reason for the call, in Swedish." }),
    language: nullable({ type: "string", enum: ["sv", "en"] }),
    outcome: nullable({ type: "string", enum: ["faq_answered", "booked", "transferred", "message_taken", "abandoned"] }),
    urgency: nullable({ type: "string", enum: ["low", "normal", "high"] }),
  },
};

const EMPTY: CallFields = { callerName: null, company: null, callbackNumber: null, reason: null, language: null, outcome: null, urgency: null };

async function authHeaders(): Promise<Record<string, string>> {
  if (process.env.AZURE_OPENAI_API_KEY) return { "api-key": process.env.AZURE_OPENAI_API_KEY };
  const t = await credential.getToken("https://cognitiveservices.azure.com/.default");
  return { authorization: `Bearer ${t.token}` };
}

export async function analyzeTranscript(transcript: string): Promise<CallAnalysis> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
  const deployment = optional("AZURE_OPENAI_CHAT_DEPLOYMENT", "gpt-5.4-mini");
  if (!endpoint || !transcript.trim()) return { summarySv: null, fields: EMPTY };
  const apiVersion = optional("AZURE_OPENAI_API_VERSION", "2024-10-21");
  const res = await fetch(`${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${apiVersion}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeaders()) },
    body: JSON.stringify({
      messages: [
        {
          role: "system",
          content: "You extract a call log entry from a phone transcript between an AI receptionist (AI) and a caller at an audit/accounting firm. Use null when something was not said. Never guess. The summary must be in Swedish and contain no advice.",
        },
        { role: "user", content: transcript.slice(0, 60_000) },
      ],
      response_format: { type: "json_schema", json_schema: { name: "call_log", strict: true, schema: SCHEMA } },
      max_completion_tokens: 2000,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`Call analysis → ${res.status}`);
  const json = (await res.json()) as { choices: { message: { content: string | null } }[] };
  const content = json.choices[0]?.message.content;
  if (!content) return { summarySv: null, fields: EMPTY };
  const parsed = JSON.parse(content) as CallFields & { summarySv: string };
  const { summarySv, ...fields } = parsed;
  return { summarySv: summarySv || null, fields: { ...EMPTY, ...fields } };
}
