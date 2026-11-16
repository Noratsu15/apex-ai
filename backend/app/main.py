# -*- coding: utf-8 -*-
"""
main.py — Cerebro de IA de Aurora (FastAPI).

Endpoints
---------
GET  /health           → estado del servicio y de la configuración de IA
POST /ai/chat/stream   → chat con streaming SSE (misma interfaz que la capa TS)
POST /ai/image         → generación de imágenes (devuelve base64 PNG)
POST /ai/docx          → construcción de documentos Word con python-docx

Arranque local:
    cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
"""

from __future__ import annotations

import base64
import json
from collections.abc import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from .ai_client import CerebroError, ClienteIA
from .config import config
from .docx_builder import construir_docx, slugify

app = FastAPI(
    title="Aurora IA — Cerebro",
    description="Motor de IA (Python/FastAPI) del chat Aurora: chat, imágenes y documentos.",
    version="1.0.0-beta",
)

# La llamada viene del servidor Next.js (misma red); CORS abierto por simplicidad
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_cliente = ClienteIA(config) if config.listo else None


def _error(mensaje: str, estado: int = 503) -> JSONResponse:
    return JSONResponse(status_code=estado, content={"error": mensaje})


def _requerir_cliente() -> ClienteIA:
    if _cliente is None:
        raise CerebroError(
            "El cerebro Python no tiene proveedor de IA configurado. "
            "Define AI_BASE_URL y AI_API_KEY (o coloca .z-ai-config)."
        )
    return _cliente


# --------------------------------------------------------------------- modelos
class Mensaje(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str


class ChatSolicitud(BaseModel):
    messages: list[Mensaje]


class ImagenSolicitud(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    size: str = "1024x1024"


class DocxSolicitud(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    markdown: str = Field(min_length=1)
    fileName: str | None = None


# --------------------------------------------------------------------- health
@app.get("/health")
async def health() -> dict:
    return {
        "ok": True,
        "servicio": "aurora-cerebro",
        "lenguaje": "python",
        "ia": config.listo,
        "proveedor": config.proveedor,
        "modelo_chat": config.chat_model or "(predeterminado del proveedor)",
        "modelo_imagen": config.image_model or "(predeterminado del proveedor)",
    }


# ---------------------------------------------------------------- chat stream
@app.post("/ai/chat/stream")
async def chat_stream(solicitud: ChatSolicitud) -> StreamingResponse:
    cliente = _requerir_cliente()
    mensajes = [{"role": m.role, "content": m.content} for m in solicitud.messages]

    async def flujo() -> AsyncIterator[bytes]:
        try:
            async for delta in cliente.chat_stream(mensajes):
                yield f"data: {json.dumps({'type': 'delta', 'content': delta}, ensure_ascii=False)}\n\n".encode("utf-8")
            yield b"data: {\"type\": \"done\"}\n\n"
        except CerebroError as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)}, ensure_ascii=False)}\n\n".encode("utf-8")

    return StreamingResponse(
        flujo(),
        media_type="text/event-stream; charset=utf-8",
        headers={"Cache-Control": "no-cache, no-transform"},
    )


# ---------------------------------------------------------------------- image
def _mime_desde_bytes(crudo: bytes) -> str:
    """Detecta el tipo real de imagen (algunos proveedores devuelven JPEG)."""
    if crudo.startswith(b"\x89PNG"):
        return "image/png"
    if crudo.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if crudo.startswith((b"GIF87a", b"GIF89a")):
        return "image/gif"
    if crudo.startswith(b"RIFF"):
        return "image/webp"
    return "image/png"


@app.post("/ai/image")
async def generar_imagen(solicitud: ImagenSolicitud) -> dict:
    cliente = _requerir_cliente()
    try:
        base64_imagen = await cliente.imagen(solicitud.prompt, solicitud.size)
    except CerebroError as exc:
        return _error(str(exc))
    return {
        "base64": base64_imagen,
        "mime": _mime_desde_bytes(base64.b64decode(base64_imagen[:64])),
        "size": solicitud.size,
    }


# ----------------------------------------------------------------------- docx
@app.post("/ai/docx")
async def generar_docx(solicitud: DocxSolicitud) -> dict:
    try:
        contenido = construir_docx(solicitud.title, solicitud.markdown)
    except Exception as exc:  # python-docx falla de formas variadas
        return _error(f"No pude construir el documento Word: {exc}", estado=500)
    nombre = solicitud.fileName or f"{slugify(solicitud.title)}.docx"
    return {
        "fileName": nombre,
        "docxBase64": base64.b64encode(contenido).decode("ascii"),
    }


# Manejador global: errores no previstos también devuelven JSON amable
@app.exception_handler(CerebroError)
async def manejador_cerebro_error(_peticion, exc: CerebroError):
    return _error(str(exc))
