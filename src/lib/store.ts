'use client'

import { create } from 'zustand'
import { toast } from '@/hooks/use-toast'
import type {
  ConversacionResumenDTO,
  MemoriaDTO,
  MensajeDTO,
  ModoComposer,
  RespuestaGeneracionDTO,
} from '@/lib/types'

const prefijoTempUsuario = 'temp-usuario'
const prefijoTempAsistente = 'temp-asistente'

interface AuroraStore {
  sessionId: string | null
  listo: boolean
  conversaciones: ConversacionResumenDTO[]
  conversacionActiva: string | null
  mensajes: MensajeDTO[]
  enviando: boolean
  modo: ModoComposer
  memorias: MemoriaDTO[]
  panelMemoriaAbierto: boolean
  sidebarMovilAbierto: boolean

  iniciar: () => Promise<void>
  setModo: (modo: ModoComposer) => void
  abrirPanelMemoria: (abierto: boolean) => void
  alternarSidebarMovil: (abierto: boolean) => void
  nuevaConversacion: () => void
  abrirConversacion: (id: string) => Promise<void>
  renombrarConversacion: (id: string, titulo: string) => Promise<void>
  borrarConversacion: (id: string) => Promise<void>
  enviarMensaje: (texto: string) => Promise<void>
  agregarMemoriaManual: (texto: string) => Promise<void>
  borrarMemoria: (id: string) => Promise<void>
  refrescarConversaciones: () => Promise<void>
  refrescarMemorias: () => Promise<void>
}

function headersSesion(sessionId: string): HeadersInit {
  return { 'Content-Type': 'application/json', 'x-session-id': sessionId }
}

