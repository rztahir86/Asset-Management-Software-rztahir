import React, { useMemo, useState } from 'react';
import {
  Asset,
  AssetCategory,
  AssetCondition,
  Branch,
  Business,
  DepreciationMethod,
  OperationalStatus,
  Region,
  RolePermissionMatrix,
} from '../types/asset';
import { formatCurrencyCents, parseDollarsToCents } from '../lib/depreciationEngine';
import { SvgBarcode128, SvgQrCode } from './QrBarcodeGraphic';
import {
  AlertTriangle,
  Download,
  FileSpreadsheet,
  Plus,
  QrCode,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';

interface AssetRegisterModuleProps {
  assets: Asset[];
  businesses: Business[];
  regions: Region[];
  branches: Branch[];
  categories: AssetCategory[];
  permissions: RolePermissionMatrix;
  selectedAsset: Asset | null;
  onSelectAsset: (asset: Asset | null) => void;
  onCreateAsset: (
    assetData: Omit<Asset, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateAsset: (assetId: string, updates: Partial<Asset>, auditSummary: string) => Promise<void>;
  onDeleteAsset: (assetId: string, assetTag: string) => Promise<void>;
  onBulkImportAssets: (
    rows: Omit<Asset, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>[]
  ) => Promise<void>;
}

export const AssetRegisterModule: React.FC<AssetRegisterModuleProps> = ({
  assets,
  businesses,
  regions,
  branches,
  categories,
  permissions,
  selectedAsset,
  onSelectAsset,
  onCreateAsset,
  onUpdateAsset,
  onDeleteAsset,
  onBulkImportAssets,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBusiness, setFilterBusiness] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [bulkCsvText, setBulkCsvText] = useState(
    'SPF-KML-CSH-00101,4-Stage Controlled Broiler Shed 05,cat-poultry-sheds,Controlled Shed,Big Dutchman Agri,EC-Shed-500ft,SN-BD-50119,biz-sultan-poultry,reg-punjab-central,br-kml-frm-02,Broiler Operations,CC-202-BROILER-OPS,Shed 5 East Sector,Rana Tanveer Hussain,SPF-FM-022,2026-08-10,38000000,3800000,240,STRAIGHT_LINE\nSPF-KSR-MIL-00102,Buhler 35 TPH Grain Conditioning Silo,cat-feed-mill,Feed Mill Silo,Buhler Group Switzerland,Silo-35TPH,SN-BHL-90184,biz-sultan-feed,reg-punjab-central,br-ksr-mill-05,Grain Storage & Silos,CC-501-GRAIN-STORAGE,Silo Yard Tower 3,Engr. Naveed Akhtar,SPF-ENG-051,2026-07-15,48500000,4850000,180,STRAIGHT_LINE'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Registration Form State
  const [formState, setFormState] = useState({
    assetTag: `SPF-KML-CSH-${String(assets.length + 101).padStart(5, '0')}`,
    name: '',
    description: '',
    categoryId: categories[0]?.id || 'cat-poultry-sheds',
    subcategory: 'Environmentally Controlled Poultry Shed',
    manufacturer: '',
    model: '',
    serialNumber: '',
    businessId: businesses[0]?.id || 'biz-sultan-poultry',
    regionId: regions[0]?.id || 'reg-punjab-central',
    branchId: branches[1]?.id || branches[0]?.id || 'br-kml-frm-02',
    department: 'Broiler Farm Operations',
    costCenter: 'CC-202-BROILER-OPS',
    physicalLocation: 'Shed 01 · Automation Control Room',
    custodianName: 'Dr. Farooq Malik (DVM)',
    custodianEmployeeId: 'SPF-DVM-041',
    purchaseDate: '2026-10-18',
    capitalizationDate: '2026-10-18',
    supplierName: '',
    invoiceReference: '',
    originalCostDollars: '36000000.00',
    currency: 'PKR',
    residualValueDollars: '3600000.00',
    usefulLifeMonths: '240',
    depreciationMethod: 'STRAIGHT_LINE' as DepreciationMethod,
    condition: 'EXCELLENT' as AssetCondition,
    operationalStatus: 'ACTIVE' as OperationalStatus,
    warrantyExpiryDate: '2029-10-18',
    insurancePolicyNo: 'EFU-AGRI-POULTRY-2026',
    insuranceExpiryDate: '2027-10-18',
    insuredValueDollars: '36000000.00',
    maintenanceSchedule: 'Monthly Environmental & Ventilation Calibration',
    fundingSource: 'Corporate CapEx Budget',
    remarks: '',
  });

  const filteredAssets = useMemo(() => {
    return assets.filter((a) => {
      if (filterBusiness !== 'ALL' && a.businessId !== filterBusiness) return false;
      if (filterCategory !== 'ALL' && a.categoryId !== filterCategory) return false;
      if (filterStatus !== 'ALL' && a.operationalStatus !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          a.assetTag.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.serialNumber.toLowerCase().includes(q) ||
          a.custodianName.toLowerCase().includes(q) ||
          a.department.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [assets, filterBusiness, filterCategory, filterStatus, searchQuery]);

  const handleCategoryChange = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    const costCents = parseDollarsToCents(formState.originalCostDollars);
    const defaultResidualDollars = cat
      ? ((costCents * cat.defaultResidualRatePct) / 10000).toFixed(2)
      : formState.residualValueDollars;
    setFormState((prev) => ({
      ...prev,
      categoryId: catId,
      depreciationMethod: cat?.defaultDepreciationMethod || prev.depreciationMethod,
      usefulLifeMonths: String(cat?.defaultUsefulLifeMonths || prev.usefulLifeMonths),
      residualValueDollars: defaultResidualDollars,
    }));
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setDuplicateWarning(null);

    // Duplicate tag or serial number guard
    const duplicate = assets.find(
      (a) =>
        a.assetTag.toLowerCase() === formState.assetTag.trim().toLowerCase() ||
        (formState.serialNumber.trim() !== '' &&
          a.serialNumber.toLowerCase() === formState.serialNumber.trim().toLowerCase())
    );
    if (duplicate) {
      setDuplicateWarning(
        `Duplicate detected: Asset Tag "${duplicate.assetTag}" or Serial Number "${duplicate.serialNumber}" is already registered in ${duplicate.businessId}.`
      );
      return;
    }

    const costCents = Math.max(0, parseDollarsToCents(formState.originalCostDollars));
    const residualCents = Math.min(
      costCents,
      Math.max(0, parseDollarsToCents(formState.residualValueDollars))
    );
    const insuredCents = Math.max(0, parseDollarsToCents(formState.insuredValueDollars));
    const lifeMonths = Math.max(1, parseInt(formState.usefulLifeMonths, 10) || 60);
    const cleanTag = formState.assetTag.trim().toUpperCase();

    setIsSubmitting(true);
    try {
      await onCreateAsset({
        assetTag: cleanTag,
        qrPayload: `https://meridian.enterprise/assets/${cleanTag}`,
        barcodeValue: cleanTag.replace(/[^A-Z0-9]/g, ''),
        name: formState.name.trim(),
        description: formState.description.trim() || formState.name.trim(),
        categoryId: formState.categoryId,
        subcategory: formState.subcategory.trim() || 'General Fixed Asset',
        manufacturer: formState.manufacturer.trim() || 'OEM Standard',
        model: formState.model.trim() || 'Enterprise Series',
        serialNumber: formState.serialNumber.trim() || `SN-${Date.now()}`,
        businessId: formState.businessId,
        regionId: formState.regionId,
        branchId: formState.branchId,
        department: formState.department.trim(),
        costCenter: formState.costCenter.trim(),
        physicalLocation: formState.physicalLocation.trim(),
        custodianName: formState.custodianName.trim(),
        custodianEmployeeId: formState.custodianEmployeeId.trim(),
        purchaseDate: formState.purchaseDate,
        capitalizationDate: formState.capitalizationDate,
        supplierName: formState.supplierName.trim() || 'Approved Enterprise Vendor',
        invoiceReference: formState.invoiceReference.trim() || `INV-${Date.now()}`,
        originalCostCents: costCents,
        currency: formState.currency,
        exchangeRateScaled: 10000,
        residualValueCents: residualCents,
        usefulLifeMonths: lifeMonths,
        depreciationMethod: formState.depreciationMethod,
        accumulatedDepreciationCents: 0,
        impairmentCents: 0,
        revaluationReserveCents: 0,
        netBookValueCents: costCents,
        taxBookValueCents: costCents,
        totalUnitsCapacity: 100000,
        unitsProducedToDate: 0,
        condition: formState.condition,
        operationalStatus: formState.operationalStatus,
        warrantyExpiryDate: formState.warrantyExpiryDate,
        insurancePolicyNo: formState.insurancePolicyNo,
        insuranceExpiryDate: formState.insuranceExpiryDate,
        insuredValueCents: insuredCents,
        maintenanceSchedule: formState.maintenanceSchedule,
        fundingSource: formState.fundingSource,
        verificationStatus: 'VERIFIED',
        lastVerifiedDate: formState.purchaseDate,
        isDemoData: false,
        remarks: formState.remarks.trim() || 'Registered via Head Office Fixed Asset Portal',
      });
      setShowCreateModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkImportSubmit = async () => {
    const lines = bulkCsvText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const parsedRows: Omit<Asset, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>[] = [];

    for (const line of lines) {
      const cols = line.split(',').map((c) => c.trim());
      if (cols.length < 10) continue;
      const [
        tag,
        name,
        categoryId,
        subcategory,
        manufacturer,
        model,
        serialNumber,
        businessId,
        regionId,
        branchId,
        department = 'Operations',
        costCenter = 'CC-1000',
        physicalLocation = 'Main Facility',
        custodianName = 'Facility Manager',
        custodianEmployeeId = 'EMP-100',
        purchaseDate = '2026-10-18',
        costDollars = '50000',
        residualDollars = '5000',
        lifeMonths = '60',
        method = 'STRAIGHT_LINE',
      ] = cols;

      // Skip duplicates already in register
      if (assets.some((a) => a.assetTag.toLowerCase() === tag.toLowerCase())) {
        continue;
      }

      const costCents = parseDollarsToCents(costDollars);
      const residualCents = parseDollarsToCents(residualDollars);

      parsedRows.push({
        assetTag: tag,
        qrPayload: `https://meridian.enterprise/assets/${tag}`,
        barcodeValue: tag.replace(/[^A-Z0-9]/g, ''),
        name,
        description: `${name} (${manufacturer} ${model})`,
        categoryId: categories.some((c) => c.id === categoryId)
          ? categoryId
          : categories[0]?.id || 'cat-machinery',
        subcategory,
        manufacturer,
        model,
        serialNumber,
        businessId: businesses.some((b) => b.id === businessId)
          ? businessId
          : businesses[0]?.id || 'biz-na',
        regionId: regions.some((r) => r.id === regionId)
          ? regionId
          : regions[0]?.id || 'reg-na-east',
        branchId: branches.some((b) => b.id === branchId)
          ? branchId
          : branches[0]?.id || 'br-ny-hq',
        department,
        costCenter,
        physicalLocation,
        custodianName,
        custodianEmployeeId,
        purchaseDate,
        capitalizationDate: purchaseDate,
        supplierName: manufacturer,
        invoiceReference: `BULK-${tag}`,
        originalCostCents: costCents,
        currency: 'PKR',
        exchangeRateScaled: 10000,
        residualValueCents: residualCents,
        usefulLifeMonths: parseInt(lifeMonths, 10) || 60,
        depreciationMethod: (method as DepreciationMethod) || 'STRAIGHT_LINE',
        accumulatedDepreciationCents: 0,
        impairmentCents: 0,
        revaluationReserveCents: 0,
        netBookValueCents: costCents,
        taxBookValueCents: costCents,
        totalUnitsCapacity: 100000,
        unitsProducedToDate: 0,
        condition: 'EXCELLENT',
        operationalStatus: 'ACTIVE',
        warrantyExpiryDate: '2029-10-18',
        insurancePolicyNo: 'POL-BULK-2026',
        insuranceExpiryDate: '2027-10-18',
        insuredValueCents: costCents,
        maintenanceSchedule: 'Semi-Annual',
        fundingSource: 'CapEx Bulk Import',
        verificationStatus: 'VERIFIED',
        lastVerifiedDate: purchaseDate,
        isDemoData: false,
        remarks: 'Imported via Bulk CSV/Excel Register Upload',
      });
    }

    if (parsedRows.length > 0) {
      setIsSubmitting(true);
      try {
        await onBulkImportAssets(parsedRows);
        setShowBulkModal(false);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const exportRegisterCsv = () => {
    const headers = [
      'Asset Tag',
      'Asset Name',
      'Category',
      'Subcategory',
      'Manufacturer',
      'Model',
      'Serial Number',
      'Business',
      'Region',
      'Branch',
      'Department',
      'Cost Center',
      'Physical Location',
      'Custodian',
      'Purchase Date',
      'Capitalization Date',
      'Supplier',
      'Invoice Ref',
      'Original Cost (PKR)',
      'Residual Value (PKR)',
      'Useful Life (Mos)',
      'Depreciation Method',
      'Accumulated Dep (PKR)',
      'Net Book Value (PKR)',
      'Condition',
      'Operational Status',
      'Verification Status',
      'Warranty Expiry',
    ];
    const rows = filteredAssets.map((a) => [
      a.assetTag,
      `"${a.name.replace(/"/g, '""')}"`,
      a.categoryId,
      a.subcategory,
      `"${a.manufacturer}"`,
      `"${a.model}"`,
      a.serialNumber,
      a.businessId,
      a.regionId,
      a.branchId,
      `"${a.department}"`,
      a.costCenter,
      `"${a.physicalLocation}"`,
      `"${a.custodianName}"`,
      a.purchaseDate,
      a.capitalizationDate,
      `"${a.supplierName}"`,
      a.invoiceReference,
      (a.originalCostCents / 100).toFixed(2),
      (a.residualValueCents / 100).toFixed(2),
      a.usefulLifeMonths,
      a.depreciationMethod,
      (a.accumulatedDepreciationCents / 100).toFixed(2),
      (a.netBookValueCents / 100).toFixed(2),
      a.condition,
      a.operationalStatus,
      a.verificationStatus,
      a.warrantyExpiryDate,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Meridian_Fixed_Asset_Register_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header & Action Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Centralized Fixed Asset Subledger</span>
              <span aria-hidden="true">·</span>
              <span>{filteredAssets.length} Assets Displayed</span>
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              Master Fixed Asset Register &amp; Capitalization Control
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportRegisterCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV / Excel Register
            </button>
            {permissions.canCreateAsset && (
              <>
                <button
                  onClick={() => setShowBulkModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Bulk CSV Import
                </button>
                <button
                  onClick={() => {
                    setFormState((prev) => ({
                      ...prev,
                      assetTag: `MRD-NA-MCH-${String(assets.length + 101).padStart(5, '0')}`,
                    }));
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Register New Asset
                </button>
              </>
            )}
          </div>
        </div>

        {/* Search & Filter Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-slate-200">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tag, name, serial #, custodian..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <select
            value={filterBusiness}
            onChange={(e) => setFilterBusiness(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900"
          >
            <option value="ALL">All Businesses</option>
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900"
          >
            <option value="ALL">All Asset Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.name}
              </option>
            ))}
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md text-slate-900"
          >
            <option value="ALL">All Operational Statuses</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="UNDER_MAINTENANCE">UNDER MAINTENANCE</option>
            <option value="AWAITING_APPROVAL">AWAITING APPROVAL</option>
            <option value="IN_TRANSIT">IN TRANSIT</option>
            <option value="FULLY_DEPRECIATED">FULLY DEPRECIATED</option>
            <option value="DISPOSED">DISPOSED</option>
          </select>
        </div>
      </div>

      {/* High-Density Asset Register Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Asset Tag</th>
                <th className="py-2.5 px-4">Asset Name &amp; Serial</th>
                <th className="py-2.5 px-4">Business · Location</th>
                <th className="py-2.5 px-4">Custodian · Dept</th>
                <th className="py-2.5 px-4">Cap. Date</th>
                <th className="py-2.5 px-4 text-right">Original Cost</th>
                <th className="py-2.5 px-4 text-right">Accum. Dep.</th>
                <th className="py-2.5 px-4 text-right">Net Book Value</th>
                <th className="py-2.5 px-4">Status · Condition</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
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
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      selectedAsset?.id === asset.id ? 'bg-slate-100/80' : ''
                    }`}
                  >
                    <td className="py-2.5 px-4 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                      {asset.assetTag}
                      {asset.isDemoData && (
                        <span className="ml-1.5 text-[10px] font-normal text-slate-400">· DEMO</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-900 truncate max-w-xs">
                        {asset.name}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {asset.manufacturer} · SN: {asset.serialNumber}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="text-slate-900 font-medium">{biz?.code || asset.businessId}</div>
                      <div className="text-[11px] text-slate-500">{br?.name || asset.branchId}</div>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="text-slate-900">{asset.custodianName}</div>
                      <div className="text-[11px] text-slate-500">
                        {asset.department} · {asset.costCenter}
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {asset.capitalizationDate}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                      {formatCurrencyCents(asset.originalCostCents, asset.currency)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700 whitespace-nowrap">
                      {formatCurrencyCents(asset.accumulatedDepreciationCents, asset.currency)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                      {formatCurrencyCents(asset.netBookValueCents, asset.currency)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <div className="text-slate-900 font-medium">
                        {asset.operationalStatus.replace(/_/g, ' ')}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {asset.condition} · {asset.verificationStatus}
                      </div>
                    </td>
                    <td
                      className="py-2.5 px-4 text-right whitespace-nowrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onSelectAsset(asset)}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded mr-1"
                      >
                        Inspect
                      </button>
                      {permissions.canDisposeAsset && (
                        <button
                          onClick={() => onDeleteAsset(asset.id, asset.assetTag)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded"
                          title="Archive Asset"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Asset Detail Drawer / Inspector */}
      {selectedAsset && (
        <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-mono tabular-nums">
                <span>ID: {selectedAsset.id}</span>
                <span aria-hidden="true">·</span>
                <span>Tag: {selectedAsset.assetTag}</span>
                <span aria-hidden="true">·</span>
                <span>Serial: {selectedAsset.serialNumber}</span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 mt-1">{selectedAsset.name}</h2>
              <p className="text-xs text-slate-600 mt-0.5">{selectedAsset.description}</p>
            </div>
            <div className="flex items-center gap-2">
              {permissions.canEditAsset && (
                <button
                  onClick={() =>
                    onUpdateAsset(
                      selectedAsset.id,
                      {
                        verificationStatus: 'VERIFIED',
                        lastVerifiedDate: new Date().toISOString().slice(0, 10),
                      },
                      `Physically verified asset ${selectedAsset.assetTag}`
                    )
                  }
                  className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100"
                >
                  Mark Physically Verified
                </button>
              )}
              <button
                onClick={() => onSelectAsset(null)}
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 pt-5">
            {/* Column 1: Organizational & Location */}
            <div className="space-y-2 text-xs">
              <h3 className="font-semibold text-slate-900 pb-1 border-b border-slate-100">
                1. Organizational Assignment
              </h3>
              <div className="flex justify-between">
                <span className="text-slate-500">Business ID:</span>
                <span className="font-medium text-slate-900">{selectedAsset.businessId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Regional Zone:</span>
                <span className="font-medium text-slate-900">{selectedAsset.regionId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Branch / Plant:</span>
                <span className="font-medium text-slate-900">{selectedAsset.branchId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Department:</span>
                <span className="font-medium text-slate-900">{selectedAsset.department}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Cost Center:</span>
                <span className="font-mono tabular-nums text-slate-900">{selectedAsset.costCenter}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Physical Location:</span>
                <span className="font-medium text-slate-900">{selectedAsset.physicalLocation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Assigned Custodian:</span>
                <span className="font-medium text-slate-900">
                  {selectedAsset.custodianName} ({selectedAsset.custodianEmployeeId})
                </span>
              </div>
            </div>

            {/* Column 2: Valuation & Depreciation */}
            <div className="space-y-2 text-xs">
              <h3 className="font-semibold text-slate-900 pb-1 border-b border-slate-100">
                2. Valuation &amp; Depreciation
              </h3>
              <div className="flex justify-between">
                <span className="text-slate-500">Original Cost:</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {formatCurrencyCents(selectedAsset.originalCostCents, selectedAsset.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Residual / Salvage:</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {formatCurrencyCents(selectedAsset.residualValueCents, selectedAsset.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Accumulated Dep.:</span>
                <span className="font-mono tabular-nums text-amber-700">
                  {formatCurrencyCents(
                    selectedAsset.accumulatedDepreciationCents,
                    selectedAsset.currency
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Book Value:</span>
                <span className="font-mono tabular-nums font-bold text-emerald-700">
                  {formatCurrencyCents(selectedAsset.netBookValueCents, selectedAsset.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tax Book Value:</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {formatCurrencyCents(selectedAsset.taxBookValueCents, selectedAsset.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Method &amp; Life:</span>
                <span className="font-medium text-slate-900">
                  {selectedAsset.depreciationMethod} ({selectedAsset.usefulLifeMonths} mos)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Funding Source:</span>
                <span className="font-medium text-slate-900">{selectedAsset.fundingSource}</span>
              </div>
            </div>

            {/* Column 3: Procurement, Warranty & Insurance */}
            <div className="space-y-2 text-xs">
              <h3 className="font-semibold text-slate-900 pb-1 border-b border-slate-100">
                3. Procurement, Warranty &amp; Insurance
              </h3>
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier:</span>
                <span className="font-medium text-slate-900">{selectedAsset.supplierName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Invoice Ref:</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {selectedAsset.invoiceReference}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Purchase / Cap Date:</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {selectedAsset.purchaseDate} / {selectedAsset.capitalizationDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Warranty Expiry:</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {selectedAsset.warrantyExpiryDate}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Insurance Policy:</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {selectedAsset.insurancePolicyNo}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Insured Value:</span>
                <span className="font-mono tabular-nums text-slate-900">
                  {formatCurrencyCents(selectedAsset.insuredValueCents, selectedAsset.currency)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Maintenance Schedule:</span>
                <span className="font-medium text-slate-900">
                  {selectedAsset.maintenanceSchedule}
                </span>
              </div>
            </div>

            {/* Column 4: Live QR Code & Barcode Tag */}
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col items-center justify-between">
              <div className="text-[11px] font-semibold text-slate-700">
                MERIDIAN GROUP ASSET TAG
              </div>
              <div className="my-2 flex items-center gap-3">
                <SvgQrCode value={selectedAsset.qrPayload} size={76} />
                <div className="text-left space-y-1">
                  <div className="text-xs font-bold font-mono text-slate-900">
                    {selectedAsset.assetTag}
                  </div>
                  <div className="text-[11px] text-slate-600 max-w-[130px] truncate">
                    {selectedAsset.name}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    {selectedAsset.businessId.toUpperCase()} · {selectedAsset.costCenter}
                  </div>
                </div>
              </div>
              <SvgBarcode128 value={selectedAsset.barcodeValue} width={190} height={34} />
            </div>
          </div>
        </div>
      )}

      {/* Modal: Register New Asset */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Register &amp; Capitalize New Fixed Asset
                </h2>
                <p className="text-xs text-slate-500">
                  Auto-generates QR code, Code 128 barcode, and subledger capitalization entry
                </p>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {duplicateWarning && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center gap-2 text-xs text-red-700">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{duplicateWarning}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Asset Tag Number *
                  </label>
                  <input
                    required
                    value={formState.assetTag}
                    onChange={(e) => setFormState({ ...formState, assetTag: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Asset Name *</label>
                  <input
                    required
                    value={formState.name}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    placeholder="e.g., ABB IRB 6700 Robotic Welding Cell"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Category *</label>
                  <select
                    value={formState.categoryId}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Manufacturer *</label>
                  <input
                    required
                    value={formState.manufacturer}
                    onChange={(e) => setFormState({ ...formState, manufacturer: e.target.value })}
                    placeholder="e.g., ABB Robotics"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Model *</label>
                  <input
                    required
                    value={formState.model}
                    onChange={(e) => setFormState({ ...formState, model: e.target.value })}
                    placeholder="e.g., IRB-6700-200"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Serial Number *</label>
                  <input
                    required
                    value={formState.serialNumber}
                    onChange={(e) => setFormState({ ...formState, serialNumber: e.target.value })}
                    placeholder="e.g., SN-ABB-2026-991"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Business Unit *</label>
                  <select
                    value={formState.businessId}
                    onChange={(e) => setFormState({ ...formState, businessId: e.target.value })}
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
                  <label className="block font-medium text-slate-700 mb-1">Region *</label>
                  <select
                    value={formState.regionId}
                    onChange={(e) => setFormState({ ...formState, regionId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md"
                  >
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Branch / Plant *</label>
                  <select
                    value={formState.branchId}
                    onChange={(e) => setFormState({ ...formState, branchId: e.target.value })}
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
                    Department &amp; Cost Center
                  </label>
                  <input
                    required
                    value={formState.department}
                    onChange={(e) => setFormState({ ...formState, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Original Cost (PKR / Rs.) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formState.originalCostDollars}
                    onChange={(e) =>
                      setFormState({ ...formState, originalCostDollars: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Residual Value (PKR / Rs.) *
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="0"
                    value={formState.residualValueDollars}
                    onChange={(e) =>
                      setFormState({ ...formState, residualValueDollars: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Useful Life (Months) *
                  </label>
                  <input
                    required
                    type="number"
                    min="1"
                    max="1200"
                    value={formState.usefulLifeMonths}
                    onChange={(e) =>
                      setFormState({ ...formState, usefulLifeMonths: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Depreciation Method *
                  </label>
                  <select
                    value={formState.depreciationMethod}
                    onChange={(e) =>
                      setFormState({
                        ...formState,
                        depreciationMethod: e.target.value as DepreciationMethod,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md"
                  >
                    <option value="STRAIGHT_LINE">Straight-Line</option>
                    <option value="REDUCING_BALANCE">Reducing Balance</option>
                    <option value="DOUBLE_DECLINING">Double-Declining Balance</option>
                    <option value="UNITS_OF_PRODUCTION">Units of Production</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Assigned Custodian *
                  </label>
                  <input
                    required
                    value={formState.custodianName}
                    onChange={(e) => setFormState({ ...formState, custodianName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Physical Location *
                  </label>
                  <input
                    required
                    value={formState.physicalLocation}
                    onChange={(e) =>
                      setFormState({ ...formState, physicalLocation: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Supplier Name *</label>
                  <input
                    required
                    value={formState.supplierName}
                    onChange={(e) => setFormState({ ...formState, supplierName: e.target.value })}
                    placeholder="e.g., ABB Industrial Automation"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Invoice Reference *
                  </label>
                  <input
                    required
                    value={formState.invoiceReference}
                    onChange={(e) =>
                      setFormState({ ...formState, invoiceReference: e.target.value })
                    }
                    placeholder="e.g., INV-2026-8840"
                    className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering Asset...' : 'Complete Asset Registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Bulk CSV / Excel Import */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-lg max-w-3xl w-full p-6">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Bulk Asset Register Import (CSV / Excel Format)
                </h2>
                <p className="text-xs text-slate-500">
                  Automatically validates schema, detects duplicate tags, and generates QR &amp; barcode records
                </p>
              </div>
              <button
                onClick={() => setShowBulkModal(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-slate-600 font-mono text-[11px]">
                Format: Tag, Name, CategoryID, Subcategory, Manufacturer, Model, SerialNo, BusinessID, RegionID, BranchID, Department, CostCenter, Location, Custodian, EmpID, PurchaseDate, CostPKR, ResidualPKR, UsefulLifeMonths, Method
              </div>
              <textarea
                rows={5}
                value={bulkCsvText}
                onChange={(e) => setBulkCsvText(e.target.value)}
                className="w-full p-3 border border-slate-200 rounded-md font-mono text-xs"
              />
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkImportSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md hover:bg-slate-800"
                >
                  {isSubmitting ? 'Importing Batch...' : 'Validate & Import Batch'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
