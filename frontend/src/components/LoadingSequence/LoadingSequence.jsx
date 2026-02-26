import { useEffect, useMemo, useState } from 'react'
import { TerminalLine } from '../TerminalLine/TerminalLine'
import styles from './LoadingSequence.module.css'

export function buildLoadingScript(persona, suggestionWord) {
  const step = 3
  const pullsToward = persona?.aesthetic?.pulls_toward?.join(', ') || ''
  const pullsAway = persona?.aesthetic?.pulls_away_from?.join(', ') || ''

  const base = [
    { text: 'loading scene partner...', speed: 25, step },
    { text: '████████████████', speed: 500, step, noBreak: true},
    { text: ' complete ✓', speed: 12, step: 2 , inline: true},
    { text: '', speed: 0, step },
    { text: `PERSONA: ${persona?.name ?? ''}`, speed: 22, step },
    { text: `"${persona?.tagline ?? ''}"`, speed: 22, step },
    { text: '', speed: 0, step },
    { text: `pulls toward: ${pullsToward}`, speed: 18, step },
    { text: `pulls away from: ${pullsAway}`, speed: 18, step },
    { text: '', speed: 0, step },
    { text: 'waiting for suggestion from the audience', speed: 22, step, noBreak: true },
    { text: '...', speed: 1000, step: 1, inline: true },
  ]

  if (!suggestionWord) return base

  return [
    ...base,
    { text: `▶  ${suggestionWord}`, speed: 45, step: 2 },
    { text: '', speed: 0, step },
    { text: 'your scene, your rules. begin when ready.', speed: 22, step },
  ]
}

export function LoadingSequence({ persona, suggestionWord, onComplete }) {
  const [activeIndex, setActiveIndex] = useState(0)
  const script = useMemo(
    () => buildLoadingScript(persona, suggestionWord),
    [persona, suggestionWord],
  )

  useEffect(() => {
    setActiveIndex(0)
  }, [persona?.id])

  useEffect(() => {
    if (suggestionWord && activeIndex >= script.length) {
      onComplete?.()
    }
  }, [activeIndex, script.length, suggestionWord, onComplete])

  useEffect(() => {
    const currentLine = script[activeIndex]
    if (!currentLine?.pause) return undefined
    const timeout = setTimeout(() => {
      setActiveIndex((current) => current + 1)
    }, currentLine.pause)
    return () => clearTimeout(timeout)
  }, [activeIndex, script])

  return (
    <div className={styles.loading}>
      {script.map((line, index) => {
        if (line.pause || line.inline) return null
        const isActive = index === activeIndex
        if (index > activeIndex) return null

        const nextLine = script[index + 1]
        if (line.noBreak && nextLine?.inline) {
          const inlineIsActive = index + 1 === activeIndex
          return (
            <div key={`${index}-group`} className={styles.inlineGroup}>
              <TerminalLine
                text={line.text}
                typing={isActive}
                speed={line.speed}
                step={line.step ?? 1}
                onComplete={() => setActiveIndex((current) => current + 1)}
              />
              {index + 1 <= activeIndex && (
                <TerminalLine
                  text={nextLine.text}
                  typing={inlineIsActive}
                  speed={nextLine.speed}
                  step={nextLine.step ?? 1}
                  onComplete={() => setActiveIndex((current) => current + 1)}
                />
              )}
            </div>
          )
        }

        return (
          <TerminalLine
            key={`${index}-${line.text}`}
            text={line.text}
            typing={isActive}
            speed={line.speed}
            step={line.step ?? 1}
            onComplete={() => setActiveIndex((current) => current + 1)}
          />
        )
      })}
    </div>
  )
}
