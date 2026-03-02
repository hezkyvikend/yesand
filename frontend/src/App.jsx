import { useCallback, useEffect, useReducer, useState } from 'react'
import styles from './App.module.css'
import { fetchPersonas, fetchSuggestion, generateImage, streamChat } from './api'
import { initialState, sessionReducer } from './state/sessionReducer'
import {
  getOrCreateConversationId,
  getOrCreateSessionId,
  getOrCreateUserId,
  startNewConversationId,
} from './state/identity'
import { Terminal } from './components/Terminal/Terminal'

function getChatMessages(messages) {
  return messages.filter((msg) => msg.role === 'human' || msg.role === 'ai')
}

function App() {
  const [state, dispatch] = useReducer(sessionReducer, initialState)
  const [personas, setPersonas] = useState([])
  const [personaError, setPersonaError] = useState(null)
  const [userId] = useState(() => getOrCreateUserId())
  const [sessionId] = useState(() => getOrCreateSessionId())
  const [conversationId, setConversationId] = useState(() => getOrCreateConversationId())

  useEffect(() => {
    let active = true
    fetchPersonas({ userId, sessionId })
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
  }, [userId, sessionId])

  const handleSelectPersona = useCallback((persona) => {
    const nextConversationId = startNewConversationId()
    setConversationId(nextConversationId)
    dispatch({ type: 'SELECT_PERSONA', persona })
    fetchSuggestion({ userId, sessionId, conversationId: nextConversationId })
      .then((data) => {
        dispatch({ type: 'SET_SUGGESTION', word: data.word })
      })
      .catch(() => {
        dispatch({ type: 'ADD_ERROR_MESSAGE', content: 'error: failed to fetch suggestion' })
        dispatch({ type: 'SET_SUGGESTION', word: '???' })
      })
  }, [userId, sessionId])

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
        { userId, sessionId, conversationId },
      )
    },
    [state.isStreaming, state.persona, state.messages, userId, sessionId, conversationId],
  )

  const handleGenerate = useCallback(() => {
    if (state.phase !== 'CHATTING' || state.isStreaming) return
    const chatMessages = getChatMessages(state.messages)
    if (!chatMessages.length) return

    dispatch({ type: 'GENERATE' })
    generateImage(state.persona.id, chatMessages, { userId, sessionId, conversationId })
      .then((data) => {
        dispatch({ type: 'IMAGE_READY', imageUrl: data.image_url, promptUsed: data.prompt_used })
      })
      .catch(() => {
        dispatch({ type: 'ADD_ERROR_MESSAGE', content: 'error: generation failed' })
        dispatch({ type: 'GENERATE_FAILED' })
      })
  }, [state.isStreaming, state.phase, state.persona, state.messages, userId, sessionId, conversationId])

  const handleReplayPrompt = useCallback(
    (text) => {
      const trimmed = text.trim()
      if (!trimmed) return
      dispatch({
        type: 'ADD_SYSTEM_MESSAGE',
        content: `> ${trimmed}`,
        variant: 'normal',
      })
      setTimeout(() => {
        dispatch({ type: 'RESET' })
      }, 0)
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
        onReplayPrompt={handleReplayPrompt}
        onLoadingComplete={() => dispatch({ type: 'LOADING_COMPLETE' })}
        onRevealComplete={() => dispatch({ type: 'REVEAL_COMPLETE' })}
      />
    </div>
  )
}

export default App
