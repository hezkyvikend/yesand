export const initialState = {
  phase: 'IDLE',
  persona: null,
  suggestionWord: null,
  messages: [],
  imageUrl: null,
  promptUsed: null,
  isStreaming: false,
}

export function sessionReducer(state, action) {
  switch (action.type) {
    case 'SELECT_PERSONA':
      if (state.phase !== 'IDLE') return state
      return {
        ...state,
        phase: 'LOADING',
        persona: action.persona,
        suggestionWord: null,
        messages: [],
        imageUrl: null,
        promptUsed: null,
        isStreaming: false,
      }

    case 'SET_SUGGESTION':
      if (state.phase !== 'LOADING') return state
      return { ...state, suggestionWord: action.word }

    case 'LOADING_COMPLETE':
      if (state.phase !== 'LOADING') return state
      return { ...state, phase: 'READY' }

    case 'SEND_MESSAGE':
      if (state.phase !== 'READY' && state.phase !== 'CHATTING') return state
      return {
        ...state,
        phase: 'CHATTING',
        messages: [...state.messages, { role: 'human', content: action.content }],
      }

    case 'START_AI_MESSAGE':
      if (state.phase !== 'CHATTING' && state.phase !== 'READY') return state
      return {
        ...state,
        phase: 'CHATTING',
        isStreaming: true,
        messages: [...state.messages, { role: 'ai', content: '' }],
      }

    case 'APPEND_AI_CHUNK':
      if (!state.isStreaming) return state
      return {
        ...state,
        messages: state.messages.map((message, index) => {
          if (index !== state.messages.length - 1) return message
          if (message.role !== 'ai') return message
          return { ...message, content: message.content + action.chunk }
        }),
      }

    case 'END_AI_MESSAGE':
      return { ...state, isStreaming: false }

    case 'ADD_ERROR_MESSAGE':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'system', content: action.content, variant: 'error' },
        ],
      }

    case 'ADD_SYSTEM_MESSAGE':
      return {
        ...state,
        messages: [
          ...state.messages,
          { role: 'system', content: action.content, variant: action.variant ?? 'hint' },
        ],
      }

    case 'GENERATE':
      if (state.phase !== 'CHATTING') return state
      return { ...state, phase: 'GENERATING' }

    case 'IMAGE_READY':
      return {
        ...state,
        phase: 'REVEALING',
        imageUrl: action.imageUrl,
        promptUsed: action.promptUsed,
      }

    case 'REVEAL_COMPLETE':
      if (state.phase !== 'REVEALING') return state
      return { ...state, phase: 'DONE' }

    case 'DOWNLOAD_ANSWERED':
      if (state.phase !== 'DONE') return state
      return { ...state, phase: 'FINISHED' }

    case 'GENERATE_FAILED':
      return { ...state, phase: 'CHATTING', isStreaming: false }

    case 'RESET':
      return initialState

    default:
      return state
  }
}
