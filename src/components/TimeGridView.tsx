import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Film,
  Globe,
  Heart,
  Radio,
  RotateCcw,
  Satellite,
  Sparkles,
  Subtitles,
  Trophy,
  Tv,
  Volume2,
} from 'lucide-react';
import {
  AppLanguage,
  BouquetFilter,
  ChannelGroup,
  ContentCategoryFilter,
  CountryCode,
  EpgChannel,
  EpgProgramme,
  SatelliteFilter,
} from '../types/epg';
import {
  APP_TIMEZONE_LABEL,
  floorToHalfHourCasablanca,
  formatDayLabel,
  formatTimeShort,
  getCasablancaTimestampForHour,
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
  translateBouquetFilter,
  translateCategoryFilter,
  translateCountryFilter,
  translateDynamicGenre,
  translateSatelliteFilter,
  translateSubGenreGroup,
} from '../utils/i18n';

interface TimeGridViewProps {
  channels: EpgChannel[];
  programmesByChannel: Record<string, EpgProgramme[]>;
  nowMs: number;
  favorites: string[];
  onToggleFavorite: (channelId: string) => void;
  onSelectChannel: (channel: EpgChannel, programme?: EpgProgramme) => void;
  selectedCategory: ContentCategoryFilter;
  onSelectCategory: (category: ContentCategoryFilter) => void;
  selectedSatellite: SatelliteFilter;
  onSelectSatellite: (sat: SatelliteFilter) => void;
  selectedBouquet: BouquetFilter;
  onSelectBouquet: (bouquet: BouquetFilter) => void;
  selectedCountry: CountryCode;
  onSelectCountry: (country: CountryCode) => void;
  selectedGroup: ChannelGroup;
  onSelectGroup: (group: ChannelGroup) => void;
  categoryCounts: Record<ContentCategoryFilter, number>;
  satelliteCounts: Record<SatelliteFilter, number>;
  bouquetCounts: Record<BouquetFilter, number>;
  countryCounts: Record<CountryCode, number>;
  groupCounts: Record<ChannelGroup, number>;
  language?: AppLanguage;
}

const PIXELS_PER_MINUTE = 4.6;
const WINDOW_HOURS = 4;
const WINDOW_MINUTES = WINDOW_HOURS * 60;
const TOTAL_TIMELINE_WIDTH = WINDOW_MINUTES * PIXELS_PER_MINUTE;

const CATEGORY_OPTIONS: {
  code: ContentCategoryFilter;
  icon: 'all' | 'cinema' | 'sport' | 'doc';
}[] = [
  { code: 'Tous', icon: 'all' },
  { code: 'Films & Séries', icon: 'cinema' },
  { code: 'Sport / Football', icon: 'sport' },
  { code: 'Documentaires', icon: 'doc' },
];

const SATELLITE_OPTIONS: SatelliteFilter[] = [
  'Tous',
  'Nilesat 7°W',
  'Astra 19.2°E',
  'Hotbird 13°E',
  'Hispasat 30°W',
  'Eutelsat 16°E / Thor 0.8°W',
  'Star One D2 70°W',
  'Amazonas 61°W',
  'Intelsat 43.1°W & SES-6 40.5°W',
];

const BOUQUET_OPTIONS: BouquetFilter[] = [
  'Tous',
  'Nilesat OSN/MBC',
  'beIN / SSC (MENA)',
  'Astra Canal+',
  'Movistar+ / DAZN ES',
  'Sky DE / DAZN DE',
  'Sky Italia / DAZN IT',
  'Canal+ / Eleven / FilmBox',
  'HBO / Cinemax',
  'AXN / Warner / Sci-Fi',
  'DigitAlb / Total TV / Focus Sat',
  'Claro TV Brasil',
  'Vivo TV / Movistar LATAM',
  'DirecTV LATAM / Sky Brasil',
];

const COUNTRY_OPTIONS: {
  code: CountryCode;
  flag: string;
}[] = [
  { code: 'Tous', flag: '🛰️' },
  { code: 'AR', flag: '🇲🇦/🇦🇪' },
  { code: 'FR', flag: '🇫🇷' },
  { code: 'ES', flag: '🇪🇸' },
  { code: 'DE', flag: '🇩🇪' },
  { code: 'IT', flag: '🇮🇹' },
  { code: 'PL', flag: '🇵🇱' },
  { code: 'EU', flag: '🇪🇺' },
  { code: 'BR', flag: '🇧🇷' },
  { code: 'LATAM', flag: '🌎' },
];

