// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {KittyPotsBase} from "./KittyPots.Base.t.sol";
import {KittyPots} from "../KittyPots.sol";

contract KittyPotsFuzzTest is KittyPotsBase {

    /// @dev value conservation: potValue(A) + totalPaidOut(A) ≈ amount1 (within 1 wei/op rounding)
    ///      potValue(B) == amount2 exactly (no vault, no rounding)
    function testFuzz_valueConservation(
        uint96 amount1,
        uint96 amount2,
        uint96 payoutAmt
    ) external {
        amount1   = uint96(bound(amount1,   1e6, 1e9));
        amount2   = uint96(bound(amount2,   1e6, 1e9));

        // Pot A: vault-backed, threshold 1
        uint256 potA = _createVaultPot();
        // Pot B: no vault, threshold 1
        address[] memory noM = new address[](0);
        uint256 potB = kp.createPot("FuzzB", noM, 1, address(0));

        // Contribute to both
        _fund(address(this), uint256(amount1) + uint256(amount2));
        kp.contribute(potA, amount1);
        kp.contribute(potB, amount2);

        // Bound payout to at most potValue(A)
        uint256 pvA = kp.potValue(potA);
        payoutAmt = uint96(bound(payoutAmt, 0, pvA));

        uint256 totalPaidOutBefore;
        if (payoutAmt > 0) {
            // Propose payout from pot A to address(this) — threshold=1, auto-executes
            kp.propose(potA, KittyPots.Kind.Payout, address(this), payoutAmt, 0, 0, "");
            (,,,,,,,, uint256 tp,) = kp.getPot(potA);
            totalPaidOutBefore = tp;
        } else {
            (,,,,,,,, uint256 tp,) = kp.getPot(potA);
            totalPaidOutBefore = tp;
        }

        // potValue(A) + totalPaidOut(A) should equal amount1 within 1 wei of rounding
        uint256 remaining = kp.potValue(potA);
        // Allow 1 wei tolerance per vault round-trip operation
        assertApproxEqAbs(
            remaining + totalPaidOutBefore,
            uint256(amount1),
            2, // 1 wei tolerance per deposit + 1 per withdrawal
            "pot A: value + paidOut should == contributed"
        );

        // Pot B: exact conservation (no vault)
        assertEq(kp.potValue(potB), uint256(amount2), "pot B: exact value conservation");
    }
}
