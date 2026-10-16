# Swedish gaps hand our receptionist an edge

As of October 2026, no single company sells the best AI phone receptionist for a Swedish audit firm. Each leader falls short on one thing that matters here. **Smith.ai** is the most accounting- and legal-oriented SMB receptionist, but it speaks only English and Spanish. **RingCentral AIR** has the broadest SMB feature set but no Swedish. **Aircall's AI Voice Agent** is the most credible Swedish-capable SMB product, yet its voice-AI subprocessors are listed as processing in the USA. Among developer platforms, **ElevenLabs Agents, Telnyx and LiveKit** lead on latency and EU residency. **Sierra, Decagon, PolyAI and Parloa** set the enterprise engineering bar at roughly $150k+ a year. Swedish operators (**Telavox, Tele2/Responda, Telink**) and about a dozen startups sell receptionists at 300–4,500 kr/month, with no independent quality evidence. For live agent assist, **Cresta and Google Agent Assist** define the pattern: grounded, cited, speaker-aware answer cards. Our self-hosted build (LiveKit + Twilio + Azure Speech and Azure OpenAI in the EU) follows the architecture the leaders use, and it is ahead of almost every SMB competitor on verifiable Swedish-language and EU-processing claims. Its weaknesses are in execution:

- **VAD and barge-in are hair-trigger** because of a confirmed unit bug in the agent configuration.
- **The AI disclosure can be interrupted**, and the EU AI Act Article 50 disclosure duty has applied since 2 August 2026.
- **Azure STT finalization is slow:** an independent benchmark puts it at about 1 s median.
- **Nothing is measured or regression-tested yet:** there is no latency instrumentation and no regression suite.
- **There is no Swedish number and date normalization** before speech synthesis.

The copilot carries the bigger risk. Its quick answer is not grounded in any source. It also sends confidential client conversations to services that may process them outside the EU, which collides with the auditors' confidentiality duty in 26 § revisorslagen. Separate prioritized fix lists for the receptionist and the copilot close the report.

> **How to read this report.** None of the six research streams could open vendor pages directly: the egress proxy blocked page fetches, and in one stream DNS lookups failed. Every vendor finding below comes from **search-engine result extracts** of the cited pages, not full-page reads. The exceptions are code-level findings, which researchers checked against GitHub source (LiveKit agents-js, Pipecat, OpenAI SDK, Azure Speech SDK, OWASP), and our own repository, which was inspected directly. Prices, certifications, latency claims and legal dates are labelled where they are vendor claims, competitor sources or conflicting. Re-check them on the live page before quoting them externally. The final section lists the figures that need verification.

## Five markets, and nobody combines Swedish, EU processing and accounting depth

The market splits into five groups that rarely compete head-on. The table names the strongest player in each for our use case and the one gap that keeps each from being a drop-in answer for Revisionskonsulterna J Hägglund.

| Segment | Strongest players (Oct 2026) | Why they lead | What they lack for a Swedish audit firm |
|---|---|---|---|
| SMB AI receptionists | Smith.ai, RingCentral AIR, Aircall AI Voice Agent, Rosie, Quo Sona | Accounting/legal intake (Smith.ai); Outlook/Calendly booking, SMS, auto language switching (AIR); Swedish GA plus EU storage (Aircall) | Swedish confirmed only at Aircall and Zendesk; Aircall's AI subprocessors process in the US |
| Developer voice-agent platforms | LiveKit, ElevenLabs Agents, Telnyx, Retell, Vapi, Pipecat | Measured latency, warm transfer, built-in simulation testing, EU regions (LiveKit, ElevenLabs, Telnyx, Vapi) | Swedish-capable turn detection is missing everywhere; Retell processes only in the US |
| Enterprise contact-centre AI | Sierra, Decagon, PolyAI, Parloa, NICE Cognigy, Five9, Google | Procedure layers, supervisor models, deterministic tool gates, simulators | Typical deals start around $150k/year; no Swedish voice case study with numbers |
| Nordic players | Telavox, Tele2 (Responda), Telink, Svaria, Menodi, TechTell, Teneo | Native PBX integration, SEK flat fees, Swedish marketing | No independent quality data; hosting and DPAs mostly undisclosed |
| Agent assist / call copilots | Cresta Knowledge Agent, Google Agent Assist, Dialpad, NICE, Balto, Teams Copilot | Grounded, cited cards; channel-based speaker separation; feedback loops | Enterprise pricing; EU hosting mostly unconfirmed |

### SMB receptionists

