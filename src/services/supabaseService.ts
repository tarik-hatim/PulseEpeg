import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { EpgBouquetId } from '../types/epg';
import {
  ALL_BOUQUET_IDS,
  ChannelWatchHabit,
  inferTvProfileFromBouquets,
  loadAppSettings,
  loadChannelWatchHabits,
  loadFavoriteChannels,
  MAX_ACTIVE_BOUQUETS,
  mergeChannelWatchHabitsMaps,
  normalizeChannelWatchHabitsMap,
  saveAppSettings,
  saveChannelWatchHabits,
  saveFavoriteChannels,
  syncSourcesWithSelectedBouquets,
} from './storageService';

export const SUPABASE_URL: string =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';

export const SUPABASE_ANON_KEY: string =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

export const PRO_BOUQUETS_UPGRADE_MESSAGE =
  'Débloquez tous les bouquets avec PulseEPG Pro (Connexion / Inscription requise)';

export const PRO_EPG_7DAYS_UPGRADE_MESSAGE =
  'Débloquez le Guide EPG étendu 7 jours (J+1 à J+7) et le mode Catch-up / Replay avec PulseEPG Pro (Connexion / Inscription requise)';

const LOCAL_SESSION_STORAGE_KEY = 'pulseepg_optional_auth_session_v1';
const LOCAL_GUEST_USER_SETTINGS_KEY = 'pulse_epg_user_settings_guest_v1';
const LOCAL_CLOUD_USER_SETTINGS_PREFIX = 'pulse_epg_user_settings_cloud_';

export interface PulseUserAccount {
  id: string;
  email: string;
  displayName: string;
  isPremium: boolean;
  plan: 'free' | 'pro';
  provider: 'supabase' | 'local_sim';
}

export interface UserSettingsRecord {
  user_id: string;
  selected_bouquets: EpgBouquetId[];
  favorite_channels: string[];
  watch_habits?: Record<string, ChannelWatchHabit>;
  is_premium: boolean;
  updated_at: string;
  syncSource: 'local' | 'supabase';
}

export interface AuthSessionState {
  isLoggedIn: boolean;
  isPremium: boolean;
  user: PulseUserAccount | null;
  statusBadgeLabel: string;
  isSimulatedLocalMode: boolean;
  lastSyncedAt?: string | null;
  syncSource?: 'local' | 'supabase';
}

type AuthStateListener = (state: AuthSessionState) => void;
type UserSettingsListener = (record: UserSettingsRecord) => void;

function sanitizeId(rawId: string): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned || 'guest_user';
}

function sanitizeDisplayName(name: string, fallbackEmail: string): string {
  const trimmed = name.trim();
  if (trimmed.length >= 1) {
    return trimmed.slice(0, 80);
  }
  const emailPrefix = fallbackEmail.split('@')[0]?.trim() || 'Utilisateur';
  return emailPrefix.slice(0, 80);
}

function sanitizeEmail(email: string): string {
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length >= 3) {
    return trimmed.slice(0, 160);
  }
  return 'user@pulseepg.app';
}

function sanitizeBouquetsList(
  rawBouquets: unknown,
  isPremium: boolean
): EpgBouquetId[] {
  const validList: EpgBouquetId[] = Array.isArray(rawBouquets)
    ? Array.from(
        new Set(
          rawBouquets.filter(
            (b): b is EpgBouquetId =>
              typeof b === 'string' &&
              ALL_BOUQUET_IDS.includes(b as EpgBouquetId)
          )
        )
      )
    : [];

  const fallbackList: EpgBouquetId[] =
    validList.length > 0
      ? validList
      : loadAppSettings().selectedBouquets.slice(0, MAX_ACTIVE_BOUQUETS);

  // Règle Freemium / Premium stricte :
  // - Mode Invité ou Compte Gratuit (is_premium: false) -> max 3 bouquets
  // - Mode Premium (is_premium: true) -> sélection illimitée
  const maxAllowed = isPremium
    ? ALL_BOUQUET_IDS.length
    : MAX_ACTIVE_BOUQUETS;
  return fallbackList.slice(0, maxAllowed);
}

function sanitizeFavoritesList(rawFavorites: unknown): string[] {
  if (!Array.isArray(rawFavorites)) return [];
  return Array.from(
    new Set(
      rawFavorites
        .filter(
          (item): item is string =>
            typeof item === 'string' && item.trim().length > 0
        )
        .map((item) => item.trim().slice(0, 120))
    )
  ).slice(0, 200);
}

