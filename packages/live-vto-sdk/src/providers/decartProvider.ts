/**
 * DecartRealtimeProvider — production adapter for Decart Lucy VTON.
 *
 * Verified official flow (docs.platform.decart.ai, @decartai/sdk 0.2.x):
 *
 *   Backend (server-only DECART_API_KEY):
 *     POST {DECART_API_BASE}/v1/client/tokens  {x-api-key}
 *     → { apiKey: <short-lived client token>, expiresAt }
 *   Frontend:
 *     import { createDecartClient, models } from "@decartai/sdk";
 *     const client = createDecartClient({ apiKey: <client token> });
 *     const model = models.realtime("lucy-vton-latest"); // {fps,width:1280,height:720}
 *     const rt = await client.realtime.connect(stream, {
 *       model, mirror: "auto",
 *       onRemoteStream: (s) => { video.srcObject = s; },  // AI output
 *       initialState: { prompt: { text, enhance: false }, image: garmentBlob },
 *     });
 *     await rt.set({ prompt, image: blob, enhance: false }); // switch, no reconnect
 *     rt.disconnect();
 *
 * This provider keeps Raritone's session bookkeeping (backend rows, quotas)
 * and delegates all media/AI to the official SDK. Decart owns the LiveKit room.
 */
import type {
  RealtimeVTOProvider,
  VTOSessionInfo,
  CreateSessionConfig,
  ResolvedGarment,
  VTOProviderCapabilities,
} from "../types.js";
import { VTOError } from "../types.js";
import { garmentToBlob } from "../garmentImage.js";

export const DECART_VTON_MODEL = "lucy-vton-latest";

export type DecartConnectionState =
  | "connecting"
  | "connected"
  | "generating"
  | "reconnecting"
  | "disconnected";

export interface DecartProviderOpts {
  backendUrl: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
  /** override model (default lucy-vton-latest); backend token is scoped to its model */
  model?: string;
}

interface BackendSession {
  sessionId: string;
  provider: string;
  isMock?: boolean;
  model?: string | null;
  garment?: { productId: string; imageUrl: string; prompt: string } | null;
  capabilities: VTOProviderCapabilities;
  createdAt: string;
  expiresAt: string;
}

interface BackendToken {
  provider: string;
  isMock?: boolean;
  model?: string | null;
  apiKey?: string;
  token?: string;
  expiresAt: string;
}

type DecartRealtimeClient = {
  set: (input: { prompt?: string; enhance?: boolean; image?: Blob | File | string | null }) => Promise<void>;
  setPrompt: (prompt: string, opts?: { enhance?: boolean }) => Promise<void>;
  disconnect: () => void;
  on: (ev: string, cb: (...args: never[]) => void) => void;
  off: (ev: string, cb: (...args: never[]) => void) => void;
  sessionId?: string | null;
};

async function loadDecartSdk(): Promise<typeof import("@decartai/sdk")> {
  try {
    return await import("@decartai/sdk");
  } catch {
    throw new VTOError(
      "PROVIDER_ERROR",
      "Missing dependency @decartai/sdk. Install it in your app: npm install @decartai/sdk",
      { recoverable: false },
    );
  }
}

export class DecartRealtimeProvider implements RealtimeVTOProvider {
  readonly name = "decart";
  readonly capabilities: VTOProviderCapabilities = {
    liveVideo: true,
    garmentSwitching: true,
    garmentSwitchingWithoutReconnect: true,
    cameraSwitching: true,
    pauseResume: false,
    snapshotExport: false,
    maxDurationSec: 300,
  };

  private backendUrl: string;
  private getAuthToken?: () => string | null | Promise<string | null>;
  private fetchImpl: typeof fetch;
  private modelOverride?: string;

  private rt: DecartRealtimeClient | null = null;
  private garmentBlobs = new Map<string, Blob>(); // productId -> uploaded blob (reuse w/o re-encode)

  onConnectionChange: ((s: DecartConnectionState) => void) | null = null;
  onProviderError: ((e: Error) => void) | null = null;

  constructor(opts: DecartProviderOpts) {
    this.backendUrl = opts.backendUrl.replace(/\/$/, "");
    this.getAuthToken = opts.getAuthToken;
    this.fetchImpl = opts.fetchImpl ?? fetch.bind(globalThis);
    this.modelOverride = opts.model;
  }

