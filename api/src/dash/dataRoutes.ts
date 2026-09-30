import { z } from "zod";
import { QueueClient } from "@azure/storage-queue";
import { DefaultAzureCredential } from "@azure/identity";
import { db, tx } from "../lib/db.js";
import { errMsg } from "../lib/log.js";
import { embedMissingFaqs, decideRetrievalMode } from "../kb/ingest.js";
import { audit, HttpError, parse, route } from "./http.js";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const outcome = z.enum(["faq_answered", "booked", "transferred", "message_taken", "abandoned"]);

route("GET", "/staff", "user", async () => {
  const r = await db().query("SELECT id, name, role, active FROM staff ORDER BY active DESC, name");
  return { body: { staff: r.rows } };
});

route("GET", "/calls", "user", async (c) => {
  const q = parse(z.object({
    from: dateStr.optional(), to: dateStr.optional(), outcome: outcome.optional(),
    staffId: z.string().max(64).optional(), language: z.enum(["sv", "en"]).optional(),
    q: z.string().trim().max(100).optional(), page: z.coerce.number().int().min(1).max(1000).default(1),
    pageSize: z.coerce.number().int().min(10).max(100).default(25),
  }), Object.fromEntries(c.query));
  const where: string[] = [];
  const args: unknown[] = [];
  const add = (sql: string, v: unknown) => { args.push(v); where.push(sql.replace("$?", `$${args.length}`)); };
  if (q.from) add("started_at >= ($?::date::timestamp AT TIME ZONE 'Europe/Stockholm')", q.from);
  if (q.to) add("started_at < (($?::date + 1)::timestamp AT TIME ZONE 'Europe/Stockholm')", q.to);
  if (q.outcome) add("outcome = $?", q.outcome);
  if (q.staffId) add("staff_id = $?", q.staffId);
  if (q.language) add("language = $?", q.language);
  if (q.q) {
    args.push(q.q, `%${q.q.replace(/[%_\\]/g, "\\$&")}%`);
    where.push(`(search @@ websearch_to_tsquery('swedish', $${args.length - 1}) OR caller_number_e164 LIKE $${args.length} OR callback_number LIKE $${args.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = await db().query(`SELECT count(*) AS n FROM calls ${whereSql}`, args);
  args.push(q.pageSize, (q.page - 1) * q.pageSize);
  const rows = await db().query(
    `SELECT c.id, c.started_at, c.duration_s, c.language, c.caller_number_e164, c.caller_name, c.company, c.reason,
            c.outcome, c.urgency, c.staff_id, s.name AS staff_name, c.cost_total
       FROM calls c LEFT JOIN staff s ON s.id = c.staff_id
       ${whereSql} ORDER BY c.started_at DESC LIMIT $${args.length - 1} OFFSET $${args.length}`,
    args,
  );
  return { body: { total: Number(total.rows[0].n), page: q.page, pageSize: q.pageSize, calls: rows.rows } };
});

route("GET", "/calls/:id", "user", async (c) => {
  const id = parse(z.string().min(1).max(128), c.params.id);
  const call = (await db().query(
    `SELECT c.*, s.name AS staff_name FROM calls c LEFT JOIN staff s ON s.id = c.staff_id WHERE c.id = $1`, [id],
  )).rows[0];
  if (!call) throw new HttpError(404, "not_found");
  delete call.search;
  const [bookings, messages, transfers] = await Promise.all([
    db().query("SELECT b.*, s.name AS staff_name FROM bookings b JOIN staff s ON s.id = b.staff_id WHERE call_id = $1 ORDER BY start_at", [id]),
    db().query("SELECT m.*, s.name AS staff_name FROM messages m LEFT JOIN staff s ON s.id = m.staff_id WHERE call_id = $1 ORDER BY created_at", [id]),
    db().query("SELECT t.id, t.staff_id, s.name AS staff_name, t.reason, t.status, t.created_at FROM transfers t JOIN staff s ON s.id = t.staff_id WHERE call_id = $1 ORDER BY created_at", [id]),
  ]);
  await audit(c.session!.userId, "call.viewed", id);
  return { body: { call, bookings: bookings.rows, messages: messages.rows, transfers: transfers.rows } };
});

route("DELETE", "/calls/:id", "admin", async (c) => {
  const id = parse(z.string().min(1).max(128), c.params.id);
  const deleted = await tx(async (t) => {
    const r = await t.query("DELETE FROM calls WHERE id = $1", [id]);
    await t.query("DELETE FROM bookings WHERE call_id = $1", [id]);
    await t.query("DELETE FROM messages WHERE call_id = $1", [id]);
    await t.query("DELETE FROM transfers WHERE call_id = $1", [id]);
    await t.query("DELETE FROM tool_call_results WHERE call_id = $1", [id]);
    await t.query(
      `INSERT INTO vapi_deletions (call_id) VALUES ($1)
       ON CONFLICT (call_id) DO UPDATE SET next_attempt_at = now() WHERE vapi_deletions.confirmed_at IS NULL`,
      [id],
    );
    return r.rowCount ?? 0;
  });
  if (!deleted) throw new HttpError(404, "not_found");
  await audit(c.session!.userId, "call.erased", id);
  return { body: { ok: true } };
});

route("GET", "/messages", "user", async (c) => {
  const q = parse(z.object({ status: z.enum(["open", "handled", "all"]).default("open"), staffId: z.string().max(64).optional() }), Object.fromEntries(c.query));
  const r = await db().query(
    `SELECT m.id, m.call_id, m.staff_id, s.name AS staff_name, m.caller_name, m.company, m.phone_e164, m.reason, m.urgency,
            m.language, m.created_at, m.handled_at, u.display_name AS handled_by_name
       FROM messages m LEFT JOIN staff s ON s.id = m.staff_id LEFT JOIN users u ON u.id = m.handled_by
      WHERE ($1 = 'all' OR ($1 = 'open') = (m.handled_at IS NULL)) AND ($2::text IS NULL OR m.staff_id = $2)
      ORDER BY (m.urgency = 'high') DESC, m.created_at DESC LIMIT 200`,
    [q.status, q.staffId ?? null],
  );
  return { body: { messages: r.rows } };
});

route("PATCH", "/messages/:id", "user", async (c) => {
  const id = parse(z.uuid(), c.params.id);
  const { handled } = parse(z.object({ handled: z.boolean() }), c.body);
  const r = await db().query(
    `UPDATE messages SET handled_at = CASE WHEN $2 THEN now() ELSE NULL END, handled_by = CASE WHEN $2 THEN $3::uuid ELSE NULL END WHERE id = $1`,
    [id, handled, c.session!.userId],
  );
  if (!r.rowCount) throw new HttpError(404, "not_found");
  await audit(c.session!.userId, handled ? "message.handled" : "message.reopened", id);
  return { body: { ok: true } };
});

route("GET", "/analytics", "user", async (c) => {
  const q = parse(z.object({ from: dateStr, to: dateStr }), Object.fromEntries(c.query));
  const rows = (await db().query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS day, language, outcome, calls, total_duration_s, total_cost, bookings,
            transfers_attempted, transfers_connected, messages, hour_histogram
       FROM daily_rollups WHERE day BETWEEN $1 AND $2 ORDER BY day`,
    [q.from, q.to],
  )).rows;
  const days = new Map<string, { day: string; calls: number; bookings: number; messages: number; cost: number; duration: number }>();
  const outcomes: Record<string, number> = {};
  const languages: Record<string, number> = {};
  const hours = Array(24).fill(0) as number[];
  const months = new Map<string, { month: string; calls: number; cost: number }>();
  let calls = 0, duration = 0, cost = 0, bookings = 0, tAtt = 0, tConn = 0, messages = 0;
  for (const r of rows) {
    const d = days.get(r.day) ?? { day: r.day, calls: 0, bookings: 0, messages: 0, cost: 0, duration: 0 };
    d.calls += r.calls; d.bookings += r.bookings; d.messages += r.messages; d.cost += Number(r.total_cost); d.duration += Number(r.total_duration_s);
    days.set(r.day, d);
    const m = months.get(r.day.slice(0, 7)) ?? { month: r.day.slice(0, 7), calls: 0, cost: 0 };
    m.calls += r.calls; m.cost += Number(r.total_cost);
    months.set(m.month, m);
    outcomes[r.outcome] = (outcomes[r.outcome] ?? 0) + r.calls;
    languages[r.language] = (languages[r.language] ?? 0) + r.calls;
    (r.hour_histogram as number[]).forEach((n, i) => { hours[i]! += n; });
    calls += r.calls; duration += Number(r.total_duration_s); cost += Number(r.total_cost);
    bookings += r.bookings; tAtt += r.transfers_attempted; tConn += r.transfers_connected; messages += r.messages;
  }
  const lastComputed = (await db().query("SELECT max(computed_at) AS at FROM daily_rollups")).rows[0].at;
  return {
    body: {
      totals: {
        calls, bookings, messages, transfersAttempted: tAtt, transfersConnected: tConn,
        transferSuccessRate: tAtt ? tConn / tAtt : null,
        avgDurationS: calls ? duration / calls : null,
        totalCostUsd: cost, costPerCallUsd: calls ? cost / calls : null,
      },
      daily: [...days.values()],
      monthly: [...months.values()],
      outcomes, languages, hours, lastComputed,
    },
  };
});

