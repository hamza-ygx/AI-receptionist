import { z } from "zod";
import { DateTime } from "luxon";
import { db, tx } from "../../lib/db.js";
import { TZ } from "../../lib/config.js";
import { nowLocal, officeConfig } from "../../lib/office.js";
import { isFree, spokenSlot, validateSlot } from "../../lib/slots.js";
import { normalizeE164, spokenSwedish } from "../../lib/phone.js";
import { sha256Hex } from "../../lib/crypto.js";
import { errMsg } from "../../lib/log.js";
import { busyIntervals, createEvent, deleteEvent } from "../../graph/calendar.js";
import { notifyBooking } from "../../teams/notify.js";
import { defineTool, ok, refuse } from "./types.js";
import { optText, staffIdSchema, text } from "./common.js";

const RULE_TEXT: Record<string, string> = {
  invalid_duration: "That meeting length is not allowed.",
  misaligned: "Times must be one of the slots returned by check_availability.",
  too_soon: "That time is too soon. Offer a later time from check_availability.",
  too_far: "That time is too far ahead.",
  outside_hours: "That time is outside bookable hours or on a holiday.",
};

const MEETING_SV = { phone: "Telefonmöte", teams: "Teams-möte", office: "Möte på kontoret" } as const;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export const bookMeeting = defineTool({
  name: "book_meeting",
  schema: z.object({
    staffId: staffIdSchema,
    start: z.string().min(16).max(40),
    end: z.string().min(16).max(40),
    callerName: text(1, 100),
    company: optText(150),
    phone: text(5, 30),
    email: z.string().optional().nullable().transform((v) => (v ? v.trim().toLowerCase() : null))
      .pipe(z.email().max(200).nullable()),
    topic: text(1, 200),
    meetingType: z.enum(["phone", "teams", "office"]),
  }),
  async run(args, ctx) {
    const cfg = await officeConfig();
    const start = DateTime.fromISO(args.start, { setZone: true });
    const end = DateTime.fromISO(args.end, { setZone: true });
    if (!start.isValid || !end.isValid) return refuse("invalid_time", "Use the exact start/end values from check_availability.");
    const violation = validateSlot(cfg, start, end, nowLocal());
    if (violation) return refuse(violation, RULE_TEXT[violation]!);

    const phone = normalizeE164(args.phone);
    if (!phone) return refuse("invalid_phone", "The phone number is not valid. Ask the caller to repeat it digit by digit.");

    const s = await db().query<{ id: string; name: string; upn: string | null }>(
      "SELECT id, name, upn FROM staff WHERE id = $1 AND active AND bookable",
      [args.staffId],
    );
    const staff = s.rows[0];
    if (!staff?.upn) return refuse("not_bookable", "That person cannot be booked. Use check_availability to find someone who can.");

    const existing = await db().query<{ id: string }>(
      "SELECT id FROM bookings WHERE call_id = $1 AND staff_id = $2 AND start_at = $3",
      [ctx.callId, staff.id, start.toJSDate()],
    );
    if (existing.rows[0]) {
      return ok({ ok: true, alreadyBooked: true, instruction: "This meeting is already booked. Confirm it to the caller." });
    }
    const count = await db().query<{ n: string }>("SELECT count(*) AS n FROM bookings WHERE call_id = $1", [ctx.callId]);
    if (Number(count.rows[0]!.n) >= cfg.limits.maxBookingsPerCall) {
      return refuse("limit_reached", "No more bookings can be made in this call. Offer to take a message.");
    }

    const booking = await tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`booking:${staff.id}`]);
      const clash = await c.query(
        "SELECT 1 FROM bookings WHERE staff_id = $1 AND start_at < $3 AND end_at > $2",
        [staff.id, start.minus({ minutes: cfg.bufferMin }).toJSDate(), end.plus({ minutes: cfg.bufferMin }).toJSDate()],
      );
      if (clash.rowCount) return { conflict: true as const };

      const busy = await busyIntervals([staff.upn!], start.minus({ minutes: cfg.bufferMin + 1 }), end.plus({ minutes: cfg.bufferMin + 1 }));
      if (!isFree({ start, end }, busy.get(staff.upn!.toLowerCase()) ?? [], cfg.bufferMin)) return { conflict: true as const };

      const local = start.setZone(TZ).setLocale("sv");
      const who = args.company ? `${args.callerName}, ${args.company}` : args.callerName;
      const lines = [
        `<p><b>${esc(MEETING_SV[args.meetingType])}</b> bokat av AI-receptionisten.</p>`,
        `<p>Kontakt: ${esc(who)}<br/>Telefon: ${esc(spokenSwedish(phone))}${args.email ? `<br/>E-post: ${esc(args.email)}` : ""}</p>`,
        `<p>Ämne: ${esc(args.topic)}</p>`,
        args.meetingType === "phone" ? `<p>Ring upp kontakten på numret ovan vid mötestiden.</p>` : "",
      ];
      const event = await createEvent({
        upn: staff.upn!,
        subject: `${MEETING_SV[args.meetingType]}: ${who} – ${args.topic}`.slice(0, 250),
        bodyHtml: lines.join(""),
        start,
        end,
        teams: args.meetingType === "teams",
        location: args.meetingType === "office" ? cfg.officeAddress : args.meetingType === "phone" ? "Telefon" : undefined,
        attendeeEmail: args.email,
        attendeeName: args.callerName,
        transactionId: sha256Hex(`${ctx.callId}|${staff.id}|${start.toISO()}`).slice(0, 36),
      });
      try {
        const r = await c.query<{ id: string }>(
          `INSERT INTO bookings (call_id, staff_id, start_at, end_at, meeting_type, topic, caller_name, company, phone_e164, email, graph_event_id, teams_join_url)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`,
          [ctx.callId, staff.id, start.toJSDate(), end.toJSDate(), args.meetingType, args.topic, args.callerName, args.company, phone, args.email, event.id, event.joinUrl],
        );
        return { conflict: false as const, id: r.rows[0]!.id, joinUrl: event.joinUrl, local };
      } catch (e) {
        await deleteEvent(staff.upn!, event.id).catch((de) => ctx.log.error("Compensating event delete failed", { err: errMsg(de) }));
        throw e;
      }
    });

    if (booking.conflict) {
      return refuse("slot_taken", "That time was just taken. Call check_availability again and offer new times.");
    }

    void notifyBooking(staff.id, {
      callId: ctx.callId, staffName: staff.name, callerName: args.callerName, company: args.company, phone,
      email: args.email, topic: args.topic, meetingType: args.meetingType,
      start: start.toJSDate(), end: end.toJSDate(), language: ctx.lang,
    }, ctx.log);

    return ok({
      ok: true,
      bookingId: booking.id,
      confirmation: {
        staffName: staff.name,
        when: spokenSlot(start, ctx.lang),
        durationMin: end.diff(start, "minutes").minutes,
        meetingType: args.meetingType,
        teamsLinkCreated: args.meetingType === "teams" ? Boolean(booking.joinUrl) : undefined,
        inviteEmailSent: Boolean(args.email),
      },
      instruction: args.meetingType === "teams" && !args.email
        ? "Confirm the booking. Explain that the consultant will send the Teams link, since no e-mail was given."
        : "Read back the booking (person, day, date, time, meeting type) and confirm it is registered.",
    });
  },
});
