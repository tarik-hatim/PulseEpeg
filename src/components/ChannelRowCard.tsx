import React from 'react';
import {
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
}

const COUNTRY_ACCENTS: Record<
  string,
  { badge: string; border: string; glow: string; flag: string }
> = {
  DE: {
    badge: 'bg-[#090d14] text-[#cbd5e1] border-[#1f293d]',
    border: 'hover:border-[#3b82f6]/60',
    glow: 'from-transparent',
    flag: '🇩🇪',
  },
  ES: {
    badge: 'bg-[#090d14] text-[#cbd5e1] border-[#1f293d]',
    border: 'hover:border-[#3b82f6]/60',
    glow: 'from-transparent',
    flag: '🇪🇸',
  },
  FR: {
    badge: 'bg-[#090d14] text-[#cbd5e1] border-[#1f293d]',
    border: 'hover:border-[#3b82f6]/60',
    glow: 'from-transparent',
    flag: '🇫🇷',
  },
  IT: {
    badge: 'bg-[#090d14] text-[#cbd5e1] border-[#1f293d]',
    border: 'hover:border-[#3b82f6]/60',
    glow: 'from-transparent',
    flag: '🇮🇹',
  },
  PL: {
    badge: 'bg-[#090d14] text-[#cbd5e1] border-[#1f293d]',
    border: 'hover:border-[#3b82f6]/60',
    glow: 'from-transparent',
    flag: '🇵🇱',
  },
  AR: {
    badge: 'bg-[#090d14] text-[#cbd5e1] border-[#1f293d]',
    border: 'hover:border-[#3b82f6]/60',
    glow: 'from-transparent',
    flag: '🇲🇦/🇦🇪',
  },
  EU: {
    badge: 'bg-[#090d14] text-[#cbd5e1] border-[#1f293d]',
    border: 'hover:border-[#3b82f6]/60',
    glow: 'from-transparent',
    flag: '🇪🇺',
  },
  BR: {
    badge: 'bg-[#090d14] text-[#cbd5e1] border-[#1f293d]',
    border: 'hover:border-[#3b82f6]/60',
    glow: 'from-transparent',
    flag: '🇧🇷',
  },
  LATAM: {
    badge: 'bg-[#090d14] text-[#cbd5e1] border-[#1f293d]',
    border: 'hover:border-[#3b82f6]/60',
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
}) => {
  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);
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
      onClick={() => onSelectChannel(channel)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelectChannel(channel);
        }
      }}
      className={`tv-card-focusable group relative rounded-lg border cursor-pointer overflow-hidden transition-all ${
        isSelected
          ? 'bg-[#121824] border-[1.5px] border-[#3b82f6] shadow-[0_0_16px_rgba(59,130,246,0.35)]'
          : `bg-[#121824] border-[#1f293d] ${accent.border} hover:bg-[#172033]`
      }`}
    >
      <div className="p-3.5 sm:p-4 2xl:p-5 flex flex-col lg:flex-row lg:items-center gap-3.5 sm:gap-4 2xl:gap-6">
        {/* Identité Chaîne Satellite */}
        <div className="flex items-center justify-between lg:w-72 2xl:w-80 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 2xl:w-14 2xl:h-14 rounded-lg bg-[#090d14] border border-[#1f293d] flex items-center justify-center p-1.5 shrink-0">
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
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded border uppercase tracking-wider ${accent.badge}`}
                >
                  {singleSatBadge}
                </span>
                {activeBouquetBadge && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#090d14] text-[#cbd5e1] border border-[#1f293d]">
                    <Satellite className="w-2.5 h-2.5 text-[#38bdf8]" />
                    {activeBouquetBadge}
                  </span>
                )}
              </div>

              {/* Badges techniques Audio & Sous-titres */}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {channel.contentCategory === 'Sport / Football' ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#090d14] text-[#cbd5e1] border border-[#1f293d]">
                      <Volume2 className="w-2.5 h-2.5 text-[#cbd5e1]" />
                      {channel.audioTrackLabel || tr.badgeAudioStadium}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#090d14] text-[#cbd5e1] border border-[#1f293d]">
                      ⚽ {channel.subtitleTrackLabel || tr.badgeFootballLive}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#090d14] text-[#cbd5e1] border border-[#1f293d]">
                      <Volume2 className="w-2.5 h-2.5 text-[#cbd5e1]" />
                      {channel.audioTrackLabel || tr.badgeVoEnglish}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#090d14] text-[#cbd5e1] border border-[#1f293d]">
                      <Subtitles className="w-2.5 h-2.5 text-[#cbd5e1]" />
                      {channel.subtitleTrackLabel || tr.badgeSubDvb}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(channel.id);
            }}
            className={`p-2 rounded-lg transition-all lg:hidden cursor-pointer ${
              isFavorite
                ? 'bg-[#2563eb] border-[1.5px] border-[#60a5fa] text-[#ffffff] shadow-[0_0_12px_rgba(37,99,235,0.45)]'
                : 'bg-[#090d14] border border-[#1f293d] text-[#cbd5e1] hover:text-[#ffffff]'
            }`}
            aria-label={tr.favLabel}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#ffffff] text-[#ffffff]' : ''}`} />
          </button>
        </div>

        {/* Programme En Direct */}
        <div className="flex-1 min-w-0 lg:ps-4 lg:border-s lg:border-[#1f293d]">
          {currentProgramme ? (
            <div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  {isActualLive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#2563eb] text-[#ffffff] border border-[#60a5fa] shadow-[0_0_12px_rgba(59,130,246,0.5)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8] shadow-[0_0_8px_#38bdf8] shrink-0 animate-pulse" />
                      {tr.liveBadge}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#090d14] text-[#cbd5e1] border border-[#1f293d]">
                      <Clock className="w-2.5 h-2.5" />
                      {tr.slotBadge}
                    </span>
                  )}

                  <span className="text-[#cbd5e1] font-mono text-[11px] font-medium">
                    {formatTimeShort(currentProgramme.startMs)} –{' '}
                    {formatTimeShort(currentProgramme.stopMs)}
                  </span>

                  {formattedCurrentSE && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#090d14] text-[#cbd5e1] border border-[#1f293d] font-medium">
                      {formattedCurrentSE}
                    </span>
                  )}

                  {currentProgramme.date && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#090d14] text-[#cbd5e1] border border-[#1f293d] font-medium">
                      {currentProgramme.date}
                    </span>
                  )}

                  {currentProgramme.category && (
                    <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded bg-[#090d14] text-[#cbd5e1] border border-[#1f293d] truncate max-w-[140px]">
                      {translateDynamicGenre(
                        currentProgramme.category,
                        activeLang
                      )}
                    </span>
                  )}
                </div>

                {isActualLive && (
                  <span className="text-[11px] font-medium text-[#cbd5e1] shrink-0">
                    {formatRemainingTime(
                      currentProgramme.stopMs,
                      nowMs,
                      activeLang
                    )}
                  </span>
                )}
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

              {/* Barre de progression fine et lumineuse */}
              <div className="mt-2.5 h-1 w-full bg-[#090d14] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#3b82f6] shadow-[0_0_8px_#3b82f6] rounded-full"
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

        {/* Programme Suivant */}
        <div className="lg:w-64 2xl:w-72 shrink-0 lg:border-s lg:border-[#1f293d] lg:ps-4 flex items-center justify-between gap-3 pt-2 lg:pt-0 border-t border-[#1f293d] lg:border-t-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-[#cbd5e1] font-medium">
              <span className="uppercase tracking-wider text-[10px] text-[#cbd5e1] font-semibold">
                {tr.upNext}
              </span>
              {nextProgramme && (
                <span className="font-mono text-[#cbd5e1]">
                  {formatTimeShort(nextProgramme.startMs)}
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(channel.id);
              }}
              className={`hidden lg:flex p-2 rounded-lg transition-all cursor-pointer ${
                isFavorite
                  ? 'bg-[#2563eb] border-[1.5px] border-[#60a5fa] text-[#ffffff] shadow-[0_0_12px_rgba(37,99,235,0.45)]'
                  : 'bg-[#090d14] border border-[#1f293d] text-[#cbd5e1] hover:text-[#ffffff]'
              }`}
              title={isFavorite ? tr.removeFromFavorites : tr.addToFavorites}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#ffffff] text-[#ffffff]' : ''}`} />
            </button>

            <div className="p-2 rounded-lg bg-[#090d14] border border-[#1f293d] text-[#cbd5e1] group-hover:text-[#ffffff] group-hover:border-[#3b82f6]/50 transition-colors">
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
