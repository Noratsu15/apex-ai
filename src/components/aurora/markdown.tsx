'use client'

import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

/**
 * Renderiza Markdown de las respuestas de la IA:
 * títulos, listas, tablas, citas, código en línea y bloques con resaltado.
 */
export const Markdown = memo(function Markdown({ contenido }: { contenido: string }) {
  return (
    <div className="aurora-markdown text-[15px] leading-relaxed break-words">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className="mt-4 mb-2 text-xl font-bold text-zinc-50">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-4 mb-2 text-lg font-bold text-zinc-50">{children}</h2>,
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1.5 text-base font-semibold text-zinc-100">{children}</h3>
          ),
          p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-zinc-50">{children}</strong>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-amber-500/50 pl-4 text-zinc-400 italic">
              {children}
            </blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-amber-400 underline underline-offset-2 hover:text-amber-300"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-zinc-900">{children}</thead>,
          th: ({ children }) => (
            <th className="px-3 py-2 text-left font-semibold text-zinc-200">{children}</th>
          ),
          td: ({ children }) => <td className="border-t border-zinc-800 px-3 py-2">{children}</td>,
          hr: () => <hr className="my-4 border-zinc-800" />,
          code: ({ children }) => (
            <code className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-[13px] text-amber-300">
              {children}
            </code>
          ),
          pre: ({ children }) => {
            const hijo = Array.isArray(children) ? children[0] : children
            const propsHijo = (hijo as { props?: { className?: string; children?: unknown } })?.props
            const match = /language-(\w+)/.exec(propsHijo?.className ?? '')
            const codigo = String(propsHijo?.children ?? '').replace(/\n$/, '')
            if (match) {
              return (
                <div className="my-3 overflow-hidden rounded-lg border border-zinc-800">
                  <SyntaxHighlighter
                    language={match[1]}
                    style={oneDark}
                    customStyle={{ margin: 0, background: '#18181b', fontSize: '13px' }}
                  >
                    {codigo}
                  </SyntaxHighlighter>
                </div>
              )
            }
            return (
              <pre className="my-3 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900 p-3 font-mono text-[13px] text-zinc-300">
                {codigo}
              </pre>
            )
          },
        }}
      >
        {contenido}
      </ReactMarkdown>
    </div>
  )
})
