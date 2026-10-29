/**
 * Single network config module.
 * ALL chain/explorer/vault references in src/ import from here.
 * Never import arcTestnet or arcMainnet directly elsewhere in src/.
 *
 * Env vars:
 *   VITE_KITTY_CHAIN        = "arc-testnet" | "arc-mainnet"  (default: arc-testnet)
 *   VITE_KITTY_ADDRESS      = deployed KittyPots contract address
 *   VITE_KITTY_DEPLOY_BLOCK = block at which KittyPots was deployed (for event scanning)
 *   VITE_KITTY_RPC_URL      = optional RPC override
 */

import { arcTestnet, arcMainnet } from './chains'
import { getAddress } from 'viem'
import type { Chain } from 'viem'

/**
 * Normalise an address to EIP-55 checksum form.
 * Throws at config-load time if the hex is invalid, making bad addresses
 * fail fast instead of silently producing "address is invalid" RPC errors.
 */
function addr(raw: string): `0x${string}` {
  return getAddress(raw)
}

export type KittyNetwork = 'arc-testnet' | 'arc-mainnet'

export interface EarnVault {
  address: `0x${string}`
  name: string
  curator: string
  description: string
}

export interface KittyConfig {
  network: KittyNetwork
  chain: Chain
  rpcUrl: string
  explorerBase: string
  usdcAddress: `0x${string}`
  contractAddress: `0x${string}`
  deployBlock: bigint
  earnVaults: EarnVault[]
}

const TESTNET_CONFIG: KittyConfig = {
  network: 'arc-testnet',
  chain: arcTestnet,
  rpcUrl: (import.meta.env.VITE_KITTY_RPC_URL as string | undefined) ?? 'https://rpc.testnet.arc.io',
  explorerBase: 'https://explorer.testnet.arc.io',
  usdcAddress: addr('0x3600000000000000000000000000000000000000'),
  contractAddress: addr((import.meta.env.VITE_KITTY_ADDRESS as string | undefined) ?? '0xea0c6e150fa386800a109f6b80fd0b285320c634'),
  // Block at which KittyPots was deployed on Arc Testnet (Oct 2026)
  deployBlock: BigInt((import.meta.env.VITE_KITTY_DEPLOY_BLOCK as string | undefined) ?? '69321420'),
  earnVaults: [
    {
      address: addr('0xAabbeF1D3971c710276ed41eC791BbE14CdB8E88'),
      name: 'EarnKit USDC Vault',
      curator: 'Circle',
      description: 'Circle-curated Morpho vault on Arc Testnet',
    },
  ],
}

const MAINNET_CONTRACT_ADDR = (import.meta.env.VITE_KITTY_ADDRESS as string | undefined) ?? ''

const MAINNET_CONFIG: KittyConfig = {
  network: 'arc-mainnet',
  chain: arcMainnet,
  rpcUrl: (import.meta.env.VITE_KITTY_RPC_URL as string | undefined) ?? 'https://rpc.mainnet.arc.io',
  explorerBase: 'https://explorer.arc.io',
  usdcAddress: addr('0x3600000000000000000000000000000000000000'),
  contractAddress: addr(MAINNET_CONTRACT_ADDR || '0x0000000000000000000000000000000000000000'),
  deployBlock: BigInt((import.meta.env.VITE_KITTY_DEPLOY_BLOCK as string | undefined) ?? '0'),
  earnVaults: [
    {
      address: addr('0x8E357432CC12ff425c36432F312968aEb16112AF'),
      name: 'Galaxy USDC',
      curator: 'Galaxy',
      description: 'Galaxy-curated Morpho Vault V2 on Arc',
    },
    {
      address: addr('0x5bEfAb92a5A3D60F578Cb51EEb4e4FD50a1e3123'),
      name: 'Keyrock Prime USDC',
      curator: 'Keyrock',
      description: 'Keyrock-curated Morpho Vault V2 on Arc',
    },
  ],
}

const networkEnv = (import.meta.env.VITE_KITTY_CHAIN || 'arc-testnet') as KittyNetwork

export const kittyConfig: KittyConfig =
  networkEnv === 'arc-mainnet' ? MAINNET_CONFIG : TESTNET_CONFIG

/**
 * Set when the active config is invalid and the app should show a config error.
 * Currently: mainnet selected but VITE_KITTY_ADDRESS not set.
 */
export const configError: string | null =
  networkEnv === 'arc-mainnet' && !MAINNET_CONTRACT_ADDR
    ? 'Arc mainnet is selected (VITE_KITTY_CHAIN=arc-mainnet) but VITE_KITTY_ADDRESS is not set. Please set VITE_KITTY_ADDRESS to the deployed KittyPots contract address.'
    : null

export const USDC_DECIMALS = 6

export function explorerTx(hash: string): string {
  return `${kittyConfig.explorerBase}/tx/${hash}`
}

export function explorerAddr(addr: string): string {
  return `${kittyConfig.explorerBase}/address/${addr}`
}
