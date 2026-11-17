"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { Icon, Seal } from "@/components/Icon"
import { setSoundOn, sfx, soundOn } from "@/components/sound"
import { COLORS, type Msg } from "@/lib/types"
import { Chat } from "./Chat"
import { initials, useRoom } from "./ctx"
import { DiceStage } from "./DiceStage"
import { LeftPanel } from "./LeftPanel"
import { RightPanel } from "./RightPanel"

export function Table({ live }: { live: boolean }) {
  const R = useRoom()
  const [sound, setSound] = useState(true)
  const [modal, setModal] = useState<"room" | "me" | null>(null)
  const [toss, setToss] = useState<Msg | null>(null)
  const seen = useRef<number>(-1)

  useEffect(() => setSound(soundOn()), [])

  // Sons e animações só para mensagens novas (não para o histórico carregado).
  useEffect(() => {
    const last = R.messages[R.messages.length - 1]
    if (!last) return
    if (seen.current === -1) { seen.current = last.seq; return }
    const fresh = R.messages.filter((m) => m.seq > seen.current)
    seen.current = last.seq
    for (const m of fresh) {
      if (m.kind === "roll") { sfx.dice(); if (m.data?.r?.crit) sfx.crit(); else if (m.data?.r?.fumble) sfx.fumble(); setToss(m) }
      else if (m.kind === "change") { const down = m.data?.ch?.some((c: any) => c.to < c.from); down ? sfx.damage() : sfx.heal() }
      else if (m.kind === "whisper") sfx.whisper()
      else if (m.kind === "narration") sfx.narration()
      else if (m.kind === "turn") sfx.bell()
      else if (m.kind === "action") sfx.action()
      else if (m.kind === "system") m.data?.icon === "door" ? sfx.door() : sfx.paper()
      else if (m.member_id !== R.me.id) sfx.msg()
    }
  }, [R.messages, R.me.id])

  const copy = () => {
    navigator.clipboard?.writeText(`${location.origin}/s/${R.code}`)
    R.toast(`Convite copiado! Código ${R.code}`, true)
    sfx.click()
  }

  return (
    <div className={"table " + (R.isGM ? "gm" : "")}>
      <header className="frame topbar">
        <Link href="/" className="brand" title="Voltar ao saguão"><Seal size={32} /><b>RPG3ic</b></Link>
        <span className="sep" />
        <span className="roomname" title={R.room.name}>{R.room.name}</span>
        {R.room.scene && <span className="scene">· {R.room.scene}</span>}
        <button className="codebadge" onClick={copy} title="Copiar convite">{R.code} <Icon n="copy" size={13} /></button>
        <span className="grow" />
        <span className={"chip " + (live ? "green" : "red")} title={live ? "Sincronizado em tempo real" : "Reconectando…"}>
          <span style={{ width: 7, height: 7, borderRadius: 9, background: live ? "#7fd18f" : "#e2725e", display: "inline-block" }} />
          {live ? "ao vivo" : "reconectando"}
        </span>
        <span className="row" style={{ gap: ".15rem" }}>
          {R.members.slice(0, 8).map((m) => (
            <span key={m.id} className="dot" style={{ background: m.color, outline: m.role === "gm" ? "2px solid var(--gold-hi)" : undefined }} title={`${m.name}${m.role === "gm" ? " (mestre)" : ""}`}>{initials(m.name)}</span>
          ))}
          {R.members.length > 8 && <span className="faint" style={{ fontSize: ".8rem" }}>+{R.members.length - 8}</span>}
        </span>
        <span className="sep" />
        <button className={"iconbtn " + (R.isGM ? "on" : "")} title={R.isGM ? "Você é mestre — clique para virar jogador" : R.room.gm_locked && !R.me.owner ? "Posto de mestre travado" : "Assumir o posto de mestre"}
          onClick={() => R.act("role.set", { role: R.isGM ? "player" : "gm" })}><Icon n="crown" /></button>
        <button className="iconbtn" title={sound ? "Silenciar" : "Ligar sons"} onClick={() => { setSoundOn(!sound); setSound(!sound); if (!sound) sfx.click() }}><Icon n={sound ? "sound" : "mute"} /></button>
        {(R.isGM || R.me.owner) && <button className="iconbtn" title="Configurar a sala" onClick={() => setModal("room")}><Icon n="gear" /></button>}
        <button className="me-pill" onClick={() => setModal("me")} title="Seu perfil na mesa">
          <span className="dot" style={{ background: R.me.color }}>{initials(R.me.name)}</span>
          <span style={{ fontSize: ".9rem" }}>{R.me.name}</span>
          {R.isGM && <span className="chip gold">mestre</span>}
        </button>
      </header>

      <div className="board">
        <LeftPanel />
        <Chat />
        <RightPanel />
      </div>

      <DiceStage msg={toss} onDone={() => setToss(null)} />
      {modal === "room" && <RoomSettings onClose={() => setModal(null)} />}
      {modal === "me" && <MeSettings onClose={() => setModal(null)} />}
    </div>
  )
}

