import React from 'react';
import {
  Bell,
  BellRing,
  ChevronRight,
  Clock,
  Heart,
  Radio,
  Satellite,
  Subtitles,
  Tv,
  Volume2,
} from 'lucide-react';
import {
  AppLanguage,
  BouquetFilter,
  EpgBouquetId,
  EpgChannel,
  EpgProgramme,
  ProgrammeReminder,
  SatelliteFilter,
} from '../types/epg';
import {
  getActiveBouquetBadgeForChannel,
  getSingleSatelliteBadgeForChannel,
} from '../services/storageService';
import {
  calculateProgress,
  formatRemainingTime,
  formatTimeShort,
} from '../utils/timeFormat';
import {
  formatSeasonEpisodeCode,
  isProgrammeSeriesOrDocumentary,
  parseSeasonAndEpisode,
  translateEpgTextToFrenchSync,
} from '../utils/metadataResolverCore';
import {
  cleanOfficialChannelName,
  ensureHttpsUrl,
} from '../utils/xmltvParser';
import {
  buildCleanFallbackLogoDataUri,
  getChannelLogoCandidates,
} from '../utils/channelLogoResolver';
import {
  getActiveLanguage,
  getTranslations,
  translateDynamicGenre,
} from '../utils/i18n';

interface ChannelRowCardProps {
  channel: EpgChannel;
  currentProgramme: EpgProgramme | null;
  nextProgramme: EpgProgramme | null;
  nowMs: number;
  isFavorite: boolean;
  onToggleFavorite: (channelId: string) => void;
  onSelectChannel: (channel: EpgChannel) => void;
  isSelected: boolean;
  language?: AppLanguage;
  activeSatellite?: SatelliteFilter;
  activeBouquet?: BouquetFilter;
  selectedBouquets?: EpgBouquetId[];
  reminders?: ProgrammeReminder[];
  onToggleReminder?: (prog: EpgProgramme, channel: EpgChannel) => void;
}

const COUNTRY_ACCENTS: Record<
  string,
  { badge: string; border: string; glow: string; flag: string }
> = {
  DE: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇩🇪',
  },
  ES: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇪🇸',
  },
  FR: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇫🇷',
  },
  IT: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇮🇹',
  },
  PL: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇵🇱',
  },
  AR: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇲🇦/🇦🇪',
  },
  EU: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇪🇺',
  },
  BR: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇧🇷',
  },
  LATAM: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🌎',
  },
};

