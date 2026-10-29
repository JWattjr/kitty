import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useReadContract } from 'wagmi'
// useReadContract still needed for potCount read after success
import { isAddress } from 'viem'
import { Plus, X, Check, ChevronRight } from 'lucide-react'
import { kittyConfig } from '@/kitty/config'
import { KITTY_ABI } from '@/kitty/abi'
import { formatUsdc, setNickname, parseOnchainError, shortAddr } from '@/kitty/utils'
import { useUsdcBalance, useVaultTotalAssets, useVaultApy } from '@/kitty/hooks'
import { toast } from 'sonner'

const glass = {
  background: 'rgba(255,255,255,0.64)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.68)',
  boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
} as React.CSSProperties

interface MemberEntry { addr: string; nickname: string }

function VaultCard({
  vault,
  selected,
  onSelect,
}: {
  vault: typeof kittyConfig.earnVaults[0] | null
  selected: boolean
  onSelect: () => void
}) {
  const isNone = vault === null
  const addr = isNone ? undefined : vault.address

  const { data: totalAssets } = useVaultTotalAssets(addr)
  const { data: apy } = useVaultApy(addr)

  const apyStr = apy === undefined || apy === null
    ? '—'
    : `${(apy * 100).toFixed(2)}% APY est.`

  return (
    <button
      onClick={onSelect}
      className="w-full text-left rounded-xl p-4 transition-all"
      style={{
        ...(selected ? {
          border: '2px solid var(--accent)',
          background: 'rgba(18,45,69,0.05)',
        } : {
          border: '1.5px solid var(--border)',
          background: 'var(--surface-strong)',
        }),
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
            {isNone ? 'No yield' : vault.name}
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
            {isNone
              ? 'USDC stays in the pot, no vault'
              : `${vault.curator} via Circle Earn · Morpho`
            }
          </div>
          {!isNone && (
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-xs mono tabular-nums" style={{ color: 'var(--subtle)' }}>
                {totalAssets != null ? `$${formatUsdc(totalAssets, 0)} total assets` : 'Loading…'}
              </span>
              <span className="text-xs font-semibold" style={{ color: apy ? 'var(--success)' : 'var(--subtle)' }}>
                {apyStr}
              </span>
            </div>
          )}
        </div>
        {selected && (
          <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <Check size={11} color="white" />
          </div>
        )}
      </div>
    </button>
  )
}

export default function NewPotPage() {
  const navigate = useNavigate()
  const { address, isConnected, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const { data: usdcBal } = useUsdcBalance(address)

  const [name, setName] = useState('')
  const [members, setMembers] = useState<MemberEntry[]>([])
  const [newAddr, setNewAddr] = useState('')
  const [newNick, setNewNick] = useState('')
  const [threshold, setThreshold] = useState(1)
  const [vaultIdx, setVaultIdx] = useState<number | null>(null) // null = no vault
  const [error, setError] = useState('')

  const totalMembers = 1 + members.length // creator + invited
  const maxThreshold = totalMembers
  const safeThreshold = Math.min(threshold, maxThreshold)

  const vaultAddress = vaultIdx !== null ? kittyConfig.earnVaults[vaultIdx]?.address : '0x0000000000000000000000000000000000000000' as `0x${string}`

  const { writeContract, data: hash, isPending, isError, error: txError, reset: resetTx } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  // After success, navigate to pot page (read potCount-1)
  const { data: potCount } = useReadContract({
    address: kittyConfig.contractAddress,
    abi: KITTY_ABI,
    functionName: 'potCount',
    chainId: kittyConfig.chain.id,
    query: { enabled: isSuccess },
  })

  if (isSuccess && potCount !== undefined) {
    const newId = (potCount) - 1n
    setTimeout(() => { void navigate(`/pot/${newId}`) }, 400)
  }

  const addMember = useCallback(() => {
    const trimmed = newAddr.trim()
    if (!isAddress(trimmed)) { setError('Enter a valid wallet address.'); return }
    if (trimmed.toLowerCase() === address?.toLowerCase()) { setError("That's your own address."); return }
    if (members.some(m => m.addr.toLowerCase() === trimmed.toLowerCase())) { setError('Already added.'); return }
    if (members.length >= 19) { setError('Max 19 additional members (20 total incl. you).'); return }
    if (newNick.trim()) setNickname(trimmed, newNick.trim())
    setMembers(prev => [...prev, { addr: trimmed, nickname: newNick.trim() }])
    setNewAddr('')
    setNewNick('')
    setError('')
  }, [newAddr, newNick, address, members])

  const removeMember = (idx: number) => setMembers(prev => prev.filter((_, i) => i !== idx))

  const handleCreate = () => {
    if (!isConnected) { toast.error('Connect your wallet first.'); return }
    if (chainId !== kittyConfig.chain.id) {
      switchChain({ chainId: kittyConfig.chain.id })
      return
    }
    if (!name.trim()) { toast.error('Give your pot a name.'); return }
    writeContract({
      address: kittyConfig.contractAddress,
      abi: KITTY_ABI,
      functionName: 'createPot',
      args: [
        name.trim(),
        members.map(m => m.addr as `0x${string}`),
        safeThreshold,
        vaultAddress,
      ],
      chainId: kittyConfig.chain.id,
    })
  }

  const busyLabel = isPending ? 'Confirm in wallet…' : isConfirming ? 'Creating pot…' : null

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-20">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}>
        <h1 className="display text-2xl font-bold mb-1" style={{ color: 'var(--ink)' }}>Start a Kitty</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>A shared pot anyone in the group can contribute to.</p>

        <div className="rounded-2xl p-5 space-y-5" style={glass}>
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>Pot name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Family Fund, Holiday Trip…"
              maxLength={64}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)', color: 'var(--ink)' }}
            />
          </div>

          {/* Members */}
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>Members</label>
            <div className="space-y-1.5 mb-2">
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--accent)', color: 'white' }}>
                  {address ? address.slice(2, 4).toUpperCase() : 'Y'}
                </div>
                <span className="text-xs flex-1" style={{ color: 'var(--ink-2)' }}>{address ? shortAddr(address) : '—'} <span style={{ color: 'var(--subtle)' }}>(you, creator)</span></span>
              </div>
              {members.map((m, i) => (
                <motion.div
                  key={m.addr}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg"
                  style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(18,45,69,0.12)', color: 'var(--ink)' }}>
                    {m.addr.slice(2, 4).toUpperCase()}
                  </div>
                  <span className="text-xs flex-1 mono" style={{ color: 'var(--ink-2)' }}>
                    {m.nickname || shortAddr(m.addr)}
                    {m.nickname && <span style={{ color: 'var(--subtle)' }}> · {shortAddr(m.addr)}</span>}
                  </span>
                  <button onClick={() => removeMember(i)} className="p-1 rounded-md hover:bg-red-50 transition-colors" aria-label="Remove">
                    <X size={12} style={{ color: 'var(--danger)' }} />
                  </button>
                </motion.div>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={newAddr}
                onChange={e => { setNewAddr(e.target.value); setError('') }}
                placeholder="0x… wallet address"
                className="flex-1 rounded-xl px-3 py-2.5 text-xs mono outline-none"
                style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)', color: 'var(--ink)' }}
              />
              <input
                value={newNick}
                onChange={e => setNewNick(e.target.value)}
                placeholder="Nickname (optional)"
                className="w-28 rounded-xl px-3 py-2.5 text-xs outline-none"
                style={{ background: 'rgba(255,255,255,0.46)', border: '1px solid rgba(255,255,255,0.56)', color: 'var(--ink)' }}
                onKeyDown={e => e.key === 'Enter' && addMember()}
              />
              <button
                onClick={addMember}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: 'var(--accent)', color: 'white' }}
                aria-label="Add member"
              >
                <Plus size={14} />
              </button>
            </div>
            {error && <p className="text-xs mt-1.5" style={{ color: 'var(--danger)' }}>{error}</p>}
          </div>

          {/* Threshold */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>Approvals needed</label>
              <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--accent)' }}>{safeThreshold} of {totalMembers}</span>
            </div>
            <input
              type="range"
              min={1}
              max={maxThreshold}
              value={safeThreshold}
              onChange={e => setThreshold(Number(e.target.value))}
              className="w-full accent-[var(--accent)] h-1.5"
            />
            <p className="text-xs mt-1" style={{ color: 'var(--subtle)' }}>
              {safeThreshold === 1 ? 'Any 1 member can approve a proposal.' : `${safeThreshold} members must approve before a proposal executes.`}
            </p>
          </div>

          {/* Vault */}
          <div>
            <label className="block text-xs font-semibold mb-2 uppercase tracking-wide" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>Earn vault</label>
            <div className="space-y-2">
              <VaultCard vault={null} selected={vaultIdx === null} onSelect={() => setVaultIdx(null)} />
              {kittyConfig.earnVaults.map((v, i) => (
                <VaultCard key={v.address} vault={v} selected={vaultIdx === i} onSelect={() => setVaultIdx(i)} />
              ))}
            </div>
          </div>
        </div>

        {/* Errors */}
        <AnimatePresence>
          {isError && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-sm mt-3 px-1" style={{ color: 'var(--danger)' }}>
              {parseOnchainError(txError)}
              <button onClick={resetTx} className="ml-2 underline text-xs">Dismiss</button>
            </motion.p>
          )}
        </AnimatePresence>

        {/* CTA */}
        <button
          onClick={handleCreate}
          disabled={!isConnected || !!busyLabel || isSuccess}
          className="w-full mt-5 rounded-xl py-4 font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-60"
          style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 16px rgba(18,45,69,0.18)' }}
        >
          {busyLabel ?? (isSuccess ? <><Check size={15} /> Pot created!</> : <><ChevronRight size={15} /> Create pot</>)}
        </button>

        {!isConnected && (
          <p className="text-center text-xs mt-3" style={{ color: 'var(--muted)' }}>Connect your wallet to create a pot.</p>
        )}

        {usdcBal !== undefined && (
          <p className="text-center text-xs mt-2 tabular-nums" style={{ color: 'var(--subtle)' }}>
            Your balance: ${formatUsdc(usdcBal)} USDC
          </p>
        )}
      </motion.div>
    </div>
  )
}
