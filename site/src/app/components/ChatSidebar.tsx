import { PenLine, Trash2 } from 'lucide-react'
import type { ChatSession } from '../lib/chatStore'

interface ChatSidebarProps {
  sessions: ChatSession[]
  activeId: string | null
  isOpen: boolean
  onSwitch: (id: string) => void
  onDelete: (id: string) => void
  onNew: () => void
  onClose: () => void
}

export function ChatSidebar({ sessions, activeId, isOpen, onSwitch, onDelete, onNew, onClose }: ChatSidebarProps) {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)

  const sidebar = (
    <div className={`h-full flex flex-col bg-[var(--cx-bg-surface)] border-r border-[var(--cx-border-subtle)] transition-all duration-200 shrink-0 ${isOpen ? 'w-[260px]' : 'w-0 overflow-hidden border-r-0'}`}>
      <div className="flex items-center justify-between px-3 h-10 shrink-0">
        <span className="text-xs font-mono font-bold text-[var(--cx-text-tertiary)] uppercase tracking-wider">
          Chats
        </span>
        <button
          onClick={onNew}
          className="text-[var(--cx-text-tertiary)] hover:text-[var(--cx-text-primary)] transition-colors"
          title="New chat"
        >
          <PenLine className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="px-3 py-4 text-xs text-[var(--cx-text-tertiary)] text-center">
            No chats yet
          </p>
        ) : (
          sorted.map((s) => {
            const isActive = s.id === activeId
            return (
              <div
                key={s.id}
                className={`relative flex items-center pr-2 group transition-colors cursor-pointer ${isActive
                    ? 'bg-[var(--cx-accent-muted)] border-l-2 border-[var(--cx-accent)]'
                    : 'hover:bg-[var(--cx-bg-elevated)] border-l-2 border-transparent'
                  }`}
                onClick={() => { onSwitch(s.id); onClose() }}
              >
                <div className="flex-1 min-w-0 px-3 py-2.5">
                  <p className="text-xs text-[var(--cx-text-primary)] truncate leading-tight">
                    {s.title}
                  </p>
                  <p className="text-[10px] text-[var(--cx-text-tertiary)] mt-0.5 font-mono">
                    {s.turns.length} msgs · {timeAgo(s.updatedAt)}
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(s.id) }}
                  className="text-[var(--cx-text-tertiary)] hover:text-[var(--cx-danger)] transition-colors opacity-0 group-hover:opacity-100 shrink-0 p-1"
                  title="Delete"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )

  if (!isOpen) return sidebar

  return (
    <>
      {/* Mobile overlay backdrop */}
      <div className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      {/* Sidebar layer */}
      <div className="lg:static lg:z-auto fixed inset-y-0 left-0 z-50 lg:h-full">
        {sidebar}
      </div>
    </>
  )
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d`
  return `${Math.floor(days / 30)}mo`
}
