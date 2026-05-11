# mesh-clap-track

[![Live](https://img.shields.io/badge/live-baditaflorin.github.io%2Fmesh--clap--track-A45EFF?style=flat-square)](https://baditaflorin.github.io/mesh-clap-track/)
[![Version](https://img.shields.io/github/package-json/v/baditaflorin/mesh-clap-track?style=flat-square&color=7a7a9a)](https://github.com/baditaflorin/mesh-clap-track/blob/main/package.json)
[![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)](LICENSE)
[![No backend](https://img.shields.io/badge/backend-none-15152a?style=flat-square)](docs/adr/0001-deployment-mode.md)

> Peer-to-peer mesh: real claps from your microphone become a synced drum loop. Each phone is a different drum sound.

**Live:** https://baditaflorin.github.io/mesh-clap-track/

Pick a drum (kick, snare, hi-hat, clap, cowbell, rim). Open the link on every phone. Tap **Allow mic & connect.** Now clap. Every phone in the room listens to its own mic, detects the sharp transient, and writes a tap into a 30-second rolling loop synced via mesh-time. The loop replays on every phone. The room has accidentally composed a beat together.

## How it works

- Each phone joins a shared **Yjs document** over **y-webrtc** via my self-hosted signaling server.
- Each phone runs an `AnalyserNode` on its own mic and detects onsets with an **adaptive threshold** that calibrates to the room's ambient noise — see [ADR 0002](docs/adr/0002-onset-detection.md).
- Detected onsets are published as `{ slot, dt, id }` to a `Y.Array<TapEvent>("taps")` (no audio bytes ever leave the device — see [ADR 0003](docs/adr/0003-mic-not-recorder.md) and [privacy](docs/privacy.md)).
- Every phone schedules drum hits using `meshNow() % 30000` so all phones play the same beat at the same instant.
- The synth (Web Audio drum tones) is reused from [mesh-tap-symphony](https://github.com/baditaflorin/mesh-tap-symphony).

## Privacy threat model

See [docs/privacy.md](docs/privacy.md). Short version: **only timestamps leave your device.** Your microphone audio is processed in-memory by `AnalyserNode` and immediately discarded; no `MediaRecorder`, no upload.

## Architecture

- **Mode A** — pure GitHub Pages, zero backend at runtime ([ADR 0001](docs/adr/0001-deployment-mode.md)).
- **WebRTC** — Yjs + y-webrtc with self-hosted signaling and TURN.
- **No GitHub Actions** — `docs/` is the built site, committed directly; pre-push hook gates build + typecheck.

## Run it locally

```bash
git clone https://github.com/baditaflorin/mesh-clap-track.git
cd mesh-clap-track
npm install
npm run dev
```

Open the URL on two devices and clap.

## Settings (in-app)

- **Room ID** — phones must share one to see each other.
- **Your drum** — kick / snare / hi-hat / clap / cowbell / rim.
- **Mic sensitivity** — 0.5–3.0 multiplier on the adaptive threshold. Lower = more sensitive.
- **Signaling URL** / **TURN credentials URL** — override the self-hosted defaults.

All persisted to `localStorage`.

## Self-hosted infrastructure

| Repo                                                                   | Endpoint                               | Role                      |
| ---------------------------------------------------------------------- | -------------------------------------- | ------------------------- |
| [signaling-server](https://github.com/baditaflorin/signaling-server)   | `wss://turn.0docker.com/ws`            | y-webrtc protocol fan-out |
| [turn-token-server](https://github.com/baditaflorin/turn-token-server) | `https://turn.0docker.com/credentials` | HMAC TURN creds           |
| [coturn-hetzner](https://github.com/baditaflorin/coturn-hetzner)       | `turn:turn.0docker.com:3479`           | TURN relay                |

## ADRs

- [0001 — Deployment mode (Mode A, pure Pages)](docs/adr/0001-deployment-mode.md)
- [0002 — Onset detection via adaptive threshold](docs/adr/0002-onset-detection.md)
- [0003 — Mic-based onset, not MediaRecorder](docs/adr/0003-mic-not-recorder.md)
- [0010 — GitHub Pages publishing](docs/adr/0010-pages-publishing.md)

## License

[MIT](LICENSE) © 2026 Florin Badita
