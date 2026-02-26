import { useCallback, useEffect, useReducer, useState } from 'react'
import styles from './App.module.css'
import { fetchPersonas, fetchSuggestion, generateImage, getProxyDownloadUrl, streamChat } from './api'
import { initialState, sessionReducer } from './state/sessionReducer'
import { Terminal } from './components/Terminal/Terminal'

function getChatMessages(messages) {
  return messages.filter((msg) => msg.role === 'human' || msg.role === 'ai')
}

async function triggerDownload(imageUrl) {
  if (!imageUrl) return
  try {
    const response = await fetch(getProxyDownloadUrl(imageUrl))
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = blobUrl
    anchor.download = 'yesand.png'
    anchor.click()
    URL.revokeObjectURL(blobUrl)
  } catch {
    // fall back to direct link
    const anchor = document.createElement('a')
    anchor.href = getProxyDownloadUrl(imageUrl)
    anchor.download = 'yesand.png'
    anchor.target = '_blank'
    anchor.rel = 'noopener'
    anchor.click()
  }
}

function App() {
  const [state, dispatch] = useReducer(sessionReducer, initialState)
  const [personas, setPersonas] = useState([])
  const [personaError, setPersonaError] = useState(null)

  useEffect(() => {
    let active = true
    fetchPersonas()
      .then((data) => {
        if (!active) return
        setPersonas(data.personas)
      })
      .catch(() => {
        if (!active) return
        setPersonaError('error: failed to load personas')
      })
    return () => {
      active = false
    }
  }, [])

  const handleSelectPersona = useCallback((persona) => {
    dispatch({ type: 'SELECT_PERSONA', persona })
    fetchSuggestion()
      .then((data) => {
        dispatch({ type: 'SET_SUGGESTION', word: data.word })
      })
      .catch(() => {
        dispatch({ type: 'ADD_ERROR_MESSAGE', content: 'error: failed to fetch suggestion' })
        dispatch({ type: 'SET_SUGGESTION', word: '???' })
      })
  }, [])

  const handleInput = useCallback(
    (text) => {
      const trimmed = text.trim()
      if (!trimmed || state.isStreaming) return

      dispatch({ type: 'SEND_MESSAGE', content: text })
      dispatch({ type: 'START_AI_MESSAGE' })

      const updatedMessages = [...getChatMessages(state.messages), { role: 'human', content: text }]

      streamChat(
        state.persona.id,
        updatedMessages,
        (chunk) => dispatch({ type: 'APPEND_AI_CHUNK', chunk }),
        () => dispatch({ type: 'END_AI_MESSAGE' }),
        () => {
          dispatch({ type: 'ADD_ERROR_MESSAGE', content: 'error: chat failed' })
          dispatch({ type: 'END_AI_MESSAGE' })
        },
      )
    },
    [state.isStreaming, state.persona, state.messages],
  )

  const handleGenerate = useCallback(() => {
    if (state.phase !== 'CHATTING' || state.isStreaming) return
    const chatMessages = getChatMessages(state.messages)
    if (!chatMessages.length) return

    dispatch({ type: 'GENERATE' })
    generateImage(state.persona.id, chatMessages)
      .then((data) => {
        dispatch({ type: 'IMAGE_READY', imageUrl: data.image_url, promptUsed: data.prompt_used })
      })
      .catch(() => {
        dispatch({ type: 'ADD_ERROR_MESSAGE', content: 'error: generation failed' })
        dispatch({ type: 'GENERATE_FAILED' })
      })
  }, [state.isStreaming, state.phase, state.persona, state.messages])

  const handleDownloadPrompt = useCallback(
    (text) => {
      const trimmed = text.trim()
      if (!trimmed) return
      dispatch({
        type: 'ADD_SYSTEM_MESSAGE',
        content: `> ${trimmed}`,
        variant: 'normal',
      })
      const answer = trimmed.toLowerCase()
      if (answer === 'y') {
        triggerDownload(state.imageUrl)
        dispatch({
          type: 'ADD_SYSTEM_MESSAGE',
          content: 'downloading image to ~/Downloads...',
        })
      }
      dispatch({ type: 'DOWNLOAD_ANSWERED' })
    },
    [state.imageUrl],
  )

  const handleReplayPrompt = useCallback(
    (text) => {
      const trimmed = text.trim()
      if (!trimmed) return
      dispatch({
        type: 'ADD_SYSTEM_MESSAGE',
        content: `> ${trimmed}`,
        variant: 'normal',
      })
      const answer = trimmed.toLowerCase()
      if (answer === 'y' || answer === 'n') {
        setTimeout(() => {
          dispatch({ type: 'RESET' })
        }, 0)
      }
    },
    [],
  )

  return (
    <div className={styles.app}>
      <Terminal
        personas={personas}
        personaError={personaError}
        state={state}
        onSelectPersona={handleSelectPersona}
        onInput={handleInput}
        onGenerate={handleGenerate}
        onDownloadPrompt={handleDownloadPrompt}
        onReplayPrompt={handleReplayPrompt}
        onLoadingComplete={() => dispatch({ type: 'LOADING_COMPLETE' })}
        onRevealComplete={() => dispatch({ type: 'REVEAL_COMPLETE' })}
      />
    </div>
  )
}

export default App
