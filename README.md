# Kitty

Shared USDC money pots for families, friends, and teams on Arc. Members chip in monthly, the pot earns yield via a Circle Earn vault (Morpho, ERC-4626), the group votes on payouts (wedding gifts, housewarmings, a percentage of the pot), and any member can receive an allowance "card" with a weekly or monthly spending limit that draws straight from the pot.

Built with [Arc Studio](https://studio.arc.io)

## Tech stack

- Smart contracts: Solidity 0.8.28, Foundry, OpenZeppelin 5.6.1
- Chain: Arc Testnet (Chain ID: 5042002) — USDC is the native gas token
- Token: USDC at `0x3600000000000000000000000000000000000000` (6 decimals, ERC-20 interface)
- Yield: ERC-4626 Morpho vaults (Circle Earn)
- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Wallet: injected (MetaMask/Rabby) + Circle Modular Wallets passkey via `@circle-fin/modular-wallets-core`
- Router: react-router-dom v7

## Deployed contract

| Contract  | Network     | Address |
|-----------|-------------|---------|
| KittyPots | Arc Testnet | `0xea0c6e150fa386800a109f6b80fd0b285320c634` |

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

test-integration/kitty-flow.ts uses Anvil's public default dev keys for a local chain only; never fund those addresses.

### Lint and typecheck

```bash
bun run check
```
