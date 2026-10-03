import { SupabaseClient } from '@supabase/supabase-js';
import {
  supabaseService,
  PulseUserAccount,
  AuthSessionState,
} from './supabaseService';

export interface UserProfileRecord {
  id: string;
  email?: string;
  full_name?: string;
  is_pro: boolean;
  role: 'user' | 'pro' | 'admin' | 'superuser';
  created_at?: string;
  updated_at?: string;
}

export interface SuperuserCheckResult {
  isSuperuser: boolean;
  isPro: boolean;
  role: string;
  userId?: string;
}

/**
 * Service d'authentification centralisé (AuthService) :
 * - Lit le profil utilisateur authentifié dans `public.profiles` via Supabase RLS.
 * - Le rôle Superuser est vérifié sans aucune clé ni email admin codé en dur :
 *   il s'agit d'un utilisateur dont le profil dans Supabase a `is_pro = true` ou `role in ('admin', 'superuser')`.
 */
export class AuthService {
  constructor(private readonly getClient: () => SupabaseClient = () => supabaseService.supabaseClient) {}

  public get currentUser(): PulseUserAccount | null {
    return supabaseService.currentUser;
  }

  public get isLoggedIn(): boolean {
    return supabaseService.isLoggedIn;
  }

  public get isPro(): boolean {
    return supabaseService.isPremium;
  }

  public getState(): AuthSessionState {
    return supabaseService.getState();
  }

  public subscribe(listener: (state: AuthSessionState) => void): () => void {
    return supabaseService.subscribe(listener);
  }

  /**
   * Récupère le profil utilisateur vérifié directement depuis la table Supabase `public.profiles`.
   */
  public async fetchUserProfile(userId?: string): Promise<UserProfileRecord | null> {
    const client = this.getClient();
    const targetUid = userId || supabaseService.currentUser?.id;

    if (!targetUid || !supabaseService.isConfigured) {
      if (supabaseService.currentUser) {
        return {
          id: supabaseService.currentUser.id,
          email: supabaseService.currentUser.email,
          full_name: supabaseService.currentUser.displayName,
          is_pro: supabaseService.currentUser.isPremium,
          role: supabaseService.currentUser.isPremium ? 'pro' : 'user',
        };
      }
      return null;
    }

    try {
      const { data, error } = await client
        .from('profiles')
        .select('id, email, full_name, is_pro, role, updated_at')
        .eq('id', targetUid)
        .maybeSingle();

      if (!error && data) {
        const isPro = Boolean(
          data.is_pro === true ||
          data.role === 'superuser' ||
          data.role === 'admin' ||
          data.role === 'pro'
        );
        return {
          id: data.id,
          email: data.email || supabaseService.currentUser?.email,
          full_name: data.full_name || supabaseService.currentUser?.displayName,
          is_pro: isPro,
          role: data.role || (isPro ? 'pro' : 'user'),
          updated_at: data.updated_at,
        };
      }
    } catch {
      // Ignorer erreur réseau en mode déconnecté
    }

    return null;
  }

  /**
   * Vérifie si un compte utilisateur possède les prérogatives Superuser / Admin :
   * - Vérifié strictement par la présence de `is_pro = true` ou `role in ('admin', 'superuser')` dans `public.profiles`.
   * - ZÉRO clé admin ou email codé en dur.
   */
  public async verifySuperuserStatus(userId?: string): Promise<SuperuserCheckResult> {
    const profile = await this.fetchUserProfile(userId);
    if (!profile) {
      return {
        isSuperuser: false,
        isPro: false,
        role: 'guest',
      };
    }

    const isSuperuser = Boolean(
      profile.role === 'superuser' ||
      profile.role === 'admin' ||
      profile.is_pro === true
    );

    return {
      isSuperuser,
      isPro: profile.is_pro || isSuperuser,
      role: profile.role,
      userId: profile.id,
    };
  }

  public async signInWithPassword(params: {
    email: string;
    password?: string;
    displayName?: string;
  }): Promise<PulseUserAccount> {
    return supabaseService.signInWithPassword(params);
  }

  public async signUp(params: {
    email: string;
    password?: string;
    displayName?: string;
  }): Promise<PulseUserAccount> {
    return supabaseService.signUp(params);
  }

  public async signInWithGoogle(): Promise<{ user: PulseUserAccount | null; isSimulated: boolean; infoMessage?: string }> {
    return supabaseService.signInWithGoogle();
  }

  public async signOut(): Promise<void> {
    return supabaseService.signOut();
  }
}

export const authService = new AuthService();
