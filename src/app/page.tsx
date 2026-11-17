"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Flourish, Icon, Seal } from "@/components/Icon"
import { sfx } from "@/components/sound"
import { authClient } from "@/lib/authClient"
import { openMenu } from "@/components/ContextMenu"

type RoomRow = { code: string; name: string; scene: string; role: string; mine: boolean; people: number }
type PublicRow = { code: string; name: string; scene: string; people: number; gm: string | null; last_active: string }

function ago(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000))
  if (m < 2) return "agora mesmo"
  if (m < 60) return `há ${m} min`
  const h = Math.round(m / 60)
  return h < 24 ? `há ${h} h` : `há ${Math.round(h / 24)} d`
}

export default function Home() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [letters, setLetters] = useState<string[]>(Array(6).fill(""))
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [pub, setPub] = useState<PublicRow[] | null>(null)
  const [last, setLast] = useState<{ code: string; name: string } | null>(null)
  const [newName, setNewName] = useState("")
  const [isPublic, setIsPublic] = useState(false)
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState("")
  const boxes = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    fetch("/api/rooms").then((r) => r.json()).then((d) => setRooms(d.rooms ?? [])).catch(() => {})
  }, [session?.user?.id])
  useEffect(() => {
    const load = () => fetch("/api/rooms/public").then((r) => r.json()).then((d) => setPub(d.rooms ?? [])).catch(() => setPub([]))
    load()
    const t = setInterval(load, 30000)
    try { const l = JSON.parse(localStorage.getItem("r3_last_room") || "null"); if (l?.code) setLast(l) } catch {}
    try { document.documentElement.dataset.skin = localStorage.getItem("r3_skin") || "medieval" } catch {}
    return () => clearInterval(t)
  }, [])

  const code = letters.join("")
  const setAt = (i: number, v: string) => {
    const clean = v.toUpperCase().replace(/[^A-Z]/g, "")
    if (clean.length > 1) {
      const next = clean.slice(0, 6).split("")
      setLetters([...next, ...Array(6 - next.length).fill("")])
      boxes.current[Math.min(5, next.length)]?.focus()
      return
    }
    const next = [...letters]; next[i] = clean; setLetters(next)
    if (clean && i < 5) boxes.current[i + 1]?.focus()
  }
  const enter = (c: string) => { sfx.door(); router.push("/s/" + c) }
  const go = () => (code.length !== 6 ? setErr("O código tem 6 letras.") : enter(code))
  const copyLink = (c: string, e?: React.MouseEvent) => {
    e?.preventDefault(); e?.stopPropagation()
    navigator.clipboard?.writeText(`${location.origin}/s/${c}`)
    setCopied(c); sfx.click()
    setTimeout(() => setCopied(""), 1600)
  }
  const roomMenu = (e: React.MouseEvent, c: string, name: string) => openMenu(e, [
    { title: name },
    { label: "Entrar", icon: "door", onClick: () => enter(c) },
    { label: "Abrir em nova aba", icon: "move", onClick: () => window.open(`/s/${c}`, "_blank") },
    { label: "Copiar link", icon: "copy", onClick: () => copyLink(c) },
    { label: "Copiar código", icon: "copy", hint: c, onClick: () => navigator.clipboard?.writeText(c) },
  ])
  async function create() {
    setBusy(true); setErr("")
    const r = await fetch("/api/rooms", { method: "POST", body: JSON.stringify({ name: newName, public: isPublic }) })
    const d = await r.json()
    setBusy(false)
    if (!r.ok) { sfx.error(); return setErr(d.error) }
    enter(d.code)
  }

  return (
    <main className="home">
      <div className="embers" aria-hidden>{Array.from({ length: 14 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i * 0.9) % 7}s`, animationDuration: `${7 + (i % 5)}s` }} />)}</div>

      {last && (
        <div className="return-banner rise" onContextMenu={(e) => roomMenu(e, last.code, last.name)}>
          <Icon n="door" size={18} />
          <span>Você estava na mesa <b>{last.name}</b> <span className="mono">({last.code})</span></span>
          <button className="btn sm" onClick={() => enter(last.code)}><Icon n="sword" size={13} /> Voltar para a sala</button>
          <button className="iconbtn sm" title="Copiar link da sala" onClick={() => copyLink(last.code)}><Icon n={copied === last.code ? "check" : "copy"} size={13} /></button>
          <button className="iconbtn sm" title="Dispensar" onClick={() => { localStorage.removeItem("r3_last_room"); setLast(null) }}><Icon n="x" size={13} /></button>
        </div>
      )}

      <div className="home-grid">
        <section className="frame hero rise">
          <span className="corner-tr" /><span className="corner-bl" />
          <div className="row" style={{ gap: ".9rem" }}>
            <Seal size={72} />
            <div>
              <h1 className="title-deco">RPG3ic</h1>
              <div className="subtitle">Taverna de histórias contadas a muitas vozes</div>
            </div>
          </div>
          <Flourish />
          <ul>
            <li><Icon n="d20" /> <span>Clique nos dados para enchê-los na bandeja: dois cliques no d6 viram <code className="mono">2d6</code>, e você rola quando quiser.</span></li>
            <li><Icon n="heart" /> <span>Comandos de mestre: <code className="mono">/dano @Lyra 8</code>, <code className="mono">/cura @todos 5</code>, <code className="mono">/descansar</code>. A ficha muda na hora para todos.</span></li>
            <li><Icon n="scroll" /> <span>Fichas vivas, modelos que o mestre desenha, NPCs e criaturas com ficha própria.</span></li>
            <li><Icon n="map" /> <span>Mapa com peças, névoa de guerra, iniciativa com rodadas e condições.</span></li>
            <li><Icon n="eye" /> <span>Oráculo, moeda, sussurros, gritos e conversa fora do personagem.</span></li>
          </ul>
        </section>

        <section className="frame side rise" style={{ animationDelay: ".08s" }}>
          <span className="corner-tr" /><span className="corner-bl" />
          <div>
            <div className="ribbon"><Icon n="door" size={14} /> Entrar com código</div>
            <div className="code-input" onPaste={(e) => { e.preventDefault(); setAt(0, e.clipboardData.getData("text")) }}>
              {letters.map((l, i) => (
                <input key={i} ref={(el) => { boxes.current[i] = el }} className="field" value={l} maxLength={6} aria-label={`Letra ${i + 1}`}
                  onChange={(e) => setAt(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Backspace" && !l && i > 0) boxes.current[i - 1]?.focus(); if (e.key === "Enter") go() }} />
              ))}
            </div>
            <button className="btn" style={{ width: "100%", marginTop: ".7rem" }} onClick={go} disabled={code.length !== 6}><Icon n="door" size={15} /> Entrar na mesa</button>
          </div>

          <div>
            <div className="ribbon"><Icon n="crown" size={14} /> Abrir uma mesa</div>
            {isPending ? <p className="muted">Consultando o livro de hóspedes…</p> : session?.user ? (
              <div className="col">
                <input className="field" placeholder="Nome da campanha (ex.: As Brumas de Arcadia)" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
                <div className="seg">
                  <button className={!isPublic ? "on" : ""} onClick={() => setIsPublic(false)}><Icon n="eyeoff" size={13} /> Privada <small>só com código</small></button>
                  <button className={isPublic ? "on" : ""} onClick={() => setIsPublic(true)}><Icon n="eye" size={13} /> Pública <small>aparece na lista</small></button>
                </div>
                <button className="btn" onClick={create} disabled={busy}><Icon n="plus" size={15} /> Criar sala</button>
                <div className="row muted" style={{ fontSize: ".88rem" }}>
                  <span className="grow">Logado como <b>{session.user.name || session.user.email}</b></span>
                  <button className="btn ghost sm" onClick={() => authClient.signOut().then(() => location.reload())}><Icon n="logout" size={13} /> Sair</button>
                </div>
              </div>
            ) : (
              <div className="col">
                <p className="muted" style={{ margin: 0 }}>Para criar salas e guardar campanhas, entre com sua conta.</p>
                <Link href="/entrar" className="btn"><Icon n="user" size={15} /> Entrar ou criar conta</Link>
              </div>
            )}
          </div>

          {rooms.length > 0 && (
            <div>
              <div className="ribbon"><Icon n="castle" size={14} /> Suas mesas</div>
              <div className="room-list">
                {rooms.map((r) => (
                  <Link key={r.code} href={"/s/" + r.code} className="room-item" onContextMenu={(e) => roomMenu(e, r.code, r.name)}>
                    <Icon n={r.role === "gm" ? "crown" : "user"} size={16} />
                    <span className="grow ellipsis">{r.name}</span>
                    <span className="faint" style={{ fontSize: ".8rem" }}>{r.people} <Icon n="users" size={12} /></span>
                    <span className="code">{r.code}</span>
                    <button className="iconbtn sm" title="Copiar link" onClick={(e) => copyLink(r.code, e)}><Icon n={copied === r.code ? "check" : "copy"} size={12} /></button>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {err && <p className="err">{err}</p>}
        </section>

        <section className="frame public-board rise" style={{ animationDelay: ".16s" }}>
          <span className="corner-tr" /><span className="corner-bl" />
          <div className="board-head">
            <Icon n="castle" size={20} />
            <h2>Mesas abertas</h2>
            <span className="grow" />
            <span className="faint" style={{ fontSize: ".85rem" }}>salas públicas ativas nos últimos dias</span>
          </div>
          {pub === null ? <p className="muted center">Escutando as tavernas da região…</p> : pub.length === 0 ? (
            <div className="empty">Nenhuma mesa pública agora. Abra a sua como pública e chame aventureiros desconhecidos.</div>
          ) : (
            <div className="pub-grid">
              {pub.map((r, i) => (
                <div key={r.code} className="pub-card rise" style={{ animationDelay: `${i * 0.04}s` }} onContextMenu={(e) => roomMenu(e, r.code, r.name)}>
                  <div className="pub-top">
                    <span className="pub-seal"><Icon n="sword" size={16} /></span>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <h3 className="ellipsis">{r.name}</h3>
                      <div className="faint ellipsis" style={{ fontSize: ".82rem", fontStyle: "italic" }}>{r.scene || "Sem cena definida"}</div>
                    </div>
                  </div>
                  <div className="row" style={{ fontSize: ".82rem", gap: ".6rem" }}>
                    <span className="muted"><Icon n="crown" size={12} /> {r.gm ?? "sem mestre"}</span>
                    <span className="muted"><Icon n="users" size={12} /> {r.people}</span>
                    <span className="grow" />
                    <span className="faint">{ago(r.last_active)}</span>
                  </div>
                  <div className="row">
                    <button className="btn sm grow" onClick={() => enter(r.code)}><Icon n="door" size={12} /> Entrar</button>
                    <button className="btn ghost sm" title="Copiar link" onClick={() => copyLink(r.code)}><Icon n={copied === r.code ? "check" : "copy"} size={12} /> {r.code}</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
      <p className="foot">RPG3ic · herdeiro do velho RPG2ic · feito para desktop, com som ligado 🔊</p>
    </main>
  )
}
