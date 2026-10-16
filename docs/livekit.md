# Call engine: self-hosted LiveKit (replaces Vapi)

Everything that touches the live call runs on **one VM in Azure Sweden Central** (`vm-rkjh-ai-<env>-media`):

```
Caller → RKJH 035-17 55 70 ─forward→ Twilio +46 10… ─Elastic SIP trunk (IE1/DE1)→ livekit/sip :5060
                                                                                     │ RTP 10000-20000
                                                         livekit-server (SFU) ◀──────┘
                                                                │ WebRTC (same host)
                                                         rkjh-agent (LiveKit Agents, Node)
                                                         ├─ STT  Azure Speech (sv-SE + en-US, continuous LID)
                                                         ├─ LLM  Azure OpenAI gpt-5.4-mini (Data Zone EU)
                                                         ├─ TTS  Azure Speech sv-SE-SofieNeural / en-GB-SoniaNeural
                                                         └─ tools → Postgres / Graph / Teams (shared api/src/core)
```

No LiveKit Cloud, no Vapi: call audio, transcripts and model calls stay in Azure Sweden Central and the EU Data Zone. The only third parties are **Twilio** (the PSTN leg) and **Microsoft**.

## Components (deploy/media/docker-compose.yml)

| Service | Image | Notes |
|---|---|---|
| redis | redis:7.4-alpine | localhost only, password, AOF |
| livekit | livekit/livekit-server:v1.13.9 | signal/API on 7880 (not exposed), media on the private IP |
| sip | livekit/sip:v1.18.0 | 5060 + RTP 10000-20000, `nat_1_to_1_ip` = VM public IP, `hide_inbound_port` |
| agent | `<acr>.azurecr.io/rkjh-agent:<git sha>` | built from `agent/Dockerfile` |

Inbound exposure: only **5060/5061 from Twilio's signalling CIDRs** and **UDP 10000-20000 from Twilio's media range**, via the NSG. Everything else is denied. SSH is not opened; use Azure Bastion or `az vm run-command`.

Secrets come from Key Vault through the VM's managed identity (`deploy/media/bootstrap.sh`). Postgres uses Entra auth as that identity.

## The agent (agent/src)

- **Language:** the Azure STT plugin runs continuous language identification over `sv-SE` and `en-US`. When a final transcript of two or more words is detected as the other language, the session hands over to the matching agent: same tools, same history, the other prompt and voice. The model can also switch explicitly (`switch_to_english` / `switch_to_swedish`).
- **Turn-taking:** Silero VAD (silence 450 ms) plus endpointing (`minDelay` 550 ms); barge-in needs 400 ms of speech. All durations are milliseconds in `@livekit/agents` 1.x. No turn-detector model supports Swedish, and LiveKit's adaptive interruption is Cloud-only.
- **Greeting:** the AI/transcription disclosure (EU AI Act Art. 50) is spoken with interruptions off; the question after it can be interrupted.
- **TTS:** `agent/src/azureTts.ts` streams PCM from the Azure Speech REST API. The LiveKit Node plugin has no Azure TTS. Fixed phrases (disclosure, greeting, hold, goodbye) are synthesised once per worker in `prewarm` and replayed from memory.
- **Sounds:** one background-audio track per call: quiet keyboard typing while calendar lookups or bookings run, hold music during warm transfers.
- **Prompt:** `prompts/*/system.v3.md`. Per-call values (time, open/closed, caller line) sit at the end so the static part can be prompt-cached.
- **Tools:** `search_knowledge`, `resolve_staff`, `check_availability`, `book_meeting` and `take_message` go through `api/src/core/executeTool.ts`. That layer handles zod validation, per-call limits and idempotency per tool-call id. `transfer_to_staff`, the language switch and `end_call` are agent-side.
- **Post-call:** the transcript goes to Azure OpenAI with a strict JSON schema (Swedish summary plus fields), then to `ingestCall` and Teams cards. No audio is recorded anywhere.
- **Safety:**
  - max call length 15 min
  - on a fatal error (e.g. Azure TTS down) the call is cold-transferred to `FALLBACK_TRANSFER_NUMBER` if set, otherwise hung up cleanly
  - the blocked-number list prevents any transfer back to the RKJH main number

