import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";

const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const office = parse(read("config/office.yaml"));
const facts = parse(read("config/core-facts.yaml"));
const faq = parse(read("config/faq.yaml")).faqs;
const copilotFacts = (parse(read("config/copilot-facts.yaml")).facts ?? []).filter((f) => f && f.fact && f.source && f.verified_by && f.verified_on && Array.isArray(f.keywords) && f.keywords.length);
const data = {
  office,
  facts,
  faq,
  copilotFacts,
  promptSv: read("prompts/sv/system.v3.md"),
  promptEn: read("prompts/en/system.v3.md"),
};
writeFileSync(new URL("../api/_data.json", import.meta.url), JSON.stringify(data));
console.log("wrote api/_data.json");
