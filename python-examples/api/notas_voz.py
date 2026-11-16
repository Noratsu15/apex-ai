"""
notas_voz.py — Función serverless de Python para Vercel.

Ejemplo práctico que reutiliza el patrón de tu ia_brain.py (Apex Evolution):
genera una nota de voz con ElevenLabs a partir de un texto y la devuelve
en base64 para que el frontend de Aurora IA la reproduzca o envíe.

Cómo funciona en Vercel:
  1. Copia esta carpeta (api/) a la RAÍZ del proyecto Next.js.
  2. Copia también requirements.txt a la raíz.
  3. Configura las variables de entorno en Vercel:
       ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID
  4. La función queda disponible en: POST /api/notas-voz

Cuerpo de la petición (JSON):
  { "texto": "Hola, esta es una nota de voz de bienvenida" }

Respuesta (JSON):
  { "ok": true, "audio_base64": "...", "formato": "mp3" }

El frontend la consumiría así (TypeScript, en una route de Next.js o
directo desde un componente):

  const res = await fetch('/api/notas-voz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texto: 'Bienvenida al portal' }),
  })
  const { audio_base64 } = await res.json()
  new Audio(`data:audio/mpeg;base64,${audio_base64}`).play()
"""

import base64
import json
import os
from http.server import BaseHTTPRequestHandler

import requests

URL_TTS = "https://api.elevenlabs.io/v1/text-to-speech/{voz_id}"
MODELO = os.getenv("ELEVENLABS_MODEL", "eleven_multilingual_v2")


def generar_nota_de_voz(texto):
    """Llama a ElevenLabs y devuelve el mp3 en bytes (o None si falla)."""
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    voz_id = os.getenv("ELEVENLABS_VOICE_ID", "").strip()
    if not api_key or not voz_id:
        return None

    respuesta = requests.post(
        URL_TTS.format(voz_id=voz_id),
        headers={"xi-api-key": api_key, "Content-Type": "application/json"},
        json={
            "text": texto,
            "model_id": MODELO,
            "voice_settings": {
                "stability": 0.45,
                "similarity_boost": 0.85,
                "style": 0.15,
                "use_speaker_boost": True,
            },
        },
        params={"output_format": "mp3_44100_128"},
        timeout=120,
    )
    if respuesta.status_code != 200:
        return None
    if "audio" not in respuesta.headers.get("Content-Type", ""):
        return None
    return respuesta.content


class handler(BaseHTTPRequestHandler):
    """Formato estándar de las Vercel Python Serverless Functions."""

    def do_POST(self):  # noqa: N802 (nombre exigido por Vercel)
        try:
            longitud = int(self.headers.get("Content-Length", 0))
            cuerpo = json.loads(self.rfile.read(longitud) or b"{}")
            texto = str(cuerpo.get("texto", "")).strip()

            if not texto:
                self._responder(400, {"ok": False, "error": "Falta el campo 'texto'"})
                return

            audio = generar_nota_de_voz(texto[:1000])
            if audio is None:
                self._responder(
                    503,
                    {
                        "ok": False,
                        "error": "No se pudo generar el audio. Revisa ELEVENLABS_API_KEY y ELEVENLABS_VOICE_ID.",
                    },
                )
                return

            self._responder(
                200,
                {
                    "ok": True,
                    "formato": "mp3",
                    "audio_base64": base64.b64encode(audio).decode("ascii"),
                },
            )
        except Exception as error:  # fallo controlado: nunca tirar la función
            self._responder(500, {"ok": False, "error": str(error)[:200]})

    def _responder(self, estado, datos):
        carga = json.dumps(datos).encode("utf-8")
        self.send_response(estado)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(carga)))
        self.end_headers()
        self.wfile.write(carga)

    def log_message(self, formato, *args):
        # Silencia el log por petición; usa los logs de Vercel para depurar.
        return
