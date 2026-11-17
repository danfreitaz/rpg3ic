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

/* ───────────── Trilhas ambiente (tudo sintetizado, em loop) ───────────── */

let amb: { kind: string; gain: GainNode; nodes: AudioNode[]; timers: number[] } | null = null
let ambVol = 0.5
export const ambienceVolume = () => { try { return Number(localStorage.getItem("r3_amb_vol") ?? "0.5") } catch { return 0.5 } }
export function setAmbienceVolume(v: number) {
  ambVol = v
  try { localStorage.setItem("r3_amb_vol", String(v)) } catch {}
  if (amb && ctx) amb.gain.gain.setTargetAtTime(v * 0.5, ctx.currentTime, 0.3)
}

function loopNoise(c: AudioContext, color: "white" | "brown" | "pink") {
  const len = c.sampleRate * 4
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  let last = 0, b0 = 0, b1 = 0, b2 = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (color === "white") d[i] = w * 0.5
    else if (color === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2 }
    else { b0 = 0.997 * b0 + w * 0.029591; b1 = 0.985 * b1 + w * 0.032534; b2 = 0.95 * b2 + w * 0.048056; d[i] = (b0 + b1 + b2 + w * 0.0186) * 0.9 }
  }
  const src = c.createBufferSource(); src.buffer = buf; src.loop = true
  return src
}

function bed(c: AudioContext, out: AudioNode, nodes: AudioNode[], color: "white" | "brown" | "pink", type: BiquadFilterType, freq: number, vol: number, lfoRate = 0, lfoDepth = 0) {
  const src = loopNoise(c, color)
  const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq
  const g = c.createGain(); g.gain.value = vol
  src.connect(f).connect(g).connect(out)
  if (lfoRate) {
    const lfo = c.createOscillator(), lg = c.createGain()
    lfo.frequency.value = lfoRate; lg.gain.value = lfoDepth
    lfo.connect(lg).connect(g.gain); lfo.start(); nodes.push(lfo)
  }
  src.start(); nodes.push(src)
}

function blip(c: AudioContext, out: AudioNode, freq: number, dur: number, type: OscillatorType, vol: number, slide?: number) {
  const t = c.currentTime, o = c.createOscillator(), g = c.createGain()
  o.type = type; o.frequency.setValueAtTime(freq, t)
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur)
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05)
}
function burst(c: AudioContext, out: AudioNode, dur: number, freq: number, vol: number, q = 1) {
  const t = c.currentTime, len = Math.max(1, Math.floor(c.sampleRate * dur))
  const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
  const s = c.createBufferSource(); s.buffer = buf
  const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q
  const g = c.createGain(); g.gain.value = vol
  s.connect(f).connect(g).connect(out); s.start(t)
}
const every = (timers: number[], min: number, max: number, fn: () => void) => {
  const tick = () => { fn(); timers.push(window.setTimeout(tick, min + Math.random() * (max - min))) }
  timers.push(window.setTimeout(tick, min + Math.random() * (max - min)))
}

