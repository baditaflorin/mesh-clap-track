import { useEffect, useMemo, useRef, useState } from "react";
import { useVibration } from "@baditaflorin/mesh-common";
import { createRoomSync } from "../sync/yjsRoom";
import { createClockSync } from "../sync/clockSync";
import { maybeFetchTurnCredentials } from "../sync/iceConfig";
import { ALL_SLOTS, SLOT_INFO, playDrum, type Slot } from "./drums";
import { OnsetDetector } from "./onset";

const LOOP_MS = 30000;

type TapEvent = { slot: Slot; dt: number; id: string };

type Props = {
  roomId: string;
  slot: Slot;
  sensitivity: number;
};

export function ClapTrack({ roomId, slot, sensitivity }: Props) {
  const [armed, setArmed] = useState(false);
  // micActive=false means the user joined without granting the mic: the loop
  // still syncs + plays, but onsets come from the manual "Tap" button instead
  // of live audio. Keeps the app usable on desktop and drivable headless.
  const [micActive, setMicActive] = useState(false);
  const [phase, setPhase] = useState(0);
  const [taps, setTaps] = useState<TapEvent[]>([]);
  const [peers, setPeers] = useState(0);
  const [meta, setMeta] = useState<{ rms: number; threshold: number }>({ rms: 0, threshold: 0 });
  const [detectionRate, setDetectionRate] = useState(0); // claps per second over last 5s
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const detectorRef = useRef<OnsetDetector | null>(null);
  const playedRef = useRef(new Set<string>());
  const recentClapTimesRef = useRef<number[]>([]);
  const haptic = useVibration();

  // Push fresh sensitivity into detector if changed mid-session.
  useEffect(() => {
    if (detectorRef.current) detectorRef.current.sensitivity = sensitivity;
  }, [sensitivity]);

  const mesh = useMemo(() => {
    if (!armed) return null;
    const room = createRoomSync(roomId);
    const clock = createClockSync(room.provider);
    const events = room.doc.getArray<TapEvent>("taps");
    return { room, clock, events };
  }, [armed, roomId]);

  useEffect(() => {
    if (!armed) return;
    void maybeFetchTurnCredentials();
  }, [armed]);

  useEffect(() => {
    return () => {
      mesh?.clock.destroy();
      mesh?.room.provider?.destroy();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [mesh]);

  // Mirror Yjs Y.Array → local state
  useEffect(() => {
    if (!mesh) return undefined;
    const update = () => setTaps(mesh.events.toArray());
    mesh.events.observe(update);
    update();
    return () => mesh.events.unobserve(update);
  }, [mesh]);

  // Main rAF loop: onset detection + playback + visualization
  useEffect(() => {
    if (!mesh) return undefined;
    let frame = 0;
    const tick = () => {
      const ctx = audioCtxRef.current;
      const detector = detectorRef.current;
      // The loop runs even without a mic (joined-without-mic / desktop): phase,
      // peer count, sync and visual playback still work; only live onset
      // detection needs the detector. Manual taps come from the Tap button.
      const t = mesh.clock.meshNow();
      const loopT = ((t % LOOP_MS) + LOOP_MS) % LOOP_MS;
      setPhase(loopT / LOOP_MS);
      const loopId = Math.floor(t / LOOP_MS);

      // Onset detection (mic path only)
      if (ctx && detector) {
        const state = detector.step(t);
        setMeta({ rms: state.rms, threshold: state.threshold });

        if (state.fired) {
          const ev: TapEvent = { slot, dt: loopT, id: crypto.randomUUID() };
          mesh.events.push([ev]);
          playDrum(ctx, slot, ctx.currentTime);
          playedRef.current.add(`${loopId}:${ev.id}`);
          recentClapTimesRef.current.push(t);
          haptic.vibrate(20);
        }
      }

      // Prune recent clap times to last 5s, compute rate
      const cutoff = t - 5000;
      while (recentClapTimesRef.current.length && (recentClapTimesRef.current[0] ?? 0) < cutoff) {
        recentClapTimesRef.current.shift();
      }
      setDetectionRate(recentClapTimesRef.current.length / 5);

      // Scheduled playback of all taps (incl. peers'). Audio only when a ctx
      // exists; without one we still mark events played so the loop visual
      // stays consistent.
      const lookahead = 60;
      for (const ev of taps) {
        const evKey = `${loopId}:${ev.id}`;
        if (playedRef.current.has(evKey)) continue;
        const ahead = ev.dt - loopT;
        if (ahead >= -10 && ahead <= lookahead) {
          playedRef.current.add(evKey);
          if (ctx) playDrum(ctx, ev.slot, ctx.currentTime + Math.max(0, ahead / 1000));
        }
      }
      if (loopT < 100) {
        playedRef.current = new Set(
          [...playedRef.current].filter((k) => k.startsWith(`${loopId}:`)),
        );
      }
      setPeers(mesh.clock.peerCount());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [mesh, taps, slot]);

  const onArm = async () => {
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0;
      src.connect(analyser);
      const detector = new OnsetDetector(analyser);
      detector.sensitivity = sensitivity;

      audioCtxRef.current = ctx;
      streamRef.current = stream;
      analyserRef.current = analyser;
      detectorRef.current = detector;
      setMicActive(true);
      setArmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  // Join the mesh without granting the mic. The loop still syncs and the
  // user taps a beat manually with the Tap button. Keeps the app usable on
  // desktop / when the mic is denied, and makes the sync drivable headless.
  const onJoinWithoutMic = () => {
    setMicActive(false);
    setArmed(true);
  };

  // Drop a tap at the current loop position into the shared Yjs array. Used
  // by the manual Tap button (no-mic fallback) — identical write path to the
  // mic onset, so it propagates to every peer.
  const onTap = () => {
    if (!mesh) return;
    const t = mesh.clock.meshNow();
    const loopT = ((t % LOOP_MS) + LOOP_MS) % LOOP_MS;
    const ev: TapEvent = { slot, dt: loopT, id: crypto.randomUUID() };
    mesh.events.push([ev]);
    const ctx = audioCtxRef.current;
    if (ctx) {
      playedRef.current.add(`${Math.floor(t / LOOP_MS)}:${ev.id}`);
      playDrum(ctx, slot, ctx.currentTime);
    }
    recentClapTimesRef.current.push(t);
    haptic.vibrate(20);
  };

  const onClear = () => {
    if (!mesh) return;
    mesh.room.doc.transact(() => {
      mesh.events.delete(0, mesh.events.length);
    });
  };

  if (!armed) {
    return (
      <div className="clap-arm">
        <h1>mesh-clap-track</h1>
        <p>
          Each phone listens to its mic and detects real claps. Every clap drops into a 30-second
          loop that replays in mesh-time on every phone. Each phone is a different drum sound — the
          room claps a beat together.
        </p>
        <p className="clap-meta">
          Your drum:{" "}
          <strong style={{ color: SLOT_INFO[slot].color }}>
            {SLOT_INFO[slot].emoji} {SLOT_INFO[slot].label}
          </strong>
        </p>
        <button type="button" className="clap-arm-button" onClick={onArm}>
          Allow mic &amp; connect
        </button>
        {error && <p className="clap-error">Mic error: {error}</p>}
        <button type="button" className="clap-arm-nomic" onClick={onJoinWithoutMic}>
          Join without mic — tap the beat by hand
        </button>
        <p className="clap-hint">Pick a different drum per phone in Settings.</p>
      </div>
    );
  }

  const ownTaps = taps.filter((t) => t.slot === slot);
  const otherTaps = taps.filter((t) => t.slot !== slot);

  // Mic-level bar: scale RMS to a 0..1 visual.
  // Threshold line at threshold/2 of the visible range — keeps it visible
  // even when ambient is very low.
  const visScale = Math.max(meta.threshold * 2.5, 0.05);
  const rmsPct = Math.min(100, (meta.rms / visScale) * 100);
  const thrPct = Math.min(100, (meta.threshold / visScale) * 100);

  return (
    <div
      className="clap-stage"
      style={{ "--accent": SLOT_INFO[slot].color } as React.CSSProperties}
    >
      <div className="clap-hud">
        {peers + 1} phones · {taps.length} taps in loop
      </div>

      {peers === 0 && (
        <p className="clap-solo-hint">
          You&rsquo;re the only phone here. Open this page on another phone (or a second browser
          tab) in the same room to build the beat together — pick a different drum on each in ⚙
          Settings, or use 📡 to share a join link.
        </p>
      )}

      <div className="clap-loop">
        <div className="clap-loop-track">
          {otherTaps.map((t) => (
            <div
              key={t.id}
              className="clap-loop-mark clap-loop-other"
              style={{
                left: `${(t.dt / LOOP_MS) * 100}%`,
                background: SLOT_INFO[t.slot].color,
              }}
            />
          ))}
          {ownTaps.map((t) => (
            <div
              key={t.id}
              className="clap-loop-mark clap-loop-own"
              style={{ left: `${(t.dt / LOOP_MS) * 100}%` }}
            />
          ))}
          <div className="clap-loop-playhead" style={{ left: `${phase * 100}%` }} />
        </div>
      </div>

      {micActive ? (
        <div className="clap-mic">
          <div className="clap-mic-bar">
            <div
              className="clap-mic-bar-fill"
              style={{ width: `${rmsPct}%`, background: SLOT_INFO[slot].color }}
            />
            <div className="clap-mic-bar-threshold" style={{ left: `${thrPct}%` }} />
          </div>
          <p className="clap-mic-label">
            {SLOT_INFO[slot].emoji} you are <strong>{SLOT_INFO[slot].label}</strong> ·{" "}
            {detectionRate.toFixed(1)} claps/s
          </p>
          {detectionRate > 4 && (
            <p className="clap-mic-warn">High detection rate — lower sensitivity in Settings.</p>
          )}
        </div>
      ) : (
        <p className="clap-mic-label">
          {SLOT_INFO[slot].emoji} you are <strong>{SLOT_INFO[slot].label}</strong> · tap the beat by
          hand
        </p>
      )}

      <button
        type="button"
        className="clap-tap"
        data-testid="clap-tap"
        onClick={(e) => {
          e.stopPropagation();
          onTap();
        }}
      >
        Tap {SLOT_INFO[slot].emoji}
      </button>

      <button
        type="button"
        className="clap-clear"
        onClick={(e) => {
          e.stopPropagation();
          onClear();
        }}
      >
        Clear loop
      </button>
    </div>
  );
}

export { ALL_SLOTS, SLOT_INFO };
export type { Slot };
