export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ChatCitation {
  slug: string
  page_blob_id: string
  source_blob_id: string
  source_title: string
}

export interface ChatResponse {
  answer: string
  citations: ChatCitation[]
  pages_used: string[]
  refused: boolean
  error: string | null
}

const API_BASE = ""

export async function sendChat(messages: ChatMessage[]): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  })
  const data = (await res.json()) as ChatResponse
  if (!res.ok) {
    throw new Error(data.error || `Chat request failed (${res.status})`)
  }
  return data
}
