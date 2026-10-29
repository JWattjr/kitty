/**
 * Circle Modular Wallets passkey integration for KittyPots.
 *
 * Provides a React context that manages a passkey-based Circle Smart Contract Account (MSCA).
 * Family members can sign in with Face ID / fingerprint — no MetaMask required.
 *
 * Env vars required:
 *   VITE_CIRCLE_CLIENT_KEY  - Client Key from Circle Console → Keys → Client Keys
 *   VITE_CIRCLE_CLIENT_URL  - Fixed: https://modular-sdk.circle.com/v1/rpc/w3s/buidl
 *
 * If VITE_CIRCLE_CLIENT_KEY is empty the passkey button is hidden with a note.
 *
 * Chain path segments (appended to clientUrl in toModularTransport):
 *   Arc Testnet → /arcTestnet
 *   Arc Mainnet → /arc
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  type P256Credential,
  type SmartAccount,
  createBundlerClient,
  toWebAuthnAccount,
} from 'viem/account-abstraction'
import { createPublicClient, encodeFunctionData } from 'viem'
import {
  WebAuthnMode,
  toCircleSmartAccount,
  toModularTransport,
  toPasskeyTransport,
  toWebAuthnCredential,
} from '@circle-fin/modular-wallets-core'
import { kittyConfig } from './config'
import { erc20Abi } from 'viem'
import { KITTY_ABI } from './abi'

// ── Config ─────────────────────────────────────────────────────────────────────

export const CLIENT_KEY = (import.meta.env.VITE_CIRCLE_CLIENT_KEY as string | undefined) ?? ''
const CLIENT_URL = (import.meta.env.VITE_CIRCLE_CLIENT_URL as string | undefined) ?? 'https://modular-sdk.circle.com/v1/rpc/w3s/buidl'
export const PASSKEY_CONFIGURED = Boolean(CLIENT_KEY)

// Arc chain path
const CHAIN_PATH = kittyConfig.network === 'arc-mainnet' ? '/arc' : '/arcTestnet'

// ── Transports (only created when key is available) ────────────────────────────

function makeTransports() {
  if (!PASSKEY_CONFIGURED) return null
  const passkeyTransport = toPasskeyTransport(CLIENT_URL, CLIENT_KEY)
  const modularTransport = toModularTransport(`${CLIENT_URL}${CHAIN_PATH}`, CLIENT_KEY)
  return { passkeyTransport, modularTransport }
}

const transports = makeTransports()

// ── Credential persistence (localStorage — prototype only) ─────────────────────

const CRED_KEY = 'kitty:passkey-credential'

function saveCredential(c: P256Credential) {
  try { localStorage.setItem(CRED_KEY, JSON.stringify(c)) } catch { /* ignore */ }
}

function loadCredential(): P256Credential | null {
  try {
    const raw = localStorage.getItem(CRED_KEY)
    return raw ? JSON.parse(raw) as P256Credential : null
  } catch { return null }
}

function clearCredential() {
  try { localStorage.removeItem(CRED_KEY) } catch { /* ignore */ }
}

// ── Context ────────────────────────────────────────────────────────────────────

export interface PasskeyWalletState {
  /** Passkey feature available (client key configured). */
  available: boolean
  /** Smart account address, or undefined if not signed in. */
  address: `0x${string}` | undefined
  /** True while register/login is in progress. */
  loading: boolean
  /** Error from last operation. */
  error: string | null
  /** Register a new passkey account. */
  register: (username: string) => Promise<void>
  /** Login with an existing passkey. */
  login: () => Promise<void>
  /** Sign out. */
  logout: () => void
  /** Send a user operation (gasless). calls = array of {to, data, value?} */
  sendUserOp: (calls: Array<{ to: `0x${string}`; data: `0x${string}`; value?: bigint }>) => Promise<`0x${string}`>
}

const PasskeyWalletContext = createContext<PasskeyWalletState | null>(null)

