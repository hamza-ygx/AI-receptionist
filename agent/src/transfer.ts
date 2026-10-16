import { voice, type AgentSession } from "@livekit/agents";
import {
  AudioSource, LocalAudioTrack, RoomEvent, TrackKind, TrackPublishOptions, TrackSource,
  type RemoteParticipant, type RemoteTrackPublication,
} from "@livekit/rtc-node";
import { RoomServiceClient, SipClient, SipCallError } from "livekit-server-sdk";
import { errMsg } from "../../api/src/lib/log.js";
import type { TransferStatus } from "../../api/src/core/transfer.js";
import type { AzureTTS } from "./azureTts.js";
import type { CallState } from "./state.js";

export interface TransferTarget { id: string; name: string; phone: string }
export interface Brief { assistantName: string; callerName: string | null; company: string | null; reason: string }

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function apiUrl(): string {
  return (process.env.LIVEKIT_API_URL ?? env("LIVEKIT_URL")).replace(/^ws/, "http");
}

function clients() {
  const key = env("LIVEKIT_API_KEY");
  const secret = env("LIVEKIT_API_SECRET");
  return { sip: new SipClient(apiUrl(), key, secret), rooms: new RoomServiceClient(apiUrl(), key, secret) };
}

function clean(s: string | null | undefined, max: number): string {
  return (s ?? "").replace(/[^\p{L}\p{N}\s.,&'\-]/gu, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

export function briefText(staff: TransferTarget, b: Brief): string {
  const who = [clean(b.callerName, 60), b.company ? `på ${clean(b.company, 80)}` : ""].filter(Boolean).join(" ") || "en uppringare";
  return `Hej ${clean(staff.name.split(" ")[0], 40)}, det är ${clean(b.assistantName, 40)}, AI-receptionisten. `
    + `Jag har ${who} i luren angående ${clean(b.reason, 160) || "ett ärende"}. `
    + "Tryck 1 för att ta samtalet, eller 2 om jag ska ta ett meddelande.";
}

function classifyDialError(e: unknown): TransferStatus {
  if (e instanceof SipCallError) {
    if (e.sipStatusCode === 486 || e.sipStatusCode === 600) return "busy";
    if (e.sipStatusCode === undefined && e.code === "canceled") return "no_answer";
    if (e.sipStatusCode === 480 || e.sipStatusCode === 408 || e.sipStatusCode === 487) return "no_answer";
  }
  return "failed";
}

function audioSids(p: RemoteParticipant | undefined): string[] {
  if (!p) return [];
  return [...p.trackPublications.values()].filter((t) => t.kind === TrackKind.KIND_AUDIO && t.sid).map((t) => t.sid!);
}

function setListening(p: RemoteParticipant | undefined, on: boolean): void {
  if (!p) return;
  for (const pub of p.trackPublications.values()) {
    if (pub.kind === TrackKind.KIND_AUDIO) (pub as RemoteTrackPublication).setSubscribed(on);
  }
}

async function speak(source: AudioSource, ttsEngine: AzureTTS, text: string): Promise<void> {
  const stream = ttsEngine.synthesize(text);
  for await (const chunk of stream) await source.captureFrame(chunk.frame);
  await source.waitForPlayout();
}

function waitForDigit(state: CallState, identity: string, timeoutMs: number): Promise<"1" | "2" | "timeout" | "hangup"> {
  const room = state.ctx.room;
  return new Promise((resolve) => {
    const done = (r: "1" | "2" | "timeout" | "hangup") => {
      clearTimeout(timer);
      room.off(RoomEvent.DtmfReceived, onDtmf);
      room.off(RoomEvent.ParticipantDisconnected, onLeave);
      resolve(r);
    };
    const onDtmf = (_code: number, digit: string, p: RemoteParticipant) => {
      if (p.identity === identity && (digit === "1" || digit === "2")) done(digit);
    };
    const onLeave = (p: RemoteParticipant) => {
      if (p.identity === identity || p.identity === state.callerIdentity) done("hangup");
    };
    const timer = setTimeout(() => done("timeout"), timeoutMs);
    room.on(RoomEvent.DtmfReceived, onDtmf);
    room.on(RoomEvent.ParticipantDisconnected, onLeave);
  });
}

export async function transferToNumber(state: CallState, e164: string): Promise<boolean> {
  try {
    await clients().sip.transferSipParticipant(state.ctx.room.name!, state.callerIdentity, `tel:${e164}`, { playDialtone: true, ringingTimeout: 25 });
    return true;
  } catch (e) {
    state.log.error("Fallback transfer failed", { err: errMsg(e) });
    return false;
  }
}

export async function coldTransfer(state: CallState, staff: TransferTarget): Promise<TransferStatus> {
  const { sip } = clients();
  try {
    await sip.transferSipParticipant(state.ctx.room.name!, state.callerIdentity, `tel:${staff.phone}`, { playDialtone: true, ringingTimeout: 25 });
    return "connected";
  } catch (e) {
    state.log.warn("Cold transfer failed", { err: errMsg(e) });
    return classifyDialError(e);
  }
}

export async function warmTransfer(state: CallState, session: AgentSession<CallState>, ttsEngine: AzureTTS, staff: TransferTarget, brief: Brief): Promise<TransferStatus> {
  const room = state.ctx.room;
  const roomName = room.name!;
  const { sip, rooms } = clients();
  const consultantId = `consultant-${staff.id}-${Date.now()}`;
  const caller = room.remoteParticipants.get(state.callerIdentity);

  setListening(caller, false);
  const ownBg = state.bg ? null : new voice.BackgroundAudioPlayer();
  if (ownBg) await ownBg.start({ room, agentSession: session as unknown as AgentSession });
  const hold = (state.bg ?? ownBg)!.play(voice.BuiltinAudioClip.HOLD_MUSIC, true);

  const source = new AudioSource(ttsEngine.sampleRate, ttsEngine.numChannels);
  const track = LocalAudioTrack.createAudioTrack("transfer_brief", source);
  const briefPub = await room.localParticipant!.publishTrack(track, new TrackPublishOptions({ source: TrackSource.SOURCE_MICROPHONE }));
  await rooms.updateSubscriptions(roomName, state.callerIdentity, [briefPub.sid!], false).catch(() => undefined);

  const hideFromCaller = (pub: RemoteTrackPublication, p: RemoteParticipant) => {
    if (p.identity === consultantId && pub.sid) void rooms.updateSubscriptions(roomName, state.callerIdentity, [pub.sid], false).catch(() => undefined);
  };
  room.on(RoomEvent.TrackPublished, hideFromCaller);

  const cleanup = async (keepConsultant: boolean) => {
    room.off(RoomEvent.TrackPublished, hideFromCaller);
    hold.stop();
    await ownBg?.close().catch(() => undefined);
    await room.localParticipant!.unpublishTrack(briefPub.sid!).catch(() => undefined);
    await source.close().catch(() => undefined);
    if (!keepConsultant) await rooms.removeParticipant(roomName, consultantId).catch(() => undefined);
  };

  try {
    try {
      await sip.createSipParticipant(env("LIVEKIT_SIP_OUTBOUND_TRUNK_ID"), staff.phone, roomName, {
        participantIdentity: consultantId,
        participantName: staff.name,
        fromNumber: process.env.TRUNK_NUMBER_E164 || undefined,
        waitUntilAnswered: true,
        ringingTimeout: Number(process.env.TRANSFER_RINGING_TIMEOUT_S ?? 25),
        playDialtone: false,
      });
    } catch (e) {
      const status = classifyDialError(e);
      state.log.info("Consultant did not answer", { status });
      await cleanup(false);
      setListening(caller, true);
      return status;
    }

    const consultant = room.remoteParticipants.get(consultantId);
    const agentSids = [...room.localParticipant!.trackPublications.values()].map((p) => p.sid!).filter((sid) => sid && sid !== briefPub.sid);
    await rooms.updateSubscriptions(roomName, consultantId, [...audioSids(caller), ...agentSids], false).catch(() => undefined);
    await rooms.updateSubscriptions(roomName, state.callerIdentity, audioSids(consultant), false).catch(() => undefined);

    const text = briefText(staff, brief);
    let answer: "1" | "2" | "timeout" | "hangup" = "timeout";
    for (let attempt = 0; attempt < 2 && answer === "timeout"; attempt++) {
      const waiting = waitForDigit(state, consultantId, 12_000);
      await speak(source, ttsEngine, attempt === 0 ? text : "Tryck 1 för att ta samtalet, eller 2 för ett meddelande.");
      answer = await waiting;
    }

    if (answer === "1" && room.remoteParticipants.has(state.callerIdentity)) {
      await speak(source, ttsEngine, "Jag kopplar nu.");
      await rooms.updateSubscriptions(roomName, consultantId, audioSids(caller), true);
      await rooms.updateSubscriptions(roomName, state.callerIdentity, audioSids(room.remoteParticipants.get(consultantId)), true);
      await cleanup(true);
      return "connected";
    }
    if (answer === "2") await speak(source, ttsEngine, "Okej, jag tar ett meddelande. Tack!").catch(() => undefined);
    await cleanup(false);
    setListening(caller, true);
    return answer === "2" ? "cancelled" : answer === "hangup" ? "failed" : "no_answer";
  } catch (e) {
    state.log.error("Warm transfer failed", { err: errMsg(e) });
    await cleanup(false);
    setListening(caller, true);
    return "failed";
  }
}
