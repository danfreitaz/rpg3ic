"use client"
// Sons sintetizados na hora (Web Audio): zero arquivos, zero custo.

let ctx: AudioContext | null = null
let master: GainNode | null = null

export const soundOn = () => { try { return localStorage.getItem("r3_sound") !== "off" } catch { return true } }
export const setSoundOn = (on: boolean) => { try { localStorage.setItem("r3_sound", on ? "on" : "off") } catch {} }

function ac() {
  if (typeof window === "undefined" || !soundOn()) return null
  if (!ctx) {
    const C = window.AudioContext || (window as any).webkitAudioContext
    if (!C) return null
    ctx = new C()
    master = ctx.createGain()
    master.gain.value = 0.35
    master.connect(ctx.destination)
  }
  if (ctx.state === "suspended") ctx.resume().catch(() => {})
  return ctx
}

function tone(freq: number, dur: number, type: OscillatorType = "sine", vol = 0.5, at = 0, slideTo?: number) {
  const c = ac(); if (!c || !master) return
  const t = c.currentTime + at
  const o = c.createOscillator(), g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, t)
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(master)
  o.start(t); o.stop(t + dur + 0.02)
}

function noise(dur: number, at = 0, vol = 0.4, freq = 2200, q = 1.2) {
  const c = ac(); if (!c || !master) return
  const t = c.currentTime + at
  const len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2)
  const src = c.createBufferSource(); src.buffer = buf
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q
  const g = c.createGain(); g.gain.value = vol
  src.connect(f).connect(g).connect(master)
  src.start(t)
}

export const sfx = {
  /** Dados chacoalhando e quicando na mesa. */
  dice() {
    for (let i = 0; i < 7; i++) noise(0.05, i * 0.055 + Math.random() * 0.02, 0.5 - i * 0.05, 1800 + Math.random() * 1800, 3)
    noise(0.09, 0.42, 0.35, 900, 2)
    tone(180, 0.08, "triangle", 0.15, 0.42)
  },
  crit() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, "triangle", 0.35, 0.5 + i * 0.09)); tone(1568, 0.6, "sine", 0.15, 0.86) },
  fumble() { tone(220, 0.35, "sawtooth", 0.18, 0.5, 110); tone(146, 0.5, "triangle", 0.25, 0.7, 73) },
  msg() { tone(880, 0.07, "sine", 0.12); tone(1320, 0.09, "sine", 0.08, 0.04) },
  action() { noise(0.12, 0, 0.18, 700, 0.8); tone(330, 0.12, "triangle", 0.1, 0.02) },
  whisper() { noise(0.3, 0, 0.12, 4200, 0.6); tone(1200, 0.2, "sine", 0.05, 0.05, 900) },
  narration() { [196, 247, 294].forEach((f, i) => tone(f, 0.9, "sine", 0.12, i * 0.06)) },
  damage() { tone(120, 0.22, "square", 0.22, 0, 50); noise(0.15, 0, 0.35, 400, 0.7) },
  heal() { [660, 880, 1320].forEach((f, i) => tone(f, 0.25, "sine", 0.18, i * 0.07)) },
  bell() { tone(784, 1.0, "sine", 0.25); tone(1568, 0.7, "sine", 0.08, 0.01); tone(1176, 0.8, "triangle", 0.05, 0.02) },
  door() { tone(110, 0.3, "triangle", 0.2, 0, 90); noise(0.2, 0.05, 0.15, 500, 1) },
  coin() { tone(2400, 0.06, "triangle", 0.18); tone(3200, 0.05, "triangle", 0.12, 0.08); tone(2600, 0.25, "sine", 0.1, 0.5); tone(2600, 0.15, "sine", 0.08, 0.62) },
  click() { tone(1600, 0.03, "square", 0.05) },
  error() { tone(200, 0.12, "square", 0.12); tone(150, 0.16, "square", 0.12, 0.1) },
  paper() { noise(0.25, 0, 0.2, 3000, 0.5); noise(0.18, 0.12, 0.15, 5000, 0.5) },
}
