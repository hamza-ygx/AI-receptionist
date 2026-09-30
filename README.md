# RKJH AI Receptionist

AI phone receptionist for **Revisionskonsulterna J Hägglund** (rkjh.se). It answers every inbound call 24/7 on the firm's number (unconditionally forwarded) in Swedish and English. It can:

- answer FAQs from an approved knowledge base,
- book meetings in consultants' Outlook calendars,
- warm-transfer calls to staff during office hours,
- take messages, which are posted to Microsoft Teams.

A private dashboard shows the call log, messages and analytics, and has an FAQ editor.

Internal tool that processes client personal data. It is EU-hosted with 30-day retention. See [docs/gdpr-notes.md](docs/gdpr-notes.md).

## Architecture

```
Caller → RKJH 035-17 55 70 ──forward──▶ Twilio +46 10… ──▶ Vapi (EU region) ──▶ Azure Speech + Azure OpenAI (Sweden Central)
                                                              │  HMAC-signed webhooks
                                                              ▼
                                         func-voice (Azure Functions, Sweden Central, VNet)
                                         ├─ tools: search_knowledge · resolve_staff · check_availability · book_meeting
                                         │         transfer_to_staff (+ transfer-destination-request) · take_message
                                         ├─ end-of-call ingest → Postgres → Teams card → DELETE /call at Vapi
                                         └─ timers: retention (30 d) · rollups · KB scrape · Vapi-deletion retries
                                                      │
          Dashboard (React, Static Web Apps) ──/api/dash──▶ func-dash ──▶ PostgreSQL Flexible (private, pgvector)
```

The full design is in **[docs/PLAN.md](docs/PLAN.md)**: Mermaid diagrams, data model, endpoint list and decisions.

## Repository

| Path | What |
|---|---|
| `api/` | Azure Functions v4 (Node 22, TypeScript, ESM). One codebase, two apps chosen by `APP_ROLE=voice\|dash`. |
| `api/migrations/` | SQL migrations. Run them with `npm run db:migrate` or `POST /api/admin/migrate` (master key). |
| `web/` | Dashboard (React 19 + Vite). Swedish UI with English i18n. |
| `vapi/` | Vapi config as code: tools, structured outputs, SV/EN assistants, squad, phone number, and versioned prompts in `vapi/prompts/`. `npm run vapi:sync` is a dry run by default. |
| `config/` | `staff.yaml`, `office.yaml` (hours, holidays, loop protection), `core-facts.yaml`, `faq.yaml`. These are seeded into the DB. |
| `infra/` | Bicep (`main.bicep` plus modules), params, and scripts (`deploy.sh`, `set-secrets.sh`, `package-api.sh`, `pg-roles.sql`). |
| `docs/` | Setup guides and GDPR notes. |

## Local development

Prerequisites: Node 22, Docker, [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local), and a dev tunnel (`devtunnel` or ngrok).

```bash
npm install
docker compose up -d                                # Postgres 16 + pgvector, Azurite
cp api/local.settings.example.json api/local.settings.json   # fill in values (see .env.example)
npm run db:migrate && npm run db:seed
npm run user:create-admin -w api -- you@rkjh.se "Your Name"   # prints a one-time invite link
(cd api && npm run build && func start)             # http://localhost:7071
npm run dev -w web                                  # http://localhost:5173 (proxies /api)
devtunnel host -p 7071 --allow-anonymous            # public URL for Vapi webhooks (dev only)
```

Point a **dev** Vapi squad at the tunnel with `VOICE_API_BASE_URL=<tunnel-url> npm run vapi:sync -- --env dev --apply`. Never point production at a tunnel.

Useful scripts:

- `npm run kb:scrape -w api` crawls rkjh.se now.
- `npm run typecheck` checks all packages.
- `npm run vapi:sync -- --env dev --print` prints the generated payloads.

## Deploying

The step-by-step guide is in [docs/setup-azure.md](docs/setup-azure.md). In short:

1. Complete the prerequisites:
   - Vapi EU org: [docs/vapi.md](docs/vapi.md)
   - Twilio number: [docs/telephony.md](docs/telephony.md)
   - Graph app registration and mailbox scoping: [docs/graph-mailbox-scoping.md](docs/graph-mailbox-scoping.md)
   - Teams workflows: [docs/teams-workflows.md](docs/teams-workflows.md)
2. Fill in `infra/params/prod.bicepparam`.
3. Run `RG=rg-rkjh-ai-prod ./infra/scripts/deploy.sh`. It is interactive and confirms each stage:
   1. infrastructure
   2. secrets
   3. API
   4. migrations and seed
   5. dashboard
4. Run `npm run vapi:sync -- --env prod`, then again with `--apply`. Put the squad ID into the params and redeploy the infrastructure.
5. Buy and import the number, then set up unconditional forwarding from 035-17 55 70.

## Environment variables

All variables are documented in [`.env.example`](.env.example). In Azure, secrets are **Key Vault references** resolved by each Function App's managed identity. Nothing secret lives in the repo.

## Key decisions (short)

- **Vapi EU region** with Zero Data Retention, recording off, and `DELETE /call/{id}` after ingest (retried until confirmed).
- **Twilio** rather than Telnyx, because Vapi's warm-transfer modes are documented for Twilio. Transfers use `warm-transfer-experimental`, which returns the caller to the AI on no answer so it can take a message.
- **Language**: Vapi's Azure transcriber is single-locale, so a squad hands off between a Swedish assistant (sv-SE) and an English one (en-GB).
- **LLM**: `gpt-5.4-mini` on an Azure OpenAI **Data Zone EU** deployment in Sweden Central, `reasoning_effort: none`. Switch with `VAPI_LLM_MODEL`.
- **Security**:
  - Tools never trust model arguments. Server-side checks enforce office hours, the staff allow-list, the blocked-number list (loop protection), per-call limits and slot re-validation.
  - Tool calls are idempotent per `toolCallId`.
- **Knowledge base**: after each crawl, a corpus of 6k tokens or less is injected into the prompt. Otherwise the assistant uses hybrid pgvector + Swedish full-text search.

## Suggested tests (not written yet; say the word)

See [docs/testing.md](docs/testing.md). The ones that matter most are tool-endpoint auth and validation, booking conflict and holiday/DST logic, the transfer loop guard, and the retention job.
