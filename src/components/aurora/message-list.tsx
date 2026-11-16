'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Brain,
  Check,
  Copy,
  Download,
  FileText,
  ImageIcon,
  Loader2,
  MessageSquare,
  Sparkles,
  TriangleAlert,
} from 'lucide-react'
import { useAurora } from '@/lib/store'
import { Markdown } from '@/components/aurora/markdown'
import { cn } from '@/lib/utils'
import type { MensajeDTO, ModoComposer } from '@/lib/types'

/* ------------------------------------------------------------------ */
/*  Tarjeta de imagen generada                                        */
/* ------------------------------------------------------------------ */
function ImagenGenerada({ mensaje }: { mensaje: MensajeDTO }) {
  const descargar = () => {
    if (!mensaje.imageBase64) return
    const a = document.createElement('a')
    a.href = mensaje.imageBase64
    a.download = `aurora-imagen-${mensaje.id.slice(0, 8)}.png`
    a.click()
  }
  return (
    <figure className="max-w-md overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      {mensaje.imageBase64 ? (
        <img
          src={mensaje.imageBase64}
          alt={`Imagen generada: ${mensaje.content}`}
          className="w-full"
        />
      ) : (
        <div className="flex aspect-square max-w-md items-center justify-center bg-zinc-900/50">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
        </div>
      )}
      <figcaption className="flex items-center justify-between gap-3 border-t border-zinc-800 px-3 py-2">
        <p className="truncate text-xs text-zinc-500">{mensaje.content}</p>
        <button
          type="button"
          onClick={descargar}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-emerald-500/50 hover:text-emerald-400"
        >
          <Download className="h-3.5 w-3.5" />
          PNG
        </button>
      </figcaption>
    </figure>
  )
}

