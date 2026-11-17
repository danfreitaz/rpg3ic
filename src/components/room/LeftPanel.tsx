"use client"
import { useEffect, useState } from "react"
import { Icon } from "@/components/Icon"
import type { Field, Note, Sheet, Template } from "@/lib/types"
import { barClass, hpOf, useRoom } from "./ctx"
import { Modal } from "./Table"

type Tab = "sheets" | "gm" | "world" | "help"

export function LeftPanel() {
  const R = useRoom()
  const [tab, setTab] = useState<Tab>("sheets")
  useEffect(() => { if (R.focus.sheet) setTab(R.isGM ? (R.sheets.find((s) => s.id === R.focus.sheet)?.kind === "pc" ? "sheets" : "gm") : "sheets") }, [R.focus.sheet])
  useEffect(() => { if (!R.isGM && tab === "gm") setTab("sheets") }, [R.isGM, tab])
  return (
    <aside className="frame panel">
      <div className="tabs">
        <button className={"tab " + (tab === "sheets" ? "on" : "")} onClick={() => setTab("sheets")}><Icon n="scroll" size={14} /> Fichas</button>
        {R.isGM && <button className={"tab " + (tab === "gm" ? "on" : "")} onClick={() => setTab("gm")}><Icon n="crown" size={14} /> Mestre</button>}
        <button className={"tab " + (tab === "world" ? "on" : "")} onClick={() => setTab("world")}><Icon n="book" size={14} /> Mundo</button>
        <button className={"tab " + (tab === "help" ? "on" : "")} onClick={() => setTab("help")} title="Comandos"><Icon n="help" size={14} /></button>
      </div>
      <div className="panel-body">
        {tab === "sheets" && <SheetsTab kinds={["pc"]} />}
        {tab === "gm" && <GMTab />}
        {tab === "world" && <WorldTab />}
        {tab === "help" && <HelpTab />}
      </div>
    </aside>
  )
}

/* ───────────────────────── Fichas ───────────────────────── */

function SheetsTab({ kinds }: { kinds: Sheet["kind"][] }) {
  const R = useRoom()
  const list = R.sheets.filter((s) => kinds.includes(s.kind))
  const [sel, setSel] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  useEffect(() => { if (R.focus.sheet && list.some((s) => s.id === R.focus.sheet)) setSel(R.focus.sheet) }, [R.focus.sheet])
  const current = list.find((s) => s.id === sel) ?? list.find((s) => s.id === R.me.sheet_id) ?? null
  const tpls = R.room.templates.filter((t) => kinds.includes(t.kind))
  const mine = list.filter((s) => s.owner_member === R.me.id)

  return (
    <>
      <div className="sec-title" style={{ marginTop: ".2rem" }}>
        {kinds.includes("pc") ? "Personagens" : "NPCs e criaturas"}
        <button className="iconbtn sm" title="Nova ficha" onClick={() => setCreating(true)}><Icon n="plus" size={14} /></button>
      </div>
      {list.length === 0 && <div className="empty">{kinds.includes("pc") ? "Nenhum herói ainda. Crie o seu!" : "Nenhum NPC ou criatura. O mundo está vazio demais…"}</div>}
      {kinds.includes("pc") && mine.length === 0 && list.length > 0 && <p className="faint" style={{ fontSize: ".85rem", margin: "0 0 .4rem" }}>Você ainda não tem personagem: clique no + para criar.</p>}
      <div className="sheet-list">
        {list.map((s) => {
          const hp = hpOf(s, R.tpl(s.template_id))
          const owner = s.owner_member ? R.memberById(s.owner_member) : null
          return (
            <div key={s.id} className={"sheet-item " + (current?.id === s.id ? "on" : "")} onClick={() => setSel(s.id)}>
              {s.avatar ? <img className="avatar" src={s.avatar} alt="" /> : <span className="dot lg" style={{ background: owner?.color ?? "#8a7a5c" }}>{s.name[0]}</span>}
              <div className="grow">
                <div className="row" style={{ gap: ".3rem" }}>
                  <span className="nm">{s.name}</span>
                  {s.id === R.me.sheet_id && <Icon n="star" size={12} className="" />}
                  {s.hidden && <Icon n="eyeoff" size={12} />}
                </div>
                <div className="faint" style={{ fontSize: ".75rem" }}>{owner ? owner.name : s.kind === "pc" ? "sem dono" : R.tpl(s.template_id)?.name}</div>
                {hp && <div className="mini-bar"><i style={{ width: hp.pct + "%" }} /></div>}
              </div>
              {(s.data?._conds ?? []).length > 0 && <span className="chip violet">{s.data._conds.length}</span>}
            </div>
          )
        })}
      </div>
      {current && <SheetView key={current.id} s={current} />}
      {creating && <CreateSheet tpls={tpls} onClose={() => setCreating(false)} onMade={(id) => setSel(id)} />}
    </>
  )
}

