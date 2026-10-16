# Real-time agent-assist / call copilot products (2025–2026)

Method note: research date 2026-10-16. Direct page fetches were blocked by this session's egress proxy (WebFetch/curl returned "CONNECT 403" for fireworks.ai, docs.cloud.google.com, help.dialpad.com), so every finding below comes from search-engine result summaries of the cited URLs, not from reading the full pages. Wording and numbers should be spot-checked against the live pages before they are quoted externally. The session's web-search budget also ran out before a final check on Chrome Web Speech API privacy and limits. "(vendor claim)" marks marketing figures that have not been independently verified.

Prototype under evaluation: a browser page uses the Chrome Web Speech API on a speakerphone. Claude Haiku gives a quick unverified answer in about 1 s, then Claude Sonnet with domain-restricted web search gives a sourced answer in 3–5 s. Answers appear as cards, with a "Help me now" button.

---

## 1. Product landscape, audio capture and speaker separation

### Takeaway
Enterprise products get audio in one of three ways. They integrate with the CCaaS or telephony platform, where agent and customer are usually on separate stereo channels. They run a desktop app that captures softphone or headset audio. Or they run inside the browser or agent workspace. Speaker separation usually comes from the channels, not from acoustic diarization. Consumer and meeting tools either join as a bot or capture system audio on the desktop. Gong, Fathom and tl;dv are still mainly post-call products. In-call answers from Otter and Zoom are pull-based: the user asks.

