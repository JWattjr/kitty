/**
 * Wagmi hooks scoped to KittyPots.
 *
 * IMPORTANT — do not use usePublicClient() here.
 * wagmi's usePublicClient({ chainId }) returns undefined when the chain type
 * is not a known literal in the wagmi config — our custom arcTestnet chain is
 * typed as the broad viem Chain interface, so wagmi can't discriminate it.
 * We create one stable module-level publicClient via createPublicClient()
 * and use it directly in all useQuery queryFns.
 */
import { useReadContract, useReadContracts } from 'wagmi'
import { createPublicClient, http, erc20Abi } from 'viem'
import { useQuery } from '@tanstack/react-query'
import { kittyConfig } from './config'
import { KITTY_ABI } from './abi'
import { ERC4626_ABI } from './erc4626abi'

// ── Stable public client ──────────────────────────────────────────────────────
// Created once at module load — safe to use inside any useQuery queryFn.
// Never recreated on re-render, so query keys stay stable.
export const kittyPublicClient = createPublicClient({
  chain: kittyConfig.chain,
  transport: http(kittyConfig.rpcUrl),
})

const contract = {
  address: kittyConfig.contractAddress,
  abi: KITTY_ABI,
  chainId: kittyConfig.chain.id,
} as const

// ── Contract globals ──────────────────────────────────────────────────────────

export function usePotCount() {
  return useReadContract({ ...contract, functionName: 'potCount' })
}

// ── Per-pot reads ─────────────────────────────────────────────────────────────

export function usePot(potId: bigint | undefined) {
  return useReadContract({
    ...contract,
    functionName: 'getPot',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: potId !== undefined },
  })
}

export function usePotValue(potId: bigint | undefined) {
  return useReadContract({
    ...contract,
    functionName: 'potValue',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: potId !== undefined },
  })
}

export function useYieldEarned(potId: bigint | undefined) {
  return useReadContract({
    ...contract,
    functionName: 'yieldEarned',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: potId !== undefined },
  })
}

export function useMembers(potId: bigint | undefined) {
  return useReadContract({
    ...contract,
    functionName: 'getMembers',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: potId !== undefined },
  })
}

export function useProposalsOf(potId: bigint | undefined) {
  return useReadContract({
    ...contract,
    functionName: 'proposalsOf',
    args: potId !== undefined ? [potId] : undefined,
    query: { enabled: potId !== undefined },
  })
}

export function useProposal(potId: bigint | undefined, proposalId: bigint | undefined) {
  return useReadContract({
    ...contract,
    functionName: 'getProposal',
    args:
      potId !== undefined && proposalId !== undefined ? [potId, proposalId] : undefined,
    query: { enabled: potId !== undefined && proposalId !== undefined },
  })
}

export function usePotsOf(address: `0x${string}` | undefined) {
  return useReadContract({
    ...contract,
    functionName: 'potsOf',
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  })
}

export function useAllowanceOf(potId: bigint | undefined, member: `0x${string}` | undefined) {
  return useReadContract({
    ...contract,
    functionName: 'allowanceOf',
    args:
      potId !== undefined && member ? [potId, member] : undefined,
    query: { enabled: potId !== undefined && Boolean(member) },
  })
}

// ── USDC balance + allowance ──────────────────────────────────────────────────

export function useUsdcBalance(address: `0x${string}` | undefined) {
  return useReadContract({
    address: kittyConfig.usdcAddress,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: kittyConfig.chain.id,
    query: { enabled: Boolean(address) },
  })
}

export function useUsdcAllowance(owner: `0x${string}` | undefined) {
  return useReadContract({
    address: kittyConfig.usdcAddress,
    abi: erc20Abi,
    functionName: 'allowance',
    args: owner ? [owner, kittyConfig.contractAddress] : undefined,
    chainId: kittyConfig.chain.id,
    query: { enabled: Boolean(owner) },
  })
}

// ── Vault metadata ────────────────────────────────────────────────────────────

