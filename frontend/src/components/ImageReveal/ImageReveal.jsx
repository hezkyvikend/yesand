import { useEffect, useRef, useState } from 'react'
import styles from './ImageReveal.module.css'

const DISPLAY = 512
const STEPS = [2, 4, 8, 16, 32, 64, 128, 256, DISPLAY]
const STEP_DURATIONS = [400, 350, 300, 250, 225, 200, 150, 125]

export function ImageReveal({ src, onRevealComplete, revealed = false }) {
  const [loaded, setLoaded] = useState(false)
  const [stepIndex, setStepIndex] = useState(revealed ? STEPS.length - 1 : 0)
  const onCompleteRef = useRef(onRevealComplete)
  const completionFiredRef = useRef(false)
  const containerRef = useRef(null)
  const canvasRef = useRef(null)
  const imgRef = useRef(null)

  useEffect(() => {
    onCompleteRef.current = onRevealComplete
  }, [onRevealComplete])

  useEffect(() => {
    completionFiredRef.current = false
  }, [src, revealed])

  // preload image — try without crossOrigin since DALL-E URLs may not support CORS
  useEffect(() => {
    if (!src) return
    let cancelled = false

    const onReady = (img) => {
      if (cancelled) return
      imgRef.current = img
      drawStep(canvasRef.current, img, revealed ? DISPLAY : STEPS[0])
      setLoaded(true)
      containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }

    const img = new Image()
    img.onload = async () => {
      // Ensure decode is complete before first paint to avoid showing an empty frame.
      if (typeof img.decode === 'function') {
        try {
          await img.decode()
        } catch {
          // Ignore decode errors and continue with onload result.
        }
      }
      onReady(img)
    }
    img.onerror = () => onReady(img)
    img.src = src

    return () => {
      cancelled = true
    }
  }, [src, revealed])

  // step through reveal
  useEffect(() => {
    if (!loaded || revealed) return undefined
    if (stepIndex >= STEPS.length - 1) {
      if (!completionFiredRef.current) {
        completionFiredRef.current = true
        onCompleteRef.current?.()
      }
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

  if (!src || !loaded) return null
  const done = revealed || stepIndex >= STEPS.length - 1

  return (
    <div className={styles.container} ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={DISPLAY}
        height={DISPLAY}
        className={styles.canvas}
      />
      {done && <img src={src} alt="generated artwork" className={styles.imgOverlay} />}
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
