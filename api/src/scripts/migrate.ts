import { migrate } from "../db/migrate.js";
import { db } from "../lib/db.js";

migrate()
  .then(() => db().end())
  .catch((e) => { console.error(e); process.exit(1); });
