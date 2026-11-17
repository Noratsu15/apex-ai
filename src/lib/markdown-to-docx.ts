import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'

/**
 * Conversor pragmático Markdown → .docx para los documentos generados por la IA.
 * Soporta: títulos (#..####), listas con viñetas y numeradas, negritas, itálicas,
 * código en línea y en bloque, citas, tablas y separadores.
 */

type Runs = TextRun[]

/** Divide una línea en TextRuns resolviendo **negrita**, *itálica* y `código`. */
function inlineRuns(line: string, base: Partial<{ bold: boolean }> = {}): Runs {
  const tokens = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g).filter(Boolean)
  return tokens.map((token) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return new TextRun({ text: token.slice(2, -2), bold: true })
    }
    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      return new TextRun({ text: token.slice(1, -1), italics: true })
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return new TextRun({ text: token.slice(1, -1), font: 'Consolas', color: '9A3B6E' })
    }
    return new TextRun({ text: token, bold: base.bold })
  })
}

function celdaMarkdown(texto: string, encabezado: boolean): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: inlineRuns(texto, { bold: encabezado }) })],
    shading: encabezado ? { type: ShadingType.CLEAR, fill: 'E8E8E8' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  })
}

/** Convierte las filas de una tabla Markdown en una Table de docx. */
function tablaMarkdown(filas: string[][]): Table {
  const [encabezado, ...cuerpo] = filas
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: encabezado.map((c) => celdaMarkdown(c, true)),
      }),
      ...cuerpo.map((fila) => new TableRow({ children: fila.map((c) => celdaMarkdown(c, false)) })),
    ],
  })
}

function separaFilaTabla(linea: string): string[] {
  return linea
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim())
}

export function slugify(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .toLowerCase()
      .slice(0, 60) || 'documento'
  )
}

/** Construye el documento Word a partir del título y el contenido Markdown. */
export async function markdownADocx(titulo: string, markdown: string): Promise<Buffer> {
  const hijos: (Paragraph | Table)[] = []

  // Título del documento
  hijos.push(
    new Paragraph({
      text: titulo,
      heading: HeadingLevel.TITLE,
      spacing: { after: 300 },
    })
  )

  const lineas = markdown.replace(/\r\n/g, '\n').split('\n')
  let i = 0

  while (i < lineas.length) {
    const linea = lineas[i]
    const limpia = linea.trim()

    // Bloque de código ```
    if (limpia.startsWith('```')) {
      const codigo: string[] = []
      i++
      while (i < lineas.length && !lineas[i].trim().startsWith('```')) {
        codigo.push(lineas[i])
        i++
      }
      i++ // cierre ```
      codigo.forEach((cod) => {
        hijos.push(
          new Paragraph({
            children: [new TextRun({ text: cod || ' ', font: 'Consolas', size: 18 })],
            shading: { type: ShadingType.CLEAR, fill: 'F4F4F4' },
            spacing: { before: 0, after: 0 },
            indent: { left: 240 },
          })
        )
      })
      hijos.push(new Paragraph({ text: '', spacing: { after: 120 } }))
      continue
    }

    // Tabla Markdown
    if (limpia.startsWith('|') && linea.includes('|', 1)) {
      const filas: string[][] = []
      while (i < lineas.length && lineas[i].trim().startsWith('|')) {
        const fila = separaFilaTabla(lineas[i])
        // descarta la fila separadora |---|---|
        if (!fila.every((c) => /^:?-{3,}:?$/.test(c))) filas.push(fila)
        i++
      }
      if (filas.length > 0) hijos.push(tablaMarkdown(filas))
      hijos.push(new Paragraph({ text: '', spacing: { after: 120 } }))
      continue
    }

    // Separador horizontal
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(limpia)) {
      hijos.push(
        new Paragraph({
          text: '',
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CCCCCC', space: 1 } },
          spacing: { after: 200 },
        })
      )
      i++
      continue
    }

    // Encabezados
    const encabezado = /^(#{1,4})\s+(.*)$/.exec(limpia)
    if (encabezado) {
      const nivel = encabezado[1].length
      const niveles = [
        HeadingLevel.HEADING_1,
        HeadingLevel.HEADING_2,
        HeadingLevel.HEADING_3,
        HeadingLevel.HEADING_4,
      ]
      hijos.push(
        new Paragraph({
          children: inlineRuns(encabezado[2]),
          heading: niveles[nivel - 1],
          spacing: { before: 240, after: 120 },
        })
      )
      i++
      continue
    }

    // Cita
    if (limpia.startsWith('> ')) {
      hijos.push(
        new Paragraph({
          children: [new TextRun({ text: limpia.slice(2), italics: true, color: '555555' })],
          indent: { left: 720 },
        })
      )
      i++
      continue
    }

    // Lista numerada
    const numerada = /^(\s*)(\d+)[.)]\s+(.*)$/.exec(linea)
    if (numerada) {
      hijos.push(
        new Paragraph({
          children: inlineRuns(`${numerada[2]}. ${numerada[3]}`),
          indent: { left: 720 },
          spacing: { after: 80 },
        })
      )
      i++
      continue
    }

    // Lista con viñetas
    const vineta = /^(\s*)[-*+]\s+(.*)$/.exec(linea)
    if (vineta) {
      hijos.push(
        new Paragraph({
          children: inlineRuns(vineta[2]),
          bullet: { level: Math.min(2, Math.floor(vineta[1].length / 2)) },
          spacing: { after: 80 },
        })
      )
      i++
      continue
    }

    // Línea vacía
    if (limpia === '') {
      hijos.push(new Paragraph({ text: '', spacing: { after: 100 } }))
      i++
      continue
    }

    // Párrafo normal
    hijos.push(
      new Paragraph({
        children: inlineRuns(limpia),
        spacing: { after: 120, line: 300 },
        alignment: AlignmentType.JUSTIFIED,
      })
    )
    i++
  }

  // Pie discreto de procedencia
  hijos.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Documento generado por Apex IA (Beta) — ${new Date().toLocaleDateString('es', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}`,
          italics: true,
          color: '999999',
          size: 16,
        }),
      ],
      spacing: { before: 400 },
    })
  )

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
    },
    sections: [{ properties: {}, children: hijos }],
  })

  return Packer.toBuffer(doc)
}
