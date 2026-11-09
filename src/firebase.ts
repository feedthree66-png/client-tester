import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  onSnapshot,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import type { ClientAccount } from './components/LicenseGateway';

// Initialize Firebase App & Firestore Database
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): void {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
}

function sanitizeClientForFirestore(client: ClientAccount) {
  return {
    id: String(client.id).trim().slice(0, 64),
    name: String(client.name).trim().slice(0, 120),
    brokerId: String(client.brokerId).trim().slice(0, 80),
    accessCode: String(client.accessCode).trim().slice(0, 64),
    status: client.status === 'inactive' ? 'inactive' : 'active',
    createdAt: String(client.createdAt).trim().slice(0, 40),
    updatedAt: Date.now(),
  };
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'system', 'meta'));
    return true;
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
    return false;
  }
}

export async function saveClientToCloud(client: ClientAccount): Promise<void> {
  const path = `clients/${client.id}`;
  try {
    const payload = sanitizeClientForFirestore(client);
    await setDoc(doc(db, 'clients', payload.id), payload);
    await setDoc(
      doc(db, 'system', 'meta'),
      { seeded: true, updatedAt: Date.now() },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
}

export async function syncClientsBatchToCloud(
  clients: ClientAccount[]
): Promise<void> {
  try {
    await Promise.all(
      clients.map((client) => {
        const payload = sanitizeClientForFirestore(client);
        return setDoc(doc(db, 'clients', payload.id), payload);
      })
    );
    await setDoc(
      doc(db, 'system', 'meta'),
      { seeded: true, updatedAt: Date.now() },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'clients');
  }
}

export async function deleteClientFromCloud(clientId: string): Promise<void> {
  const path = `clients/${clientId}`;
  try {
    await deleteDoc(doc(db, 'clients', clientId));
    await setDoc(
      doc(db, 'system', 'meta'),
      { seeded: true, updatedAt: Date.now() },
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
}

export async function fetchCloudClientsOnce(): Promise<ClientAccount[] | null> {
  try {
    const snap = await getDocs(collection(db, 'clients'));
    const list: ClientAccount[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && typeof data.id === 'string' && typeof data.name === 'string') {
        list.push({
          id: data.id,
          name: data.name,
          brokerId: data.brokerId || data.name,
          accessCode: data.accessCode || data.brokerId || data.name,
          status: data.status === 'inactive' ? 'inactive' : 'active',
          createdAt: data.createdAt || 'Baru sahaja',
        });
      }
    });
    return list;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'clients');
    return null;
  }
}

export function subscribeToCloudClients(
  onClientsChanged: (clients: ClientAccount[], isFromCloud: boolean) => void,
  onSyncStatusChange?: (status: 'connecting' | 'synced' | 'error') => void
): () => void {
  onSyncStatusChange?.('connecting');
  const clientsRef = collection(db, 'clients');

  const unsubscribe = onSnapshot(
    clientsRef,
    (snapshot) => {
      const cloudClients: Array<ClientAccount & { updatedAt?: number }> = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (
          data &&
          typeof data.id === 'string' &&
          typeof data.name === 'string'
        ) {
          cloudClients.push({
            id: data.id,
            name: data.name,
            brokerId: data.brokerId || data.name,
            accessCode: data.accessCode || data.brokerId || data.name,
            status: data.status === 'inactive' ? 'inactive' : 'active',
            createdAt: data.createdAt || 'Baru sahaja',
            updatedAt:
              typeof data.updatedAt === 'number' ? data.updatedAt : 0,
          });
        }
      });

      // Sort newest first
      cloudClients.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

      const normalized: ClientAccount[] = cloudClients.map(
        ({ id, name, brokerId, accessCode, status, createdAt }) => ({
          id,
          name,
          brokerId,
          accessCode,
          status,
          createdAt,
        })
      );

      onSyncStatusChange?.('synced');
      onClientsChanged(normalized, true);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'clients');
      onSyncStatusChange?.('error');
    }
  );

  return unsubscribe;
}
