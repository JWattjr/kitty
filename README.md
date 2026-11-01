# Kitty

Shared USDC money pots for families, friends, and teams on Arc. Members can chip in monthly or make one-off contributions, anyone can gift through a link, the pot can earn yield through a Circle Earn vault (Morpho, ERC-4626), and the group votes on payouts. Allowance cards are a prototype for future development: no payment card is linked, and there is no physical card integration.

Built with Arc Studio: [Kitty project](https://studio.arc.io/app/f06e651f-4948-42f3-8625-c7d494e78338).

**Live app:** [kitty-blush-beta.vercel.app](https://kitty-blush-beta.vercel.app) · **Demo:** [YouTube walkthrough](https://youtu.be/f_YdZ9BzzHo) · **Builder:** [JWattjr](https://github.com/JWattjr).

The live application uses Arc mainnet. The contracts and application were authored in Arc Studio; subsequent application repairs were authored there and imported with the Arc Studio CLI.

## How Kitty works

Create a pot, choose its members, set an approval threshold, and select its vault. Members contribute USDC, including fractional amounts, and non-members can use the public gift flow. Monthly contributions are voluntary transactions, not automatic bank debits.

A member can propose a fixed USDC payout or a percentage of the pot. The proposer's vote counts as the first approval; each member can approve once, and the contract executes when the approval count reaches the pot's current threshold. A threshold of two in a two-member pot requires both members. Proposals expire after seven days, and their proposer can cancel them before execution. The live demo verifies pot creation and a contribution; a voted payout has not yet been demonstrated on mainnet.

### Yield through Circle Earn

Galaxy USDC and Keyrock Prime USDC are Morpho lending vaults exposed through the ERC-4626 interface. Contributions to a vault-backed pot mint vault shares, and lending activity can increase the value of those shares. The vault is chosen at creation and is fixed for that pot. Yield is variable, and vault liquidity and lending risk affect redemption and value.

### Allowance cards: prototype

The prototype UI represents an allowance for a member, with a weekly or monthly limit and spending drawn from the pot. The contract includes vote-controlled allowance creation/revocation and a `spend` method that checks current membership, an active allowance, and the remaining period limit. These controls are not a connected merchant payment card. Card-provider integration and real card payments are future work; no card spend is claimed as mainnet demo evidence.

### Passkey sign-in

Circle Modular Wallets provides a passkey sign-in option using Face ID or a fingerprint, without requiring MetaMask for that sign-in. Injected wallets are also supported. The verified contribution used an injected wallet; a complete transaction flow through a passkey wallet is not claimed as verified here.

### Security model

There is no administrator role or administrator withdrawal path. Outgoing pot funds require a successful member proposal or a current member spending within an active allowance's limit. Per-pot accounting tracks each pot's idle USDC and vault shares, so one pot cannot withdraw another pot's allocation. Vault withdrawals debit the shares actually burned. The contract uses SafeERC20 and reentrancy protection around contribution and allowance-spend paths and does not expose arbitrary external-call proposals.

Known UI issue: changing an existing pot's threshold is documented in [HANDOFF.md](HANDOFF.md); the threshold selected when creating the demo pot is two. The previously reported vault-card `Loading…` issue was noted during development; vault balances and APYs loaded in the verified deployment after the Arc Studio read-path repair.

## Tech stack

- Smart contracts: Solidity 0.8.28, Foundry, OpenZeppelin 5.6.1
- Live chain: Arc mainnet (chain ID 5042); Arc Testnet (5042002) is also supported. USDC is the native gas token.
- Token: USDC at `0x3600000000000000000000000000000000000000` (6 decimals, ERC-20 interface)
- Yield: ERC-4626 Morpho vaults (Circle Earn)
- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Wallet: injected (MetaMask/Rabby) + Circle Modular Wallets passkey via `@circle-fin/modular-wallets-core`
- Router: react-router-dom v7

## Deployed contract

| Contract  | Network     | Address |
|-----------|-------------|---------|
| KittyPots | Arc mainnet | [`0xa1fc80ff783ec90f478912d1103af0e8a1c771b1`](https://explorer.arc.io/address/0xa1fc80ff783ec90f478912d1103af0e8a1c771b1) |
| KittyPots | Arc Testnet | `0xea0c6e150fa386800a109f6b80fd0b285320c634` |

Mainnet deployment: [transaction](https://explorer.arc.io/tx/0xfadc9561a41925ebca189bbd20bbe9946606e6fcbcf07d9847b16d59125a0e87), block `28454311`. The builder reports deployed bytecode identical to the tested build.

### Verified mainnet demo evidence

- [Create College, pot 0](https://explorer.arc.io/tx/0x41174b665ecfb881dff80cfebdae89fb5818c9e66c96c754ec59f5a5095f8a41).
- [Contribute 0.05 USDC into Galaxy USDC](https://explorer.arc.io/tx/0x09c1ece982077f815633f70ee2579dec73cfe2389d001a7bdbbfa8ec336372e2): successful at block `28988580`, with `Contributed` amount `50000` (6 decimals) and `49912278568311254` vault shares minted.
- [Open the funded pot](https://kitty-blush-beta.vercel.app/pot/0): College, two members, two approvals required.

See [SUBMISSION.md](SUBMISSION.md) for the submission links and remaining evidence TODOs.

## Circle Earn vaults (Morpho, ERC-4626, USDC asset — verified onchain)

| Vault | Network | Address |
|-------|---------|---------|
| EarnKit USDC Vault | Arc Testnet | `0xAAbbeF1D3971c710276ed41eC791BbE14CdB8E88` |
| Galaxy USDC | Arc Mainnet | `0x8E357432CC12ff425c36432F312968aEb16112AF` |
| Keyrock Prime USDC | Arc Mainnet | `0x5bEfAb92a5A3D60F578Cb51EEb4e4FD50a1e3123` |

## Development

### Prerequisites

- [Bun](https://bun.sh) >= 1.0
- [Foundry](https://getfoundry.sh)

### Install

```bash
bun install
```

### Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `VITE_KITTY_CHAIN` | No | `arc-testnet` (default) or `arc-mainnet` |
| `VITE_KITTY_ADDRESS` | Mainnet only | Deployed KittyPots contract address on mainnet |
| `VITE_KITTY_DEPLOY_BLOCK` | No | Block KittyPots was deployed (default: Arc Testnet block `69321420`) |
| `VITE_KITTY_RPC_URL` | No | Override Arc RPC endpoint |
| `VITE_CIRCLE_CLIENT_KEY` | No | Circle Modular Wallets Client Key (enables passkey sign-in). Get from Circle Console → Keys → Client Keys. |
| `VITE_CIRCLE_CLIENT_URL` | No | Fixed to `https://modular-sdk.circle.com/v1/rpc/w3s/buidl`. Pre-filled by Arc Studio — do not change. |

Copy `.env.example` to `.env` and fill in values. Passkey sign-in is hidden in the UI when `VITE_CIRCLE_CLIENT_KEY` is absent.

### Run the dev server

```bash
bun run dev
```

### Build and test contracts

```bash
bun run contracts:build   # forge build
bun run contracts:test    # forge test
```

Or run Foundry directly from the repository root:

```bash
forge test
```

The builder reports 71 Foundry tests, including fuzz and invariant tests, and a max-preset review with two findings fixed before deployment. This documentation update does not rerun that audit or claim independent certification.

test-integration/kitty-flow.ts uses Anvil's public default dev keys for a local chain only; never fund those addresses.

### Lint and typecheck

```bash
bun run check
```
