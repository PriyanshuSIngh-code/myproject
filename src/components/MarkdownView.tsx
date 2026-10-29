import React from 'react'

interface MarkdownViewProps {
  content: string
}

export default function MarkdownView({ content }: MarkdownViewProps) {
  if (!content) return null

  // Process markdown text into blocks
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []

  let listBuffer: { type: 'ul' | 'ol'; items: string[] } | null = null
  let blockKey = 0

  function flushList() {
    if (!listBuffer) return
    const currentBuffer = listBuffer
    listBuffer = null

    if (currentBuffer.type === 'ol') {
      elements.push(
        <ol
          key={`ol-${blockKey++}`}
          style={{
            margin: '10px 0 14px 22px',
            paddingLeft: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            lineHeight: 1.6
          }}
        >
          {currentBuffer.items.map((it, idx) => (
            <li key={idx} style={{ fontSize: '13px', color: '#1e293b' }}>
              {renderInline(it)}
            </li>
          ))}
        </ol>
      )
    } else {
      elements.push(
        <ul
          key={`ul-${blockKey++}`}
          style={{
            margin: '10px 0 14px 20px',
            paddingLeft: '6px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            lineHeight: 1.6
          }}
        >
          {currentBuffer.items.map((it, idx) => (
            <li key={idx} style={{ fontSize: '13px', color: '#1e293b' }}>
              {renderInline(it)}
            </li>
          ))}
        </ul>
      )
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]
    const trimmed = rawLine.trim()

    // 1. Empty lines
    if (!trimmed) {
      flushList()
      continue
    }

    // 2. Headings (###, ##, #)
    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h4
          key={`h4-${blockKey++}`}
          style={{
            fontSize: '15px',
            fontWeight: 800,
            color: '#101a33',
            margin: '16px 0 8px 0',
            letterSpacing: '-0.3px',
            fontFamily: 'Manrope, sans-serif'
          }}
        >
          {renderInline(trimmed.slice(4))}
        </h4>
      )
      continue
    }

    if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h3
          key={`h3-${blockKey++}`}
          style={{
            fontSize: '17px',
            fontWeight: 800,
            color: '#101a33',
            margin: '20px 0 10px 0',
            letterSpacing: '-0.4px',
            fontFamily: 'Manrope, sans-serif'
          }}
        >
          {renderInline(trimmed.slice(3))}
        </h3>
      )
      continue
    }

    // 3. Numbered lists (1. , 2. )
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)/)
    if (numberedMatch) {
      if (!listBuffer || listBuffer.type !== 'ol') {
        flushList()
        listBuffer = { type: 'ol', items: [] }
      }
      listBuffer.items.push(numberedMatch[2])
      continue
    }

    // 4. Bullet lists (- , * )
    const bulletMatch = trimmed.match(/^[-*]\s+(.*)/)
    if (bulletMatch) {
      if (!listBuffer || listBuffer.type !== 'ul') {
        flushList()
        listBuffer = { type: 'ul', items: [] }
      }
      listBuffer.items.push(bulletMatch[1])
      continue
    }

    // 5. Normal paragraphs
    flushList()
    elements.push(
      <p
        key={`p-${blockKey++}`}
        style={{
          margin: '0 0 12px 0',
          fontSize: '13px',
          lineHeight: 1.7,
          color: '#26334f'
        }}
      >
        {renderInline(trimmed)}
      </p>
    )
  }

  flushList()

  return <div style={{ wordBreak: 'break-word' }}>{elements}</div>
}

function renderInline(text: string): React.ReactNode {
  // Regex to split by bold (**text**), italics (*text*), code (`code`), or links ([text](url))
  const parts: React.ReactNode[] = []
  let remaining = text

  while (remaining.length > 0) {
    // 1. Link [label](url)
    const linkMatch = remaining.match(/^\[(.*?)\]\((https?:\/\/[^\s)]+)\)/)
    if (linkMatch) {
      parts.push(
        <a
          key={parts.length}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#b38b39', fontWeight: 600, textDecoration: 'underline' }}
        >
          {linkMatch[1]}
        </a>
      )
      remaining = remaining.slice(linkMatch[0].length)
      continue
    }

    // 2. Bold (**text**)
    const boldMatch = remaining.match(/^\*\*(.*?)\*\*/)
    if (boldMatch) {
      parts.push(
        <strong key={parts.length} style={{ fontWeight: 700, color: '#0f172a' }}>
          {boldMatch[1]}
        </strong>
      )
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // 3. Inline code (`code`)
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      parts.push(
        <code
          key={parts.length}
          style={{
            background: '#f1f5f9',
            color: '#0f172a',
            padding: '2px 6px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '12px'
          }}
        >
          {codeMatch[1]}
        </code>
      )
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // 4. Normal character chunk
    const nextSpecial = remaining.search(/(\[|\*\*|`)/)
    if (nextSpecial === -1) {
      parts.push(remaining)
      break
    } else if (nextSpecial > 0) {
      parts.push(remaining.slice(0, nextSpecial))
      remaining = remaining.slice(nextSpecial)
    } else {
      // Encountered special char that didn't form a full token
      parts.push(remaining[0])
      remaining = remaining.slice(1)
    }
  }

  return <>{parts}</>
}
