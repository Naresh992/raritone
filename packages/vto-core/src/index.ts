/**
 * @raritone/vto-core — public entry point.
 *
 * Contracts + pure utilities only. No provider implementations, no browser
 * APIs, no React. Surface packages (live-vto-sdk, react-vto, web-component,
 * react-native-vto) all build on these types so a garment or session means
 * the same thing in every integration.
 */

// Contracts
export type {
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
} from "./types.js";

// Errors
export { VTOError, VTOErrorCodes, type VTOErrorCode } from "./errors.js";

// Garment image primitives
export {
  fetchGarmentImage,
  validateImageBlob,
  isFetchableImageRef,
  DEFAULT_MAX_IMAGE_BYTES,
  DEFAULT_ALLOWED_IMAGE_TYPES,
  type GarmentImageOptions,
} from "./garmentImage.js";
