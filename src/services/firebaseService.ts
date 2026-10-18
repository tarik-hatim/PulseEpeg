import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
  Firestore,
  Unsubscribe,
} from 'firebase/firestore';
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  User,
  Auth,
} from 'firebase/auth';
import { EpgBouquetId } from '../types/epg';

export interface FirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
  oAuthClientId?: string;
  recaptchaSiteKey?: string;
}

export interface CloudUserSettings {
  user_id: string;
  selected_bouquets: EpgBouquetId[];
  favorite_channels: string[];
  is_premium: boolean;
  created_at?: unknown;
  updated_at?: unknown;
}

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let firebaseAuth: Auth | null = null;

export function getFirebaseConfig(): FirebaseConfig | null {
  try {
    // Config injected via firebase-applet-config.json
    return {
      projectId: 'stalwart-pen-nmn89',
      appId: '1:932218528298:web:be26497188137febbb9953',
      apiKey: 'AIzaSyD-0pb1KVB-hmYasQwdid6u59PxZn0X68k',
      authDomain: 'stalwart-pen-nmn89.firebaseapp.com',
      firestoreDatabaseId: 'ai-studio-pulseepgguidetvx-461ddafc-4692-487e-93a6-d6bcc28f5531',
      storageBucket: 'stalwart-pen-nmn89.firebasestorage.app',
      messagingSenderId: '932218528298',
    };
  } catch {
    return null;
  }
}

export function initFirebase(): { app: FirebaseApp; db: Firestore; auth: Auth } | null {
  if (firebaseApp && firestoreDb && firebaseAuth) {
    return { app: firebaseApp, db: firestoreDb, auth: firebaseAuth };
  }

  const config = getFirebaseConfig();
  if (!config || !config.apiKey) {
    return null;
  }

  try {
    firebaseApp = getApps().length > 0 ? getApp() : initializeApp(config);
    firestoreDb = config.firestoreDatabaseId
      ? getFirestore(firebaseApp, config.firestoreDatabaseId)
      : getFirestore(firebaseApp);
    firebaseAuth = getAuth(firebaseApp);
    return { app: firebaseApp, db: firestoreDb, auth: firebaseAuth };
  } catch (err) {
    console.warn('Firebase initialization notice:', err);
    return null;
  }
}

/**
 * Assure qu'un utilisateur est authentifié (anonyme ou compte existant) pour satisfaire
 * les règles de sécurité Firestore sans bloquer l'usage local hors-ligne.
 */
export async function ensureFirebaseAuth(): Promise<User | null> {
  const fb = initFirebase();
  if (!fb) return null;

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(fb.auth, async (user) => {
      unsubscribe();
      if (user) {
        resolve(user);
      } else {
        try {
          const cred = await signInAnonymously(fb.auth);
          resolve(cred.user);
        } catch {
          resolve(null);
        }
      }
    });
  });
}

/**
 * Sauvegarde et synchronise les paramètres et favoris sur Firestore
 * en respectant scrupuleusement le schéma `user_settings/{userId}` défini dans firestore.rules.
 */
export async function saveUserSettingsToFirestore(
  userId: string,
  data: {
    selected_bouquets?: EpgBouquetId[];
    favorite_channels?: string[];
    is_premium?: boolean;
  }
): Promise<boolean> {
  const fb = initFirebase();
  if (!fb) return false;

  const cleanUserId = userId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  if (!cleanUserId) return false;

  const docRef = doc(fb.db, 'user_settings', cleanUserId);

  try {
    const existingSnap = await getDoc(docRef);

    if (existingSnap.exists()) {
      // Mise à jour partielle (Action 1 / 2 / 3 autorisée par firestore.rules)
      const updatePayload: Record<string, unknown> = {
        updated_at: serverTimestamp(),
      };
      if (data.selected_bouquets) {
        updatePayload.selected_bouquets = data.selected_bouquets.slice(0, 25);
      }
      if (data.favorite_channels) {
        updatePayload.favorite_channels = data.favorite_channels.slice(0, 200);
      }
      if (typeof data.is_premium === 'boolean') {
        updatePayload.is_premium = data.is_premium;
      }

      await updateDoc(docRef, updatePayload);
      return true;
    } else {
      // Création initiale complète
      const createPayload = {
        user_id: cleanUserId,
        selected_bouquets: (data.selected_bouquets || []).slice(0, 25),
        favorite_channels: (data.favorite_channels || []).slice(0, 200),
        is_premium: Boolean(data.is_premium),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
      };

      await setDoc(docRef, createPayload);
      return true;
    }
  } catch (err) {
    // Si la permission est refusée ou hors-ligne, le stockage local prend le relais de façon transparente
    console.warn('Firestore user_settings sync deferred (offline/freemium rule):', err);
    return false;
  }
}

/**
 * Récupère les préférences et favoris d'un utilisateur depuis Firestore.
 */
export async function loadUserSettingsFromFirestore(
  userId: string
): Promise<CloudUserSettings | null> {
  const fb = initFirebase();
  if (!fb) return null;

  const cleanUserId = userId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  if (!cleanUserId) return null;

  try {
    const docRef = doc(fb.db, 'user_settings', cleanUserId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data();
    return {
      user_id: cleanUserId,
      selected_bouquets: Array.isArray(data.selected_bouquets)
        ? (data.selected_bouquets as EpgBouquetId[])
        : [],
      favorite_channels: Array.isArray(data.favorite_channels)
        ? (data.favorite_channels as string[])
        : [],
      is_premium: Boolean(data.is_premium),
    };
  } catch {
    return null;
  }
}

/**
 * Écoute en temps réel les mises à jour Firestore pour synchronisation instantanée multi-écrans.
 */
export function subscribeToUserSettings(
  userId: string,
  onUpdate: (settings: CloudUserSettings) => void
): Unsubscribe | null {
  const fb = initFirebase();
  if (!fb) return null;

  const cleanUserId = userId.replace(/[^a-zA-Z0-9_\-]/g, '_').slice(0, 128);
  if (!cleanUserId) return null;

  try {
    const docRef = doc(fb.db, 'user_settings', cleanUserId);
    return onSnapshot(
      docRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        onUpdate({
          user_id: cleanUserId,
          selected_bouquets: Array.isArray(data.selected_bouquets)
            ? (data.selected_bouquets as EpgBouquetId[])
            : [],
          favorite_channels: Array.isArray(data.favorite_channels)
            ? (data.favorite_channels as string[])
            : [],
          is_premium: Boolean(data.is_premium),
        });
      },
      (err) => {
        console.warn('Firestore realtime listener notice:', err);
      }
    );
  } catch {
    return null;
  }
}
