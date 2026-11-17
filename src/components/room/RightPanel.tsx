"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { Icon } from "@/components/Icon"
import { EMPTY_INIT, EMPTY_MAP, type InitState, type MapState, type Note, type Token } from "@/lib/types"
import { hhmm, hpOf, initials, useRoom } from "./ctx"
import { NoteEditor } from "./LeftPanel"
import { Modal } from "./Table"

type Tab = "map" | "init" | "dice" | "diary"

export function RightPanel() {
  const R = useRoom()
  const [tab, setTab] = useState<Tab>("map")
  const init = R.room.init ?? EMPTY_INIT
  const lastTurn = R.messages.filter((m) => m.kind === "turn").at(-1)?.seq
  const first = useRef(true)
  useEffect(() => { if (first.current) { first.current = false; return } if (lastTurn) setTab((t) => (t === "map" ? t : "init")) }, [lastTurn])
  return (
    <aside className="frame panel side-right">
      <span className="corner-tr" /><span className="corner-bl" /><span className="studs" />
      <div className="tabs">
        <button className={"tab " + (tab === "map" ? "on" : "")} onClick={() => setTab("map")}><Icon n="map" size={14} /> Mapa</button>
        <button className={"tab " + (tab === "init" ? "on" : "")} onClick={() => setTab("init")}><Icon n="hourglass" size={14} /> Turnos{init.on && <span className="chip gold" style={{ marginLeft: 2 }}>{init.round}</span>}</button>
        <button className={"tab " + (tab === "dice" ? "on" : "")} onClick={() => setTab("dice")}><Icon n="d20" size={14} /> Dados</button>
        <button className={"tab " + (tab === "diary" ? "on" : "")} onClick={() => setTab("diary")}><Icon n="quill" size={14} /> Diário</button>
      </div>
      <div className="panel-body" style={tab === "map" ? { display: "flex", flexDirection: "column" } : undefined}>
        {tab === "map" && <MapTab />}
        {tab === "init" && <InitTab />}
        {tab === "dice" && <DiceTab />}
        {tab === "diary" && <DiaryTab />}
      </div>
    </aside>
  )
}

/* ───────────────────────── Mapa ───────────────────────── */