const faqBody = z.object({
  questionSv: z.string().trim().min(3).max(500), answerSv: z.string().trim().min(1).max(3000),
  questionEn: z.string().trim().max(500).optional().nullable(), answerEn: z.string().trim().max(3000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).default([]), active: z.boolean().default(true),
});

async function afterFaqChange(log: Parameters<typeof embedMissingFaqs>[0]): Promise<void> {
  try {
    await embedMissingFaqs(log);
    await decideRetrievalMode();
  } catch (e) {
    log.warn("FAQ post-processing failed", { err: errMsg(e) });
  }
}

route("GET", "/faq", "user", async () => {
  const r = await db().query(
    `SELECT f.id, f.question_sv, f.answer_sv, f.question_en, f.answer_en, f.tags, f.active, f.updated_at, u.display_name AS updated_by_name
       FROM faqs f LEFT JOIN users u ON u.id = f.updated_by ORDER BY f.active DESC, f.question_sv`,
  );
  return { body: { faqs: r.rows } };
});

route("POST", "/faq", "user", async (c) => {
  const b = parse(faqBody, c.body);
  const r = await db().query(
    "INSERT INTO faqs (question_sv, answer_sv, question_en, answer_en, tags, active, updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id",
    [b.questionSv, b.answerSv, b.questionEn || null, b.answerEn || null, b.tags, b.active, c.session!.userId],
  );
  await audit(c.session!.userId, "faq.created", r.rows[0].id);
  await afterFaqChange(c.log);
  return { status: 201, body: { id: r.rows[0].id } };
});

