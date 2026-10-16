# Developer-facing voice AI agent platforms for AI phone receptionists (2025–2026): latency, turn-taking, transfers, testing, guardrails, Swedish, compliance, pricing, reliability

Research date: 2026-10-16. Benchmark target: self-hosted LiveKit Agents + Twilio SIP + Azure Speech + Azure OpenAI, Swedish/English.

**How these notes were made:** Direct page fetches were blocked in this research environment (the egress proxy refused vendor domains), so every finding comes from web-search result extracts of the cited pages, not full-page reads. Exact numbers should be spot-checked on the linked page before they go into a final report. "Vendor claim" marks figures a vendor publishes about itself. "Competitor source" marks figures a rival vendor publishes about another platform (for example Retell, Telnyx or Synthflow blogs about Vapi or Bland). Treat both as weaker evidence than independent tests.

Platforms covered: Vapi, Retell AI, Bland AI, Synthflow, Air.ai, ElevenLabs Agents (ElevenAgents), OpenAI Realtime API / gpt-realtime over SIP, LiveKit Cloud Agents and telephony, Pipecat / Pipecat Cloud (Daily), Deepgram Voice Agent API, Cartesia (Sonic / Line), Hume EVI, Ultravox, Telnyx AI Assistants, Twilio ConversationRelay, Sindarin. Also Azure Voice Live, as the closest managed relative of the benchmark stack.

---

## 1. Published end-to-end latency, how it is measured, and the architectures behind it

### Takeaway
Vendors publish voice-to-voice figures of about 200–800 ms. The only like-for-like independent test of real PSTN calls (OpenBenchmarks, data generated 2026-08-01) measured 1.3–1.75 s median time-to-first-audio-byte (TTFAB) across Telnyx, ElevenLabs, Bland, Vapi and Retell. The vendor numbers measure pipeline stages or best-case setups, not the pause a caller hears. A self-hosted LiveKit build that reaches a p50 below about 1.3 s and a p95 below about 1.8 s over real PSTN would match or beat the hosted leaders.