export function isSupabaseConfigured(
  url: string = SUPABASE_URL,
  key: string = SUPABASE_ANON_KEY
): boolean {
  return (
    Boolean(url) &&
    Boolean(key) &&
    url !== 'YOUR_SUPABASE_URL' &&
    key !== 'YOUR_SUPABASE_ANON_KEY' &&
    !url.includes('placeholder-project.supabase.co') &&
    /^https?:\/\//i.test(url)
  );
}

/**
 * Service d'authentification et de synchronisation utilisant EXCLUSIVEMENT `@supabase/supabase-js`.
 * - Aucune dépendance ni appel à Firebase Authentication.
 * - Utilise `supabase.auth.signUp()` pour l'inscription.
 * - Utilise `supabase.auth.signInWithPassword()` pour la connexion.
 * - Si les identifiants Supabase ne sont pas configurés (clefs manquantes / placeholders),
 *   simule une connexion locale réussie pour le test UI sans lever d'erreur réseau.
 */
export class SupabaseService {
  public readonly supabase: SupabaseClient;
  private state: AuthSessionState = {
    isLoggedIn: false,
    isPremium: false,
    user: null,
    statusBadgeLabel: 'Mode Invité',
    isSimulatedLocalMode: !isSupabaseConfigured(
      SUPABASE_URL,
      SUPABASE_ANON_KEY
    ),
    lastSyncedAt: null,
    syncSource: 'local',
  };
  private listeners = new Set<AuthStateListener>();
  private settingsListeners = new Set<UserSettingsListener>();

  constructor(
    private readonly supabaseUrl: string = SUPABASE_URL,
    private readonly supabaseAnonKey: string = SUPABASE_ANON_KEY
  ) {
    const configured = isSupabaseConfigured(
      this.supabaseUrl,
      this.supabaseAnonKey
    );
    const effectiveUrl = configured
      ? this.supabaseUrl
      : 'https://placeholder-project.supabase.co';
    const effectiveKey = configured
      ? this.supabaseAnonKey
      : 'YOUR_SUPABASE_ANON_KEY';

    this.supabase = createClient(effectiveUrl, effectiveKey, {
      auth: {
        persistSession: configured,
        autoRefreshToken: configured,
        detectSessionInUrl: configured,
      },
    });

    this.restoreOptionalSession();
    this.initSupabaseAuthListener();
  }

  public get supabaseClient(): SupabaseClient {
    return this.supabase;
  }

  public get isConfigured(): boolean {
    return isSupabaseConfigured(this.supabaseUrl, this.supabaseAnonKey);
  }

  public get isLoggedIn(): boolean {
    return this.state.isLoggedIn;
  }

  public get isPremium(): boolean {
    return this.state.isLoggedIn && this.state.isPremium;
  }

  public get currentUser(): PulseUserAccount | null {
    return this.state.user;
  }

  public getState(): AuthSessionState {
    return this.state;
  }

  public subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public subscribeUserSettings(listener: UserSettingsListener): () => void {
    this.settingsListeners.add(listener);
    return () => {
      this.settingsListeners.delete(listener);
    };
  }

  private notifySettingsListeners(record: UserSettingsRecord): void {
    for (const listener of this.settingsListeners) {
      listener(record);
    }
  }

  public getUserSettingsSnapshot(): UserSettingsRecord {
    const currentSettings = loadAppSettings();
    const currentFavorites = loadFavoriteChannels();
    const currentHabits = loadChannelWatchHabits();
    const isPro = this.isPremium;
    const uid = this.state.user?.id || 'guest_local';

    return {
      user_id: uid,
      selected_bouquets: sanitizeBouquetsList(
        currentSettings.selectedBouquets,
        isPro
      ),
      favorite_channels: sanitizeFavoritesList(currentFavorites),
      watch_habits: currentHabits,
      is_premium: isPro,
      updated_at: this.state.lastSyncedAt || new Date().toISOString(),
      syncSource: this.state.isLoggedIn && this.isConfigured ? 'supabase' : 'local',
    };
  }

