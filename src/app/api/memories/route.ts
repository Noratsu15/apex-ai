import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { getSessionId } from '@/lib/session'
import type { MemoriaDTO } from '@/lib/types'

export const runtime = 'nodejs'

/** GET /api/memories — memorias persistentes del usuario. */
export async function GET(req: NextRequest) {
  const sessionId = getSessionId(req)
  const memorias = await db.memory.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })
  const datos: MemoriaDTO[] = memorias.map((m) => ({
    id: m.id,
    content: m.content,
    source: m.source === 'manual' ? 'manual' : 'auto',
    createdAt: m.createdAt.toISOString(),
  }))
  return Response.json({ memories: datos })
}

/** POST /api/memories — añade una memoria manual ("recuerda que…"). */
export async function POST(req: NextRequest) {
  const sessionId = getSessionId(req)

  let content = ''
  try {
    const body = (await req.json()) as { content?: string }
    content = (body.content ?? '').trim()
  } catch {
    return Response.json({ error: 'Cuerpo de la petición inválido' }, { status: 400 })
  }
  if (!content) return Response.json({ error: 'La memoria no puede estar vacía' }, { status: 400 })
  if (content.length > 300) content = content.slice(0, 300)

  const memoria = await db.memory.create({ data: { sessionId, content, source: 'manual' } })
  return Response.json({
    memory: {
      id: memoria.id,
      content: memoria.content,
      source: 'manual',
      createdAt: memoria.createdAt.toISOString(),
    } satisfies MemoriaDTO,
  })
}
