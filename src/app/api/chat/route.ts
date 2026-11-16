import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { obtenerMotor } from '@/lib/brain'
import { getSessionId } from '@/lib/session'
import { systemPromptChat } from '@/lib/prompts'
import {
  contextoMensajes,
  extraerMemorias,
  obtenerOCrearConversacion,
  tituloDesde,
} from '@/lib/chat-service'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * POST /api/chat — chat con streaming SSE.
 * Body: { conversationId?: string, content: string }
 * Eventos: { type: "delta" | "done" | "memory" | "error", ... }
 */
export async function POST(req: NextRequest) {
  const sessionId = getSessionId(req)

  let content = ''
  let conversationId: string | undefined
  try {
    const body = (await req.json()) as { conversationId?: string; content?: string }
    content = (body.content ?? '').trim()
    conversationId = body.conversationId ?? undefined
  } catch {
    return Response.json({ error: 'Cuerpo de la petición inválido' }, { status: 400 })
  }

  if (!content) return Response.json({ error: 'El mensaje no puede estar vacío' }, { status: 400 })
  if (content.length > 8000) content = content.slice(0, 8000)

  // 1. Conversación + persistencia del mensaje del usuario
  const { conv, creada } = await obtenerOCrearConversacion(sessionId, conversationId)
  const tituloNueva = creada || conv.title === 'Nueva conversación' ? tituloDesde(content) : conv.title
  if (tituloNueva !== conv.title) {
    await db.conversation.update({ where: { id: conv.id }, data: { title: tituloNueva } })
  }
  await db.message.create({
    data: { conversationId: conv.id, role: 'user', content, kind: 'text' },
  })

  // 2. Contexto: memorias persistentes + últimos mensajes
  const memorias = await db.memory.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { content: true },
  })
  const historial = await contextoMensajes(conv.id)
  const mensajesLLM = [
    { role: 'system' as const, content: systemPromptChat(memorias.map((m) => m.content)) },
    ...historial.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.kind === 'image' ? `[imagen generada: ${m.content}]` : m.content,
    })),
  ]

  const encoder = new TextEncoder()

  const flujo = new ReadableStream<Uint8Array>({
    async start(controller) {
      const enviar = (obj: Record<string, unknown>) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        // Motor de IA: cerebro Python (FastAPI) con respaldo TypeScript
        const motor = await obtenerMotor()
        let completo = ''
        for await (const delta of motor.streamChat(mensajesLLM)) {
          completo += delta
          enviar({ type: 'delta', content: delta })
        }

        if (!completo.trim()) {
          throw new Error('El modelo devolvió una respuesta vacía')
        }

        // 3. Persistir la respuesta del asistente
        const guardado = await db.message.create({
          data: { conversationId: conv.id, role: 'assistant', content: completo, kind: 'text' },
        })
        await db.conversation.update({
          where: { id: conv.id },
          data: { updatedAt: new Date() },
        })

        enviar({
          type: 'done',
          conversationId: conv.id,
          title: tituloNueva,
          messageId: guardado.id,
        })

        // 4. Memoria automática (después de enviar el contenido, no bloquea la lectura)
        const nuevas = await extraerMemorias(sessionId, content, completo)
        if (nuevas.length > 0) enviar({ type: 'memory', memories: nuevas })
      } catch (error) {
        console.error('[api/chat]', error)
        enviar({
          type: 'error',
          message:
            error instanceof Error
              ? `No pude generar la respuesta: ${error.message}`
              : 'No pude generar la respuesta. Inténtalo de nuevo.',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(flujo, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