**Smith.ai** has the most professional-services DNA. It has an accounting vertical whose AI qualifies prospects by "service type, entity type, business size, accounting software, deadline urgency, and budget range." It escalates tax-deadline emergencies to humans and sells extra live-agent coverage during tax season ([Smith.ai](https://smith.ai/blog/ai-answering-service-for-accountants)). It pushes call summaries to email, SMS, Slack or Teams ([Smith.ai](https://smith.ai/ai-receptionist)). Its Swedish problem is blunt: AI and live agents work in English and Spanish only ([Lawyerist](https://lawyerist.com/reviews/virtual-receptionists-outsourced-staffing/smith-ai/)).

**RingCentral AIR** has the richest 2026 feature set:

- It builds itself from the firm's website.
- It books into Calendly, Google and Outlook calendars ([RingCentral](https://www.ringcentral.com/us/en/blog/ai-receptionist-easier-setup-smarter-conversations/)).
- It answers SMS and acts as call-queue overflow ([RingCentral](https://www.ringcentral.com/us/en/blog/ai-receptionist-texts-call-queues-integrations/)).
- It detects the caller's language from the first words and switches automatically.

Its languages stop at English, Spanish, French, Italian, German and Portuguese.

**Aircall** lists Swedish, Norwegian, Danish and Finnish as generally available for its voice agent, while calling Swedish analytics "best effort" ([Aircall](https://support.aircall.io/en-gb/articles/25979264664221)). It is also the only named SMB product with documented EU (Frankfurt) storage ([Aircall](https://aircall.io/regional-data-hosting/)). However, its voice-agent subprocessors (Deepgram, ElevenLabs, AssemblyAI, Cartesia, Azure) are listed as processing in the USA ([Aircall](https://aircall.io/subprocessorlist/)). **Zendesk** voice AI agents list sv-SE ([Zendesk](https://support.zendesk.com/hc/en-us/articles/10588277182618-Configuring-multi-language-support-for-voice-AI-agents)). **Dialpad's AI Agent does not list Swedish** ([Dialpad](https://help.dialpad.com/docs/dialpad-ai)). Ruby is still a human service that uses AI behind the scenes ([Ruby](https://www.ruby.com/ai/)).

### Developer platforms

LiveKit, the framework we already use, is a top-tier choice for this deployment. To keep data in the EU you pick the EU project region and deploy agents to `eu-central` ([LiveKit](https://docs.livekit.io/deploy/admin/regions/data-residency)). Its warm transfer briefs the human in a private consultation room and returns to the caller if nobody answers ([LiveKit](https://docs.livekit.io/telephony/features/transfers/warm)). Our build already has an equivalent, with a private brief and DTMF accept.

**ElevenLabs Agents** has three things the others lack for a Swedish build: Swedish across its TTS models, a language-detection system tool that switches mid-call, and EU residency on enterprise plans ([ElevenLabs](https://elevenlabs.io/docs/agents-platform/customization/tools/system-tools); [ElevenLabs](https://elevenlabs.io/agents)). **Telnyx** runs inference on its own GPUs in Paris and Frankfurt, co-located with its telephony ([Telnyx](https://telnyx.com/europe)).

**Retell** is disqualified for us. A company representative said in 2026 that all processing runs in AWS US regions and that SCCs do not meet a physical residency requirement ([Retell community](https://community.retellai.com/t/retell-nis2-is-full-eu-data-residency-actually-possible/2541/3)). **Vapi** logged 16 incidents in 90 days on one tracker ([IsDown](https://isdown.app/status/vapi)). **Air.ai** faces FTC action and should not be on any shortlist ([FTC](https://search.ftc.gov/legal-library/browse/cases-proceedings/airai)).

### Nordic players

The Nordic market is crowded and almost entirely self-described.

- **Telavox** launched an AI receptionist in March 2025 that customers configure themselves in its app. Telavox says it wants to become Europe's largest voice-AI provider ([Telavox](https://telavox.se/nyheter/nu-lanserar-vi-var-ai-receptionist-for-foretag/); [Cision](https://news.cision.com/se/telavox)).
- **Tele2's** Ai-receptionist, built with Responda, costs **1,599 kr/month at launch (normally 1,999 kr)** including 2–4 hours of setup ([Tele2](https://www.tele2.se/foretag/vaxel/ai-receptionist)).
- **Telink** sells an add-on **from 499 kr/month** on top of an 89 kr/user PBX ([Telink](https://telink.se/funktioner/ai-receptionist-pris/)).
- **Svaria** is the only vendor found marketing directly to redovisningsbyråer. Its pitch: verify the caller by organisationsnummer, read case status from Visma Advisor, Fortnox, Capego or Briljant, book the right consultant, and send deadline reminders ([Svaria](https://www.svaria.io/blogg/ai-receptionist-redovisning-usecase)). This is marketing, and the integrations are unverified.
- **Teneo** (formerly Artificial Solutions) is the Swedish enterprise heavyweight. Folksam is a named customer, but no metrics are published ([Teneo](https://www.teneo.ai/blog/best-enterprise-ai-voice-agents-customer-service)).

No independent review or benchmark exists for any Swedish AI receptionist. Not one startup gave a verifiable EU-hosting statement in the extracts.

### Call copilots

**Cresta's Knowledge Agent** (March 2026) is the closest match to our prototype. It is browser-based, listens ambiently, reads on-screen CRM "Context Fields", and returns cited answers ([Cresta](https://cresta.com/blog/introducing-knowledge-agent-real-time-answers-right-where-agents-work)). **Google's Proactive Generative Knowledge Assist** reached V2 GA in June 2026. In September 2026 Google added an on-demand assistant alongside the proactive suggestions, which is the same hybrid as our "Help me now" button ([Google](https://cloud.google.com/agent-assist/docs/release-notes)).

## Independent phone tests put the leaders at 1.3–1.75 seconds

Vendor latency claims and what a caller actually hears differ by roughly a factor of two:

- **Vendor claims:** Retell says about 600 ms ([Retell](https://www.retellai.com/blog/best-voice-ai-providers)), Bland under 400 ms ([Bland](https://www.bland.ai/compare/bland-vs-retell)), Telnyx "sub-200 ms" ([Telnyx](https://telnyx.com/)) and Aircall under 800 ms ([Aircall](https://aircall.io/blog/tech/best-ai-voice-agent/)).
- **Independent measurement:** OpenBenchmarks ran the same agent script over real PSTN calls (2,078 usable turns) and measured time-to-first-audio-byte from the saved call audio ([OpenBenchmarks](https://openbenchmarks.com/voice-agent-latency/voice-agent-latency-comparison)). Results:

| Platform | Median TTFAB | p95 TTFAB | Tail ratio (p95 ÷ median) |
|---|---|---|---|
| Telnyx | 1,296 ms | not in extract | not in extract |
| ElevenLabs | 1,424 ms | 1,768 ms | 1.24× (tightest) |
| Bland | 1,520 ms | not in extract | 1.48× (widest) |
| Vapi | 1,558 ms | 2,008 ms | 1.29× |
| Retell | 1,740 ms | 2,259 ms | 1.30× |

A competing study cited by Telnyx reports Retell at 680 ms median. We could not read that study directly ([Telnyx](https://telnyx.com/resources/voice-ai-agents-compared-latency)). The two sources are measuring different things. The practical target for our build is **p50 under about 1.3 s and p95 under about 1.8 s on real PSTN calls**, which would match or beat the hosted leaders. The common design target of about 800 ms stays the stretch goal ([Twig](https://www.twig.so/blog/voice-ai-agents-latency-budget-800ms)).

**Our build has never been measured this way.** The researchers estimate 1.4–2.2 s voice-to-voice for our stack, built up from cited per-stage figures:

| Stage | Estimated time |
|---|---|
| Twilio leg and jitter buffer | 100–200 ms |
| Endpointing (our `minDelay`) | 550 ms |
| Azure STT finalization | 500–1,000+ ms |
| gpt-5.4-mini time to first token | 300–600 ms |
| Azure REST TTS first byte | 150–300 ms |

The biggest single item is probably not the LLM. In Pipecat's open STT benchmark, **Azure's median time from end of speech to final transcript is 1,016 ms (P99 1,791 ms)**. Deepgram Nova-3 takes 247 ms and Soniox about 250 ms, while Azure has the best semantic WER of the three ([Pipecat stt-benchmark](https://github.com/pipecat-ai/stt-benchmark)). That benchmark used English audio, so it says nothing certain about sv-SE. It is still the clearest signal of where to look first.

Several speed-ups are already in place:

- **Preemptive LLM generation** is on by default in agents-js 1.9.x ([agents-js](https://github.com/livekit/agents-js/blob/main/agents/src/voice/turn_config/preemptive_generation.ts)).
- **Reasoning effort** is set to `none` in our `agent.ts`.
- **Tools run in-process.** Webhook-style tools on hosted platforms add 200–600 ms per call, according to one practitioner test ([Amjid Ali](https://amjid.au/insights/retell-vs-vapi-vs-livekit-the-voice-ai-shootout/)).

Three levers are unused:

- **Prompt caching.** Azure OpenAI caches only when the first 1,024 tokens are identical ([Microsoft](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching)). Our Swedish system prompt puts `{{now_sv}}`, `{{office_open}}` and the transfer flag on line 4, ahead of the static FAQ and core facts, so the date and time on line 4 change the cached prefix on every call.
- **Pre-synthesized fixed phrases.** Our greeting, hold and goodbye lines are synthesized live on every call instead of being cached.
- **A "thinking" sound during tool calls.** agents-js offers one through `BackgroundAudioPlayer`'s `thinkingSound` ([agents-js](https://github.com/livekit/agents-js/blob/main/agents/src/voice/background_audio.ts)). We use that player only during transfer holds.

Switching to speech-to-speech would not help either. Under 15% of enterprise deployments are pure speech-to-speech ([Future AGI](https://futureagi.com/blog/cascaded-voice-ai-vs-speech-to-speech-2026/)). On LiveKit's turn-detection benchmark, GPT Realtime 2 needs 1,143 ms where LiveKit's detector needs 543 ms at the same error budget ([eot-bench](https://github.com/livekit/eot-bench)). Developers also report 3–7 s setup delays on OpenAI's SIP interface ([OpenAI community](https://community.openai.com/t/consistently-3-5s-sometimes-7s-invite-realtime-call-incoming-delay-on-sip-realtime-accept-is-1s-any-guidance/1366874)). Amazon's Nova 2 Sonic does not support Swedish at all ([AWS](https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-language-support.html)).

## Swedish quality is decided component by component

Hosted platforms resell the same third-party STT and TTS models, so none has an inherent Swedish advantage. The real Swedish gaps sit in the auxiliary models, and they hit everyone.

**Turn detection has no Swedish model anywhere:**

- LiveKit Turn Detector v1 covers 14 languages, without Swedish ([eot-bench](https://github.com/livekit/eot-bench)).
- Pipecat Smart Turn v3 covers 23 languages, including Danish, Norwegian and Finnish but not Swedish ([smart-turn](https://github.com/pipecat-ai/smart-turn)).
- Deepgram Flux Multilingual does not list Swedish ([Deepgram](https://developers.deepgram.com/changelog)).
- LiveKit's adaptive interruption model, which tells "mm" and "ja" apart from real barge-ins, runs only on LiveKit Cloud inference ([LiveKit](https://docs.livekit.io/agents/logic/turns/adaptive-interruption-handling/)).

A self-hosted Swedish build therefore relies on VAD timing plus endpointing. That makes correct VAD settings critical.

**Our VAD settings are not correct.** In agents-js 1.9.2, which we have installed, these durations are in milliseconds: Silero's default `minSilenceDuration` is 550 and interruption `minDuration` defaults to 500 ([interruption.ts](https://github.com/livekit/agents-js/blob/main/agents/src/voice/turn_config/interruption.ts); [silero vad.ts](https://github.com/livekit/agents-js/blob/main/plugins/silero/src/vad.ts)). Our `agent.ts` passes `minSilenceDuration: 0.45` (line 91) and `minDuration: 0.4` (line 135), which are **0.45 ms and 0.4 ms**. In practice:

- VAD ends a speech segment after the first silent window.
- Any VAD blip, such as line noise, a cough or a Swedish "mm", interrupts the agent.

The greeting that carries the AI and transcription disclosure is spoken with `allowInterruptions: true`, so this bug can also cut off the legally required notice.

**Swedish speech recognition has no head-to-head telephony benchmark.**

- The best open numbers come from KBLab: **KB-Whisper-large reaches 5.4 / 4.1 / 5.2 % WER on FLEURS / Common Voice / NST**, about 47% below Whisper-large-v3. It is a batch model, though, not a streaming one ([arXiv](https://arxiv.org/html/2505.17538v1)).
- Azure updated its Swedish STT model in August 2026 and added Swedish to post-stream refinement ([Microsoft](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/releasenotes)).
- Deepgram Nova-3 has a monolingual Swedish model and an EU endpoint at no extra cost ([Deepgram](https://deepgram.com/learn/deepgram-expands-nova-3-with-german-dutch-swedish-and-danish-support); [Deepgram](https://deepgram.com/learn/deepgram-eu-endpoint-now-generally-available)).
- AssemblyAI reports 6.6% Swedish FLEURS WER for Universal-3.6 Pro. This is a vendor figure ([AssemblyAI](https://www.assemblyai.com/benchmarks)).

None of these figures was measured on 8 kHz phone audio. The only reliable test is an A/B on the firm's own recorded calls. Our Azure STT configuration also sets no `phraseList`, although the LiveKit Azure plugin supports one ([agents-js](https://github.com/livekit/agents-js/blob/main/plugins/azure/src/stt.ts)). Staff names, "Hägglund", "moms", "K10" and "årsredovisning" are exactly the terms a phrase list rescues.

**Swedish TTS has more upgrade candidates than Azure:**

- **Azure:** offers only standard neural sv-SE voices (Sofie, Mattias, Hillevi), with no sv-SE HD voice ([Microsoft](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices)).
- **Google Chirp 3 HD:** sv-SE has been GA since July 2025, with an EU endpoint and μ-law output. It does **not** support custom pronunciations in sv-SE ([Google](https://docs.cloud.google.com/text-to-speech/docs/release-notes)).
- **Cartesia Sonic 3.6:** supports Swedish ([Cartesia](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest)).
- **ElevenLabs:** markets Swedish with regional accents ([ElevenLabs](https://elevenlabs.io/text-to-speech/swedish)).

No independent Swedish naturalness (MOS) test exists, so a blind listening test with native speakers is the only fair comparison.

**Swedish number and date reading is a gap even for platforms.** Retell's speech normalization supports only English, Spanish, French and German, according to a community answer ([Retell community](https://community.retellai.com/t/how-to-configure-stable-multilingual-agents-it-en-es-fr-de-with-2-3-languages-per-agent/2214)). Doing that normalization in our own code is therefore a real differentiator.

**No current benchmark ranks GPT-5.x, Claude or Gemini in Swedish.** The latest retrievable EuroEval (formerly ScandEval) data is from 2024–2025 ([arXiv](https://arxiv.org/pdf/2505.02410)). An A/B test of real transcripts, scored by native speakers, beats any leaderboard for choosing the model.

## Compliance has hardened: Article 50 is live and auditors carry an extra duty

**The disclosure duty is already in force.** The EU AI Act's Article 50 duty to tell people they are talking to an AI has applied since **2 August 2026**. The Digital Omnibus (Regulation (EU) 2026/1744) postponed only the high-risk deadlines and a narrow marking grace period ([Usercentrics](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/); [ActuIA](https://www.actuia.com/en/news/ai-act-obligations-in-force-and-delays-under-omnibus-2026-1744/)). Breaches carry fines of **up to €15M or 3% of worldwide turnover** ([Cookiebot](https://www.cookiebot.com/en/eu-ai-act-article-50-transparency-compliance/)). PolyAI ships "AI identity" as one of five default guardrails ([PolyAI](https://docs.poly.ai/releases/overview)). Our greeting states the disclosure correctly, but it can be interrupted.

**Recording and transcription are lawful under GDPR conditions.** Recording a call you take part in is not a crime in Sweden. GDPR still requires a legal basis, notice, retention limits and a DPA with every processor ([Telink](https://telink.se/funktioner/vad-sager-lagen-om-samtalsinspelning/)). IMY's 2026 sandbox report accepted AI transcription with human control and short retention. It also found that summaries which only compress a conversation are not automated decision-making ([IMY](https://www.imy.se/globalassets/dokument/rapporter/transkribering-inom-socialtjansten.pdf)). Our 30-day retention policy fits that model.

**Auditors carry an extra confidentiality duty.** Under **26 § revisorslagen**, FAR said in April 2026 that the provision creates "great uncertainty" about using client data in external digital and AI tools. FAR has asked the government to review the provision ([FAR](https://www.far.se/aktuellt/nyheter/2026/april/revisorslagen-hammar-utvecklingen-av-digitala-verktyg/)). This makes Svaria's flagship feature, reading case status aloud to a caller, legally risky without strong verification. It also bears directly on the copilot, which by design transcribes client advice conversations.

**EU residency is where competitors are weakest.** Aircall's US subprocessors, Retell's US-only processing and Synthflow's admission that Twilio lacks EU data residency for messaging ([CloudTalk](https://www.cloudtalk.io/blog/synthflow-ai-review/)) all leave an opening that our build fills, with Azure Sweden Central for speech and the EU Data Zone for the LLM. Twilio is our own residency weak point. **46elks**, a Stockholm carrier, routes calls to SIP at 0 öre/min ([46elks](https://46elks.se/pricing/sweden)). Whether 46elks passes the original caller ID on forwarded calls is unconfirmed.

**Callers' preferences reinforce the case for fast human handoff:**

- 53% of Swedes prefer phone support ([EY](https://www.ey.com/sv_se/newsroom/2026/01/fyra-av-tio-unga-foredrar-ai-nar-de-soker-och-jamfor)).
- Only 6% of 18–34-year-olds prefer AI for invoice and payment questions ([Dagens Teknik](https://www.dagensteknik.se/svenskarna-frustrerade-pa-kundtjanst-men-ai-chatbotar-far-inget-fortroende/)).

Substantive tax matters should therefore go to a human quickly.

## Prices span 300 kronor to six figures, while per-minute costs are cents

| Category | Representative price points (as indexed, 2026) |
|---|---|
| US SMB receptionists | Smith.ai AI $150/75 calls ([Smith.ai](https://smith.ai/pricing/ai-receptionist)); Rosie $49/250 min ([Rosie](https://heyrosie.com/pricing)); RingCentral AIR $49/100 min, EU from €38 ([RingCentral](https://www.ringcentral.com/air.html)); Aircall $0.49/min PAYG ([Aircall](https://aircall.io/products/ai/voice-agent/)); Nextiva $99/100 conversations ([Nextiva](https://www.nextiva.com/products/ai-receptionist)) |
| Swedish SMB receptionists | Tele2 1,599 kr/mo; Telink from 499 kr/mo; Menodi 795–1,895 kr ([Menodi](https://menodi.se/ai-receptionist)); TechTell 999–3,999 kr ([TechTell](https://techtell.se/ai-receptionist)); Skaala from 299 kr/50 min ([Vibeforge](https://vibeforge.se/ai-telefonist-jamforelse)); market band 800–2,000 kr plus 15–35 kr/call at some vendors ([svarstjanster.se](https://svarstjanster.se/ai-receptionist/)) |
| Developer platforms | Platform fees $0.01–0.08/min: LiveKit $0.01, Telnyx $0.05, Retell from $0.07, ElevenLabs $0.08 ([LiveKit](https://livekit.com/pricing); [Telnyx](https://telnyx.com/pricing/conversational-ai); [ElevenLabs](https://elevenlabs.io/pricing/agents)); invoiced all-in $0.05–0.14/min in OpenBenchmarks ([OpenBenchmarks](https://openbenchmarks.com/voice-agent-latency/voice-agent-end-to-end-latency)) |
| Enterprise | Sierra about $150k/yr platform fee plus per-resolution charges ([Coworker.ai](https://coworker.ai/blog/sierra-ai-pricing)); Decagon median about $400k/yr from thin data ([getmacha](https://www.getmacha.com/blog/decagon-ai-pricing-explained)); Amazon Connect $0.038/min ([AWS](https://aws.amazon.com/products/connect/customer/pricing/appendix/)) |
| Agent assist | Google Agent Assist voice $0.03/min ([Google](https://cloud.google.com/agent-assist/pricing)); Cresta $150k/yr for 100k calls ([AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-lmdwown6xoo6q)) |

For a firm taking a few hundred calls a month, per-minute model and carrier costs come to tens of euros. **Self-hosting is justified by data control, confidentiality and integration depth, not by cost.** The operator alternative is the comparison the partners will hear: Tele2 at about 1,600 kr/month, or Telink at 499 kr on top of a PBX.

SMB vendors increasingly do not bill for junk calls:

- Quo does not bill calls under 15 seconds ([Quo](https://www.quo.com/sona)).
- Nextiva does not bill calls under 30 seconds.
- Smith.ai auto-blocks more than 20M spam numbers ([Smith.ai](https://smith.ai/ai-receptionist)).

For an internal build, the equivalent is to filter spam and silent calls before they consume STT and LLM minutes or create Teams messages.

## Leaders constrain the LLM with procedures, code gates and simulated callers

Every leading vendor has converged on the same reliability pattern: the LLM converses, and code decides. Each layer below has a direct equivalent for our receptionist.

**Defense in depth (Sierra).** "A supervisor agent screens the input. Another supervisor reviews the proposed response. A deterministic guard scans the output for sensitive data" ([Sierra](https://sierra.ai/blog/defense-in-depth-in-the-age-of-agents)). Sierra's deterministic guards are "non-model checks that can't be talked out of doing their job". For example, account-changing tools are not even available until the caller is authenticated. Sierra's SDK can bypass the LLM entirely where fixed wording is required ([Sierra](https://sierra.ai/blog/meet-the-ai-agent-engineer)).

**Named guardrails (PolyAI).** PolyAI ships five: jailbreak defence, scope and hallucination control, AI identity, emergency escalation and tool-call integrity ([PolyAI](https://docs.poly.ai/behavior/introduction)). Tool-call integrity targets a specific failure: the agent says a booking succeeded when the tool never ran ([PolyAI](https://poly.ai/blog/ai-agent-hallucinations-guardrails)).

**Transfer guardrails (Five9).** Five9 lets agents escalate only after they have completed their assigned objectives, and logs every transfer for traceability ([Five9](https://www.five9.com/news/news-releases/five9-launches-breakthrough-new-release-voice-ai-agents-power-next-generation)).

**Procedure layers.** Decagon AOPs, Sierra Journeys, Google Flows plus Playbooks, Retell Conversation Flow and Bland Pathways all write each call type as an explicit procedure with exit conditions ([Decagon](https://decagon.ai/blog/why-we-built-decagon-duet-on-agent-operating-procedures); [Google](https://docs.cloud.google.com/customer-engagement-ai/conversational-agents/ps)).

**Where our build stands.** It already validates tool arguments with Zod schemas. It keys transfer targets to a staff allow-list (`staffId` from `resolve_staff`), which is the OWASP-recommended least-privilege defence against spoken injection such as "transfer me to the CEO's mobile" ([OWASP](https://github.com/OWASP/www-project-top-10-for-large-language-model-applications/blob/main/2_0_vulns/LLM01_PromptInjection.md)). What it lacks:

- a second-pass check on drafted replies for tax or legal advice
- confirmations generated from tool results rather than by the model

**Testing is simulation-first everywhere.** Sierra pairs a simulated user, the agent under test and an LLM judge, and runs each scenario several times because the output is non-deterministic. Its "Voice Sims" add noise and interruptions ([Sierra](https://sierra.ai/blog/agent-development-life-cycle)). NiCE's Cognigy Simulator (January 2026) generates scenarios from real transcripts and mocks third-party APIs ([BusinessWire](https://www.businesswire.com/news/home/20260115626600/en/nice-cognigy-unveils-simulator-an-ai-performance-lab-to-enable-enterprise-scale-evaluation-of-production-grade-ai-agents)). Vapi, Retell, ElevenLabs and LiveKit all ship simulated-caller or behavioural tests ([Retell](https://docs.retellai.com/test/batch-test-simulation); [ElevenLabs](https://elevenlabs.io/docs/eleven-agents/customization/agent-testing)). agents-js includes `voice.testing` helpers: `session.run()`, `isFunctionCall()`, and `judge(llm, {intent})` for LLM-judged checks ([agents-js](https://github.com/livekit/agents-js/blob/main/agents/src/voice/testing/run_result.ts)). **Our repository contains no agent tests.** After launch, NICE scores 100% of interactions automatically instead of the usual 2–5% manual sample ([NICE](https://www.nice.com/resources/cxone-mpower-autopilot-knowledge-product-video)). LLM judges still need calibration against human review ([arXiv](https://arxiv.org/pdf/2608.24314)).

**Conversation-design practice is consistent across sources:**

- **Readback:** read critical data back character by character and get confirmation, with a phonetic disambiguator for letters ([OpenAI cookbook](https://github.com/openai/openai-cookbook/blob/main/examples/Realtime_prompting_guide.ipynb)).
- **Prompt rules:** pin the output language, add a rule against repetitive phrasing, and say short tool-call preambles so lookups never produce dead air (same source).
- **Handoff packet:** pass a structured record with verified identity, intent, actions taken, escalation reason and a two-sentence summary ([Telnyx](https://telnyx.com/resources/ai-to-human-handoff-voice-ai)). Fall back to a confirmed callback when nobody answers ([Murf](https://murf.ai/blog/ai-to-human-handoff)).
- **Explicit escalation rules:** escalate on defined conditions, not "when confused" ([LeadLock](https://www.leadlock.ai/blog/best-practices-for-setting-up-ai-voice-agents-with-call-forwarding/)).

SMB vendors add cheap features that callers notice:

- Rosie's "waterfall" transfers try person A, then person B ([Rosie](https://heyrosie.com/pricing)).
- Quo texts a booking link before the call ends ([Quo](https://www.quo.com/product/ai/receptionist)).
- Goodcall offers a callback or a self-service link when a transfer fails ([Goodcall](https://www.goodcall.com/)).
- Ringflow, JustCall and Upfirst greet known callers using caller ID ([Ringflow](https://www.ringflow.com/features/ai-receptionist/); [Upfirst](https://upfirst.ai/blog/best-ai-answering-services)).

**Measure correct routing, not containment.** "Containment" and "resolution" are defined differently by every vendor. Credible voice containment sits around 44–67%: PODS on Five9 reached 44% and PG&E on PolyAI 67% ([CMSWire](https://www.cmswire.com/contact-center/five9-debuts-agentic-voice-ai-agents-for-contact-centers/); [PolyAI](https://poly.ai/case-studies/pge/)). In an accounting firm, many calls legitimately need a consultant. The right headline metric is the share of calls routed correctly with complete message fields. A correct escalation counts as a success, not a failure.

## Copilots that work ground answers in curated sources and know who is speaking

**Speaker separation.** Enterprise agent-assist products separate speakers by audio channel, usually CCaaS stereo or a softphone tap, rather than by acoustic diarization of one microphone. Balto requires softphone and headset audio ([Balto](https://www.balto.ai/minimum-system-requirements/)). Google triggers on the customer's messages by default ([Google](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/pgka)). Dialpad cards can be scoped to fire on the rep, the customer or both ([Dialpad](https://help.dialpad.com/hc/en-us/articles/55071217349659-Custom-Moments)). Our prototype's speakerphone feeding Chrome Web Speech produces one mixed channel with no speaker labels. It therefore cannot reliably tell whether the client or the advisor asked a question, and that is the main source of irrelevant cards. A streaming ASR with diarization is one fix: AssemblyAI labels speakers on each turn in about 221 ms and also separates multichannel input ([AssemblyAI](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels)).

**Grounding is the norm, and an ungrounded fast answer is the exception.** No enterprise vendor found markets one:

- Cresta answers with citations ([Cresta](https://cresta.com/blog/introducing-knowledge-agent-real-time-answers-right-where-agents-work)).
- Google returns document metadata with each answer and logs whether the answer was displayed, clicked or copied, a correctness level, and which source links were clicked ([Google](https://docs.cloud.google.com/agent-assist/docs/generative-knowledge-assist)).
- Microsoft grounds Copilot on "trusted knowledge sources" ([Microsoft](https://blogs.microsoft.com/blog/2024/06/04/announcing-dynamics-365-contact-center-a-copilot-first-cloud-contact-center-to-transform-service-experiences/)).
- Intuit pairs a deterministic tax engine with an LLM that writes the explanation ([Intuit](https://www.intuit.com/blog/innovative-thinking/tech-innovation/how-intuit-transformed-tax-filing-experiences/)).
- Financial-services guidance puts it bluntly: "The guardrail has to live in the architecture, not the prompt" ([fin.ai](https://fin.ai/learn/evaluate-ai-agent-compliance-financial-services)).

The risk is specific. A Haiku answer that misstates a threshold or a deadline, read aloud by an advisor within one second, is exactly the automation bias IMY flagged ([Lynes](https://lynes.io/en/blog/recording-calls-gdpr)).

**Latency comes from pre-indexing, not faster web search.** Vendors claim card latencies of 200 ms to 1.2 s, all unverified ([Crescendo](https://www.crescendo.ai/blog/best-real-time-agent-assistance); [Retell](https://www.retellai.com/blog/best-contact-center-ai-solutions)). They reach those speeds by retrieving from a pre-indexed, approved knowledge base, not live web search. Our 3–5 s sourced tier is slow mainly because it searches the web at question time. The reference pattern is "only act on finalized turns": partial transcripts update the screen but never trigger the LLM ([AssemblyAI](https://www.assemblyai.com/blog/build-real-time-agent-assist)). Google recommends tuning triggers against a "golden set" of 20–30 real examples ([Google](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/pgka-bp)). Even Cresta draws G2 complaints that its detected questions "are not relevant" ([eesel](https://www.eesel.ai/blog/cresta-review)).

**The payoff is real but modest, and it goes mostly to juniors.** The only rigorous evidence is the QJE 2025 study of 5,172 support agents: about **+15% resolutions per hour**, with the largest gains for less-experienced agents ([QJE](https://academic.oup.com/qje/article-pdf/140/2/889/61701561/qjae044.pdf)). Vendor AHT claims of 8–23% lack control groups. A pilot should therefore measure questions answered on the call, follow-ups avoided and junior ramp time, against matched advisors who work without the copilot.

**Compliance shapes the copilot more than the receptionist.**

- **No emotion scoring of advisors.** The AI Act has banned emotion recognition of *workers* since February 2025, and a call-centre example is explicitly prohibited. Customer-side signals are out of scope ([Covington](https://www.insideprivacy.com/artificial-intelligence/european-commission-guidelines-on-prohibited-ai-practices-under-the-eu-artificial-intelligence-act/)).
- **Ephemeral by default.** Teams Copilot's "only during the call" mode keeps no transcript afterwards ([Microsoft](https://learn.microsoft.com/en-us/microsoftteams/copilot-teams-calling-transcription)). That is the right default for confidential advice calls.
- **Processors outside the EU.** The researchers flag Chrome's Web Speech backend and the Anthropic API as non-EU processors whose transfer mechanisms need checking. This is an inference that needs verification. Combined with 26 § revisorslagen, it is the copilot's largest open issue.

## Prioritized improvements for the receptionist

Effort: **S** is about a day or less, **M** is days to a week, **L** is multiple weeks. Risk describes what can go wrong while making the change.

| # | What to do | Why (evidence) | Who does it | Effort | Risk |
|---|---|---|---|---|---|
| 1 | Fix the unit bug: Silero `minSilenceDuration: 0.45` to 450–550, and interruption `minDuration: 0.4` to 400–600 (`agent/src/agent.ts` lines 91 and 135). | agents-js 1.9.2 uses milliseconds; the current values are 0.45 ms and 0.4 ms, so VAD chops segments and any noise or "mm" interrupts the agent ([interruption.ts](https://github.com/livekit/agents-js/blob/main/agents/src/voice/turn_config/interruption.ts); [silero vad.ts](https://github.com/livekit/agents-js/blob/main/plugins/silero/src/vad.ts)) | Every hosted platform ships tuned defaults; LiveKit's own defaults are 550 and 500 | S | Low. Re-tune endpointing afterwards, because turns will feel slightly slower once false interrupts stop. |
| 2 | Make the AI and transcription disclosure uninterruptible and pre-synthesized. Split the greeting: a short fixed disclosure sentence with `allowInterruptions: false`, then an interruptible "Hur kan jag hjälpa dig?". Cache greeting, hold, transfer and goodbye audio at worker start. | Art. 50 in force since 2 Aug 2026, fines up to €15M or 3% ([Usercentrics](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/); [Cookiebot](https://www.cookiebot.com/en/eu-ai-act-article-50-transparency-compliance/)); fixed wording via LLM bypass ([Sierra](https://sierra.ai/blog/meet-the-ai-agent-engineer)) | PolyAI "AI identity" default guardrail; Sierra fixed wording | S | Low. A long uninterruptible intro annoys repeat callers, so keep the fixed part under about 4 seconds. |
| 3 | Measure latency like OpenBenchmarks: TTFAB p50/p95 from recorded PSTN audio, plus per-stage OTel (`lk.end_of_turn_delay`, LLM TTFT, TTS first byte) with `allowPii: false`. Alert on p95 above 1.5 s. Targets: p50 under 1.3 s, p95 under 1.8 s. | No measurement exists today; independent leaders sit at 1.3–1.75 s median ([OpenBenchmarks](https://openbenchmarks.com/voice-agent-latency/voice-agent-latency-comparison)); agents-js traces these stages ([CHANGELOG](https://github.com/livekit/agents-js/blob/main/agents/CHANGELOG.md)) | LiveKit Agent Insights, Retell and Vapi analytics; public OpenBenchmarks harness | S–M | Low. Telemetry must not leak transcript content; disable GenAI content capture. |
| 4 | Restructure the prompt for caching: move `{{now_sv}}`, `{{office_open}}`, `{{transfer_possible}}`, holiday and caller lines to the end, after the static rules, core facts and KB, so the first 1,024+ tokens never change. Keep Azure OpenAI and Speech co-located. | Azure caches only identical first-1,024-token prefixes ([Microsoft](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/prompt-caching)); one case study cut TTFT from 2.4 s to 1.3 s with a high cached share ([Tech Community mirror](https://app-pack.telkomuniversity.ac.id/?p=462339)) | Standard practice in Azure and OpenAI guidance | S | Low. Verify that the gpt-5.4-mini EU Data Zone deployment reports cached tokens. |
| 5 | Attack STT finalization. A/B on Swedish calls: Azure `segmentationSilenceTimeoutMs` 300–500 versus `segmentationStrategy: "Semantic"`, and `endpointing.mode: 'dynamic'`. In parallel, test Deepgram Nova-3 `sv` on its EU endpoint against Azure on the firm's own 8 kHz recordings. | Azure median TTFS 1,016 ms vs Deepgram 247 ms, English audio ([Pipecat](https://github.com/pipecat-ai/stt-benchmark)); Deepgram EU endpoint at no extra cost ([Deepgram](https://deepgram.com/learn/deepgram-eu-endpoint-now-generally-available)) | Hosted leaders pick the fastest-finalizing STT per language | M | Medium. Shorter timeouts cut callers off mid-sentence, and Swedish speakers pause inside long organisation numbers. Semantic support for sv-SE is undocumented. |
| 6 | Add an Azure `phraseList` (staff names, "Hägglund", "Revisionskonsulterna", moms, deklaration, K10, bokslut, årsredovisning, Skatteverket). Normalize Swedish phone numbers, dates, times, amounts and organisation numbers in code via `ttsTextTransforms` or SSML `say-as` before TTS. | Our STT sets no phrase list, though the plugin supports one ([agents-js azure](https://github.com/livekit/agents-js/blob/main/plugins/azure/src/stt.ts)); Retell's normalization covers EN/ES/FR/DE only ([Retell community](https://community.retellai.com/t/how-to-configure-stable-multilingual-agents-it-en-es-fr-de-with-2-3-languages-per-agent/2214)) | agents-js keyterm biasing for Deepgram and AssemblyAI | M | Low. Over-long phrase lists can bias recognition toward the listed words, so keep the list to proper nouns and domain terms. |
| 7 | Readback protocol in the prompt: read back callback numbers in Swedish digit groups and spell names, emails and organisation numbers with the Swedish spelling alphabet (accept NATO words from English speakers), with explicit confirmation and re-confirmation after corrections. State dates with the weekday. | Character-by-character confirmation prevents mishearing ([OpenAI cookbook](https://github.com/openai/openai-cookbook/blob/main/examples/Realtime_prompting_guide.ipynb)) | OpenAI guidance; standard in enterprise voice design | S | Low. Adds about 5–10 s per message, which is acceptable for callback data. |
| 8 | Ground confirmations in tool results and add a cheap supervisor check. Template "Jag har bokat…" and "Ditt meddelande är skickat…" from the tool's return value, never free text. Run a second-pass classifier on drafted replies for tax or legal advice and for disclosure of client or staff data. | Tool-call integrity failure mode ([PolyAI](https://poly.ai/blog/ai-agent-hallucinations-guardrails)); supervisors plus deterministic guards ([Sierra](https://sierra.ai/blog/defense-in-depth-in-the-age-of-agents)) | Sierra, PolyAI, Five9 | M | Medium. A synchronous supervisor adds latency, so run it only on substantive replies, or in parallel with TTS of a neutral lead-in. |
| 9 | Build a Swedish/English regression suite. Use agents-js `voice.testing` with an LLM judge for logic: booking, message-taking, transfer refusal to the main number, tax-advice requests, prompt injection, language switching. Add audio simulations for dialects, noise, spelled names and "mm/ja" backchannels. Run each scenario several times and gate deploys. Auto-score 100% of transcripts after launch with the same rubric. | Simulation plus LLM judge is table stakes ([Sierra](https://sierra.ai/blog/agent-development-life-cycle); [Cognigy](https://www.businesswire.com/news/home/20260115626600/en/nice-cognigy-unveils-simulator-an-ai-performance-lab-to-enable-enterprise-scale-evaluation-of-production-grade-ai-agents)); agents-js testing helpers ([agents-js](https://github.com/livekit/agents-js/blob/main/agents/src/voice/testing/run_result.ts)) | Sierra, Decagon, Parloa, Cognigy, Vapi, Retell, ElevenLabs | M–L | Low. LLM judges need calibration against human review ([arXiv](https://arxiv.org/pdf/2608.24314)). |
| 10 | Close the barge-in gap that Swedish creates: `minWords: 2`, `falseInterruptionTimeout` 1,500–2,000 ms with `resumeFalseInterruption: true`, plus telephony noise suppression (Krisp on the trunk, or BVCTelephony if usable outside LiveKit Cloud; never both). | No Swedish turn or backchannel model exists, and adaptive interruption is Cloud-only ([LiveKit](https://docs.livekit.io/agents/logic/turns/adaptive-interruption-handling/)); hosted platforms default to Krisp ([Vapi](https://docs.vapi.ai/documentation/assistants/conversation-behavior/background-speech-denoising)) | Vapi, Pipecat Cloud (Krisp VIVA), LiveKit Cloud | M | Medium. The self-hosted availability of BVCTelephony and Krisp licensing are unverified, and `minWords` depends on Azure interim results. |
| 11 | Remove dead air during Graph lookups: enable `BackgroundAudioPlayer` `thinkingSound` (low-volume keyboard clip) and a spoken preamble ("Jag kollar kalendern…") before `check_availability` and `book_meeting`. | agents-js supports it ([background_audio.ts](https://github.com/livekit/agents-js/blob/main/agents/src/voice/background_audio.ts)); OpenAI recommends tool preambles ([OpenAI cookbook](https://github.com/openai/openai-cookbook/blob/main/examples/Realtime_prompting_guide.ipynb)) | ElevenLabs filler phrases; Famulor and Telnyx handoff guides | S | Low. Fillers repeated too often sound robotic, so vary them. |
| 12 | Structured accountant message schema and intent tags: organisation number, entity type, topic (moms, deklaration, bokslut, lön, revision), deadline urgency, verified flag, preferred callback window, E.164 number. Validate against a JSON schema and include the fields in Teams cards. | Smith.ai's accounting qualification fields ([Smith.ai](https://smith.ai/blog/ai-answering-service-for-accountants)); structured handoff payload ([Telnyx](https://telnyx.com/resources/ai-to-human-handoff-voice-ai)); Zendesk intent tagging ([Zendesk](https://support.zendesk.com/hc/en-us/articles/11183058023450-Announcing-the-general-availability-of-voice-AI-agents)) | Smith.ai, Zendesk, Five9 | S–M | Low. Collecting more fields lengthens calls, so make only name and number mandatory. |
| 13 | Transfer fallbacks and caller ID: add a waterfall (named consultant, then team colleague, then message plus offered callback slot). Evaluate porting caller-ID preservation and abort semantics from agents-js `TwilioConnectorWarmTransferTask` into our `transfer.ts`. | Waterfall and backup transfers ([Rosie](https://heyrosie.com/pricing); [Goodcall](https://www.goodcall.com/)); `WarmTransferTask` preserves the inbound caller ID and handles caller hang-up ([CHANGELOG](https://github.com/livekit/agents-js/blob/main/agents/CHANGELOG.md)) | Rosie, Goodcall, LiveKit, Retell (SIP DIAL with the caller's number) | M | Medium. Do not replace a working custom transfer wholesale; port features. Swedish outbound caller ID on Twilio is "not guaranteed" ([Twilio](https://www.twilio.com/en-us/guidelines/se/voice)). |
| 14 | Write down the 26 § revisorslagen position: the AI never confirms a client relationship, case status or deadlines specific to a client; caller ID alone never unlocks anything; document DPAs for Microsoft and Twilio. Evaluate 46elks as an EU carrier. | FAR's April 2026 warning ([FAR](https://www.far.se/aktuellt/nyheter/2026/april/revisorslagen-hammar-utvecklingen-av-digitala-verktyg/)); Twilio lacks EU residency for messaging ([CloudTalk](https://www.cloudtalk.io/blog/synthflow-ai-review/)); 46elks routes to SIP at 0 öre/min ([46elks](https://46elks.se/pricing/sweden)) | Nobody in the Swedish market shows evidence of handling this, which makes it a differentiator | M (policy); L (carrier) | Medium. Number porting takes 4–6 weeks ([Twilio](https://www.twilio.com/en-us/guidelines/se/porting)); 46elks caller-ID passthrough is unverified. |
| 15 | Send SMS follow-ups after the call: booking confirmation with a calendar link and a document-upload or portal link. Later, greet known numbers by name, but only as a convenience, never as identification. | Quo texts booking links mid-call ([Quo](https://www.quo.com/product/ai/receptionist)); RingCentral AIR sends SMS follow-ups ([RingCentral](https://www.ringcentral.com/us/en/blog/ai-receptionist-texts-call-queues-integrations/)); returning-caller recognition ([Upfirst](https://upfirst.ai/blog/best-ai-answering-services)) | Quo, RingCentral, Goodcall, Ringflow, JustCall | M | Medium. Caller ID can be spoofed; greeting by name partially discloses the client relationship, which touches 26 §. Swedish SMS sender rules were not researched. |
| 16 | Blind native-speaker TTS test: Azure Sofie and Mattias vs Google Chirp 3 HD sv-SE (EU endpoint) vs Cartesia Sonic 3.6 and ElevenLabs. Separately, request 8 kHz or 16 kHz raw PCM from Azure TTS instead of 24 kHz to cut bytes and resampling. | No sv-SE HD voice on Azure ([Microsoft](https://learn.microsoft.com/en-us/azure/ai-services/speech-service/high-definition-voices)); Chirp 3 HD sv-SE is GA but lacks custom pronunciation ([Google](https://docs.cloud.google.com/text-to-speech/docs/release-notes)) | Aircall, Twilio ConversationRelay and Cognigy use ElevenLabs, Google or Polly for sv-SE | M | Medium. Switching loses Azure SSML phoneme control for names, and EU residency of Cartesia and ElevenLabs must be confirmed. |

Two things are deliberately left off the list. **Do not move to speech-to-speech**: it lacks Swedish coverage, has slower turn detection on independent tests, and the SIP reliability reports are poor (section 2). **Do not chase containment**: the success metric should be correctly routed calls with complete messages.

## Prioritized improvements for the call copilot

| # | What to do | Why (evidence) | Who does it | Effort | Risk |
|---|---|---|---|---|---|
| 1 | Resolve the processing-location question before any client pilot. Replace Chrome Web Speech with Azure Speech sv-SE in Sweden Central, which the receptionist already uses. Route the LLM through an EU-processed endpoint, or confirm an EU transfer basis and a DPA for the Anthropic API. Announce transcription at the start of every call. Default to no audio retention and short transcript retention. | 26 § revisorslagen uncertainty ([FAR](https://www.far.se/aktuellt/nyheter/2026/april/revisorslagen-hammar-utvecklingen-av-digitala-verktyg/)); the controller remains responsible ([Qualtranscribe](https://www.qualtranscribe.com/blog/eu-ai-act-ai-transcription-researchers)); ephemeral model ([Microsoft Teams](https://learn.microsoft.com/en-us/microsoftteams/copilot-teams-calling-transcription)) | Teams Copilot "only during the call"; tl;dv EU hosting | M | High if skipped. Confidential advice content leaves the firm's control. Switching models may change answer quality, so re-evaluate on the golden set. |
| 2 | Ground or demote the quick tier. Minimum: a persistent "Ovarifierat AI-utkast" label, muted styling, and automatic strike-through when the sourced answer disagrees. Better: answer the quick tier only from a cached set of Skatteverket pages plus a curated, versioned table of rates, thresholds and deadlines, so the LLM never generates figures. | No enterprise vendor markets ungrounded fast answers ([Cresta](https://cresta.com/blog/introducing-knowledge-agent-real-time-answers-right-where-agents-work); [Google](https://docs.cloud.google.com/agent-assist/docs/generative-knowledge-assist)); a deterministic engine plus an LLM for explanation ([Intuit](https://www.intuit.com/blog/innovative-thinking/tech-innovation/how-intuit-transformed-tax-filing-experiences/)); IMY flags automation bias ([Lynes](https://lynes.io/en/blog/recording-calls-gdpr)) | Cresta, Google, NICE, Intuit | M | Medium. The curated table needs an owner and a yearly update before each tax year. |
| 3 | Pre-index approved sources (Skatteverket, skat.dk, plus the firm's own guidance) for local retrieval, so sourced answers arrive in about 1–2 s. Keep domain-restricted web search as a fallback. Show the exact URL and the page's tax year or last-updated date on every card. | Vendors' speed comes from pre-indexed KBs; Google returns source metadata with answers ([Google](https://docs.cloud.google.com/agent-assist/docs/generative-knowledge-assist)) | Cresta (SharePoint, PDF and web connectors), Google, NICE | M–L | Medium. A stale index is worse than live search, so schedule re-crawls and display the crawl date. |
| 4 | Trigger hygiene: call the LLM only on finalized utterances, add a cheap domain-relevance gate (tax and accounting only), suppress cards with no grounded source, de-duplicate repeated questions, and tune against a 20–30-example golden set from real calls. | "Only act on finalized turns" ([AssemblyAI](https://www.assemblyai.com/blog/build-real-time-agent-assist)); golden-set guidance ([Google](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/pgka-bp)); irrelevant-trigger complaints even at Cresta ([eesel](https://www.eesel.ai/blog/cresta-review)); alert fatigue in analogous fields ([PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6401673/)) | Google PGKA, Dialpad, AssemblyAI reference design | S–M | Low. Over-filtering hides useful cards; "Help me now" remains the manual override. |
| 5 | Separate speakers. Short term: an advisor headset plus line capture on separate channels, or a streaming ASR with diarization. Long term: a softphone or Teams tap that exposes both legs. Then trigger only on the client's speech. | Enterprise products separate speakers by channel ([Balto](https://www.balto.ai/minimum-system-requirements/); [Google](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/pgka)); AssemblyAI diarized turns in about 221 ms ([AssemblyAI](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels)) | Balto, Google, Dialpad, Cresta | L | Medium. Requires telephony or Teams integration work. A diarization vendor adds another processor to the DPA chain. |
| 6 | Log feedback and keep an audit trail: record each card shown, its sources, and the advisor's action (expanded, copied, source clicked, thumbs up or down). Report acceptance rate and expert-reviewed error rate. Pilot against matched advisors working without the copilot. | Google's `answerFeedback` model ([Google](https://docs.cloud.google.com/agent-assist/docs/generative-knowledge-assist)); +15% productivity, largest for novices ([QJE](https://academic.oup.com/qje/article-pdf/140/2/889/61701561/qjae044.pdf)) | Google, Cresta | S–M | Low. Logs are personal data; apply the same retention policy. |
| 7 | UX refinements: one primary card with the key number first, plus 1–2 "related question" chips; a hotkey for "Help me now" and a "mark moment" hotkey; client context fields (entity type, VAT registration, fiscal year) to sharpen queries; an after-call summary drafted for the client file. | Google's primary plus alternative queries ([Google](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/pgka)); Cresta Context Fields ([CX Today](https://www.cxtoday.com/ai-automation-in-cx/cresta-launches-knowledge-agent-to-reduce-agent-tab-switching/)); Fathom hotkey highlights ([tl;dv](https://tldv.io/blog/fireflies-vs-fathom/)) | Google, Cresta, Fathom, NICE, Salesforce | M | Low. |
| 8 | Instrument per-stage latency (ASR final, quick card, sourced card) at p50 and p95, and track cost per call against Google's $0.03/min reference. | No vendor publishes audited card latency; P95 alerting is recommended ([AssemblyAI](https://www.assemblyai.com/blog/build-real-time-agent-assist)); price reference ([Google](https://cloud.google.com/agent-assist/pricing)) | AssemblyAI reference design, Google | S | Low. |
| 9 | Policy guardrail: never add advisor tone, emotion or behaviour scoring; client-side signals only. | Workplace emotion recognition has been banned since Feb 2025 ([Covington](https://www.insideprivacy.com/artificial-intelligence/european-commission-guidelines-on-prohibited-ai-practices-under-the-eu-artificial-intelligence-act/)) | Cogito/Verint sell exactly this, so do not copy them | S | Low, provided the feature is never built. |

## Figures that need verification before reuse

All vendor figures come from search extracts. The table lists the ones that are conflicting, single-sourced or load-bearing for decisions.

| Claim | Why it needs checking |
|---|---|
| OpenBenchmarks TTFAB (Telnyx 1,296 ms … Retell 1,740 ms) vs "Tested Media" Retell 680 ms | Different methods; the Tested Media study was only seen via a competitor page, and p95 for Telnyx and Bland was not in the extracts |
| Pipecat Azure STT TTFS 1,016 ms median | English audio and Pipecat's default Azure settings; Swedish behaviour is unmeasured |
| VAD and interruption unit bug | Verified in the installed agents-js 1.9.2 source and our `agent.ts`; confirm behaviour on a live call before and after the fix |
| Azure `Semantic` segmentation for sv-SE; prompt caching, `prompt_cache_key` and `reasoning_effort` on the Azure gpt-5.4-mini deployment | Not documented in reachable sources |
| BVCTelephony and adaptive interruption outside LiveKit Cloud | Docs indicate Cloud-only for adaptive interruption; BVC availability for self-hosted Node is unclear |
| Art. 50 date (2 Aug 2026), Omnibus Regulation 2026/1744, Art. 50 guidelines (20 July 2026) | Secondary legal sources; confirm on EUR-Lex. The Code of Practice status conflicts across sources |
| Aircall Swedish GA; $0.49 vs $0.19/min pricing | An older Aircall page lists only EN/ES/FR/DE; the pricing pages conflict |
| Smith.ai pricing, including escalation | The $3 human-escalation charge on the homepage conflicts with "free escalation" on the pricing page |
| Telavox pricing | Only a Danish reseller (599 DKK) and a competitor claim (999 kr) were found |
| Tele2 1,599 kr launch price; Telink 499 kr; startup tiers (Svaria tiers are inconsistent) | Vendor pages, possibly time-limited offers |
| Svaria's Fortnox, Visma, Capego and Briljant status lookups | Marketing blog only |
| Retell US-only processing | A community-forum statement by a representative, about 168 days before the research date |
| LiveKit observability data region | An older blog says US storage; current docs list an EU region |
| 46elks pricing and caller-ID passthrough; Twilio Elastic SIP Trunking numbers in Sweden | Extracts conflict or were silent |
| Chrome Web Speech and Anthropic API processing locations | Researcher inference; not researched (search budget exhausted) |
| Swedish spelling alphabet list (Adam, Bertil, Caesar…) | From researcher background knowledge; Wikipedia could not be fetched |
| Cresta latency (under 200 ms vs 1.2 s) and all vendor AHT and containment claims | Vendor or competitor sources without controls |

## Conclusion

The research changes where the effort should go. Feature parity with US SMB products is cheap and mostly done: warm transfer with a brief, calendar booking, Teams summaries, an allow-listed transfer directory. The hard, defensible ground is the part no competitor verifiably covers: **Swedish telephony that works, end-to-end EU processing, and a documented answer to auditor confidentiality**. That ground is won by disciplined engineering, not by new features. Fix the millisecond bug, protect the disclosure, measure TTFAB, normalize Swedish numbers, and gate every change with simulated Swedish callers. Done well, a self-hosted build at roughly a 1.3 s median would match platforms that cost $150k a year for enterprises. It would also beat the 1,600 kr/month operator add-ons on the dimension the partners care most about: what happens to client information.

The copilot needs the opposite discipline. It is fast enough already, and its problems are trust and data flow. An ungrounded one-second answer from a non-EU model, spoken by an advisor to a client, is the single highest-risk element in the whole system. The market's direction is clear: grounded cards, a curated source of truth for numbers, speaker-aware triggers, and ephemeral transcripts. Follow that direction, and the strongest evidence in the field (+15% productivity, concentrated among juniors) points to where the copilot pays off: shortening the ramp for the firm's newest advisors, not impressing its most senior ones.
