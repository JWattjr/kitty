# Kitty handoff — Arc Studio fix required

## Arc Studio CLI repair in progress, 31 October 2026

The owner explicitly authorized completing this repair through the Arc Studio CLI. All app changes were authored in the existing Arc Studio app `f06e651f-4948-42f3-8625-c7d494e78338`, session `kitty`, thread `2f0fbc90-10b9-40b8-bc28-e51a44a76663`, and imported verbatim with `arc-studio pull`. No protected application files were edited directly on this machine.

- Studio added the deployed canonical Multicall3 address to both Arc chain definitions and separated real not-found results from read failures with Retry controls.
- Independent production-build browser verification still failed with `HTTP request failed` / `Failed to fetch` against `https://rpc.mainnet.arc.io/`. This disproved the initial claim that Multicall3 configuration alone resolved the user's symptom. The underlying browser/network reason for direct fetch failure is not conclusively isolated; matched CORS headers were observed from terminal requests.
- Studio then authored `api/arc-rpc.ts`, a fixed-mainnet-upstream read-only proxy, its Vercel routing configuration, and concise user-facing error messages. Vercel Production and Preview now have the public override `VITE_KITTY_RPC_URL=/api/arc-rpc`, keeping reads on the app's own origin.
- Independent checks passed: the Studio mainnet-read regression; frontend production build after the first source change; actual proxy mainnet chain-ID response `5042`; proxy rejection of write methods (`403`) and GET (`405`); and OPTIONS (`204`).
- No contracts, contract addresses, membership, money, or mainnet transactions were changed or created during this repair. Live deployment/browser verification is still pending at this checkpoint.

## 31 October 2026: confirmed pots invisible in the live app

The production app at `https://kitty-blush-beta.vercel.app` does not display confirmed mainnet pots. Pause further pot creation and contributions until Arc Studio repairs and verifies the read path. No application or contract files were changed during this investigation.

Verified directly against `https://rpc.mainnet.arc.io`, chain ID `5042`, at block `28843291`:

- Contract `0xa1fc80ff783ec90f478912d1103af0e8a1c771b1` reports `potCount() = 2`.
- `potsOf(0x535dF2938c7596497600564B41d0E98a5Ea6b13b)` returns `[0, 1]`.
- `getPot(0)` returns the pot name `College`, creator `0x535dF2938c7596497600564B41d0E98a5Ea6b13b`, Galaxy USDC vault `0x8E357432CC12ff425c36432F312968aEb16112AF`, threshold `2`, member count `2`, and zero contributions at that block.
- The second member of pot 0 is `0xB1e216335d010B76d107C7EB185737f01bFA1732`.
- Pot 0 creation succeeded in block `28841543`: https://explorer.arc.io/tx/0x41174b665ecfb881dff80cfebdae89fb5818c9e66c96c754ec59f5a5095f8a41 . Actual gas fee: `0.0083916675 USDC`.
- Browser `/pots` is connected to the same creator (header `0x535d...b13b`) but displays `You're not in any pots yet.` The browser also shows a separate signed-in passkey account, `0x3c73...b730`; `PotsPage` reads the injected wallet through wagmi, and the injected creator address matches the successful chain query.
- Earlier, `/new` remained on `Creating pot...` after the transaction had succeeded.
- No app-originated errors were captured in the browser console during this check. This does not establish that contract queries succeeded: the pages do not surface query errors.
- The RPC accepted a POST with Origin `https://kitty-blush-beta.vercel.app`, returned chain ID `5042`, and supplied matching CORS headers; preflight returned `204` and allowed POST/content-type. A simple blanket RPC CORS denial was not reproduced.

Confirmed misleading error handling in Arc Studio source:

- `src/pages/PotsPage.tsx`: `usePotsOf(address)` only exposes `data` and `isLoading` to the page. Undefined data becomes `[]`, and a settled failed query falls through to the false empty-membership message.
- `src/pages/PotPage.tsx`: the `notFound` expression includes `potError`, so any failed `getPot` query is reported as a nonexistent pot.

Required Arc Studio investigation: inspect the actual query errors and receipt-polling errors in the deployed browser; fix the shared read/receipt path; distinguish RPC/query failures from empty results and nonexistent pots; verify `/pots` lists IDs 0 and 1 for the creator, `/pot/0` shows `College`, and new successful transactions clear the confirmation state. The underlying browser-query failure has not yet been isolated; do not claim that a specific transport, wallet extension, or library is proven responsible.

The active production deployment is `dpl_3AjqjBacZxJi8N6YkyqiGr3RT8w6` (`kitty-jdkvuqsxt-wattxs-projects.vercel.app`), READY, built from GitHub commit `46d85044e3624bf717cc23cc86b64950addc1943`. The owner corrected `VITE_CIRCLE_CLIENT_KEY` in Vercel Production; its mainnet Client Key format and matching listed Circle prefix were checked without printing or saving the credential, and the app was redeployed. No keys belong in this document.

The demo budget was reduced at the owner's request to two MetaMask accounts, target balance `0.25 USDC` each, with `0.05 USDC` contributions and a `0.01 USDC` card spend. Do not request extra wallets or repeat pot creation to work around the display problem.

Work stopped on 29 October 2026 under the instruction to document a bug in protected Arc Studio source and stop. No protected source files were edited.

## Blocking source bug: Set threshold proposal always reverts

