---
status: accepted
date: 2026-05-12
---

# 0003 — Mic-based onset (real-time only), not MediaRecorder

## Context

The app needs to know **when** a clap happens, not **what** the clap sounds like. There are two ways to listen to a microphone in a browser:

1. `MediaRecorder` — buffers encoded audio chunks (Opus/WebM), suitable for capturing and uploading recordings.
2. `getUserMedia` → `AudioContext.createMediaStreamSource` → `AnalyserNode` — gives real-time access to the audio's time- and frequency-domain samples, without retaining them.

Audio is sensitive content: people in the room may speak, names may slip out, ambient context (a kid crying, a TV in the background) can identify a location. We do not want to be in the business of safely handling audio bytes.

## Decision

Use approach (2). Only the `AnalyserNode` is connected; no `MediaRecorder`, no `ScriptProcessor`, no `AudioWorklet`. Each rAF tick reads `getByteTimeDomainData` into a stack-local `Uint8Array`, computes one scalar (frame RMS), and discards the bytes. No audio buffer is retained, no audio is encoded, no audio is sent over the network. The only data ever leaving the device is the timestamp `dt` (ms-offset into the rolling 30-s loop) and a UUID per detected clap, published to the Yjs `taps` Y.Array.

## Consequences

- **Privacy.** Even a fully compromised signaling server, TURN relay, or peer cannot reconstruct anything about what was said in the room. The wire payload is `{ slot, dt, id }`.
- **No "playback your own claps" feature.** Users cannot review what was captured because nothing was captured. Acceptable trade-off — this is a jam tool, not a recorder.
- **No permission for storage.** The mic permission is the only sensitive permission asked. No microphone bytes are persisted to disk, IndexedDB, or `localStorage`.
- **Performance.** Cheaper than MediaRecorder — no encoder thread, no codec.

## Alternatives considered

- **MediaRecorder + on-device upload.** Would let us send synth-quality claps to peers instead of triggering local drum synthesis. Rejected — that ships audio bytes peer-to-peer, which is a much bigger privacy commitment.
- **AudioWorklet.** Marginally lower-latency than rAF + AnalyserNode but adds a build pipeline for the worklet module. The ~16 ms rAF latency is below the perceptual threshold for "I clapped and a drum played."

## What we tell the user

The README, the privacy doc, and the in-app help all say the same thing: **only timestamps leave your device**. The full payload contract is documented in `docs/privacy.md`.
