# Vapi setup (EU region)

Sources for everything here: the Vapi docs repo (`github.com/VapiAI/docs`, checked 2026-09-30) and its OpenAPI spec.

## 1. EU organisation

- Create the org at **https://dashboard.eu.vapi.ai**. The API is `https://api.eu.vapi.ai`.
- Each org belongs to one region, and the regions are isolated. The signup flow for EU orgs isn't documented; contact Vapi if the dashboard puts you in the US region.
- **Org settings → Zero Data Retention: ON.** With ZDR, Vapi keeps no recordings, transcripts, messages, summaries or structured outputs; only call history, cost and billing remain. The end-of-call report is still delivered to us.
- Ask Vapi (security@vapi.ai / https://security.vapi.ai) for:
  - **DPA + SCCs** and the **sub-processor list** (not published in the docs)
  - confirmation that ZDR and Twilio number import work on EU orgs
  - which AWS region the EU org runs in (the egress IPs suggest Frankfurt)

## 2. Credentials (dashboard → Integrations/Credentials)

| Credential | Values | Env var for sync |
|---|---|---|
| **Azure OpenAI** | region `swedencentral`, models `gpt-5.4-mini`, key and endpoint of `oai-rkjh-ai-prod`. The deployment name must equal the model id. | `VAPI_AZURE_OPENAI_CREDENTIAL_ID` |
| **Azure Speech** | service `speech`, region `swedencentral`, key of `spch-rkjh-ai-prod` | `VAPI_AZURE_SPEECH_CREDENTIAL_ID` |
| **Custom credential – HMAC** | secret = Key Vault `vapi-webhook-secret`; algorithm sha256; signature header `x-signature`; timestamp header `x-timestamp`; include timestamp: on; payload format `{timestamp}.{body}`; hex | `VAPI_WEBHOOK_CREDENTIAL_ID` |

The API is tolerant of how Vapi formats the timestamp (seconds, milliseconds or ISO) and whether the signature is hex or base64. It enforces a ±5 minute window. If HMAC ever misbehaves:

- Create a **Bearer** credential instead: header `X-Vapi-Secret`, bearer prefix off.
- Set `VAPI_WEBHOOK_AUTH_MODE=bearer` on `func-voice`.

## 3. Sync assistants, tools and squad

```bash
export VAPI_API_KEY=… VOICE_API_BASE_URL=https://func-rkjh-ai-prod-voice.azurewebsites.net \
       VAPI_WEBHOOK_CREDENTIAL_ID=… VAPI_AZURE_OPENAI_CREDENTIAL_ID=… VAPI_AZURE_SPEECH_CREDENTIAL_ID=… \
       TWILIO_NUMBER_E164=+4610… TWILIO_ACCOUNT_SID=… TWILIO_API_KEY=… TWILIO_API_SECRET=…
npm run vapi:sync -- --env prod            # dry run: prints what would be created/updated
npm run vapi:sync -- --env prod --apply    # writes vapi/state.prod.json (git-ignored)
```

What gets created:

- **Tools:**
  - `search_knowledge`, `resolve_staff`, `check_availability`, `book_meeting`, `transfer_to_staff` and `take_message`, which call `POST /api/vapi/events` with the HMAC credential
  - `transferCall` with no static destinations, so it is resolved server-side through `transfer-destination-request`
  - `endCall`, which is rejected unless the caller said goodbye
  - `handoff_to_english` / `handoff_to_swedish`
- **Structured outputs** `call_summary_sv` and `call_fields`, run on the same Azure model.
- **Assistants** `rkjh-sv` (Azure STT sv-SE, `sv-SE-SofieNeural`) and `rkjh-en` (en-GB, `en-GB-SoniaNeural`):
  - recording, logging and PCAP off
  - transcript on, delivered in the report
  - `maxDurationSeconds` 900
- **Squad** `rkjh-reception`.
- **Phone number** (Twilio import) with **no assistant attached**. Every call triggers `assistant-request` to our API, which returns the squad plus per-call variables: time, open/closed, core facts and inline knowledge base.

Afterwards, copy the squad ID into `vapiSquadId` in the Bicep params and redeploy, or set `VAPI_SQUAD_ID` on `func-voice`.

## 4. Transfers

1. `transfer_to_staff` validates everything server-side:
   - office hours
   - `transferable`
   - a direct number exists
   - the number is not on `blockedTransferNumbers`, which includes the Twilio number and **the RKJH main number, to prevent a forwarding loop**
   - the per-call limit
2. It stores an approved transfer.
3. The model then calls `transferCall`, and Vapi asks us for the destination (`transfer-destination-request`). We return the stored staff number with `transferPlan.mode = "warm-transfer-experimental"`:
   - A short-lived **transfer assistant** calls the consultant, gives a one-line summary, and asks whether they'll take the call.
   - `transferCancel` fires on voicemail, no answer, busy or a declined call. With `fallbackPlan.endCallEnabled: false`, the caller returns to the receptionist, which offers to take a message.

## 5. Deletion

After each end-of-call report we queue `DELETE /call/{id}` (first attempt about 2 minutes later, then exponential backoff).

- The `call.deleted` / `call.delete.failed` webhooks, or the API response, mark the deletion as confirmed.
- The daily retention job alerts if anything is still unconfirmed after 24 h.
- With ZDR, Vapi should hold no content anyway. The DELETE removes the call from Vapi's call list. Exactly what it purges beyond that (e.g. billing metadata) isn't documented, so confirm with Vapi.

## 6. Vapi EU egress IPs (for optional inbound restriction on func-voice)

`3.74.75.238`, `3.77.231.137`, `3.120.216.209`, `3.127.10.26`, `63.182.246.187`, `63.184.196.2` (all /32). Re-check the Vapi docs before relying on these.

## Testing a call

1. Use the dev squad with a dev tunnel (see README).
2. Call the Twilio number directly (before forwarding is live) and try:
   - opening hours
   - "jag vill boka ett möte om bokslut nästa vecka"
   - "kan jag få prata med Anna"
   - switching to English mid-call
   - a request for tax advice (it must refuse and offer a booking or message)
3. Check that the call appears in the dashboard, that a Teams card arrives for messages, and that the call disappears from the Vapi dashboard within minutes.
