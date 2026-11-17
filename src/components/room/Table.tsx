"use client"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Icon, Seal } from "@/components/Icon"
import { insertInChat, openMenu } from "@/components/ContextMenu"
import { ambienceVolume, playAmbience, setAmbienceVolume, setSoundOn, sfx, soundOn, stopAmbience, unlockAudio } from "@/components/sound"
import { AMBIENCES, COLORS, SKINS, type Msg } from "@/lib/types"
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
  const [reveal, setReveal] = useState<Msg | null>(null)
  const [skinPick, setSkinPick] = useState<string>("")
  const [ambOpen, setAmbOpen] = useState(false)
  useEffect(() => { try { setSkinPick(localStorage.getItem("r3_skin") || "") } catch {} }, [])
  const skin = skinPick || R.room.skin || "medieval"
  useEffect(() => { document.documentElement.dataset.skin = skin }, [skin])
  useEffect(() => () => { document.documentElement.dataset.skin = (() => { try { return localStorage.getItem("r3_skin") || "medieval" } catch { return "medieval" } })(); stopAmbience() }, [])
  // Trilha ambiente da sala (o navegador só libera o som depois do primeiro clique)
  useEffect(() => { if (sound) playAmbience(R.room.ambience); else stopAmbience() }, [R.room.ambience, sound])
  useEffect(() => {
    const go = () => { unlockAudio(); if (soundOn()) playAmbience(R.room.ambience) }
    window.addEventListener("pointerdown", go, { once: true })
    return () => window.removeEventListener("pointerdown", go)
  }, [R.room.ambience])
  const seen = useRef<number>(-1)

  useEffect(() => setSound(soundOn()), [])
  useEffect(() => {
    try { localStorage.setItem("r3_last_room", JSON.stringify({ code: R.code, name: R.room.name, at: Date.now() })) } catch {}
  }, [R.code, R.room.name])

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
      else if (m.kind === "coin") sfx.coin()
      else if (m.kind === "oracle") sfx.narration()
      else if (m.kind === "shout") sfx.damage()
      else if (m.kind === "scene") sfx.door()
      else if (m.kind === "reveal") { sfx.narration(); sfx.paper(); setReveal(m) }
      else if (m.kind === "system") {
        m.data?.icon === "door" ? sfx.door() : sfx.paper()
        // O mestre trocou o visual da mesa: todos passam a ver o novo visual (cada um pode trocar de novo depois).
        if (m.data?.skin) {
          let had = ""
          try { had = localStorage.getItem("r3_skin") || ""; localStorage.removeItem("r3_skin") } catch {}
          setSkinPick("")
          if (had && had !== m.data.skin) R.toast("O mestre trocou o visual da mesa. Para voltar ao seu, clique no seu nome.", true)
        }
      }
      else if (m.member_id !== R.me.id) sfx.msg()
    }
  }, [R.messages, R.me.id])

  const copy = () => {
    navigator.clipboard?.writeText(R.code)
    R.toast(`Código ${R.code} copiado.`, true)
    sfx.click()
  }
  const copyLink = () => {
    navigator.clipboard?.writeText(`${location.origin}/s/${R.code}`)
    R.toast("Link direto da sala copiado!", true)
    sfx.click()
  }

  return (
    <div className={"table " + (R.isGM ? "gm" : "")}>
      <header className="frame topbar">
        <span className="corner-tr" /><span className="corner-bl" />
        <Link href="/" className="brand" title="Voltar ao saguão"><Seal size={32} /><b>RPG3ic</b></Link>
        <span className="sep" />
        <span className="roomname" title={R.room.name}>{R.room.name}</span>
        {R.room.scene && <span className="scene">· {R.room.scene}</span>}
        <button className="codebadge" onClick={copy} title="Copiar o código"
          onContextMenu={(e) => openMenu(e, [
            { title: `Sala ${R.code}` },
            { label: "Copiar código", icon: "copy", hint: R.code, onClick: copy },
            { label: "Copiar link direto", icon: "copy", onClick: copyLink },
            (R.isGM || R.me.owner) ? { label: "Configurar a sala", icon: "gear", onClick: () => setModal("room") } : null,
            R.me.owner ? { label: R.room.public ? "Tornar privada" : "Tornar pública", icon: R.room.public ? "eyeoff" : "eye", onClick: () => R.act("room.set", { public: !R.room.public }) } : null,
          ])}>{R.code}</button>
        <button className="btn sm ghost linkbtn" onClick={copyLink} title="Copiar o link direto para a sala"><Icon n="copy" size={13} /> Copiar link</button>
        <span className={"chip " + (R.room.public ? "green" : "")} title={R.room.public ? "Aparece na lista de mesas abertas" : "Só entra quem tem o código"}>
          <Icon n={R.room.public ? "eye" : "eyeoff"} size={11} /> {R.room.public ? "pública" : "privada"}
        </span>
        <span className="grow" />
        <span className={"chip " + (live ? "green" : "red")} title={live ? "Sincronizado em tempo real" : "Reconectando…"}>
          <span style={{ width: 7, height: 7, borderRadius: 9, background: live ? "#7fd18f" : "#e2725e", display: "inline-block" }} />
          {live ? "ao vivo" : "reconectando"}
        </span>
        <span className="row" style={{ gap: ".15rem" }}>
          {R.members.slice(0, 8).map((m) => (
            <span key={m.id} className="dot" style={{ background: m.color, outline: m.role === "gm" ? "2px solid var(--gold-hi)" : undefined, cursor: "context-menu" }} title={`${m.name}${m.role === "gm" ? " (mestre)" : ""}`}
              onContextMenu={(e) => {
                const sh = m.sheet_id ? R.sheets.find((s) => s.id === m.sheet_id) : undefined
                const tag = "@" + m.name.replace(/\s+/g, "")
                openMenu(e, [
                  { title: `${m.name}${m.role === "gm" ? " · mestre" : ""}${m.id === R.me.id ? " (você)" : ""}` },
                  m.id !== R.me.id ? { label: "Sussurrar", icon: "whisper", onClick: () => insertInChat(`/w ${tag} `, true) } : null,
                  { label: "Mencionar no chat", icon: "user", onClick: () => insertInChat(tag + " ") },
                  sh ? { label: `Abrir ficha de ${sh.name}`, icon: "scroll", onClick: () => R.focus.setSheet(sh.id) } : null,
                  m.id === R.me.id ? { label: "Editar meu perfil", icon: "gear", onClick: () => setModal("me") } : null,
                  R.me.owner && m.id !== R.me.id ? "sep" : null,
                  R.me.owner && m.id !== R.me.id ? { label: m.role === "gm" ? "Tornar jogador" : "Tornar mestre", icon: "crown", onClick: () => R.act("role.set", { member_id: m.id, role: m.role === "gm" ? "player" : "gm" }) } : null,
                ])
              }}>{initials(m.name)}</span>
          ))}
          {R.members.length > 8 && <span className="faint" style={{ fontSize: ".8rem" }}>+{R.members.length - 8}</span>}
        </span>
        <span className="sep" />
        <button className={"iconbtn " + (R.isGM ? "on" : "")} title={R.isGM ? "Você é mestre — clique para virar jogador" : R.room.gm_locked && !R.me.owner ? "Posto de mestre travado" : "Assumir o posto de mestre"}
          onClick={() => R.act("role.set", { role: R.isGM ? "player" : "gm" })}><Icon n="crown" /></button>
        <div className="amb-wrap">
          <button className={"iconbtn " + (R.room.ambience ? "on" : "")} title="Trilha ambiente" onClick={() => setAmbOpen((o) => !o)}><Icon n={AMBIENCES.find((a) => a.id === R.room.ambience)?.icon ?? "bell"} /></button>
          {ambOpen && <AmbienceMenu onClose={() => setAmbOpen(false)} />}
        </div>
        <button className="iconbtn" title={sound ? "Silenciar" : "Ligar sons"} onClick={() => { setSoundOn(!sound); setSound(!sound); if (!sound) sfx.click() }}><Icon n={sound ? "sound" : "mute"} /></button>
        {(R.isGM || R.me.owner) && <button className="iconbtn" title="Configurar a sala" onClick={() => setModal("room")}><Icon n="gear" /></button>}
        <button className="me-pill" onClick={() => setModal("me")} title="Seu perfil na mesa"
          onContextMenu={(e) => openMenu(e, [
            { title: R.me.name },
            { label: "Editar perfil e visual", icon: "gear", onClick: () => setModal("me") },
            { label: R.isGM ? "Deixar o posto de mestre" : "Assumir o posto de mestre", icon: "crown", onClick: () => R.act("role.set", { role: R.isGM ? "player" : "gm" }) },
            { label: sound ? "Silenciar sons" : "Ligar sons", icon: sound ? "mute" : "sound", onClick: () => { setSoundOn(!sound); setSound(!sound) } },
            "sep",
            { label: "Voltar ao saguão", icon: "door", onClick: () => { location.href = "/" } },
          ])}>
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
      {modal === "me" && <MeSettings onClose={() => setModal(null)} skinPick={skinPick} setSkinPick={(s) => { setSkinPick(s); try { s ? localStorage.setItem("r3_skin", s) : localStorage.removeItem("r3_skin") } catch {} }} />}
      {reveal && <RevealView m={reveal} onClose={() => setReveal(null)} />}
    </div>
  )
}