route("PUT", "/faq/:id", "user", async (c) => {
  const id = parse(z.uuid(), c.params.id);
  const b = parse(faqBody, c.body);
  const r = await db().query(
    `UPDATE faqs SET question_sv = $2, answer_sv = $3, question_en = $4, answer_en = $5, tags = $6, active = $7,
       updated_by = $8, updated_at = now(), embedding = NULL WHERE id = $1`,
    [id, b.questionSv, b.answerSv, b.questionEn || null, b.answerEn || null, b.tags, b.active, c.session!.userId],
  );
  if (!r.rowCount) throw new HttpError(404, "not_found");
  await audit(c.session!.userId, "faq.updated", id);
  await afterFaqChange(c.log);
  return { body: { ok: true } };
});

route("DELETE", "/faq/:id", "user", async (c) => {
  const id = parse(z.uuid(), c.params.id);
  const r = await db().query("DELETE FROM faqs WHERE id = $1", [id]);
  if (!r.rowCount) throw new HttpError(404, "not_found");
  await audit(c.session!.userId, "faq.deleted", id);
  await afterFaqChange(c.log);
  return { body: { ok: true } };
});

route("GET", "/kb/status", "user", async () => {
  const state = (await db().query("SELECT value FROM settings WHERE key = 'kb_state'")).rows[0]?.value ?? null;
  const runs = await db().query(
    `SELECT id, trigger, started_at, finished_at, pages_seen, pages_changed, pages_removed, corpus_tokens, retrieval_mode,
            jsonb_array_length(errors) AS error_count FROM scrape_runs ORDER BY started_at DESC LIMIT 10`,
  );
  return { body: { state, runs: runs.rows } };
});

route("GET", "/kb/pages", "user", async () => {
  const r = await db().query(
    `SELECT p.id, p.url, p.title, p.lang, p.tokens, p.status, p.fetched_at, p.changed_at,
            (SELECT count(*) FROM kb_chunks k WHERE k.page_id = p.id)::int AS chunks
       FROM kb_pages p ORDER BY p.status, p.url`,
  );
  return { body: { pages: r.rows } };
});

route("GET", "/kb/pages/:id", "user", async (c) => {
  const id = parse(z.uuid(), c.params.id);
  const r = await db().query("SELECT id, url, title, lang, tokens, status, text, content_hash, fetched_at, changed_at FROM kb_pages WHERE id = $1", [id]);
  if (!r.rows[0]) throw new HttpError(404, "not_found");
  return { body: { page: r.rows[0] } };
});

function scrapeQueue(): QueueClient {
  const url = process.env.KB_QUEUE_URL;
  if (url) return new QueueClient(url, new DefaultAzureCredential());
  const conn = process.env.AzureWebJobsStorage;
  if (!conn) throw new HttpError(503, "queue_not_configured");
  return new QueueClient(conn, "kb-scrape");
}

route("POST", "/kb/rescrape", "admin", async (c) => {
  const running = await db().query("SELECT 1 FROM scrape_runs WHERE finished_at IS NULL AND started_at > now() - interval '30 minutes'");
  if (running.rowCount) throw new HttpError(409, "scrape_in_progress");
  const q = scrapeQueue();
  await q.createIfNotExists();
  await q.sendMessage(Buffer.from(JSON.stringify({ requestedBy: c.session!.userId, at: new Date().toISOString() })).toString("base64"));
  await audit(c.session!.userId, "kb.rescrape_requested", null);
  return { status: 202, body: { ok: true } };
});
