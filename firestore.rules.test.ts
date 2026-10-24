/**
 * Security Rules Verification & Dirty Dozen Payload Test Suite
 * Verifies all 12 adversarial payloads against Meridian Enterprise Asset Ledger Firestore rules.
 */

export interface DirtyDozenScenario {
  id: number;
  title: string;
  collectionPath: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'list';
  expectedOutcome: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
  invariantsTested: string[];
}

export const DIRTY_DOZEN_SCENARIOS: DirtyDozenScenario[] = [
  {
    id: 1,
    title: 'Shadow Field Injection on Asset Creation',
    collectionPath: '/assets/ast-shadow-01',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { id: 'ast-shadow-01', isApprovedBypass: true },
    invariantsTested: ['Strict Key Allowlist (hasOnly)'],
  },
  {
    id: 2,
    title: 'Self-Assigned Super Admin on User Registration',
    collectionPath: '/users/usr-attacker-01',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { uid: 'usr-attacker-01', role: 'SUPER_ADMIN' },
    invariantsTested: ['Privilege Escalation Guard'],
  },
  {
    id: 3,
    title: 'Spoofed Unverified Admin Email Write',
    collectionPath: '/businesses/biz-spoof-01',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { id: 'biz-spoof-01', email_verified: false },
    invariantsTested: ['Verified Email Mandate'],
  },
  {
    id: 4,
    title: 'Owner UID Spoofing on Asset Creation',
    collectionPath: '/assets/ast-spoof-01',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { id: 'ast-spoof-01', ownerUid: 'victim-uid-999' },
    invariantsTested: ['Identity Integrity (ownerUid == request.auth.uid)'],
  },
  {
    id: 5,
    title: 'Unscoped Cross-Tenant List Scraping',
    collectionPath: '/assets',
    operation: 'list',
    expectedOutcome: 'PERMISSION_DENIED',
    invariantsTested: ['Query Enforcer on allow list'],
  },
  {
    id: 6,
    title: 'Unauthorized PII Harvesting on Private Subcollection',
    collectionPath: '/users/victim-uid-999/private/info',
    operation: 'get',
    expectedOutcome: 'PERMISSION_DENIED',
    invariantsTested: ['Split Collection PII Isolation'],
  },
  {
    id: 7,
    title: 'Terminal State Tampering on Posted Depreciation Run',
    collectionPath: '/depreciationRuns/run-posted-01',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { status: 'DRAFT' },
    invariantsTested: ['Terminal State Locking (POSTED)'],
  },
  {
    id: 8,
    title: 'Terminal State Mutation on Received Transfer',
    collectionPath: '/transfers/trf-received-01',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { status: 'IN_TRANSIT' },
    invariantsTested: ['Terminal State Locking (RECEIVED)'],
  },
  {
    id: 9,
    title: 'Audit Log Tampering / Deletion Attempt',
    collectionPath: '/auditLogs/log-immutable-01',
    operation: 'delete',
    expectedOutcome: 'PERMISSION_DENIED',
    invariantsTested: ['Immutable Append-Only Audit Trail'],
  },
  {
    id: 10,
    title: 'ID Poisoning with Special Characters',
    collectionPath: '/assets/bad$id!@#',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    invariantsTested: ['Path Variable Hardening (isValidId)'],
  },
  {
    id: 11,
    title: 'Negative Original Cost / Residual Overflow',
    collectionPath: '/assets/ast-neg-01',
    operation: 'create',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { originalCostCents: -10000, residualValueCents: 50000 },
    invariantsTested: ['Monetary Domain Bounds'],
  },
  {
    id: 12,
    title: 'Immortal Field Mutation (createdAt / ownerUid)',
    collectionPath: '/assets/ast-immortal-01',
    operation: 'update',
    expectedOutcome: 'PERMISSION_DENIED',
    payload: { createdAt: '1999-01-01T00:00:00Z' },
    invariantsTested: ['Immortal Field Rule'],
  },
];
