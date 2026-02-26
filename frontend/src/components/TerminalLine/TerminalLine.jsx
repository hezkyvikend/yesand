import { useTypewriter } from '../../hooks/useTypewriter'
import styles from './TerminalLine.module.css'

export function TerminalLine({
  text = '',
  typing = false,
  speed = 30,
  step = 1,
  onComplete,
  variant = 'normal',
  cursor = false,
}) {
  const typed = useTypewriter(typing ? text : null, {
    speed,
    step,
    onComplete: typing ? onComplete : undefined,
  })
  const displayed = typing ? typed : text
  const showCursor = cursor || typing
  const isBlank = text === ''

  const classNames = [styles.line, styles[variant], isBlank ? styles.blank : '']
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classNames}>
      <span>{displayed}</span>
      {showCursor ? <span className={styles.cursor}>█</span> : null}
    </div>
  )
}
