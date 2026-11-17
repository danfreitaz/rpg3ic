"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { Flourish, Icon } from "@/components/Icon"
import type { Macro, Msg } from "@/lib/types"
import { Modal } from "./Table"
import { barClass, hhmm, initials, useRoom } from "./ctx"
import { sfx } from "@/components/sound"
import { insertInChat, openMenu, type MenuItem } from "@/components/ContextMenu"

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
  { c: "/dano @alvo 8", d: "Tira vida (a primeira barra da ficha)" },
  { c: "/cura @alvo 5", d: "Devolve vida, sem passar do máximo" },
  { c: "/descansar @alvo", d: "Enche todas as barras (@todos para o grupo)" },
  { c: "/status @alvo", d: "Mostra o resumo da ficha no chat" },
  { c: "/moeda", d: "Cara ou coroa" },
  { c: "/img https://link.jpg legenda", d: "Mostra uma imagem da internet (ou cole/arraste uma imagem)" },
  { c: "/grana @alvo +50", d: "Dá, tira (−20) ou define (=100) a grana de uma ficha" },
  { c: "/teste ST", d: "GURPS: 3d6 contra o atributo (ou /teste 12)" },
  { c: "/pagar @alvo 20", d: "Paga com o dinheiro da sua ficha ativa" },
  { c: "/saldo", d: "Mostra a grana das suas fichas (só você vê)" },
  { c: "/oraculo vai chover?", d: "Pergunta de sim/não ao destino (2d6)" },
  { c: "/ooc texto", d: "Fala fora do personagem (ou ((entre parênteses duplos)))" },
  { c: "/grito texto", d: "Grita, em letras garrafais" },
  { c: "/quem", d: "Quem está à mesa (só você vê)" },
  { c: "/ajuda", d: "Lista os comandos (só você vê)" },
  { c: "/cena Porto de Arcadia, ao entardecer", d: "Muda a cena do topo e anuncia", gm: true },
  { c: "/revelar https://imagem.jpg Título | texto", d: "Mostra imagem e/ou texto na tela de todos", gm: true },
  { c: "/trilha chuva", d: "Trilha ambiente: taverna, chuva, floresta, masmorra, batalha, mar, vento, silencio", gm: true },
]

const DIE: Record<number, string> = {
  4: "12,2 22,20 2,20", 6: "3,3 21,3 21,21 3,21", 8: "12,1 23,12 12,23 1,12",
  10: "12,1 22,9 18,22 6,22 2,9", 12: "12,1 22,7 22,17 12,23 2,17 2,7", 20: "12,1 22,6.5 22,17.5 12,23 2,17.5 2,6.5", 100: "12,1 22,9 18,22 6,22 2,9",
}
function DieIcon({ sides }: { sides: number }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><polygon points={DIE[sides]} fill="currentColor" fillOpacity=".18" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
}
const poolExpr = (pool: Record<number, number>, mod: number) => {
  const parts = Object.entries(pool).filter(([, n]) => n > 0).sort((a, b) => Number(a[0]) - Number(b[0])).map(([s, n]) => `${n}d${s}`)
  if (!parts.length) return ""
  return parts.join("+") + (mod ? (mod > 0 ? `+${mod}` : `${mod}`) : "")
}

