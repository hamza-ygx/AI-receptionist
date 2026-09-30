# Suggested tests (not implemented — confirm and I'll write them)

Suggested stack: **Vitest** plus a throwaway Postgres (Testcontainers `pgvector/pgvector:pg16`, or the docker-compose DB), with Graph, Teams, Vapi and HIBP stubbed at `fetch`.

## Highest value

1. **Tool endpoint auth and contract** (`api/src/vapi/router.ts`, `auth.ts`)
   - Bad or missing signature, stale timestamp, bearer mode → 401. A valid HMAC in hex or base64, with a seconds, milliseconds or ISO timestamp → 200.
   - `tool-calls` always returns HTTP 200 with `{results:[{toolCallId,name,result|error}]}`, including for unknown tools, invalid args and thrown errors.
   - Duplicate `toolCallId` delivered concurrently → the tool runs once (cached result).
   - Per-call and per-tool limits kick in.
2. **Booking logic** (`lib/slots.ts`, `tools/checkAvailability.ts`, `tools/bookMeeting.ts`)
   - Office and lunch hours, minimum notice, `maxDaysAhead`, alignment, allowed durations.
   - Holidays: midsommarafton, julafton, nyårsafton, Easter, `extraClosed`/`extraOpen`.
   - DST boundaries (last Sunday of March and of October) and ISO inputs with different offsets.
   - Double booking: two concurrent `book_meeting` calls for the same slot → exactly one succeeds (advisory lock). Graph shows the slot as busy → `slot_taken`. If the DB insert fails after the Graph event is created → the event is deleted.
3. **Transfer guard** (`tools/transferToStaff.ts`, `handlers/transferDestination.ts`)
   - Closed office, non-transferable staff, missing number, and a main or Twilio number (including other formats such as `035-17 55 70`) are all refused.
   - A destination request without an approved transfer, a replayed request, or one older than 5 minutes → error. The model can never inject a number.
4. **Retention job** (`retention/*`)
   - Rollups are computed before the purge, and recomputation is idempotent.
   - Rows older than 30 days are deleted across calls, messages, bookings and transfers; newer rows are untouched.
   - Calls purged without a confirmed Vapi deletion are queued. Backoff works, and a 404 counts as deleted. The alert fires after 24 h.

## Also worthwhile

- End-of-call ingest: outcome reconciliation (DB facts override the model's claim); tolerant parsing of empty or `unknown` structured fields.
- Dashboard auth:
  - lockout and progressive backoff
  - no user enumeration (same response for unknown user and wrong password; 423 only with the correct password)
  - admins can't skip MFA, and TOTP codes can't be replayed
  - recovery codes are single-use
  - reset and invite tokens are single-use and expire
  - CSRF and Origin checks; last-admin guard
- KB: boilerplate stripping, change detection (unchanged pages skipped), the retrieval mode switching at 6k tokens, FAQ precedence in search results.
- Phone normalisation: `070-123 45 67`, `+46 (0)35…`, `0046…`, hidden or anonymous caller ID.
