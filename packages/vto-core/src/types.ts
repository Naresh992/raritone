/**
 * @raritone/vto-core — shared contracts.
 *
 * This package is intentionally **contracts + pure utilities only**: no browser
 * APIs, no React, no provider SDKs, no network calls. Every surface package
 * (live-vto-sdk, react-vto, web-component, react-native-vto) depends on this
 * so that a garment, session, or error means exactly the same thing everywhere.
 *
 * Provider implementations are NOT exported here. Consumers configure a
 * provider by name; resolution happens inside the SDK.
 */
import type { VTOError } from "./errors.js";

// ── Session lifecycle ──────────────────────────────────────────────────────

/**
 * Full set of session states. One canonical list shared by the state machine,
 * the session object, and the provider adapters.
 */
export type VTOConnectionState =
  | "IDLE"
  | "INITIALIZING"
  | "REQUESTING_CAMERA"
  | "CONNECTING"
  | "READY"
  | "PROCESSING"
  | "LIVE"
  | "SWITCHING_GARMENT"
  | "RECONNECTING"
  | "PAUSED"
  | "GENERATING"
  | "ENDING"
  | "ENDED"
  | "ERROR";

/** Alias kept for callers that reason about "session state" specifically. */
export type VTOSessionState = VTOConnectionState;

// ── Garments ───────────────────────────────────────────────────────────────

export type GarmentCategory =
  | "t-shirts"
  | "shirts"
  | "hoodies"
  | "jackets"
  | "tops"
  | "dresses"
  | "knit"
  | "watches"
  | "jewelry"
  | "accessories"
  | "shoes"
  | (string & {});

/**
 * Loose garment description accepted from callers. Only `productId` is
 * required — the backend is the source of truth for the final image/prompt.
 */
export interface GarmentConfig {
  productId: string;
  name?: string;
  category?: GarmentCategory;
  color?: string;
  colorHex?: string;
  material?: string;
  pattern?: string;
  fit?: string;
  sleeveType?: string;
  neckline?: string;
  vtoImage?: string;
  vtoPrompt?: string;
  vtoReady?: boolean;
}

/** Alias for a garment handed to a session. */
export type Garment = GarmentConfig;

/**
 * A garment with everything a provider needs to actually render it.
 * Produced by the backend, never invented client-side.
 */
export interface ResolvedGarment {
  productId: string;
  imageUrl: string;
  prompt: string;
  category: string;
  colorHex: string;
}

// ── Sessions ───────────────────────────────────────────────────────────────

export interface CreateSessionConfig {
  productId: string;
  metadata?: Record<string, unknown>;
}

export interface VTOProviderCapabilities {
  liveVideo: boolean;
  garmentSwitching: boolean;
  garmentSwitchingWithoutReconnect: boolean;
  cameraSwitching: boolean;
  pauseResume: boolean;
  snapshotExport: boolean;
  maxDurationSec: number;
}

export interface VTOSessionInfo {
  sessionId: string;
  productId: string;
  provider: string;
  state: VTOConnectionState;
  createdAt: string;
  expiresAt?: string;
  /** Short-lived provider credential. Never a long-lived secret. */
  livekitToken?: string;
  capabilities?: VTOProviderCapabilities;
}

export interface VTOUsageMetrics {
  sessionId: string;
  durationSec: number;
  garmentSwitches: number;
  reconnections: number;
  estimatedCostUsd?: number;
  providerUsage?: Record<string, unknown>;
}

export interface VTOConnectOpts {
  mediaStream: MediaStream;
  onRemoteStream?: (stream: MediaStream) => void;
  initialGarment?: ResolvedGarment;
  onConnectionChange?: (state: string) => void;
  onConnectionQuality?: (report: unknown) => void;
}

/** Options accepted by a session's connect(). */
export interface SessionConnectOptions {
  videoElement: HTMLVideoElement;
  onRemoteStream?: (stream: MediaStream) => void;
}

// ── Events ─────────────────────────────────────────────────────────────────

/**
 * Canonical event map. Declared as a type alias (not an interface) so it
 * satisfies `Record<string, unknown>` constraints in the SDK's event emitter.
 */
