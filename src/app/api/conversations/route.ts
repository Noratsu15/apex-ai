import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSessionId } from '@/lib/session'
import type { ConversacionResumenDTO } from '@/lib/types'

export const runtime = 'nodejs'

/** GET /api/conversations — historial de chats del usuario, con vista previa. */
export async function GET(req: NextRequest) {
  const sessionId = getSessionId(req)

  const conversaciones = await db.conversation.findMany({
    where: { sessionId },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: { messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { content: true } } },
  })

  const datos: ConversacionResumenDTO[] = conversaciones.map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
    totalMensajes: 0, // se completa con el conteo agrupado
    previa: c.messages[0]?.content?.replace(/\s+/g, ' ').slice(0, 80) ?? '',
  }))

  // Conteo real de mensajes por conversación (una sola consulta agrupada)
  const conteos = await db.message.groupBy({
    by: ['conversationId'],
    where: { conversationId: { in: conversaciones.map((c) => c.id) } },
    _count: { id: true },
  })
  const mapa = new Map(conteos.map((c) => [c.conversationId, c._count.id]))
  datos.forEach((d) => {
    d.totalMensajes = mapa.get(d.id) ?? 0
  })

  return Response.json({ conversations: datos })
}
