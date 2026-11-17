"use client"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Icon } from "./Icon"
import { sfx } from "./sound"

export type MenuItem =
  | { label: string; icon?: string; onClick: () => void; danger?: boolean; disabled?: boolean; hint?: string }
  | { title: string }
  | "sep"
  | null
  | false
  | undefined

type State = { x: number; y: number; items: MenuItem[] } | null
let push: ((s: State) => void) | null = null

/** Abre o menu do botão direito com as opções do item clicado. */
export function openMenu(e: React.MouseEvent | MouseEvent, items: MenuItem[]) {
  const clean = items.filter(Boolean) as MenuItem[]
  if (!clean.some((i) => typeof i === "object" && i && "label" in i)) return
  e.preventDefault()
  e.stopPropagation()
  sfx.click()
  push?.({ x: e.clientX, y: e.clientY, items: clean })
}

/** Pede ao chat para inserir um texto no campo de fala. */
export const insertInChat = (text: string, replace = false) =>
  window.dispatchEvent(new CustomEvent("r3:insert", { detail: { text, replace } }))

export function ContextMenuHost() {
  const [state, setState] = useState<State>(null)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [hi, setHi] = useState(-1)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { push = (s) => { setHi(-1); setState(s) }; return () => { push = null } }, [])

  useLayoutEffect(() => {
    if (!state || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    setPos({ x: Math.min(state.x, innerWidth - r.width - 8), y: Math.min(state.y, innerHeight - r.height - 8) })
  }, [state])

  useEffect(() => {
    if (!state) return
    const close = () => setState(null)
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close() }
    const actionable = state.items.map((it, i) => (typeof it === "object" && it && "label" in it && !it.disabled ? i : -1)).filter((i) => i >= 0)
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close()
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault()
        setHi((h) => { const p = actionable.indexOf(h); const n = e.key === "ArrowDown" ? (p + 1) % actionable.length : (p - 1 + actionable.length) % actionable.length; return actionable[n] })
      }
      if (e.key === "Enter" && hi >= 0) { const it = state.items[hi] as any; close(); it.onClick() }
    }
    window.addEventListener("mousedown", down, true)
    window.addEventListener("keydown", key)
    window.addEventListener("blur", close)
    window.addEventListener("resize", close)
    window.addEventListener("wheel", close, { passive: true })
    return () => {
      window.removeEventListener("mousedown", down, true)
      window.removeEventListener("keydown", key)
      window.removeEventListener("blur", close)
      window.removeEventListener("resize", close)
      window.removeEventListener("wheel", close)
    }
  }, [state, hi])

  if (!state || typeof document === "undefined") return null
  return createPortal(
    <div ref={ref} className="ctx-menu" role="menu" style={{ left: pos.x || state.x, top: pos.y || state.y }} onContextMenu={(e) => e.preventDefault()}>
      {state.items.map((it, i) => {
        if (!it) return null
        if (it === "sep") return <div key={i} className="ctx-sep" />
        if ("title" in it) return <div key={i} className="ctx-title">{it.title}</div>
        return (
          <button key={i} role="menuitem" disabled={it.disabled} className={"ctx-item " + (it.danger ? "danger " : "") + (hi === i ? "hi" : "")}
            onMouseEnter={() => setHi(i)} onClick={() => { setState(null); it.onClick() }}>
            <Icon n={it.icon ?? "star"} size={14} />
            <span className="grow">{it.label}</span>
            {it.hint && <small>{it.hint}</small>}
          </button>
        )
      })}
    </div>,
    document.body
  )
}
