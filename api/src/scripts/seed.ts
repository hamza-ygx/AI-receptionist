import { seed } from "../db/seed.js";
import { db } from "../lib/db.js";

seed()
  .then(() => db().end())
  .catch((e) => { console.error(e); process.exit(1); });
