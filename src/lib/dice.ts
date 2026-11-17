import { randomInt } from "node:crypto"

export type DieRoll = { v: number; keep: boolean; ex?: boolean }
export type Part =
  | { t: "d"; sign: 1 | -1; n: number; sides: number; mod: string; rolls: DieRoll[]; sum: number }
  | { t: "n"; sign: 1 | -1; v: number; label?: string }
export type RollResult = { expr: string; parts: Part[]; total: number; crit: boolean; fumble: boolean }

const TOKEN = /\s*([+-])?\s*(?:(\d*)d(\d+)(!)?(?:(kh|kl)(\d+))?|(\d+)|([A-Za-zÀ-ÿ_][\wÀ-ÿ]*))/iy

/** Começa com algo que parece dado? (ex.: "1d20", "d6", "4d6kh3") */
export const looksLikeRoll = (s: string) => /^\s*\d*d\d+/i.test(s)

/**
 * Avalia expressões como `2d6+3`, `4d6kh3`, `1d20+FOR-2`, `3d6!`.
 * `attr` resolve nomes de atributos da ficha (retorna null se não existir).
 */
export function rollExpr(src: string, attr: (name: string) => number | null): RollResult | { error: string } {
  const s = src.trim()
  if (!s) return { error: "Expressão vazia." }
  const parts: Part[] = []
  let pos = 0
  let total = 0, crit = false, fumble = false
  while (pos < s.length) {
    TOKEN.lastIndex = pos
    const m = TOKEN.exec(s)
    if (!m || m[0].trim() === "") return { error: `Não entendi "${s.slice(pos)}".` }
    if (parts.length > 0 && !m[1]) return { error: `Faltou + ou − antes de "${m[0].trim()}".` }
    pos = TOKEN.lastIndex
    const sign: 1 | -1 = m[1] === "-" ? -1 : 1
    if (m[3]) {
      const n = Math.max(1, Number(m[2] || 1)), sides = Number(m[3])
      if (n > 100 || sides < 2 || sides > 1000) return { error: "Dados demais (máx. 100d1000)." }
      const rolls: DieRoll[] = []
      for (let i = 0; i < n; i++) {
        let v = randomInt(1, sides + 1)
        rolls.push({ v, keep: true })
        let guard = 0
        while (m[4] && v === sides && guard++ < 20) { v = randomInt(1, sides + 1); rolls.push({ v, keep: true, ex: true }) }
      }
      if (m[5]) {
        const k = Math.min(rolls.length, Math.max(1, Number(m[6])))
        const idx = rolls.map((r, i) => ({ v: r.v, i })).sort((a, b) => (m[5].toLowerCase() === "kh" ? b.v - a.v : a.v - b.v))
        const keep = new Set(idx.slice(0, k).map((x) => x.i))
        rolls.forEach((r, i) => (r.keep = keep.has(i)))
      }
      const sum = rolls.reduce((a, r) => a + (r.keep ? r.v : 0), 0)
      if (sides === 20) {
        const kept = rolls.filter((r) => r.keep)
        if (kept.some((r) => r.v === 20)) crit = true
        else if (kept.length === 1 && kept[0].v === 1) fumble = true
      }
      parts.push({ t: "d", sign, n, sides, mod: (m[4] || "") + (m[5] ? m[5] + m[6] : ""), rolls, sum })
      total += sign * sum
    } else if (m[7]) {
      const v = Number(m[7])
      parts.push({ t: "n", sign, v })
      total += sign * v
    } else {
      const v = attr(m[8])
      if (v === null || Number.isNaN(v)) return { error: `Atributo "${m[8]}" não encontrado na ficha.` }
      parts.push({ t: "n", sign, v, label: m[8].toUpperCase() })
      total += sign * v
    }
  }
  if (!parts.some((p) => p.t === "d")) return { error: "A rolagem precisa de pelo menos um dado (ex.: 1d20)." }
  return { expr: s.replace(/\s+/g, ""), parts, total, crit, fumble }
}
