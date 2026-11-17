"use client"
import { createRealtimeClient, type SealedLiveQuery } from "@neon/realtime/client"
import { RealtimeProvider, useLiveQuery } from "@neon/realtime-react"
import Link from "next/link"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Flourish, Icon, Seal } from "@/components/Icon"
import { sfx } from "@/components/sound"
import type { Member, Msg, Note, Room, Sheet } from "@/lib/types"
import { Ctx, type RoomData } from "./ctx"
import { Table } from "./Table"

type Boot = { url: string; me: { id: string; owner: boolean; account: boolean }; queries: Record<string, SealedLiveQuery<any>> }

export function RoomApp({ code }: { code: string }) {
  const [state, setState] = useState<"loading" | "join" | "missing" | "ready" | "error">("loading")
  const [boot, setBoot] = useState<Boot | null>(null)
  const [msg, setMsg] = useState("")

  const load = useCallback(async () => {
    setState("loading")
    const r = await fetch(`/api/rooms/${code}/live`, { method: "POST", cache: "no-store", body: "{}" })
    if (r.status === 404) return setState("missing")
    if (r.status === 401 || r.status === 403) return setState("join")
    if (!r.ok) { setMsg((await r.json().catch(() => ({}))).error || "Falha ao abrir a mesa."); return setState("error") }
    setBoot(await r.json())
    setState("ready")
  }, [code])
  useEffect(() => { load() }, [load])

  if (state === "loading") return <Splash><div className="loading-dice"><Icon n="d20" size={48} /></div><p className="muted">Acendendo as velas da taverna…</p></Splash>
  if (state === "missing") return <Splash><h2 className="title-deco">Sala não encontrada</h2><p className="muted">Nenhuma mesa usa o código <b className="mono">{code}</b>. Confira com quem te convidou.</p><Link className="btn" href="/">Voltar</Link></Splash>
  if (state === "error") return <Splash><h2 className="title-deco">Algo travou a porta</h2><p className="muted">{msg}</p><button className="btn" onClick={load}>Tentar de novo</button></Splash>
  if (state === "join") return <Join code={code} onJoined={load} />
  return <Live boot={boot!} code={code} />
}

function Splash({ children }: { children: React.ReactNode }) {
  return <main className="splash"><div className="frame box col" style={{ alignItems: "center", gap: ".8rem" }}><Seal size={52} />{children}</div></main>
}

function Join({ code, onJoined }: { code: string; onJoined: () => void }) {
  const [name, setName] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  async function join(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr("")
    const r = await fetch(`/api/rooms/${code}/join`, { method: "POST", body: JSON.stringify({ name }) })
    setBusy(false)
    if (!r.ok) { sfx.error(); return setErr((await r.json()).error) }
    sfx.door(); onJoined()
  }
  return (
    <Splash>
      <h2 className="title-deco" style={{ fontSize: "1.6rem" }}>Mesa {code}</h2>
      <Flourish />
      <form onSubmit={join} className="col" style={{ width: "100%" }}>
        <label className="lbl">Com que nome você chega?</label>
        <input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome na mesa" maxLength={24} />
        {err && <p className="err">{err}</p>}
        <button className="btn" disabled={busy}><Icon n="door" size={15} /> Sentar à mesa</button>
      </form>
      <p className="faint" style={{ fontSize: ".85rem", margin: 0 }}>Tem conta? <Link href={`/entrar?next=/s/${code}`}>Entre</Link> para guardar suas fichas e mesas.</p>
    </Splash>
  )
}

function Live({ boot, code }: { boot: Boot; code: string }) {
  const [client] = useState(() => createRealtimeClient({ url: boot.url, logLevel: "warn" }))
  return <RealtimeProvider client={client}><Data boot={boot} code={code} /></RealtimeProvider>
}