  /**
   * Sauvegarde hybride des bouquets, favoris et habitudes de visionnage (`watchCount` & `lastWatchedTimestamp`) :
   * - Mode Invité (non connecté) : Sauvegarde dans LocalStorage + IndexedDB (max 3 bouquets), 100% hors-ligne.
   * - Mode Connecté : Synchronise avec la table Supabase `user_settings` (`user_id`, `selected_bouquets`, `favorite_channels`, `watch_habits`)
   *   ou dans le stockage local par compte si les clefs Supabase ne sont pas configurées.
   */
  public async saveHybridUserSettings(params: {
    selected_bouquets?: EpgBouquetId[];
    favorite_channels?: string[];
    watch_habits?: Record<string, ChannelWatchHabit>;
    replace_watch_habits?: boolean;
  }): Promise<UserSettingsRecord> {
    const isPro = this.isPremium;
    const currentAppSettings = loadAppSettings();
    const currentFavs = loadFavoriteChannels();
    const currentHabits = loadChannelWatchHabits();

    const nextBouquets = sanitizeBouquetsList(
      params.selected_bouquets ?? currentAppSettings.selectedBouquets,
      isPro
    );
    const nextFavorites = sanitizeFavoritesList(
      params.favorite_channels ?? currentFavs
    );
    const nextHabits =
      params.watch_habits !== undefined
        ? params.replace_watch_habits
          ? normalizeChannelWatchHabitsMap(params.watch_habits)
          : mergeChannelWatchHabitsMaps(params.watch_habits, currentHabits)
        : currentHabits;

    if (params.favorite_channels !== undefined) {
      saveFavoriteChannels(nextFavorites);
    }
    if (params.watch_habits !== undefined) {
      saveChannelWatchHabits(nextHabits);
    }
    if (params.selected_bouquets !== undefined) {
      const nextProfile = inferTvProfileFromBouquets(
        nextBouquets,
        currentAppSettings.tvProfile
      );
      saveAppSettings({
        ...currentAppSettings,
        tvProfile: nextProfile,
        selectedBouquets: nextBouquets,
        sources: syncSourcesWithSelectedBouquets(
          nextBouquets,
          currentAppSettings.sources,
          nextProfile
        ),
      });
    }

    const nowIso = new Date().toISOString();

    if (!this.state.isLoggedIn || !this.state.user) {
      const guestRecord: UserSettingsRecord = {
        user_id: 'guest_local',
        selected_bouquets: nextBouquets,
        favorite_channels: nextFavorites,
        watch_habits: nextHabits,
        is_premium: false,
        updated_at: nowIso,
        syncSource: 'local',
      };
      try {
        localStorage.setItem(
          LOCAL_GUEST_USER_SETTINGS_KEY,
          JSON.stringify(guestRecord)
        );
      } catch {
        // Ignore storage quota errors
      }
      return guestRecord;
    }

    const uid = sanitizeId(this.state.user.id);
    let syncSource: 'local' | 'supabase' = 'local';

    if (this.isConfigured) {
      try {
        const { error } = await this.supabase.from('user_settings').upsert(
          {
            user_id: uid,
            selected_bouquets: nextBouquets,
            favorite_channels: nextFavorites,
            watch_habits: nextHabits,
            is_premium: isPro,
            updated_at: nowIso,
          },
          { onConflict: 'user_id' }
        );
        if (!error) {
          syncSource = 'supabase';
        } else {
          // Fallback si la colonne optionnelle `watch_habits` n'existe pas encore dans le schéma Supabase distant
          const fallbackRes = await this.supabase.from('user_settings').upsert(
            {
              user_id: uid,
              selected_bouquets: nextBouquets,
              favorite_channels: nextFavorites,
              is_premium: isPro,
              updated_at: nowIso,
            },
            { onConflict: 'user_id' }
          );
          if (!fallbackRes.error) {
            syncSource = 'supabase';
          }
        }
      } catch {
        // Fallback local silencieux sans lever d'erreur réseau
      }
    }

    const record: UserSettingsRecord = {
      user_id: uid,
      selected_bouquets: nextBouquets,
      favorite_channels: nextFavorites,
      watch_habits: nextHabits,
      is_premium: isPro,
      updated_at: nowIso,
      syncSource,
    };

    try {
      localStorage.setItem(
        `${LOCAL_CLOUD_USER_SETTINGS_PREFIX}${uid}`,
        JSON.stringify(record)
      );
    } catch {
      // Ignore storage error
    }

    this.state = {
      ...this.state,
      lastSyncedAt: nowIso,
      syncSource,
    };
    for (const listener of this.listeners) {
      listener(this.state);
    }

    return record;
  }

