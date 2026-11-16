# -*- coding: utf-8 -*-
"""
config.py — Configuración del proveedor de IA del cerebro Aurora.

Las credenciales NUNCA van en el código. Orden de prioridad:

1. Variables de entorno (producción, p. ej. en Vercel):
   - AI_BASE_URL   → endpoint compatible con OpenAI
                     (ej. https://api.openai.com/v1, https://open.bigmodel.cn/api/paas/v4)
   - AI_API_KEY    → clave del proveedor
   - AI_CHAT_MODEL → modelo de chat (opcional, ej. glm-4.6, gpt-4o-mini)
   - AI_IMAGE_MODEL→ modelo de imagen (opcional, ej. cogview-4, dall-e-3)

2. Archivo `.z-ai-config` (entorno de desarrollo de Z.ai):
   se busca en el directorio del proyecto, en el home del usuario y en /etc.

3. Sin credenciales: el servicio arranca en modo degradado; /health reporta
   ai=false y las llamadas de inferencia devuelven un error claro.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from urllib.parse import urlparse

# Rutas candidatas del archivo de configuración interna (mismo orden que el SDK de Node)
_RUTAS_CONFIG = [
    Path(__file__).resolve().parents[2] / ".z-ai-config",  # raíz del proyecto
    Path.home() / ".z-ai-config",
    Path("/etc/.z-ai-config"),
]


@dataclass
class ConfigIA:
    """Configuración resuelta del proveedor de IA."""

    base_url: str = ""
    api_key: str = ""
    chat_model: str = ""
    image_model: str = ""
    # Cabeceras extra del gateway interno (X-Chat-Id, X-User-Id, X-Token…)
    cabeceras_extra: dict[str, str] = field(default_factory=dict)
    # True cuando hablamos con el gateway interno de Z.ai (admite "thinking")
    gateway_interno: bool = False

    @property
    def listo(self) -> bool:
        return bool(self.base_url and self.api_key)

    @property
    def proveedor(self) -> str:
        try:
            host = urlparse(self.base_url).netloc
        except Exception:
            host = ""
        return host or "no configurado"


def _desde_entorno() -> ConfigIA:
    return ConfigIA(
        base_url=(os.environ.get("AI_BASE_URL") or "").strip().rstrip("/"),
        api_key=(os.environ.get("AI_API_KEY") or "").strip(),
        chat_model=(os.environ.get("AI_CHAT_MODEL") or "").strip(),
        image_model=(os.environ.get("AI_IMAGE_MODEL") or "").strip(),
    )


def _desde_archivo_zai() -> ConfigIA | None:
    for ruta in _RUTAS_CONFIG:
        try:
            datos = json.loads(ruta.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not (datos.get("baseUrl") and datos.get("apiKey")):
            continue
        cfg = ConfigIA(
            base_url=str(datos["baseUrl"]).rstrip("/"),
            api_key=str(datos["apiKey"]),
        )
        # Cabeceras que usa el SDK de Node frente al gateway interno
        for origen, destino in (
            ("chatId", "X-Chat-Id"),
            ("userId", "X-User-Id"),
            ("token", "X-Token"),
        ):
            if datos.get(origen):
                cfg.cabeceras_extra[destino] = str(datos[origen])
        cfg.cabeceras_extra["X-Z-AI-From"] = "Z"
        cfg.gateway_interno = True
        return cfg
    return None


def cargar_config() -> ConfigIA:
    """Resuelve la configuración con el orden de prioridad documentado."""
    cfg = _desde_entorno()
    if cfg.listo:
        return cfg
    por_archivo = _desde_archivo_zai()
    if por_archivo and por_archivo.listo:
        return por_archivo
    return cfg


# Configuración singleton del proceso
config = cargar_config()
