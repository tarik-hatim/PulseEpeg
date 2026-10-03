import React, { useEffect, useMemo, useRef } from 'react';
import {
  BellRing,
  ChevronRight,
  Clock,
  ListChecks,
  Radio,
  Tv,
  X,
} from 'lucide-react';
import { AppLanguage, ProgrammeReminder } from '../types/epg';
import { calculateProgress, formatTimeShort } from '../utils/timeFormat';
import {
  buildCleanFallbackLogoDataUri,
  resolveOfficialChannelLogoUrl,
} from '../utils/channelLogoResolver';
import { cleanOfficialChannelName, ensureHttpsUrl } from '../utils/xmltvParser';
import { translateEpgTextToFrenchSync } from '../utils/metadataResolverCore';
import { getLanguageOption, t } from '../utils/i18n';
import { playInAppNotificationSound } from '../services/nativeNotificationsService';

interface InAppReminderBannerProps {
  reminders: ProgrammeReminder[];
  realNowMs: number;
  dismissedIds: string[];
  recentAddedReminder: ProgrammeReminder | null;
  onSelectReminder: (reminder: ProgrammeReminder) => void;
  onDismissReminder: (reminderId: string) => void;
  onDismissRecentToast: () => void;
  onOpenRemindersTab: () => void;
  isModalOpen: boolean;
  language: AppLanguage;
}

