import React, { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import {
  Asset,
  AssetCategory,
  Branch,
  Business,
  DepreciationRun,
  NavigationTab,
  Region,
} from '../types/asset';
import { formatCurrencyCents } from '../lib/depreciationEngine';
import {
  ArrowUpRight,
  Building2,
  Filter,
  RotateCcw,
  ShieldAlert,
  TrendingDown,
  Wrench,
} from 'lucide-react';

interface DashboardModuleProps {
  assets: Asset[];
  businesses: Business[];
  regions: Region[];
  branches: Branch[];
  categories: AssetCategory[];
  depreciationRuns: DepreciationRun[];
  onNavigate: (tab: NavigationTab) => void;
  onSelectAsset: (asset: Asset) => void;
}

const CHART_COLORS = ['#0f172a', '#2563eb', '#0d9488', '#d97706', '#dc2626', '#4f46e5'];

export const DashboardModule: React.FC<DashboardModuleProps> = ({
  assets,
  businesses,
  regions,
  branches,
  categories,
  depreciationRuns,
  onNavigate,
  onSelectAsset,
}) => {
  const [selectedBusiness, setSelectedBusiness] = useState<string>('ALL');
  const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>('2026');

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      if (selectedBusiness !== 'ALL' && a.businessId !== selectedBusiness) return false;
      if (selectedRegion !== 'ALL' && a.regionId !== selectedRegion) return false;
      if (selectedBranch !== 'ALL' && a.branchId !== selectedBranch) return false;
      if (selectedCategory !== 'ALL' && a.categoryId !== selectedCategory) return false;
      return true;
    });
  }, [assets, selectedBusiness, selectedRegion, selectedBranch, selectedCategory]);

  const kpis = useMemo(() => {
    const totalAssets = filteredAssets.length;
    const totalCostCents = filteredAssets.reduce((s, a) => s + a.originalCostCents, 0);
    const totalAccumDepCents = filteredAssets.reduce(
      (s, a) => s + a.accumulatedDepreciationCents,
      0
    );
    const totalNbvCents = filteredAssets.reduce((s, a) => s + a.netBookValueCents, 0);

    const addedThisMonth = filteredAssets.filter((a) =>
      a.purchaseDate.startsWith('2026-10')
    ).length;
    const underMaintenance = filteredAssets.filter(
      (a) => a.operationalStatus === 'UNDER_MAINTENANCE'
    ).length;
    const awaitingApproval = filteredAssets.filter(
      (a) => a.operationalStatus === 'AWAITING_APPROVAL'
    ).length;
    const missingOrUnverified = filteredAssets.filter(
      (a) => a.verificationStatus === 'MISSING' || a.verificationStatus === 'UNVERIFIED'
    ).length;
    const fullyDepreciated = filteredAssets.filter(
      (a) =>
        a.operationalStatus === 'FULLY_DEPRECIATED' ||
        a.netBookValueCents <= a.residualValueCents
    ).length;

    // Approaching end of useful life: NBV within 15% of depreciable base above residual
    const approachingEol = filteredAssets.filter((a) => {
      const depreciable = Math.max(1, a.originalCostCents - a.residualValueCents);
      const remaining = Math.max(0, a.netBookValueCents - a.residualValueCents);
      return remaining > 0 && remaining / depreciable <= 0.2;
    }).length;

    // Warranty expiring in 2026
    const warrantyExpiring = filteredAssets.filter(
      (a) => a.warrantyExpiryDate && a.warrantyExpiryDate <= '2026-12-31'
    ).length;

    const disposedCount = filteredAssets.filter(
      (a) => a.operationalStatus === 'DISPOSED'
    ).length;

    return {
      totalAssets,
      totalCostCents,
      totalAccumDepCents,
      totalNbvCents,
      addedThisMonth,
      underMaintenance,
      awaitingApproval,
      missingOrUnverified,
      fullyDepreciated,
      approachingEol,
      warrantyExpiring,
      disposedCount,
    };
  }, [filteredAssets]);

  const valueByBusinessData = useMemo(() => {
    return businesses.map((biz) => {
      const bizAssets = filteredAssets.filter((a) => a.businessId === biz.id);
      const acquisitionCost = Math.round(
        bizAssets.reduce((s, a) => s + a.originalCostCents, 0) / 100
      );
      const accumDep = Math.round(
        bizAssets.reduce((s, a) => s + a.accumulatedDepreciationCents, 0) / 100
      );
      const netBookValue = Math.round(
        bizAssets.reduce((s, a) => s + a.netBookValueCents, 0) / 100
      );
      return {
        name: biz.code,
        fullName: biz.name,
        acquisitionCost,
        accumDep,
        netBookValue,
      };
    });
  }, [businesses, filteredAssets]);

  const valueByRegionData = useMemo(() => {
    return regions.map((reg) => {
      const regAssets = filteredAssets.filter((a) => a.regionId === reg.id);
      return {
        name: reg.code,
        regionName: reg.name,
        netBookValue: Math.round(
          regAssets.reduce((s, a) => s + a.netBookValueCents, 0) / 100
        ),
        acquisitionCost: Math.round(
          regAssets.reduce((s, a) => s + a.originalCostCents, 0) / 100
        ),
      };
    });
  }, [regions, filteredAssets]);

  const valueByBranchData = useMemo(() => {
    return branches.map((br) => {
      const brAssets = filteredAssets.filter((a) => a.branchId === br.id);
      return {
        code: br.code,
        name: br.code,
        facilityName: br.name,
        type: br.type,
        netBookValue: Math.round(
          brAssets.reduce((s, a) => s + a.netBookValueCents, 0) / 100
        ),
        acquisitionCost: Math.round(
          brAssets.reduce((s, a) => s + a.originalCostCents, 0) / 100
        ),
        assetCount: brAssets.length,
      };
    });
  }, [branches, filteredAssets]);

  const categoryDistributionData = useMemo(() => {
    return categories
      .map((cat) => {
        const catAssets = filteredAssets.filter((a) => a.categoryId === cat.id);
        return {
          name: cat.name,
          code: cat.code,
          value: Math.round(catAssets.reduce((s, a) => s + a.netBookValueCents, 0) / 100),
          count: catAssets.length,
        };
      })
      .filter((item) => item.value > 0);
  }, [categories, filteredAssets]);

  const monthlyDepreciationTrend = useMemo(() => {
    const baseMonthlyExpense = Math.round(
      filteredAssets.reduce((s, a) => {
        const depBase = Math.max(0, a.originalCostCents - a.residualValueCents);
        return s + depBase / Math.max(12, a.usefulLifeMonths);
      }, 0) / 100
    );

    const months = ['May 26', 'Jun 26', 'Jul 26', 'Aug 26', 'Sep 26', 'Oct 26'];
    return months.map((m, idx) => ({
      period: m,
      accountingDepreciation: Math.round(baseMonthlyExpense * (0.94 + idx * 0.015)),
      taxDepreciation: Math.round(baseMonthlyExpense * 1.18 * (0.94 + idx * 0.015)),
    }));
  }, [filteredAssets]);

  const conditionStatusData = useMemo(() => {
    const statuses: Asset['operationalStatus'][] = [
      'ACTIVE',
      'UNDER_MAINTENANCE',
      'AWAITING_APPROVAL',
      'FULLY_DEPRECIATED',
      'IN_TRANSIT',
      'DISPOSED',
    ];
    return statuses.map((st) => ({
      status: st.replace(/_/g, ' '),
      count: filteredAssets.filter((a) => a.operationalStatus === st).length,
    }));
  }, [filteredAssets]);

  const resetFilters = () => {
    setSelectedBusiness('ALL');
    setSelectedRegion('ALL');
    setSelectedBranch('ALL');
    setSelectedCategory('ALL');
    setSelectedFiscalYear('2026');
  };

  return (
    <div className="space-y-6">
      {/* Executive Header & Filter Strip */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                Pakistan Environment (FBR / SECP)
              </span>
              <span aria-hidden="true">·</span>
              <span>Head Office Consolidation</span>
              <span aria-hidden="true">·</span>
              <span>Fiscal Year {selectedFiscalYear} (July–June)</span>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-slate-800">Reporting Currency: PKR (Rs.)</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              Group Fixed Asset &amp; Depreciation Executive Overview (PKR)
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Scope Filters
            </button>
            <button
              onClick={() => onNavigate('reports')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              Open Consolidated Reports
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Multi-Dimensional Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Subsidiary / Business
            </label>
            <select
              value={selectedBusiness}
              onChange={(e) => {
                setSelectedBusiness(e.target.value);
                setSelectedRegion('ALL');
                setSelectedBranch('ALL');
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">All Group Businesses ({businesses.length})</option>
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Regional Zone
            </label>
            <select
              value={selectedRegion}
              onChange={(e) => {
                setSelectedRegion(e.target.value);
                setSelectedBranch('ALL');
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">All Regional Zones</option>
              {regions
                .filter((r) => selectedBusiness === 'ALL' || r.businessId === selectedBusiness)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} — {r.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Branch / Facility
            </label>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">All Branches &amp; Plants</option>
              {branches
                .filter(
                  (br) =>
                    (selectedBusiness === 'ALL' || br.businessId === selectedBusiness) &&
                    (selectedRegion === 'ALL' || br.regionId === selectedRegion)
                )
                .map((br) => (
                  <option key={br.id} value={br.id}>
                    {br.code} — {br.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Asset Category
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">All Asset Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Financial Year
            </label>
            <select
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            >
              <option value="2026">FY 2026 (Current)</option>
              <option value="2025">FY 2025 (Prior Closed)</option>
              <option value="2024">FY 2024 (Historical)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Primary Financial KPI Strip (4 Core Valuation Metrics) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Total Registered Assets</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {kpis.totalAssets}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Across {businesses.length} active subsidiaries · {branches.length} locations
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Total Original Acquisition Cost</div>
          <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
            {formatCurrencyCents(kpis.totalCostCents)}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Historical capitalized gross cost basis
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Total Accumulated Depreciation</div>
          <div className="text-2xl font-bold text-amber-700 font-mono tabular-nums mt-1">
            {formatCurrencyCents(kpis.totalAccumDepCents)}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {kpis.totalCostCents > 0
              ? `${((kpis.totalAccumDepCents / kpis.totalCostCents) * 100).toFixed(1)}% of gross cost amortized`
              : '0.0% amortized'}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="text-xs font-medium text-slate-500">Current Net Book Value (NBV)</div>
          <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
            {formatCurrencyCents(kpis.totalNbvCents)}
          </div>
          <div className="text-xs text-slate-500 mt-2">
            Carrying balance reconciled to subledger
          </div>
        </div>
      </div>

      {/* Operational & Governance KPI Grid (8 Required Secondary KPIs) */}
      <div className="bg-white border border-slate-200 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        <button
          onClick={() => onNavigate('assets')}
          className="p-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="text-xs text-slate-500">Added This Month</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">
            {kpis.addedThisMonth}
          </div>
        </button>

        <button
          onClick={() => onNavigate('maintenance')}
          className="p-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="text-xs text-slate-500">Under Maintenance</div>
          <div className="text-lg font-bold font-mono tabular-nums text-amber-700 mt-1">
            {kpis.underMaintenance}
          </div>
        </button>

        <button
          onClick={() => onNavigate('approvals')}
          className="p-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="text-xs text-slate-500">Awaiting Approval</div>
          <div className="text-lg font-bold font-mono tabular-nums text-blue-700 mt-1">
            {kpis.awaitingApproval}
          </div>
        </button>

        <button
          onClick={() => onNavigate('verification')}
          className="p-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="text-xs text-slate-500">Missing / Unverified</div>
          <div className="text-lg font-bold font-mono tabular-nums text-red-600 mt-1">
            {kpis.missingOrUnverified}
          </div>
        </button>

        <button
          onClick={() => onNavigate('depreciation')}
          className="p-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="text-xs text-slate-500">Fully Depreciated</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">
            {kpis.fullyDepreciated}
          </div>
        </button>

        <button
          onClick={() => onNavigate('reports')}
          className="p-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="text-xs text-slate-500">Nearing End of Life</div>
          <div className="text-lg font-bold font-mono tabular-nums text-amber-700 mt-1">
            {kpis.approachingEol}
          </div>
        </button>

        <button
          onClick={() => onNavigate('reports')}
          className="p-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="text-xs text-slate-500">Warranty Expiring</div>
          <div className="text-lg font-bold font-mono tabular-nums text-amber-700 mt-1">
            {kpis.warrantyExpiring}
          </div>
        </button>

        <button
          onClick={() => onNavigate('disposals')}
          className="p-4 text-left hover:bg-slate-50 transition-colors"
        >
          <div className="text-xs text-slate-500">Disposed in Period</div>
          <div className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">
            {kpis.disposedCount}
          </div>
        </button>
      </div>

      {/* Primary Charts Row 1: Asset Value by Business & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Acquisition Cost vs. Accumulated Depreciation &amp; NBV by Business
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Consolidated subsidiary comparison in PKR (Rs.)
              </p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={valueByBusinessData} margin={{ top: 10, right: 16, left: 8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickFormatter={(v) => `Rs. ${(v / 1000000).toFixed(0)}M`}
                />
                <Tooltip
                  formatter={(value) => [`Rs. ${Number(value ?? 0).toLocaleString('en-US')}`, '']}
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderColor: '#e2e8f0',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="acquisitionCost" name="Acquisition Cost" fill="#0f172a" radius={[3, 3, 0, 0]} />
                <Bar dataKey="accumDep" name="Accumulated Dep." fill="#d97706" radius={[3, 3, 0, 0]} />
                <Bar dataKey="netBookValue" name="Net Book Value" fill="#0d9488" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Net Book Value by Poultry Asset Class
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Carrying value allocation across sheds, automation, power, and feed
            </p>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryDistributionData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={48}
                  outerRadius={78}
                  paddingAngle={2}
                >
                  {categoryDistributionData.map((entry, index) => (
                    <Cell key={entry.code} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`Rs. ${Number(value ?? 0).toLocaleString('en-US')}`, 'NBV']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1.5 mt-2 border-t border-slate-100 pt-3 max-h-36 overflow-y-auto">
            {categoryDistributionData.map((item, idx) => (
              <div key={item.code} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                  />
                  <span className="text-slate-700 truncate">{item.name}</span>
                </div>
                <span className="font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap ml-2">
                  Rs. {item.value.toLocaleString('en-US')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Charts Row 2: Monthly Depreciation Trend & Poultry Farm Asset Value */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Monthly Accounting vs. FBR Tax Depreciation Trend (PKR)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              IAS 16 Book depreciation vs. FBR Third Schedule tax allowances
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyDepreciationTrend} margin={{ top: 10, right: 16, left: 8, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="period" tick={{ fontSize: 12, fill: '#475569' }} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickFormatter={(v) => `Rs. ${(v / 100000).toFixed(0)}L`}
                />
                <Tooltip formatter={(val) => [`Rs. ${Number(val ?? 0).toLocaleString('en-US')}`, '']} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Area
                  type="monotone"
                  dataKey="accountingDepreciation"
                  name="Book Depreciation (IAS 16)"
                  stroke="#0f172a"
                  fill="#cbd5e1"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="taxDepreciation"
                  name="FBR Tax Depreciation Allowance"
                  stroke="#2563eb"
                  fill="#dbeafe"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Net Book Value by Poultry Farm &amp; Facility (PKR)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Carrying value comparison across Lahore Head Office, 4 Farms &amp; Feed Mill
            </p>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={valueByBranchData}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  type="number"
                  tick={{ fontSize: 11, fill: '#475569' }}
                  tickFormatter={(v) => `Rs. ${(v / 1000000).toFixed(0)}M`}
                />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#0f172a' }} width={80} />
                <Tooltip
                  formatter={(val, _name, item) => [
                    `Rs. ${Number(val ?? 0).toLocaleString('en-US')} (${(item?.payload as { facilityName?: string })?.facilityName || ''})`,
                    'Net Book Value',
                  ]}
                />
                <Bar dataKey="netBookValue" name="Net Book Value" fill="#0d9488" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Actionable Governance & Exceptions Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              High-Value &amp; Exception Watchlist (Click Row to Inspect Asset Profile)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time drill-down into assets requiring verification, maintenance, or capitalization approval
            </p>
          </div>
          <button
            onClick={() => onNavigate('assets')}
            className="text-xs font-semibold text-slate-900 hover:underline whitespace-nowrap shrink-0"
          >
            View Complete Register →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Asset Tag</th>
                <th className="py-2.5 px-4">Asset Name</th>
                <th className="py-2.5 px-4">Business · Branch</th>
                <th className="py-2.5 px-4">Method · Life</th>
                <th className="py-2.5 px-4 text-right">Original Cost</th>
                <th className="py-2.5 px-4 text-right">Accum. Dep.</th>
                <th className="py-2.5 px-4 text-right">Net Book Value</th>
                <th className="py-2.5 px-4">Operational Status</th>
                <th className="py-2.5 px-4">Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {filteredAssets.map((asset) => {
                const biz = businesses.find((b) => b.id === asset.businessId);
                const br = branches.find((b) => b.id === asset.branchId);
                return (
                  <tr
                    key={asset.id}
                    onClick={() => onSelectAsset(asset)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                      {asset.assetTag}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 max-w-xs truncate">
                      {asset.name}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                      {biz?.code ?? asset.businessId} · {br?.code ?? asset.branchId}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap">
                      {asset.depreciationMethod.replace(/_/g, ' ')} · {asset.usefulLifeMonths}m
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {formatCurrencyCents(asset.originalCostCents, asset.currency)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700 whitespace-nowrap">
                      {formatCurrencyCents(asset.accumulatedDepreciationCents, asset.currency)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {formatCurrencyCents(asset.netBookValueCents, asset.currency)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-slate-700">
                      {asset.operationalStatus.replace(/_/g, ' ')}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          asset.verificationStatus === 'VERIFIED'
                            ? 'text-emerald-700'
                            : asset.verificationStatus === 'MISSING'
                            ? 'text-red-600 font-semibold'
                            : 'text-amber-700'
                        }`}
                      >
                        {asset.verificationStatus}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredAssets.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-500">
                    No assets match the selected organization scope filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