  private async authHeaders(json = false): Promise<Record<string, string>> {
    const h: Record<string, string> = {};
    if (json) h["Content-Type"] = "application/json";
    const t = this.getAuthToken ? await this.getAuthToken() : null;
    if (t) h["Authorization"] = `Bearer ${t}`;
    return h;
  }

  private failIfMockSession(s: BackendSession): void {
    if (s.isMock || s.provider === "mock") {
      throw new VTOError(
        "PROVIDER_ERROR",
        "Backend returned a demo session, not a Decart session. Set LIVE_VTO_PROVIDER=decart with DECART_API_KEY.",
        { recoverable: false },
      );
    }
  }

  async createSession(config: CreateSessionConfig): Promise<VTOSessionInfo> {
    const res = await this.fetchImpl(`${this.backendUrl}/api/v1/live-vto/sessions`, {
      method: "POST",
      headers: await this.authHeaders(true),
      body: JSON.stringify({ productId: config.productId, metadata: config.metadata }),
    });
    if (!res.ok) {
      const body = await res.text();
      let detail = body;
      try { detail = (JSON.parse(body) as { detail?: string }).detail ?? body; } catch {}
      if (res.status === 503) throw new VTOError("PROVIDER_ERROR", `Live Try-On unavailable: ${detail}`, { recoverable: false });
      if (res.status === 401) throw new VTOError("TOKEN_EXPIRED", String(detail), { recoverable: true });
      if (res.status === 429) throw new VTOError("QUOTA_EXCEEDED", String(detail), { recoverable: true });
      throw new VTOError("PROVIDER_ERROR", `createSession failed: ${detail}`);
    }
    const data = (await res.json()) as BackendSession;
    this.failIfMockSession(data);
    return {
      sessionId: data.sessionId,
      productId: config.productId,
      provider: data.provider,
      state: "READY",
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
    };
  }

  /** Fetch the server-side garment (image URL + prompt) for a session. */
  async getSessionGarment(sessionId: string): Promise<ResolvedGarment> {
    const res = await this.fetchImpl(`${this.backendUrl}/api/v1/live-vto/sessions/${sessionId}`, {
      headers: await this.authHeaders(),
    });
    if (!res.ok) throw new VTOError("PROVIDER_ERROR", `getSession failed (${res.status})`);
    const data = (await res.json()) as BackendSession;
    const g = data.garment;
    if (!g?.prompt || !g?.imageUrl) throw new VTOError("GARMENT_INVALID", "Session has no garment configured");
    return { productId: g.productId, imageUrl: g.imageUrl, prompt: g.prompt, category: "", colorHex: "" };
  }

  async garmentBlob(garment: ResolvedGarment): Promise<Blob> {
    const hit = this.garmentBlobs.get(garment.productId);
    if (hit) return hit;
    const blob = await garmentToBlob(garment.imageUrl, { fetchImpl: this.fetchImpl });
    this.garmentBlobs.set(garment.productId, blob);
    return blob;
  }

