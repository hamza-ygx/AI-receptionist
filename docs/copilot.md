# Call copilot

A screen next to the advisor during a phone call. It transcribes the call and, when the other person asks a factual question (rates, deadlines, rules, other countries), shows a short answer with sources. It never speaks.

Status: **prototype** in `demo/` (`/copilot` on the Vercel demo). Test calls only; see [Before real client calls](#before-real-client-calls).

## How the prototype works

```
laptop mic (call on speakerphone)
  └─ speech recognition: Azure Speech, Sweden Central (if AZURE_SPEECH_KEY) | browser (Google in Chrome)
       └─ interim text stable 280 ms (question-like) / 600 ms
            ├─ api/quick.js   Haiku: "is this a question?" + unverified quick answer   (~1 s)
            │                 + keyword match in config/copilot-facts.yaml → "Bekräftat" box (instant)
            └─ api/assist.js  Sonnet + one web search on official domains → sourced answer (~3–5 s)
                              started in parallel for question-like speech; cancelled if not a question
```

- Cards: question, confirmed facts (green), quick answer (yellow, "ej verifierat"), then the sourced answer replaces the quick one (green, with source links, timings and cost).
- "Hjälp mig nu" / space bar answers the latest question from the last ~75 s.
- Nothing is stored server-side. The transcript lives in the browser tab until "Rensa" or closing it.
- Allowed search domains: Skatteverket, Bolagsverket, Verksamt, Riksdagen, Regeringen, Försäkringskassan, Pensionsmyndigheten, Tullverket, SCB, BFN, Revisorsinspektionen, FAR, rkjh.se, skat.dk, borger.dk, virk.dk, Skatteetaten, Vero, europa.eu, OECD. Edit `ALLOWED_DOMAINS` in `demo/api/assist.js`.

## Confirmed facts

`config/copilot-facts.yaml` holds facts a consultant has checked (fact, period, source URL, initials, date). They are matched by keyword, without AI, shown instantly as "Bekräftat i byråns faktablad", and given to the sourced answer, which must not contradict them. The file ships empty; fill it with the questions clients actually ask (corporate tax and VAT rates in SE/DK/NO/FI, common filing deadlines, employer contributions) and review it every income year. After editing, run `node demo/scripts/build-data.mjs` and redeploy.

## Before real client calls

The research report (`reports/Best AI receptionists 2026.md`) and FAR's April 2026 statement on 26 § revisorslagen point the same way: client conversations must not leave the firm's control without a clear legal basis and processor agreements. Conditions:

1. **Speech in the EU:** use "Tal: Azure (EU)" (Azure Speech in Sweden Central, already supported). Never the browser engine on client calls.
2. **LLM in the EU:** move `quick` and `assist` from Anthropic's API (US) to an EU endpoint, e.g. the existing Azure OpenAI EU Data Zone deployment, or Claude through an EU-resident provider once its DPA and data location are verified.
3. **Web search:** replace live web search with a pre-indexed copy of the allowed official pages (see below), so the question text is not sent to a search provider either.
4. **Transparency:** tell the client at the start of the call that an AI assistant transcribes it to help the advisor (Art. 50 of the EU AI Act applies to the receptionist; for the copilot it is good practice and part of GDPR information duties).
5. **Records:** add the copilot to the record of processing and the DPIA; processors listed in `docs/gdpr-notes.md`.
6. **No emotion or performance scoring** of the advisor (prohibited for workers under AI Act Art. 5(1)(f)).

## Production design (option B: on the phone system)

The prototype hears the call through a laptop mic. The production version taps the call itself, which gives clean audio and tells caller and advisor apart for free.

```
Caller → RKJH number → Twilio → LiveKit room (media VM, Sweden Central)
                                   ├─ caller (SIP)        ── track A
                                   ├─ advisor (SIP, dialled like a warm transfer, or click-to-call outbound) ── track B
                                   └─ copilot agent (silent, subscribes to A and B separately)
                                        ├─ Azure Speech STT per track (speaker = track, no diarization needed)
                                        ├─ question detection on track A only (the client), plus "help me" from the advisor
                                        ├─ answers: confirmed facts → pre-indexed official pages (pgvector) → Azure OpenAI EU
                                        └─ cards → LiveKit text stream → advisor's browser (dashboard page, joins the room as a viewer)
```

- **Routing:** the receptionist's `transfer_to_staff` already dials the advisor into the caller's room. Copilot mode keeps a silent agent in the room after the handover, instead of the receptionist leaving. Outbound calls: a "Ring upp" button in the dashboard dials the client through the same trunk with the advisor and copilot in the room.
- **Knowledge:** reuse `api/src/kb` (crawler, chunking, embeddings, hybrid search) with a second corpus restricted to the allowed official domains, re-crawled weekly. Answers cite page URL and the page's fetch date.
- **Latency target:** quick answer under 1.5 s, sourced answer under 3 s (local retrieval instead of web search).
- **Retention:** transcripts follow the same 30-day purge as calls; the advisor can mark an answer wrong (feedback stored without the transcript).
- **Effort:** roughly 1–2 weeks once the phone stack is live: silent copilot agent, per-track STT, text-stream UI in the dashboard, official-pages corpus.
