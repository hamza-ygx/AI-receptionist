import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PROMPT_VERSION = "v3";

function promptsDir(): string {
  if (process.env.PROMPTS_DIR) return process.env.PROMPTS_DIR;
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [join(here, "../../prompts"), join(here, "../../../prompts"), join(here, "../../../../prompts"), join(process.cwd(), "prompts")];
  return candidates.find((d) => existsSync(join(d, "sv"))) ?? candidates[0]!;
}

const cache = new Map<string, string>();

export function loadPrompt(lang: "sv" | "en"): string {
  const key = `${lang}:${PROMPT_VERSION}`;
  if (!cache.has(key)) cache.set(key, readFileSync(join(promptsDir(), lang, `system.${PROMPT_VERSION}.md`), "utf8"));
  return cache.get(key)!;
}

export function render(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, k: string) => vars[k] ?? "").replace(/\n{3,}/g, "\n\n");
}
