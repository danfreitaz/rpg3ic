import { randomInt } from "node:crypto"
import { sql } from "./db"
import { looksLikeRoll, rollExpr } from "./dice"
import type { Ctx } from "./room"
import { AMBIENCES, EMPTY_INIT, norm, type Cond, type InitState, type Member, type Sheet, type Template } from "./types"

export type Out = { ok?: true; error?: string }
type World = { sheets: Sheet[]; members: Member[] }
type NewMsg = { kind: string; body?: string; data?: any; speaker?: string; color?: string; to?: string | null; secret?: boolean }

async function load(c: Ctx): Promise<World> {
  const [sheets, members] = await Promise.all([
    sql`SELECT * FROM sheets WHERE room_id = ${c.room.id} ORDER BY created_at`,
    sql`SELECT id, name, role, color, sheet_id FROM members WHERE room_id = ${c.room.id} ORDER BY created_at`,
  ])
  return { sheets: sheets as Sheet[], members: members as Member[] }
}

export async function post(c: Ctx, m: NewMsg) {
  await sql`INSERT INTO messages (room_id, member_id, kind, speaker, color, body, data, to_member, secret)
    VALUES (${c.room.id}, ${c.me.id}, ${m.kind}, ${m.speaker ?? c.me.name}, ${m.color ?? c.me.color}, ${m.body ?? ""},
            ${m.data ? JSON.stringify(m.data) : null}::jsonb, ${m.to ?? null}, ${m.secret ?? false})`
  await sql`UPDATE rooms SET last_active = now() WHERE id = ${c.room.id} AND last_active < now() - interval '2 minutes'`
}

const MENTION = /@([\wÀ-ÿ-]+)/g
function splitMentions(text: string) {
  const mentions: string[] = []
  const rest = text.replace(MENTION, (_, n) => (mentions.push(n), " ")).replace(/\s+/g, " ").trim()
  return { mentions, rest }
}

const mySheet = (c: Ctx, w: World) => w.sheets.find((s) => s.id === c.me.sheet_id) ?? null
const canEdit = (c: Ctx, s: Sheet) => c.isGM || s.owner_member === c.me.id
const findMember = (w: World, name: string) => {
  const n = norm(name)
  return w.members.find((m) => norm(m.name) === n) ?? w.members.find((m) => norm(m.name).startsWith(n)) ?? null
}

function resolveSheets(c: Ctx, w: World, mention: string): Sheet[] {
  const n = norm(mention)
  const vis = w.sheets.filter((s) => c.isGM || !s.hidden || s.owner_member === c.me.id)
  if (["todos", "all", "grupo"].includes(n)) return vis.filter((s) => s.kind === "pc")
  const s = vis.find((x) => norm(x.name) === n) ?? vis.find((x) => norm(x.name).startsWith(n))
  if (s) return [s]
  const m = findMember(w, mention)
  const ms = m?.sheet_id ? vis.find((x) => x.id === m.sheet_id) : null
  return ms ? [ms] : []
}

function fieldOf(tpls: Template[], sheet: Sheet, name: string) {
  const t = tpls.find((x) => x.id === sheet.template_id)
  if (!t) return null
  const n = norm(name)
  for (const f of t.fields) {
    if (f.type !== "bar" && f.type !== "num") continue
    if (norm(f.key) === n || norm(f.label) === n) return { key: f.key, label: f.label, bar: f.type === "bar" }
    if (f.type === "bar" && (norm(f.key) + "max" === n || norm(f.key) + "maximo" === n))
      return { key: f.key + "_max", label: f.label + " (máx.)", bar: false }
  }
  return null
}

const voice = (c: Ctx, w: World) => mySheet(c, w)?.name ?? c.me.name

async function say(c: Ctx, w: World, kind: "say" | "action", body: string): Promise<Out> {
  const speaker = voice(c, w)
  await post(c, { kind, body, speaker, data: speaker !== c.me.name ? { by: c.me.name } : null })
  return { ok: true }
}

