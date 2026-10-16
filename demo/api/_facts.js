import { readFileSync } from "node:fs";

const FACTS = JSON.parse(readFileSync(new URL("./_data.json", import.meta.url), "utf8")).copilotFacts ?? [];

const norm = (s) => String(s).toLowerCase().normalize("NFC").replace(/[^\p{L}\p{N}% ]/gu, " ").replace(/\s+/g, " ").trim();

export function matchFacts(text, max = 2) {
  if (!FACTS.length || !text) return [];
  const t = ` ${norm(text)} `;
  return FACTS
    .map((f) => ({ f, hits: f.keywords.filter((k) => t.includes(` ${norm(k)} `) || t.includes(norm(k))).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, max)
    .map(({ f }) => ({ fact: f.fact, validFor: f.valid_for ?? "", source: f.source, verifiedBy: f.verified_by, verifiedOn: String(f.verified_on) }));
}

export function factsPrompt(items) {
  if (!items.length) return "";
  return `<bekräftade_fakta_från_byrån>\n${items.map((i) => `- ${i.fact} (gäller ${i.validFor || "se källa"}; källa ${i.source}; kontrollerat av ${i.verifiedBy} ${i.verifiedOn})`).join("\n")}\n</bekräftade_fakta_från_byrån>\nOm dessa fakta besvarar frågan: använd dem ordagrant och motsäg dem inte. Sök ändå för att bekräfta att de fortfarande gäller.\n\n`;
}
