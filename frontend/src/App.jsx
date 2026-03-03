import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import styles from './App.module.css'
import { fetchPersonas, fetchSuggestion, formatErrorForDisplay, generateImage, streamChat } from './api'
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
  const generateInFlightRef = useRef(false)

  useEffect(() => {
    let active = true
    fetchPersonas({ userId, sessionId })
      .then((data) => {
        if (!active) return
        setPersonas(data.personas)
      })
      .catch((error) => {
        if (!active) return
        setPersonaError(formatErrorForDisplay(error, 'failed to load personas'))
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
      .catch((error) => {
        dispatch({
          type: 'ADD_ERROR_MESSAGE',
          content: formatErrorForDisplay(error, 'failed to fetch suggestion'),
        })
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
        (error) => {
          dispatch({
            type: 'ADD_ERROR_MESSAGE',
            content: formatErrorForDisplay(error, 'chat failed'),
          })
          dispatch({ type: 'END_AI_MESSAGE' })
        },
        { userId, sessionId, conversationId },
        state.suggestionWord,
      )
    },
    [state.isStreaming, state.persona, state.messages, state.suggestionWord, userId, sessionId, conversationId],
  )

  const handleGenerate = useCallback((draftText = '') => {
    if (state.isStreaming || generateInFlightRef.current) return

    const trimmedDraft = typeof draftText === 'string' ? draftText.trim() : ''
    const isChatPhase = state.phase === 'READY' || state.phase === 'CHATTING'
    if (!isChatPhase) return

    let chatMessages = getChatMessages(state.messages)
    if (trimmedDraft) {
      dispatch({ type: 'SEND_MESSAGE', content: draftText })
      chatMessages = [...chatMessages, { role: 'human', content: draftText }]
    }

    if (!chatMessages.length) return

    generateInFlightRef.current = true
    dispatch({ type: 'GENERATE' })
    generateImage(state.persona.id, chatMessages, { userId, sessionId, conversationId }, state.suggestionWord)
      .then((data) => {
        dispatch({ type: 'IMAGE_READY', imageUrl: data.image_url, promptUsed: data.prompt_used })
      })
      .catch((error) => {
        dispatch({
          type: 'ADD_ERROR_MESSAGE',
          content: formatErrorForDisplay(error, 'generation failed'),
        })
        dispatch({ type: 'GENERATE_FAILED' })
      })
      .finally(() => {
        generateInFlightRef.current = false
      })
  }, [state.isStreaming, state.phase, state.persona, state.messages, state.suggestionWord, userId, sessionId, conversationId])

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
