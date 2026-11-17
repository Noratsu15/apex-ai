'use client'

import { useState } from 'react'
import { Brain, Loader2, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useAurora } from '@/lib/store'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Panel lateral de memoria: lo que Apex recuerda del usuario.
 * Permite ver, añadir y eliminar recuerdos (automáticos y manuales).
 */
export function PanelMemoria() {
  const abierto = useAurora((s) => s.panelMemoriaAbierto)
  const abrirPanel = useAurora((s) => s.abrirPanelMemoria)
  const memorias = useAurora((s) => s.memorias)
  const agregarMemoriaManual = useAurora((s) => s.agregarMemoriaManual)
  const borrarMemoria = useAurora((s) => s.borrarMemoria)
  const [nueva, setNueva] = useState('')
  const [guardando, setGuardando] = useState(false)

  const agregar = async () => {
    const texto = nueva.trim()
    if (!texto || guardando) return
    setGuardando(true)
    await agregarMemoriaManual(texto)
    setNueva('')
    setGuardando(false)
  }

  return (
    <Sheet open={abierto} onOpenChange={abrirPanel}>
      <SheetContent side="right" className="flex w-full flex-col border-zinc-800 bg-zinc-950 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-zinc-800 px-5 py-4">
          <SheetTitle className="flex items-center gap-2 text-zinc-50">
            <Brain className="h-5 w-5 text-amber-400" aria-hidden />
            Memoria de Apex
          </SheetTitle>
          <SheetDescription className="text-zinc-400">
            Lo que Apex recuerda sobre ti entre conversaciones. Se usa automáticamente para darte
            respuestas más personales.
          </SheetDescription>
        </SheetHeader>

        {/* Añadir memoria manual */}
        <div className="border-b border-zinc-800 px-5 py-4">
          <label htmlFor="nueva-memoria" className="mb-2 block text-xs font-medium text-zinc-400">
            Enséñale algo nuevo
          </label>
          <div className="flex gap-2">
            <Input
              id="nueva-memoria"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void agregar()
              }}
              placeholder="Ej.: Trabajo en marketing y prefiero respuestas breves"
              className="border-zinc-800 bg-zinc-900 text-sm text-zinc-100 placeholder:text-zinc-600 focus-visible:ring-amber-500/40"
            />
            <Button
              type="button"
              size="icon"
              onClick={() => void agregar()}
              disabled={!nueva.trim() || guardando}
              className="shrink-0 bg-amber-500 text-zinc-950 hover:bg-amber-400"
              aria-label="Añadir memoria"
            >
              {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Lista de memorias */}
        <div className="max-h-96 flex-1 overflow-y-auto px-5 py-4">
          {memorias.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <Sparkles className="h-8 w-8 text-zinc-700" aria-hidden />
              <p className="text-sm text-zinc-500">
                Aún no tengo recuerdos. Cuéntame algo sobre ti en el chat y lo memorizaré, o añádelo
                aquí directamente.
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {memorias.map((m) => (
                <li
                  key={m.id}
                  className="group flex items-start gap-3 rounded-lg border border-zinc-800/80 bg-zinc-900/50 px-3.5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-relaxed text-zinc-200">{m.content}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          m.source === 'auto'
                            ? 'border-amber-500/40 bg-amber-500/10 text-[10px] text-amber-400'
                            : 'border-zinc-700 bg-zinc-800 text-[10px] text-zinc-400'
                        }
                      >
                        {m.source === 'auto' ? 'Automática' : 'Manual'}
                      </Badge>
                      <span className="text-[11px] text-zinc-600">
                        {new Date(m.createdAt).toLocaleDateString('es', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void borrarMemoria(m.id)}
                    aria-label="Eliminar memoria"
                    className="rounded-md p-1.5 text-zinc-600 opacity-0 transition-all hover:bg-red-500/10 hover:text-red-400 focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="border-t border-zinc-800 px-5 py-3 text-[11px] text-zinc-600">
          {memorias.length === 1
            ? '1 memoria activa'
            : `${memorias.length} memorias activas`}{' '}
          · Las memorias se guardan en la base de datos de la aplicación.
        </p>
      </SheetContent>
    </Sheet>
  )
}
