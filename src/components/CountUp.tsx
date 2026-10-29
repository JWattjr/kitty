import { useEffect, useRef, useState } from 'react'

interface Props {
  value: number
  decimals?: number
  prefix?: string
  duration?: number
}

export default function CountUp({ value, decimals = 2, prefix = '$', duration = 800 }: Props) {
  const [display, setDisplay] = useState(value)
  const prev = useRef(value)
  const raf = useRef<number>(0)
  const start = useRef(0)
  const startVal = useRef(value)

  useEffect(() => {
    const from = prev.current
    const to = value
    if (from === to) return
    prev.current = to
    startVal.current = from
    start.current = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start.current) / duration)
      const ease = 1 - (1 - t) * (1 - t) // easeOutQuad
      setDisplay(from + (to - from) * ease)
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])

  const formatted = display.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  return <>{prefix}{formatted}</>
}
