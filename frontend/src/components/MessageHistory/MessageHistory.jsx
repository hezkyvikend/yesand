import { useEffect, useRef } from 'react'
import { TerminalLine } from '../TerminalLine/TerminalLine'
import styles from './MessageHistory.module.css'

export function MessageHistory({ messages, isStreaming }) {
  const endRef = useRef(null)
  const lastAiIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .filter(({ message }) => message.role === 'ai')
    .map(({ index }) => index)
    .pop()

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className={styles.history}>
      {messages.map((message, index) => {
        if (message.role === 'human') {
          return (
            <TerminalLine
              key={`${index}-human`}
              text={`> ${message.content}`}
              variant="normal"
            />
          )
        }

        if (message.role === 'ai') {
          return (
            <TerminalLine
              key={`${index}-ai`}
              text={message.content}
              variant="ai"
              cursor={isStreaming && index === lastAiIndex}
            />
          )
        }

        const variant = message.variant ?? 'hint'
        return (
          <TerminalLine
            key={`${index}-system`}
            text={message.content}
            variant={variant}
          />
        )
      })}
      <div ref={endRef} />
    </div>
  )
}