  async connect(
    session: VTOSessionInfo,
    opts: {
      mediaStream: MediaStream;
      onRemoteStream?: (s: MediaStream) => void;
      initialGarment?: ResolvedGarment;
      onConnectionChange?: (s: DecartConnectionState) => void;
      onConnectionQuality?: (report: unknown) => void;
    },
  ): Promise<void> {
    if (this.rt) throw new VTOError("INVALID_STATE", "Already connected — disconnect first");
    if (!opts.onRemoteStream) throw new VTOError("INVALID_STATE", "connect() requires onRemoteStream to render AI output");
    const onRemoteStream = opts.onRemoteStream;
    const { createDecartClient, models } = await loadDecartSdk();

    // 1. Short-lived Decart client token from our backend (never the dct_* key)
    const res = await this.fetchImpl(`${this.backendUrl}/api/v1/live-vto/sessions/${session.sessionId}/token`, {
      method: "POST",
      headers: await this.authHeaders(),
    });
    if (!res.ok) {
      const body = await res.text();
      if (res.status === 503) throw new VTOError("PROVIDER_ERROR", `Live Try-On unavailable: ${body}`, { recoverable: false });
      if (res.status === 401) throw new VTOError("TOKEN_EXPIRED", body, { recoverable: true });
      throw new VTOError("CONNECTION_FAILED", `token fetch failed: ${body}`);
    }
    const tok = (await res.json()) as BackendToken;
    if (tok.isMock || !tok.apiKey) {
      throw new VTOError(
        "PROVIDER_ERROR",
        "Backend returned a demo token, not a Decart client token. Configure DECART_API_KEY.",
        { recoverable: false },
      );
    }
    const modelName = this.modelOverride ?? tok.model ?? DECART_VTON_MODEL;

    // 2. Garment for the first transformed frame (avoid flashing raw camera)
    const garment = opts.initialGarment ?? (await this.getSessionGarment(session.sessionId));
    const image = await this.garmentBlob(garment);

    // 3. Official connect — Decart owns WebRTC/LiveKit internally
    const client = createDecartClient({ apiKey: tok.apiKey });
    const model = models.realtime(modelName as "lucy-vton-latest");
    const onChange = (s: DecartConnectionState) => {
      this.onConnectionChange?.(s);
      opts.onConnectionChange?.(s);
    };

    const connectOpts: Record<string, unknown> = {
      model,
      mirror: "auto",
      onRemoteStream,
      initialState: { prompt: { text: garment.prompt, enhance: false }, image },
    };
    if (opts.onConnectionQuality) connectOpts["onConnectionQuality"] = opts.onConnectionQuality;

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.rt = (await (client.realtime as any).connect(opts.mediaStream, connectOpts)) as DecartRealtimeClient;
    } catch (e) {
      this.rt = null;
      throw new VTOError("CONNECTION_FAILED", e instanceof Error ? e.message : String(e));
    }
    this.rt.on("connectionChange", onChange as (...args: never[]) => void);
    this.rt.on("error", ((e: unknown) => {
      const err = e instanceof Error ? e : new Error(String(e));
      this.onProviderError?.(err);
    }) as (...args: never[]) => void);
    session.livekitToken = tok.apiKey;
  }

  async setGarment(session: VTOSessionInfo, garment: ResolvedGarment): Promise<void> {
    if (!this.rt) throw new VTOError("NOT_INITIALIZED", "Not connected — call connect() first");
    // 1. Server-side validation + tracking (quotas/audit); source of truth for prompt
    const res = await this.fetchImpl(`${this.backendUrl}/api/v1/live-vto/sessions/${session.sessionId}/garment`, {
      method: "POST",
      headers: await this.authHeaders(true),
      body: JSON.stringify({ productId: garment.productId, imageUrl: garment.imageUrl, prompt: garment.prompt }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new VTOError("PROVIDER_ERROR", `setGarment failed: ${body}`);
    }
    const data = (await res.json()) as { garment: { imageUrl: string; prompt: string } };
    // 2. Apply live — no reconnect (official set() replaces state atomically)
    const image = await this.garmentBlob({ ...garment, imageUrl: data.garment.imageUrl, prompt: data.garment.prompt });
    await this.rt.set({ prompt: data.garment.prompt, image, enhance: false });
  }

  /** Apply a user-uploaded garment Blob directly (image-only try-on). */
  async setUploadedGarment(session: VTOSessionInfo, image: Blob, prompt?: string): Promise<void> {
    if (!this.rt) throw new VTOError("NOT_INITIALIZED", "Not connected — call connect() first");
    if (prompt) {
      await this.rt.set({ prompt, image, enhance: false });
    } else {
      await this.rt.set({ image });
    }
    // Track server-side (best-effort; upload bytes stay client-side)
    try {
      await this.fetchImpl(`${this.backendUrl}/api/v1/live-vto/sessions/${session.sessionId}/garment`, {
        method: "POST",
        headers: await this.authHeaders(true),
        body: JSON.stringify({ productId: session.productId, prompt: prompt ?? null }),
      });
    } catch { /* non-fatal */ }
  }

  async disconnect(session: VTOSessionInfo): Promise<void> {
    try { this.rt?.disconnect(); } catch { /* ignore */ }
    this.rt = null;
    this.garmentBlobs.clear();
    try {
      await this.fetchImpl(`${this.backendUrl}/api/v1/live-vto/sessions/${session.sessionId}/end`, {
        method: "POST",
        headers: await this.authHeaders(),
      });
    } catch { /* best-effort */ }
  }

  get connected(): boolean {
    return this.rt != null;
  }
}
