/**
 * RaritoneVTO — main entry point for the browser SDK.
 *
 *   const vto = new RaritoneVTO({ backendUrl, clientKey });
 *   const session = await vto.createSession({ productId: "shirt-123" });
 *   await session.connect({ videoElement, onRemoteStream });
 *   await session.setGarment({ id: "shirt-456", ... });
 */
import type {
  RaritoneVTOConfig,
  CreateSessionConfig,
  VTOProviderCapabilities,
  IVTOSession,
} from "@raritone/vto-core";
import { VTOSession } from "./session.js";
import { MockRealtimeProvider } from "./providers/mockProvider.js";
import { DecartRealtimeProvider } from "./providers/decartProvider.js";
import { RaritoneRealtimeProvider } from "./providers/raritoneProvider.js";
import type { RealtimeVTOProvider } from "./types.js";

export class RaritoneVTO {
  readonly config: RaritoneVTOConfig;
  private provider: RealtimeVTOProvider;
  private sessions = new Set<VTOSession>();

  constructor(config: RaritoneVTOConfig) {
    if (!config.backendUrl) throw new Error("RaritoneVTO: backendUrl is required");
    this.config = config;
    this.provider = this.resolveProvider(config.provider);
  }

  private resolveProvider(name?: string): RealtimeVTOProvider {
    const n = (name ?? "").toLowerCase();
    if (n === "mock") return new MockRealtimeProvider();
    if (n === "raritone") return new RaritoneRealtimeProvider();
    // default: decart (backend decides real capability)
    return new DecartRealtimeProvider({
      backendUrl: this.config.backendUrl,
      getAuthToken: this.config.getAuthToken,
    });
  }

  get providerName(): string {
    return this.provider.name;
  }
  get capabilities(): VTOProviderCapabilities {
    return this.provider.capabilities;
  }

  async createSession(config: CreateSessionConfig): Promise<IVTOSession> {
    const session = new VTOSession(this.provider, config.productId);
    const info = await this.provider.createSession(config);
    session._setInfo(info);
    this.sessions.add(session);
    // auto-remove on end
    session.on("stateChange", (s) => {
      if (s === "ENDED") this.sessions.delete(session);
    });
    return session;
  }

  getSessions(): IVTOSession[] {
    return [...this.sessions];
  }

  async destroy(): Promise<void> {
    await Promise.all([...this.sessions].map((s) => s.disconnect().catch(() => {})));
    this.sessions.clear();
  }
}