export function useVaultTotalAssets(vaultAddress: `0x${string}` | undefined) {
  return useQuery<bigint | null>({
    queryKey: ['vaultTotalAssets', vaultAddress ?? '', kittyConfig.chain.id],
    queryFn: async () => {
      if (!vaultAddress) return null
      return await kittyPublicClient.readContract({
        address: vaultAddress,
        abi: ERC4626_ABI,
        functionName: 'totalAssets',
      })
    },
    enabled: Boolean(vaultAddress),
    staleTime: 2 * 60_000,
  })
}

// ── Vault APY ─────────────────────────────────────────────────────────────────

/**
 * Estimate vault APY from share-price drift.
 *
 * 1. Read the current block number and its timestamp.
 * 2. Read the block from ~5 minutes ago (300 blocks) to measure actual
 *    blocks-per-second, then extrapolate to find the block that was
 *    mined ~7 days ago.
 * 3. Call convertToAssets(1e6) at the current block and at the 7-days-ago
 *    block to get share prices.
 * 4. Annualise: APY ≈ (priceNow / priceThen - 1) × (365 / periodDays).
 *
 * Falls back to null (shows "—") if the 7-days-ago block is 0 (chain is
 * younger than 7 days) or any RPC call fails.
 */
export function useVaultApy(vaultAddress: `0x${string}` | undefined) {
  return useQuery<number | null>({
    queryKey: ['vaultApy', vaultAddress ?? '', kittyConfig.chain.id],
    queryFn: async () => {
      if (!vaultAddress) return null
      try {
        // Step 0: read vault share decimals so ONE_SHARE is always correct.
        // Morpho v2 vaults (Galaxy, Keyrock) use 18-decimal shares;
        // the testnet EarnKit vault uses 6-decimal shares.
        // convertToAssets(1 share) returns a USDC amount (6 decimals) in both cases.
        const vaultDecimals = await kittyPublicClient.readContract({
          address: vaultAddress,
          abi: ERC4626_ABI,
          functionName: 'decimals',
        })
        const ONE_SHARE = 10n ** BigInt(vaultDecimals)

        // Step 1: current block + timestamp
        const latestBlock = await kittyPublicClient.getBlock({ blockTag: 'latest' })
        const latestNumber = latestBlock.number
        const latestTs = latestBlock.timestamp // seconds

        // Step 2: block ~5 minutes ago to measure chain speed.
        // Clamp only against genesis (block 1) — never against deployBlock,
        // which is the KittyPots deploy block and unrelated to the vault's age.
        const PROBE_BACK = 300n // ~5 min if 1 block/s
        const probeNumber = latestNumber > PROBE_BACK ? latestNumber - PROBE_BACK : 1n

        const probeBlock = await kittyPublicClient.getBlock({ blockNumber: probeNumber })
        const probeTs = probeBlock.timestamp

        const blocksDiff = Number(latestNumber - probeNumber)
        const secsDiff = Number(latestTs - probeTs)

        // blocks per second, floored at 0.01 to avoid divide-by-zero
        const blocksPerSec = secsDiff > 0 && blocksDiff > 0
          ? blocksDiff / secsDiff
          : 1.0 // fallback: assume 1 block/s

        const sevenDaySecs = 7 * 24 * 3600
        const sevenDayBlocks = BigInt(Math.round(blocksPerSec * sevenDaySecs))

        const oldNumber = latestNumber > sevenDayBlocks
          ? latestNumber - sevenDayBlocks
          : 0n

        // Guard against genesis: if the chain itself is < 7 days old, show "—".
        // deployBlock is irrelevant here — the vault predates KittyPots on mainnet.
        if (oldNumber === 0n) return null

        // Step 3: convertToAssets(ONE_SHARE) at latest and at oldNumber.
        // ONE_SHARE is 10**vaultDecimals, so the result is in USDC (6 decimals).
        // The ratio priceNow/priceThen is dimensionless and correct regardless
        // of whether shares are 6- or 18-decimal.
        const [priceNow, priceThen] = await Promise.all([
          kittyPublicClient.readContract({
            address: vaultAddress,
            abi: ERC4626_ABI,
            functionName: 'convertToAssets',
            args: [ONE_SHARE],
          }),
          kittyPublicClient.readContract({
            address: vaultAddress,
            abi: ERC4626_ABI,
            functionName: 'convertToAssets',
            args: [ONE_SHARE],
            blockNumber: oldNumber,
          }),
        ])

        const now = Number(priceNow)
        const then = Number(priceThen)
        if (then === 0 || now <= then) return 0

        // Step 4: annualise — get actual period in days from block timestamps
        const oldBlock = await kittyPublicClient.getBlock({ blockNumber: oldNumber })
        const actualPeriodDays = Number(latestTs - oldBlock.timestamp) / 86400
        if (actualPeriodDays <= 0) return null

        return ((now / then) - 1) * (365 / actualPeriodDays)
      } catch {
        return null
      }
    },
    enabled: Boolean(vaultAddress),
    staleTime: 5 * 60_000,
  })
}

