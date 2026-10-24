/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
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
  NavigationTab,
  Region,
  ROLE_PERMISSIONS,
  TransferStatus,
  UserProfile,
  UserRole,
  VerificationSession,
  VerificationStatus,
} from './types/asset';
import { buildEnterpriseSeedData, buildPakistaniMasterData } from './lib/seedData';
import {
  calculateAssetDepreciation,
  formatCurrencyCents,
  parseDollarsToCents,
} from './lib/depreciationEngine';
import { DashboardModule } from './components/DashboardModule';
import { AssetRegisterModule } from './components/AssetRegisterModule';
import { TaggingAndVerificationModule } from './components/TaggingAndVerificationModule';
import { DepreciationAndTransfersModule } from './components/DepreciationAndTransfersModule';
import { ReportsAndGovernanceModule } from './components/ReportsAndGovernanceModule';
import {
  ArrowRightLeft,
  Bell,
  BookOpen,
  Building2,
  Calculator,
  CheckSquare,
  ClipboardCheck,
  FileBarChart2,
  FolderKanban,
  History,
  Layers,
  LayoutDashboard,
  LogIn,
  LogOut,
  PackageCheck,
  QrCode,
  Search,
  Settings,
  Shield,
  Trash2,
  Wrench,
} from 'lucide-react';