export function Chat() {
  const R = useRoom()
  const [text, setText] = useState("")
  const [voice, setVoice] = useState("")
  const [hist, setHist] = useState<string[]>([])
  const [hpos, setHpos] = useState(-1)
  const [hi, setHi] = useState(0)
  const [sending, setSending] = useState(false)
  const [pool, setPool] = useState<Record<number, number>>({})
  const [mod, setMod] = useState(0)
  const autoText = useRef("")
  const expr = poolExpr(pool, mod)
  useEffect(() => {
    // A bandeja escreve no campo de fala; se o jogador já escreveu outra coisa, não pisa nela.
    const next = expr ? `/r ${expr}` : ""
    const prev = autoText.current
    setText((t) => (t === "" || t === prev ? next : t))
    autoText.current = next
  }, [expr])
  const addDie = (sides: number, d = 1) => {
    sfx.click()
    setPool((p) => { const n = Math.max(0, Math.min(20, (p[sides] ?? 0) + d)); const q = { ...p, [sides]: n }; if (!n) delete q[sides]; return q })
    inputRef.current?.focus()
  }
  const clearPool = () => { setPool({}); setMod(0) }
  const [uploading, setUploading] = useState(false)
  const [dropping, setDropping] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  async function sendImage(file: File) {
    if (!file.type.startsWith("image/")) return R.toast("Esse arquivo não é uma imagem.")
    setUploading(true)
    try {
      const { data, w, h } = await shrinkImage(file)
      const caption = text.trim() && !text.trim().startsWith("/") ? text.trim() : ""
      const r = await fetch(`/api/rooms/${R.code}/image`, { method: "POST", body: JSON.stringify({ data, w, h, caption }) })
      if (!r.ok) R.toast((await r.json().catch(() => ({}))).error || "Não foi possível enviar a imagem.")
      else if (caption) { autoText.current = ""; setText("") }
      stick.current = true
    } catch { R.toast("Não consegui ler essa imagem.") }
    setUploading(false)
  }
  const insertEmoji = (e: string) => {
    const el = inputRef.current
    const at = el?.selectionStart ?? text.length
    const next = text.slice(0, at) + e + text.slice(el?.selectionEnd ?? at)
    setText(next)
    setTimeout(() => { if (el) { el.focus(); el.setSelectionRange(at + e.length, at + e.length) } }, 0)
  }
  // Outras partes da mesa (menus do botão direito) podem escrever no campo de fala
  useEffect(() => {
    const on = (e: Event) => {
      const { text: t, replace } = (e as CustomEvent).detail as { text: string; replace: boolean }
      setText((cur) => (replace || !cur.trim() ? t : cur.replace(/\s*$/, " ") + t))
      setTimeout(() => { const el = inputRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length) } }, 0)
    }
    window.addEventListener("r3:insert", on)
    return () => window.removeEventListener("r3:insert", on)
  }, [])
  const logRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    const el = logRef.current
    if (!el || !stick.current) return
    el.scrollTop = el.scrollHeight
    const t = setTimeout(() => { el.scrollTop = el.scrollHeight }, 60)
    return () => clearTimeout(t)
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
    if (ok && !raw) { setHist((h) => [text, ...h].slice(0, 50)); autoText.current = ""; setText(""); clearPool(); setHpos(-1); stick.current = true }
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


  return (
    <section className={"frame chat" + (dropping ? " dropping" : "")}
      onDragOver={(e) => { if ([...e.dataTransfer.types].includes("Files")) { e.preventDefault(); setDropping(true) } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDropping(false) }}
      onDrop={(e) => { const f = e.dataTransfer.files?.[0]; setDropping(false); if (f) { e.preventDefault(); sendImage(f) } }}>
      {dropping && <div className="drop-hint"><Icon n="image" size={30} /> Solte a imagem para enviar à mesa</div>}
      <span className="corner-tr" /><span className="corner-bl" />
      <div className="chat-head">
        <Icon n="scroll" />
        <h3 style={{ fontSize: ".95rem" }} className="grow">Crônica da mesa</h3>
        <span className="faint" style={{ fontSize: ".8rem" }}>{R.messages.length} registros</span>
        <button className="btn ghost sm" onClick={() => exportMd(R)} title="Baixar a crônica desta sessão em Markdown"><Icon n="book" size={12} /> Exportar .md</button>
      </div>
      <div className="log" ref={logRef} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80 }}>
        {R.messages.length === 0 && <div className="empty">A mesa está em silêncio. Quebre o gelo.</div>}
        {R.messages.map((m, i) => (
          <div key={m.seq} style={{ display: "contents" }} onContextMenu={(e) => openMenu(e, msgMenu(R, m, send))}>
            <Line m={m} prev={R.messages[i - 1]} />
          </div>
        ))}
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
        {expr && (
          <div className="tray rise">
            <Icon n="d20" size={15} />
            <span className="tray-expr">{expr}</span>
            <span className="faint" style={{ fontSize: ".8rem" }}>na bandeja · Enter rola</span>
            <span className="grow" />
            <button className="btn sm" onClick={() => send()}><Icon n="d20" size={12} /> Rolar</button>
            <button className="iconbtn sm" onClick={() => { clearPool() }} title="Esvaziar a bandeja"><Icon n="x" size={13} /></button>
          </div>
        )}
        <MacroBar onRun={async (m) => { for (const line of m.text.split("\n").map((l) => l.trim()).filter(Boolean)) { if (!(await R.chat(line))) break } }} />
        <div className="dicebar">
          <button className="dbtn coin-btn" onClick={() => send("/moeda")} title="Cara ou coroa"><span className="coin-mini">$</span>moeda</button>
          {[4, 6, 8, 10, 12, 20, 100].map((d) => (
            <button key={d} className={"dbtn die-btn " + (pool[d] ? "on" : "")} onClick={() => addDie(d)} onContextMenu={(e) => { e.preventDefault(); addDie(d, -1) }} title={`Clique: põe 1d${d} na bandeja · botão direito: tira`}>
              <DieIcon sides={d} />d{d}
              {pool[d] ? <span className="die-count">{pool[d]}</span> : null}
            </button>
          ))}
          <span className="sep-v" />
          <button className="dbtn" onClick={() => setMod((m) => m - 1)} title="Modificador −1">−1</button>
          <button className="dbtn" onClick={() => setMod((m) => m + 1)} title="Modificador +1">+1</button>
          <span className="grow" />
          <button className="dbtn" onClick={() => send("/r 2d20kh1 #Vantagem")} title="2d20, fica o maior">vant.</button>
          <button className="dbtn" onClick={() => send("/r 2d20kl1 #Desvantagem")} title="2d20, fica o menor">desv.</button>
          <button className="dbtn" onClick={() => { send(`/sr ${expr || "1d20"}`); clearPool(); autoText.current = ""; setText("") }} title="Só você e o mestre veem"><Icon n="eyeoff" size={13} />secr.</button>
        </div>
        {mySheet && <div className="active-sheet"><Icon n="scroll" size={11} /> falando e rolando como <b>{mySheet.name}</b></div>}
        <div className="inputrow">
          {R.isGM && (
            <select className="field voice" value={voice} onChange={(e) => setVoice(e.target.value)} title="Falar como…">
              <option value="">{mySheet ? mySheet.name : R.me.name}</option>
              <option value="__narr">📜 Narrador</option>
              {npcs.map((s) => <option key={s.id} value={s.name}>{s.kind === "creature" ? "🐉" : "🎭"} {s.name}</option>)}
            </select>
          )}
          <div className="compose-tools">
            <button className={"iconbtn " + (emojiOpen ? "on" : "")} title="Emojis" onClick={() => setEmojiOpen((o) => !o)}><Icon n="smile" size={17} /></button>
            <button className="iconbtn" title="Enviar imagem (também dá para colar ou arrastar)" disabled={uploading} onClick={() => fileRef.current?.click()}>{uploading ? <span className="loading-dice"><Icon n="d20" size={15} /></span> : <Icon n="image" size={17} />}</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) sendImage(f) }} />
            {emojiOpen && <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />}
          </div>
          <textarea ref={inputRef} className="field" rows={1} value={text}
            onPaste={(e) => { const f = [...e.clipboardData.files].find((x) => x.type.startsWith("image/")); if (f) { e.preventDefault(); sendImage(f) } }} placeholder={voice === "__narr" ? "Narre a cena…" : voice ? `Fale como ${voice}… (*ação* entre asteriscos)` : "Fale, *aja* ou digite / para comandos…"}
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
  if (m.kind === "system") return <div className={"sys " + (m.to_member ? "private" : "")}><Icon n={m.data?.icon || "star"} size={14} />{m.body}{m.to_member && <span className="chip violet" style={{ marginLeft: ".3rem" }}>só você</span>}</div>
  if (m.kind === "ooc") return <div className="ooc"><span className="who" style={{ color: m.color }}>{m.speaker}</span> <span className="faint">(fora do jogo)</span> {m.body}</div>
  if (m.kind === "reveal") return (
    <div className="reveal-line">
      <div className="lbl2"><Icon n="eye" size={12} /> Revelação{m.data?.title ? `: ${m.data.title}` : ""}</div>
      {m.data?.image && <img src={m.data.image} alt="" onError={(e) => { e.currentTarget.style.display = "none" }} />}
      {m.body && <div className="body">{m.body}</div>}
    </div>
  )
  if (m.kind === "scene") return <div className="scene-card"><Icon n="castle" size={16} /><span>{m.body}</span></div>
  if (m.kind === "narration") return <div className="parch narr"><Flourish />{m.body}</div>
  if (m.kind === "turn") return <div className="turnbar"><Icon n="hourglass" size={15} /> Rodada {m.data?.round} · vez de {m.data?.name}</div>

  const cont = !!prev && prev.speaker === m.speaker && prev.kind === m.kind && ["say", "action"].includes(m.kind) && !prev.to_member && !m.to_member &&
    new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 120000
  const cls = ["msg", m.kind, m.kind === "shout" ? "say" : "", m.data?.npc ? "npc" : "", cont ? "cont" : ""].join(" ")
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
        {m.kind === "roll" ? <RollCard m={m} /> : m.kind === "change" ? <Changes m={m} /> : m.kind === "coin" ? <Coin m={m} /> : m.kind === "oracle" ? <Oracle m={m} /> : m.kind === "status" ? <Status m={m} /> : m.kind === "money" ? <Money m={m} /> : m.kind === "image" ? <ChatImage m={m} /> : <div className="body">{m.body}</div>}
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
      {m.data?.under && <span className={"chip " + (m.data.under.ok ? "green" : "red")} style={{ alignSelf: "flex-start" }}>{m.data.under.ok ? `Sucesso por ${m.data.under.margin}` : `Falha por ${-m.data.under.margin}`} · alvo {m.data.under.alvo}</span>}
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

