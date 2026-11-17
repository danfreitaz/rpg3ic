import { getAuth } from "@/lib/auth"

type C = { params: Promise<{ path: string[] }> }
export const GET = (r: Request, c: C) => getAuth().handler().GET(r, c)
export const POST = (r: Request, c: C) => getAuth().handler().POST(r, c)
export const PUT = (r: Request, c: C) => getAuth().handler().PUT(r, c)
export const PATCH = (r: Request, c: C) => getAuth().handler().PATCH(r, c)
export const DELETE = (r: Request, c: C) => getAuth().handler().DELETE(r, c)
