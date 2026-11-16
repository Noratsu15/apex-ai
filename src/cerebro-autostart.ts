/**
 * cerebro-autostart.ts — Solo runtime de Node (nunca Edge).
 *
 * En desarrollo garantiza que el cerebro Python (FastAPI) esté corriendo en
 * el puerto 8000; si el entorno se recicla, se rearma solo. En Vercel no hace
 * falta (VERCEL está definido y el servicio Python se despliega por separado
 * con la configuración de Services).
 */
import { spawn } from 'node:child_process'

try {
  const proceso = spawn('bash', ['scripts/start-cerebro.sh'], {
    cwd: process.cwd(),
    detached: true,
    stdio: 'ignore',
  })
  proceso.unref()
} catch (error) {
  // Nunca debe romper el arranque web: el respaldo TS cubre el servicio
  console.warn('[instrumentation] No pude lanzar el cerebro Python:', error)
}
