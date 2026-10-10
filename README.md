# RKJH AI Receptionist

AI phone receptionist for **Revisionskonsulterna J Hägglund** (rkjh.se). It answers every inbound call 24/7 on the firm's number (unconditionally forwarded) in Swedish and English. It can:

- answer FAQs from an approved knowledge base,
- book meetings in consultants' Outlook calendars,
- warm-transfer calls to staff during office hours,
- take messages, which are posted to Microsoft Teams.

A private dashboard shows the call log, messages and analytics, and has an FAQ editor.

It is an internal tool that processes client personal data. The call engine is **self-hosted [LiveKit](https://github.com/livekit/livekit)** on Azure in Sweden Central, with no Vapi and no LiveKit Cloud. Speech, LLM, database and dashboard stay on Azure in the EU, and calls are kept for 30 days. See [docs/gdpr-notes.md](docs/gdpr-notes.md).

## Architecture

```
Caller → RKJH 035-17 55 70 ─forward→ Twilio +46 10… ─SIP trunk (EU edge)→ media VM (Sweden Central)
                                                                           ├─ livekit/sip + livekit-server + redis
                                                                           └─ rkjh-agent (LiveKit Agents, Node)
                                                                                ├─ Azure Speech STT/TTS (sv-SE, en)
                                                                                ├─ Azure OpenAI gpt-5.4-mini (Data Zone EU)
                                                                                └─ tools → Postgres · Graph (Outlook) · Teams
func-jobs  (Azure Functions): retention (30 d) · rollups · KB scrape · Teams sweep · admin migrate/seed
func-dash  (Azure Functions) ◀── Static Web Apps (React dashboard)
PostgreSQL Flexible Server (private, pgvector) — shared by all of the above
```

Details: [docs/livekit.md](docs/livekit.md) (call engine) and [docs/PLAN.md](docs/PLAN.md) (data model, endpoints, decisions, deviations).

## Repository

| Path | What |
|---|---|
| `agent/` | LiveKit voice agent (TypeScript): STT/LLM/TTS pipeline, Swedish/English handoff, tools, warm transfer, post-call ingest. `agent/Dockerfile`. |
| `api/` | Azure Functions v4 (Node 22, TS, ESM). `APP_ROLE=jobs\|dash`. `api/src/core` and `api/src/tools` hold the business logic that the agent shares. |
| `api/migrations/` | SQL migrations. Run with `npm run db:migrate` or `POST /api/admin/migrate` (master key). |
| `prompts/` | Versioned system prompts (`sv/`, `en/`). |
| `web/` | Dashboard (React 19 + Vite). Swedish UI with English i18n. |
| `config/` | `staff.yaml`, `office.yaml` (hours, holidays, loop protection), `core-facts.yaml`, `faq.yaml`. These are seeded into the DB. |
| `deploy/media/` | Docker Compose stack for the media VM, plus `bootstrap.sh` (secrets from Key Vault via managed identity). |
| `infra/` | Bicep (`main.bicep` plus modules), params, and scripts (`deploy.sh`, `set-secrets.sh`, `package-api.sh`, `pg-roles.sql`). |
| `docs/` | Setup guides, GDPR notes, suggested tests. |

## Local development

Prerequisites: Node 22, Docker, [Azure Functions Core Tools v4](https://learn.microsoft.com/azure/azure-functions/functions-run-local), and the `livekit-server` binary.

```bash
npm install
docker compose up -d                                         # Postgres 16 + pgvector, Azurite
cp api/local.settings.example.json api/local.settings.json   # fill in values (see .env.example)
npm run db:migrate && npm run db:seed
npm run user:create-admin -w api -- you@rkjh.se "Your Name"  # prints a one-time invite link
(cd api && npm run build && func start)                      # dashboard API on :7071
npm run dev -w web                                           # dashboard on :5173 (proxies /api)
livekit-server --dev                                         # LiveKit on :7880 (devkey/secret)
npm run agent:dev                                            # needs Azure Speech + OpenAI env, see docs/livekit.md
```

Talk to the agent from LiveKit's Agents Playground or a test room. Real phone calls need the media VM and a Twilio trunk.

## Deploying

See [docs/setup-azure.md](docs/setup-azure.md). In short:

1. Complete the prerequisites:
   - Twilio Elastic SIP trunk and +46 number: [docs/telephony.md](docs/telephony.md)
   - Graph app registration and mailbox scoping: [docs/graph-mailbox-scoping.md](docs/graph-mailbox-scoping.md)
   - Teams workflows: [docs/teams-workflows.md](docs/teams-workflows.md)
2. Fill in `infra/params/prod.bicepparam` and `deploy/media/agent.env.static`.
3. Run `RG=rg-rkjh-ai-prod ./infra/scripts/deploy.sh`. It is interactive and confirms each stage:
   1. infrastructure
   2. secrets
   3. API
   4. migrations and seed
   5. agent image
   6. media VM
   7. SIP trunks
   8. dashboard
4. Point the Twilio trunk's origination URI at the media VM's public IP, then forward 035-17 55 70 to the Twilio number.

## Environment variables

- [`.env.example`](.env.example) covers the Functions apps.
- [`deploy/media/agent.env.static.example`](deploy/media/agent.env.static.example) covers the agent.
- In Azure, secrets are **Key Vault references** (Functions) or are pulled from Key Vault at boot (media VM). Nothing secret lives in the repo.

## Key decisions (short)

- **Self-hosted LiveKit instead of Vapi.** There is no per-minute platform fee and no US voice-orchestration sub-processor. Only Twilio and Microsoft handle call data.
- **Language.** Azure STT runs continuous sv-SE/en-US language identification, and the agent hands off automatically to an English agent with its own voice.
- **TTS.** A custom streaming Azure Speech adapter keeps `sv-SE-SofieNeural` in Sweden Central.
- **Transfers.** Warm transfer happens in the caller's own room: hold music, a private briefing, and the consultant presses 1 to accept or 2 to decline. Cold transfer via SIP REFER is available as an option. Loop protection blocks transfers to RKJH's main number.
- **Security.**
  - Tools never trust model arguments. The server enforces office hours, the staff allow-list, the blocked numbers, per-call limits and slot re-validation, and tool calls are idempotent.
  - The media VM exposes only SIP and RTP, to Twilio's IP ranges only.
- **Knowledge base.** After each crawl, a corpus of 6k tokens or less is injected into the prompt. A larger one is searched with hybrid pgvector + Swedish full-text search.

## Suggested tests (not written yet)

See [docs/testing.md](docs/testing.md).
