import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from 'wagmi'
import { isAddress } from 'viem'
import { kittyConfig } from '@/kitty/config'
import { KITTY_ABI } from '@/kitty/abi'
import { parseUsdc, parseOnchainError } from '@/kitty/utils'
import { toast } from 'sonner'

const ZERO_ADDR = '0x0000000000000000000000000000000000000000' as `0x${string}`

interface Props {
  potId: bigint
  potValue: bigint
  members: Array<{ addr: string; isMember: boolean }>
  onClose: () => void
  onSuccess: () => void
}

type Kind = 0 | 1 | 2 | 3 | 4 | 5

const KINDS: { value: Kind; label: string; description: string }[] = [
  { value: 0, label: 'Send money', description: 'Transfer USDC from the pot to any address.' },
  { value: 1, label: 'Add member', description: 'Invite a new wallet to the pot.' },
  { value: 2, label: 'Remove member', description: 'Remove a member from the pot.' },
  { value: 3, label: 'Change approvals', description: 'Change how many votes are needed.' },
  { value: 4, label: 'Give allowance card', description: 'Let a member spend directly from the pot.' },
  { value: 5, label: 'Freeze card', description: 'Deactivate a member\'s allowance card.' },
]

export default function ProposalSheet({ potId, potValue: _potValue, members, onClose, onSuccess }: Props) {
  const { address } = useAccount()
  const [kind, setKind] = useState<Kind>(0)
  const [targetAddr, setTargetAddr] = useState('')
  const [amountStr, setAmountStr] = useState('')

  const [periodDays, setPeriodDays] = useState(7)
  const [newThreshold, setNewThreshold] = useState(1)
  const [memo, setMemo] = useState('')
  const [err, setErr] = useState('')

  const { writeContract, data: hash, isPending, isError, error: txError, reset } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  if (isSuccess) {
    toast.success('Proposal submitted!')
    onSuccess()
  }

  function buildArgs(): {
    kind: number; target: `0x${string}`; amount: bigint; bps: number; period: bigint; memo: string
  } | null {
    const amount = amountStr ? parseUsdc(amountStr) : 0n
    const period = BigInt(periodDays * 86400)
    const safeTarget = targetAddr.trim() && isAddress(targetAddr.trim()) ? targetAddr.trim() as `0x${string}` : ZERO_ADDR

    switch (kind) {
      case 0: // FixedPayout
        if (!isAddress(targetAddr.trim())) { setErr('Enter a valid recipient address.'); return null }
        if (amount === 0n) { setErr('Enter an amount.'); return null }
        return { kind: 0, target: safeTarget, amount, bps: 0, period: 0n, memo }
      case 1: // AddMember
        if (!isAddress(targetAddr.trim())) { setErr('Enter a valid wallet address.'); return null }
        return { kind: 1, target: safeTarget, amount: 0n, bps: 0, period: 0n, memo }
      case 2: // RemoveMember
        if (!isAddress(targetAddr.trim())) { setErr('Select a member to remove.'); return null }
        return { kind: 2, target: safeTarget, amount: 0n, bps: 0, period: 0n, memo }
      case 3: // SetThreshold
        return { kind: 3, target: ZERO_ADDR, amount: 0n, bps: newThreshold, period: 0n, memo: memo }
      case 4: // SetAllowance
        if (!isAddress(targetAddr.trim())) { setErr('Select a member.'); return null }
        if (amount === 0n) { setErr('Enter a card limit.'); return null }
        return { kind: 4, target: safeTarget, amount, bps: 0, period, memo }
      case 5: // RevokeAllowance
        if (!isAddress(targetAddr.trim())) { setErr('Select a member.'); return null }
        return { kind: 5, target: safeTarget, amount: 0n, bps: 0, period: 0n, memo }
      default:
        return null
    }
  }

  function submit() {
    setErr('')
    const args = buildArgs()
    if (!args) return
    writeContract({
      address: kittyConfig.contractAddress,
      abi: KITTY_ABI,
      functionName: 'propose',
      args: [potId, args.kind, args.target, args.amount, args.bps, args.period, args.memo],
      chainId: kittyConfig.chain.id,
    })
  }

  const busyLabel = isPending ? 'Confirm in wallet…' : isConfirming ? 'Submitting…' : null
  const activeMembers = members.filter(m => m.isMember && m.addr.toLowerCase() !== address?.toLowerCase())

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <div className="absolute inset-0" style={{ background: 'rgba(18,45,69,0.32)', backdropFilter: 'blur(4px)' }} />
        <motion.div
          className="relative w-full max-w-lg rounded-t-2xl pb-8"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 400, damping: 36 }}
          style={{
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(24px)',
            boxShadow: '0 -8px 40px rgba(18,45,69,0.12)',
          }}
          onClick={e => e.stopPropagation()}
        >
          {/* Spectral strip */}
          <div className="h-1 rounded-full mx-auto mt-3 mb-4 w-10" style={{ background: 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b)' }} />

          <div className="px-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="display text-lg font-bold" style={{ color: 'var(--ink)' }}>New proposal</h2>
              <button onClick={onClose} className="p-1.5 rounded-lg" style={{ background: 'var(--surface-muted)' }}>
                <X size={15} style={{ color: 'var(--muted)' }} />
              </button>
            </div>

            {/* Kind picker */}
            <div className="grid grid-cols-2 gap-1.5 mb-4">
              {KINDS.map(k => (
                <button
                  key={k.value}
                  onClick={() => { setKind(k.value); setErr(''); reset() }}
                  className="rounded-xl px-3 py-2.5 text-left text-xs font-medium transition-all"
                  style={kind === k.value ? {
                    background: 'var(--accent)', color: 'white',
                  } : {
                    background: 'var(--surface-muted)', color: 'var(--ink-2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {k.label}
                </button>
              ))}
            </div>

            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              {KINDS.find(k => k.value === kind)?.description}
            </p>

            {/* Fields by kind */}
            <div className="space-y-3">
              {/* Target address / member picker */}
              {(kind === 0 || kind === 1) && (
                <input
                  value={targetAddr}
                  onChange={e => setTargetAddr(e.target.value)}
                  placeholder={kind === 0 ? 'Recipient 0x…' : 'New member 0x…'}
                  className="w-full rounded-xl px-4 py-3 text-sm mono outline-none"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                />
              )}
              {(kind === 2 || kind === 4 || kind === 5) && (
                <select
                  value={targetAddr}
                  onChange={e => setTargetAddr(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                >
                  <option value="">Select member…</option>
                  {activeMembers.map(m => (
                    <option key={m.addr} value={m.addr}>{m.addr.slice(0, 8)}…{m.addr.slice(-4)}</option>
                  ))}
                </select>
              )}

              {/* Amount */}
              {(kind === 0 || kind === 4) && (
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: 'var(--muted)' }}>$</span>
                  <input
                    value={amountStr}
                    onChange={e => setAmountStr(e.target.value)}
                    placeholder={kind === 4 ? 'Card limit…' : 'Amount…'}
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full rounded-xl pl-7 pr-16 py-3 text-sm outline-none"
                    style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
                </div>
              )}

              {/* Allowance period */}
              {kind === 4 && (
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Period</label>
                  <select
                    value={periodDays}
                    onChange={e => setPeriodDays(Number(e.target.value))}
                    className="flex-1 rounded-xl px-3 py-2.5 text-sm outline-none"
                    style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                  >
                    {[7,14,21,28,31].map(d => <option key={d} value={d}>{d === 7 ? 'Weekly' : d === 28 || d === 31 ? 'Monthly' : `${d} days`}</option>)}
                  </select>
                </div>
              )}

              {/* Threshold */}
              {kind === 3 && (
                <div className="flex items-center gap-3">
                  <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>New threshold</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={newThreshold}
                    onChange={e => setNewThreshold(Number(e.target.value))}
                    className="w-20 rounded-xl px-3 py-2.5 text-sm outline-none text-center"
                    style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                  />
                </div>
              )}

              {/* Memo */}
              <input
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="Memo (optional)"
                maxLength={128}
                className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)', color: 'var(--ink)' }}
              />
            </div>

            {err && <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>{err}</p>}
            {isError && <p className="text-xs mt-2" style={{ color: 'var(--danger)' }}>{parseOnchainError(txError)}</p>}

            <p className="text-xs mt-3 mb-4" style={{ color: 'var(--subtle)' }}>
              The approval that reaches the threshold executes the action automatically.
            </p>

            <button
              onClick={submit}
              disabled={!!busyLabel}
              className="w-full rounded-xl py-3.5 font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {busyLabel ?? 'Submit proposal'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
