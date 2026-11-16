# -*- coding: utf-8 -*-
"""
docx_builder.py — Conversor Markdown → .docx con python-docx.

Espejo del conversor TypeScript (src/lib/markdown-to-docx.ts): soporta títulos
(#..####), listas con viñetas y numeradas, **negritas**, *itálicas*, `código`
en línea y en bloque, citas, tablas y separadores horizontales.
"""

from __future__ import annotations

import re
import unicodedata
from datetime import date
from io import BytesIO

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Pt, RGBColor

# Meses en español para el pie del documento (sin depender del locale del SO)
_MESES = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

_TOKEN_INLINE = re.compile(r"(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)")
_SEPARADOR_TABLA = re.compile(r"^:?-{3,}:?$")
_ENCABEZADO = re.compile(r"^(#{1,4})\s+(.*)$")
_LISTA_NUMERADA = re.compile(r"^(\s*)(\d+)[.)]\s+(.*)$")
_LISTA_VINIETA = re.compile(r"^(\s*)[-*+]\s+(.*)$")
_REGLA_HORIZONTAL = re.compile(r"^(-{3,}|\*{3,}|_{3,})$")


def slugify(texto: str) -> str:
    """Convierte un título en un nombre de archivo seguro (igual que la versión TS)."""
    normalizado = unicodedata.normalize("NFD", texto)
    sin_acentos = "".join(c for c in normalizado if unicodedata.category(c) != "Mn")
    limpio = re.sub(r"[^a-zA-Z0-9\s-]", "", sin_acentos).strip()
    return (re.sub(r"\s+", "-", limpio).lower()[:60]) or "documento"


def _sombrear(parrafo, color: str) -> None:
    """Aplica un color de fondo al párrafo (python-docx no lo trae de serie)."""
    pr = parrafo._p.get_or_add_pPr()
    sombreado = OxmlElement("w:shd")
    sombreado.set(qn("w:val"), "clear")
    sombreado.set(qn("w:fill"), color)
    pr.append(sombreado)


def _borde_inferior(parrafo) -> None:
    """Borde inferior fino (separador horizontal ---)."""
    pr = parrafo._p.get_or_add_pPr()
    bordes = OxmlElement("w:pBdr")
    inferior = OxmlElement("w:bottom")
    inferior.set(qn("w:val"), "single")
    inferior.set(qn("w:sz"), "6")
    inferior.set(qn("w:color"), "CCCCCC")
    bordes.append(inferior)
    pr.append(bordes)


def _runs_con_formato(parrafo, texto: str, negrita: bool = False) -> None:
    """Añade runs resolviendo **negrita**, *itálica* y `código` en línea."""
    for token in [t for t in _TOKEN_INLINE.split(texto) if t]:
        if token.startswith("**") and token.endswith("**") and len(token) > 4:
            run = parrafo.add_run(token[2:-2])
            run.bold = True
        elif token.startswith("*") and token.endswith("*") and len(token) > 2:
            run = parrafo.add_run(token[1:-1])
            run.italic = True
        elif token.startswith("`") and token.endswith("`") and len(token) > 2:
            run = parrafo.add_run(token[1:-1])
            run.font.name = "Consolas"
            run.font.color.rgb = RGBColor(0x9A, 0x3B, 0x6E)
        else:
            run = parrafo.add_run(token)
            if negrita:
                run.bold = True


def _separar_fila_tabla(linea: str) -> list[str]:
    return [c.strip() for c in linea.strip().strip("|").split("|")]


def _sombrear_celda(celda, color: str) -> None:
    """Aplica un color de fondo a una celda de tabla."""
    pr = celda._tc.get_or_add_tcPr()
    sombreado = OxmlElement("w:shd")
    sombreado.set(qn("w:val"), "clear")
    sombreado.set(qn("w:fill"), color)
    pr.append(sombreado)


