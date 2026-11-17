'use client'

import { useEffect, useState } from 'react'
import { ServerCog } from 'lucide-react'

interface EstadoMotorIA {
  motor: 'python' | 'typescript' | 'ninguno'
  detalle: string
}

/**
 * Badge del motor de IA: muestra en todo momento qué cerebro atiende la app.
 * Python (FastAPI) es el motor principal; TypeScript actúa como respaldo.
 */
export function BadgeMotor() {
  const [estado, setEstado] = useState<EstadoMotorIA | null>(null)

  useEffect(() => {
    let vivo = true
    fetch('/api/engine', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: EstadoMotorIA) => {
        if (vivo) setEstado(d)
      })
      .catch(() => {
        if (vivo) setEstado({ motor: 'ninguno', detalle: 'Sin conexión con el motor' })
      })
    return () => {
      vivo = false
    }
  }, [])

  const configuracion =
    estado?.motor === 'python'
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
      : estado?.motor === 'typescript'
        ? 'border-sky-500/40 bg-sky-500/10 text-sky-400'
        : 'border-red-500/40 bg-red-500/10 text-red-400'

  const etiqueta =
    estado?.motor === 'python'
      ? 'Python · FastAPI'
      : estado?.motor === 'typescript'
        ? 'TS · Respaldo'
        : estado
          ? 'IA no configurada'
          : 'Motor IA…'

  return (
    <span
      className={`hidden shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold md:inline-flex ${configuracion}`}
      title={`Motor de IA: ${estado?.detalle ?? 'comprobando'}`}
      aria-label={`Motor de IA: ${estado?.detalle ?? 'comprobando'}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          estado?.motor === 'python' ? 'animate-pulse bg-amber-400' : 'bg-current'
        }`}
        aria-hidden
      />
      <ServerCog className="h-3 w-3" aria-hidden />
      {etiqueta}
    </span>
  )
}
