/**
 * brain.ts — Selección del motor de IA de Apex.
 *
 * Arquitectura del producto:
 *  1. **Cerebro Python (FastAPI)** — motor principal. Toda la inferencia
 *     (chat, imágenes) y la construcción de Word pasa por el servicio Python
 *     desplegado junto a esta app (Vercel Services) o en localhost durante
 *     el desarrollo. URL: variable de entorno BACKEND_URL.
 *  2. **Proveedor OpenAI-compatible** (respaldo en producción) — si el
 *     servicio Python no responde y hay AI_BASE_URL + AI_API_KEY definidas,
 *     la capa TS habla directo con el proveedor.
 *  3. **SDK interno Z.ai** (respaldo en desarrollo) — usado solo en este
 *     entorno de desarrollo (archivo .z-ai-config).
 *
 * Gracias a los respaldos, la app sigue funcionando aunque el cerebro Python
 * esté caído; el badge de la interfaz siempre muestra qué motor atiende.
 */

import { getZAI } from '@/lib/zai'

export type TipoMotor = 'python' | 'openai' | 'sdk'

export interface MensajeLLM {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface MotorIA {
  tipo: TipoMotor
  /** Streaming de la respuesta del modelo: cede cada fragmento de texto. */
  streamChat(mensajes: MensajeLLM[]): AsyncGenerator<string>
  /** Respuesta completa en un solo string. */
  completar(mensajes: MensajeLLM[]): Promise<string>
  /** Genera una imagen; devuelve base64 crudo y su tipo MIME real. */
  generarImagen(prompt: string, size?: string): Promise<{ base64: string; mime: string }>
}

// ------------------------------------------------------------------ utilidades

const BACKEND_URL = (process.env.BACKEND_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')
const AI_BASE_URL = (process.env.AI_BASE_URL || '').replace(/\/$/, '')
const AI_API_KEY = process.env.AI_API_KEY || ''

/** Detecta el MIME real de una imagen en base64 (PNG, JPEG, GIF, WebP). */
export function mimeDesdeBase64(b64: string): string {
  const cabeza = atob(b64.slice(0, 24))
  if (cabeza.startsWith('\u0089PNG')) return 'image/png'
  if (cabeza.startsWith('\u00FF\u00D8\u00FF')) return 'image/jpeg'
  if (cabeza.startsWith('GIF8')) return 'image/gif'
  if (cabeza.startsWith('RIFF')) return 'image/webp'
  return 'image/png'
}

/** Itera los eventos SSE `data: {...}` de un cuerpo de respuesta. */
async function* iterarSSE(cuerpo: ReadableStream<Uint8Array>): AsyncGenerator<Record<string, unknown>> {
  const lector = cuerpo.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await lector.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const partes = buffer.split('\n')
    buffer = partes.pop() ?? ''
    for (const linea of partes) {
      const limpia = linea.trim()
      if (!limpia.startsWith('data:')) continue
      const carga = limpia.slice(5).trim()
      if (!carga || carga === '[DONE]') continue
      try {
        yield JSON.parse(carga) as Record<string, unknown>
      } catch {
        // fragmento incompleto: se completará en la siguiente lectura
      }
    }
  }
}

// ------------------------------------------------------------- motor 1: Python

/** Comprueba si el cerebro Python responde (con caché breve para no frenar el chat). */
let cacheSalud: { ok: boolean; cuando: number } | null = null

export async function cerebroPythonActivo(forzar = false): Promise<boolean> {
  const ahora = Date.now()
  if (!forzar && cacheSalud && ahora - cacheSalud.cuando < (cacheSalud.ok ? 15_000 : 5_000)) {
    return cacheSalud.ok
  }
  try {
    const res = await fetch(`${BACKEND_URL}/health`, {
      signal: AbortSignal.timeout(1500),
      cache: 'no-store',
    })
    cacheSalud = { ok: res.ok, cuando: ahora }
  } catch {
    cacheSalud = { ok: false, cuando: ahora }
  }
  return cacheSalud.ok
}

function motorPython(): MotorIA {
  return {
    tipo: 'python',

    async *streamChat(mensajes) {
      const res = await fetch(`${BACKEND_URL}/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: mensajes }),
        signal: AbortSignal.timeout(300_000),
      })
      if (!res.ok || !res.body) {
        const detalle = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(detalle?.error ?? `El cerebro Python respondió ${res.status}`)
      }
      for await (const evento of iterarSSE(res.body)) {
        if (evento.type === 'delta' && typeof evento.content === 'string') yield evento.content
        else if (evento.type === 'error') throw new Error(String(evento.message ?? 'Error del cerebro Python'))
      }
    },

    async completar(mensajes) {
      let completo = ''
      for await (const delta of this.streamChat(mensajes)) completo += delta
      return completo
    },

    async generarImagen(prompt, size = '1024x1024') {
      const res = await fetch(`${BACKEND_URL}/ai/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, size }),
        signal: AbortSignal.timeout(300_000),
      })
      const datos = (await res.json().catch(() => null)) as
        | { base64?: string; mime?: string; error?: string }
        | null
      if (!res.ok || !datos?.base64) {
        throw new Error(datos?.error ?? `El cerebro Python respondió ${res.status}`)
      }
      return { base64: datos.base64, mime: datos.mime || mimeDesdeBase64(datos.base64) }
    },
  }
}

