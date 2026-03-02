const BASE = import.meta.env.VITE_API_BASE ?? '/api'

class ApiError extends Error {
  constructor(message, options = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = options.status
    this.requestId = options.requestId
    this.detail = options.detail
    this.detailMessage = options.detailMessage
    this.code = options.code
    this.stage = options.stage
    this.retryable = options.retryable
    this.upstreamError = options.upstreamError
    this.endpoint = options.endpoint
    this.method = options.method
  }
}

function buildHeaders(context, includeJson = false) {
  const headers = {}
  if (includeJson) {
    headers['Content-Type'] = 'application/json'
  }
  if (context?.userId) {
    headers['X-User-Id'] = context.userId
  }
  if (context?.sessionId) {
    headers['X-Session-Id'] = context.sessionId
  }
  if (context?.conversationId) {
    headers['X-Conversation-Id'] = context.conversationId
  }
  return headers
}

function normalizeDetail(detail, fallbackRequestId) {
  const normalized = {
    detail: detail ?? '',
    detailMessage: '',
    code: undefined,
    stage: undefined,
    requestId: fallbackRequestId ?? undefined,
    retryable: undefined,
    upstreamError: undefined,
  }

  if (typeof detail === 'string') {
    normalized.detailMessage = detail
    return normalized
  }

  if (detail && typeof detail === 'object') {
    if (typeof detail.message === 'string') normalized.detailMessage = detail.message
    if (typeof detail.code === 'string') normalized.code = detail.code
    if (typeof detail.stage === 'string') normalized.stage = detail.stage
    if (!normalized.requestId && typeof detail.request_id === 'string') {
      normalized.requestId = detail.request_id
    }
    if (typeof detail.retryable === 'boolean') normalized.retryable = detail.retryable
    if (typeof detail.upstream_error === 'string') normalized.upstreamError = detail.upstream_error
    if (!normalized.detailMessage) normalized.detailMessage = JSON.stringify(detail)
    return normalized
  }

  if (detail != null) {
    normalized.detailMessage = String(detail)
  }
  return normalized
}

async function buildApiError(response, errorMessage, context = {}) {
  const requestId = response.headers.get('x-request-id') || undefined
  let parsedBody = null
  let fallbackText = ''

  try {
    parsedBody = await response.json()
  } catch {
    try {
      fallbackText = (await response.text()).trim()
    } catch {
      fallbackText = ''
    }
  }

  const rawDetail = parsedBody?.detail ?? parsedBody ?? fallbackText
  const detail = normalizeDetail(rawDetail, requestId)

  const parts = [
    errorMessage,
    response.status ? `(HTTP ${response.status})` : '',
    detail.detailMessage ? `- ${detail.detailMessage}` : '',
    detail.requestId ? `[request_id=${detail.requestId}]` : '',
  ].filter(Boolean)

  return new ApiError(parts.join(' '), {
    status: response.status,
    requestId: detail.requestId,
    detail: detail.detail,
    detailMessage: detail.detailMessage,
    code: detail.code,
    stage: detail.stage,
    retryable: detail.retryable,
    upstreamError: detail.upstreamError,
    endpoint: context.endpoint,
    method: context.method,
  })
}

async function readJson(response, errorMessage, context) {
  if (!response.ok) {
    throw await buildApiError(response, errorMessage, context)
  }
  return response.json()
}

export function formatErrorForDisplay(error, fallback) {
  const lines = [`error: ${fallback}`]

  if (!error) return lines.join('\n')
  if (typeof error === 'string') {
    lines.push(`detail: ${error}`)
    return lines.join('\n')
  }

  const detailMessage = typeof error.detailMessage === 'string' && error.detailMessage
    ? error.detailMessage
    : (typeof error.message === 'string' ? error.message : '')
  if (error.status) lines.push(`status: ${error.status}`)
  if (error.code) lines.push(`code: ${error.code}`)
  if (error.stage) lines.push(`stage: ${error.stage}`)
  if (typeof error.retryable === 'boolean') {
    lines.push(`retryable: ${error.retryable ? 'yes' : 'no'}`)
  }
  if (error.method) lines.push(`method: ${error.method}`)
  if (error.endpoint) lines.push(`endpoint: ${error.endpoint}`)
  if (detailMessage) lines.push(`detail: ${detailMessage}`)
  if (error.upstreamError) lines.push(`upstream: ${error.upstreamError}`)
  if (error.requestId) lines.push(`request id: ${error.requestId}`)

  return lines.join('\n')
}