### Cited Findings
**Independent or semi-independent measurements**
- OpenBenchmarks (YC F24) ran 5 platforms on one identical agent script over real phone calls, 2,078 usable turns. TTFAB means the pause from the caller finishing speech to the caller hearing the agent's first audio, read from saved call audio rather than from timestamps the platforms report. Discarded turns are counted rather than hidden (Vapi had the most, 50). — [OpenBenchmarks comparison](https://openbenchmarks.com/voice-agent-latency/voice-agent-latency-comparison); [OpenBenchmarks GitHub harness](https://github.com/openbenchmarks-labs/voice-agent-latency)
- Results, median / p95:

  | Platform | Median TTFAB | p95 TTFAB |
  |---|---|---|
  | Telnyx | 1,296 ms | not in extract |
  | ElevenLabs | 1,424 ms | 1,768 ms |
  | Bland | 1,520 ms | not in extract |
  | Vapi | 1,558 ms | 2,008 ms |
  | Retell | 1,740 ms | 2,259 ms |

  Tail ratio (p95 ÷ median): ElevenLabs is tightest at 1.24×, then Vapi 1.29×, Retell 1.30×; Bland is widest at 1.48×. — [OpenBenchmarks](https://openbenchmarks.com/voice-agent-latency/voice-agent-latency-comparison); [OpenBenchmarks on X](https://x.com/openbenchmarks/status/2102447713455579607)
- OpenBenchmarks caveats: it turned off ElevenLabs' filler phrase so the filler would not be timed as the answer, and it flags some configuration as unverified (for example ElevenLabs `tts_optimize_streaming_latency: 3`). Measured invoiced cost ranged from $0.0500/min (Telnyx) to $0.1408/min (Bland). — [OpenBenchmarks end-to-end page](https://openbenchmarks.com/voice-agent-latency/voice-agent-end-to-end-latency)
- A conflicting study: a "Tested Media" study of 500 production calls per platform (March 2026), cited on a Telnyx page, found Retell lowest at 680 ms median and 920 ms p95, and an optimized Vapi setup at 720 ms median and 1,050 ms p95. It is cited by a competitor, and the original study was not reached. — [Telnyx latency resource](https://telnyx.com/resources/voice-ai-agents-compared-latency)
- An independent openfon PR (n=20 per arm) on OpenAI Realtime found that semantic VAD on gpt-realtime-2.1 added about 106 ms at the median but worsened the tail: p90 end-of-turn was 5,465 ms against 2,349 ms with server VAD. On gpt-realtime-2 it added about 662 ms. — [openfon PR #10](https://github.com/duguetlabs/openfon/pull/10)
- OpenAI SIP setup delay: one developer reported a consistent 3–5 s (sometimes 7 s) gap between the SIP INVITE and the `realtime.call.incoming` webhook. Another reported webhook P99 of about 7 s, with calls timing out at 10 s. — [OpenAI community thread](https://community.openai.com/t/consistently-3-5s-sometimes-7s-invite-realtime-call-incoming-delay-on-sip-realtime-accept-is-1s-any-guidance/1366874); [OpenAI Realtime SIP guide](https://developers.openai.com/api/docs/guides/realtime-sip)

**Vendor claims (not independently verified)**
- **Retell:** about 600 ms headline; its own blog reports about 620 ms measured by default, typically 720–840 ms. — [Retell blog, best voice AI providers](https://www.retellai.com/blog/best-voice-ai-providers); [Retell vs Bland comparison](https://www.retellai.com/comparisons/retell-vs-bland)
- **Vapi:** "<500 ms" in optimal configurations. Competitor and review sources report 800 ms to 4–5 s in practice. LiveKit notes Vapi's default `waitSeconds` of 0.4 s is added before every reply. — [CloudTalk Vapi review](https://www.cloudtalk.io/blog/vapi-ai-reviews/); [Evalgent LiveKit vs Vapi](https://www.evalgent.com/blog/livekit-vs-vapi)
- **Bland:** "<400 ms" end-to-end, on self-hosted STT, LLM and TTS. A Retell blog (competitor source) says independent tests come in nearer 800 ms with spikes. — [Bland vs Retell (Bland page)](https://www.bland.ai/compare/bland-vs-retell); [Retell blog on Bland](https://www.retellai.com/blog/bland-ai-reviews)
- **Telnyx:** "sub-200 ms round-trip", attributed to GPUs co-located with telephony points of presence (PoPs) on its own carrier network. Another Telnyx page gives an estimated budget of about 460 ms. — [Telnyx homepage](https://telnyx.com/); [Telnyx our-network](https://telnyx.com/our-network)
- **Cartesia Sonic** (TTS only): about 40 ms TTFA for Sonic Turbo and about 90 ms for Sonic, both vendor model-latency figures. A third-party test measured about 166–190 ms. — [invideo Cartesia review](https://invideo.io/blog/cartesia-sonic-ai-voice/)
- **Hume EVI 3:** "<300 ms" per secondary reviews; another review measured about 1.2 s in practice. — [dupple Hume review](https://dupple.com/reviews/hume); [Hume EVI 3 blog](https://www.hume.ai/blog/introducing-evi-3)
- **Ultravox:** "comparable to GPT-4o Realtime" (vendor, launch 2024; older claim). — [Ultravox on X](https://x.com/FixieAI/status/1856823608926244944)
- **ElevenLabs:** the low-latency claims it markets mostly refer to TTS model latency, one stage of the pipeline, not the round trip. — [Retell vs ElevenLabs blog (competitor source)](https://www.retellai.com/blog/vapi-vs-elevenlabs)
- **Self-hosted vs hosted:** one blog's own test put self-hosted LiveKit at 380 ms p50 against Vapi at 480 ms p50 (not independent). The same source says default Vapi pipelines commonly land at 800 ms–1.2 s. Webhook-based tools on Vapi add 200–600 ms per tool call, against far less for LiveKit's in-process tools (single author). — [Amjid Ali shootout](https://amjid.au/insights/retell-vs-vapi-vs-livekit-the-voice-ai-shootout/)

**Architecture choices cited**
- **Co-located STT/LLM/TTS and telephony:** Telnyx runs GPUs inside its carrier PoPs, with EU inference in Paris and Frankfurt. — [Telnyx Europe](https://telnyx.com/europe)
- **Proprietary self-hosted models:** Bland. — [Bland AI review (Retell blog)](https://www.retellai.com/blog/bland-ai-reviews)
- **Speech-to-speech models:** OpenAI gpt-realtime / gpt-realtime-2 / gpt-realtime-2.1 (SIP, WebRTC and WebSocket) — [OpenAI gpt-realtime launch](https://openai.com/index/introducing-gpt-realtime/); Hume EVI 3 — [Hume EVI 3 API](https://www.hume.ai/blog/announcing-evi-3-api); Ultravox, which is speech-in and text-out, with TTS added — [How Ultravox works](https://docs.ultravox.ai/gettingstarted/how-ultravox-works)
- **STT with built-in end-of-turn:** Deepgram Flux merges recognition and end-of-turn detection, so no separate VAD is needed. Its "EagerEndOfTurn" mode cuts latency but can raise LLM usage by 50–70%. — [together.ai Flux](https://www.together.ai/models/flux); [Dograh on Deepgram pricing](https://blog.dograh.com/deepgram-pricing-breakdown-and-how-open-source-saves-70/)

### Inferences
- Vendor "500–800 ms" figures and independent "1.3–2.3 s" PSTN figures measure different things. For an apples-to-apples benchmark, the self-hosted build should be measured the OpenBenchmarks way: TTFAB from recorded PSTN audio, reporting p50, p95 and the tail ratio. The public harness could be reused.
- Tool-call latency (webhooks against in-process tools) and the end-of-turn delay are probably the largest controllable parts of latency. Both favour a self-hosted LiveKit build where tools run in-process.
- If the Azure OpenAI realtime models are used with semantic VAD, measure the p90/p95 end-of-turn tail, not only p50.

### Gaps
- OpenBenchmarks p95 for Telnyx and Bland was not in the extracts. No independent PSTN latency figures were found for LiveKit Cloud, Pipecat Cloud, Deepgram Voice Agent, Synthflow, Hume, Ultravox, Twilio ConversationRelay, Cartesia Line or OpenAI SIP.
- No EU-region or Sweden-originated latency measurements were found for any platform. The benchmarks appear to be US-centric.
- The Tested Media study (March 2026) could not be reached directly.

---

## 2. Turn-taking: end-of-turn detection, barge-in, backchannels, fillers, denoising, voicemail, DTMF, IVR

### Takeaway
Every major platform now offers model-based turn-taking. LiveKit's turn detector and Pipecat's Smart Turn v3 both list supported languages, and **Swedish is missing from both**. LiveKit's new adaptive interruption model (which tells backchannels from real barge-ins) runs only on LiveKit Cloud inference, not on self-hosted workers. Both points matter directly for a self-hosted Swedish build.

### Cited Findings
**LiveKit**
- **Turn detector v1:** free for agents deployed to LiveKit Cloud; 7,500 free requests per month for local development; falls back to the local CPU model v1-mini when the allowance runs out. — [LiveKit turn detector docs](https://docs.livekit.io/agents/logic/turns/turn-detector/)
- The audio turn detector covers 14 languages: English, Arabic, German, Spanish, French, Hindi, Indonesian, Italian, Japanese, Korean, Dutch, Portuguese, Turkish and Chinese. **No Swedish.** The text-based MultilingualModel list differs slightly and relies on the STT reporting the language. — [LiveKit turn detector docs](https://docs.livekit.io/agents/logic/turns/turn-detector/); [LiveKit blog: Turn Detector v1.0](https://livekit.com/blog/solving-end-of-turn-detection)
- **Adaptive interruption handling:** an acoustic model looks at the first few hundred milliseconds of detected user speech to tell a barge-in from a backchannel ("uh-huh", "okay"). On a false interruption the agent resumes playback where it stopped.
  - Vendor metrics: 86% precision and 100% recall at 500 ms of overlapping speech; rejects 51% of VAD false positives.
  - Requires Python SDK ≥1.5.0 or Node ≥1.2.0. Free on LiveKit Cloud.
  - It runs on LiveKit Cloud GPU inference, and LiveKit calls it "impractical to bundle into agent containers". A community thread asks about a self-hosted roadmap.
  - Sources: [LiveKit adaptive interruption docs](https://docs.livekit.io/agents/logic/turns/adaptive-interruption-handling/); [LiveKit blog](https://livekit.com/blog/adaptive-interruption-handling); [v1.5.0 release thread](https://community.livekit.io/t/python-agents-1-5-0-released/619); [self-hosted roadmap thread](https://community.livekit.io/t/roadmap-for-adaptive-interruption-handling-in-self-hosted-livekit-workers/1172)

**Pipecat**
- Smart Turn v3 (v3.2 is current) is open (BSD-2), and its CPU inference takes about 12 ms. It supports 23 languages, including Danish, Finnish and Norwegian but **not Swedish**. — [smart-turn GitHub](https://github.com/pipecat-ai/smart-turn); [Daily: Smart Turn v3](https://www.daily.co/blog/announcing-smart-turn-v3-with-cpu-inference-in-just-12ms/)
- Pipecat Cloud includes Smart Turn and Krisp VIVA noise cancellation. Krisp is free for 0–10k session minutes per month, then $0.0015/min. — [Pipecat Cloud pricing](https://www.daily.co/pricing/pipecat-cloud/); [Pipecat Cloud GA blog](https://www.daily.co/blog/pipecat-cloud-is-now-generally-available/)

**Vapi**
- **Denoising:** "Smart Denoising" uses Krisp and is the recommended default; Fourier denoising is experimental. Configured with `backgroundSpeechDenoisingPlan`. — [Vapi background speech denoising](https://docs.vapi.ai/documentation/assistants/conversation-behavior/background-speech-denoising)
- **End-of-turn:** a Krisp audio-based end-of-turn detector with a 0–1 threshold (default 0.5). — [Vapi speech configuration](https://docs.vapi.ai/customization/speech-configuration)
- **Voicemail detection:** off by default. Provider options are Vapi (recommended), Google, OpenAI and Twilio; minimum `frequencySeconds` is 2.5 s. — [Vapi voicemail detection](https://docs.vapi.ai/calls/voicemail-detection); [Vapi assistant API](https://docs.vapi.ai/api-reference/assistants/update)

**Retell**
- Proprietary turn-taking model covering interruptions, barge-in and backchannels (vendor claim). A Retell blog reports 58 clean recoveries in 62 interruption test calls (unverified). — [Retell blog, best voice AI providers](https://www.retellai.com/blog/best-voice-ai-providers)

**ElevenLabs Agents**
- Proprietary turn-taking model alongside ASR, LLM and TTS. Turn-taking, interruptions and timeouts are set in the conversation flow settings. — [ElevenAgents overview](https://elevenlabs.io/docs/agents-platform/overview)
- System tools include voicemail detection (optionally leaving a message), transfer to number, language detection and skip turn. A keypad-tone (DTMF) tool also exists, per the ElevenLabs tool surface. — [ElevenLabs system tools](https://elevenlabs.io/docs/agents-platform/customization/tools/system-tools)
- Filler phrases exist; OpenBenchmarks had to switch the filler off to time real answers. — [OpenBenchmarks](https://openbenchmarks.com/voice-agent-latency/voice-agent-latency-comparison)

**Deepgram**
- Flux provides native end-of-turn detection; its EagerEndOfTurn mode gives speculative early turns. — [together.ai Flux](https://www.together.ai/models/flux); [Deepgram STT changelog (Flux launch, English-only at first)](https://developers.deepgram.com/changelog/speech-to-text-changelog)

**Twilio ConversationRelay**
- `interruptible` can be none, dtmf, speech or any; `dtmfDetection` sends keypress events over the WebSocket; `reportInputDuringAgentSpeech` controls whether input is reported while the agent speaks. Individual text tokens can carry their own interruptible flag. — [Twilio ConversationRelay TwiML docs](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay)
- Now supports Deepgram Flux for turn detection. — [Twilio changelog: Flux](https://www.twilio.com/en-us/changelog/conversation-relay-now-supports-deepgram-flux---new-features)

**OpenAI Realtime**
- Semantic VAD scores the probability that the user has finished, so the model waits longer when that probability is low, which produces the tail behaviour in Section 1. — [Azure OpenAI realtime audio docs](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/realtime-audio); [openfon PR #10](https://github.com/duguetlabs/openfon/pull/10)

**Testing tools covering IVR**
- Hamming is the only one of Hamming, Coval and Cekura with DTMF/IVR emulation in a 2026 feature table (that comparison was written by Coval, a competitor). — [Coval: Hamming vs Cekura](https://www.coval.ai/blog/hamming-vs-cekura)

### Inferences
- The benchmark build (LiveKit self-hosted, Swedish) cannot use LiveKit's adaptive interruption model or a validated LiveKit/Smart Turn audio turn detector for Swedish. Options:
  - Use STT-driven endpointing (Azure Speech segmentation silence timeout) plus VAD.
  - Use the text-based MultilingualModel; whether it covers Swedish needs checking.
  - Use Deepgram Nova-3 Swedish endpointing.
  - Fine-tune a turn model on Swedish data.

  Hosted platforms that rely on these same models probably have the same Swedish weakness.
- Krisp-class denoising is now standard on hosted platforms (Vapi, Pipecat Cloud), so a self-hosted build should budget for an equivalent such as Krisp, or a LiveKit Cloud noise-cancellation plugin if it uses Cloud.

### Gaps
- No Swedish-specific end-of-turn or barge-in accuracy data was found for any vendor.
- IVR navigation features (an agent navigating outbound phone trees) were not confirmed for any platform beyond DTMF support (ElevenLabs keypad tool, Twilio DTMF, Hamming emulation).
- The details of Retell's backchanneling and Bland's turn-taking model were not reached.

---

## 3. Call transfer: cold, warm, SIP REFER, whisper and summary

### Takeaway
LiveKit, Retell and ElevenLabs document both cold and warm transfers with a context or whisper message for the receiving human. Whether SIP REFER works depends on the carrier; the forums report frequent REFER failures on Plivo and Telnyx trunks. Vapi's warm transfer has been called "experimental" in support replies. OpenAI's SIP interface exposes a `refer` endpoint.

### Cited Findings
**LiveKit**
- **Cold transfer:** sends a SIP REFER through the trunk (`TransferSIPParticipant`) and closes the caller's LiveKit session. — [LiveKit cold transfer docs](https://docs.livekit.io/telephony/features/transfers/cold)
- **Warm ("agent-assisted") transfer:**
  - The caller is put on hold, the human is dialled into a private consultation room, and the agent briefs them with a summary and collected data before bridging.
  - If nobody answers, the agent returns to the caller.
  - A prebuilt `WarmTransferTask` (beta) takes the human's number, the SIP trunk config and the conversation history.
  - The trunk must allow transfers (Twilio is the documented example).
  - Sources: [LiveKit warm transfer docs](https://docs.livekit.io/telephony/features/transfers/warm); [WarmTransferTask](https://docs.livekit.io/agents/prebuilt/tasks/warm-transfer.md)

**Retell**
- **Warm transfer** uses SIP DIAL, not REFER. It sets From and P-Asserted-Identity to the caller's number.
  - An optional whisper message is spoken only to the destination; an optional three-way message is played once both parties are on.
  - Human detection gates the bridge. With `opt_out_human_detection`, IVRs and voicemail also receive the whisper, and one user reported bridge failures with that setting.
  - Sources: [Retell transfer call tool](https://docs.retellai.com/build/single-multi-prompt/transfer-call); [Retell call transfer node](https://docs.retellai.com/build/conversation-flow/call-transfer-node); [Retell community thread](https://community.retellai.com/t/warm-transfer-with-opt-out-human-detection-bridge-fails-even-when-a-human-answers/2997)
- **Cold transfer** defaults to SIP INVITE; SIP REFER is optional, if the carrier supports it, and requires Elastic SIP Trunking rather than "Dial to SIP URI". — [Retell transfer docs](https://docs.retellai.com/build/single-multi-prompt/transfer-call); [Retell community: SIP REFER](https://community.retellai.com/t/transfer-call-using-sip-refer-to-different-destinations-based-on-detected-intent-state/962)

**Vapi**
- Vapi sends the REFER and the carrier executes it.
- Forum threads report Plivo trunks rejecting REFER, Telnyx telling one user REFER was not available on their account, and users moving to Twilio.
- A support reply called warm transfer "experimental"; one user found warm mode worked only on Twilio SIP calls.
- Vapi documents debugging through SIP traces (look for REFER and the 202 response).
- Sources: [Vapi debug forwarding drops](https://docs.vapi.ai/phone-calling/in-call-control/transfer-calls/debug-forwarding-drops); [Vapi forum: Plivo](https://support.vapi.ai/t/32968959/call-transfers-with-plivo-sip-trunk-numbers); [Vapi forum: transfers](https://support.vapi.ai/t/27091759/phone-transfers-not-working); [Vapi forum: warm transfer](https://support.vapi.ai/t/27522317/transfer-call-function-not-working-every-time)

**ElevenLabs**
- The `transfer_to_number` system tool supports conference, blind and SIP REFER transfers to a phone number or SIP URI, over Twilio or SIP trunks. It works only on phone calls.
- It plays a "client message" to the caller while they wait; an "agent message" for the human operator works only with native Twilio transfers, not with blind or SIP transfers.
- Separately, a "transfer to agent" tool hands over between AI agents.
- Source: [ElevenLabs transfer to number](https://elevenlabs.io/docs/eleven-agents/customization/tools/system-tools/transfer-to-number)

**OpenAI Realtime SIP**
- The Calls API includes accept, reject, refer ("transfer to another destination") and hangup endpoints, plus a sideband WebSocket for controlling the call. — [OpenAI Realtime SIP guide](https://developers.openai.com/api/docs/guides/realtime-sip); [OpenAI Calls API reference](https://platform.openai.com/docs/api-reference/realtime-calls/accept-call)

**Twilio ConversationRelay**
- The app ends the session with handoff data; Twilio then calls the `<Connect>` action URL so the flow can route to a human, for example in Flex with context. — [Twilio ConversationRelay docs](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay); [Twilio Flex escalation tutorial](https://www.twilio.com/en-us/blog/developers/tutorials/integrations/conversationrelay-flex-contextual-escalations)

### Inferences
- For Swedish receptionists, transfers usually go to a Swedish mobile number or PBX. Check that the Twilio Elastic SIP trunk allows REFER, or implement warm transfer by dial-out and bridge, as LiveKit's WarmTransferTask and Retell's SIP DIAL do. Dial-out and bridge avoids carrier REFER support entirely but keeps the platform in the media path, and you pay for both legs.
- LiveKit's documented warm transfer, with a summary and a fallback back to the caller, is at least as complete as the hosted platforms'. The self-hosted build is not at a disadvantage here.

### Gaps
- No details were found on transfers for Bland, Synthflow, Telnyx AI Assistants, Deepgram Voice Agent, Hume, Ultravox or Cartesia Line.
- REFER behaviour with Swedish carriers or numbers was not researched.

---

## 4. Testing and QA: simulated calls, evals, regression suites, analytics, monitoring, A/B tests

### Takeaway
Simulated-caller testing is now built into Vapi (Evals and Simulations), Retell (simulation and batch tests), ElevenLabs (simulation, next-reply and tool-call tests) and LiveKit (pytest/Vitest behavioural tests, Agent Simulations, Agent Insights observability). Most built-in simulators run on text, not audio. Audio-level QA (noise, DTMF/IVR, load) is where third-party tools such as Hamming, Coval and Cekura add value.

### Cited Findings
**Vapi**
- "Evals" check a single next response (exact match, pattern or AI judge); they do not exercise audio or timing.
- "Simulations" use an AI caller pursuing a goal over voice, exercising STT, TTS and timing.
- Vapi itself recommends controlled real phone calls for telephony, voicemail and noise.
- Sources: [Vapi voice testing](https://docs.vapi.ai/test/voice-testing); [Vapi advanced evals](https://docs.vapi.ai/observability/evals-advanced); [Vapi simulations quickstart](https://docs.vapi.ai/observability/simulations-quickstart)

**Retell**
- **Simulation tests:** an AI-simulated caller in text, with success criteria, dynamic variables, mocked functions, and a pass/fail grade with an explanation. Not supported for custom-LLM agents.
- **Batch tests:** saved cases run together as a regression suite before deploys.
- **Web call testing:** used to check real audio (latency, turn-taking, interruptions).
- Sources: [Retell batch testing](https://docs.retellai.com/test/batch-test-simulation); [Retell LLM simulation testing](https://docs.retellai.com/test/llm-simulation-testing); [Retell testing overview](https://docs.retellai.com/test/test-overview); [Retell changelog: performance analytics](https://www.retellai.com/changelog/performance-analytics-cf-testing-and-more)

**ElevenLabs**
- Three test types:
  - Simulation: multi-turn with a simulated user, 1–50 turns, default 5.
  - Next Reply: scores the next message against criteria.
  - Tool Call: asserts the expected tool, such as `transfer_to_number`, and its parameters.
- The older simulate-conversation endpoint is deprecated.
- The platform also offers real-time monitoring and branch/merge-proposal workflows for agent versions.
- Sources: [ElevenLabs agent testing](https://elevenlabs.io/docs/eleven-agents/customization/agent-testing); [ElevenLabs simulate conversation (deprecated)](https://elevenlabs.io/docs/eleven-agents/api-reference/agents/simulate-conversation); [ElevenLabs real-time monitoring](https://elevenlabs.io/docs/eleven-agents/guides/realtime-monitoring)

**LiveKit**
- Text-mode behavioural tests in pytest/Vitest assert on messages, tool calls and handoffs, with an LLM judge. Agent Simulations run multi-turn scenarios over text or audio and can run from CI.
- "Agent observability" and the "Agent insights" tab provide synchronized audio, transcripts, turn-by-turn traces and logs.
- A third-party guide says the insight detection is best-effort and English-only, and audio redaction does not work with realtime models.
- The LiveKit pricing page showed simulations free through Oct 31 (promotion).
- Sources: [LiveKit observability docs](https://docs.livekit.io/testing/observability/); [LiveKit agent observability blog](https://blog.livekit.io/streamline-troubleshooting-with-agent-observability/); [Future AGI LiveKit observability guide](https://futureagi.com/blog/voice-ai-observability-livekit-2026/); [LiveKit pricing](https://livekit.com/pricing)

**Third-party QA tools**
- **Coval:** positioned for CI/CD gating; second on simulation quality (48.9) and third on evaluation accuracy (62.7%) in a single third-party benchmark. — [Maxim: best voice agent eval tools 2026](https://www.getmaxim.ai/articles/best-voice-agent-evaluation-tools-in-2026/)
- **Hamming:** audio signal analysis, production call replay, 1,000+ concurrent simulations (self-reported), DTMF/IVR emulation. — [Coval: Hamming vs Cekura (competitor-written)](https://www.coval.ai/blog/hamming-vs-cekura)
- **Cekura:** $30/month self-serve, Conditional Actions, CLI and Python SDK, MCP server, GitHub Actions integration, 2,000+ concurrent simulations (self-reported). — [Cekura programmatic testing API](https://www.cekura.ai/discover/programmatic-voice-agent-testing-api); [Coval: Hamming vs Cekura](https://www.coval.ai/blog/hamming-vs-cekura)
- Hamming publishes guidance on testing and monitoring LiveKit agents in production. — [Hamming LiveKit testing guide](https://hamming.ai/resources/testing-and-monitoring-livekit-voice-agents-production)

### Inferences
- A self-hosted LiveKit build already has text-level unit tests and could add LiveKit Cloud observability, which raises EU-residency questions (see Section 7). For audio-level Swedish regression testing (accents, noise, numbers and dates), a third-party simulator that supports Swedish TTS callers, or a home-made harness (TTS caller over PSTN), is likely needed.
- Built-in A/B testing of prompts was not confirmed for any platform. ElevenLabs' branches and merge proposals and Vapi's Evals are the closest features found.

### Gaps
- No platform's native A/B prompt-testing feature was confirmed with a source.
- No Swedish-language support was confirmed for any simulated-caller tool.
- Bland's, Synthflow's and Telnyx's testing tooling was not reached.

---

## 5. Hallucination and guardrail features: knowledge bases, structured flows, tool-call validation

### Takeaway
The main anti-hallucination pattern across hosted platforms is a structured graph or flow constraining a free LLM: Bland "Pathways", Retell "Conversation Flow" nodes, ElevenLabs workflows and "procedures", Vapi assistants and squads. These come with knowledge-base retrieval and tool-call tests. Evidence about guardrail effectiveness is almost entirely vendor marketing.

### Cited Findings
- **Bland Pathways:** a node-based visual builder for branches, conditions and API calls; the main way Bland constrains call logic. — [CloudTalk Bland review](https://www.cloudtalk.io/blog/bland-ai-review/); [Fora Soft on Bland alternatives](https://www.forasoft.com/blog/article/bland-ai-alternatives)
- **Retell Conversation Flow:** typed nodes such as call-transfer nodes with set whisper and three-way messages, and non-agentic warm-transfer options, as opposed to single- or multi-prompt agents. — [Retell conversation flow nodes](https://docs.retellai.com/build/conversation-flow/node); [Retell call transfer node](https://docs.retellai.com/build/conversation-flow/call-transfer-node)
- **ElevenLabs:** separate configuration surfaces for guardrails, workflows, procedures, the knowledge base (RAG index) and tool-call tests, visible in the API and MCP tool surface (`update_guardrails`, `update_workflow`, `create_procedure`, `compute_kb_rag_index`). Tool Call tests assert the correct tool and parameters. — [ElevenLabs agent testing](https://elevenlabs.io/docs/eleven-agents/customization/agent-testing); [ElevenAgents overview](https://elevenlabs.io/docs/agents-platform/overview)
- **Retell text normalization:** a community answer says `normalize_for_speech` supports only English, Spanish, French and German, so Swedish numbers and dates may be read wrongly (forum post). — [Retell community multilingual thread](https://community.retellai.com/t/how-to-configure-stable-multilingual-agents-it-en-es-fr-de-with-2-3-languages-per-agent/2214)
- **Bland's own warning:** a Bland blog argues that certifications can break down if audio passes through infrastructure outside the attested environment. That is a compliance guardrail rather than a hallucination one. — [Bland blog: compliance tools](https://www.bland.ai/blog/best-rated-voice-ai-for-compliance)

### Inferences
- For a receptionist, a self-hosted LiveKit build can match the hosted platforms by using multi-agent handoffs or `AgentTask`s, function-tool schemas with server-side validation, and Azure AI Search for grounding. No hosted platform offers a proven, measured hallucination-rate advantage.

### Gaps
- No independent measurement of hallucination rates by platform was found.
- Vapi's knowledge-base and "squads" details, and Synthflow's and Telnyx's guardrails, were not reached because the search budget ran out.

---

## 6. Languages: Swedish STT and TTS quality, and switching language mid-call

### Takeaway
Swedish appears on the language lists of most platforms: ElevenLabs TTS models, Deepgram Nova-3 (since August 2025), Cartesia Sonic-3/3.5, Retell's language list, and Twilio ConversationRelay (sv-SE). **No published Swedish WER or TTS-naturalness benchmarks were found for any voice-agent platform.** The Swedish gaps are in the auxiliary models: LiveKit's turn detector, Smart Turn v3, Retell's text normalization, and possibly Deepgram Flux Multilingual.

### Cited Findings
- **ElevenLabs:** Swedish (sv) is listed for Eleven v4, v4 Turbo, v3, v3 Conversational and Multilingual v2. ElevenAgents claims 90+ languages with automatic language detection and switching mid-conversation; the language-detection system tool switches voice and responses. — [ElevenLabs models](https://elevenlabs.io/docs/overview/models); [ElevenLabs system tools](https://elevenlabs.io/docs/agents-platform/customization/tools/system-tools); [ElevenLabs Swedish TTS page](https://elevenlabs.io/text-to-speech/swedish)
- **Deepgram:** Nova-3 added monolingual Swedish (sv, sv-SE) for batch and streaming (changelog 2025-08-15; announced 2025-09-04). Flux launched English-only. The language set of Flux Multilingual (`flux-general-multi`) was not confirmed. — [Deepgram announcement](https://deepgram.com/learn/deepgram-expands-nova-3-with-german-dutch-swedish-and-danish-support); [Deepgram changelog](https://developers.deepgram.com/changelog/2025/8/15); [Deepgram Flux Multilingual](https://deepgram.com/learn/deepgram-launches-flux-multilingual-press-release)
- **Cartesia:** Sonic-3 and Sonic 3.5 list Swedish (sv) among 42 languages, alongside Danish, Norwegian and Finnish. — [Cartesia TTS models](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest)
- **Retell:** Swedish is in its "31+ languages" list (January 2025 blog) and has a Swedish landing page. The community advises 2–3 languages per agent to reduce ASR drift. Text normalization is English, Spanish, French and German only. — [Retell multilingual blog](https://www.retellai.com/blog/how-to-use-ai-phone-agents-for-multilingual-communication); [Retell Swedish page](https://www.retellai.com/languages-ai/swedish-ai); [Retell community](https://community.retellai.com/t/how-to-configure-stable-multilingual-agents-it-en-es-fr-de-with-2-3-languages-per-agent/2214)
- **Twilio ConversationRelay:** the default-voice table lists sv-SE with an ElevenLabs voice plus Google transcription; examples also use Amazon Polly "Elin-Neural" for sv-SE. — [Twilio ConversationRelay voice configuration](https://www.twilio.com/docs/voice/conversationrelay/voice-configuration); [Twilio ConversationRelay docs](https://www.twilio.com/docs/voice/twiml/connect/conversationrelay)
- **Vapi:** language quality depends on the STT and TTS provider you choose; Vapi passes it through. — [Retell blog: Vapi vs ElevenLabs (competitor source)](https://www.retellai.com/blog/vapi-vs-elevenlabs); [Deepgram on Vapi](https://docs.vapi.ai/providers/transcriber/deepgram)
- **Telnyx:** "100+ languages" claimed, but Swedish is not named. — [Telnyx Europe](https://telnyx.com/europe)
- **Hume EVI:** only 11 major languages as of March 2026 (secondary sources); Swedish not confirmed. — [dupple Hume review](https://dupple.com/reviews/hume)
- **LiveKit turn detector:** no Swedish. **Pipecat Smart Turn v3:** no Swedish. (See Section 2.)

### Inferences
- For Swedish, the benchmark stack's choice of Azure Speech (sv-SE STT plus Swedish neural voices) and Azure OpenAI is reasonable. The hosted platforms do not appear to have a Swedish advantage in model quality, because they resell the same third-party STT and TTS models. ElevenLabs and Cartesia are the TTS alternatives worth A/B testing against Azure neural voices.
- Mid-call switching between English and Swedish is natively productized in ElevenLabs (language-detection tool). Elsewhere it is mostly prompt-driven or uses multilingual STT modes. With Azure Speech it would need continuous language identification or a parallel STT setup.

### Gaps
- No published Swedish WER or MOS (TTS naturalness) comparison was found for Azure, Deepgram, ElevenLabs Scribe, OpenAI gpt-realtime or Google on telephony (8 kHz) audio.
- Swedish quality for OpenAI gpt-realtime and Azure Voice Live was not found.
- Swedish support was not confirmed for Synthflow, Bland, Telnyx, Hume, Ultravox or Sindarin.

---

## 7. Compliance: GDPR, EU data residency, SOC 2, HIPAA, ISO 27001, zero data retention

### Takeaway
SOC 2 Type II and GDPR DPAs are table stakes, and HIPAA BAAs are usually an Enterprise or paid add-on. True EU data residency is the main differentiator:
- **Available:** LiveKit (EU project region plus `eu-central` agents, region pinning on Scale+), ElevenLabs (EU residency on enterprise), Vapi (EU region), Deepgram (api.eu.deepgram.com), Telnyx (EU GPUs in Paris and Frankfurt), OpenAI (EU residency for some realtime snapshots, with a 10% uplift on newer models).
- **Not available:** Retell, per a company rep in 2026 (all processing in AWS US). Synthflow is EU-capable, with exceptions tied to Twilio.

### Cited Findings
**Vapi**
- SOC 2 Type II and GDPR (FAQ) — [Vapi FAQ](https://docs.vapi.ai/faq)
- EU region for data residency, with orchestration on US or EU infrastructure — [Vapi data flow](https://docs.vapi.ai/security-and-privacy/data-flow)
- Zero data retention (ZDR): an org-wide setting that stops storage of recordings, transcripts and logs but keeps metadata; it cannot be combined with HIPAA mode — [Vapi ZDR](https://docs.vapi.ai/security-and-privacy/zero-data-retention)
- HIPAA add-on: $2,000/month with a BAA (an older June 2025 forum reply said $1,000/month); HIPAA mode restricts which providers can be used — [Vapi pricing](https://vapi.ai/pricing); [Vapi HIPAA](https://docs.vapi.ai/security-and-privacy/hipaa); [Vapi forum](https://support.vapi.ai/t/29104150/hippa-compliance-question)

**Retell**
- Marketed as SOC 2 Type II and ISO 27001, with HIPAA and GDPR covered by a self-signed DPA with Standard Contractual Clauses (SCCs) — [Retell enterprise security](https://www.retellai.com/blog/enterprise-ai-calling-security)
- A company rep (about 168 days before research date) said Retell does not operate in the EU; all processing is in AWS US regions; SCCs do not meet a physical residency requirement. An enterprise on-prem option is mentioned — [Retell community: NIS2 / EU residency](https://community.retellai.com/t/retell-nis2-is-full-eu-data-residency-actually-possible/2541/3)
- HIPAA BAA is Enterprise-only per one review, while another says BAAs are available — [CloudTalk Retell pricing](https://www.cloudtalk.io/retell-ai-pricing/); [Synthflow Retell review (competitor source)](https://synthflow.ai/blog/retell-ai-review)

**ElevenLabs**
- Data residency in the US, EU and India; HIPAA with BAAs, which the pricing page lists as Enterprise-only; regional residency is an enterprise control — [ElevenAgents page](https://elevenlabs.io/agents); [ElevenLabs healthcare](https://elevenlabs.io/agents/healthcare); [ElevenAgents pricing](https://elevenlabs.io/pricing/agents)
- An "Agents – EU Residency" component appears on its status page, and a 2026-10-06 incident was titled "EU Agents disruption in SIP calls", which confirms an EU deployment exists — [ElevenLabs status (incident.io)](https://statuspage.incident.io/elevenlabs/incidents/73m4as2z)

**LiveKit**
- To keep everything in the EU: choose the EU project data region at creation (Frankfurt; it cannot be changed later), deploy agents to `eu-central`, and use LiveKit Inference, which restricts to EU models when agents run in the EU — [LiveKit data residency](https://docs.livekit.io/deploy/admin/regions/data-residency)
- Region pinning requires the Scale plan or higher, is enabled through support, and disables failover; telephony uses region-based endpoints — [LiveKit region pinning](https://docs.livekit.io/deploy/admin/regions/region-pinning)
- Conflict: an older blog (February 2026) and a community post said observability data is stored in the US; the current docs list an EU data region — [LiveKit regional checklist blog](https://livekit.com/blog/checklist-for-regional-deployments); [LiveKit community](https://community.livekit.io/t/agent-observability-and-region-pinning/1206)
- The trust center offers a SOC 2 report, BAA, GDPR and HIPAA materials, and a list of HIPAA-eligible services — [LiveKit data residency docs](https://docs.livekit.io/deploy/admin/regions/data-residency)

**OpenAI Realtime**
- The launch post says the Realtime API supports EU data residency; developer notes narrow this to specific 2025 snapshots, which must be enabled per organization through the EU endpoint
- Regional processing carries a 10% uplift for eligible models released on or after 2026-03-05
- Sources: [OpenAI gpt-realtime launch](https://openai.com/index/introducing-gpt-realtime/); [OpenAI developer notes](https://developers.openai.com/blog/realtime-api); [OpenAI pricing](https://developers.openai.com/api/docs/pricing)

**Azure Voice Live / Azure OpenAI** (relevant to the benchmark stack)
- `gpt-realtime-regional` and `-datazone` variants (and the 2.1 equivalents) keep processing in the region or data zone; Sweden Central appears among Speech regions — [Azure Speech pricing](https://azure.microsoft.com/en-us/pricing/details/speech/); [Voice Live overview](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/voice-live)

**Deepgram**
- The EU endpoint api.eu.deepgram.com is generally available, includes Voice Agent (/v1/agent/converse), and costs nothing extra; Whisper is excluded
- BAAs are for Enterprise
- With a third-party "think" LLM, you must verify that provider's residency yourself
- One compliance-page fragment mentions Australian infrastructure for listen and speak (likely an editing artifact; unverified)
- Sources: [Deepgram EU endpoint GA](https://deepgram.com/learn/deepgram-eu-endpoint-now-generally-available); [Deepgram data privacy compliance](https://developers.deepgram.com/trust-security/data-privacy-compliance)

**Telnyx**
- Open-weight inference on owned GPUs in Paris and Frankfurt; prompts and outputs processed in the EU; traffic stays on its private network — [Telnyx Europe](https://telnyx.com/europe)

**Synthflow**
- Trust Center lists SOC 2 Type 2, GDPR, DORA, EU AI Act, HIPAA, ISO 27001, ISO 42001 and PCI DSS v4.0.1 — [Synthflow Trust Center](https://security.synthflow.ai/)
- EU residency is stated, but WhatsApp and SMS are US-only "because Twilio does not currently offer EU data residency" (third-party review quoting Synthflow docs) — [CloudTalk Synthflow review](https://www.cloudtalk.io/blog/synthflow-ai-review/)

**Bland**
- Self-describes as SOC 2 Type I and II, HIPAA (BAAs included), PCI DSS and GDPR, with on-prem or VPC options; the documentation is under NDA, and the claims are vendor or paid-press-release only — [Bland AI information](https://www.bland.ai/ai-information); [Bland healthcare](https://www.bland.ai/industries/healthcare)

### Inferences
- For a Swedish deployment under GDPR (and possibly NIS2 in some sectors), the benchmark stack (Azure Sweden Central or EU Data Zone, LiveKit self-hosted in the EU, Twilio) can claim stronger, more verifiable residency than Retell. It is comparable to LiveKit Cloud EU, ElevenLabs Enterprise EU, or Telnyx EU.
- Twilio itself is a residency weak point; Synthflow's docs cite Twilio's lack of EU data residency for messaging. Carrier choice (Twilio against an EU carrier or Telnyx EU) should be evaluated.

### Gaps
- Not confirmed: whether gpt-realtime-2.x on OpenAI direct is EU-residency eligible, and the ISO 27001 status of Vapi, LiveKit and ElevenLabs.
- No Twilio ConversationRelay EU-region information was gathered.
- No compliance information for Hume, Ultravox, Cartesia Line or Sindarin.

---

## 8. Pricing per minute (platform fee plus model costs) and concurrency limits, with dates

### Takeaway
Platform-only fees cluster at $0.01–0.08/min: LiveKit agent sessions $0.01, Telnyx $0.05, Ultravox $0.05, Cartesia Line $0.06, Retell $0.07+, Twilio ConversationRelay $0.07, ElevenLabs $0.08. Vapi has moved to tiered plans with a percentage of hosting fees. Realistic all-in costs land at about $0.06–0.33/min. Speech-to-speech flagships (gpt-realtime-2.1) cost about $0.05–0.15/min for the model alone. A self-hosted LiveKit build pays only for models and carrier, but carries its own engineering and operations cost.

### Cited Findings
**Pricing table**

| Platform | Pricing (as of 2025–2026) | Concurrency | Sources |
|---|---|---|---|
| Vapi | Current pricing page: free tier (4 concurrent); Core $29/mo (10 concurrent); Pro = 10% of hosting fee, $999/mo minimum (30 concurrent); extra lines $10/line/mo; HIPAA $2,000/mo. Older $0.05/min platform fee widely cited in 2026 reviews. All-in estimates $0.13–0.33/min (reviews). | 4 / 10 / 30 by tier | [Vapi pricing](https://vapi.ai/pricing); [Vapi plans docs](https://docs.vapi.ai/enterprise/plans); [CloudTalk Vapi pricing](https://www.cloudtalk.io/blog/vapi-ai-pricing/) |
| Retell | Pay-as-you-go from $0.07/min, no platform fee; all-in $0.07–0.31/min; Retell number about $0.015/min + $2/mo; $10 free credit | 20 free concurrent; extra about $8/mo each (Retell comparison page) | [CloudTalk Retell pricing](https://www.cloudtalk.io/retell-ai-pricing/); [Retell vs Bland](https://www.retellai.com/comparisons/retell-vs-bland) |
| Bland | 2026 reviews: Start $0.14/min, no platform fee; Build $0.12/min + $299/mo; Scale $0.11/min + $499/mo (billing docs). Bundles LLM, STT and TTS; telephony extra. Older $0.09/min figure is stale (2025). | not found | [orvera Bland pricing](https://orvera.ai/blogs/bland-ai-pricing); [CloudTalk Bland review](https://www.cloudtalk.io/blog/bland-ai-review/) |
| Synthflow | Enterprise-only, from about $30,000/yr (2026); last published per-minute rate $0.08/min (August 2025) | not found | [getmacha Synthflow pricing](https://www.getmacha.com/blog/synthflow-pricing-explained) |
| ElevenLabs Agents | $0.08/min additional minutes; burst above concurrency limit $0.16/min (up to 3× limit or 300); LLM billed separately; no ElevenLabs telephony charge. Plans: Free (15 min), Starter $6, Creator $22, Pro $99, Scale $299, Business $990 (12,375 min), Enterprise. | 4 (Free) to 40 (Business) | [ElevenAgents pricing](https://elevenlabs.io/pricing/agents); [ElevenLabs PAYG blog](https://elevenlabs.io/blog/weve-lowered-api-agents-pricing-and-introduced-pay-as-you-go); [thunderphone guide](https://thunderphone.com/guides/elevenlabs-agents-pricing) |
| OpenAI gpt-realtime-2.1 | Audio $32/1M input tokens ($0.40 cached), $64/1M output; gpt-realtime-2.1-mini $10 / $20; about $0.019/min listening, $0.077/min speaking; real two-way about $0.05–0.15/min; telephony extra. gpt-realtime and gpt-4o-realtime reportedly retire 2027-01-20. | not found | [OpenAI pricing](https://developers.openai.com/api/docs/pricing); [Layer3 Labs](https://www.layer3labs.io/guides/openai-realtime-api-pricing); [Fora Soft](https://www.forasoft.com/blog/article/openai-realtime-api-pricing) |
| LiveKit Cloud | Agent session $0.01/min beyond included allowance (1,000 Build / 5,000 Ship / 50,000 Scale); telephony $0.01/min; third-party SIP $0.004/min (Ship) or $0.003; Ship $50/mo, Scale $500/mo; models billed separately (inference credits or bring your own keys) | quotas page exists, figures not extracted | [LiveKit pricing](https://livekit.com/pricing); [LiveKit quotas](https://docs.livekit.io/deploy/admin/quotas-and-limits/); [Fora Soft LiveKit](https://www.forasoft.com/blog/article/livekit-vs-agora-cost-analysis) |
| Pipecat Cloud | agent-1x $0.01/min active ($0.0005/min reserved), 2x $0.02, 3x $0.03; Daily PSTN $0.018/min; WebRTC $0.004/participant-min; Krisp VIVA free to 10k min then $0.0015/min; GA January 2026 | not found | [Pipecat Cloud pricing](https://www.daily.co/pricing/pipecat-cloud/) |
| Deepgram Voice Agent | Standard about $4.50/hr ($0.075/min); Advanced about $0.163/min; bring-your-own-LLM tier reportedly $0.065/min since August 2026 (single source); billed on WebSocket connection time. Flux STT $0.0065–0.0077/min. | not found | [usagepricing Deepgram](https://www.usagepricing.com/blueprint/deepgram); [Deepgram GitHub discussion](https://github.com/orgs/deepgram/discussions/1089); [Deepgram Voice Agent GA](https://deepgram.com/learn/voice-agent-api-generally-available) |
| Cartesia Line | $0.06/min call duration + $0.014/min with a Cartesia number | not found | [CloudTalk Cartesia pricing](https://www.cloudtalk.io/blog/cartesia-pricing/) |
| Hume EVI 3 | Overage $0.06/min (Pro), $0.05 (Scale), $0.04 (Business); Starter $0.07/min with 40 minutes; telephony and external LLM extra | not found | [Hume pricing](https://www.hume.ai/pricing) |
| Ultravox | $0.05/min (kept for v0.7); paid plans remove concurrency caps. Reported acquisition by Inworld on 2026-09-30 (single source). | caps on lower plans | [Ultravox news](https://docs.ultravox.ai/changelog/news); [Ultravox v0.7](https://www.ultravox.ai/blog/introducing-ultravox-v0-7-the-world-s-smartest-speech-understanding-model); [aiscoutdaily on Inworld](https://aiscoutdaily.com/news/inworld-acquires-ultravox-voice-agents) |
| Telnyx AI Assistants | $0.05/min orchestration incl. STT and TTS; LLM and telephony extra; about $0.06 all-in (Telnyx's own estimate); $0.0500/min invoiced in OpenBenchmarks | not found | [Telnyx conversational AI pricing](https://telnyx.com/pricing/conversational-ai); [OpenBenchmarks](https://openbenchmarks.com/voice-agent-latency/voice-agent-end-to-end-latency) |
| Twilio ConversationRelay | $0.07/min plus voice minutes (US local inbound $0.0085/min); bring your own LLM; automatic volume discounts; GA (May 2026 per tracker) | not found | [Twilio conversational AI pricing](https://www.twilio.com/en-us/products/conversational-ai/pricing); [thunderphone guide](https://thunderphone.com/guides/twilio-conversationrelay-pricing); [usagepricing Twilio GA](https://www.usagepricing.com/blueprint/activity/twilio-2026-05-06-launch) |
| Azure Voice Live | Tiered (Pro tier includes gpt-realtime and gpt-realtime-2.1 plus regional and datazone variants); per-token rates not rendered in search; a third-party calculator mirrors OpenAI's $32 / $64 | not found | [Azure Speech pricing](https://azure.microsoft.com/en-us/pricing/details/speech/); [Azure Voice Live pricing blog](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/azure-ai-voice-live-api-what%E2%80%99s-new-and-the-pricing-announcement/4428687) |
| Air.ai | Not purchasable (see Section 9) | — | — |
| Sindarin | No pricing found | — | — |

**Cross-platform all-in figures**
- One aggregator puts LiveKit plus models plus telephony at about $0.04–0.25/min; a LiveKit-calculator default phone stack comes to about $0.0479/min. — [LiveKit pricing (search extract)](https://livekit.com/pricing); [usagepricing LiveKit](https://www.usagepricing.com/blueprint/livekit)

### Inferences
- The benchmark stack's marginal cost is Twilio voice ($0.0085/min US-inbound reference; Swedish rates not gathered) plus Azure STT/TTS and Azure OpenAI tokens plus hosting. It should plausibly land below the $0.10–0.30/min all-in of hosted platforms, but the comparison should include engineering and on-call cost.
- Concurrency caps on hosted platforms are cheap to raise ($8–10 per line per month on Retell and Vapi). Burst pricing (ElevenLabs at 2×) matters for receptionist call spikes.

### Gaps
- Swedish PSTN rates on Twilio, Telnyx and LiveKit were not collected.
- Deepgram's list price versus promo price is unresolved.
- Azure Voice Live per-token prices for Sweden Central were not extracted.
- Concurrency limits for Bland, Synthflow, Telnyx, Deepgram, Cartesia, Hume and Pipecat are not confirmed.

---

## 9. Reliability incidents, outages and community complaints

### Takeaway
All hosted platforms had several call-affecting incidents in 2026:
- **Vapi:** 16 incidents in 90 days by one tracker, including a 4.5 h database outage in May.
- **Retell:** a web and phone call disruption on 2026-09-05, plus degradations in July and September.
- **ElevenLabs:** SIP and EU agent disruptions on 2026-10-06 and 10-08.
- **OpenAI Realtime SIP:** forum reports of webhook delays and failures, and `call_id_not_found` errors.

Air.ai is effectively defunct and subject to FTC action.

### Cited Findings
**Vapi**
- Status page incidents: elevated call failure rate on 2026-05-26 (about 40 min) and API degradation on 2026-08-04 (about 40 min) — [Vapi status incidents](https://status.vapi.ai/incidents); [Elevated call failure rate](https://status.vapi.ai/incident/905860); [API degradation on Daily](https://status.vapi.ai/incident/996148)
- A May 2026 analysis reports a database outage on 2026-05-20 (about 4.5 h) and "3 outages in 11 days" — [buildwithhermes](https://www.buildwithhermes.com/blog/lovo-bankruptcy-vapi-outages-voice-infrastructure-risk-2026-05-31)
- IsDown: 16 incidents in the prior 90 days (6 major), median about 1.5 h; 337 incidents since August 2024 — [IsDown Vapi](https://isdown.app/status/vapi)
- StatusStack: 98.24% uptime over 30 days; BYO SIP trunk creation failing since 2026-10-08; outbound SIP failure on 10-02 (about 21 min); number-provisioning degradation on 09-29 (about 22 h). Trackers conflict with each other. — [StatusStack Vapi](https://statusstack.com/service/vapi)

**Retell**
- 2026-09-05 web, outbound and inbound call disruption, with a postmortem posted — [Retell community announcement](https://community.retellai.com/t/web-calls-and-phone-calls-disruption/3610)
- 2026-09-16/17 "Call service degraded" — [Retell community](https://community.retellai.com/t/call-service-degraded/3657)
- A user thread on server-side terminations and calls stuck "ongoing" on long calls — [Retell community](https://community.retellai.com/t/degraded-performance-server-side-errors-and-perpetually-ongoing-calls/3662)
- StatusGator: major outage on 2026-07-29 with inbound calls not connecting — [StatusGator Retell](https://statusgator.com/services/retell-ai)

**ElevenLabs**
- 2026-09-18/19 "Some ElevenAgents calls failed to start" (telephony, about 1.3 h) — [ElevenLabs status](https://status.elevenlabs.io/incidents/01M2VHBGDK805SSRGAEZ6Q6TF0)
- 2026-09-29 Agents and STT latency and failures (about 1.5 h); 2026-10-06 "EU Agents disruption in SIP calls" (about 2 h 23 min); 2026-10-08 Agent SIP disruption (about 26–44 min) — [ElevenLabs EU residency incident](https://statuspage.incident.io/elevenlabs/incidents/73m4as2z); [IsDown ElevenLabs](https://isdown.app/status/elevenlabs)

**OpenAI Realtime SIP**
- Forum reports: "Realtime API unreliable over SIP"; inbound calls failing before webhook dispatch; `accept` returning 404 `call_id_not_found` on every inbound call since 2026-09-10; questions on whether RTP is gated to specific carriers — [OpenAI community: unreliable over SIP](https://community.openai.com/t/realtime-api-unreliable-over-sip/1366350); [webhook failures](https://community.openai.com/t/realtime-api-sip-inbound-calls-failing-again-before-webhook-dispatch/1380763); [call_id_not_found](https://community.openai.com/t/realtime-sip-accept-returns-404-call-id-not-found-on-every-inbound-call-since-2026-09-10-worked-for-months/1396354); [RTP gating](https://community.openai.com/t/realtime-api-over-sip-is-rtp-still-gated-to-specific-carriers/1388553)

**Transfers**
- Recurring Vapi forum complaints about transfers failing (see Section 3) — [Vapi forum](https://support.vapi.ai/t/27522317/transfer-call-function-not-working-every-time)

**Air.ai**
- The FTC sued Air AI Technologies, related companies and three founders in August 2025 (D. Ariz.) over deceptive earnings claims and refund guarantees; the FTC case page shows "Pending" — [FTC case page](https://search.ftc.gov/legal-library/browse/cases-proceedings/airai); [FKKS analysis](https://advertisinglaw.fkks.com/post/102l0vq/ftcs-case-against-air-ai-highlights-ongoing-enforcement-trend)
- Secondary sources report a March 2026 settlement: an $18M judgment, largely suspended, and a ban. One blog says the voice services went dark in late 2024. Both are unconfirmed by the FTC page. — [Trillet blog](https://trillet.ai/blogs/air-ai-ftc-lawsuit-status-2026)

**Ultravox**
- Reported acquisition by Inworld on 2026-09-30; pricing and long-term support not announced (single source) — [aiscoutdaily](https://aiscoutdaily.com/news/inworld-acquires-ultravox-voice-agents)

**Sindarin**
- Small Austin company (founded 2022) selling the "Persona" low-latency agent product; aggregator estimates of about 5 employees and about $550K revenue in 2025 (low-quality sources); no 2026 news found — [aiwiki Sindarin](https://www.aiwiki.ai/wiki/sindarin_ai); [getlatka Sindarin](https://getlatka.com/companies/sindarin.tech)

**LiveKit region pinning**
- Pinning disables automatic failover to another region during an outage, a reliability trade-off for EU residency — [LiveKit region pinning](https://docs.livekit.io/deploy/admin/regions/region-pinning)

### Inferences
- Hosted platforms add a dependency chain (platform plus its STT, LLM and TTS vendors plus carrier). Vapi's "API Degradation on Daily" title suggests upstream media-provider incidents flow through. A self-hosted LiveKit build removes the platform layer but inherits Azure, Twilio and LiveKit-server operations. Design for multi-region failover, or accept the residency/failover trade-off.
- Air.ai should be excluded from any vendor shortlist. Ultravox's roadmap risk rose after the reported acquisition.

### Gaps
- No Reddit or Hacker News threads were retrieved; the searches returned blogs and trackers instead. The community-complaint picture rests on vendor forums and status trackers.
- No 2026 incident data was gathered for LiveKit Cloud, Twilio, Telnyx, Deepgram, Bland, Synthflow, Pipecat Cloud or Azure Speech or OpenAI.
- Not researched because the search budget ran out: Telnyx AI Assistant features (transfer, voicemail, Swedish) and its compliance certifications.
