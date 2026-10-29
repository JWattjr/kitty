import { useEffect } from 'react'
import { motion, useSpring } from 'framer-motion'

interface Props {
  fillPct: number // 0-100
  gradient: string
  size?: number
}

export default function PotFill({ fillPct, gradient: _gradient, size = 120 }: Props) {
  const spring = useSpring(fillPct, { stiffness: 60, damping: 18 })

  useEffect(() => {
    spring.set(fillPct)
  }, [fillPct, spring])

  const r = size / 2
  const strokeW = 8
  const innerR = r - strokeW / 2
  const circ = 2 * Math.PI * innerR
  const frac = fillPct / 100

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={r} cy={r} r={innerR}
          fill="none"
          stroke="rgba(18,45,69,0.08)"
          strokeWidth={strokeW}
        />
        <motion.circle
          cx={r} cy={r} r={innerR}
          fill="none"
          stroke="url(#potGrad)"
          strokeWidth={strokeW}
          strokeLinecap="round"
          strokeDasharray={circ}
          style={{ strokeDashoffset: spring.get() ? undefined : circ * (1 - frac) }}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - frac) }}
          transition={{ type: 'spring', stiffness: 50, damping: 18 }}
        />
        <defs>
          <linearGradient id="potGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#5fbeff" />
            <stop offset="50%" stopColor="#af8ff4" />
            <stop offset="100%" stopColor="#7ef1b3" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
