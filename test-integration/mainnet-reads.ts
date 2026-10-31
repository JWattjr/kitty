/**
 * Regression test: Arc chain multicall3 registration and mainnet contract reads.
 *
 * Root cause of the browser read failures (Oct 2026):
 *   arcTestnet and arcMainnet were missing contracts.multicall3.
 *   wagmi createConfig defaults to batch: { multicall: true }, which makes viem
 *   look up chain.contracts.multicall3.address before every batched eth_call.
 *   Missing it throws ChainDoesNotSupportContract, silently failing every
 *   useReadContract call in the browser.
 *
 * This test verifies the fix is in place and that live mainnet reads succeed.
 *
 * Run: bun run test-integration/mainnet-reads.ts
 *   (requires network access to https://rpc.mainnet.arc.io)
 */

import { createPublicClient, http, getChainContractAddress } from 'viem'
import { arcTestnet, arcMainnet } from '../src/kitty/chains'

const KITTY_ABI = [
  { type: 'function', name: 'potCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' as const },
  { type: 'function', name: 'getPot', inputs: [{ name: 'potId', type: 'uint256' }], outputs: [
    { name: 'name', type: 'string' }, { name: 'creator', type: 'address' },
    { name: 'vault', type: 'address' }, { name: 'shares', type: 'uint256' },
    { name: 'idle', type: 'uint256' }, { name: 'threshold', type: 'uint8' },
    { name: 'memberCount', type: 'uint8' }, { name: 'totalContributed', type: 'uint256' },
    { name: 'totalPaidOut', type: 'uint256' }, { name: 'proposalCount', type: 'uint256' },
  ], stateMutability: 'view' as const },
  { type: 'function', name: 'potsOf', inputs: [{ name: 'member', type: 'address' }],
    outputs: [{ type: 'uint256[]' }], stateMutability: 'view' as const },
] as const

const KITTY_MAINNET = '0xa1fc80ff783ec90f478912d1103af0e8a1c771b1' as const
const CREATOR = '0x535dF2938c7596497600564B41d0E98a5Ea6b13b' as const
const GALAXY_VAULT = '0x8E357432CC12ff425c36432F312968aEb16112AF' as const
const MC3 = '0xcA11bde05977b3631167028862bE2a173976CA11' as const

function pass(msg: string) { console.log(`  PASS  ${msg}`) }
function fail(msg: string): never { throw new Error(`FAIL  ${msg}`) }

let failures = 0
function assert(cond: boolean, msg: string) {
  if (cond) { pass(msg) }
  else { console.error(`  FAIL  ${msg}`); failures++ }
}

async function run() {
  console.log('\n=== Arc chain multicall3 + mainnet read regression ===\n')

  // ── 1. Chain definitions have contracts.multicall3 ─────────────────────────
  console.log('[1] Chain definitions')

  assert(
    arcTestnet.contracts?.multicall3?.address?.toLowerCase() === MC3.toLowerCase(),
    `arcTestnet has contracts.multicall3 = ${arcTestnet.contracts?.multicall3?.address}`,
  )
  assert(
    arcMainnet.contracts?.multicall3?.address?.toLowerCase() === MC3.toLowerCase(),
    `arcMainnet has contracts.multicall3 = ${arcMainnet.contracts?.multicall3?.address}`,
  )

  // Verify getChainContractAddress no longer throws for these chains
  let testnetAddr: string | undefined
  let mainnetAddr: string | undefined
  try {
    testnetAddr = getChainContractAddress({ chain: arcTestnet, contract: 'multicall3' })
    mainnetAddr = getChainContractAddress({ chain: arcMainnet, contract: 'multicall3' })
  } catch (e) {
    fail(`getChainContractAddress threw: ${(e as Error).message}`)
  }
  assert(testnetAddr?.toLowerCase() === MC3.toLowerCase(), 'getChainContractAddress(arcTestnet, multicall3) returns canonical address')
  assert(mainnetAddr?.toLowerCase() === MC3.toLowerCase(), 'getChainContractAddress(arcMainnet, multicall3) returns canonical address')

  // ── 2. Live mainnet reads via createPublicClient (same as hooks.ts) ────────
  console.log('\n[2] Live mainnet reads via createPublicClient')

  const client = createPublicClient({
    chain: arcMainnet,
    transport: http('https://rpc.mainnet.arc.io'),
  })

  const potCount = await client.readContract({
    address: KITTY_MAINNET, abi: KITTY_ABI, functionName: 'potCount',
  })
  assert(potCount === 2n, `potCount = ${potCount} (expected 2)`)

  const potsOfCreator = await client.readContract({
    address: KITTY_MAINNET, abi: KITTY_ABI, functionName: 'potsOf',
    args: [CREATOR],
  }) as bigint[]
  assert(
    potsOfCreator.length === 2 && potsOfCreator[0] === 0n && potsOfCreator[1] === 1n,
    `potsOf(creator) = [${potsOfCreator}] (expected [0,1])`,
  )

  const pot0 = await client.readContract({
    address: KITTY_MAINNET, abi: KITTY_ABI, functionName: 'getPot', args: [0n],
  }) as readonly [string, string, string, ...unknown[]]
  const [pot0Name, pot0Creator, pot0Vault] = pot0
  assert(pot0Name === 'College', `getPot(0).name = "${pot0Name}" (expected "College")`)
  assert(pot0Creator.toLowerCase() === CREATOR.toLowerCase(), `getPot(0).creator = ${pot0Creator}`)
  assert(pot0Vault.toLowerCase() === GALAXY_VAULT.toLowerCase(), `getPot(0).vault = ${pot0Vault} (Galaxy)`)

  // ── 3. Verify multicall3 batching works on Arc mainnet ────────────────────
  console.log('\n[3] Multicall3 batch on Arc mainnet')

  // multicall sends both calls in one eth_call to the MC3 contract
  const [count, pots] = await client.multicall({
    contracts: [
      { address: KITTY_MAINNET, abi: KITTY_ABI, functionName: 'potCount' },
      { address: KITTY_MAINNET, abi: KITTY_ABI, functionName: 'potsOf', args: [CREATOR] },
    ],
  })
  assert(count.result === 2n, `multicall potCount = ${count.result}`)
  const potsArr = pots.result as bigint[] | undefined
  assert(
    potsArr?.length === 2 && potsArr[0] === 0n && potsArr[1] === 1n,
    `multicall potsOf(creator) = [${potsArr}]`,
  )

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('')
  if (failures > 0) {
    console.error(`=== ${failures} test(s) FAILED ===\n`)
    process.exit(1)
  } else {
    console.log('=== All tests PASSED ===\n')
  }
}

run().catch(e => { console.error('Uncaught:', e); process.exit(1) })