def _tabla(doc: Document, filas: list[list[str]]) -> None:
    """Construye una tabla con estilo de cuadrícula y encabezado sombreado."""
    columnas = max(len(f) for f in filas)
    tabla = doc.add_table(rows=len(filas), cols=columnas)
    tabla.style = "Table Grid"
    for i, fila in enumerate(filas):
        for j in range(columnas):
            celda = tabla.rows[i].cells[j]
            parrafo = celda.paragraphs[0]
            texto = fila[j] if j < len(fila) else ""
            _runs_con_formato(parrafo, texto, negrita=(i == 0))
            if i == 0:
                _sombrear_celda(celda, "E8E8E8")


def construir_docx(titulo: str, markdown: str) -> bytes:
    """Construye el documento Word a partir del título y el contenido Markdown."""
    doc = Document()

    estilo_normal = doc.styles["Normal"]
    estilo_normal.font.name = "Calibri"
    estilo_normal.font.size = Pt(11)

    # Título principal del documento
    doc.add_heading(titulo, level=0)

    lineas = markdown.replace("\r\n", "\n").split("\n")
    i = 0
    while i < len(lineas):
        linea = lineas[i]
        limpia = linea.strip()

        # Bloque de código ```
        if limpia.startswith("```"):
            i += 1
            codigo: list[str] = []
            while i < len(lineas) and not lineas[i].strip().startswith("```"):
                codigo.append(lineas[i])
                i += 1
            i += 1  # cierre ```
            for trozo in codigo:
                p = doc.add_paragraph()
                run = p.add_run(trozo or " ")
                run.font.name = "Consolas"
                run.font.size = Pt(9)
                _sombrear(p, "F4F4F4")
                p.paragraph_format.left_indent = Pt(12)
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
            doc.add_paragraph()
            continue

        # Tabla Markdown
        if limpia.startswith("|") and "|" in linea[1:]:
            filas: list[list[str]] = []
            while i < len(lineas) and lineas[i].strip().startswith("|"):
                fila = _separar_fila_tabla(lineas[i])
                if not all(_SEPARADOR_TABLA.match(c) for c in fila):
                    filas.append(fila)
                i += 1
            if filas:
                _tabla(doc, filas)
            doc.add_paragraph()
            continue

        # Separador horizontal
        if _REGLA_HORIZONTAL.match(limpia):
            p = doc.add_paragraph()
            _borde_inferior(p)
            i += 1
            continue

        # Encabezados #..####
        m = _ENCABEZADO.match(limpia)
        if m:
            p = doc.add_heading(level=len(m.group(1)))
            _runs_con_formato(p, m.group(2))
            i += 1
            continue

        # Cita
        if limpia.startswith("> "):
            p = doc.add_paragraph()
            run = p.add_run(limpia[2:])
            run.italic = True
            run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
            p.paragraph_format.left_indent = Pt(36)
            i += 1
            continue

        # Lista numerada
        m = _LISTA_NUMERADA.match(linea)
        if m:
            p = doc.add_paragraph(style="List Number")
            _runs_con_formato(p, f"{m.group(2)}. {m.group(3)}")
            p.paragraph_format.left_indent = Pt(36)
            i += 1
            continue

        # Lista con viñetas (hasta 3 niveles)
        m = _LISTA_VINIETA.match(linea)
        if m:
            nivel = min(2, len(m.group(1)) // 2)
            estilo = "List Bullet" if nivel == 0 else f"List Bullet {nivel + 1}"
            p = doc.add_paragraph(style=estilo)
            _runs_con_formato(p, m.group(2))
            i += 1
            continue

        # Línea vacía
        if limpia == "":
            i += 1
            continue

        # Párrafo normal justificado
        p = doc.add_paragraph()
        _runs_con_formato(p, limpia)
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.space_after = Pt(6)
        p.paragraph_format.line_spacing = 1.25
        i += 1

    # Pie discreto de procedencia
    hoy = date.today()
    p = doc.add_paragraph()
    run = p.add_run(
        f"Documento generado por Aurora IA (Beta) — {hoy.day} de {_MESES[hoy.month - 1]} de {hoy.year}"
    )
    run.italic = True
    run.font.color.rgb = RGBColor(0x99, 0x99, 0x99)
    run.font.size = Pt(8)
    p.paragraph_format.space_before = Pt(20)

    buffer = BytesIO()
    doc.save(buffer)
    return buffer.getvalue()
