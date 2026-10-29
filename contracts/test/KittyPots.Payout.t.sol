// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {KittyPotsBase} from "./KittyPots.Base.t.sol";
import {KittyPots} from "../KittyPots.sol";

contract KittyPotsPayoutTest is KittyPotsBase {

    // ── helpers ──────────────────────────────────────────────────────────────

    /// 3-member pot (this, alice, bob), threshold 2, no vault, pre-funded with 100 USDC.
    function _setup3MemberPot() internal returns (uint256 potId) {
        potId = _createBasicPot(); // threshold 2, members: this, alice, bob
        _fund(address(this), 100 * ONE_USDC);
        kp.contribute(potId, 100 * ONE_USDC);
    }

    // ── Payout: fixed amount ──────────────────────────────────────────────────

    function test_payout_fixedAmount_executesOnThreshold() public {
        uint256 potId = _setup3MemberPot();

        uint256 bobBefore = usdc.balanceOf(bob);

        // Alice proposes payout of 50 USDC to bob (1 approval, threshold=2 → not yet executed)
        vm.prank(alice);
        uint256 pid = kp.propose(potId, KittyPots.Kind.Payout, bob, 50 * ONE_USDC, 0, 0, "");

        // Bob approves → 2nd approval, should execute
        vm.prank(bob);
        kp.approve(potId, pid);

        uint256 bobAfter = usdc.balanceOf(bob);
        assertEq(bobAfter - bobBefore, 50 * ONE_USDC, "bob should receive 50 USDC");

        (,,,,,,,, , bool executed, bool cancelled,) = kp.getProposal(potId, pid);
        assertTrue(executed, "proposal should be marked executed");
        assertFalse(cancelled);
    }

    // ── Payout: bps ──────────────────────────────────────────────────────────

    function test_payout_bps_executesOnThreshold() public {
        // Single-member pot, threshold 1 (auto-executes on propose)
        address[] memory noMembers = new address[](0);
        uint256 potId = kp.createPot("BpsPot", noMembers, 1, address(0));
        _fund(address(this), 100 * ONE_USDC);
        kp.contribute(potId, 100 * ONE_USDC);

        uint256 recipBefore = usdc.balanceOf(alice);

        // Propose payout of 50% (5000 bps) to alice — auto-executes (threshold=1)
        kp.propose(potId, KittyPots.Kind.Payout, alice, 0, 5000, 0, "");

        uint256 recipAfter = usdc.balanceOf(alice);
        assertApproxEqAbs(recipAfter - recipBefore, 50 * ONE_USDC, 1, "alice should receive ~50 USDC");
    }

    // ── Payout: below threshold ───────────────────────────────────────────────

    function test_payout_belowThreshold_doesNotExecute() public {
        uint256 potId = _setup3MemberPot();
        uint256 bobBefore = usdc.balanceOf(bob);

        // Alice proposes — only 1 of 2 approvals needed
        vm.prank(alice);
        kp.propose(potId, KittyPots.Kind.Payout, bob, 50 * ONE_USDC, 0, 0, "");

        assertEq(usdc.balanceOf(bob), bobBefore, "funds should not move below threshold");
    }

    // ── Payout: expired proposal ──────────────────────────────────────────────

    function test_payout_expiredProposal_reverts() public {
        uint256 potId = _setup3MemberPot();

        vm.prank(alice);
        uint256 pid = kp.propose(potId, KittyPots.Kind.Payout, bob, 50 * ONE_USDC, 0, 0, "");

        // Warp 8 days past TTL (7 days)
        skip(8 days);

        vm.prank(bob);
        vm.expectRevert("KittyPots: proposal expired");
        kp.approve(potId, pid);
    }

    // ── Payout: double approve ────────────────────────────────────────────────

    function test_payout_doubleApprove_reverts() public {
        uint256 potId = _setup3MemberPot();

        vm.prank(alice);
        uint256 pid = kp.propose(potId, KittyPots.Kind.Payout, bob, 50 * ONE_USDC, 0, 0, "");

        // Alice tries to approve again
        vm.prank(alice);
        vm.expectRevert("KittyPots: already approved");
        kp.approve(potId, pid);
    }

    // ── Payout: non-member tries to approve ──────────────────────────────────

    function test_payout_nonMember_reverts() public {
        uint256 potId = _setup3MemberPot();

        vm.prank(alice);
        uint256 pid = kp.propose(potId, KittyPots.Kind.Payout, bob, 50 * ONE_USDC, 0, 0, "");

        vm.prank(eve); // eve is not a member
        vm.expectRevert("KittyPots: not member");
        kp.approve(potId, pid);
    }
}
