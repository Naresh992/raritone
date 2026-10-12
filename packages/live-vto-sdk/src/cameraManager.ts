/**
 * cameraManager — owns the local camera MediaStream.
 *
 * The provider consumes this stream; the SDK never keeps a second copy.
 * All errors are normalised to VTOError so callers never have to branch on
 * DOMException names.
 */
import { VTOError } from "./types.js";

export type CameraFacing = "user" | "environment";

export interface CameraManagerOptions {
  facing?: CameraFacing;
  width?: number;
  height?: number;
}

export class CameraManager {
  private stream: MediaStream | null = null;
  private _facing: CameraFacing;

  constructor(opts: CameraManagerOptions = {}) {
    this._facing = opts.facing ?? "user";
  }

  get activeStream(): MediaStream | null {
    return this.stream;
  }

  get facingMode(): CameraFacing {
    return this._facing;
  }

  async request(facing: CameraFacing = this._facing): Promise<MediaStream> {
    this._facing = facing;
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      this.cleanup();
      this.stream = s;
      return s;
    } catch (e: unknown) {
      const err = e as DOMException;
      if (err?.name === "NotAllowedError") {
        throw new VTOError("PERMISSION_DENIED", "Camera permission denied", { recoverable: true });
      }
      if (err?.name === "NotFoundError") {
        throw new VTOError("DEVICE_NOT_FOUND", "No camera found", { recoverable: false });
      }
      throw new VTOError("PERMISSION_DENIED", err?.message ?? "Failed to access camera", {
        details: { cause: e instanceof Error ? e.message : String(e) },
      });
    }
  }

  async switchCamera(): Promise<MediaStream> {
    const next: CameraFacing = this._facing === "user" ? "environment" : "user";
    return this.request(next);
  }

  cleanup(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        try {
          track.stop();
        } catch {
          /* already stopped */
        }
      }
    }
    this.stream = null;
  }
}
