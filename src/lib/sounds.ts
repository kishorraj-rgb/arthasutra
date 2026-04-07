// ═══════════════════════════════════════════════════════════════
// ArthaSutra — Web Audio Sound Effects (zero dependencies)
// ═══════════════════════════════════════════════════════════════

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function shouldPlay(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return false;
  return localStorage.getItem("arthasutra-sound") !== "false";
}

// ── Sound generators ────────────────────────────────────────────

/** Short click — 800 Hz sine, 40 ms, gain 0.08 */
export function playClick(): void {
  if (!shouldPlay()) return;
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 800;
  gain.gain.value = 0.08;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.04);
}

/** Two ascending tones — 523 Hz → 659 Hz, 180 ms total, gain 0.1 */
export function playSuccess(): void {
  if (!shouldPlay()) return;
  const ctx = getAudioContext();

  const osc1 = ctx.createOscillator();
  const gain1 = ctx.createGain();
  osc1.type = "sine";
  osc1.frequency.value = 523;
  gain1.gain.value = 0.1;
  osc1.connect(gain1).connect(ctx.destination);
  osc1.start();
  osc1.stop(ctx.currentTime + 0.09);

  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.value = 659;
  gain2.gain.value = 0.1;
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(ctx.currentTime + 0.09);
  osc2.stop(ctx.currentTime + 0.18);
}

/** Error buzz — 200 Hz sawtooth, 120 ms, gain 0.08 */
export function playError(): void {
  if (!shouldPlay()) return;
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 200;
  gain.gain.value = 0.08;
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.12);
}

/** Notification ping — 880 Hz sine with exponential decay, 250 ms, gain 0.08 */
export function playNotification(): void {
  if (!shouldPlay()) return;
  const ctx = getAudioContext();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = 880;
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.25);
}

// ── Toggle helpers ──────────────────────────────────────────────

export function setSoundEnabled(enabled: boolean): void {
  localStorage.setItem("arthasutra-sound", String(enabled));
}

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem("arthasutra-sound") !== "false";
}
