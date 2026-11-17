import { getIdentity } from "@/lib/auth"
import { roomCode, sql, uid } from "@/lib/db"
import { fail, json } from "@/lib/room"
import { COLORS, DEFAULT_TEMPLATES, EMPTY_INIT, EMPTY_MAP } from "@/lib/types"

/** Salas em que já estou. */
export async function GET() {
  const who = await getIdentity()
  if (!who) return json({ rooms: [] })
  const rooms = await sql`
    SELECT r.code, r.name, r.scene, m.role, (r.owner_id = ${who.userId ?? ""}) AS mine,
           (SELECT count(*)::int FROM members x WHERE x.room_id = r.id) AS people
    FROM members m JOIN rooms r ON r.id = m.room_id
    WHERE m.ident = ${who.ident} ORDER BY m.created_at DESC LIMIT 30`
  return json({ rooms })
}

/** Cria uma sala (só para quem tem conta). */
export async function POST(req: Request) {
  const who = await getIdentity()
  if (!who?.userId) return fail("Entre com sua conta para criar uma sala.", 401)
  const body = await req.json().catch(() => ({}))
  const name = String(body.name ?? "").trim().slice(0, 60) || "Mesa sem nome"
  const id = uid()
  let code = ""
  for (let i = 0; i < 6 && !code; i++) {
    const tryCode = roomCode()
    const r = await sql`INSERT INTO rooms (id, code, name, owner_id, map, init, templates)
      VALUES (${id}, ${tryCode}, ${name}, ${who.userId}, ${JSON.stringify(EMPTY_MAP)}::jsonb, ${JSON.stringify(EMPTY_INIT)}::jsonb, ${JSON.stringify(DEFAULT_TEMPLATES)}::jsonb)
      ON CONFLICT (code) DO NOTHING RETURNING code`
    if (r.length) code = tryCode
  }
  if (!code) return fail("Não consegui gerar um código de sala. Tente de novo.", 500)
  const memberId = uid()
  await sql`INSERT INTO members (id, room_id, ident, name, role, color) VALUES (${memberId}, ${id}, ${who.ident}, ${who.name.slice(0, 24)}, 'gm', ${COLORS[0]})`
  await sql`INSERT INTO messages (room_id, member_id, kind, speaker, body, data)
    VALUES (${id}, ${memberId}, 'system', 'RPG3ic', ${`A mesa "${name}" foi aberta. Chame o grupo com o código ${code}.`}, '{"icon":"door"}'::jsonb)`
  return json({ code })
}
