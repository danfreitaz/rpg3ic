import { getIdentity, type Identity } from "./auth"
import { sql } from "./db"
import type { Member, Room } from "./types"

export type Ctx = { room: Room; me: Member & { ident: string }; who: Identity; isGM: boolean; isOwner: boolean }

export const json = (data: any, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } })
export const fail = (error: string, status = 400) => json({ error }, status)

export async function getRoom(code: string): Promise<Room | null> {
  const rows = await sql`SELECT * FROM rooms WHERE code = ${String(code).toUpperCase()}`
  return (rows[0] as Room) ?? null
}

/** Sala + membro de quem pede. Retorna Response de erro quando não autorizado. */
export async function ctx(code: string): Promise<Ctx | Response> {
  const who = await getIdentity()
  if (!who) return fail("Entre na sala primeiro.", 401)
  const room = await getRoom(code)
  if (!room) return fail("Sala não encontrada.", 404)
  const rows = await sql`SELECT * FROM members WHERE room_id = ${room.id} AND ident = ${who.ident}`
  const me = rows[0] as (Member & { ident: string }) | undefined
  if (!me) return fail("Você ainda não entrou nesta sala.", 403)
  const isOwner = who.userId !== null && who.userId === room.owner_id
  return { room, me, who, isGM: me.role === "gm", isOwner }
}
