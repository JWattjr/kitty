import { useAccount, useSwitchChain } from 'wagmi'
import { AlertTriangle } from 'lucide-react'
import { kittyConfig } from '@/kitty/config'
import { motion, AnimatePresence } from 'framer-motion'

export default function NetworkGuard() {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const wrong = isConnected && chainId !== kittyConfig.chain.id

  return (
    <AnimatePresence>
      {wrong && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="relative z-20 mx-4 mb-2 max-w-2xl mx-auto"
          style={{
            background: 'rgba(186,43,76,0.08)',
            border: '1px solid rgba(186,43,76,0.24)',
            borderRadius: 12,
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <AlertTriangle size={15} style={{ color: 'var(--danger)', flexShrink: 0 }} />
          <span className="text-sm flex-1" style={{ color: 'var(--danger)' }}>
            Switch to <strong>{kittyConfig.chain.name}</strong> to use KittyPots.
          </span>
          <button
            onClick={() => switchChain({ chainId: kittyConfig.chain.id })}
            disabled={isPending}
            className="text-xs font-semibold rounded-full px-3 py-1 transition-opacity disabled:opacity-60"
            style={{ background: 'var(--danger)', color: 'white' }}
          >
            {isPending ? 'Switching…' : 'Switch'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
