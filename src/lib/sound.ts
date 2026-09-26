"use client";

import { useSettings } from "@/stores/settings";

/**
 * Synthesized sound (Web Audio, no files). A small palette tuned to feel like
 * one heist movie: soft footsteps, clunky locks, a siren when it goes wrong.
 */

export type Sfx =
  | "step"
  | "wait"
  | "blocked"
  | "loot"
  | "key"
  | "door"
  | "takedown"
  | "emp"
  | "caught"
  | "cracked"
  | "click"
  | "tick"
  | "solve";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let air: GainNode | null = null;
let noise: AudioBuffer | null = null;

function ensure(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC({ latencyHint: "interactive" });
    master = ctx.createGain();
    master.connect(ctx.destination);
    // a short dark delay gives everything a "big empty building" feel
    air = ctx.createGain();
    air.connect(master);
    const delay = ctx.createDelay(1);
    delay.delayTime.value = 0.17;
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1800;
    const wet = ctx.createGain();
    wet.gain.value = 0.25;
    air.connect(delay);
    delay.connect(lp).connect(fb).connect(delay);
    lp.connect(wet).connect(master);
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.2), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function primeAudio() {
  ensure();
}

function env(g: GainNode, t: number, peak: number, a: number, d: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}

function tone(c: AudioContext, t: number, o: { f: number; type?: OscillatorType; peak: number; a?: number; d: number; to?: number; bus?: AudioNode | null }) {
  const out = o.bus ?? master;
  if (!out) return;
  const osc = c.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.a ?? 0.004) + o.d);
  const g = c.createGain();
  env(g, t, o.peak, o.a ?? 0.004, o.d);
  osc.connect(g).connect(out);
  osc.start(t);
  osc.stop(t + (o.a ?? 0.004) + o.d + 0.05);
}

function hiss(c: AudioContext, t: number, o: { f: number; to?: number; q?: number; type?: BiquadFilterType; peak: number; a?: number; d: number; bus?: AudioNode | null }) {
  const out = o.bus ?? master;
  if (!out || !noise) return;
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = o.type ?? "bandpass";
  f.frequency.setValueAtTime(o.f, t);
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + (o.a ?? 0.002) + o.d);
  f.Q.value = o.q ?? 1;
  const g = c.createGain();
  env(g, t, o.peak, o.a ?? 0.002, o.d);
  src.connect(f).connect(g).connect(out);
  src.start(t, Math.random() * 0.5);
  src.stop(t + (o.a ?? 0.002) + o.d + 0.05);
}

const jit = (n: number, s = 0.08) => n * (1 + (Math.random() * 2 - 1) * s);

export function sfx(name: Sfx) {
  const s = useSettings.getState();
  if (!s.sound || s.volume <= 0) return;
  const c = ensure();
  if (!c || !master) return;
  master.gain.value = s.volume * 0.7;
  const t = c.currentTime;
  switch (name) {
    case "step":
      hiss(c, t, { f: jit(700), q: 0.8, type: "lowpass", peak: 0.35, a: 0.003, d: 0.05 });
      tone(c, t, { f: jit(90), peak: 0.2, d: 0.06 });
      break;
    case "wait":
      tone(c, t, { f: 220, type: "triangle", peak: 0.05, d: 0.12 });
      break;
    case "blocked":
      tone(c, t, { f: 110, type: "square", peak: 0.05, d: 0.06 });
      break;
    case "click":
      hiss(c, t, { f: 3000, q: 3, peak: 0.12, d: 0.02 });
      break;
    case "tick":
      tone(c, t, { f: 1200, peak: 0.05, d: 0.03 });
      break;
    case "loot":
      [987.77, 1318.51, 1975.53].forEach((f, i) => tone(c, t + i * 0.05, { f, peak: 0.12, d: 0.5, bus: air }));
      hiss(c, t, { f: 6000, q: 2, peak: 0.06, d: 0.3, bus: air });
      break;
    case "key":
      tone(c, t, { f: 1760, peak: 0.1, d: 0.12 });
      tone(c, t + 0.07, { f: 2349.3, peak: 0.1, d: 0.2, bus: air });
      break;
    case "door":
      hiss(c, t, { f: 400, q: 2, peak: 0.4, d: 0.08 });
      tone(c, t, { f: 70, type: "triangle", peak: 0.35, d: 0.18 });
      hiss(c, t + 0.1, { f: 1200, to: 300, q: 1, peak: 0.12, a: 0.03, d: 0.3, bus: air });
      break;
    case "takedown":
      tone(c, t, { f: 120, to: 50, type: "sine", peak: 0.5, d: 0.2 });
      hiss(c, t, { f: 500, q: 0.7, type: "lowpass", peak: 0.4, d: 0.12 });
      break;
    case "emp":
      tone(c, t, { f: 1600, to: 60, type: "sawtooth", peak: 0.12, a: 0.005, d: 0.6, bus: air });
      hiss(c, t, { f: 8000, to: 200, q: 0.6, peak: 0.2, d: 0.7, bus: air });
      break;
    case "caught": {
      // two-tone siren and a low hit
      tone(c, t, { f: 60, type: "sine", peak: 0.6, d: 0.5 });
      for (let i = 0; i < 4; i++) {
        tone(c, t + i * 0.28, { f: i % 2 ? 660 : 880, type: "square", peak: 0.08, a: 0.01, d: 0.24, bus: air });
      }
      break;
    }
    case "cracked": {
      hiss(c, t, { f: 300, q: 1.5, peak: 0.4, d: 0.15 });
      tone(c, t, { f: 55, type: "triangle", peak: 0.5, d: 0.5 });
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(c, t + 0.25 + i * 0.09, { f, type: "triangle", peak: 0.12, d: 0.9, bus: air }));
      tone(c, t + 0.7, { f: 1567.98, peak: 0.08, d: 1.4, bus: air });
      break;
    }
    case "solve":
      [392, 523.25].forEach((f, i) => tone(c, t + i * 0.08, { f, peak: 0.08, d: 0.3, bus: air }));
      break;
  }
}