export async function fetchPersonas(context) {
  const response = await fetch(`${BASE}/personas`, {
    headers: buildHeaders(context),
  })
  return readJson(response, 'Failed to load personas', {
    endpoint: '/personas',
    method: 'GET',
  })
}

export async function fetchSuggestion(context) {
  const response = await fetch(`${BASE}/suggest`, {
    headers: buildHeaders(context),
  })
  return readJson(response, 'Failed to fetch suggestion', {
    endpoint: '/suggest',
    method: 'GET',
  })
}

export async function sendMessage(personaId, messages, context, suggestionWord) {
  const response = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: buildHeaders(context, true),
    body: JSON.stringify({ persona_id: personaId, messages, suggestion_word: suggestionWord }),
  })
  return readJson(response, 'Chat failed', {
    endpoint: '/chat',
    method: 'POST',
  })
}

export function getProxyDownloadUrl(imageUrl) {
  return `${BASE}/proxy-image?url=${encodeURIComponent(imageUrl)}`
}

export async function generateImage(personaId, messages, context, suggestionWord) {
  const response = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: buildHeaders(context, true),
    body: JSON.stringify({ persona_id: personaId, messages, suggestion_word: suggestionWord }),
  })
  return readJson(response, 'Generation failed', {
    endpoint: '/generate',
    method: 'POST',
  })
}

export async function streamChat(personaId, messages, onChunk, onDone, onError, context, suggestionWord) {
  try {
    const response = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers: buildHeaders(context, true),
      body: JSON.stringify({ persona_id: personaId, messages, suggestion_word: suggestionWord }),
    })

    if (!response.ok) {
      throw await buildApiError(response, 'Chat stream failed', {
        endpoint: '/chat/stream',
        method: 'POST',
      })
    }
    if (!response.body) {
      throw new ApiError('Chat stream failed: empty response body', {
        code: 'chat_stream_empty_body',
        stage: 'chat_stream',
        retryable: true,
        endpoint: '/chat/stream',
        method: 'POST',
        requestId: response.headers.get('x-request-id') || undefined,
      })
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''
    let finished = false

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      let separatorIndex = buffer.indexOf('\n\n')
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex).trim()
        buffer = buffer.slice(separatorIndex + 2)

        if (rawEvent) {
          const dataLines = rawEvent
            .split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.replace('data:', '').trim())
          if (dataLines.length) {
            const payloadText = dataLines.join('')
            let payload
            try {
              payload = JSON.parse(payloadText)
            } catch (parseError) {
              throw new ApiError('Chat stream failed: invalid event payload', {
                code: 'chat_stream_parse_error',
                stage: 'chat_stream',
                retryable: true,
                endpoint: '/chat/stream',
                method: 'POST',
                requestId: response.headers.get('x-request-id') || undefined,
                upstreamError: String(parseError),
              })
            }

            if (payload.type === 'chunk') {
              onChunk?.(payload.content || '')
            } else if (payload.type === 'done') {
              onDone?.()
              finished = true
              return
            } else if (payload.type === 'error') {
              onError?.(new ApiError(payload.message || 'Stream error', {
                code: payload.code,
                stage: payload.stage,
                requestId: payload.request_id || response.headers.get('x-request-id') || undefined,
                retryable: payload.retryable,
                upstreamError: payload.upstream_error,
                endpoint: '/chat/stream',
                method: 'POST',
              }))
              finished = true
              return
            }
          }
        }

        separatorIndex = buffer.indexOf('\n\n')
      }
    }

    if (!finished) {
      onDone?.()
    }
  } catch (error) {
    if (error instanceof Error) {
      onError?.(error)
      return
    }
    onError?.(new ApiError('Chat stream failed', {
      endpoint: '/chat/stream',
      method: 'POST',
      detail: String(error),
    }))
  }
}
