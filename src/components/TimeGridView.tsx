import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Baby,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Film,
  Globe,
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
  X,
} from 'lucide-react';
import {
  AppLanguage,
  BouquetFilter,
  ChannelCountryFilter,
  ChannelGroup,
  ContentCategoryFilter,
  EpgChannel,
  EpgProgramme,
  SatelliteFilter,
} from '../types/epg';
import {
  APP_TIMEZONE_LABEL,
  floorToHalfHourCasablanca,
  formatDateInputValue,
  formatDayLabel,
  formatTimeInputValue,
  formatTimeShort,
  getCasablancaTimestampForHour,
  parseDateInputWithCurrentTime,
  parseTimeInputWithCurrentDate,
} from '../utils/timeFormat';
import {
  formatSeasonEpisodeCode,
  isProgrammeSeriesOrDocumentary,
  parseSeasonAndEpisode,
  translateEpgTextToFrenchSync,
} from '../utils/metadataResolverCore';
import {
  CHANNEL_COUNTRY_FLAGS,
  getActiveLanguage,
  getTranslations,
  translateBouquetFilter,
  translateCategoryFilter,
  translateChannelCountryFilter,
  translateDynamicGenre,
  translateSatelliteFilter,
  translateSubGenreGroup,
} from '../utils/i18n';
import {
  cleanOfficialChannelName,
  cleanXmltvChannelId,
  ensureHttpsUrl,
  isPlaceholderProgrammeTitle,
  normalizeSingleOrbitalPosition,
} from '../utils/xmltvParser';
import {
  buildCleanFallbackLogoDataUri,
  getChannelLogoCandidates,
  resolveOfficialChannelLogoUrl,
} from '../utils/channelLogoResolver';
import {
  CHANNEL_COUNTRY_FILTER_OPTIONS,
  ensureSchedulesCoverTargetTime,
  getBouquetsForSatellite,
  getSingleSatelliteBadgeForChannel,
  STRICT_SAT_FILTER_LIST,
} from '../services/storageService';

