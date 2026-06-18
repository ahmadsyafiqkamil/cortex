import type { ChatCitation } from './chatApi'

export interface Turn {
  role: 'user' | 'assistant'
  text: string
  citations?: ChatCitation[]
}

export interface ChatSession {
  id: string
  title: string
  turns: Turn[]
  createdAt: number
  updatedAt: number
}

const SESSIONS_KEY = 'cortex-chat-sessions'
const ACTIVE_KEY = 'cortex-chat-active-id'

export function getSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as ChatSession[]
  } catch {
    return []
  }
}

export function saveSessions(sessions: ChatSession[]): void {
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions))
}

export function getActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY)
}

export function saveActiveId(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_KEY, id)
  } else {
    localStorage.removeItem(ACTIVE_KEY)
  }
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

function deriveTitle(turns: Turn[]): string {
  const firstUser = turns.find((t) => t.role === 'user')
  if (!firstUser) return 'New Chat'
  const text = firstUser.text.trim()
  return text.length > 40 ? text.slice(0, 40) + '…' : text
}

export function createSession(): ChatSession {
  const session: ChatSession = {
    id: generateId(),
    title: 'New Chat',
    turns: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  const sessions = getSessions()
  sessions.unshift(session)
  saveSessions(sessions)
  saveActiveId(session.id)
  return session
}

export function updateSession(id: string, turns: Turn[]): ChatSession | null {
  const sessions = getSessions()
  const idx = sessions.findIndex((s) => s.id === id)
  if (idx === -1) return null
  sessions[idx] = {
    ...sessions[idx],
    title: deriveTitle(turns),
    turns,
    updatedAt: Date.now(),
  }
  saveSessions(sessions)
  return sessions[idx]
}

export function deleteSession(id: string): string | null {
  const sessions = getSessions().filter((s) => s.id !== id)
  saveSessions(sessions)

  if (getActiveId() === id) {
    const next = sessions[0] ?? null
    saveActiveId(next?.id ?? null)
    return next?.id ?? null
  }
  return getActiveId()
}

export function getActiveSession(): ChatSession | null {
  const id = getActiveId()
  if (!id) return null
  return getSessions().find((s) => s.id === id) ?? null
}

export function setActiveSession(id: string): ChatSession | null {
  const session = getSessions().find((s) => s.id === id)
  if (!session) return null
  saveActiveId(id)
  return session
}
