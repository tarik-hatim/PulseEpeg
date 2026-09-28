import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  Globe,
  Orbit,
  Trophy,
  Tv,
} from 'lucide-react';
import {
  BouquetFilter,
  ContentCategoryFilter,
  CountryCode,
  EpgChannel,
  EpgProgramme,
  SatelliteFilter,
  TimeFilterPreset,
} from '../types/epg';
import { formatLocalTime, formatShortDate } from '../utils/timeFormat';
import {
  enrichProgrammeWithFrenchMetadata,
  getCachedEnrichedMetadata,
} from '../services/metadataEnricher';

interface TimeGridViewProps {
  channels: EpgChannel[];
  schedulesByChannel: Record<string, EpgProgramme[]>;
  referenceTimeMs: number;
  onChangeReferenceTime: (newTimeMs: number, preset?: TimeFilterPreset) => void;
  activeTimeFilter?: TimeFilterPreset;
  onSelectTimeFilter?: (preset: TimeFilterPreset) => void;
  onSelectChannel: (channelId: string) => void;
  selectedCategory: ContentCategoryFilter;
  onSelectCategory: (cat: ContentCategoryFilter) => void;
  categoryCounts: Record<string, number>;
  selectedSatellite: SatelliteFilter;
  onSelectSatellite: (sat: SatelliteFilter) => void;
  satelliteCounts: Record<string, number>;
  selectedCountry: CountryCode;
  onSelectCountry: (country: CountryCode) => void;
  countryCounts: Record<string, number>;
  selectedBouquet: BouquetFilter;
  onSelectBouquet: (bouquet: BouquetFilter) => void;
  bouquetCounts: Record<string, number>;
  isLight: boolean;
}

const WINDOW_DURATION_MS = 3 * 3600 * 1000; // Fenêtre de 3 heures sur la grille

const CATEGORIES: { code: ContentCategoryFilter; label: string }[] = [
  { code: 'Tous', label: 'Tous' },
  { code: 'Films & Séries', label: 'Films & Séries' },
  { code: 'Sport / Football', label: 'Sport / Football' },
];

const SATELLITES: { code: SatelliteFilter; label: string }[] = [
  { code: 'Tous', label: 'Tous satellites' },
  { code: 'Astra 19.2°E', label: 'Astra 19.2°E' },
  { code: 'Hotbird 13°E', label: 'Hotbird 13°E' },
  { code: 'Hispasat 30°W', label: 'Hispasat 30°W' },
  { code: 'Nilesat 7°W', label: 'Nilesat 7°W' },
];

const COUNTRIES: { code: CountryCode; label: string }[] = [
  { code: 'Tous', label: 'Tous pays' },
  { code: 'PL', label: 'PL · Pologne (VO / Sport)' },
  { code: 'ES', label: 'ES · Movistar+ / DAZN' },
  { code: 'DE', label: 'DE · Allemagne / Sky DE' },
  { code: 'IT', label: 'IT · Sky Italia / DAZN' },
  { code: 'AR', label: 'Nilesat 7°W · OSN / MBC / beIN' },
];

const BOUQUETS: BouquetFilter[] = [
  'Tous',
  'Movistar+ / DAZN ES',
  'Sky DE / DAZN DE',
  'Sky Italia / DAZN IT',
  'Canal+ / Eleven / FilmBox',
  'HBO / Cinemax',
  'AXN / Warner / Sci-Fi',
  'OSN / MBC (Nilesat)',
  'beIN / SSC / AD Sports',
];