async function doRoll(c: Ctx, w: World, text: string, secret: boolean, label0?: string): Promise<Out & { total?: number }> {
  const hash = text.indexOf("#")
  const label = (hash >= 0 ? text.slice(hash + 1).trim() : "") || label0 || ""
  const { mentions, rest } = splitMentions(hash >= 0 ? text.slice(0, hash) : text)
  let target: Sheet | null = mySheet(c, w)
  if (mentions.length) {
    const found = resolveSheets(c, w, mentions[0])
    if (found.length !== 1) return { error: `Não achei a ficha de @${mentions[0]}.` }
    target = found[0]
  }
  const r = rollExpr(rest, (name) => {
    if (!target) return null
    const f = fieldOf(c.room.templates, target, name)
    if (f) return Number(target.data?.[f.key] ?? 0)
    // MODFOR / FORMOD: modificador de atributo no estilo D&D, (valor − 10) ÷ 2
    const base = /^mod(.+)$/i.exec(name)?.[1] ?? /^(.+)mod$/i.exec(name)?.[1]
    const g = base ? fieldOf(c.room.templates, target, base) : null
    return g ? Math.floor((Number(target.data?.[g.key] ?? 10) - 10) / 2) : null
  })
  if ("error" in r) return { error: r.error }
  await post(c, { kind: "roll", body: label, speaker: voice(c, w), secret, data: { r, target: mentions.length ? target?.name : null, by: c.me.name } })
  return { ok: true, total: r.total }
}

async function changeAttr(c: Ctx, w: World, cmd: string, arg: string): Promise<Out> {
  const { mentions, rest } = splitMentions(arg)
  const m = /^([+\-=]?)\s*(\d+)$/.exec(rest)
  let targets: Sheet[] = []
  if (mentions.length) for (const mn of mentions) targets.push(...resolveSheets(c, w, mn))
  else { const s = mySheet(c, w); if (s) targets = [s] }
  targets = [...new Map(targets.map((s) => [s.id, s])).values()]
  if (!targets.length) return { error: mentions.length ? "Não achei nenhuma ficha com esse nome." : `Comando /${cmd} desconhecido — ou você ainda não tem uma ficha ativa.` }
  if (!targets.some((s) => fieldOf(c.room.templates, s, cmd))) return { error: `Comando ou atributo "/${cmd}" desconhecido. Veja a aba Ajuda.` }
  if (!m) return { error: `Use /${cmd} @alvo +N, −N ou =N (ex.: /${cmd} @alvo -20).` }
  const changes: any[] = []
  for (const s of targets) {
    const f = fieldOf(c.room.templates, s, cmd)
    if (!f) continue
    if (!canEdit(c, s)) return { error: `Só o mestre pode mexer na ficha de ${s.name}.` }
    const from = Number(s.data?.[f.key] ?? 0), n = Number(m[2])
    let to = m[1] === "+" ? from + n : m[1] === "-" ? from - n : n
    const max = f.bar ? Number(s.data?.[f.key + "_max"] ?? 0) : null
    if (f.bar) to = Math.max(0, m[1] === "+" && max ? Math.min(max, to) : to)
    await sql`INSERT INTO undo_log (room_id, label, sheet_id, prev) VALUES (${c.room.id}, ${`${f.label} de ${s.name}: ${from} → ${to}`}, ${s.id}, ${JSON.stringify(s.data)}::jsonb)`
    await sql`UPDATE sheets SET data = jsonb_set(data, ARRAY[${f.key}]::text[], ${JSON.stringify(to)}::jsonb, true) WHERE id = ${s.id}`
    changes.push({ name: s.name, label: f.label, key: f.key, from, to, max, bar: f.bar })
  }
  if (!changes.length) return { error: "Nada para alterar." }
  await post(c, { kind: "change", data: { ch: changes, by: c.me.name } })
  return { ok: true }
}

