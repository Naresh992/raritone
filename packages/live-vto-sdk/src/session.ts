/**
 * VTOSession — per-session controller for browser SDK.
 * Owns state machine, camera, provider, garment switching queue, metrics.
 * Implements the core IVTOSession interface from @raritone/vto-core.
 */
import type {
  CreateSessionConfig,
  Garment,
  VTOSessionState,
  VTOSessionInfo,
  ResolvedGarment,
  IVTOSession,
  VTOEventMap,
} from "@raritone/vto-core";
import { VTOError, VTOErrorCodes } from "@raritone/vto-core";
import { VTOStateMachine } from "./stateMachine.js";
import { CameraManager } from "./cameraManager.js";
import { Emitter } from "./utils.js";
import { resolveGarment } from "./garment.js";
import type { RealtimeVTOProvider } from "./types.js";

export class VTOSession implements IVTOSession {
  readonly id: string;
  readonly provider: RealtimeVTOProvider;
  readonly sm = new VTOStateMachine();
  readonly camera = new CameraManager();
  private emitter = new Emitter<VTOEventMap>();
  private info: VTOSessionInfo | null = null;
  private initialProductId: string;
  private garmentSwitchQueue: {
    garment: ResolvedGarment;
    resolve: () => void;
    reject: (e: unknown) => void;
  }[] = [];
  private switching = false;
  private t0: number | null = null;
  private firstFrameAt: number | null = null;
  private metrics: {
    sessionId: string;
    durationSec: number;
    garmentSwitches: number;
    reconnections: number;
  };
  private ended = false;
  private _currentGarment: ResolvedGarment | null = null;
  private _state: VTOSessionState = "IDLE";

