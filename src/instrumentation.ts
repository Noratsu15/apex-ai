/**
 * instrumentation.ts — Punto de entrada que Next.js ejecuta al arrancar.
 *
 * El código específico de Node (lanzar el cerebro Python) vive en un módulo
 * aparte que solo se importa en el runtime de Node, nunca en el Edge.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs' && !process.env.VERCEL && !process.env.AURORA_NO_AUTOSTART) {
    await import('./cerebro-autostart')
  }
}
