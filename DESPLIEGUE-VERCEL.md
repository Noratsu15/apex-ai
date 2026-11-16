# Aurora IA — Guía de despliegue en Vercel (TypeScript + Python)

Chat de IA en fase beta: responde preguntas, genera imágenes, crea documentos
Word, guarda el historial y mantiene memoria del usuario.

**Arquitectura: TypeScript (web + datos) + Python (cerebro de IA).**

```
Navegador (React/TS, Tailwind, shadcn/ui)
   │  fetch /api/* (mismo origen)
   ▼
Next.js 16 — capa web y de datos (TypeScript)
   ├── Prisma: conversaciones, mensajes, memorias, documentos
   ├── /api/chat · /api/image · /api/document  → piden inferencia al cerebro
   ├── /api/conversations · /api/memories      → CRUD puro
   └── /api/engine → badge de la interfaz
   ▼ HTTP interno (BACKEND_URL, service binding privado)
backend/ — Cerebro de IA (Python 3.12 · FastAPI)
   ├── /ai/chat/stream  → chat con streaming SSE
   ├── /ai/image        → generación de imágenes
   └── /ai/docx         → documentos Word con python-docx
```

Si el cerebro Python no responde, la app **no se cae**: degrada a un respaldo
TypeScript (proveedor OpenAI-compatible directo) y el badge del encabezado
muestra `TS · Respaldo` en lugar de `Python · FastAPI`.

---

## 1. Estructura del repositorio

```
├── vercel.json               ← define los DOS servicios (frontend + backend)
├── backend/                  ← CEREBRO PYTHON (FastAPI)
│   ├── app/main.py           ← app = FastAPI()
│   ├── app/config.py         ← credenciales: env AI_* > .z-ai-config
│   ├── app/ai_client.py      ← cliente compatible OpenAI
│   ├── app/docx_builder.py   ← Markdown → .docx
│   └── requirements.txt
├── prisma/schema.prisma      ← Conversation, Message, Memory, GeneratedDocument
└── src/
    ├── app/page.tsx          ← la aplicación (ruta /)
    ├── app/api/…             ← chat, image, document, conversations, memories…
    ├── lib/brain.ts          ← selección de motor: Python → respaldo TS
    └── components/aurora/    ← UI: sidebar, mensajes, composer, memoria, badge
```

## 2. Subir el código

1. Crea un repositorio en GitHub y sube el proyecto:

   ```bash
   git init && git add . && git commit -m "Aurora IA beta: TypeScript + Python"
   git remote add origin https://github.com/tu-usuario/aurora-ia.git
   git push -u origin main
   ```

   (`.gitignore` ya excluye `node_modules`, `.env`, `db/`, cachés de Python…)
   **No subas tu `.env`** — las claves van como variables de entorno en Vercel.

## 3. Importar en Vercel (Services: frontend + backend juntos)

1. Entra a [vercel.com/new](https://vercel.com/new) e importa el repositorio.
2. **Framework Preset: elige "Services"** (no "Next.js"). El `vercel.json`
   de la raíz ya declara los dos servicios:
   - `frontend` → Next.js en la raíz
   - `backend` → FastAPI en `backend/`
   - El *service binding* inyecta `BACKEND_URL` en el frontend (backend privado).
3. Root Directory: la **raíz del repositorio** (no cambies nada).

## 4. Variables de entorno (Settings → Environment Variables)

| Variable         | Servicio  | Valor                                                          |
| ---------------- | --------- | -------------------------------------------------------------- |
| `AI_BASE_URL`    | todos     | `https://open.bigmodel.cn/api/paas/v4` (GLM) u `https://api.openai.com/v1` |
| `AI_API_KEY`     | todos     | tu clave del proveedor                                          |
| `AI_CHAT_MODEL`  | opcional  | ej. `glm-4.6`, `gpt-4o-mini`                                    |
| `AI_IMAGE_MODEL` | opcional  | ej. `cogview-4`, `dall-e-3`                                     |
| `DATABASE_URL`   | frontend  | cadena PostgreSQL (paso 5)                                      |

> `BACKEND_URL` **no** se configura a mano: lo inyecta el service binding.

## 5. Base de datos (producción)

En local usa SQLite (`db/custom.db`). El filesystem de Vercel es efímero, así
que en producción usa PostgreSQL:

1. Crea una base gratis en [Neon](https://neon.tech) (o Supabase).
2. En `prisma/schema.prisma` cambia `provider = "sqlite"` → `provider = "postgresql"`.
3. Añade `DATABASE_URL` (cadena de Neon) en Vercel.
4. Crea las tablas desde tu máquina: `npx prisma db push`.

## 6. Plan B — backend Python en otro hosting

Si prefieres no usar la beta de Vercel Services:

1. Despliega `backend/` en [Render](https://render.com) o [Railway](https://railway.app)
   (Python service, start command del README del backend, mismas variables `AI_*`).
2. En Vercel importa el proyecto con preset **Next.js** (ignora el vercel.json
   o bórralo) y define `BACKEND_URL=https://tu-cerebro.onrender.com` y las `AI_*`.

## 7. Plan C — solo TypeScript (sin servicio Python)

La app funciona igual gracias al respaldo: importa con preset **Next.js**,
define `AI_BASE_URL` + `AI_API_KEY` y listo. El badge mostrará `TS · Respaldo`.
Útil como red de seguridad el día de la presentación.

## 8. Desarrollo en local

```bash
npm install                      # (o bun install)
cp .env.example .env             # rellena AI_BASE_URL y AI_API_KEY
npx prisma db push               # crea db/custom.db
npm run dev                      # Next.js en :3000
bash scripts/start-cerebro.sh    # cerebro Python en :8000 (o npm run cerebro)
```

`src/instrumentation.ts` intenta arrancar el cerebro automáticamente al levantar
Next.js; si no hay Python disponible, la app usa el respaldo TS sin romperse.

## 9. Checklist para la presentación

- [ ] Badge del encabezado en verde: `Python · FastAPI`
- [ ] Chat responde con streaming y Markdown (pide código de ejemplo)
- [ ] Modo Imagen: genera y descarga la imagen (~15-30 s)
- [ ] Modo Documento: genera y descarga un .docx real (hecho por Python)
- [ ] Historial: conversaciones persisten, se renombran y se borran
- [ ] Memoria: cuenta algo personal y pregunta "¿qué sabes de mí?"
- [ ] Responsive: muestra la versión móvil (menú hamburguesa)

## 10. Problemas comunes

| Síntoma                                        | Causa / solución                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------- |
| `No Output Directory named "public"`           | Preset equivocado: usa **Services** con root en la raíz del repo      |
| Badge en `TS · Respaldo` en producción         | El servicio Python no levantó: revisa el log del servicio `backend`   |
| Chat responde `No hay motor de IA disponible`  | Faltan `AI_BASE_URL` / `AI_API_KEY` en las variables de entorno       |
| `PrismaClientInitializationError`              | `DATABASE_URL` ausente o provider aún en `sqlite`                     |
| 404 al descargar .docx                         | El documento existe pero la sesión no coincide (x-session-id)         |
| Imagen tarda > 30 s                            | Normal en el primer arranque en frío; Fluid compute tarda en escalar  |
