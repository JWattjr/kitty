import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { Check, ExternalLink, Heart } from 'lucide-react'
import { kittyConfig, explorerTx } from '@/kitty/config'
import { KITTY_ABI } from '@/kitty/abi'
import { usePot, usePotValue, usePotCount } from '@/kitty/hooks'
import { formatUsdc, parseUsdc } from '@/kitty/utils'
import CountUp from '@/components/CountUp'
import { ConnectKitButton } from 'connectkit'

const USDC_D = 1e6
const glass = {
  background: 'rgba(255,255,255,0.64)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.68)',
  boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
} as React.CSSProperties

export default function GiftPage() {
  const { id } = useParams<{ id: string }>()
  const potId = id !== undefined ? BigInt(id) : undefined
  const { address, isConnected } = useAccount()

  const { data: potCount } = usePotCount()
  const { data: potData, isError: potError } = usePot(potId)
  const { data: potVal, refetch } = usePotValue(potId)

  const [amountStr, setAmountStr] = useState('')
  const [approved, setApproved] = useState(false)
  const [celebrated, setCelebrated] = useState(false)

  const amount = parseUsdc(amountStr)

  const { data: usdcBalance } = useReadContract({
    address: kittyConfig.usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: kittyConfig.chain.id,
    query: { enabled: Boolean(address) },
  })

  const { writeContract: approveWrite, data: approveHash, isPending: approveWaiting } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  const { writeContract: contributeWrite, data: contributeHash, isPending: contributeWaiting } = useWriteContract()
  const { isLoading: contributeConfirming, isSuccess: contributeSuccess } = useWaitForTransactionReceipt({ hash: contributeHash })

  if (approveSuccess && !approved) setApproved(true)
  if (contributeSuccess && !celebrated) {
    setCelebrated(true)
    void refetch()
  }

  const needsApprove = !approved && amount > 0n
  const potTuple = potData as readonly [string, string, string, bigint, bigint, number, number, bigint, bigint, bigint] | undefined
  const name = potTuple?.[0]
  const memberCount = potTuple?.[6]
  const value = potVal ?? 0n

  const notFound =
    potId === undefined ||
    (potCount !== undefined && potId >= (potCount)) ||
    potError ||
    (potData && !(potTuple?.[0]))

  if (notFound) {
    return (
      <div className="mx-auto max-w-sm px-4 pt-20 text-center space-y-4">
        <Heart size={32} style={{ color: 'var(--border)' }} className="mx-auto" />
        <div className="display text-xl font-bold" style={{ color: 'var(--ink)' }}>Pot not found</div>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>This gift link may be invalid or the pot hasn't been created yet.</p>
        <a href="/" className="inline-block text-sm font-semibold underline" style={{ color: 'var(--accent)' }}>Go home</a>
      </div>
    )
  }

  function doApprove() {
    approveWrite({
      address: kittyConfig.usdcAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [kittyConfig.contractAddress, amount],
      chainId: kittyConfig.chain.id,
    })
  }

  function doContribute() {
    if (!potId) return
    contributeWrite({
      address: kittyConfig.contractAddress,
      abi: KITTY_ABI,
      functionName: 'contribute',
      args: [potId, amount],
      chainId: kittyConfig.chain.id,
    })
  }

  const busyApprove = approveWaiting || approveConfirming
  const busyContribute = contributeWaiting || contributeConfirming

  return (
    <div className="mx-auto max-w-sm px-4 pt-12 pb-20 flex flex-col items-center">
      <AnimatePresence>
        {celebrated ? (
          <motion.div
            key="celebration"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-4"
          >
            <motion.div
              animate={{ scale: [1, 1.15, 1], rotate: [0, -8, 8, 0] }}
              transition={{ repeat: 3, duration: 0.5 }}
              className="mx-auto w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #5fbeff, #af8ff4)' }}
            >
              <Heart size={28} color="white" fill="white" />
            </motion.div>
            <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Gift sent!</h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              ${formatUsdc(amount)} USDC landed in <strong>{name}</strong>. The pot appreciates it.
            </p>
            {contributeHash && (
              <a href={explorerTx(contributeHash)} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs justify-center" style={{ color: 'var(--subtle)' }}>
                View on explorer <ExternalLink size={11} />
              </a>
            )}
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="w-full space-y-4">
            <div className="text-center space-y-1 mb-2">
              <Heart size={28} style={{ color: '#f05c6b' }} className="mx-auto" />
              <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>
                {name ?? 'Shared pot'}
              </h1>
              <p className="text-sm" style={{ color: 'var(--muted)' }}>
                {Number(memberCount ?? 0)} members · <CountUp value={Number(value) / USDC_D} /> USDC
              </p>
            </div>

            <div className="rounded-2xl p-5 space-y-4" style={glass}>
              <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>
                Send a gift
              </div>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-sm" style={{ color: 'var(--muted)' }}>$</span>
                <input
                  value={amountStr}
                  onChange={e => { setAmountStr(e.target.value); setApproved(false) }}
                  placeholder="0.00"
                  type="number"
                  min="0"
                  step="1"
                  className="w-full rounded-xl pl-7 pr-16 py-3 text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)', color: 'var(--ink)' }}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
              </div>

              {usdcBalance !== undefined && (
                <p className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
                  Your USDC: ${formatUsdc(usdcBalance)}
                </p>
              )}

              {!isConnected ? (
                <div className="flex justify-center">
                  <ConnectKitButton label="Connect to gift" />
                </div>
              ) : (
                <div className="flex gap-2">
                  {needsApprove && (
                    <button
                      onClick={doApprove}
                      disabled={!amount || busyApprove || approved}
                      className="flex-1 rounded-xl py-3 text-sm font-semibold disabled:opacity-50 transition-all"
                      style={{ background: 'rgba(18,45,69,0.08)', color: 'var(--ink)', border: '1px solid var(--border)' }}
                    >
                      {busyApprove ? (approveWaiting ? 'Confirm…' : 'Approving…') : approved ? <><Check size={13} /> Approved</> : 'Approve'}
                    </button>
                  )}
                  <button
                    onClick={doContribute}
                    disabled={(!approved && needsApprove) || !amount || busyContribute}
                    className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: 'white' }}
                  >
                    {busyContribute ? (contributeWaiting ? 'Confirm…' : 'Sending…') : 'Send gift'}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
