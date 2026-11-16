'use client'

import { useRef, useState } from 'react'
import { ArrowUp, FileText, ImageIcon, Loader2, MessageSquare } from 'lucide-react'
import { useAurora } from '@/lib/store'
import { cn } from '@/lib/utils'
import type { ModoComposer } from '@/lib/types'

const MODOS: Array<{ id: ModoComposer; etiqueta: string; icono: typeof MessageSquare }> = [
  { id: 'chat', etiqueta: 'Chat', icono: MessageSquare },
  { id: 'image', etiqueta: 'Imagen', icono: ImageIcon },
  { id: 'document', etiqueta: 'Documento', icono: FileText },
]

const PLACEHOLDERS: Record<ModoComposer, string> = {
  chat: 'Pregúntame lo que quieras…',
  image: 'Describe la imagen que quieres crear…',
  document: 'Describe el documento que necesitas (propuesta, contrato, informe…)',
}

const AYUDAS: Record<ModoComposer, string> = {
  chat: '',
  image: 'La generación de imágenes tarda entre 10 y 25 segundos.',
  document: 'Redacto el documento completo y lo descargas en formato Word (.docx).',
}

export function Composer() {
  const [texto, setTexto] = useState('')
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const modo = useAurora((s) => s.modo)
  const setModo = useAurora((s) => s.setModo)
  const enviando = useAurora((s) => s.enviando)
  const enviarMensaje = useAurora((s) => s.enviarMensaje)

  const ajustarAltura = () => {
    const area = areaRef.current
    if (!area) return
    area.style.height = 'auto'
    area.style.height = `${Math.min(area.scrollHeight, 160)}px`
  }

  const enviar = () => {
    const contenido = texto.trim()
    if (!contenido || enviando) return
    setTexto('')
    if (areaRef.current) areaRef.current.style.height = 'auto'
    void enviarMensaje(contenido)
  }

  return (
    <div className="border-t border-zinc-800 bg-zinc-950/95 px-4 pt-3 pb-4 backdrop-blur sm:px-6">
      <div className="mx-auto max-w-3xl">
        {/* Selector de modo */}
        <div className="mb-2.5 flex items-center gap-1.5" role="tablist" aria-label="Modo del asistente">
          {MODOS.map(({ id, etiqueta, icono: Icono }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={modo === id}
              aria-label={`Modo ${etiqueta.toLowerCase()}`}
              onClick={() => setModo(id)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                modo === id
                  ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                  : 'border-zinc-800 bg-zinc-900/60 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              )}
            >
              <Icono className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">{etiqueta}</span>
            </button>
          ))}
        </div>

        {/* Caja de entrada */}
        <div className="flex items-end gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2 transition-colors focus-within:border-emerald-500/50">
          <textarea
            ref={areaRef}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              ajustarAltura()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                enviar()
              }
            }}
            rows={1}
            placeholder={PLACEHOLDERS[modo]}
            aria-label="Mensaje para Aurora"
            className="max-h-40 min-h-[44px] flex-1 resize-none bg-transparent px-2.5 py-2.5 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={!texto.trim() || enviando}
            aria-label="Enviar mensaje"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-zinc-950 transition-all hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? (
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            ) : (
              <ArrowUp className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>

        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[11px] text-zinc-600">
          <span>
            <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 font-mono text-[10px]">Enter</kbd>{' '}
            enviar ·{' '}
            <kbd className="rounded border border-zinc-800 bg-zinc-900 px-1 py-0.5 font-mono text-[10px]">
              Shift+Enter
            </kbd>{' '}
            salto de línea
          </span>
          {AYUDAS[modo] && <span className="text-emerald-500/70">{AYUDAS[modo]}</span>}
        </p>
      </div>
    </div>
  )
}
