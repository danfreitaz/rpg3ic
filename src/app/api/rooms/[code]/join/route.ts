import { createGuest, getIdentity } from "@/lib/auth"
import { sql, uid } from "@/lib/db"
import { fail, getRoom, json } from "@/lib/room"
import { COLORS } from "@/lib/types"

/** Entra na sala. Sem conta, vira convidado com o nome informado. */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const room = await getRoom(code)
  if (!room) return fail("Não existe sala com esse código.", 404)
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? "").trim().replace(/\s+/g, " ").slice(0, 24)
  let who = await getIdentity()
  if (!who) {
    if (name.length < 2) return fail("Escolha um nome com pelo menos 2 letras.")
    who = await createGuest(name)
  }
  const existing = await sql`SELECT id FROM members WHERE room_id = ${room.id} AND ident = ${who.ident}`
  if (existing.length) return json({ ok: true, code: room.code })
  const count = await sql`SELECT count(*)::int AS n FROM members WHERE room_id = ${room.id}`
  if (count[0].n >= 30) return fail("A sala está cheia (30 pessoas).")
  const display = (name.length >= 2 ? name : who.name).slice(0, 24)
  const role = who.userId && who.userId === room.owner_id ? "gm" : "player"
  const id = uid()
  await sql`INSERT INTO members (id, room_id, ident, name, role, color)
    VALUES (${id}, ${room.id}, ${who.ident}, ${display}, ${role}, ${COLORS[count[0].n % COLORS.length]})
    ON CONFLICT (room_id, ident) DO NOTHING`
  await sql`INSERT INTO messages (room_id, member_id, kind, speaker, body, data)
    VALUES (${room.id}, ${id}, 'system', 'RPG3ic', ${`${display} chegou à mesa.`}, '{"icon":"door"}'::jsonb)`
  return json({ ok: true, code: room.code })
}