function CreateSheet({ tpls, onClose, onMade }: { tpls: Template[]; onClose: () => void; onMade: (id: string) => void }) {
  const R = useRoom()
  const [name, setName] = useState("")
  const [tid, setTid] = useState(tpls[0]?.id ?? "")
  const [mine, setMine] = useState(true)
  const t = tpls.find((x) => x.id === tid)
  return (
    <Modal title="Nova ficha" icon="quill" onClose={onClose}>
      {tpls.length === 0 ? <p className="muted">Não há modelos desse tipo. O mestre pode criar um na aba Mestre.</p> : (
        <>
          <label className="lbl">Nome</label>
          <input className="field" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t?.kind === "creature" ? "Ex.: Lobo das Brumas" : t?.kind === "npc" ? "Ex.: Mestre Ferreiro Odo" : "Ex.: Lyra Valcorvo"} />
          <label className="lbl">Modelo de ficha</label>
          <select className="field" value={tid} onChange={(e) => setTid(e.target.value)}>
            {tpls.map((x) => <option key={x.id} value={x.id}>{x.name} · {x.fields.length} campos</option>)}
          </select>
          {R.isGM && t?.kind === "pc" && (
            <label className="row" style={{ marginTop: ".7rem", cursor: "pointer" }}><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} /> Esta ficha é minha (desmarque para entregar a um jogador depois)</label>
          )}
          <div className="row" style={{ marginTop: "1rem" }}>
            <button className="btn" onClick={async () => { const d = await R.act("sheet.create", { name, template_id: tid, mine }); if (d) { onMade(d.id); onClose() } }}><Icon n="check" size={14} /> Criar</button>
          </div>
        </>
      )}
    </Modal>
  )
}

