/**
 * MockRealtimeProvider — deterministic, no network, for unit tests and CI.
 * Renders nothing but simulates timing/state for garment switching.
 */
import type { RealtimeVTOProvider, VTOSessionInfo, CreateSessionConfig, ResolvedGarment, VTOProviderCapabilities } from "../types.js";

export class MockRealtimeProvider implements RealtimeVTOProvider {
  readonly name = "mock";
  readonly capabilities: VTOProviderCapabilities = {
    liveVideo: true,
    garmentSwitching: true,
    garmentSwitchingWithoutReconnect: true,
    cameraSwitching: true,
    pauseResume: true,
    snapshotExport: false,
    maxDurationSec: 300,
  };
  private sessions = new Map<string, VTOSessionInfo>();

  async createSession(config: CreateSessionConfig): Promise<VTOSessionInfo> {
    const id = `mock_${Math.random().toString(36).slice(2, 10)}`;
    const info: VTOSessionInfo = {
      sessionId: id,
      productId: config.productId,
      provider: this.name,
      state: "READY",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };
    this.sessions.set(id, info);
    return info;
  }

  async connect(_session: VTOSessionInfo, _opts: { mediaStream: MediaStream }): Promise<void> {
    await new Promise((r) => setTimeout(r, 80));
  }

  async setGarment(_session: VTOSessionInfo, _garment: ResolvedGarment): Promise<void> {
    await new Promise((r) => setTimeout(r, 120));
  }

  async disconnect(session: VTOSessionInfo): Promise<void> {
    this.sessions.delete(session.sessionId);
  }
}
