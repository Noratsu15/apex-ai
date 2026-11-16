import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSessionId } from '@/lib/session'
import { aMensajeDTO } from '@/lib/chat-service'

export const runtime = 'nodejs'

type Contexto = { params: Promise<{ id: string }> }

/** GET /api/conversations/[id] — mensajes completos de una conversación. */
export async function GET(req: NextRequest, ctx: Contexto) {
  const sessionId = getSessionId(req)
  const { id } = await ctx.params

  const conv = await db.conversation.findFirst({ where: { id, sessionId } })
  if (!conv) return Response.json({ error: 'Conversación no encontrada' }, { status: 404 })

  const mensajes = await db.message.findMany({
    where: { conversationId: conv.id },
    orderBy: { createdAt: 'asc' },
  })

  return Response.json({
    conversation: {
      id: conv.id,
      title: conv.title,
      createdAt: conv.createdAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
    },
    messages: mensajes.map(aMensajeDTO),
  })
}

/** PATCH /api/conversations/[id] — renombra una conversación. */
export async function PATCH(req: NextRequest, ctx: Contexto) {
  const sessionId = getSessionId(req)
  const { id } = await ctx.params

  let title = ''
  try {
    const body = (await req.json()) as { title?: string }
    title = (body.title ?? '').trim()
  } catch {
    return Response.json({ error: 'Cuerpo de la petición inválido' }, { status: 400 })
  }
  if (!title) return Response.json({ error: 'El título no puede estar vacío' }, { status: 400 })
  if (title.length > 80) title = title.slice(0, 80)

  const conv = await db.conversation.findFirst({ where: { id, sessionId } })
  if (!conv) return Response.json({ error: 'Conversación no encontrada' }, { status: 404 })

  const actualizada = await db.conversation.update({
    where: { id: conv.id },
    data: { title },
  })
  return Response.json({ id: actualizada.id, title: actualizada.title })
}

/** DELETE /api/conversations/[id] — elimina la conversación y sus mensajes. */
export async function DELETE(req: NextRequest, ctx: Contexto) {
  const sessionId = getSessionId(req)
  const { id } = await ctx.params

  const conv = await db.conversation.findFirst({ where: { id, sessionId } })
  if (!conv) return Response.json({ error: 'Conversación no encontrada' }, { status: 404 })

  await db.conversation.delete({ where: { id: conv.id } })
  return Response.json({ ok: true })
}
