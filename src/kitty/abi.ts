/**
 * KittyPots ABI — generated from contracts/out/KittyPots.sol/KittyPots.json
 */
export const KITTY_ABI = [
  // Events
  {
    type: 'event',
    name: 'PotCreated',
    inputs: [
      { name: 'potId', type: 'uint256', indexed: true },
      { name: 'creator', type: 'address', indexed: true },
      { name: 'name', type: 'string', indexed: false },
      { name: 'vault', type: 'address', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Contributed',
    inputs: [
      { name: 'potId', type: 'uint256', indexed: true },
      { name: 'from', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'sharesMinted', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Proposed',
    inputs: [
      { name: 'potId', type: 'uint256', indexed: true },
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'proposer', type: 'address', indexed: true },
      { name: 'kind', type: 'uint8', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Approved',
    inputs: [
      { name: 'potId', type: 'uint256', indexed: true },
      { name: 'proposalId', type: 'uint256', indexed: true },
      { name: 'approver', type: 'address', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Executed',
    inputs: [
      { name: 'potId', type: 'uint256', indexed: true },
      { name: 'proposalId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Cancelled',
    inputs: [
      { name: 'potId', type: 'uint256', indexed: true },
      { name: 'proposalId', type: 'uint256', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'Spent',
    inputs: [
      { name: 'potId', type: 'uint256', indexed: true },
      { name: 'member', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256', indexed: false },
      { name: 'memo', type: 'string', indexed: false },
      { name: 'spentThisPeriod', type: 'uint256', indexed: false },
      { name: 'limit', type: 'uint256', indexed: false },
    ],
  },
  // Constructor
  { type: 'constructor', inputs: [{ name: '_usdc', type: 'address' }], stateMutability: 'nonpayable' },
  // State vars
  { type: 'function', name: 'usdc', inputs: [], outputs: [{ type: 'address' }], stateMutability: 'view' },
  { type: 'function', name: 'potCount', inputs: [], outputs: [{ type: 'uint256' }], stateMutability: 'view' },
  // Write functions
  {
    type: 'function',
    name: 'createPot',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'members', type: 'address[]' },
      { name: 'threshold', type: 'uint8' },
      { name: 'vault', type: 'address' },
    ],
    outputs: [{ name: 'potId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'contribute',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'propose',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'kind', type: 'uint8' },
      { name: 'target', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'bps', type: 'uint16' },
      { name: 'period', type: 'uint64' },
      { name: 'memo', type: 'string' },
    ],
    outputs: [{ name: 'proposalId', type: 'uint256' }],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'proposalId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'cancel',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'proposalId', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'spend',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'memo', type: 'string' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  // Read functions
  {
    type: 'function',
    name: 'getPot',
    inputs: [{ name: 'potId', type: 'uint256' }],
    outputs: [
      { name: 'name', type: 'string' },
      { name: 'creator', type: 'address' },
      { name: 'vault', type: 'address' },
      { name: 'shares', type: 'uint256' },
      { name: 'idle', type: 'uint256' },
      { name: 'threshold', type: 'uint8' },
      { name: 'memberCount', type: 'uint8' },
      { name: 'totalContributed', type: 'uint256' },
      { name: 'totalPaidOut', type: 'uint256' },
      { name: 'proposalCount', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getMembers',
    inputs: [{ name: 'potId', type: 'uint256' }],
    outputs: [
      {
        name: 'infos',
        type: 'tuple[]',
        components: [
          { name: 'addr', type: 'address' },
          { name: 'isMember', type: 'bool' },
          { name: 'contributed', type: 'uint256' },
          { name: 'monthsStreak', type: 'uint32' },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getProposal',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'proposalId', type: 'uint256' },
    ],
    outputs: [
      { name: 'kind', type: 'uint8' },
      { name: 'target', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'bps', type: 'uint16' },
      { name: 'period', type: 'uint64' },
      { name: 'memo', type: 'string' },
      { name: 'proposer', type: 'address' },
      { name: 'createdAt', type: 'uint64' },
      { name: 'approvalCount', type: 'uint8' },
      { name: 'executed', type: 'bool' },
      { name: 'cancelled', type: 'bool' },
      { name: 'expired', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'proposalsOf',
    inputs: [{ name: 'potId', type: 'uint256' }],
    outputs: [{ name: 'ids', type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'potsOf',
    inputs: [{ name: 'member', type: 'address' }],
    outputs: [{ type: 'uint256[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'potValue',
    inputs: [{ name: 'potId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'yieldEarned',
    inputs: [{ name: 'potId', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allowanceOf',
    inputs: [
      { name: 'potId', type: 'uint256' },
      { name: 'member', type: 'address' },
    ],
    outputs: [
      { name: 'limit', type: 'uint256' },
      { name: 'period', type: 'uint256' },
      { name: 'spentThisPeriod', type: 'uint256' },
      { name: 'remainingThisPeriod', type: 'uint256' },
      { name: 'resetsAt', type: 'uint64' },
      { name: 'active', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_MEMBERS',
    inputs: [],
    outputs: [{ type: 'uint8' }],
    stateMutability: 'view',
  },
] as const
