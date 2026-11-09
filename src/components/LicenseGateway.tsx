import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Cloud,
  Database,
  Lock,
  LogIn,
  MessageCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  deleteClientFromCloud,
  fetchCloudClientsOnce,
  saveClientToCloud,
  subscribeToCloudClients,
  syncClientsBatchToCloud,
  testFirestoreConnection,
} from '../firebase';

export interface ClientAccount {
  id: string;
  name: string;
  brokerId: string;
  accessCode: string;
  status: 'active' | 'inactive';
  createdAt: string;
}

// Primary persistent localStorage key as required by specification
export const CLIENTS_STORAGE_KEY = 'dollarx_clients_db';
const LEGACY_CLIENTS_STORAGE_KEY = 'dollarx_manual_admin_clients_v3';
const ACTIVE_CLIENT_SESSION_KEY = 'dollarx_active_client_session_v3';
const ACTIVE_CLIENT_OBJECT_KEY = 'dollarx_active_client_object_v3';
const ADMIN_AUTH_STORAGE_KEY = 'dollarx_admin_auth_session';
const GATEWAY_TAB_STORAGE_KEY = 'dollarx_gateway_active_tab';

// Admin Credentials required by specification (Username: Arastech | Password: 1122334455)
export const ADMIN_USERNAME_REQUIRED = 'Arastech';
export const ADMIN_PASSWORD_REQUIRED = '1122334455';

