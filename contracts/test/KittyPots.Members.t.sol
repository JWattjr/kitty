// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {KittyPotsBase} from "./KittyPots.Base.t.sol";
import {KittyPots} from "../KittyPots.sol";

contract KittyPotsMembersTest is KittyPotsBase {

    // ── helpers ───────────────────────────────────────────────────────────────

    /// Single-member pot (creator = address(this)), threshold 1.
    function _solo() internal returns (uint256) {
        address[] memory m = new address[](0);
        return kp.createPot("Solo", m, 1, address(0));
    }

    /// 3-member pot (this, alice, bob), threshold 2.
    function _trio() internal returns (uint256) {
        return _createBasicPot(); // threshold 2
    }

    // ── AddMember ─────────────────────────────────────────────────────────────

    function test_addMember_via_proposal() public {
        // Threshold 1, so propose auto-executes
        uint256 potId = _solo();
        kp.propose(potId, KittyPots.Kind.AddMember, dave, 0, 0, 0, "");

        KittyPots.MemberInfo[] memory infos = kp.getMembers(potId);
        bool found;
        for (uint256 i = 0; i < infos.length; i++) {
            if (infos[i].addr == dave && infos[i].isMember) found = true;
        }
        assertTrue(found, "dave should be a member after proposal");

        (,,,,,,uint8 mc,,,) = kp.getPot(potId);
        assertEq(mc, 2, "memberCount should be 2");
    }

    // ── RemoveMember ─────────────────────────────────────────────────────────

    function test_removeMember_via_proposal() public {
        uint256 potId = _trio(); // this, alice, bob — threshold 2

        // address(this) proposes removal of alice → 1 approval, need 2
        uint256 pid = kp.propose(potId, KittyPots.Kind.RemoveMember, alice, 0, 0, 0, "");

        // bob approves → executes
        vm.prank(bob);
        kp.approve(potId, pid);

        (,,,,,,uint8 mc,,,) = kp.getPot(potId);
        assertEq(mc, 2, "memberCount should be 2 after removal");

        KittyPots.MemberInfo[] memory infos = kp.getMembers(potId);
        for (uint256 i = 0; i < infos.length; i++) {
            if (infos[i].addr == alice) {
                assertFalse(infos[i].isMember, "alice should not be a member");
            }
        }
    }

    function test_removeMember_thresholdClamps() public {
        // 3 members, threshold 2. Remove one → memberCount = 2, threshold stays 2 (still valid).
        // Remove a second → memberCount = 1, threshold must clamp to 1.
        uint256 potId = _trio();

        // Remove alice (this proposes, bob approves)
        uint256 pid1 = kp.propose(potId, KittyPots.Kind.RemoveMember, alice, 0, 0, 0, "");
        vm.prank(bob);
        kp.approve(potId, pid1); // now: this + bob, threshold 2

        // Remove bob (this proposes, but bob is still a member so needs bob's approval)
        // Lower threshold to 1 first via SetThreshold proposal (this proposes, bob must approve)
        uint256 stPid = kp.propose(potId, KittyPots.Kind.SetThreshold, address(0), 1, 0, 0, "");
        vm.prank(bob);
        kp.approve(potId, stPid); // threshold is now 1

        // Now remove bob (threshold 1, auto-executes)
        kp.propose(potId, KittyPots.Kind.RemoveMember, bob, 0, 0, 0, "");

        (,,,,,uint8 th, uint8 mc,,,) = kp.getPot(potId);
        assertEq(mc, 1, "only 1 member left");
        assertEq(th, 1, "threshold clamped to 1");
    }

    function test_removeMember_lastMember_reverts() public {
        uint256 potId = _solo();
        // Can't propose removal of the last member
        vm.expectRevert("KittyPots: last member");
        kp.propose(potId, KittyPots.Kind.RemoveMember, address(this), 0, 0, 0, "");
    }

    // ── SetThreshold ─────────────────────────────────────────────────────────

    function test_setThreshold_via_proposal() public {
        uint256 potId = _trio(); // threshold = 2

        // Propose threshold=1 — 1 approval (alice), need 2; then bob approves
        vm.prank(alice);
        uint256 pid = kp.propose(potId, KittyPots.Kind.SetThreshold, address(0), 3, 0, 0, "");

        vm.prank(bob);
        kp.approve(potId, pid);

        (,,,,,uint8 th,,,,) = kp.getPot(potId);
        assertEq(th, 3, "threshold should be 3");
    }
}