- Source: `src/components/ProposalSheet.tsx:69-70`, `buildArgs()`, `case 3` (`SetThreshold`).
- The UI constructs `{ kind: 3, target: ZERO_ADDR, amount: 0n, bps: newThreshold, period: 0n, memo: memo }`.
- `contracts/KittyPots.sol:254-255` validates SetThreshold using `amount >= 1 && amount <= pot.memberCount`. Execution at lines 523-525 also reads `p.amount`.
- Consequently, submitting a threshold change through this UI sends zero as the threshold and reverts with `KittyPots: bad threshold` for every selection.
- Fix in Arc Studio: encode the selected integer threshold in `amount` (not USDC-scaled), and use zero for `bps`. Verify the generated transaction arguments and a successful threshold-change proposal/approval on a local test chain.
- This is a separate issue from the known vault-card `Loading…` display bug, which is not a blocker by itself.

## Completed setup

- Public repository: https://github.com/JWattjr/kitty
- Branch: `main`; initial commit: `46d85044e3624bf717cc23cc86b64950addc1943`.
- Added `.gitignore`, MIT `LICENSE`, and blank `.env.example` with the six requested variable names.
- Confirmed the existing `vercel.json` already supplies SPA fallback rewrites; left it unchanged.
- Vercel project: `kitty`, ID `prj_EMUMsyhAvutNgXTlUdh4HiSwDWxb`, team `wattxs-projects` (`team_4mmvifpyuNjvwkcbbJvmxNIc`), linked to `JWattjr/kitty`, production branch `main`.
- Framework: Vite. Install: `npm install --legacy-peer-deps`. Build: `npm run build`. Output: `dist`.
- Configured in Production and Preview: `VITE_KITTY_CHAIN=arc-mainnet`, `VITE_KITTY_ADDRESS=0xa1fc80ff783ec90f478912d1103af0e8a1c771b1`, `VITE_KITTY_DEPLOY_BLOCK=28454311`, `VITE_CIRCLE_CLIENT_URL=https://modular-sdk.circle.com/v1/rpc/w3s/buidl`.
- `VITE_CIRCLE_CLIENT_KEY` was intentionally left unset for the owner to add later.
- Started production Git deployment `dpl_7BKju26f7masxnCQPUo2CCNicDzt` from the initial commit. Last observed status: BUILDING. Deployment URL: https://kitty-fwqgvp5oe-wattxs-projects.vercel.app
- Vercel assigned project domain: https://kitty-blush-beta.vercel.app ; listed deployment aliases also include https://kitty-wattxs-projects.vercel.app . Availability and readiness have not been verified.
- Vercel linking created ignored `.vercel/` metadata and an ignored `.env.local` with a local Vercel OIDC credential. Neither was committed. Do not publish their contents.
- Added the requested public Anvil dev-key notice under the README tests section. The test integration file remains unchanged. This README addition and this handoff have not been committed or pushed because work stopped on the source bug.

## Remaining after the Arc Studio fix

1. Pull GitHub `main` before every push. Claude's fix will arrive as a GitHub commit on `main`; never overwrite Arc Studio code. The first push was to a newly created empty remote after fetching and confirming no remote `main` existed.
2. Review and commit the local documentation and `.gitignore` update from Vercel linking without including local credential files.
3. Extend the Arc Studio README with the full product, voting/threshold, prototype cards, fixed-per-pot lending vault, passkey, security, deployment-address, live-URL and `forge test` documentation from the user request. Preserve the original README content and the Anvil-key notice.
4. Create `SUBMISSION.md` with the Arc Studio project, verified live URL, contract addresses, transaction evidence TODOs, video TODO, builder-profile TODO and three-sentence description. Do not invent transaction hashes or submit a form.
5. Verify Vercel build success, exact environment scopes, `/`, `/new`, `/pots`, `/pot/0`, `/gift/0` on direct load and refresh, Arc mainnet display, both Galaxy USDC and Keyrock Prime USDC in the vault picker, and browser console errors. `Pot not found` on `/pot/0` is acceptable. Record the known vault-card `Loading…` issue without blocking on that issue alone. Ignore the known TypeScript error in `scripts/compass-deploy.ts`; do not edit it.
6. Commit, pull GitHub main, push, verify the final deployment, and return repository/live URLs. No Foundry tests or browser route verification have been run in this setup session.

## User-provided references

- Arc Studio: https://studio.arc.io/app/f06e651f-4948-42f3-8625-c7d494e78338
- Arc mainnet KittyPots: `0xa1fc80ff783ec90f478912d1103af0e8a1c771b1`; explorer: https://explorer.arc.io/address/0xa1fc80ff783ec90f478912d1103af0e8a1c771b1
- Mainnet deploy transaction: https://explorer.arc.io/tx/0xfadc9561a41925ebca189bbd20bbe9946606e6fcbcf07d9847b16d59125a0e87 ; block `28454311`. The owner reports bytecode verified identical to the tested build.
- Mainnet Circle Earn vaults: Galaxy USDC `0x8E357432CC12ff425c36432F312968aEb16112AF`; Keyrock Prime USDC `0x5bEfAb92a5A3D60F578Cb51EEb4e4FD50a1e3123`.
- Arc Testnet KittyPots: `0xea0c6e150fa386800a109f6b80fd0b285320c634`; EarnKit USDC vault: `0xAAbbeF1D3971c710276ed41eC791BbE14CdB8E88`.
- Owner-reported validation: 71 Foundry tests, including fuzz and invariants, and a max-preset audit with two findings fixed before deployment.
