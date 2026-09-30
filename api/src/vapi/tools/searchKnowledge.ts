import { z } from "zod";
import { searchKnowledge } from "../../kb/search.js";
import { defineTool, ok } from "./types.js";
import { langSchema, text } from "./common.js";

export const searchKnowledgeTool = defineTool({
  name: "search_knowledge",
  schema: z.object({ query: text(1, 300), lang: langSchema.optional() }),
  perCallLimit: 15,
  async run({ query, lang }, ctx) {
    const { faq, pages } = await searchKnowledge(query, lang ?? ctx.lang);
    if (!faq.length && !pages.length) {
      return ok({
        found: false,
        instruction: "Nothing relevant found. Do not guess. Offer to book a meeting or take a message for a consultant.",
      });
    }
    return ok({
      found: true,
      authoritativeFaq: faq.map((f) => ({ q: f.question, a: f.answer })),
      websiteExcerpts: pages.map((p) => ({ source: p.url, title: p.title, text: p.text })),
      instruction: "authoritativeFaq wins over websiteExcerpts on conflict. Only state prices, deadlines or rules if they appear verbatim here. Never add advice or interpretation.",
    });
  },
});
