import { useState } from 'react'
import { sendChat, type ChatMessage, type ChatCitation } from '../lib/chatApi'
import { ChatBubble } from '../components/ChatBubble'

interface Turn {
  role: 'user' | 'assistant'
  text: string
  citations?: ChatCitation[]
}

export function AskCortex() {
  const [turns, setTurns] = useState<Turn[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const question = input.trim()
    if (!question || busy) return

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

  return (
    <main className="ask-cortex" aria-labelledby="ask-heading">
      <h1 id="ask-heading">Ask Cortex</h1>
      <p>Every answer is grounded in the wiki — click a source to trace it.</p>

      <div className="ask-cortex__thread">
        {turns.map((t, i) => (
          <ChatBubble key={i} role={t.role} text={t.text} citations={t.citations} />
        ))}
        {busy ? <p className="ask-cortex__status">Thinking…</p> : null}
        {error ? <p className="ask-cortex__error" role="alert">{error}</p> : null}
      </div>

      <form className="ask-cortex__form" onSubmit={onSubmit}>
        <input
          aria-label="Your question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. What do I do if I lose my passport abroad?"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !input.trim()}>Ask</button>
      </form>
    </main>
  )
}
