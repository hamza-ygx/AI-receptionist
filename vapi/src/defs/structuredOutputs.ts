import type { SyncEnv } from "../env.js";

export function structuredOutputDefs(env: SyncEnv): Record<string, object> {
  const model = { provider: "openai", model: env.llmModel, temperature: 0 };
  return {
    call_summary_sv: {
      name: "call_summary_sv",
      type: "ai",
      description: "Saklig sammanfattning på svenska (2–4 meningar) av samtalet för receptionens logg: vem ringde, vad de ville, vad som hände. Inga råd, inga antaganden.",
      model,
      schema: { type: "string", description: "Svensk sammanfattning, 2–4 meningar." },
    },
    call_fields: {
      name: "call_fields",
      type: "ai",
      description: "Structured fields extracted from the call. Use null when unknown. Never guess.",
      model,
      schema: {
        type: "object",
        properties: {
          callerName: { type: "string", description: "Caller's name as confirmed, or empty string if unknown." },
          company: { type: "string", description: "Company name, or empty string." },
          callbackNumber: { type: "string", description: "Number the caller confirmed for callback, digits only, or empty string." },
          reason: { type: "string", description: "Short neutral reason for the call, in Swedish, or empty string." },
          language: { type: "string", enum: ["sv", "en"] },
          outcome: { type: "string", enum: ["faq_answered", "booked", "transferred", "message_taken", "abandoned"] },
          staffId: { type: "string", description: "staffId the call concerned, or empty string." },
          urgency: { type: "string", enum: ["low", "normal", "high", "unknown"] },
        },
        required: ["language", "outcome"],
      },
    },
  };
}