/* ------------------------------------------------------------------ */
/*  Tarjeta de documento generado                                     */
/* ------------------------------------------------------------------ */
function DocumentoGenerado({ mensaje }: { mensaje: MensajeDTO }) {
  const [descargando, setDescargando] = useState(false)
  const sessionId = useAurora((s) => s.sessionId)

  const descargar = async () => {
    if (!mensaje.documentId || !sessionId) return
    setDescargando(true)
    try {
      const res = await fetch(`/api/documents/${mensaje.documentId}/download`, {
        headers: { 'x-session-id': sessionId },
      })
      if (!res.ok) throw new Error()
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `documento-aurora-${mensaje.documentId.slice(0, 8)}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // el toast de error lo maneja el llamador
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-zinc-100">Documento Word generado</p>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-500">{mensaje.content}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={descargar}
        disabled={descargando}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 disabled:opacity-60"
      >
        {descargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {descargando ? 'Preparando archivo…' : 'Descargar .docx'}
      </button>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Burbuja individual                                                */
/* ------------------------------------------------------------------ */
function Burbuja({ mensaje, esUltima }: { mensaje: MensajeDTO; esUltima: boolean }) {
  const [copiado, setCopiado] = useState(false)
  const enviando = useAurora((s) => s.enviando)
  // El mensaje temporal en curso siempre es el último mientras se genera
  const enCurso = esUltima && mensaje.role === 'assistant' && enviando

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(mensaje.content)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // portapapeles no disponible
    }
  }

  if (mensaje.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-[15px] whitespace-pre-wrap text-zinc-100">
          {mensaje.content}
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-3">
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-emerald-400',
          mensaje.error ? 'border-red-500/40 bg-red-500/10' : 'border-emerald-500/30 bg-emerald-500/10'
        )}
        aria-hidden
      >
        {mensaje.error ? (
          <TriangleAlert className="h-4 w-4 text-red-400" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-200">Aurora</span>
          {enCurso && <span className="text-xs text-emerald-400">escribiendo…</span>}
        </div>

        {mensaje.error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">
            {mensaje.content}
          </p>
        ) : mensaje.kind === 'image' ? (
          <ImagenGenerada mensaje={mensaje} />
        ) : mensaje.kind === 'document' ? (
          <DocumentoGenerado mensaje={mensaje} />
        ) : (
          <div className="text-zinc-300">
            {mensaje.content ? (
              <>
                <Markdown contenido={mensaje.content} />
                {enCurso && (
                  <span className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-emerald-400 align-text-bottom" />
                )}
              </>
            ) : (
              <div className="flex items-center gap-1.5 py-2" aria-label="Aurora está pensando">
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:0ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:150ms]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-400 [animation-delay:300ms]" />
              </div>
            )}
          </div>
        )}

        {!enCurso && !mensaje.error && mensaje.kind === 'text' && mensaje.content && (
          <button
            type="button"
            onClick={copiar}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-800/60 hover:text-zinc-300"
          >
            {copiado ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        )}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Estado vacío con capacidades                                      */
/* ------------------------------------------------------------------ */
const SUGERENCIAS: Array<{ modo: ModoComposer; icono: typeof Sparkles; titulo: string; descripcion: string; ejemplo: string }> = [
  {
    modo: 'chat',
    icono: MessageSquare,
    titulo: 'Pregunta lo que quieras',
    descripcion: 'Respuestas claras con código, tablas y estructura',
    ejemplo: 'Explícame qué es una API REST como si tuviera 12 años',
  },
  {
    modo: 'image',
    icono: ImageIcon,
    titulo: 'Crea imágenes',
    descripcion: 'Ilustraciones y fotos a partir de una descripción',
    ejemplo: 'Un colibrí iridiscente bebiendo néctar de una flor de cristal, luz dorada, fotografía macro',
  },
  {
    modo: 'document',
    icono: FileText,
    titulo: 'Genera documentos',
    descripcion: 'Propuestas, contratos e informes en Word',
    ejemplo: 'Una propuesta comercial para una agencia de marketing digital, con alcance, precios y cronograma',
  },
]

function EstadoVacio() {
  const enviarMensaje = useAurora((s) => s.enviarMensaje)
  const setModo = useAurora((s) => s.setModo)
  const enviando = useAurora((s) => s.enviando)

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-10 text-center sm:py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10">
        <Sparkles className="h-7 w-7 text-emerald-400" aria-hidden />
      </div>
      <h1 className="mt-5 text-2xl font-bold text-zinc-50 sm:text-3xl">
        Hola, soy <span className="text-emerald-400">Aurora</span>
      </h1>
      <p className="mt-2 max-w-md text-sm text-zinc-400 sm:text-base">
        Tu asistente de IA en fase beta. Puedo responder preguntas, crear imágenes, generar documentos
        Word y recordar lo que me cuentes.
      </p>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
        {SUGERENCIAS.map(({ modo, icono: Icono, titulo, descripcion, ejemplo }) => (
          <button
            key={modo}
            type="button"
            disabled={enviando}
            onClick={() => {
              setModo(modo)
              void enviarMensaje(ejemplo)
            }}
            className="group flex flex-col items-start gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:bg-zinc-900 disabled:pointer-events-none disabled:opacity-60"
          >
            <Icono className="h-5 w-5 text-emerald-400" aria-hidden />
            <span className="text-sm font-semibold text-zinc-100">{titulo}</span>
            <span className="text-xs leading-relaxed text-zinc-500">{descripcion}</span>
            <span className="mt-1 line-clamp-2 text-xs italic text-zinc-600 group-hover:text-emerald-500/80">
              &ldquo;{ejemplo}&rdquo;
            </span>
          </button>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-2 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1">
          <Brain className="h-3.5 w-3.5 text-emerald-400" /> Memoria persistente
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1">
          <ImageIcon className="h-3.5 w-3.5 text-emerald-400" /> Imágenes con IA
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-800 px-3 py-1">
          <FileText className="h-3.5 w-3.5 text-emerald-400" /> Documentos .docx
        </span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Lista completa de mensajes                                        */
/* ------------------------------------------------------------------ */
export function ListaMensajes() {
  const mensajes = useAurora((s) => s.mensajes)
  const contenedorRef = useRef<HTMLDivElement>(null)
  const pegadoAbajo = useRef(true)

  // Auto-scroll: sigue al fondo mientras el usuario no suba a leer
  useEffect(() => {
    const cont = contenedorRef.current
    if (cont && pegadoAbajo.current) {
      cont.scrollTop = cont.scrollHeight
    }
  }, [mensajes])

  const alScroll = () => {
    const cont = contenedorRef.current
    if (!cont) return
    pegadoAbajo.current = cont.scrollHeight - cont.scrollTop - cont.clientHeight < 120
  }

  if (mensajes.length === 0) return <EstadoVacio />

  return (
    <div
      ref={contenedorRef}
      onScroll={alScroll}
      className="h-full overflow-y-auto px-4 py-6 sm:px-6"
      role="log"
      aria-live="polite"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {mensajes.map((m, i) => (
          <Burbuja key={m.id} mensaje={m} esUltima={i === mensajes.length - 1} />
        ))}
      </div>
    </div>
  )
}
