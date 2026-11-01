# Kitty — Arc Microgrants Round 2

## Three-sentence description

Kitty is a shared USDC pot for families, friends, and teams on Arc mainnet, combining group contributions, Circle Earn lending-vault yield, and member-approved payouts. Members choose a vault and an approval threshold, while the application includes public gift links and Circle Modular Wallets passkey sign-in. Built with Arc Studio, Kitty has a live mainnet pot and a verified 0.05 USDC contribution; allowance cards remain a prototype for future development, with no linked payment card.

## Project links

- Arc Studio: https://studio.arc.io/app/f06e651f-4948-42f3-8625-c7d494e78338
- Live app: https://kitty-blush-beta.vercel.app
- Funded demo pot: https://kitty-blush-beta.vercel.app/pot/0
- Public repository: https://github.com/JWattjr/kitty
- Video walkthrough: https://youtu.be/f_YdZ9BzzHo
- Public builder profile: https://github.com/JWattjr
- Submission destination: https://dorahacks.io/hackathon/arc-microgrants-2/detail

## Arc Studio build

The contracts and application were authored in Arc Studio, including Solidity contracts, Foundry tests, and the React/Vite frontend. Later mainnet read-path and RPC-handler repairs were authored in Arc Studio and imported using its CLI. The builder reports 71 Foundry tests, including fuzz and invariants, plus a max-preset review with two findings fixed before deployment; deployed bytecode was reported identical to the tested build.

## Contract and vault addresses

| Contract or vault | Network | Address / explorer |
|---|---|---|
| KittyPots | Arc mainnet, chain ID 5042 | [0xa1fc80ff783ec90f478912d1103af0e8a1c771b1](https://explorer.arc.io/address/0xa1fc80ff783ec90f478912d1103af0e8a1c771b1) |
| Galaxy USDC, Circle Earn / Morpho | Arc mainnet | [0x8E357432CC12ff425c36432F312968aEb16112AF](https://explorer.arc.io/address/0x8E357432CC12ff425c36432F312968aEb16112AF) |
| Keyrock Prime USDC, Circle Earn / Morpho | Arc mainnet | [0x5bEfAb92a5A3D60F578Cb51EEb4e4FD50a1e3123](https://explorer.arc.io/address/0x5bEfAb92a5A3D60F578Cb51EEb4e4FD50a1e3123) |
| KittyPots | Arc Testnet | [0xea0c6e150fa386800a109f6b80fd0b285320c634](https://explorer.testnet.arc.io/address/0xea0c6e150fa386800a109f6b80fd0b285320c634) |
| EarnKit USDC vault | Arc Testnet | [0xAAbbeF1D3971c710276ed41eC791BbE14CdB8E88](https://explorer.testnet.arc.io/address/0xAAbbeF1D3971c710276ed41eC791BbE14CdB8E88) |

USDC ERC-20 interface: `0x3600000000000000000000000000000000000000` (6 decimals).

## Mainnet transaction evidence

| Action | Evidence |
|---|---|
| Deploy KittyPots | [0xfadc9561a41925ebca189bbd20bbe9946606e6fcbcf07d9847b16d59125a0e87](https://explorer.arc.io/tx/0xfadc9561a41925ebca189bbd20bbe9946606e6fcbcf07d9847b16d59125a0e87), block 28454311 |
| Create College, pot 0 | [0x41174b665ecfb881dff80cfebdae89fb5818c9e66c96c754ec59f5a5095f8a41](https://explorer.arc.io/tx/0x41174b665ecfb881dff80cfebdae89fb5818c9e66c96c754ec59f5a5095f8a41), block 28841543 |
| Contribute into Galaxy USDC vault | [0x09c1ece982077f815633f70ee2579dec73cfe2389d001a7bdbbfa8ec336372e2](https://explorer.arc.io/tx/0x09c1ece982077f815633f70ee2579dec73cfe2389d001a7bdbbfa8ec336372e2), block 28988580 |
| Payout by vote | TODO — no mainnet payout performed or claimed for this submission |
| Allowance/card spend | TODO — no mainnet allowance spend performed or claimed; no payment card is linked |

The contribution receipt and contract state were independently read on 1 November 2026: receipt status `success`, recipient KittyPots, pot ID `0`, contribution `50000` USDC base units (`0.05 USDC`), and `49912278568311254` vault shares minted. College has two members and threshold two; the observed total paid out and proposal count were both zero. No additional funding or transactions are required for the evidence above.

## Product scope and next steps

The live evidence covers pot creation and a small contribution into the selected lending vault. Voting and fixed/percentage payouts are implemented contract/application features, with further user validation planned. Allowance-card controls are an early prototype; connecting a payment-card provider is future work. Passkey sign-in is available through Circle Modular Wallets; the evidenced contribution used an injected wallet.

Known UI limitation: changing an existing threshold is recorded in [HANDOFF.md](HANDOFF.md). The original vault-card `Loading…` issue was noted, and vault data loaded after the Studio-authored read-path repair. These statements do not claim a complete production security audit.

## Before the builder submits

- Confirm the description and video accurately reflect the demonstrated scope.
- Confirm the Arc Studio project, app, repository, video, contract, and contribution links are accessible to reviewers.
- Review any organizer contact fields and declarations personally.
- The builder reviews and presses the final DoraHacks submission button; preparing this document does not submit an application.
