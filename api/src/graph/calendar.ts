import { DateTime, Interval } from "luxon";
import { graph } from "./client.js";
import { TZ } from "../lib/config.js";

const GRAPH_TZ = "W. Europe Standard Time";

interface ScheduleItem { status: string; start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string } }
interface ScheduleInfo { scheduleId: string; scheduleItems?: ScheduleItem[]; error?: { message?: string; responseCode?: string } }

const BUSY = new Set(["busy", "tentative", "oof", "unknown"]);

function fromGraph(dt: { dateTime: string; timeZone: string }): DateTime {
  const zone = dt.timeZone === GRAPH_TZ ? TZ : dt.timeZone === "UTC" ? "UTC" : TZ;
  return DateTime.fromISO(dt.dateTime, { zone });
}

export async function busyIntervals(upns: string[], from: DateTime, to: DateTime): Promise<Map<string, Interval[]>> {
  const result = new Map<string, Interval[]>();
  if (!upns.length) return result;
  for (let i = 0; i < upns.length; i += 20) {
    const batch = upns.slice(i, i + 20);
    const res = await graph<{ value: ScheduleInfo[] }>(
      "POST",
      `/users/${encodeURIComponent(batch[0]!)}/calendar/getSchedule`,
      {
        schedules: batch,
        startTime: { dateTime: from.setZone(TZ).toFormat("yyyy-MM-dd'T'HH:mm:ss"), timeZone: GRAPH_TZ },
        endTime: { dateTime: to.setZone(TZ).toFormat("yyyy-MM-dd'T'HH:mm:ss"), timeZone: GRAPH_TZ },
        availabilityViewInterval: 15,
      },
      { Prefer: `outlook.timezone="${GRAPH_TZ}"` },
    );
    for (const s of res.value) {
      if (s.error) throw new Error(`Schedule unavailable for a mailbox: ${s.error.responseCode ?? "error"}`);
      const items = (s.scheduleItems ?? []).filter((it) => BUSY.has(it.status.toLowerCase()));
      result.set(s.scheduleId.toLowerCase(), items.map((it) => Interval.fromDateTimes(fromGraph(it.start), fromGraph(it.end))));
    }
  }
  return result;
}

export interface NewEvent {
  upn: string;
  subject: string;
  bodyHtml: string;
  start: DateTime;
  end: DateTime;
  teams: boolean;
  location?: string;
  attendeeEmail?: string | null;
  attendeeName?: string;
  transactionId: string;
}

export async function createEvent(e: NewEvent): Promise<{ id: string; joinUrl: string | null }> {
  const body: Record<string, unknown> = {
    subject: e.subject,
    body: { contentType: "HTML", content: e.bodyHtml },
    start: { dateTime: e.start.setZone(TZ).toFormat("yyyy-MM-dd'T'HH:mm:ss"), timeZone: GRAPH_TZ },
    end: { dateTime: e.end.setZone(TZ).toFormat("yyyy-MM-dd'T'HH:mm:ss"), timeZone: GRAPH_TZ },
    showAs: "busy",
    isReminderOn: true,
    reminderMinutesBeforeStart: 15,
    sensitivity: "private",
    transactionId: e.transactionId,
    categories: ["AI-receptionist"],
  };
  if (e.location) body.location = { displayName: e.location };
  if (e.teams) {
    body.isOnlineMeeting = true;
    body.onlineMeetingProvider = "teamsForBusiness";
  }
  if (e.attendeeEmail) {
    body.attendees = [{ emailAddress: { address: e.attendeeEmail, name: e.attendeeName ?? e.attendeeEmail }, type: "required" }];
  }
  const res = await graph<{ id: string; onlineMeeting?: { joinUrl?: string } | null }>(
    "POST",
    `/users/${encodeURIComponent(e.upn)}/events`,
    body,
    { Prefer: `outlook.timezone="${GRAPH_TZ}"` },
    15_000,
  );
  return { id: res.id, joinUrl: res.onlineMeeting?.joinUrl ?? null };
}

export async function deleteEvent(upn: string, eventId: string): Promise<void> {
  await graph("DELETE", `/users/${encodeURIComponent(upn)}/events/${encodeURIComponent(eventId)}`);
}
