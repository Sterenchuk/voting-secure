import { Role, GroupRole, VotingType } from '@prisma/client';

export const USERS_DATA = [
  { email: 'owner1@example.com', name: 'Owner One', role: Role.USER },
  { email: 'owner2@example.com', name: 'Owner Two', role: Role.USER },
  { email: 'admin@example.com', name: 'Global Admin', role: Role.ADMIN },
  { email: 'auditor@example.com', name: 'Auditor User', role: Role.AUDITOR },
  { email: 'user1@example.com', name: 'User One', role: Role.USER },
  { email: 'user2@example.com', name: 'User Two', role: Role.USER },
  { email: 'user3@example.com', name: 'User Three', role: Role.USER },
  { email: 'user4@example.com', name: 'User Four', role: Role.USER },
];

export const GROUPS_DATA = [
  { name: 'Alpha Group', ownerEmail: 'owner1@example.com' },
  { name: 'Beta Group', ownerEmail: 'owner2@example.com' },
];

// Memberships for each group to ensure all levels are present
export const MEMBERSHIPS = [
  // Alpha Group
  { groupName: 'Alpha Group', email: 'owner1@example.com', role: GroupRole.OWNER },
  { groupName: 'Alpha Group', email: 'user1@example.com', role: GroupRole.ADMIN },
  { groupName: 'Alpha Group', email: 'user2@example.com', role: GroupRole.MODERATOR },
  { groupName: 'Alpha Group', email: 'user3@example.com', role: GroupRole.MEMBER },
  
  // Beta Group
  { groupName: 'Beta Group', email: 'owner2@example.com', role: GroupRole.OWNER },
  { groupName: 'Beta Group', email: 'user1@example.com', role: GroupRole.ADMIN },
  { groupName: 'Beta Group', email: 'user4@example.com', role: GroupRole.MODERATOR },
  { groupName: 'Beta Group', email: 'user2@example.com', role: GroupRole.MEMBER },
];

export const VOTINGS_DATA = [
  {
    title: 'Alpha Budget 2026',
    description: 'Ongoing discussion on budget allocation',
    groupName: 'Alpha Group',
    creatorEmail: 'owner1@example.com',
    type: VotingType.SINGLE_CHOICE,
    isOpen: true,
    isFinalized: false,
    options: ['Marketing', 'Development', 'Operations'],
    startAt: new Date(),
    endAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 1 week from now
  },
  {
    title: 'Beta Project Priority',
    description: 'Deciding which project to start first',
    groupName: 'Beta Group',
    creatorEmail: 'owner2@example.com',
    type: VotingType.SINGLE_CHOICE,
    isOpen: true,
    isFinalized: false,
    options: ['Project X', 'Project Y', 'Project Z'],
    startAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    endAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  },
  {
    title: 'Completed: Yearly Retreat',
    description: 'Finalized voting for retreat location',
    groupName: 'Alpha Group',
    creatorEmail: 'owner1@example.com',
    type: VotingType.SINGLE_CHOICE,
    isOpen: false,
    isFinalized: true,
    options: ['Mountain', 'Beach', 'City'],
    startAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    endAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    allowOther: true,
  },
  {
    title: 'Deleted Voting: Pizza Toppings',
    description: 'This was a test voting',
    groupName: 'Beta Group',
    creatorEmail: 'owner2@example.com',
    type: VotingType.SINGLE_CHOICE,
    isOpen: false,
    isFinalized: false,
    options: ['Pepperoni', 'Mushroom'],
    deletedAt: new Date(),
  }
];
