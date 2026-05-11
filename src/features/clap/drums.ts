export type Slot = "kick" | "snare" | "hihat" | "clap" | "cowbell" | "rim";

export const SLOT_INFO: Record<Slot, { label: string; emoji: string; color: string }> = {
  kick: { label: "kick", emoji: "🥁", color: "#ff5e7a" },
  snare: { label: "snare", emoji: "🪘", color: "#5ed3ff" },
  hihat: { label: "hi-hat", emoji: "🎩", color: "#ffcf5e" },
  clap: { label: "clap", emoji: "👏", color: "#5eff8a" },
  cowbell: { label: "cowbell", emoji: "🔔", color: "#c45eff" },
  rim: { label: "rim", emoji: "🎯", color: "#ffa05e" },
};

export const ALL_SLOTS: Slot[] = ["kick", "snare", "hihat", "clap", "cowbell", "rim"];

export function playDrum(ctx: AudioContext, slot: Slot, t0: number): void {
  switch (slot) {
    case "kick":
      kick(ctx, t0);
      break;
    case "snare":
      snare(ctx, t0);
      break;
    case "hihat":
      hihat(ctx, t0, 0.05);
      break;
    case "clap":
      clap(ctx, t0);
      break;
    case "cowbell":
      cowbell(ctx, t0);
      break;
    case "rim":
      hihat(ctx, t0, 0.02);
      break;
  }
}

function kick(ctx: AudioContext, t0: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(140, t0);
  osc.frequency.exponentialRampToValueAtTime(40, t0 + 0.18);
  gain.gain.setValueAtTime(0.5, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + 0.5);
}

function snare(ctx: AudioContext, t0: number) {
  const noise = whiteNoise(ctx, 0.18);
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 1500;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(t0);
  noise.stop(t0 + 0.18);
}

function hihat(ctx: AudioContext, t0: number, decay: number) {
  const noise = whiteNoise(ctx, decay);
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 7000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, t0);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(t0);
  noise.stop(t0 + decay);
}

function clap(ctx: AudioContext, t0: number) {
  for (const dt of [0, 0.012, 0.022, 0.034]) {
    const noise = whiteNoise(ctx, 0.06);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, t0 + dt);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.06);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(t0 + dt);
    noise.stop(t0 + dt + 0.08);
  }
}

function cowbell(ctx: AudioContext, t0: number) {
  for (const freq of [800, 540]) {
    const osc = ctx.createOscillator();
    osc.type = "square";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.32);
  }
}

function whiteNoise(ctx: AudioContext, durSec: number): AudioBufferSourceNode {
  const length = Math.max(1, Math.ceil(ctx.sampleRate * durSec));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  return src;
}
