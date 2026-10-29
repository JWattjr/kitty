// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {KittyPotsBase} from "./KittyPots.Base.t.sol";
import {KittyPots} from "../KittyPots.sol";

contract KittyPotsAllowanceTest is KittyPotsBase {

    /// 3-member pot (this, alice, bob), threshold 1 for easy testing.
    function _pot() internal returns (uint256) {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        return kp.createPot("AllowPot", members, 1, address(0));
    }

    /// Fund pot with 200 USDC and set allowance of 50 USDC / 7 days for alice.
    function _setupAllowance(uint256 potId) internal {
        _fund(address(this), 200 * ONE_USDC);
        kp.contribute(potId, 200 * ONE_USDC);
        // SetAllowance: target=alice, amount=50e6, period=7 days; threshold=1 → auto-executes
        kp.propose(potId, KittyPots.Kind.SetAllowance, alice, 50 * ONE_USDC, 0, 7 days, "");
    }

    // ── spend: within limit ───────────────────────────────────────────────────

    function test_spend_withinLimit() public {
        uint256 potId = _pot();
        _setupAllowance(potId);

        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(alice);
        kp.spend(potId, bob, 30 * ONE_USDC, "coffee");

        assertEq(usdc.balanceOf(bob) - bobBefore, 30 * ONE_USDC, "bob should receive 30 USDC");
    }

    // ── spend: over limit ─────────────────────────────────────────────────────

    function test_spend_overLimit_reverts() public {
        uint256 potId = _pot();
        _setupAllowance(potId);

        vm.prank(alice);
        vm.expectRevert("KittyPots: allowance exceeded");
        kp.spend(potId, bob, 60 * ONE_USDC, "too much");
    }

    // ── spend: period reset ───────────────────────────────────────────────────

    function test_spend_periodReset() public {
        uint256 potId = _pot();
        _setupAllowance(potId);

        // Spend the full limit
        vm.prank(alice);
        kp.spend(potId, bob, 50 * ONE_USDC, "first");

        // Try again — should fail
        vm.prank(alice);
        vm.expectRevert("KittyPots: allowance exceeded");
        kp.spend(potId, bob, 1 * ONE_USDC, "over");

        // Warp 7+ days → period resets
        skip(7 days + 1);
        uint256 bobBefore = usdc.balanceOf(bob);
        vm.prank(alice);
        kp.spend(potId, bob, 50 * ONE_USDC, "new period");
        assertEq(usdc.balanceOf(bob) - bobBefore, 50 * ONE_USDC, "should succeed after period reset");
    }

    // ── spend: revoke stops spending ──────────────────────────────────────────

    function test_spend_revoke_stopsSpending() public {
        uint256 potId = _pot();
        _setupAllowance(potId);

        // Revoke alice's allowance (threshold=1 → auto-executes)
        kp.propose(potId, KittyPots.Kind.RevokeAllowance, alice, 0, 0, 0, "");

        vm.prank(alice);
        vm.expectRevert("KittyPots: no allowance");
        kp.spend(potId, bob, 10 * ONE_USDC, "should fail");
    }

    // ── spend: only holder ────────────────────────────────────────────────────

    function test_spend_onlyHolder_reverts() public {
        uint256 potId = _pot();
        _setupAllowance(potId); // only alice has allowance

        // bob has no allowance
        vm.prank(bob);
        vm.expectRevert("KittyPots: no allowance");
        kp.spend(potId, alice, 10 * ONE_USDC, "no allow");
    }
}
