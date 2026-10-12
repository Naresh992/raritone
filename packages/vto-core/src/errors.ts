/**
 * VTOError — Standard error class for Raritone VTO platform
 */

export class VTOError extends Error {
  public readonly code: string;
  public readonly recoverable: boolean;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    options?: { recoverable?: boolean; details?: Record<string, unknown> }
  ) {
    super(message);
    this.name = "VTOError";
    this.code = code;
    this.recoverable = options?.recoverable ?? false;
    this.details = options?.details;
  }

  static isVTOError(err: unknown): err is VTOError {
    return err instanceof VTOError;
  }
}

// Common error codes — the single source of truth. `VTOErrorCode` is derived
// from this object, so adding a key here widens the type everywhere at once.
export const VTOErrorCodes = {
  PROVIDER_ERROR: "PROVIDER_ERROR",
  INVALID_STATE: "INVALID_STATE",
  NOT_INITIALIZED: "NOT_INITIALIZED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  SESSION_LIMIT: "SESSION_LIMIT",
  QUOTA_EXCEEDED: "QUOTA_EXCEEDED",
  CONNECTION_FAILED: "CONNECTION_FAILED",
  GARMENT_INVALID: "GARMENT_INVALID",
  GARMENT_NOT_READY: "GARMENT_NOT_READY",
  CAMERA_DENIED: "CAMERA_DENIED",
  CAMERA_UNAVAILABLE: "CAMERA_UNAVAILABLE",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  DEVICE_NOT_FOUND: "DEVICE_NOT_FOUND",
  NETWORK_ERROR: "NETWORK_ERROR",
  TIMEOUT: "TIMEOUT",
  SESSION_ENDED: "SESSION_ENDED",
  AUTH_FAILED: "AUTH_FAILED",
  DOMAIN_NOT_ALLOWED: "DOMAIN_NOT_ALLOWED",
  UNKNOWN: "UNKNOWN",
} as const;

export type VTOErrorCode = (typeof VTOErrorCodes)[keyof typeof VTOErrorCodes];
