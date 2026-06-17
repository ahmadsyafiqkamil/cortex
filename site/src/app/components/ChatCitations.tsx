import type { ChatCitation } from '../lib/chatApi'

interface ChatCitationsProps {
  citations: ChatCitation[]
}

export function ChatCitations({ citations }: ChatCitationsProps) {
  if (citations.length === 0) return null
  return (
    <ul className="chat-citations" aria-label="Sources">
      {citations.map((c) => (
        <li key={`${c.slug}-${c.source_blob_id}`}>
          <a href={`#/app/wiki/${c.slug}`}>{c.slug}</a>
          <span className="chat-citations__title"> — {c.source_title}</span>
          <code className="chat-citations__blob">{c.source_blob_id}</code>
        </li>
      ))}
    </ul>
  )
}