export type VTOEventMap = {
  stateChange: VTOConnectionState;
  error: VTOError;
  garmentSwitching: { productId: string };
  garmentReady: { productId: string };
  garmentError: { productId: string; error: VTOError };
  metrics: VTOUsageMetrics;
  firstFrame: { latencyMs: number };
};

export interface VTOEventEmitter {
  on<K extends keyof VTOEventMap>(event: K, cb: (value: VTOEventMap[K]) => void): () => void;
  off<K extends keyof VTOEventMap>(event: K, cb: (value: VTOEventMap[K]) => void): void;
}

// ── Provider abstraction ───────────────────────────────────────────────────

/**
 * The contract every realtime backend adapter implements. Adapters own the
 * media pipeline; the session owns bookkeeping and state.
 */
export interface RealtimeVTOProvider {
  readonly name: string;
  readonly capabilities: VTOProviderCapabilities;
  readonly connected?: boolean;

  createSession(config: CreateSessionConfig): Promise<VTOSessionInfo>;
  connect(session: VTOSessionInfo, opts: VTOConnectOpts): Promise<void>;
  setGarment(session: VTOSessionInfo, garment: ResolvedGarment): Promise<void>;
  setUploadedGarment?(session: VTOSessionInfo, image: Blob, prompt?: string): Promise<void>;
  disconnect(session: VTOSessionInfo): Promise<void>;
  getSessionGarment?(sessionId: string): Promise<ResolvedGarment>;
  garmentBlob?(garment: ResolvedGarment): Promise<Blob>;
}

/** Per-provider tuning passed to the internal provider factory. */
export interface ProviderConfig {
  name?: string;
  backendUrl?: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
  model?: string;
}

// ── Client entry point ─────────────────────────────────────────────────────

export interface CameraConfig {
  facingMode?: "user" | "environment";
  width?: number;
  height?: number;
  frameRate?: number;
}

export interface VTOUIConfig {
  theme?: "light" | "dark" | "auto";
  primaryColor?: string;
  borderRadius?: number;
  logo?: string;
  showGarmentSelector?: boolean;
  showLatency?: boolean;
  showDebug?: boolean;
}

/**
 * Config for RaritoneVTO. `clientKey` is the public, publishable project key —
 * the provider secret is never accepted here.
 */
export interface RaritoneVTOConfig {
  backendUrl: string;
  clientKey?: string;
  getAuthToken?: () => string | null | Promise<string | null>;
  provider?: string;
  maxSessionDurationSec?: number;
  onError?: (err: VTOError) => void;
  session?: {
    maxDurationSec?: number;
    autoEndOnInactivitySec?: number;
  };
  ui?: VTOUIConfig;
  camera?: CameraConfig;
  fetchImpl?: typeof fetch;
}

// ── Session facade ─────────────────────────────────────────────────────────

/** Public shape of a live try-on session. */
export interface IVTOSession extends VTOEventEmitter {
  readonly id: string;
  readonly sessionId: string;
  readonly productId: string;
  readonly state: VTOConnectionState;
  readonly currentGarment: ResolvedGarment | null;

  connect(opts: SessionConnectOptions): Promise<void>;
  setGarment(garment: Garment): Promise<void>;
  setUploadedGarment?(image: Blob | File, prompt?: string): Promise<void>;
  disconnect(): Promise<void>;
  switchCamera?(): Promise<void>;
  snapshot?(): Promise<Blob | null>;
}

// ── Backend wire contracts ─────────────────────────────────────────────────

export interface BackendSessionResponse {
  sessionId: string;
  provider: string;
  livekitUrl?: string;
  capabilities: VTOProviderCapabilities;
  maxDurationSec: number;
  garment: ResolvedGarment | null;
  createdAt: string;
  expiresAt: string;
}

export interface BackendTokenResponse {
  token: string;
  url: string;
  expiresAt: string;
}

export interface ClientKeyResponse {
  clientKey: string;
  projectId: string;
  allowedDomains: string[];
  rateLimit: {
    requestsPerMinute: number;
    sessionsPerHour: number;
  };
  features: string[];
}