function Coin({ m }: { m: Msg }) {
  return (
    <div className="rollcard coin-card">
      <div className="row">
        <span className={"coin-face " + (m.data?.face === "Cara" ? "heads" : "tails")}>{m.data?.face === "Cara" ? "☉" : "♛"}</span>
        <div className="grow">{m.body && <div className="lbl2">{m.body}</div>}<div className="expr">moeda ao ar…</div></div>
        <span className="total">{m.data?.face}</span>
      </div>
    </div>
  )
}

function Oracle({ m }: { m: Msg }) {
  const t = m.data?.t ?? 7
  return (
    <div className={"rollcard oracle " + (t >= 11 ? "crit" : t <= 3 ? "fumble" : "")}>
      <div className="lbl2"><Icon n="eye" size={12} /> Oráculo</div>
      <div style={{ fontStyle: "italic" }}>“{m.body}”</div>
      <div className="dice-row">
        <span className="die">{m.data?.a}</span><span className="mod">+</span><span className="die">{m.data?.b}</span>
        <span className="total" style={{ fontSize: "1.05rem" }}>{m.data?.answer}</span>
      </div>
    </div>
  )
}

function Status({ m }: { m: Msg }) {
  const d = m.data ?? {}
  return (
    <div className="rollcard status-card">
      {(d.bars ?? []).map((b: any) => (
        <div key={b.label} className="row" style={{ gap: ".4rem", fontSize: ".85rem" }}>
          <span style={{ width: 110 }} className="muted">{b.label}</span>
          <div className={"mini-bar grow mb-" + barClass(b.key ?? b.label)} style={{ height: 8, margin: 0 }}><i style={{ width: (b.m ? Math.max(0, Math.min(100, (b.v / b.m) * 100)) : 0) + "%" }} /></div>
          <b className="mono" style={{ fontSize: ".78rem" }}>{b.v}/{b.m}</b>
        </div>
      ))}
      {(d.nums ?? []).length > 0 && <div className="row wrap" style={{ gap: ".25rem" }}>{d.nums.map((n: any) => <span key={n.label} className="chip">{n.label} {n.v}</span>)}</div>}
      <div className="row wrap" style={{ gap: ".25rem", fontSize: ".85rem" }}>
        <span className="muted" style={{ width: 110 }}>Condições</span>
        {(d.conds ?? []).length ? d.conds.map((c: any) => <span key={c.n} className="chip violet">{c.n}{c.r !== null && c.r !== undefined ? ` · ${c.r} rod.` : ""}</span>) : <span className="faint">nenhuma</span>}
      </div>
      {d.money !== undefined && <div className="row" style={{ gap: ".4rem", fontSize: ".85rem" }}><span className="muted" style={{ width: 110 }}>Grana</span><b className="money">$ {d.money}</b></div>}
    </div>
  )
}

