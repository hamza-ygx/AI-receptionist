import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "yaml";

const root = new URL("../../", import.meta.url);
const read = (p) => readFileSync(new URL(p, root), "utf8");
const office = parse(read("config/office.yaml"));
const facts = parse(read("config/core-facts.yaml"));
const faq = parse(read("config/faq.yaml")).faqs;
const data = {
  office,
  facts,
  faq,
  promptSv: read("prompts/sv/system.v2.md"),
  promptEn: read("prompts/en/system.v2.md"),
};
writeFileSync(new URL("../api/_data.json", import.meta.url), JSON.stringify(data));
console.log("wrote api/_data.json");