export const TimeGridView: React.FC<TimeGridViewProps> = ({
  channels,
  schedulesByChannel,
  referenceTimeMs,
  onChangeReferenceTime,
  activeTimeFilter,
  onSelectTimeFilter,
  onSelectChannel,
  selectedCategory,
  onSelectCategory,
  categoryCounts,
  selectedSatellite,
  onSelectSatellite,
  satelliteCounts,
  selectedCountry,
  onSelectCountry,
  countryCounts,
  selectedBouquet,
  onSelectBouquet,
  bouquetCounts,
  isLight,
}) => {
  const [page, setPage] = useState(0);
  const [activePreset, setActivePreset] = useState<TimeFilterPreset>(
    activeTimeFilter || 'now'
  );
  const [, setGridEnrichTick] = useState(0);
  const pageSize = 30;

  useEffect(() => {
    if (activeTimeFilter) {
      setActivePreset(activeTimeFilter);
    }
  }, [activeTimeFilter]);

  const currentActiveTimeFilter: TimeFilterPreset =
    activeTimeFilter ?? activePreset;

  useEffect(() => {
    setPage(0);
  }, [
    selectedCategory,
    selectedSatellite,
    selectedCountry,
    selectedBouquet,
    channels.length,
  ]);

  const windowStartMs = useMemo(() => {
    const d = new Date(referenceTimeMs);
    d.setMinutes(d.getMinutes() >= 30 ? 30 : 0, 0, 0);
    return d.getTime();
  }, [referenceTimeMs]);

  const windowEndMs = windowStartMs + WINDOW_DURATION_MS;

  const halfHourSlots = useMemo(() => {
    const slots: number[] = [];
    for (let t = windowStartMs; t < windowEndMs; t += 30 * 60 * 1000) {
      slots.push(t);
    }
    return slots;
  }, [windowStartMs, windowEndMs]);

  const totalPages = Math.max(1, Math.ceil(channels.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visibleChannels = useMemo(
    () => channels.slice(safePage * pageSize, (safePage + 1) * pageSize),
    [channels, safePage]
  );

  // Enrichissement systématique TMDB + Traduction FR sur les programmes visibles de la Grille TV
  useEffect(() => {
    let cancelled = false;

    async function enrichVisibleGridProgrammes() {
      for (const ch of visibleChannels) {
        if (cancelled) break;
        const schedule = schedulesByChannel[ch.id] || [];
        const activeInWindow = schedule
          .filter((p) => p.stopMs > windowStartMs && p.startMs < windowEndMs)
          .slice(0, 2);

        for (const prog of activeInWindow) {
          if (cancelled) break;
          if (!getCachedEnrichedMetadata(prog)) {
            try {
              await enrichProgrammeWithFrenchMetadata(prog, ch.country);
              if (!cancelled) {
                setGridEnrichTick((t) => t + 1);
              }
            } catch {
              // Ignore
            }
          }
        }
      }
    }

    const timer = setTimeout(enrichVisibleGridProgrammes, 180);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visibleChannels, schedulesByChannel, windowStartMs, windowEndMs]);

  const handleMinusOneHour = () => {
    setActivePreset('minus1h');
    onSelectTimeFilter?.('minus1h');
    onChangeReferenceTime(referenceTimeMs - 3600 * 1000, 'minus1h');
  };

  const handleJumpToNow = () => {
    setActivePreset('now');
    onSelectTimeFilter?.('now');
    onChangeReferenceTime(Date.now(), 'now');
  };

  const jumpToTonightPrime = () => {
    setActivePreset('prime');
    onSelectTimeFilter?.('prime');
    const d = new Date(referenceTimeMs);
    d.setHours(20, 45, 0, 0);
    onChangeReferenceTime(d.getTime(), 'prime');
  };

  const handlePlusOneHour = () => {
    setActivePreset('plus1h');
    onSelectTimeFilter?.('plus1h');
    onChangeReferenceTime(referenceTimeMs + 3600 * 1000, 'plus1h');
  };

  const getTimePresetButtonClass = (preset: TimeFilterPreset) => {
    const isActive = currentActiveTimeFilter === preset;
    if (isActive) {
      return 'min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors whitespace-nowrap active btn-orange-active';
    }
    return `min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 transition-colors whitespace-nowrap btn-normal-inactive ${
      isLight
        ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
        : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200'
    }`;
  };

  return (
    <div
      className={`rounded-3xl border overflow-hidden ${
        isLight
          ? 'bg-white border-slate-200 text-slate-900'
          : 'bg-[#131B2E] border-slate-800/90 text-slate-100'
      }`}
    >
      {/* Category, Satellite, Bouquet & Country Quick Filters inside Grille TV Header */}
      <div
        className={`p-4 border-b space-y-2.5 ${
          isLight
            ? 'bg-slate-50/70 border-slate-200'
            : 'bg-[#0B0F17]/50 border-slate-800/80'
        }`}
      >
        {/* Row 0: Quick Category Filter ("Tous", "Films & Séries", "Sport / Football") */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold pr-1 shrink-0 ${
              isLight ? 'text-slate-700' : 'text-slate-200'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-amber-400" />
            <span>Catégorie :</span>
          </div>
          {CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.code;
            const count = categoryCounts[cat.code] || 0;
            return (
              <button
                key={cat.code}
                type="button"
                onClick={() => onSelectCategory(cat.code)}
                className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  active
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : isLight
                    ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'bg-[#131B2E] border border-slate-800 text-slate-200 hover:bg-slate-800'
                }`}
              >
                {cat.code === 'Sport / Football' && (
                  <Trophy className="w-3.5 h-3.5" />
                )}
                <span>{cat.label}</span>
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    active ? 'text-slate-900/80' : 'text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 1: Satellite Quick Filter (Astra 19.2°E, Hotbird 13°E, Hispasat 30°W, Nilesat 7°W) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold pr-1 shrink-0 ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}
          >
            <Orbit className="w-3.5 h-3.5 text-amber-400" />
            <span>Satellite :</span>
          </div>
          {SATELLITES.map((sat) => {
            const active = selectedSatellite === sat.code;
            const count = satelliteCounts[sat.code] || 0;
            return (
              <button
                key={sat.code}
                type="button"
                onClick={() => onSelectSatellite(sat.code)}
                className={`min-h-[38px] px-3.5 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  active
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : isLight
                    ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'bg-[#131B2E] border border-slate-800 text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>{sat.label}</span>
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    active ? 'text-slate-900/80' : 'text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 2: Bouquet Filter (Movistar+, Sky DE, Sky Italia, HBO/Cinemax, Canal+/FilmBox, AXN/Warner, OSN/MBC) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold pr-1 shrink-0 ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            <Tv className="w-3.5 h-3.5 text-amber-400" />
            <span>Bouquet :</span>
          </div>
          {BOUQUETS.map((b) => {
            const active = selectedBouquet === b;
            const count = bouquetCounts[b] || 0;
            return (
              <button
                key={b}
                type="button"
                onClick={() => onSelectBouquet(b)}
                className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  active
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : isLight
                    ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'bg-[#131B2E] border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{b === 'Tous' ? 'Tous bouquets' : b}</span>
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    active ? 'text-slate-900/80' : 'text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Row 3: Country Filter (PL, ES, DE, IT, AR) */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <div
            className={`flex items-center gap-1.5 text-xs font-semibold pr-1 shrink-0 ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-amber-400" />
            <span>Zone :</span>
          </div>
          {COUNTRIES.map((c) => {
            const active = selectedCountry === c.code;
            const count = countryCounts[c.code] || 0;
            return (
              <button
                key={c.code}
                type="button"
                onClick={() => onSelectCountry(c.code)}
                className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                  active
                    ? 'bg-amber-500 text-slate-950 font-semibold'
                    : isLight
                    ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    : 'bg-[#131B2E] border border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <span>{c.label}</span>
                <span
                  className={`font-mono tabular-nums text-[11px] ${
                    active ? 'text-slate-900/80' : 'text-slate-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Time Navigation Header */}
      <div
        className={`p-4 border-b flex flex-wrap items-center justify-between gap-3 ${
          isLight ? 'border-slate-200' : 'border-slate-800/80'
        }`}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold">
            {formatShortDate(windowStartMs)} · {formatLocalTime(windowStartMs)} à{' '}
            {formatLocalTime(windowEndMs)}
          </span>
          <span
            className={`hidden sm:inline text-xs font-mono ${
              isLight ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            · Films/Séries (VO+Sub) & Sport/Football
          </span>
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            type="button"
            aria-pressed={currentActiveTimeFilter === 'minus1h'}
            onClick={handleMinusOneHour}
            className={getTimePresetButtonClass('minus1h')}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>-1h</span>
          </button>

          <button
            type="button"
            aria-pressed={currentActiveTimeFilter === 'now'}
            onClick={handleJumpToNow}
            className={getTimePresetButtonClass('now')}
          >
            <span>Maintenant</span>
          </button>

          <button
            type="button"
            aria-pressed={currentActiveTimeFilter === 'prime'}
            onClick={jumpToTonightPrime}
            className={getTimePresetButtonClass('prime')}
          >
            <span>Prime 20h45</span>
          </button>

          <button
            type="button"
            aria-pressed={currentActiveTimeFilter === 'plus1h'}
            onClick={handlePlusOneHour}
            className={getTimePresetButtonClass('plus1h')}
          >
            <span>+1h</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable Timeline Matrix */}
      <div className="overflow-x-auto">
        <div className="min-w-[780px]">
          {/* Time Ruler */}
          <div
            className={`flex border-b text-xs font-mono tabular-nums ${
              isLight
                ? 'bg-slate-50 border-slate-200 text-slate-500'
                : 'bg-[#0B0F17]/70 border-slate-800/80 text-slate-400'
            }`}
          >
            <div className="w-56 shrink-0 px-4 py-2.5 font-sans font-semibold border-r border-slate-800/40">
              Chaîne Cinéma/Séries ({channels.length})
            </div>
            <div className="flex-1 grid grid-cols-6">
              {halfHourSlots.map((slotMs) => (
                <div
                  key={slotMs}
                  className="px-3 py-2.5 border-r border-slate-800/30 last:border-r-0"
                >
                  {formatLocalTime(slotMs)}
                </div>
              ))}
            </div>
          </div>

          {/* Channel Rows */}
          <div className="divide-y divide-slate-800/40">
            {visibleChannels.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                Aucune chaîne ne correspond au filtre satellite/bouquet sélectionné.
              </div>
            ) : (
              visibleChannels.map((channel) => {
                const schedule = schedulesByChannel[channel.id] || [];
                const overlapping = schedule.filter(
                  (p) => p.stopMs > windowStartMs && p.startMs < windowEndMs
                );

                return (
                  <div
                    key={channel.id}
                    onClick={() => onSelectChannel(channel.id)}
                    className={`flex items-stretch cursor-pointer transition-colors min-h-[64px] ${
                      isLight ? 'hover:bg-slate-50' : 'hover:bg-slate-800/30'
                    }`}
                  >
                    {/* Channel Identity Cell */}
                    <div
                      className={`w-56 shrink-0 px-4 py-2.5 border-r flex flex-col justify-center ${
                        isLight
                          ? 'border-slate-200 bg-white'
                          : 'border-slate-800/60 bg-[#131B2E]'
                      }`}
                    >
                      <p className="text-xs font-semibold truncate">
                        {channel.displayName}
                      </p>
                      <p
                        className={`text-[10px] truncate mt-0.5 ${
                          isLight ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        <span className="font-mono tabular-nums font-semibold text-amber-400">
                          {channel.orbitalPosition}
                        </span>
                      </p>
                      <p className="text-[10px] font-mono text-emerald-400 truncate mt-0.5">
                        {channel.audioTrackLabel} · {channel.subtitleTrackLabel}
                      </p>
                    </div>

                    {/* Proportional Timeline Track */}
                    <div className="flex-1 relative min-h-[64px] flex items-center">
                      {overlapping.length === 0 ? (
                        <span
                          className={`px-4 text-xs italic ${
                            isLight ? 'text-slate-400' : 'text-slate-600'
                          }`}
                        >
                          Aucun programme sur cette tranche horaire
                        </span>
                      ) : (
                        overlapping.map((prog) => {
                          const clampedStart = Math.max(
                            windowStartMs,
                            prog.startMs
                          );
                          const clampedEnd = Math.min(windowEndMs, prog.stopMs);
                          const leftPct =
                            ((clampedStart - windowStartMs) /
                              WINDOW_DURATION_MS) *
                            100;
                          const widthPct = Math.max(
                            2,
                            ((clampedEnd - clampedStart) / WINDOW_DURATION_MS) *
                              100
                          );
                          const isLive =
                            prog.startMs <= referenceTimeMs &&
                            prog.stopMs > referenceTimeMs;
                          const cachedFr = getCachedEnrichedMetadata(prog);
                          const cellTitle = cachedFr?.frenchTitle || prog.title;

                          return (
                            <div
                              key={prog.id}
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                              }}
                              className={`absolute top-1.5 bottom-1.5 px-2.5 py-1 rounded-lg border overflow-hidden flex flex-col justify-center transition-colors ${
                                isLive
                                  ? isLight
                                    ? 'bg-amber-100/90 border-amber-400 text-slate-900'
                                    : 'bg-amber-500/15 border-amber-500/60 text-slate-100'
                                  : isLight
                                  ? 'bg-slate-100 border-slate-200/90 text-slate-800'
                                  : 'bg-[#0B0F17]/90 border-slate-800 text-slate-200'
                              }`}
                            >
                              <p className="text-xs font-semibold truncate">
                                {cellTitle}
                              </p>
                              <p
                                className={`text-[10px] font-mono tabular-nums truncate ${
                                  isLive
                                    ? 'text-amber-400'
                                    : isLight
                                    ? 'text-slate-500'
                                    : 'text-slate-400'
                                }`}
                              >
                                {formatLocalTime(prog.startMs)} –{' '}
                                {formatLocalTime(prog.stopMs)} · {prog.category}
                              </p>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div
          className={`px-4 py-3 border-t flex items-center justify-between text-xs ${
            isLight ? 'border-slate-200' : 'border-slate-800/80'
          }`}
        >
          <span className="font-mono tabular-nums">
            Page {safePage + 1} sur {totalPages} ({channels.length} chaînes
            Cinéma/Séries)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="min-h-[40px] px-3 py-1.5 rounded-xl font-medium disabled:opacity-40 bg-slate-800/70 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Précédent
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="min-h-[40px] px-3 py-1.5 rounded-xl font-medium disabled:opacity-40 bg-slate-800/70 text-slate-200 hover:bg-slate-700 transition-colors"
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
