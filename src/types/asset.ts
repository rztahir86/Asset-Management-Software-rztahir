export type UserRole =
  | 'SUPER_ADMIN'
  | 'GROUP_FINANCE_MANAGER'
  | 'BUSINESS_ADMIN'
  | 'REGIONAL_MANAGER'
  | 'BRANCH_ASSET_OFFICER'
  | 'ACCOUNTANT'
  | 'AUDITOR'
  | 'READ_ONLY_EXECUTIVE';

export type DepreciationMethod =
  | 'STRAIGHT_LINE'
  | 'REDUCING_BALANCE'
  | 'DOUBLE_DECLINING'
  | 'UNITS_OF_PRODUCTION';

export type AssetCondition = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'DAMAGED' | 'SCRAP';

export type OperationalStatus =
  | 'ACTIVE'
  | 'UNDER_MAINTENANCE'
  | 'IN_TRANSIT'
  | 'AWAITING_APPROVAL'
  | 'FULLY_DEPRECIATED'
  | 'DISPOSED';

export type VerificationStatus =
  | 'VERIFIED'
  | 'UNVERIFIED'
  | 'MISSING'
  | 'DAMAGED'
  | 'RELOCATED';

export type TransferStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'IN_TRANSIT'
  | 'RECEIVED'
  | 'REJECTED';

