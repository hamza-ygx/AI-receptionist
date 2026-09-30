import { app } from "@azure/functions";
import { appRole } from "./lib/config.js";
import { registerVoice } from "./functions/voice.js";

app.setup({ enableHttpStream: false });

const role = appRole();
if (role === "voice" || role === "all") registerVoice();
