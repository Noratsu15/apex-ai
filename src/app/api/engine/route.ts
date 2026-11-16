import { estadoMotor } from '@/lib/brain'

export const runtime = 'nodejs'

/**
 * GET /api/engine — motor de IA que atiende la app en este momento.
 * Lo consume el badge de la interfaz: Python (principal) o TypeScript (respaldo).
 */
export async function GET() {
  try {
    const estado = await estadoMotor()
    return Response.json(estado, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ motor: 'ninguno', detalle: 'Sin motor de IA configurado' })
  }
}
