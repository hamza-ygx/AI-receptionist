import { z } from "zod";
import { db } from "../../lib/db.js";
import { defineTool, ok } from "./types.js";
import { text } from "./common.js";

export interface StaffCandidate {
  staffId: string;
  name: string;
  role: string;
  languages: string[];
  topics: string[];
  transferable: boolean;
  bookable: boolean;
  match: "name" | "topic";
}

export async function findStaff(query: string): Promise<StaffCandidate[]> {
  const q = query.toLowerCase();
  const byName = await db().query(
    `SELECT s.id, s.name, s.role, s.languages::text[] AS languages, s.transferable, s.bookable,
            coalesce(array_agg(t.topic) FILTER (WHERE t.topic IS NOT NULL), '{}') AS topics,
            greatest(similarity(lower(s.name), $1), word_similarity($1, lower(s.name))) AS score
       FROM staff s LEFT JOIN staff_topics t ON t.staff_id = s.id
      WHERE s.active
      GROUP BY s.id
     HAVING greatest(similarity(lower(s.name), $1), word_similarity($1, lower(s.name))) > 0.45
      ORDER BY score DESC LIMIT 3`,
    [q],
  );
  if (byName.rows.length) return byName.rows.map((r) => toCandidate(r, "name"));

  const byTopic = await db().query(
    `WITH topic AS (
       SELECT coalesce(
         (SELECT a.topic FROM topic_aliases a WHERE word_similarity(a.alias, $1) > 0.6 ORDER BY word_similarity(a.alias, $1) DESC LIMIT 1),
         (SELECT t.topic FROM staff_topics t WHERE word_similarity(t.topic, $1) > 0.6 ORDER BY word_similarity(t.topic, $1) DESC LIMIT 1)
       ) AS topic
     )
     SELECT s.id, s.name, s.role, s.languages::text[] AS languages, s.transferable, s.bookable,
            array_agg(DISTINCT t2.topic) AS topics
       FROM topic, staff_topics t
       JOIN staff s ON s.id = t.staff_id AND s.active
       JOIN staff_topics t2 ON t2.staff_id = s.id
      WHERE t.topic = topic.topic
      GROUP BY s.id ORDER BY s.name LIMIT 3`,
    [q],
  );
  return byTopic.rows.map((r) => toCandidate(r, "topic"));
}

function toCandidate(r: Record<string, unknown>, match: "name" | "topic"): StaffCandidate {
  return {
    staffId: r.id as string,
    name: r.name as string,
    role: r.role as string,
    languages: r.languages as string[],
    topics: r.topics as string[],
    transferable: r.transferable as boolean,
    bookable: r.bookable as boolean,
    match,
  };
}

export const resolveStaff = defineTool({
  name: "resolve_staff",
  schema: z.object({ nameOrTopic: text(1, 100) }),
  perCallLimit: 10,
  async run({ nameOrTopic }) {
    const candidates = await findStaff(nameOrTopic);
    if (!candidates.length) {
      return ok({ found: false, instruction: "No matching staff member or topic. Ask the caller to clarify, or offer to take a message for the general reception." });
    }
    return ok({ found: true, candidates });
  },
});
