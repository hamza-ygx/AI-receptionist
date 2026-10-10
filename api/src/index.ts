import { app } from "@azure/functions";
import { appRole } from "./lib/config.js";
import { registerJobs } from "./functions/jobs.js";
import { registerDash } from "./functions/dash.js";

app.setup({ enableHttpStream: false });

const role = appRole();
if (role === "jobs" || role === "all") registerJobs();
if (role === "dash" || role === "all") registerDash();
