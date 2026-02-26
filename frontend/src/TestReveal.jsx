import { useState } from 'react'
import { ImageReveal } from './components/ImageReveal/ImageReveal'

const TEST_IMAGE = 'https://picsum.photos/1024/1024'

export default function TestReveal() {
  const [key, setKey] = useState(0)
  const [done, setDone] = useState(false)

  return (
    <div style={{ background: '#0d0d0d', color: '#39ff14', fontFamily: 'monospace', padding: 40, minHeight: '100vh' }}>
      <p>image reveal test</p>
      <p style={{ color: '#1f8c0a', fontSize: 12, marginBottom: 8 }}>
        step key: {key} &nbsp;|&nbsp; status: {done ? 'done' : 'revealing...'}
      </p>
      <button
        onClick={() => { setKey((k) => k + 1); setDone(false) }}
        style={{
          background: 'none',
          border: '1px solid #39ff14',
          color: '#39ff14',
          fontFamily: 'monospace',
          padding: '6px 16px',
          cursor: 'pointer',
          marginBottom: 16,
        }}
      >
        replay
      </button>
      <ImageReveal
        key={key}
        src={`${TEST_IMAGE}?v=${key}`}
        onRevealComplete={() => setDone(true)}
      />
    </div>
  )
}
