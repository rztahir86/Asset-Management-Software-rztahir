# Security Specification — Meridian Enterprise Asset Ledger

## 1. Data Invariants
1. **Verified Identity Invariant**: All write operations require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`).
2. **Ownership & Attribution Invariant**: Every operational record (`businesses`, `regions`, `branches`, `categories`, `assets`, `transfers`, `verifications`, `depreciationRuns`, `maintenance`, `disposals`, `journals`, `approvals`, `auditLogs`) must record `ownerUid == request.auth.uid` on creation and keep `ownerUid` and `createdAt` immutable across updates.
3. **PII Isolation Invariant**: User email addresses are stored in `/users/{userId}/private/{docId}` (or restricted to owner/admin on `/users/{userId}`) and can never be read by non-owner, non-admin users.
4. **Privilege Escalation Guard**: Non-admin users cannot self-assign `SUPER_ADMIN` role on creation or mutate their own `role` field to `SUPER_ADMIN` unless they are the bootstrapped administrator (`ztahir86@gmail.com` with `email_verified == true`) or an existing admin in `/admins/{uid}`.
5. **Financial & Monetary Boundaries**: Original costs, residual values, and accumulated depreciation must be non-negative numbers (`>= 0`), and `residualValueCents <= originalCostCents`.
6. **Terminal State Locking**:
   - `transfers` in terminal states (`RECEIVED`, `REJECTED`) cannot be updated by non-admins.
   - `depreciationRuns` in terminal state (`POSTED`) cannot be updated by non-admins.
   - `disposals` in terminal states (`EXECUTED`, `REJECTED`) cannot be updated by non-admins.
   - `approvals` in terminal states (`APPROVED`, `REJECTED`) cannot be updated by non-admins.
   - `auditLogs` are strictly append-only (no `update` or `delete` allowed).
7. **Strict Key & Size Enforcement**: Every string is bounded by `maxLength` and every document write enforces `hasAll` and `hasOnly` keys to block shadow fields.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Shadow Field Injection on Asset Creation**: Adding `"isApprovedBypass": true` to `/assets/{assetId}` -> Rejected by `data.keys().hasOnly(...)`.
2. **Self-Assigned Super Admin**: Standard user creating `/users/{uid}` with `"role": "SUPER_ADMIN"` -> Rejected unless `isAdmin()`.
3. **Spoofed Unverified Admin Email**: Token with `email: "ztahir86@gmail.com"` and `email_verified: false` attempting admin write -> Rejected by `request.auth.token.email_verified == true`.
4. **Owner Spoofing on Asset Registration**: Setting `ownerUid: "another-user-uid"` on `/assets/{assetId}` -> Rejected by `data.ownerUid == request.auth.uid`.
5. **Cross-Tenant List Scraping**: Querying `/assets` without matching `resource.data.ownerUid == request.auth.uid` (when not admin) -> Rejected by Query Enforcer on `allow list`.
6. **PII Harvesting**: Authenticated user reading `/users/otherUser/private/info` -> Rejected by `isOwner(userId) || isAdmin()`.
7. **Terminal Depreciation Run Tampering**: Updating a `POSTED` document in `/depreciationRuns/{runId}` -> Rejected by Terminal State Lock (`existing().status != 'POSTED'`).
8. **Terminal Transfer State Mutation**: Updating a `RECEIVED` transfer in `/transfers/{transferId}` -> Rejected by Terminal State Lock.
9. **Audit Log Tampering / Deletion**: Calling `update` or `delete` on `/auditLogs/{logId}` -> Rejected (`allow update, delete: if false;`).
10. **ID Poisoning Attack**: Creating a document with a 500-character or special-character ID -> Rejected by `isValidId(id)`.
11. **Negative Cost / Residual Overflow**: Creating an asset with `originalCostCents: -5000` or `residualValueCents > originalCostCents` -> Rejected by `isValidAsset()`.
12. **Immortal Field Mutation**: Updating `createdAt` or `ownerUid` on `/assets/{assetId}` -> Rejected by immutability gate (`incoming().createdAt == existing().createdAt && incoming().ownerUid == existing().ownerUid`).
