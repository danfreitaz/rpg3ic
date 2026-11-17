import { sql } from "./db"
import { looksLikeRoll, rollExpr } from "./dice"
import type { Ctx } from "./room"
import { EMPTY_INIT, norm, type Cond, type InitState, type Member, type Sheet, type Template } from "./types"

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
    return f ? Number(target.data?.[f.key] ?? 0) : null
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
    default:
      return changeAttr(c, w, cmd, arg)
  }
}
