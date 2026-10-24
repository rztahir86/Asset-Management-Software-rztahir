import React, { useEffect, useRef, useState } from 'react';
import {
  Asset,
  AssetCategory,
  Branch,
  Business,
  DepreciationMethod,
  RolePermissionMatrix,
  VerificationSession,
  VerificationStatus,
} from '../types/asset';
import { SvgBarcode128, SvgQrCode } from './QrBarcodeGraphic';
import { formatCurrencyCents } from '../lib/depreciationEngine';
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Plus,
  Printer,
  QrCode,
  Search,
  StopCircle,
} from 'lucide-react';

interface TaggingAndVerificationModuleProps {
  mode: 'categories' | 'tagging' | 'verification';
  assets: Asset[];
  businesses: Business[];
  branches: Branch[];
  categories: AssetCategory[];
  verifications: VerificationSession[];
  permissions: RolePermissionMatrix;
  onCreateCategory: (
    cat: Omit<AssetCategory, 'id' | 'ownerUid' | 'createdAt'>
  ) => Promise<void>;
  onUpdateAssetVerification: (
    assetId: string,
    status: VerificationStatus,
    notes: string
  ) => Promise<void>;
  onCreateVerificationSession: (
    session: Omit<VerificationSession, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
  ) => Promise<void>;
  onUpdateVerificationSession: (
    sessionId: string,
    updates: Partial<VerificationSession>
  ) => Promise<void>;
  onOpenAssetProfile: (asset: Asset) => void;
}

