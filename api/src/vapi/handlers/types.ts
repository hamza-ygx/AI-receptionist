import type { z } from "zod";
import type { ToolCallsMessage, EndOfCallReport, StatusUpdateMessage } from "../schemas.js";

export type ToolsCallsMessageT = z.infer<typeof ToolCallsMessage>;
export type EndOfCallReportT = z.infer<typeof EndOfCallReport>;
export type StatusUpdateT = z.infer<typeof StatusUpdateMessage>;
