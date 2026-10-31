/**
 * /api/arc-rpc — narrow same-origin JSON-RPC proxy for Arc Mainnet.
 *
 * Purpose: browsers cannot reach the Arc mainnet RPC directly when the app is
 * served from a different origin (Vercel) because the public RPC may not echo
 * the correct Access-Control-Allow-Origin for every deployment hostname.
 * Routing reads through this handler makes them same-origin, bypassing CORS.
 *
 * Upstream: the Arc mainnet RPC URL from the onchain-facts registry (chain ID
 * 5042), or the VITE_KITTY_RPC_URL override env var when set to something other
 * than this handler's own path.  The upstream is always fixed at deploy time.
 *
 * Constraints:
 *   - Only accepts POST (plus OPTIONS for preflight).
 *   - Only forwards an allowlisted set of read-only JSON-RPC methods.
 *   - Does NOT accept arbitrary upstream URLs — not an open proxy.
 *   - No API keys, authentication, or secrets involved.
 */

// @vercel/node types are provided by Vercel at deploy time; stub them here so
// the sandbox TypeScript check passes without an extra dependency.
type VercelRequest = {
  method?: string
  body: unknown
  headers: Record<string, string | string[] | undefined>
}
type VercelResponse = {
  status(code: number): VercelResponse
  json(body: unknown): void
  end(): void
  setHeader(name: string, value: string): void
}

import { requireChain } from '../src/onchain-facts'

// Arc Mainnet chain ID — must match the deployed contract config.
const ARC_MAINNET_CHAIN_ID = 5042

// Resolve upstream at module load.  VITE_KITTY_RPC_URL is the app's override
// var; if it points back to this handler's own path, don't loop — use the
// registry URL instead.
function resolveUpstream(): string {
  const override = process.env.VITE_KITTY_RPC_URL ?? ''
  // If the override is a relative /api/... path or points to ourselves, ignore it.
  if (override && !override.includes('/api/arc-rpc')) {
    return override
  }
  // Fall back to the registry URL for Arc Mainnet.
  return requireChain(ARC_MAINNET_CHAIN_ID).rpcUrls[0]
}

const UPSTREAM = resolveUpstream()

// Read-only JSON-RPC method allowlist.
// Covers all reads the KittyPots app makes: contract calls, block/log/receipt
// lookups.  Write methods (eth_sendRawTransaction, eth_sendTransaction) are
// intentionally absent — wallets sign and broadcast independently.
const ALLOWED_METHODS = new Set([
  'eth_call',
  'eth_getBlockByNumber',
  'eth_getBlockByHash',
  'eth_blockNumber',
  'eth_chainId',
  'eth_getLogs',
  'eth_getTransactionReceipt',
  'eth_getTransactionByHash',
  'net_version',
])

type RpcItem = { jsonrpc?: string; method?: string; id?: unknown; params?: unknown }

function allAllowed(body: unknown): boolean {
  if (Array.isArray(body)) return body.every(item => allAllowed(item))
  if (typeof body !== 'object' || body === null) return false
  const { method } = body as RpcItem
  return typeof method === 'string' && ALLOWED_METHODS.has(method)
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const body: unknown = req.body
  if (!allAllowed(body)) {
    res.status(403).json({ error: 'Method not permitted by proxy' })
    return
  }

  try {
    const upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data: unknown = await upstream.json()
    res.status(upstream.status).json(data)
  } catch {
    res.status(502).json({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32603, message: 'Upstream RPC unreachable' },
    })
  }
}
