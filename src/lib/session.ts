import { NextRequest } from 'next/server'

export const SESSION_HEADER = 'x-session-id'
export const FALLBACK_SESSION = 'invitado-demo'

/**
 * Identidad ligera por sesión (beta sin login): el cliente genera un UUID
 * en localStorage y lo envía en la cabecera x-session-id en cada petición.
 */
export function getSessionId(req: NextRequest): string {
  const sid = req.headers.get(SESSION_HEADER)?.trim()
  return sid && sid.length >= 8 ? sid : FALLBACK_SESSION
}
