// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {KittyPotsBase, MockBadVault} from "./KittyPots.Base.t.sol";
import {KittyPots} from "../KittyPots.sol";

contract KittyPotsCreateTest is KittyPotsBase {

    // ── createPot ────────────────────────────────────────────────────────────

    function test_createPot_basic() public {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        uint256 potId = kp.createPot("Family Fund", members, 2, address(0));

        (
            string memory name,
            address creator,
            address v,
            ,
            ,
            uint8 threshold,
            uint8 memberCount,
            ,
            ,
        ) = kp.getPot(potId);

        assertEq(name, "Family Fund");
        assertEq(creator, address(this));
        assertEq(v, address(0));
        assertEq(threshold, 2);
        assertEq(memberCount, 3); // creator + alice + bob
    }

    function test_createPot_deduplicate() public {
        address[] memory members = new address[](4);
        members[0] = alice;
        members[1] = alice; // duplicate
        members[2] = bob;
        members[3] = bob;   // duplicate
        kp.createPot("Dedup", members, 2, address(0));

        (,,,,, , uint8 memberCount,,,) = kp.getPot(0);
        assertEq(memberCount, 3); // creator + alice + bob
    }

    function test_createPot_thresholdZero_reverts() public {
        address[] memory members = new address[](1);
        members[0] = alice;
        vm.expectRevert("KittyPots: bad threshold");
        kp.createPot("T0", members, 0, address(0));
    }

    function test_createPot_thresholdAboveMemberCount_reverts() public {
        address[] memory members = new address[](1);
        members[0] = alice;
        // 2 members (creator + alice), threshold=3
        vm.expectRevert("KittyPots: bad threshold");
        kp.createPot("Thi", members, 3, address(0));
    }

    function test_createPot_wrongVaultAsset_reverts() public {
        // Create a vault whose asset() returns a dummy address (not usdc)
        MockBadVault badVault = new MockBadVault(makeAddr("notUsdc"));
        address[] memory members = new address[](0);
        vm.expectRevert("KittyPots: vault asset != usdc");
        kp.createPot("BadVault", members, 1, address(badVault));
    }

    function test_createPot_vaultZeroAllowed() public {
        address[] memory members = new address[](0);
        uint256 potId = kp.createPot("NoVault", members, 1, address(0));
        (,, address v,,,,,,, ) = kp.getPot(potId);
        assertEq(v, address(0));
    }

    function test_createPot_maxMembers() public {
        // 20 additional unique addresses would give 21 total (creator + 20),
        // which exceeds MAX_MEMBERS (20). The contract reverts on the 20th additional member.
        address[] memory members = new address[](20);
        for (uint256 i = 0; i < 20; i++) {
            // forge-lint: disable-next-line(unsafe-typecast)
            members[i] = address(uint160(0xDEAD0000 + i));
        }
        vm.expectRevert("KittyPots: max members");
        kp.createPot("MaxPot", members, 1, address(0));
    }

    function test_createPot_exactlyMaxMembers() public {
        // 19 additional addresses gives exactly 20 total (creator + 19). Should succeed.
        address[] memory members = new address[](19);
        for (uint256 i = 0; i < 19; i++) {
            // forge-lint: disable-next-line(unsafe-typecast)
            members[i] = address(uint160(0xBEEF0000 + i));
        }
        uint256 potId = kp.createPot("MaxPot", members, 1, address(0));
        (,,,,,,uint8 memberCount,,,) = kp.getPot(potId);
        assertEq(memberCount, 20);
    }
}
