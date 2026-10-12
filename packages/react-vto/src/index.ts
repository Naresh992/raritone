/**
 * @raritone/react-vto — React bindings for Raritone live virtual try-on.
 *
 * The realtime engine is provider-independent and lives in
 * @raritone/live-vto-sdk; this package only adds React ergonomics.
 *
 *   const vto = useMemo(() => new RaritoneVTO({ backendUrl, clientKey }), []);
 *   const { session, state, error, start, stop } = useVTOSession(vto, productId);
 *   <LiveVTOView session={session} onStateChange={setState} />
 */
export { LiveVTOView, type LiveVTOViewProps } from "./LiveVTOView.js";
export { useVTOSession, type UseVTOSessionResult } from "./useVTOSession.js";

// Re-export the client and its types so React apps need a single import.
export { RaritoneVTO } from "@raritone/live-vto-sdk";
export { VTOError, VTOErrorCodes } from "@raritone/vto-core";

export type {
  VTOErrorCode,
  VTOConnectionState,
  VTOSessionState,
  GarmentCategory,
  GarmentConfig,
  Garment,
  ResolvedGarment,
  VTOProviderCapabilities,
  VTOSessionInfo,
  RaritoneVTOConfig,
  IVTOSession,
  BackendSessionResponse,
  BackendTokenResponse,
  ClientKeyResponse,
} from "@raritone/vto-core";