/** Construye un .docx con python-docx en el cerebro; null si no está disponible. */
export async function docxViaPython(
  titulo: string,
  markdown: string,
  fileName?: string
): Promise<{ buffer: Buffer; fileName: string } | null> {
  if (!(await cerebroPythonActivo())) return null
  try {
    const res = await fetch(`${BACKEND_URL}/ai/docx`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: titulo, markdown, fileName }),
      signal: AbortSignal.timeout(60_000),
    })
    const datos = (await res.json().catch(() => null)) as
      | { docxBase64?: string; fileName?: string; error?: string }
      | null
    if (!res.ok || !datos?.docxBase64) return null
    return {
      buffer: Buffer.from(datos.docxBase64, 'base64'),
      fileName: datos.fileName || fileName || 'documento.docx',
    }
  } catch {
    return null
  }
}

// --------------------------------------------------- motor 2: OpenAI-compatible

function motorOpenAI(): MotorIA {
  const cabeceras = { 'Content-Type': 'application/json', Authorization: `Bearer ${AI_API_KEY}` }

  async function* streamDirecto(mensajes: MensajeLLM[]): AsyncGenerator<string> {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({
        messages: mensajes,
        stream: true,
        ...(process.env.AI_CHAT_MODEL ? { model: process.env.AI_CHAT_MODEL } : {}),
      }),
      signal: AbortSignal.timeout(300_000),
    })
    if (!res.ok || !res.body) {
      throw new Error(`El proveedor de IA respondió ${res.status}: ${(await res.text()).slice(0, 200)}`)
    }
    for await (const evento of iterarSSE(res.body)) {
      const delta = (evento.choices as Array<{ delta?: { content?: string } }> | undefined)?.[0]?.delta?.content
      if (typeof delta === 'string' && delta) yield delta
    }
  }

  return {
    tipo: 'openai',
    streamChat: streamDirecto,
    async completar(mensajes) {
      let completo = ''
      for await (const delta of streamDirecto(mensajes)) completo += delta
      return completo
    },
    async generarImagen(prompt, size = '1024x1024') {
      const res = await fetch(`${AI_BASE_URL}/images/generations`, {
        method: 'POST',
        headers: cabeceras,
        body: JSON.stringify({
          prompt,
          size,
          response_format: 'b64_json',
          ...(process.env.AI_IMAGE_MODEL ? { model: process.env.AI_IMAGE_MODEL } : {}),
        }),
        signal: AbortSignal.timeout(300_000),
      })
      const datos = (await res.json().catch(() => null)) as
        | { data?: Array<{ b64_json?: string; base64?: string }>; error?: { message?: string } }
        | null
      const b64 = datos?.data?.[0]?.b64_json ?? datos?.data?.[0]?.base64
      if (!res.ok || !b64) {
        throw new Error(datos?.error?.message ?? `El proveedor de imágenes respondió ${res.status}`)
      }
      return { base64: b64, mime: mimeDesdeBase64(b64) }
    },
  }
}

