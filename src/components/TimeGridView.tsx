import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Baby,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Film,
  Heart,
  Music,
  Newspaper,
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
  translateDynamicGenre,
  translateSatelliteFilter,
  translateSubGenreGroup,
} from '../utils/i18n';
import {
  cleanXmltvChannelId,
  isPlaceholderProgrammeTitle,
} from '../utils/xmltvParser';
import {
  getBouquetsForSatellite,
  STRICT_SAT_FILTER_LIST,
} from '../services/storageService';

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
  selectedBouquetsList?: BouquetFilter[];
  ramWarningMessage?: string | null;
  selectedGroup: ChannelGroup;
  onSelectGroup: (group: ChannelGroup) => void;
  categoryCounts: Record<ContentCategoryFilter, number>;
  satelliteCounts: Record<SatelliteFilter, number>;
  bouquetCounts: Record<BouquetFilter, number>;
  groupCounts: Record<ChannelGroup, number>;
  allowedSatelliteOptions?: SatelliteFilter[];
  allowedBouquetOptions?: BouquetFilter[];
  allowedCategoryCodes?: ContentCategoryFilter[];
  allowedGroupOptions?: ChannelGroup[];
  language?: AppLanguage;
}

const PIXELS_PER_MINUTE = 4.6;
const WINDOW_HOURS = 4;
const WINDOW_MINUTES = WINDOW_HOURS * 60;
const TOTAL_TIMELINE_WIDTH = WINDOW_MINUTES * PIXELS_PER_MINUTE;

const CATEGORY_OPTIONS: {
  code: ContentCategoryFilter;
  icon: 'all' | 'cinema' | 'doc' | 'news' | 'kids' | 'music' | 'sport';
}[] = [
  { code: 'Tous', icon: 'all' },
  { code: 'Films & Séries', icon: 'cinema' },
  { code: 'Documentaires', icon: 'doc' },
  { code: 'Actualités / News', icon: 'news' },
  { code: 'Jeunesse / Enfants', icon: 'kids' },
  { code: 'Musique & Divertissement', icon: 'music' },
  { code: 'Sport / Football', icon: 'sport' },
];

