// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {KittyPots} from "../KittyPots.sol";

// ─────────────────────────────────────────────────────────────────────────────
// Mock helpers
// ─────────────────────────────────────────────────────────────────────────────

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract MockVault is ERC4626 {
    constructor(MockUSDC _asset) ERC4626(_asset) ERC20("Vault Shares", "vUSDC") {}
    function decimals() public pure override returns (uint8) { return 6; }
    /// Injects yield by minting USDC directly to this vault — raises share price.
    function injectYield(uint256 amount) external {
        MockUSDC(asset()).mint(address(this), amount);
    }
}

contract MockBadVault {
    function asset() external pure returns (address) { return address(0x1234); }
}

// ─────────────────────────────────────────────────────────────────────────────
// Invariant handler
// ─────────────────────────────────────────────────────────────────────────────

contract KittyPotsHandler is Test {
    KittyPots public kitty;
    MockUSDC  public usdc;
    MockVault public vault;
    uint256   public potA;
    uint256   public potB;
    address   public actor = makeAddr("actor");

    constructor(KittyPots _k, MockUSDC _u, MockVault _v, uint256 _pA, uint256 _pB) {
        kitty = _k; usdc = _u; vault = _v; potA = _pA; potB = _pB;
        usdc.mint(actor, 1_000_000e6);
        vm.prank(actor); usdc.approve(address(kitty), type(uint256).max);
    }

    function contributeA(uint96 amount) external {
        amount = uint96(bound(amount, 1e6, 10_000e6));
        usdc.mint(actor, amount);
        vm.prank(actor); kitty.contribute(potA, amount);
    }

    function contributeB(uint96 amount) external {
        amount = uint96(bound(amount, 1e6, 10_000e6));
        usdc.mint(actor, amount);
        vm.prank(actor); kitty.contribute(potB, amount);
    }

    function payoutA(uint96 amount) external {
        uint256 pv = kitty.potValue(potA);
        if (pv == 0) return;
        amount = uint96(bound(amount, 1, pv));
        vm.prank(actor);
        kitty.propose(potA, KittyPots.Kind.Payout, actor, amount, 0, 0, "");
    }

    function payoutB(uint96 amount) external {
        uint256 pv = kitty.potValue(potB);
        if (pv == 0) return;
        amount = uint96(bound(amount, 1, pv));
        vm.prank(actor);
        kitty.propose(potB, KittyPots.Kind.Payout, actor, amount, 0, 0, "");
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Invariant test contract
// ─────────────────────────────────────────────────────────────────────────────

contract KittyPotsInvariantTest is Test {
    KittyPots        public kitty;
    MockUSDC         public usdc;
    MockVault        public vault;
    KittyPotsHandler public handler;
    uint256          public potA;
    uint256          public potB;

    function setUp() public {
        usdc  = new MockUSDC();
        vault = new MockVault(usdc);
        kitty = new KittyPots(address(usdc));

        address actor = makeAddr("actor");
        usdc.mint(actor, 1_000_000e6);
        vm.prank(actor); usdc.approve(address(kitty), type(uint256).max);

        address[] memory noMembers = new address[](0);
        vm.prank(actor);
        potA = kitty.createPot("A", noMembers, 1, address(vault));

        vm.prank(actor);
        potB = kitty.createPot("B", noMembers, 1, address(0));

        handler = new KittyPotsHandler(kitty, usdc, vault, potA, potB);
        targetContract(address(handler));
    }

    /// Sum of all per-pot shares must equal vault's total balance of KittyPots.
    function invariant_sharesBalance() public view {
        (, , , uint256 sharesA, , , , , , ) = kitty.getPot(potA);
        (, , , uint256 sharesB, , , , , , ) = kitty.getPot(potB);
        assertEq(sharesA + sharesB, vault.balanceOf(address(kitty)));
    }

    /// Sum of idle across all pots must equal USDC balance held directly by KittyPots.
    function invariant_idleBalance() public view {
        (, , , , uint256 idleA, , , , , ) = kitty.getPot(potA);
        (, , , , uint256 idleB, , , , , ) = kitty.getPot(potB);
        assertEq(idleA + idleB, usdc.balanceOf(address(kitty)));
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main unit test contract
// ─────────────────────────────────────────────────────────────────────────────

contract KittyPotsTest is Test {
    KittyPots internal kitty;
    MockUSDC  internal usdc;
    MockVault internal vault;

    address internal alice = makeAddr("alice");
    address internal bob   = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal dave  = makeAddr("dave");
    address internal eve   = makeAddr("eve"); // non-member

    uint256 internal constant ONE_USDC = 1e6;

    // ── setUp ──────────────────────────────────────────────────────────────

    function setUp() public {
        usdc  = new MockUSDC();
        vault = new MockVault(usdc);
        kitty = new KittyPots(address(usdc));

        usdc.mint(alice, 1_000_000e6);
        usdc.mint(bob,   1_000_000e6);
        usdc.mint(carol, 1_000_000e6);
        usdc.mint(dave,  1_000_000e6);
        usdc.mint(eve,   1_000_000e6);

        vm.prank(alice); usdc.approve(address(kitty), type(uint256).max);
        vm.prank(bob);   usdc.approve(address(kitty), type(uint256).max);
        vm.prank(carol); usdc.approve(address(kitty), type(uint256).max);
        vm.prank(dave);  usdc.approve(address(kitty), type(uint256).max);
        vm.prank(eve);   usdc.approve(address(kitty), type(uint256).max);
    }

    // ── Internal helpers ───────────────────────────────────────────────────

    /// 3-member pot: alice (creator) + bob + carol, threshold 2, no vault.
    function _createPot3() internal returns (uint256 potId) {
        address[] memory members = new address[](2);
        members[0] = bob;
        members[1] = carol;
        vm.prank(alice);
        potId = kitty.createPot("FamPot", members, 2, address(0));
    }

    /// Single-member pot for alice, threshold 1, with vault.
    function _createVaultPot() internal returns (uint256 potId) {
        address[] memory members = new address[](0);
        vm.prank(alice);
        potId = kitty.createPot("YieldPot", members, 1, address(vault));
    }

    /// Single-member pot for alice, threshold 1, no vault.
    function _createIdlePot() internal returns (uint256 potId) {
        address[] memory members = new address[](0);
        vm.prank(alice);
        potId = kitty.createPot("IdlePot", members, 1, address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GROUP 1 — createPot validation
    // ═══════════════════════════════════════════════════════════════════════

    function test_createPot_basic() public {
        uint256 id = _createPot3();
        assertEq(id, 0);
        assertEq(kitty.potCount(), 1);

        (
            string memory name,
            address creator,
            address vaultAddr,
            ,
            ,
            uint8 threshold,
            uint8 memberCount,
            ,
            ,
        ) = kitty.getPot(id);

        assertEq(name, "FamPot");
        assertEq(creator, alice);
        assertEq(vaultAddr, address(0));
        assertEq(threshold, 2);
        assertEq(memberCount, 3); // alice + bob + carol
    }

    function test_createPot_deduplicate() public {
        // Pass alice again in the extra-members list — should be silently skipped.
        address[] memory members = new address[](2);
        members[0] = alice; // duplicate of creator
        members[1] = bob;
        vm.prank(alice);
        uint256 id = kitty.createPot("Dedup", members, 1, address(0));

        (, , , , , , uint8 memberCount, , , ) = kitty.getPot(id);
        assertEq(memberCount, 2); // alice + bob only
    }

    function test_createPot_thresholdZero_reverts() public {
        address[] memory members = new address[](1);
        members[0] = bob;
        vm.prank(alice);
        vm.expectRevert("KittyPots: bad threshold");
        kitty.createPot("T0", members, 0, address(0));
    }

    function test_createPot_thresholdTooHigh_reverts() public {
        address[] memory members = new address[](1);
        members[0] = bob;
        // 2 members total; threshold 3 is too high.
        vm.prank(alice);
        vm.expectRevert("KittyPots: bad threshold");
        kitty.createPot("TH", members, 3, address(0));
    }

    function test_createPot_wrongVaultAsset_reverts() public {
        address[] memory members = new address[](0);
        MockBadVault badVault = new MockBadVault();
        vm.prank(alice);
        vm.expectRevert("KittyPots: vault asset != usdc");
        kitty.createPot("BadV", members, 1, address(badVault));
    }

    function test_createPot_vaultZeroAllowed() public {
        uint256 id = _createIdlePot();
        (, , address vaultAddr, , , , , , , ) = kitty.getPot(id);
        assertEq(vaultAddr, address(0));
    }

    function test_createPot_maxMembersCapped() public {
        // Build an array of MAX_MEMBERS (20) extra members → total would be 21, should revert.
        address[] memory members = new address[](20);
        for (uint256 i = 0; i < 20; i++) {
            members[i] = address(uint160(0x1000 + i));
        }
        // alice is already the creator (member 1), so adding 20 more = 21 total → reverts.
        vm.prank(alice);
        vm.expectRevert("KittyPots: max members");
        kitty.createPot("MaxM", members, 1, address(0));
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GROUP 2 — contribute
    // ═══════════════════════════════════════════════════════════════════════

    function test_contribute_depositsIntoVault() public {
        uint256 id = _createVaultPot();
        uint256 depositAmt = 100e6;

        vm.prank(alice);
        kitty.contribute(id, depositAmt);

        (, , , uint256 shares, uint256 idle, , , , , ) = kitty.getPot(id);
        assertGt(shares, 0);
        assertEq(idle, 0);
        // vault convertToAssets should return depositAmt (1:1 initially).
        assertEq(kitty.potValue(id), depositAmt);
    }

    function test_contribute_noVault() public {
        uint256 id = _createIdlePot();

        vm.prank(alice);
        kitty.contribute(id, 50e6);

        (, , , uint256 shares, uint256 idle, , , , , ) = kitty.getPot(id);
        assertEq(shares, 0);
        assertEq(idle, 50e6);
        assertEq(kitty.potValue(id), 50e6);
    }

    function test_contribute_anyoneCanGift() public {
        // eve is not a member; she can still contribute (contributes but streak not tracked).
        uint256 id = _createIdlePot();

        vm.prank(eve);
        kitty.contribute(id, 10e6);

        assertEq(kitty.potValue(id), 10e6);
    }

    function test_contribute_streakAt30Days() public {
        uint256 id = _createIdlePot();

        // First contribution — sets lastContributionAt, streak goes to 1.
        vm.prank(alice);
        kitty.contribute(id, ONE_USDC);

        // Warp exactly 30 days (within [25, 45] window).
        vm.warp(block.timestamp + 30 days);

        // Second contribution — streak should become 2.
        vm.prank(alice);
        kitty.contribute(id, ONE_USDC);

        KittyPots.MemberInfo[] memory infos = kitty.getMembers(id);
        uint32 streak;
        for (uint256 i = 0; i < infos.length; i++) {
            if (infos[i].addr == alice) { streak = infos[i].monthsStreak; break; }
        }
        assertEq(streak, 2);
    }

    function test_contribute_noStreakAt10Days() public {
        uint256 id = _createIdlePot();

        vm.prank(alice);
        kitty.contribute(id, ONE_USDC);

        // 10 days — less than STREAK_MIN (25 days), gap does nothing to streak.
        vm.warp(block.timestamp + 10 days);

        vm.prank(alice);
        kitty.contribute(id, ONE_USDC);

        KittyPots.MemberInfo[] memory infos = kitty.getMembers(id);
        uint32 streak;
        for (uint256 i = 0; i < infos.length; i++) {
            if (infos[i].addr == alice) { streak = infos[i].monthsStreak; break; }
        }
        // Gap < STREAK_MIN: no increment, no reset → stays at 1.
        assertEq(streak, 1);
    }

    function test_contribute_streakResetAt50Days() public {
        uint256 id = _createIdlePot();

        vm.prank(alice);
        kitty.contribute(id, ONE_USDC);

        // Get streak to 2 first.
        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        kitty.contribute(id, ONE_USDC);

        // Now wait 50 days (> STREAK_MAX = 45 days) → streak resets to 1.
        vm.warp(block.timestamp + 50 days);
        vm.prank(alice);
        kitty.contribute(id, ONE_USDC);

        KittyPots.MemberInfo[] memory infos = kitty.getMembers(id);
        uint32 streak;
        for (uint256 i = 0; i < infos.length; i++) {
            if (infos[i].addr == alice) { streak = infos[i].monthsStreak; break; }
        }
        assertEq(streak, 1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GROUP 3 — potValue and yieldEarned
    // ═══════════════════════════════════════════════════════════════════════

    function test_potValue_withVault() public {
        uint256 id = _createVaultPot();
        vm.prank(alice);
        kitty.contribute(id, 200e6);
        // 1:1 at deposit time → potValue == 200 USDC.
        assertEq(kitty.potValue(id), 200e6);
    }

    function test_potValue_noVault() public {
        uint256 id = _createIdlePot();
        vm.prank(alice);
        kitty.contribute(id, 333e6);
        assertEq(kitty.potValue(id), 333e6);
    }

    function test_yieldEarned_withSimulatedYield() public {
        uint256 id = _createVaultPot();
        vm.prank(alice);
        kitty.contribute(id, 100e6);

        // No yield yet.
        assertEq(kitty.yieldEarned(id), 0);

        // Inject 10 USDC yield → share price rises.
        vault.injectYield(10e6);

        // yieldEarned should be ~10 USDC (ERC-4626 convertToAssets rounds down by 1 wei).
        assertApproxEqAbs(kitty.yieldEarned(id), 10e6, 1);
    }

    function test_twoPots_noLeakage() public {
        // potA and potB both use the same vault.
        uint256 idA = _createVaultPot();

        address[] memory noM = new address[](0);
        vm.prank(alice);
        uint256 idB = kitty.createPot("PotB", noM, 1, address(vault));

        vm.prank(alice); kitty.contribute(idA, 100e6);
        vm.prank(alice); kitty.contribute(idB, 100e6);

        // Inject 10 USDC yield; it is shared proportionally (50/50 shares → 5 each).
        vault.injectYield(10e6);

        uint256 yA = kitty.yieldEarned(idA);
        uint256 yB = kitty.yieldEarned(idB);

        // Each pot should see ~5 USDC yield (within 1 wei rounding).
        assertApproxEqAbs(yA, 5e6, 1);
        assertApproxEqAbs(yB, 5e6, 1);

        // potValue isolation: A's value should not bleed into B's.
        assertApproxEqAbs(kitty.potValue(idA), 105e6, 1);
        assertApproxEqAbs(kitty.potValue(idB), 105e6, 1);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GROUP 4 — Payout proposals
    // ═══════════════════════════════════════════════════════════════════════

    function test_payout_fixedAmount_executesOnThreshold() public {
        uint256 id = _createIdlePot();
        vm.prank(alice); kitty.contribute(id, 100e6);

        uint256 aliceBefore = usdc.balanceOf(alice);

        // threshold=1: propose auto-executes.
        vm.prank(alice);
        kitty.propose(id, KittyPots.Kind.Payout, alice, 40e6, 0, 0, "pay");

        assertEq(usdc.balanceOf(alice) - aliceBefore, 40e6);
        assertEq(kitty.potValue(id), 60e6);
    }

    function test_payout_bps_executesOnThreshold() public {
        uint256 id = _createIdlePot();
        vm.prank(alice); kitty.contribute(id, 200e6);

        uint256 aliceBefore = usdc.balanceOf(alice);

        // 5000 bps = 50% of 200 = 100 USDC.
        vm.prank(alice);
        kitty.propose(id, KittyPots.Kind.Payout, alice, 0, 5000, 0, "half");

        assertEq(usdc.balanceOf(alice) - aliceBefore, 100e6);
    }

    function test_payout_belowThreshold_doesNotExecute() public {
        uint256 id = _createPot3(); // threshold=2
        vm.prank(alice); kitty.contribute(id, 100e6);

        uint256 aliceBefore = usdc.balanceOf(alice);

        // alice proposes (count=1 < threshold=2) → NOT executed yet.
        vm.prank(alice);
        uint256 propId = kitty.propose(id, KittyPots.Kind.Payout, alice, 50e6, 0, 0, "wait");

        // Nothing paid out.
        assertEq(usdc.balanceOf(alice), aliceBefore);

        // bob approves → count=2 >= threshold=2 → executes.
        vm.prank(bob);
        kitty.approve(id, propId);

        assertEq(usdc.balanceOf(alice) - aliceBefore, 50e6);
    }

    function test_payout_expiredProposal_reverts() public {
        uint256 id = _createPot3(); // threshold=2
        vm.prank(alice); kitty.contribute(id, 100e6);

        vm.prank(alice);
        uint256 propId = kitty.propose(id, KittyPots.Kind.Payout, alice, 10e6, 0, 0, "exp");

        // Warp past PROPOSAL_TTL (7 days).
        vm.warp(block.timestamp + 8 days);

        vm.prank(bob);
        vm.expectRevert("KittyPots: proposal expired");
        kitty.approve(id, propId);
    }

    function test_payout_doubleApprove_reverts() public {
        uint256 id = _createPot3(); // threshold=2
        vm.prank(alice); kitty.contribute(id, 100e6);

        vm.prank(alice);
        uint256 propId = kitty.propose(id, KittyPots.Kind.Payout, alice, 10e6, 0, 0, "dup");

        // alice tries to approve again.
        vm.prank(alice);
        vm.expectRevert("KittyPots: already approved");
        kitty.approve(id, propId);
    }

    function test_payout_nonMember_reverts() public {
        uint256 id = _createIdlePot();
        vm.prank(eve);
        vm.expectRevert("KittyPots: not member");
        kitty.propose(id, KittyPots.Kind.Payout, eve, 1e6, 0, 0, "hack");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GROUP 5 — Add / Remove member and threshold
    // ═══════════════════════════════════════════════════════════════════════

    function test_addMember_via_proposal() public {
        uint256 id = _createIdlePot(); // alice sole member, threshold=1

        vm.prank(alice);
        kitty.propose(id, KittyPots.Kind.AddMember, dave, 0, 0, 0, "add dave");

        (, , , , , , uint8 memberCount, , , ) = kitty.getPot(id);
        assertEq(memberCount, 2);

        // dave should now be a member.
        KittyPots.MemberInfo[] memory infos = kitty.getMembers(id);
        bool found;
        for (uint256 i = 0; i < infos.length; i++) {
            if (infos[i].addr == dave && infos[i].isMember) { found = true; break; }
        }
        assertTrue(found);
    }

    function test_removeMember_via_proposal() public {
        uint256 id = _createPot3(); // alice + bob + carol, threshold=2

        // alice proposes removal of carol.
        vm.prank(alice);
        uint256 propId = kitty.propose(id, KittyPots.Kind.RemoveMember, carol, 0, 0, 0, "remove carol");

        // bob approves → executes.
        vm.prank(bob);
        kitty.approve(id, propId);

        (, , , , , , uint8 memberCount, , , ) = kitty.getPot(id);
        assertEq(memberCount, 2);
    }

    function test_removeMember_thresholdClamps() public {
        uint256 id = _createPot3(); // alice + bob + carol, threshold=2

        // Raise threshold to 3 (2 approvals needed at current threshold=2).
        vm.prank(alice);
        uint256 p1 = kitty.propose(id, KittyPots.Kind.SetThreshold, alice, 3, 0, 0, "t=3");
        vm.prank(bob);
        kitty.approve(id, p1); // threshold is now 3

        // Remove carol — now needs 3 approvals (alice, bob, carol).
        vm.prank(alice);
        uint256 p2 = kitty.propose(id, KittyPots.Kind.RemoveMember, carol, 0, 0, 0, "rm carol");
        vm.prank(bob);
        kitty.approve(id, p2);
        vm.prank(carol);
        kitty.approve(id, p2); // 3rd approval → executes; memberCount 3→2, threshold clamps 3→2

        (, , , , , uint8 threshold, uint8 memberCount, , , ) = kitty.getPot(id);
        assertEq(memberCount, 2);
        assertLe(threshold, memberCount); // threshold was 3, must be clamped to 2
    }

    function test_removeMember_lastMember_reverts() public {
        uint256 id = _createIdlePot(); // alice sole member

        // Cannot propose removal of the last member.
        vm.prank(alice);
        vm.expectRevert("KittyPots: last member");
        kitty.propose(id, KittyPots.Kind.RemoveMember, alice, 0, 0, 0, "rm self");
    }

    function test_setThreshold_via_proposal() public {
        uint256 id = _createPot3(); // threshold=2

        vm.prank(alice);
        uint256 propId = kitty.propose(id, KittyPots.Kind.SetThreshold, alice, 3, 0, 0, "t=3");

        vm.prank(bob);
        kitty.approve(id, propId);

        (, , , , , uint8 threshold, , , , ) = kitty.getPot(id);
        assertEq(threshold, 3);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GROUP 6 — Allowance (spend)
    // ═══════════════════════════════════════════════════════════════════════

    /// Helper: create idle pot, fund it, and grant alice an allowance via proposal.
    function _setupAllowance(uint256 limit, uint64 period)
        internal
        returns (uint256 potId)
    {
        potId = _createIdlePot();
        vm.prank(alice); kitty.contribute(potId, 500e6);

        // SetAllowance: target=alice, amount=limit, period=period (seconds).
        vm.prank(alice);
        kitty.propose(potId, KittyPots.Kind.SetAllowance, alice, limit, 0, period, "grant");
    }

    function test_spend_withinLimit() public {
        uint256 id = _setupAllowance(100e6, 7 days);
        uint256 aliceBefore = usdc.balanceOf(alice);

        vm.prank(alice);
        kitty.spend(id, alice, 60e6, "coffee");

        assertEq(usdc.balanceOf(alice) - aliceBefore, 60e6);
        assertEq(kitty.potValue(id), 440e6);
    }

    function test_spend_overLimit_reverts() public {
        uint256 id = _setupAllowance(100e6, 7 days);

        vm.prank(alice);
        vm.expectRevert("KittyPots: allowance exceeded");
        kitty.spend(id, alice, 101e6, "over");
    }

    function test_spend_periodReset() public {
        uint256 id = _setupAllowance(100e6, 7 days);

        // Spend full limit.
        vm.prank(alice); kitty.spend(id, alice, 100e6, "full");

        // Another spend in same period should fail.
        vm.prank(alice);
        vm.expectRevert("KittyPots: allowance exceeded");
        kitty.spend(id, alice, 1, "extra");

        // Warp past the period.
        vm.warp(block.timestamp + 8 days);

        // Period reset → full limit available again.
        vm.prank(alice);
        kitty.spend(id, alice, 100e6, "next period");
    }

    function test_spend_revoke_stopsSpending() public {
        uint256 id = _setupAllowance(100e6, 7 days);

        // Revoke the allowance.
        vm.prank(alice);
        kitty.propose(id, KittyPots.Kind.RevokeAllowance, alice, 0, 0, 0, "revoke");

        // Attempt to spend after revocation.
        vm.prank(alice);
        vm.expectRevert("KittyPots: no allowance");
        kitty.spend(id, alice, 10e6, "blocked");
    }

    function test_spend_onlyHolder_reverts() public {
        uint256 id = _setupAllowance(100e6, 7 days);

        // bob is not a member of this pot (single-member alice pot).
        // spend() checks membership first, then allowance.
        vm.prank(bob);
        vm.expectRevert("KittyPots: not member");
        kitty.spend(id, bob, 10e6, "steal");
    }

    // ═══════════════════════════════════════════════════════════════════════
    // GROUP 7 — Fuzz: value conservation
    // ═══════════════════════════════════════════════════════════════════════

    function testFuzz_valueConservation(uint96 rawA, uint96 rawB) public {
        rawA = uint96(bound(rawA, 1e6, 500_000e6));
        rawB = uint96(bound(rawB, 1e6, 500_000e6));

        // Fresh vault pot for A.
        address[] memory noM = new address[](0);
        vm.prank(alice);
        uint256 idA = kitty.createPot("FuzzA", noM, 1, address(vault));

        // Fresh idle pot for B.
        vm.prank(alice);
        uint256 idB = kitty.createPot("FuzzB", noM, 1, address(0));

        // Fund alice sufficiently.
        usdc.mint(alice, uint256(rawA) + uint256(rawB));

        vm.prank(alice); kitty.contribute(idA, rawA);
        vm.prank(alice); kitty.contribute(idB, rawB);

        // Vault pot: value must be within 1 wei of rawA.
        assertGe(kitty.potValue(idA) + 1, rawA);

        // Idle pot: value is exact.
        assertEq(kitty.potValue(idB), rawB);

        // Propose 50% payout from vault pot (threshold=1 → auto-executes).
        uint256 valueBefore = kitty.potValue(idA);
        vm.prank(alice);
        kitty.propose(idA, KittyPots.Kind.Payout, alice, 0, 5000, 0, "50pct");

        uint256 valueAfter = kitty.potValue(idA);
        (, , , , , , , , uint256 totalPaidOut, ) = kitty.getPot(idA);

        // Conservation: valueAfter + totalPaidOut >= valueBefore - 2 (2 wei rounding budget)
        assertGe(valueAfter + totalPaidOut + 2, valueBefore);
    }
}
