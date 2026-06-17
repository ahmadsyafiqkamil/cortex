import { useState, useRef, useEffect } from 'react'
import { ArrowUp, MessageSquare, Plus, PanelLeftOpen, PanelLeftClose } from 'lucide-react'
import { sendChat, type ChatMessage } from '../lib/chatApi'
import {
  getActiveSession,
  createSession,
  updateSession,
  deleteSession,
  getSessions,
  setActiveSession,
  type Turn,
} from '../lib/chatStore'
import { ChatBubble } from '../components/ChatBubble'
import { ChatSidebar } from '../components/ChatSidebar'

const EXAMPLES = [
  'What should I do if I lose my passport abroad?',
  'What are the requirements for SPLP?',
  'How does the dispute process work in Cortex?',
]

export function AskCortex() {
  const [activeId, setActiveId] = useState<string | null>(() => getActiveSession()?.id ?? null)
  const [turns, setTurns] = useState<Turn[]>(() => getActiveSession()?.turns ?? [])
  const [sessions, setSessions] = useState(() => getSessions())
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024)
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    function onResize() {
      setSidebarOpen(window.innerWidth >= 1024)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight
    }
  }, [turns])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  useEffect(() => {
    setSessions(getSessions())
  }, [turns])

  function persist(updated: Turn[]) {
    setTurns(updated)
    if (activeId) {
      updateSession(activeId, updated)
    }
  }

  function startNewChat() {
    const session = createSession()
    setActiveId(session.id)
    setTurns([])
    setError(null)
    inputRef.current?.focus()
  }

  function switchTo(id: string) {
    const session = setActiveSession(id)
    if (session) {
      setActiveId(session.id)
      setTurns(session.turns)
      setError(null)
    }
  }

  function removeSession(id: string) {
    const nextId = deleteSession(id)
    if (nextId === null) {
      setActiveId(null)
      setTurns([])
      setError(null)
    } else if (nextId !== id) {
      const session = getSessions().find((s) => s.id === nextId)
      if (session) {
        setActiveId(session.id)
        setTurns(session.turns)
      }
    }
  }

  async function submit(question: string) {
    if (!question.trim() || busy) return

    const nextTurns: Turn[] = [...turns, { role: 'user', text: question }]
    persist(nextTurns)
    setInput('')
    setBusy(true)
    setError(null)

    const history: ChatMessage[] = nextTurns.map((t) => ({ role: t.role, content: t.text }))
    try {
      const resp = await sendChat(history)
      const final: Turn[] = [...nextTurns, { role: 'assistant', text: resp.answer, citations: resp.citations }]
      persist(final)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit(input)
    }
  }

  const sessionTitle = activeId
    ? sessions.find((s) => s.id === activeId)?.title ?? 'Chat'
    : null
  const hasTurns = turns.length > 0

  return (
    <div className="flex flex-row h-[calc(100vh-3.5rem)]">
      <ChatSidebar
        sessions={sessions}
        activeId={activeId}
        isOpen={sidebarOpen}
        onSwitch={switchTo}
        onDelete={removeSession}
        onNew={startNewChat}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between h-10 px-4 border-b border-[var(--cx-border-subtle)] shrink-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-[var(--cx-text-tertiary)] hover:text-[var(--cx-text-primary)] transition-colors p-1 -ml-1"
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              {sidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
            {hasTurns && sessionTitle && (
              <h2 className="text-sm font-semibold text-[var(--cx-text-primary)] truncate flex-1 mx-3">
                {sessionTitle}
              </h2>
            )}
            <button
              onClick={startNewChat}
              className="flex items-center gap-1 px-2 py-1 text-xs text-[var(--cx-text-secondary)] hover:text-[var(--cx-text-primary)] transition-colors rounded shrink-0"
              title="New chat"
            >
              <Plus className="w-3.5 h-3.5" />
              New
            </button>
          </div>

        <div ref={threadRef} className="flex-1 overflow-y-auto">
          {turns.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 text-center">
              <div className="w-12 h-12 rounded-full bg-[var(--cx-accent-muted)] flex items-center justify-center mb-6">
                <MessageSquare className="w-6 h-6 text-[var(--cx-accent)]" />
              </div>
              <h1 className="text-xl font-semibold text-[var(--cx-text-primary)] mb-2">Ask Cortex</h1>
              <p className="text-sm text-[var(--cx-text-secondary)] max-w-md mb-4">
                Every answer is grounded in the wiki with verifiable provenance.
                Chats are saved in your browser — pick up where you left off.
              </p>
              {!sidebarOpen && sessions.length > 0 && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="mb-6 text-xs text-[var(--cx-accent)] hover:text-[var(--cx-accent-hover)] transition-colors font-mono"
                >
                  Open sidebar to browse past chats →
                </button>
              )}
              <div className="flex flex-wrap justify-center gap-2 max-w-xl">
                {EXAMPLES.map((q) => (
                  <button
                    key={q}
                    onClick={() => submit(q)}
                    disabled={busy}
                    className="px-4 py-2 text-sm text-[var(--cx-text-secondary)] border border-[var(--cx-border-visible)] rounded-full hover:bg-[var(--cx-bg-surface)] hover:text-[var(--cx-text-primary)] transition-colors disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-[800px] mx-auto px-4 py-6 space-y-6">
              {turns.map((t, i) => (
                <ChatBubble key={i} role={t.role} text={t.text} citations={t.citations} />
              ))}
              {busy && (
                <div className="flex items-center gap-1 px-1 py-2">
                  <span className="w-2 h-2 rounded-full bg-[var(--cx-text-tertiary)] cx-bounce" />
                  <span className="w-2 h-2 rounded-full bg-[var(--cx-text-tertiary)] cx-bounce" style={{ animationDelay: '0.15s' }} />
                  <span className="w-2 h-2 rounded-full bg-[var(--cx-text-tertiary)] cx-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
              )}
              {error && (
                <div className="max-w-[800px] mx-auto px-4">
                  <p className="text-sm text-[var(--cx-danger)] bg-[var(--cx-bg-surface)] border border-red-900/40 rounded-lg px-4 py-3" role="alert">
                    {error}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gradient-to-t from-[var(--cx-bg-base)] via-[var(--cx-bg-base)] to-transparent pt-4 pb-6">
          <div className="max-w-[800px] mx-auto px-4">
            <div className="flex items-end gap-2 bg-[var(--cx-bg-surface)] border border-[var(--cx-border-visible)] rounded-full px-4 py-2 focus-within:border-[var(--cx-accent)] transition-colors">
              <textarea
                ref={inputRef}
                rows={1}
                aria-label="Your question"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask Cortex…"
                disabled={busy}
                className="flex-1 bg-transparent text-sm text-[var(--cx-text-primary)] placeholder:text-[var(--cx-text-tertiary)] resize-none outline-none py-1 max-h-[200px]"
              />
              <button
                onClick={() => submit(input)}
                disabled={busy || !input.trim()}
                className="w-8 h-8 rounded-full bg-[var(--cx-accent)] text-white flex items-center justify-center hover:bg-[var(--cx-accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
            <p className="text-center text-[10px] text-[var(--cx-text-tertiary)] mt-2 font-mono">
              Cortex may produce inaccurate answers. Always verify with cited sources.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
