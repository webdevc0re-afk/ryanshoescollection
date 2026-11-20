import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const BOOTSTRAP_ADMIN_EMAIL = 'clonekey7@gmail.com';
export const GOOGLE_SHEETS_ID =
  import.meta.env.VITE_GOOGLE_SHEETS_ID || '1jZ_CIw6GbfTiwyFa2Gqx0tZvbMWX_xMv46yq08iQhg0';
export const GOOGLE_DRIVE_FOLDER_ID =
  import.meta.env.VITE_GOOGLE_DRIVE_FOLDER_ID || '1xHTKf5DgUmOnRMnItRlGA9yUyiprmBNw';

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
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Startup Firestore connection check
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

// Strict in-memory OAuth access token cache for Google Workspace (never localStorage/sessionStorage)
let cachedWorkspaceAccessToken: string | null = null;

const standardGoogleProvider = new GoogleAuthProvider();
standardGoogleProvider.setCustomParameters({ prompt: 'select_account' });

const workspaceGoogleProvider = new GoogleAuthProvider();
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/spreadsheets');
workspaceGoogleProvider.addScope('https://www.googleapis.com/auth/drive');
workspaceGoogleProvider.setCustomParameters({ prompt: 'consent' });

export function getWorkspaceAccessToken(): string | null {
  return cachedWorkspaceAccessToken;
}

export function clearWorkspaceAccessToken(): void {
  cachedWorkspaceAccessToken = null;
}

function formatAuthError(err: unknown): Error {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code)
      : '';
  const message = err instanceof Error ? err.message : String(err);

  if (code === 'auth/popup-blocked' || message.includes('auth/popup-blocked')) {
    return new Error(
      'Your browser blocked the Google Sign-In popup. Please allow popups for this site in your browser address bar, then click Sign in again.'
    );
  }
  if (code === 'auth/popup-closed-by-user' || message.includes('auth/popup-closed-by-user')) {
    return new Error('Google Sign-In was closed before completion. Please try again.');
  }
  if (code === 'auth/cancelled-popup-request' || message.includes('auth/cancelled-popup-request')) {
    return new Error('A sign-in window is already in progress. Please check open browser windows or try again.');
  }
  if (code === 'auth/unauthorized-domain' || message.includes('auth/unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
    return new Error(
      `Domain "${host}" is not authorized in Firebase Authentication. Add it in Firebase Console → Authentication → Settings → Authorized domains.`
    );
  }
  return err instanceof Error ? err : new Error(message || 'Google Sign-In failed.');
}

export async function signInWithGoogleCustomer(): Promise<User> {
  try {
    const result = await signInWithPopup(auth, standardGoogleProvider);
    return result.user;
  } catch (err) {
    throw formatAuthError(err);
  }
}

export async function connectGoogleWorkspace(): Promise<{ user: User; accessToken: string }> {
  try {
    const result = await signInWithPopup(auth, workspaceGoogleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Could not obtain Google Workspace access token. Please allow Drive & Sheets permissions.');
    }
    cachedWorkspaceAccessToken = credential.accessToken;
    return { user: result.user, accessToken: credential.accessToken };
  } catch (err) {
    throw formatAuthError(err);
  }
}

export async function signOutStoreUser(): Promise<void> {
  cachedWorkspaceAccessToken = null;
  await signOut(auth);
}

export function subscribeToAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, (user) => {
    if (!user) {
      cachedWorkspaceAccessToken = null;
    }
    callback(user);
  });
}