function MapTab() {
  const R = useRoom()
  const map: MapState = { ...EMPTY_MAP, ...(R.room.map ?? {}) }
  const [zoom, setZoom] = useState(1)
  const [tool, setTool] = useState<"move" | "reveal" | "cover">("move")
  const [drag, setDrag] = useState<{ id: string; x: number; y: number } | null>(null)
  const [fogLocal, setFogLocal] = useState<string | null>(null)
  const [cfg, setCfg] = useState(false)
  const [pending, setPending] = useState<Record<string, { x: number; y: number }>>({})
  const painting = useRef(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const CELL = 34 * zoom
  const cells = map.cols * map.rows
  const fog = (fogLocal ?? map.fog).padEnd(cells, "1").slice(0, cells)
  const curInit = R.room.init?.on ? R.room.init.order[R.room.init.turn] : null

  useEffect(() => setPending({}), [R.room.map])

  const cellAt = (e: React.PointerEvent) => {
    const rect = gridRef.current!.getBoundingClientRect()
    return { cx: Math.floor((e.clientX - rect.left) / CELL), cy: Math.floor((e.clientY - rect.top) / CELL) }
  }
  const paint = (e: React.PointerEvent) => {
    const { cx, cy } = cellAt(e)
    if (cx < 0 || cy < 0 || cx >= map.cols || cy >= map.rows) return
    const arr = (fogLocal ?? fog).split("")
    const v = tool === "cover" ? "1" : "0"
    let changed = false
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = cx + dx, y = cy + dy
      if (x < 0 || y < 0 || x >= map.cols || y >= map.rows) continue
      if (arr[y * map.cols + x] !== v) { arr[y * map.cols + x] = v; changed = true }
    }
    if (changed) setFogLocal(arr.join(""))
  }

  function onGridDown(e: React.PointerEvent) {
    if (!R.isGM || tool === "move" || !map.fogOn) return
    painting.current = true
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    paint(e)
  }
  function onGridMove(e: React.PointerEvent) {
    if (painting.current) paint(e)
    if (drag) { const rect = gridRef.current!.getBoundingClientRect(); setDrag({ ...drag, x: (e.clientX - rect.left) / CELL - 0.5, y: (e.clientY - rect.top) / CELL - 0.5 }) }
  }
  async function onGridUp() {
    if (painting.current) {
      painting.current = false
      if (fogLocal !== null) { await R.act("map.set", { fog: fogLocal }); setFogLocal(null) }
    }
    if (drag) {
      const x = Math.max(0, Math.min(map.cols - 1, Math.round(drag.x))), y = Math.max(0, Math.min(map.rows - 1, Math.round(drag.y)))
      setPending((p) => ({ ...p, [drag.id]: { x, y } }))
      setDrag(null)
      R.act("token.move", { id: drag.id, x, y })
    }
  }

  const canMove = (t: Token) => R.isGM || (!!t.sheet_id && R.sheets.find((s) => s.id === t.sheet_id)?.owner_member === R.me.id)
  const tokens = Object.values(map.tokens ?? {}).filter((t) => R.isGM || !t.hidden)
  const visibleFor = (t: Token) => R.isGM || !map.fogOn || fog[Math.round(t.y) * map.cols + Math.round(t.x)] !== "1" || canMove(t)

  return (
    <>
      <div className="maptools">
        {R.isGM && (
          <>
            <button className={"iconbtn " + (tool === "move" ? "on" : "")} title="Mover peças" onClick={() => setTool("move")}><Icon n="move" size={16} /></button>
            <button className={"iconbtn " + (map.fogOn ? "on" : "")} title={map.fogOn ? "Desligar névoa de guerra" : "Ligar névoa de guerra"} onClick={() => R.act("map.set", { fogOn: !map.fogOn, fog: map.fog || "1".repeat(cells) })}><Icon n="cloud" size={16} /></button>
            {map.fogOn && <>
              <button className={"iconbtn " + (tool === "reveal" ? "on" : "")} title="Pincel: revelar" onClick={() => setTool("reveal")}><Icon n="eye" size={16} /></button>
              <button className={"iconbtn " + (tool === "cover" ? "on" : "")} title="Pincel: cobrir" onClick={() => setTool("cover")}><Icon n="brush" size={16} /></button>
              <button className="btn ghost sm" onClick={() => R.act("map.set", { fog: "0".repeat(cells) })}>Revelar tudo</button>
              <button className="btn ghost sm" onClick={() => R.act("map.set", { fog: "1".repeat(cells) })}>Cobrir</button>
            </>}
            <button className="iconbtn" title="Nova peça" onClick={() => R.act("token.put", { label: "?", x: 0, y: 0, color: "#b9a27a" })}><Icon n="plus" size={16} /></button>
            <button className="iconbtn" title="Configurar mapa" onClick={() => setCfg(true)}><Icon n="gear" size={16} /></button>
          </>
        )}
        <span className="grow" />
        <button className="iconbtn sm" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)))} title="Afastar"><Icon n="minus" size={13} /></button>
        <span className="faint mono" style={{ fontSize: ".75rem" }}>{Math.round(zoom * 100)}%</span>
        <button className="iconbtn sm" onClick={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))} title="Aproximar"><Icon n="plus" size={13} /></button>
      </div>
      <div className="mapwrap grow">
        <div ref={gridRef} className="mapgrid" onPointerDown={onGridDown} onPointerMove={onGridMove} onPointerUp={onGridUp} onPointerLeave={onGridUp}
          style={{ width: map.cols * CELL, height: map.rows * CELL, backgroundImage: map.image ? `url("${map.image}")` : undefined, background: map.image ? undefined : "var(--map-empty, radial-gradient(circle at 40% 40%, #2c2015, #120c07))", cursor: R.isGM && tool !== "move" && map.fogOn ? "crosshair" : "default" }}>
          <div className="gridlines" style={{ backgroundSize: `${CELL}px ${CELL}px` }} />
          {tokens.filter(visibleFor).map((t) => {
            const sheet = t.sheet_id ? R.sheets.find((s) => s.id === t.sheet_id) : undefined
            const hp = hpOf(sheet, sheet ? R.tpl(sheet.template_id) : undefined)
            const pos = drag?.id === t.id ? drag : pending[t.id] ?? t
            const size = (t.size ?? 1) * CELL - 6
            return (
              <div key={t.id} className={"token " + (drag?.id === t.id ? "drag " : "") + (t.hidden ? "hid " : "") + (curInit && sheet && curInit.sheet_id === sheet.id ? "turn" : "")}
                style={{ left: pos.x * CELL + 3, top: pos.y * CELL + 3, width: size, height: size, background: t.color, cursor: canMove(t) ? undefined : "default" }}
                title={sheet?.name ?? t.label}
                onPointerDown={(e) => { if (!canMove(t) || (R.isGM && tool !== "move" && map.fogOn)) return; e.stopPropagation(); gridRef.current?.setPointerCapture?.(e.pointerId); setDrag({ id: t.id, x: t.x, y: t.y }) }}
                onDoubleClick={() => sheet && R.focus.setSheet(sheet.id)}
                onContextMenu={(e) => { if (!R.isGM) return; e.preventDefault(); setCfg(false); setEditTok(t) }}>
                {sheet?.avatar ? <img src={sheet.avatar} alt="" /> : <span>{initials(sheet?.name ?? t.label)}</span>}
                {hp && <span className="hp"><i style={{ width: hp.pct + "%" }} /></span>}
                <span className="nm">{sheet?.name ?? t.label}</span>
              </div>
            )
          })}
          {map.fogOn && Array.from({ length: cells }, (_, i) => fog[i] === "1" ? (
            <div key={i} className="fogcell" style={{ left: (i % map.cols) * CELL, top: Math.floor(i / map.cols) * CELL, width: CELL + 0.5, height: CELL + 0.5, pointerEvents: "none" }} />
          ) : null)}
        </div>
      </div>
      <p className="faint" style={{ fontSize: ".78rem", margin: ".4rem 0 0" }}>
        {R.isGM ? "Arraste as peças · duplo clique abre a ficha · botão direito edita a peça." : "Arraste a sua peça · duplo clique abre a ficha."}
      </p>
      {cfg && <MapConfig map={map} onClose={() => setCfg(false)} />}
      <TokenEditorHost />
    </>
  )
}

