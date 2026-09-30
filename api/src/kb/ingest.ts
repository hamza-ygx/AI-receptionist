import { db, tx } from "../lib/db.js";
import { optional, optionalInt } from "../lib/config.js";
import { sha256Hex } from "../lib/crypto.js";
import { errMsg, type Logger } from "../lib/log.js";
import { crawl } from "./crawl.js";
import { chunk, extract, type Extracted } from "./extract.js";
import { embed, embeddingsConfigured, estimateTokens, toVector } from "./embed.js";
import { buildCorpus } from "./inline.js";

interface Page extends Extracted { url: string; etag: string | null; lastModified: string | null }

function stripBoilerplate(pages: Page[]): Page[] {
  if (pages.length < 4) return pages;
  const freq = new Map<string, number>();
  for (const p of pages) for (const para of new Set(p.text.split("\n"))) freq.set(para, (freq.get(para) ?? 0) + 1);
  const threshold = Math.max(3, Math.ceil(pages.length * 0.5));
  return pages.map((p) => ({ ...p, text: p.text.split("\n").filter((para) => (freq.get(para) ?? 0) < threshold || para.length > 400).join("\n") }));
}

async function embedMany(texts: string[]): Promise<(number[] | null)[]> {
  if (!embeddingsConfigured()) return texts.map(() => null);
  const out: (number[] | null)[] = [];
  for (let i = 0; i < texts.length; i += 16) out.push(...(await embed(texts.slice(i, i + 16), 30_000)));
  return out;
}

export async function embedMissingFaqs(log: Logger): Promise<number> {
  if (!embeddingsConfigured()) return 0;
  const r = await db().query<{ id: string; q: string; a: string }>("SELECT id, question_sv AS q, answer_sv AS a FROM faqs WHERE embedding IS NULL AND active LIMIT 200");
  if (!r.rows.length) return 0;
  const vecs = await embedMany(r.rows.map((f) => `${f.q}\n${f.a}`));
  for (const [i, f] of r.rows.entries()) {
    const v = vecs[i];
    if (v) await db().query("UPDATE faqs SET embedding = $2::vector WHERE id = $1", [f.id, toVector(v)]);
  }
  log.info("FAQ embeddings refreshed", { count: r.rows.length });
  return r.rows.length;
}

export async function decideRetrievalMode(): Promise<{ mode: "inline" | "search"; corpusTokens: number }> {
  const corpus = await buildCorpus();
  const corpusTokens = estimateTokens(corpus.sv);
  const mode = corpusTokens <= optionalInt("KB_INLINE_MAX_TOKENS", 6000) ? "inline" : "search";
  await db().query(
    "INSERT INTO settings (key, value) VALUES ('kb_state', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
    [JSON.stringify({ mode, corpusTokens, decidedAt: new Date().toISOString() })],
  );
  return { mode, corpusTokens };
}

export async function runScrape(trigger: "timer" | "manual" | "cli", log: Logger) {
  const run = await db().query<{ id: string }>("INSERT INTO scrape_runs (trigger) VALUES ($1) RETURNING id", [trigger]);
  const runId = run.rows[0]!.id;
  const errors: { url: string; err: string }[] = [];
  let changed = 0;
  let removed = 0;
  try {
    const raw = await crawl(optional("KB_ROOT_URL", "https://rkjh.se"), optionalInt("KB_MAX_PAGES", 200), (url, err) => errors.push({ url, err }));
    if (!raw.length) throw new Error("Crawl returned no pages; keeping existing knowledge base");

    const seenHashes = new Set<string>();
    const pages = stripBoilerplate(raw.map((p) => ({ ...extract(p.html, p.url), url: p.url, etag: p.etag, lastModified: p.lastModified })))
      .filter((p) => !p.noindex && p.text.length >= 80)
      .filter((p) => {
        const h = sha256Hex(p.text);
        if (seenHashes.has(h)) return false;
        seenHashes.add(h);
        return true;
      });

    for (const p of pages) {
      const hash = sha256Hex(p.text);
      const existing = await db().query<{ id: string; content_hash: string; status: string }>("SELECT id, content_hash, status FROM kb_pages WHERE url = $1", [p.url]);
      const row = existing.rows[0];
      if (row && row.content_hash === hash && row.status === "active") {
        await db().query("UPDATE kb_pages SET fetched_at = now(), etag = $2, last_modified = $3 WHERE id = $1", [row.id, p.etag, p.lastModified]);
        continue;
      }
      const pieces = chunk(p.text);
      let vectors: (number[] | null)[] = pieces.map(() => null);
      try {
        vectors = await embedMany(pieces);
      } catch (e) {
        errors.push({ url: p.url, err: `embedding: ${errMsg(e)}` });
      }
      const dict = p.lang === "sv" ? "swedish" : "english";
      await tx(async (c) => {
        const up = await c.query<{ id: string }>(
          `INSERT INTO kb_pages (url, title, lang, content_hash, text, tokens, etag, last_modified, status, fetched_at, changed_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'active',now(),now())
           ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title, lang = EXCLUDED.lang, content_hash = EXCLUDED.content_hash,
             text = EXCLUDED.text, tokens = EXCLUDED.tokens, etag = EXCLUDED.etag, last_modified = EXCLUDED.last_modified,
             status = 'active', fetched_at = now(), changed_at = now()
           RETURNING id`,
          [p.url, p.title, p.lang, hash, p.text, estimateTokens(p.text), p.etag, p.lastModified],
        );
        const pageId = up.rows[0]!.id;
        await c.query("DELETE FROM kb_chunks WHERE page_id = $1", [pageId]);
        for (const [i, text] of pieces.entries()) {
          const v = vectors[i];
          await c.query(
            `INSERT INTO kb_chunks (page_id, ord, lang, text, tokens, embedding, tsv)
             VALUES ($1,$2,$3,$4,$5,$6::vector, to_tsvector('${dict}', coalesce($7, '') || ' ' || $4))`,
            [pageId, i, p.lang, text, estimateTokens(text), v ? toVector(v) : null, p.title],
          );
        }
      });
      changed++;
    }

    const urls = pages.map((p) => p.url);
    const gone = await db().query<{ id: string }>(
      "UPDATE kb_pages SET status = 'gone' WHERE status = 'active' AND NOT (url = ANY($1)) RETURNING id",
      [urls],
    );
    if (gone.rows.length) await db().query("DELETE FROM kb_chunks WHERE page_id = ANY($1)", [gone.rows.map((r) => r.id)]);
    removed = gone.rows.length;

    await embedMissingFaqs(log);
    const decision = await decideRetrievalMode();
    await db().query(
      `UPDATE scrape_runs SET finished_at = now(), pages_seen = $2, pages_changed = $3, pages_removed = $4,
         corpus_tokens = $5, retrieval_mode = $6, errors = $7 WHERE id = $1`,
      [runId, pages.length, changed, removed, decision.corpusTokens, decision.mode, JSON.stringify(errors.slice(0, 50))],
    );
    log.info("KB scrape complete", { pages: pages.length, changed, removed, ...decision, errors: errors.length });
    return { runId, pages: pages.length, changed, removed, ...decision, errors };
  } catch (e) {
    errors.push({ url: "*", err: errMsg(e) });
    await db().query("UPDATE scrape_runs SET finished_at = now(), errors = $2 WHERE id = $1", [runId, JSON.stringify(errors.slice(0, 50))]);
    log.error("KB scrape failed", { err: errMsg(e) });
    throw e;
  }
}
