import { SupabaseClient } from '@supabase/supabase-js';
import {
  supabaseService,
  PRO_EPG_7DAYS_UPGRADE_MESSAGE,
  PRO_BOUQUETS_UPGRADE_MESSAGE,
} from './supabaseService';
import { EpgProgramme } from '../types/epg';

export interface SubscriptionStatus {
  isPro: boolean;
  role: 'user' | 'pro' | 'admin' | 'superuser';
  source: 'database_profile' | 'session' | 'guest';
  userId?: string;
  verifiedAt: string;
}

export interface EpgSecurityGuardResult {
  allowed: boolean;
  reason?: string;
}

export interface ExtendedEpgResponse {
  authorized: boolean;
  programmes: EpgProgramme[];
  error?: string;
}

/**
 * Service de contrôle d'accès et d'abonnement (Server-Side Auth Guard via Supabase RLS & JWT) :
 * - Aucune clé ou e-mail admin n'est écrit en dur dans le frontend.
 * - Le statut Superuser / Pro est strictement vérifié en base de données dans `public.profiles` (`is_pro = true` ou `role = 'superuser' | 'admin' | 'pro'`).
 * - Les requêtes Supabase pour l'EPG étendu (J+1 à J+7) ou le Replay / Catch-up vérifient le statut côté serveur (RLS / Edge Functions).
 */
export class SubscriptionService {
  private cachedStatus: SubscriptionStatus | null = null;
  private lastVerificationTime = 0;
  private readonly CACHE_TTL_MS = 60000; // 1 minute de mise en cache pour limiter les requêtes répétitives

  constructor(private readonly getClient: () => SupabaseClient = () => supabaseService.supabaseClient) {}

  /**
   * Vérifie le statut Pro / Superuser directement via la table sécurisée `public.profiles`
   * en utilisant l'UUID de l'utilisateur authentifié (sans aucune clé ni e-mail en dur).
   */
  public async verifyProStatus(userId?: string): Promise<SubscriptionStatus> {
    const client = this.getClient();
    const effectiveUid = userId || supabaseService.currentUser?.id;

    if (!effectiveUid || !supabaseService.isLoggedIn) {
      const guestStatus: SubscriptionStatus = {
        isPro: false,
        role: 'user',
        source: 'guest',
        verifiedAt: new Date().toISOString(),
      };
      this.cachedStatus = guestStatus;
      return guestStatus;
    }

    const now = Date.now();
    if (
      this.cachedStatus &&
      this.cachedStatus.userId === effectiveUid &&
      now - this.lastVerificationTime < this.CACHE_TTL_MS
    ) {
      return this.cachedStatus;
    }

    if (!supabaseService.isConfigured) {
      // Mode simulation locale hors-ligne pour les tests UI sans Supabase
      const isSimulatedPro = Boolean(supabaseService.currentUser?.isPremium);
      const simulatedStatus: SubscriptionStatus = {
        isPro: isSimulatedPro,
        role: isSimulatedPro ? 'pro' : 'user',
        source: 'session',
        userId: effectiveUid,
        verifiedAt: new Date().toISOString(),
      };
      this.cachedStatus = simulatedStatus;
      this.lastVerificationTime = now;
      return simulatedStatus;
    }

    try {
      // Lecture stricte dans public.profiles via RLS : auth.uid() = id
      const { data, error } = await client
        .from('profiles')
        .select('id, is_pro, role, updated_at')
        .eq('id', effectiveUid)
        .maybeSingle();

      if (!error && data) {
        const isPro = Boolean(
          data.is_pro === true ||
          data.role === 'superuser' ||
          data.role === 'admin' ||
          data.role === 'pro'
        );
        const resolvedRole = (data.role as SubscriptionStatus['role']) || (isPro ? 'pro' : 'user');

        const verifiedStatus: SubscriptionStatus = {
          isPro,
          role: resolvedRole,
          source: 'database_profile',
          userId: effectiveUid,
          verifiedAt: new Date().toISOString(),
        };

        this.cachedStatus = verifiedStatus;
        this.lastVerificationTime = now;
        return verifiedStatus;
      }
    } catch {
      // Fallback sécurisé en cas d'erreur réseau
    }

    // Par défaut, si le profil n'a pas is_pro: true, accès gratuit non pro
    const fallbackStatus: SubscriptionStatus = {
      isPro: false,
      role: 'user',
      source: 'database_profile',
      userId: effectiveUid,
      verifiedAt: new Date().toISOString(),
    };
    this.cachedStatus = fallbackStatus;
    this.lastVerificationTime = now;
    return fallbackStatus;
  }

