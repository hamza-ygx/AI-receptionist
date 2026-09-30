import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";

export interface Extracted { title: string | null; text: string; lang: "sv" | "en"; links: string[]; canonical: string | null; noindex: boolean }

const DROP = "script,style,noscript,iframe,svg,form,nav,footer,header,aside,[role=navigation],[aria-hidden=true],.cookie,.cookies,#cookie-notice,.cmplz-cookiebanner,.wpml-ls,.screen-reader-text";

const BLOCK = new Set(["P", "DIV", "SECTION", "ARTICLE", "MAIN", "H1", "H2", "H3", "H4", "H5", "H6", "LI", "UL", "OL", "TR", "TABLE", "BLOCKQUOTE", "PRE", "DL", "DT", "DD", "FIGCAPTION", "ADDRESS", "HEADER", "FOOTER"]);

function blockText(node: Node): string {
  let out = "";
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      out += child.textContent ?? "";
    } else if (child.nodeType === 1) {
      const el = child as Element;
      if (el.tagName === "BR") { out += "\n"; return; }
      if (["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(el.tagName)) return;
      const inner = blockText(el);
      out += BLOCK.has(el.tagName) ? `\n${inner}\n` : inner;
    }
  });
  return out;
}

function normalize(text: string): string {
  return text
    .replace(/ /g, " ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extract(html: string, url: string): Extracted {
  const { document } = parseHTML(html);
  const htmlLang = (document.documentElement?.getAttribute("lang") ?? "").toLowerCase();
  const lang: "sv" | "en" = htmlLang.startsWith("en") || /\/en(\/|$)/.test(new URL(url).pathname) ? "en" : "sv";
  const robots = document.querySelector('meta[name="robots"]')?.getAttribute("content") ?? "";
  const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? null;
  const links = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href") ?? "").filter(Boolean);

  let title: string | null = document.querySelector("title")?.textContent?.trim() ?? null;
  let text = "";
  try {
    const article = new Readability(document.cloneNode(true) as unknown as Document, { charThreshold: 200 }).parse();
    if (article?.content) {
      title = article.title?.trim() || title;
      text = blockText(parseHTML(`<html><body>${article.content}</body></html>`).document.body as unknown as Node);
    }
  } catch { /* fall back below */ }
  if (text.trim().length < 200) {
    document.querySelectorAll(DROP).forEach((n) => n.remove());
    const main = document.querySelector("main, article, #content, .entry-content, .site-content") ?? document.body;
    text = main ? blockText(main as unknown as Node) : "";
  }
  return { title, text: normalize(text), lang, links, canonical, noindex: /noindex/i.test(robots) };
}

export function chunk(text: string, maxChars = 1800, overlapChars = 200): string[] {
  const paras = text.split(/\n+/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let cur = "";
  for (const p of paras) {
    if (p.length > maxChars) {
      if (cur) { chunks.push(cur); cur = ""; }
      for (let i = 0; i < p.length; i += maxChars - overlapChars) chunks.push(p.slice(i, i + maxChars));
      continue;
    }
    if ((cur + "\n" + p).length > maxChars && cur) {
      chunks.push(cur);
      cur = cur.slice(-overlapChars) + "\n" + p;
    } else {
      cur = cur ? `${cur}\n${p}` : p;
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}
