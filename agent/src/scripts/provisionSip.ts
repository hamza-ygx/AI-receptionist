import { RoomAgentDispatch, RoomConfiguration, SIPTransport } from "@livekit/protocol";
import { SipClient } from "livekit-server-sdk";

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

const apply = process.argv.includes("--apply");
const url = (process.env.LIVEKIT_API_URL ?? env("LIVEKIT_URL")).replace(/^ws/, "http");
const sip = new SipClient(url, env("LIVEKIT_API_KEY"), env("LIVEKIT_API_SECRET"));
const number = env("TRUNK_NUMBER_E164");
const agentName = process.env.LIVEKIT_AGENT_NAME ?? "rkjh-receptionist";
const twilioSignalling = env("TWILIO_SIGNALLING_CIDRS").split(",").map((s) => s.trim()).filter(Boolean);

async function main() {
  const inbound = (await sip.listSipInboundTrunk()).find((t) => t.name === "rkjh-twilio-in");
  const outbound = (await sip.listSipOutboundTrunk()).find((t) => t.name === "rkjh-twilio-out");
  const rule = (await sip.listSipDispatchRule()).find((r) => r.name === "rkjh-reception");
  console.log(`inbound trunk: ${inbound ? inbound.sipTrunkId : "missing"}; outbound trunk: ${outbound ? outbound.sipTrunkId : "missing"}; dispatch rule: ${rule ? rule.sipDispatchRuleId : "missing"}`);
  if (!apply) {
    console.log("Dry run. Re-run with --apply to create what is missing.");
    return;
  }

  const inId = inbound?.sipTrunkId ?? (await sip.createSipInboundTrunk("rkjh-twilio-in", [number], {
    allowedAddresses: twilioSignalling,
    ringingTimeout: 30,
  })).sipTrunkId;

  const outId = outbound?.sipTrunkId ?? (await sip.createSipOutboundTrunk("rkjh-twilio-out", env("TWILIO_TERMINATION_URI"), [number], {
    transport: SIPTransport.SIP_TRANSPORT_UDP,
    authUsername: env("TWILIO_SIP_USERNAME"),
    authPassword: env("TWILIO_SIP_PASSWORD"),
  })).sipTrunkId;

  if (!rule) {
    await sip.createSipDispatchRule(
      { type: "individual", roomPrefix: "call-" },
      {
        name: "rkjh-reception",
        trunkIds: [inId],
        roomConfig: new RoomConfiguration({ agents: [new RoomAgentDispatch({ agentName })] }),
      },
    );
  }
  console.log(`LIVEKIT_SIP_INBOUND_TRUNK_ID=${inId}\nLIVEKIT_SIP_OUTBOUND_TRUNK_ID=${outId}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
