import ZAI from 'z-ai-web-dev-sdk'
import fs from 'fs'

const zai = await ZAI.create()

for (const archivo of process.argv.slice(2)) {
  const base64 = fs.readFileSync(archivo).toString('base64')
  const r = await zai.chat.completions.createVision({
    messages: [{
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Describe brevemente esta captura de una app de chat: ¿se ve el sidebar (o header móvil), el estado vacío con saludo y tarjetas de sugerencia, el compositor con pestañas de modo? ¿Hay algún elemento roto, texto cortado o superpuesto? Responde en español, máximo 60 palabras.',
        },
        { type: 'image_url', image_url: { url: `data:image/png;base64,${base64}` } },
      ],
    }],
    thinking: { type: 'disabled' },
  })
  console.log(`=== ${archivo.split('/').pop()} ===`)
  console.log((r.choices[0]?.message?.content ?? '').slice(0, 600))
}
