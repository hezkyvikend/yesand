import { useEffect, useRef, useState } from 'react'

export function useTypewriter(text, { speed = 30, step = 1, onComplete } = {}) {
  const [displayed, setDisplayed] = useState('')
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    setDisplayed('')

    if (text === '') {
      const id = setTimeout(() => {
        onCompleteRef.current?.()
      }, 0)
      return () => clearTimeout(id)
    }

    if (!text) return undefined

    let index = 0
    const interval = setInterval(() => {
      index += step
      setDisplayed(text.slice(0, index))

      if (index >= text.length) {
        clearInterval(interval)
        onCompleteRef.current?.()
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed])

  return displayed
}