function MacroBar({ onRun }: { onRun: (m: Macro) => void }) {
  const R = useRoom()
  const [edit, setEdit] = useState(false)
  const list = (R.me.macros ?? []) as Macro[]
  return (
    <div className="macrobar">
      <Icon n="star" size={13} className="faint" />
      {list.length === 0 && <span className="faint" style={{ fontSize: ".8rem" }}>Sem macros. Crie atalhos para comandos que você usa sempre.</span>}
      {list.map((m, i) => (
        <button key={i} className="macro" onClick={() => onRun(m)} title={m.text}
          onContextMenu={(e) => openMenu(e, [
            { title: `Macro · ${m.name}` },
            { label: "Executar", icon: "send", onClick: () => onRun(m) },
            { label: "Colocar no campo de fala", icon: "quill", onClick: () => insertInChat(m.text.split("\n")[0], true) },
            { label: "Editar macros", icon: "gear", onClick: () => setEdit(true) },
            "sep",
            { label: "Apagar esta macro", icon: "trash", danger: true, onClick: () => R.act("me.set", { macros: list.filter((_, j) => j !== i) }) },
          ])}>{m.name}</button>
      ))}
      <button className="iconbtn sm" title="Editar macros" onClick={() => setEdit(true)}><Icon n="gear" size={13} /></button>
      {edit && <MacroEditor initial={list} onClose={() => setEdit(false)} />}
    </div>
  )
}

