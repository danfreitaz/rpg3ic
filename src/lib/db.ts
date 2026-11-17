import { neon, type NeonQueryFunction } from "@neondatabase/serverless"

let _sql: NeonQueryFunction<false, false> | undefined
/** Cliente SQL criado no primeiro uso (o build não tem os segredos). */
export const sql: NeonQueryFunction<false, false> = ((strings: any, ...values: any[]) =>
  (_sql ??= neon(process.env.DATABASE_URL!))(strings, ...values)) as any

export const uid = () => crypto.randomUUID()

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ"
/** Código de sala: 6 letras diferentes entre si. */
export function roomCode() {
  const pool = LETTERS.split("")
  let out = ""
  for (let i = 0; i < 6; i++) out += pool.splice(Math.floor(Math.random() * pool.length), 1)[0]
  return out
}