// Editor de peça acessível pelo botão direito (estado global simples)
let setEditTok: (t: Token | null) => void = () => {}
function TokenEditorHost() {
  const R = useRoom()
  const [t, setT] = useState<Token | null>(null)
  setEditTok = setT
  if (!t) return null
  return <TokenEditor key={t.id} t={t} onClose={() => setT(null)} sheets={R.sheets} />
}

function TokenEditor({ t, onClose, sheets }: { t: Token; onClose: () => void; sheets: any[] }) {
  const R = useRoom()
  const [tok, setTok] = useState(t)
  return (
    <Modal title="Peça do mapa" icon="pin" onClose={onClose}>
      <div className="row">
        <div className="grow"><label className="lbl">Rótulo</label><input className="field" value={tok.label} onChange={(e) => setTok({ ...tok, label: e.target.value })} /></div>
        <div><label className="lbl">Cor</label><input type="color" value={tok.color} onChange={(e) => setTok({ ...tok, color: e.target.value })} style={{ width: 48, height: 38, background: "none", border: 0 }} /></div>
        <div><label className="lbl">Tamanho</label><select className="field" value={tok.size ?? 1} onChange={(e) => setTok({ ...tok, size: Number(e.target.value) })}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}×{n}</option>)}</select></div>
      </div>
      <label className="lbl">Ligada à ficha</label>
      <select className="field" value={tok.sheet_id ?? ""} onChange={(e) => setTok({ ...tok, sheet_id: e.target.value || null })}>
        <option value="">— nenhuma —</option>
        {sheets.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      <label className="row" style={{ marginTop: ".7rem", cursor: "pointer" }}><input type="checkbox" checked={!!tok.hidden} onChange={(e) => setTok({ ...tok, hidden: e.target.checked })} /> Oculta dos jogadores</label>
      <div className="row" style={{ marginTop: "1rem" }}>
        <button className="btn" onClick={async () => { await R.act("token.put", tok); onClose() }}><Icon n="check" size={14} /> Salvar</button>
        <span className="grow" />
        <button className="btn red sm" onClick={async () => { await R.act("token.del", { id: t.id }); onClose() }}><Icon n="trash" size={12} /> Remover</button>
      </div>
    </Modal>
  )
}

