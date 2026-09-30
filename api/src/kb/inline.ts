import { db } from "../lib/db.js";

interface KbState { mode: "inline" | "search"; corpusTokens: number }

let cache: { at: number; value: { sv: string; en: string } | null } | undefined;

export async function kbState(): Promise<KbState | null> {
  const r = await db().query<{ value: KbState }>("SELECT value FROM settings WHERE key = 'kb_state'");
  return r.rows[0]?.value ?? null;
}

export async function buildCorpus(): Promise<{ sv: string; en: string }> {
  const faqs = await db().query("SELECT question_sv, answer_sv, question_en, answer_en FROM faqs WHERE active ORDER BY created_at");
  const pages = await db().query("SELECT url, title, lang, text FROM kb_pages WHERE status = 'active' ORDER BY url");
  const build = (lang: "sv" | "en") => {
    const faqPart = faqs.rows
      .map((f) => lang === "sv" ? `F: ${f.question_sv}\nS: ${f.answer_sv}` : `Q: ${f.question_en ?? f.question_sv}\nA: ${f.answer_en ?? f.answer_sv}`)
      .join("\n\n");
    const pagePart = pages.rows
      .filter((p) => p.lang === lang)
      .map((p) => `### ${p.title ?? p.url} (${p.url})\n${p.text}`)
      .join("\n\n");
    return [
      faqPart && (lang === "sv" ? "## Manuella FAQ (gäller före webbplatsen)\n" : "## Manual FAQ (overrides website)\n") + faqPart,
      pagePart && (lang === "sv" ? "## Webbplatsen rkjh.se\n" : "## Website rkjh.se\n") + pagePart,
    ].filter(Boolean).join("\n\n");
  };
  return { sv: build("sv"), en: build("en") };
}

export async function inlineCorpus(): Promise<{ sv: string; en: string } | null> {
  if (cache && Date.now() - cache.at < 5 * 60_000) return cache.value;
  const state = await kbState();
  const value = state?.mode === "inline" ? await buildCorpus() : null;
  cache = { at: Date.now(), value };
  return value;
}