  constructor(provider: RealtimeVTOProvider, initialProductId: string) {
    this.provider = provider;
    this.id = `vto_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
    this.initialProductId = initialProductId;
    this.metrics = {
      sessionId: this.id,
      durationSec: 0,
      garmentSwitches: 0,
      reconnections: 0,
    };
  }

  // ── IVTOSession interface ───────────────────────────────────────────────

  get sessionId(): string {
    return this.info?.sessionId ?? this.id;
  }

  get productId(): string {
    return this.initialProductId;
  }

  get state(): VTOSessionState {
    return this._state;
  }

  private setState(newState: VTOSessionState): void {
    if (this._state !== newState) {
      this._state = newState;
      this.emitter.emit("stateChange", newState);
    }
  }

  get currentGarment(): ResolvedGarment | null {
    return this._currentGarment;
  }

  on<K extends keyof VTOEventMap>(ev: K, cb: (v: VTOEventMap[K]) => void): () => void {
    return this.emitter.on(ev, cb);
  }

  off<K extends keyof VTOEventMap>(ev: K, cb: (v: VTOEventMap[K]) => void): void {
    this.emitter.off(ev, cb);
  }

  /** SDK wiring: called by RaritoneVTO after provider.createSession resolves. */
  _setInfo(info: VTOSessionInfo): void {
    this.info = info;
    this.setState(info.state);
  }

  async connect(opts: {
    videoElement: HTMLVideoElement;
    onRemoteStream?: (stream: MediaStream) => void;
  }): Promise<void> {
    if (this.ended) throw new VTOError(VTOErrorCodes.INVALID_STATE, "Session already ended");
    if (this.info == null) {
      throw new VTOError(VTOErrorCodes.NOT_INITIALIZED, "Call createSession first");
    }
    if (this.sm.state !== "IDLE" && this.sm.state !== "ERROR") {
      throw new VTOError(
        VTOErrorCodes.INVALID_STATE,
        `connect() invalid in state ${this.sm.state}`,
      );
    }
    if (!opts.videoElement) {
      throw new VTOError(VTOErrorCodes.INVALID_STATE, "videoElement is required");
    }

    this.setState("INITIALIZING");
    this.t0 = Date.now();

    try {
      this.sm.transition("REQUESTING_CAMERA");
      this.setState("REQUESTING_CAMERA");
      const stream = await this.camera.request("user");

      this.sm.transition("CONNECTING");
      this.setState("CONNECTING");

      const onRemoteStream =
        opts.onRemoteStream ??
        ((stream: MediaStream) => {
          if (opts.videoElement) {
            opts.videoElement.srcObject = stream;
            void opts.videoElement.play().catch(() => {});
          }
        });

      await this.provider.connect(this.info, {
        mediaStream: stream,
        onRemoteStream,
        initialGarment: this._currentGarment ?? undefined,
      });

      this.sm.transition("READY");
      this.setState("READY");
      this.sm.transition("PROCESSING");
      this.setState("PROCESSING");
      // LIVE is confirmed by the first transformed frame; providers without a
      // remote track (mock) advance immediately.
      this.markFirstFrame();
    } catch (e) {
      const err =
        e instanceof VTOError
          ? e
          : new VTOError(VTOErrorCodes.CONNECTION_FAILED, (e as Error).message);
      this.sm.force("ERROR");
      this.setState("ERROR");
      this.emitter.emit("error", err);
      throw err;
    }
  }

  private markFirstFrame(): void {
    if (this.sm.state === "PROCESSING") {
      this.sm.transition("LIVE");
      this.setState("LIVE");
      if (this.t0) {
        const latency = Date.now() - this.t0;
        this.firstFrameAt = Date.now();
        this.emitter.emit("firstFrame", { latencyMs: latency });
      }
    }
  }

  /** Called by the renderer once the first remote frame has decoded. */
  notifyFirstFrame(): void {
    this.markFirstFrame();
  }

  async setGarment(garment: Garment): Promise<void> {
    if (this.ended) throw new VTOError(VTOErrorCodes.INVALID_STATE, "Session ended");
    if (!this.info) throw new VTOError(VTOErrorCodes.NOT_INITIALIZED, "Not connected");
    if (
      this.sm.state !== "LIVE" &&
      this.sm.state !== "READY" &&
      this.sm.state !== "PROCESSING"
    ) {
      throw new VTOError(
        VTOErrorCodes.INVALID_STATE,
        `setGarment invalid in state ${this.sm.state}`,
      );
    }
    // Serialize concurrent calls so rapid product taps cannot corrupt state.
    const resolved = resolveGarment(garment);
    return new Promise<void>((resolve, reject) => {
      this.garmentSwitchQueue.push({ garment: resolved, resolve, reject });
      void this.drainQueue();
    });
  }

  async setUploadedGarment(image: Blob | File, prompt?: string): Promise<void> {
    if (this.ended) throw new VTOError(VTOErrorCodes.INVALID_STATE, "Session ended");
    if (!this.info) throw new VTOError(VTOErrorCodes.NOT_INITIALIZED, "Not connected");
    if (!this.provider.connected) {
      throw new VTOError(VTOErrorCodes.NOT_INITIALIZED, "Not connected");
    }
    if (!this.provider.setUploadedGarment) {
      throw new VTOError(
        VTOErrorCodes.PROVIDER_ERROR,
        `Provider '${this.provider.name}' does not support uploaded garments`,
      );
    }

    this.setState("GENERATING");
    try {
      await this.provider.setUploadedGarment(this.info, image, prompt);
      this.setState("LIVE");
    } catch (e) {
      this.setState("ERROR");
      const err =
        e instanceof VTOError
          ? e
          : new VTOError(VTOErrorCodes.PROVIDER_ERROR, (e as Error).message);
      this.emitter.emit("error", err);
      throw err;
    }
  }

  private async drainQueue(): Promise<void> {
    if (this.switching) return;
    const next = this.garmentSwitchQueue.shift();
    if (!next) return;
    this.switching = true;
    try {
      if (this.sm.state === "LIVE") {
        this.sm.transition("SWITCHING_GARMENT");
        this.setState("SWITCHING_GARMENT");
        this.emitter.emit("garmentSwitching", { productId: next.garment.productId });
      }
      if (!this.info) throw new VTOError(VTOErrorCodes.NOT_INITIALIZED, "No session info");
      await this.provider.setGarment(this.info, next.garment);
      this.metrics.garmentSwitches += 1;
      if (this.sm.state === "SWITCHING_GARMENT") {
        this.sm.transition("LIVE");
        this.setState("LIVE");
      }
      this._currentGarment = next.garment;
      this.emitter.emit("garmentReady", { productId: next.garment.productId });
      next.resolve();
    } catch (e) {
      const err =
        e instanceof VTOError
          ? e
          : new VTOError(VTOErrorCodes.PROVIDER_ERROR, (e as Error).message);
      // Recover to LIVE so one bad garment does not kill the session.
      if (this.sm.state === "SWITCHING_GARMENT") {
        try {
          this.sm.transition("LIVE");
          this.setState("LIVE");
        } catch {
          /* already moved on */
        }
      }
      this.emitter.emit("garmentError", { productId: next.garment.productId, error: err });
      next.reject(err);
    } finally {
      this.switching = false;
      if (this.garmentSwitchQueue.length) void this.drainQueue();
    }
  }

  async disconnect(): Promise<void> {
    if (this.ended) return;
    this.ended = true;
    try {
      this.sm.transition("ENDING");
      this.setState("ENDING");
    } catch {
      this.sm.force("ENDING");
    }
    try {
      if (this.info) await this.provider.disconnect(this.info);
    } catch {
      /* best-effort */
    }
    this.camera.cleanup();
    this.sm.force("ENDED");
    this.setState("ENDED");
    if (this.t0) {
      this.metrics.durationSec = Math.round((Date.now() - this.t0) / 1000);
    }
    this.emitter.emit("metrics", { ...this.metrics });
    this.emitter.removeAll();
  }

  async switchCamera(): Promise<void> {
    if (!this.provider.capabilities.cameraSwitching) {
      throw new VTOError(
        VTOErrorCodes.PROVIDER_ERROR,
        "Camera switching not supported",
      );
    }
    await this.camera.switchCamera();
  }

  async snapshot(): Promise<Blob | null> {
    // The SDK does not retain the video element; callers capture from their own.
    return null;
  }
}
