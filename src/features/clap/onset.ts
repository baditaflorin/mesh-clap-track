/**
 * Adaptive onset detector for claps / sharp transients.
 *
 * Pipeline (called per-frame at ~60 Hz):
 *   1. AnalyserNode.getByteTimeDomainData → window
 *   2. compute RMS energy of window (frame energy)
 *   3. push into running stats (mean, variance via Welford)
 *   4. fire onset if:
 *        - frame > mean + sensitivity * 3 * stddev
 *        - frame > 2 * avg(last 10 frames excluding this one)
 *        - timeSinceLast > REFRACTORY_MS (150)
 *
 * Returns the current RMS and whether this frame triggered onset.
 */

export type OnsetState = {
  rms: number;
  threshold: number;
  fired: boolean;
};

const REFRACTORY_MS = 150;
const WARMUP_FRAMES = 30;

export class OnsetDetector {
  private buf: Uint8Array<ArrayBuffer>;
  private mean = 0;
  private m2 = 0;
  private n = 0;
  private recent: number[] = [];
  private lastFiredAt = -Infinity;
  // Sensitivity multiplier — lower = more sensitive (lower threshold).
  // Default 1.0 means: threshold = mean + 3*stddev.
  // sensitivity=0.5 → threshold = mean + 1.5*stddev (very sensitive).
  // sensitivity=3.0 → threshold = mean + 9*stddev (very strict).
  sensitivity = 1.0;

  constructor(private analyser: AnalyserNode) {
    this.buf = new Uint8Array(new ArrayBuffer(analyser.fftSize));
  }

  step(now: number): OnsetState {
    this.analyser.getByteTimeDomainData(this.buf);
    // Window RMS, centered at 128 (zero in unsigned byte)
    let sum = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const v = (this.buf[i] ?? 128) - 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / this.buf.length) / 128; // normalized 0..1

    // Welford running mean+variance
    this.n += 1;
    const delta = rms - this.mean;
    this.mean += delta / this.n;
    const delta2 = rms - this.mean;
    this.m2 += delta * delta2;
    const variance = this.n > 1 ? this.m2 / (this.n - 1) : 0;
    const stddev = Math.sqrt(Math.max(0, variance));

    const avgRecent =
      this.recent.length > 0 ? this.recent.reduce((a, b) => a + b, 0) / this.recent.length : 0;

    const threshold = this.mean + 3 * this.sensitivity * stddev;

    let fired = false;
    if (
      this.n > WARMUP_FRAMES &&
      rms > threshold &&
      rms > 2 * avgRecent &&
      now - this.lastFiredAt > REFRACTORY_MS
    ) {
      fired = true;
      this.lastFiredAt = now;
    }

    // Update the recent buffer AFTER the comparison so the current frame
    // is compared to its predecessors, not to itself.
    this.recent.push(rms);
    if (this.recent.length > 10) this.recent.shift();

    return { rms, threshold, fired };
  }
}
