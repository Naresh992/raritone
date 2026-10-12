/**
 * LiveVTOView — React component for rendering the transformed stream.
 * Thin wrapper; all realtime logic lives in VTOSession / providers.
 *
 * Usage:
 *   <LiveVTOView session={session} onStateChange={setState} />
 */
import * as React from "react";
import type { VTOSession } from "@raritone/live-vto-sdk";
import type { VTOConnectionState } from "@raritone/vto-core";

export interface LiveVTOViewProps
  extends Omit<React.VideoHTMLAttributes<HTMLVideoElement>, "onError"> {
  session: VTOSession | null;
  /** Show local preview while the transformed stream is not ready yet */
  showLocalPreview?: boolean;
  onStateChange?: (s: VTOConnectionState) => void;
  onVTOError?: (e: Error) => void;
}

export function LiveVTOView({
  session,
  showLocalPreview = true,
  onStateChange,
  onVTOError,
  ...videoProps
}: LiveVTOViewProps) {
  const localRef = React.useRef<HTMLVideoElement>(null);
  const remoteRef = React.useRef<HTMLVideoElement>(null);
  const [state, setState] = React.useState<VTOConnectionState>(session?.state ?? "IDLE");

  React.useEffect(() => {
    if (!session) return;
    setState(session.state);
    const offState = session.on("stateChange", (s) => {
      setState(s);
      onStateChange?.(s);
    });
    const offErr = session.on("error", (e) => onVTOError?.(e as Error));
    // The provider owns the remote track; this component only renders it.
    return () => {
      offState();
      offErr();
    };
  }, [session, onStateChange, onVTOError]);

  React.useEffect(() => {
    if (!session || !localRef.current) return;
    const stream = session.camera.activeStream;
    if (stream && localRef.current.srcObject !== stream) {
      localRef.current.srcObject = stream;
      void localRef.current.play().catch(() => {});
    }
  }, [session, state]);

  const showRemote = state === "LIVE" || state === "SWITCHING_GARMENT";
  const showLocal = showLocalPreview && !showRemote;
  const isConnecting =
    state === "INITIALIZING" || state === "REQUESTING_CAMERA" || state === "CONNECTING";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        background: "#0a0a0a",
        overflow: "hidden",
      }}
    >
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        muted
        style={{
          display: showRemote ? "block" : "none",
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
        {...videoProps}
      />
      <video
        ref={localRef}
        autoPlay
        playsInline
        muted
        style={{
          display: showLocal ? "block" : "none",
          width: "100%",
          height: "100%",
          objectFit: "cover",
          // mirror the front camera
          transform: session?.camera.facingMode === "user" ? "scaleX(-1)" : undefined,
        }}
      />
      {isConnecting ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#fff",
            fontSize: 14,
          }}
        >
          Connecting…
        </div>
      ) : null}
      {state === "ERROR" ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "grid",
            placeItems: "center",
            color: "#ff6b6b",
            fontSize: 14,
          }}
        >
          Connection error — try again
        </div>
      ) : null}
    </div>
  );
}
