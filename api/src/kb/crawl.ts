import { createRequire } from "node:module";
import type RobotsParser from "robots-parser";

const robotsParser = createRequire(import.meta.url)("robots-parser") as typeof RobotsParser.default;
import { parseHTML } from "linkedom";

const UA = "RKJH-Receptionist-KB/1.0 (+https://rkjh.se)";
const EXCLUDE = [/\/test\/?$/i, /\/feed\/?$/i, /\/(tag|author|category)\//i, /\/wp-(admin|json|login|content|includes)/i, /\?/, /#/, /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|mp3)$/i, /\/page\/\d+\/?$/i];

export interface CrawlPage { url: string; html: string; etag: string | null; lastModified: string | null; status: number }

function sameSite(u: URL, root: URL): boolean {
  return u.hostname.replace(/^www\./, "") === root.hostname.replace(/^www\./, "");
}

export function canonicalUrl(raw: string, base: string): string | null {
  try {
    const u = new URL(raw, base);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    u.hash = "";
    u.search = "";
    u.hostname = u.hostname.toLowerCase();
    if (!u.pathname.endsWith("/") && !/\.[a-z0-9]{2,5}$/i.test(u.pathname)) u.pathname += "/";
    return u.toString();
  } catch {
    return null;
  }
}

async function get(url: string, timeoutMs = 15_000): Promise<Response> {
  return fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,application/xml;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
}

async function sitemapUrls(root: URL, extra: string[]): Promise<string[]> {
  const queue = [...new Set([...extra, `${root.origin}/wp-sitemap.xml`, `${root.origin}/sitemap_index.xml`, `${root.origin}/sitemap.xml`])];
  const seen = new Set<string>();
  const urls: string[] = [];
  while (queue.length && seen.size < 30) {
    const sm = queue.shift()!;
    if (seen.has(sm)) continue;
    seen.add(sm);
    try {
      const res = await get(sm);
      if (!res.ok) continue;
      const { document } = parseHTML(await res.text());
      for (const loc of document.querySelectorAll("sitemap > loc")) queue.push(loc.textContent!.trim());
      for (const loc of document.querySelectorAll("url > loc")) urls.push(loc.textContent!.trim());
    } catch { /* ignore missing sitemaps */ }
  }
  return urls;
}

export async function crawl(rootUrl: string, maxPages = 200, onError: (url: string, err: string) => void = () => undefined): Promise<CrawlPage[]> {
  const root = new URL(rootUrl);
  const robotsUrl = `${root.origin}/robots.txt`;
  let robotsTxt = "";
  try {
    const r = await get(robotsUrl);
    if (r.ok) robotsTxt = await r.text();
  } catch { /* no robots → allowed */ }
  const robots = robotsParser(robotsUrl, robotsTxt);
  const delayMs = Math.min(10_000, Math.max(500, (robots.getCrawlDelay(UA) ?? 1) * 1000));
  const sitemapsFromRobots = robots.getSitemaps();

  const allowed = (u: string) => {
    const url = new URL(u);
    return sameSite(url, root) && !EXCLUDE.some((re) => re.test(url.pathname + url.search)) && robots.isAllowed(u, UA) !== false;
  };

  const queue: string[] = [canonicalUrl(root.toString(), root.toString())!];
  for (const u of await sitemapUrls(root, sitemapsFromRobots)) {
    const c = canonicalUrl(u, root.toString());
    if (c) queue.push(c);
  }
  const seen = new Set<string>();
  const pages: CrawlPage[] = [];
  while (queue.length && pages.length < maxPages) {
    const url = queue.shift()!;
    if (seen.has(url) || !allowed(url)) continue;
    seen.add(url);
    try {
      const res = await get(url);
      const type = res.headers.get("content-type") ?? "";
      if (!res.ok || !type.includes("html")) {
        if (!res.ok) onError(url, `HTTP ${res.status}`);
        continue;
      }
      const finalUrl = canonicalUrl(res.url, root.toString()) ?? url;
      if (finalUrl !== url && (seen.has(finalUrl) || !allowed(finalUrl))) continue;
      seen.add(finalUrl);
      const html = await res.text();
      pages.push({ url: finalUrl, html, etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified"), status: res.status });
      const { document } = parseHTML(html);
      for (const a of document.querySelectorAll("a[href]")) {
        const c = canonicalUrl(a.getAttribute("href") ?? "", finalUrl);
        if (c && !seen.has(c)) queue.push(c);
      }
    } catch (e) {
      onError(url, e instanceof Error ? e.message : String(e));
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return pages;
}
