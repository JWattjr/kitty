/**
 * Arc chain definitions for viem.
 * Imported ONLY by kitty/config.ts — nowhere else in src/ imports this directly.
 *
 * IMPORTANT: contracts.multicall3 MUST be set on both chains.
 * wagmi createConfig defaults to batch: { multicall: true }, which makes viem's
 * call action look up chain.contracts.multicall3.address before every batched
 * eth_call.  Without it, getChainContractAddress throws ChainDoesNotSupportContract
 * and every useReadContract query fails silently — the root cause of all read
 * failures in the browser.  Multicall3 is deployed at the canonical address on
 * both Arc Testnet and Arc Mainnet (confirmed via eth_getCode).
 */
import type { Chain } from 'viem'

// Standard Multicall3 address — same on every EVM chain that has it deployed.
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const

export const arcTestnet: Chain = {
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.testnet.arc.io' },
  },
  contracts: {
    multicall3: { address: MULTICALL3 },
  },
  testnet: true,
}

export const arcMainnet: Chain = {
  id: 5042,
  name: 'Arc',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.arc.io'] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.io' },
  },
  contracts: {
    multicall3: { address: MULTICALL3 },
  },
}
