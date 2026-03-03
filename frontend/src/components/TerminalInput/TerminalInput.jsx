import { useEffect, useRef, useState } from 'react'
import styles from './TerminalInput.module.css'

export function TerminalInput({
  onSubmit,
  disabled = false,
  placeholder = 'enter to send...',
  onGenerate,
  generateEnabled = false,
  allowGenerateFromDraft = false,
  showGenerate = false,
}) {
  const [value, setValue] = useState('')
  const inputRef = useRef(null)
  const hasDraft = value.trim().length > 0
  const canGenerate = generateEnabled || (allowGenerateFromDraft && hasDraft)

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  function handleKeyDown(event) {
    if (event.key === 'Enter') {
      event.preventDefault()
      const trimmed = value.trim()
      if (!trimmed) return
      onSubmit?.(value)
      setValue('')
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          className={styles.input}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
        />
        {showGenerate && (
          <button
            type="button"
            className={styles.generateBtn}
            disabled={!canGenerate}
            onClick={() => {
              onGenerate?.(value)
              if (hasDraft) {
                setValue('')
              }
            }}
          >
            generate
          </button>
        )}
      </div>
    </div>
  )
}
