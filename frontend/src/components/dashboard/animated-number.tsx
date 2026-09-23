import { animate, useReducedMotion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'

/** Плавный переход числа к новому значению (animated counter). Уважает prefers-reduced-motion. */
export function AnimatedNumber({
  value,
  format,
}: {
  value: number | null
  format: (value: number | null) => string
}) {
  const reduce = useReducedMotion()
  const [display, setDisplay] = useState(value)
  const previous = useRef(value)

  useEffect(() => {
    const from = previous.current
    previous.current = value
    if (reduce || value === null || from === null || from === value) {
      setDisplay(value)
      return
    }
    const controls = animate(from, value, { duration: 0.6, ease: 'easeOut', onUpdate: setDisplay })
    return () => controls.stop()
  }, [value, reduce])

  return <span className="tabular">{format(display)}</span>
}
