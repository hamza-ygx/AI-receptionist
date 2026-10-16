export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });
  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION || "swedencentral";
  if (!key) return res.status(404).json({ enabled: false });
  try {
    const r = await fetch(`https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key, "Content-Length": "0" },
      signal: AbortSignal.timeout(5000),
    });
    if (!r.ok) return res.status(502).json({ error: "token_failed", status: r.status });
    return res.status(200).json({ token: await r.text(), region });
  } catch {
    return res.status(502).json({ error: "token_unreachable" });
  }
}