## Transfers

`TRANSFER_MODE=warm` (default):
1. The caller hears "ett ögonblick" and then hold music. The agent stops listening.
2. The consultant is dialled into **the same room** through the outbound trunk.
3. Server-side subscriptions keep the legs apart. The consultant only hears a private briefing track ("…Tryck 1 för att ta samtalet, eller 2 om jag ska ta ett meddelande"). The caller only hears hold music.
4. **1** connects them: subscriptions are opened and the agent goes quiet. **2**, no answer, busy or a hang-up brings the caller back to the AI, which offers to take a message.
5. When either party hangs up, the room is closed and the call is logged. The human-to-human part is never transcribed.

LiveKit's own `WarmTransferTask` needs `MoveParticipant`, which isn't implemented in self-hosted LiveKit. That's why the transfer stays in one room.

`TRANSFER_MODE=cold`: a SIP REFER to the consultant's number. Twilio takes over the call and there is no briefing. It requires *Call Transfer (SIP REFER)* to be enabled on the Twilio trunk. Use it if the warm flow misbehaves in testing.

## SIP provisioning

Run once after the stack is up (step 7 of `infra/scripts/deploy.sh`), using `agent/dist/scripts/provisionSip.js --apply`. It creates:

- **Inbound trunk** `rkjh-twilio-in` for `TRUNK_NUMBER_E164`. It allows only `TWILIO_SIGNALLING_CIDRS`; there is no digest challenge, because Twilio origination doesn't answer one.
- **Outbound trunk** `rkjh-twilio-out` to `TWILIO_TERMINATION_URI`, using Twilio credential-list auth.
- **Dispatch rule** `rkjh-reception`: an individual room per call (`call-…`) with explicit dispatch to `rkjh-receptionist`.

Copy the printed `LIVEKIT_SIP_OUTBOUND_TRUNK_ID` into `deploy/media/agent.env.static` and re-run step 6.

## Local development

```bash
docker compose up -d                       # Postgres + Azurite (repo root)
livekit-server --dev                       # https://github.com/livekit/livekit/releases
npm run db:migrate && npm run db:seed
cp deploy/media/agent.env.static.example .env.agent   # fill: AZURE_SPEECH_KEY, AZURE_OPENAI_*, PG*
set -a; . ./.env.agent; set +a
LIVEKIT_URL=ws://127.0.0.1:7880 LIVEKIT_API_KEY=devkey LIVEKIT_API_SECRET=secret npm run agent:dev
```

Then join a room from LiveKit's Agents Playground or the `lk` CLI. Dispatch the agent with `lk dispatch create --agent-name rkjh-receptionist --room test`. To test real phone calls, point a dev Twilio trunk at a dev VM.

## What needs staging verification (not testable in the build sandbox)

- [ ] Swedish STT accuracy and language-ID switching on real calls, and the 550 ms endpointing feel
- [ ] Warm transfer on Twilio: subscription isolation timing (a 100–500 ms bleed right after the consultant answers is possible), DTMF from mobiles, hold music level
- [ ] `TRANSFER_MODE=cold` with SIP REFER enabled on the trunk
- [ ] `gpt-5.4-mini` with `reasoning_effort: none` latency on the Data Zone deployment; fall back to `LLM_REASONING_EFFORT=minimal`/`low` or `gpt-5.1` if it is rejected
- [ ] Twilio signalling and media CIDRs for your edge (`twilioSignallingCidrs` in the Bicep params)
- [ ] Caller-ID passthrough from RKJH's operator forwarding (`sip.phoneNumber`)
