import { USDC_DECIMALS } from './config'

// ── USDC formatting ───────────────────────────────────────────────────────────

export function formatUsdc(raw: bigint, decimals = 2): string {
  const n = Number(raw) / 10 ** USDC_DECIMALS
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function parseUsdc(human: string): bigint {
  const n = parseFloat(human.replace(/,/g, ''))
  if (isNaN(n) || n < 0) return 0n
  return BigInt(Math.round(n * 10 ** USDC_DECIMALS))
}

// ── Address helpers ───────────────────────────────────────────────────────────

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

// ── Time helpers ──────────────────────────────────────────────────────────────

export function formatCountdown(expiresAt: number): string {
  const diff = expiresAt - Date.now() / 1000
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function formatResetIn(resetsAt: number): string {
  return formatCountdown(resetsAt)
}

// ── Proposal kinds ────────────────────────────────────────────────────────────

export const KIND_LABELS: Record<number, string> = {
  0: 'Send money',
  1: 'Add member',
  2: 'Remove member',
  3: 'Change approvals',
  4: 'Give allowance card',
  5: 'Freeze card',
}

// ── Nickname storage ──────────────────────────────────────────────────────────

const NS_KEY = 'kitty:nicknames'

function loadNicknames(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(NS_KEY) || '{}') as Record<string, string>
  } catch {
    return {}
  }
}

function saveNicknames(map: Record<string, string>): void {
  localStorage.setItem(NS_KEY, JSON.stringify(map))
}

export function getNickname(addr: string): string {
  return loadNicknames()[addr.toLowerCase()] || ''
}

export function setNickname(addr: string, name: string): void {
  const map = loadNicknames()
  map[addr.toLowerCase()] = name
  saveNicknames(map)
}

export function displayName(addr: string): string {
  return getNickname(addr) || shortAddr(addr)
}

// ── Error parser ──────────────────────────────────────────────────────────────

export function parseOnchainError(error: unknown): string {
  const msg = (error as { message?: string })?.message?.toLowerCase() ?? ''
  if (msg.includes('user rejected') || msg.includes('user denied')) return 'Cancelled.'
  if (msg.includes('insufficient') || msg.includes('exceeds balance')) return 'Insufficient USDC balance.'
  if (msg.includes('not member')) return 'You are not a member of this pot.'
  if (msg.includes('allowance exceeded')) return 'Over your card limit for this period.'
  if (msg.includes('proposal expired')) return 'This proposal has expired.'
  if (msg.includes('already approved')) return 'You already approved this.'
  if (msg.includes('no allowance')) return 'You have no active allowance card on this pot.'
  if (msg.includes('reverted')) {
    const m = msg.match(/kittypots: ([^"]+)/)
    if (m) return `Transaction failed: ${m[1]}`
    return 'Transaction failed. Check the pot state and try again.'
  }
  if (msg.includes('network') || msg.includes('timeout')) return 'Network error. Check your connection.'
  return 'Something went wrong. Please try again.'
}

// ── Colour for pot (deterministic from id) ────────────────────────────────────

const POT_GRADIENTS = [
  'linear-gradient(135deg, #5fbeff 0%, #af8ff4 100%)',
  'linear-gradient(135deg, #ffcd83 0%, #f05c6b 100%)',
  'linear-gradient(135deg, #7ef1b3 0%, #5fbeff 100%)',
  'linear-gradient(135deg, #af8ff4 0%, #f05c6b 100%)',
  'linear-gradient(135deg, #ffcd83 0%, #7ef1b3 100%)',
]

export function potGradient(potId: bigint | number): string {
  return POT_GRADIENTS[Number(potId) % POT_GRADIENTS.length]
}