  /**
   * Vérification synchrone instantanée de l'état Pro courant
   */
  public isProSync(): boolean {
    return Boolean(supabaseService.isLoggedIn && supabaseService.isPremium);
  }

  /**
   * Guard d'accès au Guide EPG 7 jours (J+1 à J+7) ou au mode Catch-up / Replay
   */
  public async guardExtendedEpgAccess(dayOffset: number, isReplay = false): Promise<EpgSecurityGuardResult> {
    // Aujourd'hui (offset 0) et hors replay est toujours autorisé en gratuit / invité
    if (dayOffset === 0 && !isReplay) {
      return { allowed: true };
    }

    const status = await this.verifyProStatus();
    if (status.isPro) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: PRO_EPG_7DAYS_UPGRADE_MESSAGE,
    };
  }

  /**
   * Guard d'accès pour les bouquets supplémentaires (au-delà de 3 bouquets)
   */
  public async guardBouquetsAccess(selectedCount: number): Promise<EpgSecurityGuardResult> {
    if (selectedCount <= 3) {
      return { allowed: true };
    }

    const status = await this.verifyProStatus();
    if (status.isPro) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: PRO_BOUQUETS_UPGRADE_MESSAGE,
    };
  }

  /**
   * Requête sécurisée de l'EPG étendu (J+1 à J+7) ou Catch-up via Supabase RLS / Edge Functions :
   * Exige une vérification du statut Pro côté serveur pour empêcher tout déblocage client sur une version altérée.
   */
  public async secureFetchExtendedEpg(
    channelId: string,
    dayOffset: number,
    isCatchUp = false
  ): Promise<ExtendedEpgResponse> {
    const guard = await this.guardExtendedEpgAccess(dayOffset, isCatchUp);
    if (!guard.allowed) {
      return {
        authorized: false,
        programmes: [],
        error: guard.reason || 'Accès réservé aux utilisateurs PulseEPG Pro.',
      };
    }

    const client = this.getClient();
    if (!supabaseService.isConfigured) {
      // En mode de développement local non connecté à Supabase distant, on renvoie une liste vide autorisée
      return {
        authorized: true,
        programmes: [],
      };
    }

    try {
      // Requête RLS vérifiée par Supabase :
      // La table `epg_extended_schedules` applique la politique RLS :
      // exists (select 1 from public.profiles where profiles.id = auth.uid() and profiles.is_pro = true)
      const { data, error } = await client
        .from('epg_extended_schedules')
        .select('*')
        .eq('channel_id', channelId)
        .eq('day_offset', dayOffset)
        .eq('is_catchup', isCatchUp);

      if (error) {
        // Si RLS refuse la lecture (403 / permission denied)
        if (/permission denied|policy/i.test(error.message)) {
          return {
            authorized: false,
            programmes: [],
            error: 'Accès refusé par la politique de sécurité Supabase RLS (Abonnement Pro requis).',
          };
        }
        return {
          authorized: true,
          programmes: [],
          error: error.message,
        };
      }

      const programmes: EpgProgramme[] = Array.isArray(data)
        ? data.flatMap((row) => (Array.isArray(row.programmes) ? row.programmes : []))
        : [];

      return {
        authorized: true,
        programmes,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur réseau sécurisée EPG étendu';
      return {
        authorized: false,
        programmes: [],
        error: message,
      };
    }
  }

  /**
   * Requête sécurisée de Replay / Catch-up pour une chaîne
   */
  public async secureFetchCatchUp(channelId: string): Promise<ExtendedEpgResponse> {
    return this.secureFetchExtendedEpg(channelId, -1, true);
  }

  /**
   * Réinitialise le cache local lors d'un changement de session ou de déconnexion
   */
  public invalidateCache(): void {
    this.cachedStatus = null;
    this.lastVerificationTime = 0;
  }
}

export const subscriptionService = new SubscriptionService();
