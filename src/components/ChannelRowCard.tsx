import React, { useState } from 'react';
import { ChevronRight, Star } from 'lucide-react';
import { EpgChannel, EpgProgramme } from '../types/epg';
import {
  formatLocalTimeRange,
  getProgrammeProgress,
  getRemainingMinutes,
} from '../utils/timeFormat';
import { getCachedEnrichedMetadata } from '../services/metadataEnricher';

interface ChannelRowCardProps {
  channel: EpgChannel;
  currentProgramme: EpgProgramme | null;
  nextProgramme: EpgProgramme | null;
  referenceTimeMs: number;
  isSelected: boolean;
  isFavorite: boolean;
  onSelectChannel: (channelId: string) => void;
  onToggleFavorite: (channelId: string, e: React.MouseEvent) => void;
  isLight: boolean;
}

export const ChannelRowCard: React.FC<ChannelRowCardProps> = React.memo(
  ({
    channel,
    currentProgramme,
    nextProgramme,
    referenceTimeMs,
    isSelected,
    isFavorite,
    onSelectChannel,
    onToggleFavorite,
    isLight,
  }) => {
    const [imgError, setImgError] = useState(false);

    const progress = currentProgramme
      ? getProgrammeProgress(
          currentProgramme.startMs,
          currentProgramme.stopMs,
          referenceTimeMs
        )
      : 0;

    const remainingMins = currentProgramme
      ? getRemainingMinutes(currentProgramme.stopMs, referenceTimeMs)
      : 0;

    const enrichedCurrent = currentProgramme
      ? getCachedEnrichedMetadata(currentProgramme)
      : null;
    const enrichedNext = nextProgramme
      ? getCachedEnrichedMetadata(nextProgramme)
      : null;

    const displayCurrentTitle =
      enrichedCurrent?.frenchTitle || currentProgramme?.title || '';
    const displayCurrentSubTitle =
      enrichedCurrent?.frenchEpisodeTitle || currentProgramme?.subTitle;
    const displayCurrentSynopsis =
      enrichedCurrent?.frenchSynopsis || currentProgramme?.description;

    const displayNextTitle =
      enrichedNext?.frenchTitle || nextProgramme?.title || '';

    const initials = channel.displayName
      .replace(/[^a-zA-Z0-9\s+]/g, '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.slice(0, 2).toUpperCase())
      .join('');

    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectChannel(channel.id)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelectChannel(channel.id);
          }
        }}
        className={`group relative rounded-2xl p-4 transition-colors cursor-pointer select-none border ${
          isSelected
            ? isLight
              ? 'bg-amber-50/70 border-amber-400'
              : 'bg-[#182238] border-amber-500/70'
            : isLight
            ? 'bg-white border-slate-200/90 hover:border-slate-300'
            : 'bg-[#131B2E] border-slate-800/80 hover:border-slate-700'
        }`}
      >
        {/* Top Row: Channel Identity + Favorite Trigger */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 overflow-hidden font-display font-bold text-xs ${
                isLight
                  ? 'bg-slate-100 text-slate-800'
                  : 'bg-[#0B0F17] text-slate-200'
              }`}
            >
              {channel.icon && !imgError ? (
                <img
                  src={channel.icon}
                  alt={channel.displayName}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <>
                  <span className="leading-none tracking-tight text-amber-400">
                    {initials || channel.country || 'TV'}
                  </span>
                  <span className="text-[9px] font-mono tabular-nums text-slate-500 mt-0.5">
                    {channel.country}
                  </span>
                </>
              )}
            </div>

            <div className="min-w-0">
              <h3 className="text-base font-semibold tracking-tight truncate">
                {channel.displayName}
              </h3>
              {/* Zero-Pill Unboxed Metadata: Satellite · Bouquet · Audio VO + Subtitles */}
              <div
                className={`flex flex-wrap items-center gap-1.5 text-xs mt-0.5 ${
                  isLight ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                <span className="font-mono tabular-nums font-semibold text-amber-400">
                  {channel.orbitalPosition}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-[11px] text-emerald-400 font-medium">
                  {channel.audioTrackLabel} + {channel.subtitleTrackLabel}
                </span>
                {channel.lektorStatus && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[11px] font-medium text-sky-400">
                      {channel.lektorStatus}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={(e) => onToggleFavorite(channel.id, e)}
              aria-label={
                isFavorite
                  ? `Retirer ${channel.displayName} des favoris`
                  : `Ajouter ${channel.displayName} aux favoris`
              }
              className={`min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-colors ${
                isFavorite
                  ? 'text-amber-400 hover:bg-amber-500/10'
                  : isLight
                  ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'
                  : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Star
                className="w-4 h-4"
                fill={isFavorite ? 'currentColor' : 'none'}
              />
            </button>
            <ChevronRight
              className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
                isLight ? 'text-slate-400' : 'text-slate-500'
              }`}
            />
          </div>
        </div>

        {/* Middle Section: Current Programme (En cours) */}
        <div className="mt-3.5 pt-3 border-t border-slate-800/40 dark:border-slate-800/60">
          {currentProgramme ? (
            <div>
              <div className="flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-mono tabular-nums font-semibold text-amber-400 shrink-0">
                    {formatLocalTimeRange(
                      currentProgramme.startMs,
                      currentProgramme.stopMs
                    )}
                  </span>
                  <span aria-hidden="true" className="text-slate-600">
                    ·
                  </span>
                  <span
                    className={`text-xs truncate ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    {currentProgramme.category}
                    {currentProgramme.episodeNum
                      ? ` · ${currentProgramme.episodeNum}`
                      : ''}
                  </span>
                </div>
                <span
                  className={`text-[11px] font-mono tabular-nums shrink-0 ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  reste {remainingMins} min ({progress}%)
                </span>
              </div>

              <h4 className="text-sm font-semibold mt-1 truncate">
                {displayCurrentTitle}
                {displayCurrentSubTitle ? (
                  <span
                    className={`font-normal ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    {' '}
                    — {displayCurrentSubTitle}
                  </span>
                ) : null}
              </h4>

              {displayCurrentSynopsis && (
                <p
                  className={`text-xs mt-1 line-clamp-2 leading-relaxed ${
                    isLight ? 'text-slate-600' : 'text-slate-400'
                  }`}
                >
                  {displayCurrentSynopsis}
                </p>
              )}

              {/* Live Broadcast Progress Bar */}
              <div
                className={`mt-2.5 h-1 w-full rounded-full overflow-hidden ${
                  isLight ? 'bg-slate-200' : 'bg-slate-800'
                }`}
              >
                <div
                  className="h-full bg-amber-400 transition-transform duration-200 origin-left"
                  style={{
                    transform: `scaleX(${Math.max(0.02, progress / 100)})`,
                  }}
                />
              </div>
            </div>
          ) : (
            <p
              className={`text-xs italic ${
                isLight ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Aucun programme en cours sur ce créneau horaire.
            </p>
          )}

          {/* Bottom Row: Next Programme (À venir) */}
          {nextProgramme && (
            <div className="mt-2.5 flex items-center gap-2 text-xs min-w-0">
              <span
                className={`font-medium shrink-0 ${
                  isLight ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                À suivre
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span
                className={`font-mono tabular-nums shrink-0 ${
                  isLight ? 'text-slate-700' : 'text-slate-300'
                }`}
              >
                {formatLocalTimeRange(
                  nextProgramme.startMs,
                  nextProgramme.stopMs
                )}
              </span>
              <span aria-hidden="true" className="text-slate-600">
                ·
              </span>
              <span
                className={`truncate font-medium ${
                  isLight ? 'text-slate-800' : 'text-slate-200'
                }`}
              >
                {displayNextTitle}
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }
);
