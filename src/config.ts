/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 *
 * Chain, RPC and explorer come from kitty/config.ts — the single source of truth.
 * Modular Wallets passkey transport is added in kitty/passkey-wallet.tsx.
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { kittyConfig, configError } from './kitty/config'

const { chain, rpcUrl } = kittyConfig

// Log a config error at startup for fast diagnosis
if (configError) {
  console.error('[KittyPots] Config error:', configError)
}

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(chain.id, rpcUrl)

// Build transports with an explicit key so the chain ID is certain at runtime
const transports: Record<number, ReturnType<typeof http>> = {
  [chain.id]: http(rpcUrl),
  [mainnet.id]: http(), // ENS resolution uses mainnet
}

export const config = createConfig({
  chains: [chain, mainnet] as [typeof chain, typeof mainnet],
  connectors: [injected()],
  transports,
})
