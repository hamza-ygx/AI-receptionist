import type { ToolDef } from "./types.js";
import { searchKnowledgeTool } from "./searchKnowledge.js";
import { resolveStaff } from "./resolveStaff.js";
import { checkAvailability } from "./checkAvailability.js";
import { bookMeeting } from "./bookMeeting.js";
import { transferToStaff } from "./transferToStaff.js";
import { takeMessage } from "./takeMessage.js";

export const TOOLS: Record<string, ToolDef<any>> = Object.fromEntries(
  [searchKnowledgeTool, resolveStaff, checkAvailability, bookMeeting, transferToStaff, takeMessage].map((t) => [t.name, t]),
);
