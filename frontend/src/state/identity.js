const USER_ID_KEY = 'yesand.user_id'
const SESSION_ID_KEY = 'yesand.session_id'
const CONVERSATION_ID_KEY = 'yesand.conversation_id'

function createId(prefix) {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`
  }
  const random = Math.random().toString(36).slice(2, 10)
  const timestamp = Date.now().toString(36)
  return `${prefix}_${timestamp}_${random}`
}

export function getOrCreateUserId() {
  if (typeof window === 'undefined') {
    return createId('user')
  }
  const existing = window.localStorage.getItem(USER_ID_KEY)
  if (existing) return existing
  const next = createId('user')
  window.localStorage.setItem(USER_ID_KEY, next)
  return next
}

export function getOrCreateSessionId() {
  if (typeof window === 'undefined') {
    return createId('session')
  }
  const existing = window.sessionStorage.getItem(SESSION_ID_KEY)
  if (existing) return existing
  const next = createId('session')
  window.sessionStorage.setItem(SESSION_ID_KEY, next)
  return next
}

export function getOrCreateConversationId() {
  if (typeof window === 'undefined') {
    return createId('conv')
  }
  const existing = window.localStorage.getItem(CONVERSATION_ID_KEY)
  if (existing) return existing
  const next = createId('conv')
  window.localStorage.setItem(CONVERSATION_ID_KEY, next)
  return next
}

export function startNewConversationId() {
  const next = createId('conv')
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CONVERSATION_ID_KEY, next)
  }
  return next
}
