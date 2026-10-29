// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {KittyPots} from "../KittyPots.sol";

// ─── Mocks ────────────────────────────────────────────────────────────────────

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

/// @dev Minimal ERC-4626 vault over MockUSDC. Shares are 1:1 initially.
///      simulateYield: caller donates extra USDC into vault (increases share price).
///      injectYield  : vault mints extra USDC to itself (no external funder needed).
contract MockVault is ERC4626 {
    MockUSDC private immutable _asset;

    constructor(MockUSDC asset_) ERC4626(asset_) ERC20("Vault Shares", "vUSDC") {
        _asset = asset_;
    }

    function decimals() public pure override returns (uint8) { return 6; }

    /// @notice Donate `extra` USDC from caller into the vault to push share price up.
    function simulateYield(uint256 extra) external {
        IERC20(asset()).transferFrom(msg.sender, address(this), extra);
    }

    /// @notice Mint `amount` USDC directly to the vault (simulated protocol yield).
    function injectYield(uint256 amount) external {
        _asset.mint(address(this), amount);
    }
}

/// @dev A vault whose asset() returns a different address — used to test createPot rejection.
contract MockBadVault {
    address public immutable asset;
    constructor(address wrongAsset) { asset = wrongAsset; }
}

// ─── Base ─────────────────────────────────────────────────────────────────────

abstract contract KittyPotsBase is Test {
    MockUSDC  internal usdc;
    MockVault internal vault;
    KittyPots internal kp;

    address internal alice   = makeAddr("alice");
    address internal bob     = makeAddr("bob");
    address internal charlie = makeAddr("charlie");
    address internal dave    = makeAddr("dave");
    address internal eve     = makeAddr("eve");

    uint256 internal constant ONE_USDC = 1e6;

    function setUp() public virtual {
        usdc  = new MockUSDC();
        vault = new MockVault(usdc);
        kp    = new KittyPots(address(usdc));
    }

    // ── helpers ──────────────────────────────────────────────────────────────

    /// Mint + approve KittyPots for `who`.
    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(kp), amount);
    }

    /// Create a simple 3-member pot (creator = address(this), alice, bob) threshold 2, no vault.
    function _createBasicPot() internal returns (uint256 potId) {
        address[] memory members = new address[](2);
        members[0] = alice;
        members[1] = bob;
        potId = kp.createPot("Basic", members, 2, address(0));
    }

    /// Create a vault-backed pot with creator = address(this), threshold 1.
    function _createVaultPot() internal returns (uint256 potId) {
        address[] memory members = new address[](0);
        potId = kp.createPot("VaultPot", members, 1, address(vault));
    }

    /// Propose + approve a Payout from `potId` of `amount` USDC to `to`, using creator = address(this).
    function _proposeAndApprovePayout(uint256 potId, uint256 amount, address to) internal returns (uint256 pid) {
        pid = kp.propose(potId, KittyPots.Kind.Payout, to, amount, 0, 0, "");
    }
}
