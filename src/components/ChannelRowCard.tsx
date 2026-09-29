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
import { AppLanguage, EpgChannel, EpgProgramme } from '../types/epg';
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
}

const COUNTRY_ACCENTS: Record<
  string,
  { badge: string; border: string; glow: string; flag: string }
> = {
  DE: {
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    border: 'hover:border-amber-500/40',
    glow: 'from-amber-500/5',
    flag: '🇩🇪',
  },
  ES: {
    badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    border: 'hover:border-rose-500/40',
    glow: 'from-rose-500/5',
    flag: '🇪🇸',
  },
  FR: {
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    border: 'hover:border-indigo-500/40',
    glow: 'from-indigo-500/5',
    flag: '🇫🇷',
  },
  IT: {
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    border: 'hover:border-emerald-500/40',
    glow: 'from-emerald-500/5',
    flag: '🇮🇹',
  },
  PL: {
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    border: 'hover:border-sky-500/40',
    glow: 'from-sky-500/5',
    flag: '🇵🇱',
  },
  AR: {
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    border: 'hover:border-violet-500/40',
    glow: 'from-violet-500/5',
    flag: '🇲🇦/🇦🇪',
  },
  EU: {
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    border: 'hover:border-blue-500/40',
    glow: 'from-blue-500/5',
    flag: '🇪🇺',
  },
  BR: {
    badge: 'bg-green-500/15 text-green-300 border-green-500/30',
    border: 'hover:border-green-500/40',
    glow: 'from-green-500/5',
    flag: '🇧🇷',
  },
  LATAM: {
    badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    border: 'hover:border-cyan-500/40',
    glow: 'from-cyan-500/5',
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
}) => {
  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);

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

  return (
    <div
      onClick={() => onSelectChannel(channel)}
      className={`group relative rounded-2xl border cursor-pointer overflow-hidden bg-slate-900/95 ${
        isActualLive ? 'border-l-4 border-l-amber-500' : ''
      } ${
        isSelected
          ? 'border-amber-500/70 ring-1 ring-amber-500/30 shadow-lg shadow-amber-950/30'
          : `border-slate-800/80 ${accent.border} hover:bg-slate-900`
      }`}
    >
      <div className="p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3.5 sm:gap-4">
        {/* Identité Chaîne Satellite */}
        <div className="flex items-center justify-between lg:w-72 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center p-1.5 shrink-0 shadow-inner">
              {channel.icon ? (
                <img
                  src={channel.icon}
                  alt={channel.displayName}
                  className="max-w-full max-h-full object-contain"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <Tv className="w-5 h-5 text-slate-500" />
              )}
              <span className="absolute -bottom-1 -right-1 text-[11px] leading-none">
                {accent.flag}
              </span>
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${accent.badge}`}
                >
                  {channel.orbitalPosition}
                </span>
                {channel.bouquets[0] && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800/90 text-slate-300 border border-slate-700/70">
                    <Satellite className="w-2.5 h-2.5 text-amber-400" />
                    {channel.bouquets[0]}
                  </span>
                )}
              </div>

              <h3 className="font-bold text-slate-100 text-sm sm:text-base truncate mt-1 group-hover:text-amber-300 transition-colors">
                {channel.displayName}
              </h3>

              {/* Badges techniques Audio & Sous-titres */}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {channel.contentCategory === 'Sport / Football' ? (
                  <>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                      <Volume2 className="w-2.5 h-2.5" />
                      {channel.audioTrackLabel || tr.badgeAudioStadium}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                      ⚽ {channel.subtitleTrackLabel || tr.badgeFootballLive}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                      <Volume2 className="w-2.5 h-2.5" />
                      {channel.audioTrackLabel || tr.badgeVoEnglish}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/25">
                      <Subtitles className="w-2.5 h-2.5" />
                      {channel.subtitleTrackLabel || tr.badgeSubDvb}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(channel.id);
            }}
            className={`p-2 rounded-xl border transition-all lg:hidden cursor-pointer ${
              isFavorite
                ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
            }`}
            aria-label={tr.favLabel}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500' : ''}`} />
          </button>
        </div>

        {/* Programme En Direct */}
        <div
          className={`flex-1 min-w-0 lg:ps-4 ${
            isActualLive
              ? 'border-l-4 border-amber-500 ps-3'
              : 'lg:border-s lg:border-slate-800/80'
          }`}
        >
          {currentProgramme ? (
            <div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  {isActualLive ? (
                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                      {tr.liveBadge}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      <Clock className="w-2.5 h-2.5" />
                      {tr.slotBadge}
                    </span>
                  )}

                  <span className="text-slate-300 font-mono text-[11px] font-semibold">
                    {formatTimeShort(currentProgramme.startMs)} –{' '}
                    {formatTimeShort(currentProgramme.stopMs)}
                  </span>

                  {formattedCurrentSE && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-bold">
                      {formattedCurrentSE}
                    </span>
                  )}

                  {currentProgramme.date && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 font-semibold">
                      {currentProgramme.date}
                    </span>
                  )}

                  {currentProgramme.category && (
                    <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 truncate max-w-[140px]">
                      {translateDynamicGenre(
                        currentProgramme.category,
                        activeLang
                      )}
                    </span>
                  )}
                </div>

                {isActualLive && (
                  <span className="text-[11px] font-medium text-amber-400/90 shrink-0">
                    {formatRemainingTime(
                      currentProgramme.stopMs,
                      nowMs,
                      activeLang
                    )}
                  </span>
                )}
              </div>

              <div className="mt-1 flex items-baseline gap-2">
                <h4 className="font-bold text-white text-sm sm:text-base truncate">
                  {activeLang === 'fr'
                    ? translateEpgTextToFrenchSync(currentProgramme.title)
                    : currentProgramme.title}
                </h4>
                {currentProgramme.subTitle && allowCurrentSE && (
                  <span className="text-xs text-amber-300/90 truncate hidden md:inline">
                    —{' '}
                    {activeLang === 'fr'
                      ? translateEpgTextToFrenchSync(currentProgramme.subTitle)
                      : currentProgramme.subTitle}
                  </span>
                )}
              </div>

              {currentProgramme.description && (
                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                  {currentProgramme.description}
                </p>
              )}

              {/* Barre de progression statique économe en batterie */}
              <div className="mt-2.5 h-1.5 w-full bg-slate-800/90 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full"
                  style={{ width: `${isActualLive ? progress : 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs text-slate-500 italic flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-slate-600" />
              {tr.noProgramCommunicated}
            </div>
          )}
        </div>

        {/* Programme Suivant */}
        <div className="lg:w-64 shrink-0 lg:border-s lg:border-slate-800/80 lg:ps-4 flex items-center justify-between gap-3 pt-2 lg:pt-0 border-t border-slate-800/60 lg:border-t-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
              <span className="uppercase tracking-wider text-[10px] text-slate-500 font-bold">
                {tr.upNext}
              </span>
              {nextProgramme && (
                <span className="font-mono text-amber-400/90">
                  {formatTimeShort(nextProgramme.startMs)}
                </span>
              )}
            </div>
            {nextProgramme ? (
              <p className="text-xs sm:text-sm font-medium text-slate-200 truncate mt-0.5">
                {activeLang === 'fr'
                  ? translateEpgTextToFrenchSync(nextProgramme.title)
                  : nextProgramme.title}
              </p>
            ) : (
              <p className="text-xs text-slate-500 italic mt-0.5">
                {tr.unspecified}
              </p>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(channel.id);
              }}
              className={`hidden lg:flex p-2 rounded-xl border transition-all cursor-pointer ${
                isFavorite
                  ? 'bg-rose-500/15 border-rose-500/40 text-rose-400'
                  : 'bg-slate-800/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
              }`}
              title={isFavorite ? tr.removeFromFavorites : tr.addToFavorites}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-rose-500' : ''}`} />
            </button>

            <div className="p-2 rounded-xl bg-slate-800/50 text-slate-400 group-hover:text-amber-300 group-hover:bg-amber-500/15 transition-colors">
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
