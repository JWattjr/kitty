// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title KittyPots
/// @notice Shared USDC-denominated pots for families, friends, and teams.
/// @dev Security notes:
/// - Each pot may optionally use an ERC-4626 vault selected at pot creation. Vault yield introduces lending risk
///   (for example, bad debt or liquidity stress in the underlying strategy).
/// - Per-pot share accounting prevents one pot from spending another pot's shares.
/// - Withdrawals debit exactly the shares burned by the vault. Any vault-favoring rounding remains in the vault
///   and benefits the pot's remaining shares.
/// - There is no admin role: fund movements require a successful proposal flow or an active allowance.
/// - Only explicit proposal kinds are executable. Arbitrary external calls are not supported.
/// - Checks-effects-interactions is applied by marking proposals executed before external interactions.
/// - SafeERC20 is used for all USDC transfers and approvals.
contract KittyPots is ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint8 public constant MAX_MEMBERS = 20;
    uint64 public constant PROPOSAL_TTL = 7 days;
    uint64 public constant STREAK_MIN = 25 days;
    uint64 public constant STREAK_MAX = 45 days;
    uint64 public constant ALLOW_MIN_P = 1 days;
    uint64 public constant ALLOW_MAX_P = 31 days;

    enum Kind {
        Payout,
        AddMember,
        RemoveMember,
        SetThreshold,
        SetAllowance,
        RevokeAllowance
    }

    struct Member {
        bool isMember;
        uint256 contributed;
        uint64 lastContributionAt;
        uint32 monthsStreak;
    }

    struct Allowance {
        uint256 limit;
        uint64 period;
        uint256 spentThisPeriod;
        uint64 periodStart;
        bool active;
    }

    struct Proposal {
        Kind kind;
        address target;
        uint256 amount;
        uint16 bps;
        uint64 period;
        string memo;
        address proposer;
        uint64 createdAt;
        uint8 approvalCount;
        bool executed;
        bool cancelled;
        mapping(address => bool) approved;
    }

    struct Pot {
        string name;
        address creator;
        address vault;
        uint256 shares;
        uint256 idle;
        uint8 threshold;
        address[] members;
        uint8 memberCount;
        uint256 totalContributed;
        uint256 totalPaidOut;
        uint256 proposalCount;
    }

    struct MemberInfo {
        address addr;
        bool isMember;
        uint256 contributed;
        uint32 monthsStreak;
    }

    IERC20 public immutable usdc;

    mapping(uint256 => Pot) private _pots;
    mapping(uint256 => mapping(address => Member)) private _members;
    mapping(uint256 => mapping(uint256 => Proposal)) private _proposals;
    mapping(uint256 => mapping(address => Allowance)) private _allowances;
    mapping(address => uint256[]) private _potsOf;
    uint256 public potCount;

    event PotCreated(uint256 indexed potId, address indexed creator, string name, address vault);
    event Contributed(uint256 indexed potId, address indexed from, uint256 amount, uint256 sharesMinted);
    event Proposed(uint256 indexed potId, uint256 indexed proposalId, address indexed proposer, Kind kind);
    event Approved(uint256 indexed potId, uint256 indexed proposalId, address indexed approver);
    event Executed(uint256 indexed potId, uint256 indexed proposalId);
    event Cancelled(uint256 indexed potId, uint256 indexed proposalId);
    event Spent(
        uint256 indexed potId,
        address indexed member,
        address indexed to,
        uint256 amount,
        string memo,
        uint256 spentThisPeriod,
        uint256 limit
    );

    constructor(address _usdc) {
        require(_usdc != address(0), "KittyPots: zero usdc");
        usdc = IERC20(_usdc);
    }

    function createPot(
        string calldata name,
        address[] calldata members,
        uint8 threshold,
        address vault
    ) external returns (uint256 potId) {
        if (vault != address(0)) {
            require(IERC4626(vault).asset() == address(usdc), "KittyPots: vault asset != usdc");
        }

        potId = potCount;
        unchecked {
            potCount = potId + 1;
        }

        Pot storage pot = _pots[potId];
        pot.name = name;
        pot.creator = msg.sender;
        pot.vault = vault;

        _addMember(potId, msg.sender);

        uint256 len = members.length;
        for (uint256 i = 0; i < len; ++i) {
            address who = members[i];
            if (who == address(0) || who == msg.sender) {
                continue;
            }
            if (_members[potId][who].isMember) {
                continue;
            }
            require(pot.memberCount < MAX_MEMBERS, "KittyPots: max members");
            _addMember(potId, who);
        }

        require(threshold >= 1 && threshold <= pot.memberCount, "KittyPots: bad threshold");
        pot.threshold = threshold;

        emit PotCreated(potId, msg.sender, name, vault);
    }

    function contribute(uint256 potId, uint256 amount) external nonReentrant {
        require(potId < potCount, "KittyPots: bad pot");
        require(amount > 0, "KittyPots: zero amount");

        Pot storage pot = _pots[potId];

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        uint256 sharesMinted;
        if (pot.vault != address(0)) {
            usdc.forceApprove(pot.vault, amount);
            sharesMinted = IERC4626(pot.vault).deposit(amount, address(this));
            // Clear any residual allowance; a well-behaved vault pulls exactly amount,
            // but we reset unconditionally to prevent a partial-pull vault from retaining
            // approval over USDC belonging to other pots.
            usdc.forceApprove(pot.vault, 0);
            pot.shares += sharesMinted;
        } else {
            pot.idle += amount;
        }

        pot.totalContributed += amount;

        Member storage m = _members[potId][msg.sender];
        if (m.isMember) {
            m.contributed += amount;

            if (m.lastContributionAt == 0) {
                m.monthsStreak += 1;
                m.lastContributionAt = uint64(block.timestamp);
            } else {
                uint64 gap = uint64(block.timestamp) - m.lastContributionAt;
                if (gap >= STREAK_MIN && gap <= STREAK_MAX) {
                    m.monthsStreak += 1;
                    m.lastContributionAt = uint64(block.timestamp);
                } else if (gap > STREAK_MAX) {
                    m.monthsStreak = 1;
                    m.lastContributionAt = uint64(block.timestamp);
                }
            }
        }

        emit Contributed(potId, msg.sender, amount, sharesMinted);
    }

    function potValue(uint256 potId) public view returns (uint256) {
        require(potId < potCount, "KittyPots: bad pot");
        Pot storage pot = _pots[potId];
        if (pot.vault != address(0)) {
            return IERC4626(pot.vault).convertToAssets(pot.shares) + pot.idle;
        }
        return pot.idle;
    }

    function yieldEarned(uint256 potId) public view returns (uint256) {
        require(potId < potCount, "KittyPots: bad pot");
        Pot storage pot = _pots[potId];

        uint256 val = potValue(potId);
        uint256 accounted = pot.totalContributed;
        uint256 nowPlusPaidOut = val + pot.totalPaidOut;

        if (nowPlusPaidOut > accounted) {
            return nowPlusPaidOut - accounted;
        }
        return 0;
    }

    function propose(
        uint256 potId,
        Kind kind,
        address target,
        uint256 amount,
        uint16 bps,
        uint64 period,
        string calldata memo
    ) external returns (uint256 proposalId) {
        require(potId < potCount, "KittyPots: bad pot");
        require(_members[potId][msg.sender].isMember, "KittyPots: not member");

        Pot storage pot = _pots[potId];

        if (kind == Kind.Payout) {
            require(amount > 0 || (bps >= 1 && bps <= 10_000), "KittyPots: bad payout");
        } else if (kind == Kind.AddMember) {
            require(target != address(0), "KittyPots: zero target");
            require(!_members[potId][target].isMember, "KittyPots: already member");
            require(pot.memberCount < MAX_MEMBERS, "KittyPots: max members");
        } else if (kind == Kind.RemoveMember) {
            require(_members[potId][target].isMember, "KittyPots: not member");
            require(pot.memberCount > 1, "KittyPots: last member");
        } else if (kind == Kind.SetThreshold) {
            require(amount >= 1 && amount <= pot.memberCount, "KittyPots: bad threshold");
        } else if (kind == Kind.SetAllowance) {
            require(_members[potId][target].isMember, "KittyPots: not member");
            require(amount > 0, "KittyPots: zero allowance");
            require(period >= ALLOW_MIN_P && period <= ALLOW_MAX_P, "KittyPots: bad period");
        } else if (kind == Kind.RevokeAllowance) {
            // No membership requirement: the group must be able to revoke a former
            // member's allowance even after that address was removed from the pot.
            require(target != address(0), "KittyPots: zero target");
        }

        proposalId = pot.proposalCount;
        unchecked {
            pot.proposalCount = proposalId + 1;
        }

        Proposal storage p = _proposals[potId][proposalId];
        p.kind = kind;
        p.target = target;
        p.amount = amount;
        p.bps = bps;
        p.period = period;
        p.memo = memo;
        p.proposer = msg.sender;
        p.createdAt = uint64(block.timestamp);
        p.approved[msg.sender] = true;
        p.approvalCount = 1;

        emit Proposed(potId, proposalId, msg.sender, kind);
        emit Approved(potId, proposalId, msg.sender);

        if (p.approvalCount >= pot.threshold) {
            _execute(potId, proposalId);
            emit Executed(potId, proposalId);
        }
    }

    function approve(uint256 potId, uint256 proposalId) external {
        require(potId < potCount, "KittyPots: bad pot");
        require(_members[potId][msg.sender].isMember, "KittyPots: not member");

        Pot storage pot = _pots[potId];
        require(proposalId < pot.proposalCount, "KittyPots: bad proposal");

        Proposal storage p = _proposals[potId][proposalId];
        require(!p.executed && !p.cancelled, "KittyPots: inactive proposal");
        require(block.timestamp <= p.createdAt + PROPOSAL_TTL, "KittyPots: proposal expired");
        require(!p.approved[msg.sender], "KittyPots: already approved");

        p.approved[msg.sender] = true;
        p.approvalCount += 1;

        emit Approved(potId, proposalId, msg.sender);

        if (p.approvalCount >= pot.threshold) {
            _execute(potId, proposalId);
            emit Executed(potId, proposalId);
        }
    }

    function cancel(uint256 potId, uint256 proposalId) external {
        require(potId < potCount, "KittyPots: bad pot");

        Pot storage pot = _pots[potId];
        require(proposalId < pot.proposalCount, "KittyPots: bad proposal");

        Proposal storage p = _proposals[potId][proposalId];
        require(msg.sender == p.proposer, "KittyPots: not proposer");
        require(!p.executed && !p.cancelled, "KittyPots: inactive proposal");

        p.cancelled = true;
        emit Cancelled(potId, proposalId);
    }

    function spend(uint256 potId, address to, uint256 amount, string calldata memo) external nonReentrant {
        require(potId < potCount, "KittyPots: bad pot");
        require(amount > 0, "KittyPots: zero amount");
        require(to != address(0), "KittyPots: zero to");

        // Spending requires both an active allowance AND current membership.
        // Membership is checked separately so that removing a member also stops their card.
        require(_members[potId][msg.sender].isMember, "KittyPots: not member");
        Allowance storage a = _allowances[potId][msg.sender];
        require(a.active, "KittyPots: no allowance");

        if (block.timestamp >= a.periodStart + a.period) {
            a.spentThisPeriod = 0;
            a.periodStart = uint64(block.timestamp);
        }

        require(a.spentThisPeriod + amount <= a.limit, "KittyPots: allowance exceeded");
        require(potValue(potId) >= amount, "KittyPots: insufficient pot value");

        a.spentThisPeriod += amount;
        _withdrawFromPot(potId, amount, to);

        emit Spent(potId, msg.sender, to, amount, memo, a.spentThisPeriod, a.limit);
    }

    function allowanceOf(
        uint256 potId,
        address member
    )
        external
        view
        returns (
            uint256 limit,
            uint256 period,
            uint256 spentThisPeriod,
            uint256 remainingThisPeriod,
            uint64 resetsAt,
            bool active
        )
    {
        require(potId < potCount, "KittyPots: bad pot");
        Allowance storage a = _allowances[potId][member];

        limit = a.limit;
        period = a.period;
        active = a.active;

        if (a.period == 0) {
            spentThisPeriod = 0;
            remainingThisPeriod = limit;
            resetsAt = 0;
            return (limit, period, spentThisPeriod, remainingThisPeriod, resetsAt, active);
        }

        resetsAt = a.periodStart + a.period;

        if (block.timestamp >= resetsAt) {
            spentThisPeriod = 0;
            remainingThisPeriod = limit;
        } else {
            spentThisPeriod = a.spentThisPeriod;
            remainingThisPeriod = spentThisPeriod >= limit ? 0 : limit - spentThisPeriod;
        }
    }

    function getPot(
        uint256 potId
    )
        external
        view
        returns (
            string memory name,
            address creator,
            address vault,
            uint256 shares,
            uint256 idle,
            uint8 threshold,
            uint8 memberCount,
            uint256 totalContributed,
            uint256 totalPaidOut,
            uint256 proposalCount_
        )
    {
        require(potId < potCount, "KittyPots: bad pot");
        Pot storage pot = _pots[potId];

        name = pot.name;
        creator = pot.creator;
        vault = pot.vault;
        shares = pot.shares;
        idle = pot.idle;
        threshold = pot.threshold;
        memberCount = pot.memberCount;
        totalContributed = pot.totalContributed;
        totalPaidOut = pot.totalPaidOut;
        proposalCount_ = pot.proposalCount;
    }

    function getMembers(uint256 potId) external view returns (MemberInfo[] memory infos) {
        require(potId < potCount, "KittyPots: bad pot");
        Pot storage pot = _pots[potId];

        uint256 len = pot.members.length;
        infos = new MemberInfo[](len);

        for (uint256 i = 0; i < len; ++i) {
            address who = pot.members[i];
            Member storage m = _members[potId][who];
            infos[i] = MemberInfo({
                addr: who,
                isMember: m.isMember,
                contributed: m.contributed,
                monthsStreak: m.monthsStreak
            });
        }
    }

    function getProposal(
        uint256 potId,
        uint256 proposalId
    )
        external
        view
        returns (
            Kind kind,
            address target,
            uint256 amount,
            uint16 bps,
            uint64 period,
            string memory memo,
            address proposer,
            uint64 createdAt,
            uint8 approvalCount,
            bool executed,
            bool cancelled,
            bool expired
        )
    {
        require(potId < potCount, "KittyPots: bad pot");
        Pot storage pot = _pots[potId];
        require(proposalId < pot.proposalCount, "KittyPots: bad proposal");

        Proposal storage p = _proposals[potId][proposalId];

        kind = p.kind;
        target = p.target;
        amount = p.amount;
        bps = p.bps;
        period = p.period;
        memo = p.memo;
        proposer = p.proposer;
        createdAt = p.createdAt;
        approvalCount = p.approvalCount;
        executed = p.executed;
        cancelled = p.cancelled;
        expired = block.timestamp > p.createdAt + PROPOSAL_TTL && !p.executed && !p.cancelled;
    }

    function proposalsOf(uint256 potId) external view returns (uint256[] memory ids) {
        require(potId < potCount, "KittyPots: bad pot");

        uint256 count = _pots[potId].proposalCount;
        ids = new uint256[](count);

        for (uint256 i = 0; i < count; ++i) {
            ids[i] = i;
        }
    }

    function potsOf(address member) external view returns (uint256[] memory) {
        return _potsOf[member];
    }

    function _execute(uint256 potId, uint256 proposalId) internal {
        Pot storage pot = _pots[potId];
        Proposal storage p = _proposals[potId][proposalId];

        require(!p.executed && !p.cancelled, "KittyPots: inactive proposal");

        p.executed = true;

        if (p.kind == Kind.Payout) {
            uint256 payout = p.amount > 0 ? p.amount : Math.mulDiv(potValue(potId), p.bps, 10_000);
            require(payout > 0 && payout <= potValue(potId), "KittyPots: bad payout");

            _withdrawFromPot(potId, payout, p.target);
            pot.totalPaidOut += payout;
        } else if (p.kind == Kind.AddMember) {
            _addMember(potId, p.target);
        } else if (p.kind == Kind.RemoveMember) {
            _removeMember(potId, p.target);
            if (pot.threshold > pot.memberCount) {
                pot.threshold = pot.memberCount;
            }
        } else if (p.kind == Kind.SetThreshold) {
            require(p.amount >= 1 && p.amount <= pot.memberCount, "KittyPots: bad threshold");
            pot.threshold = uint8(p.amount);
        } else if (p.kind == Kind.SetAllowance) {
            _allowances[potId][p.target] = Allowance({
                limit: p.amount,
                period: p.period,
                spentThisPeriod: 0,
                periodStart: uint64(block.timestamp),
                active: true
            });
        } else if (p.kind == Kind.RevokeAllowance) {
            _allowances[potId][p.target].active = false;
        }
    }

    function _withdrawFromPot(uint256 potId, uint256 amount, address to) internal {
        Pot storage pot = _pots[potId];

        if (pot.vault != address(0) && pot.shares > 0) {
            uint256 sharesBurned = IERC4626(pot.vault).withdraw(amount, to, address(this));
            pot.shares -= sharesBurned;
            return;
        }

        require(pot.idle >= amount, "KittyPots: insufficient idle");
        pot.idle -= amount;
        usdc.safeTransfer(to, amount);
    }

    function _addMember(uint256 potId, address who) internal {
        Pot storage pot = _pots[potId];
        Member storage m = _members[potId][who];

        require(who != address(0), "KittyPots: zero member");
        require(!m.isMember, "KittyPots: already member");
        require(pot.memberCount < MAX_MEMBERS, "KittyPots: max members");

        m.isMember = true;
        pot.members.push(who);
        pot.memberCount += 1;
        _potsOf[who].push(potId);
    }

    function _removeMember(uint256 potId, address who) internal {
        Pot storage pot = _pots[potId];
        Member storage m = _members[potId][who];

        require(m.isMember, "KittyPots: not member");
        require(pot.memberCount > 1, "KittyPots: last member");

        m.isMember = false;
        pot.memberCount -= 1;

        // Automatically deactivate any spending allowance so that a removed member
        // cannot continue spending from the pot. The group may still call RevokeAllowance
        // explicitly (which now accepts non-members) to zero out the record entirely.
        _allowances[potId][who].active = false;
    }
}
