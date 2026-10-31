/**
 * /api/arc-rpc — narrow same-origin JSON-RPC proxy for Arc Mainnet.
 *
 * Purpose: browsers cannot reach the Arc mainnet RPC directly when the app is
 * served from a different origin (Vercel) because the public RPC does not echo
 * the caller's origin in Access-Control-Allow-Origin.  Routing reads through
 * this handler makes them same-origin, bypassing CORS.
 *
 * Upstream: the fixed public Arc mainnet RPC endpoint.  This is a protocol-
 * defined public constant, not a secret.  The handler is intentionally
 * self-contained — no cross-directory imports — so it compiles cleanly in the
 * Vercel Node 24 ESM runtime without bundling the frontend source tree.
 *
 * Constraints:
 *   - Only accepts POST (plus OPTIONS for CORS preflight).
 *   - Only forwards an allowlisted set of read-only JSON-RPC methods.
 *   - Upstream is hard-coded; this is NOT an open proxy.
 *   - No API keys, authentication, or secrets involved.
 */

// @vercel/node types are provided by Vercel at deploy time; stubbed here so
// the sandbox TypeScript check passes without an extra devDependency.
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

// Fixed public Arc mainnet RPC — same URL used by the frontend default config.
// arc-studio-allow-onchain-literal
const UPSTREAM = 'https://rpc.mainnet.arc.io' as const

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
