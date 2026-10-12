/**
 * RaritoneRealtimeProvider — placeholder for future proprietary model.
 * Clearly marked unimplemented. Implements the interface so SDK consumers
 * can type-check against it without runtime behavior.
 */
import type { RealtimeVTOProvider, VTOSessionInfo, CreateSessionConfig, ResolvedGarment, VTOProviderCapabilities } from "../types.js";
import { VTOError } from "../types.js";

export class RaritoneRealtimeProvider implements RealtimeVTOProvider {
  readonly name = "raritone";
  readonly capabilities: VTOProviderCapabilities = {
    liveVideo: false,
    garmentSwitching: false,
    garmentSwitchingWithoutReconnect: false,
    cameraSwitching: false,
    pauseResume: false,
    snapshotExport: false,
    maxDurationSec: 0,
  };

  async createSession(_config: CreateSessionConfig): Promise<VTOSessionInfo> {
    throw new VTOError("PROVIDER_ERROR", "Raritone proprietary realtime model not yet available — provider is a stub. Use decart or mock.", {
      recoverable: false,
    });
  }
  async connect(_s: VTOSessionInfo, _o: { mediaStream: MediaStream }): Promise<void> {
    throw new VTOError("PROVIDER_ERROR", "Raritone provider not implemented");
  }
  async setGarment(_s: VTOSessionInfo, _g: ResolvedGarment): Promise<void> {
    throw new VTOError("PROVIDER_ERROR", "Raritone provider not implemented");
  }
  async disconnect(_s: VTOSessionInfo): Promise<void> {
    // no-op
  }
}
