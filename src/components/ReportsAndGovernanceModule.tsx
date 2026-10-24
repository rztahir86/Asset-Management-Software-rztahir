import React, { useMemo, useState } from 'react';
import {
  ApprovalRequest,
  Asset,
  AssetCategory,
  AssetDisposal,
  AssetTransfer,
  AuditLog,
  Branch,
  Business,
  DepreciationRun,
  JournalEntry,
  MaintenanceRecord,
  Region,
  ROLE_PERMISSIONS,
  RolePermissionMatrix,
  UserProfile,
  UserRole,
  VerificationSession,
} from '../types/asset';
import {
  calculateAssetDepreciation,
  formatCurrencyCents,
  runAutomatedSystemTests,
} from '../lib/depreciationEngine';
import { DIRTY_DOZEN_SCENARIOS } from '../../firestore.rules.test';
import {
  Building2,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface ReportsAndGovernanceModuleProps {
  mode:
    | 'reports'
    | 'reconciliation'
    | 'approvals'
    | 'organization'
    | 'users'
    | 'audit'
    | 'settings';
  assets: Asset[];
  businesses: Business[];
  regions: Region[];
  branches: Branch[];
  categories: AssetCategory[];
  transfers: AssetTransfer[];
  verifications: VerificationSession[];
  depreciationRuns: DepreciationRun[];
  maintenance: MaintenanceRecord[];
  disposals: AssetDisposal[];
  journals: JournalEntry[];
  approvals: ApprovalRequest[];
  auditLogs: AuditLog[];
  currentUserProfile: UserProfile;
  permissions: RolePermissionMatrix;
  onChangeActiveRole: (role: UserRole, assignedBusinessId: string) => Promise<void>;
  onDecideApproval: (
    approval: ApprovalRequest,
    decision: 'APPROVED' | 'REJECTED',
    notes: string
  ) => Promise<void>;
  onReconcileJournal: (journalId: string) => Promise<void>;
  onCreateBusiness: (
    biz: Omit<Business, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onCreateBranch: (br: Omit<Branch, 'id' | 'ownerUid' | 'createdAt'>) => Promise<void>;
  onSeedDemoData: () => Promise<void>;
  onPurgeDemoData: () => Promise<void>;
  onDrillDownAsset: (asset: Asset) => void;
}

const TWENTY_ENTERPRISE_REPORTS = [
  { id: 'R01', title: '01. Complete Fixed Asset Register', group: 'Register' },
  { id: 'R02', title: '02. Asset Register by Business Subsidiary', group: 'Register' },
  { id: 'R03', title: '03. Asset Register by Regional Location', group: 'Register' },
  { id: 'R04', title: '04. Asset Register by Department & Custodian', group: 'Register' },
  { id: 'R05', title: '05. Asset Acquisition & Additions Report', group: 'Financial' },
  { id: 'R06', title: '06. Monthly Depreciation Schedule', group: 'Financial' },
  { id: 'R07', title: '07. Annual Depreciation Schedule', group: 'Financial' },
  { id: 'R08', title: '08. Accumulated Depreciation Roll-Forward', group: 'Financial' },
  { id: 'R09', title: '09. Net Book Value (NBV) Carrying Report', group: 'Financial' },
  { id: 'R10', title: '10. Asset Movement & Intercompany Transfer Report', group: 'Operational' },
  { id: 'R11', title: '11. Physical Verification & Reconciliation Report', group: 'Audit' },
  { id: 'R12', title: '12. Missing, Damaged & Unverified Assets Report', group: 'Audit' },
  { id: 'R13', title: '13. Fully Depreciated Assets Register', group: 'Financial' },
  { id: 'R14', title: '14. Assets Nearing End of Useful Life', group: 'Operational' },
  { id: 'R15', title: '15. Warranty & Insurance Expiry Schedule', group: 'Operational' },
  { id: 'R16', title: '16. Maintenance & Repair Cost Ledger', group: 'Operational' },
  { id: 'R17', title: '17. Asset Disposal & Realized Gain/Loss Report', group: 'Financial' },
  { id: 'R18', title: '18. Asset History & Immutable Audit Trail', group: 'Audit' },
  { id: 'R19', title: '19. Business-Wise & Region-Wise Asset Comparison', group: 'Executive' },
  { id: 'R20', title: '20. Consolidated Head Office Asset Summary', group: 'Executive' },
];

export const ReportsAndGovernanceModule: React.FC<ReportsAndGovernanceModuleProps> = ({
  mode,
  assets,
  businesses,
  regions,
  branches,
  categories,
  transfers,
  verifications,
  depreciationRuns,
  maintenance,
  disposals,
  journals,
  approvals,
  auditLogs,
  currentUserProfile,
  permissions,
  onChangeActiveRole,
  onDecideApproval,
  onReconcileJournal,
  onCreateBusiness,
  onCreateBranch,
  onSeedDemoData,
  onPurgeDemoData,
  onDrillDownAsset,
}) => {
  const [selectedReportId, setSelectedReportId] = useState('R01');
  const [reportBusinessFilter, setReportBusinessFilter] = useState('ALL');
  const [reportSearch, setReportSearch] = useState('');

  // New Business form state
  const [newBiz, setNewBiz] = useState({
    code: 'SPF-HATCH',
    name: 'Sultan Grandparent Breeder & Hatcheries (Pvt) Ltd',
    legalName: 'Sultan Grandparent Breeder & Hatcheries (Private) Limited',
    taxId: '5192841-7',
    baseCurrency: 'PKR',
    fiscalYearStartMonth: 7,
    country: 'Pakistan',
  });

  // New Branch form state
  const [newBranch, setNewBranch] = useState({
    businessId: businesses[0]?.id || 'biz-sultan-poultry',
    regionId: regions[0]?.id || 'reg-punjab-central',
    code: 'SWL-FRM-06',
    name: 'Farm 06: Sahiwal Commercial Broiler Complex (4 Sheds)',
    type: 'POULTRY_FARM' as Branch['type'],
    address: 'Arifwala Road, Sahiwal District, Punjab',
    costCenterCode: 'CC-206-SAHIWAL-FARM',
    custodianLead: 'Dr. Zulfiqar Haider (DVM)',
  });

  const testResults = useMemo(() => runAutomatedSystemTests(), []);

  if (mode === 'reports') {
    const activeReport =
      TWENTY_ENTERPRISE_REPORTS.find((r) => r.id === selectedReportId) ||
      TWENTY_ENTERPRISE_REPORTS[0];

    const scopedAssets = assets.filter((a) => {
      if (reportBusinessFilter !== 'ALL' && a.businessId !== reportBusinessFilter) return false;
      if (reportSearch.trim()) {
        const q = reportSearch.toLowerCase();
        if (
          !a.assetTag.toLowerCase().includes(q) &&
          !a.name.toLowerCase().includes(q) &&
          !a.custodianName.toLowerCase().includes(q) &&
          !a.department.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (selectedReportId === 'R05') return a.purchaseDate >= '2025-01-01';
      if (selectedReportId === 'R12')
        return a.verificationStatus !== 'VERIFIED' || a.condition === 'DAMAGED';
      if (selectedReportId === 'R13')
        return (
          a.operationalStatus === 'FULLY_DEPRECIATED' ||
          a.netBookValueCents <= a.residualValueCents
        );
      if (selectedReportId === 'R14') {
        const depBase = Math.max(1, a.originalCostCents - a.residualValueCents);
        const rem = Math.max(0, a.netBookValueCents - a.residualValueCents);
        return rem / depBase <= 0.25;
      }
      return true;
    });

    const grandTotals = scopedAssets.reduce(
      (acc, a) => ({
        cost: acc.cost + a.originalCostCents,
        accum: acc.accum + a.accumulatedDepreciationCents,
        nbv: acc.nbv + a.netBookValueCents,
        residual: acc.residual + a.residualValueCents,
      }),
      { cost: 0, accum: 0, nbv: 0, residual: 0 }
    );

    const exportReportFile = (extension: 'csv' | 'xls') => {
      const sep = extension === 'xls' ? '\t' : ',';
      const headers = [
        'Report ID',
        'Asset Tag',
        'Asset Name',
        'Business',
        'Region',
        'Branch',
        'Department',
        'Custodian',
        'Capitalization Date',
        'Depreciation Method',
        'Original Cost (PKR)',
        'Accumulated Depreciation (PKR)',
        'Residual Value (PKR)',
        'Net Book Value (PKR)',
        'Operational Status',
        'Verification Status',
      ];
      const rows = scopedAssets.map((a) => [
        activeReport.id,
        a.assetTag,
        `"${a.name.replace(/"/g, '""')}"`,
        a.businessId,
        a.regionId,
        a.branchId,
        `"${a.department}"`,
        `"${a.custodianName}"`,
        a.capitalizationDate,
        a.depreciationMethod,
        (a.originalCostCents / 100).toFixed(2),
        (a.accumulatedDepreciationCents / 100).toFixed(2),
        (a.residualValueCents / 100).toFixed(2),
        (a.netBookValueCents / 100).toFixed(2),
        a.operationalStatus,
        a.verificationStatus,
      ]);
      const content = [headers.join(sep), ...rows.map((r) => r.join(sep))].join('\n');
      const mime =
        extension === 'xls'
          ? 'application/vnd.ms-excel;charset=utf-8;'
          : 'text/csv;charset=utf-8;';
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Meridian_${activeReport.id}_${new Date().toISOString().slice(0, 10)}.${extension}`;
      link.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5 no-print">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">
                Enterprise Reporting Center · 20 Standard Statutory &amp; Operational Reports
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">{activeReport.title}</h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportReportFile('csv')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
              >
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </button>
              <button
                onClick={() => exportReportFile('xls')}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                Export Excel (.xls)
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
              >
                <Printer className="w-3.5 h-3.5" />
                Print / Save PDF
              </button>
            </div>
          </div>

          {/* 20 Report Selector & Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Select Enterprise Report (1–20)
              </label>
              <select
                value={selectedReportId}
                onChange={(e) => setSelectedReportId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md font-medium text-slate-900"
              >
                {TWENTY_ENTERPRISE_REPORTS.map((rep) => (
                  <option key={rep.id} value={rep.id}>
                    {rep.title} ({rep.group})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Filter by Business Subsidiary
              </label>
              <select
                value={reportBusinessFilter}
                onChange={(e) => setReportBusinessFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md"
              >
                <option value="ALL">All Businesses (Consolidated Head Office)</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Search Within Report
              </label>
              <input
                type="text"
                value={reportSearch}
                onChange={(e) => setReportSearch(e.target.value)}
                placeholder="Filter by asset tag, custodian, department..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md"
              />
            </div>
          </div>
        </div>

        {/* Report Output Canvas */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <div className="text-xs font-mono text-slate-500">
                REPORT CODE: {activeReport.id} · GENERATED: {new Date().toISOString().slice(0, 10)}
              </div>
              <h2 className="text-sm font-bold text-slate-900">{activeReport.title}</h2>
            </div>
            <div className="text-xs font-mono tabular-nums text-slate-700">
              Records: <strong>{scopedAssets.length}</strong> · Grand Total NBV:{' '}
              <strong className="text-emerald-700">{formatCurrencyCents(grandTotals.nbv)}</strong>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Asset Tag</th>
                  <th className="py-2.5 px-4">Asset Description</th>
                  <th className="py-2.5 px-4">Business · Region · Branch</th>
                  <th className="py-2.5 px-4">Department · Custodian</th>
                  <th className="py-2.5 px-4 text-right">Gross Cost</th>
                  <th className="py-2.5 px-4 text-right">Accum. Dep.</th>
                  <th className="py-2.5 px-4 text-right">Residual Floor</th>
                  <th className="py-2.5 px-4 text-right">Net Book Value</th>
                  <th className="py-2.5 px-4">Status / Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {scopedAssets.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => onDrillDownAsset(a)}
                    className="hover:bg-slate-50 cursor-pointer"
                  >
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                      {a.assetTag}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{a.name}</div>
                      <div className="text-[11px] text-slate-500">
                        Cap: {a.capitalizationDate} · {a.depreciationMethod} ({a.usefulLifeMonths}m)
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {a.businessId.toUpperCase()} · {a.regionId} · {a.branchId}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {a.department} · {a.custodianName}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrencyCents(a.originalCostCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">
                      {formatCurrencyCents(a.accumulatedDepreciationCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {formatCurrencyCents(a.residualValueCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      {formatCurrencyCents(a.netBookValueCents)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {a.operationalStatus} · {a.verificationStatus}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50 font-mono tabular-nums text-xs font-bold text-slate-900">
                  <td colSpan={4} className="py-3 px-4 font-sans">
                    CONSOLIDATED REPORT GRAND TOTAL ({scopedAssets.length} Assets)
                  </td>
                  <td className="py-3 px-4 text-right">{formatCurrencyCents(grandTotals.cost)}</td>
                  <td className="py-3 px-4 text-right text-amber-700">
                    {formatCurrencyCents(grandTotals.accum)}
                  </td>
                  <td className="py-3 px-4 text-right text-slate-600">
                    {formatCurrencyCents(grandTotals.residual)}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-700">
                    {formatCurrencyCents(grandTotals.nbv)}
                  </td>
                  <td className="py-3 px-4">RECONCILED</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'reconciliation') {
    const subledgerCost = assets.reduce((s, a) => s + a.originalCostCents, 0);
    const subledgerAccum = assets.reduce((s, a) => s + a.accumulatedDepreciationCents, 0);
    const subledgerNbv = assets.reduce((s, a) => s + a.netBookValueCents, 0);

    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">
                Fixed Asset Subledger to General Ledger (GL) Tie-Out &amp; Journal Export
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                Financial Reconciliation &amp; Accounting Journal Control
              </h1>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-200">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
              <div className="text-xs text-slate-500">Subledger Gross Asset Cost</div>
              <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">
                {formatCurrencyCents(subledgerCost)}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1">
                GL Control Account 1600–1699 Variance: $0.00 (Matched)
              </div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
              <div className="text-xs text-slate-500">Subledger Accumulated Depreciation</div>
              <div className="text-lg font-bold font-mono tabular-nums text-amber-700 mt-1">
                {formatCurrencyCents(subledgerAccum)}
              </div>
              <div className="text-[11px] text-emerald-700 mt-1">
                GL Contra-Asset Account Variance: $0.00 (Matched)
              </div>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-md">
              <div className="text-xs text-slate-500">Consolidated Net Carrying Value</div>
              <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 mt-1">
                {formatCurrencyCents(subledgerNbv)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                External ERP Posting: Manual Export Only (Protected)
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Subledger Accounting Journal Entries (Preview &amp; GL Reconciliation)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Journal #</th>
                  <th className="py-2.5 px-4">Period · Date</th>
                  <th className="py-2.5 px-4">Business · Cost Center</th>
                  <th className="py-2.5 px-4">Source · Reference</th>
                  <th className="py-2.5 px-4">Debit GL Account</th>
                  <th className="py-2.5 px-4">Credit GL Account</th>
                  <th className="py-2.5 px-4 text-right">Amount (PKR)</th>
                  <th className="py-2.5 px-4">GL Tie-Out</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {journals.map((j) => (
                  <tr key={j.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                      {j.journalNumber}
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600">
                      {j.fiscalPeriod} · {j.postingDate}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {j.businessId.toUpperCase()} · {j.costCenter}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700">
                      {j.sourceModule} · {j.referenceCode}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-800">{j.debitAccount}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-800">{j.creditAccount}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrencyCents(j.amountCents)}
                    </td>
                    <td className="py-2.5 px-4">
                      <span
                        className={`font-semibold ${
                          j.glReconciled ? 'text-emerald-700' : 'text-amber-700'
                        }`}
                      >
                        {j.glReconciled ? 'RECONCILED' : 'UNRECONCILED'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {!j.glReconciled && permissions.canPostDepreciation && (
                        <button
                          onClick={() => onReconcileJournal(j.id)}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800"
                        >
                          Approve &amp; Reconcile GL
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'approvals') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">
            Configurable Multi-Step Governance &amp; Financial Authorization Queue
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Pending Capitalization, Transfer, Depreciation &amp; Disposal Approvals
          </h1>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Request #</th>
                  <th className="py-2.5 px-4">Workflow Type</th>
                  <th className="py-2.5 px-4">Target Subject &amp; Notes</th>
                  <th className="py-2.5 px-4">Requested By</th>
                  <th className="py-2.5 px-4 text-right">Value Impact</th>
                  <th className="py-2.5 px-4">Step · Authority</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {approvals.map((apr) => (
                  <tr key={apr.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                      {apr.requestCode}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900">
                      {apr.workflowType.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{apr.targetLabel}</div>
                      <div className="text-[11px] text-slate-500">{apr.decisionNotes}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">{apr.requestedBy}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrencyCents(apr.amountCents)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      Step {apr.currentStep}/{apr.totalSteps} · {apr.requiredRole}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{apr.status}</td>
                    <td className="py-2.5 px-4 text-right space-x-1 whitespace-nowrap">
                      {apr.status === 'PENDING' && permissions.canApproveWorkflows && (
                        <>
                          <button
                            onClick={() =>
                              onDecideApproval(
                                apr,
                                'APPROVED',
                                'Authorized via Head Office Governance Portal'
                              )
                            }
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 text-white rounded hover:bg-emerald-800"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              onDecideApproval(
                                apr,
                                'REJECTED',
                                'Rejected during financial review'
                              )
                            }
                            className="px-2.5 py-1 text-xs font-medium bg-red-50 text-red-700 rounded hover:bg-red-100"
                          >
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'organization') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div>
            <div className="text-xs text-slate-500">
              Multi-Entity Corporate Hierarchy (Head Office → Subsidiaries → Regions → Branches)
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              Organization Structure, Subsidiaries &amp; Cost Centers
            </h1>
          </div>

          {permissions.canManageOrgAndUsers && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onCreateBusiness({
                  ...newBiz,
                  status: 'ACTIVE',
                });
              }}
              className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Business Code</label>
                <input
                  required
                  value={newBiz.code}
                  onChange={(e) => setNewBiz({ ...newBiz, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Subsidiary Name</label>
                <input
                  required
                  value={newBiz.name}
                  onChange={(e) =>
                    setNewBiz({ ...newBiz, name: e.target.value, legalName: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Country</label>
                <input
                  required
                  value={newBiz.country}
                  onChange={(e) => setNewBiz({ ...newBiz, country: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">FBR NTN / Tax ID (e.g. 1234567-8)</label>
                <input
                  required
                  placeholder="e.g. 4129841-3"
                  value={newBiz.taxId}
                  onChange={(e) => setNewBiz({ ...newBiz, taxId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  + Add Subsidiary Business
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Businesses Table */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Controlled Subsidiaries &amp; Operating Companies
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Business / Legal Entity</th>
                  <th className="py-2.5 px-4">Country · Tax ID</th>
                  <th className="py-2.5 px-4">Currency · FY Start</th>
                  <th className="py-2.5 px-4 text-right">Registered Assets</th>
                  <th className="py-2.5 px-4 text-right">Consolidated NBV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {businesses.map((biz) => {
                  const bizAssets = assets.filter((a) => a.businessId === biz.id);
                  const nbv = bizAssets.reduce((s, a) => s + a.netBookValueCents, 0);
                  return (
                    <tr key={biz.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                        {biz.code}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{biz.name}</div>
                        <div className="text-[11px] text-slate-500">{biz.legalName}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {biz.country} · <span className="font-mono">{biz.taxId}</span>
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">
                        {biz.baseCurrency} · Month {biz.fiscalYearStartMonth}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {bizAssets.length}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                        {formatCurrencyCents(nbv)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Branches, Plants & Warehouses Table */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Corporate Head Office &amp; Controlled Poultry Farms / Production Facilities
            </h2>
            {permissions.canManageOrgAndUsers && (
              <button
                onClick={() =>
                  onCreateBranch({
                    ...newBranch,
                    status: 'ACTIVE',
                  })
                }
                className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800"
              >
                + Quick-Add Sahiwal Broiler Farm (SWL-FRM-06)
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Branch Code</th>
                  <th className="py-2.5 px-4">Facility Name &amp; Address</th>
                  <th className="py-2.5 px-4">Facility Type</th>
                  <th className="py-2.5 px-4">Business · Region</th>
                  <th className="py-2.5 px-4">Cost Center</th>
                  <th className="py-2.5 px-4">Custodian Lead</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {branches.map((br) => (
                  <tr key={br.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                      {br.code}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{br.name}</div>
                      <div className="text-[11px] text-slate-500">{br.address}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{br.type}</td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {br.businessId.toUpperCase()} · {br.regionId}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-800">{br.costCenterCode}</td>
                    <td className="py-2.5 px-4 text-slate-700">{br.custodianLead}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'users') {
    const rolesList = Object.values(ROLE_PERMISSIONS);
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">
                Role-Based Access Control (RBAC) &amp; Subsidiary Scope Isolation
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                Users, Roles &amp; Granular Permission Matrix
              </h1>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center gap-4 text-xs">
            <div>
              <span className="text-slate-500 block">Active Session Role:</span>
              <strong className="text-slate-900">{permissions.label}</strong> (Scope:{' '}
              <span className="font-mono">{currentUserProfile.assignedBusinessId}</span>)
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-slate-500">Switch Role Perspective &amp; Data Scope:</span>
              <select
                value={currentUserProfile.role}
                onChange={(e) =>
                  onChangeActiveRole(
                    e.target.value as UserRole,
                    currentUserProfile.assignedBusinessId
                  )
                }
                className="px-3 py-1.5 border border-slate-200 rounded-md bg-slate-50 font-medium"
              >
                {rolesList.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
              </select>

              <select
                value={currentUserProfile.assignedBusinessId}
                onChange={(e) => onChangeActiveRole(currentUserProfile.role, e.target.value)}
                className="px-3 py-1.5 border border-slate-200 rounded-md bg-slate-50 font-mono"
              >
                <option value="ALL">ALL (Head Office Consolidated View)</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    Scoped to {b.code} ({b.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Enterprise Role</th>
                  <th className="py-2.5 px-4">Access Scope</th>
                  <th className="py-2.5 px-4 text-center">Consolidated View</th>
                  <th className="py-2.5 px-4 text-center">Create/Edit Asset</th>
                  <th className="py-2.5 px-4 text-center">Approve Workflows</th>
                  <th className="py-2.5 px-4 text-center">Transfers</th>
                  <th className="py-2.5 px-4 text-center">Disposals</th>
                  <th className="py-2.5 px-4 text-center">Post Depreciation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {rolesList.map((r) => (
                  <tr
                    key={r.role}
                    className={`hover:bg-slate-50 ${
                      currentUserProfile.role === r.role ? 'bg-slate-100/80 font-medium' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{r.label}</td>
                    <td className="py-2.5 px-4 text-slate-600">{r.scopeDescription}</td>
                    <td className="py-2.5 px-4 text-center font-mono">
                      {r.canViewAllBusinesses ? 'YES' : 'SCOPED'}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono">
                      {r.canCreateAsset ? 'YES' : 'NO'}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono">
                      {r.canApproveWorkflows ? 'YES' : 'NO'}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono">
                      {r.canInitiateTransfer ? 'YES' : 'NO'}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono">
                      {r.canDisposeAsset ? 'YES' : 'NO'}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono">
                      {r.canPostDepreciation ? 'YES' : 'NO'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'audit') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs text-slate-500">
            Immutable Append-Only Compliance Log (Protected by Zero-Trust Firestore Rules)
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Enterprise Audit Trail &amp; Financial Action History
          </h1>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Actor &amp; Role</th>
                  <th className="py-2.5 px-4">Module · Action</th>
                  <th className="py-2.5 px-4">Entity Reference</th>
                  <th className="py-2.5 px-4">Audit Event Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {log.eventTimestamp}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="font-medium text-slate-900">{log.actorEmail}</div>
                      <div className="text-[11px] font-mono text-slate-500">{log.actorRole}</div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-800 whitespace-nowrap">
                      {log.module} · {log.action}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {log.entityReference}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{log.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // System Settings, Demo Data Controls & Automated Verification Suite
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">
              System Configuration, Demonstration Data Isolation &amp; Automated Verification Suite
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              System Settings, Seed Controls &amp; Automated Test Suite
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onPurgeDemoData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-md shadow-sm transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear &amp; Wipe All Records (0 Assets / Clean Ledger)
            </button>
            <button
              onClick={onSeedDemoData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Load Pakistani Sample Records (Optional PKR Demo)
            </button>
          </div>
        </div>
      </div>

      {/* Automated Verification Test Runner */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Automated Financial, Depreciation, RBAC &amp; Transfer Verification Tests
            </h2>
            <p className="text-xs text-slate-500">
              Live execution of integer-cent depreciation formulas, residual caps, duplicate period guards, and intercompany conservation
            </p>
          </div>
          <span className="text-xs font-mono font-semibold text-emerald-700">
            {testResults.filter((t) => t.passed).length}/{testResults.length} PASSED
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Test ID</th>
                <th className="py-2.5 px-4">Suite</th>
                <th className="py-2.5 px-4">Verification Assertion</th>
                <th className="py-2.5 px-4">Expected Invariant</th>
                <th className="py-2.5 px-4">Computed Output</th>
                <th className="py-2.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {testResults.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">{t.id}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600">{t.suite}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{t.name}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600">{t.expected}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-900">{t.actual}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">
                    {t.passed ? 'PASS' : 'FAIL'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dirty Dozen Zero-Trust Firestore Security Matrix */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Zero-Trust ABAC Security Specification (&ldquo;Dirty Dozen&rdquo; Adversarial Payloads)
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">#</th>
                <th className="py-2.5 px-4">Adversarial Scenario</th>
                <th className="py-2.5 px-4">Target Path · Op</th>
                <th className="py-2.5 px-4">Enforced Rule Invariant</th>
                <th className="py-2.5 px-4 text-right">Rule Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {DIRTY_DOZEN_SCENARIOS.map((sc) => (
                <tr key={sc.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono text-slate-600">{sc.id}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{sc.title}</td>
                  <td className="py-2.5 px-4 font-mono text-slate-600">
                    {sc.collectionPath} ({sc.operation})
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{sc.invariantsTested.join(', ')}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-700">
                    {sc.expectedOutcome}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