function useLive<T>(code: string, q: string, sealed: SealedLiveQuery<any>) {
  const [query] = useState(sealed)
  const refreshQuery = useCallback(async () => {
    const r = await fetch(`/api/rooms/${code}/live`, { method: "POST", cache: "no-store", body: JSON.stringify({ q }) })
    if (r.status === 401 || r.status === 403) { location.reload(); throw new Error("sessão perdida") }
    if (!r.ok) throw new Error("falha ao renovar")
    const next = await r.json()
    // Uma atualização do site mudou a consulta: recarrega para assinar a nova.
    if (next.queryFingerprint !== query.queryFingerprint) { location.reload(); throw new Error("consulta mudou") }
    return next
  }, [code, q, query])
  const { data, status } = useLiveQuery<T>(query, { refreshQuery })
  return { data: (data ?? []) as T[], status }
}

function Data({ boot, code }: { boot: Boot; code: string }) {
  const room = useLive<Room>(code, "room", boot.queries.room)
  const members = useLive<Member>(code, "members", boot.queries.members)
  const messages = useLive<Msg>(code, "messages", boot.queries.messages)
  const sheets = useLive<Sheet>(code, "sheets", boot.queries.sheets)
  const notes = useLive<Note>(code, "notes", boot.queries.notes)
  const [toasts, setToasts] = useState<{ id: number; text: string; ok?: boolean }[]>([])
  const [focusSheet, setFocusSheet] = useState<string | null>(null)
  const tid = useRef(0)

  const toast = useCallback((text: string, ok?: boolean) => {
    const id = ++tid.current
    if (!ok) sfx.error()
    setToasts((t) => [...t, { id, text, ok }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200)
  }, [])

  const act = useCallback(async (a: string, body: Record<string, any> = {}) => {
    const r = await fetch(`/api/rooms/${code}/act`, { method: "POST", body: JSON.stringify({ a, ...body }) })
    const d = await r.json().catch(() => ({ error: "Sem resposta do servidor." }))
    if (!r.ok) { toast(d.error || "Falhou."); return null }
    return d
  }, [code, toast])

  const chat = useCallback(async (text: string) => {
    const r = await fetch(`/api/rooms/${code}/chat`, { method: "POST", body: JSON.stringify({ text }) })
    if (r.ok) return true
    toast((await r.json().catch(() => ({}))).error || "Não foi possível enviar.")
    return false
  }, [code, toast])

  const value = useMemo<RoomData | null>(() => {
    const r = room.data[0]
    const meRow = members.data.find((m) => m.id === boot.me.id)
    if (!r || !meRow) return null
    const isGM = meRow.role === "gm"
    return {
      code, room: r, isGM,
      me: { ...meRow, owner: boot.me.owner, account: boot.me.account },
      members: members.data,
      messages: [...messages.data].reverse(),
      sheets: sheets.data, notes: notes.data,
      tpl: (id) => r.templates.find((t) => t.id === id),
      memberById: (id) => members.data.find((m) => m.id === id),
      canEdit: (s) => isGM || s.owner_member === meRow.id,
      act, chat, toast,
      focus: { sheet: focusSheet, setSheet: setFocusSheet },
    }
  }, [room.data, members.data, messages.data, sheets.data, notes.data, boot.me, code, act, chat, toast, focusSheet])

  const live = [room, members, messages, sheets, notes].every((x) => x.status === "live")
  const dead = [room, members, messages, sheets, notes].some((x) => x.status === "error")
  useEffect(() => { if (dead) { const t = setTimeout(() => location.reload(), 1500); return () => clearTimeout(t) } }, [dead])
  if (!value) {
    if (room.status === "live" && members.status === "live") return <Splash><p className="muted">Você não está mais nesta mesa.</p><Link className="btn" href="/">Voltar</Link></Splash>
    return <Splash><div className="loading-dice"><Icon n="d20" size={48} /></div><p className="muted">Conectando à mesa…</p></Splash>
  }
  return (
    <Ctx.Provider value={value}>
      <Table live={live} />
      <div className="toasts">{toasts.map((t) => <div key={t.id} className={"toast " + (t.ok ? "ok" : "")}>{t.text}</div>)}</div>
    </Ctx.Provider>
  )
}
