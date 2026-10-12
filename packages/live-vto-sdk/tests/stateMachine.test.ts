import { describe, it, expect } from "vitest";
import { VTOStateMachine } from "../src/stateMachine.js";
import { validateGarment, generateGarmentPrompt } from "../src/garment.js";

describe("VTOStateMachine", () => {
  it("allows valid transitions and rejects invalid", () => {
    const sm = new VTOStateMachine();
    expect(sm.state).toBe("IDLE");
    sm.transition("INITIALIZING");
    sm.transition("REQUESTING_CAMERA");
    sm.transition("CONNECTING");
    sm.transition("READY");
    sm.transition("PROCESSING");
    sm.transition("LIVE");
    expect(sm.state).toBe("LIVE");
    expect(() => sm.transition("IDLE")).toThrow();
    sm.transition("SWITCHING_GARMENT");
    sm.transition("LIVE");
    sm.transition("ENDING");
    sm.transition("ENDED");
    expect(sm.state).toBe("ENDED");
  });
  it("canTransition guards correctly", () => {
    const sm = new VTOStateMachine();
    expect(sm.canTransition("INITIALIZING")).toBe(true);
    expect(sm.canTransition("LIVE")).toBe(false);
  });
});

describe("garment", () => {
  it("validates garment", () => {
    const r = validateGarment({ productId: "abc", category: "t-shirts", colorHex: "#111111" });
    expect(r.valid).toBe(true);
    const r2 = validateGarment({ productId: "", category: "unknown" as any });
    expect(r2.valid).toBe(false);
  });
  it("generates prompt without inventing", () => {
    const p = generateGarmentPrompt({ category: "t-shirts", color: "black", fit: "oversized", name: "Oversized Black Tee" });
    expect(p).toContain("Oversized Black");
    const p2 = generateGarmentPrompt({ category: "dresses", color: "sage" } as any);
    expect(p2).toContain("sage");
  });
  it("respects manual prompt override", () => {
    const p = generateGarmentPrompt({ category: "tee", vtoPrompt: "Custom prompt for this exact garment with details." } as any);
    expect(p).toBe("Custom prompt for this exact garment with details.");
  });
});
