/**
 * @raritone/live-vto-sdk — public typed contracts.
 *
 * This module is a thin re-export layer over @raritone/vto-core so that a
 * garment, session state, or error means the same thing in every Raritone
 * surface. Only genuinely SDK-specific shapes are declared here.
 *
 * Keep this file additive: it must never redeclare a core type, or the two
 * will drift apart.
 */
import type {
  VTOSessionInfo,
  VTOProviderCapabilities,
  VTOEventMap,
} from "@raritone/vto-core";

// ── Core contracts (re-exported verbatim) ──────────────────────────────────
export {
  // Errors
  VTOError,
  VTOErrorCodes,
  type VTOErrorCode,
  // Types
  type VTOConnectionState,
  type VTOSessionState,
  type GarmentCategory,
  type GarmentConfig,
  type Garment,
  type ResolvedGarment,
  type CreateSessionConfig,
  type VTOProviderCapabilities,
  type VTOSessionInfo,
  type VTOUsageMetrics,
  type VTOConnectOpts,
  type SessionConnectOptions,
  type VTOEventMap,
  type VTOEventEmitter,
  type RealtimeVTOProvider,
  type ProviderConfig,
  type CameraConfig,
  type VTOUIConfig,
  type RaritoneVTOConfig,
  type IVTOSession,
  type BackendSessionResponse,
  type BackendTokenResponse,
  type ClientKeyResponse,
} from "@raritone/vto-core";

// ── SDK-specific shapes ────────────────────────────────────────────────────

/** Session info with the extra fields the SDK populates locally. */
export interface VTOSessionInfoExtended extends VTOSessionInfo {
  capabilities: VTOProviderCapabilities;
}

/**
 * Extended event map. Kept separate from core's VTOEventMap so the
 * provider-agnostic contract stays small; the SDK adapter merges the two.
 */
export interface VTOEventMapExtended extends VTOEventMap {
  connecting: { sessionId: string };
  connected: { sessionId: string };
  stream_started: { sessionId: string };
  garment_changed: { sessionId: string; garmentId: string };
  quality_changed: { sessionId: string; report: unknown };
  reconnecting: { sessionId: string };
  disconnected: { sessionId: string; reason?: string };
  session_ended: { sessionId: string; durationSec: number; garmentId: string };
}
