import { useEffect, useRef, useState } from 'react'
import styles from './ImageReveal.module.css'

const DISPLAY = 512
const STEPS = [2, 4, 8, 16, 32, 64, 128, 256, DISPLAY]
const STEP_DURATIONS = [400, 350, 300, 250, 225, 200, 150, 125]

export function ImageReveal({ src, onRevealComplete, revealed = false }) {
  const [loaded, setLoaded] = useState(false)
  const [stepIndex, setStepIndex] = useState(revealed ? STEPS.length - 1 : 0)
  const onCompleteRef = useRef(onRevealComplete)
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    onCompleteRef.current = onRevealComplete
  }, [onRevealComplete])

  // preload image — try without crossOrigin since DALL-E URLs may not support CORS
  useEffect(() => {
    if (!src) return
    const onReady = (img) => {
      imgRef.current = img
      setLoaded(true)
      drawStep(canvasRef.current, img, revealed ? DISPLAY : STEPS[0])
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
    const img = new Image()
    img.onload = () => onReady(img)
    img.onerror = () => onReady(img)
    img.src = src
  }, [src, revealed])

  // step through reveal
  useEffect(() => {
    if (!loaded || revealed) return undefined
    if (stepIndex >= STEPS.length - 1) {
      onCompleteRef.current?.()
      return undefined
    }
    const timer = setTimeout(() => {
      setStepIndex((prev) => {
        const next = prev + 1
        drawStep(canvasRef.current, imgRef.current, STEPS[next])
        return next
      })
    }, STEP_DURATIONS[stepIndex])
    return () => clearTimeout(timer)
  }, [loaded, stepIndex, revealed])

  if (!src) return null

  return (
    <div className={styles.container} ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={DISPLAY}
        height={DISPLAY}
        className={styles.canvas}
      />
      <div className={styles.scanlines} />
    </div>
  )
}

function drawStep(canvas, img, size) {
  if (!canvas || !img) return
  const ctx = canvas.getContext('2d')

  // draw the image at tiny resolution
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(img, 0, 0, size, size)

  // now draw that tiny result back up to full canvas with no smoothing
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(canvas, 0, 0, size, size, 0, 0, DISPLAY, DISPLAY)
}