export interface UserProfile {
  uid: string;
  displayName: string;
  role: UserRole;
  assignedBusinessId: string; // 'ALL' for Head Office / Super Admin / Group Finance
  assignedRegionId?: string;
  assignedBranchId?: string;
  department?: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface Business {
  id: string;
  code: string;
  name: string;
  legalName: string;
  taxId?: string;
  baseCurrency: string;
  fiscalYearStartMonth: number;
  country: string;
  status: 'ACTIVE' | 'INACTIVE';
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface Region {
  id: string;
  businessId: string;
  code: string;
  name: string;
  zoneManager: string;
  country: string;
  status: 'ACTIVE' | 'INACTIVE';
  ownerUid: string;
  createdAt: string;
}

export interface Branch {
  id: string;
  businessId: string;
  regionId: string;
  code: string;
  name: string;
  type:
    | 'HEAD_OFFICE'
    | 'REGIONAL_OFFICE'
    | 'BRANCH'
    | 'WAREHOUSE'
    | 'PLANT'
    | 'POULTRY_FARM'
    | 'HATCHERY'
    | 'FEED_MILL';
  address: string;
  costCenterCode: string;
  custodianLead: string;
  status: 'ACTIVE' | 'INACTIVE';
  ownerUid: string;
  createdAt: string;
}

export interface AssetCategory {
  id: string;
  code: string;
  name: string;
  parentCategory: string;
  defaultDepreciationMethod: DepreciationMethod;
  defaultUsefulLifeMonths: number;
  defaultResidualRatePct: number;
  glAssetAccount: string;
  glAccumDepAccount: string;
  glDepExpenseAccount: string;
  taxDepreciationRatePct: number;
  status: 'ACTIVE' | 'INACTIVE';
  ownerUid: string;
  createdAt: string;
}

export interface Asset {
  id: string;
  assetTag: string;
  qrPayload: string;
  barcodeValue: string;
  name: string;
  description: string;
  categoryId: string;
  subcategory: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  businessId: string;
  regionId: string;
  branchId: string;
  department: string;
  costCenter: string;
  physicalLocation: string;
  custodianName: string;
  custodianEmployeeId: string;
  purchaseDate: string;
  capitalizationDate: string;
  supplierName: string;
  invoiceReference: string;
  originalCostCents: number;
  currency: string;
  exchangeRateScaled: number; // 10000 = 1.0000 exchange rate to Group Base Currency (PKR)
  residualValueCents: number;
  usefulLifeMonths: number;
  depreciationMethod: DepreciationMethod;
  accumulatedDepreciationCents: number;
  impairmentCents: number;
  revaluationReserveCents: number;
  netBookValueCents: number;
  taxBookValueCents: number;
  totalUnitsCapacity: number;
  unitsProducedToDate: number;
  condition: AssetCondition;
  operationalStatus: OperationalStatus;
  warrantyExpiryDate: string;
  insurancePolicyNo: string;
  insuranceExpiryDate: string;
  insuredValueCents: number;
  maintenanceSchedule: string;
  fundingSource: string;
  verificationStatus: VerificationStatus;
  lastVerifiedDate: string;
  isDemoData: boolean;
  remarks: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetTransfer {
  id: string;
  transferNumber: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  fromBusinessId: string;
  toBusinessId: string;
  fromRegionId: string;
  toRegionId: string;
  fromBranchId: string;
  toBranchId: string;
  fromDepartment: string;
  toDepartment: string;
  fromCustodian: string;
  toCustodian: string;
  transferDate: string;
  reason: string;
  isIntercompany: boolean;
  transferNetBookValueCents: number;
  status: TransferStatus;
  requestedByName: string;
  approvedByName: string;
  dispatchConfirmedAt: string;
  receivedConfirmedAt: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface VerificationSession {
  id: string;
  sessionCode: string;
  title: string;
  businessId: string;
  branchId: string;
  categoryId: string;
  scheduledDate: string;
  auditorName: string;
  totalExpected: number;
  verifiedCount: number;
  missingCount: number;
  damagedCount: number;
  relocatedCount: number;
  unregisteredCount: number;
  status: 'OPEN' | 'IN_PROGRESS' | 'RECONCILED' | 'CLOSED';
  notes: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface DepreciationRun {
  id: string;
  runCode: string;
  fiscalYear: number;
  periodMonth: number;
  periodLabel: string;
  businessId: string;
  categoryId: string;
  assetCount: number;
  openingCostCents: number;
  additionsCents: number;
  periodDepreciationCents: number;
  taxDepreciationCents: number;
  closingAccumDepCents: number;
  closingNetBookValueCents: number;
  status: 'DRAFT' | 'REVIEWED' | 'APPROVED' | 'POSTED';
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  postedAt: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceRecord {
  id: string;
  ticketNumber: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  businessId: string;
  maintenanceType: 'PREVENTIVE' | 'CORRECTIVE' | 'OVERHAUL' | 'INSPECTION';
  vendorName: string;
  scheduledDate: string;
  completedDate: string;
  costCents: number;
  isCapitalImprovement: boolean;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetDisposal {
  id: string;
  disposalNumber: string;
  assetId: string;
  assetTag: string;
  assetName: string;
  businessId: string;
  disposalDate: string;
  disposalMethod: 'SALE' | 'SCRAP' | 'DONATION' | 'WRITE_OFF' | 'TRADE_IN';
  originalCostCents: number;
  accumDepAtDisposalCents: number;
  netBookValueAtDisposalCents: number;
  proceedsCents: number;
  gainLossCents: number;
  buyerOrRecipient: string;
  reason: string;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'EXECUTED' | 'REJECTED';
  approvedBy: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  journalNumber: string;
  postingDate: string;
  fiscalPeriod: string;
  businessId: string;
  costCenter: string;
  sourceModule: 'DEPRECIATION' | 'ACQUISITION' | 'TRANSFER' | 'DISPOSAL' | 'REVALUATION';
  referenceCode: string;
  debitAccount: string;
  creditAccount: string;
  amountCents: number;
  description: string;
  glReconciled: boolean;
  status: 'DRAFT' | 'APPROVED' | 'EXPORTED';
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalRequest {
  id: string;
  requestCode: string;
  workflowType:
    | 'ASSET_CAPITALIZATION'
    | 'INTERCOMPANY_TRANSFER'
    | 'DEPRECIATION_POSTING'
    | 'ASSET_DISPOSAL'
    | 'VALUATION_ADJUSTMENT';
  targetEntityId: string;
  targetLabel: string;
  businessId: string;
  amountCents: number;
  requestedBy: string;
  requiredRole: string;
  currentStep: number;
  totalSteps: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  decisionNotes: string;
  ownerUid: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  eventTimestamp: string;
  actorEmail: string;
  actorRole: string;
  module: string;
  action: string;
  entityId: string;
  entityReference: string;
  summary: string;
  ownerUid: string;
  createdAt: string;
}

export type NavigationTab =
  | 'dashboard'
  | 'assets'
  | 'categories'
  | 'tagging'
  | 'verification'
  | 'depreciation'
  | 'transfers'
  | 'maintenance'
  | 'disposals'
  | 'reports'
  | 'reconciliation'
  | 'approvals'
  | 'organization'
  | 'users'
  | 'audit'
  | 'settings';

export interface RolePermissionMatrix {
  role: UserRole;
  label: string;
  scopeDescription: string;
  canViewAllBusinesses: boolean;
  canCreateAsset: boolean;
  canEditAsset: boolean;
  canApproveWorkflows: boolean;
  canInitiateTransfer: boolean;
  canDisposeAsset: boolean;
  canPostDepreciation: boolean;
  canExportReports: boolean;
  canManageOrgAndUsers: boolean;
}

export const ROLE_PERMISSIONS: Record<UserRole, RolePermissionMatrix> = {
  SUPER_ADMIN: {
    role: 'SUPER_ADMIN',
    label: 'Super Administrator / Head Office',
    scopeDescription: 'Consolidated group-wide authority across all businesses, regions, and ledgers.',
    canViewAllBusinesses: true,
    canCreateAsset: true,
    canEditAsset: true,
    canApproveWorkflows: true,
    canInitiateTransfer: true,
    canDisposeAsset: true,
    canPostDepreciation: true,
    canExportReports: true,
    canManageOrgAndUsers: true,
  },
  GROUP_FINANCE_MANAGER: {
    role: 'GROUP_FINANCE_MANAGER',
    label: 'Group Finance Manager',
    scopeDescription: 'Group-wide financial consolidation, depreciation posting, and GL reconciliation.',
    canViewAllBusinesses: true,
    canCreateAsset: true,
    canEditAsset: true,
    canApproveWorkflows: true,
    canInitiateTransfer: true,
    canDisposeAsset: true,
    canPostDepreciation: true,
    canExportReports: true,
    canManageOrgAndUsers: false,
  },
  BUSINESS_ADMIN: {
    role: 'BUSINESS_ADMIN',
    label: 'Business Administrator',
    scopeDescription: 'Full operational and asset governance within assigned subsidiary business.',
    canViewAllBusinesses: false,
    canCreateAsset: true,
    canEditAsset: true,
    canApproveWorkflows: true,
    canInitiateTransfer: true,
    canDisposeAsset: true,
    canPostDepreciation: false,
    canExportReports: true,
    canManageOrgAndUsers: false,
  },
  REGIONAL_MANAGER: {
    role: 'REGIONAL_MANAGER',
    label: 'Regional Manager',
    scopeDescription: 'Oversight of branches, transfers, and verifications in assigned regional zone.',
    canViewAllBusinesses: false,
    canCreateAsset: true,
    canEditAsset: true,
    canApproveWorkflows: true,
    canInitiateTransfer: true,
    canDisposeAsset: false,
    canPostDepreciation: false,
    canExportReports: true,
    canManageOrgAndUsers: false,
  },
  BRANCH_ASSET_OFFICER: {
    role: 'BRANCH_ASSET_OFFICER',
    label: 'Branch Asset Officer',
    scopeDescription: 'Day-to-day asset registration, tagging, physical verification, and maintenance.',
    canViewAllBusinesses: false,
    canCreateAsset: true,
    canEditAsset: true,
    canApproveWorkflows: false,
    canInitiateTransfer: true,
    canDisposeAsset: false,
    canPostDepreciation: false,
    canExportReports: true,
    canManageOrgAndUsers: false,
  },
  ACCOUNTANT: {
    role: 'ACCOUNTANT',
    label: 'Accountant',
    scopeDescription: 'Depreciation run preparation, subledger reconciliation, and journal exports.',
    canViewAllBusinesses: false,
    canCreateAsset: false,
    canEditAsset: true,
    canApproveWorkflows: false,
    canInitiateTransfer: false,
    canDisposeAsset: false,
    canPostDepreciation: true,
    canExportReports: true,
    canManageOrgAndUsers: false,
  },
  AUDITOR: {
    role: 'AUDITOR',
    label: 'Internal / External Auditor',
    scopeDescription: 'Group-wide verification audit, discrepancy review, and immutable trail inspection.',
    canViewAllBusinesses: true,
    canCreateAsset: false,
    canEditAsset: false,
    canApproveWorkflows: false,
    canInitiateTransfer: false,
    canDisposeAsset: false,
    canPostDepreciation: false,
    canExportReports: true,
    canManageOrgAndUsers: false,
  },
  READ_ONLY_EXECUTIVE: {
    role: 'READ_ONLY_EXECUTIVE',
    label: 'Read-Only Executive',
    scopeDescription: 'Executive visibility into consolidated KPIs, NBV schedules, and reports.',
    canViewAllBusinesses: true,
    canCreateAsset: false,
    canEditAsset: false,
    canApproveWorkflows: false,
    canInitiateTransfer: false,
    canDisposeAsset: false,
    canPostDepreciation: false,
    canExportReports: true,
    canManageOrgAndUsers: false,
  },
};
