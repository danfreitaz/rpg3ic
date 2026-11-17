import { nextTurn, post, setRole } from "@/lib/commands"
import { sql, uid } from "@/lib/db"
import { ctx, fail, json, type Ctx } from "@/lib/room"
import { blankData, EMPTY_INIT, norm, type Field, type Sheet, type Template, type Token } from "@/lib/types"

// Chaves que colidiriam com comandos do chat.
const RESERVED = new Set(["r", "rolar", "roll", "dado", "sr", "rs", "gmr", "secreto", "me", "acao", "a", "w", "s", "sussurro", "sussurrar", "n", "narrar", "narracao", "npc", "como", "desfazer", "undo", "init", "iniciativa", "proximo", "prox", "next", "turno", "cond", "condicao", "gm", "mestre"])
const str = (v: any, max: number) => String(v ?? "").trim().slice(0, max)
const url = (v: any) => { const s = str(v, 600); return /^https:\/\/\S+$/.test(s) ? s : "" }
const hex = (v: any, d = "#c9a24b") => (/^#[0-9a-f]{6}$/i.test(String(v)) ? String(v) : d)
const int = (v: any, lo: number, hi: number, d: number) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d }

async function sheetOf(c: Ctx, id: any): Promise<Sheet | null> {
  const r = await sql`SELECT * FROM sheets WHERE id = ${String(id)} AND room_id = ${c.room.id}`
  return (r[0] as Sheet) ?? null
}

