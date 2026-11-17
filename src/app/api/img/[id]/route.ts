import { sql } from "@/lib/db"

/** Entrega uma imagem do chat. O endereço é único e nunca muda, então pode ficar em cache para sempre. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/.test(id)) return new Response("not found", { status: 404 })
  const rows = await sql`SELECT mime, data FROM images WHERE id = ${id}`
  if (!rows.length) return new Response("not found", { status: 404 })
  return new Response(Buffer.from(rows[0].data, "base64"), {
    headers: { "Content-Type": rows[0].mime, "Cache-Control": "public, max-age=31536000, immutable" },
  })
}
