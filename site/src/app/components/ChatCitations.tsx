import type { ChatCitation } from '../lib/chatApi'

interface ChatCitationsProps {
  citations: ChatCitation[]
}

export function ChatCitations({ citations }: ChatCitationsProps) {
  if (citations.length === 0) return null

  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Sources">
      {citations.map((c) => (
        <a
          key={`${c.slug}-${c.source_blob_id}`}
          href={`#/app/wiki/${c.slug}`}
          className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-[var(--cx-border-visible)] bg-[var(--cx-bg-surface)] hover:bg-[var(--cx-bg-elevated)] hover:border-[var(--cx-accent)] rounded-md text-xs font-mono transition-colors no-underline"
        >
          <span className="text-[var(--cx-accent)]">{c.slug}</span>
          <span className="text-[var(--cx-text-tertiary)]">·</span>
          <span className="text-[var(--cx-text-secondary)]">{c.source_title}</span>
          <span className="text-[var(--cx-text-tertiary)] truncate max-w-[12ch]">
            {c.source_blob_id}
          </span>
        </a>
      ))}
    </div>
  )
}
