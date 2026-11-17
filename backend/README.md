# Cerebro de Apex IA (Python · FastAPI)

Servicio Python que concentra **toda la inferencia de IA** del producto:

| Endpoint             | Método | Función                                                        |
| -------------------- | ------ | -------------------------------------------------------------- |
| `/health`            | GET    | Estado del servicio y de la configuración de IA                |
| `/ai/chat/stream`    | POST   | Chat con streaming SSE (la interfaz consume estos eventos)     |
| `/ai/image`          | POST   | Generación de imágenes; devuelve base64 + MIME real            |
| `/ai/docx`           | POST   | Construye documentos Word (.docx) con `python-docx`            |

La capa web (Next.js/TypeScript) lo llama por HTTP interno (`BACKEND_URL`).
Si el cerebro no responde, la app degrada a un respaldo TypeScript y el badge
de la interfaz lo indica.

## Arrancar en local

```bash
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

(o simplemente `bash scripts/start-cerebro.sh` desde la raíz del proyecto)

## Configuración del proveedor de IA

Credenciales **nunca** en el código. Dos formas:

1. **Variables de entorno** (producción): `AI_BASE_URL`, `AI_API_KEY` y,
   opcionalmente, `AI_CHAT_MODEL` y `AI_IMAGE_MODEL`. Sirve con cualquier
   API compatible con OpenAI (GLM/Z.ai, OpenAI, DeepSeek, Groq…).
2. **Archivo `.z-ai-config`** (solo entorno de desarrollo de Z.ai): se busca
   en la raíz del proyecto, en `~` y en `/etc`.

Sin credenciales el servicio arranca en modo degradado (`/health` → `ia: false`)
y las llamadas de inferencia devuelven un error claro.

## Estructura

```
backend/
├── requirements.txt        ← fastapi, uvicorn, httpx, python-docx
├── .python-version         ← 3.12 (la que usa Vercel por defecto)
└── app/
    ├── main.py             ← endpoints FastAPI
    ├── config.py           ← resolución de credenciales (env > .z-ai-config)
    ├── ai_client.py        ← cliente HTTP compatible con OpenAI (chat + imágenes)
    └── docx_builder.py     ← Markdown → .docx (títulos, listas, tablas, código…)
```
