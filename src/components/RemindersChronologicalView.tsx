import React, { useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  BellRing,
  Calendar,
  ChevronRight,
  Clock,
  Film,
  Radio,
  Satellite,
  Sparkles,
  Trash2,
  Trophy,
  Tv,
} from 'lucide-react';
import {
  AppLanguage,
  EpgChannel,
  EpgProgramme,
  ProgrammeReminder,
} from '../types/epg';
import {
  calculateProgress,
  formatDayLabel,
  formatDurationMinutes,
  formatTimeShort,
} from '../utils/timeFormat';
import {
  buildCleanFallbackLogoDataUri,
  resolveOfficialChannelLogoUrl,
} from '../utils/channelLogoResolver';
import {
  cleanOfficialChannelName,
  cleanXmltvChannelId,
  ensureHttpsUrl,
  isExclusivelySportChannel,
  isPlaceholderProgrammeTitle,
} from '../utils/xmltvParser';
import { translateEpgTextToFrenchSync } from '../utils/metadataResolverCore';
import {
  cleanBouquetName,
  getLanguageOption,
  t,
  translateDynamicGenre,
} from '../utils/i18n';
import {
  getActiveBouquetBadgeForChannel,
  getSingleSatelliteBadgeForChannel,
} from '../services/storageService';

interface RemindersChronologicalViewProps {
  reminders: ProgrammeReminder[];
  channels: EpgChannel[];
  schedulesByChannel: Record<string, EpgProgramme[]>;
  nowMs: number;
  language: AppLanguage;
  onSelectReminder: (reminder: ProgrammeReminder) => void;
  onRemoveReminder: (reminderId: string) => void;
  onClearAllReminders: () => void;
  onToggleReminder: (programme: EpgProgramme, channel: EpgChannel) => void;
  onSimulateImminentAlert: () => void;
}

type ReminderSubFilter = 'all' | 'imminent' | 'sport' | 'cinema';

function formatCountdownLabel(
  startMs: number,
  stopMs: number,
  nowMs: number,
  language: AppLanguage
): {
  label: string;
  state: 'live' | 'imminent' | 'upcoming' | 'ended';
} {
  if (stopMs <= nowMs) {
    return { label: t('reminders.countdownEnded', language), state: 'ended' };
  }
  if (startMs <= nowMs && stopMs > nowMs) {
    const remMins = Math.max(1, Math.ceil((stopMs - nowMs) / 60000));
    return {
      label: t('reminders.countdownLive', language, { min: remMins }),
      state: 'live',
    };
  }
  const diffMins = Math.max(1, Math.ceil((startMs - nowMs) / 60000));
  if (diffMins <= 5) {
    return {
      label: t('reminders.countdownImminent', language, { min: diffMins }),
      state: 'imminent',
    };
  }
  if (diffMins < 60) {
    return {
      label: t('reminders.countdownInMinutes', language, { min: diffMins }),
      state: 'upcoming',
    };
  }
  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  return {
    label:
      mins > 0
        ? t('reminders.countdownInHoursMinutes', language, {
            hours,
            min: mins,
          })
        : t('reminders.countdownInHours', language, { hours }),
    state: 'upcoming',
  };
}

export const RemindersChronologicalView: React.FC<
  RemindersChronologicalViewProps
