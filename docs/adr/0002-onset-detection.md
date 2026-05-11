---
status: accepted
date: 2026-05-12
---

# 0002 — Onset detection via adaptive threshold

## Context

`mesh-clap-track` needs to recognise hand-claps (and similar sharp transients: snaps, hand-drum hits) from a live microphone, in a room that may have wildly different ambient noise — a quiet living room, a loud cafe, an outdoor street. A fixed dBFS threshold either misses claps in a noisy room or false-triggers on background chatter in a quiet one.

We also need to do this in the browser, in real time, without ML and without buffering audio (see ADR 0003).

## Decision

Run a single `AnalyserNode` on the live mic stream (fftSize 1024, smoothingTimeConstant 0) and poll it from a `requestAnimationFrame` loop (~60 Hz). For each frame:

1. Read `getByteTimeDomainData` into a window.
2. Compute the window's RMS energy, normalised to 0..1.
3. Maintain a running mean and standard deviation of the per-frame RMS using Welford's online algorithm.
4. Maintain a small ring buffer of the last 10 frames' RMS to compare the current frame against its recent neighbours.
5. Fire an onset when **all** of the following are true:
   - `frame_rms > running_mean + 3 × sensitivity × stddev`
   - `frame_rms > 2 × mean(last 10 frames)`
   - `now − last_fired_at > 150 ms` (refractory period — a single clap is one event, not three).
6. Ignore the first 30 frames (warm-up) so the running stats are not dominated by silence at start.

The `sensitivity` multiplier is exposed in Settings, range 0.5–3.0 (default 1.0). Lower values mean a lower threshold — more sensitive.

## Consequences

- Self-calibrates to the room's baseline noise within ~1 second. Works in cafes, on streets, at parties.
- The two-condition AND (statistical + ratio-vs-recent) catches sharp transients but rejects slow swells like an HVAC ramping up.
- The 150 ms refractory matches the slowest expected clap-to-clap cadence in a normal beat (>400 BPM = 150 ms inter-onset, well beyond human clapping).
- Detection cost is trivial — one rAF pass per frame, no FFT, no buffer copy beyond the time-domain window.

## Alternatives considered

- **Fixed dBFS threshold.** Rejected — see Context. A fixed threshold cannot serve both quiet and loud rooms.
- **Spectral flux / high-frequency content.** More precise for distinguishing claps from kicks, but each frame requires an FFT and tuning. Overkill for "did a sharp thing happen."
- **ML onset detection (e.g. CREPE, TF.js).** Bundle weight is ~5 MB, model load adds startup latency, and the user-facing improvement is marginal for sharp transients. Rejected.
- **Send raw audio to a server.** Would defeat the privacy guarantee in ADR 0003 and require a backend.

## Caveats

- Very rhythmic ambient sound (music with a strong beat playing in the background) **will** false-trigger. The UI surfaces a "lower sensitivity in Settings" hint when the detection rate exceeds ~4 claps/second sustained.
- Continuous loud noise (a vacuum cleaner) won't false-trigger — the running mean adapts to it — but it will mask real claps because the ratio-vs-recent test fails.
- Variance estimate drifts over very long sessions because we use cumulative Welford rather than a windowed estimator. Acceptable for typical session lengths (minutes, not hours). A page reload resets.