interface TimeGridViewProps {
  channels: EpgChannel[];
  programmesByChannel: Record<string, EpgProgramme[]>;
  nowMs: number;
  realNowMs?: number;
  timeOffsetMinutes?: number;
  activeTimePreset?: 'minus' | 'now' | 'prime' | 'plus';
  liveSyncCount?: number;
  onShiftTimeOffset?: (deltaMinutes: number) => void;
  onResetToLive?: () => void;
  onJumpToPrimeTime?: () => void;
  onSelectDateTime?: (targetMs: number) => void;
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
  selectedCountry?: ChannelCountryFilter;
  onSelectCountry?: (country: ChannelCountryFilter) => void;
  selectedGroup: ChannelGroup;
  onSelectGroup: (group: ChannelGroup) => void;
  categoryCounts: Record<ContentCategoryFilter, number>;
  satelliteCounts: Record<SatelliteFilter, number>;
  bouquetCounts: Record<BouquetFilter, number>;
  countryCounts?: Record<ChannelCountryFilter, number>;
  groupCounts: Record<ChannelGroup, number>;
  allowedSatelliteOptions?: SatelliteFilter[];
  allowedBouquetOptions?: BouquetFilter[];
  allowedCountryOptions?: ChannelCountryFilter[];
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
  realNowMs,
  timeOffsetMinutes = 0,
  activeTimePreset = 'now',
  liveSyncCount = 0,
  onShiftTimeOffset,
  onResetToLive,
  onJumpToPrimeTime,
  onSelectDateTime,
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
  selectedCountry = 'Tous',
  onSelectCountry,
  selectedGroup,
  onSelectGroup,
  categoryCounts,
  satelliteCounts,
  bouquetCounts,
  countryCounts = {} as Record<ChannelCountryFilter, number>,
  groupCounts,
  allowedSatelliteOptions,
  allowedBouquetOptions,
  allowedCountryOptions,
  allowedCategoryCodes,
  allowedGroupOptions,
  language,
}) => {
  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);
  const baseRealNowMs = realNowMs ?? nowMs;

  const [windowStartMs, setWindowStartMs] = useState<number>(() =>
    activeTimePreset === 'prime'
      ? getCasablancaTimestampForHour(nowMs, 20, 30)
      : floorToHalfHourCasablanca(nowMs - 30 * 60000)
  );
  const [activeTimeBtn, setActiveTimeBtn] = useState<
    'minus' | 'now' | 'prime' | 'plus'
  >(activeTimePreset);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Keep TimeGridView synchronized when parent time offset / preset or Sync to Live triggers
  useEffect(() => {
    if (activeTimePreset === 'prime') {
      setWindowStartMs(getCasablancaTimestampForHour(nowMs, 20, 30));
      setActiveTimeBtn('prime');
    } else {
      setWindowStartMs(floorToHalfHourCasablanca(nowMs - 30 * 60000));
      setActiveTimeBtn(activeTimePreset);
    }
  }, [nowMs, timeOffsetMinutes, activeTimePreset, liveSyncCount]);

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
    if (baseRealNowMs < windowStartMs || baseRealNowMs > windowEndMs) return null;
    return ((baseRealNowMs - windowStartMs) / 60000) * PIXELS_PER_MINUTE;
  }, [baseRealNowMs, windowStartMs, windowEndMs]);

  const shiftWindow = (hours: number) => {
    if (onShiftTimeOffset) {
      onShiftTimeOffset(hours * 60);
    } else {
      setWindowStartMs((prev) => prev + hours * 3600000);
      setActiveTimeBtn(hours < 0 ? 'minus' : 'plus');
    }
  };

  const resetToNow = () => {
    if (onResetToLive) {
      onResetToLive();
    } else {
      setWindowStartMs(floorToHalfHourCasablanca(baseRealNowMs - 30 * 60000));
      setActiveTimeBtn('now');
    }
  };

  const jumpToPrimeTime = () => {
    if (onJumpToPrimeTime) {
      onJumpToPrimeTime();
    } else {
      setWindowStartMs(getCasablancaTimestampForHour(nowMs, 20, 30));
      setActiveTimeBtn('prime');
    }
  };

  const handleDateInputChange = (dateValue: string) => {
    const parsedMs = parseDateInputWithCurrentTime(dateValue, nowMs);
    if (parsedMs === null) return;
    if (onSelectDateTime) {
      onSelectDateTime(parsedMs);
    } else {
      setWindowStartMs(floorToHalfHourCasablanca(parsedMs - 30 * 60000));
      setActiveTimeBtn(parsedMs < baseRealNowMs ? 'minus' : 'plus');
    }
  };

  const handleTimeInputChange = (timeValue: string) => {
    const parsedMs = parseTimeInputWithCurrentDate(timeValue, nowMs);
    if (parsedMs === null) return;
    if (onSelectDateTime) {
      onSelectDateTime(parsedMs);
    } else {
      setWindowStartMs(floorToHalfHourCasablanca(parsedMs - 30 * 60000));
      setActiveTimeBtn(parsedMs < baseRealNowMs ? 'minus' : 'plus');
    }
  };

  const favoriteSet = useMemo(() => {
    const s = new Set<string>();
    for (const f of favorites) {
      s.add(f);
      s.add(cleanXmltvChannelId(f));
    }
    return s;
  }, [favorites]);

  const visibleCountryOptions = useMemo(() => {
    if (allowedCountryOptions && allowedCountryOptions.length > 0) {
      return allowedCountryOptions;
    }
    return CHANNEL_COUNTRY_FILTER_OPTIONS.filter(
      (c) => c === 'Tous' || (countryCounts[c] ?? 0) > 0
    );
  }, [allowedCountryOptions, countryCounts]);

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

  // Garantit que la fenêtre horaire sélectionnée sur la Grille TV dispose de programmes pour toutes les chaînes
  const effectiveProgrammesByChannel = useMemo(
    () =>
      ensureSchedulesCoverTargetTime(
        channels,
        programmesByChannel,
        windowStartMs + 30 * 60000
      ),
    [channels, programmesByChannel, windowStartMs]
  );

  // Ne conserve sur la Grille TV que les chaînes ayant au moins un programme valide dans la fenêtre horaire
  const gridVisibleChannels = useMemo(
    () =>
      channels.filter((ch) => {
        const cleanId = cleanXmltvChannelId(ch.id);
        const list =
          effectiveProgrammesByChannel[cleanId] ||
          effectiveProgrammesByChannel[ch.id] ||
          [];
        return list.some(
          (p) =>
            p &&
            !isPlaceholderProgrammeTitle(p.title) &&
            p.stopMs > windowStartMs &&
            p.startMs < windowEndMs
        );
      }),
    [channels, effectiveProgrammesByChannel, windowStartMs, windowEndMs]
  );

  useEffect(() => {
    if (nowOffsetPx !== null && scrollContainerRef.current) {
      const targetScroll = Math.max(0, nowOffsetPx - 160);
      scrollContainerRef.current.scrollLeft = targetScroll;
    }
  }, [liveSyncCount]);

  const handleGridKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (
      e.key === 'ArrowRight' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowUp'
    ) {
      const focusables = Array.from(
        container.querySelectorAll<HTMLElement>('[data-grid-focusable="true"]')
      );
      const current = document.activeElement as HTMLElement | null;
      const currentRect = current?.getBoundingClientRect();

      if (current && container.contains(current) && currentRect) {
        const cx = currentRect.left + currentRect.width / 2;
        const cy = currentRect.top + currentRect.height / 2;

        let bestCandidate: HTMLElement | null = null;
        let bestScore = Infinity;

        for (const el of focusables) {
          if (el === current) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          const ex = r.left + r.width / 2;
          const ey = r.top + r.height / 2;
          const dx = ex - cx;
          const dy = ey - cy;

          if (e.key === 'ArrowRight' && dx > 8 && Math.abs(dy) < 44) {
            const score = dx + Math.abs(dy) * 3;
            if (score < bestScore) {
              bestScore = score;
              bestCandidate = el;
            }
          } else if (e.key === 'ArrowLeft' && dx < -8 && Math.abs(dy) < 44) {
            const score = Math.abs(dx) + Math.abs(dy) * 3;
            if (score < bestScore) {
              bestScore = score;
              bestCandidate = el;
            }
          } else if (e.key === 'ArrowDown' && dy > 20) {
            const score = dy * 2 + Math.abs(dx) * 0.6;
            if (score < bestScore) {
              bestScore = score;
              bestCandidate = el;
            }
          } else if (e.key === 'ArrowUp' && dy < -20) {
            const score = Math.abs(dy) * 2 + Math.abs(dx) * 0.6;
            if (score < bestScore) {
              bestScore = score;
              bestCandidate = el;
            }
          }
        }

        if (bestCandidate) {
          e.preventDefault();
          e.stopPropagation();
          bestCandidate.focus({ preventScroll: true });
          bestCandidate.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
            inline: 'center',
          });
          return;
        }
      }

      // Défilement fluide direct de la Grille TV avec les flèches directionnelles
      const stepX = 260;
      const stepY = 120;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        container.scrollBy({ left: stepX, behavior: 'smooth' });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        container.scrollBy({ left: -stepX, behavior: 'smooth' });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        container.scrollBy({ top: stepY, behavior: 'smooth' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        container.scrollBy({ top: -stepY, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="rounded-lg border border-[#1E2638] bg-[#0B0F17] overflow-hidden shadow-2xl">
      {/* Barre de Filtres [CATÉGORIE] -> [SATELLITE / BOUQUET] -> [GENRE] dédiée à la Grille TV */}
      <div className="p-3 sm:p-4 bg-[#131927] border-b border-[#1E2638] space-y-2.5">
        {/* Ligne 1 : [CATÉGORIE] */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 border-b border-[#1E2638]">
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] me-1 shrink-0">
            <Film className="w-3.5 h-3.5 text-[#94A3B8]" />
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
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all shrink-0 cursor-pointer ${
                  active
                    ? 'bg-[#1E293B] border-[1.5px] border-[#3B82F6] text-white font-bold'
                    : 'bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-[#94A3B8] hover:text-white hover:border-[#3B82F6]/40 font-medium'
                }`}
              >
                {cat.icon === 'sport' ? (
                  <Trophy
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#3B82F6]' : 'text-[#94A3B8]'
                    }`}
                  />
                ) : cat.icon === 'cinema' ? (
                  <Film
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#3B82F6]' : 'text-[#94A3B8]'
                    }`}
                  />
                ) : cat.icon === 'doc' ? (
                  <Compass
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#3B82F6]' : 'text-[#94A3B8]'
                    }`}
                  />
                ) : cat.icon === 'news' ? (
                  <Newspaper
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#3B82F6]' : 'text-[#94A3B8]'
                    }`}
                  />
                ) : cat.icon === 'kids' ? (
                  <Baby
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#3B82F6]' : 'text-[#94A3B8]'
                    }`}
                  />
                ) : cat.icon === 'music' ? (
                  <Music
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#3B82F6]' : 'text-[#94A3B8]'
                    }`}
                  />
                ) : (
                  <Tv
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#3B82F6]' : 'text-[#94A3B8]'
                    }`}
                  />
                )}
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    active
                      ? 'bg-[#0B0F17] text-white border border-[#3B82F6]/40 font-bold'
                      : 'bg-[#0B0F17]/60 text-[#94A3B8]'
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
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] me-1 shrink-0">
                <Satellite className="w-3.5 h-3.5 text-[#94A3B8]" />
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
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#1E293B] border-[1.5px] border-[#3B82F6] text-white font-bold'
                        : 'bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-[#94A3B8] hover:text-white hover:border-[#3B82F6]/40 font-medium'
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`text-[10px] px-1.5 rounded font-mono ${
                        active
                          ? 'bg-[#0B0F17] text-white border border-[#3B82F6]/40 font-bold'
                          : 'bg-[#0B0F17]/60 text-[#94A3B8]'
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
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] me-1 shrink-0">
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
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-all shrink-0 cursor-pointer ${
                      active
                        ? 'bg-[#1E293B] border-[1.5px] border-[#3B82F6] text-white font-bold'
                        : 'bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-[#94A3B8] hover:text-white hover:border-[#3B82F6]/40 font-medium'
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`text-[10px] px-1 rounded font-mono ${
                        active
                          ? 'bg-[#0B0F17] text-white border border-[#3B82F6]/40 font-bold'
                          : 'bg-[#0B0F17]/60 text-[#94A3B8]'
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
          <div className="px-3 py-2 rounded-lg bg-[#1E293B] border border-[#3B82F6]/50 text-white text-xs font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3B82F6] shrink-0" />
            <span>{ramWarningMessage}</span>
          </div>
        )}

        {/* Ligne 2.5 : [COUNTRY] (Menu déroulant compact sur Mobile / Puces sélectionnables au Pad/Télécommande sur Tablette & TV) */}
        {onSelectCountry && visibleCountryOptions.length > 1 && (
          <div className="pt-1 border-t border-[#1E2638]">
            {/* Mobile : Menu déroulant compact */}
            <div className="flex md:hidden items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] shrink-0">
                <Globe className="w-3.5 h-3.5 text-[#94A3B8]" />
                {tr.filterCountryLabel || tr.filterZoneLabel}
              </span>
              <div className="flex items-center gap-1.5 flex-1 max-w-[260px]">
                <select
                  value={selectedCountry}
                  onChange={(e) =>
                    onSelectCountry(e.target.value as ChannelCountryFilter)
                  }
                  aria-label={tr.filterCountryLabel || tr.filterZoneLabel}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B0F17] border border-[#2A324B] text-xs font-medium text-white focus:outline-none focus:border-[#3B82F6] transition-colors cursor-pointer"
                >
                  {visibleCountryOptions.map((cCode) => {
                    const count = countryCounts[cCode] ?? 0;
                    const label = translateChannelCountryFilter(
                      cCode,
                      activeLang
                    );
                    const flag = CHANNEL_COUNTRY_FLAGS[cCode] || '🌍';
                    return (
                      <option
                        key={cCode}
                        value={cCode}
                        className="bg-[#131927] text-white"
                      >
                        {flag} {label} ({count})
                      </option>
                    );
                  })}
                </select>
                {selectedCountry !== 'Tous' && (
                  <button
                    type="button"
                    onClick={() => onSelectCountry('Tous')}
                    className="p-1.5 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-[#94A3B8] hover:text-white shrink-0 cursor-pointer"
                    title={tr.resetFiltersBtn}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tablette & TV : Puces (chips) sélectionnables au pad/télécommande */}
            <div className="hidden md:flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] me-1 shrink-0">
                <Globe className="w-3.5 h-3.5 text-[#94A3B8]" />
                {tr.filterCountryLabel || tr.filterZoneLabel}
              </span>
              {visibleCountryOptions.map((cCode) => {
                const active = selectedCountry === cCode;
                const count = countryCounts[cCode] ?? 0;
                const label = translateChannelCountryFilter(cCode, activeLang);
                const flag = CHANNEL_COUNTRY_FLAGS[cCode] || '🌍';
                return (
                  <button
                    key={cCode}
                    type="button"
                    onClick={() => onSelectCountry(cCode)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] ${
                      active
                        ? 'bg-[#1E293B] border-[1.5px] border-[#3B82F6] text-white font-bold'
                        : 'bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-[#94A3B8] hover:text-white hover:border-[#3B82F6]/40 font-medium'
                    }`}
                  >
                    <span>{flag}</span>
                    <span>{label}</span>
                    <span
                      className={`text-[10px] px-1 rounded font-mono ${
                        active
                          ? 'bg-[#0B0F17] text-white border border-[#3B82F6]/40 font-bold'
                          : 'bg-[#0B0F17]/60 text-[#94A3B8]'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Ligne 3 : [GENRE] */}
        {visibleGroupOptions.length > 1 && (
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1 border-t border-[#1E2638] pb-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] me-1 shrink-0">
              <Sparkles className="w-3 h-3 text-[#94A3B8]" />
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
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-all shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#1E293B] border-[1.5px] border-[#3B82F6] text-white font-bold'
                      : 'bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-[#94A3B8] hover:text-white hover:border-[#3B82F6]/40 font-medium'
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[10px] px-1 rounded font-mono ${
                      active
                        ? 'bg-[#0B0F17] text-white border border-[#3B82F6]/40 font-bold'
                        : 'bg-[#0B0F17]/60 text-[#94A3B8]'
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
      <div className="p-3 sm:p-4 bg-[#131927] border-b border-[#1E2638] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-xs font-semibold text-white">
            <Clock className="w-3.5 h-3.5 text-[#94A3B8]" />
            <span>{formatDayLabel(windowStartMs, activeLang)}</span>
            <span className="text-[#94A3B8]">·</span>
            <span className="font-mono text-[#94A3B8]">
              {formatTimeShort(windowStartMs)} – {formatTimeShort(windowEndMs)}
            </span>
            <span className="hidden md:inline-block ms-1 px-1.5 py-0.2 rounded bg-[#0B0F17] text-[#94A3B8] border border-[#1E2638] text-[10px] font-mono">
              {APP_TIMEZONE_LABEL}
            </span>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-[11px] font-medium text-[#94A3B8]">
            <Volume2 className="w-3 h-3 text-[#94A3B8]" />
            {gridVisibleChannels.length} {tr.activeChannelsOnGrid}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="date"
            value={formatDateInputValue(windowStartMs + 30 * 60000)}
            onChange={(e) => handleDateInputChange(e.target.value)}
            aria-label={
              activeLang === 'fr' ? 'Sélecteur de date' : 'Date selector'
            }
            className="px-2.5 py-1.5 rounded-lg bg-[#0B0F17] border border-[#2A324B] text-xs font-mono text-white focus:outline-none focus:border-[#3B82F6] transition-colors cursor-pointer shrink-0"
          />

          <input
            type="time"
            value={formatTimeInputValue(windowStartMs + 30 * 60000)}
            onChange={(e) => handleTimeInputChange(e.target.value)}
            aria-label={
              activeLang === 'fr' ? "Sélecteur d'heure" : 'Time selector'
            }
            className="px-2.5 py-1.5 rounded-lg bg-[#0B0F17] border border-[#2A324B] text-xs font-mono text-white focus:outline-none focus:border-[#3B82F6] transition-colors cursor-pointer shrink-0"
          />

          <button
            type="button"
            onClick={() => shiftWindow(-2)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              activeTimeBtn === 'minus'
                ? 'bg-[#1E293B] border-[1.5px] border-[#3B82F6] text-white font-bold'
                : 'bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-[#94A3B8] hover:text-white font-medium'
            }`}
          >
            <ChevronLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            -2h
          </button>

          <button
            type="button"
            onClick={resetToNow}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              activeTimeBtn === 'now'
                ? 'bg-[#1E293B] border-[1.5px] border-[#3B82F6] text-white font-bold'
                : 'bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-[#94A3B8] hover:text-white font-medium'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981] shrink-0" />
            {tr.presetNow}
          </button>

          <button
            type="button"
            onClick={jumpToPrimeTime}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              activeTimeBtn === 'prime'
                ? 'bg-[#1E293B] border-[1.5px] border-[#3B82F6] text-white font-bold'
                : 'bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-[#94A3B8] hover:text-white font-medium'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            {tr.presetPrime}
          </button>

          <button
            type="button"
            onClick={() => shiftWindow(2)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              activeTimeBtn === 'plus'
                ? 'bg-[#1E293B] border-[1.5px] border-[#3B82F6] text-white font-bold'
                : 'bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-[#94A3B8] hover:text-white font-medium'
            }`}
          >
            +2h
            <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
          </button>
        </div>
      </div>

      {/* Corps de la Grille multi-colonnes synchronisée verticalement et horizontalement (Navigation D-Pad TV fluide) */}
      <div
        dir="ltr"
        ref={scrollContainerRef}
        tabIndex={0}
        onKeyDown={handleGridKeyDown}
        aria-label="TV Programme Grid"
        className="relative overflow-x-auto overflow-y-auto max-h-[70vh] 2xl:max-h-[74vh] focus:outline-none"
      >
        <div
          style={{ minWidth: `calc(13rem + ${TOTAL_TIMELINE_WIDTH}px)` }}
          className="relative"
        >
          {/* En-tête collant : Colonne Chaînes + Axe temporel gradué toutes les 30 minutes */}
          <div className="sticky top-0 z-30 flex h-10 border-b border-[#1E2638] bg-[#0B0F17]">
            <div className="sticky left-0 z-40 w-52 sm:w-64 shrink-0 border-r border-[#1E2638] px-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] bg-[#0B0F17] select-none">
              <span>{tr.gridChannelHeader}</span>
              <span className="text-[#94A3B8] text-[10px]">
                {tr.gridVoSubHeader}
              </span>
            </div>

            <div
              style={{ width: `${TOTAL_TIMELINE_WIDTH}px` }}
              className="relative flex shrink-0 bg-[#0B0F17]/95"
            >
              {timeSlots.map((slotMs) => (
                <div
                  key={slotMs}
                  style={{ width: `${30 * PIXELS_PER_MINUTE}px` }}
                  className="border-r border-[#1E2638] px-2.5 flex items-center text-xs font-mono font-semibold text-[#94A3B8] shrink-0"
                >
                  {formatTimeShort(slotMs)}
                </div>
              ))}
            </div>
          </div>

          {/* Lignes dynamiques des chaînes filtrées et de leurs programmes */}
          <div className="divide-y divide-[#1E2638]">
            {gridVisibleChannels.map((ch) => {
              const isFav = favoriteSet.has(ch.id);
              const flag = COUNTRY_FLAGS[ch.country] || '🛰️';
              const cleanId = cleanXmltvChannelId(ch.id);
              const rawChannelProgs =
                effectiveProgrammesByChannel[cleanId] ||
                effectiveProgrammesByChannel[ch.id] ||
                [];
              const progs = rawChannelProgs.filter(
                (p) =>
                  p &&
                  !isPlaceholderProgrammeTitle(p.title) &&
                  p.stopMs > windowStartMs &&
                  p.startMs < windowEndMs
              );

              return (
                <div key={ch.id} className="flex h-20 2xl:h-24">
                  {/* Cellule Chaîne Collante à Gauche */}
                  <div
                    tabIndex={0}
                    role="button"
                    data-grid-focusable="true"
                    onClick={() => onSelectChannel(ch)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectChannel(ch);
                      }
                    }}
                    className="tv-focusable sticky left-0 z-20 w-52 sm:w-64 shrink-0 border-r border-[#1E2638] bg-[#0B0F17] px-2.5 flex items-center justify-between gap-2 hover:bg-[#131927] transition-colors cursor-pointer group select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#131927] border border-[#1E2638] flex items-center justify-center p-1 shrink-0">
                        <img
                          src={
                            ensureHttpsUrl(
                              (
                                ch.icon ||
                                resolveOfficialChannelLogoUrl(
                                  ch.id,
                                  ch.displayName
                                )
                              ).replace(/^http:\/\//i, 'https://')
                            ) ||
                            buildCleanFallbackLogoDataUri(ch.displayName, ch.id)
                          }
                          alt={ch.displayName}
                          className="max-w-full max-h-full object-contain"
                          loading="lazy"
                          onError={(e) => {
                            const candidates = getChannelLogoCandidates(
                              ch.id,
                              ch.displayName,
                              ch.icon
                            );
                            const currentSrc = e.currentTarget.src;
                            const idx = candidates.indexOf(currentSrc);
                            const nextSrc =
                              idx !== -1 && idx + 1 < candidates.length
                                ? candidates[idx + 1]
                                : buildCleanFallbackLogoDataUri(
                                    ch.displayName,
                                    ch.id
                                  );
                            if (currentSrc !== nextSrc) {
                              e.currentTarget.src = nextSrc;
                            }
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px]">{flag}</span>
                          <p className="text-xs font-bold text-white truncate">
                            {cleanOfficialChannelName(ch.displayName)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] font-medium px-1 py-0.2 rounded bg-[rgba(255,255,255,0.03)] text-[#94A3B8] border border-[#1E2638] truncate">
                            {getSingleSatelliteBadgeForChannel(
                              ch,
                              selectedSatellite
                            )}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-[#94A3B8] font-medium">
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
                          ? 'text-[#3B82F6]'
                          : 'text-[#94A3B8] hover:text-white'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${isFav ? 'fill-[#3B82F6]' : ''}`}
                      />
                    </button>
                  </div>

                  {/* Cellule Timeline Programmes */}
                  <div
                    style={{ width: `${TOTAL_TIMELINE_WIDTH}px` }}
                    className="h-20 2xl:h-24 relative shrink-0 bg-[#0B0F17]"
                  >
                    {/* Marqueur vertical Temps Réel */}
                    {nowOffsetPx !== null && (
                      <div
                        style={{ left: `${nowOffsetPx}px` }}
                        className="absolute top-0 bottom-0 w-px bg-[#3B82F6]/70 z-15 pointer-events-none"
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
                          tabIndex={0}
                          role="button"
                          data-grid-focusable="true"
                          onClick={() => onSelectChannel(ch, prog)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onSelectChannel(ch, prog);
                            }
                          }}
                          style={{
                            left: `${leftPx}px`,
                            width: `${widthPx}px`,
                          }}
                          className={`tv-focusable absolute top-1 bottom-1 rounded-lg px-2.5 py-1.5 border overflow-hidden cursor-pointer flex flex-col justify-between transition-all ${
                            isLive
                              ? 'bg-[#161E31] border-[#2A324B] z-10'
                              : 'bg-[#131927] hover:bg-[#171F30] border-[#1E2638] hover:border-[#3B82F6]/50'
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
                                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981] shrink-0" />
                              )}
                              <p className="text-xs font-bold text-white truncate">
                                {activeLang === 'fr'
                                  ? translateEpgTextToFrenchSync(prog.title)
                                  : prog.title}
                              </p>
                            </div>
                            {prog.subTitle && allowGridSE && widthPx > 130 && (
                              <p className="text-[10px] text-[#94A3B8] truncate">
                                {activeLang === 'fr'
                                  ? translateEpgTextToFrenchSync(prog.subTitle)
                                  : prog.subTitle}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1 text-[10px] text-[#94A3B8] font-mono">
                            <span className="truncate">
                              {formatTimeShort(prog.startMs)} -{' '}
                              {formatTimeShort(prog.stopMs)}
                            </span>
                            {formattedGridSE && widthPx > 140 ? (
                              <span className="px-1 py-0.2 rounded bg-[rgba(255,255,255,0.03)] text-[#94A3B8] border border-[#1E2638] text-[9px] font-sans font-medium truncate max-w-[65px]">
                                {formattedGridSE}
                              </span>
                            ) : (
                              prog.category &&
                              widthPx > 140 && (
                                <span className="px-1.5 py-0.2 rounded bg-[rgba(255,255,255,0.03)] text-[#94A3B8] border border-[#1E2638] text-[9px] font-sans truncate max-w-[90px]">
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