// ── Activity feed — chunked getLogs ──────────────────────────────────────────

/**
 * Chunked getLogs for a pot's activity feed.
 * Uses kittyPublicClient (not usePublicClient) to avoid the wagmi chain
 * inference problem. Fetches 2000 blocks at a time from deployBlock to latest.
 */
const CHUNK_SIZE = 2000n

export function useActivityLogs(potId: bigint | undefined) {
  return useQuery<Array<{ type: string; hash: string }>>({
    queryKey: ['activity', potId?.toString() ?? '', kittyConfig.contractAddress],
    queryFn: async () => {
      if (potId === undefined) return []
      try {
        const latest = await kittyPublicClient.getBlockNumber()
        const from = kittyConfig.deployBlock
        const results: Array<{ type: string; hash: string }> = []

        for (let start = from; start <= latest; start += CHUNK_SIZE) {
          const end = start + CHUNK_SIZE - 1n > latest ? latest : start + CHUNK_SIZE - 1n
          const logs = await kittyPublicClient.getLogs({
            address: kittyConfig.contractAddress,
            fromBlock: start,
            toBlock: end,
          })
          for (const l of logs) {
            if (l.topics[1] && BigInt(l.topics[1]) === potId) {
              results.push({
                type: l.topics[0]?.slice(0, 10) ?? 'event',
                hash: l.transactionHash ?? '',
              })
            }
          }
        }

        return results.slice(-30).reverse()
      } catch {
        return []
      }
    },
    enabled: potId !== undefined,
    staleTime: 60_000,
  })
}

// ── Home page aggregates ──────────────────────────────────────────────────────

/**
 * Read potValue and yieldEarned for all pots in one batch,
 * returning { totalInPots, totalYield } in raw bigint USDC units.
 */
export function useGlobalStats(potCount: bigint | undefined) {
  const count = Number(potCount ?? 0)
  const potIds = Array.from({ length: count }, (_, i) => BigInt(i))

  const valContracts = potIds.map(id => ({
    address: kittyConfig.contractAddress,
    abi: KITTY_ABI,
    functionName: 'potValue' as const,
    args: [id] as const,
    chainId: kittyConfig.chain.id,
  }))
  const yieldContracts = potIds.map(id => ({
    address: kittyConfig.contractAddress,
    abi: KITTY_ABI,
    functionName: 'yieldEarned' as const,
    args: [id] as const,
    chainId: kittyConfig.chain.id,
  }))

  const { data: valData } = useReadContracts({
    contracts: valContracts,
    query: { enabled: count > 0 },
  })
  const { data: yieldData } = useReadContracts({
    contracts: yieldContracts,
    query: { enabled: count > 0 },
  })

  const totalInPots = valData
    ? valData.reduce((acc, r) => acc + (typeof r.result === 'bigint' ? r.result : 0n), 0n)
    : 0n
  const totalYield = yieldData
    ? yieldData.reduce((acc, r) => acc + (typeof r.result === 'bigint' ? r.result : 0n), 0n)
    : 0n

  return { totalInPots, totalYield }
}
