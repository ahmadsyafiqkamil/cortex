import { useState, useRef, useEffect } from 'react'
import { ArrowUp, MessageSquare } from 'lucide-react'
import { sendChat, type ChatMessage, type ChatCitation } from '../lib/chatApi'
import { ChatBubble } from '../components/ChatBubble'

interface Turn {
  role: 'user' | 'assistant'
  text: string
  citations?: ChatCitation[]
}

const EXAMPLES = [
  'What should I do if I lose my passport abroad?',
  'What are the requirements for SPLP?',
  'How does the dispute process work in Cortex?',
]

export function AskCortex() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const threadRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

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

  async function submit(question: string) {
    if (!question.trim() || busy) return

    const nextTurns: Turn[] = [...turns, { role: 'user', text: question }]
    setTurns(nextTurns)
    setInput('')
    setBusy(true)
    setError(null)

    const history: ChatMessage[] = nextTurns.map((t) => ({ role: t.role, content: t.text }))
    try {
      const resp = await sendChat(history)
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', text: resp.answer, citations: resp.citations },
      ])
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

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div ref={threadRef} className="flex-1 overflow-y-auto">
        {turns.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full px-4 text-center">
            <div className="w-12 h-12 rounded-full bg-[var(--cx-accent-muted)] flex items-center justify-center mb-6">
              <MessageSquare className="w-6 h-6 text-[var(--cx-accent)]" />
            </div>
            <h1 className="text-xl font-semibold text-[var(--cx-text-primary)] mb-2">Ask Cortex</h1>
            <p className="text-sm text-[var(--cx-text-secondary)] max-w-md mb-8">
              Every answer is grounded in the wiki with verifiable provenance.
            </p>
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
  )
}