export function Modal({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [onClose])
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="frame modal rise">
        <div className="row"><h2 className="grow"><Icon n={icon} /> {title}</h2><button className="iconbtn" onClick={onClose}><Icon n="x" /></button></div>
        {children}
      </div>
    </div>
  )
}

function RoomSettings({ onClose }: { onClose: () => void }) {
  const R = useRoom()
  const [name, setName] = useState(R.room.name)
  const [scene, setScene] = useState(R.room.scene)
  return (
    <Modal title="A sala" icon="castle" onClose={onClose}>
      <label className="lbl">Nome da campanha</label>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="lbl">Cena atual (aparece no topo)</label>
      <input className="field" value={scene} onChange={(e) => setScene(e.target.value)} placeholder="Ex.: Taverna do Javali Torto, noite chuvosa" />
      <div className="row" style={{ marginTop: ".8rem" }}>
        <button className="btn" onClick={async () => { if (await R.act("room.set", { name, scene })) { R.toast("Sala atualizada.", true); onClose() } }}><Icon n="check" size={14} /> Salvar</button>
      </div>

      {R.me.owner && (
        <>
          <div className="sec-title"><Icon n="crown" size={14} /> Posto de mestre</div>
          <div className="row">
            <p className="grow muted" style={{ margin: 0 }}>{R.room.gm_locked ? "Travado: só você é mestre. Ninguém mais consegue assumir." : "Livre: qualquer jogador pode se declarar mestre."}</p>
            <button className={"btn " + (R.room.gm_locked ? "ghost" : "")} onClick={() => R.act("room.set", { gm_locked: !R.room.gm_locked })}>
              {R.room.gm_locked ? "Liberar" : "Travar para mim"}
            </button>
          </div>
        </>
      )}

      <div className="sec-title"><Icon n="users" size={14} /> Pessoas na mesa</div>
      <div className="col" style={{ gap: ".3rem" }}>
        {R.members.map((m) => (
          <div key={m.id} className="row" style={{ padding: ".25rem 0", borderBottom: "1px solid var(--line-soft)" }}>
            <span className="dot" style={{ background: m.color }}>{initials(m.name)}</span>
            <span className="grow">{m.name}{m.id === R.me.id && <span className="faint"> (você)</span>}</span>
            {m.role === "gm" ? <span className="chip gold">mestre</span> : <span className="chip">jogador</span>}
            {R.me.owner && m.id !== R.me.id && (
              <button className="btn ghost sm" onClick={() => R.act("role.set", { member_id: m.id, role: m.role === "gm" ? "player" : "gm" })}>
                {m.role === "gm" ? "Tornar jogador" : "Tornar mestre"}
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="faint" style={{ fontSize: ".85rem" }}>Convite: <span className="mono">{typeof window !== "undefined" ? location.origin : ""}/s/{R.code}</span></p>
    </Modal>
  )
}

function MeSettings({ onClose }: { onClose: () => void }) {
  const R = useRoom()
  const [name, setName] = useState(R.me.name)
  return (
    <Modal title="Você nesta mesa" icon="user" onClose={onClose}>
      <label className="lbl">Nome exibido</label>
      <input className="field" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} />
      <label className="lbl">Sua cor</label>
      <div className="row wrap">
        {COLORS.map((c) => (
          <button key={c} onClick={() => R.act("me.set", { color: c })} className="dot lg" style={{ background: c, border: 0, cursor: "pointer", outline: c === R.me.color ? "3px solid var(--gold-hi)" : undefined }} aria-label={c} />
        ))}
      </div>
      <div className="row" style={{ marginTop: "1rem" }}>
        <button className="btn" onClick={async () => { if (await R.act("me.set", { name })) onClose() }}><Icon n="check" size={14} /> Salvar</button>
        <span className="grow" />
        {!R.me.account && <Link className="btn ghost" href={`/entrar?next=/s/${R.code}`}>Criar conta</Link>}
      </div>
      {!R.me.account && <p className="faint" style={{ fontSize: ".85rem" }}>Você está como convidado neste navegador. Com conta, suas mesas ficam salvas em qualquer lugar.</p>}
    </Modal>
  )
}
