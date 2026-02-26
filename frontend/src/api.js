const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000'

async function readJson(response, errorMessage) {
  if (!response.ok) {
    throw new Error(errorMessage)
  }
  return response.json()
}

export async function fetchPersonas() {
  const response = await fetch(`${BASE}/personas`)
  return readJson(response, 'Failed to load personas')
}

export async function fetchSuggestion() {
  const response = await fetch(`${BASE}/suggest`)
  return readJson(response, 'Failed to fetch suggestion')
}

export async function sendMessage(personaId, messages) {
  const response = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona_id: personaId, messages }),
  })
  return readJson(response, 'Chat failed')
}

export function getProxyDownloadUrl(imageUrl) {
  return `${BASE}/proxy-image?url=${encodeURIComponent(imageUrl)}`
}

export async function generateImage(personaId, messages) {
  const response = await fetch(`${BASE}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ persona_id: personaId, messages }),
  })
  return readJson(response, 'Generation failed')
}

export async function streamChat(personaId, messages, onChunk, onDone, onError) {
  try {
    const response = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona_id: personaId, messages }),
    })

    if (!response.ok || !response.body) {
      throw new Error('Chat stream failed')
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
            const payload = JSON.parse(payloadText)

            if (payload.type === 'chunk') {
              onChunk?.(payload.content || '')
            } else if (payload.type === 'done') {
              onDone?.()
              finished = true
              return
            } else if (payload.type === 'error') {
              onError?.(payload.message || 'Stream error')
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
    onError?.(error)
  }
}
