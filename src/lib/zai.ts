import ZAI from 'z-ai-web-dev-sdk'

let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null

/**
 * Devuelve el singleton del SDK de IA (solo backend).
 * La configuración se lee de /etc/.z-ai-config o .z-ai-config del proyecto.
 */
export async function getZAI() {
  if (!zaiInstance) {
    zaiInstance = await ZAI.create()
  }
  return zaiInstance
}
