/**
 * Dirty Dozen Security Specification Test Suite for PulseEPG Firestore Rules
 */
export interface DirtyDozenTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: { uid: string; email_verified: boolean } | null;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_CASES: DirtyDozenTestCase[] = [
  {
    id: 1,
    name: 'Unauthenticated Profile Read',
    operation: 'get',
    path: '/users/user_123',
    auth: null,
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/users/user_123',
    auth: { uid: 'user_123', email_verified: false },
    payload: {
      uid: 'user_123',
      displayName: 'Tarik',
      email: 'tarik@example.com',
      plan: 'free',
      isPremium: false,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Cross-User PII Read',
    operation: 'get',
    path: '/users/user_456',
    auth: { uid: 'user_123', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Users Collection Enumeration',
    operation: 'list',
    path: '/users',
    auth: { uid: 'user_123', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'UID Spoofing on Create',
    operation: 'create',
    path: '/users/user_123',
    auth: { uid: 'user_123', email_verified: true },
    payload: {
      uid: 'user_999',
      displayName: 'Spoofer',
      email: 'spoof@example.com',
      plan: 'free',
      isPremium: false,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Shadow / Ghost Field Injection',
    operation: 'create',
    path: '/users/user_123',
    auth: { uid: 'user_123', email_verified: true },
    payload: {
      uid: 'user_123',
      displayName: 'Tarik',
      email: 'tarik@example.com',
      plan: 'free',
      isPremium: false,
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Oversized DisplayName DoW Attack',
    operation: 'create',
    path: '/users/user_123',
    auth: { uid: 'user_123', email_verified: true },
    payload: {
      uid: 'user_123',
      displayName: 'A'.repeat(200),
      email: 'tarik@example.com',
      plan: 'free',
      isPremium: false,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Invalid Plan Enum Value',
    operation: 'create',
    path: '/users/user_123',
    auth: { uid: 'user_123', email_verified: true },
    payload: {
      uid: 'user_123',
      displayName: 'Tarik',
      email: 'tarik@example.com',
      plan: 'unlimited_hack',
      isPremium: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Inconsistent Plan vs isPremium Flag',
    operation: 'create',
    path: '/users/user_123',
    auth: { uid: 'user_123', email_verified: true },
    payload: {
      uid: 'user_123',
      displayName: 'Tarik',
      email: 'tarik@example.com',
      plan: 'free',
      isPremium: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Immutable Field Mutation on Update',
    operation: 'update',
    path: '/users/user_123',
    auth: { uid: 'user_123', email_verified: true },
    payload: {
      uid: 'user_999',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Value Poisoning on Update',
    operation: 'update',
    path: '/users/user_123',
    auth: { uid: 'user_123', email_verified: true },
    payload: {
      isPremium: 'yes',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Malformed Document ID Poisoning',
    operation: 'create',
    path: '/users/bad$id!',
    auth: { uid: 'bad$id!', email_verified: true },
    payload: {
      uid: 'bad$id!',
      displayName: 'Tarik',
      email: 'tarik@example.com',
      plan: 'free',
      isPremium: false,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 13,
    name: 'Freemium Bypass Attempt on user_settings (4 bouquets with is_premium: false)',
    operation: 'create',
    path: '/user_settings/user_123',
    auth: { uid: 'user_123', email_verified: true },
    payload: {
      user_id: 'user_123',
      selected_bouquets: ['astra_canal_fr', 'astra_tnt_fr', 'hotbird_bis_fr', 'movistar_es'],
      favorite_channels: ['TF1.fr'],
      is_premium: false,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 14,
    name: 'Cross-User user_settings Read',
    operation: 'get',
    path: '/user_settings/user_456',
    auth: { uid: 'user_123', email_verified: true },
    expected: 'PERMISSION_DENIED',
  },
];
