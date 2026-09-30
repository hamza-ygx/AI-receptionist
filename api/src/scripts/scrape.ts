import { runScrape } from "../kb/ingest.js";
import { logger } from "../lib/log.js";
import { db } from "../lib/db.js";

runScrape("cli", logger())
  .then((r) => console.log(JSON.stringify({ ...r, errors: r.errors.length }, null, 2)))
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => db().end());
