/**
 * useVTOSession — manage a live try-on session's lifecycle in React.
 *
 * Owns the awkward parts of session handling: creating it once, tearing it
 * down on unmount, and guaranteeing that an in-flight start is not committed
 * after the component has gone away.
 *
 *   const { session, state, error, start, stop } = useVTOSession(vto, "shirt-123");
 */
import * as React from "react";
import type { RaritoneVTO } from "@raritone/live-vto-sdk";
import type { IVTOSession, VTOConnectionState } from "@raritone/vto-core";
import { VTOError } from "@raritone/vto-core";

export interface UseVTOSessionResult {
  session: IVTOSession | null;
  state: VTOConnectionState;
  error: VTOError | null;
  /** Create a session, optionally connecting it to a video element. */
  start: (opts?: { videoElement?: HTMLVideoElement }) => Promise<IVTOSession>;
  /** End the session and release the camera. */
  stop: () => Promise<void>;
}

export function useVTOSession(
  vto: RaritoneVTO | null,
  productId?: string,
): UseVTOSessionResult {
  const [session, setSession] = React.useState<IVTOSession | null>(null);
  const [state, setState] = React.useState<VTOConnectionState>("IDLE");
  const [error, setError] = React.useState<VTOError | null>(null);

  // Refs so teardown and start always see the current session without
  // re-subscribing effects on every render.
  const sessionRef = React.useRef<IVTOSession | null>(null);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      const active = sessionRef.current;
      sessionRef.current = null;
      if (active) void active.disconnect().catch(() => {});
    };
  }, []);

  const stop = React.useCallback(async () => {
    const active = sessionRef.current;
    sessionRef.current = null;
    if (active) await active.disconnect().catch(() => {});
    if (mountedRef.current) {
      setSession(null);
      setState("ENDED");
    }
  }, []);

  const start = React.useCallback(
    async (opts?: { videoElement?: HTMLVideoElement }) => {
      if (!vto) {
        throw new VTOError("NOT_INITIALIZED", "useVTOSession: no RaritoneVTO instance");
      }
      if (!productId) {
        throw new VTOError("GARMENT_INVALID", "useVTOSession: productId is required");
      }

      // Replace any previous session rather than stacking connections.
      if (sessionRef.current) {
        await sessionRef.current.disconnect().catch(() => {});
        sessionRef.current = null;
      }

      setError(null);
      const next = await vto.createSession({ productId });
      sessionRef.current = next;

      if (!mountedRef.current) {
        // Unmounted mid-flight — do not leak the camera.
        await next.disconnect().catch(() => {});
        throw new VTOError("INVALID_STATE", "useVTOSession: unmounted while starting");
      }

      setSession(next);
      setState(next.state);

      try {
        if (opts?.videoElement) {
          await next.connect({ videoElement: opts.videoElement });
        }
      } catch (e) {
        const err =
          e instanceof VTOError
            ? e
            : new VTOError("CONNECTION_FAILED", (e as Error).message);
        if (mountedRef.current) setError(err);
        throw err;
      }

      return next;
    },
    [vto, productId],
  );

  return { session, state, error, start, stop };
}