export function Modal({ title, icon, onClose, children }: { title: string; icon: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [onClose])
  // Portal: o modal sai de dentro dos painéis, então nenhum recorte, desfoque ou camada de skin o esconde.
  if (typeof document === "undefined") return null
  return createPortal(
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="frame modal rise">
        <span className="corner-tr" /><span className="corner-bl" />
        <div className="row"><h2 className="grow"><Icon n={icon} /> {title}</h2><button className="iconbtn" onClick={onClose}><Icon n="x" /></button></div>
        {children}
      </div>
    </div>,
    document.body
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
      <label className="lbl">Visual da mesa (padrão para todos)</label>
      <SkinGrid value={R.room.skin} onPick={(id) => R.act("room.set", { skin: id })} />
      <div className="row" style={{ marginTop: ".8rem" }}>
        <button className="btn" onClick={async () => { if (await R.act("room.set", { name, scene })) { R.toast("Sala atualizada.", true); onClose() } }}><Icon n="check" size={14} /> Salvar</button>
      </div>

      {R.me.owner && (
        <>
          <div className="sec-title"><Icon n="eye" size={14} /> Visibilidade</div>
          <div className="row">
            <p className="grow muted" style={{ margin: 0 }}>{R.room.public ? "Pública: aparece em “Mesas abertas” na página inicial, e qualquer um pode entrar." : "Privada: só entra quem tem o código ou o link."}</p>
            <button className={"btn " + (R.room.public ? "ghost" : "")} onClick={() => R.act("room.set", { public: !R.room.public })}>{R.room.public ? "Tornar privada" : "Tornar pública"}</button>
          </div>
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
      <div className="row" style={{ marginTop: ".8rem" }}>
        <span className="faint mono grow" style={{ fontSize: ".85rem" }}>{typeof window !== "undefined" ? location.origin : ""}/s/{R.code}</span>
        <button className="btn sm" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/s/${R.code}`); R.toast("Link copiado!", true) }}><Icon n="copy" size={12} /> Copiar link</button>
      </div>
    </Modal>
  )
}

function MeSettings({ onClose, skinPick, setSkinPick }: { onClose: () => void; skinPick: string; setSkinPick: (s: string) => void }) {
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
      <label className="lbl">Visual só para você</label>
      <SkinGrid value={skinPick} follow={R.room.skin} onPick={setSkinPick} />
      <div className="row" style={{ marginTop: "1rem" }}>
        <button className="btn" onClick={async () => { if (await R.act("me.set", { name })) onClose() }}><Icon n="check" size={14} /> Salvar</button>
        <span className="grow" />
        {!R.me.account && <Link className="btn ghost" href={`/entrar?next=/s/${R.code}`}>Criar conta</Link>}
      </div>
      {!R.me.account && <p className="faint" style={{ fontSize: ".85rem" }}>Você está como convidado neste navegador. Com conta, suas mesas ficam salvas em qualquer lugar.</p>}
    </Modal>
  )
}

function SkinGrid({ value, follow, onPick }: { value: string; follow?: string; onPick: (id: string) => void }) {
  const opts = follow !== undefined ? [{ id: "", name: "Seguir a sala", hint: `Usa o visual que o mestre escolheu (${SKINS.find((s) => s.id === follow)?.name ?? "Taverna"})` }, ...SKINS] : SKINS
  return (
    <div className="skin-grid">
      {opts.map((s) => (
        <button key={s.id || "follow"} className={"skin-opt " + (value === s.id ? "on" : "")} onClick={() => { sfx.click(); onPick(s.id) }}>
          <span className={"skin-swatch sw-" + (s.id || follow || "medieval")}><i /><i /><i /></span>
          <b>{s.name}</b><small>{s.hint}</small>
        </button>
      ))}
    </div>
  )
}

function AmbienceMenu({ onClose }: { onClose: () => void }) {
  const R = useRoom()
  const [vol, setVol] = useState(0.5)
  useEffect(() => setVol(ambienceVolume()), [])
  useEffect(() => {
    const k = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".amb-wrap")) onClose() }
    setTimeout(() => window.addEventListener("mousedown", k), 0)
    return () => window.removeEventListener("mousedown", k)
  }, [onClose])
  return (
    <div className="amb-menu rise">
      <div className="sec-title" style={{ marginTop: 0 }}>Trilha ambiente</div>
      {R.isGM ? (
        <div className="amb-list">
          {AMBIENCES.map((a) => (
            <button key={a.id || "none"} className={"amb-opt " + (R.room.ambience === a.id ? "on" : "")} onClick={() => R.act("room.set", { ambience: a.id })}>
              <Icon n={a.icon} size={15} /> {a.name}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted" style={{ margin: "0 0 .4rem" }}>Tocando: <b>{AMBIENCES.find((a) => a.id === R.room.ambience)?.name ?? "Silêncio"}</b>. Quem escolhe a trilha é o mestre.</p>
      )}
      <label className="lbl">Seu volume</label>
      <input type="range" min={0} max={1} step={0.05} value={vol} onChange={(e) => { const v = Number(e.target.value); setVol(v); setAmbienceVolume(v) }} style={{ width: "100%", accentColor: "var(--gold)" }} />
      <p className="faint" style={{ fontSize: ".78rem", margin: ".3rem 0 0" }}>Tudo sintetizado na hora, sem baixar nada. Se não ouvir, clique em qualquer lugar da página.</p>
    </div>
  )
}

function RevealView({ m, onClose }: { m: Msg; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [onClose])
  return (
    <div className="reveal-back" onMouseDown={onClose}>
      <div className="reveal-card" onMouseDown={(e) => e.stopPropagation()}>
        <div className="reveal-glow" />
        {m.data?.title && <h2 className="title-deco">{m.data.title}</h2>}
        {m.data?.image && <img src={m.data.image} alt={m.data?.title || "Revelação"} onError={(e) => { e.currentTarget.style.display = "none" }} />}
        {m.body && <p>{m.body}</p>}
        <button className="btn" onClick={onClose}><Icon n="check" size={14} /> Continuar</button>
      </div>
    </div>
  )
}
