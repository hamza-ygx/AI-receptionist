import { db } from "../lib/db.js";
import { embed, embeddingsConfigured, toVector } from "./embed.js";

export interface FaqHit { id: string; question: string; answer: string; score: number }
export interface ChunkHit { url: string; title: string | null; text: string; score: number }

const RRF_K = 60;

async function queryEmbedding(query: string): Promise<string | null> {
  if (!embeddingsConfigured()) return null;
  try {
    const [v] = await embed([query], 1500);
    return v ? toVector(v) : null;
  } catch {
    return null;
  }
}

export async function searchFaq(query: string, lang: "sv" | "en", vec: string | null, limit = 3): Promise<FaqHit[]> {
  const cfg = lang === "sv"
    ? { tsv: "tsv_sv", dict: "swedish", q: "question_sv", a: "answer_sv" }
    : { tsv: "tsv_en", dict: "english", q: "coalesce(question_en, question_sv)", a: "coalesce(answer_en, answer_sv)" };
  const r = await db().query(
    `WITH fts AS (
       SELECT id, row_number() OVER (ORDER BY ts_rank_cd(${cfg.tsv}, websearch_to_tsquery('${cfg.dict}', $1)) DESC) AS rk
         FROM faqs WHERE active AND ${cfg.tsv} @@ websearch_to_tsquery('${cfg.dict}', $1) LIMIT 20
     ), trg AS (
       SELECT id, row_number() OVER (ORDER BY word_similarity($1, ${cfg.q}) DESC) AS rk
         FROM faqs WHERE active AND word_similarity($1, ${cfg.q}) > 0.3 LIMIT 20
     ), vec AS (
       SELECT id, row_number() OVER (ORDER BY embedding <=> $2::vector) AS rk
         FROM faqs WHERE active AND $2::vector IS NOT NULL AND embedding IS NOT NULL
        ORDER BY embedding <=> $2::vector LIMIT 20
     ), fused AS (
       SELECT id, sum(1.0 / (${RRF_K} + rk)) AS score FROM (
         SELECT * FROM fts UNION ALL SELECT * FROM trg UNION ALL SELECT * FROM vec) u GROUP BY id
     )
     SELECT f.id, ${cfg.q} AS question, ${cfg.a} AS answer, fused.score
       FROM fused JOIN faqs f ON f.id = fused.id
      ORDER BY fused.score DESC LIMIT $3`,
    [query, vec, limit],
  );
  return r.rows.map((x) => ({ id: x.id, question: x.question, answer: x.answer, score: Number(x.score) }));
}

export async function searchChunks(query: string, lang: "sv" | "en", vec: string | null, limit = 4): Promise<ChunkHit[]> {
  const dict = lang === "sv" ? "swedish" : "english";
  const r = await db().query(
    `WITH fts AS (
       SELECT c.id, row_number() OVER (ORDER BY ts_rank_cd(c.tsv, websearch_to_tsquery('${dict}', $1)) DESC) AS rk
         FROM kb_chunks c JOIN kb_pages p ON p.id = c.page_id AND p.status = 'active'
        WHERE c.tsv @@ websearch_to_tsquery('${dict}', $1) LIMIT 30
     ), vec AS (
       SELECT c.id, row_number() OVER (ORDER BY c.embedding <=> $2::vector) AS rk
         FROM kb_chunks c JOIN kb_pages p ON p.id = c.page_id AND p.status = 'active'
        WHERE $2::vector IS NOT NULL AND c.embedding IS NOT NULL
        ORDER BY c.embedding <=> $2::vector LIMIT 30
     ), fused AS (
       SELECT id, sum(1.0 / (${RRF_K} + rk)) AS score FROM (SELECT * FROM fts UNION ALL SELECT * FROM vec) u GROUP BY id
     )
     SELECT p.url, p.title, c.text, c.lang, fused.score
       FROM fused JOIN kb_chunks c ON c.id = fused.id JOIN kb_pages p ON p.id = c.page_id
      ORDER BY (c.lang = $3::call_language) DESC, fused.score DESC LIMIT $4`,
    [query, vec, lang, limit],
  );
  return r.rows.map((x) => ({ url: x.url, title: x.title, text: String(x.text).slice(0, 700), score: Number(x.score) }));
}

export async function searchKnowledge(query: string, lang: "sv" | "en") {
  const vec = await queryEmbedding(query);
  const [faq, pages] = await Promise.all([searchFaq(query, lang, vec), searchChunks(query, lang, vec)]);
  return { faq, pages };
}
