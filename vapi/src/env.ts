function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

export interface SyncEnv {
  name: string;
  vapiBase: string;
  vapiKey: string;
  apiBase: string;
  webhookCredentialId: string;
  azureOpenAICredentialId: string;
  azureSpeechCredentialId: string;
  llmModel: string;
  voiceSv: string;
  voiceEn: string;
  twilio?: { number: string; accountSid: string; apiKey: string; apiSecret: string };
  fallbackNumber?: string;
  blockedNumbers: string[];
}

export function loadEnv(envName: string): SyncEnv {
  const twilioNumber = process.env.TWILIO_NUMBER_E164;
  return {
    name: envName,
    vapiBase: (process.env.VAPI_BASE_URL ?? "https://api.eu.vapi.ai").replace(/\/$/, ""),
    vapiKey: req("VAPI_API_KEY"),
    apiBase: req("VOICE_API_BASE_URL").replace(/\/$/, ""),
    webhookCredentialId: req("VAPI_WEBHOOK_CREDENTIAL_ID"),
    azureOpenAICredentialId: req("VAPI_AZURE_OPENAI_CREDENTIAL_ID"),
    azureSpeechCredentialId: req("VAPI_AZURE_SPEECH_CREDENTIAL_ID"),
    llmModel: process.env.VAPI_LLM_MODEL ?? "gpt-5.4-mini:swedencentral",
    voiceSv: process.env.VAPI_VOICE_SV ?? "sv-SE-SofieNeural",
    voiceEn: process.env.VAPI_VOICE_EN ?? "en-GB-SoniaNeural",
    twilio: twilioNumber
      ? { number: twilioNumber, accountSid: req("TWILIO_ACCOUNT_SID"), apiKey: req("TWILIO_API_KEY"), apiSecret: req("TWILIO_API_SECRET") }
      : undefined,
    fallbackNumber: process.env.VAPI_FALLBACK_NUMBER || undefined,
    blockedNumbers: (process.env.BLOCKED_TRANSFER_NUMBERS ?? "+4635175570").split(",").map((s) => s.trim()).filter(Boolean),
  };
}