// --------------------------------------------------------- motor 3: SDK Z.ai

function motorSDK(): MotorIA {
  return {
    tipo: 'sdk',

    async *streamChat(mensajes) {
      const zai = await getZAI()
      const resultado = (await zai.chat.completions.create({
        messages: mensajes.map((m) => ({ role: m.role, content: m.content })),
        stream: true,
        thinking: { type: 'disabled' },
      })) as unknown

      if (resultado && typeof (resultado as ReadableStream).getReader === 'function') {
        for await (const evento of iterarSSE(resultado as ReadableStream<Uint8Array>)) {
          const delta = (evento.choices as Array<{ delta?: { content?: string } }> | undefined)?.[0]?.delta?.content
          if (typeof delta === 'string' && delta) yield delta
        }
      } else if (resultado && typeof resultado === 'object') {
        const texto =
          (resultado as { choices?: Array<{ message?: { content?: string } }> }).choices?.[0]?.message
            ?.content ?? ''
        if (texto) yield texto
      }
    },

    async completar(mensajes) {
      const zai = await getZAI()
      const respuesta = await zai.chat.completions.create({
        messages: mensajes.map((m) => ({ role: m.role, content: m.content })),
        thinking: { type: 'disabled' },
      })
      return respuesta?.choices?.[0]?.message?.content ?? ''
    },

    async generarImagen(prompt, size = '1024x1024') {
      const zai = await getZAI()
      const respuesta = await zai.images.generations.create({ prompt, size })
      const base64 = respuesta.data?.[0]?.base64
      if (!base64) throw new Error('El modelo no devolvió ninguna imagen')
      return { base64, mime: mimeDesdeBase64(base64) }
    },
  }
}

// ------------------------------------------------------------------- selección

/**
 * Devuelve el mejor motor de IA disponible en este momento.
 * Lanza un error amable si no hay ninguno configurado.
 */
export async function obtenerMotor(): Promise<MotorIA> {
  // 1. Cerebro Python (arquitectura principal del producto)
  if (await cerebroPythonActivo()) return motorPython()

  // 2. Proveedor OpenAI-compatible (producción sin Python)
  if (AI_BASE_URL && AI_API_KEY) return motorOpenAI()

  // 3. SDK interno (este entorno de desarrollo)
  try {
    await getZAI()
    return motorSDK()
  } catch {
    /* sin configuración */
  }

  throw new Error(
    'No hay motor de IA disponible: el cerebro Python no responde y no hay ' +
      'proveedor configurado (define AI_BASE_URL y AI_API_KEY, o arranca backend/).'
  )
}

/** Estado resumido del motor para el badge de la interfaz. */
export async function estadoMotor(): Promise<{
  motor: 'python' | 'typescript' | 'ninguno'
  detalle: string
}> {
  if (await cerebroPythonActivo()) {
    return { motor: 'python', detalle: 'Cerebro Python · FastAPI' }
  }
  if (AI_BASE_URL && AI_API_KEY) {
    return { motor: 'typescript', detalle: 'Proveedor IA directo (respaldo TS)' }
  }
  try {
    await getZAI()
    return { motor: 'typescript', detalle: 'SDK interno (respaldo TS)' }
  } catch {
    return { motor: 'ninguno', detalle: 'Sin motor de IA configurado' }
  }
}
