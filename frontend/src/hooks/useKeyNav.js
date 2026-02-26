import { useEffect, useState } from 'react'

export function useKeyNav(items, onSelect) {
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    if (!items.length) return
    if (cursor > items.length - 1) {
      setCursor(items.length - 1)
    }
  }, [items, cursor])

  useEffect(() => {
    if (!items.length) return

    function handleKey(event) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setCursor((current) => Math.min(current + 1, items.length - 1))
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setCursor((current) => Math.max(current - 1, 0))
      } else if (event.key === 'Enter') {
        event.preventDefault()
        onSelect?.(items[cursor])
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cursor, items, onSelect])

  return cursor
}
