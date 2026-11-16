import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getZAI } from '@/lib/zai'
import { getSessionId } from '@/lib/session'
import { systemPromptImagen } from '@/lib/prompts'
import { aMensajeDTO, obtenerOCrearConversacion, tituloDesde } from '@/lib/chat-service'

export const runtime = 'nodejs'
export const maxDuration = 180

/**
 * POST /api/image — genera una imagen a partir de un prompt.
 * Body: { conversationId?: string, prompt: string }
 * El prompt del usuario se enriquece con el LLM (español → inglés visual)
 * y luego se envía al modelo text-to-image. La imagen vuelve como data URL
 * y queda persistida en el historial de la conversación.
 */
export async function POST(req: NextRequest) {
  const sessionId = getSessionId(req)

  let prompt = ''
  let conversationId: string | undefined
  try {
    const body = (await req.json()) as { conversationId?: string; prompt?: string }
    prompt = (body.prompt ?? '').trim()
    conversationId = body.conversationId ?? undefined
  } catch {
    return Response.json({ error: 'Cuerpo de la petición inválido' }, { status: 400 })
  }

  if (!prompt) return Response.json({ error: 'Describe la imagen que quieres generar' }, { status: 400 })
  if (prompt.length > 2000) prompt = prompt.slice(0, 2000)

  try {
    const zai = await getZAI()

    // 1. Enriquecer el prompt (con respaldo si falla)
    let promptFinal = prompt
    try {
      const mejora = await zai.chat.completions.create({
        messages: [
          { role: 'system', content: systemPromptImagen },
          { role: 'user', content: prompt },
        ],
        thinking: { type: 'disabled' },
      })
      const descripcion = (mejora?.choices?.[0]?.message?.content ?? '').trim()
      if (descripcion.length > 10) promptFinal = descripcion
    } catch {
      // se usa el prompt original
    }

    // 2. Generar la imagen (base64)
    const respuesta = await zai.images.generations.create({
      prompt: promptFinal,
      size: '1024x1024',
    })
    const base64 = respuesta.data?.[0]?.base64
    if (!base64) throw new Error('El modelo no devolvió ninguna imagen')

    // 3. Persistir en la conversación
    const { conv, creada } = await obtenerOCrearConversacion(sessionId, conversationId)
    const titulo = creada || conv.title === 'Nueva conversación' ? `Imagen: ${tituloDesde(prompt)}` : conv.title
    if (titulo !== conv.title) {
      await db.conversation.update({ where: { id: conv.id }, data: { title: titulo } })
    }

    const userMessage = await db.message.create({
      data: { conversationId: conv.id, role: 'user', content: prompt, kind: 'text' },
    })
    const assistantMessage = await db.message.create({
      data: {
        conversationId: conv.id,
        role: 'assistant',
        content: promptFinal,
        kind: 'image',
        imageBase64: `data:image/png;base64,${base64}`,
      },
    })
    await db.conversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } })

    return Response.json({
      conversationId: conv.id,
      title: titulo,
      userMessage: aMensajeDTO(userMessage),
      assistantMessage: aMensajeDTO(assistantMessage),
    })
  } catch (error) {
    console.error('[api/image]', error)
    return Response.json(
      {
        error:
          error instanceof Error
            ? `No pude generar la imagen: ${error.message}`
            : 'No pude generar la imagen. Inténtalo de nuevo.',
      },
      { status: 500 }
    )
  }
}
