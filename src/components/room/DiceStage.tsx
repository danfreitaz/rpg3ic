"use client"
import { useEffect, useState } from "react"
import type { Msg } from "@/lib/types"

const SHAPE: Record<number, string> = {
  4: "39,4 74,70 4,70",
  6: "8,8 70,8 70,70 8,70",
  8: "39,2 76,39 39,76 2,39",
  10: "39,2 74,30 62,72 16,72 4,30",
  12: "39,3 72,22 72,56 39,75 6,56 6,22",
  20: "39,2 73,20 73,58 39,76 5,58 5,20",
}

/** Dados voando pela tela a cada rolagem nova. */
export function DiceStage({ msg, onDone }: { msg: Msg | null; onDone: () => void }) {
  const [out, setOut] = useState(false)
  useEffect(() => {
    if (!msg) return
    setOut(false)
    const a = setTimeout(() => setOut(true), 1700)
    const b = setTimeout(onDone, 2100)
    return () => { clearTimeout(a); clearTimeout(b) }
  }, [msg, onDone])
  if (!msg?.data?.r) return null
  const r = msg.data.r
  const dice: { v: number; sides: number; keep: boolean }[] = []
  for (const p of r.parts) if (p.t === "d") for (const d of p.rolls) dice.push({ v: d.v, sides: p.sides, keep: d.keep })
  const show = dice.slice(0, 6)
  return (
    <div className="dice-stage" key={msg.seq}>
      <div className={"dice-toss " + (out ? "out" : "")}>
        {show.map((d, i) => (
          <div key={i} className={"bigdie " + (r.crit && d.sides === 20 && d.v === 20 ? "crit" : "")} style={{ animationDelay: `${i * 40}ms`, opacity: d.keep ? 1 : 0.45 }}>
            <svg viewBox="0 0 78 78" aria-hidden>
              <defs>
                <linearGradient id={"dg" + i} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={d.v === d.sides ? "#fff0bf" : d.v === 1 ? "#f0a090" : "#f6ead0"} />
                  <stop offset="1" stopColor={d.v === d.sides ? "#c9a24b" : d.v === 1 ? "#a3362a" : "#bba272"} />
                </linearGradient>
              </defs>
              <polygon points={SHAPE[d.sides] ?? SHAPE[20]} fill={`url(#dg${i})`} stroke="#3a250a" strokeWidth="2.5" strokeLinejoin="round" />
              {d.sides === 20 && <path d="M39 2 22 44h34zM5 20l17 24M73 20 56 44M22 44l17 32 17-32" fill="none" stroke="#3a250a" strokeWidth="1" opacity=".35" />}
            </svg>
            <span>{d.v}</span>
          </div>
        ))}
        {dice.length > 6 && <span className="dice-total" style={{ fontSize: "1.4rem" }}>+{dice.length - 6}</span>}
        <span className={"dice-total " + (r.crit ? "crit" : r.fumble ? "fumble" : "")}>{r.total}</span>
      </div>
    </div>
  )
}
