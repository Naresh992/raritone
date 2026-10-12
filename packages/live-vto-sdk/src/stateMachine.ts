/**
 * Session state machine — single source of truth for valid transitions.
 * Prevents invalid transitions, duplicate session creation, orphaned connections.
 */
import type { VTOConnectionState } from "./types.js";
import { VTOError } from "./types.js";

const TRANSITIONS: Record<VTOConnectionState, VTOConnectionState[]> = {
  IDLE: ["INITIALIZING"],
  INITIALIZING: ["REQUESTING_CAMERA", "ERROR", "ENDED"],
  REQUESTING_CAMERA: ["CONNECTING", "ERROR", "ENDED"],
  CONNECTING: ["READY", "ERROR", "ENDED"],
  READY: ["PROCESSING", "GENERATING", "ENDING", "ERROR", "ENDED"],
  PROCESSING: ["LIVE", "GENERATING", "RECONNECTING", "ERROR", "ENDING", "ENDED"],
  GENERATING: ["LIVE", "SWITCHING_GARMENT", "RECONNECTING", "ERROR", "ENDING", "ENDED"],
  LIVE: ["SWITCHING_GARMENT", "RECONNECTING", "PAUSED", "ENDING", "ERROR", "ENDED"],
  SWITCHING_GARMENT: ["LIVE", "ERROR", "RECONNECTING", "ENDING", "ENDED"],
  RECONNECTING: ["LIVE", "READY", "CONNECTING", "ERROR", "ENDING", "ENDED"],
  PAUSED: ["LIVE", "RECONNECTING", "ENDING", "ERROR", "ENDED"],
  ENDING: ["ENDED", "ERROR"],
  ENDED: [],
  ERROR: ["RECONNECTING", "ENDING", "ENDED", "IDLE", "INITIALIZING"],
};

export class VTOStateMachine {
  private _state: VTOConnectionState = "IDLE";
  private listeners = new Set<(s: VTOConnectionState) => void>();

  get state(): VTOConnectionState {
    return this._state;
  }

  canTransition(to: VTOConnectionState): boolean {
    if (to === this._state) return false;
    return (TRANSITIONS[this._state] ?? []).includes(to);
  }

  transition(to: VTOConnectionState): void {
    if (!this.canTransition(to)) {
      throw new VTOError(
        "INVALID_STATE",
        `Invalid state transition: ${this._state} -> ${to}`,
        { details: { from: this._state, to } },
      );
    }
    this._state = to;
    for (const cb of this.listeners) cb(to);
  }

  /** Force without validation — only for cleanup / reset */
  force(to: VTOConnectionState): void {
    this._state = to;
    for (const cb of this.listeners) cb(to);
  }

  reset(): void {
    this.force("IDLE");
  }

  onChange(cb: (s: VTOConnectionState) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
