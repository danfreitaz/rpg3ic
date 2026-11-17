import { RoomApp } from "@/components/room/RoomApp"

export const dynamic = "force-dynamic"

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  return <RoomApp code={code.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6)} />
}
