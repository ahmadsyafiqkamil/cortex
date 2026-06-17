import type { ChatCitation } from '../lib/chatApi'
import { ChatCitations } from './ChatCitations'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  text: string
  citations?: ChatCitation[]
}

const TAG_RE = /(\[\[[^\]|]+(?:[^|\]]*)?\]\])/g

function renderText(text: string) {
  const parts = text.split(TAG_RE)
  return parts.map((part, i) => {
    if (part.startsWith('[[') && part.endsWith(']]')) {
      const slug = part.slice(2, -2).split('|')[0].trim()
      return (
        <code key={i} className="inline-block px-1.5 py-0.5 text-xs font-mono bg-[var(--cx-accent-muted)] text-[var(--cx-accent)] rounded">
          {slug}
        </code>
      )
    }
    return <span key={i}>{part}</span>
  })
}

export function ChatBubble({ role, text, citations }: ChatBubbleProps) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] px-4 py-2.5 bg-[var(--cx-accent)] text-white rounded-2xl rounded-br-md text-sm leading-relaxed font-sans">
          {text}
        </div>
      </div>
    )
  }

  return (
    <div className="text-sm text-[var(--cx-text-primary)] leading-relaxed font-sans">
      <div className="whitespace-pre-wrap break-words">
        {renderText(text)}
      </div>
      {citations && citations.length > 0 && (
        <div className="mt-3">
          <ChatCitations citations={citations} />
        </div>
      )}
    </div>
  )
}
