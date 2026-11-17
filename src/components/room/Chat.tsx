"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { Flourish, Icon } from "@/components/Icon"
import type { Msg } from "@/lib/types"
import { hhmm, initials, useRoom } from "./ctx"

const COMMANDS: { c: string; d: string; gm?: boolean }[] = [
  { c: "/r 1d20+FOR", d: "Rola dados (soma atributos da sua ficha)" },
  { c: "/r 1d20 @alvo", d: "Rola usando a ficha de outro personagem" },
  { c: "/r 4d6kh3 #Força", d: "Mantém os 3 maiores; # dá um rótulo" },
  { c: "/r 2d20kh1", d: "Vantagem (2d20kl1 = desvantagem)" },
  { c: "/sr 1d20", d: "Rolagem secreta: só você e o mestre veem" },
  { c: "/me acende a tocha", d: "Ação do personagem (ou *entre asteriscos*)" },
  { c: "/w @jogador texto", d: "Sussurro privado" },
  { c: "/pv @alvo -20", d: "Muda um atributo: +N, −N ou =N (/pm, /for…)" },
  { c: "/pv @todos +5", d: "Aplica em todos os personagens", gm: true },
  { c: "/init 1d20+DES", d: "Entra na iniciativa (ou /init 15)" },
  { c: "/proximo", d: "Passa o turno" },
  { c: "/cond @alvo Envenenado 3", d: "Condição por N rodadas (-Nome remove)" },
  { c: "/n texto", d: "Narração do mestre, em pergaminho", gm: true },
  { c: "/npc Nome: fala", d: "Fala como NPC ou criatura", gm: true },
  { c: "/desfazer", d: "Desfaz a última mudança de atributo", gm: true },
  { c: "/gm", d: "Assume ou deixa o posto de mestre" },
]

