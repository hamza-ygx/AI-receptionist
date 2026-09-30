import { app, type InvocationContext, type Timer } from "@azure/functions";
import { vapiEvents } from "../vapi/router.js";
import { logger, errMsg } from "../lib/log.js";
import { nowLocal } from "../lib/office.js";
import { processVapiDeletions, unconfirmedDeletions } from "../retention/vapiDeletion.js";
import { recomputeRollups } from "../retention/rollups.js";
import { purgeExpired } from "../retention/purge.js";
import { postPendingMessages } from "../teams/notify.js";
import { runScrape } from "../kb/ingest.js";

async function retentionDaily(_t: Timer, ctx: InvocationContext): Promise<void> {
  const log = logger(ctx);
  const today = nowLocal().startOf("day");
  await recomputeRollups(today.minus({ days: 29 }), today.minus({ days: 1 }));
  await purgeExpired(log);
  await processVapiDeletions(log, 500);
  const stale = await unconfirmedDeletions(24);
  if (stale > 0) log.error("ALERT: Vapi call deletions unconfirmed after 24h", { count: stale });
}

export function registerVoice(): void {
  app.http("vapiEvents", {
    route: "vapi/events",
    methods: ["POST"],
    authLevel: "anonymous",
    handler: vapiEvents,
  });

  app.http("health", {
    route: "health",
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async () => ({ status: 200, jsonBody: { ok: true } }),
  });

  app.timer("vapiDeletions", {
    schedule: "0 */10 * * * *",
    handler: async (_t, ctx) => { await processVapiDeletions(logger(ctx)); },
  });

  app.timer("rollupsHourly", {
    schedule: "0 5 * * * *",
    handler: async (_t, ctx) => {
      const today = nowLocal().startOf("day");
      await recomputeRollups(today.minus({ days: 1 }), today).catch((e) => logger(ctx).error("Hourly rollup failed", { err: errMsg(e) }));
    },
  });

  app.timer("retentionDaily", {
    schedule: "0 30 0 * * *",
    handler: retentionDaily,
  });

  app.timer("kbScrapeWeekly", {
    schedule: "0 0 1 * * 1",
    handler: async (_t, ctx) => { await runScrape("timer", logger(ctx)); },
  });

  app.storageQueue("kbScrapeManual", {
    queueName: "kb-scrape",
    connection: "AzureWebJobsStorage",
    handler: async (_msg, ctx) => { await runScrape("manual", logger(ctx)); },
  });

  app.timer("messagesSweep", {
    schedule: "0 */5 * * * *",
    handler: async (_t, ctx) => { await postPendingMessages(null, 10, logger(ctx)); },
  });
}
