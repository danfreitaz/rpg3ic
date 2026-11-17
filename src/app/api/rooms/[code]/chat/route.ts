import { handleChat } from "@/lib/commands"
import { ctx, fail, json } from "@/lib/room"

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const c = await ctx((await params).code)
  if (c instanceof Response) return c
  const body = await req.json().catch(() => ({}))
  try {
    const out = await handleChat(c, body.text)
    return out.error ? fail(out.error) : json({ ok: true })
  } catch (e) {
    console.error("[chat]", e)
    return fail("Algo deu errado ao enviar. Tente de novo.", 500)
  }
}