export function usePasskeyWallet(): PasskeyWalletState {
  const ctx = useContext(PasskeyWalletContext)
  if (!ctx) throw new Error('usePasskeyWallet must be used inside PasskeyWalletProvider')
  return ctx
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function PasskeyWalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<SmartAccount | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Try to restore session on mount
  const [restored, setRestored] = useState(false)

  const buildAccount = useCallback(async (cred: P256Credential) => {
    if (!transports) return null
    const { modularTransport } = transports
    const publicClient = createPublicClient({
      chain: kittyConfig.chain,
      transport: modularTransport,
    })
    const acc = await toCircleSmartAccount({
      client: publicClient,
      owner: toWebAuthnAccount({ credential: cred }),
    })
    return acc
  }, [])

  // Restore from localStorage on first render
  if (!restored) {
    setRestored(true)
    if (PASSKEY_CONFIGURED) {
      const stored = loadCredential()
      if (stored) {
        buildAccount(stored).then(acc => {
          if (acc) setAccount(acc)
        }).catch(() => { clearCredential() })
      }
    }
  }

  const register = useCallback(async (username: string) => {
    if (!transports) return
    setLoading(true)
    setError(null)
    try {
      const cred = await toWebAuthnCredential({
        transport: transports.passkeyTransport,
        mode: WebAuthnMode.Register,
        username,
      })
      saveCredential(cred)
      const acc = await buildAccount(cred)
      if (acc) setAccount(acc)
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e)
      if (msg.includes('NotAllowedError') || msg.includes('cancelled')) {
        setError('Passkey registration was cancelled.')
      } else if (msg.includes('InvalidStateError')) {
        setError('A passkey for this account already exists. Try signing in instead.')
      } else {
        setError(`Registration failed: ${msg}`)
      }
    } finally {
      setLoading(false)
    }
  }, [buildAccount])

  const login = useCallback(async () => {
    if (!transports) return
    setLoading(true)
    setError(null)
    try {
      const cred = await toWebAuthnCredential({
        transport: transports.passkeyTransport,
        mode: WebAuthnMode.Login,
      })
      saveCredential(cred)
      const acc = await buildAccount(cred)
      if (acc) setAccount(acc)
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e)
      if (msg.includes('NotAllowedError') || msg.includes('cancelled')) {
        setError('Sign-in was cancelled.')
      } else {
        setError(`Sign-in failed: ${msg}`)
      }
    } finally {
      setLoading(false)
    }
  }, [buildAccount])

  const logout = useCallback(() => {
    clearCredential()
    setAccount(null)
    setError(null)
  }, [])

  const sendUserOp = useCallback(async (
    calls: Array<{ to: `0x${string}`; data: `0x${string}`; value?: bigint }>
  ): Promise<`0x${string}`> => {
    if (!transports || !account) throw new Error('Not signed in with passkey.')
    const bundler = createBundlerClient({
      chain: kittyConfig.chain,
      transport: transports.modularTransport,
    })
    const hash = await bundler.sendUserOperation({
      account,
      calls,
      paymaster: true,
    })
    const { receipt } = await bundler.waitForUserOperationReceipt({ hash })
    return receipt.transactionHash
  }, [account])

  const state: PasskeyWalletState = {
    available: PASSKEY_CONFIGURED,
    address: account?.address,
    loading,
    error,
    register,
    login,
    logout,
    sendUserOp,
  }

  return (
    <PasskeyWalletContext.Provider value={state}>
      {children}
    </PasskeyWalletContext.Provider>
  )
}

// ── Helpers for encoding KittyPots calls ──────────────────────────────────────

/**
 * Encode approve + contribute as two calls for batch submission.
 * The approve is for the USDC ERC-20; contribute is the KittyPots call.
 */
export function encodeApproveAndContribute(
  potId: bigint,
  amount: bigint,
): Array<{ to: `0x${string}`; data: `0x${string}` }> {
  return [
    {
      to: kittyConfig.usdcAddress,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [kittyConfig.contractAddress, amount],
      }),
    },
    {
      to: kittyConfig.contractAddress,
      data: encodeFunctionData({
        abi: KITTY_ABI,
        functionName: 'contribute',
        args: [potId, amount],
      }),
    },
  ]
}

/**
 * Encode a KittyPots propose() call.
 * The caller is responsible for passing the correctly typed args tuple.
 */
export function encodeKittyPropose(
  potId: bigint,
  kind: number,
  target: `0x${string}`,
  amount: bigint,
  bps: number,
  period: bigint,
  memo: string,
): { to: `0x${string}`; data: `0x${string}` } {
  return {
    to: kittyConfig.contractAddress,
    data: encodeFunctionData({
      abi: KITTY_ABI,
      functionName: 'propose',
      args: [potId, kind, target, amount, bps, period, memo],
    }),
  }
}

/** Encode a KittyPots approve() call. */
export function encodeKittyApprove(
  potId: bigint,
  proposalId: bigint,
): { to: `0x${string}`; data: `0x${string}` } {
  return {
    to: kittyConfig.contractAddress,
    data: encodeFunctionData({
      abi: KITTY_ABI,
      functionName: 'approve',
      args: [potId, proposalId],
    }),
  }
}