> = ({
  reminders,
  channels,
  schedulesByChannel,
  nowMs,
  language,
  onSelectReminder,
  onRemoveReminder,
  onClearAllReminders,
  onToggleReminder,
  onSimulateImminentAlert,
}) => {
  const [subFilter, setSubFilter] = useState<ReminderSubFilter>('all');
  const langDir = getLanguageOption(language).dir;
  const isRtl = langDir === 'rtl';

  const channelMap = useMemo(() => {
    const map = new Map<string, EpgChannel>();
    for (const ch of channels) {
      map.set(ch.id, ch);
      map.set(cleanXmltvChannelId(ch.id), ch);
    }
    return map;
  }, [channels]);

  const reminderIdSet = useMemo(
    () => new Set(reminders.map((r) => r.id)),
    [reminders]
  );

  // Tri strictement chronologique : En cours / Imminent d'abord, puis par heure de début croissante
  const sortedReminders = useMemo(() => {
    return [...reminders].sort((a, b) => {
      const aEnded = a.stopMs <= nowMs ? 1 : 0;
      const bEnded = b.stopMs <= nowMs ? 1 : 0;
      if (aEnded !== bEnded) return aEnded - bEnded;
      return a.startMs - b.startMs;
    });
  }, [reminders, nowMs]);

  const counts = useMemo(() => {
    let imminent = 0;
    let sport = 0;
    let cinema = 0;
    for (const r of sortedReminders) {
      const isLiveOr5Min =
        r.stopMs > nowMs && r.startMs - nowMs <= 5 * 60 * 1000;
      if (isLiveOr5Min) imminent++;
      const ch =
        channelMap.get(r.channelId) ||
        channelMap.get(cleanXmltvChannelId(r.channelId));
      const isSport =
        /sport|foot|match|league|liga|calcio|bundesliga|ufc|nba|tennis|f1/i.test(
          `${r.category} ${r.title} ${r.channelName}`
        ) || (ch ? isExclusivelySportChannel(ch) : false);
      if (isSport) {
        sport++;
      } else {
        cinema++;
      }
    }
    return {
      all: sortedReminders.length,
      imminent,
      sport,
      cinema,
    };
  }, [sortedReminders, nowMs, channelMap]);

  const filteredReminders = useMemo(() => {
    return sortedReminders.filter((r) => {
      if (subFilter === 'all') return true;
      if (subFilter === 'imminent') {
        return r.stopMs > nowMs && r.startMs - nowMs <= 5 * 60 * 1000;
      }
      const ch =
        channelMap.get(r.channelId) ||
        channelMap.get(cleanXmltvChannelId(r.channelId));
      const isSport =
        /sport|foot|match|league|liga|calcio|bundesliga|ufc|nba|tennis|f1/i.test(
          `${r.category} ${r.title} ${r.channelName}`
        ) || (ch ? isExclusivelySportChannel(ch) : false);
      if (subFilter === 'sport') return isSport;
      if (subFilter === 'cinema') return !isSport;
      return true;
    });
  }, [sortedReminders, subFilter, nowMs, channelMap]);

  // Suggestions d'événements/matchs/films à venir pour programmer un rappel en 1 clic à la télécommande
  const upcomingSuggestions = useMemo(() => {
    const items: { channel: EpgChannel; programme: EpgProgramme }[] = [];
    for (const ch of channels.slice(0, 30)) {
      const cleanId = cleanXmltvChannelId(ch.id);
      const list =
        schedulesByChannel[cleanId] || schedulesByChannel[ch.id] || [];
      const nextProg = list.find(
        (p) =>
          p &&
          !isPlaceholderProgrammeTitle(p.title) &&
          p.startMs > nowMs &&
          p.startMs <= nowMs + 6 * 3600 * 1000 &&
          !reminderIdSet.has(p.id)
      );
      if (nextProg) {
        items.push({ channel: ch, programme: nextProg });
      }
      if (items.length >= 8) break;
    }
    return items.sort((a, b) => a.programme.startMs - b.programme.startMs);
  }, [channels, schedulesByChannel, nowMs, reminderIdSet]);

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`reminders-view-root w-full space-y-4 ${
        isRtl ? 'text-right' : 'text-left'
      } text-start`}
    >
      {/* En-tête de la vue "Mes Rappels" & Filtres Chronologiques */}
      <div
        dir={isRtl ? 'rtl' : 'ltr'}
        className={`reminders-header-card w-full rounded-lg bg-[#141a26] border border-[#1a202c] p-4 sm:p-5 space-y-4 ${
          isRtl ? 'text-right' : 'text-left'
        } text-start`}
      >
        <div className="w-full flex flex-col gap-3">
          {/* Ligne supérieure : Icône + Titre + Badge compteur & Boutons d'action */}
          <div className="w-full flex flex-row flex-wrap items-center justify-between gap-4">
            <div className="flex flex-row items-center gap-3 flex-wrap min-w-[240px] flex-1">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#0055ff] to-[#ec4899] flex items-center justify-center text-[#ffffff] shadow-[0_0_16px_rgba(236,72,153,0.45)] shrink-0">
                <BellRing className="w-5 h-5 shrink-0" />
              </div>
              <div className="flex flex-row items-center gap-2.5 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-[#ffffff] whitespace-normal">
                  {t('reminders.title', language)}
                </h2>
                <span
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className="px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] border border-[#ec4899] shrink-0"
                >
                  {t('reminders.programmed', language, {
                    count: reminders.length,
                  })}
                </span>
              </div>
            </div>

            <div
              data-tv-row="reminders-actions"
              className="flex flex-row flex-wrap items-center gap-3 shrink-0 my-0.5"
            >
              <button
                type="button"
                onClick={onSimulateImminentAlert}
                className="tv-focusable inline-flex flex-row items-center gap-2 px-3.5 py-2 rounded-lg bg-gradient-to-r from-[#0055ff] to-[#ec4899] hover:opacity-95 text-[#ffffff] border border-[#ec4899] text-xs font-bold shadow-[0_0_12px_rgba(236,72,153,0.45)] transition-all cursor-pointer shrink-0"
                title={t('reminders.testAlertTooltip', language)}
              >
                <BellRing className="w-3.5 h-3.5 shrink-0" />
                <span className="whitespace-normal sm:whitespace-nowrap">
                  {t('reminders.testAlert', language)}
                </span>
              </button>

              {reminders.length > 0 && (
                <button
                  type="button"
                  onClick={onClearAllReminders}
                  className="tv-focusable inline-flex flex-row items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0a0e17] hover:bg-[#e11d48]/20 text-[#cbd5e1] hover:text-[#ffffff] border border-[#1a202c] hover:border-[#e11d48] text-xs font-semibold transition-colors cursor-pointer shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5 text-[#e11d48] shrink-0" />
                  <span className="whitespace-nowrap">
                    {t('reminders.clearAll', language)}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Conteneur de description pleine largeur (empêche tout retour à la ligne vertical mot par mot en RTL) */}
          <div className="w-full">
            <p
              className={`reminders-header-desc w-full whitespace-normal break-normal text-xs sm:text-sm text-[#cbd5e1] leading-relaxed ${
                isRtl ? 'text-right' : 'text-left'
              } text-start`}
            >
              {t('reminders.description', language)}
            </p>
          </div>
        </div>

        {/* Barre de sous-filtres rapides (Tous / En cours & Imminent / Sport / Cinéma) */}
        <div
          data-tv-row="reminders-subfilters"
          className="pt-3 border-t border-[#1a202c] flex flex-row flex-wrap sm:flex-nowrap items-center gap-2.5 overflow-x-auto no-scrollbar py-1 px-0.5"
        >
          <button
            type="button"
            onClick={() => setSubFilter('all')}
            className={`tv-focusable inline-flex flex-row items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all shrink-0 cursor-pointer ${
              subFilter === 'all'
                ? 'bg-gradient-to-r from-[#0055ff] to-[#ec4899] border border-[#ec4899] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(236,72,153,0.45)]'
                : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] font-medium'
            }`}
          >
            <Calendar className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">
              {t('reminders.filterAll', language)}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-[#0a0e17]/80 text-[#ffffff] font-mono text-[10px] font-bold">
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubFilter('imminent')}
            className={`tv-focusable inline-flex flex-row items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all shrink-0 cursor-pointer ${
              subFilter === 'imminent'
                ? 'bg-[#e11d48] border border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] font-medium'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-[#ec4899] shrink-0" />
            <span className="whitespace-nowrap">
              {t('reminders.filterImminent', language)}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-[#141a26] text-[#ffffff] font-mono text-[10px] font-bold">
              {counts.imminent}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubFilter('sport')}
            className={`tv-focusable inline-flex flex-row items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all shrink-0 cursor-pointer ${
              subFilter === 'sport'
                ? 'bg-[#1d4ed8] border border-[#0055ff] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(0,85,255,0.45)]'
                : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] font-medium'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-[#60a5fa] shrink-0" />
            <span className="whitespace-nowrap">
              {t('reminders.filterSport', language)}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-[#141a26] text-[#ffffff] font-mono text-[10px] font-bold">
              {counts.sport}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSubFilter('cinema')}
            className={`tv-focusable inline-flex flex-row items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs transition-all shrink-0 cursor-pointer ${
              subFilter === 'cinema'
                ? 'bg-[#1d4ed8] border border-[#0055ff] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(0,85,255,0.45)]'
                : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] font-medium'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-[#ec4899] shrink-0" />
            <span className="whitespace-nowrap">
              {t('reminders.filterCinema', language)}
            </span>
            <span className="px-1.5 py-0.2 rounded bg-[#141a26] text-[#ffffff] font-mono text-[10px] font-bold">
              {counts.cinema}
            </span>
          </button>
        </div>
      </div>

      {/* Liste Chronologique des Événements / Matchs Programmés */}
      {filteredReminders.length === 0 ? (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className="w-full rounded-lg border border-dashed border-[#1a202c] bg-[#141a26] p-8 text-center"
        >
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0055ff]/25 to-[#ec4899]/25 border border-[#ec4899]/50 flex items-center justify-center mx-auto mb-3">
            <Bell className="w-6 h-6 text-[#ec4899]" />
          </div>
          <h3 className="w-full whitespace-normal text-base font-bold text-[#ffffff]">
            {reminders.length === 0
              ? t('reminders.emptyTitle', language)
              : t('reminders.emptyCategoryTitle', language)}
          </h3>
          <p className="w-full whitespace-normal text-xs sm:text-sm text-[#cbd5e1] mt-1.5 leading-relaxed">
            {t('reminders.emptyDescPrefix', language)}{' '}
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] font-bold text-[10px]">
              <Bell className="w-2.5 h-2.5 shrink-0" />{' '}
              {t('reminders.emptyDescBadge', language)}
            </span>{' '}
            {t('reminders.emptyDescSuffix', language)}
          </p>
        </div>
      ) : (
        <div data-tv-list="reminders" className="w-full space-y-2.5">
          {filteredReminders.map((rem) => {
            const countdown = formatCountdownLabel(
              rem.startMs,
              rem.stopMs,
              nowMs,
              language
            );
            const isLive = countdown.state === 'live';
            const isImminent = countdown.state === 'imminent';
            const progress = isLive
              ? calculateProgress(rem.startMs, rem.stopMs, nowMs)
              : 0;

            const ch =
              channelMap.get(rem.channelId) ||
              channelMap.get(cleanXmltvChannelId(rem.channelId));

            const rawLogo =
              rem.channelIcon ||
              ch?.icon ||
              resolveOfficialChannelLogoUrl(rem.channelId, rem.channelName);
            const logoUrl =
              ensureHttpsUrl(rawLogo.replace(/^http:\/\//i, 'https://')) ||
              buildCleanFallbackLogoDataUri(rem.channelName, rem.channelId);

            const satLabel = ch
              ? getSingleSatelliteBadgeForChannel(ch, 'Tous')
              : rem.orbitalPosition || t('reminders.satelliteFallback', language);
            const bouquetLabel = ch
              ? cleanBouquetName(
                  getActiveBouquetBadgeForChannel(ch, 'Tous', 'Tous') || '',
                  satLabel
                )
              : '';

            const displayTitle =
              language === 'fr'
                ? translateEpgTextToFrenchSync(rem.title)
                : rem.title;

            return (
              <div
                key={rem.id}
                dir={isRtl ? 'rtl' : 'ltr'}
                tabIndex={0}
                role="button"
                data-channel-card="true"
                data-tv-focusable="true"
                onClick={() => onSelectReminder(rem)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' ||
                    e.key === ' ' ||
                    e.key === 'Select' ||
                    e.keyCode === 23 ||
                    e.keyCode === 66
                  ) {
                    e.preventDefault();
                    onSelectReminder(rem);
                  }
                }}
                className={`tv-card-focusable group relative w-full rounded-lg p-3.5 sm:p-4 border transition-all cursor-pointer ${
                  isRtl ? 'text-right' : 'text-left'
                } text-start ${
                  isLive || isImminent
                    ? 'bg-[#141a26] border-[1.5px] border-[#ec4899] shadow-[0_0_18px_rgba(236,72,153,0.35)]'
                    : 'bg-[#141a26] border-[#0055ff]/50 hover:border-[#ec4899]'
                }`}
              >
                <div className="w-full flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Gauche (ou Droite en RTL) : Horaire Chronologique + Chaîne */}
                  <div className="flex flex-row items-center gap-3 w-full lg:w-auto lg:min-w-[280px] shrink-0">
                    <div className="w-12 h-12 rounded-lg bg-[#0a0e17] border border-[#1a202c] flex items-center justify-center p-1.5 shrink-0">
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={rem.channelName}
                          className="max-w-full max-h-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <Tv className="w-5 h-5 text-[#cbd5e1]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-[180px]">
                      <div className="flex flex-row items-center gap-2 flex-wrap">
                        <span className="inline-flex flex-row items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] border border-[#ec4899] shadow-[0_0_8px_rgba(236,72,153,0.4)] shrink-0">
                          <BellRing className="w-2.5 h-2.5 shrink-0" />
                          <span>{t('reminders.activeBadge', language)}</span>
                        </span>
                        <span
                          dir="ltr"
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 uppercase shrink-0"
                        >
                          {satLabel}
                        </span>
                        {bouquetLabel && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ec4899]/20 text-[#ffffff] border border-[#ec4899]/60 shrink-0">
                            {bouquetLabel}
                          </span>
                        )}
                      </div>
                      <h3 className="w-full font-bold text-[#ffffff] text-sm sm:text-base whitespace-normal mt-1">
                        {cleanOfficialChannelName(rem.channelName)}
                      </h3>
                      <div className="flex flex-row items-center gap-1.5 text-[11px] font-mono text-[#cbd5e1] mt-0.5 flex-wrap">
                        <Clock className="w-3 h-3 text-[#60a5fa] shrink-0" />
                        <span>{formatDayLabel(rem.startMs, language)}</span>
                        <span>·</span>
                        <span
                          dir="ltr"
                          className="font-bold text-[#ffffff] inline-block"
                        >
                          {formatTimeShort(rem.startMs)} –{' '}
                          {formatTimeShort(rem.stopMs)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Centre : Détails de l'événement / match programmé */}
                  <div className="w-full flex-1 min-w-[220px] lg:ps-4 lg:border-s lg:border-[#1a202c]">
                    <div className="flex flex-row items-center gap-2 flex-wrap">
                      {isLive ? (
                        <span className="inline-flex flex-row items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-[#e11d48] text-[#ffffff] border border-[#ff0033] shadow-[0_0_10px_rgba(225,29,72,0.5)]">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff] animate-pulse shrink-0" />
                          <span>{countdown.label}</span>
                        </span>
                      ) : isImminent ? (
                        <span className="inline-flex flex-row items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] border border-[#ec4899] animate-pulse">
                          <BellRing className="w-3 h-3 shrink-0" />
                          <span>{countdown.label}</span>
                        </span>
                      ) : (
                        <span className="inline-flex flex-row items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-[#1d4ed8]/25 text-[#60a5fa] border border-[#0055ff]/50">
                          <Clock className="w-3 h-3 shrink-0" />
                          <span>{countdown.label}</span>
                        </span>
                      )}

                      {rem.category && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 font-medium">
                          {translateDynamicGenre(rem.category, language)}
                        </span>
                      )}

                      <span className="text-[10px] font-mono text-[#cbd5e1]">
                        {formatDurationMinutes(
                          rem.startMs,
                          rem.stopMs,
                          language
                        )}
                      </span>
                    </div>

                    <h4 className="w-full whitespace-normal font-extrabold text-[#ffffff] text-sm sm:text-base 2xl:text-lg mt-1">
                      {displayTitle}
                    </h4>

                    {rem.description && (
                      <p className="w-full whitespace-normal text-xs text-[#cbd5e1] line-clamp-2 mt-0.5 leading-relaxed">
                        {rem.description}
                      </p>
                    )}

                    {isLive && (
                      <div className="live-progress-rail mt-2 w-full overflow-hidden">
                        <div
                          className="live-progress-fill h-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Droite (ou Gauche en RTL) : Actions (Retirer le rappel / Voir la fiche) */}
                  <div className="flex flex-row flex-wrap items-center justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t border-[#1a202c] lg:border-t-0">
                    <button
                      type="button"
                      data-channel-fav="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveReminder(rem.id);
                      }}
                      className="tv-focusable inline-flex flex-row items-center gap-2 px-3.5 py-2 rounded-lg bg-[#0a0e17] hover:bg-[#e11d48] text-[#cbd5e1] hover:text-[#ffffff] border border-[#1a202c] hover:border-[#ff0033] text-xs font-semibold transition-colors cursor-pointer shrink-0"
                      title={t('reminders.removeTooltip', language)}
                    >
                      <BellOff className="w-3.5 h-3.5 text-[#ec4899] shrink-0" />
                      <span className="whitespace-nowrap">
                        {t('reminders.removeBtn', language)}
                      </span>
                    </button>

                    <div className="p-2 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] group-hover:text-[#ffffff] group-hover:border-[#ec4899] transition-colors shrink-0">
                      <ChevronRight
                        className={`w-4 h-4 transition-transform ${
                          isRtl ? 'rotate-180' : ''
                        }`}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Suggestions d'événements / matchs / films à venir (Programmation en 1 clic à la télécommande) */}
      {upcomingSuggestions.length > 0 && (
        <div
          dir={isRtl ? 'rtl' : 'ltr'}
          className={`w-full rounded-lg bg-[#141a26] border border-[#1a202c] p-4 space-y-3 ${
            isRtl ? 'text-right' : 'text-left'
          } text-start`}
        >
          <div className="w-full flex flex-row items-center justify-between gap-3 flex-wrap">
            <div className="flex flex-row items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#ec4899] shrink-0" />
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#ffffff] whitespace-normal">
                {t('reminders.suggestionsTitle', language)}
              </h3>
            </div>
            <span className="text-[11px] text-[#cbd5e1] whitespace-normal">
              {t('reminders.suggestionsHintPrefix', language)}{' '}
              <strong dir="ltr" className="text-[#ffffff] inline-block">
                {t('reminders.suggestionsHintKey', language)}
              </strong>{' '}
              {t('reminders.suggestionsHintSuffix', language)}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingSuggestions.map(({ channel: ch, programme: prog }) => {
              const countdown = formatCountdownLabel(
                prog.startMs,
                prog.stopMs,
                nowMs,
                language
              );
              return (
                <div
                  key={prog.id}
                  dir={isRtl ? 'rtl' : 'ltr'}
                  tabIndex={0}
                  role="button"
                  data-tv-focusable="true"
                  onClick={() => onToggleReminder(prog, ch)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' ||
                      e.key === ' ' ||
                      e.key === 'Select' ||
                      e.keyCode === 23 ||
                      e.keyCode === 66
                    ) {
                      e.preventDefault();
                      onToggleReminder(prog, ch);
                    }
                  }}
                  className={`tv-card-focusable w-full rounded-lg p-3.5 bg-[#0a0e17] border border-[#1a202c] hover:border-[#ec4899] flex flex-row flex-wrap sm:flex-nowrap items-center justify-between gap-3 cursor-pointer transition-all ${
                    isRtl ? 'text-right' : 'text-left'
                  } text-start`}
                >
                  <div className="flex-1 min-w-[180px]">
                    <div className="flex flex-row items-center gap-1.5 flex-wrap text-[10px]">
                      <span className="font-bold text-[#60a5fa]">
                        {cleanOfficialChannelName(ch.displayName)}
                      </span>
                      <span className="text-[#cbd5e1]">•</span>
                      <span
                        dir="ltr"
                        className="font-mono font-semibold text-[#ffffff] inline-block"
                      >
                        {formatTimeShort(prog.startMs)} –{' '}
                        {formatTimeShort(prog.stopMs)}
                      </span>
                      <span className="px-1.5 py-0.2 rounded bg-[#1d4ed8]/20 text-[#cbd5e1] border border-[#0055ff]/40">
                        {countdown.label}
                      </span>
                    </div>
                    <p className="w-full whitespace-normal text-xs sm:text-sm font-bold text-[#ffffff] line-clamp-1 mt-1">
                      {language === 'fr'
                        ? translateEpgTextToFrenchSync(prog.title)
                        : prog.title}
                    </p>
                  </div>

                  <span className="inline-flex flex-row items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] border border-[#ec4899] text-xs font-bold shrink-0 shadow-[0_0_10px_rgba(236,72,153,0.35)]">
                    <Bell className="w-3.5 h-3.5 shrink-0" />
                    <span className="whitespace-nowrap">
                      {t('reminders.addReminderBtn', language)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const RemindersView = RemindersChronologicalView;
