import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, TrendingUp, Users, Vote } from 'lucide-react'
import { useReadContract } from 'wagmi'
import { kittyConfig, configError } from '@/kitty/config'
import { KITTY_ABI } from '@/kitty/abi'
import { useGlobalStats } from '@/kitty/hooks'
import { formatUsdc } from '@/kitty/utils'

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.28, ease: [0.25, 0.1, 0.25, 1.0] },
}

const glass = {
  background: 'rgba(255,255,255,0.64)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.68)',
  boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
} as React.CSSProperties

function LiveStats() {
  const { data: potCount } = useReadContract({
    address: kittyConfig.contractAddress,
    abi: KITTY_ABI,
    functionName: 'potCount',
    chainId: kittyConfig.chain.id,
  })

  const count = potCount
  const { totalInPots, totalYield } = useGlobalStats(count)

  return (
    <div className="rounded-2xl p-5" style={glass}>
      <div className="text-xs font-semibold uppercase tracking-wide mb-4 text-center" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>
        Live on {kittyConfig.chain.name}
      </div>
      <div className="flex items-start justify-center gap-8 text-center">
        <Stat label="Pots created" value={count !== undefined ? count.toString() : '—'} />
        <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />
        <Stat label="Total in pots" value={count !== undefined ? `$${formatUsdc(totalInPots, 0)}` : '—'} />
        <div style={{ width: 1, alignSelf: 'stretch', background: 'var(--border)' }} />
        <Stat label="Yield earned" value={count !== undefined ? `$${formatUsdc(totalYield)}` : '—'} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="display text-xl font-bold tabular-nums" style={{ color: 'var(--ink)' }}>{value}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>{label}</div>
    </div>
  )
}

const STEPS = [
  {
    icon: <Users size={22} />,
    title: 'Everyone chips in',
    body: 'Invite family, friends or teammates. Each member contributes monthly to a shared USDC pot.',
  },
  {
    icon: <TrendingUp size={22} />,
    title: 'The pot earns yield',
    body: 'Your USDC sits in a Circle Earn vault (Morpho), growing automatically while you save.',
  },
  {
    icon: <Vote size={22} />,
    title: 'The group decides',
    body: 'Members vote on payouts, add allowance cards, and choose who gets to spend.',
  },
]

export default function HomePage() {
  const navigate = useNavigate()

  if (configError) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-12 text-center space-y-3">
        <div className="display text-xl font-bold" style={{ color: 'var(--danger)' }}>Configuration error</div>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{configError}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-8 pb-20">
      {/* Hero */}
      <motion.div {...fadeUp} className="text-center mb-10">
        <h1 className="display text-4xl font-bold leading-tight text-balance mb-4" style={{ color: 'var(--ink)', letterSpacing: '-0.03em' }}>
          One pot for the<br />people you love.
        </h1>
        <p className="text-base text-pretty max-w-sm mx-auto mb-8" style={{ color: 'var(--ink-2)' }}>
          It earns while you save, and everyone decides how it&apos;s spent.
        </p>
        <button
          onClick={() => { void navigate('/new') }}
          className="inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-base font-semibold transition-all active:scale-95 hover:opacity-90"
          style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 20px rgba(18,45,69,0.22)' }}
        >
          Start a Kitty
          <ArrowRight size={16} />
        </button>
      </motion.div>

      {/* 3-step visual */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.32, delay: 0.08, ease: [0.25, 0.1, 0.25, 1.0] }}
        className="rounded-2xl p-5 mb-6"
        style={glass}
      >
        {/* Spectral strip */}
        <div className="rounded-full h-1 mb-5 w-16" style={{ background: 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)' }} />

        <div className="space-y-5">
          {STEPS.map((step, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'var(--surface-muted)', color: 'var(--accent)' }}>
                {step.icon}
              </div>
              <div>
                <div className="font-semibold text-sm mb-0.5" style={{ color: 'var(--ink)' }}>{step.title}</div>
                <div className="text-sm text-pretty" style={{ color: 'var(--muted)' }}>{step.body}</div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Live stats */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <LiveStats />
      </motion.div>
    </div>
  )
}
