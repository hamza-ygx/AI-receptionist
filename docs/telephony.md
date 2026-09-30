# Telephony: Twilio +46 number and call forwarding

## Recommendation: Twilio

- **Warm transfer.** Vapi documents its warm-transfer modes as supported on Twilio calls. Assistant-based warm transfer (`warm-transfer-experimental`, which we use) also works over SIP. Vapi documents no warm transfer for native Telnyx numbers, and warns about an A-law codec mismatch "on some calls outside North America".
- **Trade-off.** Telnyx is cheaper and offers geographic numbers (08, 035…), but a failed or looping transfer is the biggest user-facing risk here. Twilio is the safer choice.

## 1. Buy the number

1. Twilio Console → Phone Numbers → Regulatory Compliance → create a **Bundle** for Sweden, business end-user. You need:
   - company name: Revisionskonsulterna J Hägglund AB
   - organisationsnummer **559060-3766**
   - a Swedish business address with proof (registreringsbevis from Bolagsverket, or a utility bill)
   - no PO boxes
2. Buy a **national (010)** number. Twilio's Swedish inventory lists mobile, national and toll-free. Geographic 035 availability is unclear, and callers never see this number anyway, because they dial 035-17 55 70.
3. Create a **Twilio API key** (Account → API keys) for Vapi. Don't hand Vapi the account auth token.
4. Optional EU data residency: Twilio's IE1 (Dublin) region. Whether Vapi's native Twilio import works with IE1 numbers on an EU org isn't documented; ask Vapi. If it doesn't, use a Twilio Elastic SIP Trunk (IE1) → `sip.eu.vapi.ai` (BYO SIP number in Vapi). The transfer design still works over SIP.

## 2. Import into Vapi

`npm run vapi:sync -- --env prod --apply` imports the number (provider `twilio`, API key and secret) with **no assistant**, and sets the server URL for `assistant-request`. Add the number to `config/office.yaml → blockedTransferNumbers` and `TWILIO_NUMBER_E164`.

## 3. Forward RKJH's number

Set **unconditional call forwarding** (vidarekoppling – alla samtal) on 035-17 55 70 to the Twilio number:

- **Fixed line / PBX / cloud switchboard** (Telia, Tele2, Telavox, Teams Phone…): set it in the operator's portal or ask the operator. Ask them to **pass through the original caller ID** (CLIP) so the AI can offer "call back on this number". Otherwise the caller ID shows as RKJH's own number or as hidden.
- **Mobile subscription:** `**21*<number>#` to activate, `##21#` to deactivate.
- Test from an external phone, both with and without a hidden number.

## 4. Loop protection

A transfer to RKJH's main number would forward straight back to the AI and loop. So:

- `config/office.yaml → blockedTransferNumbers` contains `+4635175570`, and `TWILIO_NUMBER_E164` is also blocked automatically.
- The seed script **refuses** to save a staff member whose `directPhone` is on that list.
- The check runs twice: when the model calls `transfer_to_staff`, and again when Vapi asks for the destination.
- `VAPI_FALLBACK_NUMBER`, used if our API is unreachable during `assistant-request`, is also checked against the list. Leave it empty or use a staff mobile, **never** the main number.

## 5. Staff numbers

Only direct lines or mobiles go in `config/staff.yaml → directPhone`, and only for staff marked `transferable: true`. These numbers are never spoken to callers and never returned by any tool.