const GROUP_OPTIONS: ChannelGroup[] = [
  'Toutes',
  'Sport / Football',
  'Documentaires',
  'Cinéma Premières',
  'Séries TV & US',
  'Action & Thriller',
  'Comédie & Famille',
  'Classiques & Culte',
];

const COUNTRY_FLAGS: Record<string, string> = {
  DE: '🇩🇪',
  ES: '🇪🇸',
  FR: '🇫🇷',
  IT: '🇮🇹',
  PL: '🇵🇱',
  AR: '🇲🇦/🇦🇪',
  EU: '🇪🇺',
  BR: '🇧🇷',
  LATAM: '🌎',
};

export const TimeGridView: React.FC<TimeGridViewProps> = ({
  channels,
  programmesByChannel,
  nowMs,
  favorites,
  onToggleFavorite,
  onSelectChannel,
  selectedCategory,
  onSelectCategory,
  selectedSatellite,
  onSelectSatellite,
  selectedBouquet,
  onSelectBouquet,
  selectedCountry,
  onSelectCountry,
  selectedGroup,
  onSelectGroup,
  categoryCounts,
  satelliteCounts,
  bouquetCounts,
  countryCounts,
  groupCounts,
  language,
}) => {
  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);

  const [windowStartMs, setWindowStartMs] = useState<number>(() =>
    floorToHalfHourCasablanca(nowMs - 30 * 60000)
  );
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const windowEndMs = windowStartMs + WINDOW_MINUTES * 60000;

  const timeSlots = useMemo(() => {
    const slots: number[] = [];
    const count = WINDOW_HOURS * 2;
    for (let i = 0; i < count; i++) {
      slots.push(windowStartMs + i * 30 * 60000);
    }
    return slots;
  }, [windowStartMs]);

  const nowOffsetPx = useMemo(() => {
    if (nowMs < windowStartMs || nowMs > windowEndMs) return null;
    return ((nowMs - windowStartMs) / 60000) * PIXELS_PER_MINUTE;
  }, [nowMs, windowStartMs, windowEndMs]);

  const shiftWindow = (hours: number) => {
    setWindowStartMs((prev) => prev + hours * 3600000);
  };

  const resetToNow = () => {
    setWindowStartMs(floorToHalfHourCasablanca(nowMs - 30 * 60000));
  };

  const jumpToPrimeTime = () => {
    setWindowStartMs(getCasablancaTimestampForHour(nowMs, 20, 30));
  };

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const visibleCategoryOptions = useMemo(
    () =>
      CATEGORY_OPTIONS.filter(
        (cat) => cat.code === 'Tous' || (categoryCounts[cat.code] ?? 0) > 0
      ),
    [categoryCounts]
  );

  const visibleSatelliteOptions = useMemo(
    () =>
      SATELLITE_OPTIONS.filter(
        (sat) => sat === 'Tous' || (satelliteCounts[sat] ?? 0) > 0
      ),
    [satelliteCounts]
  );

  const visibleBouquetOptions = useMemo(
    () =>
      BOUQUET_OPTIONS.filter(
        (bq) => bq === 'Tous' || (bouquetCounts[bq] ?? 0) > 0
      ),
    [bouquetCounts]
  );

  const visibleCountryOptions = useMemo(
    () =>
      COUNTRY_OPTIONS.filter(
        (c) => c.code === 'Tous' || (countryCounts[c.code] ?? 0) > 0
      ),
    [countryCounts]
  );

  const visibleGroupOptions = useMemo(
    () =>
      GROUP_OPTIONS.filter(
        (grp) => grp === 'Toutes' || (groupCounts[grp] ?? 0) > 0
      ),
    [groupCounts]
  );

  useEffect(() => {
    if (nowOffsetPx !== null && scrollContainerRef.current) {
      const targetScroll = Math.max(0, nowOffsetPx - 160);
      scrollContainerRef.current.scrollLeft = targetScroll;
    }
  }, []);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/95 overflow-hidden shadow-2xl">
      {/* Barre de Filtres Satellite / Bouquet / Genre dédiée à la Grille TV */}
      <div className="p-3 sm:p-4 bg-slate-950/90 border-b border-slate-800/90 space-y-2.5">
        {/* Ligne 0 : Catégories principales */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-slate-800/70">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-400 me-1 shrink-0">
            <Film className="w-3.5 h-3.5" />
            {tr.filterCatLabel}
          </span>
          {visibleCategoryOptions.map((cat) => {
            const active = selectedCategory === cat.code;
            const count = categoryCounts[cat.code] ?? 0;
            const label = translateCategoryFilter(cat.code, activeLang);
            return (
              <button
                key={cat.code}
                onClick={() => onSelectCategory(cat.code)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                  active
                    ? cat.code === 'Sport / Football'
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                      : cat.code === 'Documentaires'
                      ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                      : 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                    : 'bg-slate-900 text-slate-200 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                {cat.icon === 'sport' ? (
                  <Trophy
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-slate-950' : 'text-emerald-400'
                    }`}
                  />
                ) : cat.icon === 'cinema' ? (
                  <Film
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-slate-950' : 'text-amber-400'
                    }`}
                  />
                ) : cat.icon === 'doc' ? (
                  <Compass
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-slate-950' : 'text-cyan-400'
                    }`}
                  />
                ) : (
                  <Tv
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-slate-950' : 'text-indigo-400'
                    }`}
                  />
                )}
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    active
                      ? 'bg-slate-950/20 text-slate-950 font-extrabold'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Ligne 1 : Satellites + Zones */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {visibleSatelliteOptions.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-400 me-1 shrink-0">
                <Satellite className="w-3.5 h-3.5" />
                {tr.filterSatLabel}
              </span>
              {visibleSatelliteOptions.map((sat) => {
                const active = selectedSatellite === sat;
                const count = satelliteCounts[sat] ?? 0;
                const label = translateSatelliteFilter(sat, activeLang);
                return (
                  <button
                    key={sat}
                    onClick={() => onSelectSatellite(sat)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer border ${
                      active
                        ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`text-[10px] px-1.5 rounded-full ${
                        active
                          ? 'bg-slate-950/20 text-slate-950 font-extrabold'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Zones / Pays */}
          {visibleCountryOptions.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 me-1 shrink-0">
                <Globe className="w-3 h-3 text-indigo-400" />
                {tr.filterZoneLabel}
              </span>
              {visibleCountryOptions.map((c) => {
                const active = selectedCountry === c.code;
                const count = countryCounts[c.code] ?? 0;
                const label = translateCountryFilter(c.code, activeLang);
                return (
                  <button
                    key={c.code}
                    onClick={() => onSelectCountry(c.code)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer border ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-400 font-bold'
                        : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span>{label}</span>
                    <span
                      className={`text-[10px] px-1 rounded-full ${
                        active
                          ? 'bg-white/20 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Ligne 2 : Bouquets + Genres */}
        {(visibleBouquetOptions.length > 1 ||
          visibleGroupOptions.length > 1) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
            {visibleBouquetOptions.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 me-1 shrink-0">
                  {tr.filterBouquetLabel}
                </span>
                {visibleBouquetOptions.map((bq) => {
                  const active = selectedBouquet === bq;
                  const count = bouquetCounts[bq] ?? 0;
                  const label = translateBouquetFilter(bq, activeLang);
                  return (
                    <button
                      key={bq}
                      onClick={() => onSelectBouquet(bq)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer border ${
                        active
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                          : 'bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      <span>{label}</span>
                      <span
                        className={`text-[10px] px-1 rounded-full ${
                          active
                            ? 'bg-slate-950/20 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {visibleGroupOptions.length > 1 && (
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 me-1 shrink-0">
                  <Sparkles className="w-3 h-3" />
                  {tr.filterGenreLabel}
                </span>
                {visibleGroupOptions.map((grp) => {
                  const active = selectedGroup === grp;
                  const count = groupCounts[grp] ?? 0;
                  const label = translateSubGenreGroup(grp, activeLang);
                  return (
                    <button
                      key={grp}
                      onClick={() => onSelectGroup(grp)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer border ${
                        active
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                      }`}
                    >
                      <span>{label}</span>
                      <span className="text-[10px] text-slate-500">
                        ({count})
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Contrôles Temporels de la Grille */}
      <div className="p-3 sm:p-4 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700/70 text-xs font-semibold text-slate-200">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>{formatDayLabel(windowStartMs, activeLang)}</span>
            <span className="text-slate-500">·</span>
            <span className="font-mono text-amber-300">
              {formatTimeShort(windowStartMs)} – {formatTimeShort(windowEndMs)}
            </span>
            <span className="hidden md:inline-block ms-1 px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-mono">
              {APP_TIMEZONE_LABEL}
            </span>
          </div>

          <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-semibold text-emerald-300">
            <Volume2 className="w-3 h-3" />
            {channels.length} {tr.activeChannelsOnGrid}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => shiftWindow(-2)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            2h
          </button>

          <button
            onClick={resetToNow}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-xs font-semibold text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {tr.presetNow}
          </button>

          <button
            onClick={jumpToPrimeTime}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-xs font-semibold text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer"
          >
            <Radio className="w-3.5 h-3.5" />
            20h45
          </button>

          <button
            onClick={() => shiftWindow(2)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            2h
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* Corps de la Grille multi-colonnes (Forcé en LTR pour l'axe chronologique horizontal) */}
      <div dir="ltr" className="relative flex overflow-hidden max-h-[68vh]">
        {/* Colonne Fixe Gauche : Chaînes Satellite */}
        <div className="w-52 sm:w-64 shrink-0 border-r border-slate-800 bg-slate-950/95 z-20 overflow-y-hidden select-none">
          <div className="h-10 border-b border-slate-800 px-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950">
            <span>{tr.gridChannelHeader}</span>
            <span className="text-emerald-400 text-[10px]">
              {tr.gridVoSubHeader}
            </span>
          </div>

          <div className="divide-y divide-slate-800/70">
            {channels.map((ch) => {
              const isFav = favoriteSet.has(ch.id);
              const flag = COUNTRY_FLAGS[ch.country] || '🛰️';
              return (
                <div
                  key={ch.id}
                  onClick={() => onSelectChannel(ch)}
                  className="h-20 px-2.5 flex items-center justify-between gap-2 hover:bg-slate-900 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center p-1 shrink-0">
                      {ch.icon ? (
                        <img
                          src={ch.icon}
                          alt={ch.displayName}
                          className="max-w-full max-h-full object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <Tv className="w-4 h-4 text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-[10px]">{flag}</span>
                        <p className="text-xs font-bold text-slate-200 truncate group-hover:text-amber-300 transition-colors">
                          {ch.displayName}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-slate-800 text-amber-300 border border-slate-700 truncate">
                          {ch.orbitalPosition}
                        </span>
                        <span className="inline-flex items-center gap-0.5 text-[9px] text-cyan-300 font-medium">
                          <Subtitles className="w-2.5 h-2.5" />
                          SUB
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleFavorite(ch.id);
                    }}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer shrink-0 ${
                      isFav
                        ? 'text-rose-400'
                        : 'text-slate-600 hover:text-slate-300'
                    }`}
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${isFav ? 'fill-rose-500' : ''}`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Zone Scrollable Horizontale : Timeline & Programmes */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-x-auto overflow-y-auto relative"
        >
          <div
            style={{ width: `${TOTAL_TIMELINE_WIDTH}px` }}
            className="relative"
          >
            {/* En-tête gradué toutes les 30 minutes */}
            <div className="h-10 border-b border-slate-800 bg-slate-950/90 sticky top-0 z-10 flex">
              {timeSlots.map((slotMs) => (
                <div
                  key={slotMs}
                  style={{ width: `${30 * PIXELS_PER_MINUTE}px` }}
                  className="border-r border-slate-800/80 px-2.5 flex items-center text-xs font-mono font-semibold text-slate-300 shrink-0"
                >
                  {formatTimeShort(slotMs)}
                </div>
              ))}
            </div>

            {/* Marqueur vertical Temps Réel */}
            {nowOffsetPx !== null && (
              <div
                style={{ left: `${nowOffsetPx}px` }}
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-20 pointer-events-none shadow-[0_0_10px_rgba(251,191,36,0.9)]"
              >
                <div className="px-1.5 py-0.5 rounded bg-amber-400 text-slate-950 font-mono font-bold text-[9px] -translate-x-1/2 whitespace-nowrap shadow">
                  {formatTimeShort(nowMs)}
                </div>
              </div>
            )}

            {/* Lignes des programmes */}
            <div className="divide-y divide-slate-800/70">
              {channels.map((ch) => {
                const progs = (programmesByChannel[ch.id] || []).filter(
                  (p) => p.stopMs > windowStartMs && p.startMs < windowEndMs
                );

                return (
                  <div
                    key={ch.id}
                    className="h-20 relative bg-slate-900/40 hover:bg-slate-900/80 transition-colors"
                  >
                    {progs.map((prog) => {
                      const clampedStart = Math.max(
                        prog.startMs,
                        windowStartMs
                      );
                      const clampedStop = Math.min(prog.stopMs, windowEndMs);
                      const leftPx =
                        ((clampedStart - windowStartMs) / 60000) *
                        PIXELS_PER_MINUTE;
                      const widthPx = Math.max(
                        36,
                        ((clampedStop - clampedStart) / 60000) *
                          PIXELS_PER_MINUTE -
                          3
                      );
                      const isLive =
                        prog.startMs <= nowMs && prog.stopMs > nowMs;

                      const allowGridSE = isProgrammeSeriesOrDocumentary({
                        category: prog.category,
                        rawCategory: prog.rawCategory,
                        title: prog.originalTitle || prog.title,
                        subTitle: prog.subTitle,
                        channelCategory: ch.contentCategory,
                      });
                      const parsedGridSE = allowGridSE
                        ? parseSeasonAndEpisode(
                            prog.episodeNum,
                            prog.originalTitle || prog.title,
                            prog.subTitle
                          )
                        : {};
                      const formattedGridSE = allowGridSE
                        ? formatSeasonEpisodeCode(
                            parsedGridSE.season,
                            parsedGridSE.episode
                          )
                        : undefined;

                      return (
                        <div
                          key={prog.id}
                          onClick={() => onSelectChannel(ch, prog)}
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                          }}
                          className={`absolute top-1.5 bottom-1.5 rounded-xl px-2.5 py-1.5 border overflow-hidden cursor-pointer transition-all flex flex-col justify-between ${
                            isLive
                              ? 'bg-gradient-to-br from-amber-500/25 via-amber-500/10 to-slate-900 border-amber-500/60 shadow-md z-10'
                              : 'bg-slate-800/75 hover:bg-slate-800 border-slate-700/70 hover:border-slate-600'
                          }`}
                          title={`${
                            activeLang === 'fr'
                              ? translateEpgTextToFrenchSync(prog.title)
                              : prog.title
                          } (${formatTimeShort(prog.startMs)} - ${formatTimeShort(
                            prog.stopMs
                          )})`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              {isLive && (
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                              )}
                              <p className="text-xs font-bold text-white truncate">
                                {activeLang === 'fr'
                                  ? translateEpgTextToFrenchSync(prog.title)
                                  : prog.title}
                              </p>
                            </div>
                            {prog.subTitle && allowGridSE && widthPx > 130 && (
                              <p className="text-[10px] text-amber-300/90 truncate">
                                {activeLang === 'fr'
                                  ? translateEpgTextToFrenchSync(prog.subTitle)
                                  : prog.subTitle}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1 text-[10px] text-slate-400 font-mono">
                            <span className="truncate">
                              {formatTimeShort(prog.startMs)} -{' '}
                              {formatTimeShort(prog.stopMs)}
                            </span>
                            {formattedGridSE && widthPx > 140 ? (
                              <span className="px-1 py-0.2 rounded bg-indigo-500/20 text-indigo-300 text-[9px] font-sans font-bold truncate max-w-[65px]">
                                {formattedGridSE}
                              </span>
                            ) : (
                              prog.category &&
                              widthPx > 140 && (
                                <span className="px-1.5 py-0.2 rounded bg-slate-900/70 text-slate-300 text-[9px] font-sans truncate max-w-[90px]">
                                  {translateDynamicGenre(
                                    prog.category,
                                    activeLang
                                  )}
                                </span>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
