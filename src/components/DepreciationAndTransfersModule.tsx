import React, { useMemo, useState } from 'react';
import {
  Asset,
  AssetCategory,
  AssetDisposal,
  AssetTransfer,
  Branch,
  Business,
  DepreciationRun,
  MaintenanceRecord,
  Region,
  RolePermissionMatrix,
  TransferStatus,
} from '../types/asset';
import {
  calculateAssetDepreciation,
  formatCurrencyCents,
  parseDollarsToCents,
} from '../lib/depreciationEngine';
import { AlertCircle, ArrowRightLeft, Calculator, Check, Play, Wrench } from 'lucide-react';

interface DepreciationAndTransfersModuleProps {
  mode: 'depreciation' | 'transfers' | 'maintenance' | 'disposals';
  assets: Asset[];
  businesses: Business[];
  regions: Region[];
  branches: Branch[];
  categories: AssetCategory[];
  depreciationRuns: DepreciationRun[];
  transfers: AssetTransfer[];
  maintenance: MaintenanceRecord[];
  disposals: AssetDisposal[];
  permissions: RolePermissionMatrix;
  actorName: string;
  onExecuteDepreciationRun: (
    fiscalYear: number,
    periodMonth: number,
    businessId: string,
    categoryId: string,
    mode: 'MONTHLY' | 'ANNUAL'
  ) => Promise<void>;
  onAdvanceDepreciationRunStatus: (
    run: DepreciationRun,
    nextStatus: DepreciationRun['status']
  ) => Promise<void>;
  onManualValuationAdjustment: (
    assetId: string,
    impairmentDollars: string,
    revaluationDollars: string,
    reason: string
  ) => Promise<void>;
  onCreateTransfer: (
    transfer: Omit<AssetTransfer, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onAdvanceTransferStatus: (
    transfer: AssetTransfer,
    nextStatus: TransferStatus
  ) => Promise<void>;
  onCreateMaintenance: (
    rec: Omit<MaintenanceRecord, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onCompleteMaintenance: (rec: MaintenanceRecord) => Promise<void>;
  onCreateDisposal: (
    dsp: Omit<AssetDisposal, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onExecuteDisposal: (dsp: AssetDisposal) => Promise<void>;
}

export const DepreciationAndTransfersModule: React.FC<DepreciationAndTransfersModuleProps> = ({
  mode,
  assets,
  businesses,
  regions,
  branches,
  categories,
  depreciationRuns,
  transfers,
  maintenance,
  disposals,
  permissions,
  actorName,
  onExecuteDepreciationRun,
  onAdvanceDepreciationRunStatus,
  onManualValuationAdjustment,
  onCreateTransfer,
  onAdvanceTransferStatus,
  onCreateMaintenance,
  onCompleteMaintenance,
  onCreateDisposal,
  onExecuteDisposal,
}) => {
  // Depreciation Engine controls
  const [fiscalYear, setFiscalYear] = useState(2026);
  const [periodMonth, setPeriodMonth] = useState(11);
  const [depBusinessFilter, setDepBusinessFilter] = useState('ALL');
  const [depCategoryFilter, setDepCategoryFilter] = useState('ALL');
  const [depCycleMode, setDepCycleMode] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [runError, setRunError] = useState<string | null>(null);

  // Manual Valuation Adjustment state
  const [adjAssetId, setAdjAssetId] = useState(assets[0]?.id || '');
  const [impairmentDollars, setImpairmentDollars] = useState('0.00');
  const [revaluationDollars, setRevaluationDollars] = useState('0.00');
  const [adjReason, setAdjReason] = useState('Annual IAS 36 Impairment & Fair Value Review');

  // Transfer Form state
  const [trfForm, setTrfForm] = useState({
    assetId: assets[0]?.id || '',
    toBusinessId: businesses[1]?.id || businesses[0]?.id || 'biz-sultan-feed',
    toRegionId: regions[1]?.id || regions[0]?.id || 'reg-punjab-north',
    toBranchId: branches[2]?.id || branches[0]?.id || 'br-okr-frm-03',
    toDepartment: 'Layer Flock Operations',
    toCustodian: 'Dr. Farooq Malik (DVM)',
    transferDate: '2026-10-20',
    reason: 'Strategic deployment of climate control automation and standby power to Farm 03.',
  });

  // Maintenance Form state
  const [mntForm, setMntForm] = useState({
    assetId: assets[0]?.id || '',
    maintenanceType: 'PREVENTIVE' as MaintenanceRecord['maintenanceType'],
    vendorName: 'Big Dutchman Agri Services Pakistan',
    scheduledDate: '2026-10-25',
    costDollars: '280000.00',
    isCapitalImprovement: false,
    notes: 'Scheduled 500-hour preventive generator service & automated feeding auger calibration.',
  });

  // Disposal Form state
  const [dspForm, setDspForm] = useState({
    assetId: assets[0]?.id || '',
    disposalDate: '2026-10-28',
    disposalMethod: 'SALE' as AssetDisposal['disposalMethod'],
    proceedsDollars: '850000.00',
    buyerOrRecipient: 'Pak Agro Equipment Traders, Multan Road Lahore',
    reason: 'End of economic lifecycle replacement under Group Farm Modernization Program.',
  });

  const previews = useMemo(() => {
    const eligible = assets.filter((a) => {
      if (depBusinessFilter !== 'ALL' && a.businessId !== depBusinessFilter) return false;
      if (depCategoryFilter !== 'ALL' && a.categoryId !== depCategoryFilter) return false;
      return true;
    });
    return eligible.map((asset) => {
      const cat = categories.find((c) => c.id === asset.categoryId);
      return calculateAssetDepreciation(asset, cat, depCycleMode);
    });
  }, [assets, categories, depBusinessFilter, depCategoryFilter, depCycleMode]);

  const previewTotals = useMemo(() => {
    return previews.reduce(
      (acc, p) => ({
        openingCost: acc.openingCost + p.openingCostCents,
        openingNbv: acc.openingNbv + p.openingNetBookValueCents,
        periodAccDep: acc.periodAccDep + p.periodAccountingDepreciationCents,
        periodTaxDep: acc.periodTaxDep + p.periodTaxDepreciationCents,
        closingAccum: acc.closingAccum + p.closingAccumDepCents,
        closingNbv: acc.closingNbv + p.closingNetBookValueCents,
      }),
      {
        openingCost: 0,
        openingNbv: 0,
        periodAccDep: 0,
        periodTaxDep: 0,
        closingAccum: 0,
        closingNbv: 0,
      }
    );
  }, [previews]);

  if (mode === 'depreciation') {
    return (
      <div className="space-y-6">
        {/* Automated Depreciation Engine Control Panel */}
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="text-xs text-slate-500">
                Multi-Standard Book (IFRS/GAAP) &amp; Statutory Tax Depreciation Engine
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                Automated Depreciation Calculation, Preview &amp; Period Posting
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                <button
                  onClick={() => setDepCycleMode('MONTHLY')}
                  className={`px-3 py-1.5 text-xs font-medium rounded ${
                    depCycleMode === 'MONTHLY'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  Monthly Period Run
                </button>
                <button
                  onClick={() => setDepCycleMode('ANNUAL')}
                  className={`px-3 py-1.5 text-xs font-medium rounded ${
                    depCycleMode === 'ANNUAL'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600'
                  }`}
                >
                  Full-Year Schedule
                </button>
              </div>

              {permissions.canPostDepreciation && (
                <button
                  onClick={async () => {
                    setRunError(null);
                    const duplicate = depreciationRuns.some(
                      (r) =>
                        r.fiscalYear === fiscalYear &&
                        r.periodMonth === periodMonth &&
                        r.businessId === depBusinessFilter
                    );
                    if (duplicate) {
                      setRunError(
                        `Duplicate Depreciation Run Blocked: Period FY${fiscalYear} M${String(
                          periodMonth
                        ).padStart(2, '0')} for scope "${depBusinessFilter}" already exists.`
                      );
                      return;
                    }
                    await onExecuteDepreciationRun(
                      fiscalYear,
                      periodMonth,
                      depBusinessFilter,
                      depCategoryFilter,
                      depCycleMode
                    );
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  Generate Draft Depreciation Run
                </button>
              )}
            </div>
          </div>

          {runError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{runError}</span>
            </div>
          )}

          {/* Parameters & Summary Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4 text-xs">
            <div>
              <label className="block font-medium text-slate-600 mb-1">Fiscal Year</label>
              <input
                type="number"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(parseInt(e.target.value, 10) || 2026)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600 mb-1">Period Month (1–12)</label>
              <input
                type="number"
                min="1"
                max="12"
                value={periodMonth}
                onChange={(e) => setPeriodMonth(parseInt(e.target.value, 10) || 11)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-600 mb-1">Business Scope</label>
              <select
                value={depBusinessFilter}
                onChange={(e) => setDepBusinessFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md"
              >
                <option value="ALL">All Group Businesses (Consolidated)</option>
                {businesses.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-600 mb-1">Category Policy Filter</label>
              <select
                value={depCategoryFilter}
                onChange={(e) => setDepCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md"
              >
                <option value="ALL">All Asset Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Live Pre-Posting Depreciation Schedule Preview */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Pre-Posting Depreciation Calculation Preview ({depCycleMode})
              </h2>
              <p className="text-xs text-slate-500">
                Exact integer-cent computation respecting residual floors, impairment, and tax vs. accounting separation
              </p>
            </div>
            <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
              <span>
                Book Expense:{' '}
                <strong className="text-amber-700">
                  {formatCurrencyCents(previewTotals.periodAccDep)}
                </strong>
              </span>
              <span>
                Tax Allowance:{' '}
                <strong className="text-blue-700">
                  {formatCurrencyCents(previewTotals.periodTaxDep)}
                </strong>
              </span>
              <span>
                Closing NBV:{' '}
                <strong className="text-emerald-700">
                  {formatCurrencyCents(previewTotals.closingNbv)}
                </strong>
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Asset Tag &amp; Name</th>
                  <th className="py-2.5 px-4">Method &amp; Formula Trace</th>
                  <th className="py-2.5 px-4 text-right">Capitalized Cost</th>
                  <th className="py-2.5 px-4 text-right">Residual Floor</th>
                  <th className="py-2.5 px-4 text-right">Opening NBV</th>
                  <th className="py-2.5 px-4 text-right">Book Dep. Expense</th>
                  <th className="py-2.5 px-4 text-right">Tax Dep. Expense</th>
                  <th className="py-2.5 px-4 text-right">Closing Accum. Dep.</th>
                  <th className="py-2.5 px-4 text-right">Closing NBV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {previews.map((p) => (
                  <tr key={p.assetId} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4">
                      <div className="font-mono font-semibold text-slate-900">{p.assetTag}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">
                        {p.assetName}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-800">
                        {p.method.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[11px] font-mono text-slate-500">
                        {p.calculationFormulaNote}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrencyCents(p.openingCostCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                      {formatCurrencyCents(p.residualValueCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrencyCents(p.openingNetBookValueCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-amber-700">
                      {formatCurrencyCents(p.periodAccountingDepreciationCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-700">
                      {formatCurrencyCents(p.periodTaxDepreciationCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                      {formatCurrencyCents(p.closingAccumDepCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-emerald-700">
                      {formatCurrencyCents(p.closingNetBookValueCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Posted & Pending Depreciation Runs Workflow Table */}
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-sm font-semibold text-slate-900">
              Depreciation Run Register (Draft → Reviewed → Approved → Posted)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Run Code</th>
                  <th className="py-2.5 px-4">Fiscal Period</th>
                  <th className="py-2.5 px-4">Scope · Assets</th>
                  <th className="py-2.5 px-4 text-right">Opening Cost</th>
                  <th className="py-2.5 px-4 text-right">Book Dep. Expense</th>
                  <th className="py-2.5 px-4 text-right">Tax Dep. Allowance</th>
                  <th className="py-2.5 px-4 text-right">Closing NBV</th>
                  <th className="py-2.5 px-4">Workflow Status</th>
                  <th className="py-2.5 px-4 text-right">Governance Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {depreciationRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                      {run.runCode}
                    </td>
                    <td className="py-2.5 px-4 text-slate-900">{run.periodLabel}</td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {run.businessId} · {run.assetCount} assets
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                      {formatCurrencyCents(run.openingCostCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-amber-700">
                      {formatCurrencyCents(run.periodDepreciationCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-700">
                      {formatCurrencyCents(run.taxDepreciationCents)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      {formatCurrencyCents(run.closingNetBookValueCents)}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{run.status}</td>
                    <td className="py-2.5 px-4 text-right whitespace-nowrap">
                      {permissions.canPostDepreciation && run.status === 'DRAFT' && (
                        <button
                          onClick={() => onAdvanceDepreciationRunStatus(run, 'REVIEWED')}
                          className="px-2.5 py-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-800 rounded"
                        >
                          Mark Reviewed
                        </button>
                      )}
                      {permissions.canApproveWorkflows && run.status === 'REVIEWED' && (
                        <button
                          onClick={() => onAdvanceDepreciationRunStatus(run, 'APPROVED')}
                          className="px-2.5 py-1 text-xs font-medium bg-blue-50 hover:bg-blue-100 text-blue-800 rounded"
                        >
                          Approve Run
                        </button>
                      )}
                      {permissions.canPostDepreciation && run.status === 'APPROVED' && (
                        <button
                          onClick={() => onAdvanceDepreciationRunStatus(run, 'POSTED')}
                          className="px-2.5 py-1 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded"
                        >
                          Post to Subledger &amp; GL
                        </button>
                      )}
                      {run.status === 'POSTED' && (
                        <span className="text-[11px] font-mono text-emerald-700">
                          Locked · {run.postedAt || 'Posted'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Manual Valuation Adjustment (Impairment & Revaluation with Audit Trail) */}
        {permissions.canPostDepreciation && (
          <div className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-slate-900">
              Authorized Manual Valuation Adjustment (IAS 36 Impairment / IAS 16 Revaluation)
            </h2>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!adjAssetId) return;
                await onManualValuationAdjustment(
                  adjAssetId,
                  impairmentDollars,
                  revaluationDollars,
                  adjReason
                );
              }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Target Asset</label>
                <select
                  value={adjAssetId}
                  onChange={(e) => setAdjAssetId(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetTag} — {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Impairment Loss (PKR / Rs.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={impairmentDollars}
                  onChange={(e) => setImpairmentDollars(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Revaluation Surplus (PKR / Rs.)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={revaluationDollars}
                  onChange={(e) => setRevaluationDollars(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Authorization &amp; Audit Justification
                </label>
                <input
                  required
                  value={adjReason}
                  onChange={(e) => setAdjReason(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  Apply Valuation Adjustment
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  if (mode === 'transfers') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div>
            <div className="text-xs text-slate-500">
              Inter-Branch, Regional &amp; Intercompany Asset Movement Workflow
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              Asset Transfers, Transit Tracking &amp; Intercompany Clearing
            </h1>
          </div>

          {permissions.canInitiateTransfer && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const asset = assets.find((a) => a.id === trfForm.assetId);
                if (!asset) return;
                const isIntercompany = asset.businessId !== trfForm.toBusinessId;
                await onCreateTransfer({
                  transferNumber: `TRF-2026-${String(transfers.length + 45).padStart(4, '0')}`,
                  assetId: asset.id,
                  assetTag: asset.assetTag,
                  assetName: asset.name,
                  fromBusinessId: asset.businessId,
                  toBusinessId: trfForm.toBusinessId,
                  fromRegionId: asset.regionId,
                  toRegionId: trfForm.toRegionId,
                  fromBranchId: asset.branchId,
                  toBranchId: trfForm.toBranchId,
                  fromDepartment: asset.department,
                  toDepartment: trfForm.toDepartment,
                  fromCustodian: asset.custodianName,
                  toCustodian: trfForm.toCustodian,
                  transferDate: trfForm.transferDate,
                  reason: trfForm.reason,
                  isIntercompany,
                  transferNetBookValueCents: asset.netBookValueCents,
                  status: 'PENDING_APPROVAL',
                  requestedByName: actorName,
                  approvedByName: '',
                  dispatchConfirmedAt: '',
                  receivedConfirmedAt: '',
                });
              }}
              className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Select Asset *</label>
                <select
                  value={trfForm.assetId}
                  onChange={(e) => setTrfForm({ ...trfForm, assetId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetTag} — {a.name} ({a.businessId})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Destination Business *
                </label>
                <select
                  value={trfForm.toBusinessId}
                  onChange={(e) => setTrfForm({ ...trfForm, toBusinessId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.code} — {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Destination Branch *
                </label>
                <select
                  value={trfForm.toBranchId}
                  onChange={(e) => {
                    const br = branches.find((b) => b.id === e.target.value);
                    setTrfForm({
                      ...trfForm,
                      toBranchId: e.target.value,
                      toRegionId: br?.regionId || trfForm.toRegionId,
                    });
                  }}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                >
                  {branches.map((br) => (
                    <option key={br.id} value={br.id}>
                      {br.code} — {br.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Receiving Custodian &amp; Dept *
                </label>
                <input
                  required
                  value={trfForm.toCustodian}
                  onChange={(e) => setTrfForm({ ...trfForm, toCustodian: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                />
              </div>
              <div className="sm:col-span-3">
                <label className="block font-medium text-slate-700 mb-1">
                  Transfer Justification &amp; Intercompany Clearing Note *
                </label>
                <input
                  required
                  value={trfForm.reason}
                  onChange={(e) => setTrfForm({ ...trfForm, reason: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  Submit Transfer Request
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Transfer #</th>
                  <th className="py-2.5 px-4">Asset Tag &amp; Name</th>
                  <th className="py-2.5 px-4">Source → Destination</th>
                  <th className="py-2.5 px-4">Custodian Handover</th>
                  <th className="py-2.5 px-4 text-right">Transfer NBV</th>
                  <th className="py-2.5 px-4">Treatment</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Workflow Step</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {transfers.map((trf) => (
                  <tr key={trf.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                      {trf.transferNumber}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-mono font-medium text-slate-900">{trf.assetTag}</div>
                      <div className="text-[11px] text-slate-500 truncate max-w-xs">
                        {trf.assetName}
                      </div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">
                        {trf.fromBusinessId.toUpperCase()} ({trf.fromBranchId}) →{' '}
                        {trf.toBusinessId.toUpperCase()} ({trf.toBranchId})
                      </div>
                      <div className="text-[11px] text-slate-500">{trf.reason}</div>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {trf.fromCustodian} → {trf.toCustodian}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrencyCents(trf.transferNetBookValueCents)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {trf.isIntercompany ? 'Intercompany GL' : 'Intra-Business'}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{trf.status}</td>
                    <td className="py-2.5 px-4 text-right space-x-1 whitespace-nowrap">
                      {trf.status === 'PENDING_APPROVAL' && permissions.canApproveWorkflows && (
                        <>
                          <button
                            onClick={() => onAdvanceTransferStatus(trf, 'APPROVED')}
                            className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-800 rounded hover:bg-blue-100"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => onAdvanceTransferStatus(trf, 'REJECTED')}
                            className="px-2 py-1 text-xs text-red-700 hover:bg-red-50 rounded"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {trf.status === 'APPROVED' && (
                        <button
                          onClick={() => onAdvanceTransferStatus(trf, 'IN_TRANSIT')}
                          className="px-2.5 py-1 text-xs font-medium bg-amber-50 text-amber-800 rounded hover:bg-amber-100"
                        >
                          Confirm Dispatch
                        </button>
                      )}
                      {trf.status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => onAdvanceTransferStatus(trf, 'RECEIVED')}
                          className="px-2.5 py-1 text-xs font-semibold bg-emerald-700 text-white rounded hover:bg-emerald-800"
                        >
                          Confirm Receipt &amp; Update Asset
                        </button>
                      )}
                      {trf.status === 'RECEIVED' && (
                        <span className="text-[11px] font-mono text-emerald-700">
                          Completed · {trf.receivedConfirmedAt || 'Received'}
                        </span>
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

  if (mode === 'maintenance') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div>
            <div className="text-xs text-slate-500">
              Preventive Service Schedules, Repairs &amp; Capital Improvements
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              Asset Maintenance &amp; Service Cost Ledger
            </h1>
          </div>

          {permissions.canEditAsset && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const asset = assets.find((a) => a.id === mntForm.assetId);
                if (!asset) return;
                await onCreateMaintenance({
                  ticketNumber: `MNT-2026-${String(maintenance.length + 901).padStart(4, '0')}`,
                  assetId: asset.id,
                  assetTag: asset.assetTag,
                  assetName: asset.name,
                  businessId: asset.businessId,
                  maintenanceType: mntForm.maintenanceType,
                  vendorName: mntForm.vendorName,
                  scheduledDate: mntForm.scheduledDate,
                  completedDate: '',
                  costCents: parseDollarsToCents(mntForm.costDollars),
                  isCapitalImprovement: mntForm.isCapitalImprovement,
                  status: 'SCHEDULED',
                  notes: mntForm.notes,
                });
              }}
              className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Asset</label>
                <select
                  value={mntForm.assetId}
                  onChange={(e) => setMntForm({ ...mntForm, assetId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                >
                  {assets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetTag} — {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Service Type</label>
                <select
                  value={mntForm.maintenanceType}
                  onChange={(e) =>
                    setMntForm({
                      ...mntForm,
                      maintenanceType: e.target.value as MaintenanceRecord['maintenanceType'],
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                >
                  <option value="PREVENTIVE">Preventive Maintenance</option>
                  <option value="CORRECTIVE">Corrective Repair</option>
                  <option value="OVERHAUL">Major Capital Overhaul</option>
                  <option value="INSPECTION">Statutory Inspection</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Service Vendor</label>
                <input
                  required
                  value={mntForm.vendorName}
                  onChange={(e) => setMntForm({ ...mntForm, vendorName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Estimated Cost (PKR / Rs.)
                </label>
                <input
                  required
                  type="number"
                  step="0.01"
                  value={mntForm.costDollars}
                  onChange={(e) => setMntForm({ ...mntForm, costDollars: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  + Schedule Maintenance
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <th className="py-2.5 px-4">Ticket #</th>
                  <th className="py-2.5 px-4">Asset Tag &amp; Name</th>
                  <th className="py-2.5 px-4">Type · Vendor</th>
                  <th className="py-2.5 px-4">Scheduled Date</th>
                  <th className="py-2.5 px-4 text-right">Service Cost</th>
                  <th className="py-2.5 px-4">Accounting Treatment</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {maintenance.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                      {m.ticketNumber}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-mono font-medium text-slate-900">{m.assetTag}</div>
                      <div className="text-[11px] text-slate-500">{m.assetName}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900">{m.maintenanceType}</div>
                      <div className="text-[11px] text-slate-500">{m.vendorName}</div>
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600">
                      {m.scheduledDate}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrencyCents(m.costCents)}
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">
                      {m.isCapitalImprovement ? 'Capitalized to Asset Cost' : 'Period P&L Expense'}
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{m.status}</td>
                    <td className="py-2.5 px-4 text-right">
                      {m.status !== 'COMPLETED' && permissions.canEditAsset && (
                        <button
                          onClick={() => onCompleteMaintenance(m)}
                          className="px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded"
                        >
                          Mark Completed
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

  // Disposals Mode
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div>
          <div className="text-xs text-slate-500">
            Asset Retirement, Sale, Write-Off &amp; Derecognition Gain/Loss Ledger
          </div>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Asset Disposals &amp; Net Gain/Loss Recognition
          </h1>
        </div>

        {permissions.canDisposeAsset && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const asset = assets.find((a) => a.id === dspForm.assetId);
              if (!asset) return;
              const proceedsCents = parseDollarsToCents(dspForm.proceedsDollars);
              const gainLossCents = proceedsCents - asset.netBookValueCents;
              await onCreateDisposal({
                disposalNumber: `DSP-2026-${String(disposals.length + 18).padStart(4, '0')}`,
                assetId: asset.id,
                assetTag: asset.assetTag,
                assetName: asset.name,
                businessId: asset.businessId,
                disposalDate: dspForm.disposalDate,
                disposalMethod: dspForm.disposalMethod,
                originalCostCents: asset.originalCostCents,
                accumDepAtDisposalCents: asset.accumulatedDepreciationCents,
                netBookValueAtDisposalCents: asset.netBookValueCents,
                proceedsCents,
                gainLossCents,
                buyerOrRecipient: dspForm.buyerOrRecipient,
                reason: dspForm.reason,
                status: 'PENDING_APPROVAL',
                approvedBy: '',
              });
            }}
            className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs"
          >
            <div>
              <label className="block font-medium text-slate-700 mb-1">Asset to Dispose</label>
              <select
                value={dspForm.assetId}
                onChange={(e) => setDspForm({ ...dspForm, assetId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-md"
              >
                {assets
                  .filter((a) => a.operationalStatus !== 'DISPOSED')
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.assetTag} — {a.name} (NBV: {formatCurrencyCents(a.netBookValueCents)})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Disposal Method</label>
              <select
                value={dspForm.disposalMethod}
                onChange={(e) =>
                  setDspForm({
                    ...dspForm,
                    disposalMethod: e.target.value as AssetDisposal['disposalMethod'],
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-md"
              >
                <option value="SALE">Commercial Sale</option>
                <option value="TRADE_IN">OEM Trade-In</option>
                <option value="SCRAP">Certified Scrap / Recycling</option>
                <option value="WRITE_OFF">Impairment Write-Off</option>
                <option value="DONATION">Charitable Donation</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Disposal Proceeds (PKR / Rs.)
              </label>
              <input
                required
                type="number"
                step="0.01"
                min="0"
                value={dspForm.proceedsDollars}
                onChange={(e) => setDspForm({ ...dspForm, proceedsDollars: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Buyer / Recipient</label>
              <input
                required
                value={dspForm.buyerOrRecipient}
                onChange={(e) => setDspForm({ ...dspForm, buyerOrRecipient: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-md"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
              >
                Initiate Disposal
              </button>
            </div>
          </form>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Disposal #</th>
                <th className="py-2.5 px-4">Asset Tag &amp; Name</th>
                <th className="py-2.5 px-4">Method · Date</th>
                <th className="py-2.5 px-4 text-right">Original Cost</th>
                <th className="py-2.5 px-4 text-right">Accum. Dep.</th>
                <th className="py-2.5 px-4 text-right">Carrying NBV</th>
                <th className="py-2.5 px-4 text-right">Sale Proceeds</th>
                <th className="py-2.5 px-4 text-right">Net Gain / (Loss)</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {disposals.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                    {d.disposalNumber}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-mono font-medium text-slate-900">{d.assetTag}</div>
                    <div className="text-[11px] text-slate-500">{d.assetName}</div>
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-slate-900">{d.disposalMethod}</div>
                    <div className="text-[11px] font-mono text-slate-500">{d.disposalDate}</div>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                    {formatCurrencyCents(d.originalCostCents)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">
                    {formatCurrencyCents(d.accumDepAtDisposalCents)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                    {formatCurrencyCents(d.netBookValueAtDisposalCents)}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                    {formatCurrencyCents(d.proceedsCents)}
                  </td>
                  <td
                    className={`py-2.5 px-4 text-right font-mono tabular-nums font-bold ${
                      d.gainLossCents >= 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {d.gainLossCents >= 0 ? '+' : ''}
                    {formatCurrencyCents(d.gainLossCents)}
                  </td>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{d.status}</td>
                  <td className="py-2.5 px-4 text-right">
                    {d.status !== 'EXECUTED' && permissions.canApproveWorkflows && (
                      <button
                        onClick={() => onExecuteDisposal(d)}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-900 text-white rounded hover:bg-slate-800"
                      >
                        Approve &amp; Derecognize
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
};
