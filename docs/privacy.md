# Privacy threat model — mesh-clap-track

## What other peers in the same room can see

For every clap your phone detects:

- The 6-bit drum slot you picked (one of kick/snare/hihat/clap/cowbell/rim).
- The millisecond offset `dt` (0–29999) into the shared 30-second rolling loop where the clap landed.
- A per-clap UUID (random; not stable across reloads).

Plus, from the mesh clock-sync layer:

- Your phone's wall-clock time (`Date.now()`), published every 1.5 s.
- Your Yjs awareness `clientID` — a per-session 32-bit random integer regenerated on every page load.

That is the entire payload on the wire. **No audio. No raw mic bytes. No transcript.**

## What stays local — including audio

Your microphone stream goes into one `AnalyserNode` and is read frame-by-frame in real time for energy analysis only. The bytes are never:

- buffered into an audio file,
- encoded by `MediaRecorder`,
- uploaded anywhere,
- written to `localStorage` or IndexedDB.

The clap **detector** runs entirely client-side. Only the **decision** ("a sharp transient happened at offset T into the loop") is published. See [ADR 0003](adr/0003-mic-not-recorder.md).

Your room ID, drum slot, and sensitivity setting are in `localStorage` and never leave your device.

## What the signaling server can see

`signaling-server` (mine, source at https://github.com/baditaflorin/signaling-server) sees:

- The **room name** (`mesh-clap-track:<roomId>`).
- Encrypted **SDP** offer/answer blobs being relayed between peers.
- The IP address of the peer making the WebSocket connection.

It does **not** see clap events or audio. Those flow peer-to-peer over WebRTC DataChannel.

## What the TURN server can see

`coturn-hetzner` (mine, source at https://github.com/baditaflorin/coturn-hetzner) relays encrypted WebRTC traffic when peers cannot connect directly. It sees:

- The IP addresses of the two peers being relayed.
- Encrypted DTLS-SRTP / DataChannel bytes. It cannot decrypt them.

It does **not** see clap events or audio.

## Permissions asked

- **Microphone.** Required. Used for the `AnalyserNode` energy probe only.

That's it. No camera, no location, no motion.

## What's NOT in the threat model

- **Anonymity within the room.** Anyone in the same room with packet-inspection tools could correlate your awareness `clientID` with your IP. Since the only payload is "a drum hit happened at offset T," there is very little to leak.
- **Adversarial peers spamming the loop.** A malicious peer can flood `Y.Array<TapEvent>("taps")`. Anyone in the room can hit **Clear loop**. This is a "trusted group of people in a room" app, not a public broadcast.