async function act(c: Ctx, b: any): Promise<any> {
  const GM = "Só o mestre pode fazer isso."
  switch (b.a) {
    // ───── Fichas
    case "sheet.create": {
      const tpl = c.room.templates.find((t) => t.id === b.template_id)
      if (!tpl) return { error: "Modelo de ficha não encontrado." }
      if (!c.isGM && tpl.kind !== "pc") return { error: GM }
      const id = uid(), mine = !c.isGM || b.mine === true
      await sql`INSERT INTO sheets (id, room_id, template_id, kind, owner_member, name, data, hidden)
        VALUES (${id}, ${c.room.id}, ${tpl.id}, ${tpl.kind}, ${mine ? c.me.id : null}, ${str(b.name, 40) || "Sem nome"}, ${JSON.stringify(blankData(tpl))}::jsonb, ${tpl.kind !== "pc"})`
      if (mine && !c.me.sheet_id) await sql`UPDATE members SET sheet_id = ${id} WHERE id = ${c.me.id}`
      return { id }
    }
    case "sheet.update": {
      const s = await sheetOf(c, b.id)
      if (!s) return { error: "Ficha não encontrada." }
      if (!c.isGM && s.owner_member !== c.me.id) return { error: "Essa ficha não é sua." }
      if (b.data && typeof b.data === "object") {
        const patch = JSON.stringify(b.data)
        if (patch.length > 20000) return { error: "Texto grande demais para a ficha." }
        await sql`UPDATE sheets SET data = data || ${patch}::jsonb WHERE id = ${s.id}`
      }
      if (b.name !== undefined) await sql`UPDATE sheets SET name = ${str(b.name, 40) || s.name} WHERE id = ${s.id}`
      if (b.avatar !== undefined) await sql`UPDATE sheets SET avatar = ${url(b.avatar)} WHERE id = ${s.id}`
      if (b.hidden !== undefined && c.isGM) await sql`UPDATE sheets SET hidden = ${!!b.hidden} WHERE id = ${s.id}`
      if (b.owner_member !== undefined && c.isGM) await sql`UPDATE sheets SET owner_member = ${b.owner_member ? String(b.owner_member) : null} WHERE id = ${s.id}`
      return {}
    }
    case "sheet.delete": {
      const s = await sheetOf(c, b.id)
      if (!s) return {}
      if (!c.isGM && s.owner_member !== c.me.id) return { error: "Essa ficha não é sua." }
      await sql`DELETE FROM sheets WHERE id = ${s.id}`
      await sql`UPDATE members SET sheet_id = NULL WHERE room_id = ${c.room.id} AND sheet_id = ${s.id}`
      return {}
    }
    case "sheet.use": {
      if (b.id === null) { await sql`UPDATE members SET sheet_id = NULL WHERE id = ${c.me.id}`; return {} }
      const s = await sheetOf(c, b.id)
      if (!s || (!c.isGM && s.owner_member !== c.me.id)) return { error: "Você não pode usar essa ficha." }
      await sql`UPDATE members SET sheet_id = ${s.id} WHERE id = ${c.me.id}`
      return {}
    }
    // ───── Modelos de ficha
    case "tpl.save": {
      if (!c.isGM) return { error: GM }
      const t = b.tpl ?? {}
      const seen = new Set<string>()
      const fields: Field[] = (Array.isArray(t.fields) ? t.fields : []).slice(0, 40).map((f: any) => {
        let key = norm(f.key || f.label).replace(/[^a-z0-9]/g, "").slice(0, 16) || "campo"
        if (RESERVED.has(key)) key += "x"
        while (seen.has(key)) key += "x"
        seen.add(key)
        const type = ["bar", "num", "text", "long"].includes(f.type) ? f.type : "num"
        return { key, label: str(f.label, 40) || key.toUpperCase(), type, def: type === "bar" || type === "num" ? Number(f.def) || 0 : str(f.def, 200) }
      })
      if (!fields.length) return { error: "O modelo precisa de pelo menos um campo." }
      const tpl: Template = { id: str(t.id, 40) || uid(), name: str(t.name, 40) || "Modelo novo", kind: ["pc", "npc", "creature"].includes(t.kind) ? t.kind : "pc", fields }
      const list = c.room.templates.some((x) => x.id === tpl.id) ? c.room.templates.map((x) => (x.id === tpl.id ? tpl : x)) : [...c.room.templates, tpl]
      if (list.length > 30) return { error: "Limite de 30 modelos por sala." }
      await sql`UPDATE rooms SET templates = ${JSON.stringify(list)}::jsonb WHERE id = ${c.room.id}`
      return { id: tpl.id }
    }
    case "tpl.delete": {
      if (!c.isGM) return { error: GM }
      const used = await sql`SELECT 1 FROM sheets WHERE room_id = ${c.room.id} AND template_id = ${String(b.id)} LIMIT 1`
      if (used.length) return { error: "Há fichas usando esse modelo. Apague-as antes." }
      await sql`UPDATE rooms SET templates = ${JSON.stringify(c.room.templates.filter((x) => x.id !== b.id))}::jsonb WHERE id = ${c.room.id}`
      return {}
    }
    // ───── Histórias, locais e diário
    case "note.save": {
      const kind = ["story", "place", "diary"].includes(b.kind) ? b.kind : "diary"
      if (kind !== "diary" && !c.isGM) return { error: GM }
      const title = str(b.title, 80) || "Sem título", body = String(b.body ?? "").slice(0, 12000)
      if (b.id) {
        const r = await sql`UPDATE notes SET title = ${title}, body = ${body}, hidden = ${!!b.hidden}
          WHERE id = ${String(b.id)} AND room_id = ${c.room.id} AND (${c.isGM} OR author_member = ${c.me.id}) RETURNING id`
        return r.length ? { id: b.id } : { error: "Você não pode editar essa anotação." }
      }
      const id = uid()
      await sql`INSERT INTO notes (id, room_id, kind, title, body, hidden, author_member) VALUES (${id}, ${c.room.id}, ${kind}, ${title}, ${body}, ${!!b.hidden}, ${c.me.id})`
      return { id }
    }
    case "note.delete":
      await sql`DELETE FROM notes WHERE id = ${String(b.id)} AND room_id = ${c.room.id} AND (${c.isGM} OR author_member = ${c.me.id})`
      return {}
    // ───── Mapa
    case "map.set": {
      if (!c.isGM) return { error: GM }
      const p: any = {}
      if (b.image !== undefined) p.image = url(b.image)
      if (b.cols !== undefined) p.cols = int(b.cols, 4, 60, 24)
      if (b.rows !== undefined) p.rows = int(b.rows, 4, 60, 16)
      if (b.fogOn !== undefined) p.fogOn = !!b.fogOn
      if (b.fog !== undefined) p.fog = String(b.fog).replace(/[^01]/g, "").slice(0, 3600)
      await sql`UPDATE rooms SET map = map || ${JSON.stringify(p)}::jsonb WHERE id = ${c.room.id}`
      return {}
    }
    case "token.put": {
      if (!c.isGM) return { error: GM }
      const id = str(b.id, 40) || uid()
      const tok: Token = { id, label: str(b.label, 24) || "?", sheet_id: b.sheet_id ? String(b.sheet_id) : null, x: Number(b.x) || 0, y: Number(b.y) || 0, color: hex(b.color), hidden: !!b.hidden, size: int(b.size, 1, 4, 1) }
      if (Object.keys(c.room.map?.tokens ?? {}).length >= 80 && !c.room.map.tokens[id]) return { error: "Limite de 80 peças no mapa." }
      await sql`UPDATE rooms SET map = jsonb_set(CASE WHEN map ? 'tokens' THEN map ELSE map || '{"tokens":{}}'::jsonb END, ARRAY['tokens', ${id}]::text[], ${JSON.stringify(tok)}::jsonb, true) WHERE id = ${c.room.id}`
      return { id }
    }
    case "token.move": {
      const tok = c.room.map?.tokens?.[String(b.id)]
      if (!tok) return {}
      if (!c.isGM) {
        const s = tok.sheet_id ? await sheetOf(c, tok.sheet_id) : null
        if (!s || s.owner_member !== c.me.id) return { error: "Só o mestre move essa peça." }
      }
      const next = { ...tok, x: Number(b.x) || 0, y: Number(b.y) || 0 }
      await sql`UPDATE rooms SET map = jsonb_set(map, ARRAY['tokens', ${tok.id}]::text[], ${JSON.stringify(next)}::jsonb, true) WHERE id = ${c.room.id}`
      return {}
    }
    case "token.del":
      if (!c.isGM) return { error: GM }
      await sql`UPDATE rooms SET map = map #- ARRAY['tokens', ${String(b.id)}]::text[] WHERE id = ${c.room.id}`
      return {}
    // ───── Iniciativa
    case "init.set": {
      if (!c.isGM) return { error: GM }
      const i = b.init ?? EMPTY_INIT
      const order = (Array.isArray(i.order) ? i.order : []).slice(0, 60).map((e: any) => ({ id: str(e.id, 60), name: str(e.name, 40), init: Number(e.init) || 0, sheet_id: e.sheet_id ? String(e.sheet_id) : null }))
      const init = { on: !!i.on && order.length > 0, round: int(i.round, 1, 9999, 1), turn: int(i.turn, 0, Math.max(0, order.length - 1), 0), order }
      await sql`UPDATE rooms SET init = ${JSON.stringify(init)}::jsonb WHERE id = ${c.room.id}`
      return {}
    }
    case "init.next":
      return nextTurn(c)
    // ───── Sala e pessoas
    case "room.set": {
      if (!c.isGM && !c.isOwner) return { error: GM }
      if (b.name !== undefined) await sql`UPDATE rooms SET name = ${str(b.name, 60) || c.room.name} WHERE id = ${c.room.id}`
      if (b.scene !== undefined) await sql`UPDATE rooms SET scene = ${str(b.scene, 80)} WHERE id = ${c.room.id}`
      if (b.gm_locked !== undefined) {
        if (!c.isOwner) return { error: "Só quem criou a sala trava o posto de mestre." }
        await sql`UPDATE rooms SET gm_locked = ${!!b.gm_locked} WHERE id = ${c.room.id}`
        if (b.gm_locked) await sql`UPDATE members SET role = 'player' WHERE room_id = ${c.room.id} AND id <> ${c.me.id}`
        await sql`UPDATE members SET role = 'gm' WHERE id = ${c.me.id}`
        await post(c, { kind: "system", body: b.gm_locked ? `${c.me.name} travou o posto de mestre: agora há um único mestre.` : "O posto de mestre foi liberado: qualquer um pode assumir.", data: { icon: "crown" } })
      }
      return {}
    }
    case "role.set": {
      const role = b.role === "gm" ? "gm" : "player"
      if (!b.member_id || b.member_id === c.me.id) return setRole(c, role)
      if (!c.isOwner) return { error: "Só quem criou a sala muda o papel dos outros." }
      await sql`UPDATE members SET role = ${role} WHERE id = ${String(b.member_id)} AND room_id = ${c.room.id}`
      return {}
    }
    case "me.set": {
      if (b.name !== undefined) { const n = str(b.name, 24); if (n.length >= 2) await sql`UPDATE members SET name = ${n} WHERE id = ${c.me.id}` }
      if (b.color !== undefined) await sql`UPDATE members SET color = ${hex(b.color)} WHERE id = ${c.me.id}`
      return {}
    }
    default:
      return { error: "Ação desconhecida." }
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const c = await ctx((await params).code)
  if (c instanceof Response) return c
  const body = await req.json().catch(() => ({}))
  try {
    const out = await act(c, body)
    return out?.error ? fail(out.error) : json({ ok: true, ...out })
  } catch (e) {
    console.error("[act]", body?.a, e)
    return fail("Algo deu errado. Tente de novo.", 500)
  }
}
