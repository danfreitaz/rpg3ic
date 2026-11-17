"use client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { Flourish, Icon, Seal } from "@/components/Icon"
import { sfx } from "@/components/sound"
import { authClient } from "@/lib/authClient"

type RoomRow = { code: string; name: string; scene: string; role: string; mine: boolean; people: number }

export default function Home() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession()
  const [letters, setLetters] = useState<string[]>(Array(6).fill(""))
  const [rooms, setRooms] = useState<RoomRow[]>([])
  const [newName, setNewName] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)
  const boxes = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    fetch("/api/rooms").then((r) => r.json()).then((d) => setRooms(d.rooms ?? [])).catch(() => {})
  }, [session?.user?.id])

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
  const go = () => {
    if (code.length !== 6) return setErr("O código tem 6 letras.")
    sfx.door()
    router.push("/s/" + code)
  }
  async function create() {
    setBusy(true); setErr("")
    const r = await fetch("/api/rooms", { method: "POST", body: JSON.stringify({ name: newName }) })
    const d = await r.json()
    setBusy(false)
    if (!r.ok) { sfx.error(); return setErr(d.error) }
    sfx.door()
    router.push("/s/" + d.code)
  }

  return (
    <main className="home">
      <div className="home-card">
        <section className="frame hero rise">
          <div className="row" style={{ gap: ".9rem" }}>
            <Seal size={64} />
            <h1 className="title-deco">RPG3ic</h1>
          </div>
          <p className="tag">A taverna onde a história é contada por todos, e o mestre tem as chaves.</p>
          <Flourish className="" />
          <ul style={{ marginTop: "1rem" }}>
            <li><Icon n="d20" /> <span>Dados direto no chat: <code className="mono">1d20+FOR</code> soma o atributo da sua ficha, sozinho.</span></li>
            <li><Icon n="heart" /> <span>Comandos de mestre: <code className="mono">/pv @Lyra -20</code> e a vida cai na hora, para todo mundo ver.</span></li>
            <li><Icon n="scroll" /> <span>Fichas vivas, modelos que o mestre desenha, NPCs e criaturas com ficha própria.</span></li>
            <li><Icon n="map" /> <span>Mapa com peças, névoa de guerra e iniciativa com rodadas e condições.</span></li>
            <li><Icon n="users" /> <span>Amigos sem conta entram só com o código da sala.</span></li>
          </ul>
        </section>

        <section className="frame side rise" style={{ animationDelay: ".08s" }}>
          <div>
            <div className="sec-title" style={{ marginTop: 0 }}><Icon n="door" size={14} /> Entrar com código</div>
            <div className="code-input" onPaste={(e) => { e.preventDefault(); setAt(0, e.clipboardData.getData("text")) }}>
              {letters.map((l, i) => (
                <input key={i} ref={(el) => { boxes.current[i] = el }} className="field" value={l} maxLength={6} aria-label={`Letra ${i + 1}`}
                  onChange={(e) => setAt(i, e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Backspace" && !l && i > 0) boxes.current[i - 1]?.focus(); if (e.key === "Enter") go() }} />
              ))}
            </div>
            <button className="btn" style={{ width: "100%", marginTop: ".7rem" }} onClick={go} disabled={code.length !== 6}>
              <Icon n="door" size={15} /> Entrar na mesa
            </button>
          </div>

          <div>
            <div className="sec-title"><Icon n="crown" size={14} /> Abrir uma mesa</div>
            {isPending ? <p className="muted">Consultando o livro de hóspedes…</p> : session?.user ? (
              <div className="col">
                <input className="field" placeholder="Nome da campanha (ex.: As Brumas de Arcadia)" value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && create()} />
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
              <div className="sec-title"><Icon n="castle" size={14} /> Suas mesas</div>
              <div className="room-list">
                {rooms.map((r) => (
                  <Link key={r.code} href={"/s/" + r.code} className="room-item">
                    <Icon n={r.role === "gm" ? "crown" : "user"} size={16} />
                    <span className="grow" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.name}</span>
                    <span className="faint" style={{ fontSize: ".8rem" }}>{r.people} <Icon n="users" size={12} /></span>
                    <span className="code">{r.code}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
          {err && <p className="err">{err}</p>}
        </section>
      </div>
      <p className="foot">RPG3ic · herdeiro do velho RPG2ic · feito para desktop, com som ligado 🔊</p>
    </main>
  )
}