export const ChannelRowCard: React.FC<ChannelRowCardProps> = ({
  channel,
  currentProgramme,
  nextProgramme,
  nowMs,
  isFavorite,
  onToggleFavorite,
  onSelectChannel,
  isSelected,
  language,
  activeSatellite,
  activeBouquet,
  selectedBouquets,
  reminders = [],
  onToggleReminder,
}) => {
  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);
  const reminderIdSet = React.useMemo(
    () => new Set(reminders.map((r) => r.id)),
    [reminders]
  );
  const hasCurrentReminder = currentProgramme
    ? reminderIdSet.has(currentProgramme.id)
    : false;
  const hasNextReminder = nextProgramme
    ? reminderIdSet.has(nextProgramme.id)
    : false;
  const singleSatBadge = getSingleSatelliteBadgeForChannel(
    channel,
    activeSatellite,
    selectedBouquets
  );
  const activeBouquetBadge = getActiveBouquetBadgeForChannel(
    channel,
    activeSatellite,
    activeBouquet
  );

  const progress = currentProgramme
    ? calculateProgress(currentProgramme.startMs, currentProgramme.stopMs, nowMs)
    : 0;

  const isActualLive =
    currentProgramme &&
    currentProgramme.startMs <= nowMs &&
    currentProgramme.stopMs > nowMs;

  const accent = COUNTRY_ACCENTS[channel.country] || COUNTRY_ACCENTS.FR;

  const allowCurrentSE = currentProgramme
    ? isProgrammeSeriesOrDocumentary({
        category: currentProgramme.category,
        rawCategory: currentProgramme.rawCategory,
        title: currentProgramme.originalTitle || currentProgramme.title,
        subTitle: currentProgramme.subTitle,
        channelCategory: channel.contentCategory,
      })
    : false;

  const parsedCurrentSE =
    allowCurrentSE && currentProgramme
      ? parseSeasonAndEpisode(
          currentProgramme.episodeNum,
          currentProgramme.originalTitle || currentProgramme.title,
          currentProgramme.subTitle
        )
      : {};

  const formattedCurrentSE = allowCurrentSE
    ? formatSeasonEpisodeCode(parsedCurrentSE.season, parsedCurrentSE.episode)
    : undefined;

  const logoCandidates = React.useMemo(
    () =>
      getChannelLogoCandidates(
        channel.id,
        channel.displayName,
        channel.icon ? channel.icon.replace(/^http:\/\//i, 'https://') : undefined
      ),
    [channel.id, channel.displayName, channel.icon]
  );

  const [logoCandidateIdx, setLogoCandidateIdx] = React.useState(0);

  React.useEffect(() => {
    setLogoCandidateIdx(0);
  }, [channel.id, channel.icon]);

  const rawLogoUrl =
    logoCandidates[Math.min(logoCandidateIdx, logoCandidates.length - 1)] ||
    buildCleanFallbackLogoDataUri(channel.displayName, channel.id);
  const secureChannelLogoUrl =
    ensureHttpsUrl(rawLogoUrl.replace(/^http:\/\//i, 'https://')) ||
    buildCleanFallbackLogoDataUri(channel.displayName, channel.id);

  return (
    <div
      tabIndex={0}
      role="button"
      data-channel-card="true"
      data-tv-focusable="true"
      onClick={() => onSelectChannel(channel)}
      onKeyDown={(e) => {
        if (
          e.key === 'Enter' ||
          e.key === ' ' ||
          e.key === 'Select' ||
          e.keyCode === 23 ||
          e.keyCode === 66
        ) {
          e.preventDefault();
          onSelectChannel(channel);
        }
      }}
      className={`tv-card-focusable group relative rounded-lg border cursor-pointer overflow-hidden transition-all ${
        isSelected
          ? 'bg-[#1a202c] border-[1.5px] border-[#e11d48] shadow-[0_0_16px_rgba(225,29,72,0.4)]'
          : `bg-[#141a26] border-[#1a202c] ${accent.border} hover:bg-[#1a202c]`
      }`}
    >
      <div className="p-3.5 sm:p-4 2xl:p-5 flex flex-col lg:flex-row lg:items-center gap-3.5 sm:gap-4 2xl:gap-6">
        {/* Identité Chaîne Satellite */}
        <div className="flex items-center justify-between lg:w-72 2xl:w-80 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 2xl:w-14 2xl:h-14 rounded-lg bg-[#0a0e17] border border-[#1a202c] flex items-center justify-center p-1.5 shrink-0">
              {secureChannelLogoUrl ? (
                <img
                  src={secureChannelLogoUrl}
                  alt={channel.displayName}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                  onError={(e) => {
                    if (logoCandidateIdx < logoCandidates.length - 1) {
                      setLogoCandidateIdx((prev) => prev + 1);
                    } else {
                      const fallbackUri = buildCleanFallbackLogoDataUri(
                        channel.displayName,
                        channel.id
                      );
                      if (e.currentTarget.src !== fallbackUri) {
                        e.currentTarget.src = fallbackUri;
                      }
                    }
                  }}
                />
              ) : (
                <Tv className="w-5 h-5 text-[#cbd5e1]" />
              )}
              <span className="absolute -bottom-1 -right-1 text-[11px] leading-none">
                {accent.flag}
              </span>
            </div>

            <div className="min-w-0">
              <h3 className="font-bold text-[#ffffff] text-sm sm:text-base 2xl:text-lg truncate">
                {cleanOfficialChannelName(channel.displayName)}
              </h3>

              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${accent.badge}`}
                >
                  {singleSatBadge}
                </span>
                {activeBouquetBadge && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50">
                    <Satellite className="w-2.5 h-2.5 text-[#0055ff]" />
                    {activeBouquetBadge}
                  </span>
                )}
              </div>

              {/* Badges techniques Audio & Sous-titres (Bleu Royal Sky Sport) */}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {channel.contentCategory === 'Sport / Football' ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#1d4ed8]/15 text-[#ffffff] border border-[#0055ff]/45">
                      <Volume2 className="w-2.5 h-2.5 text-[#60a5fa]" />
                      {channel.audioTrackLabel || tr.badgeAudioStadium}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#1d4ed8]/15 text-[#ffffff] border border-[#0055ff]/45">
                      ⚽ {channel.subtitleTrackLabel || tr.badgeFootballLive}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#1d4ed8]/15 text-[#ffffff] border border-[#0055ff]/45">
                      <Volume2 className="w-2.5 h-2.5 text-[#60a5fa]" />
                      {channel.audioTrackLabel || tr.badgeVoEnglish}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#1d4ed8]/15 text-[#ffffff] border border-[#0055ff]/45">
                      <Subtitles className="w-2.5 h-2.5 text-[#60a5fa]" />
                      {channel.subtitleTrackLabel || tr.badgeSubDvb}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-channel-fav="true"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(channel.id);
            }}
            className={`tv-focusable p-2 rounded-lg transition-all lg:hidden cursor-pointer ${
              isFavorite
                ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60'
            }`}
            aria-label={tr.favLabel}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#ffffff] text-[#ffffff]' : ''}`} />
          </button>
        </div>

        {/* Programme En Direct */}
        <div className="flex-1 min-w-0 lg:ps-4 lg:border-s lg:border-[#1a202c]">
          {currentProgramme ? (
            <div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  {isActualLive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-[#e11d48] text-[#ffffff] border border-[#ff0033] shadow-[0_0_12px_rgba(225,29,72,0.5)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff] shadow-[0_0_8px_#ffffff] shrink-0 animate-pulse" />
                      {tr.liveBadge}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50">
                      <Clock className="w-2.5 h-2.5 text-[#60a5fa]" />
                      {tr.slotBadge}
                    </span>
                  )}

                  <span className="text-[#cbd5e1] font-mono text-[11px] font-medium">
                    {formatTimeShort(currentProgramme.startMs)} –{' '}
                    {formatTimeShort(currentProgramme.stopMs)}
                  </span>

                  {formattedCurrentSE && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 font-medium">
                      {formattedCurrentSE}
                    </span>
                  )}

                  {currentProgramme.date && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1d4ed8]/15 text-[#cbd5e1] border border-[#0055ff]/40 font-medium">
                      {currentProgramme.date}
                    </span>
                  )}

                  {currentProgramme.category && (
                    <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 truncate max-w-[140px]">
                      {translateDynamicGenre(
                        currentProgramme.category,
                        activeLang
                      )}
                    </span>
                  )}

                  {hasCurrentReminder && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] border border-[#ec4899]/80 shadow-[0_0_10px_rgba(236,72,153,0.4)]">
                      <BellRing className="w-2.5 h-2.5 text-[#ffffff] animate-bounce" />
                      {tr.reminderActive}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isActualLive && (
                    <span className="text-[11px] font-medium text-[#cbd5e1] shrink-0">
                      {formatRemainingTime(
                        currentProgramme.stopMs,
                        nowMs,
                        activeLang
                      )}
                    </span>
                  )}
                  {onToggleReminder && currentProgramme.startMs > Date.now() && (
                    <button
                      type="button"
                      data-channel-reminder="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleReminder(currentProgramme, channel);
                      }}
                      className={`tv-focusable inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        hasCurrentReminder
                          ? 'bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] border border-[#ec4899] shadow-[0_0_10px_rgba(236,72,153,0.45)]'
                          : 'bg-[#0a0e17] border border-[#0055ff]/50 text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#ec4899]'
                      }`}
                      title={
                        hasCurrentReminder ? tr.cancelReminder : tr.remindProgram
                      }
                    >
                      {hasCurrentReminder ? (
                        <BellRing className="w-3 h-3 text-[#ffffff]" />
                      ) : (
                        <Bell className="w-3 h-3 text-[#60a5fa]" />
                      )}
                      <span className="hidden xl:inline">
                        {hasCurrentReminder ? tr.reminderActive : tr.reminderBtn}
                      </span>
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-1 flex items-baseline gap-2">
                <h4 className="font-bold text-[#ffffff] text-sm sm:text-base 2xl:text-lg truncate">
                  {activeLang === 'fr'
                    ? translateEpgTextToFrenchSync(currentProgramme.title)
                    : currentProgramme.title}
                </h4>
                {currentProgramme.subTitle && allowCurrentSE && (
                  <span className="text-xs text-[#cbd5e1] truncate hidden md:inline">
                    —{' '}
                    {activeLang === 'fr'
                      ? translateEpgTextToFrenchSync(currentProgramme.subTitle)
                      : currentProgramme.subTitle}
                  </span>
                )}
              </div>

              {currentProgramme.description && (
                <p className="text-xs 2xl:text-sm text-[#cbd5e1] line-clamp-1 mt-0.5">
                  {currentProgramme.description}
                </p>
              )}

              {/* Barre de progression dynamique Rouge / Crimson Sky Sport */}
              <div className="mt-2.5 h-1.5 w-full bg-[#0a0e17] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-[#e11d48] to-[#ff0033] shadow-[0_0_10px_#e11d48] rounded-full"
                  style={{ width: `${isActualLive ? progress : 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs text-[#cbd5e1] italic flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-[#cbd5e1]" />
              {tr.noProgramCommunicated}
            </div>
          )}
        </div>

        {/* Programme Suivant (À Venir) + Action Rappel Cloche & Badge Bleu/Rose */}
        <div className="lg:w-72 2xl:w-80 shrink-0 lg:border-s lg:border-[#1a202c] lg:ps-4 flex items-center justify-between gap-2.5 pt-2 lg:pt-0 border-t border-[#1a202c] lg:border-t-0">
          <div
            className={`min-w-0 flex-1 rounded-lg p-1.5 -m-1.5 transition-all ${
              hasNextReminder
                ? 'bg-gradient-to-r from-[#0055ff]/15 to-[#ec4899]/15 border border-[#ec4899]/50'
                : ''
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] text-[#cbd5e1] font-medium flex-wrap">
              <span className="uppercase tracking-wider text-[10px] text-[#60a5fa] font-semibold">
                {tr.upNext}
              </span>
              {nextProgramme && (
                <span className="font-mono text-[#cbd5e1]">
                  {formatTimeShort(nextProgramme.startMs)}
                </span>
              )}
              {hasNextReminder && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] border border-[#ec4899]/80 shadow-[0_0_8px_rgba(236,72,153,0.4)]">
                  <BellRing className="w-2.5 h-2.5 text-[#ffffff]" />
                  {activeLang === 'fr' ? 'Rappel' : tr.reminderBtn}
                </span>
              )}
            </div>
            {nextProgramme ? (
              <p className="text-xs sm:text-sm font-medium text-[#ffffff] truncate mt-0.5">
                {activeLang === 'fr'
                  ? translateEpgTextToFrenchSync(nextProgramme.title)
                  : nextProgramme.title}
              </p>
            ) : (
              <p className="text-xs text-[#cbd5e1] italic mt-0.5">
                {tr.unspecified}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {nextProgramme && onToggleReminder && (
              <button
                type="button"
                data-channel-reminder="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleReminder(nextProgramme, channel);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' ||
                    e.key === ' ' ||
                    e.key === 'Select' ||
                    e.keyCode === 23 ||
                    e.keyCode === 66
                  ) {
                    e.stopPropagation();
                    e.preventDefault();
                    onToggleReminder(nextProgramme, channel);
                  }
                }}
                className={`tv-focusable p-2 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  hasNextReminder
                    ? 'bg-gradient-to-r from-[#0055ff] to-[#ec4899] border-[1.5px] border-[#ec4899] text-[#ffffff] shadow-[0_0_12px_rgba(236,72,153,0.5)]'
                    : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#ec4899]/70'
                }`}
                title={
                  hasNextReminder
                    ? tr.cancelReminder
                    : `${tr.remindProgram} : ${
                        activeLang === 'fr'
                          ? translateEpgTextToFrenchSync(nextProgramme.title)
                          : nextProgramme.title
                      }`
                }
                aria-label={
                  hasNextReminder ? tr.cancelReminder : tr.remindProgram
                }
              >
                {hasNextReminder ? (
                  <BellRing className="w-4 h-4 text-[#ffffff]" />
                ) : (
                  <Bell className="w-4 h-4 text-[#60a5fa]" />
                )}
              </button>
            )}

            <button
              type="button"
              data-channel-fav="true"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(channel.id);
              }}
              className={`tv-focusable hidden lg:flex p-2 rounded-lg transition-all cursor-pointer ${
                isFavorite
                  ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                  : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60'
              }`}
              title={isFavorite ? tr.removeFromFavorites : tr.addToFavorites}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#ffffff] text-[#ffffff]' : ''}`} />
            </button>

            <div className="p-2 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] group-hover:text-[#ffffff] group-hover:border-[#e11d48]/70 transition-colors">
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
