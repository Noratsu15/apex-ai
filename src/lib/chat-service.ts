import { db } from '@/lib/db'
import { obtenerMotor } from '@/lib/brain'
import { systemPromptMemoria } from '@/lib/prompts'
import type { MensajeLLM } from '@/lib/brain'
import type { MensajeDTO } from '@/lib/types'

const MAX_MENSAJES_CONTEXTO = 20

/** Obtiene la conversación del usuario o crea una nueva si no existe. */
export async function obtenerOCrearConversacion(sessionId: string, conversationId?: string | null) {
  if (conversationId) {
    const conv = await db.conversation.findFirst({ where: { id: conversationId, sessionId } })
    if (conv) return { conv, creada: false }
  }
  const conv = await db.conversation.create({ data: { sessionId } })
  return { conv, creada: true }
}

/** Título corto y legible derivado del primer mensaje del usuario. */
export function tituloDesde(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  if (!limpio) return 'Nueva conversación'
  const capitalizado = limpio.charAt(0).toUpperCase() + limpio.slice(1)
  return capitalizado.length <= 42 ? capitalizado : capitalizado.slice(0, 42).trimEnd() + '…'
}

/** Últimos N mensajes de la conversación, en orden cronológico. */
export async function contextoMensajes(conversationId: string) {
  const mensajes = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'asc' },
  })
  return mensajes.slice(-MAX_MENSAJES_CONTEXTO)
}

/** Convierte una fila Prisma Message en el DTO que consume el frontend. */
export function aMensajeDTO(m: {
  id: string
  role: string
  content: string
  kind: string
  imageBase64?: string | null
  documentId?: string | null
  createdAt: Date
}): MensajeDTO {
  return {
    id: m.id,
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
    kind: (m.kind as MensajeDTO['kind']) || 'text',
    imageBase64: m.imageBase64 ?? null,
    documentId: m.documentId ?? null,
    createdAt: m.createdAt.toISOString(),
  }
}

const normalizar = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * Extrae hechos duraderos del último intercambio (memoria automática).
 * Falla en silencio: la memoria nunca debe romper el chat.
 */
export async function extraerMemorias(
  sessionId: string,
  mensajeUsuario: string,
  respuestaAsistente: string
): Promise<string[]> {
  try {
    const motor = await obtenerMotor()
    const existentes = await db.memory.findMany({ where: { sessionId }, select: { content: true } })

    const yaSabe =
      existentes.length > 0
        ? `\nLo que YA sabes del usuario (no lo repitas):\n${existentes
            .map((e) => `- ${e.content}`)
            .join('\n')}\n`
        : '\nLo que YA sabes del usuario: (nada todavía)\n'

    const mensajesMemoria: MensajeLLM[] = [
      { role: 'system', content: systemPromptMemoria },
      {
        role: 'user',
        content: `${yaSabe}\nIntercambio:\nUsuario: ${mensajeUsuario.slice(0, 1200)}\nAsistente: ${respuestaAsistente.slice(0, 800)}`,
      },
    ]
    const texto = await motor.completar(mensajesMemoria)
    const coincidencia = (texto || '[]').match(/\[[\s\S]*\]/)
    if (!coincidencia) return []
    const datos = JSON.parse(coincidencia[0]) as unknown
    if (!Array.isArray(datos)) return []

    const nuevas: string[] = []

    for (const item of datos.slice(0, 2)) {
      if (typeof item !== 'string' || item.trim().length < 8 || item.trim().length > 200) continue
      const hecho = item.trim()
      const n = normalizar(hecho)
      const duplicada =
        existentes.some((e) => {
          const en = normalizar(e.content)
          return en === n || en.includes(n) || n.includes(en)
        }) || nuevas.some((x) => normalizar(x) === n)
      if (duplicada) continue
      await db.memory.create({ data: { sessionId, content: hecho, source: 'auto' } })
      nuevas.push(hecho)
    }
    return nuevas
  } catch {
    return []
  }
}
