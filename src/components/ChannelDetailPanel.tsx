import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  Calendar,
  Clock,
  Film,
  RefreshCw,
  Star,
  X,
} from 'lucide-react';
import { EpgChannel, EpgProgramme, ProgrammeReminder } from '../types/epg';
import {
  formatLocalTimeRange,
  formatShortDate,
  getAvailableDays,
  getDurationMinutes,
  getProgrammeProgress,
  getRemainingMinutes,
} from '../utils/timeFormat';
import {
  enrichProgrammeWithFrenchMetadata,
  getCachedEnrichedMetadata,
} from '../services/metadataEnricher';
import { EnrichedProgrammeResult } from '../utils/metadataResolverCore';

interface ChannelDetailPanelProps {
  channel: EpgChannel | null;
  schedule: EpgProgramme[];
  referenceTimeMs: number;
  isFavorite: boolean;
  onToggleFavorite: (channelId: string, e: React.MouseEvent) => void;
  reminders: ProgrammeReminder[];
  onToggleReminder: (programme: EpgProgramme, channelName: string) => void;
  onCloseMobile: () => void;
  onMetadataResolved?: () => void;
  isLight: boolean;
}

export const ChannelDetailPanel: React.FC<ChannelDetailPanelProps> = ({
  channel,
  schedule,
  referenceTimeMs,
  isFavorite,
  onToggleFavorite,
  reminders,
  onToggleReminder,
  onCloseMobile,
  onMetadataResolved,
  isLight,
}) => {
  const [selectedDayStartMs, setSelectedDayStartMs] = useState<number>(0);
  const [focusedProgrammeId, setFocusedProgrammeId] = useState<string | null>(
    null
  );

  const [enrichedData, setEnrichedData] =
    useState<EnrichedProgrammeResult | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [showRawXmlDesc, setShowRawXmlDesc] = useState(false);
  const [posterError, setPosterError] = useState(false);
  const [backdropError, setBackdropError] = useState(false);

  const availableDays = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];
    const minMs = schedule[0].startMs;
    const maxMs = schedule[schedule.length - 1].stopMs;
    return getAvailableDays(minMs, maxMs);
  }, [schedule]);

  useEffect(() => {
    if (!schedule || schedule.length === 0) {
      setSelectedDayStartMs(0);
      setFocusedProgrammeId(null);
      return;
    }

    const activeProg =
      schedule.find(
        (p) => p.startMs <= referenceTimeMs && p.stopMs > referenceTimeMs
      ) ||
      schedule.find((p) => p.startMs >= referenceTimeMs) ||
      schedule[0];

    if (activeProg) {
      setFocusedProgrammeId(activeProg.id);
      const progDay = new Date(activeProg.startMs);
      progDay.setHours(0, 0, 0, 0);
      setSelectedDayStartMs(progDay.getTime());
    }
  }, [channel?.id, schedule, referenceTimeMs]);

  const dayProgrammes = useMemo(() => {
    if (!schedule || schedule.length === 0) return [];
    if (!selectedDayStartMs) return schedule.slice(0, 60);
    const dayEndMs = selectedDayStartMs + 86400000;
    return schedule.filter(
      (p) => p.stopMs > selectedDayStartMs && p.startMs < dayEndMs
    );
  }, [schedule, selectedDayStartMs]);

  const focusedProgramme = useMemo(() => {
    if (!schedule || schedule.length === 0) return null;
    if (focusedProgrammeId) {
      const found = schedule.find((p) => p.id === focusedProgrammeId);
      if (found) return found;
    }
    return dayProgrammes[0] || schedule[0] || null;
  }, [schedule, focusedProgrammeId, dayProgrammes]);

  // Enrichissement automatique TMDB / TVMaze (language=fr-FR) dès qu'un programme est affiché
  useEffect(() => {
    if (!focusedProgramme) {
      setEnrichedData(null);
      setIsEnriching(false);
      return;
    }

    setShowRawXmlDesc(false);
    setPosterError(false);
    setBackdropError(false);

    const cached = getCachedEnrichedMetadata(focusedProgramme);
    if (cached) {
      setEnrichedData(cached);
      setIsEnriching(false);
      return;
    }

    let cancelled = false;
    setIsEnriching(true);
    setEnrichedData(null);

    enrichProgrammeWithFrenchMetadata(focusedProgramme, channel?.country)
      .then((res) => {
        if (cancelled) return;
        setEnrichedData(res);
        setIsEnriching(false);
        onMetadataResolved?.();
      })
      .catch(() => {
        if (cancelled) return;
        setIsEnriching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [focusedProgramme, channel?.country, onMetadataResolved]);

  // Enrichissement systématique en arrière-plan des créneaux de la journée affichée
  const [, setDayEnrichTick] = useState(0);
  useEffect(() => {
    if (!channel || dayProgrammes.length === 0) return;
    let cancelled = false;
    const queue = dayProgrammes.filter((p) => !getCachedEnrichedMetadata(p));
    if (queue.length === 0) return;

    let idx = 0;
    const workers = Array.from({ length: 3 }, async () => {
      while (idx < queue.length && !cancelled) {
        const current = queue[idx++];
        try {
          await enrichProgrammeWithOfficialFrenchMetadata(
            current,
            channel.country
          );
          if (!cancelled) {
            setDayEnrichTick((t) => t + 1);
            onMetadataResolved?.();
          }
        } catch {
          // Ignorer
        }
      }
    });

    void Promise.all(workers);

    return () => {
      cancelled = true;
    };
  }, [dayProgrammes, channel, onMetadataResolved]);

  if (!channel) {
    return (
      <div
        className={`rounded-3xl p-8 border text-center ${
          isLight
            ? 'bg-white border-slate-200 text-slate-600'
            : 'bg-[#131B2E] border-slate-800/80 text-slate-400'
        }`}
      >
        <p className="text-sm font-medium">
          Sélectionnez une chaîne pour afficher sa grille complète et les fiches
          officielles en français (TMDB / TVMaze).
        </p>
      </div>
    );
  }

  const isCurrentlyAiring =
    focusedProgramme &&
    focusedProgramme.startMs <= referenceTimeMs &&
    focusedProgramme.stopMs > referenceTimeMs;

  const progress =
    focusedProgramme && isCurrentlyAiring
      ? getProgrammeProgress(
          focusedProgramme.startMs,
          focusedProgramme.stopMs,
          referenceTimeMs
        )
      : 0;

  const hasReminder = focusedProgramme
    ? reminders.some((r) => r.id === focusedProgramme.id)
    : false;

  // Titre officiel français prioritaire (sans traduction littérale)
  const displayedMainTitle =
    enrichedData?.frenchTitle || focusedProgramme?.title || '';

  const rawOrOriginalTitle =
    enrichedData?.originalTitle ||
    focusedProgramme?.originalTitle ||
    focusedProgramme?.title ||
    '';

  const hasDistinctOriginalTitle =
    Boolean(rawOrOriginalTitle) &&
    rawOrOriginalTitle.toLowerCase() !== displayedMainTitle.toLowerCase();

  const displayedEpisodeTitle =
    enrichedData?.frenchEpisodeTitle ||
    focusedProgramme?.subTitle ||
    enrichedData?.originalEpisodeTitle;

  const displayedSynopsis =
    (!showRawXmlDesc && enrichedData?.frenchSynopsis) ||
    focusedProgramme?.description ||
    enrichedData?.frenchSynopsis;

  const activePosterUrl = !posterError
    ? enrichedData?.posterUrl || focusedProgramme?.icon
    : undefined;
  const activeBackdropUrl = !backdropError
    ? enrichedData?.backdropUrl || focusedProgramme?.icon || activePosterUrl
    : activePosterUrl;

  return (
    <div
      className={`rounded-t-3xl lg:rounded-3xl border flex flex-col max-h-[88vh] lg:max-h-[calc(100vh-110px)] overflow-hidden ${
        isLight
          ? 'bg-white border-slate-200 text-slate-900 shadow-xl lg:shadow-none'
          : 'bg-[#131B2E] border-slate-800/90 text-slate-100 shadow-2xl lg:shadow-none'
      }`}
    >
      {/* Mobile Bottom Sheet Drag Handle */}
      <div className="lg:hidden pt-2.5 pb-1 flex justify-center">
        <div
          className={`w-10 h-1.5 rounded-full ${
            isLight ? 'bg-slate-300' : 'bg-slate-700'
          }`}
        />
      </div>

      {/* Header: Channel Info + Favorite + Mobile Close */}
      <div
        className={`px-5 py-3.5 border-b flex items-center justify-between gap-3 ${
          isLight ? 'border-slate-200' : 'border-slate-800/80'
        }`}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight truncate">
            {channel.displayName}
          </h2>
          <div
            className={`flex flex-wrap items-center gap-1.5 text-xs mt-0.5 ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            <span className="font-mono tabular-nums font-semibold text-amber-400">
              {channel.orbitalPosition}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-emerald-400 font-medium">
              {channel.audioTrackLabel} + {channel.subtitleTrackLabel}
            </span>
            {channel.lektorStatus && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-sky-400 font-medium">
                  {channel.lektorStatus}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span>{channel.group}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {schedule.length} programmes
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => onToggleFavorite(channel.id, e)}
            className={`min-h-[44px] px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              isFavorite
                ? 'bg-amber-500/15 text-amber-400'
                : isLight
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <Star
              className="w-4 h-4"
              fill={isFavorite ? 'currentColor' : 'none'}
            />
            <span>{isFavorite ? 'Favori' : 'Suivre'}</span>
          </button>

          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Fermer le panneau"
            className={`lg:hidden min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-colors ${
              isLight
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Horizontal Day Selector */}
      {availableDays.length > 0 && (
        <div
          className={`px-5 py-2.5 border-b flex items-center gap-1.5 overflow-x-auto no-scrollbar ${
            isLight
              ? 'bg-slate-50/70 border-slate-200'
              : 'bg-[#0B0F17]/50 border-slate-800/80'
          }`}
        >
          {availableDays.map((day) => {
            const active = day.startOfDayMs === selectedDayStartMs;
            return (
              <button
                key={day.startOfDayMs}
                type="button"
                onClick={() => setSelectedDayStartMs(day.startOfDayMs)}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  active
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : isLight
                    ? 'text-slate-600 hover:bg-slate-200/70'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'
                }`}
              >
                <span>{day.label}</span>
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    active
                      ? 'text-slate-900/80'
                      : isLight
                      ? 'text-slate-400'
                      : 'text-slate-500'
                  }`}
                >
                  {day.subLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Scrollable Body: Focused Programme Detail with Official Poster Backdrop + Full Day Schedule */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
        {focusedProgramme && (
          <div className="relative overflow-hidden">
            {/* Affiche / Poster officiel en arrière-plan du modal avec Scrim de contraste mesuré (WCAG AA) */}
            {activeBackdropUrl && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <img
                  src={activeBackdropUrl}
                  alt={`Affiche de fond ${displayedMainTitle}`}
                  referrerPolicy="no-referrer"
                  onError={() => setBackdropError(true)}
                  className="w-full h-full object-cover object-center scale-105 blur-[2px] opacity-30"
                />
                <div
                  className={`absolute inset-0 ${
                    isLight
                      ? 'bg-gradient-to-t from-white via-white/90 to-white/75'
                      : 'bg-gradient-to-t from-[#0B0F17] via-[#0B0F17]/85 to-[#0B0F17]/60'
                  }`}
                />
              </div>
            )}

            <div
              className={`relative z-10 p-5 ${
                !activeBackdropUrl
                  ? isLight
                    ? 'bg-amber-50/30'
                    : 'bg-[#0B0F17]/40'
                  : ''
              }`}
            >
              {/* Top Kicker Row: Live Status / Time Range + Enrichment Status */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-amber-400 font-mono tabular-nums">
                  <span>
                    {isCurrentlyAiring
                      ? `En direct (${progress}%)`
                      : formatShortDate(focusedProgramme.startMs)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {formatLocalTimeRange(
                      focusedProgramme.startMs,
                      focusedProgramme.stopMs
                    )}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {getDurationMinutes(
                      focusedProgramme.startMs,
                      focusedProgramme.stopMs
                    )}{' '}
                    min
                  </span>
                </div>

                {isEnriching ? (
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-amber-400">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Recherche titre officiel FR (TMDB/TVMaze)...</span>
                  </span>
                ) : enrichedData?.frenchTitle || enrichedData?.frenchSynopsis ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-mono text-emerald-400">
                    <Film className="w-3 h-3" />
                    <span>Fiche Officielle FR ({enrichedData.sourceProvider})</span>
                  </span>
                ) : null}
              </div>

              {/* Poster + Title Lockup */}
              <div className="mt-3 flex items-start gap-4">
                {activePosterUrl && (
                  <div className="w-20 sm:w-24 aspect-[2/3] rounded-xl overflow-hidden shrink-0 border border-white/15 shadow-lg bg-slate-900">
                    <img
                      src={activePosterUrl}
                      alt={`Affiche officielle ${displayedMainTitle}`}
                      referrerPolicy="no-referrer"
                      onError={() => setPosterError(true)}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  {/* Titre Officiel Français */}
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight text-balance">
                    {displayedMainTitle}
                  </h3>

                  {/* Nom Officiel de l'Épisode en Français (ex: S17E17 -> Épisode 17 : En souvenir du 5 novembre) */}
                  {(focusedProgramme.episodeNum || displayedEpisodeTitle) && (
                    <p className="text-xs sm:text-sm font-semibold text-amber-400 mt-1">
                      {focusedProgramme.episodeNum
                        ? `${focusedProgramme.episodeNum}${
                            displayedEpisodeTitle ? ' · ' : ''
                          }`
                        : ''}
                      {displayedEpisodeTitle
                        ? `« ${displayedEpisodeTitle} »`
                        : ''}
                      {enrichedData?.frenchEpisodeTitle &&
                      enrichedData.originalEpisodeTitle &&
                      enrichedData.originalEpisodeTitle.toLowerCase() !==
                        enrichedData.frenchEpisodeTitle.toLowerCase() ? (
                        <span
                          className={`font-normal text-xs ${
                            isLight ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          {' '}
                          (VO : {enrichedData.originalEpisodeTitle})
                        </span>
                      ) : null}
                    </p>
                  )}

                  {/* Titre Original / Titre EPG Brut */}
                  {hasDistinctOriginalTitle && (
                    <p
                      className={`text-xs mt-1 ${
                        isLight ? 'text-slate-600' : 'text-slate-300'
                      }`}
                    >
                      Titre original :{' '}
                      <span className="font-medium">{rawOrOriginalTitle}</span>
                      {focusedProgramme.title !== displayedMainTitle &&
                      focusedProgramme.title !== rawOrOriginalTitle
                        ? ` · EPG : ${focusedProgramme.title}`
                        : ''}
                    </p>
                  )}

                  {/* Unboxed Metadata: Category · Year · Rating */}
                  <div
                    className={`flex flex-wrap items-center gap-1.5 text-xs mt-2 ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    <span>{focusedProgramme.category}</span>
                    {(enrichedData?.releaseYear || focusedProgramme.date) && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          {enrichedData?.releaseYear || focusedProgramme.date}
                        </span>
                      </>
                    )}
                    {enrichedData?.rating && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums text-amber-400 font-semibold">
                          ★ {enrichedData.rating}/10
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Progress Bar */}
              {isCurrentlyAiring && (
                <div className="mt-3.5">
                  <div
                    className={`h-1.5 w-full rounded-full overflow-hidden ${
                      isLight ? 'bg-slate-200' : 'bg-slate-800/90'
                    }`}
                  >
                    <div
                      className="h-full bg-amber-400 transition-transform duration-200 origin-left"
                      style={{
                        transform: `scaleX(${Math.max(0.02, progress / 100)})`,
                      }}
                    />
                  </div>
                  <p
                    className={`text-[11px] font-mono tabular-nums mt-1 ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Temps restant :{' '}
                    {getRemainingMinutes(
                      focusedProgramme.stopMs,
                      referenceTimeMs
                    )}{' '}
                    min
                  </p>
                </div>
              )}

              {/* Synopsis Officiel en Français */}
              <div className="mt-3.5">
                {displayedSynopsis ? (
                  <>
                    <p
                      className={`text-xs leading-relaxed ${
                        isLight ? 'text-slate-700' : 'text-slate-200'
                      }`}
                    >
                      {displayedSynopsis}
                    </p>
                    {enrichedData?.frenchSynopsis &&
                      focusedProgramme.description &&
                      focusedProgramme.description !==
                        enrichedData.frenchSynopsis && (
                        <button
                          type="button"
                          onClick={() => setShowRawXmlDesc((v) => !v)}
                          className="mt-2 text-[11px] font-medium text-amber-400 hover:underline"
                        >
                          {showRawXmlDesc
                            ? 'Afficher le synopsis officiel en français'
                            : 'Voir la description EPG originale'}
                        </button>
                      )}
                  </>
                ) : isEnriching ? (
                  <p
                    className={`text-xs italic ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Récupération du synopsis officiel en français auprès de TMDB /
                    TVMaze...
                  </p>
                ) : (
                  <p
                    className={`text-xs italic ${
                      isLight ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    Synopsis officiel en français non référencé sur TMDB/TVMaze
                    pour ce programme.
                  </p>
                )}
              </div>

              {/* Credits: Directors & Cast */}
              {(focusedProgramme.directors?.length ||
                focusedProgramme.actors?.length) && (
                <div
                  className={`mt-3.5 pt-3 border-t text-xs space-y-1 ${
                    isLight
                      ? 'border-slate-200/80 text-slate-600'
                      : 'border-slate-800/80 text-slate-400'
                  }`}
                >
                  {focusedProgramme.directors &&
                    focusedProgramme.directors.length > 0 && (
                      <p>
                        <span className="font-medium">Réalisation :</span>{' '}
                        {focusedProgramme.directors.join(', ')}
                      </p>
                    )}
                  {focusedProgramme.actors &&
                    focusedProgramme.actors.length > 0 && (
                      <p>
                        <span className="font-medium">Distribution :</span>{' '}
                        {focusedProgramme.actors.join(' · ')}
                      </p>
                    )}
                </div>
              )}

              {/* Reminder Action Button */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() =>
                    onToggleReminder(focusedProgramme, channel.displayName)
                  }
                  className={`min-h-[44px] w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap ${
                    hasReminder
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                  }`}
                >
                  {hasReminder ? (
                    <>
                      <BellOff className="w-4 h-4" />
                      Rappel programmé (Retirer)
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4" />
                      Programmer un rappel local
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Day Programme Timeline List */}
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-semibold tracking-tight flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Grille horaire de la journée</span>
            </h4>
            <span
              className={`text-xs font-mono tabular-nums ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              {dayProgrammes.length} créneaux
            </span>
          </div>

          <div className="divide-y divide-slate-800/40">
            {dayProgrammes.map((prog) => {
              const isLive =
                prog.startMs <= referenceTimeMs &&
                prog.stopMs > referenceTimeMs;
              const isPast = prog.stopMs <= referenceTimeMs;
              const isFocused = focusedProgramme?.id === prog.id;
              const isReminded = reminders.some((r) => r.id === prog.id);
              const cachedMeta = getCachedEnrichedMetadata(prog);
              const rowTitle = cachedMeta?.frenchTitle || prog.title;
              const rowEpTitle =
                cachedMeta?.frenchEpisodeTitle || prog.subTitle;

              return (
                <button
                  key={prog.id}
                  type="button"
                  onClick={() => setFocusedProgrammeId(prog.id)}
                  className={`w-full text-left py-3 px-3 -mx-3 rounded-xl transition-colors flex items-start gap-3 min-h-[52px] ${
                    isFocused
                      ? isLight
                        ? 'bg-amber-100/70'
                        : 'bg-amber-500/10'
                      : isLight
                      ? 'hover:bg-slate-100'
                      : 'hover:bg-slate-800/40'
                  } ${isPast && !isFocused ? 'opacity-60' : ''}`}
                >
                  <div className="w-24 shrink-0 pt-0.5">
                    <span
                      className={`text-xs font-mono tabular-nums font-semibold block ${
                        isLive
                          ? 'text-amber-400'
                          : isLight
                          ? 'text-slate-700'
                          : 'text-slate-300'
                      }`}
                    >
                      {formatLocalTimeRange(prog.startMs, prog.stopMs)}
                    </span>
                    {isLive && (
                      <span className="text-[10px] font-medium text-amber-400 block mt-0.5">
                        En cours
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">
                      {rowTitle}
                      {rowEpTitle ? (
                        <span
                          className={`font-normal ${
                            isLight ? 'text-slate-500' : 'text-slate-400'
                          }`}
                        >
                          {' '}
                          — {rowEpTitle}
                        </span>
                      ) : null}
                    </p>
                    <div
                      className={`flex items-center gap-1.5 text-[11px] mt-0.5 truncate ${
                        isLight ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      <span>{prog.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {getDurationMinutes(prog.startMs, prog.stopMs)} min
                      </span>
                      {prog.episodeNum && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {prog.episodeNum}
                          </span>
                        </>
                      )}
                      {cachedMeta?.frenchTitle && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-400 font-medium">
                            VF
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {isReminded && (
                    <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
