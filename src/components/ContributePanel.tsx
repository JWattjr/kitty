import { useState } from 'react'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { Check, ExternalLink } from 'lucide-react'

import { kittyConfig } from '@/kitty/config'
import { KITTY_ABI } from '@/kitty/abi'
import { parseUsdc, formatUsdc } from '@/kitty/utils'
import { explorerTx } from '@/kitty/config'

interface Props {
  potId: bigint
  onSuccess: () => void
}

type Step = 'idle' | 'approving' | 'approved' | 'contributing' | 'done' | 'error'

export default function ContributePanel({ potId, onSuccess }: Props) {
  const { address } = useAccount()
  const [amountStr, setAmountStr] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [errMsg, setErrMsg] = useState('')

  const amount = parseUsdc(amountStr)

  // Check existing allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: kittyConfig.usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, kittyConfig.contractAddress] : undefined,
    chainId: kittyConfig.chain.id,
    query: { enabled: Boolean(address) },
  })

  const { data: balance } = useReadContract({
    address: kittyConfig.usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: kittyConfig.chain.id,
    query: { enabled: Boolean(address) },
  })

  // Approve write
  const { writeContract: approveWrite, data: approveHash, isPending: approveWaiting } = useWriteContract()
  const { isLoading: approveConfirming, isSuccess: approveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

  // Contribute write
  const { writeContract: contributeWrite, data: contributeHash, isPending: contributeWaiting } = useWriteContract()
  const { isLoading: contributeConfirming, isSuccess: contributeSuccess } = useWaitForTransactionReceipt({ hash: contributeHash })

  if (approveSuccess && step === 'approving') {
    setStep('approved')
    void refetchAllowance()
  }
  if (contributeSuccess && step === 'contributing') {
    setStep('done')
    onSuccess()
  }

  function handleApprove() {
    if (!amount) return
    setErrMsg('')
    setStep('approving')
    approveWrite({
      address: kittyConfig.usdcAddress,
      abi: erc20Abi,
      functionName: 'approve',
      args: [kittyConfig.contractAddress, amount],
      chainId: kittyConfig.chain.id,
    })
  }

  function handleContribute() {
    setErrMsg('')
    setStep('contributing')
    contributeWrite({
      address: kittyConfig.contractAddress,
      abi: KITTY_ABI,
      functionName: 'contribute',
      args: [potId, amount],
      chainId: kittyConfig.chain.id,
    })
  }

  const hasEnoughAllowance = allowance !== undefined && amount > 0n && (allowance) >= amount
  const hasBalance = balance !== undefined && amount > 0n && (balance) >= amount
  const canSkipApprove = hasEnoughAllowance
  const busyApprove = approveWaiting || approveConfirming
  const busyContribute = contributeWaiting || contributeConfirming

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: 'rgba(255,255,255,0.64)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.68)', boxShadow: '0 8px 32px rgba(18,45,69,0.08)' }}>
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>Chip in</div>

      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold text-sm" style={{ color: 'var(--muted)' }}>$</span>
        <input
          value={amountStr}
          onChange={e => { setAmountStr(e.target.value); setStep('idle') }}
          placeholder="0.00"
          type="number"
          min="0"
          step="1"
          className="w-full rounded-xl pl-7 pr-16 py-3 text-sm outline-none"
          style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)', color: 'var(--ink)' }}
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold" style={{ color: 'var(--subtle)' }}>USDC</span>
      </div>

      {balance !== undefined && (
        <p className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>
          Balance: ${formatUsdc(balance)} USDC
          {amount > 0n && !(balance >= amount) && <span style={{ color: 'var(--danger)' }}> · Insufficient</span>}
        </p>
      )}

      {/* Step indicators */}
      <div className="flex gap-2">
        {!canSkipApprove && (
          <div className={`flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 ${step === 'approved' || step === 'contributing' || step === 'done' ? 'opacity-50' : ''}`}
            style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
            {(step === 'approved' || step === 'contributing' || step === 'done') && <Check size={10} style={{ color: 'var(--success)' }} />}
            1. Approve USDC
          </div>
        )}
        <div className={`flex items-center gap-1.5 text-xs rounded-full px-2.5 py-1 ${step === 'done' ? 'opacity-50' : ''}`}
          style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}>
          {step === 'done' && <Check size={10} style={{ color: 'var(--success)' }} />}
          {canSkipApprove ? '1.' : '2.'} Contribute
        </div>
      </div>

      {errMsg && <p className="text-xs" style={{ color: 'var(--danger)' }}>{errMsg}</p>}

      {step === 'done' ? (
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--success)' }}>
          <Check size={15} />
          Contributed!
          {contributeHash && (
            <a href={explorerTx(contributeHash)} target="_blank" rel="noopener noreferrer" className="ml-auto flex items-center gap-1 text-xs" style={{ color: 'var(--subtle)' }}>
              Explorer <ExternalLink size={11} />
            </a>
          )}
        </div>
      ) : (
        <div className="flex gap-2">
          {!canSkipApprove && (
            <button
              onClick={handleApprove}
              disabled={!amount || busyApprove || step === 'approved' || step === 'contributing'}
              className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
              style={{ background: step === 'approved' ? 'var(--surface-muted)' : 'rgba(18,45,69,0.08)', color: 'var(--ink)', border: '1px solid var(--border)' }}
            >
              {busyApprove ? (approveWaiting ? 'Confirm…' : 'Approving…') : (step === 'approved' ? '✓ Approved' : 'Approve')}
            </button>
          )}
          <button
            onClick={handleContribute}
            disabled={(!canSkipApprove && step !== 'approved') || !amount || busyContribute || !hasBalance}
            className="flex-1 rounded-xl py-3 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            {busyContribute ? (contributeWaiting ? 'Confirm…' : 'Contributing…') : 'Contribute'}
          </button>
        </div>
      )}
    </div>
  )
}