function MacroEditor({ initial, onClose }: { initial: Macro[]; onClose: () => void }) {
  const R = useRoom()
  const [list, setList] = useState<Macro[]>(initial.length ? initial : [{ name: "Ataque", text: "/r 1d20+FOR #Ataque\n/r 1d8+FOR #Dano" }])
  const set = (i: number, p: Partial<Macro>) => setList(list.map((m, j) => (j === i ? { ...m, ...p } : m)))
  return (
    <Modal title="Suas macros" icon="star" onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>Cada linha vira uma mensagem ou comando, em ordem. Ex.: um ataque que rola o acerto e o dano de uma vez.</p>
      {list.map((m, i) => (
        <div key={i} className="row" style={{ alignItems: "flex-start", marginBottom: ".5rem" }}>
          <input className="field" style={{ width: 140 }} value={m.name} maxLength={24} placeholder="Nome" onChange={(e) => set(i, { name: e.target.value })} />
          <textarea className="field grow mono" style={{ fontSize: ".82rem", minHeight: "3.2em" }} value={m.text} placeholder="/r 1d20+DES #Furtividade" onChange={(e) => set(i, { text: e.target.value })} />
          <button className="iconbtn sm" onClick={() => setList(list.filter((_, j) => j !== i))} title="Remover"><Icon n="trash" size={13} /></button>
        </div>
      ))}
      <div className="row" style={{ marginTop: ".6rem" }}>
        <button className="btn ghost sm" disabled={list.length >= 20} onClick={() => setList([...list, { name: "", text: "" }])}><Icon n="plus" size={12} /> Macro</button>
        <span className="grow" />
        <button className="btn" onClick={async () => { if (await R.act("me.set", { macros: list })) { R.toast("Macros salvas.", true); onClose() } }}><Icon n="check" size={14} /> Salvar</button>
      </div>
    </Modal>
  )
}

