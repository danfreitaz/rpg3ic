import { createRealtime, rawSql } from "@neon/realtime/server"

let rt: ReturnType<typeof create> | undefined
const create = () => createRealtime({ secret: process.env.NEON_REALTIME_SECRET!, db: "neondb" })
const realtime = () => (rt ??= create())

export const LIVE = ["room", "members", "messages", "sheets", "notes"] as const
export type LiveName = (typeof LIVE)[number]

/** As consultas vivas da sala. A visibilidade (sussurros, fichas ocultas) é decidida aqui, no servidor. */
function query(name: LiveName, roomId: string, memberId: string) {
  switch (name) {
    case "room":
      return rawSql<any>(
        `SELECT id, code, name, owner_id, gm_locked, skin, scene, map, init, templates FROM rooms WHERE id = $1`,
        [roomId]
      )
    case "members":
      return rawSql<any>(
        `SELECT id, name, role, color, sheet_id, created_at FROM members WHERE room_id = $1 ORDER BY created_at`,
        [roomId]
      )
    case "messages":
      return rawSql<any>(
        `SELECT m.seq, m.member_id, m.kind, m.speaker, m.color, m.body, m.data, m.to_member, m.secret, m.created_at
         FROM messages m JOIN members me ON me.id = $2
         WHERE m.room_id = $1
           AND ((m.secret = false AND m.to_member IS NULL) OR m.member_id = $2 OR m.to_member = $2 OR me.role = 'gm')
         ORDER BY m.seq DESC LIMIT 250`,
        [roomId, memberId]
      )
    case "sheets":
      return rawSql<any>(
        `SELECT s.id, s.template_id, s.kind, s.owner_member, s.name, s.avatar, s.data, s.hidden, s.created_at
         FROM sheets s JOIN members me ON me.id = $2
         WHERE s.room_id = $1 AND (s.hidden = false OR me.role = 'gm' OR s.owner_member = $2)
         ORDER BY s.created_at`,
        [roomId, memberId]
      )
    case "notes":
      return rawSql<any>(
        `SELECT n.id, n.kind, n.title, n.body, n.hidden, n.author_member, n.created_at
         FROM notes n JOIN members me ON me.id = $2
         WHERE n.room_id = $1 AND (n.hidden = false OR me.role = 'gm' OR n.author_member = $2)
         ORDER BY n.created_at`,
        [roomId, memberId]
      )
  }
}

export const seal = (name: LiveName, roomId: string, memberId: string) =>
  realtime().seal({ query: query(name, roomId, memberId) })