/** Avança o turno; ao fechar a rodada, as condições com duração perdem 1 rodada. */
export async function nextTurn(c: Ctx): Promise<Out> {
  const init: InitState = { ...EMPTY_INIT, ...(c.room.init || {}) }
  if (!init.order.length) return { error: "A iniciativa está vazia." }
  const cur = init.order[init.turn]
  const w = await load(c)
  const curSheet = cur?.sheet_id ? w.sheets.find((s) => s.id === cur.sheet_id) : null
  const mine = cur && (cur.id === "m:" + c.me.id || (curSheet && curSheet.owner_member === c.me.id))
  if (!c.isGM && !(init.on && mine)) return { error: "Só o mestre (ou quem está na vez) passa o turno." }
  if (!init.on) { init.on = true; init.turn = 0; init.round = 1 }
  else {
    init.turn++
    if (init.turn >= init.order.length) {
      init.turn = 0; init.round++
      for (const s of w.sheets) {
        const conds: Cond[] = s.data?._conds ?? []
        if (!conds.some((x) => x.r !== null)) continue
        const next = conds.map((x) => (x.r === null ? x : { ...x, r: x.r - 1 })).filter((x) => x.r === null || x.r > 0)
        await sql`UPDATE sheets SET data = jsonb_set(data, '{_conds}', ${JSON.stringify(next)}::jsonb, true) WHERE id = ${s.id}`
      }
    }
  }
  await sql`UPDATE rooms SET init = ${JSON.stringify(init)}::jsonb WHERE id = ${c.room.id}`
  const now = init.order[init.turn]
  await post(c, { kind: "turn", speaker: "Iniciativa", data: { name: now.name, id: now.id, sheet_id: now.sheet_id ?? null, round: init.round } })
  return { ok: true }
}

async function doInit(c: Ctx, w: World, arg: string): Promise<Out> {
  const a = norm(arg)
  const init: InitState = { ...EMPTY_INIT, ...(c.room.init || {}) }
  if (["limpar", "fim", "encerrar"].includes(a)) {
    if (!c.isGM) return { error: "Só o mestre encerra a iniciativa." }
    await sql`UPDATE rooms SET init = ${JSON.stringify(EMPTY_INIT)}::jsonb WHERE id = ${c.room.id}`
    await post(c, { kind: "system", body: "A iniciativa foi encerrada." })
    return { ok: true }
  }
  if (["iniciar", "comecar", "start"].includes(a)) return nextTurn({ ...c, room: { ...c.room, init: { ...init, on: false } } })
  const { mentions, rest } = splitMentions(arg)
  if (!rest) return { error: "Use /init 15, /init 1d20+DES ou /init @alvo 12." }
  let sheet = mySheet(c, w)
  if (mentions.length) {
    const found = resolveSheets(c, w, mentions[0])
    if (found.length !== 1) return { error: `Não achei a ficha de @${mentions[0]}.` }
    if (!canEdit(c, found[0])) return { error: "Só o mestre coloca outras fichas na iniciativa." }
    sheet = found[0]
  }
  let value: number
  if (/^-?\d+$/.test(rest)) value = Number(rest)
  else {
    const r = await doRoll(c, w, rest + (mentions.length ? " @" + mentions[0] : ""), false, "Iniciativa")
    if (r.error || r.total === undefined) return { error: r.error }
    value = r.total
  }
  const entry = sheet ? { id: sheet.id, name: sheet.name, init: value, sheet_id: sheet.id } : { id: "m:" + c.me.id, name: c.me.name, init: value, sheet_id: null }
  const curId = init.order[init.turn]?.id
  init.order = [...init.order.filter((e) => e.id !== entry.id), entry].sort((x, y) => y.init - x.init)
  if (init.on && curId) init.turn = Math.max(0, init.order.findIndex((e) => e.id === curId))
  await sql`UPDATE rooms SET init = ${JSON.stringify(init)}::jsonb WHERE id = ${c.room.id}`
  if (/^-?\d+$/.test(rest)) await post(c, { kind: "system", body: `${entry.name} entra na iniciativa com ${value}.` })
  return { ok: true }
}

