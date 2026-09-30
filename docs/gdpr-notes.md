# GDPR notes

This is an internal tool that processes **client personal data**: names, company, phone numbers, the reason for calling, and transcripts. It is not legal advice. RKJH should own the DPIA and the records of processing.

## Data map

| Data | Where | Retention |
|---|---|---|
| Call audio | Streamed through Twilio → Vapi → Azure Speech. **Not recorded** (`recordingEnabled: false`). | Not stored |
| Transcript, summary, structured fields | Vapi (EU org, ZDR: not retained) → our Postgres (Sweden Central, private network) | **30 days**, then hard-deleted |
| Messages, bookings, transfer log | Postgres | 30 days |
| Calendar event (caller name, company, phone, topic) | Consultant's Outlook (M365) | **Outside the 30-day purge.** It follows RKJH's normal M365 retention (open question from the plan) |
| Teams cards | Teams channel | Teams retention policy |
| Anonymous daily rollups (counts, durations, costs, outcomes, hour histogram) | Postgres | Kept indefinitely; contains no personal data |
| Dashboard audit log (who viewed which call ID) | Postgres | 1 year |
| Logs | App Insights | 30 days; phone numbers, e-mails and transcripts masked or never logged |
| Postgres backups | Azure (Sweden Central, no geo-redundancy) | 7 days, so deleted rows can survive in backups for up to 7 extra days |

## Processors and sub-processors: action items

| Party | Role | Location | Action |
|---|---|---|---|
| **Vapi** | Voice orchestration | EU region (AWS, likely Frankfurt); **US company** | Sign the DPA and SCCs, get the sub-processor list, enable ZDR, and record a transfer impact assessment (TIA) |
| **Twilio** | Telephony | US company; IE1 region optional | DPA/SCCs are part of Twilio's terms; record a TIA |
| **Microsoft** (Azure, M365) | Hosting, AI, calendar, Teams, email | Sweden Central / EU Data Boundary | Covered by the Microsoft DPA/Product Terms |
| Azure OpenAI Data Zone EU | LLM inference | EU/EFTA data zone | Switch to the regional `gpt-5.1` deployment if processing must stay in Sweden |
| Static Web Apps | Dashboard hosting | West Europe resource; global edge | Static assets hold no personal data. `/api` responses pass through the SWA edge |

## Transparency

- Callers hear at the start of every call: *"Du pratar med en AI-assistent, och samtalet transkriberas så att vi kan hjälpa dig."* ("You are talking to an AI assistant, and the call is transcribed so that we can help you.")
- Add a short section to RKJH's privacy notice on rkjh.se covering:
  - the purpose (handling enquiries, booking meetings)
  - the legal basis (legitimate interest / steps prior to a contract)
  - the 30-day retention
  - the processors
  - how to exercise data subject rights

## Data subject rights

- **Access:** search the call log by name or number; the call detail view shows everything stored.
- **Erasure:** dashboard → call → **Radera samtal (GDPR)** (admin only, audited). It deletes the call, transcript, messages, bookings rows and transfer log, and queues the Vapi deletion. Delete the Outlook event and the Teams card by hand if needed.

## Security measures (summary)

- **Network and hosting:** EU hosting. Postgres has private access only, Entra-only auth and TLS 1.3. Secrets live in Key Vault and are read through managed identities.
- **Webhooks:** HMAC-signed with a replay window.
- **Prompt-injection defence:** all limits are enforced server-side, and the model never supplies a phone number.
- **Dashboard auth:**
  - invite-only `@rkjh.se`
  - argon2id, breached-password check, lockout
  - TOTP required for admins
  - strict cookies, CSRF protection and CSP
- **Privacy:** masked logging and an audit log.
