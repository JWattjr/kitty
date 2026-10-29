// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {KittyPotsBase} from "./KittyPots.Base.t.sol";
import {KittyPots} from "../KittyPots.sol";

contract KittyPotsContributeTest is KittyPotsBase {

    // ── contribute ───────────────────────────────────────────────────────────

    function test_contribute_depositsIntoVault() public {
        uint256 potId = _createVaultPot();
        _fund(address(this), 100 * ONE_USDC);
        kp.contribute(potId, 100 * ONE_USDC);

        (,,, uint256 shares, uint256 idle,,,,,) = kp.getPot(potId);
        assertGt(shares, 0, "shares should be > 0");
        assertEq(idle, 0, "idle should be 0 when vault is set");
    }

    function test_contribute_noVault() public {
        uint256 potId = _createBasicPot();
        _fund(address(this), 100 * ONE_USDC);
        kp.contribute(potId, 100 * ONE_USDC);

        (,,, uint256 shares, uint256 idle,,,,,) = kp.getPot(potId);
        assertEq(shares, 0, "shares should be 0 with no vault");
        assertEq(idle, 100 * ONE_USDC, "idle should equal contributed amount");
    }

    function test_contribute_anyoneCanGift() public {
        uint256 potId = _createBasicPot();
        // eve is NOT a member
        usdc.mint(eve, 50 * ONE_USDC);
        vm.prank(eve);
        usdc.approve(address(kp), 50 * ONE_USDC);
        vm.prank(eve);
        kp.contribute(potId, 50 * ONE_USDC);

        (,,,,,,,uint256 totalContributed,,) = kp.getPot(potId);
        assertEq(totalContributed, 50 * ONE_USDC, "total contributed should increase");

        // Eve has no streak because she is not a member
        KittyPots.MemberInfo[] memory infos = kp.getMembers(potId);
        for (uint256 i = 0; i < infos.length; i++) {
            if (infos[i].addr == eve) {
                assertEq(infos[i].monthsStreak, 0, "eve has no streak");
            }
        }
    }

    function test_contribute_streakAt30Days() public {
        uint256 potId = _createBasicPot(); // address(this) is creator = member
        _fund(address(this), 200 * ONE_USDC);

        // First contribution at t=0
        kp.contribute(potId, 100 * ONE_USDC);

        // Warp 30 days
        skip(30 days);
        kp.contribute(potId, 100 * ONE_USDC);

        KittyPots.MemberInfo[] memory infos = kp.getMembers(potId);
        uint32 streak;
        for (uint256 i = 0; i < infos.length; i++) {
            if (infos[i].addr == address(this)) streak = infos[i].monthsStreak;
        }
        assertEq(streak, 2, "streak should be 2 after 30-day gap");
    }

    function test_contribute_noStreakAt10Days() public {
        uint256 potId = _createBasicPot();
        _fund(address(this), 200 * ONE_USDC);

        kp.contribute(potId, 100 * ONE_USDC);
        skip(10 days); // < STREAK_MIN (25 days)
        kp.contribute(potId, 100 * ONE_USDC);

        KittyPots.MemberInfo[] memory infos = kp.getMembers(potId);
        uint32 streak;
        for (uint256 i = 0; i < infos.length; i++) {
            if (infos[i].addr == address(this)) streak = infos[i].monthsStreak;
        }
        assertEq(streak, 1, "streak should stay 1 when gap < 25 days");
    }

    function test_contribute_streakResetAt50Days() public {
        uint256 potId = _createBasicPot();
        _fund(address(this), 200 * ONE_USDC);

        kp.contribute(potId, 100 * ONE_USDC); // streak = 1
        skip(30 days);
        kp.contribute(potId, 100 * ONE_USDC); // streak = 2
        skip(50 days); // > STREAK_MAX (45 days) → reset
        _fund(address(this), 100 * ONE_USDC);
        kp.contribute(potId, 100 * ONE_USDC); // streak resets to 1

        KittyPots.MemberInfo[] memory infos = kp.getMembers(potId);
        uint32 streak;
        for (uint256 i = 0; i < infos.length; i++) {
            if (infos[i].addr == address(this)) streak = infos[i].monthsStreak;
        }
        assertEq(streak, 1, "streak should reset to 1 after > 45-day gap");
    }

    // ── potValue & yieldEarned ────────────────────────────────────────────────

    function test_potValue_withVault() public {
        uint256 potId = _createVaultPot();
        _fund(address(this), 100 * ONE_USDC);
        kp.contribute(potId, 100 * ONE_USDC);

        uint256 val = kp.potValue(potId);
        assertApproxEqAbs(val, 100 * ONE_USDC, 1, "vault pot value should be ~100 USDC");
    }

    function test_potValue_noVault() public {
        uint256 potId = _createBasicPot();
        _fund(address(this), 100 * ONE_USDC);
        kp.contribute(potId, 100 * ONE_USDC);

        assertEq(kp.potValue(potId), 100 * ONE_USDC, "idle pot value should be exactly 100 USDC");
    }

    function test_yieldEarned_withSimulatedYield() public {
        uint256 potId = _createVaultPot();
        _fund(address(this), 100 * ONE_USDC);
        kp.contribute(potId, 100 * ONE_USDC);

        // Inject 10 USDC yield directly into vault
        vault.injectYield(10 * ONE_USDC);

        uint256 earned = kp.yieldEarned(potId);
        assertApproxEqAbs(earned, 10 * ONE_USDC, 1, "yield earned should be ~10 USDC");
    }

    function test_twoPots_noLeakage() public {
        // Pot A: vault-backed
        uint256 potA = _createVaultPot();
        // Pot B: also vault-backed, same vault, no contributions
        address[] memory noMembers = new address[](0);
        uint256 potB = kp.createPot("PotB", noMembers, 1, address(vault));

        _fund(address(this), 100 * ONE_USDC);
        kp.contribute(potA, 100 * ONE_USDC);

        // Pot B has no shares → potValue = 0
        assertEq(kp.potValue(potB), 0, "pot B should have 0 value before any contribution");

        // Inject yield; only pot A benefits
        vault.injectYield(20 * ONE_USDC);

        assertApproxEqAbs(kp.potValue(potA), 120 * ONE_USDC, 1, "pot A should reflect yield");
        assertEq(kp.potValue(potB), 0, "pot B should still be 0 after yield injection");
    }
}
