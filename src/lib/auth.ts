import { createNeonAuth } from "@neon/auth/next/server"
import { SignJWT, jwtVerify } from "jose"
import { cookies } from "next/headers"

let auth: ReturnType<typeof createNeonAuth> | undefined
export function getAuth() {
  return (auth ??= createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
  }))
}

export type Identity = { ident: string; name: string; userId: string | null; email?: string }

const GUEST_COOKIE = "r3_guest"
const key = () => new TextEncoder().encode("guest:" + process.env.NEON_AUTH_COOKIE_SECRET!)

/** Usuário logado, se houver. */
export async function getUser() {
  try {
    const { data } = await getAuth().getSession()
    return data?.user ?? null
  } catch {
    return null
  }
}

/** Quem está pedindo: conta logada ou convidado (cookie assinado). */
export async function getIdentity(): Promise<Identity | null> {
  const user = await getUser()
  if (user) return { ident: "u:" + user.id, name: user.name || user.email?.split("@")[0] || "Aventureiro", userId: user.id, email: user.email }
  const token = (await cookies()).get(GUEST_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, key())
    return { ident: "g:" + payload.sub, name: String(payload.name || "Convidado"), userId: null }
  } catch {
    return null
  }
}

/** Cria a identidade de convidado e grava o cookie. */
export async function createGuest(name: string): Promise<Identity> {
  const id = crypto.randomUUID()
  const token = await new SignJWT({ name }).setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt().setExpirationTime("60d").sign(key())
  ;(await cookies()).set(GUEST_COOKIE, token, { httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: 60 * 60 * 24 * 60 })
  return { ident: "g:" + id, name, userId: null }
}
