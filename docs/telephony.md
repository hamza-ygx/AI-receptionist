# Telephony: Twilio Elastic SIP Trunking → self-hosted LiveKit SIP

## Why Twilio

- It offers Swedish numbers with a straightforward business regulatory bundle.
- It has Elastic SIP Trunking with an **EU edge** (Dublin IE1 / Frankfurt DE1), plus SIP REFER for the optional cold-transfer mode.
- Telnyx would also work with LiveKit SIP, and is cheaper and offers geographic numbers. Switching is a trunk configuration change; the code doesn't care.

## 1. Number and regulatory bundle

1. Twilio Console → Phone Numbers → Regulatory Compliance → create a **Bundle** for Sweden, business end-user. You need:
   - Revisionskonsulterna J Hägglund AB
   - org. no. **559060-3766**
   - a Swedish business address with proof (registreringsbevis)
   - no PO box
2. Buy a **national 010** number. Callers never see it, because they dial 035-17 55 70.

## 2. Elastic SIP Trunk

Create the trunk in the **IE1 (Dublin)** region for EU processing (`trunking.dublin.ie1.twilio.com`). Then configure:

- **Origination:** add the URI `sip:<media VM public IP>:5060;transport=udp`. This is the `mediaPublicIp` deployment output.
- **Termination:**
  - a URI such as `rkjh-ai.pstn.dublin.twilio.com`
  - authentication through a **Credential List**, with the username and password stored as Key Vault secrets `twilio-sip-username` / `twilio-sip-password`
  - put the URI in `TWILIO_TERMINATION_URI` in `deploy/media/agent.env.static`
- **Numbers:** attach the 010 number to the trunk.
- Optional, only if you use `TRANSFER_MODE=cold`: enable **Call Transfer (SIP REFER)**, and allow PSTN transfer to Swedish mobiles and landlines.

Restrict the media VM to Twilio's signalling IPs for your edge (`twilioSignallingCidrs` in the Bicep params, and `TWILIO_SIGNALLING_CIDRS` for the LiveKit inbound trunk) and Twilio's media range. **Check the current list at twilio.com/docs/sip-trunking/ip-addresses before go-live.** The defaults in the repo are taken from search results and are unverified.

Then run step 7 of `deploy.sh` to create the LiveKit inbound trunk, outbound trunk and dispatch rule (see [livekit.md](livekit.md#sip-provisioning)).

## 3. Forward RKJH's number

Set **unconditional call forwarding** (vidarekoppling – alla samtal) on 035-17 55 70 to the Twilio number:

- **Fixed line / PBX / cloud switchboard** (Telia, Tele2, Telavox, Teams Phone…): set it in the operator's portal or ask the operator. Ask them to **pass through the original caller ID** (CLIP) so the AI can offer "call back on this number". It arrives as `sip.phoneNumber` on the call.
- **Mobile subscription:** `**21*<number>#` to activate, `##21#` to deactivate.
- Test from an external phone, both with and without a hidden number.

## 4. Loop protection

A transfer to RKJH's main number would forward straight back to the AI and loop. So:

- `config/office.yaml → blockedTransferNumbers` contains `+4635175570`, and `TRUNK_NUMBER_E164` is blocked automatically.
- The seed script **refuses** to save a staff member whose `directPhone` is on that list.
- `transfer_to_staff` checks the list on every attempt, along with office hours and the per-call limit.
- `FALLBACK_TRANSFER_NUMBER`, which is used if the AI pipeline fails mid-call, is checked against the same list. Leave it empty or use a staff mobile, **never** the main number.

## 5. Staff numbers

Only direct lines or mobiles go in `config/staff.yaml → directPhone`, and only for staff marked `transferable: true`. These numbers are never spoken to callers and never returned by any tool.
