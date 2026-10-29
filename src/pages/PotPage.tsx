import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi'
import { ExternalLink, Flame, Plus, Check, X, QrCode, Copy } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { kittyConfig, explorerTx } from '@/kitty/config'
import { KITTY_ABI } from '@/kitty/abi'
import { usePot, usePotValue, useYieldEarned, useMembers, useProposalsOf, useAllowanceOf, usePotCount, useActivityLogs } from '@/kitty/hooks'
import { formatUsdc, displayName, formatCountdown, KIND_LABELS, potGradient, shortAddr } from '@/kitty/utils'
import CountUp from '@/components/CountUp'
import PotFill from '@/components/PotFill'
import ContributePanel from '@/components/ContributePanel'
import ProposalSheet from '@/components/ProposalSheet'
import AllowanceCard from '@/components/AllowanceCard'
import { buildShareLink } from '@/lib/share'
import { toast } from 'sonner'

const USDC_D = 1e6
const glass = {
  background: 'rgba(255,255,255,0.64)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.68)',
  boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
} as React.CSSProperties

// ── Proposal Row ───────────────────────────────────────────────────────────────

function ProposalRow({
  potId,
  proposalId,
  threshold,
  myAddr,
  onRefresh,
}: {
  potId: bigint
  proposalId: bigint
  threshold: number
  myAddr: string | undefined
  onRefresh: () => void
}) {
  const { data: p } = useReadContract({
    address: kittyConfig.contractAddress,
    abi: KITTY_ABI,
    functionName: 'getProposal',
    args: [potId, proposalId],
    chainId: kittyConfig.chain.id,
  })
  const { writeContract: doApprove, data: approveHash, isPending: approvePending } = useWriteContract()
  const { writeContract: doCancel, data: cancelHash, isPending: cancelPending } = useWriteContract()
  const { isSuccess: approveOk } = useWaitForTransactionReceipt({ hash: approveHash })
  const { isSuccess: cancelOk } = useWaitForTransactionReceipt({ hash: cancelHash })

  if (approveOk || cancelOk) onRefresh()

  if (!p) return null
  const tuple = p as readonly [number, string, bigint, number, bigint, string, string, bigint, number, boolean, boolean, boolean]
  const [kind, target, amount, bps, , memo, proposer, createdAt, approvalCount, executed, cancelled, expired] = tuple
  const kindN = Number(kind)
  const approvals = Number(approvalCount)
  const exp = executed
  const can = cancelled
  const expi = expired
  const done = exp || can || expi
  const expiryTs = Number(createdAt) + 7 * 86400
  const isProposer = proposer?.toLowerCase() === myAddr?.toLowerCase()

  const pct = Math.min(100, (approvals / threshold) * 100)

  let detail = ''
  if (kindN === 0) detail = `$${formatUsdc(amount)} → ${shortAddr(target)}`
  else if (kindN === 1) detail = `Add ${shortAddr(target)}`
  else if (kindN === 2) detail = `Remove ${shortAddr(target)}`
  else if (kindN === 3) detail = `Set threshold to ${Number(bps)}`
  else if (kindN === 4) detail = `Card: $${formatUsdc(amount)}`
  else if (kindN === 5) detail = `Freeze card for ${shortAddr(target)}`

  function approve() {
    doApprove({
      address: kittyConfig.contractAddress,
      abi: KITTY_ABI,
      functionName: 'approve',
      args: [potId, proposalId],
      chainId: kittyConfig.chain.id,
    })
  }
  function cancel() {
    doCancel({
      address: kittyConfig.contractAddress,
      abi: KITTY_ABI,
      functionName: 'cancel',
      args: [potId, proposalId],
      chainId: kittyConfig.chain.id,
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-3.5 space-y-2"
      style={{
        background: done ? 'rgba(18,45,69,0.03)' : 'rgba(255,255,255,0.46)',
        border: `1px solid ${done ? 'var(--border)' : 'rgba(255,255,255,0.56)'}`,
        opacity: done ? 0.65 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{KIND_LABELS[kindN] ?? `Kind ${kindN}`}</span>
          {detail && <span className="text-xs ml-2" style={{ color: 'var(--muted)' }}>{detail}</span>}
          {memo && <div className="text-xs mt-0.5 italic" style={{ color: 'var(--subtle)' }}>"{memo}"</div>}
        </div>
        <div className="text-xs shrink-0" style={{ color: done ? 'var(--subtle)' : 'var(--muted)' }}>
          {exp ? 'Executed' : can ? 'Cancelled' : expi ? 'Expired' : formatCountdown(expiryTs)}
        </div>
      </div>

      {!done && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 80, damping: 20 }}
                style={{ background: pct >= 100 ? 'var(--success)' : 'var(--accent)' }}
              />
            </div>
            <span className="text-xs tabular-nums" style={{ color: 'var(--subtle)' }}>{approvals}/{threshold}</span>
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={approve}
              disabled={approvePending}
              className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              {approvePending ? '…' : <><Check size={10} /> Approve{pct + (1 / threshold) * 100 >= 100 ? ' (executes)' : ''}</>}
            </button>
            {isProposer && (
              <button
                onClick={cancel}
                disabled={cancelPending}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all disabled:opacity-50"
                style={{ background: 'var(--surface-muted)', color: 'var(--muted)', border: '1px solid var(--border)' }}
              >
                {cancelPending ? '…' : <><X size={10} /> Cancel</>}
              </button>
            )}
          </div>
        </>
      )}
    </motion.div>
  )
}

// ── Activity Feed ─────────────────────────────────────────────────────────────

function ActivityFeed({ potId }: { potId: bigint }) {
  const { data: events = [], isLoading } = useActivityLogs(potId)

  if (isLoading) return <p className="text-xs py-2" style={{ color: 'var(--subtle)' }}>Loading activity…</p>
  if (events.length === 0) return null

  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>Activity</div>
      <div className="space-y-1">
        {events.map((e, i) => (
          <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b" style={{ borderColor: 'var(--border)' }}>
            <span style={{ color: 'var(--ink-2)' }}>Transaction</span>
            {e.hash && (
              <a href={explorerTx(e.hash)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-0.5" style={{ color: 'var(--subtle)' }}>
                {e.hash.slice(0, 8)}… <ExternalLink size={9} />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PotPage() {
  const { id } = useParams<{ id: string }>()
  const potId = id !== undefined ? BigInt(id) : undefined
  const { address } = useAccount()

  const { data: potCount } = usePotCount()
  const { data: potData, isError: potError, fetchStatus, refetch: refetchPot } = usePot(potId)
  const { data: potVal, refetch: refetchVal } = usePotValue(potId)
  const { data: yieldVal, refetch: refetchYield } = useYieldEarned(potId)
  const { data: membersData, refetch: refetchMembers } = useMembers(potId)
  const { data: proposalIds, refetch: refetchProposals } = useProposalsOf(potId)

  const allMembers = (membersData as Array<{ addr: string; isMember: boolean; contributed: bigint; monthsStreak: number }> | undefined) ?? []
  const myMember = allMembers.find(m => m.addr.toLowerCase() === address?.toLowerCase())
  const isMember = myMember?.isMember ?? false

  const { data: myAllowance, refetch: refetchAllowance } = useAllowanceOf(potId, address)

  const [showProposal, setShowProposal] = useState(false)
  const [shareLink, setShareLink] = useState<string | null>(null)
  const [showQr, setShowQr] = useState(false)

  useEffect(() => {
    if (!potId) return
    buildShareLink(`/gift/${potId}`).then(link => setShareLink(link)).catch(() => {})
  }, [potId])

  function refresh() {
    void refetchPot()
    void refetchVal()
    void refetchYield()
    void refetchMembers()
    void refetchProposals()
    void refetchAllowance()
  }

  const potTuple = potData as readonly [string, string, string, bigint, bigint, number, number, bigint, bigint, bigint] | undefined

  // Out-of-bounds: pot id >= potCount
  const notFound =
    (potId === undefined) ||
    (potCount !== undefined && potId >= (potCount)) ||
    potError

  if (notFound || (potData && !(potTuple?.[0]))) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-20 text-center space-y-4">
        <div className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>Pot not found</div>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          {potId !== undefined ? `Pot #${potId.toString()} doesn't exist yet.` : 'Invalid pot ID.'}
        </p>
        <a href="/" className="inline-block mt-2 text-sm font-semibold underline" style={{ color: 'var(--accent)' }}>
          Go home
        </a>
      </div>
    )
  }

  if (!potData && fetchStatus !== 'idle') {
    return (
      <div className="mx-auto max-w-lg px-4 pt-12 text-center space-y-2">
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" style={{ color: 'var(--border)' }} />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading pot…</p>
      </div>
    )
  }

  if (!potData) {
    return (
      <div className="mx-auto max-w-lg px-4 pt-12 text-center space-y-2">
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto" style={{ color: 'var(--border)' }} />
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading pot…</p>
      </div>
    )
  }

  const name = potTuple?.[0]
  const vaultAddr = potTuple?.[2]
  const threshold = potTuple?.[5]
  const memberCount = potTuple?.[6]
  const totalContributed = potTuple?.[7]

  const value = (potVal) ?? 0n
  const yld = (yieldVal) ?? 0n
  const totalC = totalContributed ?? 0n
  const threshNum = Number(threshold ?? 1)
  const proposalIdsArr = (proposalIds as bigint[] | undefined) ?? []

  const fillPct = totalC > 0n ? Math.min(100, Number((value * 100n) / totalC)) : 0
  const grad = potGradient(potId ?? 0n)
  const vaultInfo = vaultAddr && vaultAddr !== '0x0000000000000000000000000000000000000000'
    ? kittyConfig.earnVaults.find(v => v.address.toLowerCase() === vaultAddr.toLowerCase())
    : null

  const myAllowanceData = myAllowance as { limit: bigint; period: bigint; spentThisPeriod: bigint; remainingThisPeriod: bigint; resetsAt: bigint; active: boolean } | undefined

  async function copyShareLink() {
    if (!shareLink) return
    await navigator.clipboard.writeText(shareLink)
    toast.success('Gift link copied!')
  }

  return (
    <div className="mx-auto max-w-lg px-4 pt-4 pb-24 space-y-4">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }}
        className="rounded-2xl p-5" style={glass}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h1 className="display text-xl font-bold truncate" style={{ color: 'var(--ink)' }}>{name}</h1>
            {vaultInfo && (
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--success)' }} />
                <span className="text-xs" style={{ color: 'var(--muted)' }}>
                  Earning in {vaultInfo.name} · Morpho via Circle Earn
                </span>
              </div>
            )}
            {!vaultInfo && <span className="text-xs mt-1 block" style={{ color: 'var(--subtle)' }}>No yield vault</span>}
          </div>
          <PotFill fillPct={fillPct} gradient={grad} size={80} />
        </div>

        <div className="text-4xl font-bold tabular-nums mb-1 display" style={{ letterSpacing: '-0.03em', color: 'var(--ink)' }}>
          $<CountUp value={Number(value) / USDC_D} />
        </div>
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          ${formatUsdc(totalC)} contributed · ${formatUsdc(yld)} yield earned
        </p>

        {/* Share */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => void copyShareLink()}
            disabled={!shareLink}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40"
            style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
          >
            <Copy size={12} /> Copy gift link
          </button>
          <button
            onClick={() => setShowQr(!showQr)}
            className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
          >
            <QrCode size={12} /> QR
          </button>
        </div>
        <AnimatePresence>
          {showQr && shareLink && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex justify-center overflow-hidden">
              <div className="p-3 rounded-xl" style={{ background: 'white' }}>
                <QRCodeSVG value={shareLink} size={140} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Contribute */}
      {isMember && (
        <ContributePanel potId={potId} onSuccess={refresh} />
      )}

      {/* Members */}
      <div className="rounded-2xl p-4" style={glass}>
        <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>
          Members ({Number(memberCount ?? 0)})
        </div>
        <div className="space-y-2">
          {allMembers.filter(m => m.isMember).map(m => (
            <div key={m.addr} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: potGradient(potId), color: 'white' }}>
                {m.addr.slice(2, 4).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{displayName(m.addr)}</span>
                  {m.addr.toLowerCase() === address?.toLowerCase() && (
                    <span className="text-xs rounded-full px-2 py-0.5" style={{ background: 'var(--accent)', color: 'white' }}>you</span>
                  )}
                </div>
                <span className="text-xs tabular-nums" style={{ color: 'var(--muted)' }}>${formatUsdc(m.contributed)} contributed</span>
              </div>
              {m.monthsStreak > 0 && (
                <div className="flex items-center gap-1 text-xs font-semibold" style={{ color: '#f05c6b' }}>
                  <Flame size={13} />
                  {m.monthsStreak}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Allowance card */}
      {myAllowanceData?.active && address && (
        <div className="rounded-2xl p-4" style={glass}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>Your allowance card</div>
          <AllowanceCard
            potId={potId}
            memberAddr={address}
            allowance={myAllowanceData}
            isHolder={true}
            onRefresh={refresh}
          />
        </div>
      )}

      {/* Proposals */}
      <div className="rounded-2xl p-4" style={glass}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--subtle)', letterSpacing: '0.07em' }}>
            Decisions ({proposalIdsArr.length})
          </div>
          {isMember && (
            <button
              onClick={() => setShowProposal(true)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
              style={{ background: 'var(--accent)', color: 'white' }}
            >
              <Plus size={12} /> Propose
            </button>
          )}
        </div>

        {proposalIdsArr.length === 0 ? (
          <p className="text-xs text-center py-4" style={{ color: 'var(--subtle)' }}>No proposals yet.</p>
        ) : (
          <div className="space-y-2">
            {[...proposalIdsArr].reverse().map(pid => (
              <ProposalRow
                key={pid.toString()}
                potId={potId}
                proposalId={pid}
                threshold={threshNum}
                myAddr={address}
                onRefresh={refresh}
              />
            ))}
          </div>
        )}
      </div>

      {/* Activity */}
      <div className="rounded-2xl p-4" style={glass}>
        <ActivityFeed potId={potId} />
      </div>

      {/* Proposal sheet */}
      {showProposal && (
        <ProposalSheet
          potId={potId}
          potValue={value}
          members={allMembers}
          onClose={() => setShowProposal(false)}
          onSuccess={() => { setShowProposal(false); refresh() }}
        />
      )}
    </div>
  )
}
