import React, { useState } from 'react';
import {
  Check,
  Crown,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { AppLanguage } from '../types/epg';
import {
  AuthSessionState,
  supabaseService,
} from '../services/supabaseService';

interface AuthAccountModalProps {
  authState: AuthSessionState;
  language: AppLanguage;
  proFeatureReason?: string | null;
  onClose: () => void;
}

export const AuthAccountModal: React.FC<AuthAccountModalProps> = ({
  authState,
  language,
  proFeatureReason,
  onClose,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [displayName, setDisplayName] = useState(
    authState.user?.displayName || ''
  );
  const [email, setEmail] = useState(authState.user?.email || '');
  const [password, setPassword] = useState('');
  const [selectProOnSubmit, setSelectProOnSubmit] = useState<boolean>(
    Boolean(proFeatureReason)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isFr = language === 'fr';

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage(
        isFr
          ? 'Veuillez saisir une adresse e-mail valide.'
          : 'Please enter a valid email address.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (mode === 'register') {
        // 1. Inscription via supabase.auth.signUp() (ou simulation locale réussie si clefs manquantes)
        await supabaseService.signUp({
          email: email.trim(),
          password: password || undefined,
          displayName: displayName.trim() || undefined,
          activatePro: selectProOnSubmit,
        });
      } else {
        // 2. Connexion via supabase.auth.signInWithPassword() (ou simulation locale réussie si clefs manquantes)
        await supabaseService.signInWithPassword({
          email: email.trim(),
          password: password || undefined,
          displayName: displayName.trim() || undefined,
          activatePro: selectProOnSubmit,
        });
      }
      onClose();
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : isFr
          ? 'Erreur lors de la connexion Supabase.'
          : 'Supabase sign-in error.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePro = async (targetPro: boolean) => {
    setIsLoading(true);
    try {
      await supabaseService.setPremiumStatus(targetPro);
      if (targetPro && proFeatureReason) {
        onClose();
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await supabaseService.signOut();
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      data-tv-modal-overlay="true"
      className="fixed inset-0 z-[2600] flex items-center justify-center p-3 sm:p-4 bg-[#0a0e17]/90 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        data-tv-modal="true"
        className="w-full max-w-md bg-[#141a26] border border-[#1a202c] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal avec bouton X de fermeture */}
        <div className="px-4 py-3.5 bg-[#0b0f19] border-b border-[#1a202c] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#0055ff] to-[#ec4899] flex items-center justify-center text-[#ffffff] shrink-0 shadow-[0_0_14px_rgba(236,72,153,0.4)]">
              {authState.isPremium ? (
                <Crown className="w-5 h-5 text-[#fde047]" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-[#ffffff] truncate">
                {proFeatureReason
                  ? 'PulseEPG Pro 👑'
                  : authState.isLoggedIn
                  ? isFr
                    ? 'Mon Compte PulseEPG'
                    : 'My PulseEPG Account'
                  : isFr
                  ? "Se connecter / S'inscrire"
                  : 'Sign In / Sign Up'}
              </h2>
              <p className="text-[11px] text-[#cbd5e1] truncate">
                {authState.isLoggedIn
                  ? `${authState.user?.displayName} • ${authState.statusBadgeLabel}`
                  : isFr
                  ? 'Authentification Supabase (@supabase/supabase-js)'
                  : 'Supabase Authentication (@supabase/supabase-js)'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={isFr ? 'Fermer' : 'Close'}
            title={isFr ? 'Fermer' : 'Close'}
            className="tv-dpad-btn inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#e11d48]/20 border border-[#e11d48]/70 text-[#ffffff] hover:bg-[#e11d48] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps du Modal */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Bandeau d'information si l'utilisateur tente de consulter un jour verrouillé (J+1..J+7 / Catch-up) ou de cocher un 4ème bouquet */}
          {proFeatureReason && (
            <div className="p-3.5 rounded-xl bg-gradient-to-r from-[#ec4899]/25 to-[#8b5cf6]/25 border-2 border-[#ec4899] flex items-start gap-2.5 shadow-[0_0_18px_rgba(236,72,153,0.3)]">
              <Crown className="w-5 h-5 text-[#fde047] shrink-0 mt-0.5" />
              <div className="text-xs text-[#ffffff] leading-relaxed space-y-1.5">
                <p className="font-extrabold text-[#fde047] text-xs sm:text-sm">
                  {proFeatureReason}
                </p>
                <div className="text-[11px] text-[#cbd5e1] space-y-0.5">
                  <p>
                    •{' '}
                    {isFr
                      ? 'Guide EPG étendu 7 jours complets (J+1 à J+7) & Mode Catch-up / Replay'
                      : 'Full 7-day extended EPG Guide (D+1 to D+7) & Catch-up / Replay Mode'}
                  </p>
                  <p>
                    •{' '}
                    {isFr
                      ? 'Débloquez tous les bouquets avec PulseEPG Pro (Synchronisation multi-satellites)'
                      : 'Unlock all bouquets with PulseEPG Pro (Multi-satellite sync)'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {authState.isLoggedIn && authState.user ? (
            <div className="space-y-4">
              {/* Carte Profil Connecté */}
              <div className="p-4 rounded-xl bg-[#0a0e17] border border-[#1a202c] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs text-[#cbd5e1]">
                      {isFr ? 'Utilisateur connecté' : 'Signed in as'}
                    </p>
                    <p className="text-base font-extrabold text-[#ffffff] truncate">
                      {authState.user.displayName}
                    </p>
                    <p className="text-xs font-mono text-[#cbd5e1] truncate">
                      {authState.user.email}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold shrink-0 ${
                      authState.isPremium
                        ? 'bg-gradient-to-r from-[#f59e0b] to-[#ec4899] text-[#ffffff] shadow-[0_0_12px_rgba(245,158,11,0.45)]'
                        : 'bg-[#1d4ed8]/25 text-[#38bdf8] border border-[#0055ff]/60'
                    }`}
                  >
                    <span>
                      {authState.isPremium ? 'PulseEPG Pro 👑' : 'Gratuit'}
                    </span>
                  </span>
                </div>

                <div className="pt-3 border-t border-[#1a202c] space-y-1.5 text-xs text-[#cbd5e1]">
                  <div className="flex items-center justify-between">
                    <span>
                      {isFr ? 'Guide EPG & Replay :' : 'EPG Guide & Replay:'}
                    </span>
                    <span className="font-bold text-[#ffffff]">
                      {authState.isPremium
                        ? isFr
                          ? '7 Jours complets + Replay (Pro 👑)'
                          : 'Full 7 Days + Replay (Pro 👑)'
                        : isFr
                        ? 'Journée en cours (24h)'
                        : 'Current day (24h)'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>
                      {isFr ? 'Bouquets simultanés :' : 'Simultaneous bouquets:'}
                    </span>
                    <span className="font-bold text-[#ffffff]">
                      {authState.isPremium
                        ? isFr
                          ? 'Illimités (Pro 👑)'
                          : 'Unlimited (Pro 👑)'
                        : isFr
                        ? '3 Bouquets Gratuits'
                        : '3 Free Bouquets'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sélecteur de statut Gratuit / PulseEPG Pro 👑 */}
              <div className="space-y-2">
                <p className="text-xs font-bold uppercase tracking-wider text-[#cbd5e1]">
                  {isFr ? 'Statut de votre abonnement' : 'Subscription Status'}
                </p>
                <div
                  data-tv-row="auth-plan-toggle"
                  className="grid grid-cols-2 gap-2.5"
                >
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleTogglePro(false)}
                    className={`tv-dpad-btn p-3 rounded-xl border text-start transition-all cursor-pointer ${
                      !authState.isPremium
                        ? 'bg-[#2563eb]/25 border-[#60a5fa] text-[#ffffff]'
                        : 'bg-[#0a0e17] border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold">Gratuit</span>
                      {!authState.isPremium && (
                        <Check className="w-4 h-4 text-[#38bdf8]" />
                      )}
                    </div>
                    <p className="text-[10px] text-[#cbd5e1] mt-1">
                      {isFr
                        ? 'Grille 24h + 3 bouquets actifs'
                        : '24h TV Grid + 3 active bouquets'}
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleTogglePro(true)}
                    className={`tv-dpad-btn p-3 rounded-xl border text-start transition-all cursor-pointer ${
                      authState.isPremium
                        ? 'bg-gradient-to-br from-[#ec4899]/30 to-[#8b5cf6]/30 border-[#ec4899] text-[#ffffff]'
                        : 'bg-[#0a0e17] border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#fde047]">
                        PulseEPG Pro 👑
                      </span>
                      {authState.isPremium && (
                        <Check className="w-4 h-4 text-[#fde047]" />
                      )}
                    </div>
                    <p className="text-[10px] text-[#cbd5e1] mt-1">
                      {isFr
                        ? 'EPG 7 jours + Replay + Tous les bouquets'
                        : '7-day EPG + Replay + All bouquets'}
                    </p>
                  </button>
                </div>
              </div>

              <div
                data-tv-row="auth-logged-actions"
                className="pt-2 flex items-center justify-between gap-2.5"
              >
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="tv-dpad-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0a0e17] border border-[#334155] text-xs font-semibold text-[#cbd5e1] hover:text-[#e11d48] hover:border-[#e11d48] transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>
                    {isFr
                      ? 'Se déconnecter (Mode Invité)'
                      : 'Sign out (Guest Mode)'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="tv-dpad-btn px-4 py-2 rounded-xl bg-[#0055ff] hover:bg-[#1d4ed8] text-xs font-bold text-[#ffffff] transition-colors cursor-pointer"
                >
                  {isFr ? 'Continuer' : 'Continue'}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Rappel du Mode Invité sans blocage */}
              <div className="p-3 rounded-xl bg-[#0a0e17] border border-[#1a202c] flex items-center gap-2.5 text-xs text-[#cbd5e1]">
                <ShieldCheck className="w-4 h-4 text-[#38bdf8] shrink-0" />
                <span>
                  {isFr
                    ? 'Accès Invité actif : la grille TV et 3 bouquets restent 100% accessibles sans compte.'
                    : 'Guest Access active: TV grid and 3 bouquets remain 100% accessible without an account.'}
                </span>
              </div>

              {/* Onglets Connexion (signInWithPassword) / Inscription (signUp) */}
              <div
                data-tv-row="auth-mode-tabs"
                className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[#0a0e17] border border-[#1a202c]"
              >
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`tv-dpad-btn inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mode === 'login'
                      ? 'bg-[#e11d48] text-[#ffffff]'
                      : 'text-[#cbd5e1] hover:text-[#ffffff]'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isFr ? 'Se connecter' : 'Sign In'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`tv-dpad-btn inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    mode === 'register'
                      ? 'bg-[#e11d48] text-[#ffffff]'
                      : 'text-[#cbd5e1] hover:text-[#ffffff]'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>{isFr ? "S'inscrire" : 'Sign Up'}</span>
                </button>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] font-semibold text-[#cbd5e1] mb-1">
                    {isFr ? "Nom d'affichage" : 'Display Name'}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={isFr ? 'Ex: Tarik' : 'Ex: Tarik'}
                    className="w-full px-3 py-2 rounded-lg bg-[#0a0e17] border border-[#334155] text-xs text-[#ffffff] placeholder-[#cbd5e1]/50"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#cbd5e1] mb-1">
                    {isFr ? 'Adresse e-mail' : 'Email address'}
                  </label>
                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-[#cbd5e1] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      required
                      className="w-full ps-9 pe-3 py-2 rounded-lg bg-[#0a0e17] border border-[#334155] text-xs text-[#ffffff] placeholder-[#cbd5e1]/50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-[#cbd5e1] mb-1">
                    {isFr ? 'Mot de passe' : 'Password'}
                  </label>
                  <div className="relative">
                    <KeyRound className="w-3.5 h-3.5 text-[#cbd5e1] absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full ps-9 pe-3 py-2 rounded-lg bg-[#0a0e17] border border-[#334155] text-xs text-[#ffffff] placeholder-[#cbd5e1]/50"
                    />
                  </div>
                </div>

                {/* Choix du Statut (Gratuit ou PulseEPG Pro 👑) */}
                <div
                  data-tv-row="auth-tier-choice"
                  className="grid grid-cols-2 gap-2 pt-1"
                >
                  <button
                    type="button"
                    onClick={() => setSelectProOnSubmit(false)}
                    className={`tv-dpad-btn p-2.5 rounded-xl border text-start transition-all cursor-pointer ${
                      !selectProOnSubmit
                        ? 'bg-[#2563eb]/25 border-[#60a5fa] text-[#ffffff]'
                        : 'bg-[#0a0e17] border-[#1a202c] text-[#cbd5e1]'
                    }`}
                  >
                    <div className="text-xs font-bold">Gratuit</div>
                    <div className="text-[10px] text-[#cbd5e1]">
                      {isFr ? '3 bouquets inclus' : '3 bouquets included'}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectProOnSubmit(true)}
                    className={`tv-dpad-btn p-2.5 rounded-xl border text-start transition-all cursor-pointer ${
                      selectProOnSubmit
                        ? 'bg-gradient-to-br from-[#ec4899]/30 to-[#8b5cf6]/30 border-[#ec4899] text-[#ffffff]'
                        : 'bg-[#0a0e17] border-[#1a202c] text-[#cbd5e1]'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-[#fde047]">
                      PulseEPG Pro 👑
                    </div>
                    <div className="text-[10px] text-[#cbd5e1]">
                      {isFr ? 'Bouquets illimités' : 'Unlimited bouquets'}
                    </div>
                  </button>
                </div>

                {errorMessage && (
                  <p className="text-xs text-[#e11d48] font-medium">
                    {errorMessage}
                  </p>
                )}

                <div
                  data-tv-row="auth-submit-row"
                  className="pt-1 flex flex-col gap-2"
                >
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="tv-dpad-btn w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-xs font-bold text-[#ffffff] shadow-[0_0_15px_rgba(236,72,153,0.4)] cursor-pointer"
                  >
                    {mode === 'login'
                      ? isFr
                        ? 'Se connecter'
                        : 'Sign In'
                      : isFr
                      ? 'Créer mon compte'
                      : 'Create Account'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