  /**
   * Récupère et fusionne `selected_bouquets`, `favorite_channels` et `watch_habits` depuis la table Supabase `user_settings`
   * (ou depuis le stockage local simulé si les clefs Supabase ne sont pas configurées).
   */
  public async fetchAndMergeUserSettingsFromCloud(
    accountOverride?: PulseUserAccount
  ): Promise<UserSettingsRecord | null> {
    const targetUser = accountOverride || this.state.user;
    if (!targetUser) return null;

    const uid = sanitizeId(targetUser.id);
    const isPro = Boolean(targetUser.isPremium || targetUser.plan === 'pro');
    const localSettings = loadAppSettings();
    const localFavorites = loadFavoriteChannels();
    const localHabits = loadChannelWatchHabits();

    let remoteBouquets: EpgBouquetId[] | null = null;
    let remoteFavorites: string[] | null = null;
    let remoteHabits: Record<string, ChannelWatchHabit> | null = null;
    let syncSource: 'local' | 'supabase' = 'local';

    if (this.isConfigured) {
      try {
        const { data, error } = await this.supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle();

        if (!error && data) {
          if (
            Array.isArray(data.selected_bouquets) &&
            data.selected_bouquets.length > 0
          ) {
            remoteBouquets = sanitizeBouquetsList(
              data.selected_bouquets,
              isPro
            );
          }
          if (Array.isArray(data.favorite_channels)) {
            remoteFavorites = sanitizeFavoritesList(data.favorite_channels);
          }
          if (data.watch_habits && typeof data.watch_habits === 'object') {
            remoteHabits = normalizeChannelWatchHabitsMap(data.watch_habits);
          }
          syncSource = 'supabase';
        }
      } catch {
        // Ignore network error in offline/unconfigured mode
      }
    }

    if (!remoteBouquets && !remoteFavorites && !remoteHabits) {
      try {
        const rawCached = localStorage.getItem(
          `${LOCAL_CLOUD_USER_SETTINGS_PREFIX}${uid}`
        );
        if (rawCached) {
          const parsedCached = JSON.parse(
            rawCached
          ) as Partial<UserSettingsRecord>;
          if (
            Array.isArray(parsedCached.selected_bouquets) &&
            parsedCached.selected_bouquets.length > 0
          ) {
            remoteBouquets = sanitizeBouquetsList(
              parsedCached.selected_bouquets,
              isPro
            );
          }
          if (Array.isArray(parsedCached.favorite_channels)) {
            remoteFavorites = sanitizeFavoritesList(
              parsedCached.favorite_channels
            );
          }
          if (parsedCached.watch_habits) {
            remoteHabits = normalizeChannelWatchHabitsMap(
              parsedCached.watch_habits
            );
          }
        }
      } catch {
        // Ignore
      }
    }

    const mergedFavorites = sanitizeFavoritesList([
      ...(remoteFavorites || []),
      ...localFavorites,
    ]);
    const mergedHabits = mergeChannelWatchHabitsMaps(
      localHabits,
      remoteHabits || {}
    );

    const finalBouquets = sanitizeBouquetsList(
      remoteBouquets && remoteBouquets.length > 0
        ? remoteBouquets
        : localSettings.selectedBouquets,
      isPro
    );

    const syncedRecord = await this.saveHybridUserSettings({
      selected_bouquets: finalBouquets,
      favorite_channels: mergedFavorites,
      watch_habits: mergedHabits,
    });
    syncedRecord.syncSource = syncSource;

    this.notifySettingsListeners(syncedRecord);
    return syncedRecord;
  }

