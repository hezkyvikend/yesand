import { ImageReveal } from '../ImageReveal/ImageReveal'
import { LoadingSequence, buildLoadingScript } from '../LoadingSequence/LoadingSequence'
import { MessageHistory } from '../MessageHistory/MessageHistory'
import { PersonaSelector } from '../PersonaSelector/PersonaSelector'
import { TerminalInput } from '../TerminalInput/TerminalInput'
import { TerminalLine } from '../TerminalLine/TerminalLine'
import styles from './Terminal.module.css'

function LoadingTranscript({ persona, suggestionWord }) {
  if (!persona || !suggestionWord) return null
  const script = buildLoadingScript(persona, suggestionWord)

  return (
    <div className={styles.transcript}>
      {script.map((line, index) => {
        if (line.pause || line.inline) return null
        const nextLine = script[index + 1]
        if (line.noBreak && nextLine?.inline) {
          return (
            <div key={`${index}-group`} style={{ display: 'flex' }}>
              <TerminalLine text={line.text} />
              <TerminalLine text={nextLine.text} />
            </div>
          )
        }
        return <TerminalLine key={`${index}-${line.text}`} text={line.text} />
      })}
    </div>
  )
}

function getChatMessageCount(messages) {
  return messages.filter((m) => m.role === 'human' || m.role === 'ai').length
}

export function Terminal({
  personas,
  personaError,
  state,
  onSelectPersona,
  onInput,
  onGenerate,
  onReplayPrompt,
  onLoadingComplete,
  onRevealComplete,
}) {
  const showInstruction = true
  const showTranscript = state.phase !== 'IDLE' && state.phase !== 'LOADING'
  const { phase } = state

  const hasMessages = getChatMessageCount(state.messages) > 0

  const isChatPhase = phase === 'READY' || phase === 'CHATTING'
  const inputProps = {
    onSubmit: isChatPhase ? onInput : phase === 'FINISHED' ? onReplayPrompt : undefined,
    disabled: (!isChatPhase && phase !== 'FINISHED') || state.isStreaming,
    placeholder: phase === 'FINISHED' ? 'press any key' : 'enter to send...',
    showGenerate: true,
    generateEnabled: isChatPhase && hasMessages && !state.isStreaming,
    allowGenerateFromDraft: isChatPhase && !state.isStreaming,
    onGenerate,
  }

  return (
    <div className={styles.terminal}>
      {showInstruction ? (
        <>
          <div className={styles.instruction}>
            <ul className={styles.instructionList}>
              <li className={styles.instructionItem}>Select a scene partner from below.</li>
              <li className={styles.instructionItem}>
                Type your initial idea in response to the suggested word, then press Enter to send.
              </li>
              <li className={styles.instructionItem}>
                Riff with your AI scene partner and keep the conversation going as long as you want.
              </li>
              <li className={styles.instructionItem}>
                Press generate to create an image from your conversation.
              </li>
            </ul>
          </div>
          {showTranscript ? (
            <LoadingTranscript persona={state.persona} suggestionWord={state.suggestionWord} />
          ) : null}
        </>
      ) : null}

      {phase === 'IDLE' && (
        <>
          {personaError ? <TerminalLine text={personaError} variant="error" /> : null}
          {!personas.length && !personaError ? (
            <TerminalLine text="loading personas..." variant="hint" />
          ) : null}
          {personas.length ? (
            <PersonaSelector personas={personas} onSelect={onSelectPersona} />
          ) : null}
        </>
      )}

      {phase === 'LOADING' && (
        <LoadingSequence
          persona={state.persona}
          suggestionWord={state.suggestionWord}
          onComplete={onLoadingComplete}
        />
      )}

      {(phase === 'READY' || phase === 'CHATTING') && (
        <MessageHistory messages={state.messages} isStreaming={state.isStreaming} />
      )}

      {phase === 'GENERATING' && (
        <>
          <MessageHistory messages={state.messages} isStreaming={state.isStreaming} />
          <TerminalLine text="generating image..." typing speed={25} step={2} />
        </>
      )}

      {phase === 'REVEALING' && (
        <>
          <MessageHistory messages={state.messages} isStreaming={false} />
          <TerminalLine text="generating image... done." />
          <ImageReveal src={state.imageUrl} onRevealComplete={onRevealComplete} />
        </>
      )}

      {phase === 'FINISHED' && (
        <>
          <MessageHistory messages={state.messages} isStreaming={false} />
          <TerminalLine text="generating image... done." />
          <ImageReveal src={state.imageUrl} revealed />
          <TerminalLine text="press any key to play again" />
        </>
      )}

      <TerminalInput {...inputProps} />
    </div>
  )
}
