/**
 * @raritone/live-vto-sdk — public entry point.
 *
 * The only supported way to run live try-on is `RaritoneVTO`. Provider
 * adapters (Decart, Raritone, Mock) are deliberately NOT exported: they are
 * an implementation detail resolved by name from the project configuration.
 *
 *   const vto = new RaritoneVTO({ backendUrl, clientKey });
 *   const session = await vto.createSession({ productId: "shirt-123" });
 *   await session.connect({ videoElement });
 *   await session.setGarment({ productId: "shirt-456", vtoImage, vtoPrompt });
 */

// ── Public API ─────────────────────────────────────────────────────────────
export { RaritoneVTO } from "./RaritoneVTO.js";
export { VTOSession } from "./session.js";

// ── Building blocks (advanced use) ─────────────────────────────────────────
export { VTOStateMachine } from "./stateMachine.js";
export { CameraManager } from "./cameraManager.js";
export {
  validateGarment,
  generateGarmentPrompt,
  resolveGarment,
  ALLOWED_CATEGORIES,
  type ValidationResult,
} from "./garment.js";
export {
  garmentToBlob,
  renderTokenGarmentBlob,
  type GarmentBlobSource,
} from "./garmentImage.js";

// ── Core contracts ─────────────────────────────────────────────────────────
export {
  VTOError,
  VTOErrorCodes,
  fetchGarmentImage,
  validateImageBlob,
  isFetchableImageRef,
} from "@raritone/vto-core";

export type {
  VTOErrorCode,
  VTOConnectionState,
  VTOSessionState,
  GarmentCategory,
  GarmentConfig,
  Garment,
  ResolvedGarment,
  CreateSessionConfig,
  VTOProviderCapabilities,
  VTOSessionInfo,
  VTOUsageMetrics,
  VTOConnectOpts,
  SessionConnectOptions,
  VTOEventMap,
  VTOEventEmitter,
  RealtimeVTOProvider,
  ProviderConfig,
  CameraConfig,
  VTOUIConfig,
  RaritoneVTOConfig,
  IVTOSession,
  BackendSessionResponse,
  BackendTokenResponse,
  ClientKeyResponse,
} from "@raritone/vto-core";

export type {
  VTOSessionInfoExtended,
  VTOEventMapExtended,
} from "./types.js";
