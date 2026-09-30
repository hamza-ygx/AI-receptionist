import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "yaml";
import { z } from "zod";
import { tx } from "../lib/db.js";
import { OfficeConfigSchema } from "../lib/office.js";
import { sameNumber } from "../lib/phone.js";

function configDir(): string {
  if (process.env.CONFIG_DIR) return process.env.CONFIG_DIR;
  const here = dirname(fileURLToPath(import.meta.url));
  return existsSync(join(here, "../../config")) ? join(here, "../../config") : join(here, "../../../config");
}

const StaffFile = z.object({
  staff: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]{1,64}$/),
    name: z.string().min(1),
    role: z.string().min(1),
    topics: z.array(z.string().min(1)).default([]),
    directPhone: z.string().regex(/^\+[1-9]\d{6,14}$/).nullable().default(null),
    upn: z.string().email().nullable().default(null),
    teamsWebhookRef: z.string().regex(/^TEAMS_WEBHOOK_[A-Z0-9_]+$/).nullable().default(null),
    languages: z.array(z.enum(["sv", "en"])).min(1).default(["sv"]),
    transferable: z.boolean().default(false),
    bookable: z.boolean().default(true),
    active: z.boolean().default(true),
  })),
  topicAliases: z.record(z.string(), z.string()).default({}),
});

const CoreFacts = z.object({ sv: z.string().min(1), en: z.string().min(1) });
const FaqFile = z.object({
  faqs: z.array(z.object({
    key: z.string().min(1),
    question_sv: z.string().min(1), answer_sv: z.string().min(1),
    question_en: z.string().optional(), answer_en: z.string().optional(),
    tags: z.array(z.string()).default([]),
  })).default([]),
});

async function load<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  return schema.parse(parse(await readFile(join(configDir(), file), "utf8")));
}

export async function seed(log: (msg: string) => void = console.log): Promise<void> {
  const staffFile = await load("staff.yaml", StaffFile);
  const office = await load("office.yaml", OfficeConfigSchema);
  const facts = await load("core-facts.yaml", CoreFacts);
  const faqFile = await load("faq.yaml", FaqFile).catch(() => ({ faqs: [] }));

  for (const s of staffFile.staff) {
    if (s.directPhone && office.blockedTransferNumbers.some((b) => sameNumber(b, s.directPhone!))) {
      throw new Error(`Staff ${s.id} direct number is on the blocked transfer list (would create a call loop)`);
    }
    if (s.transferable && !s.directPhone) throw new Error(`Staff ${s.id} is transferable but has no directPhone`);
    if (s.bookable && s.active && !s.upn) log(`warning: ${s.id} is bookable but has no upn; booking will be skipped`);
  }

  await tx(async (c) => {
    const ids = staffFile.staff.map((s) => s.id);
    for (const s of staffFile.staff) {
      await c.query(
        `INSERT INTO staff (id, name, role, direct_phone_e164, upn, teams_webhook_ref, languages, transferable, bookable, active, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, now())
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, direct_phone_e164 = EXCLUDED.direct_phone_e164,
           upn = EXCLUDED.upn, teams_webhook_ref = EXCLUDED.teams_webhook_ref, languages = EXCLUDED.languages,
           transferable = EXCLUDED.transferable, bookable = EXCLUDED.bookable, active = EXCLUDED.active, updated_at = now()`,
        [s.id, s.name, s.role, s.directPhone, s.upn, s.teamsWebhookRef, s.languages, s.transferable, s.bookable, s.active],
      );
      await c.query("DELETE FROM staff_topics WHERE staff_id = $1", [s.id]);
      for (const t of new Set(s.topics.map((x) => x.toLowerCase()))) {
        await c.query("INSERT INTO staff_topics (staff_id, topic) VALUES ($1, $2)", [s.id, t]);
      }
    }
    await c.query("UPDATE staff SET active = false, transferable = false, updated_at = now() WHERE NOT (id = ANY($1))", [ids]);
    await c.query("DELETE FROM topic_aliases");
    for (const [alias, topic] of Object.entries(staffFile.topicAliases)) {
      await c.query("INSERT INTO topic_aliases (alias, topic) VALUES ($1, $2)", [alias.toLowerCase(), topic.toLowerCase()]);
    }
    await c.query(
      "INSERT INTO settings (key, value) VALUES ('office', $1), ('core_facts', $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()",
      [JSON.stringify(office), JSON.stringify(facts)],
    );
    for (const f of faqFile.faqs) {
      const tag = `seed:${f.key}`;
      const exists = await c.query("SELECT 1 FROM faqs WHERE $1 = ANY(tags)", [tag]);
      if (!exists.rowCount) {
        await c.query(
          "INSERT INTO faqs (question_sv, answer_sv, question_en, answer_en, tags) VALUES ($1,$2,$3,$4,$5)",
          [f.question_sv, f.answer_sv, f.question_en ?? null, f.answer_en ?? null, [tag, ...f.tags]],
        );
      }
    }
  });
  log(`seeded ${staffFile.staff.length} staff, office settings, core facts, ${faqFile.faqs.length} seed FAQs (insert-only)`);
}
