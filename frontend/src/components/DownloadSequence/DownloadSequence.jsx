import { useEffect, useState } from 'react'
import { TerminalLine } from '../TerminalLine/TerminalLine'
import styles from './DownloadSequence.module.css'

const PAUSE_MS = 10000

export function DownloadSequence({ onComplete }) {
  const [stage, setStage] = useState(0)

  useEffect(() => {
    if (stage !== 1) return undefined
    const timeout = setTimeout(() => setStage(2), PAUSE_MS)
    return () => clearTimeout(timeout)
  }, [stage])

  return (
    <div className={styles.download}>
      <TerminalLine
        text="downloading image..."
        typing={stage === 0}
        speed={30}
        step={2}
        onComplete={() => setStage(1)}
      />
      {stage >= 2 ? (
        <TerminalLine
          text="████████████████ complete ✓"
          typing
          speed={12}
          step={2}
          onComplete={onComplete}
        />
      ) : null}
    </div>
  )
}
