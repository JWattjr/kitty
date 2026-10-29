import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAccount } from 'wagmi'
import { Plus, ChevronRight } from 'lucide-react'
import { usePotsOf, usePotValue, usePot, useProposalsOf, useMembers } from '@/kitty/hooks'
import { formatUsdc, potGradient } from '@/kitty/utils'
import { ConnectKitButton } from 'connectkit'

const glass = {
  background: 'rgba(255,255,255,0.64)',
  backdropFilter: 'blur(24px) saturate(180%)',
  WebkitBackdropFilter: 'blur(24px) saturate(180%)',
  border: '1px solid rgba(255,255,255,0.68)',
  boxShadow: '0 8px 32px rgba(18,45,69,0.08), inset 0 1px 0 rgba(255,255,255,0.55)',
} as React.CSSProperties

function PotCard({ potId, myAddr }: { potId: bigint; myAddr: string }) {
  const { data: potData } = usePot(potId)
  const { data: potVal } = usePotValue(potId)
  const { data: proposals } = useProposalsOf(potId)
  const { data: members } = useMembers(potId)

  const [name, , , , , , memberCount] = (potData as unknown[] | undefined) ?? []
  const value = (potVal) ?? 0n
  const proposalIds = (proposals as bigint[] | undefined) ?? []
  const allMembers = (members as Array<{ addr: string; isMember: boolean; contributed: bigint }> | undefined) ?? []
  const myMember = allMembers.find(m => m.addr.toLowerCase() === myAddr.toLowerCase())
  const grad = potGradient(potId)

  // Open proposals: not cancelled, not executed, not expired
  // We can't check all states without N reads, so just show count
  const openCount = proposalIds.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
    >
      <Link to={`/pot/${potId}`} className="block no-underline">
        <div className="rounded-2xl p-4 flex items-center gap-4 hover:shadow-lg transition-shadow" style={glass}>
          <div
            className="w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center text-white font-bold display text-sm"
            style={{ background: grad }}
          >
            {(name as string ?? '?')[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate" style={{ color: 'var(--ink)' }}>{name as string}</div>
            <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
              <span className="tabular-nums">${formatUsdc(value)}</span>
              <span>·</span>
              <span>{Number(memberCount ?? 0)} members</span>
              {openCount > 0 && (
                <>
                  <span>·</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{openCount} proposal{openCount !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
            {myMember && myMember.contributed > 0n && (
              <div className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
                Your contribution: ${formatUsdc(myMember.contributed)}
              </div>
            )}
          </div>
          <ChevronRight size={16} style={{ color: 'var(--subtle)', flexShrink: 0 }} />
        </div>
      </Link>
    </motion.div>
  )
}

export default function PotsPage() {
  const { address, isConnected } = useAccount()
  const { data: potIds, isLoading } = usePotsOf(address)
  const ids = (potIds as bigint[] | undefined) ?? []

  return (
    <div className="mx-auto max-w-lg px-4 pt-6 pb-20">
      <div className="flex items-center justify-between mb-6">
        <h1 className="display text-2xl font-bold" style={{ color: 'var(--ink)' }}>My pots</h1>
        <Link
          to="/new"
          className="flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-colors"
          style={{ background: 'var(--accent)', color: 'white' }}
        >
          <Plus size={12} /> New pot
        </Link>
      </div>

      {!isConnected ? (
        <div className="text-center space-y-4 py-12">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Connect your wallet to see your pots.</p>
          <ConnectKitButton />
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: 'var(--border)' }} />
        </div>
      ) : ids.length === 0 ? (
        <div className="text-center space-y-4 py-12">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>You're not in any pots yet.</p>
          <Link
            to="/new"
            className="inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold"
            style={{ background: 'var(--accent)', color: 'white' }}
          >
            <Plus size={14} /> Start your first Kitty
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {ids.map(id => (
            <PotCard key={id.toString()} potId={id} myAddr={address ?? ''} />
          ))}
        </div>
      )}
    </div>
  )
}