export function playAmbience(kind: string) {
  if (amb?.kind === kind) return
  stopAmbience()
  if (!kind) return
  const c = ac(); if (!c || !master) return
  ambVol = ambienceVolume()
  const gain = c.createGain(); gain.gain.value = 0.0001
  gain.connect(master)
  gain.gain.setTargetAtTime(ambVol * 0.5, c.currentTime, 1.2)
  const nodes: AudioNode[] = [], timers: number[] = []
  switch (kind) {
    case "taverna":
      bed(c, gain, nodes, "brown", "lowpass", 380, 0.55, 0.25, 0.15)        // burburinho
      bed(c, gain, nodes, "pink", "bandpass", 900, 0.08, 0.6, 0.05)          // vozes distantes
      every(timers, 60, 260, () => burst(c, gain, 0.02, 2500 + Math.random() * 2500, 0.25, 4)) // estalos do fogo
      every(timers, 2500, 7000, () => { blip(c, gain, 1800 + Math.random() * 600, 0.25, "sine", 0.05); blip(c, gain, 2400, 0.2, "sine", 0.03) }) // canecas
      every(timers, 6000, 14000, () => [262, 330, 392].forEach((f, i) => setTimeout(() => blip(c, gain, f * (Math.random() < .5 ? 1 : 1.5), 0.6, "triangle", 0.04), i * 220))) // alaúde
      break
    case "chuva":
      bed(c, gain, nodes, "white", "highpass", 1200, 0.22, 0.15, 0.04)
      bed(c, gain, nodes, "pink", "lowpass", 2400, 0.3)
      every(timers, 40, 160, () => burst(c, gain, 0.015, 3000 + Math.random() * 4000, 0.08, 6))
      every(timers, 9000, 22000, () => { burst(c, gain, 2.8, 80, 1.2, 0.4); burst(c, gain, 1.2, 160, 0.6, 0.6) }) // trovão
      break
    case "floresta":
      bed(c, gain, nodes, "pink", "bandpass", 500, 0.18, 0.08, 0.12)
      every(timers, 1500, 5000, () => { const f = 2600 + Math.random() * 1600; blip(c, gain, f, 0.09, "sine", 0.06, f * 1.3); setTimeout(() => blip(c, gain, f * 1.1, 0.08, "sine", 0.05, f * 0.9), 120) })
      every(timers, 4000, 9000, () => burst(c, gain, 0.6, 1200, 0.12, 0.5)) // folhas
      break
    case "masmorra":
      { const o = c.createOscillator(), g = c.createGain(); o.type = "sine"; o.frequency.value = 55; g.gain.value = 0.18; o.connect(g).connect(gain); o.start(); nodes.push(o)
        const o2 = c.createOscillator(), g2 = c.createGain(); o2.type = "triangle"; o2.frequency.value = 82.4; g2.gain.value = 0.06; o2.connect(g2).connect(gain); o2.start(); nodes.push(o2) }
      bed(c, gain, nodes, "brown", "lowpass", 200, 0.3, 0.05, 0.2)
      every(timers, 1200, 4500, () => blip(c, gain, 1400 + Math.random() * 900, 0.12, "sine", 0.12, 600)) // goteira
      every(timers, 12000, 25000, () => { blip(c, gain, 70, 1.6, "sawtooth", 0.06, 50); burst(c, gain, 1.2, 300, 0.2, 0.5) }) // corrente
      break
    case "batalha":
      bed(c, gain, nodes, "brown", "lowpass", 600, 0.4, 0.5, 0.2)
      { let beat = 0
        every(timers, 430, 470, () => { beat++; blip(c, gain, beat % 4 === 0 ? 70 : 95, 0.3, "sine", beat % 4 === 0 ? 0.6 : 0.35, 40); if (beat % 2) burst(c, gain, 0.08, 200, 0.3, 1) }) }
      every(timers, 1500, 4000, () => { burst(c, gain, 0.18, 4200, 0.25, 8); blip(c, gain, 3100 + Math.random() * 800, 0.4, "triangle", 0.05) }) // espadas
      every(timers, 7000, 15000, () => [196, 262, 330].forEach((f, i) => setTimeout(() => blip(c, gain, f, 0.5, "sawtooth", 0.05), i * 160))) // trompa
      break
    case "mar":
      { const src = loopNoise(c, "pink"), f = c.createBiquadFilter(), g = c.createGain(), lfo = c.createOscillator(), lg = c.createGain()
        f.type = "lowpass"; f.frequency.value = 900; g.gain.value = 0.35; lfo.frequency.value = 0.09; lg.gain.value = 0.3
        src.connect(f).connect(g).connect(gain); lfo.connect(lg).connect(g.gain); src.start(); lfo.start(); nodes.push(src, lfo) }
      every(timers, 5000, 12000, () => { blip(c, gain, 1500, 0.35, "sine", 0.04, 1100); setTimeout(() => blip(c, gain, 1300, 0.3, "sine", 0.03, 1000), 300) }) // gaivotas
      every(timers, 8000, 16000, () => blip(c, gain, 110, 1.5, "triangle", 0.05, 100)) // madeira do cais
      break
    case "vento":
      bed(c, gain, nodes, "pink", "bandpass", 450, 0.35, 0.07, 0.3)
      bed(c, gain, nodes, "white", "bandpass", 1600, 0.05, 0.13, 0.05)
      every(timers, 6000, 13000, () => blip(c, gain, 380 + Math.random() * 200, 2.4, "sine", 0.05, 260))
      break
  }
  amb = { kind, gain, nodes, timers }
}

export function stopAmbience() {
  if (!amb) return
  const a = amb; amb = null
  a.timers.forEach((t) => clearTimeout(t))
  if (ctx) a.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.5)
  setTimeout(() => { a.nodes.forEach((n: any) => { try { n.stop?.() } catch {} ; try { n.disconnect() } catch {} }); try { a.gain.disconnect() } catch {} }, 2500)
}
export const currentAmbience = () => amb?.kind ?? ""
export function unlockAudio() { ac() }
