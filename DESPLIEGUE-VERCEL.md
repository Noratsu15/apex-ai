# Aurora IA — Guía de despliegue en Vercel

Chat de IA en fase beta: responde preguntas, genera imágenes, crea documentos
Word, guarda el historial y mantiene memoria del usuario.

Stack: **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + shadcn/ui +
Prisma + Python (funciones serverless opcionales)**.

---

## 1. Estructura del proyecto

```
aurora-ia/
├── prisma/schema.prisma        ← Conversación, Message, Memory, GeneratedDocument
├── src/
│   ├── app/
│   │   ├── page.tsx            ← la aplicación (ruta /)
│   │   └── api/
│   │       ├── chat/           ← chat con streaming SSE + memoria automática
│   │       ├── image/          ← generación de imágenes
│   │       ├── document/       ← generación de documentos (Markdown)
│   │       ├── conversations/  ← historial: listar, abrir, renombrar, borrar
│   │       ├── memories/       ← memoria: listar, añadir, borrar
│   │       └── documents/      ← descarga .docx (se genera al vuelo)
│   ├── components/aurora/      ← UI: sidebar, mensajes, composer, panel memoria
│   └── lib/                    ← SDK de IA, sesión, prompts, Markdown→docx
├── python-examples/            ← función Python de ejemplo (ver su README)
└── DESPLIEGUE-VERCEL.md        ← este archivo
```

## 2. Requisitos previos

- Cuenta gratuita en [Vercel](https://vercel.com)
- El código en un repositorio de GitHub/GitLab/Bitbucket
  (o Vercel CLI: `npm i -g vercel`)

## 3. Desplegar la app Next.js

1. Entra a [vercel.com/new](https://vercel.com/new) e importa el repositorio.
2. Vercel detecta Next.js automáticamente; no hay que configurar el build.
3. Añade la variable de entorno `DATABASE_URL` (paso 4) y despliega.

## 4. Base de datos

En local el proyecto usa **SQLite** (`db/custom.db`), perfecto para desarrollo
y para la demo. En Vercel el sistema de archivos es efímero, así que para
producción se recomienda PostgreSQL:

1. Crea una base gratis en [Neon](https://neon.tech) o [Supabase](https://supabase.com).
2. En `prisma/schema.prisma` cambia el provider:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. En Vercel añade `DATABASE_URL` con la cadena de conexión de Neon/Supabase.
4. Crea las tablas: `npx prisma db push` (en tu máquina, apuntando a la BD
   de producción).

Nota: en Postgres los campos de texto largos (imágenes en base64, documentos)
no tienen el límite práctico de SQLite; el esquema funciona igual.

## 5. Proveedor del modelo de IA (importante)

En este entorno de desarrollo el chat usa un SDK interno. Al desplegar a
Vercel, sustitúyelo por tu proveedor favorito — **solo cambia
`src/lib/zai.ts` y las rutas API**, el resto de la app no se toca:

| Opción                                   | Cómo                                                            |
| ---------------------------------------- | --------------------------------------------------------------- |
| **Vercel AI SDK** (recomendado)          | `npm i ai @ai-sdk/openai` (o anthropic, google, groq…) y usa `streamText()` en `/api/chat`, `generateText()` en `/api/document` |
| **OpenAI SDK directo**                   | `npm i openai` y `client.chat.completions.create({ stream: true })` |
| **GLM (Z.ai)**                           | API compatible con OpenAI: `baseURL: https://open.bigmodel.cn/api/paas/v4` |

Todas las llamadas al modelo están centralizadas en:
- `src/lib/zai.ts` (cliente singleton)
- `src/app/api/chat/route.ts` (streaming del chat)
- `src/app/api/image/route.ts` (mejora de prompt + imagen)
- `src/app/api/document/route.ts` (redacción del documento)

Variables de entorno típicas: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
`GLM_API_KEY`… según el proveedor elegido.

## 6. Funciones Python (reutilizar ia_brain.py)

Ver `python-examples/README.md`. Resumen: copia `python-examples/api/` a la
raíz como `api/` + `requirements.txt`, y Vercel publica cada `.py` como una
función serverless (`/api/notas-voz`). Combínalo con `vercel.json` (crons)
para tareas periódicas como tus alertas de mantenimiento.

## 7. Checklist para la presentación (lunes 16)

- [ ] Chat responde con streaming y Markdown (pide código de ejemplo)
- [ ] Modo Imagen: genera y descarga un PNG (~15-25 s)
- [ ] Modo Documento: genera y descarga un .docx real
- [ ] Historial: conversaciones persisten, se renombran y se borran
- [ ] Memoria: cuenta algo personal, pregunta "¿qué sabes de mí?"
- [ ] Responsive: muestra la versión móvil (menú hamburguesa)

## 8. Problemas comunes

| Síntoma                                   | Causa / solución                                                |
| ----------------------------------------- | --------------------------------------------------------------- |
| `PrismaClientInitializationError` en Vercel | Falta `DATABASE_URL` o el provider sigue siendo `sqlite`        |
| El chat responde vacío                    | Revisa la clave del proveedor de IA en las variables de entorno |
| Las imágenes no cargan al reabrir el chat | Son data URLs guardadas en BD; verifica el tamaño del campo    |
| Función Python 503                        | Revisa `ELEVENLABS_API_KEY` / `ELEVENLABS_VOICE_ID`             |