export function Chat() {
  const R = useRoom()
  const [text, setText] = useState("")
  const [voice, setVoice] = useState("")
  const [hist, setHist] = useState<string[]>([])
  const [hpos, setHpos] = useState(-1)
  const [hi, setHi] = useState(0)
  const [sending, setSending] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    const el = logRef.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [R.messages.length])

  const npcs = R.sheets.filter((s) => s.kind !== "pc")
  const mySheet = R.sheets.find((s) => s.id === R.me.sheet_id)

  // Sugestões: comandos ao digitar "/", nomes ao digitar "@".
  const hints = useMemo(() => {
    const at = /@([\wÀ-ÿ-]*)$/.exec(text)
    if (at) {
      const q = at[1].toLowerCase()
      const names = [...R.sheets.map((s) => s.name), ...R.members.map((m) => m.name), "todos"]
      return [...new Set(names)].filter((n) => n.toLowerCase().replace(/\s+/g, "").startsWith(q)).slice(0, 8).map((n) => ({ c: "@" + n.replace(/\s+/g, ""), d: "", at: true }))
    }
    if (!text.startsWith("/") || text.includes(" ")) return []
    return COMMANDS.filter((x) => (!x.gm || R.isGM) && x.c.startsWith(text.toLowerCase())).map((x) => ({ ...x, at: false }))
  }, [text, R.sheets, R.members, R.isGM])
  useEffect(() => setHi(0), [hints.length])

  function pick(h: { c: string; at: boolean }) {
    if (h.at) setText(text.replace(/@([\wÀ-ÿ-]*)$/, h.c + " "))
    else setText(h.c.split(" ")[0] + " ")
    inputRef.current?.focus()
  }

  async function send(raw?: string) {
    let t = (raw ?? text).trim()
    if (!t || sending) return
    if (!raw && !t.startsWith("/") && voice) {
      t = voice === "__narr" ? `/n ${t}` : `/npc ${voice}: ${t}`
    }
    setSending(true)
    const ok = await R.chat(t)
    setSending(false)
    if (ok && !raw) { setHist((h) => [text, ...h].slice(0, 50)); setText(""); setHpos(-1); stick.current = true }
    inputRef.current?.focus()
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (hints.length) {
      if (e.key === "ArrowDown") { e.preventDefault(); return setHi((hi + 1) % hints.length) }
      if (e.key === "ArrowUp") { e.preventDefault(); return setHi((hi - 1 + hints.length) % hints.length) }
      if (e.key === "Tab") { e.preventDefault(); return pick(hints[hi]) }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); return send() }
    if (e.key === "ArrowUp" && !text.includes("\n") && hist.length && (text === "" || hpos >= 0)) {
      e.preventDefault(); const p = Math.min(hist.length - 1, hpos + 1); setHpos(p); setText(hist[p])
    }
    if (e.key === "ArrowDown" && hpos >= 0) { e.preventDefault(); const p = hpos - 1; setHpos(p); setText(p < 0 ? "" : hist[p]) }
  }

  const rollQuick = (d: string) => send(`/r ${d}`)

  return (
    <section className="frame chat">
      <div className="chat-head">
        <Icon n="scroll" />
        <h3 style={{ fontSize: ".95rem" }} className="grow">Crônica da mesa</h3>
        <span className="faint" style={{ fontSize: ".8rem" }}>{R.messages.length} registros</span>
      </div>
      <div className="log" ref={logRef} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
        {R.messages.length === 0 && <div className="empty">A mesa está em silêncio. Quebre o gelo.</div>}
        {R.messages.map((m, i) => <Line key={m.seq} m={m} prev={R.messages[i - 1]} />)}
      </div>
      <div className="composer">
        {hints.length > 0 && (
          <div className="hints">
            {hints.map((h, i) => (
              <div key={h.c} className={"hint " + (i === hi ? "on" : "")} onMouseDown={(e) => { e.preventDefault(); pick(h) }}>
                <b>{h.c}</b><span className="muted">{h.d}</span>
              </div>
            ))}
          </div>
        )}
        <div className="dicebar">
          {["d4", "d6", "d8", "d10", "d12", "d20", "d100"].map((d) => (
            <button key={d} className="dbtn" onClick={() => rollQuick("1" + d)} title={`Rolar 1${d}`}><Icon n={d === "d6" ? "d6" : "d20"} size={13} />{d}</button>
          ))}
          <button className="dbtn" onClick={() => rollQuick("2d20kh1 #Vantagem")} title="2d20, fica o maior">vant.</button>
          <button className="dbtn" onClick={() => rollQuick("2d20kl1 #Desvantagem")} title="2d20, fica o menor">desv.</button>
          <button className="dbtn" onClick={() => send("/sr 1d20")} title="Só você e o mestre veem"><Icon n="eyeoff" size={13} />secreta</button>
          <span className="grow" />
          {mySheet && <span className="chip gold" title="Ficha ativa: atributos dela entram nas rolagens"><Icon n="scroll" size={11} /> {mySheet.name}</span>}
        </div>
        <div className="inputrow">
          {R.isGM && (
            <select className="field voice" value={voice} onChange={(e) => setVoice(e.target.value)} title="Falar como…">
              <option value="">{mySheet ? mySheet.name : R.me.name}</option>
              <option value="__narr">📜 Narrador</option>
              {npcs.map((s) => <option key={s.id} value={s.name}>{s.kind === "creature" ? "🐉" : "🎭"} {s.name}</option>)}
            </select>
          )}
          <textarea ref={inputRef} className="field" rows={1} value={text} placeholder={voice === "__narr" ? "Narre a cena…" : voice ? `Fale como ${voice}… (*ação* entre asteriscos)` : "Fale, *aja* ou digite / para comandos…"}
            onChange={(e) => { setText(e.target.value); setHpos(-1) }} onKeyDown={onKey} />
          <button className="btn" onClick={() => send()} disabled={sending || !text.trim()} title="Enviar (Enter)"><Icon n="send" size={15} /></button>
        </div>
      </div>
    </section>
  )
}

function Avatar({ m }: { m: Msg }) {
  const R = useRoom()
  const img = m.data?.avatar || R.sheets.find((s) => s.name === m.speaker)?.avatar
  if (img) return <img className="avatar" src={img} alt="" />
  return <span className="dot lg" style={{ background: m.color || "#999" }}>{initials(m.speaker)}</span>
}

