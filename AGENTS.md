# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

KittyPots: shared USDC money pots for families, friends, and teams on Arc. Members chip in, the pot earns yield via an ERC-4626 Morpho vault, and the group votes on payouts. Allowance "cards" let a member spend directly from the pot within a weekly or monthly limit.

## Deployed Contracts

| Contract   | Network      | Address                                      | Explorer |
|------------|-------------|----------------------------------------------|---------|
| KittyPots  | Arc Testnet | `0xea0c6e150fa386800a109f6b80fd0b285320c634` | https://explorer.testnet.arc.io/address/0xea0c6e150fa386800a109f6b80fd0b285320c634 |

Constructor arg: `usdc = 0x3600000000000000000000000000000000000000` (Arc USDC, 6 decimals)

## Circle Earn Vault Addresses (ERC-4626, USDC asset, Morpho-backed)

| Vault                   | Network        | Address                                      | Verified ERC-4626 asset() |
|-------------------------|---------------|----------------------------------------------|--------------------------|
| EarnKit USDC Vault      | Arc Testnet   | `0xAAbbeF1D3971c710276ed41eC791BbE14CdB8E88` | 0x3600...0000 (USDC) ✓  |
| Galaxy USDC (Morpho v2) | Arc Mainnet   | `0x8E357432CC12ff425c36432F312968aEb16112AF` | 0x3600...0000 (USDC) ✓  |
| Keyrock Prime USDC (Morpho v2) | Arc Mainnet | `0x5bEfAb92a5A3D60F578Cb51EEb4e4FD50a1e3123` | 0x3600...0000 (USDC) ✓ |

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.) + Circle Modular Wallets passkey (requires VITE_CIRCLE_CLIENT_KEY)
- Chain: Arc Testnet (Chain ID: 5042002, custom definition in `src/kitty/chains.ts`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Deploy block: 69321420 (Arc Testnet, default in config)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Router + page composition
- `src/kitty/config.ts` - Single source of truth: chain, USDC address, contract address, deploy block, earn vaults
- `src/kitty/hooks.ts` - All wagmi read hooks: usePot, usePotValue, useVaultApy, useActivityLogs, useGlobalStats, etc.
- `src/kitty/passkey-wallet.tsx` - Circle Modular Wallets passkey context + sendViaPasskey helper
- `src/components/PasskeyButton.tsx` - Passkey register/login/disconnect button in the nav
- `src/components/` - All UI components (Layout, ContributePanel, AllowanceCard, etc.)
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
