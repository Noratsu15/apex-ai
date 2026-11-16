// Tipos compartidos entre el frontend y las rutas API.

export type TipoMensaje = 'text' | 'image' | 'document'
export type RolMensaje = 'user' | 'assistant'
export type ModoComposer = 'chat' | 'image' | 'document'

export interface MensajeDTO {
  id: string
  role: RolMensaje
  content: string
  kind: TipoMensaje
  imageBase64?: string | null
  documentId?: string | null
  createdAt: string
  error?: boolean
}

export interface ConversacionResumenDTO {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  totalMensajes: number
  previa: string
}

export interface MemoriaDTO {
  id: string
  content: string
  source: 'auto' | 'manual'
  createdAt: string
}

export interface DocumentoMensajeDTO {
  id: string
  title: string
  fileName: string
}

export interface RespuestaGeneracionDTO {
  conversationId: string
  title: string
  userMessage: MensajeDTO
  assistantMessage: MensajeDTO
  document?: DocumentoMensajeDTO
}
