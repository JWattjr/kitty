import { Link, useLocation } from 'react-router-dom'
import { ConnectKitButton } from 'connectkit'
import { useAccount } from 'wagmi'
import { Layers, Plus } from 'lucide-react'
import { kittyConfig } from '@/kitty/config'
import NetworkGuard from './NetworkGuard'
import PasskeyButton from './PasskeyButton'
import { usePasskeyWallet } from '@/kitty/passkey-wallet'

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount()
  const { address: passkeyAddr } = usePasskeyWallet()
  const location = useLocation()
  const isHome = location.pathname === '/'
  const anyConnected = isConnected || Boolean(passkeyAddr)

  return (
    <div className="relative min-h-dvh overflow-x-hidden" style={{ background: 'var(--bg-gradient)' }}>
      {/* Ambient blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div style={{ position: 'absolute', top: '6%', left: '3%', width: 320, height: 320, borderRadius: '50%', background: 'radial-gradient(circle, rgba(133,177,237,0.18) 0%, transparent 70%)', filter: 'blur(72px)' }} />
        <div style={{ position: 'absolute', bottom: '10%', right: '4%', width: 280, height: 280, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,205,131,0.16) 0%, transparent 70%)', filter: 'blur(64px)' }} />
      </div>

      {/* Header */}
      <header className="relative z-20 flex items-center justify-between px-4 py-3 max-w-2xl mx-auto">
        <Link to="/" className="flex items-center gap-2 no-underline">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" aria-hidden="true">
              <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="2" />
              <path d="M6 10h8M10 6v8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </div>
          <span className="display text-base font-bold" style={{ color: 'var(--ink)' }}>KittyPots</span>
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          {anyConnected && !isHome && (
            <>
              <Link
                to="/pots"
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ background: 'var(--surface-muted)', color: 'var(--ink-2)', border: '1px solid var(--border)' }}
              >
                <Layers size={13} />
                My pots
              </Link>
              <Link
                to="/new"
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{ background: 'var(--accent)', color: 'white' }}
              >
                <Plus size={13} />
                New pot
              </Link>
            </>
          )}
          {/* Passkey sign-in (Family ID — no MetaMask) */}
          <PasskeyButton />
          {/* Injected wallet connect */}
          <ConnectKitButton />
        </div>
      </header>

      {/* Network guard — only shown when connected */}
      <NetworkGuard />

      {/* Main */}
      <main className="relative z-10 pb-16">
        {children}
      </main>

      {/* Chain badge */}
      <div className="fixed bottom-4 left-4 z-30 text-xs rounded-full px-3 py-1 font-medium mono"
        style={{ background: 'rgba(18,45,69,0.06)', color: 'var(--subtle)', border: '1px solid var(--border)' }}>
        {kittyConfig.chain.name}
      </div>
    </div>
  )
}