function Line({ m, prev }: { m: Msg; prev?: Msg }) {
  const R = useRoom()
  if (m.kind === "system") return <div className="sys"><Icon n={m.data?.icon || "star"} size={14} />{m.body}</div>
  if (m.kind === "narration") return <div className="parch narr"><Flourish />{m.body}</div>
  if (m.kind === "turn") return <div className="turnbar"><Icon n="hourglass" size={15} /> Rodada {m.data?.round} · vez de {m.data?.name}</div>

  const cont = !!prev && prev.speaker === m.speaker && prev.kind === m.kind && ["say", "action"].includes(m.kind) && !prev.to_member && !m.to_member &&
    new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 120000
  const cls = ["msg", m.kind, m.data?.npc ? "npc" : "", cont ? "cont" : ""].join(" ")
  const toName = m.to_member ? R.memberById(m.to_member)?.name ?? m.data?.to : null

  return (
    <div className={cls}>
      <Avatar m={m} />
      <div className="bubble">
        {!cont && (
          <div>
            <span className="who" style={{ color: m.color || undefined }}>{m.speaker}</span>
            {m.data?.by && m.data.by !== m.speaker && <span className="by">({m.data.by})</span>}
            {m.kind === "whisper" && <span className="by">sussurra para {toName}</span>}
            {m.secret && <span className="chip violet" style={{ marginLeft: ".4rem" }}><Icon n="eyeoff" size={10} /> secreta</span>}
            <span className="time">{hhmm(m.created_at)}</span>
          </div>
        )}
        {m.kind === "roll" ? <RollCard m={m} /> : m.kind === "change" ? <Changes m={m} /> : <div className="body">{m.body}</div>}
      </div>
    </div>
  )
}

function RollCard({ m }: { m: Msg }) {
  const r = m.data?.r
  if (!r) return null
  return (
    <div className={"rollcard " + (r.crit ? "crit " : r.fumble ? "fumble " : "") + (m.secret ? "secret" : "")}>
      <div className="row">
        {m.body && <span className="lbl2">{m.body}</span>}
        <span className="expr">{r.expr}{m.data?.target ? ` · ficha de ${m.data.target}` : ""}</span>
      </div>
      <div className="dice-row">
        {r.parts.map((p: any, i: number) => (
          <span key={i} className="row" style={{ gap: ".2rem" }}>
            {i > 0 && <span className="mod">{p.sign < 0 ? "−" : "+"}</span>}
            {p.t === "d"
              ? p.rolls.map((d: any, j: number) => (
                  <span key={j} className={["die", p.sides === 20 ? "d20" : "", d.v === p.sides ? "max" : "", d.v === 1 ? "min" : "", d.keep ? "" : "drop", d.ex ? "ex" : ""].join(" ")} title={`d${p.sides}`}>{d.v}</span>
                ))
              : <span className="mod">{p.v}{p.label ? ` ${p.label}` : ""}</span>}
          </span>
        ))}
        <span className="total">{r.total}</span>
      </div>
      {r.crit && <span className="chip gold" style={{ alignSelf: "flex-start" }}><Icon n="star" size={11} /> Crítico!</span>}
      {r.fumble && <span className="chip red" style={{ alignSelf: "flex-start" }}><Icon n="skull" size={11} /> Falha crítica</span>}
    </div>
  )
}

function Changes({ m }: { m: Msg }) {
  return (
    <div className="change-list">
      {(m.data?.ch ?? []).map((c: any, i: number) => {
        const d = c.to - c.from
        return (
          <div key={i} className="change">
            <Icon n={c.key.includes("pv") ? "heart" : "flask"} size={15} />
            <span><b>{c.name}</b> · {c.label}: {c.from} → <b>{c.to}</b>{c.max ? <span className="faint"> / {c.max}</span> : null}</span>
            <span className={"delta " + (d < 0 ? "down" : "up")}>{d > 0 ? "+" : ""}{d}</span>
            {c.bar && c.to === 0 && <span className="chip red"><Icon n="skull" size={11} /> caído</span>}
          </div>
        )
      })}
    </div>
  )
}