export const useAurora = create<AuroraStore>((set, get) => ({
  sessionId: null,
  listo: false,
  conversaciones: [],
  conversacionActiva: null,
  mensajes: [],
  enviando: false,
  modo: 'chat',
  memorias: [],
  panelMemoriaAbierto: false,
  sidebarMovilAbierto: false,

  async iniciar() {
    let sid = localStorage.getItem('aurora_sid')
    if (!sid) {
      sid =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `sid-${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem('aurora_sid', sid)
    }
    set({ sessionId: sid, listo: true })
    await Promise.all([get().refrescarConversaciones(), get().refrescarMemorias()])
  },

  setModo(modo) {
    set({ modo })
  },

  abrirPanelMemoria(abierto) {
    set({ panelMemoriaAbierto: abierto })
  },

  alternarSidebarMovil(abierto) {
    set({ sidebarMovilAbierto: abierto })
  },

  nuevaConversacion() {
    set({ conversacionActiva: null, mensajes: [], sidebarMovilAbierto: false })
  },

  async abrirConversacion(id) {
    const { sessionId } = get()
    if (!sessionId) return
    try {
      const res = await fetch(`/api/conversations/${id}`, { headers: headersSesion(sessionId) })
      if (!res.ok) throw new Error('No pude cargar la conversación')
      const datos = (await res.json()) as { messages: MensajeDTO[] }
      set({
        conversacionActiva: id,
        mensajes: datos.messages,
        sidebarMovilAbierto: false,
      })
    } catch {
      toast({ title: 'Error', description: 'No pude cargar la conversación.', variant: 'destructive' })
    }
  },

  async renombrarConversacion(id, titulo) {
    const { sessionId } = get()
    if (!sessionId) return
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'PATCH',
        headers: headersSesion(sessionId),
        body: JSON.stringify({ title: titulo }),
      })
      if (!res.ok) throw new Error()
      set({
        conversaciones: get().conversaciones.map((c) => (c.id === id ? { ...c, title: titulo } : c)),
      })
    } catch {
      toast({ title: 'Error', description: 'No pude renombrar la conversación.', variant: 'destructive' })
    }
  },

  async borrarConversacion(id) {
    const { sessionId } = get()
    if (!sessionId) return
    try {
      const res = await fetch(`/api/conversations/${id}`, {
        method: 'DELETE',
        headers: headersSesion(sessionId),
      })
      if (!res.ok) throw new Error()
      const eraActiva = get().conversacionActiva === id
      set({
        conversaciones: get().conversaciones.filter((c) => c.id !== id),
        ...(eraActiva ? { conversacionActiva: null, mensajes: [] } : {}),
      })
      toast({ title: 'Conversación eliminada' })
    } catch {
      toast({ title: 'Error', description: 'No pude eliminar la conversación.', variant: 'destructive' })
    }
  },

  async refrescarConversaciones() {
    const { sessionId } = get()
    if (!sessionId) return
    try {
      const res = await fetch('/api/conversations', { headers: headersSesion(sessionId) })
      if (!res.ok) return
      const datos = (await res.json()) as { conversations: ConversacionResumenDTO[] }
      set({ conversaciones: datos.conversations })
    } catch {
      // silencioso: el historial se reintenta en la siguiente acción
    }
  },

  async refrescarMemorias() {
    const { sessionId } = get()
    if (!sessionId) return
    try {
      const res = await fetch('/api/memories', { headers: headersSesion(sessionId) })
      if (!res.ok) return
      const datos = (await res.json()) as { memories: MemoriaDTO[] }
      set({ memorias: datos.memories })
    } catch {
      // silencioso
    }
  },

  async agregarMemoriaManual(texto) {
    const { sessionId } = get()
    if (!sessionId) return
    try {
      const res = await fetch('/api/memories', {
        method: 'POST',
        headers: headersSesion(sessionId),
        body: JSON.stringify({ content: texto }),
      })
      if (!res.ok) throw new Error()
      const datos = (await res.json()) as { memory: MemoriaDTO }
      set({ memorias: [datos.memory, ...get().memorias] })
      toast({ title: 'Memoria guardada', description: 'La tendré presente en futuras conversaciones.' })
    } catch {
      toast({ title: 'Error', description: 'No pude guardar la memoria.', variant: 'destructive' })
    }
  },

  async borrarMemoria(id) {
    const { sessionId } = get()
    if (!sessionId) return
    try {
      const res = await fetch(`/api/memories/${id}`, {
        method: 'DELETE',
        headers: headersSesion(sessionId),
      })
      if (!res.ok) throw new Error()
      set({ memorias: get().memorias.filter((m) => m.id !== id) })
    } catch {
      toast({ title: 'Error', description: 'No pude eliminar la memoria.', variant: 'destructive' })
    }
  },

  async enviarMensaje(texto) {
    const contenido = texto.trim()
    const { sessionId, modo, conversacionActiva, enviando } = get()
    if (!sessionId || !contenido || enviando) return

    // IDs temporales únicos por envío (evita claves de React duplicadas)
    const sufijo = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const idTempUsuario = `${prefijoTempUsuario}-${sufijo}`
    const idTempAsistente = `${prefijoTempAsistente}-${sufijo}`

    const mensajeUsuario: MensajeDTO = {
      id: idTempUsuario,
      role: 'user',
      content: contenido,
      kind: 'text',
      createdAt: new Date().toISOString(),
    }
    const mensajeAsistente: MensajeDTO = {
      id: idTempAsistente,
      role: 'assistant',
      content: '',
      kind: modo === 'chat' ? 'text' : modo,
      createdAt: new Date().toISOString(),
    }

    set({ mensajes: [...get().mensajes, mensajeUsuario, mensajeAsistente], enviando: true })

    const actualizarTemporal = (cambios: Partial<MensajeDTO>) => {
      set({
        mensajes: get().mensajes.map((m) => (m.id === idTempAsistente ? { ...m, ...cambios } : m)),
      })
    }

    try {
      if (modo === 'chat') {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: headersSesion(sessionId),
          body: JSON.stringify({ conversationId: conversacionActiva, content: contenido }),
        })
        if (!res.ok || !res.body) {
          const err = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(err?.error ?? 'El servidor no respondió correctamente')
        }

        const lector = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let textoAcumulado = ''

        while (true) {
          const { done, value } = await lector.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const partes = buffer.split('\n\n')
          buffer = partes.pop() ?? ''
          for (const parte of partes) {
            const linea = parte.trim()
            if (!linea.startsWith('data:')) continue
            let evento: Record<string, unknown>
            try {
              evento = JSON.parse(linea.slice(5).trim()) as Record<string, unknown>
            } catch {
              continue
            }
            if (evento.type === 'delta' && typeof evento.content === 'string') {
              textoAcumulado += evento.content
              actualizarTemporal({ content: textoAcumulado })
            } else if (evento.type === 'done') {
              actualizarTemporal({ id: String(evento.messageId), content: textoAcumulado })
              set({
                conversacionActiva:
                  typeof evento.conversationId === 'string' ? evento.conversationId : conversacionActiva,
              })
            } else if (evento.type === 'memory' && Array.isArray(evento.memories)) {
              const nuevas = (evento.memories as string[]).map((contenido2, i) => ({
                id: `mem-temp-${Date.now()}-${i}`,
                content: contenido2,
                source: 'auto' as const,
                createdAt: new Date().toISOString(),
              }))
              set({ memorias: [...nuevas, ...get().memorias] })
              toast({
                title: 'Memoria actualizada',
                description: `Guardé ${nuevas.length === 1 ? 'un dato nuevo' : `${nuevas.length} datos nuevos`} sobre ti.`,
              })
            } else if (evento.type === 'error') {
              throw new Error(String(evento.message ?? 'Error desconocido'))
            }
          }
        }
        if (!textoAcumulado.trim()) {
          actualizarTemporal({ content: 'Lo sentimos, la respuesta llegó vacía. Inténtalo de nuevo.', error: true })
        }
      } else {
        // Modos imagen y documento: petición única
        const url = modo === 'image' ? '/api/image' : '/api/document'
        const res = await fetch(url, {
          method: 'POST',
          headers: headersSesion(sessionId),
          body: JSON.stringify({ conversationId: conversacionActiva, prompt: contenido }),
        })
        const datos = (await res.json()) as RespuestaGeneracionDTO & { error?: string }
        if (!res.ok) throw new Error(datos.error ?? 'El servidor no respondió correctamente')

        set({
          mensajes: get().mensajes.map((m) => {
            if (m.id === idTempUsuario) return datos.userMessage
            if (m.id === idTempAsistente) return datos.assistantMessage
            return m
          }),
          conversacionActiva: datos.conversationId,
        })
        toast(
          modo === 'image'
            ? { title: 'Imagen generada', description: 'Ya está disponible en el historial.' }
            : { title: 'Documento listo', description: 'Descárgalo en formato Word desde el chat.' }
        )
      }
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : 'Hubo un problema de comunicación con el servidor.'
      actualizarTemporal({ content: mensaje, error: true })
      toast({ title: 'Algo salió mal', description: mensaje, variant: 'destructive' })
    } finally {
      set({ enviando: false })
      void get().refrescarConversaciones()
    }
  },
}))