const NAV_ITEMS: { id: NavigationTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'dashboard', label: '01. Dashboard', icon: LayoutDashboard },
  { id: 'assets', label: '02. Asset Register', icon: PackageCheck },
  { id: 'categories', label: '03. Asset Categories', icon: Layers },
  { id: 'tagging', label: '04. Asset Tagging', icon: QrCode },
  { id: 'verification', label: '05. Physical Verification', icon: ClipboardCheck },
  { id: 'depreciation', label: '06. Depreciation', icon: Calculator },
  { id: 'transfers', label: '07. Transfers & Movements', icon: ArrowRightLeft },
  { id: 'maintenance', label: '08. Maintenance', icon: Wrench },
  { id: 'disposals', label: '09. Disposals', icon: Trash2 },
  { id: 'reports', label: '10. Reports (20)', icon: FileBarChart2 },
  { id: 'reconciliation', label: '11. Financial Reconciliation', icon: BookOpen },
  { id: 'approvals', label: '12. Approvals', icon: CheckSquare },
  { id: 'organization', label: '13. Organization Setup', icon: Building2 },
  { id: 'users', label: '14. Users & Permissions', icon: Shield },
  { id: 'audit', label: '15. Audit Logs', icon: History },
  { id: 'settings', label: '16. System Settings', icon: Settings },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<NavigationTab>('dashboard');
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Initial clean Pakistani Master structure (0 assets, ready for enterprise data)
  const initialPakistaniMaster = useMemo(
    () => buildPakistaniMasterData('demo-preview-uid'),
    []
  );

  const [userProfile, setUserProfile] = useState<UserProfile>({
    uid: 'demo-preview-uid',
    displayName: 'Head Office Super Administrator (Pakistan)',
    role: 'SUPER_ADMIN',
    assignedBusinessId: 'ALL',
    status: 'ACTIVE',
    createdAt: '2026-10-18T05:00:00.000Z',
    updatedAt: '2026-10-18T05:00:00.000Z',
  });

  const [businesses, setBusinesses] = useState<Business[]>(initialPakistaniMaster.businesses);
  const [regions, setRegions] = useState<Region[]>(initialPakistaniMaster.regions);
  const [branches, setBranches] = useState<Branch[]>(initialPakistaniMaster.branches);
  const [categories, setCategories] = useState<AssetCategory[]>(initialPakistaniMaster.categories);
  const [assets, setAssets] = useState<Asset[]>([]); // 0 assets — clean ledger!
  const [transfers, setTransfers] = useState<AssetTransfer[]>([]);
  const [verifications, setVerifications] = useState<VerificationSession[]>([]);
  const [depreciationRuns, setDepreciationRuns] = useState<DepreciationRun[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [disposals, setDisposals] = useState<AssetDisposal[]>([]);
  const [journals, setJournals] = useState<JournalEntry[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [hasCleanedLegacy, setHasCleanedLegacy] = useState(false);

  // Track Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (firebaseUser) {
        const now = new Date().toISOString();
        const isDefaultAdmin = firebaseUser.email === 'ztahir86@gmail.com';
        const profileDoc: UserProfile = {
          uid: firebaseUser.uid,
          displayName: firebaseUser.displayName || firebaseUser.email || 'Enterprise Officer',
          role: isDefaultAdmin ? 'SUPER_ADMIN' : 'GROUP_FINANCE_MANAGER',
          assignedBusinessId: 'ALL',
          status: 'ACTIVE',
          createdAt: now,
          updatedAt: now,
        };
        setUserProfile(profileDoc);
        try {
          await setDoc(doc(db, 'users', firebaseUser.uid), profileDoc, { merge: true });
          if (firebaseUser.email) {
            await setDoc(
              doc(db, 'users', firebaseUser.uid, 'private', 'info'),
              {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                createdAt: now,
              },
              { merge: true }
            );
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
        }
      }
    });
    return () => unsub();
  }, []);

  // Real-time Firestore synchronization when authenticated
  useEffect(() => {
    if (!authReady || !user) return;
    const uid = user.uid;

    const unsubBusinesses = onSnapshot(
      query(collection(db, 'businesses'), where('ownerUid', '==', uid)),
      async (snap) => {
        if (!snap.empty) {
          const loadedBiz = snap.docs.map((d) => d.data() as Business);
          const hasLegacyUsd = loadedBiz.some(
            (b) => b.baseCurrency !== 'PKR' || b.country !== 'Pakistan'
          );
          if (hasLegacyUsd && !hasCleanedLegacy) {
            setHasCleanedLegacy(true);
            await purgeAllData(uid);
            await initializePakistaniMasterInFirestore(uid);
          } else {
            setBusinesses(loadedBiz);
          }
        } else {
          await initializePakistaniMasterInFirestore(uid);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'businesses')
    );

    const unsubRegions = onSnapshot(
      query(collection(db, 'regions'), where('ownerUid', '==', uid)),
      (snap) => {
        if (!snap.empty) setRegions(snap.docs.map((d) => d.data() as Region));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'regions')
    );

    const unsubBranches = onSnapshot(
      query(collection(db, 'branches'), where('ownerUid', '==', uid)),
      (snap) => {
        if (!snap.empty) setBranches(snap.docs.map((d) => d.data() as Branch));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'branches')
    );

    const unsubCategories = onSnapshot(
      query(collection(db, 'categories'), where('ownerUid', '==', uid)),
      (snap) => {
        if (!snap.empty) setCategories(snap.docs.map((d) => d.data() as AssetCategory));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'categories')
    );

    const unsubAssets = onSnapshot(
      query(collection(db, 'assets'), where('ownerUid', '==', uid)),
      async (snap) => {
        if (!snap.empty) {
          const loadedAssets = snap.docs.map((d) => d.data() as Asset);
          const hasLegacyNonPkr = loadedAssets.some((a) => a.currency !== 'PKR');
          if (hasLegacyNonPkr && !hasCleanedLegacy) {
            setHasCleanedLegacy(true);
            await purgeAllData(uid);
          } else {
            setAssets(loadedAssets);
          }
        } else {
          setAssets([]);
        }
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'assets')
    );

    const unsubTransfers = onSnapshot(
      query(collection(db, 'transfers'), where('ownerUid', '==', uid)),
      (snap) => {
        if (!snap.empty) setTransfers(snap.docs.map((d) => d.data() as AssetTransfer));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'transfers')
    );

    const unsubVerifications = onSnapshot(
      query(collection(db, 'verifications'), where('ownerUid', '==', uid)),
      (snap) => {
        if (!snap.empty) setVerifications(snap.docs.map((d) => d.data() as VerificationSession));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'verifications')
    );

    const unsubDepRuns = onSnapshot(
      query(collection(db, 'depreciationRuns'), where('ownerUid', '==', uid)),
      (snap) => {
        if (!snap.empty) setDepreciationRuns(snap.docs.map((d) => d.data() as DepreciationRun));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'depreciationRuns')
    );

    const unsubMaintenance = onSnapshot(
      query(collection(db, 'maintenance'), where('ownerUid', '==', uid)),
      (snap) => {
        if (!snap.empty) setMaintenance(snap.docs.map((d) => d.data() as MaintenanceRecord));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'maintenance')
    );

    const unsubDisposals = onSnapshot(
      query(collection(db, 'disposals'), where('ownerUid', '==', uid)),
      (snap) => {
        if (!snap.empty) setDisposals(snap.docs.map((d) => d.data() as AssetDisposal));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'disposals')
    );

    const unsubJournals = onSnapshot(
      query(collection(db, 'journals'), where('ownerUid', '==', uid)),
      (snap) => {
        if (!snap.empty) setJournals(snap.docs.map((d) => d.data() as JournalEntry));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'journals')
    );

    const unsubApprovals = onSnapshot(
      query(collection(db, 'approvals'), where('ownerUid', '==', uid)),
      (snap) => {
        if (!snap.empty) setApprovals(snap.docs.map((d) => d.data() as ApprovalRequest));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'approvals')
    );

    const unsubAuditLogs = onSnapshot(
      query(collection(db, 'auditLogs'), where('ownerUid', '==', uid)),
      (snap) => {
        if (!snap.empty) setAuditLogs(snap.docs.map((d) => d.data() as AuditLog));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'auditLogs')
    );

    return () => {
      unsubBusinesses();
      unsubRegions();
      unsubBranches();
      unsubCategories();
      unsubAssets();
      unsubTransfers();
      unsubVerifications();
      unsubDepRuns();
      unsubMaintenance();
      unsubDisposals();
      unsubJournals();
      unsubApprovals();
      unsubAuditLogs();
    };
  }, [authReady, user, hasCleanedLegacy]);

  // Initialize Clean Pakistani Corporate Framework in Firestore (0 assets)
  const initializePakistaniMasterInFirestore = async (uid: string) => {
    const master = buildPakistaniMasterData(uid);
    setBusinesses(master.businesses);
    setRegions(master.regions);
    setBranches(master.branches);
    setCategories(master.categories);
    setAssets([]);
    setTransfers([]);
    setVerifications([]);
    setDepreciationRuns([]);
    setMaintenance([]);
    setDisposals([]);
    setJournals([]);
    setApprovals([]);
    setAuditLogs([]);

    if (user && uid) {
      try {
        const batch = writeBatch(db);
        master.businesses.forEach((b) => batch.set(doc(db, 'businesses', b.id), b));
        master.regions.forEach((r) => batch.set(doc(db, 'regions', r.id), r));
        master.branches.forEach((br) => batch.set(doc(db, 'branches', br.id), br));
        master.categories.forEach((c) => batch.set(doc(db, 'categories', c.id), c));
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'initializePakistaniMasterInFirestore');
      }
    }
  };

  // Completely wipe all asset and transactional data
  const purgeAllData = async (targetUid?: string) => {
    const uid = targetUid || user?.uid;
    setAssets([]);
    setTransfers([]);
    setVerifications([]);
    setDepreciationRuns([]);
    setMaintenance([]);
    setDisposals([]);
    setJournals([]);
    setApprovals([]);
    setAuditLogs([]);

    if (user && uid) {
      try {
        const collectionsToPurge = [
          'assets',
          'transfers',
          'verifications',
          'depreciationRuns',
          'maintenance',
          'disposals',
          'journals',
          'approvals',
          'auditLogs',
        ];

        for (const col of collectionsToPurge) {
          const qSnap = await getDocs(query(collection(db, col), where('ownerUid', '==', uid)));
          if (!qSnap.empty) {
            const batch = writeBatch(db);
            qSnap.docs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }

        // Also check if any old USD businesses exist and remove them
        const bizSnap = await getDocs(query(collection(db, 'businesses'), where('ownerUid', '==', uid)));
        if (!bizSnap.empty) {
          const legacyDocs = bizSnap.docs.filter(
            (d) =>
              (d.data() as Business).baseCurrency !== 'PKR' ||
              (d.data() as Business).country !== 'Pakistan'
          );
          if (legacyDocs.length > 0) {
            const batch = writeBatch(db);
            legacyDocs.forEach((d) => batch.delete(d.ref));
            await batch.commit();
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, 'purgeAllData');
      }
    }
    notifyBanner('All asset and transaction records cleared. Pakistani ledger active (0 assets).');
  };

  // Seed authentic Pakistani sample records when requested
  const seedFirestoreForUser = async (uid: string, email: string) => {
    const seed = buildEnterpriseSeedData(uid, email);
    setBusinesses(seed.businesses);
    setRegions(seed.regions);
    setBranches(seed.branches);
    setCategories(seed.categories);
    setAssets(seed.assets);
    setTransfers(seed.transfers);
    setVerifications(seed.verifications);
    setDepreciationRuns(seed.depreciationRuns);
    setMaintenance(seed.maintenance);
    setDisposals(seed.disposals);
    setJournals(seed.journals);
    setApprovals(seed.approvals);
    setAuditLogs(seed.auditLogs);

    if (user && uid) {
      try {
        // Reference collections
        const refBatch = writeBatch(db);
        seed.businesses.forEach((b) => refBatch.set(doc(db, 'businesses', b.id), b));
        seed.regions.forEach((r) => refBatch.set(doc(db, 'regions', r.id), r));
        seed.branches.forEach((br) => refBatch.set(doc(db, 'branches', br.id), br));
        seed.categories.forEach((c) => refBatch.set(doc(db, 'categories', c.id), c));
        await refBatch.commit();

        // Assets
        const assetBatch = writeBatch(db);
        seed.assets.forEach((a) => assetBatch.set(doc(db, 'assets', a.id), a));
        await assetBatch.commit();

        // Dependent operational records
        const opsBatch = writeBatch(db);
        seed.transfers.forEach((t) => opsBatch.set(doc(db, 'transfers', t.id), t));
        seed.verifications.forEach((v) => opsBatch.set(doc(db, 'verifications', v.id), v));
        seed.depreciationRuns.forEach((dr) => opsBatch.set(doc(db, 'depreciationRuns', dr.id), dr));
        seed.maintenance.forEach((m) => opsBatch.set(doc(db, 'maintenance', m.id), m));
        seed.disposals.forEach((d) => opsBatch.set(doc(db, 'disposals', d.id), d));
        seed.journals.forEach((j) => opsBatch.set(doc(db, 'journals', j.id), j));
        seed.approvals.forEach((ap) => opsBatch.set(doc(db, 'approvals', ap.id), ap));
        seed.auditLogs.forEach((lg) => opsBatch.set(doc(db, 'auditLogs', lg.id), lg));
        await opsBatch.commit();
        notifyBanner('Pakistani demonstration dataset loaded with PKR valuations.');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'seedPakistaniDemoRecords');
      }
    } else {
      notifyBanner('Pakistani demonstration dataset loaded with PKR valuations in preview.');
    }
  };

  const notifyBanner = (msg: string) => {
    setStatusBanner(msg);
    setTimeout(() => setStatusBanner(null), 4000);
  };

  const recordAuditEvent = async (
    moduleName: string,
    action: string,
    entityId: string,
    entityReference: string,
    summary: string
  ) => {
    const now = new Date().toISOString();
    const logItem: AuditLog = {
      id: `log-${Date.now()}-${Math.floor(Math.random() * 900 + 100)}`,
      eventTimestamp: now.replace('T', ' ').slice(0, 19) + ' UTC',
      actorEmail: user?.email || 'ztahir86@gmail.com',
      actorRole: userProfile.role,
      module: moduleName,
      action,
      entityId,
      entityReference,
      summary: summary.slice(0, 490),
      ownerUid: user?.uid || 'demo-preview-uid',
      createdAt: now,
    };
    setAuditLogs((prev) => [logItem, ...prev]);
    if (user) {
      try {
        await setDoc(doc(db, 'auditLogs', logItem.id), logItem);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `auditLogs/${logItem.id}`);
      }
    }
  };

  const permissions = ROLE_PERMISSIONS[userProfile.role];

  // Scope isolation: Head Office / Super Admin / Group Finance / Auditor see all; regional/business users see assigned business
  const scopedAssets = useMemo(() => {
    if (permissions.canViewAllBusinesses || userProfile.assignedBusinessId === 'ALL') {
      return assets;
    }
    return assets.filter((a) => a.businessId === userProfile.assignedBusinessId);
  }, [assets, permissions, userProfile.assignedBusinessId]);

  // Actionable Notifications computed from real system state
  const notifications = useMemo(() => {
    const list: { id: string; category: string; text: string; targetTab: NavigationTab }[] = [];
    const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');
    if (pendingApprovals.length > 0) {
      list.push({
        id: 'notif-apr',
        category: 'Pending Approvals',
        text: `${pendingApprovals.length} governance workflows awaiting authorization`,
        targetTab: 'approvals',
      });
    }
    const missingAssets = scopedAssets.filter((a) => a.verificationStatus === 'MISSING');
    if (missingAssets.length > 0) {
      list.push({
        id: 'notif-mis',
        category: 'Missing Asset Alert',
        text: `${missingAssets.length} asset(s) flagged MISSING during physical verification`,
        targetTab: 'verification',
      });
    }
    const inTransitTransfers = transfers.filter((t) => t.status === 'IN_TRANSIT');
    if (inTransitTransfers.length > 0) {
      list.push({
        id: 'notif-trf',
        category: 'Transfers Awaiting Receipt',
        text: `${inTransitTransfers.length} inter-branch transfer(s) in transit awaiting receipt confirmation`,
        targetTab: 'transfers',
      });
    }
    const unpostedDepRuns = depreciationRuns.filter((r) => r.status !== 'POSTED');
    if (unpostedDepRuns.length > 0) {
      list.push({
        id: 'notif-dep',
        category: 'Depreciation Run Ready',
        text: `${unpostedDepRuns.length} depreciation run(s) ready for GL subledger posting`,
        targetTab: 'depreciation',
      });
    }
    return list;
  }, [approvals, scopedAssets, transfers, depreciationRuns]);

  // CRUD & Workflow Handlers
  const handleCreateAsset = async (
    assetData: Omit<Asset, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>
  ) => {
    const now = new Date().toISOString();
    const newAsset: Asset = {
      ...assetData,
      id: `ast-${Date.now()}`,
      ownerUid: user?.uid || 'demo-preview-uid',
      createdAt: now,
      updatedAt: now,
    };
    setAssets((prev) => [newAsset, ...prev]);
    if (user) {
      try {
        await setDoc(doc(db, 'assets', newAsset.id), newAsset);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `assets/${newAsset.id}`);
      }
    }
    await recordAuditEvent(
      'ASSET_REGISTER',
      'ASSET_REGISTERED',
      newAsset.id,
      newAsset.assetTag,
      `Registered new fixed asset "${newAsset.name}" (${formatCurrencyCents(
        newAsset.originalCostCents
      )}) in ${newAsset.businessId}.`
    );
    notifyBanner(`Asset ${newAsset.assetTag} registered and tagged.`);
  };

  const handleUpdateAsset = async (
    assetId: string,
    updates: Partial<Asset>,
    auditSummary: string
  ) => {
    const now = new Date().toISOString();
    const existing = assets.find((a) => a.id === assetId);
    if (!existing) return;
    const updated: Asset = { ...existing, ...updates, updatedAt: now };
    setAssets((prev) => prev.map((a) => (a.id === assetId ? updated : a)));
    if (selectedAsset?.id === assetId) setSelectedAsset(updated);

    if (user) {
      try {
        await updateDoc(doc(db, 'assets', assetId), { ...updates, updatedAt: now });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `assets/${assetId}`);
      }
    }
    await recordAuditEvent(
      'ASSET_REGISTER',
      'ASSET_UPDATED',
      assetId,
      existing.assetTag,
      auditSummary
    );
    notifyBanner(`Updated ${existing.assetTag}.`);
  };

  const handleDeleteAsset = async (assetId: string, assetTag: string) => {
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
    if (selectedAsset?.id === assetId) setSelectedAsset(null);
    if (user) {
      try {
        await deleteDoc(doc(db, 'assets', assetId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `assets/${assetId}`);
      }
    }
    await recordAuditEvent(
      'ASSET_REGISTER',
      'ASSET_ARCHIVED',
      assetId,
      assetTag,
      `Archived asset record ${assetTag}.`
    );
    notifyBanner(`Archived asset ${assetTag}.`);
  };

  const handleBulkImportAssets = async (
    rows: Omit<Asset, 'id' | 'ownerUid' | 'createdAt' | 'updatedAt'>[]
  ) => {
    const now = new Date().toISOString();
    const created: Asset[] = rows.map((r, idx) => ({
      ...r,
      id: `ast-${Date.now()}-${idx}`,
      ownerUid: user?.uid || 'demo-preview-uid',
      createdAt: now,
      updatedAt: now,
    }));
    setAssets((prev) => [...created, ...prev]);
    if (user) {
      try {
        const batch = writeBatch(db);
        created.forEach((a) => batch.set(doc(db, 'assets', a.id), a));
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'assets/bulkImport');
      }
    }
    await recordAuditEvent(
      'ASSET_REGISTER',
      'BULK_IMPORT',
      created[0]?.id || 'bulk',
      `BATCH-${created.length}`,
      `Bulk imported ${created.length} verified fixed assets into register.`
    );
    notifyBanner(`Successfully imported ${created.length} assets.`);
  };

  const handleExecuteDepreciationRun = async (
    fiscalYear: number,
    periodMonth: number,
    businessId: string,
    categoryId: string,
    mode: 'MONTHLY' | 'ANNUAL'
  ) => {
    const eligible = assets.filter((a) => {
      if (businessId !== 'ALL' && a.businessId !== businessId) return false;
      if (categoryId !== 'ALL' && a.categoryId !== categoryId) return false;
      return true;
    });
    const previews = eligible.map((a) =>
      calculateAssetDepreciation(
        a,
        categories.find((c) => c.id === a.categoryId),
        mode
      )
    );
    const now = new Date().toISOString();
    const runCode = `DEP-${fiscalYear}-M${String(periodMonth).padStart(2, '0')}-${businessId}`;
    const newRun: DepreciationRun = {
      id: `dep-${Date.now()}`,
      runCode,
      fiscalYear,
      periodMonth,
      periodLabel: `FY${fiscalYear} Period ${String(periodMonth).padStart(2, '0')} (${mode})`,
      businessId,
      categoryId,
      assetCount: previews.length,
      openingCostCents: previews.reduce((s, p) => s + p.openingCostCents, 0),
      additionsCents: 0,
      periodDepreciationCents: previews.reduce(
        (s, p) => s + p.periodAccountingDepreciationCents,
        0
      ),
      taxDepreciationCents: previews.reduce((s, p) => s + p.periodTaxDepreciationCents, 0),
      closingAccumDepCents: previews.reduce((s, p) => s + p.closingAccumDepCents, 0),
      closingNetBookValueCents: previews.reduce((s, p) => s + p.closingNetBookValueCents, 0),
      status: 'DRAFT',
      preparedBy: userProfile.displayName,
      reviewedBy: '',
      approvedBy: '',
      postedAt: '',
      ownerUid: user?.uid || 'demo-preview-uid',
      createdAt: now,
      updatedAt: now,
    };
    setDepreciationRuns((prev) => [newRun, ...prev]);
    if (user) {
      try {
        await setDoc(doc(db, 'depreciationRuns', newRun.id), newRun);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `depreciationRuns/${newRun.id}`);
      }
    }
    await recordAuditEvent(
      'DEPRECIATION_ENGINE',
      'RUN_DRAFTED',
      newRun.id,
      newRun.runCode,
      `Drafted ${mode} depreciation run ${newRun.runCode} (${formatCurrencyCents(
        newRun.periodDepreciationCents
      )} expense across ${newRun.assetCount} assets).`
    );
    notifyBanner(`Draft depreciation run ${newRun.runCode} created.`);
  };

  const handleAdvanceDepreciationRunStatus = async (
    run: DepreciationRun,
    nextStatus: DepreciationRun['status']
  ) => {
    const now = new Date().toISOString();
    const updates: Partial<DepreciationRun> = {
      status: nextStatus,
      updatedAt: now,
    };
    if (nextStatus === 'REVIEWED') updates.reviewedBy = userProfile.displayName;
    if (nextStatus === 'APPROVED') updates.approvedBy = userProfile.displayName;
    if (nextStatus === 'POSTED') updates.postedAt = now.slice(0, 16).replace('T', ' ') + ' UTC';

    setDepreciationRuns((prev) =>
      prev.map((r) => (r.id === run.id ? { ...r, ...updates } : r))
    );

    if (user) {
      try {
        await updateDoc(doc(db, 'depreciationRuns', run.id), updates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `depreciationRuns/${run.id}`);
      }
    }

    // When POSTED, atomically update asset accumulated depreciation & NBV and generate GL journal entry
    if (nextStatus === 'POSTED') {
      const targetAssets = assets.filter((a) => {
        if (run.businessId !== 'ALL' && a.businessId !== run.businessId) return false;
        if (run.categoryId !== 'ALL' && a.categoryId !== run.categoryId) return false;
        return true;
      });

      const updatedAssetMap = new Map<string, Asset>();
      for (const asset of targetAssets) {
        const preview = calculateAssetDepreciation(
          asset,
          categories.find((c) => c.id === asset.categoryId),
          'MONTHLY'
        );
        const nextAsset: Asset = {
          ...asset,
          accumulatedDepreciationCents: preview.closingAccumDepCents,
          netBookValueCents: preview.closingNetBookValueCents,
          taxBookValueCents: Math.max(
            asset.residualValueCents,
            asset.taxBookValueCents - preview.periodTaxDepreciationCents
          ),
          operationalStatus: preview.isFullyDepreciatedAfterRun
            ? 'FULLY_DEPRECIATED'
            : asset.operationalStatus,
          updatedAt: now,
        };
        updatedAssetMap.set(asset.id, nextAsset);
        if (user) {
          try {
            await updateDoc(doc(db, 'assets', asset.id), {
              accumulatedDepreciationCents: nextAsset.accumulatedDepreciationCents,
              netBookValueCents: nextAsset.netBookValueCents,
              taxBookValueCents: nextAsset.taxBookValueCents,
              operationalStatus: nextAsset.operationalStatus,
              updatedAt: now,
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.UPDATE, `assets/${asset.id}`);
          }
        }
      }

      setAssets((prev) => prev.map((a) => updatedAssetMap.get(a.id) || a));

      const newJournal: JournalEntry = {
        id: `jrn-${Date.now()}`,
        journalNumber: `JE-${run.fiscalYear}-${String(run.periodMonth).padStart(2, '0')}-${Math.floor(
          Math.random() * 899 + 100
        )}`,
        postingDate: now.slice(0, 10),
        fiscalPeriod: `FY${run.fiscalYear}-P${String(run.periodMonth).padStart(2, '0')}`,
        businessId: run.businessId === 'ALL' ? 'biz-na' : run.businessId,
        costCenter: 'CC-CONSOLIDATED',
        sourceModule: 'DEPRECIATION',
        referenceCode: run.runCode,
        debitAccount: '6400-00-DEP-EXP (Consolidated Depreciation Expense)',
        creditAccount: '1609-00-ACC-DEP (Accumulated Depreciation Subledger)',
        amountCents: run.periodDepreciationCents,
        description: `Posted depreciation run ${run.runCode} across ${run.assetCount} assets.`,
        glReconciled: true,
        status: 'APPROVED',
        ownerUid: user?.uid || 'demo-preview-uid',
        createdAt: now,
        updatedAt: now,
      };
      setJournals((prev) => [newJournal, ...prev]);
      if (user) {
        try {
          await setDoc(doc(db, 'journals', newJournal.id), newJournal);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `journals/${newJournal.id}`);
        }
      }
    }

    await recordAuditEvent(
      'DEPRECIATION_ENGINE',
      `RUN_${nextStatus}`,
      run.id,
      run.runCode,
      `Transitioned depreciation run ${run.runCode} to ${nextStatus}.`
    );
    notifyBanner(`Depreciation run ${run.runCode} marked ${nextStatus}.`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: Zone 1 (Brand), Zone 2 (4 Concise Quick Nav Links), Zone 3 (Primary Auth/Action) */}
      <header className="bg-white border-b border-slate-200 px-6 py-3.5 flex items-center justify-between gap-8 sticky top-0 z-30 no-print">
        <a
          href="#dashboard"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('dashboard');
          }}
          className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
          <span>Sultan Poultry Farms · Enterprise Fixed Asset Ledger</span>
        </a>

        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-slate-600">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'dashboard' ? 'text-slate-900 font-semibold underline underline-offset-4' : ''
            }`}
          >
            Executive Dashboard
          </button>
          <button
            onClick={() => setActiveTab('assets')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'assets' ? 'text-slate-900 font-semibold underline underline-offset-4' : ''
            }`}
          >
            Asset Register
          </button>
          <button
            onClick={() => setActiveTab('depreciation')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'depreciation'
                ? 'text-slate-900 font-semibold underline underline-offset-4'
                : ''
            }`}
          >
            Depreciation Engine
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'reports' ? 'text-slate-900 font-semibold underline underline-offset-4' : ''
            }`}
          >
            Consolidated Reports
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md">
            <span>🇵🇰</span>
            <span>Head Office + 5 Farms · PKR (Rs.)</span>
          </div>

          <button
            onClick={() => purgeAllData()}
            title="Clear all asset records, transfers, and transactions"
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear All Data</span>
            <span className="sm:hidden">Clear</span>
          </button>

          {user ? (
            <button
              onClick={() => signOut(auth)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out ({user.email?.split('@')[0]})
            </button>
          ) : (
            <button
              onClick={async () => {
                try {
                  await signInWithPopup(auth, googleProvider);
                } catch (err) {
                  console.error('Sign-in error:', err);
                }
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <LogIn className="w-3.5 h-3.5" />
              Sign In with Google
            </button>
          )}
        </div>
      </header>

      {/* Main Enterprise Workspace Layout: Left Sidebar (260px) + Contextual Subheader & Viewport */}
      <div className="flex-1 flex min-h-0">
        {/* Left Navigation Sidebar (16 Enterprise Modules) */}
        <aside className="w-64 bg-white border-r border-slate-200 shrink-0 hidden lg:flex flex-col justify-between no-print">
          <div className="p-3 space-y-0.5 overflow-y-auto">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-4 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-600 space-y-1">
            <div className="font-semibold text-slate-900 truncate">{permissions.label}</div>
            <div>
              Scope:{' '}
              <span className="font-mono font-semibold text-slate-800">
                {userProfile.assignedBusinessId === 'ALL'
                  ? 'HEAD OFFICE (ALL)'
                  : userProfile.assignedBusinessId.toUpperCase()}
              </span>
            </div>
            <div>
              Storage:{' '}
              <span className="font-mono text-emerald-700">
                {user ? 'Firestore Live Sync' : 'Interactive Sandbox'}
              </span>
            </div>
          </div>
        </aside>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Workspace Utility Sub-Toolbar (Breadcrumbs, Global Asset Search, Actionable Notifications) */}
          <div className="bg-white border-b border-slate-200 px-6 py-2.5 flex flex-wrap items-center justify-between gap-4 no-print">
            {/* Mobile Navigation Selector + Breadcrumb */}
            <div className="flex items-center gap-3">
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as NavigationTab)}
                className="lg:hidden px-2.5 py-1.5 text-xs font-medium bg-slate-100 border border-slate-200 rounded-md"
              >
                {NAV_ITEMS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>

              <div className="text-xs text-slate-500 flex items-center gap-2">
                <span>Head Office Group</span>
                <span aria-hidden="true">/</span>
                <span className="font-semibold text-slate-900">
                  {NAV_ITEMS.find((n) => n.id === activeTab)?.label}
                </span>
              </div>
            </div>

            {/* Global Asset Search & Notification Center */}
            <div className="flex items-center gap-3">
              <div className="relative w-64 sm:w-80">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && globalSearch.trim()) {
                      const q = globalSearch.toLowerCase();
                      const found = scopedAssets.find(
                        (a) =>
                          a.assetTag.toLowerCase().includes(q) ||
                          a.name.toLowerCase().includes(q) ||
                          a.serialNumber.toLowerCase().includes(q)
                      );
                      if (found) {
                        setSelectedAsset(found);
                        setActiveTab('assets');
                      }
                    }
                  }}
                  placeholder="Global lookup by Asset Tag or Serial (Press Enter)..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md whitespace-nowrap shrink-0"
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Alerts ({notifications.length})</span>
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-40 space-y-2">
                    <div className="text-xs font-semibold text-slate-900 pb-2 border-b border-slate-100">
                      Enterprise Workflow &amp; Audit Notifications
                    </div>
                    {notifications.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => {
                          setActiveTab(n.targetTab);
                          setShowNotifications(false);
                        }}
                        className="w-full text-left p-2 rounded hover:bg-slate-50 transition-colors block"
                      >
                        <div className="text-[11px] font-semibold text-slate-900">{n.category}</div>
                        <div className="text-xs text-slate-600">{n.text}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {statusBanner && (
            <div className="bg-slate-900 text-white px-6 py-2 text-xs font-medium flex items-center justify-between no-print">
              <span>{statusBanner}</span>
              <button onClick={() => setStatusBanner(null)} className="text-slate-300 hover:text-white">
                Dismiss
              </button>
            </div>
          )}

          {/* Main Module Viewport */}
          <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
            {activeTab === 'dashboard' && (
              <DashboardModule
                assets={scopedAssets}
                businesses={businesses}
                regions={regions}
                branches={branches}
                categories={categories}
                depreciationRuns={depreciationRuns}
                onNavigate={setActiveTab}
                onSelectAsset={(asset) => {
                  setSelectedAsset(asset);
                  setActiveTab('assets');
                }}
              />
            )}

            {activeTab === 'assets' && (
              <AssetRegisterModule
                assets={scopedAssets}
                businesses={businesses}
                regions={regions}
                branches={branches}
                categories={categories}
                permissions={permissions}
                selectedAsset={selectedAsset}
                onSelectAsset={setSelectedAsset}
                onCreateAsset={handleCreateAsset}
                onUpdateAsset={handleUpdateAsset}
                onDeleteAsset={handleDeleteAsset}
                onBulkImportAssets={handleBulkImportAssets}
              />
            )}

            {(activeTab === 'categories' ||
              activeTab === 'tagging' ||
              activeTab === 'verification') && (
              <TaggingAndVerificationModule
                mode={activeTab}
                assets={scopedAssets}
                businesses={businesses}
                branches={branches}
                categories={categories}
                verifications={verifications}
                permissions={permissions}
                onCreateCategory={async (catData) => {
                  const now = new Date().toISOString();
                  const newCat: AssetCategory = {
                    ...catData,
                    id: `cat-${Date.now()}`,
                    ownerUid: user?.uid || 'demo-preview-uid',
                    createdAt: now,
                  };
                  setCategories((prev) => [...prev, newCat]);
                  if (user) {
                    try {
                      await setDoc(doc(db, 'categories', newCat.id), newCat);
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, `categories/${newCat.id}`);
                    }
                  }
                  await recordAuditEvent(
                    'CATEGORIES',
                    'POLICY_CREATED',
                    newCat.id,
                    newCat.code,
                    `Created asset category policy "${newCat.name}" (${newCat.defaultDepreciationMethod}).`
                  );
                  notifyBanner(`Category policy ${newCat.code} created.`);
                }}
                onUpdateAssetVerification={async (assetId, status, notes) => {
                  await handleUpdateAsset(
                    assetId,
                    {
                      verificationStatus: status,
                      lastVerifiedDate: new Date().toISOString().slice(0, 10),
                      remarks: notes,
                    },
                    notes
                  );
                }}
                onCreateVerificationSession={async (sessionData) => {
                  const now = new Date().toISOString();
                  const session: VerificationSession = {
                    ...sessionData,
                    id: `ver-${Date.now()}`,
                    ownerUid: user?.uid || 'demo-preview-uid',
                    createdAt: now,
                    updatedAt: now,
                  };
                  setVerifications((prev) => [session, ...prev]);
                  if (user) {
                    try {
                      await setDoc(doc(db, 'verifications', session.id), session);
                    } catch (err) {
                      handleFirestoreError(
                        err,
                        OperationType.CREATE,
                        `verifications/${session.id}`
                      );
                    }
                  }
                  await recordAuditEvent(
                    'PHYSICAL_VERIFICATION',
                    'SESSION_LAUNCHED',
                    session.id,
                    session.sessionCode,
                    `Launched physical verification session ${session.sessionCode} (${session.title}).`
                  );
                  notifyBanner(`Verification session ${session.sessionCode} launched.`);
                }}
                onUpdateVerificationSession={async (sessionId, updates) => {
                  const now = new Date().toISOString();
                  setVerifications((prev) =>
                    prev.map((v) =>
                      v.id === sessionId ? { ...v, ...updates, updatedAt: now } : v
                    )
                  );
                  if (user) {
                    try {
                      await updateDoc(doc(db, 'verifications', sessionId), {
                        ...updates,
                        updatedAt: now,
                      });
                    } catch (err) {
                      handleFirestoreError(err, OperationType.UPDATE, `verifications/${sessionId}`);
                    }
                  }
                  notifyBanner(`Verification session updated.`);
                }}
                onOpenAssetProfile={(asset) => {
                  setSelectedAsset(asset);
                  setActiveTab('assets');
                }}
              />
            )}

            {(activeTab === 'depreciation' ||
              activeTab === 'transfers' ||
              activeTab === 'maintenance' ||
              activeTab === 'disposals') && (
              <DepreciationAndTransfersModule
                mode={activeTab}
                assets={scopedAssets}
                businesses={businesses}
                regions={regions}
                branches={branches}
                categories={categories}
                depreciationRuns={depreciationRuns}
                transfers={transfers}
                maintenance={maintenance}
                disposals={disposals}
                permissions={permissions}
                actorName={userProfile.displayName}
                onExecuteDepreciationRun={handleExecuteDepreciationRun}
                onAdvanceDepreciationRunStatus={handleAdvanceDepreciationRunStatus}
                onManualValuationAdjustment={async (
                  assetId,
                  impairmentDollars,
                  revaluationDollars,
                  reason
                ) => {
                  const target = assets.find((a) => a.id === assetId);
                  if (!target) return;
                  const impCents = parseDollarsToCents(impairmentDollars);
                  const revCents = parseDollarsToCents(revaluationDollars);
                  const newNbv = Math.max(
                    target.residualValueCents,
                    target.originalCostCents +
                      revCents -
                      target.accumulatedDepreciationCents -
                      impCents
                  );
                  await handleUpdateAsset(
                    assetId,
                    {
                      impairmentCents: impCents,
                      revaluationReserveCents: revCents,
                      netBookValueCents: newNbv,
                      remarks: `Valuation Adjusted: ${reason}`,
                    },
                    `Applied manual valuation adjustment on ${target.assetTag} (Impairment: ${formatCurrencyCents(
                      impCents
                    )}, Revaluation: ${formatCurrencyCents(revCents)}). Reason: ${reason}`
                  );
                }}
                onCreateTransfer={async (trfData) => {
                  const now = new Date().toISOString();
                  const trf: AssetTransfer = {
                    ...trfData,
                    id: `trf-${Date.now()}`,
                    ownerUid: user?.uid || 'demo-preview-uid',
                    createdAt: now,
                    updatedAt: now,
                  };
                  setTransfers((prev) => [trf, ...prev]);
                  if (user) {
                    try {
                      await setDoc(doc(db, 'transfers', trf.id), trf);
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, `transfers/${trf.id}`);
                    }
                  }
                  await recordAuditEvent(
                    'ASSET_TRANSFERS',
                    'TRANSFER_REQUESTED',
                    trf.id,
                    trf.transferNumber,
                    `Initiated transfer ${trf.transferNumber} for ${trf.assetTag} (${trf.fromBranchId} → ${trf.toBranchId}).`
                  );
                  notifyBanner(`Transfer ${trf.transferNumber} submitted.`);
                }}
                onAdvanceTransferStatus={async (trf, nextStatus) => {
                  const now = new Date().toISOString();
                  const updates: Partial<AssetTransfer> = {
                    status: nextStatus,
                    updatedAt: now,
                  };
                  if (nextStatus === 'APPROVED') updates.approvedByName = userProfile.displayName;
                  if (nextStatus === 'IN_TRANSIT')
                    updates.dispatchConfirmedAt = now.slice(0, 16).replace('T', ' ') + ' UTC';
                  if (nextStatus === 'RECEIVED')
                    updates.receivedConfirmedAt = now.slice(0, 16).replace('T', ' ') + ' UTC';

                  setTransfers((prev) =>
                    prev.map((t) => (t.id === trf.id ? { ...t, ...updates } : t))
                  );
                  if (user) {
                    try {
                      await updateDoc(doc(db, 'transfers', trf.id), updates);
                    } catch (err) {
                      handleFirestoreError(err, OperationType.UPDATE, `transfers/${trf.id}`);
                    }
                  }

                  // Update asset location and custodian when RECEIVED
                  if (nextStatus === 'RECEIVED') {
                    await handleUpdateAsset(
                      trf.assetId,
                      {
                        businessId: trf.toBusinessId,
                        regionId: trf.toRegionId,
                        branchId: trf.toBranchId,
                        department: trf.toDepartment,
                        custodianName: trf.toCustodian,
                        operationalStatus: 'ACTIVE',
                      },
                      `Completed transfer ${trf.transferNumber}: reassigned ${trf.assetTag} to ${trf.toBusinessId}/${trf.toBranchId} (${trf.toCustodian}).`
                    );
                  }
                  notifyBanner(`Transfer ${trf.transferNumber} status updated to ${nextStatus}.`);
                }}
                onCreateMaintenance={async (mntData) => {
                  const now = new Date().toISOString();
                  const rec: MaintenanceRecord = {
                    ...mntData,
                    id: `mnt-${Date.now()}`,
                    ownerUid: user?.uid || 'demo-preview-uid',
                    createdAt: now,
                    updatedAt: now,
                  };
                  setMaintenance((prev) => [rec, ...prev]);
                  if (user) {
                    try {
                      await setDoc(doc(db, 'maintenance', rec.id), rec);
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, `maintenance/${rec.id}`);
                    }
                  }
                  await recordAuditEvent(
                    'MAINTENANCE',
                    'TICKET_SCHEDULED',
                    rec.id,
                    rec.ticketNumber,
                    `Scheduled ${rec.maintenanceType} maintenance ${rec.ticketNumber} for ${rec.assetTag}.`
                  );
                  notifyBanner(`Maintenance ticket ${rec.ticketNumber} scheduled.`);
                }}
                onCompleteMaintenance={async (rec) => {
                  const now = new Date().toISOString();
                  const completedDate = now.slice(0, 10);
                  setMaintenance((prev) =>
                    prev.map((m) =>
                      m.id === rec.id
                        ? { ...m, status: 'COMPLETED', completedDate, updatedAt: now }
                        : m
                    )
                  );
                  if (user) {
                    try {
                      await updateDoc(doc(db, 'maintenance', rec.id), {
                        status: 'COMPLETED',
                        completedDate,
                        updatedAt: now,
                      });
                    } catch (err) {
                      handleFirestoreError(err, OperationType.UPDATE, `maintenance/${rec.id}`);
                    }
                  }
                  await recordAuditEvent(
                    'MAINTENANCE',
                    'TICKET_COMPLETED',
                    rec.id,
                    rec.ticketNumber,
                    `Completed maintenance ${rec.ticketNumber} on ${rec.assetTag}.`
                  );
                  notifyBanner(`Maintenance ${rec.ticketNumber} completed.`);
                }}
                onCreateDisposal={async (dspData) => {
                  const now = new Date().toISOString();
                  const dsp: AssetDisposal = {
                    ...dspData,
                    id: `dsp-${Date.now()}`,
                    ownerUid: user?.uid || 'demo-preview-uid',
                    createdAt: now,
                    updatedAt: now,
                  };
                  setDisposals((prev) => [dsp, ...prev]);
                  if (user) {
                    try {
                      await setDoc(doc(db, 'disposals', dsp.id), dsp);
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, `disposals/${dsp.id}`);
                    }
                  }
                  await recordAuditEvent(
                    'DISPOSALS',
                    'DISPOSAL_INITIATED',
                    dsp.id,
                    dsp.disposalNumber,
                    `Initiated ${dsp.disposalMethod} disposal ${dsp.disposalNumber} for ${dsp.assetTag}.`
                  );
                  notifyBanner(`Disposal ${dsp.disposalNumber} created.`);
                }}
                onExecuteDisposal={async (dsp) => {
                  const now = new Date().toISOString();
                  setDisposals((prev) =>
                    prev.map((d) =>
                      d.id === dsp.id
                        ? {
                            ...d,
                            status: 'EXECUTED',
                            approvedBy: userProfile.displayName,
                            updatedAt: now,
                          }
                        : d
                    )
                  );
                  if (user) {
                    try {
                      await updateDoc(doc(db, 'disposals', dsp.id), {
                        status: 'EXECUTED',
                        approvedBy: userProfile.displayName,
                        updatedAt: now,
                      });
                    } catch (err) {
                      handleFirestoreError(err, OperationType.UPDATE, `disposals/${dsp.id}`);
                    }
                  }
                  await handleUpdateAsset(
                    dsp.assetId,
                    {
                      operationalStatus: 'DISPOSED',
                      netBookValueCents: 0,
                    },
                    `Executed disposal ${dsp.disposalNumber}: derecognized asset ${dsp.assetTag} with net gain/loss ${formatCurrencyCents(
                      dsp.gainLossCents
                    )}.`
                  );
                  notifyBanner(`Disposal ${dsp.disposalNumber} executed and asset derecognized.`);
                }}
              />
            )}

            {(activeTab === 'reports' ||
              activeTab === 'reconciliation' ||
              activeTab === 'approvals' ||
              activeTab === 'organization' ||
              activeTab === 'users' ||
              activeTab === 'audit' ||
              activeTab === 'settings') && (
              <ReportsAndGovernanceModule
                mode={activeTab}
                assets={scopedAssets}
                businesses={businesses}
                regions={regions}
                branches={branches}
                categories={categories}
                transfers={transfers}
                verifications={verifications}
                depreciationRuns={depreciationRuns}
                maintenance={maintenance}
                disposals={disposals}
                journals={journals}
                approvals={approvals}
                auditLogs={auditLogs}
                currentUserProfile={userProfile}
                permissions={permissions}
                onChangeActiveRole={async (role, assignedBusinessId) => {
                  const now = new Date().toISOString();
                  setUserProfile((prev) => ({
                    ...prev,
                    role,
                    assignedBusinessId,
                    updatedAt: now,
                  }));
                  notifyBanner(
                    `Switched active role to ${ROLE_PERMISSIONS[role].label} (Scope: ${assignedBusinessId}).`
                  );
                }}
                onDecideApproval={async (apr, decision, notes) => {
                  const now = new Date().toISOString();
                  setApprovals((prev) =>
                    prev.map((a) =>
                      a.id === apr.id
                        ? { ...a, status: decision, decisionNotes: notes, updatedAt: now }
                        : a
                    )
                  );
                  if (user) {
                    try {
                      await updateDoc(doc(db, 'approvals', apr.id), {
                        status: decision,
                        decisionNotes: notes,
                        updatedAt: now,
                      });
                    } catch (err) {
                      handleFirestoreError(err, OperationType.UPDATE, `approvals/${apr.id}`);
                    }
                  }
                  await recordAuditEvent(
                    'APPROVAL_WORKFLOW',
                    `WORKFLOW_${decision}`,
                    apr.id,
                    apr.requestCode,
                    `${decision} workflow request ${apr.requestCode} (${apr.targetLabel}).`
                  );
                  notifyBanner(`Approval ${apr.requestCode} marked ${decision}.`);
                }}
                onReconcileJournal={async (journalId) => {
                  const now = new Date().toISOString();
                  setJournals((prev) =>
                    prev.map((j) =>
                      j.id === journalId
                        ? { ...j, glReconciled: true, status: 'APPROVED', updatedAt: now }
                        : j
                    )
                  );
                  if (user) {
                    try {
                      await updateDoc(doc(db, 'journals', journalId), {
                        glReconciled: true,
                        status: 'APPROVED',
                        updatedAt: now,
                      });
                    } catch (err) {
                      handleFirestoreError(err, OperationType.UPDATE, `journals/${journalId}`);
                    }
                  }
                  notifyBanner(`Journal entry reconciled with General Ledger.`);
                }}
                onCreateBusiness={async (bizData) => {
                  const now = new Date().toISOString();
                  const newB: Business = {
                    ...bizData,
                    id: `biz-${Date.now()}`,
                    ownerUid: user?.uid || 'demo-preview-uid',
                    createdAt: now,
                    updatedAt: now,
                  };
                  setBusinesses((prev) => [...prev, newB]);
                  if (user) {
                    try {
                      await setDoc(doc(db, 'businesses', newB.id), newB);
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, `businesses/${newB.id}`);
                    }
                  }
                  notifyBanner(`Subsidiary ${newB.code} added to Head Office hierarchy.`);
                }}
                onCreateBranch={async (brData) => {
                  const now = new Date().toISOString();
                  const newBr: Branch = {
                    ...brData,
                    id: `br-${Date.now()}`,
                    ownerUid: user?.uid || 'demo-preview-uid',
                    createdAt: now,
                  };
                  setBranches((prev) => [...prev, newBr]);
                  if (user) {
                    try {
                      await setDoc(doc(db, 'branches', newBr.id), newBr);
                    } catch (err) {
                      handleFirestoreError(err, OperationType.CREATE, `branches/${newBr.id}`);
                    }
                  }
                  notifyBanner(`Facility ${newBr.code} added.`);
                }}
                onSeedDemoData={async () => {
                  if (user) {
                    await seedFirestoreForUser(user.uid, user.email || 'ztahir86@gmail.com');
                  } else {
                    const seed = buildEnterpriseSeedData('demo-preview-uid', 'ztahir86@gmail.com');
                    setBusinesses(seed.businesses);
                    setRegions(seed.regions);
                    setBranches(seed.branches);
                    setCategories(seed.categories);
                    setAssets(seed.assets);
                    setTransfers(seed.transfers);
                    setVerifications(seed.verifications);
                    setDepreciationRuns(seed.depreciationRuns);
                    setMaintenance(seed.maintenance);
                    setDisposals(seed.disposals);
                    setJournals(seed.journals);
                    setApprovals(seed.approvals);
                    setAuditLogs(seed.auditLogs);
                    notifyBanner('Pakistani demonstration dataset loaded with PKR valuations.');
                  }
                }}
                onPurgeDemoData={async () => {
                  await purgeAllData();
                }}
                onDrillDownAsset={(asset) => {
                  setSelectedAsset(asset);
                  setActiveTab('assets');
                }}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