### Cited Findings
**Contact-center specialists**
- **Cresta**: launched **Knowledge Agent** on 17 March 2026. It is a browser-based assistant that uses "ambient listening within the browser" to analyse live call audio and detect customer intent in real time, so the agent does not have to search. "Context Fields" read values shown on the agent's screen (loyalty tier, booking class, account status) to tailor answers. Answers include citations back to knowledge sources. — [Cresta blog](https://cresta.com/blog/introducing-knowledge-agent-real-time-answers-right-where-agents-work); [CX Today](https://www.cxtoday.com/ai-automation-in-cx/cresta-launches-knowledge-agent-to-reduce-agent-tab-switching/); [CMSWire](https://www.cmswire.com/contact-center/cresta-launches-knowledge-agent-for-contact-centers/); [DestinationCRM](https://www.destinationcrm.com/Articles/ReadArticle.aspx?ArticleID=173960)
- Cresta's earlier **Knowledge Assist** (Fall '23 release) offered "proactive question and answer extraction that uses real time conversation context to identify the right information and generate an exact response that links back to the source", plus agent feedback on the quality of generated responses. — [Cresta Fall '23 release](https://cresta.com/blog/introducing-our-fall-23-release-leveraging-generative-ai-to-empower-better-outcomes); [Cresta press release](https://cresta.com/press/cresta-raises-bar-with-new-generative-ai-capabilities-that-drive-efficiency-and-effectiveness-in-the-contact-center)
- Knowledge connectors for Cresta are reported as API, web, PDF, Salesforce, Google Drive, SharePoint and Zendesk (third-party list). — [getmacha](https://www.getmacha.com/blog/cresta-ai-complete-guide)
- Cresta runs Knowledge Assist inference on Fireworks AI to get low-latency, high-availability serving at scale. The case study summary gives no numbers. — [Fireworks case study](https://fireworks.ai/blog/story-cresta-knowledge-assist)
- **Balto**: Windows/Mac desktop app for customers. Agents must use software phones on a computer with a headset, and Chrome OS is not supported. — [Balto download](https://www.balto.ai/download-balto/); [Balto system requirements](https://www.balto.ai/minimum-system-requirements/)
- Balto has also launched an embeddable "app-free" version; the desktop app stays for organisations that cannot embed it. It guides agents with "smart checklists and dynamic prompts". — [CX Today](https://www.cxtoday.com/contact-center/balto-launches-an-app-free-version-of-its-platform/)
- Balto uses stereo audio where available to separate agent and customer speech (third-party wiki, unverified). — [WFM Labs wiki](https://wiki.wfmlabs.org/wiki/Balto)
- **Observe.AI**: its real-time assist has been renamed "Companion Agent". It surfaces scripts, prompts and knowledge-base answers live. Knowledge is connected through APIs or drag-and-drop files. One review says its real-time side is less mature than its post-call QA. — [Observe.AI Knowledge AI](https://www.observe.ai/real-time/knowledge-ai); [getmacha](https://www.getmacha.com/blog/observe-ai-complete-guide)
- **Level AI**: started in QA and speech analytics and added real-time assist later. It surfaces KB articles and policy snippets by customer intent, and integrates with Genesys Cloud CX, NICE CXone and Five9. Source is a competitor's blog. — [Balto: Level AI alternatives](https://www.balto.ai/competitors/level-ai-alternatives/)
- **Uniphore**: a 2025 real-time guidance brochure says it surfaces prompts and "trusted answers" during calls and pulls CRM and past-interaction context before the call. The module name is inconsistent across sources (U-Assist vs X-Assist). — [Uniphore brochure PDF](https://www.uniphore.com/document-library/brochures/brochure-real-time-guidance-agent-2-pager.pdf); [Balto vs Uniphore](https://www.balto.ai/compare/balto-vs-uniphore/)
- **Cogito** is now part of Verint and gives real-time behavioural cues on tone, empathy and pace. It is strongest on voice. — [Balto: Uniphore alternatives](https://www.balto.ai/competitors/uniphore-alternatives/); [AssemblyAI roundup](https://www.assemblyai.com/blog/best-agent-assist-software)

**CCaaS and platform vendors**
- **Google Agent Assist**: Proactive Generative Knowledge Assist follows the conversation and proactively suggests search queries and answers. It extracts conversation facts as key-value pairs to enrich the search. V2 went GA on 10 June 2026 with rich search context, multiple suggested queries and granular trigger control. A 30 September 2026 release added context-aware next-best-action and an on-demand assistant for human agents. — [Google PGKA docs](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/pgka); [Agent Assist release notes](https://cloud.google.com/agent-assist/docs/release-notes)
- Google ships drop-in **UI modules** (Container, Generative knowledge assist v2.10, Companion agent v1.1) that talk to the agent desktop through a "UI module connector" using custom events. — [UI modules docs](https://docs.cloud.google.com/agent-assist/docs/ui-modules)
- **Dialpad**: "RTA cards" were renamed **AI Live Coach Cards**. Admins define trigger keywords or phrases plus the response to show. A card can be triggered by the rep, the customer, or anyone. Cards are language-specific and scoped per contact center or department. — [Dialpad help: AI Live Coach Cards](https://help.dialpad.com/docs/ai-live-coach-cards); [Dialpad Custom Moments](https://help.dialpad.com/hc/en-us/articles/55071217349659-Custom-Moments); [eesel overview](https://www.eesel.ai/blog/dialpad)
- **Salesforce**: Agentforce Contact Center has an "AI Service Assistant" panel in the Service Console next to the live transcript and customer profile. It generates summaries, suggests responses and recommends next steps in real time. Since November 2025, Amazon Connect supplies real-time transcripts and contextual recommendations into Salesforce. — [Salesforce announcement](https://www.salesforce.com/news/stories/agentforce-contact-center-announcement/); [CMSWire review](https://www.cmswire.com/contact-center/salesforce-agentforce-contact-center-review-strengths-gaps-and-how-it-compares-to-rivals/); [AWS What's New Nov 2025](https://aws.amazon.com/about-aws/whats-new/2025/11/amazon-connect-ai-agent-assistance-summarization-agentforce-service/)
- **Microsoft Dynamics 365 Contact Center**: launched in 2024 as "Copilot-first". Copilot answers agent questions "grounded on your trusted knowledge sources", with real-time transcription, translation and sentiment. Most 2026 news covers customer-facing voice agents rather than human-agent assist. — [Microsoft blog 2024](https://blogs.microsoft.com/blog/2024/06/04/announcing-dynamics-365-contact-center-a-copilot-first-cloud-contact-center-to-transform-service-experiences/); [Dynamics 365 blog Apr 2026](https://www.microsoft.com/en-us/dynamics-365/blog/it-professional/2026/04/27/dynamics-365-contact-center-ai-agents/)
- **Microsoft Teams (meetings and Teams Phone)**: Copilot is started manually from the call or meeting controls and stays on for the rest of the call. In "Only during the call" mode it works with transcription and recording off, and nothing is kept after the call. — [Microsoft Support](https://support.microsoft.com/en-us/teams/copilot/use-copilot-without-transcribing-or-recording-a-teams-meeting-or-call); [Microsoft Learn admin](https://learn.microsoft.com/en-us/microsoftteams/copilot-teams-calling-transcription)
- **Zoom**: AI Companion "in-meeting questions" answers questions about the meeting so far, including parts before the person joined, in a private side panel. Since July 2025 it can also be queried before, during and after Zoom Phone calls. For contact centers, **Zoom AI Expert Assist** gives in-conversation next-best-action suggestions from knowledge and CRM. The Elite-plan requirement comes from a single secondary source. — [Zoom news](https://news.zoom.com/zoom-rolls-out-new-agentic-ai-offerings-to-save-time-and-drive-connections/); [GetVoIP guide](https://getvoip.com/blog/zoom-ai-companion/); [Wharton support](https://support.wharton.upenn.edu/help/zoom-ai-companion)
- **Genesys Cloud Agent Copilot**: surfaces knowledge suggestions in the agent workspace. — [Genesys tokens model](https://help.genesys.cloud/articles/genesys-cloud-tokens-model/); [robertwc blog](https://robertwc.blogspot.com/2025/08/deciding-between-genesys-cloud-agent.html)
- **NICE CXone Mpower Copilot for Agents** (Enlighten family) offers real-time summaries, sentiment, KB answers (process steps, links, images), email drafts and AutoSummary. It is queried through a search bar, and one- or two-word inputs are treated as keyword searches. Agents cannot edit real-time summaries. — [NICE help](https://help.nicecxone.com/content/agent/cxoneagent/enlightencopilotforagentscxa.htm); [NICE copilot page](https://www.nice.com/products/copilot-for-agents)
- **Five9**: lists AI Agent Assist, AI Knowledge, Live Transcription and AI Summaries in its bundles. — [Five9 pricing](https://www.five9.com/products/pricing); [Five9 Agent Assist datasheet](https://assets.ctfassets.net/3viuren4us1n/2zkOnOTyi5NwxCElcApAon/b48cacf98f50da0458bf9faf4fd8ffc8/3-Five9_DataSheet_Agent_Assist.pdf)

**Sales and meeting tools**
- **Gong**: 2026 reviews describe it as post-call only. "Gong Assistant" (formerly AI Ask Anything) is a chat tool for asking about calls and deals; no live in-call coaching product was found. — [Gong help](https://help.gong.io/docs/ai-ask-anything-is-evolving-into-gong-assistant); [Revenue.io](https://www.revenue.io/blog/best-gong-alternatives-and-competitors); [Technology in Sales](https://www.technologyinsales.com/tools/gong)
- **Otter**: the Meeting Agent launched 25 March 2025. It was voice-activated ("Hey Otter"), answered from the company's meeting database, and was initially Zoom-only. Otter said it would not speak unprompted at first. A later Otter blog says Otter "no longer answers questions live", so the current status is unclear. In-call chat in a sidebar is reported. — [BusinessWire](https://www.businesswire.com/news/home/20250325249430/en/Otter.ai-Breaks-$100M-ARR-Barrier-and-Transforms-Business-Meetings-Launching-Industry-First-AI-Meeting-Agent-Suite); [Forbes](https://www.forbes.com/sites/barrycollins/2025/03/25/now-you-can-talk-to-otters-ai-assistant-during-meetings/); [Otter blog](https://otter.ai/blog/ai-meeting-assistants-vs-meeting-agents)
- **Fireflies**: "Live Assist" is reported to give real-time prompts during calls. **Fathom** offers live manual highlights by button or hotkey, with summaries after the call. **tl;dv** offers real-time transcription and highlights and is post-call focused, with EU hosting. All sources are third-party or competitor blogs. — [tl;dv: Fireflies vs Fathom](https://tldv.io/blog/fireflies-vs-fathom/); [tl;dv best meeting assistants](https://tldv.io/blog/best-ai-meeting-assistants/); [screenapp comparison](https://screenapp.io/blog/ai-meeting-notetakers-comparison)
- **Cluely-style tools**: a macOS/Windows desktop app that captures audio without joining as a bot. It sends audio to cloud LLMs and shows suggestions in a semi-transparent overlay, and competitors claim it also OCRs the screen. The "undetectable" mode, which hides the overlay from screen share, is only in the top tier. — [builts.ai](https://builts.ai/blog/what-is-cluely/); [CoPrep review](https://www.coprep.ai/blog/cluely-review-2026-pricing-features-pros-and-cons); [Final Round AI](https://www.finalroundai.com/blog/cluely-review-pros-cons)

**Speaker separation (diarization)**
- AssemblyAI streaming diarization tags each turn event with a `speaker_label` ("A" or "B"). A `max_speakers` hint (1–10) improves accuracy, and multichannel input separates speakers by channel. The vendor says turns arrive in about 221 ms and that "200ms of diarization latency is fine. Two seconds isn't." — [AssemblyAI diarization docs](https://www.assemblyai.com/docs/streaming/label-speakers-and-separate-channels); [AssemblyAI streaming diarization blog](https://www.assemblyai.com/blog/streaming-speaker-diarization)

### Inferences
- Nearly every enterprise product separates speakers by channel (CCaaS stereo or softphone tap). Acoustic diarization of a single mixed mic is a fallback. A speakerphone feeding the Chrome Web Speech API gives one mixed channel with no speaker labels. So the prototype cannot reliably tell whether the client or the advisor asked a question. Products that do separate speakers rely on that to trigger on customer questions only (Dialpad, Google). Options include a softphone or VoIP integration that exposes both legs, a headset for the advisor plus line capture for the client, or a streaming ASR with diarization or multichannel support (e.g. AssemblyAI).
- The Cresta Knowledge Agent and Cluely designs (browser or desktop, ambient, screen context) are closest to the prototype's form factor. Cresta adds reading the CRM context on screen, such as client type or VAT status, to personalise answers.

### Gaps
- No primary documentation on how Cresta's browser extension captures audio (tab audio, microphone, or a CCaaS stream).
- Gong: no confirmed real-time product. Fireflies "Live Assist" is confirmed only by third-party blogs.
- Chrome Web Speech API privacy and diarization limits could not be researched (search budget exhausted).

---

## 2. Trigger design: automatic detection vs. manual, and avoiding alert fatigue

### Takeaway
Trigger designs range from three kinds. Admin-authored keyword or phrase triggers (Dialpad, Balto checklists). Model-based intent or question detection over finalized turns (Cresta, Google PGKA). And pull-based asking (NICE search bar, Teams/Zoom/Otter questions, Gong Assistant). The better systems trigger only on finalized utterances, can restrict triggers to the customer's speech, and let admins tune specificity. No vendor publishes how many suggestions they show per call.

### Cited Findings
- Google PGKA triggers on customer messages by default. `suggestion_trigger_event` can switch this to agent messages or end-of-utterance events. It returns one primary query, used for the automatic search, plus alternative queries the agent can run by hand. — [Google PGKA docs](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/pgka)
- PGKA V2 (GA June 2026) added "granular control over triggering events". — [Agent Assist release notes](https://cloud.google.com/agent-assist/docs/release-notes)
- Google's best practice is to evaluate with a "golden set" of about 20–30 examples representing your business needs. — [Google PGKA best practices](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/pgka-bp)
- Dialpad's guidance: the ideal trigger phrase is "specific enough to avoid over-triggering in irrelevant contexts, but general enough to include most relevant contexts". Phrases that break the formatting guidelines won't fire, and ungrammatical phrases trigger less reliably. Cards can be set to fire on rep speech, customer speech, or both. — [Dialpad best practices](https://help.dialpad.com/docs/real-time-assist-cards-custom-moments-best-practices); [Dialpad Custom Moments](https://help.dialpad.com/hc/en-us/articles/55071217349659-Custom-Moments)
- AssemblyAI reference pattern: "Only act on finalized turns". Partial transcripts update the UI but should not trigger the LLM. — [AssemblyAI build agent assist](https://www.assemblyai.com/blog/build-real-time-agent-assist); [AssemblyAI voice agent guide](https://www.assemblyai.com/blog/real-time-speech-to-text-for-voice-agents)
- A G2 reviewer complained that Cresta's knowledge-assist model "is not very accurate in understanding the overall caller's intent, so the questions/answers it identifies are not relevant". This is evidence of false-positive and irrelevant-trigger risk even in a leader. — via [eesel Cresta review](https://www.eesel.ai/blog/cresta-review)
- NICE Copilot is pull-based through a search bar, and one- or two-word inputs fall back to keyword search. — [NICE help](https://help.nicecxone.com/content/agent/cxoneagent/enlightencopilotforagentscxa.htm)
- Teams Copilot must be started manually from the call controls. Zoom in-meeting questions are user-initiated. Otter's 2025 Meeting Agent required a wake phrase and did not volunteer answers. — [Microsoft Support](https://support.microsoft.com/en-us/teams/copilot/use-copilot-without-transcribing-or-recording-a-teams-meeting-or-call); [Zoom/GetVoIP](https://getvoip.com/blog/zoom-ai-companion/); [Forbes on Otter](https://www.forbes.com/sites/barrycollins/2025/03/25/now-you-can-talk-to-otters-ai-assistant-during-meetings/)
- Fathom's in-call interaction is a manual highlight button or hotkey. — [tl;dv: Fireflies vs Fathom](https://tldv.io/blog/fireflies-vs-fathom/)
- **Analogue evidence on alert fatigue (no agent-assist study found):**
  - Clinical decision support: a Swiss hospital system used pharmacists to filter alerts and got 72.4% acceptance. — [Swiss Medical Weekly](https://smw.ch/index.php/smw/article/view/3357)
  - Adaptive changes to an ED pulmonary-embolism tool lowered trigger rates and raised adoption 4.5- and 3-fold. — [PMC6401673](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6401673/)
  - A systematic review found GPs disregarding pertinent reminders because of alert fatigue. — [PMC11845892](https://pmc.ncbi.nlm.nih.gov/articles/PMC11845892/)
  - Security operations: 67% of alerts are ignored because of false-positive volume (Vectra 2023, cited by IBM). — [IBM](https://www.ibm.com/think/insights/alert-fatigue-reduction-with-ai-agents)

### Inferences
- The prototype has an always-on question detector plus a manual "Help me now" button. That hybrid matches where the market is heading: Google added an "on-demand assistant" alongside proactive suggestions in September 2026.
- Ways to cut false positives, drawn from the sources above:
  - Trigger only on finalized, end-of-utterance turns.
  - Trigger only on the client's speech, which needs speaker separation.
  - Require a domain-relevance classifier, e.g. tax or accounting topics only.
  - Suppress a card when retrieval finds no grounded answer.
  - De-duplicate repeated questions.
  - Tune against a 20–30-example golden set of real call snippets, following Google's guidance.
- Treat card acceptance and dismissal rate as the core health metric; clinical decision support shows adoption rises when the trigger rate falls.

### Gaps
- No vendor publishes suggestions-per-call, precision/recall of question detection, or suppression thresholds.
- No peer-reviewed acceptance-rate study for live agent assist was found.

---

## 3. Latency: from utterance end to card on screen

### Takeaway
No major vendor publishes an audited end-to-end latency figure. The figures available are vendor or reviewer claims: "sub-200 ms" for Cresta, 1.2 s average in a 60-seat trial, and streaming ASR finals in about 150–300 ms. A plausible budget is roughly 0.3 s ASR final, plus endpointing, plus retrieval, plus LLM. The prototype's ~1 s quick answer is competitive, and 3–5 s for a sourced answer is slower than what vendors claim for retrieval over pre-indexed KBs.

### Cited Findings
- Cresta markets "near-zero latency" with task-specific models but gives no millisecond figure. — [Cresta Agent Assist](https://cresta.com/agent-assist)
- Crescendo's roundup claims Cresta coaching under 200 ms. A Retell reviewer who ran a 60-seat trial reported the agent-assist sidebar "fired prompts within 1.2 seconds of customer utterance on average". Another Retell page claims under 200 ms. These conflict, and all are unverified. — [Crescendo](https://www.crescendo.ai/blog/best-real-time-agent-assistance); [Retell contact-center AI](https://www.retellai.com/blog/best-contact-center-ai-solutions); [Retell automation tools](https://www.retellai.com/blog/best-contact-center-automation-tools)
- Fireworks hosts Cresta's Knowledge Assist inference for "low-latency, high-availability" serving. — [Fireworks](https://fireworks.ai/blog/story-cresta-knowledge-assist)
- AssemblyAI vendor claims, which conflict across pages:
  - 307 ms median time to final transcript (Pipecat benchmark, Universal-3.6 Pro Realtime). — [AssemblyAI agent assist](https://www.assemblyai.com/solutions/voice-agents-agent-assist)
  - About 150 ms P50 for partials and finals. — [AssemblyAI streaming STT](https://www.assemblyai.com/products/streaming-speech-to-text)
  - About 300 ms P50 in its implementation guide. — [AssemblyAI implementation guide](https://www.assemblyai.com/blog/how-does-real-time-agent-assist-work-an-implementation-guide)
  - min_latency vs max_accuracy modes. — [AssemblyAI 2026 roundup](https://www.assemblyai.com/blog/best-api-models-for-real-time-speech-recognition-and-transcription)
- Endpointing trade-off: aggressive endpointing cuts latency but risks cutting speakers off. Suggested monitoring is P50/P95/P99 end-to-end, with "P95 > 800ms: Warning" as an example alert. — [AssemblyAI build agent assist](https://www.assemblyai.com/blog/build-real-time-agent-assist)
- Google research separates partial-recognition latency from endpointer latency. A joint endpointing model cut median endpoint latency by 130 ms at a cost of +0.3% WER. — [arXiv 2004.11544](https://arxiv.org/pdf/2004.11544); [arXiv 2011.10798](https://arxiv.org/pdf/2011.10798)
- Google's release notes show latency work on summarization (V3.1 "reduces latency and improves quality" over V3.0) but give no figure for generative knowledge assist. — [Agent Assist release notes](https://cloud.google.com/agent-assist/docs/release-notes)

### Inferences
- Techniques implied by the sources:
  - Streaming ASR with partials shown live and LLM calls fired only on finals.
  - Retrieval over a pre-indexed approved KB rather than live web search. This is the main reason vendors can be faster than the prototype's 3–5 s web-search path.
  - Extracting conversation context as key-value pairs to sharpen queries (Google).
  - Dedicated low-latency inference hosting (Cresta/Fireworks).
- For the prototype, a likely big win is pre-indexing Skatteverket and skat.dk pages, or caching answers to frequent questions such as rates, deadlines and thresholds. Then the "sourced" tier comes from local retrieval in about 1–2 s, and live web search becomes a fallback. Instrument P50/P95 per stage.

### Gaps
- No vendor-published utterance-end-to-card latency for Google, Dialpad, Balto, Observe.AI, NICE, Genesys or Salesforce.
- The Cresta latency claims could not be checked against a primary source.

---

## 4. Knowledge grounding, citations, confidence and hallucination control

### Takeaway
Leading products ground answers in a curated, approved knowledge base: connectors to SharePoint, Zendesk, Salesforce, PDFs, and so on. They return source links or metadata with each answer. Rich confidence indicators are rare in public material. Regulated-industry guidance stresses RAG over approved content only, guardrails enforced in the system architecture rather than just the prompt, human review, and audit trails.

### Cited Findings
- Cresta Knowledge Agent produces "precise, cited answers" with links to sources in real time. Fall '23 Knowledge Assist generated responses that "link back to the source". — [Cresta blog](https://cresta.com/blog/introducing-knowledge-agent-real-time-answers-right-where-agents-work); [Cresta Fall '23](https://cresta.com/blog/introducing-our-fall-23-release-leveraging-generative-ai-to-empower-better-outcomes)
- Google: if knowledge documents have metadata configured, both generative KA and PGKA return it with the answer, and the UI modules display certain metadata keys automatically. — [Google UI modules / GKA docs](https://docs.cloud.google.com/agent-assist/docs/generative-knowledge-assist)
- Google's feedback payload (`answerFeedback`) records whether an answer was displayed or clicked, a `correctnessLevel`, whether it was copied, and which source URIs were clicked. This is effectively an implicit plus explicit quality signal. — [Google GKA docs](https://docs.cloud.google.com/agent-assist/docs/generative-knowledge-assist); [Backend modules](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/backend-basics)
- NICE says its Copilot "works best when paired with a strong knowledge system like NiCE Knowledge Management", its "single source of truth". — [NICE copilots](https://www.nice.com/products/copilots)
- Microsoft's D365 Copilot answers are "grounded on your trusted knowledge sources". — [Microsoft blog](https://blogs.microsoft.com/blog/2024/06/04/announcing-dynamics-365-contact-center-a-copilot-first-cloud-contact-center-to-transform-service-experiences/)
- Uniphore markets "trusted answers". — [Uniphore brochure](https://www.uniphore.com/document-library/brochures/brochure-real-time-guidance-agent-2-pager.pdf)
- Financial-services guardrail patterns (vendor blogs, not regulators):
  - Answer only from "approved, current content". — [IrisAgent](https://irisagent.com/blog/fintech-support-compliance-ai-guardrails/)
  - Post-LLM checks for hallucination and output compliance, and checks preventing "advice that can't legally be given". — [Gradient Labs](https://gradient-labs.ai/blog/agent-and-customer-guardrails-protecting-both-sides-of-financial-services)
  - "The guardrail has to live in the architecture, not the prompt." — [fin.ai](https://fin.ai/learn/evaluate-ai-agent-compliance-financial-services)
  - Human approval for high-risk finance and compliance actions. — [Atlan](https://atlan.com/know/ai-agent-risks-guardrails/)
- Claim on a vendor page: the CFPB has said incorrect information from an AI chatbot can be a UDAAP violation (verify with CFPB). — [IrisAgent](https://irisagent.com/blog/fintech-support-compliance-ai-guardrails/)
- Intuit's model for tax: the tax-calculation knowledge engine is paired with Claude on Amazon Bedrock to generate explanations, and human experts on its Virtual Expert Platform get "Intuit Assist for experts". 24M customers used Intuit Assist in a tax season (vendor claim). The sources do not confirm a live in-call copilot for experts. — [Intuit blog](https://www.intuit.com/blog/innovative-thinking/tech-innovation/how-intuit-transformed-tax-filing-experiences/); [Intuit press](https://investors.intuit.com/news-events/press-releases/detail/1229/intuits-ai-driven-expert-platform-redefines-tax-filing-with-done-for-you-experiences)
- In an early-2026 sandbox report on AI transcription, Sweden's IMY flagged **automation bias**: staff accepting AI output without scrutiny. — [Qualtranscribe summary](https://www.qualtranscribe.com/blog/eu-ai-act-ai-transcription-researchers); [Lynes](https://lynes.io/en/blog/recording-calls-gdpr)

### Inferences
- The prototype's "unverified quick answer" tier is the riskiest element under these norms; no enterprise vendor found markets an ungrounded fast answer.
- Ways to mitigate it:
  - Label it visibly ("Unverified – AI draft"), visually subordinate it, and replace or mark it when the sourced answer disagrees.
  - Or ground even the quick tier in a cached or pre-indexed set of official pages (Intuit's model pairs a deterministic tax engine with an LLM for explanation).
  - Keep exact figures (rates, thresholds, dates) in a curated, versioned table rather than letting the LLM generate them.
- The domain-restricted web search to Skatteverket and skat.dk matches the "approved sources" principle. Show the exact URL plus the page's last-updated date or tax year in the citation.
- Log every card shown, the source, the advisor's action and feedback, as Google's `answerFeedback` does. This gives an audit trail for regulated advice.

### Gaps
- No public detail on numeric confidence indicators in any product UI.
- No FCA, FINRA, Skatteverket or Danish regulator guidance specific to live AI assist was found.

---

## 5. UX: cards, length, feedback, summaries, CRM autofill, compliance checklists

### Takeaway
Typical UX is a sidebar or panel next to the live transcript. It holds short action cards or answers with source links, checklists or compliance prompts (Balto), and running and after-call summaries (NICE, Salesforce, Teams). Feedback is captured explicitly (rating) and implicitly (displayed, clicked, copied). The answer-card format with a citation link has become standard. Public specs on word counts or number highlighting were not found.

### Cited Findings
- Balto: "smart checklists and dynamic prompts" on the agent's screen. — [CX Today](https://www.cxtoday.com/contact-center/balto-launches-an-app-free-version-of-its-platform/)
- Balto says real-time guidance raised compliance rates from 30% to nearly 70% (vendor claim). — [Balto real-time agent assist](https://www.balto.ai/real-time-agent-assist/)
- Dialpad AI Live Coach Cards have a name, trigger keywords and an agent response. They come from templates or are built from scratch, and are scoped per team. — [Dialpad help](https://help.dialpad.com/docs/ai-live-coach-cards)
- Salesforce: the AI Service Assistant panel sits next to the real-time transcript and customer profile, with summaries, suggested replies and next steps. — [CMSWire](https://www.cmswire.com/contact-center/salesforce-agentforce-contact-center-review-strengths-gaps-and-how-it-compares-to-rivals/)
- NICE: KB answers can include process steps, web links and images. Real-time summaries update during the interaction but cannot be edited. Transfer and journey summaries and AutoSummary are included. — [NICE help](https://help.nicecxone.com/content/agent/cxoneagent/enlightencopilotforagentscxa.htm)
- Cresta: answers appear "right where agents work" (in-browser sidebar) to cut tab-switching, and are tailored using on-screen CRM fields. — [CX Today](https://www.cxtoday.com/ai-automation-in-cx/cresta-launches-knowledge-agent-to-reduce-agent-tab-switching/)
- Google returns one auto-searched primary query plus alternative suggested queries the agent can click. It captures displayed, clicked, copied, correctness and URI-clicked feedback. — [Google PGKA](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/pgka); [Google GKA](https://docs.cloud.google.com/agent-assist/docs/generative-knowledge-assist)
- Zoom answers appear in a private side panel that others can't see, and in-meeting questions are not shared with the host. — [GetVoIP](https://getvoip.com/blog/zoom-ai-companion/)
- Teams "only during the call" mode generates notes and tasks live but keeps nothing afterwards. — [Microsoft Support](https://support.microsoft.com/en-us/teams/copilot/use-copilot-without-transcribing-or-recording-a-teams-meeting-or-call)
- Fathom uses a one-click or hotkey highlight to mark moments mid-call. — [tl;dv](https://tldv.io/blog/fireflies-vs-fathom/)
- Cluely shows a semi-transparent overlay, hidden from screen share in its top tier. — [builts.ai](https://builts.ai/blog/what-is-cluely/)
- After-call work: Google says Agent Assist reduces after-call work time and AHT by automating post-interaction workflows. — [Google Agent Assist](https://cloud.google.com/agent-assist)
- An Observe.AI customer cut After-Call Work by 50% (Accolade, secondary source). — [Knowmax](https://knowmax.ai/feeds/blog/agent-assist-platforms-reducing-average-handle-time)

### Inferences
- UX ideas transferable to the prototype:
  - One primary answer card plus 1–2 "related questions" chips (Google pattern).
  - A source link on every sourced card.
  - Personalisation from client context: entity type, VAT registration, tax year (Cresta Context Fields).
  - A "Help me now" hotkey, plus a mark-moment hotkey (Fathom) to flag things for follow-up.
  - Implicit feedback logging (shown, expanded, copied, source clicked) plus thumbs up/down.
  - An after-call summary drafted into the CRM or practice-management notes.
  - A compliance or checklist panel for mandatory disclosures, e.g. "this is general information, not formal advice", or KYC questions.
- Keep cards terse, with the key number first, because the advisor is speaking. This is an inference; no public spec on word counts was found.

### Gaps
- No vendor-published card word limits, number-highlighting conventions, pinning behaviour or thumbs-up/down specifics. The Cresta and Google feedback mechanisms are confirmed only in general terms.

---

## 6. Measured outcomes

### Takeaway
The only rigorous evidence is the QJE 2025 study (Brynjolfsson, Li, Raymond) of an LLM agent-assist tool: about +15% resolutions per hour, with the largest gains for novices. Vendor case studies cite 8–23% AHT reductions and faster ramp, mostly without control groups or published method.

### Cited Findings
- "Generative AI at Work" (QJE vol. 140, no. 2, 2025, pp. 889–942) studied 5,172 support agents at a Fortune 500 software firm using a GPT-3-based assistant:
  - Resolutions per hour rose about 15% on average.
  - Less-experienced and lower-skilled agents improved in both speed and quality; top agents gained little speed and lost a little quality.
  - Gains were largest on moderately rare problems.
  - Customers were more polite and less likely to escalate to a manager.
  - The 2023 working paper reported 14% average and 34% for novices.
  — [QJE PDF](https://academic.oup.com/qje/article-pdf/140/2/889/61701561/qjae044.pdf); [NBER w31161](https://www.nber.org/papers/w31161); [RePEc](https://ideas.repec.org/a/oup/qjecon/v140y2025i2p889-942..html)
- Cresta (vendor-reported, no control group described): United Airlines -15% handle time (chat team); Brinks Home -8% AHT. A "40% AHT reduction" at Snap Finance comes from a third-party source and is tied to containment rather than assist. — [Cresta AI customer engagement guide](https://cresta.com/guides/ai-customer-engagement); [Cresta guides](https://cresta.com/guides/ai-agents-for-customer-experience); [Maven AGI](https://www.mavenagi.com/blog/cresta-reviews)
- Balto (vendor sales claims via a third party): +16% sales, 53-second AHT reduction, 65% faster ramp. Balto's own page: compliance up from 30% to about 70%. Balto blog: real-time prompts cut AHT 20–30%. — [alpharun](https://www.alpharun.com/blog/balto-ai-pricing); [Balto](https://www.balto.ai/real-time-agent-assist/); [Balto blog](https://www.balto.ai/blog/how-agent-assist-ai-improves-customer-support/)
- Balto reports more than 75M calls guided. — [CB Insights](https://www.cbinsights.com/research/?p=129109)
- Observe.AI (vendor blog, pre-2025): a customer cut AHT 23% and handled 24% more calls with real-time prompts. A financial-services customer cut hold-time violations by 60%. — [Observe.AI blog](https://www.observe.ai/blog/top-4-reasons-contact-centers-need-real-time-ai); [Observe.AI compliance blog](https://www.observe.ai/blog/real-time-ai-compliance)
- ResultsCX telecom case (vendor unnamed): 50% faster onboarding and 20% AHT reduction in two months. — [ResultsCX](https://resultscx.com/case-study/ai-driven-agent-assist-drives-faster-agent-onboarding-reduction-in-aht-for-telecom/)
- EXL LLM agent-assist case: 12–15% AHT reduction. — [EXL](https://www.exlservice.com/insights/case-study/smart-agent-assist)
- Caveat: AHT can rise when agents use freed time for sales or deeper service, so AHT alone can mislead. — [TechTarget](https://www.techtarget.com/enterprise-software/tip/How-agent-assist-technology-works-in-the-contact-center)
- Google's Agent Assist metrics: CX Insights computes metrics from Agent Assist conversation data, and suggestion feedback (displayed, clicked, copied) feeds measurement. — [Google CX Insights metrics](https://docs.cloud.google.com/contact-center/insights/docs/agent-assist-metrics)

### Inferences
- For an accounting-firm pilot, measure:
  - Questions answered on the call vs "I'll get back to you" (a first-contact-resolution proxy).
  - Follow-up emails and callbacks avoided.
  - Junior-advisor ramp time; QJE suggests the biggest gains are for less-experienced advisors.
  - Card acceptance rate.
  - Factual error rate from expert review of logged cards.
- Use a simple A/B (with vs without copilot) or before/after with matched advisors. Vendor numbers lack controls.

### Gaps
- No controlled first-call-resolution study for any named vendor.
- No outcome data for professional-services or tax-advice settings.

---

## 7. Privacy and compliance: consent, retention, EU hosting, regulated advice

### Takeaway
In the EU, the main issues are three. GDPR lawful basis and notice for recording and transcription; residency alone is not required, but processing location and sub-processors matter. The EU AI Act ban on inferring *workers'* emotions, in force since February 2025, which bites on Cogito-style agent emotion and behaviour scoring. And retention controls, of which Teams' "only during the call" mode is an instructive model. Vendor-specific EU-hosting confirmation was mostly not found.

### Cited Findings
- **EU AI Act Article 5(1)(f)** has prohibited emotion recognition in the workplace since February 2025:
  - The Commission's guidelines give a call-centre example as prohibited: voice analysis to tell whether *employees* are angry or impatient.
  - Tracking *customers'* emotions in a call centre is out of scope of the ban.
  - Text-only sentiment is generally outside it.
  - Fines run up to €35M or 7% of global annual turnover.
  - High-risk obligations for emotion recognition (Annex III) were reportedly deferred to 2 December 2027.
  — [Covington InsidePrivacy](https://www.insideprivacy.com/artificial-intelligence/european-commission-guidelines-on-prohibited-ai-practices-under-the-eu-artificial-intelligence-act/); [CMS](https://cms.law/en/gbr/legal-updates/eu-commission-issues-guidelines-on-prohibited-ai-practices-part-ii); [CX Today](https://www.cxtoday.com/contact-center/contact-center-emotion-ai-eu-rules/); [UC Today](https://uctoday.com/eu-ai-act-shock-emotion-recognition-is-now-illegal-at-work-so-why-is-your-vendor-still-selling-it)
- **Sweden, recording:** a participant may generally record a call they are part of (Penal Code 4:9a targets secret recording by non-participants). Once recordings are stored or AI-analysed, GDPR requires a lawful basis (consent or legitimate interest) and notice. Sources conflict on whether consent is needed or notification is enough. The safe practice is to announce at the start of every call. — [salesprep.ai](https://salesprep.ai/blog/recording-sales-calls-gdpr-sweden); [Lynes](https://lynes.io/en/blog/recording-calls-gdpr); [Plaud](https://plaud.se/en/blog/can-you-record-meetings-and-conversations-at-work-heres-what-the-law-says); [Teneks Nordics guide](https://www.teneks.ai/blog/call-recording-laws-baltic-nordic-guide)
- The organisation remains data controller and cannot hand GDPR compliance off to the transcription vendor. — [Qualtranscribe](https://www.qualtranscribe.com/blog/eu-ai-act-ai-transcription-researchers)
- GDPR does not require EU residency; Chapter V transfers via adequacy or SCCs are allowed. But processing location, including LLM inference calls, matters, and an EU region does not equal sovereignty. — [sitegpt](https://sitegpt.ai/resources/chatbot-data-residency); [aona.ai](https://aona.ai/resources/guides/ai-data-residency-requirements-eu-uk/); [particula](https://particula.tech/blog/eu-ai-act-data-sovereignty-residency)
- **Microsoft Teams**: in "only during the call/meeting" mode no transcript is kept after the call. Copilot prompts and responses may still be retained under Microsoft Purview policies. Admins enforce it through the Teams calling policy. — [Microsoft Learn](https://learn.microsoft.com/en-us/microsoftteams/copilot-teams-calling-transcription); [Microsoft Support](https://support.microsoft.com/en-us/teams/copilot/use-copilot-without-transcribing-or-recording-a-teams-meeting-or-call)
- **Zoom**: attendees are notified when Meeting AI Companion is on, and hosts control who may ask questions. — [Wharton](https://support.wharton.upenn.edu/help/zoom-ai-companion)
- **Dialpad**:
  - Retention policies, DSAR support and consent mechanisms; an exception list can skip recording and transcription for chosen country or area codes; the Trust Center lists GDPR, EU-US DPF and EU AI Act. — [Dialpad GDPR blog](https://www.dialpad.com/blog/call-recording-gdpr-compliance/); [Dialpad Trust Center](https://trust.dialpad.com/)
  - EU data residency is listed by a 2026 third-party review, but an older Dialpad/T-Mobile page says data is stored in the US on GCP. These conflict. — [revops.tools](https://revops.tools/dialpad/); [T-Mobile/Dialpad](https://www.t-mobile.com/business/solutions/dialpad)
- **tl;dv** is noted for EU data hosting. — [tl;dv comparison](https://tldv.io/blog/fireflies-vs-fathom/)
- **Otter** faces a federal class action in the US over consent practices. — [Zapier/roundups](https://zapier.com/blog/best-ai-meeting-assistant/)
- **Cluely**: a competitor alleges a 2025 data breach affecting 83k users (unverified). Its "undetectable" design is ethically and legally problematic for consented advice calls. — [Final Round AI](https://www.finalroundai.com/blog/cluely-review-pros-cons)

### Inferences
- For a Swedish or Danish accounting firm:
  - Announce AI transcription at call start and document the lawful basis (legitimate interest plus notice, or consent).
  - Default to no audio retention, with transcript retention set by policy.
  - Keep ASR and LLM processing under a DPA. Anthropic's API and Google's Web Speech backend are both non-EU processors, so check transfer mechanisms.
  - Avoid any advisor emotion or behaviour scoring; customer-side signals are allowed.
- Prefer a Teams-style "ephemeral" mode where transcript and cards vanish after the summary is approved.

### Gaps
- No confirmed EU-hosting statements found for Cresta, Balto, Observe.AI or Level AI.
- No IMY primary guidance was retrieved.
- No regulator guidance (Skatteverket, Revisorsinspektionen, FAR, Danish FSR) on AI assist in tax-advice calls was found.

---

## 8. Pricing

### Takeaway
Enterprise agent assist is almost always quote-based. Indicative ranges are $50–150 per agent per month for standalone real-time guidance, bundled CCaaS seats of $75–250 per month, or usage pricing (Google: $0.03 per voice minute). Consumer real-time tools cost $20–150 per month.

### Cited Findings
- **Google Agent Assist** (official pricing page): Voice Standard, which includes transcription, summarization and knowledge assist, is $0.03/min. Voice Summarization alone is $0.02/min. Chat Standard is $0.002 per count. Knowledge assist on a datastore without a conversation ID is $0.012 per request. An older page lists Chat at $0.06/session. — [Google Agent Assist pricing](https://cloud.google.com/agent-assist/pricing); [Gemini Enterprise for CX Agent Assist](https://cloud.google.com/gemini-enterprise-cx/agent-assist)
- **Cresta**: AWS Marketplace listing at $150,000/year for up to 100,000 calls or 125,000 chats (Agent Assist only), with overage at $1.50/call and $1.20/chat. — [getmacha](https://www.getmacha.com/blog/cresta-ai-complete-guide); [AWS Marketplace](https://aws.amazon.com/marketplace/pp/prodview-lmdwown6xoo6q)
- **Balto**: quote-based; estimates of about $100+/user/month (third party). Capterra lists "$29/user/month", which is possibly a placeholder. The category runs $50–150 per agent per month at scale. — [Sonant](https://www.sonant.ai/blog/balto-alternative-review); [Capterra](https://www.capterra.com/p/169149/Balto/); [alpharun](https://www.alpharun.com/blog/balto-ai-pricing)
- **Observe.AI**: quote-based. Third-party estimate of about $69/agent/month entry, and $60k–180k/year for 100 seats. — [getmacha](https://www.getmacha.com/blog/observe-ai-complete-guide)
- **Level AI**: quote-only. — [eesel](https://www.eesel.ai/blog/cresta-alternatives)
- **Dialpad**: Contact Center from about $95/agent/month (Vendr), or Essentials $80, Advanced $115, Premium $150. Sources conflict. — [getmacha Dialpad](https://www.getmacha.com/blog/dialpad-ai-complete-guide); [CloudTalk](https://www.cloudtalk.io/blog/dialpad-pricing/)
- **Genesys Cloud CX**: CX1 $75, CX2 $115, CX3 $155, CX4 $240 per user per month (annual billing). Agent Copilot is metered in AI Experience tokens: 40/user named, 60/user concurrent. — [Genesys tokens model](https://help.genesys.cloud/articles/genesys-cloud-tokens-model/); [getmacha Genesys](https://www.getmacha.com/blog/genesys-cloud-ai-complete-guide)
- **NICE CXone Mpower**: about $110–249 per agent per month (third party). — [getmacha NICE](https://www.getmacha.com/blog/nice-cxone-mpower-complete-guide)
- **Five9**: AI Agent Assist, AI Knowledge and Summaries are listed in the Digital ($119) and Core ($159) seat bundles, with a 50-seat minimum. Third parties say AI is an add-on. These conflict. — [Five9 pricing](https://www.five9.com/products/pricing); [Platform28](https://www.platform28.com/blog/five9-pricing-breakdown)
- **Microsoft**: in-call Copilot needs Microsoft 365 Copilot plus Teams Phone licences (third-party blog). — [erik365](https://erik365.blog/2025/08/05/microsoft-copilot-in-teams-calls-without-transcription-or-recording/)
- **Cluely**: free Starter tier; Pro $19.99/month; Pro + Undetectability $149.99/month as of September 2026. Other sources say $75. — [LastRound AI](https://lastroundai.com/compare/cluely/pricing); [CoPrep](https://www.coprep.ai/blog/cluely-review-2026-pricing-features-pros-and-cons)

### Inferences
- At $0.03 per minute (Google's voice rate) a 30-minute advice call costs about $0.90 for ASR, summary and knowledge assist. That gives a reference point for the prototype's per-call cost of Web Speech plus Haiku plus Sonnet with web search, which should be tracked per call.

### Gaps
- No official per-agent prices for Cresta, Balto, Observe.AI, Level AI, Uniphore or Cogito/Verint.
- No Salesforce Agentforce Service Assist pricing was found.