const GROUP_OPTIONS: ChannelGroup[] = [
  'Tous',
  'Cinéma Premières',
  'Action & Thriller',
  'Séries TV & US',
  'Comédie & Famille',
  'Classiques & Culte',
  'Documentaires',
  'Actualités / News',
  'Jeunesse / Enfants',
  'Musique & Divertissement',
  'Sport / Football',
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
  selectedBouquetsList = [],
  ramWarningMessage,
  selectedGroup,
  onSelectGroup,
  categoryCounts,
  satelliteCounts,
  bouquetCounts,
  groupCounts,
  allowedSatelliteOptions,
  allowedBouquetOptions,
  allowedCategoryCodes,
  allowedGroupOptions,
  language,
}) => {
  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);

  const [windowStartMs, setWindowStartMs] = useState<number>(() =>
    floorToHalfHourCasablanca(nowMs - 30 * 60000)
  );
  const [activeTimeBtn, setActiveTimeBtn] = useState<
    'minus' | 'now' | 'prime' | 'plus'
  >('now');
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
    setActiveTimeBtn(hours < 0 ? 'minus' : 'plus');
  };

  const resetToNow = () => {
    setWindowStartMs(floorToHalfHourCasablanca(nowMs - 30 * 60000));
    setActiveTimeBtn('now');
  };

  const jumpToPrimeTime = () => {
    setWindowStartMs(getCasablancaTimestampForHour(nowMs, 20, 30));
    setActiveTimeBtn('prime');
  };

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

  const visibleCategoryOptions = useMemo(
    () =>
      CATEGORY_OPTIONS.filter((cat) => {
        if (
          allowedCategoryCodes &&
          !allowedCategoryCodes.includes(cat.code)
        ) {
          return false;
        }
        return (categoryCounts[cat.code] ?? 0) > 0;
      }),
    [allowedCategoryCodes, categoryCounts]
  );

  // Ne liste dans la barre SAT que les satellites activés dans Réglages et ayant > 0 chaîne
  const visibleSatelliteOptions = useMemo(
    () =>
      (allowedSatelliteOptions || STRICT_SAT_FILTER_LIST).filter(
        (sat) => (satelliteCounts[sat] ?? 0) > 0
      ),
    [allowedSatelliteOptions, satelliteCounts]
  );

  // Liaison dynamique stricte + masquage des bouquets avec compteur = 0
  const visibleBouquetOptions = useMemo(
    () =>
      (
        allowedBouquetOptions || getBouquetsForSatellite(selectedSatellite)
      ).filter((bq) => (bouquetCounts[bq] ?? 0) > 0),
    [allowedBouquetOptions, selectedSatellite, bouquetCounts]
  );

  // Masquage strict de tout genre dont le compteur = 0
  const visibleGroupOptions = useMemo(
    () =>
      (allowedGroupOptions || GROUP_OPTIONS).filter((grp) => {
        const count =
          (groupCounts[grp] ?? 0) ||
          (grp === 'Tous' ? (groupCounts['Toutes'] ?? 0) : 0);
        return count > 0;
      }),
    [allowedGroupOptions, groupCounts]
  );

  // Ne conserve sur la Grille TV que les chaînes ayant au moins un programme valide dans la fenêtre horaire
  const gridVisibleChannels = useMemo(
    () =>
      channels.filter((ch) => {
        const cleanId = cleanXmltvChannelId(ch.id);
        const list =
          programmesByChannel[cleanId] || programmesByChannel[ch.id] || [];
        return list.some(
          (p) =>
            p &&
            !isPlaceholderProgrammeTitle(p.title) &&
            p.stopMs > windowStartMs &&
            p.startMs < windowEndMs
        );
      }),
    [channels, programmesByChannel, windowStartMs, windowEndMs]
  );

  useEffect(() => {
    if (nowOffsetPx !== null && scrollContainerRef.current) {
      const targetScroll = Math.max(0, nowOffsetPx - 160);
      scrollContainerRef.current.scrollLeft = targetScroll;
    }
  }, []);

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/95 overflow-hidden shadow-2xl">
      {/* Barre de Filtres [CATÉGORIE] -> [SATELLITE / BOUQUET] -> [GENRE] dédiée à la Grille TV */}
      <div className="p-3 sm:p-4 bg-slate-950/90 border-b border-slate-800/90 space-y-2.5">
        {/* Ligne 1 : [CATÉGORIE] */}
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
                type="button"
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
                ) : cat.icon === 'news' ? (
                  <Newspaper
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-slate-950' : 'text-sky-400'
                    }`}
                  />
                ) : cat.icon === 'kids' ? (
                  <Baby
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-slate-950' : 'text-pink-400'
                    }`}
                  />
                ) : cat.icon === 'music' ? (
                  <Music
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-slate-950' : 'text-purple-400'
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

        {/* Ligne 2 : [SATELLITE / BOUQUET] */}
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
                    type="button"
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

          {visibleBouquetOptions.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 me-1 shrink-0">
                {tr.filterBouquetLabel}
              </span>
              {visibleBouquetOptions.map((bq) => {
                const active =
                  bq === 'Tous'
                    ? selectedBouquet === 'Tous' &&
                      selectedBouquetsList.length === 0
                    : selectedBouquet === bq ||
                      selectedBouquetsList.includes(bq);
                const count = bouquetCounts[bq] ?? 0;
                const label = translateBouquetFilter(bq, activeLang);
                return (
                  <button
                    key={bq}
                    type="button"
                    onClick={() => onSelectBouquet(bq)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 cursor-pointer border ${
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
        </div>

        {ramWarningMessage && (
          <div className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-bold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
            <span>{ramWarningMessage}</span>
          </div>
        )}

        {/* Ligne 3 : [GENRE] */}
        {visibleGroupOptions.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1 border-t border-slate-800/60 pb-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-amber-300 me-1 shrink-0">
              <Sparkles className="w-3 h-3" />
              {tr.filterGenreLabel}
            </span>
            {visibleGroupOptions.map((grp) => {
              const active =
                selectedGroup === grp ||
                (grp === 'Tous' && selectedGroup === 'Toutes');
              const count =
                (groupCounts[grp] ?? 0) ||
                (grp === 'Tous' ? (groupCounts['Toutes'] ?? 0) : 0);
              const label = translateSubGenreGroup(grp, activeLang);
              return (
                <button
                  key={grp}
                  type="button"
                  onClick={() => onSelectGroup(grp)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer border ${
                    active
                      ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[10px] px-1 rounded-full ${
                      active
                        ? 'bg-slate-950/20 text-slate-950 font-bold'
                        : 'text-slate-500'
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

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-semibold text-emerald-300">
            <Volume2 className="w-3 h-3" />
            {gridVisibleChannels.length} {tr.activeChannelsOnGrid}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => shiftWindow(-2)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              activeTimeBtn === 'minus'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            -2h
          </button>

          <button
            type="button"
            onClick={resetToNow}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              activeTimeBtn === 'now'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {tr.presetNow}
          </button>

          <button
            type="button"
            onClick={jumpToPrimeTime}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              activeTimeBtn === 'prime'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            {tr.presetPrime}
          </button>

          <button
            type="button"
            onClick={() => shiftWindow(2)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              activeTimeBtn === 'plus'
                ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
            }`}
          >
            +2h
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* Corps de la Grille multi-colonnes synchronisée verticalement et horizontalement */}
      <div
        dir="ltr"
        ref={scrollContainerRef}
        className="relative overflow-x-auto overflow-y-auto max-h-[68vh]"
      >
        <div
          style={{ minWidth: `calc(13rem + ${TOTAL_TIMELINE_WIDTH}px)` }}
          className="relative"
        >
          {/* En-tête collant : Colonne Chaînes + Axe temporel gradué toutes les 30 minutes */}
          <div className="sticky top-0 z-30 flex h-10 border-b border-slate-800 bg-slate-950">
            <div className="sticky left-0 z-40 w-52 sm:w-64 shrink-0 border-r border-slate-800 px-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-950 select-none">
              <span>{tr.gridChannelHeader}</span>
              <span className="text-emerald-400 text-[10px]">
                {tr.gridVoSubHeader}
              </span>
            </div>

            <div
              style={{ width: `${TOTAL_TIMELINE_WIDTH}px` }}
              className="relative flex shrink-0 bg-slate-950/95"
            >
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
          </div>

          {/* Lignes dynamiques des chaînes filtrées et de leurs programmes */}
          <div className="divide-y divide-slate-800/70">
            {gridVisibleChannels.map((ch) => {
              const isFav = favoriteSet.has(ch.id);
              const flag = COUNTRY_FLAGS[ch.country] || '🛰️';
              const cleanId = cleanXmltvChannelId(ch.id);
              const rawChannelProgs =
                programmesByChannel[cleanId] ||
                programmesByChannel[ch.id] ||
                [];
              const progs = rawChannelProgs.filter(
                (p) =>
                  p &&
                  !isPlaceholderProgrammeTitle(p.title) &&
                  p.stopMs > windowStartMs &&
                  p.startMs < windowEndMs
              );

              return (
                <div key={ch.id} className="flex h-20">
                  {/* Cellule Chaîne Collante à Gauche */}
                  <div
                    onClick={() => onSelectChannel(ch)}
                    className="sticky left-0 z-20 w-52 sm:w-64 shrink-0 border-r border-slate-800 bg-slate-950/95 px-2.5 flex items-center justify-between gap-2 hover:bg-slate-900 transition-colors cursor-pointer group select-none"
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
                      type="button"
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

                  {/* Cellule Timeline Programmes */}
                  <div
                    style={{ width: `${TOTAL_TIMELINE_WIDTH}px` }}
                    className="h-20 relative shrink-0 bg-slate-900/40 hover:bg-slate-900/80 transition-colors"
                  >
                    {/* Marqueur vertical Temps Réel */}
                    {nowOffsetPx !== null && (
                      <div
                        style={{ left: `${nowOffsetPx}px` }}
                        className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-15 pointer-events-none shadow-[0_0_10px_rgba(251,191,36,0.9)]"
                      />
                    )}

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
                          className={`absolute top-1.5 bottom-1.5 rounded-xl px-2.5 py-1.5 border overflow-hidden cursor-pointer flex flex-col justify-between ${
                            isLive
                              ? 'bg-slate-900 border-slate-700 border-l-4 border-amber-500 z-10'
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
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
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
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
