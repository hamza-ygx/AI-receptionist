import { AudioByteStream, shortuuid, tts, type APIConnectOptions } from "@livekit/agents";

const SAMPLE_RATE = 24000;
const CHANNELS = 1;

export interface AzureTtsOptions {
  region: string;
  key: string;
  voice: string;
  locale: string;
  rate?: string;
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
}

export class AzureTTS extends tts.TTS {
  label = "rkjh.AzureTTS";
  #opts: AzureTtsOptions;

  constructor(opts: AzureTtsOptions) {
    super(SAMPLE_RATE, CHANNELS, { streaming: false });
    this.#opts = opts;
  }

  override get model(): string {
    return this.#opts.voice;
  }

  override get provider(): string {
    return `${this.#opts.region}.tts.speech.microsoft.com`;
  }

  ssml(text: string): string {
    const body = escapeXml(text);
    const inner = this.#opts.rate ? `<prosody rate="${this.#opts.rate}">${body}</prosody>` : body;
    return `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${this.#opts.locale}"><voice name="${this.#opts.voice}">${inner}</voice></speak>`;
  }

  async fetchAudio(text: string, signal: AbortSignal): Promise<Response> {
    const res = await fetch(`https://${this.#opts.region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": this.#opts.key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "raw-24khz-16bit-mono-pcm",
        "User-Agent": "rkjh-receptionist",
      },
      body: this.ssml(text),
      signal,
    });
    if (!res.ok || !res.body) throw new Error(`Azure TTS ${res.status}`);
    return res;
  }

  synthesize(text: string, connOptions?: APIConnectOptions, abortSignal?: AbortSignal): tts.ChunkedStream {
    return new AzureChunkedStream(this, text, connOptions, abortSignal);
  }

  stream(): tts.SynthesizeStream {
    throw new Error("AzureTTS is chunked; the agent wraps it in a StreamAdapter");
  }
}

class AzureChunkedStream extends tts.ChunkedStream {
  label = "rkjh.AzureChunkedStream";
  #tts: AzureTTS;
  #text: string;

  constructor(azureTts: AzureTTS, text: string, connOptions?: APIConnectOptions, abortSignal?: AbortSignal) {
    super(text, azureTts, connOptions, abortSignal);
    this.#tts = azureTts;
    this.#text = text;
  }

  protected async run(): Promise<void> {
    const requestId = shortuuid();
    const bytes = new AudioByteStream(SAMPLE_RATE, CHANNELS);
    let pending: import("@livekit/rtc-node").AudioFrame | undefined;
    const emit = (final: boolean) => {
      if (pending) {
        this.queue.put({ requestId, segmentId: requestId, frame: pending, final });
        pending = undefined;
      }
    };
    try {
      const res = await this.#tts.fetchAudio(this.#text, this.abortSignal);
      const reader = res.body!.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const frame of bytes.write(value)) {
          emit(false);
          pending = frame;
        }
      }
      for (const frame of bytes.flush()) {
        emit(false);
        pending = frame;
      }
      emit(true);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      throw e;
    } finally {
      this.queue.close();
    }
  }
}