async function doCond(c: Ctx, w: World, arg: string): Promise<Out> {
  const { mentions, rest } = splitMentions(arg)
  let targets: Sheet[] = []
  if (mentions.length) for (const mn of mentions) targets.push(...resolveSheets(c, w, mn))
  else { const s = mySheet(c, w); if (s) targets = [s] }
  if (!targets.length || !rest) return { error: "Use /cond @alvo Envenenado 3 (ou /cond @alvo -Envenenado para remover)." }
  const remove = rest.startsWith("-")
  const m = /^-?\s*(.+?)(?:\s+(\d+))?$/.exec(rest)!
  const name = m[1].trim().slice(0, 30), rounds = m[2] ? Number(m[2]) : null
  for (const s of targets) {
    if (!canEdit(c, s)) return { error: `Só o mestre pode mexer na ficha de ${s.name}.` }
    const conds: Cond[] = (s.data?._conds ?? []).filter((x: Cond) => norm(x.n) !== norm(name))
    if (!remove) conds.push({ n: name, r: rounds })
    await sql`UPDATE sheets SET data = jsonb_set(data, '{_conds}', ${JSON.stringify(conds)}::jsonb, true) WHERE id = ${s.id}`
  }
  const who = targets.map((s) => s.name).join(", ")
  await post(c, { kind: "system", body: remove ? `${who} não está mais ${name}.` : `${who} agora está ${name}${rounds ? ` (${rounds} rodada${rounds > 1 ? "s" : ""})` : ""}.`, data: { icon: "cond" } })
  return { ok: true }
}

export async function setRole(c: Ctx, role: "gm" | "player"): Promise<Out> {
  if (role === "gm" && !c.isOwner && c.room.gm_locked) return { error: "O criador da sala travou o posto de mestre." }
  await sql`UPDATE members SET role = ${role} WHERE id = ${c.me.id}`
  await post(c, { kind: "system", body: role === "gm" ? `${c.me.name} assumiu o posto de mestre.` : `${c.me.name} deixou o posto de mestre.`, data: { icon: "crown" } })
  return { ok: true }
}