export const TaggingAndVerificationModule: React.FC<TaggingAndVerificationModuleProps> = ({
  mode,
  assets,
  businesses,
  branches,
  categories,
  verifications,
  permissions,
  onCreateCategory,
  onUpdateAssetVerification,
  onCreateVerificationSession,
  onUpdateVerificationSession,
  onOpenAssetProfile,
}) => {
  // Tagging Studio state
  const [labelSize, setLabelSize] = useState<'SMALL' | 'STANDARD' | 'INDUSTRIAL'>('STANDARD');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('ALL');
  const [scanInput, setScanInput] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedAsset, setScannedAsset] = useState<Asset | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Category creation state
  const [newCat, setNewCat] = useState({
    code: 'CAT-BIO-60',
    name: 'Biosecurity, Sanitation & Disinfection Systems',
    parentCategory: 'Poultry Farm Infrastructure',
    defaultDepreciationMethod: 'STRAIGHT_LINE' as DepreciationMethod,
    defaultUsefulLifeMonths: 84,
    defaultResidualRatePct: 5,
    glAssetAccount: '1660-00-BIO',
    glAccumDepAccount: '1669-00-ACC-BIO',
    glDepExpenseAccount: '6460-00-DEP-BIO',
    taxDepreciationRatePct: 15,
  });

  // Verification session state
  const [newSession, setNewSession] = useState({
    sessionCode: `VER-2026-Q4-${String(verifications.length + 10).padStart(2, '0')}`,
    title: 'Q4 2026 Chakwal Grandparent Breeder & Shed Audit',
    businessId: businesses[0]?.id || 'biz-sultan-poultry',
    branchId: branches[1]?.id || branches[0]?.id || 'br-ckw-frm-01',
    categoryId: 'ALL',
    scheduledDate: '2026-10-20',
    auditorName: 'Tariq Mehmood (Senior Poultry Internal Auditor)',
    notes: 'Physical scanning of climate sensors, automated feeding lines, and standby generators across Sheds 1-4.',
  });

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startMobileCameraScan = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch {
      setCameraError(
        'Camera stream unavailable in current browser context. Use Instant QR/Tag Scanner Lookup below to simulate mobile scan.'
      );
    }
  };

  const stopMobileCameraScan = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleScanLookup = (queryValue: string) => {
    const clean = queryValue.trim().toLowerCase();
    if (!clean) return;
    const match = assets.find(
      (a) =>
        a.assetTag.toLowerCase() === clean ||
        a.barcodeValue.toLowerCase() === clean ||
        a.qrPayload.toLowerCase().includes(clean) ||
        a.id.toLowerCase() === clean
    );
    if (match) {
      setScannedAsset(match);
    }
  };

  if (mode === 'categories') {
    return (
      <div className="space-y-6">
        <div className="bg-white border border-slate-200 rounded-lg p-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">
                Accounting Policy &amp; GL Account Mapping Configuration
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                Asset Categories, Useful Life &amp; Depreciation Policies
              </h1>
            </div>
          </div>

          {permissions.canManageOrgAndUsers && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await onCreateCategory({
                  ...newCat,
                  status: 'ACTIVE',
                });
              }}
              className="mt-5 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs"
            >
              <div>
                <label className="block font-medium text-slate-700 mb-1">Category Code</label>
                <input
                  required
                  value={newCat.code}
                  onChange={(e) => setNewCat({ ...newCat, code: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Category Name</label>
                <input
                  required
                  value={newCat.name}
                  onChange={(e) => setNewCat({ ...newCat, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">Default Method</label>
                <select
                  value={newCat.defaultDepreciationMethod}
                  onChange={(e) =>
                    setNewCat({
                      ...newCat,
                      defaultDepreciationMethod: e.target.value as DepreciationMethod,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-md"
                >
                  <option value="STRAIGHT_LINE">Straight-Line</option>
                  <option value="REDUCING_BALANCE">Reducing Balance</option>
                  <option value="DOUBLE_DECLINING">Double-Declining</option>
                  <option value="UNITS_OF_PRODUCTION">Units of Production</option>
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Useful Life (Mos) · Residual %
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="1"
                    value={newCat.defaultUsefulLifeMonths}
                    onChange={(e) =>
                      setNewCat({
                        ...newCat,
                        defaultUsefulLifeMonths: parseInt(e.target.value, 10) || 60,
                      })
                    }
                    className="w-1/2 px-2 py-2 border border-slate-200 rounded-md font-mono"
                  />
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newCat.defaultResidualRatePct}
                    onChange={(e) =>
                      setNewCat({
                        ...newCat,
                        defaultResidualRatePct: parseInt(e.target.value, 10) || 10,
                      })
                    }
                    className="w-1/2 px-2 py-2 border border-slate-200 rounded-md font-mono"
                  />
                </div>
              </div>
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                >
                  + Add Category Policy
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
                  <th className="py-2.5 px-4">Code</th>
                  <th className="py-2.5 px-4">Category &amp; Parent Class</th>
                  <th className="py-2.5 px-4">Book Depreciation Policy</th>
                  <th className="py-2.5 px-4 text-right">Useful Life</th>
                  <th className="py-2.5 px-4 text-right">Residual Rate</th>
                  <th className="py-2.5 px-4 text-right">Tax Dep. Rate</th>
                  <th className="py-2.5 px-4">GL Asset Account</th>
                  <th className="py-2.5 px-4">GL Accum. Dep.</th>
                  <th className="py-2.5 px-4">GL Dep. Expense</th>
                  <th className="py-2.5 px-4 text-right">Active Assets</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {categories.map((cat) => {
                  const count = assets.filter((a) => a.categoryId === cat.id).length;
                  return (
                    <tr key={cat.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                        {cat.code}
                      </td>
                      <td className="py-2.5 px-4">
                        <div className="font-medium text-slate-900">{cat.name}</div>
                        <div className="text-[11px] text-slate-500">{cat.parentCategory}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700">
                        {cat.defaultDepreciationMethod.replace(/_/g, ' ')}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {cat.defaultUsefulLifeMonths} mos ({(cat.defaultUsefulLifeMonths / 12).toFixed(1)} yrs)
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-900">
                        {cat.defaultResidualRatePct}%
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-700">
                        {cat.taxDepreciationRatePct}% p.a.
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">{cat.glAssetAccount}</td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">
                        {cat.glAccumDepAccount}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-700">
                        {cat.glDepExpenseAccount}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'tagging') {
    const tagAssets = assets.filter(
      (a) => selectedBranchFilter === 'ALL' || a.branchId === selectedBranchFilter
    );

    return (
      <div className="space-y-6">
        {/* Tagging Header & Print Controls */}
        <div className="bg-white border border-slate-200 rounded-lg p-5 no-print">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <div className="text-xs text-slate-500">
                ISO/IEC 18004 QR Code &amp; Code-128 Asset Label Studio
              </div>
              <h1 className="text-xl font-bold text-slate-900 mt-1">
                Asset Tagging, Label Printing &amp; Mobile QR Scanner
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
                {(['SMALL', 'STANDARD', 'INDUSTRIAL'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => setLabelSize(sz)}
                    className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      labelSize === sz
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sz === 'SMALL'
                      ? 'Small (50×25mm)'
                      : sz === 'STANDARD'
                      ? 'Standard (70×38mm)'
                      : 'Industrial Plate (100×50mm)'}
                  </button>
                ))}
              </div>

              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md"
              >
                <option value="ALL">All Branches ({assets.length} labels)</option>
                {branches.map((br) => (
                  <option key={br.id} value={br.id}>
                    {br.code} — {br.name}
                  </option>
                ))}
              </select>

              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md whitespace-nowrap shrink-0"
              >
                <Printer className="w-3.5 h-3.5" />
                Print Asset Labels
              </button>
            </div>
          </div>

          {/* Mobile Phone Camera QR Scanner & Instant Tag Lookup */}
          <div className="mt-5 pt-5 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">
                Mobile Camera QR Scanner &amp; Instant Asset Profile Opener
              </h2>
              <p className="text-xs text-slate-600">
                Scan any physical asset QR tag using your mobile camera or select/enter a tag below to open the complete asset profile immediately.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                {!cameraActive ? (
                  <button
                    onClick={startMobileCameraScan}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Activate Mobile Camera Scanner
                  </button>
                ) : (
                  <button
                    onClick={stopMobileCameraScan}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md"
                  >
                    <StopCircle className="w-3.5 h-3.5" />
                    Stop Camera Stream
                  </button>
                )}

                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="text"
                    value={scanInput}
                    onChange={(e) => setScanInput(e.target.value)}
                    placeholder="Enter or scan Asset Tag (e.g. MRD-EU-MCH-00101)..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-md font-mono"
                  />
                  <button
                    onClick={() => handleScanLookup(scanInput)}
                    className="px-3 py-2 text-xs font-semibold text-white bg-slate-900 rounded-md whitespace-nowrap shrink-0"
                  >
                    Lookup Tag
                  </button>
                </div>
              </div>

              {cameraError && (
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2.5">
                  {cameraError}
                </div>
              )}

              {cameraActive && (
                <div className="relative bg-slate-900 rounded-lg overflow-hidden h-48 flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 border-2 border-emerald-400/80 m-8 rounded pointer-events-none flex items-end justify-center pb-2">
                    <span className="text-[11px] font-mono text-white bg-slate-900/80 px-2 py-0.5 rounded">
                      Align QR Code Within Optical Frame
                    </span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-slate-500">Quick-Scan Test Tags:</span>
                {assets.slice(0, 4).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setScanInput(a.assetTag);
                      setScannedAsset(a);
                    }}
                    className="px-2 py-1 text-[11px] font-mono bg-slate-100 hover:bg-slate-200 text-slate-800 rounded"
                  >
                    {a.assetTag}
                  </button>
                ))}
              </div>
            </div>

            {/* Scanned Asset Immediate Profile Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              {scannedAsset ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-[11px] font-mono text-emerald-700 font-semibold">
                        QR SCAN MATCHED · {scannedAsset.assetTag}
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                        {scannedAsset.name}
                      </h3>
                      <p className="text-xs text-slate-500">
                        {scannedAsset.businessId.toUpperCase()} · {scannedAsset.physicalLocation} · Custodian: {scannedAsset.custodianName}
                      </p>
                    </div>
                    <SvgQrCode value={scannedAsset.qrPayload} size={56} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-xs">
                    <div>
                      <span className="text-slate-500 block">Net Book Value</span>
                      <span className="font-mono font-semibold text-slate-900">
                        {formatCurrencyCents(scannedAsset.netBookValueCents)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Status</span>
                      <span className="font-medium text-slate-900">
                        {scannedAsset.operationalStatus}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Verification</span>
                      <span className="font-semibold text-emerald-700">
                        {scannedAsset.verificationStatus}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => onOpenAssetProfile(scannedAsset)}
                      className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
                    >
                      Open Full Asset Register Profile →
                    </button>
                    <button
                      onClick={() =>
                        onUpdateAssetVerification(
                          scannedAsset.id,
                          'VERIFIED',
                          'Verified via Mobile QR Scanner'
                        )
                      }
                      className="px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-md"
                    >
                      Confirm Physical Verification
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-8 text-xs text-slate-500">
                  <QrCode className="w-8 h-8 text-slate-400 mb-2" />
                  <div>Scan a QR label or click any test tag to open its live asset profile.</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Printable Label Sheet Grid */}
        <div
          className={`grid gap-4 ${
            labelSize === 'SMALL'
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              : labelSize === 'STANDARD'
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 lg:grid-cols-2'
          }`}
        >
          {tagAssets.map((asset) => {
            const biz = businesses.find((b) => b.id === asset.businessId);
            return (
              <div
                key={asset.id}
                className="bg-white border-2 border-slate-900 rounded-md p-4 flex flex-col justify-between break-inside-avoid"
              >
                <div className="flex items-center justify-between border-b border-slate-300 pb-2">
                  <span className="text-[11px] font-bold tracking-wider uppercase text-slate-900">
                    {biz?.name || 'MERIDIAN ENTERPRISE GROUP'}
                  </span>
                  <span className="text-[10px] font-mono font-semibold text-slate-700">
                    PROPERTY OF HEAD OFFICE
                  </span>
                </div>

                <div className="flex items-center gap-4 my-3">
                  <SvgQrCode
                    value={asset.qrPayload}
                    size={labelSize === 'SMALL' ? 64 : labelSize === 'STANDARD' ? 84 : 104}
                  />
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="text-xs font-bold font-mono text-slate-900">
                      {asset.assetTag}
                    </div>
                    <div className="text-xs font-semibold text-slate-900 truncate">
                      {asset.name}
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono">
                      SN: {asset.serialNumber}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Loc: {asset.branchId.toUpperCase()} · {asset.costCenter}
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 flex items-center justify-center">
                  <SvgBarcode128
                    value={asset.barcodeValue}
                    width={labelSize === 'SMALL' ? 160 : 220}
                    height={34}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Physical Verification & Reconciliation Mode
  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-lg p-5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500">
              Field Audit &amp; System Register Reconciliation
            </div>
            <h1 className="text-xl font-bold text-slate-900 mt-1">
              Physical Asset Verification &amp; Discrepancy Control
            </h1>
          </div>
        </div>

        {/* Launch New Verification Exercise */}
        {permissions.canEditAsset && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const expectedAssets = assets.filter(
                (a) =>
                  a.businessId === newSession.businessId &&
                  (newSession.branchId === 'ALL' || a.branchId === newSession.branchId)
              );
              await onCreateVerificationSession({
                ...newSession,
                totalExpected: expectedAssets.length,
                verifiedCount: expectedAssets.filter((a) => a.verificationStatus === 'VERIFIED')
                  .length,
                missingCount: expectedAssets.filter((a) => a.verificationStatus === 'MISSING')
                  .length,
                damagedCount: expectedAssets.filter((a) => a.verificationStatus === 'DAMAGED')
                  .length,
                relocatedCount: expectedAssets.filter((a) => a.verificationStatus === 'RELOCATED')
                  .length,
                unregisteredCount: 0,
                status: 'IN_PROGRESS',
              });
            }}
            className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs"
          >
            <div>
              <label className="block font-medium text-slate-700 mb-1">Session Code</label>
              <input
                required
                value={newSession.sessionCode}
                onChange={(e) => setNewSession({ ...newSession, sessionCode: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-md font-mono"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Exercise Title</label>
              <input
                required
                value={newSession.title}
                onChange={(e) => setNewSession({ ...newSession, title: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-md"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Target Branch</label>
              <select
                value={newSession.branchId}
                onChange={(e) => setNewSession({ ...newSession, branchId: e.target.value })}
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
              <label className="block font-medium text-slate-700 mb-1">Lead Auditor</label>
              <input
                required
                value={newSession.auditorName}
                onChange={(e) => setNewSession({ ...newSession, auditorName: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-md"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md"
              >
                + Launch Verification Session
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Verification Sessions History */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Physical Verification Exercises &amp; Reconciliation Summary
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Session Code</th>
                <th className="py-2.5 px-4">Exercise Title &amp; Auditor</th>
                <th className="py-2.5 px-4">Scheduled Date</th>
                <th className="py-2.5 px-4 text-right">System Expected</th>
                <th className="py-2.5 px-4 text-right">Verified</th>
                <th className="py-2.5 px-4 text-right">Missing</th>
                <th className="py-2.5 px-4 text-right">Damaged / Relocated</th>
                <th className="py-2.5 px-4 text-right">Unregistered</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {verifications.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                    {v.sessionCode}
                  </td>
                  <td className="py-2.5 px-4">
                    <div className="font-medium text-slate-900">{v.title}</div>
                    <div className="text-[11px] text-slate-500">Auditor: {v.auditorName}</div>
                  </td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600">
                    {v.scheduledDate}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                    {v.totalExpected}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                    {v.verifiedCount}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-red-600 font-semibold">
                    {v.missingCount}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-700">
                    {v.damagedCount + v.relocatedCount}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                    {v.unregisteredCount}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{v.status}</td>
                  <td className="py-2.5 px-4 text-right">
                    {v.status !== 'CLOSED' && permissions.canEditAsset && (
                      <button
                        onClick={() =>
                          onUpdateVerificationSession(v.id, { status: 'CLOSED' })
                        }
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded"
                      >
                        Close &amp; Certify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Asset-by-Asset Physical Verification & Discrepancy Recorder */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-900">
            Line-Item Physical Count vs. System Register Reconciliation
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record physical verification outcome (Verified, Missing, Damaged, Relocated) per asset
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <th className="py-2.5 px-4">Asset Tag</th>
                <th className="py-2.5 px-4">Asset Name</th>
                <th className="py-2.5 px-4">Expected Branch · Location</th>
                <th className="py-2.5 px-4">Custodian</th>
                <th className="py-2.5 px-4">Last Verified</th>
                <th className="py-2.5 px-4">Current Audit Status</th>
                <th className="py-2.5 px-4 text-right">Record Physical Verification</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-xs">
              {assets.map((asset) => (
                <tr key={asset.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                    {asset.assetTag}
                  </td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">{asset.name}</td>
                  <td className="py-2.5 px-4 text-slate-600">
                    {asset.branchId} · {asset.physicalLocation}
                  </td>
                  <td className="py-2.5 px-4 text-slate-600">{asset.custodianName}</td>
                  <td className="py-2.5 px-4 font-mono tabular-nums text-slate-600">
                    {asset.lastVerifiedDate}
                  </td>
                  <td className="py-2.5 px-4 font-semibold">
                    <span
                      className={
                        asset.verificationStatus === 'VERIFIED'
                          ? 'text-emerald-700'
                          : asset.verificationStatus === 'MISSING'
                          ? 'text-red-600'
                          : 'text-amber-700'
                      }
                    >
                      {asset.verificationStatus}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right space-x-1 whitespace-nowrap">
                    {(['VERIFIED', 'MISSING', 'DAMAGED', 'RELOCATED'] as VerificationStatus[]).map(
                      (st) => (
                        <button
                          key={st}
                          onClick={() =>
                            onUpdateAssetVerification(
                              asset.id,
                              st,
                              `Physical verification marked ${st} on ${new Date()
                                .toISOString()
                                .slice(0, 10)}`
                            )
                          }
                          className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                            asset.verificationStatus === st
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {st}
                        </button>
                      )
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
