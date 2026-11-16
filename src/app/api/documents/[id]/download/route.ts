import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { docxViaPython } from '@/lib/brain'
import { getSessionId } from '@/lib/session'
import { markdownADocx } from '@/lib/markdown-to-docx'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * GET /api/documents/[id]/download — descarga el documento en formato Word.
 * El .docx se construye al vuelo a partir del Markdown almacenado.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const sessionId = getSessionId(req)
  const { id } = await ctx.params

  const documento = await db.generatedDocument.findFirst({ where: { id, sessionId } })
  if (!documento) return Response.json({ error: 'Documento no encontrado' }, { status: 404 })

  try {
    // 1. El .docx lo construye el cerebro Python con python-docx
    const viaPython = await docxViaPython(documento.title, documento.content, documento.fileName)
    // 2. Respaldo: conversor TypeScript (docx) si Python no está disponible
    const buffer = viaPython?.buffer ?? (await markdownADocx(documento.title, documento.content))
    const nombreSeguro = (viaPython?.fileName ?? documento.fileName).replace(/[^\w.-]/g, '_')

    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${nombreSeguro}"; filename*=UTF-8''${encodeURIComponent(documento.fileName)}`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('[api/documents/download]', error)
    return Response.json({ error: 'No pude generar el archivo Word' }, { status: 500 })
  }
}