export function SheetView({ s }: { s: Sheet }) {
  const R = useRoom()
  const t = R.tpl(s.template_id)
  const edit = R.canEdit(s)
  const [local, setLocal] = useState<Record<string, any>>(s.data)
  const [nm, setNm] = useState(s.name)
  const [fx, setFx] = useState<Record<string, { d: number; k: number }>>({})
  useEffect(() => {
    // Números flutuando quando algo muda por fora (ex.: /pv @você -5)
    const next: typeof fx = {}
    for (const f of t?.fields ?? []) if (f.type === "bar" && Number(local[f.key]) !== Number(s.data[f.key]) && local[f.key] !== undefined) next[f.key] = { d: Number(s.data[f.key]) - Number(local[f.key]), k: Date.now() }
    if (Object.keys(next).length) setFx((x) => ({ ...x, ...next }))
    setLocal(s.data)
  }, [s.data])
  useEffect(() => setNm(s.name), [s.name])
  if (!t) return <div className="empty">O modelo desta ficha foi apagado.</div>

  const save = (patch: Record<string, any>) => { setLocal((l) => ({ ...l, ...patch })); R.act("sheet.update", { id: s.id, data: patch }) }
  const bars = t.fields.filter((f) => f.type === "bar")
  const nums = t.fields.filter((f) => f.type === "num")
  const texts = t.fields.filter((f) => f.type === "text" || f.type === "long")
  const tag = s.name.replace(/\s+/g, "")
  const conds = (s.data?._conds ?? []) as { n: string; r: number | null }[]
  const onMap = Object.values(R.room.map?.tokens ?? {}).some((k) => k.sheet_id === s.id)
  const inInit = (R.room.init?.order ?? []).some((e) => e.sheet_id === s.id)

  return (
    <div className="parch sheet rise">
      <div className="sheet-head">
        {s.avatar ? <img className="avatar" src={s.avatar} alt="" /> : <div className="ph"><Icon n="user" size={24} /></div>}
        <div className="grow">
          {edit ? <input className="field" style={{ font: "700 1.1rem var(--f-title)", padding: ".2em .4em" }} value={nm} onChange={(e) => setNm(e.target.value)} onBlur={() => nm !== s.name && R.act("sheet.update", { id: s.id, name: nm })} /> : <h3>{s.name}</h3>}
          <div style={{ fontSize: ".8rem", color: "#6b4a22" }}>{t.name}{s.owner_member ? ` · de ${R.memberById(s.owner_member)?.name ?? "?"}` : ""}</div>
        </div>
      </div>

      {conds.length > 0 && (
        <div className="conds" style={{ marginTop: ".5rem" }}>
          {conds.map((c) => (
            <span key={c.n} className="chip violet" style={{ color: "#4a2a6b", background: "rgba(155,116,201,.2)" }}>
              {c.n}{c.r !== null ? ` · ${c.r}r` : ""}
              {edit && <button onClick={() => R.chat(`/cond @${tag} -${c.n}`)} title="Remover"><Icon n="x" size={10} /></button>}
            </span>
          ))}
        </div>
      )}

      <div className="col" style={{ marginTop: ".6rem", gap: ".45rem" }}>
        {bars.map((f) => {
          const v = Number(local[f.key] ?? 0), m = Number(local[f.key + "_max"] ?? 0)
          return (
            <div key={f.key}>
              <label className="lbl" style={{ margin: "0 0 .2rem" }}>{f.label}</label>
              <div className="row" style={{ gap: ".3rem", position: "relative" }}>
                <div className={"bar grow " + barClass(f.key)}>
                  <i style={{ width: (m > 0 ? Math.max(0, Math.min(100, (v / m) * 100)) : 0) + "%" }} />
                  <span>{v} / {m}</span>
                </div>
                {fx[f.key] && <span key={fx[f.key].k} className="floatnum" style={{ color: fx[f.key].d < 0 ? "#ff8a73" : "#9ff0b0" }}>{fx[f.key].d > 0 ? "+" : ""}{fx[f.key].d}</span>}
                {edit && (
                  <div className="pm-btns">
                    <button title="−1" onClick={() => R.chat(`/${f.key} @${tag} -1`)}><Icon n="minus" size={12} /></button>
                    <button title="+1" onClick={() => R.chat(`/${f.key} @${tag} +1`)}><Icon n="plus" size={12} /></button>
                    <input className="field" style={{ width: 52, padding: ".1em .3em", fontSize: ".8rem" }} type="number" value={m} title="Máximo"
                      onChange={(e) => setLocal((l) => ({ ...l, [f.key + "_max"]: Number(e.target.value) }))} onBlur={(e) => save({ [f.key + "_max"]: Number(e.target.value) })} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {nums.length > 0 && (
        <div className="attrs" style={{ marginTop: ".7rem" }}>
          {nums.map((f) => (
            <div key={f.key} className="attr" title={`Clique no dado para rolar 1d20+${f.key.toUpperCase()}`}>
              <small>{f.label}</small>
              <input type="number" value={local[f.key] ?? 0} readOnly={!edit}
                onChange={(e) => setLocal((l) => ({ ...l, [f.key]: Number(e.target.value) }))} onBlur={(e) => edit && Number(e.target.value) !== Number(s.data[f.key]) && save({ [f.key]: Number(e.target.value) })} />
              <button className="roll" onClick={() => R.chat(`/r 1d20+${f.key.toUpperCase()} @${tag} #${f.label}`)} title="Rolar"><Icon n="d20" size={13} /></button>
            </div>
          ))}
        </div>
      )}

      {texts.map((f) => (
        <div key={f.key}>
          <label className="lbl">{f.label}</label>
          {f.type === "long"
            ? <textarea className="field" readOnly={!edit} rows={3} value={local[f.key] ?? ""} onChange={(e) => setLocal((l) => ({ ...l, [f.key]: e.target.value }))} onBlur={(e) => edit && e.target.value !== s.data[f.key] && save({ [f.key]: e.target.value })} />
            : <input className="field" readOnly={!edit} value={local[f.key] ?? ""} onChange={(e) => setLocal((l) => ({ ...l, [f.key]: e.target.value }))} onBlur={(e) => edit && e.target.value !== s.data[f.key] && save({ [f.key]: e.target.value })} />}
        </div>
      ))}

      {edit && (
        <>
          <label className="lbl">Retrato (link https de imagem)</label>
          <input className="field" defaultValue={s.avatar} placeholder="https://…" onBlur={(e) => e.target.value !== s.avatar && R.act("sheet.update", { id: s.id, avatar: e.target.value })} />
        </>
      )}

      <div className="row wrap" style={{ marginTop: ".8rem", gap: ".35rem" }}>
        {edit && s.id !== R.me.sheet_id && <button className="btn sm" onClick={() => R.act("sheet.use", { id: s.id })}><Icon n="star" size={12} /> Usar esta ficha</button>}
        {s.id === R.me.sheet_id && <button className="btn ghost sm" style={{ color: "#3b220f" }} onClick={() => R.act("sheet.use", { id: null })}>Deixar de usar</button>}
        {R.isGM && !onMap && <button className="btn ghost sm" style={{ color: "#3b220f" }} onClick={() => R.act("token.put", { label: s.name.slice(0, 2), sheet_id: s.id, x: 1, y: 1, color: R.memberById(s.owner_member ?? "")?.color ?? (s.kind === "creature" ? "#a3362a" : "#b9a27a"), hidden: s.hidden })}><Icon n="pin" size={12} /> No mapa</button>}
        {edit && !inInit && <button className="btn ghost sm" style={{ color: "#3b220f" }} onClick={() => R.chat(`/init 1d20${nums.some((f) => f.key === "des") ? "+DES" : ""} @${tag}`)}><Icon n="hourglass" size={12} /> Iniciativa</button>}
        {R.isGM && <button className="btn ghost sm" style={{ color: "#3b220f" }} onClick={() => R.act("sheet.update", { id: s.id, hidden: !s.hidden })}><Icon n={s.hidden ? "eye" : "eyeoff"} size={12} /> {s.hidden ? "Revelar" : "Ocultar"}</button>}
        {R.isGM && s.kind === "pc" && (
          <select className="field" style={{ width: "auto", fontSize: ".78rem", padding: ".25em 2em .25em .5em" }} value={s.owner_member ?? ""} onChange={(e) => R.act("sheet.update", { id: s.id, owner_member: e.target.value || null })} title="Dono da ficha">
            <option value="">sem dono</option>
            {R.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        )}
        <span className="grow" />
        {edit && <button className="iconbtn sm" style={{ color: "#8f2b1f" }} title="Apagar ficha" onClick={() => confirm(`Apagar a ficha de ${s.name}? Isso não tem volta.`) && R.act("sheet.delete", { id: s.id })}><Icon n="trash" size={14} /></button>}
      </div>
    </div>
  )
}

/* ───────────────────────── Mestre ───────────────────────── */

function GMTab() {
  const [sub, setSub] = useState<"npc" | "tpl" | "lore">("npc")
  return (
    <>
      <div className="row" style={{ gap: ".25rem", marginBottom: ".3rem" }}>
        <button className={"btn sm " + (sub === "npc" ? "" : "ghost")} onClick={() => setSub("npc")}><Icon n="skull" size={12} /> NPCs</button>
        <button className={"btn sm " + (sub === "lore" ? "" : "ghost")} onClick={() => setSub("lore")}><Icon n="castle" size={12} /> História</button>
        <button className={"btn sm " + (sub === "tpl" ? "" : "ghost")} onClick={() => setSub("tpl")}><Icon n="quill" size={12} /> Modelos</button>
      </div>
      {sub === "npc" && <SheetsTab kinds={["npc", "creature"]} />}
      {sub === "lore" && <Lore editable />}
      {sub === "tpl" && <Templates />}
    </>
  )
}

function Templates() {
  const R = useRoom()
  const [edit, setEdit] = useState<Template | null>(null)
  return (
    <>
      <div className="sec-title">Modelos de ficha <button className="iconbtn sm" title="Novo modelo" onClick={() => setEdit({ id: "", name: "Novo modelo", kind: "pc", fields: [{ key: "pv", label: "Pontos de Vida", type: "bar", def: 10 }] })}><Icon n="plus" size={14} /></button></div>
      <p className="faint" style={{ fontSize: ".85rem", marginTop: 0 }}>A chave de cada campo vira comando e atributo de dado: <code className="mono">/pv</code>, <code className="mono">1d20+FOR</code>.</p>
      <div className="sheet-list">
        {R.room.templates.map((t) => (
          <div key={t.id} className="sheet-item" onClick={() => setEdit(t)}>
            <Icon n={t.kind === "creature" ? "skull" : t.kind === "npc" ? "users" : "scroll"} />
            <div className="grow"><div className="nm">{t.name}</div><div className="faint" style={{ fontSize: ".75rem" }}>{{ pc: "personagem", npc: "NPC", creature: "criatura" }[t.kind]} · {t.fields.length} campos</div></div>
          </div>
        ))}
      </div>
      {edit && <TemplateEditor t={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function TemplateEditor({ t, onClose }: { t: Template; onClose: () => void }) {
  const R = useRoom()
  const [tpl, setTpl] = useState<Template>(JSON.parse(JSON.stringify(t)))
  const setField = (i: number, p: Partial<Field>) => setTpl({ ...tpl, fields: tpl.fields.map((f, j) => (j === i ? { ...f, ...p } : f)) })
  const move = (i: number, d: number) => { const f = [...tpl.fields]; const [x] = f.splice(i, 1); f.splice(Math.max(0, Math.min(f.length, i + d)), 0, x); setTpl({ ...tpl, fields: f }) }
  return (
    <Modal title={t.id ? "Editar modelo" : "Novo modelo"} icon="quill" onClose={onClose}>
      <div className="row">
        <div className="grow"><label className="lbl">Nome</label><input className="field" value={tpl.name} onChange={(e) => setTpl({ ...tpl, name: e.target.value })} /></div>
        <div><label className="lbl">Para</label>
          <select className="field" value={tpl.kind} onChange={(e) => setTpl({ ...tpl, kind: e.target.value as Template["kind"] })}>
            <option value="pc">Personagens</option><option value="npc">NPCs</option><option value="creature">Criaturas</option>
          </select></div>
      </div>
      <div className="sec-title">Campos</div>
      <div className="tpl-field faint" style={{ fontSize: ".7rem", fontFamily: "var(--f-title)", letterSpacing: ".08em" }}><span>RÓTULO · CHAVE</span><span>TIPO</span><span>PADRÃO</span><span /></div>
      {tpl.fields.map((f, i) => (
        <div key={i} className="tpl-field">
          <div className="row" style={{ gap: ".25rem" }}>
            <input className="field" value={f.label} onChange={(e) => setField(i, { label: e.target.value })} placeholder="Rótulo" />
            <input className="field mono" style={{ width: 72, fontSize: ".75rem" }} value={f.key} onChange={(e) => setField(i, { key: e.target.value })} placeholder="chave" title="Chave curta: vira /comando e atributo" />
          </div>
          <select className="field" value={f.type} onChange={(e) => setField(i, { type: e.target.value as Field["type"] })}>
            <option value="bar">Barra (PV…)</option><option value="num">Número</option><option value="text">Texto</option><option value="long">Texto longo</option>
          </select>
          <input className="field" value={String(f.def ?? "")} onChange={(e) => setField(i, { def: e.target.value })} />
          <div className="col" style={{ gap: 0 }}>
            <button className="iconbtn sm" onClick={() => move(i, -1)} title="Subir">▲</button>
            <button className="iconbtn sm" onClick={() => setTpl({ ...tpl, fields: tpl.fields.filter((_, j) => j !== i) })} title="Remover"><Icon n="x" size={12} /></button>
          </div>
        </div>
      ))}
      <button className="btn ghost sm" onClick={() => setTpl({ ...tpl, fields: [...tpl.fields, { key: "", label: "", type: "num", def: 0 }] })}><Icon n="plus" size={12} /> Campo</button>
      <div className="row" style={{ marginTop: "1rem" }}>
        <button className="btn" onClick={async () => { if (await R.act("tpl.save", { tpl })) { R.toast("Modelo salvo.", true); onClose() } }}><Icon n="check" size={14} /> Salvar modelo</button>
        <span className="grow" />
        {t.id && <button className="btn red sm" onClick={async () => { if (confirm("Apagar este modelo?") && (await R.act("tpl.delete", { id: t.id }))) onClose() }}><Icon n="trash" size={12} /> Apagar</button>}
      </div>
      <p className="faint" style={{ fontSize: ".82rem" }}>Mudanças valem para fichas novas e existentes; campos novos começam vazios nas fichas antigas.</p>
    </Modal>
  )
}

/* ───────────────────────── Mundo: histórias e locais ───────────────────────── */

function WorldTab() {
  return <Lore editable={false} />
}

function Lore({ editable }: { editable: boolean }) {
  const R = useRoom()
  const [edit, setEdit] = useState<Partial<Note> | null>(null)
  const can = editable && R.isGM
  const groups: [Note["kind"], string, string][] = [["story", "Histórias e capítulos", "book"], ["place", "Localidades", "castle"]]
  return (
    <>
      {groups.map(([k, title, icon]) => {
        const list = R.notes.filter((n) => n.kind === k)
        return (
          <div key={k}>
            <div className="sec-title"><Icon n={icon} size={13} /> {title} {can && <button className="iconbtn sm" onClick={() => setEdit({ kind: k, title: "", body: "", hidden: true })}><Icon n="plus" size={14} /></button>}</div>
            {list.length === 0 && <div className="empty">{k === "story" ? "Nenhuma história revelada ainda." : "Nenhum lugar no mapa do mundo."}</div>}
            {list.map((n) => (
              <div key={n.id} className="parch note rise">
                <h4>{n.title} {n.hidden && <Icon n="eyeoff" size={13} />}<span className="grow" />
                  {R.isGM && <button className="iconbtn sm" style={{ color: "#6b4a22" }} onClick={() => setEdit(n)}><Icon n="quill" size={13} /></button>}
                </h4>
                {n.body && <div className="txt">{n.body}</div>}
              </div>
            ))}
          </div>
        )
      })}
      {!editable && R.isGM && <p className="faint" style={{ fontSize: ".85rem" }}>Crie e revele histórias e locais na aba Mestre → História.</p>}
      {edit && <NoteEditor n={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

export function NoteEditor({ n, onClose }: { n: Partial<Note>; onClose: () => void }) {
  const R = useRoom()
  const [title, setTitle] = useState(n.title ?? "")
  const [body, setBody] = useState(n.body ?? "")
  const [hidden, setHidden] = useState(!!n.hidden)
  const label = { story: "História", place: "Localidade", diary: "Entrada do diário" }[n.kind ?? "diary"]
  return (
    <Modal title={label} icon={n.kind === "place" ? "castle" : n.kind === "story" ? "book" : "quill"} onClose={onClose}>
      <label className="lbl">Título</label>
      <input className="field" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="lbl">Texto</label>
      <textarea className="field" rows={8} value={body} onChange={(e) => setBody(e.target.value)} />
      <label className="row" style={{ marginTop: ".7rem", cursor: "pointer" }}>
        <input type="checkbox" checked={hidden} onChange={(e) => setHidden(e.target.checked)} />
        {n.kind === "diary" ? "Privado (só eu e o mestre)" : "Oculto dos jogadores"}
      </label>
      <div className="row" style={{ marginTop: "1rem" }}>
        <button className="btn" onClick={async () => { if (await R.act("note.save", { id: n.id, kind: n.kind, title, body, hidden })) onClose() }}><Icon n="check" size={14} /> Salvar</button>
        {n.kind !== "diary" && R.isGM && hidden && n.id && <button className="btn ghost" onClick={async () => { await R.act("note.save", { id: n.id, kind: n.kind, title, body, hidden: false }); R.chat(`/n ${title} foi revelado.`); onClose() }}><Icon n="eye" size={14} /> Revelar a todos</button>}
        <span className="grow" />
        {n.id && <button className="btn red sm" onClick={async () => { if (confirm("Apagar?")) { await R.act("note.delete", { id: n.id }); onClose() } }}><Icon n="trash" size={12} /></button>}
      </div>
    </Modal>
  )
}

/* ───────────────────────── Ajuda ───────────────────────── */

function HelpTab() {
  const R = useRoom()
  const rows: [string, string][] = [
    ["1d20+FOR", "Rolar direto: começa com dado, rola. Atributos da sua ficha ativa entram por nome."],
    ["/r 2d6+3 #Dano", "Rolagem com rótulo"],
    ["/r 4d6kh3", "Mantém os 3 maiores (kl = menores)"],
    ["/r 3d6!", "Dados que explodem no valor máximo"],
    ["/r 1d20+DES @Lyra", "Usa a ficha de outro personagem"],
    ["/sr 1d20", "Secreta: só você e o mestre"],
    ["*abre a porta*", "Ação (ou /me abre a porta)"],
    ["/w @Ana segredo", "Sussurro"],
    ["/pv @Lyra -20", "Muda atributo (+N −N =N). Vale para qualquer campo: /pm, /for, /def…"],
    ["/pvmax @Lyra =30", "Muda o máximo de uma barra"],
    ["/init 1d20+DES", "Entrar na iniciativa"],
    ["/init iniciar · /proximo · /init fim", "Controle de turnos"],
    ["/cond @Orc Atordoado 2", "Condição por 2 rodadas (/cond @Orc -Atordoado remove)"],
    ["/gm", "Assumir ou largar o posto de mestre"],
  ]
  const gm: [string, string][] = [
    ["/n texto", "Narração em pergaminho"],
    ["/npc Odo: Bom dia!", "Falar como NPC (ou use o seletor ao lado do chat)"],
    ["/pv @todos +5", "Afeta todos os personagens"],
    ["/desfazer", "Desfaz a última mudança de atributo"],
  ]
  return (
    <div className="helpgrid">
      <div className="sec-title" style={{ marginTop: ".2rem" }}>Comandos</div>
      {rows.map(([c, d]) => <div key={c}><code>{c}</code> <span className="muted">{d}</span></div>)}
      <div className="sec-title"><Icon n="crown" size={13} /> Só o mestre</div>
      {gm.map(([c, d]) => <div key={c}><code>{c}</code> <span className="muted">{d}</span></div>)}
      <div className="sec-title">Atalhos</div>
      <div className="muted"><kbd>Enter</kbd> envia · <kbd>Shift+Enter</kbd> quebra linha · <kbd>↑</kbd> repete o último · <kbd>Tab</kbd> completa · <kbd>@</kbd> sugere nomes</div>
      {!R.isGM && <p className="faint" style={{ fontSize: ".85rem" }}>Mudar atributos de outras fichas é poder do mestre.</p>}
    </div>
  )
}
