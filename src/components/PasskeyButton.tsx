/**
 * Passkey sign-in button shown alongside the regular "Connect wallet" button.
 * When VITE_CIRCLE_CLIENT_KEY is empty, shows a "not configured" note.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Fingerprint, LogOut, Copy, X, AlertTriangle } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { usePasskeyWallet } from '@/kitty/passkey-wallet'
import { useUsdcBalance } from '@/kitty/hooks'
import { formatUsdc, shortAddr } from '@/kitty/utils'
import { toast } from 'sonner'

const glass = {
  background: 'rgba(255,255,255,0.92)',
  backdropFilter: 'blur(32px) saturate(200%)',
  WebkitBackdropFilter: 'blur(32px) saturate(200%)',
  border: '1px solid rgba(255,255,255,0.72)',
  boxShadow: '0 16px 48px rgba(18,45,69,0.14)',
} as React.CSSProperties

export default function PasskeyButton() {
  const pw = usePasskeyWallet()
  const [showSheet, setShowSheet] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [showQr, setShowQr] = useState(false)

  const { data: usdcBal } = useUsdcBalance(pw.address)

  async function copyAddr() {
    if (!pw.address) return
    await navigator.clipboard.writeText(pw.address)
    toast.success('Address copied!')
  }

  if (!pw.available) {
    return (
      <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs" style={{ background: 'var(--surface-muted)', color: 'var(--subtle)', border: '1px solid var(--border)' }}>
        <AlertTriangle size={12} />
        Passkey sign-in not configured
      </div>
    )
  }

  if (pw.address) {
    return (
      <>
        <button
          onClick={() => setShowSheet(true)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-80"
          style={{ background: 'linear-gradient(90deg, #5fbeff, #af8ff4)', color: 'white' }}
        >
          <Fingerprint size={13} />
          {shortAddr(pw.address)}
        </button>

        <AnimatePresence>
          {showSheet && (
            <motion.div
              className="fixed inset-0 z-50 flex items-end justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSheet(false)}
            >
              <div className="absolute inset-0" style={{ background: 'rgba(18,45,69,0.3)', backdropFilter: 'blur(4px)' }} />
              <motion.div
                className="relative z-10 w-full max-w-sm rounded-t-3xl p-6 mx-4 mb-0 space-y-4"
                style={glass}
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 400, damping: 36 }}
                onClick={e => e.stopPropagation()}
              >
                {/* 4px spectral strip at top */}
                <div className="rounded-full h-1 w-10 mx-auto mb-2" style={{ background: 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)' }} />

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>Your Kitty wallet</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--subtle)' }}>
                      Smart account · passkey secured
                    </div>
                  </div>
                  <button onClick={() => setShowSheet(false)} className="p-1.5 rounded-full" style={{ color: 'var(--muted)' }}>
                    <X size={16} />
                  </button>
                </div>

                <div className="rounded-xl p-4 space-y-2" style={{ background: 'var(--surface-muted)', border: '1px solid var(--border)' }}>
                  <div className="text-xs" style={{ color: 'var(--subtle)' }}>Address</div>
                  <div className="flex items-center gap-2">
                    <span className="mono text-xs flex-1 truncate" style={{ color: 'var(--ink)' }}>{pw.address}</span>
                    <button onClick={() => void copyAddr()} className="p-1.5 rounded-lg transition-colors hover:bg-white/60" aria-label="Copy address">
                      <Copy size={13} style={{ color: 'var(--muted)' }} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <div className="text-xs" style={{ color: 'var(--subtle)' }}>USDC balance</div>
                      <div className="font-semibold tabular-nums" style={{ color: 'var(--ink)' }}>
                        {usdcBal !== undefined ? `$${formatUsdc(usdcBal)}` : '—'}
                      </div>
                    </div>
                    <button
                      onClick={() => setShowQr(!showQr)}
                      className="rounded-xl px-3 py-1.5 text-xs font-semibold"
                      style={{ background: 'var(--accent)', color: 'white' }}
                    >
                      Receive USDC
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {showQr && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="flex justify-center overflow-hidden"
                    >
                      <div className="p-3 rounded-xl" style={{ background: 'white' }}>
                        <QRCodeSVG value={pw.address} size={160} />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <p className="text-xs text-center" style={{ color: 'var(--subtle)' }}>
                  Send USDC to this address so you can chip in to pots.
                </p>

                <button
                  onClick={() => { pw.logout(); setShowSheet(false) }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all"
                  style={{ background: 'var(--surface-muted)', color: 'var(--muted)', border: '1px solid var(--border)' }}
                >
                  <LogOut size={14} /> Sign out
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    )
  }

  // Not signed in
  return (
    <>
      <button
        onClick={() => setShowSheet(true)}
        disabled={pw.loading}
        className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all hover:opacity-90 disabled:opacity-60"
        style={{ background: 'linear-gradient(90deg, #5fbeff 0%, #af8ff4 100%)', color: 'white' }}
      >
        <Fingerprint size={13} />
        {pw.loading ? 'Signing in…' : 'Face ID / Fingerprint'}
      </button>

      <AnimatePresence>
        {showSheet && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSheet(false)}
          >
            <div className="absolute inset-0" style={{ background: 'rgba(18,45,69,0.3)', backdropFilter: 'blur(4px)' }} />
            <motion.div
              className="relative z-10 w-full max-w-sm rounded-t-3xl p-6 mx-4 mb-0 space-y-4"
              style={glass}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 36 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="rounded-full h-1 w-10 mx-auto mb-2" style={{ background: 'linear-gradient(90deg, #5fbeff, #af8ff4, #f05c6b, #ffcd83, #7ef1b3)' }} />

              <div className="text-center space-y-1">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'linear-gradient(135deg, #5fbeff, #af8ff4)' }}>
                  <Fingerprint size={24} color="white" />
                </div>
                <div className="display font-bold text-lg" style={{ color: 'var(--ink)' }}>Sign in with passkey</div>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>
                  Use Face ID or your fingerprint. Your keys never leave your device.
                </p>
              </div>

              {pw.error && (
                <div className="rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(186,43,76,0.07)', color: 'var(--danger)', border: '1px solid rgba(186,43,76,0.2)' }}>
                  {pw.error}
                </div>
              )}

              {showRegister ? (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--subtle)' }}>Your name (optional)</label>
                    <input
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="e.g. Alice"
                      className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                    />
                  </div>
                  <button
                    onClick={() => void pw.register(username || 'KittyPots user')}
                    disabled={pw.loading}
                    className="w-full rounded-xl py-3.5 font-semibold text-sm transition-all disabled:opacity-60"
                    style={{ background: 'linear-gradient(90deg, #5fbeff, #af8ff4)', color: 'white' }}
                  >
                    {pw.loading ? 'Creating…' : 'Create passkey account'}
                  </button>
                  <button onClick={() => setShowRegister(false)} className="w-full text-xs text-center py-1" style={{ color: 'var(--subtle)' }}>
                    Back
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    onClick={() => void pw.login()}
                    disabled={pw.loading}
                    className="w-full rounded-xl py-3.5 font-semibold text-sm transition-all disabled:opacity-60"
                    style={{ background: 'var(--accent)', color: 'white' }}
                  >
                    {pw.loading ? 'Signing in…' : 'Sign in with existing passkey'}
                  </button>
                  <button
                    onClick={() => setShowRegister(true)}
                    className="w-full rounded-xl py-3 text-sm font-semibold transition-all"
                    style={{ background: 'var(--surface-muted)', color: 'var(--ink)', border: '1px solid var(--border)' }}
                  >
                    Create new passkey account
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
