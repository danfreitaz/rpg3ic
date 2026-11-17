"use client"
import { createContext, useContext } from "react"
import type { Member, Msg, Note, Room, Sheet, Template } from "@/lib/types"

export type Me = Member & { owner: boolean; account: boolean }
export type RoomData = {
  code: string
  room: Room
  me: Me
  isGM: boolean
  members: Member[]
  messages: Msg[] // do mais antigo para o mais novo
  sheets: Sheet[]
  notes: Note[]
  tpl: (id: string) => Template | undefined
  memberById: (id: string) => Member | undefined
  canEdit: (s: Sheet) => boolean
  act: (a: string, body?: Record<string, any>) => Promise<any>
  chat: (text: string) => Promise<boolean>
  toast: (text: string, ok?: boolean) => void
  focus: { sheet: string | null; setSheet: (id: string | null) => void }
}

export const Ctx = createContext<RoomData | null>(null)
export const useRoom = () => useContext(Ctx)!

export const initials = (s: string) => s.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?"
export const hhmm = (d: Date) => new Date(d).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

export function barClass(key: string) {
  const k = key.toLowerCase()
  return k.includes("pv") || k.includes("vida") || k.includes("hp") ? "pv" : k.includes("pm") || k.includes("mana") ? "pm" : "other"
}

/** Primeiro atributo do tipo barra (normalmente PV). */
export function hpOf(s: Sheet | undefined, t: Template | undefined) {
  if (!s || !t) return null
  const f = t.fields.find((x) => x.type === "bar")
  if (!f) return null
  const v = Number(s.data?.[f.key] ?? 0), m = Number(s.data?.[f.key + "_max"] ?? 0)
  return { v, m, pct: m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0, key: f.key }
}