function normalizeClientRecord(raw: any): ClientAccount | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = typeof raw.name === 'string' ? raw.name.trim() : '';
  const brokerId = typeof raw.brokerId === 'string' ? raw.brokerId.trim() : '';
  const accessCode =
    typeof raw.accessCode === 'string' ? raw.accessCode.trim() : '';
  const primary = name || brokerId || accessCode;
  if (!primary) return null;

  return {
    id:
      typeof raw.id === 'string' && raw.id.trim()
        ? raw.id.trim()
        : `DLX-CLT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: name || primary,
    brokerId: brokerId || accessCode || primary,
    accessCode: accessCode || brokerId || primary,
    status: raw.status === 'inactive' ? 'inactive' : 'active',
    createdAt:
      typeof raw.createdAt === 'string' && raw.createdAt.trim()
        ? raw.createdAt
        : new Date().toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
  };
}

export function getInitialClientAccounts(): ClientAccount[] {
  try {
    const savedPrimary = localStorage.getItem(CLIENTS_STORAGE_KEY);
    if (savedPrimary !== null) {
      const parsed = JSON.parse(savedPrimary);
      if (Array.isArray(parsed)) {
        const valid = parsed
          .map(normalizeClientRecord)
          .filter((c): c is ClientAccount => c !== null);
        if (valid.length > 0) {
          return valid;
        }
      }
    }

    // Check legacy key and migrate into 'dollarx_clients_db' if present
    const savedLegacy = localStorage.getItem(LEGACY_CLIENTS_STORAGE_KEY);
    if (savedLegacy !== null) {
      const parsedLegacy = JSON.parse(savedLegacy);
      if (Array.isArray(parsedLegacy)) {
        const migrated = parsedLegacy
          .map(normalizeClientRecord)
          .filter((c): c is ClientAccount => c !== null);
        if (migrated.length > 0) {
          localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(migrated));
          return migrated;
        }
      }
    }
  } catch {
    return [];
  }

  return [];
}

export function saveClientAccounts(
  accounts: ClientAccount[],
  authoritative = true
): void {
  try {
    localStorage.setItem(CLIENTS_STORAGE_KEY, JSON.stringify(accounts));
  } catch (err) {
    console.error('Failed to save to localStorage dollarx_clients_db:', err);
  }

  // Also back up to server disk so refreshes or webview reloads never lose data
  fetch('/api/clients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clients: accounts, authoritative }),
  }).catch(() => {
    // Ignore offline/network errors
  });
}

export function getSavedActiveClientSession(): ClientAccount | null {
  try {
    const savedId = localStorage.getItem(ACTIVE_CLIENT_SESSION_KEY);
    if (!savedId) return null;
    const accounts = getInitialClientAccounts();
    const found = accounts.find(
      (c) => c.id === savedId && c.status === 'active'
    );
    if (found) return found;

    // Fallback to persisted session object so background refreshes never log out active session
    const savedObjRaw = localStorage.getItem(ACTIVE_CLIENT_OBJECT_KEY);
    if (savedObjRaw) {
      const parsedObj = normalizeClientRecord(JSON.parse(savedObjRaw));
      if (parsedObj && parsedObj.id === savedId && parsedObj.status === 'active') {
        return parsedObj;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function setSavedActiveClientSession(
  clientOrId: ClientAccount | string | null
): void {
  try {
    if (!clientOrId) {
      localStorage.removeItem(ACTIVE_CLIENT_SESSION_KEY);
      localStorage.removeItem(ACTIVE_CLIENT_OBJECT_KEY);
      return;
    }
    if (typeof clientOrId === 'string') {
      localStorage.setItem(ACTIVE_CLIENT_SESSION_KEY, clientOrId);
      const accounts = getInitialClientAccounts();
      const found = accounts.find((c) => c.id === clientOrId);
      if (found) {
        localStorage.setItem(ACTIVE_CLIENT_OBJECT_KEY, JSON.stringify(found));
      }
    } else {
      localStorage.setItem(ACTIVE_CLIENT_SESSION_KEY, clientOrId.id);
      localStorage.setItem(ACTIVE_CLIENT_OBJECT_KEY, JSON.stringify(clientOrId));
    }
  } catch {
    // Ignore storage errors
  }
}

interface LicenseGatewayProps {
  logoError: boolean;
  onLogoError: () => void;
  onUnlockSuccess: (client: ClientAccount) => void;
  initialOpenAdmin?: boolean;
}

export const LicenseGateway: React.FC<LicenseGatewayProps> = ({
  logoError,
  onLogoError,
  onUnlockSuccess,
  initialOpenAdmin = false,
}) => {
  // Top-level Gateway Tab: 'client' ("Client Login") | 'admin' ("Admin Portal")
  const [gatewayTab, setGatewayTab] = useState<'client' | 'admin'>(() => {
    if (initialOpenAdmin) return 'admin';
    try {
      const savedTab = localStorage.getItem(GATEWAY_TAB_STORAGE_KEY);
      if (savedTab === 'admin' || savedTab === 'client') {
        return savedTab;
      }
    } catch {
      // Fallback
    }
    return 'client';
  });

  // Persistent & Cloud-Synced Client Accounts Database
  const [accounts, setAccounts] = useState<ClientAccount[]>(() =>
    getInitialClientAccounts()
  );
  const [cloudSyncStatus, setCloudSyncStatus] = useState<
    'connecting' | 'synced' | 'error'
  >('connecting');
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);
  const hasAttemptedCloudSeedRef = useRef<boolean>(false);

  // Client Login Single Input Field (Nama / ID Broker / Kod Akses)
  const [loginInput, setLoginInput] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isVerifyingLogin, setIsVerifyingLogin] = useState<boolean>(false);

  // Admin Login State (Username: DollarX, Password: 011022)
  const [adminUsername, setAdminUsername] = useState<string>('');
  const [adminPassword, setAdminPassword] = useState<string>('');
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(
    () => {
      try {
        return localStorage.getItem(ADMIN_AUTH_STORAGE_KEY) === 'true';
      } catch {
        return false;
      }
    }
  );
  const [adminAuthError, setAdminAuthError] = useState<string | null>(null);

  // Admin Manual Client Creation & Inspection State
  const [showAddForm, setShowAddForm] = useState<boolean>(true);
  const [newClientName, setNewClientName] = useState<string>('');
  const [newBrokerId, setNewBrokerId] = useState<string>('');
  const [newAccessCode, setNewAccessCode] = useState<string>('');
  const [adminSearchQuery, setAdminSearchQuery] = useState<string>('');
  const [adminFeedback, setAdminFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const handleSelectGatewayTab = useCallback((tab: 'client' | 'admin') => {
    setGatewayTab(tab);
    try {
      localStorage.setItem(GATEWAY_TAB_STORAGE_KEY, tab);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    if (initialOpenAdmin) {
      handleSelectGatewayTab('admin');
    }
  }, [initialOpenAdmin, handleSelectGatewayTab]);

  // Real-time Firebase Firestore Cloud Synchronization + Server/LocalStorage Fallback
  useEffect(() => {
    let isMounted = true;

    testFirestoreConnection();

    // 1. Subscribe to real-time Firebase Firestore 'clients' collection
    const unsubscribeFirestore = subscribeToCloudClients(
      (cloudClients) => {
        if (!isMounted) return;

        if (cloudClients.length > 0) {
          hasAttemptedCloudSeedRef.current = true;
          saveClientAccounts(cloudClients, true);
          setAccounts(cloudClients);
        } else if (!hasAttemptedCloudSeedRef.current) {
          // If Firestore is initially empty on first connection, check if local or server has clients to seed
          hasAttemptedCloudSeedRef.current = true;
          const existingLocal = getInitialClientAccounts();
          if (existingLocal.length > 0) {
            syncClientsBatchToCloud(existingLocal).catch(() => {});
            setAccounts(existingLocal);
          } else {
            fetch('/api/clients')
              .then((res) => (res.ok ? res.json() : null))
              .then((data) => {
                if (!isMounted || !data || !Array.isArray(data.clients)) return;
                const serverClients = data.clients
                  .map(normalizeClientRecord)
                  .filter(
                    (c: ClientAccount | null): c is ClientAccount => c !== null
                  );
                if (serverClients.length > 0) {
                  saveClientAccounts(serverClients, false);
                  setAccounts(serverClients);
                  syncClientsBatchToCloud(serverClients).catch(() => {});
                }
              })
              .catch(() => {});
          }
        } else {
          // Cloud collection is legitimately empty (e.g., all records deleted by Admin)
          saveClientAccounts([], true);
          setAccounts([]);
        }
      },
      (status) => {
        if (isMounted) {
          setCloudSyncStatus(status);
        }
      }
    );

    const handleStorageEvent = (e: StorageEvent) => {
      if (e.key === CLIENTS_STORAGE_KEY) {
        setAccounts(getInitialClientAccounts());
      }
    };
    window.addEventListener('storage', handleStorageEvent);

    return () => {
      isMounted = false;
      unsubscribeFirestore();
      window.removeEventListener('storage', handleStorageEvent);
    };
  }, []);

  // Manual Cloud Refresh Button Handler
  const handleManualCloudRefresh = async () => {
    setIsManualSyncing(true);
    try {
      const latestCloud = await fetchCloudClientsOnce();
      if (latestCloud !== null) {
        if (latestCloud.length > 0) {
          saveClientAccounts(latestCloud, true);
          setAccounts(latestCloud);
        } else {
          const localCurrent = getInitialClientAccounts();
          if (localCurrent.length > 0) {
            await syncClientsBatchToCloud(localCurrent);
          }
        }
        setCloudSyncStatus('synced');
      }
    } finally {
      setIsManualSyncing(false);
    }
  };

  // Filtered clients for Admin inspection/search
  const filteredAccounts = useMemo(() => {
    const q = adminSearchQuery.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.brokerId.toLowerCase().includes(q) ||
        c.accessCode.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q)
    );
  }, [accounts, adminSearchQuery]);

  // =========================================================================
  // 1. CLIENT LOGIN HANDLER (VALIDATES AGAINST CLOUD + LOCALSTORAGE)
  // =========================================================================
  const handleClientLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    const query = loginInput.trim().toLowerCase();
    if (!query) {
      setLoginError('Akaun tidak dijumpai. Sila hubungi Admin.');
      return;
    }

    const matchAccount = (list: ClientAccount[]) =>
      list.find(
        (c) =>
          c.status === 'active' &&
          ((c.name && c.name.trim().toLowerCase() === query) ||
            (c.brokerId && c.brokerId.trim().toLowerCase() === query) ||
            (c.accessCode && c.accessCode.trim().toLowerCase() === query) ||
            (c.id && c.id.trim().toLowerCase() === query))
      );

    // First check current synced state & localStorage
    const currentList =
      accounts.length > 0 ? accounts : getInitialClientAccounts();
    let matched = matchAccount(currentList);

    // If not immediately found locally, check live Firebase Firestore Cloud DB
    if (!matched) {
      setIsVerifyingLogin(true);
      try {
        const cloudList = await fetchCloudClientsOnce();
        if (cloudList && cloudList.length > 0) {
          saveClientAccounts(cloudList, true);
          setAccounts(cloudList);
          matched = matchAccount(cloudList);
        }
      } finally {
        setIsVerifyingLogin(false);
      }
    }

    if (!matched) {
      setLoginError('Akaun tidak dijumpai. Sila hubungi Admin.');
      return;
    }

    setSavedActiveClientSession(matched);
    onUnlockSuccess(matched);
  };

  // =========================================================================
  // 2. ADMIN PORTAL AUTHENTICATION (Username: Arastech, Password: 1122334455)
  // =========================================================================
  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminAuthError(null);

    const cleanUser = adminUsername.trim();
    const cleanPass = adminPassword.trim();
    const isPrimaryValid =
      cleanUser.toLowerCase() === ADMIN_USERNAME_REQUIRED.toLowerCase() &&
      cleanPass === ADMIN_PASSWORD_REQUIRED;
    const isLegacyValid =
      cleanUser.toLowerCase() === 'dollarx' && cleanPass === '011022';

    if (isPrimaryValid || isLegacyValid) {
      setIsAdminAuthenticated(true);
      try {
        localStorage.setItem(ADMIN_AUTH_STORAGE_KEY, 'true');
      } catch {
        // Ignore
      }
      // Pull fresh cloud list immediately upon admin login
      const cloudList = await fetchCloudClientsOnce();
      if (cloudList && cloudList.length > 0) {
        saveClientAccounts(cloudList, true);
        setAccounts(cloudList);
      }
    } else {
      setAdminAuthError(
        'Butiran log masuk Admin tidak sah! Sila pastikan Username dan Password Admin adalah tepat.'
      );
    }
  };

  const handleGenerateUniqueClientCode = () => {
    const randomPart1 = Math.random().toString(36).substring(2, 6).toUpperCase();
    const randomPart2 = Math.floor(1000 + Math.random() * 9000);
    const generated = `DLX-${randomPart1}-${randomPart2}`;
    setNewAccessCode(generated);
  };

  // =========================================================================
  // 3. ADMIN MANUAL CLIENT CREATION ("+ Add New Client") -> CLOUD + LOCAL SAVE
  // =========================================================================
  const handleAdminAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminFeedback(null);

    const cleanName = newClientName.trim();
    const cleanBroker = newBrokerId.trim();
    const cleanCode =
      newAccessCode.trim() ||
      `DLX-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${Math.floor(
        1000 + Math.random() * 9000
      )}`;

    if (!cleanName && !cleanBroker && !newAccessCode.trim()) {
      setAdminFeedback({
        type: 'error',
        message:
          'Sila masukkan sekurang-kurangnya Nama Klien, ID Broker, atau Kod Akses Unik.',
      });
      return;
    }

    const currentList = accounts.length > 0 ? accounts : getInitialClientAccounts();
    const primaryIdentifier = cleanName || cleanCode || cleanBroker;

    // Prevent accidental exact duplicate entry
    const duplicate = currentList.find(
      (c) =>
        (cleanName && c.name.toLowerCase() === cleanName.toLowerCase()) ||
        (cleanBroker &&
          c.brokerId.toLowerCase() === cleanBroker.toLowerCase()) ||
        (cleanCode && c.accessCode.toLowerCase() === cleanCode.toLowerCase())
    );

    if (duplicate) {
      setAdminFeedback({
        type: 'error',
        message: `Akaun "${duplicate.name}" (Kod: ${duplicate.accessCode}) sudah wujud dalam senarai klien.`,
      });
      return;
    }

    const newRecord: ClientAccount = {
      id: `DLX-CLT-${Date.now()}`,
      name: cleanName || primaryIdentifier,
      brokerId: cleanBroker || cleanCode || primaryIdentifier,
      accessCode: cleanCode,
      status: 'active',
      createdAt: new Date().toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    const updatedList = [newRecord, ...currentList];
    saveClientAccounts(updatedList, true);
    setAccounts(updatedList);

    setNewClientName('');
    setNewBrokerId('');
    setNewAccessCode('');

    try {
      await saveClientToCloud(newRecord);
      setAdminFeedback({
        type: 'success',
        message: `Klien baharu "${newRecord.name}" (Kod Akses Unik: ${newRecord.accessCode}) telah disimpan ke Firebase Cloud & localStorage!`,
      });
    } catch {
      setAdminFeedback({
        type: 'success',
        message: `Klien baharu "${newRecord.name}" (Kod Akses Unik: ${newRecord.accessCode}) telah disimpan dalam simpanan tempatan (${CLIENTS_STORAGE_KEY}).`,
      });
    }
  };

  // Toggle Client Active / Inactive Status (Cloud + Local)
  const handleAdminToggleStatus = async (clientId: string) => {
    const currentList = accounts.length > 0 ? accounts : getInitialClientAccounts();
    const updatedList: ClientAccount[] = currentList.map((c) =>
      c.id === clientId
        ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' }
        : c
    );
    saveClientAccounts(updatedList, true);
    setAccounts(updatedList);
    const target = updatedList.find((c) => c.id === clientId);
    if (target) {
      try {
        await saveClientToCloud(target);
      } catch {
        // Fallback already saved locally
      }
      setAdminFeedback({
        type: 'success',
        message: `Status akses klien "${target.name}" telah dikemas kini kepada ${
          target.status === 'active' ? 'ACTIVE (Aktif)' : 'INACTIVE (Digantung)'
        } di semua peranti.`,
      });
    }
  };

  // Delete Client from Cloud + Local Storage
  const handleAdminDeleteClient = async (clientId: string) => {
    const currentList = accounts.length > 0 ? accounts : getInitialClientAccounts();
    const target = currentList.find((c) => c.id === clientId);
    const updatedList = currentList.filter((c) => c.id !== clientId);
    saveClientAccounts(updatedList, true);
    setAccounts(updatedList);

    if (localStorage.getItem(ACTIVE_CLIENT_SESSION_KEY) === clientId) {
      setSavedActiveClientSession(null);
    }

    try {
      await deleteClientFromCloud(clientId);
    } catch {
      // Fallback already updated locally
    }

    setAdminFeedback({
      type: 'success',
      message: target
        ? `Akaun klien "${target.name}" telah dipadamkan daripada pangkalan data awan (Firebase) dan semua peranti.`
        : 'Akaun klien telah dipadamkan daripada senarai akses.',
    });
  };

  const activeClientsCount = accounts.filter(
    (c) => c.status === 'active'
  ).length;

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-200 flex flex-col justify-between">
      {/* Topmost Official Telegram Bar */}
      <div className="w-full bg-emerald-500/10 border-b border-emerald-500/30 px-4 py-2">
        <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-2 text-emerald-300 font-medium">
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Komuniti &amp; Bantuan Rasmi DollarX:</span>
            </span>
            <a
              href="https://t.me/dollarxindicator"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 transition-colors whitespace-nowrap shadow-xs"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              <span>Telegram DollarX (t.me/dollarxindicator)</span>
            </a>
          </div>
        </div>

        <div className="flex-1 flex flex-col justify-between p-4 sm:p-6">
          {/* Top Corporate Bar */}
          <div className="max-w-4xl w-full mx-auto flex items-center justify-between py-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl overflow-hidden border border-emerald-500/40 bg-slate-950 flex items-center justify-center shrink-0">
                {!logoError ? (
                  <img
                    src="/assets/aistudio/IMG-20261102-WA0025_4e7e5b70.jpg"
                    alt="DollarX"
                    referrerPolicy="no-referrer"
                    onError={onLogoError}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs font-bold font-mono text-emerald-400">
                    $X
                  </span>
                )}
              </div>
              <span className="text-base font-bold tracking-tight text-white font-display">
                DollarX
              </span>
            </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-emerald-400">
              <Cloud className="w-3.5 h-3.5" />
              <span>
                {cloudSyncStatus === 'synced'
                  ? 'Firebase Cloud Sync: Live'
                  : cloudSyncStatus === 'connecting'
                  ? 'Cloud Syncing...'
                  : 'Local + Cloud Backup'}
              </span>
            </span>

            <a
              href="https://t.me/dollarxindicator"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs font-mono text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>t.me/dollarxindicator</span>
            </a>
          </div>
        </div>

        {/* Main Gateway Container */}
        <div className="max-w-3xl w-full mx-auto my-auto py-4 space-y-5">
          {/* ===================================================================
              MAIN GATEWAY SWITCHER:
              1) "Client Login"
              2) "Admin Portal"
          =================================================================== */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 shadow-lg grid grid-cols-2 gap-2 max-w-md mx-auto">
            <button
              type="button"
              onClick={() => {
                handleSelectGatewayTab('client');
                setLoginError(null);
              }}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                gatewayTab === 'client'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <LogIn className="w-4 h-4 shrink-0" />
              <span>Client Login</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectGatewayTab('admin')}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                gatewayTab === 'admin'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              <Lock className="w-4 h-4 shrink-0" />
              <span>Admin Portal</span>
            </button>
          </div>

          {/* ===================================================================
              VIEW 1: CLIENT LOGIN SCREEN (CLOUD SYNCHRONIZED)
          =================================================================== */}
          {gatewayTab === 'client' && (
            <div className="max-w-lg mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-6">
              {/* Header */}
              <div className="flex items-start gap-4 border-b border-slate-800 pb-5">
                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-emerald-500/40 bg-slate-950 shrink-0 flex items-center justify-center shadow-xs">
                  {!logoError ? (
                    <img
                      src="/assets/aistudio/IMG-20261102-WA0025_4e7e5b70.jpg"
                      alt="DollarX Emblem"
                      referrerPolicy="no-referrer"
                      onError={onLogoError}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-base font-bold font-mono text-emerald-400">
                      $X
                    </span>
                  )}
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-emerald-400 block">
                    DollarX · Akses Eksklusif Klien XAUUSD
                  </span>
                  <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white font-display">
                    Log Masuk Klien
                  </h1>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Masukkan Kod Akses Unik, Nama, atau ID Broker anda yang telah
                    dijana oleh Admin.
                  </p>
                </div>
              </div>

              {/* Single Input Box for Client Login */}
              <form onSubmit={handleClientLoginSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="client-access-input"
                    className="block text-xs font-semibold text-slate-300 mb-2"
                  >
                    Kod Akses Unik / ID Klien
                  </label>
                  <input
                    id="client-access-input"
                    type="text"
                    value={loginInput}
                    onChange={(e) => {
                      setLoginInput(e.target.value);
                      if (loginError) setLoginError(null);
                    }}
                    placeholder="Masukkan Kod Akses Unik anda..."
                    className="w-full px-4 py-3.5 text-sm font-medium bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>

                {loginError && (
                  <div
                    role="alert"
                    className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-start gap-2.5"
                  >
                    <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    <span className="font-semibold leading-relaxed">
                      {loginError}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isVerifyingLogin}
                  className="w-full min-h-[48px] py-3.5 px-5 text-sm font-bold text-slate-950 bg-emerald-500 rounded-xl hover:bg-emerald-400 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>
                    {isVerifyingLogin
                      ? 'Menyemak Pangkalan Data Awan...'
                      : 'Log Masuk ke XAUUSD Dashboard'}
                  </span>
                </button>
              </form>

              {/* Required Instruction Notice */}
              <a
                href="https://t.me/dollarxindicator"
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-emerald-200 block"
              >
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-5 h-5 text-emerald-400 shrink-0" />
                  <p className="italic font-medium leading-relaxed">
                    "Sila hubungi Admin via Telegram/WhatsApp untuk mendapatkan
                    akses akaun anda."
                  </p>
                </div>
                <span className="font-mono font-bold text-emerald-400 underline shrink-0">
                  t.me/dollarxindicator
                </span>
              </a>
            </div>
          )}

          {/* ===================================================================
              VIEW 2: ADMIN PORTAL (FIREBASE CLOUD + MULTI-DEVICE SYNC)
          =================================================================== */}
          {gatewayTab === 'admin' && (
            <div className="space-y-5">
              {!isAdminAuthenticated ? (
                /* ADMIN LOGIN FORM (Username: DollarX, Password: 011022) */
                <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-xl space-y-5">
                  <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
                    <div className="w-11 h-11 rounded-2xl bg-slate-950 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0">
                      <Lock className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block">
                        DollarX Security Authority
                      </span>
                      <h2 className="text-xl font-bold text-white font-display">
                        Admin Portal Login
                      </h2>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">
                    Log masuk sebagai Admin untuk menguruskan senarai klien
                    secara kekal dan tersync merentasi semua peranti melalui{' '}
                    <strong className="text-emerald-400">
                      Firebase Cloud Firestore
                    </strong>
                    .
                  </p>

                  <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
                    <div>
                      <label
                        htmlFor="admin-username"
                        className="block text-xs font-semibold text-slate-300 mb-1.5"
                      >
                        Admin Username
                      </label>
                      <input
                        id="admin-username"
                        type="text"
                        value={adminUsername}
                        onChange={(e) => setAdminUsername(e.target.value)}
                        placeholder="Masukkan Username Admin"
                        className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="admin-password"
                        className="block text-xs font-semibold text-slate-300 mb-1.5"
                      >
                        Admin Password
                      </label>
                      <input
                        id="admin-password"
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••••"
                        className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    {adminAuthError && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-200 flex items-center gap-2">
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                        <span>{adminAuthError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full min-h-[46px] py-3 px-4 text-xs font-bold text-slate-950 bg-emerald-500 rounded-xl hover:bg-emerald-400 transition-colors cursor-pointer"
                    >
                      Log Masuk ke Panel Admin
                    </button>
                  </form>
                </div>
              ) : (
                /* UNLOCKED ADMIN PANEL (CLOUD SYNCHRONIZED CLIENT MANAGEMENT) */
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
                  {/* Admin Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                          Admin: {ADMIN_USERNAME_REQUIRED}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          <Cloud className="w-3 h-3" />
                          {cloudSyncStatus === 'synced'
                            ? 'Firebase Firestore: Real-Time Sync Aktif'
                            : 'Menyambung ke Cloud...'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-semibold rounded bg-slate-950 text-slate-400 border border-slate-800">
                          <Database className="w-3 h-3" />
                          {CLIENTS_STORAGE_KEY}
                        </span>
                      </div>
                      <h2 className="text-xl font-bold text-white font-display mt-1.5">
                        Panel Kawalan Admin — Pengurusan Akses Klien (Cloud Sync)
                      </h2>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleManualCloudRefresh}
                        disabled={isManualSyncing}
                        title="Segarkan semula data dari Firebase Cloud"
                        className="px-3 py-2 text-xs font-semibold text-emerald-300 bg-slate-950 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/10 transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <RefreshCw
                          className={`w-3.5 h-3.5 ${
                            isManualSyncing ? 'animate-spin' : ''
                          }`}
                        />
                        <span>Sync Cloud</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="px-3.5 py-2 text-xs font-bold text-slate-950 bg-emerald-500 rounded-xl hover:bg-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        + Add New Client
                      </button>

                      <button
                        type="button"
                        onClick={() => handleSelectGatewayTab('client')}
                        className="px-3.5 py-2 text-xs font-semibold text-slate-200 bg-slate-800 border border-slate-700 rounded-xl hover:bg-slate-700 transition-colors cursor-pointer"
                      >
                        Ke Skrin Log Masuk Klien
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAdminAuthenticated(false);
                          try {
                            localStorage.removeItem(ADMIN_AUTH_STORAGE_KEY);
                          } catch {
                            // Ignore
                          }
                          setAdminUsername('');
                          setAdminPassword('');
                        }}
                        className="px-3.5 py-2 text-xs font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl hover:bg-rose-500/20 transition-colors cursor-pointer"
                      >
                        Log Keluar Admin
                      </button>
                    </div>
                  </div>

                  {/* "+ Add New Client" Manual Form */}
                  {showAddForm && (
                    <form
                      onSubmit={handleAdminAddClient}
                      className="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-white font-display flex items-center gap-2">
                          <UserPlus className="w-4 h-4 text-emerald-400" />
                          + Add New Client (Simpanan Awan Firebase Automatik)
                        </h3>
                        <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Tersync Serta-Merta di Semua Telefon & Peranti
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label
                            htmlFor="admin-add-name"
                            className="block text-xs font-semibold text-slate-300 mb-1"
                          >
                            Nama Klien
                          </label>
                          <input
                            id="admin-add-name"
                            type="text"
                            value={newClientName}
                            onChange={(e) => setNewClientName(e.target.value)}
                            placeholder="Contoh: Ahmad Razak"
                            className="w-full px-3 py-2 text-xs bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <label
                            htmlFor="admin-add-broker"
                            className="block text-xs font-semibold text-slate-300 mb-1"
                          >
                            ID Akaun / Broker (Pilihan)
                          </label>
                          <input
                            id="admin-add-broker"
                            type="text"
                            value={newBrokerId}
                            onChange={(e) => setNewBrokerId(e.target.value)}
                            placeholder="Contoh: 8849201"
                            className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label
                              htmlFor="admin-add-code"
                              className="block text-xs font-semibold text-slate-300"
                            >
                              Kod Akses Unik Klien
                            </label>
                            <button
                              type="button"
                              onClick={handleGenerateUniqueClientCode}
                              className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                            >
                              Jana Kod Unik
                            </button>
                          </div>
                          <input
                            id="admin-add-code"
                            type="text"
                            value={newAccessCode}
                            onChange={(e) => setNewAccessCode(e.target.value)}
                            placeholder="Contoh: DLX-VIP01"
                            className="w-full px-3 py-2 text-xs font-mono bg-slate-900 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          className="px-5 py-2.5 text-xs font-bold text-slate-950 bg-emerald-500 rounded-xl hover:bg-emerald-400 transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Plus className="w-4 h-4" />
                          Simpan & Sync Akses Klien
                        </button>
                      </div>
                    </form>
                  )}

                  {adminFeedback && (
                    <div
                      className={`p-3.5 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                        adminFeedback.type === 'success'
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                          : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {adminFeedback.type === 'success' ? (
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                        )}
                        <span className="font-medium">
                          {adminFeedback.message}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setAdminFeedback(null)}
                        className="underline font-semibold shrink-0 cursor-pointer"
                      >
                        Tutup
                      </button>
                    </div>
                  )}

                  {/* Registered Clients Table & Search Filter */}
                  <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <h3 className="text-base font-bold text-white font-display flex items-center gap-2">
                          <Users className="w-4 h-4 text-emerald-400" />
                          Senarai Klien Berdaftar ({accounts.length} Rekod ·{' '}
                          {activeClientsCount} Aktif)
                        </h3>
                        <p className="text-xs text-slate-400">
                          Data diselaraskan secara masa nyata melalui{' '}
                          <code className="text-emerald-400 font-mono">
                            Firebase Cloud Firestore
                          </code>{' '}
                          dan disimpan dalam{' '}
                          <code className="text-emerald-400 font-mono">
                            localStorage (&apos;{CLIENTS_STORAGE_KEY}&apos;)
                          </code>
                          .
                        </p>
                      </div>

                      {accounts.length > 0 && (
                        <div className="relative w-full sm:w-64">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={adminSearchQuery}
                            onChange={(e) =>
                              setAdminSearchQuery(e.target.value)
                            }
                            placeholder="Semak nama / ID klien..."
                            className="w-full pl-8 pr-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      )}
                    </div>

                    {accounts.length === 0 ? (
                      <div className="p-8 rounded-2xl border border-dashed border-slate-800 bg-slate-950/50 text-center space-y-2">
                        <span className="text-xs font-mono font-semibold text-slate-500 uppercase block">
                          0 Rekod Klien Dalam Pangkalan Data Awan
                        </span>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                          Senarai klien masih kosong. Sila gunakan borang{' '}
                          <strong className="text-emerald-400">
                            + Add New Client
                          </strong>{' '}
                          di atas untuk menambah Nama Klien, ID Broker, atau Kod
                          Akses baharu supaya tersync di semua peranti.
                        </p>
                      </div>
                    ) : filteredAccounts.length === 0 ? (
                      <div className="p-6 rounded-2xl border border-slate-800 bg-slate-950/50 text-center text-xs text-slate-400">
                        Tiada rekod klien sepadan dengan carian &ldquo;
                        {adminSearchQuery}&rdquo;.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400">
                              <th className="py-2.5 pr-3 font-medium">
                                Nama Klien
                              </th>
                              <th className="py-2.5 px-3 font-medium">
                                ID Akaun / Broker
                              </th>
                              <th className="py-2.5 px-3 font-medium">
                                Kod Akses
                              </th>
                              <th className="py-2.5 px-3 font-medium">
                                Status Akses
                              </th>
                              <th className="py-2.5 pl-3 text-right font-medium">
                                Kawalan Admin
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {filteredAccounts.map((client) => {
                              const isClientActive = client.status === 'active';
                              return (
                                <tr
                                  key={client.id}
                                  className="hover:bg-slate-800/50 transition-colors"
                                >
                                  <td className="py-3 pr-3">
                                    <strong className="text-white font-semibold block">
                                      {client.name}
                                    </strong>
                                    <span className="text-[11px] text-slate-500 font-mono">
                                      Ditambah: {client.createdAt}
                                    </span>
                                  </td>
                                  <td className="py-3 px-3 font-mono font-bold text-slate-200">
                                    {client.brokerId}
                                  </td>
                                  <td className="py-3 px-3 font-mono text-emerald-400 font-semibold">
                                    {client.accessCode}
                                  </td>
                                  <td className="py-3 px-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAdminToggleStatus(client.id)
                                      }
                                      title="Klik untuk tukar status Active / Inactive"
                                      className={`inline-flex items-center px-2.5 py-1 rounded text-[11px] font-mono font-bold uppercase cursor-pointer transition-colors ${
                                        isClientActive
                                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                                          : 'bg-rose-500/15 text-rose-300 border border-rose-500/30 hover:bg-rose-500/25'
                                      }`}
                                    >
                                      {isClientActive ? 'Active' : 'Inactive'}
                                    </button>
                                  </td>
                                  <td className="py-3 pl-3 text-right whitespace-nowrap">
                                    <div className="inline-flex items-center gap-2">
                                      {isClientActive && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSavedActiveClientSession(client);
                                            onUnlockSuccess(client);
                                          }}
                                          className="px-2.5 py-1 text-[11px] font-semibold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/25 cursor-pointer"
                                        >
                                          Masuk Dashboard
                                        </button>
                                      )}

                                      <button
                                        type="button"
                                        onClick={() =>
                                          handleAdminDeleteClient(client.id)
                                        }
                                        title="Padam Klien"
                                        className="px-2.5 py-1 text-[11px] font-semibold text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg hover:bg-rose-500/20 inline-flex items-center gap-1 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Padam</span>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="max-w-4xl w-full mx-auto text-center text-xs text-slate-500 py-2">
          DollarX · Exclusive XAUUSD AI Trading Terminal ·{' '}
          <a
            href="https://t.me/dollarxindicator"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:underline font-mono"
          >
            t.me/dollarxindicator
          </a>
        </div>
      </div>
    </div>
  );
};
