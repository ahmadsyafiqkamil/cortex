import type { ChatCitation } from '../lib/chatApi'
import { ChatCitations } from './ChatCitations'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  text: string
  citations?: ChatCitation[]
}

export function ChatBubble({ role, text, citations }: ChatBubbleProps) {
  return (
    <div className={`chat-bubble chat-bubble--${role}`}>
      <p className="chat-bubble__text">{text}</p>
      {role === 'assistant' && citations ? <ChatCitations citations={citations} /> : null}
    </div>
  )
}
