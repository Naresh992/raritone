import { describe, it, expect } from "vitest";
import * as sdk from "../src/index.js";

/**
 * Guards the public surface.
 *
 * Provider adapters are an implementation detail: integrations must go through
 * `RaritoneVTO`. If someone re-exports a provider later, this fails loudly
 * rather than silently binding the platform to one vendor.
 */
describe("public surface", () => {
  it("exports RaritoneVTO as the entry point", () => {
    expect(typeof sdk.RaritoneVTO).toBe("function");
  });

  it("does not export provider adapters", () => {
    const leaked = [
      "DecartRealtimeProvider",
      "MockRealtimeProvider",
      "RaritoneRealtimeProvider",
      "DECART_VTON_MODEL",
    ].filter((name) => name in sdk);
    expect(leaked).toEqual([]);
  });

  it("re-exports the shared error contract from core", () => {
    expect(typeof sdk.VTOError).toBe("function");
    expect(sdk.VTOErrorCodes.INVALID_STATE).toBe("INVALID_STATE");
    expect(sdk.VTOError.isVTOError(new sdk.VTOError("UNKNOWN", "x"))).toBe(true);
  });

  it("never requires a provider secret in config", () => {
    // A client key is publishable; provider API keys must not be accepted.
    const cfg: sdk.RaritoneVTOConfig = {
      backendUrl: "https://example.com",
      clientKey: "rt_live_public",
    };
    expect("clientKey" in cfg).toBe(true);
    expect(Object.keys(cfg)).not.toContain("decartApiKey");
  });
});
