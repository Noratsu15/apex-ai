'use client'

import { useEffect } from 'react'
import { Brain, Menu, Sparkles } from 'lucide-react'
import { useAurora } from '@/lib/store'
import { ListaMensajes } from '@/components/aurora/message-list'
import { Composer } from '@/components/aurora/composer'
import { ContenidoSidebar } from '@/components/aurora/sidebar'
import { BadgeMotor } from '@/components/aurora/engine-badge'
import { PanelMemoria } from '@/components/aurora/memory-panel'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

export function AuroraApp() {
  const iniciar = useAurora((s) => s.iniciar)
  const listo = useAurora((s) => s.listo)
  const conversaciones = useAurora((s) => s.conversaciones)
  const conversacionActiva = useAurora((s) => s.conversacionActiva)
  const memorias = useAurora((s) => s.memorias)
  const abrirPanelMemoria = useAurora((s) => s.abrirPanelMemoria)
  const sidebarMovilAbierto = useAurora((s) => s.sidebarMovilAbierto)
  const alternarSidebarMovil = useAurora((s) => s.alternarSidebarMovil)

  useEffect(() => {
    void iniciar()
  }, [iniciar])

  const tituloActivo =
    conversaciones.find((c) => c.id === conversacionActiva)?.title ?? 'Nueva conversación'

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Sidebar de escritorio */}
      <aside className="hidden w-72 shrink-0 lg:block" aria-label="Barra lateral">
        <ContenidoSidebar />
      </aside>

      {/* Sidebar móvil */}
      <Sheet open={sidebarMovilAbierto} onOpenChange={alternarSidebarMovil}>
        <SheetContent side="left" className="w-72 border-zinc-800 bg-zinc-950 p-0">
          <SheetTitle className="sr-only">Historial de conversaciones</SheetTitle>
          <ContenidoSidebar />
        </SheetContent>
      </Sheet>

      {/* Área principal */}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur sm:px-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => alternarSidebarMovil(true)}
            className="-ml-2 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 lg:hidden"
            aria-label="Abrir historial"
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Sparkles className="h-4 w-4 shrink-0 text-amber-400 lg:hidden" aria-hidden />
            <h1 className="truncate text-sm font-semibold text-zinc-200">{tituloActivo}</h1>
            <span className="hidden shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400 sm:inline">
              BETA
            </span>
            <BadgeMotor />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => abrirPanelMemoria(true)}
            className="gap-2 border-zinc-800 bg-zinc-900/60 text-zinc-300 hover:border-amber-500/40 hover:bg-zinc-900 hover:text-amber-400"
            aria-label={`Abrir memoria de Apex (${memorias.length} recuerdos)`}
          >
            <Brain className="h-4 w-4" aria-hidden />
            <span className="hidden sm:inline">Memoria</span>
            <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-400">
              {memorias.length}
            </span>
          </Button>
        </header>

        {/* Mensajes */}
        <div className="min-h-0 flex-1" aria-label="Conversación">
          {listo ? (
            <ListaMensajes />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="flex h-10 w-10 animate-pulse items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10">
                <Sparkles className="h-5 w-5 text-amber-400" aria-hidden />
              </div>
            </div>
          )}
        </div>

        {/* Entrada */}
        <Composer />
      </main>

      {/* Panel de memoria */}
      <PanelMemoria />
    </div>
  )
}