export const InAppReminderBanner: React.FC<InAppReminderBannerProps> = ({
  reminders,
  realNowMs,
  dismissedIds,
  recentAddedReminder,
  onSelectReminder,
  onDismissReminder,
  onDismissRecentToast,
  onOpenRemindersTab,
  isModalOpen,
  language,
}) => {
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const lastAutoFocusedAlertIdRef = useRef<string | null>(null);

  // Programmes marqués qui commencent dans les 5 prochaines minutes ou qui sont en cours de diffusion
  const activeAlerts = useMemo(() => {
    const dismissedSet = new Set(dismissedIds);
    return reminders
      .filter((r) => {
        if (dismissedSet.has(r.id)) return false;
        const startsInMs = r.startMs - realNowMs;
        const isImminentWithin5Min =
          startsInMs > 0 && startsInMs <= 5 * 60 * 1000;
        const isCurrentlyLive = r.startMs <= realNowMs && r.stopMs > realNowMs;
        return isImminentWithin5Min || isCurrentlyLive;
      })
      .sort((a, b) => a.startMs - b.startMs);
  }, [reminders, realNowMs, dismissedIds]);

  const primaryAlert = activeAlerts[0] || recentAddedReminder || null;
  const isImminentOrLive = Boolean(activeAlerts[0]);
  const lastSoundPlayedAlertIdRef = useRef<string | null>(null);

  // Déclenche le carillon sonore In-App dès qu'un rappel entre dans la fenêtre <= 5 min ou En Direct
  useEffect(() => {
    const currentImminent = activeAlerts[0];
    if (!currentImminent) return;
    if (lastSoundPlayedAlertIdRef.current === currentImminent.id) return;
    lastSoundPlayedAlertIdRef.current = currentImminent.id;
    playInAppNotificationSound();
  }, [activeAlerts]);

  // Rend le bandeau immédiatement sélectionnable via le bouton OK/Enter de la télécommande dès son apparition
  useEffect(() => {
    if (!primaryAlert || isModalOpen) return;
    if (lastAutoFocusedAlertIdRef.current === primaryAlert.id) return;

    const activeEl = document.activeElement as HTMLElement | null;
    const isTyping =
      activeEl &&
      (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
      (activeEl as HTMLInputElement).type !== 'checkbox';

    if (!isTyping && primaryButtonRef.current) {
      lastAutoFocusedAlertIdRef.current = primaryAlert.id;
      const timer = setTimeout(() => {
        primaryButtonRef.current?.focus({ preventScroll: true });
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [primaryAlert, isModalOpen]);

  if (!primaryAlert) return null;

  const isLiveNow =
    primaryAlert.startMs <= realNowMs && primaryAlert.stopMs > realNowMs;
  const diffMinutes = Math.max(
    1,
    Math.ceil((primaryAlert.startMs - realNowMs) / 60000)
  );
  const progress = isLiveNow
    ? calculateProgress(primaryAlert.startMs, primaryAlert.stopMs, realNowMs)
    : 0;

  const rawLogo =
    primaryAlert.channelIcon ||
    resolveOfficialChannelLogoUrl(
      primaryAlert.channelId,
      primaryAlert.channelName
    );
  const logoUrl =
    ensureHttpsUrl(rawLogo.replace(/^http:\/\//i, 'https://')) ||
    buildCleanFallbackLogoDataUri(
      primaryAlert.channelName,
      primaryAlert.channelId
    );

  const displayTitle =
    language === 'fr'
      ? translateEpgTextToFrenchSync(primaryAlert.title)
      : primaryAlert.title;
  const langDir = getLanguageOption(language).dir;
  const isRtl = langDir === 'rtl';

  return (
    <div
      dir={langDir}
      role="region"
      aria-live="polite"
      aria-label={t('reminders.bannerAriaLabel', language)}
      data-tv-row="in-app-alert-banner"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: isRtl ? 'auto' : '24px',
        left: isRtl ? '24px' : 'auto',
        zIndex: 50,
        background: '#1e293b',
        color: '#ffffff',
        border: '1px solid #3b82f6',
        borderRadius: '12px',
        padding: '12px 16px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.85)',
      }}
      className="in-app-toast-banner pointer-events-auto flex items-center gap-3 w-auto min-w-[300px] max-w-[calc(100vw-32px)] sm:max-w-lg transition-all"
    >
      {/* Bouton principal immédiatement sélectionnable via OK / Enter sur la télécommande */}
      <button
        ref={primaryButtonRef}
        type="button"
        tabIndex={0}
        data-tv-alert-banner="true"
        onClick={() => onSelectReminder(primaryAlert)}
        onKeyDown={(e) => {
          if (
            e.key === 'Enter' ||
            e.key === ' ' ||
            e.key === 'Select' ||
            e.keyCode === 23 ||
            e.keyCode === 66
          ) {
            e.preventDefault();
            e.stopPropagation();
            onSelectReminder(primaryAlert);
          }
        }}
        className="tv-focusable flex-1 min-w-0 flex items-center gap-3 text-start rounded-lg p-1 bg-transparent hover:bg-[#0f172a]/70 border border-transparent transition-all cursor-pointer group"
      >
        {/* Icône Cloche & Logo Chaîne */}
        <div className="relative shrink-0 flex items-center">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#2563eb] to-[#ec4899] p-0.5 flex items-center justify-center">
            <div className="w-full h-full rounded-[6px] bg-[#0a0e17] flex items-center justify-center p-1">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={primaryAlert.channelName}
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <Tv className="w-4 h-4 text-[#ffffff]" />
              )}
            </div>
          </div>
          <span className="absolute -top-1 -end-1 w-4 h-4 rounded-full bg-[#2563eb] border border-[#ffffff] flex items-center justify-center">
            <BellRing className="w-2.5 h-2.5 text-[#ffffff] animate-bounce" />
          </span>
        </div>

        {/* Détails structurés de l'alerte programme : évite tout chevauchement */}
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          {/* Ligne 1 : Statut / Temps restant + Nom Chaîne + Horaires */}
          <div className="flex items-center gap-1.5 flex-nowrap overflow-hidden">
            {isImminentOrLive ? (
              isLiveNow ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#e11d48] text-[#ffffff] shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff] animate-pulse shrink-0" />
                  <span>{t('reminders.bannerLive', language)}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#2563eb] to-[#ec4899] text-[#ffffff] shrink-0">
                  <Clock className="w-3 h-3 text-[#ffffff] shrink-0" />
                  <span>
                    {t('reminders.bannerInMinutes', language, {
                      min: diffMinutes,
                    })}
                  </span>
                </span>
              )
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-[#2563eb] text-[#ffffff] shrink-0">
                <BellRing className="w-3 h-3 text-[#ffffff] shrink-0" />
                <span>{t('reminders.bannerSaved', language)}</span>
              </span>
            )}

            <span className="text-xs font-bold text-[#60a5fa] truncate shrink-1">
              {cleanOfficialChannelName(primaryAlert.channelName)}
            </span>

            <span
              dir="ltr"
              className="text-[11px] font-mono text-[#cbd5e1] shrink-0"
            >
              {formatTimeShort(primaryAlert.startMs)} –{' '}
              {formatTimeShort(primaryAlert.stopMs)}
            </span>

            {activeAlerts.length > 1 && (
              <span
                dir="ltr"
                className="px-1.5 py-0.2 rounded-full bg-[#1d4ed8]/40 border border-[#3b82f6] text-[10px] font-mono font-bold text-[#ffffff] shrink-0"
              >
                +{activeAlerts.length - 1}
              </span>
            )}
          </div>

          {/* Ligne 2 : Titre du programme avec badge OK bien espacé */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <p className="text-xs sm:text-sm font-extrabold text-[#ffffff] truncate flex-1 min-w-0">
              {displayTitle}
            </p>
            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ec4899]/20 border border-[#ec4899] text-[10px] font-mono font-bold text-[#ffffff] shrink-0">
              <span>OK</span>
              <ChevronRight
                className={`w-3 h-3 transition-transform ${
                  isRtl ? 'rotate-180' : ''
                }`}
              />
            </span>
          </div>

          {isLiveNow && (
            <div className="h-1 w-full bg-[#0a0e17] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#2563eb] via-[#ec4899] to-[#e11d48] rounded-full"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}
        </div>
      </button>

      {/* Actions secondaires (Voir Mes Rappels / Fermer X) */}
      <div className="flex items-center justify-end gap-1.5 shrink-0">
        <button
          type="button"
          onClick={onOpenRemindersTab}
          className="tv-focusable inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#1d4ed8]/30 hover:bg-[#2563eb] border border-[#3b82f6] text-xs font-bold text-[#ffffff] transition-colors cursor-pointer"
          title={t('reminders.bannerOpenTabTitle', language)}
        >
          <ListChecks className="w-3.5 h-3.5 text-[#60a5fa] shrink-0" />
          <span className="hidden sm:inline">
            {t('reminders.bannerOpenTab', language, {
              count: reminders.length,
            })}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (isImminentOrLive) {
              onDismissReminder(primaryAlert.id);
            } else {
              onDismissRecentToast();
            }
          }}
          aria-label={t('reminders.bannerDismissTitle', language)}
          title={t('reminders.bannerDismissTitle', language)}
          className="tv-focusable p-1.5 rounded-lg bg-[#0a0e17] hover:bg-[#e11d48] border border-[#1a202c] hover:border-[#ff0033] text-[#cbd5e1] hover:text-[#ffffff] transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