/** Baixa a crônica da sessão em Markdown (o que este jogador consegue ver). */
function exportMd(R: ReturnType<typeof useRoom>) {
  const date = new Date().toLocaleDateString("pt-BR")
  const out: string[] = [`# Crônica — ${R.room.name}`, "", `*Mesa ${R.code} · exportada em ${date}${R.room.scene ? ` · cena: ${R.room.scene}` : ""}*`, ""]
  let day = ""
  for (const m of R.messages) {
    const d = new Date(m.created_at)
    const dd = d.toLocaleDateString("pt-BR")
    if (dd !== day) { day = dd; out.push("", `## ${dd}`, "") }
    const t = hhmm(m.created_at)
    switch (m.kind) {
      case "say": out.push(`**${m.speaker}:** ${m.body}  `); break
      case "action": out.push(`*${m.speaker} ${m.body}*  `); break
      case "shout": out.push(`**${m.speaker} grita:** ${m.body}!  `); break
      case "whisper": out.push(`> *(sussurro de ${m.speaker} para ${m.data?.to ?? "?"})* ${m.body}`); break
      case "narration": out.push("", `> ${m.body.replace(/\n/g, "\n> ")}`, ""); break
      case "scene": out.push("", `### 🏰 ${m.body}`, ""); break
      case "reveal": out.push("", `> **Revelação${m.data?.title ? `: ${m.data.title}` : ""}** ${m.body}${m.data?.image ? `\n>\n> ![](${m.data.image})` : ""}`, ""); break
      case "roll": { const r = m.data?.r; out.push(`🎲 ${m.speaker}${m.body ? ` (${m.body})` : ""}: \`${r?.expr}\` = **${r?.total}**${r?.crit ? " — crítico!" : r?.fumble ? " — falha crítica" : ""}${m.secret ? " *(secreta)*" : ""}  `); break }
      case "change": for (const c of m.data?.ch ?? []) out.push(`✦ ${c.name} · ${c.label}: ${c.from} → ${c.to}  `); break
      case "coin": out.push(`🪙 ${m.speaker} jogou a moeda${m.body ? ` (${m.body})` : ""}: **${m.data?.face}**  `); break
      case "oracle": out.push(`🔮 ${m.speaker} perguntou ao oráculo: “${m.body}” → **${m.data?.answer}**  `); break
      case "turn": out.push(`⏳ Rodada ${m.data?.round} — vez de ${m.data?.name}  `); break
      case "image": out.push("", `![${m.body || "imagem"}](${new URL(m.data?.url ?? "", location.origin).href})${m.body ? `  \n*${m.speaker}: ${m.body}*` : `  \n*${m.speaker}*`}`, ""); break
      case "money": out.push(m.data?.pay ? `💰 ${m.data.pay.from} pagou $ ${m.data.pay.n} a ${m.data.pay.to}  ` : (m.data?.ch ?? []).map((c: any) => `💰 ${c.name}: $ ${c.from} → $ ${c.to}  `).join("\n")); break
      case "ooc": out.push(`<sub>(${m.speaker}, fora do jogo: ${m.body})</sub>  `); break
      case "status": break
      default: if (!m.to_member) out.push(`— ${m.body} —  `)
    }
    void t
  }
  const blob = new Blob([out.join("\n")], { type: "text/markdown;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `cronica-${R.room.name.normalize("NFD").replace(/[^\w]+/g, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.md`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 2000)
  R.toast("Crônica exportada.", true)
}

/** Opções do botão direito para cada tipo de mensagem. */
function msgMenu(R: ReturnType<typeof useRoom>, m: Msg, send: (raw?: string) => void): MenuItem[] {
  const author = R.memberById(m.member_id)
  const tag = (n: string) => "@" + n.replace(/\s+/g, "")
  const sheet = R.sheets.find((s) => s.name === m.speaker)
  const r = m.data?.r
  const text = m.kind === "roll" ? `${m.speaker}: ${r?.expr} = ${r?.total}${m.body ? ` (${m.body})` : ""}`
    : m.kind === "change" ? (m.data?.ch ?? []).map((c: any) => `${c.name} ${c.label}: ${c.from} → ${c.to}`).join("; ")
    : m.kind === "coin" ? `${m.speaker}: ${m.data?.face}` : m.kind === "oracle" ? `${m.body} → ${m.data?.answer}` : m.body
  const copy = (t: string, what: string) => { navigator.clipboard?.writeText(t); R.toast(`${what} copiado.`, true) }
  const isMine = m.member_id === R.me.id
  const speakerIsPerson = !["system", "turn", "scene", "narration", "reveal"].includes(m.kind)
  return [
    { title: m.kind === "roll" ? `Rolagem de ${m.speaker}` : speakerIsPerson ? m.speaker : { system: "Aviso da mesa", turn: "Turno", scene: "Cena", narration: "Narração", reveal: "Revelação" }[m.kind] ?? "Mensagem" },
    text ? { label: "Copiar texto", icon: "copy", onClick: () => copy(text, "Texto") } : null,
    m.kind === "roll" && r ? { label: "Rolar de novo", icon: "d20", hint: r.expr, onClick: () => send(`/r ${r.expr}${m.body ? ` #${m.body}` : ""}`) } : null,
    m.kind === "roll" && r ? { label: "Copiar a expressão", icon: "copy", onClick: () => copy(r.expr, "Expressão") } : null,
    speakerIsPerson && m.body ? { label: "Responder citando", icon: "quill", onClick: () => insertInChat(`«${m.body.slice(0, 80)}${m.body.length > 80 ? "…" : ""}» — `) } : null,
    speakerIsPerson ? { label: `Mencionar ${m.speaker}`, icon: "user", onClick: () => insertInChat(tag(sheet?.name ?? m.speaker) + " ") } : null,
    author && !isMine && speakerIsPerson ? { label: `Sussurrar para ${author.name}`, icon: "whisper", onClick: () => insertInChat(`/w ${tag(author.name)} `, true) } : null,
    sheet ? { label: `Abrir a ficha de ${sheet.name}`, icon: "scroll", onClick: () => R.focus.setSheet(sheet.id) } : null,
    m.data?.image || m.data?.url ? { label: "Abrir a imagem", icon: "image", onClick: () => window.open(m.data.image || m.data.url, "_blank", "noopener") } : null,
    m.kind === "image" ? { label: "Copiar link da imagem", icon: "copy", onClick: () => copy(new URL(m.data.url, location.origin).href, "Link") } : null,
    m.kind === "image" && R.isGM ? { label: "Revelar na tela de todos", icon: "eye", onClick: () => send(`/revelar ${new URL(m.data.url, location.origin).href} ${m.body || "Imagem"} | `) } : null,
    R.isGM && (m.kind === "narration" || m.kind === "reveal") ? { label: "Mostrar de novo na tela", icon: "eye", onClick: () => send(m.kind === "reveal" ? `/revelar ${m.data?.image ? m.data.image + " " : ""}${m.data?.title || "Revelação"} | ${m.body}` : `/n ${m.body}`) } : null,
    R.isGM ? "sep" : null,
    R.isGM ? { label: "Apagar mensagem", icon: "trash", danger: true, onClick: () => R.act("msg.delete", { seq: m.seq }) } : null,
  ]
}

function Money({ m }: { m: Msg }) {
  const d = m.data ?? {}
  return (
    <div className="change-list">
      {d.pay && <div className="change"><span className="coin-mini">$</span><span><b>{d.pay.from}</b> pagou <b className="money">$ {d.pay.n}</b> a <b>{d.pay.to}</b></span></div>}
      {(d.ch ?? []).map((c: any, i: number) => {
        const delta = c.to - c.from
        return (
          <div key={i} className="change">
            {!d.pay && <span className="coin-mini">$</span>}
            <span><b>{c.name}</b> · grana: $ {c.from} → <b className="money">$ {c.to}</b></span>
            <span className={"delta " + (delta < 0 ? "down" : "up")}>{delta > 0 ? "+" : ""}{delta}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Reduz e comprime a imagem no navegador antes de enviar (orçamento zero agradece). */
async function shrinkImage(file: File): Promise<{ data: string; w: number; h: number }> {
  const toData = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b) })
  const bmp = await createImageBitmap(file)
  const { width: w0, height: h0 } = bmp
  if (file.type === "image/gif" && file.size <= 850 * 1024) return { data: await toData(file), w: w0, h: h0 } // GIF animado inteiro
  for (const [max, q] of [[1600, 0.82], [1280, 0.75], [960, 0.7], [720, 0.62]] as const) {
    const k = Math.min(1, max / Math.max(w0, h0))
    const w = Math.round(w0 * k), h = Math.round(h0 * k)
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h
    cv.getContext("2d")!.drawImage(bmp, 0, 0, w, h)
    const blob = await new Promise<Blob | null>((res) => cv.toBlob(res, "image/webp", q))
    if (blob && blob.size <= 850 * 1024) return { data: await toData(blob), w, h }
  }
  throw new Error("grande demais")
}

let showImage: (src: string, caption?: string) => void = () => {}
function ChatImage({ m }: { m: Msg }) {
  const src = m.data?.url as string
  const ratio = m.data?.w && m.data?.h ? `${m.data.w} / ${m.data.h}` : undefined
  return (
    <div className="chat-img-wrap">
      <img className="chat-img" src={src} alt={m.body || "imagem"} loading="lazy" style={{ aspectRatio: ratio }} onClick={() => showImage(src, m.body)}
        onError={(e) => { e.currentTarget.replaceWith(Object.assign(document.createElement("span"), { className: "faint", textContent: "(imagem indisponível)" })) }} />
      {m.body && <div className="body">{m.body}</div>}
    </div>
  )
}

export function ImageLightbox() {
  const [img, setImg] = useState<{ src: string; caption?: string } | null>(null)
  showImage = (src, caption) => setImg({ src, caption })
  useEffect(() => {
    if (!img) return
    const k = (e: KeyboardEvent) => e.key === "Escape" && setImg(null)
    window.addEventListener("keydown", k)
    return () => window.removeEventListener("keydown", k)
  }, [img])
  if (!img) return null
  return (
    <div className="lightbox" onClick={() => setImg(null)}>
      <img src={img.src} alt={img.caption || ""} />
      {img.caption && <p>{img.caption}</p>}
    </div>
  )
}

const EMOJIS: [string, string][] = [
  ["Aventura", "⚔️ 🛡️ 🏹 🗡️ 🪓 🔮 🧪 📜 🗺️ 💰 💎 👑 🏰 🗝️ 🚪 🕯️ ⛓️ 🎲 🎭 🎵 🍺 🍖 🔥 ❄️ ⚡ 🌙 ☀️ 🌧️ 🌲 ⛰️"],
  ["Criaturas", "🐉 🧙 🧝 🧛 🧟 🧚 🧞 💀 👻 👹 👺 🕷️ 🦇 🐺 🐍 🦂 🐀 🦅 🐎 🐗"],
  ["Rostos", "😀 😂 🤣 😅 😉 😎 🤔 😐 😏 🙄 😬 😴 😱 😡 😭 🥲 🤯 🥳 😇 😈 🤡 🤫 🫡 🤐"],
  ["Gestos", "👍 👎 👏 🙏 💪 ✌️ 🤞 👀 ❤️ 💔 ✨ 💥 💤 ❗ ❓ ✅ ❌ 🎉 🏆 ⭐"],
]
function EmojiPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const down = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node) && !(e.target as HTMLElement).closest(".compose-tools")) onClose() }
    window.addEventListener("mousedown", down)
    return () => window.removeEventListener("mousedown", down)
  }, [onClose])
  return (
    <div className="emoji-pop rise" ref={ref}>
      {EMOJIS.map(([title, list]) => (
        <div key={title}>
          <div className="emoji-title">{title}</div>
          <div className="emoji-grid">{list.split(" ").map((e) => <button key={e} onClick={() => onPick(e)}>{e}</button>)}</div>
        </div>
      ))}
    </div>
  )
}