  private emitState(nextUser: PulseUserAccount | null): void {
    const configured = this.isConfigured;
    if (!nextUser) {
      this.state = {
        isLoggedIn: false,
        isPremium: false,
        user: null,
        statusBadgeLabel: 'Mode Invité',
        isSimulatedLocalMode: !configured,
        lastSyncedAt: null,
        syncSource: 'local',
      };
      try {
        localStorage.removeItem(LOCAL_SESSION_STORAGE_KEY);
      } catch {
        // Ignore
      }

      const currentSettings = loadAppSettings();
      if (currentSettings.selectedBouquets.length > MAX_ACTIVE_BOUQUETS) {
        const cappedBouquets = currentSettings.selectedBouquets.slice(
          0,
          MAX_ACTIVE_BOUQUETS
        );
        const nextProfile = inferTvProfileFromBouquets(
          cappedBouquets,
          currentSettings.tvProfile
        );
        saveAppSettings({
          ...currentSettings,
          tvProfile: nextProfile,
          selectedBouquets: cappedBouquets,
          sources: syncSourcesWithSelectedBouquets(
            cappedBouquets,
            currentSettings.sources,
            nextProfile
          ),
        });
        this.notifySettingsListeners({
          user_id: 'guest_local',
          selected_bouquets: cappedBouquets,
          favorite_channels: loadFavoriteChannels(),
          is_premium: false,
          updated_at: new Date().toISOString(),
          syncSource: 'local',
        });
      }
    } else {
      const isPro = Boolean(nextUser.isPremium || nextUser.plan === 'pro');
      const normalizedUser: PulseUserAccount = {
        ...nextUser,
        isPremium: isPro,
        plan: isPro ? 'pro' : 'free',
      };
      this.state = {
        isLoggedIn: true,
        isPremium: isPro,
        user: normalizedUser,
        statusBadgeLabel: isPro ? 'PulseEPG Pro 👑' : 'Gratuit',
        isSimulatedLocalMode: !configured,
        lastSyncedAt: this.state.lastSyncedAt || new Date().toISOString(),
        syncSource: configured ? 'supabase' : 'local',
      };
      try {
        localStorage.setItem(
          LOCAL_SESSION_STORAGE_KEY,
          JSON.stringify(normalizedUser)
        );
      } catch {
        // Ignore
      }
    }

    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  private restoreOptionalSession(): void {
    try {
      const raw = localStorage.getItem(LOCAL_SESSION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<PulseUserAccount>;
      if (parsed && parsed.id && parsed.email) {
        const isPro = Boolean(parsed.isPremium || parsed.plan === 'pro');
        const restoredAccount: PulseUserAccount = {
          id: sanitizeId(parsed.id),
          email: sanitizeEmail(parsed.email),
          displayName: sanitizeDisplayName(
            parsed.displayName || '',
            parsed.email
          ),
          isPremium: isPro,
          plan: isPro ? 'pro' : 'free',
          provider: this.isConfigured ? 'supabase' : 'local_sim',
        };
        this.emitState(restoredAccount);
        void this.fetchAndMergeUserSettingsFromCloud(restoredAccount);
      }
    } catch {
      this.emitState(null);
    }
  }

  private initSupabaseAuthListener(): void {
    if (!this.isConfigured) {
      return;
    }

    void this.supabase.auth
      .getSession()
      .then(({ data }) => {
        const supaUser = data?.session?.user;
        if (supaUser) {
          const meta = supaUser.user_metadata || {};
          const isPro = Boolean(meta.is_premium || meta.plan === 'pro');
          const account: PulseUserAccount = {
            id: sanitizeId(supaUser.id),
            email: sanitizeEmail(supaUser.email || 'user@pulseepg.app'),
            displayName: sanitizeDisplayName(
              String(meta.full_name || meta.name || ''),
              supaUser.email || 'Utilisateur'
            ),
            isPremium: isPro,
            plan: isPro ? 'pro' : 'free',
            provider: 'supabase',
          };
          this.emitState(account);
          void this.fetchAndMergeUserSettingsFromCloud(account);
        }
      })
      .catch(() => {
        // Pas d'erreur levée en mode invité
      });

    this.supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        const isPro = Boolean(meta.is_premium || meta.plan === 'pro');
        const account: PulseUserAccount = {
          id: sanitizeId(session.user.id),
          email: sanitizeEmail(session.user.email || 'user@pulseepg.app'),
          displayName: sanitizeDisplayName(
            String(meta.full_name || meta.name || ''),
            session.user.email || 'Utilisateur'
          ),
          isPremium: isPro,
          plan: isPro ? 'pro' : 'free',
          provider: 'supabase',
        };
        this.emitState(account);
        void this.fetchAndMergeUserSettingsFromCloud(account);
      }
    });
  }

  private buildSimulatedLocalAccount(
    cleanEmail: string,
    cleanName: string,
    isPro: boolean
  ): PulseUserAccount {
    const deterministicId = sanitizeId(
      `supa_local_${cleanEmail.replace(/[^a-z0-9]/g, '_')}`
    );
    return {
      id: deterministicId,
      email: cleanEmail,
      displayName: cleanName,
      isPremium: isPro,
      plan: isPro ? 'pro' : 'free',
      provider: 'local_sim',
    };
  }

  /**
   * 1. Inscription via `supabase.auth.signUp()`
   * Si les identifiants Supabase ne sont pas configurés, simule une inscription/connexion locale réussie sans erreur réseau.
   */
  public async signUp(params: {
    email: string;
    password?: string;
    displayName?: string;
    activatePro?: boolean;
  }): Promise<PulseUserAccount> {
    const cleanEmail = sanitizeEmail(params.email);
    const cleanName = sanitizeDisplayName(
      params.displayName || '',
      cleanEmail
    );
    const isPro = Boolean(params.activatePro);
    const effectivePassword =
      params.password && params.password.trim().length >= 6
        ? params.password.trim()
        : 'pulseepg_default_pass';

    if (this.isConfigured) {
      try {
        const { data, error } = await this.supabase.auth.signUp({
          email: cleanEmail,
          password: effectivePassword,
          options: {
            data: {
              full_name: cleanName,
              is_premium: isPro,
              plan: isPro ? 'pro' : 'free',
            },
          },
        });
        if (error) {
          throw new Error(error.message);
        }
        if (data.user) {
          const account: PulseUserAccount = {
            id: sanitizeId(data.user.id),
            email: cleanEmail,
            displayName: cleanName,
            isPremium: isPro,
            plan: isPro ? 'pro' : 'free',
            provider: 'supabase',
          };
          this.emitState(account);
          await this.fetchAndMergeUserSettingsFromCloud(account);
          return account;
        }
      } catch (err) {
        // Si erreur de configuration / réseau Supabase, bascule proprement sur la simulation locale pour le test UI
        if (
          err instanceof Error &&
          !/invalid login|already registered|weak password/i.test(err.message)
        ) {
          const simulated = this.buildSimulatedLocalAccount(
            cleanEmail,
            cleanName,
            isPro
          );
          this.emitState(simulated);
          await this.fetchAndMergeUserSettingsFromCloud(simulated);
          return simulated;
        }
        throw err;
      }
    }

    // Identifiants Supabase non configurés (clefs manquantes) -> Connexion locale simulée réussie sans erreur réseau
    const simulatedAccount = this.buildSimulatedLocalAccount(
      cleanEmail,
      cleanName,
      isPro
    );
    this.emitState(simulatedAccount);
    await this.fetchAndMergeUserSettingsFromCloud(simulatedAccount);
    return simulatedAccount;
  }

  /**
   * 2. Connexion via `supabase.auth.signInWithPassword()`
   * Si les identifiants Supabase ne sont pas configurés, simule une connexion locale réussie sans erreur réseau.
   */
  public async signInWithPassword(params: {
    email: string;
    password?: string;
    displayName?: string;
    activatePro?: boolean;
  }): Promise<PulseUserAccount> {
    const cleanEmail = sanitizeEmail(params.email);
    const cleanName = sanitizeDisplayName(
      params.displayName || '',
      cleanEmail
    );
    const isPro = Boolean(params.activatePro);
    const effectivePassword =
      params.password && params.password.trim().length >= 1
        ? params.password.trim()
        : 'pulseepg_default_pass';

    if (this.isConfigured) {
      try {
        const { data, error } = await this.supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: effectivePassword,
        });
        if (error) {
          throw new Error(error.message);
        }
        if (data.user) {
          const meta = data.user.user_metadata || {};
          const userPro =
            params.activatePro !== undefined
              ? isPro
              : Boolean(meta.is_premium || meta.plan === 'pro');
          const account: PulseUserAccount = {
            id: sanitizeId(data.user.id),
            email: cleanEmail,
            displayName: sanitizeDisplayName(
              String(meta.full_name || cleanName),
              cleanEmail
            ),
            isPremium: userPro,
            plan: userPro ? 'pro' : 'free',
            provider: 'supabase',
          };
          this.emitState(account);
          await this.fetchAndMergeUserSettingsFromCloud(account);
          return account;
        }
      } catch (err) {
        if (
          err instanceof Error &&
          !/invalid login credentials/i.test(err.message)
        ) {
          const simulated = this.buildSimulatedLocalAccount(
            cleanEmail,
            cleanName,
            isPro
          );
          this.emitState(simulated);
          await this.fetchAndMergeUserSettingsFromCloud(simulated);
          return simulated;
        }
        throw err;
      }
    }

    // Identifiants Supabase non configurés (clefs manquantes) -> Connexion locale simulée réussie sans erreur réseau
    const simulatedAccount = this.buildSimulatedLocalAccount(
      cleanEmail,
      cleanName,
      isPro
    );
    this.emitState(simulatedAccount);
    await this.fetchAndMergeUserSettingsFromCloud(simulatedAccount);
    return simulatedAccount;
  }

  public async signInOrRegisterWithEmail(params: {
    email: string;
    password?: string;
    displayName?: string;
    mode: 'login' | 'register';
    activatePro?: boolean;
  }): Promise<PulseUserAccount> {
    if (params.mode === 'register') {
      return this.signUp(params);
    }
    return this.signInWithPassword(params);
  }

  /**
   * 3. Authentification Google via Supabase OAuth : `supabase.auth.signInWithOAuth({ provider: 'google' })`
   * Si la configuration Supabase n'est pas encore saisie, gère le clic proprement avec une simulation
   * d'authentification locale et une notification informative pour les tests UI.
   */
  public async signInWithGoogle(params?: {
    activatePro?: boolean;
    displayName?: string;
    email?: string;
  }): Promise<{
    user: PulseUserAccount | null;
    isSimulated: boolean;
    infoMessage?: string;
  }> {
    const isPro = Boolean(params?.activatePro);
    const cleanEmail = sanitizeEmail(
      params?.email?.trim() || 'google.user@gmail.com'
    );
    const cleanName = sanitizeDisplayName(
      params?.displayName?.trim() || 'Compte Google',
      cleanEmail
    );

    if (this.isConfigured) {
      try {
        const { error } = await this.supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo:
              typeof window !== 'undefined'
                ? window.location.origin
                : undefined,
          },
        });
        if (error) {
          throw new Error(error.message);
        }
        return {
          user: this.state.user,
          isSimulated: false,
        };
      } catch {
        const simulated = this.buildSimulatedLocalAccount(
          cleanEmail,
          cleanName,
          isPro
        );
        this.emitState(simulated);
        await this.fetchAndMergeUserSettingsFromCloud(simulated);
        return {
          user: simulated,
          isSimulated: true,
          infoMessage:
            'Mode test local : Authentification Google simulée avec succès (vérifiez la configuration Google OAuth dans Supabase).',
        };
      }
    }

    // Configuration Supabase non saisie -> Simulation locale propre avec notification informative pour les tests UI
    const simulatedAccount = this.buildSimulatedLocalAccount(
      cleanEmail,
      cleanName,
      isPro
    );
    this.emitState(simulatedAccount);
    await this.fetchAndMergeUserSettingsFromCloud(simulatedAccount);
    return {
      user: simulatedAccount,
      isSimulated: true,
      infoMessage:
        'Mode test local : Connexion Google simulée avec succès (clefs Supabase non configurées).',
    };
  }

  /**
   * Bascule ou active le statut "PulseEPG Pro 👑" / "Gratuit" sur le compte connecté
   */
  public async setPremiumStatus(isPremium: boolean): Promise<void> {
    if (!this.state.user) return;
    const updatedUser: PulseUserAccount = {
      ...this.state.user,
      isPremium,
      plan: isPremium ? 'pro' : 'free',
    };
    this.emitState(updatedUser);

    const currentSettings = loadAppSettings();
    const enforcedBouquets = sanitizeBouquetsList(
      currentSettings.selectedBouquets,
      isPremium
    );
    const synced = await this.saveHybridUserSettings({
      selected_bouquets: enforcedBouquets,
      favorite_channels: loadFavoriteChannels(),
    });
    this.notifySettingsListeners(synced);
  }

  /**
   * Déconnexion via `supabase.auth.signOut()` et retour immédiat au Mode Invité
   */
  public async signOut(): Promise<void> {
    if (this.isConfigured) {
      try {
        await this.supabase.auth.signOut();
      } catch {
        // Ignore network error
      }
    }
    this.emitState(null);
  }
}

export const supabaseService = new SupabaseService(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
