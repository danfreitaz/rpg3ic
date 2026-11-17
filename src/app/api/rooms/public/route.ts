import { sql } from "@/lib/db"
import { json } from "@/lib/room"

/** Mesas públicas, as mais movimentadas primeiro. */
export async function GET() {
  const rooms = await sql`
    SELECT r.code, r.name, r.scene, r.last_active,
           (SELECT count(*)::int FROM members m WHERE m.room_id = r.id) AS people,
           (SELECT m.name FROM members m WHERE m.room_id = r.id AND m.role = 'gm' ORDER BY m.created_at LIMIT 1) AS gm
    FROM rooms r
    WHERE r.public = true AND r.last_active > now() - interval '14 days'
    ORDER BY r.last_active DESC LIMIT 24`
  return json({ rooms })
}
