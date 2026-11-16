import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { obtenerMotor } from '@/lib/brain'
import { getSessionId } from '@/lib/session'
import { systemPromptDocumento } from '@/lib/prompts'
import { slugify } from '@/lib/markdown-to-docx'
import { aMensajeDTO, obtenerOCrearConversacion, tituloDesde } from '@/lib/chat-service'
import type { RespuestaGeneracionDTO } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 180

/** Extrae el objeto JSON { title, content } de la respuesta del modelo. */
function parsearDocumento(
  texto: string,
  prompt: string
): { title: string; content: string } {
  const limpio = texto
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  const inicio = limpio.indexOf('{')
  const fin = limpio.lastIndexOf('}')
  if (inicio !== -1 && fin > inicio) {
    try {
      const datos = JSON.parse(limpio.slice(inicio, fin + 1)) as {
        title?: string
        content?: string
      }
      if (datos.content && datos.content.trim().length > 0) {
        return {
          title: (datos.title ?? '').trim() || tituloDesde(prompt),
          content: datos.content.trim(),
        }
      }
    } catch {
      // JSON malformado: se usa el respaldo
    }
  }
  // Respaldo: toda la respuesta es el contenido del documento
  return { title: tituloDesde(prompt), content: limpio || prompt }
}

/**
 * POST /api/document — genera un documento profesional descargable en Word.
 * Body: { conversationId?: string, prompt: string }
 * El LLM redacta el documento en Markdown; se guarda y se ofrece como .docx.
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

  if (!prompt) return Response.json({ error: 'Describe el documento que necesitas' }, { status: 400 })
  if (prompt.length > 4000) prompt = prompt.slice(0, 4000)

  try {
    // Motor de IA: cerebro Python (FastAPI) con respaldo TypeScript
    const motor = await obtenerMotor()
    const texto = await motor.completar([
      { role: 'system', content: systemPromptDocumento },
      { role: 'user', content: prompt },
    ])
    if (!texto.trim()) throw new Error('El modelo devolvió una respuesta vacía')

    const { title, content } = parsearDocumento(texto, prompt)
    const fileName = `${slugify(title)}.docx`

    // 1. Guardar el documento
    const { conv, creada } = await obtenerOCrearConversacion(sessionId, conversationId)
    const titulo = creada || conv.title === 'Nueva conversación' ? `Documento: ${title}`.slice(0, 60) : conv.title
    if (titulo !== conv.title) {
      await db.conversation.update({ where: { id: conv.id }, data: { title: titulo } })
    }

    const documento = await db.generatedDocument.create({
      data: {
        sessionId,
        title,
        content,
        fileName,
        conversationId: conv.id,
      },
    })

    // 2. Persistir el intercambio en el historial
    const userMessage = await db.message.create({
      data: { conversationId: conv.id, role: 'user', content: prompt, kind: 'text' },
    })
    const resumen = content
      .replace(/[#*`>\-|]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 180)
    const assistantMessage = await db.message.create({
      data: {
        conversationId: conv.id,
        role: 'assistant',
        content: `He generado el documento «${title}». ${resumen}…`,
        kind: 'document',
        documentId: documento.id,
      },
    })
    await db.conversation.update({ where: { id: conv.id }, data: { updatedAt: new Date() } })

    const payload: RespuestaGeneracionDTO = {
      conversationId: conv.id,
      title: titulo,
      userMessage: aMensajeDTO(userMessage),
      assistantMessage: aMensajeDTO(assistantMessage),
      document: { id: documento.id, title, fileName },
    }
    return Response.json(payload)
  } catch (error) {
    console.error('[api/document]', error)
    return Response.json(
      {
        error:
          error instanceof Error
            ? `No pude generar el documento: ${error.message}`
            : 'No pude generar el documento. Inténtalo de nuevo.',
      },
      { status: 500 }
    )
  }
}
