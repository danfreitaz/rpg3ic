import { LIVE, seal, type LiveName } from "@/lib/realtime"
import { ctx, fail, json } from "@/lib/room"

/** Entrega as consultas vivas seladas. Com `q`, renova só uma (chamado ~1x por minuto). */
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const c = await ctx((await params).code)
  if (c instanceof Response) return c
  const body = await req.json().catch(() => ({}))
  if (body.q) {
    if (!LIVE.includes(body.q)) return fail("Consulta desconhecida.")
    return json(await seal(body.q as LiveName, c.room.id, c.me.id))
  }
  const sealed = await Promise.all(LIVE.map((q) => seal(q, c.room.id, c.me.id)))
  return json({
    url: process.env.NEON_REALTIME_URL,
    me: { id: c.me.id, owner: c.isOwner, account: c.who.userId !== null },
    queries: Object.fromEntries(LIVE.map((q, i) => [q, sealed[i]])),
  })
}
