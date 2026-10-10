# Suggested tests (not implemented — confirm and I'll write them)

Suggested stack: **Vitest** plus a throwaway Postgres (Testcontainers `pgvector/pgvector:pg16`, or the docker-compose DB), with Graph, Teams, Azure OpenAI and HIBP stubbed at `fetch`.

## Highest value

1. **Tool execution core** (`api/src/core/executeTool.ts`)
   - Unknown tools, invalid arguments and thrown errors always return a structured JSON result, never an exception, to the agent.
   - Duplicate `toolCallId` delivered concurrently → the tool runs once (cached result).
   - Per-call and per-tool limits kick in.
2. **Booking logic** (`lib/slots.ts`, `tools/checkAvailability.ts`, `tools/bookMeeting.ts`)
   - Office and lunch hours, minimum notice, `maxDaysAhead`, alignment, allowed durations.
   - Holidays: midsommarafton, julafton, nyårsafton, Easter, `extraClosed`/`extraOpen`.
   - DST boundaries (last Sunday of March and of October) and ISO inputs with different offsets.
   - Double booking: two concurrent `book_meeting` calls for the same slot → exactly one succeeds (advisory lock). Graph shows the slot as busy → `slot_taken`. If the DB insert fails after the Graph event is created → the event is deleted.
3. **Transfer guard** (`api/src/core/transfer.ts`, `agent/src/transfer.ts`)
   - Closed office, non-transferable staff, missing number, and the main or trunk number (including other formats such as `035-17 55 70`) are all refused. The model can never supply a number.
   - SIP dial errors map correctly: 486 → busy, timeout → no_answer, 480/408/487 → no_answer, otherwise failed.
   - Briefing text sanitises caller-provided names.
4. **Retention job** (`retention/*`)
   - Rollups are computed before the purge, and recomputation is idempotent.
   - Rows older than 30 days are deleted across calls, messages, bookings and transfers; newer rows are untouched.

## Also worthwhile

- Post-call ingest: outcome reconciliation (DB facts override the model's claim); analysis failure still stores the call.
- Agent (integration, against `livekit-server --dev`): dispatch → greeting → language hand-off on an English final transcript → hang-up → room deleted → call row ingested.
- Dashboard auth:
  - lockout and progressive backoff
  - no user enumeration (same response for unknown user and wrong password; 423 only with the correct password)
  - admins can't skip MFA, and TOTP codes can't be replayed
  - recovery codes are single-use
  - reset and invite tokens are single-use and expire
  - CSRF and Origin checks; last-admin guard
- KB: boilerplate stripping, change detection (unchanged pages skipped), the retrieval mode switching at 6k tokens, FAQ precedence in search results.
- Phone normalisation: `070-123 45 67`, `+46 (0)35…`, `0046…`, hidden or anonymous caller ID.
