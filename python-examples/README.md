# Python en el proyecto Aurora IA (para Vercel)

Esta carpeta contiene un **ejemplo real** de función serverless en Python,
pensada para que reutilices la lógica de tu `ia_brain.py` de Apex Evolution
(ElevenLabs + WhatsApp Cloud API) dentro del nuevo proyecto TypeScript.

## Contenido

```
python-examples/
├── api/
│   └── notas_voz.py     ← función serverless de ejemplo (ElevenLabs TTS)
├── requirements.txt     ← dependencias Python que Vercel instalará
└── README.md            ← este archivo
```

## Cómo activarla al desplegar en Vercel

1. Copia la carpeta `api/` a la **raíz del proyecto** (junto a `package.json`):

   ```
   aurora-ia/
   ├── api/              ← funciones Python (Vercel las detecta solo)
   │   └── notas_voz.py
   ├── src/              ← el resto de la app Next.js
   ├── requirements.txt  ← también en la raíz
   └── package.json
   ```

2. Copia `requirements.txt` a la raíz del proyecto.

3. Añade las variables de entorno en Vercel
   (Proyecto → Settings → Environment Variables):

   | Variable               | Uso                                   |
   | ---------------------- | ------------------------------------- |
   | `ELEVENLABS_API_KEY`   | Clave de la cuenta de ElevenLabs      |
   | `ELEVENLABS_VOICE_ID`  | ID de la voz clonada de la mentora    |
   | `ELEVENLABS_MODEL`     | Opcional, por defecto multilingual_v2 |

4. Despliega. La función queda pública en:

   ```
   POST https://tu-proyecto.vercel.app/api/notas-voz
   Body: { "texto": "Hola, bienvenida a Apex Evolution 4.0" }
   ```

## Por qué esto encaja con tu arquitectura actual

- **Tu código actual**: PHP manda a llamar a `ia_brain.py` por CLI tras cada
  inscripción (`procesar_inscripcion.php` → `python3 ia_brain.py --inscripcion N`).
- **Con Vercel**: ya no necesitas PHP. El frontend TypeScript (o una route
  handler de Next.js) llama a `/api/notas-voz` con `fetch`, y la función
  Python hace el mismo trabajo en la nube, sin servidor que mantener.

El mismo patrón sirve para portar el resto de tu `core-processor.py`:
la cola de bienvenida (`apex_cola`) y las alertas de mantenimiento pueden
convertirse en funciones Python individuales (`api/cola.py`, `api/alertas.py`)
programadas con **Vercel Cron Jobs** (archivo `vercel.json`):

```json
{
  "crons": [
    { "path": "/api/alertas", "schedule": "0 13 * * *" }
  ]
}
```

## Limitaciones a tener en cuenta (fase beta)

- Las funciones serverless de Vercel tienen un máximo de ejecución
  (10 s en el plan gratuito, 60 s en Pro). Para colas largas o clonado de voz
  masivo, considera un worker dedicado (Railway, Render, Fly.io) que lea de
  tu base de datos, tal como hoy corre tu `--demonio`.
- La conexión directa a MySQL desde Python en Vercel funciona, pero para el
  nuevo proyecto se recomienda PostgreSQL (Neon/Supabase) — ver
  `DESPLIEGUE-VERCEL.md`.
