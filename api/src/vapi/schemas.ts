import { z } from "zod";

export const CallRef = z.looseObject({
  id: z.string().min(1).max(128),
  customer: z.looseObject({ number: z.string().optional().nullable() }).optional().nullable(),
  startedAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
  cost: z.number().optional().nullable(),
  costBreakdown: z.record(z.string(), z.unknown()).optional().nullable(),
});

const AssistantRef = z.looseObject({ name: z.string().optional().nullable() }).optional().nullable();

export const ToolCall = z.looseObject({
  id: z.string().min(1).max(200),
  function: z.looseObject({
    name: z.string().min(1).max(64),
    arguments: z.union([z.record(z.string(), z.unknown()), z.string()]).optional(),
  }),
});

export const Envelope = z.object({
  message: z.looseObject({
    type: z.string().min(1).max(64),
    call: CallRef.optional().nullable(),
    assistant: AssistantRef,
    customer: z.looseObject({ number: z.string().optional().nullable() }).optional().nullable(),
  }),
});

export const ToolCallsMessage = z.looseObject({
  type: z.literal("tool-calls"),
  call: CallRef,
  assistant: AssistantRef,
  toolCallList: z.array(ToolCall).min(1).max(10),
});

export const StatusUpdateMessage = z.looseObject({
  type: z.literal("status-update"),
  call: CallRef.optional().nullable(),
  status: z.string().optional(),
  endedReason: z.string().optional().nullable(),
  destination: z.looseObject({ number: z.string().optional() }).optional().nullable(),
});

export const TransferUpdateMessage = z.looseObject({
  type: z.literal("transfer-update"),
  call: CallRef.optional().nullable(),
  destination: z.looseObject({ number: z.string().optional() }).optional().nullable(),
});

export const EndOfCallReport = z.looseObject({
  type: z.literal("end-of-call-report"),
  call: CallRef,
  assistant: AssistantRef,
  endedReason: z.string().optional().nullable(),
  startedAt: z.string().optional().nullable(),
  endedAt: z.string().optional().nullable(),
  cost: z.number().optional().nullable(),
  costs: z.array(z.record(z.string(), z.unknown())).optional().nullable(),
  analysis: z.looseObject({
    summary: z.string().optional().nullable(),
    structuredData: z.record(z.string(), z.unknown()).optional().nullable(),
  }).optional().nullable(),
  artifact: z.looseObject({
    transcript: z.string().optional().nullable(),
    messages: z.array(z.looseObject({ role: z.string().optional(), message: z.string().optional() })).optional().nullable(),
    structuredOutputs: z.record(z.string(), z.looseObject({ name: z.string().optional(), result: z.unknown() })).optional().nullable(),
    transfers: z.array(z.unknown()).optional().nullable(),
  }).optional().nullable(),
});

export const CallDeletedMessage = z.looseObject({
  type: z.enum(["call.deleted", "call.delete.failed"]),
  call: CallRef.optional().nullable(),
  callId: z.string().optional(),
});

export type ToolCallT = z.infer<typeof ToolCall>;
export type EndOfCallReportT = z.infer<typeof EndOfCallReport>;