function MapConfig({ map, onClose }: { map: MapState; onClose: () => void }) {
  const R = useRoom()
  const [image, setImage] = useState(map.image)
  const [cols, setCols] = useState(map.cols)
  const [rows, setRows] = useState(map.rows)
  return (
    <Modal title="Mapa" icon="map" onClose={onClose}>
      <label className="lbl">Imagem de fundo (link https)</label>
      <input className="field" value={image} onChange={(e) => setImage(e.target.value)} placeholder="https://…/masmorra.jpg" />
      <p className="faint" style={{ fontSize: ".82rem", margin: ".3rem 0 0" }}>Use um link público de imagem (Imgur, Discord, Drive público…). Nada é enviado ao servidor: assim o orçamento continua zero.</p>
      <div className="row">
        <div className="grow"><label className="lbl">Colunas</label><input className="field" type="number" min={4} max={60} value={cols} onChange={(e) => setCols(Number(e.target.value))} /></div>
        <div className="grow"><label className="lbl">Linhas</label><input className="field" type="number" min={4} max={60} value={rows} onChange={(e) => setRows(Number(e.target.value))} /></div>
      </div>
      <div className="row" style={{ marginTop: "1rem" }}>
        <button className="btn" onClick={async () => {
          const resized = cols !== map.cols || rows !== map.rows
          await R.act("map.set", { image, cols, rows, ...(resized ? { fog: "1".repeat(cols * rows) } : {}) })
          onClose()
        }}><Icon n="check" size={14} /> Salvar</button>
      </div>
    </Modal>
  )
}

/* ───────────────────────── Iniciativa ───────────────────────── */

