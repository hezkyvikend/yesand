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
  const canSubmit = typeof onSubmit === 'function' && hasDraft && !disabled
  const canGenerate = generateEnabled || (allowGenerateFromDraft && hasDraft)

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus()
    }
  }, [disabled])

  function submitDraft() {
    if (!canSubmit) return
    onSubmit?.(value)
    setValue('')
  }

  function handleKeyDown(event) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    submitDraft()
  }

  return (
    <div className={styles.container}>
      <div className={styles.inputRow}>
        <input
          ref={inputRef}
          type="text"
          className={styles.input}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          enterKeyHint="send"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
        />
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.sendBtn}
            disabled={!canSubmit}
            onClick={submitDraft}
          >
            send
          </button>
          {showGenerate && (
            <button
              type="button"
              className={styles.generateIconBtn}
              disabled={!canGenerate}
              aria-label="generate image"
              title="Generate image"
              onClick={() => {
                onGenerate?.(value)
                if (hasDraft) {
                  setValue('')
                }
              }}
            >
              <svg
                viewBox="0 0 24 24"
                className={styles.generateIcon}
                aria-hidden="true"
                focusable="false"
              >
                <path d="M12 2.5L14.5 9.5L21.5 12L14.5 14.5L12 21.5L9.5 14.5L2.5 12L9.5 9.5L12 2.5Z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
