import { app, type InvocationContext, type Timer } from "@azure/functions";
import { logger, errMsg } from "../lib/log.js";
import { nowLocal } from "../lib/office.js";
import { recomputeRollups } from "../retention/rollups.js";
import { purgeExpired } from "../retention/purge.js";
import { postPendingMessages } from "../teams/notify.js";
import { runScrape } from "../kb/ingest.js";
import { migrate } from "../db/migrate.js";
import { seed } from "../db/seed.js";

async function retentionDaily(_t: Timer, ctx: InvocationContext): Promise<void> {
  const log = logger(ctx);
  const today = nowLocal().startOf("day");
  await recomputeRollups(today.minus({ days: 29 }), today.minus({ days: 1 }));
  await purgeExpired(log);
}

export function registerJobs(): void {
  app.http("health", {
    route: "health",
    methods: ["GET"],
    authLevel: "anonymous",
    handler: async () => ({ status: 200, jsonBody: { ok: true } }),
  });

  app.http("adminMigrate", {
    route: "admin/migrate",
    methods: ["POST"],
    authLevel: "admin",
    handler: async (_req, ctx) => {
      const lines: string[] = [];
      const applied = await migrate((m) => { lines.push(m); ctx.log(m); });
      return { status: 200, jsonBody: { applied, log: lines } };
    },
  });

  app.http("adminSeed", {
    route: "admin/seed",
    methods: ["POST"],
    authLevel: "admin",
    handler: async (_req, ctx) => {
      const lines: string[] = [];
      await seed((m) => { lines.push(m); ctx.log(m); });
      return { status: 200, jsonBody: { ok: true, log: lines } };
    },
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
