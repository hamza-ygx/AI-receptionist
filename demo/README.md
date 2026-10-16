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

- Triggers on speech that has stopped changing (280 ms if it sounds like a question, 600 ms otherwise), before the browser finalises it. A trigger that is superseded by more speech is cancelled, server calls included.
- `api/quick.js`: Haiku (`COPILOT_QUICK_MODEL`, thinking off) decides in one streamed call whether the latest utterance is a question (`INGEN` or `F: …`) and gives an unverified quick answer from its own knowledge, shown within about a second and labelled as such.
- `api/assist.js`: Sonnet (`COPILOT_MODEL`, effort `COPILOT_EFFORT`, thinking `between_tools`) starts in parallel with the quick call when the utterance sounds like a question (cancelled if Haiku says `INGEN`), answers with one plain web search (`COPILOT_SEARCH_TOOL`, default `web_search_20250305`, no dynamic filtering; `COPILOT_MAX_SEARCHES`, default 1) limited to official domains (Skatteverket, Bolagsverket, skat.dk, …) and replaces the quick answer, with cited sources.
- Both functions are warmed on page load and on Start to avoid cold starts.
- Confirmed facts: `config/copilot-facts.yaml` (empty by default). Entries are matched by keyword, without AI, and shown instantly as "Bekräftat i byråns faktablad" with period, source and who verified them; they are also passed to the sourced answer. Only add facts a consultant has checked; rebuild `api/_data.json` after editing.
- "Hjälp mig nu" (or space) answers the latest question from the last ~75 s of transcript.
- Prototype only: speech recognition is the browser's (Google in Chrome), LLM is Anthropic (US). No real client calls until it runs on Azure Speech + an EU model.
