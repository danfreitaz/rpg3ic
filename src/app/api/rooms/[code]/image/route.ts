import { post } from "@/lib/commands"
import { sql, uid } from "@/lib/db"
import { ctx, fail, json } from "@/lib/room"

const MAX = 900 * 1024 // por imagem, já comprimida no navegador
const ROOM_MAX = 80 * 1024 * 1024 // por sala, para o banco gratuito durar

/** Recebe uma imagem (data URL) e a publica no chat. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const c = await ctx((await params).code)
  if (c instanceof Response) return c
  const body = await req.json().catch(() => ({}))
  const m = /^data:(image\/(?:webp|png|jpeg|gif));base64,([A-Za-z0-9+/=]+)$/.exec(String(body.data ?? ""))
  if (!m) return fail("Formato de imagem não aceito (use PNG, JPG, WEBP ou GIF).")
  const size = Math.floor((m[2].length * 3) / 4)
  if (size > MAX) return fail("Imagem grande demais, mesmo depois de comprimida (máx. 900 KB).")
  const used = await sql`SELECT coalesce(sum(size), 0)::bigint AS n FROM images WHERE room_id = ${c.room.id}`
  if (Number(used[0].n) + size > ROOM_MAX) return fail("Esta sala atingiu o limite de imagens. O mestre pode apagar mensagens antigas com imagem.")
  const id = uid()
  await sql`INSERT INTO images (id, room_id, member_id, mime, data, size) VALUES (${id}, ${c.room.id}, ${c.me.id}, ${m[1]}, ${m[2]}, ${size})`
  const caption = String(body.caption ?? "").trim().slice(0, 300)
  const w = Math.max(0, Math.min(4000, Number(body.w) || 0)), h = Math.max(0, Math.min(4000, Number(body.h) || 0))
  const sheet = c.me.sheet_id ? (await sql`SELECT name FROM sheets WHERE id = ${c.me.sheet_id}`)[0] : null
  await post(c, { kind: "image", body: caption, speaker: sheet?.name ?? c.me.name, data: { url: `/api/img/${id}`, w, h, by: c.me.name } })
  return json({ ok: true })
}
