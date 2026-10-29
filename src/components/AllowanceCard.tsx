import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { isAddress } from 'viem'
import { CreditCard } from 'lucide-react'
import { kittyConfig } from '@/kitty/config'
import { KITTY_ABI } from '@/kitty/abi'
import { formatUsdc, formatResetIn, parseUsdc, parseOnchainError, displayName, potGradient } from '@/kitty/utils'
import { toast } from 'sonner'

interface AllowanceInfo {
  limit: bigint
  period: bigint
  spentThisPeriod: bigint
  remainingThisPeriod: bigint
  resetsAt: bigint
  active: boolean
}

interface Props {
  potId: bigint
  memberAddr: string
  allowance: AllowanceInfo
  isHolder: boolean
  onRefresh: () => void
}

export default function AllowanceCard({ potId, memberAddr, allowance, isHolder, onRefresh }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [spending, setSpending] = useState(false)
  const [toAddr, setToAddr] = useState('')
  const [amountStr, setAmountStr] = useState('')
  const [memo, setMemo] = useState('')
  const [spendErr, setSpendErr] = useState('')

  const { writeContract, data: hash, isPending, isError, error: txError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  if (isSuccess) {
    toast.success('Spent from pot!')
    setSpending(false)
    onRefresh()
  }

  const limit = Number(allowance.limit) / 1e6
  const spent = Number(allowance.spentThisPeriod) / 1e6
  const pct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
  const grad = potGradient(potId)

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const rect = cardRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = ((e.clientY - rect.top) / rect.height - 0.5) * 12
    const y = -((e.clientX - rect.left) / rect.width - 0.5) * 12
    setTilt({ x, y })
  }

  function handleMouseLeave() {
    setTilt({ x: 0, y: 0 })
  }

  function submitSpend() {
    setSpendErr('')
    if (!isAddress(toAddr.trim())) { setSpendErr('Enter a valid recipient address.'); return }
    const amount = parseUsdc(amountStr)
    if (amount === 0n) { setSpendErr('Enter an amount.'); return }
    writeContract({
      address: kittyConfig.contractAddress,
      abi: KITTY_ABI,
      functionName: 'spend',
      args: [potId, toAddr.trim() as `0x${string}`, amount, memo],
      chainId: kittyConfig.chain.id,
    })
  }

  const periodLabel = Number(allowance.period) === 7 * 86400 ? 'Weekly' : Number(allowance.period) === 30 * 86400 || Number(allowance.period) === 31 * 86400 ? 'Monthly' : `${Math.round(Number(allowance.period) / 86400)}d`
  const resetsIn = formatResetIn(Number(allowance.resetsAt))

  return (
    <div className="space-y-2">
      <motion.div
        ref={cardRef}
        className="rounded-2xl p-5 cursor-default select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onTouchStart={() => setTilt({ x: 4, y: -4 })}
        onTouchEnd={() => setTilt({ x: 0, y: 0 })}
        style={{
          background: grad,
          color: 'white',
          transform: `perspective(600px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: 'transform 0.15s ease',
          boxShadow: '0 12px 32px rgba(18,45,69,0.18)',
        }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-semibold opacity-75 uppercase tracking-wide mb-0.5">{periodLabel} limit</div>
            <div className="text-2xl font-bold tabular-nums" style={{ fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '-0.03em' }}>
              ${formatUsdc(allowance.limit)} USDC
            </div>
          </div>
          <CreditCard size={22} style={{ opacity: 0.7 }} />
        </div>

        <div className="h-1 rounded-full mb-2" style={{ background: 'rgba(255,255,255,0.25)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'rgba(255,255,255,0.85)' }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 80, damping: 20 }}
          />
        </div>

        <div className="flex items-center justify-between text-xs opacity-80">
          <span>${formatUsdc(allowance.spentThisPeriod)} spent · ${formatUsdc(allowance.remainingThisPeriod)} left</span>
          <span>Resets in {resetsIn}</span>
        </div>

        <div className="mt-3 pt-3 border-t border-white/20 text-xs opacity-70">
          {displayName(memberAddr)}
        </div>
      </motion.div>

      <p className="text-xs px-1" style={{ color: 'var(--subtle)' }}>
        Prototype card: spends straight from the pot on-chain. No physical card is issued.
      </p>

      {isHolder && (
        <div>
          {!spending ? (
            <button
              onClick={() => setSpending(true)}
              className="w-full rounded-xl py-2.5 text-sm font-semibold transition-all"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              Spend from card
            </button>
          ) : (
            <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
              <input
                value={toAddr}
                onChange={e => setToAddr(e.target.value)}
                placeholder="Pay to 0x…"
                className="w-full rounded-xl px-3 py-2.5 text-sm mono outline-none"
                style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)', color: 'var(--ink)' }}
              />
              <div className="flex gap-2">
                <input
                  value={amountStr}
                  onChange={e => setAmountStr(e.target.value)}
                  placeholder="Amount USDC"
                  type="number"
                  min="0"
                  step="0.01"
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)', color: 'var(--ink)' }}
                />
                <input
                  value={memo}
                  onChange={e => setMemo(e.target.value)}
                  placeholder="Memo"
                  className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)', color: 'var(--ink)' }}
                />
              </div>
              {spendErr && <p className="text-xs" style={{ color: 'var(--danger)' }}>{spendErr}</p>}
              {isError && <p className="text-xs" style={{ color: 'var(--danger)' }}>{parseOnchainError(txError)}</p>}
              <div className="flex gap-2">
                <button
                  onClick={() => { setSpending(false); reset() }}
                  className="flex-1 rounded-xl py-2 text-sm font-medium"
                  style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={submitSpend}
                  disabled={isPending || isConfirming}
                  className="flex-1 rounded-xl py-2 text-sm font-semibold disabled:opacity-60"
                  style={{ background: 'var(--accent)', color: 'white' }}
                >
                  {isPending ? 'Confirm in wallet…' : isConfirming ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