export async function handleChat(c: Ctx, raw: string): Promise<Out> {
  const text = String(raw ?? "").trim().slice(0, 2000)
  if (!text) return { error: "Mensagem vazia." }
  const w = await load(c)
  if (!text.startsWith("/")) {
    if (looksLikeRoll(text)) { const r = await doRoll(c, w, text, false); if (!r.error) return { ok: true } }
    const img = /^(https:\/\/\S+\.(?:png|jpe?g|gif|webp)(?:\?\S*)?)(?:\s+([\s\S]*))?$/i.exec(text)
    if (img) { await post(c, { kind: "image", body: (img[2] ?? "").trim(), speaker: voice(c, w), data: { url: img[1], by: c.me.name } }); return { ok: true } }
    const ooc = /^\(\(([\s\S]+)\)\)$/.exec(text)
    if (ooc) { await post(c, { kind: "ooc", body: ooc[1].trim() }); return { ok: true } }
    const act = /^\*([^*]+)\*$/.exec(text)
    return act ? say(c, w, "action", act[1].trim()) : say(c, w, "say", text)
  }
  const sp = text.search(/\s/)
  const cmd = norm(text.slice(1, sp < 0 ? undefined : sp))
  const arg = sp < 0 ? "" : text.slice(sp + 1).trim()
  switch (cmd) {
    case "r": case "rolar": case "roll": case "dado":
      return doRoll(c, w, arg || "1d20", false)
    case "sr": case "rs": case "gmr": case "secreto":
      return doRoll(c, w, arg || "1d20", true)
    case "me": case "acao": case "a":
      return arg ? say(c, w, "action", arg) : { error: "Use /me descreve a ação." }
    case "w": case "s": case "sussurro": case "sussurrar": {
      const m = /^@([\wÀ-ÿ-]+)\s+([\s\S]+)$/.exec(arg)
      if (!m) return { error: "Use /w @jogador mensagem." }
      const to = findMember(w, m[1])
      if (!to) return { error: `Não achei @${m[1]} na sala.` }
      await post(c, { kind: "whisper", body: m[2], to: to.id, data: { to: to.name } })
      return { ok: true }
    }
    case "n": case "narrar": case "narracao":
      if (!c.isGM) return { error: "Só o mestre narra." }
      if (!arg) return { error: "Use /n texto da narração." }
      await post(c, { kind: "narration", body: arg, speaker: "Narrador" })
      return { ok: true }
    case "npc": case "como": {
      if (!c.isGM) return { error: "Só o mestre fala como NPC." }
      const m = /^([^:]{1,40}):\s*([\s\S]+)$/.exec(arg)
      if (!m) return { error: "Use /npc Nome: fala (ou /npc Nome: *ação*)." }
      const sheet = w.sheets.find((s) => norm(s.name) === norm(m[1])) ?? w.sheets.find((s) => norm(s.name).startsWith(norm(m[1])))
      const act = /^\*([^*]+)\*$/.exec(m[2].trim())
      await post(c, { kind: act ? "action" : "say", body: act ? act[1] : m[2].trim(), speaker: sheet?.name ?? m[1].trim(), color: "#b9a27a", data: { npc: true, avatar: sheet?.avatar || null } })
      return { ok: true }
    }
    case "desfazer": case "undo": {
      if (!c.isGM) return { error: "Só o mestre desfaz alterações." }
      const rows = await sql`DELETE FROM undo_log WHERE seq = (SELECT max(seq) FROM undo_log WHERE room_id = ${c.room.id}) RETURNING label, sheet_id, prev`
      if (!rows.length) return { error: "Não há nada para desfazer." }
      await sql`UPDATE sheets SET data = ${JSON.stringify(rows[0].prev)}::jsonb WHERE id = ${rows[0].sheet_id}`
      await post(c, { kind: "system", body: `Desfeito: ${rows[0].label}.`, data: { icon: "undo" } })
      return { ok: true }
    }
    case "init": case "iniciativa":
      return doInit(c, w, arg)
    case "proximo": case "prox": case "next": case "turno":
      return nextTurn(c)
    case "cond": case "condicao":
      return doCond(c, w, arg)
    case "gm": case "mestre":
      return setRole(c, c.isGM ? "player" : "gm")
    case "moeda": case "coin": {
      const face = randomInt(0, 2) === 0 ? "Cara" : "Coroa"
      await post(c, { kind: "coin", body: arg, speaker: voice(c, w), data: { face, by: c.me.name } })
      return { ok: true }
    }
    case "oraculo": case "sorte": case "destino": {
      const a = randomInt(1, 7), b = randomInt(1, 7), t = a + b
      const answer = t <= 3 ? "Não, e ainda piora…" : t <= 5 ? "Não." : t <= 6 ? "Não, mas…" : t === 7 ? "Talvez… os ventos hesitam." : t === 8 ? "Sim, mas…" : t <= 10 ? "Sim." : "Sim, e ainda melhor!"
      await post(c, { kind: "oracle", body: arg || "O destino foi consultado.", speaker: voice(c, w), data: { a, b, t, answer, by: c.me.name } })
      return { ok: true }
    }
    case "dano": case "ferir": case "cura": case "curar": {
      const heal = cmd.startsWith("cur")
      const { mentions, rest } = splitMentions(arg)
      if (!/^\d+$/.test(rest)) return { error: `Use /${cmd} @alvo N (ex.: /${cmd} @Lyra 8).` }
      const targets = (mentions.length ? mentions.flatMap((m) => resolveSheets(c, w, m)) : [mySheet(c, w)].filter(Boolean)) as Sheet[]
      if (!targets.length) return { error: "Não achei o alvo." }
      const t = c.room.templates.find((x) => x.id === targets[0].template_id)
      const bar = t?.fields.find((f) => f.type === "bar")
      if (!bar) return { error: "Essa ficha não tem barra de vida." }
      return changeAttr(c, w, bar.key, `${targets.map((s) => "@" + s.name.replace(/\s+/g, "")).join(" ")} ${heal ? "+" : "-"}${rest}`)
    }
    case "descansar": case "descanso": {
      const { mentions } = splitMentions(arg)
      const targets = (mentions.length ? mentions.flatMap((m) => resolveSheets(c, w, m)) : [mySheet(c, w)].filter(Boolean)) as Sheet[]
      if (!targets.length) return { error: "Use /descansar @alvo (ou /descansar @todos)." }
      for (const s of targets) {
        if (!canEdit(c, s)) return { error: `Só o mestre pode fazer ${s.name} descansar.` }
        const t = c.room.templates.find((x) => x.id === s.template_id)
        const patch: Record<string, number> = {}
        for (const f of t?.fields ?? []) if (f.type === "bar") patch[f.key] = Number(s.data?.[f.key + "_max"] ?? 0)
        await sql`INSERT INTO undo_log (room_id, label, sheet_id, prev) VALUES (${c.room.id}, ${`descanso de ${s.name}`}, ${s.id}, ${JSON.stringify(s.data)}::jsonb)`
        await sql`UPDATE sheets SET data = data || ${JSON.stringify(patch)}::jsonb WHERE id = ${s.id}`
      }
      await post(c, { kind: "system", body: `${targets.map((s) => s.name).join(", ")} descansa${targets.length > 1 ? "m" : ""} e recupera${targets.length > 1 ? "m" : ""} as forças.`, data: { icon: "heart" } })
      return { ok: true }
    }
    case "status": case "ficha": {
      const { mentions } = splitMentions(arg)
      const s = mentions.length ? resolveSheets(c, w, mentions[0])[0] : mySheet(c, w)
      if (!s) return { error: "Use /status @alvo." }
      const t = c.room.templates.find((x) => x.id === s.template_id)
      const bars = (t?.fields ?? []).filter((f) => f.type === "bar").map((f) => ({ key: f.key, label: f.label, v: Number(s.data?.[f.key] ?? 0), m: Number(s.data?.[f.key + "_max"] ?? 0) }))
      const nums = (t?.fields ?? []).filter((f) => f.type === "num").map((f) => ({ label: f.key.toUpperCase(), v: Number(s.data?.[f.key] ?? 0) }))
      await post(c, { kind: "status", speaker: s.name, body: "", data: { bars, nums, conds: s.data?._conds ?? [], money: Number(s.data?._money ?? 0), avatar: s.avatar || null, by: c.me.name } })
      return { ok: true }
    }
    case "teste": case "nh": {
      // 3d6 contra um atributo ou número (estilo GURPS): sucesso se o total for menor ou igual.
      const { mentions, rest } = splitMentions(arg)
      let target: Sheet | null = mySheet(c, w)
      if (mentions.length) { const found = resolveSheets(c, w, mentions[0]); if (found.length !== 1) return { error: `Não achei a ficha de @${mentions[0]}.` }; target = found[0] }
      const m = /^([\wÀ-ÿ]+)\s*([+-]\s*\d+)?\s*(?:#(.*))?$/.exec(rest)
      if (!m) return { error: "Use /teste ST, /teste DX-2, /teste 12 ou /teste IQ @alvo." }
      let value: number, label: string
      if (/^\d+$/.test(m[1])) { value = Number(m[1]); label = `NH ${value}` }
      else {
        const f = target ? fieldOf(c.room.templates, target, m[1]) : null
        if (!f || !target) return { error: `Atributo "${m[1]}" não encontrado${target ? ` na ficha de ${target.name}` : " (escolha uma ficha ativa)"}.` }
        value = Number(target.data?.[f.key] ?? 0); label = f.label
      }
      const mod = m[2] ? Number(m[2].replace(/\s/g, "")) : 0
      const alvo = value + mod
      const r = rollExpr("3d6", () => null)
      if ("error" in r) return { error: r.error }
      const t = r.total, margin = alvo - t
      const crit = t <= 4 || (t === 5 && alvo >= 15) || (t === 6 && alvo >= 16)
      const fumble = t === 18 || (t === 17 && alvo <= 15) || t - alvo >= 10
      await post(c, { kind: "roll", body: (m[3]?.trim() || label) + ` (${alvo}${mod ? `, ${mod > 0 ? "+" : ""}${mod}` : ""})`, speaker: voice(c, w),
        data: { r: { ...r, crit, fumble }, under: { alvo, margin, ok: margin >= 0 }, target: mentions.length ? target?.name : null, by: c.me.name } })
      return { ok: true }
    }
    case "dinheiro": case "$": case "grana": case "ouro": case "moedas": case "money": {
      const { mentions, rest } = splitMentions(arg)
      const m = /^([+\-=]?)\s*(\d+)$/.exec(rest.replace(/^\$\s*/, ""))
      const targets = (mentions.length ? mentions.flatMap((x) => resolveSheets(c, w, x)) : [mySheet(c, w)].filter(Boolean)) as Sheet[]
      if (!targets.length) return { error: "Use /grana @alvo +50 (ou −20, =100). Sem @, mexe na sua ficha ativa." }
      if (!m) return { error: "Use /grana @alvo +50, -20 ou =100." }
      const ch: any[] = []
      for (const s of [...new Map(targets.map((x) => [x.id, x])).values()]) {
        if (!canEdit(c, s)) return { error: `Só o mestre mexe na grana de ${s.name}. Para dar grana a alguém, use /pagar.` }
        const from = Number(s.data?._money ?? 0), n = Number(m[2])
        const to = Math.max(0, m[1] === "+" ? from + n : m[1] === "-" ? from - n : n)
        await sql`INSERT INTO undo_log (room_id, label, sheet_id, prev) VALUES (${c.room.id}, ${`grana de ${s.name}: $${from} → $${to}`}, ${s.id}, ${JSON.stringify(s.data)}::jsonb)`
        await sql`UPDATE sheets SET data = jsonb_set(data, '{_money}', ${JSON.stringify(to)}::jsonb, true) WHERE id = ${s.id}`
        ch.push({ name: s.name, from, to })
      }
      await post(c, { kind: "money", data: { ch, by: c.me.name } })
      return { ok: true }
    }
    case "pagar": case "dar": case "pay": {
      const { mentions, rest } = splitMentions(arg)
      const n = Number(rest.replace(/^\$\s*/, ""))
      if (!mentions.length || !Number.isInteger(n) || n <= 0) return { error: "Use /pagar @alvo 20 (sai da sua ficha ativa)." }
      const payer = mySheet(c, w)
      if (!payer) return { error: "Escolha uma ficha ativa para pagar com a grana dela." }
      const to = resolveSheets(c, w, mentions[0])[0]
      if (!to) return { error: `Não achei @${mentions[0]}.` }
      if (to.id === payer.id) return { error: "Pagar a si mesmo não muda nada." }
      const have = Number(payer.data?._money ?? 0)
      if (have < n) return { error: `${payer.name} só tem $ ${have}.` }
      const fresh = await sql`SELECT data FROM sheets WHERE id = ${to.id}`
      const toHave = Number(fresh[0]?.data?._money ?? 0)
      await sql`UPDATE sheets SET data = jsonb_set(data, '{_money}', ${JSON.stringify(have - n)}::jsonb, true) WHERE id = ${payer.id}`
      await sql`UPDATE sheets SET data = jsonb_set(data, '{_money}', ${JSON.stringify(toHave + n)}::jsonb, true) WHERE id = ${to.id}`
      await post(c, { kind: "money", data: { pay: { from: payer.name, to: to.name, n }, ch: [{ name: payer.name, from: have, to: have - n }, { name: to.name, from: toHave, to: toHave + n }], by: c.me.name } })
      return { ok: true }
    }
    case "saldo": case "bolsa": {
      const s = mySheet(c, w)
      const list = c.isGM ? w.sheets : w.sheets.filter((x) => x.owner_member === c.me.id)
      if (!list.length && !s) return { error: "Você não tem fichas." }
      await post(c, { kind: "system", to: c.me.id, data: { icon: "flask" }, body: "Bolsas: " + list.map((x) => `${x.name} $ ${Number(x.data?._money ?? 0)}`).join(" · ") })
      return { ok: true }
    }
    case "img": case "imagem": case "foto": {
      const m = /^(https:\/\/\S+)(?:\s+([\s\S]*))?$/.exec(arg)
      if (!m) return { error: "Use /img https://link-da-imagem legenda (ou cole/arraste a imagem no chat)." }
      await post(c, { kind: "image", body: (m[2] ?? "").trim(), speaker: voice(c, w), data: { url: m[1], by: c.me.name } })
      return { ok: true }
    }
    case "ooc": case "off": case "fora":
      if (!arg) return { error: "Use /ooc mensagem fora do personagem." }
      await post(c, { kind: "ooc", body: arg })
      return { ok: true }
    case "grito": case "gritar":
      if (!arg) return { error: "Use /grito ALGUMA COISA!" }
      await post(c, { kind: "shout", body: arg.toUpperCase(), speaker: voice(c, w) })
      return { ok: true }
    case "cena":
      if (!c.isGM) return { error: "Só o mestre muda a cena." }
      await sql`UPDATE rooms SET scene = ${arg.slice(0, 80)} WHERE id = ${c.room.id}`
      await post(c, { kind: "scene", body: arg ? arg.slice(0, 80) : "A cena se dissolve…", speaker: "Cena" })
      return { ok: true }
    case "quem": case "presentes": {
      const list = w.members.map((m) => `${m.role === "gm" ? "👑 " : ""}${m.name}${m.sheet_id ? ` (${w.sheets.find((s) => s.id === m.sheet_id)?.name ?? "?"})` : ""}`).join(" · ")
      await post(c, { kind: "system", body: `À mesa: ${list}`, to: c.me.id, data: { icon: "users" } })
      return { ok: true }
    }
    case "revelar": case "mostrar": {
      if (!c.isGM) return { error: "Só o mestre faz revelações." }
      const m = /^(https:\/\/\S+)?\s*([\s\S]*)$/.exec(arg)!
      const image = m[1] ?? "", text = (m[2] ?? "").trim()
      if (!image && !text) return { error: "Use /revelar https://imagem.jpg Texto (imagem e/ou texto)." }
      const [title, ...rest] = text.split("|")
      await post(c, { kind: "reveal", speaker: "Revelação", body: rest.join("|").trim(), data: { image, title: title.trim() } })
      return { ok: true }
    }
    case "trilha": case "musica": case "ambiente": {
      if (!c.isGM) return { error: "Só o mestre escolhe a trilha." }
      const id = norm(arg).replace("silencio", "")
      const a = AMBIENCES.find((x) => x.id === id || norm(x.name).startsWith(id))
      if (!a || (arg && !a.id && id)) return { error: `Trilhas: ${AMBIENCES.map((x) => x.id || "silencio").join(", ")}.` }
      await sql`UPDATE rooms SET ambience = ${a.id} WHERE id = ${c.room.id}`
      await post(c, { kind: "system", body: a.id ? `Ao fundo: ${a.name}.` : "A trilha silencia.", data: { icon: a.icon } })
      return { ok: true }
    }
    case "ajuda": case "help": case "comandos":
      await post(c, { kind: "system", to: c.me.id, data: { icon: "help" }, body: "Comandos: /r /sr /me /w /ooc /grito /moeda /oraculo /pv /dano /cura /descansar /status /grana /pagar /saldo /teste /init /proximo /cond /quem /gm — e, para o mestre, /n /npc /cena /revelar /trilha /desfazer. A aba ? do painel esquerdo explica cada um." })
      return { ok: true }
    default:
      return changeAttr(c, w, cmd, arg)
  }
}
