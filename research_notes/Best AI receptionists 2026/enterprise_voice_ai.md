# Enterprise Conversational / Voice AI Vendors for Customer Calls (2025–2026): Techniques and Controls That Make Them Reliable in Production

> Research method note: compiled 2026-10-16. Direct page fetching was blocked in this environment (egress proxy refused vendor domains), so every finding below comes from search-engine result summaries of the cited URLs, not from reading the full pages. Treat exact wording and numbers as "as summarised"; verify the critical ones (pricing, certifications, legal dates) against the primary page before relying on them. Vendor-published numbers are flagged **[vendor claim]**; third-party/aggregator numbers are flagged **[3rd-party estimate]**.

## 1. Architecture approaches: LLM-native vs. flow/NLU hybrid, guardrails, deterministic procedures, tool grounding, anti-hallucination

### Takeaway
Every leading vendor has converged on the same pattern: an LLM handles conversation, but business-critical behaviour is pinned down by (a) a written procedure/SOP layer (Sierra Journeys, Decagon AOPs, Google Playbooks+Flows, Parloa natural-language briefings), (b) deterministic, non-LLM code gates around tools and data (e.g. no account-changing tool is even available until the caller is authenticated), and (c) separate supervisor/guardrail models that check input and the proposed reply before it is spoken. Hallucination control is enforced at the system layer (grounding + "I don't know" + tool-call integrity checks), not hoped for at the model layer.

