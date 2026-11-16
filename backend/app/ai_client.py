# -*- coding: utf-8 -*-
"""
ai_client.py — Cliente HTTP de IA compatible con la API de OpenAI.

Replica exactamente las peticiones que hace el SDK de Node (z-ai-web-dev-sdk)
para que el cerebro Python hable con el mismo gateway en desarrollo, y con
cualquier proveedor estándar (OpenAI, GLM/Z.ai, DeepSeek, Groq…) en producción.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from .config import ConfigIA


class CerebroError(RuntimeError):
    """Error con mensaje apto para mostrar al usuario final."""


class ClienteIA:
    """Cliente mínimo de chat/imagen sobre una API compatible con OpenAI."""

    def __init__(self, cfg: ConfigIA) -> None:
        self.cfg = cfg
        # Timeouts generosos: la generación de imágenes tarda 15-60 s
        self.http = httpx.AsyncClient(
            base_url=cfg.base_url,
            headers=self._cabeceras(),
            timeout=httpx.Timeout(connect=15.0, read=300.0, write=60.0, pool=15.0),
        )

    # ------------------------------------------------------------------ base
    def _cabeceras(self) -> dict[str, str]:
        cabeceras = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.cfg.api_key}",
        }
        cabeceras.update(self.cfg.cabeceras_extra)
        return cabeceras

    def _cuerpo_chat(self, mensajes: list[dict[str, str]], stream: bool) -> dict[str, Any]:
        cuerpo: dict[str, Any] = {"messages": mensajes, "stream": stream}
        if self.cfg.chat_model:
            cuerpo["model"] = self.cfg.chat_model
        # El gateway interno de Z.ai espera "thinking"; los proveedores
        # estándar rechazan campos desconocidos, así que solo se envía allí.
        if self.cfg.gateway_interno:
            cuerpo["thinking"] = {"type": "disabled"}
        return cuerpo

    @staticmethod
    def _leer_error(resp: httpx.Response) -> str:
        try:
            detalle = resp.json()
            return str(detalle.get("error", {}).get("message") or detalle.get("detail") or detalle)
        except Exception:
            return resp.text[:300]

    # ------------------------------------------------------------------ chat
    async def chat_stream(self, mensajes: list[dict[str, str]]) -> AsyncIterator[str]:
        """Streaming de la respuesta del modelo: cede cada fragmento de texto."""
        try:
            async with self.http.stream(
                "POST", "/chat/completions", json=self._cuerpo_chat(mensajes, stream=True)
            ) as resp:
                if resp.status_code >= 400:
                    await resp.aread()
                    raise CerebroError(
                        f"El proveedor de IA respondió {resp.status_code}: {self._leer_error(resp)}"
                    )
                async for linea in resp.aiter_lines():
                    if not linea or not linea.startswith("data:"):
                        continue
                    carga = linea[5:].strip()
                    if not carga or carga == "[DONE]":
                        continue
                    try:
                        fragmento = json.loads(carga)
                    except json.JSONDecodeError:
                        continue  # fragmento SSE incompleto
                    delta = (fragmento.get("choices") or [{}])[0].get("delta", {}).get("content")
                    if isinstance(delta, str) and delta:
                        yield delta
        except CerebroError:
            raise
        except httpx.HTTPError as exc:
            raise CerebroError(f"No pude contactar al proveedor de IA: {exc}") from exc

    async def chat(self, mensajes: list[dict[str, str]]) -> str:
        """Respuesta completa (sin streaming)."""
        cuerpo = self._cuerpo_chat(mensajes, stream=False)
        try:
            resp = await self.http.post("/chat/completions", json=cuerpo)
        except httpx.HTTPError as exc:
            raise CerebroError(f"No pude contactar al proveedor de IA: {exc}") from exc
        if resp.status_code >= 400:
            raise CerebroError(
                f"El proveedor de IA respondió {resp.status_code}: {self._leer_error(resp)}"
            )
        try:
            return resp.json()["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, ValueError) as exc:
            raise CerebroError("El proveedor de IA devolvió una respuesta con formato inesperado") from exc

    # ---------------------------------------------------------------- imagen
    async def imagen(self, prompt: str, size: str = "1024x1024") -> str:
        """Genera una imagen y la devuelve como base64 (PNG)."""
        cuerpo: dict[str, Any] = {"prompt": prompt, "size": size}
        if self.cfg.image_model:
            cuerpo["model"] = self.cfg.image_model
            # Los proveedores estándar exigen response_format para recibir bytes
            cuerpo["response_format"] = "b64_json"
        try:
            resp = await self.http.post("/images/generations", json=cuerpo)
        except httpx.HTTPError as exc:
            raise CerebroError(f"No pude contactar al proveedor de imágenes: {exc}") from exc
        if resp.status_code >= 400:
            raise CerebroError(
                f"El proveedor de imágenes respondió {resp.status_code}: {self._leer_error(resp)}"
            )
        try:
            item = resp.json()["data"][0]
        except (KeyError, IndexError, ValueError) as exc:
            raise CerebroError("El proveedor de imágenes no devolvió datos") from exc

        # Formatos habituales: base64 (gateway interno) o b64_json (OpenAI)
        for clave in ("base64", "b64_json"):
            valor = item.get(clave)
            if isinstance(valor, str) and valor:
                return valor

        # Si llega una URL, se descarga y se convierte a base64.
        # IMPORTANTE: la descarga se hace con un cliente limpio, SIN las
        # cabeceras de autenticación del gateway (la CDN las rechaza con 403),
        # exactamente igual que hace el SDK de Node (fetch plano).
        url = item.get("url")
        if isinstance(url, str) and url:
            import base64

            intentos = (
                {},  # tal cual
                {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36"},
            )
            ultimo_error = "descarga fallida"
            for extra in intentos:
                try:
                    async with httpx.AsyncClient(
                        timeout=httpx.Timeout(180.0, connect=15.0),
                        follow_redirects=True,
                        headers=extra,
                    ) as descargador:
                        descarga = await descargador.get(url)
                except httpx.HTTPError as exc:
                    ultimo_error = str(exc)
                    continue
                if descarga.status_code < 400 and descarga.content:
                    return base64.b64encode(descarga.content).decode("ascii")
                ultimo_error = f"HTTP {descarga.status_code}"
            raise CerebroError(f"No pude descargar la imagen generada ({ultimo_error})")

        raise CerebroError("La respuesta del proveedor no contiene ninguna imagen")
