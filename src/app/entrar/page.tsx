"use client"
import Link from "next/link"
import { useState } from "react"
import { Flourish, Icon, Seal } from "@/components/Icon"
import { authClient } from "@/lib/authClient"

function nextUrl() {
  if (typeof window === "undefined") return "/"
  const n = new URLSearchParams(location.search).get("next") || "/"
  return n.startsWith("/") && !n.startsWith("//") ? n : "/"
}

export default function Entrar() {
  const [mode, setMode] = useState<"in" | "up">("in")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [pass, setPass] = useState("")
  const [err, setErr] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setErr("")
    const res = mode === "in"
      ? await authClient.signIn.email({ email, password: pass })
      : await authClient.signUp.email({ email, password: pass, name: name || email.split("@")[0] })
    setBusy(false)
    if (res.error) {
      const m = res.error.message || ""
      setErr(/invalid|incorrect/i.test(m) ? "E-mail ou senha não conferem." : /exist/i.test(m) ? "Já existe uma conta com esse e-mail." : /password/i.test(m) ? "A senha precisa de pelo menos 8 caracteres." : m || "Não deu certo. Tente de novo.")
      return
    }
    location.href = nextUrl()
  }

  async function google() {
    setErr("")
    const res = await authClient.signIn.social({ provider: "google", callbackURL: location.origin + nextUrl() })
    if (res?.error) setErr(res.error.message || "O Google não respondeu.")
  }

  return (
    <main className="home">
      <div className="frame auth-box rise">
        <div className="center">
          <Link href="/" style={{ textDecoration: "none" }}><Seal size={56} /></Link>
          <h1 className="title-deco" style={{ fontSize: "2rem", marginTop: ".3rem" }}>RPG3ic</h1>
          <Flourish />
        </div>
        <div className="tabs">
          <button className={"tab " + (mode === "in" ? "on" : "")} onClick={() => setMode("in")}><Icon n="door" size={14} /> Entrar</button>
          <button className={"tab " + (mode === "up" ? "on" : "")} onClick={() => setMode("up")}><Icon n="quill" size={14} /> Criar conta</button>
        </div>
        <button className="btn google" style={{ width: "100%", marginTop: ".6rem" }} onClick={google}>
          <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.5 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.2l7.8 6C12.3 13.4 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.6c0-1.6-.1-3.1-.4-4.6H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.8c4.3-4 6.9-10 6.9-17.1z"/><path fill="#FBBC05" d="M10.4 28.8a14.4 14.4 0 0 1 0-9.6l-7.8-6a24 24 0 0 0 0 21.6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.8c-2.1 1.4-4.8 2.3-8.5 2.3-6.3 0-11.7-3.9-13.6-9.7l-7.8 6C6.6 42.6 14.6 48 24 48z"/></svg>
          Continuar com Google
        </button>
        <div className="or">ou com e-mail</div>
        <form onSubmit={submit}>
          {mode === "up" && (<><label className="lbl">Como te chamam na taverna</label><input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome" /></>)}
          <label className="lbl">E-mail</label>
          <input className="field" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@exemplo.com" />
          <label className="lbl">Senha</label>
          <input className="field" type="password" required minLength={8} value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Pelo menos 8 caracteres" />
          {err && <p className="err">{err}</p>}
          <button className="btn" style={{ width: "100%", marginTop: "1rem" }} disabled={busy}>
            {busy ? "Abrindo os portões…" : mode === "in" ? "Entrar" : "Criar minha conta"}
          </button>
        </form>
        <p className="center faint" style={{ fontSize: ".85rem", marginTop: "1rem" }}>Só vai jogar? Não precisa de conta: <Link href="/">entre com o código da sala</Link>.</p>
      </div>
    </main>
  )
}
