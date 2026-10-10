# Browser demo (Vercel)

A talk-to-it demo of the receptionist for testing persona, guardrails and tool flow. **Not the production stack** (that is LiveKit + Twilio + Azure, see `docs/livekit.md`).

- Speech: browser Web Speech API (recognition + synthesis), half-duplex. Chrome/Edge.
- LLM: Claude via `@anthropic-ai/sdk` (`DEMO_MODEL`, default `claude-opus-5-5`, effort `DEMO_EFFORT`=`low`), server-side refusal fallback enabled.
- Prompt: the real `prompts/*/system.v2.md` and `config/*.yaml`, rendered with demo values. Language switch appends the other-language prompt as a mid-conversation system message.
- Tools are mocks with the production names and guardrails: fake staff (Anna → transfer connects, Erik → busy, Jörgen → not transferable), deterministic fake calendar, simulated bookings/messages. No holidays.
- Conversation state lives in the browser and is sent with every request (append-only, thinking blocks echoed unchanged). Nothing is stored server-side.

## Env vars (Vercel project)

| Var | |
|---|---|
| `ANTHROPIC_API_KEY` | required |
| `DEMO_MODEL` / `DEMO_EFFORT` / `DEMO_ASSISTANT_NAME` | optional |

## Data
`api/_data.json` is generated from `config/` and `prompts/`: `node demo/scripts/build-data.mjs` (needs the root `node_modules` for `yaml`).

## Access
The project uses Vercel Authentication (only logged-in team members can open it). There is no app-level gate.

## Privacy
Test data only. Requests go to Anthropic's API (US processing), unlike production which stays in the EU.

## Call copilot (`/copilot`)

Listens through the laptop mic while you take a call on speaker, transcribes it, and shows short sourced answers to questions as they come up.

- `api/detect.js`: Haiku (`COPILOT_DETECT_MODEL`) decides if the latest utterance needs an answer and rewrites it as a standalone question (structured output).
- `api/assist.js`: Opus (`COPILOT_MODEL`, effort `COPILOT_EFFORT`) answers with web search limited to official domains (Skatteverket, Bolagsverket, skat.dk, …), streamed as NDJSON with cited sources.
- "Hjälp mig nu" (or space) answers the latest question from the last ~75 s of transcript.
- Prototype only: speech recognition is the browser's (Google in Chrome), LLM is Anthropic (US). No real client calls until it runs on Azure Speech + an EU model.
