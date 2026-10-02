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
import { getLanguageOption, t } from '../utils/i18n';

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
  const [infoNotification, setInfoNotification] = useState<string | null>(null);

  const langOption = getLanguageOption(language);
  const isRtl = langOption.dir === 'rtl';

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setInfoNotification(null);
    try {
      const result = await supabaseService.signInWithGoogle({
        activatePro: selectProOnSubmit,
        displayName: displayName.trim() || undefined,
        email: email.trim() || undefined,
      });
      if (result.infoMessage) {
        setInfoNotification(result.infoMessage);
      }
      if (!result.isSimulated) {
        onClose();
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : t('auth.errorGoogleOAuth', language)
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMessage(t('auth.errorInvalidEmail', language));
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      if (mode === 'register') {
        // Inscription via supabase.auth.signUp() (ou simulation locale réussie si clefs manquantes)
        await supabaseService.signUp({
          email: email.trim(),
          password: password || undefined,
          displayName: displayName.trim() || undefined,
          activatePro: selectProOnSubmit,
        });
      } else {
        // Connexion via supabase.auth.signInWithPassword() (ou simulation locale réussie si clefs manquantes)
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
          : t('auth.errorSupabase', language)
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

  // Titre principal et badge dynamiques
  const modalHeaderTitle = proFeatureReason
    ? t('auth.proBadge', language)
    : authState.isLoggedIn
    ? t('auth.myAccount', language)
    : t('auth.signInSignUp', language);

  const badgeLabel = authState.isLoggedIn
    ? authState.isPremium
      ? t('auth.proBadge', language)
      : t('auth.free', language)
    : t('auth.guestMode', language);

  const modalSubtitle = authState.isLoggedIn
    ? `${authState.user?.displayName} • ${authState.user?.email}`
    : t('auth.subtitle', language);

  // Message explicatif dans l'encadré rose Pro
  const getProReasonDisplay = () => {
    if (!proFeatureReason) return null;
    const lower = proFeatureReason.toLowerCase();
    const isBouquet =
      lower.includes('bouquet') || lower.includes('باقات');
    if (language === 'ar') {
      return isBouquet
        ? t('auth.proReasonBouquets', language)
        : t('auth.proReasonEpg7Days', language);
    }
    if (language === 'en') {
      return isBouquet
        ? t('auth.proReasonBouquets', language)
        : t('auth.proReasonEpg7Days', language);
    }
    if (language === 'fr') {
      return proFeatureReason;
    }
    return isBouquet
      ? t('auth.proReasonBouquets', language)
      : t('auth.proReasonEpg7Days', language);
  };

  return (
    <div
      data-tv-modal-overlay="true"
      className="fixed inset-0 z-[2600] flex items-center justify-center p-3 sm:p-4 bg-[#0a0e17]/90 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        data-tv-modal="true"
        dir={isRtl ? 'rtl' : 'ltr'}
        className={`auth-modal-root w-full max-w-md bg-[#141a26] border border-[#1a202c] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] ${
          isRtl ? 'text-right' : 'text-left'
        } box-border`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal avec bouton X de fermeture */}
        <div
          data-tv-row="auth-header"
          className="px-5 py-4 bg-[#0b0f19] border-b border-[#1a202c] flex items-center justify-between gap-3 shrink-0 w-full"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0055ff] to-[#ec4899] flex items-center justify-center text-[#ffffff] shrink-0 shadow-[0_0_14px_rgba(236,72,153,0.4)]">
              {authState.isPremium ? (
                <Crown className="w-5 h-5 text-[#fde047]" />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0 flex-1 auth-header-text">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm sm:text-base font-bold text-[#ffffff] whitespace-normal">
                  {modalHeaderTitle}
                </h2>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${
                    authState.isPremium
                      ? 'bg-gradient-to-r from-[#f59e0b] to-[#ec4899] text-[#ffffff]'
                      : 'bg-[#1d4ed8]/25 text-[#38bdf8] border border-[#0055ff]/50'
                  }`}
                >
                  {badgeLabel}
                </span>
              </div>
              <p className="text-[11px] text-[#cbd5e1] mt-0.5 w-full whitespace-normal break-words leading-tight">
                {modalSubtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('auth.close', language)}
            title={t('auth.close', language)}
            className="tv-dpad-btn inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#e11d48]/20 border border-[#e11d48]/70 text-[#ffffff] hover:bg-[#e11d48] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps du Modal */}
        <div
          data-tv-modal-scroll="true"
          className="p-5 sm:p-6 pb-8 overflow-y-auto space-y-4 flex-1 w-full box-border"
        >
          {infoNotification && (
            <div
              role="status"
              data-tv-row="auth-notification"
              className="p-3.5 rounded-xl bg-[#1d4ed8]/25 border border-[#60a5fa] text-xs text-[#ffffff] flex items-start justify-between gap-3 shadow-[0_0_14px_rgba(37,99,235,0.3)] w-full box-border"
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <ShieldCheck className="w-4 h-4 text-[#38bdf8] shrink-0 mt-0.5" />
                <span className="font-semibold leading-relaxed whitespace-normal break-words">
                  {infoNotification}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="tv-dpad-btn px-3 py-1.5 rounded-lg bg-[#0055ff] hover:bg-[#1d4ed8] text-[11px] font-bold text-[#ffffff] shrink-0 cursor-pointer"
              >
                OK
              </button>
            </div>
          )}

          {/* Bandeau d'information si l'utilisateur tente de consulter un jour verrouillé (J+1..J+7 / Catch-up) ou de cocher un 4ème bouquet */}
          {proFeatureReason && (
            <div
              className="pro-feature-card w-full max-w-full p-4 rounded-xl bg-gradient-to-r from-[#ec4899]/25 to-[#8b5cf6]/25 border-2 border-[#ec4899] flex items-start gap-3 shadow-[0_0_18px_rgba(236,72,153,0.3)] box-border"
            >
              <Crown className="w-5 h-5 text-[#fde047] shrink-0 mt-0.5" />
              <div className="w-full flex-1 min-w-0 text-xs text-[#ffffff] leading-relaxed space-y-1.5 whitespace-normal break-words text-start">
                <p className="font-extrabold text-[#fde047] text-xs sm:text-sm leading-snug w-full whitespace-normal break-words">
                  {getProReasonDisplay()}
                </p>
                <div className="text-[11px] text-[#cbd5e1] space-y-1 w-full whitespace-normal break-words">
                  <p className="w-full whitespace-normal break-words">
                    • {t('auth.proBullet1', language)}
                  </p>
                  <p className="w-full whitespace-normal break-words">
                    • {t('auth.proBullet2', language)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {authState.isLoggedIn && authState.user ? (
            <div className="space-y-4 w-full">
              {/* Carte Profil Connecté */}
              <div className="auth-profile-card p-4 rounded-xl bg-[#0a0e17] border border-[#1a202c] space-y-3.5 w-full box-border">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-[#cbd5e1] whitespace-normal">
                      {t('auth.signedInAs', language)}
                    </p>
                    <p className="text-base font-extrabold text-[#ffffff] break-words mt-0.5 whitespace-normal">
                      {authState.user.displayName}
                    </p>
                    <p className="text-xs font-mono text-[#cbd5e1] break-all whitespace-normal">
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
                      {authState.isPremium
                        ? t('auth.proBadge', language)
                        : t('auth.free', language)}
                    </span>
                  </span>
                </div>

                <div className="pt-3 border-t border-[#1a202c] space-y-2 text-xs text-[#cbd5e1]">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="whitespace-normal">
                      {t('auth.epgGuideReplayLabel', language)}
                    </span>
                    <span className="font-bold text-[#ffffff] whitespace-normal">
                      {authState.isPremium
                        ? t('auth.epgGuideReplayPro', language)
                        : t('auth.epgGuideReplayFree', language)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="whitespace-normal">
                      {t('auth.simultaneousBouquetsLabel', language)}
                    </span>
                    <span className="font-bold text-[#ffffff] whitespace-normal">
                      {authState.isPremium
                        ? t('auth.bouquetsUnlimitedPro', language)
                        : t('auth.bouquets3Free', language)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sélecteur de statut Gratuit / PulseEPG Pro 👑 */}
              <div className="space-y-2.5 w-full">
                <p className="text-xs font-bold uppercase tracking-wider text-[#cbd5e1] whitespace-normal text-start">
                  {t('auth.subscriptionStatus', language)}
                </p>
                <div
                  data-tv-row="auth-plan-toggle"
                  className="grid grid-cols-2 gap-3 w-full"
                >
                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleTogglePro(false)}
                    className={`auth-tier-card tv-dpad-btn p-3.5 rounded-xl border text-start transition-all cursor-pointer w-full box-border ${
                      !authState.isPremium
                        ? 'bg-[#2563eb]/25 border-[#60a5fa] text-[#ffffff]'
                        : 'bg-[#0a0e17] border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold whitespace-normal">
                        {t('auth.free', language)}
                      </span>
                      {!authState.isPremium && (
                        <Check className="w-4 h-4 text-[#38bdf8] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#cbd5e1] mt-1.5 leading-snug whitespace-normal break-words">
                      {t('auth.planFreeDesc', language)}
                    </p>
                  </button>

                  <button
                    type="button"
                    disabled={isLoading}
                    onClick={() => handleTogglePro(true)}
                    className={`auth-tier-card tv-dpad-btn p-3.5 rounded-xl border text-start transition-all cursor-pointer w-full box-border ${
                      authState.isPremium
                        ? 'bg-gradient-to-br from-[#ec4899]/30 to-[#8b5cf6]/30 border-[#ec4899] text-[#ffffff]'
                        : 'bg-[#0a0e17] border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-[#fde047] whitespace-normal">
                        {t('auth.proBadge', language)}
                      </span>
                      {authState.isPremium && (
                        <Check className="w-4 h-4 text-[#fde047] shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-[#cbd5e1] mt-1.5 leading-snug whitespace-normal break-words">
                      {t('auth.planProDesc', language)}
                    </p>
                  </button>
                </div>
              </div>

              <div
                data-tv-row="auth-logged-actions"
                className="pt-2 flex items-center justify-between gap-3 w-full"
              >
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={isLoading}
                  className="tv-dpad-btn inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-[#0a0e17] border border-[#334155] text-xs font-semibold text-[#cbd5e1] hover:text-[#e11d48] hover:border-[#e11d48] transition-colors cursor-pointer"
                >
                  <LogOut className={`w-3.5 h-3.5 shrink-0 ${isRtl ? 'rotate-180' : ''}`} />
                  <span className="whitespace-normal">
                    {t('auth.signOutGuest', language)}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="tv-dpad-btn px-4 py-2.5 rounded-xl bg-[#0055ff] hover:bg-[#1d4ed8] text-xs font-bold text-[#ffffff] transition-colors cursor-pointer"
                >
                  {t('auth.continueBtn', language)}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 w-full">
              {/* Rappel du Mode Invité sans blocage */}
              <div className="guest-info-box w-full max-w-full p-3.5 rounded-xl bg-[#0a0e17] border border-[#1a202c] flex items-center gap-3 text-xs text-[#cbd5e1] leading-relaxed box-border">
                <ShieldCheck className="w-4 h-4 text-[#38bdf8] shrink-0" />
                <span className="w-full flex-1 min-w-0 whitespace-normal break-words text-start">
                  {t('auth.guestAccessInfo', language)}
                </span>
              </div>

              {/* Onglets Connexion (signInWithPassword) / Inscription (signUp) */}
              <div
                data-tv-row="auth-mode-tabs"
                className="grid grid-cols-2 gap-2.5 p-1.5 rounded-xl bg-[#0a0e17] border border-[#1a202c] w-full"
              >
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className={`tv-dpad-btn inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer w-full ${
                    mode === 'login'
                      ? 'bg-[#e11d48] text-[#ffffff]'
                      : 'text-[#cbd5e1] hover:text-[#ffffff]'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-normal">
                    {t('auth.signIn', language)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode('register')}
                  className={`tv-dpad-btn inline-flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer w-full ${
                    mode === 'register'
                      ? 'bg-[#e11d48] text-[#ffffff]'
                      : 'text-[#cbd5e1] hover:text-[#ffffff]'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5 shrink-0" />
                  <span className="whitespace-normal">
                    {t('auth.signUp', language)}
                  </span>
                </button>
              </div>

              {/* Bouton d'authentification sociale rapide "Continuer avec Google" */}
              <div data-tv-row="auth-google-oauth" className="space-y-3 w-full">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleGoogleSignIn}
                  className="tv-dpad-btn w-full py-3 px-4 rounded-xl bg-[#ffffff] hover:bg-[#f8fafc] text-[#0f172a] border-2 border-[#ffffff] font-bold text-xs sm:text-sm flex items-center justify-center gap-2.5 shadow-[0_0_16px_rgba(255,255,255,0.2)] transition-all cursor-pointer"
                >
                  <svg
                    className="w-4 h-4 shrink-0"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      fill="#4285F4"
                      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.09 3.56-5.17 3.56-8.8z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-2.98c-1.08.72-2.45 1.16-4.07 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.31c-.24-.72-.38-1.49-.38-2.31s.14-1.59.38-2.31V6.6H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.4l3.99-3.09z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.6l3.99 3.09c.95-2.85 3.6-4.94 6.72-4.94z"
                    />
                  </svg>
                  <span className="whitespace-normal">
                    {t('auth.continueWithGoogle', language)}
                  </span>
                </button>

                <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider text-[#cbd5e1]/70 w-full">
                  <div className="h-px flex-1 bg-[#1a202c]" />
                  <span className="shrink-0 whitespace-nowrap">
                    {t('auth.orWithEmail', language)}
                  </span>
                  <div className="h-px flex-1 bg-[#1a202c]" />
                </div>
              </div>

              <form onSubmit={handleAuthSubmit} className="space-y-3.5 w-full">
                <div className="w-full">
                  <label className="auth-form-label block text-[11px] font-semibold text-[#cbd5e1] mb-1.5 text-start w-full">
                    {t('auth.displayName', language)}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('auth.displayNamePlaceholder', language)}
                    dir={isRtl ? 'rtl' : 'ltr'}
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-[#0a0e17] border border-[#334155] text-xs text-[#ffffff] placeholder-[#cbd5e1]/50 ${
                      isRtl ? 'text-right' : 'text-left'
                    }`}
                  />
                </div>

                <div className="w-full">
                  <label className="auth-form-label block text-[11px] font-semibold text-[#cbd5e1] mb-1.5 text-start w-full">
                    {t('auth.email', language)}
                  </label>
                  <div className="relative w-full">
                    <Mail
                      className={`w-3.5 h-3.5 text-[#cbd5e1] absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                        isRtl ? 'right-3.5' : 'left-3.5'
                      }`}
                    />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nom@exemple.com"
                      required
                      dir="ltr"
                      className={`w-full ${
                        isRtl ? 'pr-9 pl-3.5 text-right' : 'pl-9 pr-3.5 text-left'
                      } py-2.5 rounded-xl bg-[#0a0e17] border border-[#334155] text-xs text-[#ffffff] placeholder-[#cbd5e1]/50`}
                    />
                  </div>
                </div>

                <div className="w-full">
                  <label className="auth-form-label block text-[11px] font-semibold text-[#cbd5e1] mb-1.5 text-start w-full">
                    {t('auth.password', language)}
                  </label>
                  <div className="relative w-full">
                    <KeyRound
                      className={`w-3.5 h-3.5 text-[#cbd5e1] absolute top-1/2 -translate-y-1/2 pointer-events-none ${
                        isRtl ? 'right-3.5' : 'left-3.5'
                      }`}
                    />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      dir="ltr"
                      className={`w-full ${
                        isRtl ? 'pr-9 pl-3.5 text-right' : 'pl-9 pr-3.5 text-left'
                      } py-2.5 rounded-xl bg-[#0a0e17] border border-[#334155] text-xs text-[#ffffff] placeholder-[#cbd5e1]/50`}
                    />
                  </div>
                </div>

                {/* Choix du Statut (Gratuit ou PulseEPG Pro 👑) */}
                <div
                  data-tv-row="auth-tier-choice"
                  className="grid grid-cols-2 gap-3 pt-1 w-full"
                >
                  <button
                    type="button"
                    onClick={() => setSelectProOnSubmit(false)}
                    className={`auth-tier-card tv-dpad-btn p-3 rounded-xl border text-start transition-all cursor-pointer w-full box-border ${
                      !selectProOnSubmit
                        ? 'bg-[#2563eb]/25 border-[#60a5fa] text-[#ffffff]'
                        : 'bg-[#0a0e17] border-[#1a202c] text-[#cbd5e1]'
                    }`}
                  >
                    <div className="text-xs font-bold whitespace-normal">
                      {t('auth.free', language)}
                    </div>
                    <div className="text-[11px] text-[#cbd5e1] mt-1 whitespace-normal leading-snug">
                      {t('auth.tierFree3Bouquets', language)}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectProOnSubmit(true)}
                    className={`auth-tier-card tv-dpad-btn p-3 rounded-xl border text-start transition-all cursor-pointer w-full box-border ${
                      selectProOnSubmit
                        ? 'bg-gradient-to-br from-[#ec4899]/30 to-[#8b5cf6]/30 border-[#ec4899] text-[#ffffff]'
                        : 'bg-[#0a0e17] border-[#1a202c] text-[#cbd5e1]'
                    }`}
                  >
                    <div className="text-xs font-extrabold text-[#fde047] whitespace-normal">
                      {t('auth.proBadge', language)}
                    </div>
                    <div className="text-[11px] text-[#cbd5e1] mt-1 whitespace-normal leading-snug">
                      {t('auth.tierPro7Days', language)}
                    </div>
                  </button>
                </div>

                {errorMessage && (
                  <p className="text-xs text-[#e11d48] font-medium whitespace-normal break-words text-start">
                    {errorMessage}
                  </p>
                )}

                <div
                  data-tv-row="auth-submit-row"
                  className="pt-1.5 flex flex-col gap-2 w-full"
                >
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="tv-dpad-btn w-full py-3 rounded-xl bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-xs sm:text-sm font-bold text-[#ffffff] shadow-[0_0_15px_rgba(236,72,153,0.4)] cursor-pointer"
                  >
                    {mode === 'login'
                      ? t('auth.signIn', language)
                      : t('auth.createAccountBtn', language)}
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
