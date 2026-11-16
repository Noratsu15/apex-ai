import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSessionId } from '@/lib/session'

export const runtime = 'nodejs'

/** DELETE /api/memories/[id] — elimina una memoria concreta. */
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = getSessionId(req)
  const { id } = await ctx.params

  const memoria = await db.memory.findFirst({ where: { id, sessionId } })
  if (!memoria) return Response.json({ error: 'Memoria no encontrada' }, { status: 404 })

  await db.memory.delete({ where: { id: memoria.id } })
  return Response.json({ ok: true })
}