function InitTab() {
  const R = useRoom()
  const init: InitState = { ...EMPTY_INIT, ...(R.room.init ?? {}) }
  const [addId, setAddId] = useState("")
  const [cond, setCond] = useState<{ tag: string; name: string } | null>(null)
  const cur = init.on ? init.order[init.turn] : null
  const save = (next: Partial<InitState>) => R.act("init.set", { init: { ...init, ...next } })
  const myTurn = !!cur && (cur.id === "m:" + R.me.id || (!!cur.sheet_id && R.sheets.find((s) => s.id === cur.sheet_id)?.owner_member === R.me.id))
  const available = R.sheets.filter((s) => !init.order.some((e) => e.sheet_id === s.id))

  return (
    <>
      <div className="row" style={{ marginBottom: ".4rem" }}>
        <div className="grow">
          <div className="faint" style={{ fontSize: ".7rem", fontFamily: "var(--f-title)", letterSpacing: ".1em" }}>RODADA</div>
          <div className="round">{init.on ? init.round : "—"}</div>
        </div>
        {R.isGM ? (
          <div className="col" style={{ gap: ".3rem", alignItems: "flex-end" }}>
            {!init.on
              ? <button className="btn sm" disabled={!init.order.length} onClick={() => R.chat("/init iniciar")}><Icon n="sword" size={13} /> Iniciar combate</button>
              : <button className="btn sm" onClick={() => R.act("init.next")}><Icon n="hourglass" size={13} /> Próximo turno</button>}
            {init.order.length > 0 && <button className="btn ghost sm" onClick={() => R.chat("/init fim")}>Encerrar</button>}
          </div>
        ) : myTurn && <button className="btn sm" onClick={() => R.act("init.next")}><Icon n="check" size={13} /> Terminei meu turno</button>}
      </div>
      {cur && <div className="chip gold" style={{ marginBottom: ".5rem" }}><Icon n="sword" size={11} /> Vez de {cur.name}</div>}

      {init.order.length === 0 && <div className="empty">Ninguém na iniciativa. Use <code className="mono">/init 1d20+DES</code> ou o botão na ficha.</div>}
      <div className="init-list">
        {init.order.map((e, i) => {
          const s = e.sheet_id ? R.sheets.find((x) => x.id === e.sheet_id) : undefined
          const hp = hpOf(s, s ? R.tpl(s.template_id) : undefined)
          const conds = (s?.data?._conds ?? []) as { n: string; r: number | null }[]
          const tag = (s?.name ?? e.name).replace(/\s+/g, "")
          return (
            <div key={e.id} className={"init-item " + (init.on && i === init.turn ? "cur" : "")}>
              <div className="init-val">
                {R.isGM ? <input key={e.init} defaultValue={e.init} onBlur={(ev) => { const v = Number(ev.target.value); if (v !== e.init) save({ order: init.order.map((x) => (x.id === e.id ? { ...x, init: v } : x)).sort((a, b) => b.init - a.init) }) }} />
                  : e.init}
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: ".3rem" }}>
                  <b style={{ fontFamily: "var(--f-title)", fontSize: ".88rem", cursor: s ? "pointer" : undefined }} onClick={() => s && R.focus.setSheet(s.id)}>{e.name}</b>
                  {s?.hidden && <Icon n="eyeoff" size={12} />}
                </div>
                {hp && <div className="mini-bar"><i style={{ width: hp.pct + "%" }} /></div>}
                {conds.length > 0 && <div className="conds" style={{ marginTop: 3 }}>{conds.map((c) => <span key={c.n} className="chip violet">{c.n}{c.r !== null ? ` ${c.r}r` : ""}</span>)}</div>}
              </div>
              {R.isGM && (
                <div className="row" style={{ gap: 0 }}>
                  {s && <button className="iconbtn sm" title="Adicionar condição" onClick={() => setCond({ tag, name: "" })}><Icon n="flame" size={13} /></button>}
                  <button className="iconbtn sm" title="Tirar da iniciativa" onClick={() => {
                    const order = init.order.filter((x) => x.id !== e.id)
                    save({ order, turn: Math.min(init.turn > i ? init.turn - 1 : init.turn, Math.max(0, order.length - 1)), on: init.on && order.length > 0 })
                  }}><Icon n="x" size={13} /></button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {R.isGM && available.length > 0 && (
        <div className="row" style={{ marginTop: ".7rem" }}>
          <select className="field grow" value={addId} onChange={(e) => setAddId(e.target.value)}>
            <option value="">Adicionar ficha…</option>
            {available.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn sm" disabled={!addId} onClick={() => { const s = R.sheets.find((x) => x.id === addId)!; const t = R.tpl(s.template_id); R.chat(`/init 1d20${t?.fields.some((f) => f.key === "des") ? "+DES" : ""} @${s.name.replace(/\s+/g, "")}`); setAddId("") }}><Icon n="d20" size={13} /> Rolar</button>
        </div>
      )}
      {cond && (
        <Modal title={`Condição em ${cond.tag}`} icon="flame" onClose={() => setCond(null)}>
          <div className="row wrap" style={{ gap: ".3rem" }}>
            {["Envenenado", "Atordoado", "Caído", "Cego", "Amedrontado", "Sangrando", "Invisível", "Abençoado", "Inspirado", "Agarrado"].map((n) => (
              <button key={n} className="btn ghost sm" onClick={() => setCond({ ...cond, name: n })}>{n}</button>
            ))}
          </div>
          <CondForm initial={cond.name} onSave={async (n, r) => { await R.chat(`/cond @${cond.tag} ${n}${r ? " " + r : ""}`); setCond(null) }} />
        </Modal>
      )}
    </>
  )
}

function CondForm({ initial, onSave }: { initial: string; onSave: (n: string, r: number | null) => void }) {
  const [n, setN] = useState(initial)
  const [r, setR] = useState("")
  useEffect(() => setN(initial), [initial])
  return (
    <div className="row" style={{ marginTop: ".8rem" }}>
      <input className="field grow" placeholder="Nome da condição" value={n} onChange={(e) => setN(e.target.value)} />
      <input className="field" style={{ width: 90 }} type="number" min={1} placeholder="rodadas" value={r} onChange={(e) => setR(e.target.value)} />
      <button className="btn" disabled={!n.trim()} onClick={() => onSave(n.trim(), r ? Number(r) : null)}><Icon n="check" size={14} /></button>
    </div>
  )
}

/* ───────────────────────── Dados (estatísticas) ───────────────────────── */

function DiceTab() {
  const R = useRoom()
  const [who, setWho] = useState("")
  const rolls = R.messages.filter((m) => m.kind === "roll" && m.data?.r && (!who || m.speaker === who))
  const speakers = [...new Set(R.messages.filter((m) => m.kind === "roll").map((m) => m.speaker))]
  const stats = useMemo(() => {
    const d20: number[] = []
    let crit = 0, fumble = 0
    for (const m of rolls) {
      for (const p of m.data.r.parts) if (p.t === "d" && p.sides === 20) for (const d of p.rolls) if (d.keep) d20.push(d.v)
      if (m.data.r.crit) crit++
      if (m.data.r.fumble) fumble++
    }
    const hist = Array.from({ length: 20 }, (_, i) => d20.filter((v) => v === i + 1).length)
    const avg = d20.length ? d20.reduce((a, b) => a + b, 0) / d20.length : 0
    return { n: rolls.length, d20n: d20.length, avg, crit, fumble, hist, max: Math.max(1, ...hist) }
  }, [rolls])
  return (
    <>
      <select className="field" value={who} onChange={(e) => setWho(e.target.value)} style={{ marginBottom: ".6rem" }}>
        <option value="">Toda a mesa</option>
        {speakers.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
      <div className="stat-grid">
        <div className="stat"><b>{stats.n}</b><small>rolagens</small></div>
        <div className="stat"><b>{stats.avg ? stats.avg.toFixed(1) : "—"}</b><small>média no d20</small></div>
        <div className="stat"><b style={{ color: "var(--gold-hi)" }}>{stats.crit}</b><small>críticos</small></div>
        <div className="stat"><b style={{ color: "var(--blood-hi)" }}>{stats.fumble}</b><small>falhas críticas</small></div>
      </div>
      <div className="sec-title">Distribuição do d20 ({stats.d20n})</div>
      <div className="histo" title="Quantas vezes cada face do d20 saiu">
        {stats.hist.map((v, i) => <i key={i} style={{ height: `${(v / stats.max) * 100}%`, opacity: i === 0 || i === 19 ? 1 : 0.75 }} title={`${i + 1}: ${v}x`} />)}
      </div>
      <div className="row faint mono" style={{ justifyContent: "space-between", fontSize: ".65rem" }}><span>1</span><span>10</span><span>20</span></div>
      <div className="sec-title">Últimas rolagens</div>
      <div className="col" style={{ gap: ".25rem" }}>
        {rolls.slice(-14).reverse().map((m) => (
          <div key={m.seq} className="row" style={{ fontSize: ".88rem", borderBottom: "1px solid var(--line-soft)", paddingBottom: ".2rem" }}>
            <span className="faint mono" style={{ fontSize: ".7rem" }}>{hhmm(m.created_at)}</span>
            <span className="grow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b>{m.speaker}</b> <span className="muted">{m.body || m.data.r.expr}</span></span>
            {m.secret && <Icon n="eyeoff" size={12} />}
            <b style={{ fontFamily: "var(--f-title)", color: m.data.r.crit ? "var(--gold-hi)" : m.data.r.fumble ? "var(--blood-hi)" : undefined }}>{m.data.r.total}</b>
          </div>
        ))}
        {rolls.length === 0 && <div className="empty">Os dados ainda não rolaram.</div>}
      </div>
    </>
  )
}

/* ───────────────────────── Diário ───────────────────────── */

function DiaryTab() {
  const R = useRoom()
  const [edit, setEdit] = useState<Partial<Note> | null>(null)
  const list = R.notes.filter((n) => n.kind === "diary").slice().reverse()
  return (
    <>
      <div className="sec-title" style={{ marginTop: ".2rem" }}>Diário da campanha <button className="iconbtn sm" title="Nova entrada" onClick={() => setEdit({ kind: "diary", title: "", body: "", hidden: false })}><Icon n="plus" size={14} /></button></div>
      {list.length === 0 && <div className="empty">Ninguém escreveu ainda. O que aconteceu hoje?</div>}
      {list.map((n) => {
        const a = n.author_member ? R.memberById(n.author_member) : null
        const mine = n.author_member === R.me.id
        return (
          <div key={n.id} className="parch note rise">
            <h4>{n.title} {n.hidden && <Icon n="eyeoff" size={13} />}<span className="grow" />
              {(mine || R.isGM) && <button className="iconbtn sm" style={{ color: "#6b4a22" }} onClick={() => setEdit(n)}><Icon n="quill" size={13} /></button>}
            </h4>
            <div style={{ fontSize: ".75rem", color: "#6b4a22" }}>{a?.name ?? "?"} · {new Date(n.created_at).toLocaleDateString("pt-BR")}</div>
            {n.body && <div className="txt">{n.body}</div>}
          </div>
        )
      })}
      {edit && <NoteEditor n={edit} onClose={() => setEdit(null)} />}
    </>
  )
}
