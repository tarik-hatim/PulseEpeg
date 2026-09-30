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

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label="Alerte Rappel Programme TV"
      className="fixed bottom-3 inset-x-3 sm:bottom-5 sm:inset-x-6 z-40 pointer-events-none flex justify-center"
    >
      <div
        data-tv-row="in-app-alert-banner"
        className="pointer-events-auto w-full max-w-4xl rounded-xl bg-[#0a0e17]/95 backdrop-blur-xl border-2 border-[#ec4899] shadow-[0_0_30px_rgba(236,72,153,0.45),0_12px_32px_rgba(0,0,0,0.85)] p-2.5 sm:p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 transition-all"
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
          className="tv-focusable flex-1 flex items-center gap-3 text-start rounded-lg p-1.5 sm:p-2 bg-[#141a26]/90 hover:bg-[#1a202c] border border-[#0055ff]/50 transition-all cursor-pointer min-w-0 group"
        >
          {/* Icône Cloche & Logo Chaîne */}
          <div className="relative shrink-0 flex items-center gap-2">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br from-[#0055ff] to-[#ec4899] p-0.5 shadow-[0_0_14px_rgba(236,72,153,0.55)] flex items-center justify-center">
              <div className="w-full h-full rounded-[6px] bg-[#0a0e17] flex items-center justify-center p-1">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={primaryAlert.channelName}
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <Tv className="w-5 h-5 text-[#ffffff]" />
                )}
              </div>
            </div>
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gradient-to-r from-[#0055ff] to-[#ec4899] border border-[#ffffff] flex items-center justify-center shadow-[0_0_8px_#ec4899]">
              <BellRing className="w-3 h-3 text-[#ffffff] animate-bounce" />
            </span>
          </div>

          {/* Détails de l'alerte programme */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isImminentOrLive ? (
                isLiveNow ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-[#e11d48] text-[#ffffff] border border-[#ff0033] shadow-[0_0_10px_rgba(225,29,72,0.6)]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff] animate-pulse" />
                    EN COURS · DIRECT
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] border border-[#ec4899] shadow-[0_0_10px_rgba(236,72,153,0.55)]">
                    <Clock className="w-3 h-3 text-[#ffffff]" />
                    COMMENCE DANS {diffMinutes} MIN
                  </span>
                )
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] border border-[#ec4899]">
                  <BellRing className="w-3 h-3 text-[#ffffff]" />
                  RAPPEL ENREGISTRÉ · DANS {diffMinutes} MIN
                </span>
              )}

              <span className="text-xs font-bold text-[#60a5fa] truncate">
                {cleanOfficialChannelName(primaryAlert.channelName)}
              </span>

              <span className="text-[11px] font-mono text-[#cbd5e1]">
                {formatTimeShort(primaryAlert.startMs)} –{' '}
                {formatTimeShort(primaryAlert.stopMs)}
              </span>

              {activeAlerts.length > 1 && (
                <span className="px-1.5 py-0.2 rounded bg-[#1d4ed8]/30 border border-[#0055ff] text-[10px] font-mono font-bold text-[#ffffff]">
                  +{activeAlerts.length - 1} autre
                  {activeAlerts.length - 1 > 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div className="mt-0.5 flex items-center justify-between gap-2">
              <p className="text-xs sm:text-sm font-extrabold text-[#ffffff] truncate">
                {displayTitle}
              </p>
              <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#ec4899]/20 border border-[#ec4899] text-[10px] font-mono font-bold text-[#ffffff] shrink-0 group-hover:bg-[#ec4899] transition-colors">
                <span>OK / ENTER</span>
                <ChevronRight className="w-3 h-3" />
              </span>
            </div>

            {isLiveNow && (
              <div className="mt-1.5 h-1 w-full bg-[#0a0e17] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#0055ff] via-[#ec4899] to-[#e11d48] rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </button>

        {/* Actions secondaires (Voir Mes Rappels / Fermer) */}
        <div className="flex items-center justify-end gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenRemindersTab}
            className="tv-focusable inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1d4ed8]/25 hover:bg-[#1d4ed8] border border-[#0055ff] text-xs font-bold text-[#ffffff] transition-colors cursor-pointer"
            title="Ouvrir l'onglet Mes Rappels"
          >
            <ListChecks className="w-3.5 h-3.5 text-[#60a5fa]" />
            <span>Mes Rappels ({reminders.length})</span>
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
            aria-label="Masquer l'alerte de rappel"
            title="Masquer l'alerte"
            className="tv-focusable p-2 rounded-lg bg-[#141a26] hover:bg-[#e11d48] border border-[#1a202c] hover:border-[#ff0033] text-[#cbd5e1] hover:text-[#ffffff] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
