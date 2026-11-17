'use client'

import { useState } from 'react'
import {
  MessageSquare,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import { useAurora } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { ConversacionResumenDTO } from '@/lib/types'

function tiempoRelativo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `hace ${min} min`
  const horas = Math.floor(min / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.floor(horas / 24)
  if (dias < 7) return `hace ${dias} d`
  return new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' })
}

function ElementoConversacion({ conv }: { conv: ConversacionResumenDTO }) {
  const activa = useAurora((s) => s.conversacionActiva) === conv.id
  const abrirConversacion = useAurora((s) => s.abrirConversacion)
  const renombrarConversacion = useAurora((s) => s.renombrarConversacion)
  const borrarConversacion = useAurora((s) => s.borrarConversacion)
  const [editando, setEditando] = useState(false)
  const [titulo, setTitulo] = useState(conv.title)
  const [confirmando, setConfirmando] = useState(false)

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={() => void abrirConversacion(conv.id)}
        className={cn(
          'w-full rounded-lg border px-3 py-2.5 pr-14 text-left transition-colors',
          activa
            ? 'border-amber-500/40 bg-amber-500/10'
            : 'border-transparent hover:border-zinc-800 hover:bg-zinc-900/70'
        )}
        aria-current={activa ? 'page' : undefined}
      >
        <span className="flex items-center gap-2">
          <MessageSquare
            className={cn('h-3.5 w-3.5 shrink-0', activa ? 'text-amber-400' : 'text-zinc-600')}
            aria-hidden
          />
          <span className={cn('truncate text-sm', activa ? 'text-zinc-50' : 'text-zinc-300')}>
            {conv.title}
          </span>
        </span>
        <span className="mt-1 flex items-center justify-between gap-2 pl-5.5">
          <span className="truncate text-[11px] text-zinc-600">{conv.previa || 'Sin mensajes'}</span>
          <span className="shrink-0 text-[11px] text-zinc-600">{tiempoRelativo(conv.updatedAt)}</span>
        </span>
      </button>

      {/* Acciones: visibles en táctil, al pasar el cursor en escritorio */}
      <div className="absolute top-2 right-1.5 flex gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100">
        <button
          type="button"
          onClick={() => {
            setTitulo(conv.title)
            setEditando(true)
          }}
          aria-label={`Renombrar ${conv.title}`}
          className="rounded-md bg-zinc-900/80 p-1.5 text-zinc-500 backdrop-blur transition-colors hover:text-amber-400"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          aria-label={`Eliminar ${conv.title}`}
          className="rounded-md bg-zinc-900/80 p-1.5 text-zinc-500 backdrop-blur transition-colors hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <Dialog open={editando} onOpenChange={setEditando}>
        <DialogContent className="border-zinc-800 bg-zinc-950 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-zinc-50">Renombrar conversación</DialogTitle>
          </DialogHeader>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && titulo.trim()) {
                void renombrarConversacion(conv.id, titulo.trim())
                setEditando(false)
              }
            }}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-amber-500/50 focus:outline-none"
            aria-label="Nuevo título"
            maxLength={80}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setEditando(false)}
              className="text-zinc-400 hover:text-zinc-200"
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (titulo.trim()) void renombrarConversacion(conv.id, titulo.trim())
                setEditando(false)
              }}
              className="bg-amber-500 text-zinc-950 hover:bg-amber-400"
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmando} onOpenChange={setConfirmando}>
        <AlertDialogContent className="border-zinc-800 bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-zinc-50">¿Eliminar esta conversación?</AlertDialogTitle>
            <AlertDialogDescription className="text-zinc-400">
              Se borrarán «{conv.title}» y sus {conv.totalMensajes} mensaje(s). Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void borrarConversacion(conv.id)}
              className="bg-red-600 text-white hover:bg-red-500"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </li>
  )
}

export function ContenidoSidebar() {
  const conversaciones = useAurora((s) => s.conversaciones)
  const nuevaConversacion = useAurora((s) => s.nuevaConversacion)

  return (
    <div className="flex h-full flex-col border-r border-zinc-800/70 bg-zinc-900/40">
      {/* Marca */}
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-amber-500/30 bg-amber-500/10">
          <Sparkles className="h-5 w-5 text-amber-400" aria-hidden />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-zinc-50">
            Apex <span className="text-amber-400">IA</span>
          </p>
          <p className="text-[10px] font-medium tracking-wide text-zinc-500 uppercase">
            Fase beta · v0.1
          </p>
        </div>
      </div>

      {/* Nueva conversación */}
      <div className="px-3">
        <Button
          onClick={nuevaConversacion}
          className="w-full justify-start gap-2 rounded-xl bg-amber-500 text-sm font-semibold text-zinc-950 shadow-none hover:bg-amber-400"
        >
          <Plus className="h-4 w-4" aria-hidden />
          Nueva conversación
        </Button>
      </div>

      {/* Historial */}
      <nav aria-label="Historial de conversaciones" className="mt-4 flex min-h-0 flex-1 flex-col">
        <p className="px-4 pb-2 text-[11px] font-semibold tracking-wider text-zinc-600 uppercase">
          Historial
        </p>
        {conversaciones.length === 0 ? (
          <p className="px-4 text-xs leading-relaxed text-zinc-600">
            Aún no hay conversaciones. Todo lo que hables con Apex quedará guardado aquí.
          </p>
        ) : (
          <ul className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
            {conversaciones.map((conv) => (
              <ElementoConversacion key={conv.id} conv={conv} />
            ))}
          </ul>
        )}
      </nav>

      {/* Pie */}
      <div className="border-t border-zinc-800/70 px-4 py-3">
        <p className="text-[11px] leading-relaxed text-zinc-600">
          Historial y memoria persistentes · Sesión local sin registro
        </p>
      </div>
    </div>
  )
}