### Cited Findings
**Sierra (Agent OS / Agent SDK / Journeys)**
- Uses a "constellation of models" architecture rather than one model — [Sierra blog: Constellation of models](https://sierra.ai/blog/constellation-of-models)
- Defense-in-depth pipeline: "A supervisor agent screens the input. Another supervisor reviews the proposed response. A deterministic guard scans the output for sensitive data." — [Sierra: Defense in depth in the age of agents](https://sierra.ai/blog/defense-in-depth-in-the-age-of-agents)
- Deterministic guards are "non-model checks that can't be talked out of doing their job — like preventing account-modification tools from even being available to the agent until the customer has been authenticated." — [Sierra: Defense in depth](https://sierra.ai/blog/defense-in-depth-in-the-age-of-agents)
- Agent SDK lets engineers "construct agents by stacking composable skills and enforcing deterministic API interactions" and can "selectively bypass an LLM to achieve the necessary consistency" (i.e. fixed wording where required) — [Sierra: Meet the AI agent engineer](https://sierra.ai/blog/meet-the-ai-agent-engineer)
- Most agent development has shifted to the no-code "Journeys" layer that compiles to Agent SDK code — [ZenML LLMOps DB summary of Sierra talk](https://www.zenml.io/llmops-database/building-production-grade-customer-experience-agents-at-enterprise-scale) **[secondary]**
- Supervisors can take "subtle corrective action" (e.g. steer away from mentioning a competitor) rather than kill the conversation; hard business rules (e.g. "returns only within 30 days") are deterministic guardrails — [getmacha Sierra review](https://www.getmacha.com/blog/sierra-ai-complete-guide) **[3rd-party]**; see also [Sierra: From LLMs to enterprise-grade agents](https://sierra.ai/blog/enterprise-grade-agents)
- Trade-off noted by reviewers: supervision layer adds latency/complexity; misconfigured guardrails make the agent "hesitant or evasive" — [Atlan on Sierra](https://atlan.com/know/ai-agent/ai-agent-applications/what-is-sierra-ai/) **[3rd-party opinion]**

**Decagon (Agent Operating Procedures, AOPs)**
- AOPs = natural-language SOPs that compile into agent behaviour; Decagon built its "Duet" product on AOPs — [Decagon: Why we built Decagon Duet on AOPs](https://decagon.ai/blog/why-we-built-decagon-duet-on-agent-operating-procedures)
- Decagon frames agent development as "test-driven" — [Decagon: The future of AI agents is test-driven](https://decagon.ai/blog/the-future-of-ai-agents-is-test-driven)
- Comparison of AOPs vs. Intercom "Procedures" vs. Sierra "Journeys" as the same category of construct — [Fin.ai comparison](https://fin.ai/learn/ai-agent-procedures-aops-journeys) **[competitor source]**

**PolyAI (Agent Studio, Raven model)**
- Five pre-built platform guardrails: jailbreak defence, scope & hallucination control, AI identity, emergency escalation, tool-call integrity; applied to every conversation, visible in transcripts, toggleable per project — [PolyAI docs: release notes overview](https://docs.poly.ai/releases/overview); [PolyAI docs: Behavior](https://docs.poly.ai/behavior/introduction)
- Raven 3.5 (PolyAI's own LLM) is "grounded in your knowledge" and says "I don't know" rather than inventing; 24+ languages, sub-300 ms latency across voice and chat **[vendor claim]** — [PolyAI docs: Raven](https://docs.poly.ai/behavior/models/raven)
- Named failure mode: agents claiming a transaction completed when the tool call never executed (model generated the confirmation without checking the result) — distinct from factual hallucination; the tool-call-integrity guardrail targets it — [PolyAI blog: AI agent hallucinations](https://poly.ai/blog/ai-agent-hallucinations-guardrails)

**Parloa (AMP — AI Agent Management Platform)**
- AMP launched 12 Sept 2024 with $66M Series B; agents built from natural-language "briefings" instead of scripted flows; lifecycle tooling for simulation, evaluation, monitoring — [Parloa platform page](https://www.parloa.com/platform/); funding context [BeBeez Jan 2026 (€310M round)](https://bebeez.eu/2026/01/15/e310-million-raise-positions-germanys-parloa-far-ahead-recent-european-enterprise-ai-agent-rounds/)
- Built on OpenAI models (customer story) — [OpenAI: Parloa](https://openai.com/index/parloa/); earlier on Azure OpenAI — [Microsoft customer story](https://www.microsoft.com/en/customers/story/19824-parola-azure-open-ai-service)

**Google Customer Engagement Suite / CX Agent Studio (Conversational Agents)**
- Hybrid by design: deterministic "Flows" (state machine, Dialogflow CX heritage) + generative "Playbooks", connected to APIs via webhooks/tools — [Google partner skills path](https://partner.skills.google/paths/2306); [CX Agent Studio docs](https://docs.cloud.google.com/customer-engagement-ai/conversational-agents/ps)

**Five9 (Genius AI agents)**
- "Transfer guardrails ensure AI agents only escalate calls to human agents when they've completed their assigned objectives"; each transfer logged for supervisor traceability — [Five9 press release: new release of Voice AI Agents](https://www.five9.com/news/news-releases/five9-launches-breakthrough-new-release-voice-ai-agents-power-next-generation); [Five9 Genius AI page](https://www.five9.com/products/capabilities/conversational-generative-agentic-ai)

**Talkdesk**
- Hands-on reviewer (a competitor, Retell AI) found Talkdesk agents "conservative" — quickly hit guardrails off-script, prioritising safety/compliance/handoff over flexibility — [Retell AI blog](https://www.retellai.com/blog/best-ai-voice-agent-solutions-for-business-phone-systems) **[competitor opinion]**

**NICE CXone Mpower / Cognigy**
- NICE Proactive AI Agent applies guardrails "to limit over- and miscommunication" and support compliance — [NICE datasheet PDF (Mar 2025)](https://resources.nice.com/wp-content/uploads/2025/03/0275038_CXone-Mpower-Proactive-AI-Agent-Datasheet2.pdf)
- Mpower Agents launched June 2025 as no-code agentic AI in Mpower AI Studio; brand-specific guardrails in top tier — [Yardstick tear-sheet](https://yardstickresearch.app/tear-sheet/nice-cxone-mpower/) **[analyst opinion]**; [CX Today: NICE Mpower what's included](https://www.cxtoday.com/contact-center/nice-mpower-whats-included-how-much-does-it-cost/)

**Teneo (ex-Artificial Solutions, Swedish origin)**
- Positioned as hybrid (its long-standing deterministic NLU/flow engine plus LLM orchestration); claims 99% intent/entity accuracy and 17,000+ agents in production **[vendor claim, unverified]** — [Teneo AI voice agent page](https://www.teneo.ai/ai-voice-agent); rebrand from Artificial Solutions to Teneo.ai in 2024, listed on Nasdaq First North — [Wikipedia: Teneo.ai](https://en.wikipedia.org/wiki/Teneo.ai)

### Inferences
- The transferable pattern for a small self-hosted receptionist: (1) write each call type as an explicit SOP/procedure with steps and exit conditions; (2) gate tools in code (identity verified → only then expose client-specific lookups; booking tool returns success/failure that the bot must read before confirming); (3) add a cheap second-pass "supervisor" check on the drafted reply for out-of-scope advice (e.g. tax/accounting advice an accounting-firm receptionist must not give) and PII leakage; (4) use fixed, pre-written wording (LLM bypass) for legally sensitive statements (AI disclosure, recording notice, "we cannot give advice over the phone").
- PolyAI's "claimed success without tool success" failure mode is directly relevant to booking callbacks/meetings: the confirmation sentence should be generated from the tool result, not by the model.

### Gaps
- Could not read the full Sierra "enterprise-grade agents" and Decagon AOP posts (fetch blocked); exact internal mechanics (e.g. how supervisors are prompted, model sizes) not confirmed.
- Microsoft Copilot Studio, Amazon Connect, Genesys and Salesforce guardrail internals not researched in depth in this pass (Salesforce's "Einstein Trust Layer" and Genesys "AI Guides" are known product names but no 2025–26 sourced detail was gathered).

## 2. Testing & QA: simulation, evaluation suites, red-teaming, regression testing, 100% automated QA, human review

### Takeaway
Simulation with LLM-driven synthetic callers + LLM-as-judge scoring is now table stakes (Sierra, Decagon, Parloa, Cognigy Simulator Jan 2026, Talkdesk, Google test cases). Each run is repeated multiple times because outputs are non-deterministic, scenarios are seeded from real transcripts, and the suite gates every prompt/model change (regression). Voice-specific sims add noise, accents and interruptions. Post-launch, NICE-style "score 100% of calls" analytics replaces 2–5% manual sampling.

### Cited Findings
- Sierra Agent OS creates "simulated conversations between agents and mock personas"; set-up is user-simulator agent + agent under test + evaluator (LLM-as-judge); each scenario run 5–15 times due to non-determinism **[the 5–15 figure is secondary]**; "Voice Sims" test under background noise and interruptions; sims surface regressions in guardrail behaviour before release — [Sierra: Agent Development Life Cycle](https://sierra.ai/blog/agent-development-life-cycle); [ZenML summary of Sierra](https://www.zenml.io/llmops-database/building-production-ai-agents-with-advanced-testing-voice-architecture-and-multi-model-orchestration); [Sierra: Defense in depth](https://sierra.ai/blog/defense-in-depth-in-the-age-of-agents)
- Decagon simulations test whether the agent picks the right workflow (AOP) and follows its steps, with AI-generated mock users across channels; tests are structured around AOPs so failures are explainable — [Decagon: Simulations](https://decagon.ai/blog/decagon-simulations)
- Decagon sims can run on a schedule or in CI/CD and alert PagerDuty — [SiteGPT Decagon review](https://sitegpt.ai/resources/decagon-review) **[3rd-party]**; also unit tests on AOP components, replay of historical transcripts as regression tests, live A/B tests — [Fin.ai comparison](https://fin.ai/learn/ai-agent-procedures-aops-journeys) **[competitor source]**
- Suggested Decagon Voice 2.0 test suites: accents, noisy backgrounds, mid-sentence interruptions, emotional tone — [AgentsDB](https://agentsdb.com/decagon-voice-2-0-and-aop-copilot-turn-voice-into-revenue) **[3rd-party]**
- Parloa: simulated calls where one model plays the caller and another runs the configured agent; scored by mix of deterministic checks + LLM-as-judge (instruction following, correct tool use, task completion) — [OpenAI customer story: Parloa](https://openai.com/index/parloa/). "Performance Lab" simulates/tests agents for every update or model change; production monitoring via "Parloa Lens" — [Parloa platform](https://www.parloa.com/platform/)
- NiCE Cognigy Simulator (launched 15 Jan 2026): synthetic users as "digital twins" capturing demographics, language and intent variance; scored on task completion, guardrail adherence, integration reliability, experience quality; auto-generates scenarios from existing transcripts/agent configs; can mock third-party API responses to test integration robustness — [BusinessWire release](https://www.businesswire.com/news/home/20260115626600/en/nice-cognigy-unveils-simulator-an-ai-performance-lab-to-enable-enterprise-scale-evaluation-of-production-grade-ai-agents); [CX Today](https://www.cxtoday.com/ai-automation-in-cx/cognigy-simulator-ai-agent-testing-cx/); [No Jitter](https://www.nojitter.com/ai-automation/nice-s-cognigy-simulator-pressure-tests-ai-agents)
- Google CX Agent Studio: test cases are "self-contained scenarios" defining ideal conversation paths for regression testing so core paths don't break on updates; "test case hill climbing" to improve evaluation stability — [Google docs: Evaluation](https://docs.cloud.google.com/customer-engagement-ai/conversational-agents/ps/evaluation)
- Talkdesk: build agents in natural language, test before deployment, then "measure, govern and continuously optimize" — [GetApp listing](https://www.getapp.com/it-communications-software/a/talkdesk/) **[listing summary]**
- NICE CXone: AI evaluates every interaction (100% coverage) and feeds coaching — [NICE Autopilot Knowledge video page](https://www.nice.com/resources/cxone-mpower-autopilot-knowledge-product-video); 2–5% manual-sampling baseline comes from a third-party review — [Cekura: What is NICE CXone](https://www.cekura.ai/blogs/what-is-nice-cxone) **[3rd-party]**
- Voice testing practice: measure time-to-first-word and per-turn latency across whole calls (averages hide the worst turns); test barge-in by interrupting at random points with background noise — [Cekura: voice agent testing best practices](https://www.cekura.ai/blogs/best-practices-for-ai-voice-agent-testing) **[testing-tool vendor]**
- Research caution: LLM judges for voice-agent evaluation need calibration and human oversight — [arXiv 2608.24314: Benchmarking LLM Judges for Voice-Agent Evaluation](https://arxiv.org/pdf/2608.24314)

### Inferences
- Minimum viable QA for a small team: a scenario library (~50–150 Swedish/English call scripts derived from real calls: booking, "who is my contact", invoice question, angry client, wrong number, prompt-injection attempts, requests for tax advice); an LLM caller simulator; deterministic assertions (correct tool called, correct fields, AI disclosure spoken, no advice given) + LLM-judge rubric; run each scenario several times; block deploys on regression. Add audio-level sims (noise, accented Swedish, interruptions) for the voice layer.
- Post-launch: auto-score 100% of transcripts with the same rubric, and route low-scoring/flagged calls to a human review queue weekly.

### Gaps
- No public detail on red-teaming programmes (cadence, external red teams) for any vendor in this pass.
- No vendor published pass-rate thresholds used as release gates.

## 3. Production metrics: containment/resolution, CSAT, latency, escalation — and how they're defined

### Takeaway
Vendors report very different numbers because definitions differ: "containment" (call didn't reach a human) vs. "resolution" (problem actually solved, often contract-defined) vs. "in-scope resolution". Credible figures cluster around 40–70% containment for real voice deployments; claims of 80–90%+ are usually narrow-scope or vendor marketing. Latency targets: sub-second turn latency; humans hand off turns in ~200–300 ms while most agents land at 800–1500 ms.

### Cited Findings
- Sierra: resolution defined per contract ("successful resolution" and its rate negotiated per deal); escalations to a human not charged — [Contrary Research: Sierra](https://research.contrary.com/company/sierra); [Bret Taylor interview, Cheeky Pint](https://cheekypint.substack.com/p/bret-taylor-of-sierra-on-ai-agents). Published customer figures: 80% resolution (Airtable), 70%+ (Chime); median 70% across 14 Sierra case studies with a resolution rate **[3rd-party compilation]** — [Coworker.ai: Sierra pricing](https://coworker.ai/blog/sierra-ai-pricing)
- PolyAI / PG&E (US utility): 67% end-to-end containment (6 pts above legacy IVR), 22% CSAT lift on outage calls, 25% reduction in customer effort, 35,000 labour hours saved **[vendor case study]** — [PolyAI case study: PG&E](https://poly.ai/case-studies/pge/); PolyAI argues containment alone is misleading, resolution should be measured — [PolyAI guide: Call center voice AI](https://poly.ai/guides/call-center-voice-ai)
- PolyAI / Hopper: Gartner case study (Nov 2024, older) reports 88% satisfaction for GenAI voice assistant, equivalent to phone-channel CSAT — [PolyAI blog re Gartner](https://poly.ai/blog/polyai-recognized-in-recent-gartner-research-market-guides-case-studies)
- Five9: PODS 44% containment; Exact Sciences 45% AI containment and ~60% less time to schedule a pickup **[vendor claim]** — [CMSWire on Five9 voice AI agents](https://www.cmswire.com/contact-center/five9-debuts-agentic-voice-ai-agents-for-contact-centers/); [Five9 press release](https://www.five9.com/news/news-releases/five9-launches-breakthrough-new-release-voice-ai-agents-power-next-generation). Five9's commissioned 2025 TEI study: AI agents handle up to 28% of contacts — [Five9 resources](https://www.five9.com/resources?ci=2170&langcode=en-gb&page=1). Commentary framing Five9 as "containment by resolution, not deflection" — [CX Foundation](https://cxfoundation.com/news/five9-voice-ai)
- Teneo: claims >60% voice containment, "above 80%" for predictable call types, up to 90–91% "full automation" **[vendor claims, inconsistent across pages, unverified]** — [Teneo AI voice agent](https://www.teneo.ai/ai-voice-agent); [Teneo Annual Report 2025 (PDF)](https://storage.mfn.se/88c823e7-18d0-4ae2-9011-ae2caa16735e/annual-report-2025_en.pdf)
- NICE CXone Autopilot 70–88% containment **[secondhand, unverified]** — [Plura.ai NICE guide](https://www.plura.ai/articles/nice-contact-center-ai)
- Boost.ai / Nordea (Nordic bank, chat-first, 12 AI agents across SE/DK/NO/FI): 90%+ "in-scope resolution" **[vendor claim; in-scope ≠ containment]** — [boost.ai Nordea case study](https://boost.ai/case-studies/nordea-employs-comprehensive-conversational-ai-strategy-to-scale-customer-service/)
- Containment measures what the AI did, not whether the customer's problem was solved — [Kore.ai: The voice AI surge](https://www.kore.ai/blog/the-ai-voice-surge) **[vendor opinion]**
- Latency: human turn handoffs ~200–300 ms; most agents 800–1500 ms; a ~900 ms reply makes callers think they weren't heard and repeat themselves — [Softcery: real-time vs turn-based voice agents](https://softcery.com/lab/ai-voice-agents-real-time-vs-turn-based-tts-stt-architecture); [Gnani.ai latency guide](https://www.gnani.ai/resources/blogs/what-causes-latency-in-voice-ai-how-to-overcome-it). PolyAI claims sub-300 ms for Raven 3.5 **[vendor claim]** — [PolyAI docs: Raven](https://docs.poly.ai/behavior/models/raven)
- Escalation/handoff quality: 83% of consumers still repeat themselves moving from AI to human (Five9-sponsored 2026 survey) — [CX Today: AI handoffs, Five9](https://cxtoday.com/ai-handoffs-should-feel-seamless-why-arent-they-five9)

### Inferences
- For an accounting-firm receptionist, define metrics up front: (a) "resolved by AI" = caller's intent fulfilled with no human follow-up needed (e.g. booking made, message correctly routed with all required fields); (b) "correctly escalated" counted as success, not failure; (c) "bad containment" = caller hung up unresolved; (d) p50/p95 turn latency; (e) post-call CSAT/SMS 1-question survey; (f) rate of human corrections to AI-captured messages. Realistic target for a receptionist where many calls legitimately need a human: high correct-routing rate rather than high containment.

### Gaps
- No vendor-published latency SLAs in the sources gathered; no standard industry definition of "resolution."
- No Swedish/Nordic voice deployment with published containment numbers was found.

## 4. Handoff to humans: warm transfer, context passing, whisper, callback scheduling

### Takeaway
Best practice is a warm transfer that briefs the human first (screen summary or spoken "whisper"), passes a structured context packet (verified identity, intent, actions taken, open items, escalation reason) and falls back to a confirmed callback with the context saved to CRM if nobody answers. Escalation triggers should be explicit conditions, not "when confused."

### Cited Findings
- Five9: "Seamless warm handoffs give human agents complete conversational context before transferring the call, eliminating customer repetition"; transfers logged so supervisors can trace why — [Five9 press release](https://www.five9.com/news/news-releases/five9-launches-breakthrough-new-release-voice-ai-agents-power-next-generation); [Call Centre Helper on Five9 AI trust & governance](https://www.callcentrehelper.com/five9-ai-agents-and-ai-trust-governance-258548.htm)
- PolyAI has a built-in "emergency escalation" guardrail (crisis events) — [PolyAI docs: Behavior](https://docs.poly.ai/behavior/introduction)
- Warm transfer briefs the receiving agent before the customer connects: on-screen summary, spoken whisper, or short live three-way — [Retell AI: warm transfer meaning](https://www.retellai.com/blog/warm-transfer-meaning) **[vendor blog]**; [Deepgram: warm transfer guide](https://deepgram.com/learn/ai-voice-agent-human-handoffs-warm-transfer-calls)
- Handoff summary should cover why the customer called, what the AI tried, what remains — [Cresta: AI to human handoff best practices](https://cresta.com/guides/ai-to-human-agent-handoff-best-practices); structured payload: verified identity, intent, entities, actions taken, escalation code, two-sentence summary — [Telnyx: AI-to-human handoff](https://telnyx.com/resources/ai-to-human-handoff-voice-ai)
- Announce the transfer and bridge the wait with filler audio (no dead air) — [Famulor: call transfer guide 2026](https://www.famulor.io/blog/ai-voice-agent-call-transfer-to-a-human-the-2026-guide)
- Callback as async handoff: collect preferred time, create a human task with transcript/context; if transfer times out, offer a callback, confirm the number aloud, save commitment + context to CRM — [Murf: AI-to-human handoff](https://murf.ai/blog/ai-to-human-handoff); [Telnyx](https://telnyx.com/resources/ai-to-human-handoff-voice-ai)
- Define specific escalation conditions ("Not 'Hand off when the AI gets confused'") — [LeadLock: call forwarding best practices](https://www.leadlock.ai/blog/best-practices-for-setting-up-ai-voice-agents-with-call-forwarding/)

### Inferences
- Small-firm adaptation: since accountants are often unavailable, the dominant path will be "structured message + callback booking" rather than live warm transfer; the message should be a structured record (who, company/org.nr, verified?, topic category, urgency/deadline, preferred callback window, phone number read back) pushed to the responsible accountant.

### Gaps
- Vendor-specific docs for Genesys, Cognigy, PolyAI, Microsoft warm-transfer/whisper features were not retrieved.

## 5. Voice UX practices: persona, AI disclosure, interruptions, readback/confirmation, accents & noise, multilingual (Swedish)

### Takeaway
Leading voice stacks run half-duplex with barge-in and semantic endpointing, keep turn latency well under 1 s, disclose AI identity (PolyAI ships it as a default guardrail; EU law now requires it), and test explicitly for noise, accents and interruptions. Swedish is NOT supported by several hyperscaler speech-to-speech models (Amazon Nova 2/2.5 Sonic), so Swedish deployments usually rely on cascaded ASR→LLM→TTS with EU-hosted speech vendors.

### Cited Findings
- PolyAI "AI identity" guardrail is one of five default guardrails — [PolyAI release notes](https://docs.poly.ai/releases/overview)
- Most production systems are half-duplex with barge-in (agent stops when interrupted; only short acknowledgements overlap); barge-in needs neural VAD on ~10–20 ms frames; false triggers from coughs/backchannels are the main pitfall; one developer measured +120 ms latency from adding barge-in — [DEV: Barge-in is the feature nobody benchmarks](https://dev.to/kenimo49/barge-in-is-the-voice-agent-feature-nobody-benchmarks-i-added-it-and-lost-120ms-4o7m); [Softcery](https://softcery.com/lab/ai-voice-agents-real-time-vs-turn-based-tts-stt-architecture)
- Semantic endpointing (is the utterance complete?) beats fixed silence timers for cutting turn delay — [Gnani.ai](https://www.gnani.ai/resources/blogs/what-causes-latency-in-voice-ai-how-to-overcome-it); [rnikhil latency post](https://rnikhil.com/2025/05/18/how-to-reduce-latency-voice-agents)
- Benchmarks rarely cover interruptions and disfluency; Full-Duplex-Bench-v3 evaluates tool use under real-world disfluency — [arXiv 2604.04847](https://arxiv.org/pdf/2604.04847)
- Sierra Voice Sims test noise and interruptions before deploy — [ZenML summary](https://www.zenml.io/llmops-database/building-production-ai-agents-with-advanced-testing-voice-architecture-and-multi-model-orchestration)
- Amazon Nova 2 Sonic officially supports English (US/UK/AU/IN), French, Italian, German, Spanish, Portuguese (BR), Hindi — no Swedish; Nova 2.5 Sonic service card (Oct 2026) says same set, "not recommended" for other languages — [AWS Nova 2 Sonic language support](https://docs.aws.amazon.com/nova/latest/nova2-userguide/sonic-language-support.html); [AWS AI Service Card Nova 2.5 Sonic (PDF)](https://docs.aws.amazon.com/pdfs/ai/responsible-ai/nova-2-5-sonic/nova-2-5-sonic.pdf)
- Cognigy.AI 2025.17 added ElevenLabs and Deepgram EU-hosted speech so "all audio data is processed within the EU" — [Cognigy release 2025.17](https://www.cognigy.com/product-updates/2025.17)
- PolyAI Raven 3.5 supports 24+ languages (Swedish not confirmed) — [PolyAI docs: Raven](https://docs.poly.ai/behavior/models/raven)
- Nordic-language speech (Finnish, Swedish, Norwegian, Danish) "improved sharply" and is "ready for everyday service" **[vendor claim, Digital Workforce]** — [Digital Workforce Voice AI](https://digitalworkforce.com/customer-service-automation/voice-ai/)
- Parloa emphasises covering "as many languages as possible and the nuances of each one" but Swedish not named — [Microsoft customer story: Parloa](https://www.microsoft.com/en/customers/story/19824-parola-azure-open-ai-service)

### Inferences
- Readback/confirmation of critical data (phone number, personnummer/org.nr, dates, email) is standard practice in voice design generally; for Swedish, read numbers in digit groups and confirm dates with weekday ("tisdag den 14:e") to catch ASR errors. (Inference; no vendor source retrieved specifically on readback.)
- Swedish support must be verified per component (ASR, LLM, TTS), not per platform; speech-to-speech models from hyperscalers may not cover Swedish.

### Gaps
- No primary vendor source on persona design guidelines or confirmation/readback rules was retrieved (PolyAI/Google design guides likely exist but were not reachable).
- Swedish language availability for PolyAI, Sierra, Decagon, Parloa, Google CES voice, Microsoft Copilot Studio real-time voice not confirmed.

## 6. Compliance & governance: EU residency, GDPR, EU AI Act, ISO 27001/42001, SOC 2, PCI, recording consent

### Takeaway
EU AI Act Article 50 "tell people they're talking to an AI" applies from 2 August 2026 and was NOT delayed by the Digital Omnibus (only high-risk rules and watermark-marking grace periods moved). EU-native vendors (Parloa, Cognigy) lead on EU residency claims; ISO/IEC 42001 is still rare in contact-centre AI (Cresta first, Jan 2025; Talkdesk reportedly Jan 2026). In Sweden, recording one's own call isn't criminal eavesdropping, but GDPR (lawful basis + Art. 13 notice) governs storage and AI analysis.

### Cited Findings
- Article 50 AI-interaction disclosure applies from 2 Aug 2026, unaffected by Digital Omnibus — [Usercentrics](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/); [Cookiebot](https://www.cookiebot.com/en/eu-ai-act-article-50-transparency-compliance/); [artificialintelligenceact.eu Art. 50 guide](https://artificialintelligenceact.eu/transparency-rules-article-50/)
- Omnibus (Reg. (EU) 2026/1744) in force 27 July 2026; high-risk Annex III moved to 2 Dec 2027; Art. 50(2) marking grace to 2 Dec 2026 for systems already on market — [ActuIA](https://www.actuia.com/en/news/ai-act-obligations-in-force-and-delays-under-omnibus-2026-1744/); [Technology.org, 13 Oct 2026](https://www.technology.org/2026/10/13/eu-ai-act-deadlines-after-the-digital-omnibus-what-applies-from-december-2026-to-august-2028/); older provisional-agreement view: [Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/)
- Commission finalised Art. 50 implementation guidelines 20 July 2026 (single source) — [Usercentrics](https://usercentrics.com/knowledge-hub/eu-ai-act-high-risk-delay-article-50-transparency-consent/); Code of Practice on AI-generated content status conflicting (finalised 10 June 2026 per [Paul Weiss](https://www.paulweiss.com/insights/client-memos/eu-finalises-transparency-rules-for-ai-generated-content) vs. "in progress" per another source) — **conflict, verify**
- Art. 50 breaches: up to €15M or 3% worldwide turnover — [Cookiebot](https://www.cookiebot.com/en/eu-ai-act-article-50-transparency-compliance/)
- Parloa Trust Center lists ISO/IEC 27001:2022, SOC 2 Type 1 & 2, PCI DSS, HIPAA, DORA, GDPR, "EU AI Act" alignment; German/EU residency; regional residency via "Parloa Zones"; ISO 42001 not listed **[vendor claims]** — [Parloa homepage](https://www.parloa.com/); [Parloa AI phone agents page](https://www.parloa.com/landing-page/ai-phone-agents/); [Valueposition Parloa review](https://valueposition.co/tools/parloa)
- Cognigy EU-hosted speech option (2025.17) — [Cognigy 2025.17](https://www.cognigy.com/product-updates/2025.17); Cognigy Simulator data residency not documented in sources found
- Cresta: first contact-centre AI provider with ISO/IEC 42001 (14 Jan 2025) — [Cresta press release](https://cresta.com/press/cresta-becomes-first-contact-center-ai-provider-to-achieve-iso-iec-42001-certification); Talkdesk ISO 42001 (22 Jan 2026) per third-party list only — [AI Compliance Vendors list](https://aicompliancevendors.com/blog/iso-42001-certified-companies-list) **[verify]**
- Amazon Nova models run in AWS Stockholm region (hosting, not language) — [rywalker research](https://rywalker.com/research/aws-nova-2-sonic) **[3rd-party]**
- Microsoft Copilot Studio real-time voice agents GA 27 Apr 2026, initially via D365 Contact Center in North America (regional limits) — [Microsoft Dynamics 365 blog, 27 Apr 2026](https://www.microsoft.com/en-us/dynamics-365/blog/business-leader/2026/04/27/turning-customer-experience-into-a-growth-engine/); [Waboom](https://www.waboom.ai/blog/microsoft-copilot-studio-voice-agents-launch) **[3rd-party]**
- Sweden: a party recording its own conversation does not commit unlawful eavesdropping; storing/AI-analysing recordings is personal-data processing needing an Art. 6 basis and Art. 13 notice; voiceprint identification = special-category data needing explicit consent — [Salesprep: recording calls GDPR Sweden](https://salesprep.ai/blog/recording-sales-calls-gdpr-sweden); [Teneks: Nordic call recording laws](https://www.teneks.ai/blog/call-recording-laws-baltic-nordic-guide); [Softcery EU voice AI regulations](https://softcery.com/lab/eu-voice-ai-regulations-founders-guide) **[non-legal sources]**
- IMY examined Telia/Tele2 call recording (2016) and ran a 2026 sandbox on AI transcription in social services; no IMY position specifically on AI voice agents found — [Teneks](https://www.teneks.ai/blog/call-recording-laws-baltic-nordic-guide) **[secondary]**
- Swedish phone-service provider Voice Integrate Nordic investigated over data concerns — [MLex](https://www.mlex.com/mlex/articles/2056817/voice-integrate-nordic-investigated-over-swedish-phone-service-data-concerns) (details paywalled)

### Inferences
- For the Swedish accounting firm: fixed opening line covering AI identity + recording/transcription notice + link to privacy notice (satisfies Art. 50 and GDPR Art. 13 layered notice); avoid voice biometrics; keep audio/transcripts in EU with retention limits; DPA with every sub-processor (ASR, LLM, TTS, telephony). Note accountants' confidentiality duties (and AML/KYC data) make minimising what the bot hears/stores more important than for retail use cases.

### Gaps
- No primary IMY guidance on AI voice agents; no verified ISO 42001 status for the 14 named vendors except Talkdesk (unverified).
- Sierra/Decagon/PolyAI EU data residency details not retrieved.

## 7. Pricing models and deal sizes

### Takeaway
Three models coexist: outcome/resolution-based (Sierra; Decagon optional), per-conversation/per-session (Decagon, Google CX Agent Studio $0.50/session, Salesforce $2/conversation), and per-minute/consumption (Amazon Connect $0.038/min incl. Nova Sonic; Google classic per-second; Salesforce voice minutes; Genesys tokens). AI-native vendors' deals are typically six figures per year (Decagon median ~$400k; PolyAI/Sierra entry ~$150k) — far beyond a small firm, which is why self-hosting is rational.

### Cited Findings
- Sierra: outcome-based, pre-negotiated per-resolution rate; escalation free — [Cheeky Pint / Bret Taylor](https://cheekypint.substack.com/p/bret-taylor-of-sierra-on-ai-agents); estimates $1–2.50/resolution and ~$150k/yr platform fee **[3rd-party estimate]** — [Coworker.ai](https://coworker.ai/blog/sierra-ai-pricing); [eesel](https://www.eesel.ai/blog/sierra-ai-pricing)
- Decagon: per-conversation or per-resolution, custom quotes; median contract $432,750/yr (range $105k–$923k, from only 12 purchases/2 buyers) **[thin data]** — [getmacha Decagon pricing](https://www.getmacha.com/blog/decagon-ai-pricing-explained); ~$386k median elsewhere; ~$0.99/conversation + ~$50k platform fee per competitor Quiq — [Quiq](https://quiq.com/blog/decagon-pricing/) **[competitor]**
- PolyAI: custom, usage-based; entry "near $150K/year" **[single 3rd-party estimate]** — [Retell AI: Parloa alternatives](https://www.retellai.com/blog/best-parloa-alternatives-for-conversational-ai)
- Parloa: no public pricing — [Famulor](https://www.famulor.io/blog/best-parloa-alternatives-for-conversational-ai); [Chatarmin](https://chatarmin.com/en/blog/parloa-pricing)
- Google Conversational Agents (classic): voice $0.001/s (Flows), $0.002/s (Playbooks), billed per turn (listening + spoken response, rounded up); chat $0.007/$0.012 per request; CX Agent Studio $0.50/session voice or chat — [Google pricing page](https://cloud.google.com/products/conversational-agents/pricing); [Google CX Agent Studio product page](https://cloud.google.com/products/conversational-agents) — **conflict between pages; verify**
- Amazon Connect: Customer voice $0.038/min, Nova Sonic and 3P STT/TTS config included (3P provider fees extra) — [AWS Connect pricing appendix](https://aws.amazon.com/products/connect/customer/pricing/appendix/)
- Genesys Cloud: Virtual Agent 0.5 tokens/interaction, Agentic Virtual Agent 1.2 tokens/interaction; tiers include 250 named/350 concurrent AI tokens per org/month; ~US$1/token — [Genesys billing scenarios](https://help.genesys.cloud/articles/virtual-agent-and-agentic-virtual-agent-billing-scenarios/); [Genesys tokens model](https://help.genesys.cloud/articles/genesys-cloud-tokens-model/)
- Salesforce Agentforce: Flex Credits $500/100k; standard action 20 credits (~$0.10), voice action 30 credits (~$0.15) or voice minutes 60 credits (~$0.30/min) — mutually exclusive, minutes take precedence; alt. $2/conversation; per-user $125/mo **[3rd-party summaries of Salesforce rate card]** — [Supered](https://www.supered.io/blog/agentforce-pricing/); [Valintry360](https://valintry360.com/blogs/agentforce-flex-credits-cost-per-action/)
- Microsoft: D365 Contact Center Voice $95/user/mo, full $110; agents metered via Copilot Credits (pay-as-you-go), Azure Communication Services billed separately — [Microsoft D365 Contact Center pricing](https://www.microsoft.com/en-us/dynamics-365/products/contact-center/pricing); [Copilot Studio pricing](https://www.microsoft.com/en-us/microsoft-365-copilot/pricing/copilot-studio)
- Talkdesk: seats $85–$225/user/mo; AI pricing unpublished/quote-based — [getmacha Talkdesk](https://www.getmacha.com/blog/talkdesk-ai-complete-guide)
- NICE Mpower packaging/pricing overview — [CX Today](https://www.cxtoday.com/contact-center/nice-mpower-whats-included-how-much-does-it-cost/)

### Inferences
- Benchmark for the self-hosted build: hyperscaler consumption rates (~$0.04–0.12/min, or ~$0.50/session) set a realistic "cost ceiling" to beat; a small firm with a few hundred calls/month could run per-minute services for tens of euros, so self-hosting is justified mainly by data control/GDPR, not cost.

### Gaps
- Five9, Cognigy, Teneo, PolyAI, Parloa list prices unavailable; Sierra "Horizon" product (July 2026) from single aggregator, unverified.

## 8. Published case studies with numbers (prefer Nordic/European/professional services)

### Takeaway
No Swedish-language voice deployment with published containment numbers was found for the named vendors. European examples are mostly German (Parloa) or chat-centric Nordic (boost.ai/Nordea). The best-documented voice numbers are US (PG&E/PolyAI 67% containment; PODS/Five9 44%).

### Cited Findings
- Teneo: Folksam (Swedish insurer) is a named customer; no published metrics — [Teneo blog](https://www.teneo.ai/blog/best-enterprise-ai-voice-agents-customer-service); [getmacha Teneo review](https://www.getmacha.com/blog/teneo-ai-complete-guide)
- Parloa: customers include Allianz, Booking.com, SAP, HealthEquity, Swiss Life — [The Innovator](https://theinnovator.news/startup-of-the-week-parloa/); Nord-Ostsee Automobile (Germany) case — [Parloa customer story](https://www.parloa.com/customers/nord-ostsee-automobile/); global retail brand "AI agents manage 100% of calls" — [Parloa customer story](https://www.parloa.com/customers/global-retail-brand/); HSE voice ordering into CRM — [Parloa customers](https://www.parloa.com/customers/)
- Boost.ai / Nordea: 12 AI agents across SE/DK/NO/FI, 90%+ in-scope resolution, Swedish chat routed AI-first (chat, not voice) — [boost.ai](https://boost.ai/case-studies/nordea-employs-comprehensive-conversational-ai-strategy-to-scale-customer-service/); Västra Götaland region ~800 automated conversations/day during pandemic (dated ~2020–21) — [boost.ai Nordic public sector](https://boost.ai/case-studies/public-sector-nordics-conversational-ai-case-study/)
- PolyAI / PG&E: 67% containment, +22% CSAT, 35,000 labour hours saved — [PolyAI PG&E](https://poly.ai/case-studies/pge/)
- Five9 / PODS 44% containment, >100k calls/year expected; Exact Sciences 45% — [CMSWire](https://www.cmswire.com/contact-center/five9-debuts-agentic-voice-ai-agents-for-contact-centers/)
- Sierra: Airtable 80% resolution, Chime 70%+, Rocket Mortgage 4x conversion (channel not stated as voice) — [Coworker.ai](https://coworker.ai/blog/sierra-ai-pricing) **[3rd-party compilation]**

### Inferences
- No direct professional-services (accounting/legal) voice-AI case study with numbers found; closest analogues are appointment/scheduling flows (Five9 Exact Sciences pickup scheduling, PolyAI reservations/utility).

### Gaps
- Swedish-language voice case studies; accounting/professional-services case studies; Genesys, Microsoft, Google, Amazon, Salesforce European voice case studies — not found in this pass.
