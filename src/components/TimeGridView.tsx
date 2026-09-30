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

  const scrollGridElementIntoView = (el: HTMLElement) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const colAttr = el.getAttribute('data-grid-col');
    if (colAttr === 'channel') {
      container.scrollTo({
        left: 0,
        behavior: 'smooth',
      });
    } else {
      const leftPx = Number(el.getAttribute('data-left-px') || '0');
      const widthPx = Number(el.getAttribute('data-width-px') || '120');
      const stickyColWidth = window.innerWidth >= 640 ? 256 : 208;
      const visibleTimelineWidth = Math.max(
        200,
        container.clientWidth - stickyColWidth
      );
      const targetLeft = Math.max(
        0,
        leftPx - visibleTimelineWidth / 2 + Math.min(widthPx, visibleTimelineWidth) / 2
      );
      container.scrollTo({
        left: targetLeft,
        behavior: 'smooth',
      });
    }

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const stickyHeaderHeight = 44;
    if (elRect.top < containerRect.top + stickyHeaderHeight) {
      container.scrollBy({
        top: elRect.top - (containerRect.top + stickyHeaderHeight) - 12,
        behavior: 'smooth',
      });
    } else if (elRect.bottom > containerRect.bottom - 12) {
      container.scrollBy({
        top: elRect.bottom - containerRect.bottom + 16,
        behavior: 'smooth',
      });
    }
  };

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

      if (
        current &&
        container.contains(current) &&
        current.getAttribute('data-grid-focusable') === 'true'
      ) {
        const currentRow = Number(current.getAttribute('data-grid-row') || '0');
        const currentCol = current.getAttribute('data-grid-col') || 'channel';
        const currentStartMs = Number(
          current.getAttribute('data-start-ms') || String(nowMs)
        );
        const currentStopMs = Number(
          current.getAttribute('data-stop-ms') || String(nowMs + 1800000)
        );
        const currentMidMs =
          Math.max(currentStartMs, windowStartMs) +
          (Math.min(currentStopMs, windowEndMs) -
            Math.max(currentStartMs, windowStartMs)) /
            2;

        const rowElements = focusables.filter(
          (el) => Number(el.getAttribute('data-grid-row') || '-1') === currentRow
        );
        const rowProgs = rowElements
          .filter((el) => el.getAttribute('data-grid-col') !== 'channel')
          .sort(
            (a, b) =>
              Number(a.getAttribute('data-grid-col') || '0') -
              Number(b.getAttribute('data-grid-col') || '0')
          );
        const rowChannelEl =
          rowElements.find(
            (el) => el.getAttribute('data-grid-col') === 'channel'
          ) || null;

        let targetEl: HTMLElement | null = null;

        if (e.key === 'ArrowRight') {
          if (currentCol === 'channel') {
            // Focus first programme in current window (or live programme)
            targetEl =
              rowProgs.find((el) => {
                const s = Number(el.getAttribute('data-start-ms') || '0');
                const end = Number(el.getAttribute('data-stop-ms') || '0');
                return s <= nowMs && end > nowMs;
              }) ||
              rowProgs[0] ||
              null;
          } else {
            const colIdx = Number(currentCol);
            targetEl =
              rowProgs.find(
                (el) => Number(el.getAttribute('data-grid-col')) === colIdx + 1
              ) || null;
          }
        } else if (e.key === 'ArrowLeft') {
          if (currentCol !== 'channel') {
            const colIdx = Number(currentCol);
            if (colIdx > 0) {
              targetEl =
                rowProgs.find(
                  (el) =>
                    Number(el.getAttribute('data-grid-col')) === colIdx - 1
                ) || rowChannelEl;
            } else {
              targetEl = rowChannelEl;
            }
          }
        } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          const nextRow =
            e.key === 'ArrowDown' ? currentRow + 1 : currentRow - 1;
          if (nextRow < 0) {
            // Let global D-Pad handler move focus up to the Time Controls / Filters above the grid
            return;
          }
          const nextRowElements = focusables.filter(
            (el) => Number(el.getAttribute('data-grid-row') || '-1') === nextRow
          );
          if (nextRowElements.length > 0) {
            if (currentCol === 'channel') {
              targetEl =
                nextRowElements.find(
                  (el) => el.getAttribute('data-grid-col') === 'channel'
                ) || nextRowElements[0];
            } else {
              const nextRowProgs = nextRowElements.filter(
                (el) => el.getAttribute('data-grid-col') !== 'channel'
              );
              // Find programme in nextRow that overlaps currentMidMs or is closest in time
              let bestProg: HTMLElement | null = null;
              let bestTimeDist = Infinity;
              for (const el of nextRowProgs) {
                const s = Number(el.getAttribute('data-start-ms') || '0');
                const end = Number(el.getAttribute('data-stop-ms') || '0');
                if (s <= currentMidMs && end >= currentMidMs) {
                  bestProg = el;
                  break;
                }
                const mid = (s + end) / 2;
                const dist = Math.abs(mid - currentMidMs);
                if (dist < bestTimeDist) {
                  bestTimeDist = dist;
                  bestProg = el;
                }
              }
              targetEl = bestProg || nextRowElements[0];
            }
          }
        }

        if (targetEl) {
          e.preventDefault();
          e.stopPropagation();
          targetEl.focus({ preventScroll: true });
          scrollGridElementIntoView(targetEl);
          return;
        }
      } else if (focusables.length > 0 && e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        focusables[0].focus({ preventScroll: true });
        scrollGridElementIntoView(focusables[0]);
        return;
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
      }
    }
  };

  return (
    <div className="rounded-lg border border-[#1a202c] bg-[#0a0e17] overflow-hidden shadow-2xl">
      {/* Barre de Filtres [CATÉGORIE] -> [SATELLITE / BOUQUET] -> [GENRE] dédiée à la Grille TV */}
      <div className="p-3 sm:p-4 bg-[#141a26] border-b border-[#1a202c] space-y-2.5">
        {/* Ligne 1 : [CATÉGORIE] */}
        <div
          data-tv-row="grid-categories"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-0.5 border-b border-[#1a202c]"
        >
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] me-1 shrink-0">
            <Film className="w-3.5 h-3.5 text-[#e11d48]" />
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
                    ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                    : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#e11d48]/60 font-medium'
                }`}
              >
                {cat.icon === 'sport' ? (
                  <Trophy
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#ffffff]' : 'text-[#cbd5e1]'
                    }`}
                  />
                ) : cat.icon === 'cinema' ? (
                  <Film
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#ffffff]' : 'text-[#cbd5e1]'
                    }`}
                  />
                ) : cat.icon === 'doc' ? (
                  <Compass
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#ffffff]' : 'text-[#cbd5e1]'
                    }`}
                  />
                ) : cat.icon === 'news' ? (
                  <Newspaper
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#ffffff]' : 'text-[#cbd5e1]'
                    }`}
                  />
                ) : cat.icon === 'kids' ? (
                  <Baby
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#ffffff]' : 'text-[#cbd5e1]'
                    }`}
                  />
                ) : cat.icon === 'music' ? (
                  <Music
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#ffffff]' : 'text-[#cbd5e1]'
                    }`}
                  />
                ) : (
                  <Tv
                    className={`w-3.5 h-3.5 ${
                      active ? 'text-[#ffffff]' : 'text-[#cbd5e1]'
                    }`}
                  />
                )}
                <span>{label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                    active
                      ? 'bg-[#0a0e17]/80 text-[#ffffff] border border-[#ff0033]/50 font-bold'
                      : 'bg-[#141a26] text-[#cbd5e1]'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Ligne 2 : [SATELLITE / BOUQUET] (Bleu Royal Sky Sport #1d4ed8 / #0055ff) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {visibleSatelliteOptions.length > 1 && (
            <div
              data-tv-row="grid-satellites"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-0.5"
            >
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] me-1 shrink-0">
                <Satellite className="w-3.5 h-3.5 text-[#0055ff]" />
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
                        ? 'bg-[#1d4ed8] border-[1.5px] border-[#0055ff] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(0,85,255,0.45)]'
                        : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`text-[10px] px-1.5 rounded font-mono ${
                        active
                          ? 'bg-[#0a0e17]/80 text-[#ffffff] border border-[#0055ff]/50 font-bold'
                          : 'bg-[#141a26] text-[#cbd5e1]'
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
            <div
              data-tv-row="grid-bouquets"
              className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 px-0.5"
            >
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] me-1 shrink-0">
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
                        ? 'bg-[#1d4ed8] border-[1.5px] border-[#0055ff] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(0,85,255,0.45)]'
                        : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
                    }`}
                  >
                    <span>{label}</span>
                    <span
                      className={`text-[10px] px-1 rounded font-mono ${
                        active
                          ? 'bg-[#0a0e17]/80 text-[#ffffff] border border-[#0055ff]/50 font-bold'
                          : 'bg-[#141a26] text-[#cbd5e1]'
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
          <div className="px-3 py-2 rounded-lg bg-[#0a0e17] border border-[#0055ff]/50 text-[#ffffff] text-xs font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0055ff] shrink-0" />
            <span>{ramWarningMessage}</span>
          </div>
        )}

        {/* Ligne 2.5 : [COUNTRY] (Menu déroulant compact sur Mobile / Puces sélectionnables au Pad/Télécommande sur Tablette & TV) */}
        {onSelectCountry && visibleCountryOptions.length > 1 && (
          <div className="pt-1 border-t border-[#1a202c]">
            {/* Mobile : Menu déroulant compact */}
            <div className="flex md:hidden items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] shrink-0">
                <Globe className="w-3.5 h-3.5 text-[#0055ff]" />
                {tr.filterCountryLabel || tr.filterZoneLabel}
              </span>
              <div className="flex items-center gap-1.5 flex-1 max-w-[260px]">
                <select
                  value={selectedCountry}
                  onChange={(e) =>
                    onSelectCountry(e.target.value as ChannelCountryFilter)
                  }
                  aria-label={tr.filterCountryLabel || tr.filterZoneLabel}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-xs font-medium text-[#ffffff] focus:outline-none focus:border-[#0055ff] transition-colors cursor-pointer"
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
                        className="bg-[#141a26] text-[#ffffff]"
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
                    className="p-1.5 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] shrink-0 cursor-pointer"
                    title={tr.resetFiltersBtn}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Tablette & TV : Puces (chips) sélectionnables au pad/télécommande */}
            <div
              data-tv-row="grid-countries"
              className="hidden md:flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 px-0.5"
            >
              <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] me-1 shrink-0">
                <Globe className="w-3.5 h-3.5 text-[#0055ff]" />
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
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] transition-all shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0055ff] ${
                      active
                        ? 'bg-[#1d4ed8] border-[1.5px] border-[#0055ff] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(0,85,255,0.45)]'
                        : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
                    }`}
                  >
                    <span>{flag}</span>
                    <span>{label}</span>
                    <span
                      className={`text-[10px] px-1 rounded font-mono ${
                        active
                          ? 'bg-[#0a0e17]/80 text-[#ffffff] border border-[#0055ff]/50 font-bold'
                          : 'bg-[#141a26] text-[#cbd5e1]'
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
          <div
            data-tv-row="grid-genres"
            className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1.5 border-t border-[#1a202c] py-1 px-0.5"
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] me-1 shrink-0">
              <Sparkles className="w-3 h-3 text-[#e11d48]" />
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
                      ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                      : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#e11d48]/60 font-medium'
                  }`}
                >
                  <span>{label}</span>
                  <span
                    className={`text-[10px] px-1 rounded font-mono ${
                      active
                        ? 'bg-[#0a0e17]/80 text-[#ffffff] border border-[#ff0033]/50 font-bold'
                        : 'bg-[#141a26] text-[#cbd5e1]'
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
      <div className="p-3 sm:p-4 bg-[#141a26] border-b border-[#1a202c] flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-xs font-semibold text-[#ffffff]">
            <Clock className="w-3.5 h-3.5 text-[#cbd5e1]" />
            <span>{formatDayLabel(windowStartMs, activeLang)}</span>
            <span className="text-[#cbd5e1]">·</span>
            <span className="font-mono text-[#cbd5e1]">
              {formatTimeShort(windowStartMs)} – {formatTimeShort(windowEndMs)}
            </span>
            <span className="hidden md:inline-block ms-1 px-1.5 py-0.2 rounded bg-[#1d4ed8]/25 text-[#ffffff] border border-[#0055ff]/50 text-[10px] font-mono">
              {APP_TIMEZONE_LABEL}
            </span>
          </div>

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#1d4ed8]/20 border border-[#0055ff]/50 text-[11px] font-medium text-[#ffffff]">
            <Volume2 className="w-3 h-3 text-[#60a5fa]" />
            {gridVisibleChannels.length} {tr.activeChannelsOnGrid}
          </span>
        </div>

        <div
          data-tv-row="grid-time-controls"
          className="flex flex-wrap items-center gap-1.5"
        >
          <input
            type="date"
            value={formatDateInputValue(windowStartMs + 30 * 60000)}
            onChange={(e) => handleDateInputChange(e.target.value)}
            aria-label={
              activeLang === 'fr' ? 'Sélecteur de date' : 'Date selector'
            }
            className="px-2.5 py-1.5 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-xs font-mono text-[#ffffff] focus:outline-none focus:border-[#0055ff] transition-colors cursor-pointer shrink-0"
          />

          <input
            type="time"
            value={formatTimeInputValue(windowStartMs + 30 * 60000)}
            onChange={(e) => handleTimeInputChange(e.target.value)}
            aria-label={
              activeLang === 'fr' ? "Sélecteur d'heure" : 'Time selector'
            }
            className="px-2.5 py-1.5 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-xs font-mono text-[#ffffff] focus:outline-none focus:border-[#0055ff] transition-colors cursor-pointer shrink-0"
          />

          <button
            type="button"
            onClick={() => shiftWindow(-2)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              activeTimeBtn === 'minus'
                ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#e11d48]/60 font-medium'
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
                ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#e11d48]/60 font-medium'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                activeTimeBtn === 'now'
                  ? 'bg-[#ffffff] animate-pulse shadow-[0_0_6px_#ffffff]'
                  : 'bg-[#e11d48] shadow-[0_0_6px_#e11d48]'
              }`}
            />
            {tr.presetNow}
          </button>

          <button
            type="button"
            onClick={jumpToPrimeTime}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              activeTimeBtn === 'prime'
                ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#e11d48]/60 font-medium'
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
                ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#e11d48]/60 font-medium'
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
          <div className="sticky top-0 z-30 flex h-10 border-b border-[#1a202c] bg-[#0a0e17]">
            <div className="sticky left-0 z-40 w-52 sm:w-64 shrink-0 border-r border-[#1a202c] px-3 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] bg-[#0a0e17] select-none">
              <span>{tr.gridChannelHeader}</span>
              <span className="text-[#60a5fa] text-[10px]">
                {tr.gridVoSubHeader}
              </span>
            </div>

            <div
              style={{ width: `${TOTAL_TIMELINE_WIDTH}px` }}
              className="relative flex shrink-0 bg-[#0a0e17]/95"
            >
              {timeSlots.map((slotMs) => (
                <div
                  key={slotMs}
                  style={{ width: `${30 * PIXELS_PER_MINUTE}px` }}
                  className="border-r border-[#1a202c] px-2.5 flex items-center text-xs font-mono font-semibold text-[#cbd5e1] shrink-0"
                >
                  {formatTimeShort(slotMs)}
                </div>
              ))}
            </div>
          </div>

          {/* Lignes dynamiques des chaînes filtrées et de leurs programmes */}
          <div className="divide-y divide-[#1a202c]">
            {gridVisibleChannels.map((ch, rowIdx) => {
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
                    data-grid-row={rowIdx}
                    data-grid-col="channel"
                    onClick={() => onSelectChannel(ch)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' ||
                        e.key === ' ' ||
                        e.key === 'Select' ||
                        e.keyCode === 23 ||
                        e.keyCode === 66
                      ) {
                        e.preventDefault();
                        onSelectChannel(ch);
                      }
                    }}
                    className="tv-focusable sticky left-0 z-20 w-52 sm:w-64 shrink-0 border-r border-[#1a202c] bg-[#0a0e17] px-2.5 flex items-center justify-between gap-2 hover:bg-[#141a26] transition-colors cursor-pointer group select-none"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-[#141a26] border border-[#1a202c] flex items-center justify-center p-1 shrink-0">
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
                          <p className="text-xs font-bold text-[#ffffff] truncate">
                            {cleanOfficialChannelName(ch.displayName)}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 truncate">
                            {getSingleSatelliteBadgeForChannel(
                              ch,
                              selectedSatellite
                            )}
                          </span>
                          <span className="inline-flex items-center gap-0.5 text-[9px] text-[#60a5fa] font-semibold">
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
                          ? 'text-[#e11d48]'
                          : 'text-[#cbd5e1] hover:text-[#ffffff]'
                      }`}
                    >
                      <Heart
                        className={`w-3.5 h-3.5 ${isFav ? 'fill-[#e11d48]' : ''}`}
                      />
                    </button>
                  </div>

                  {/* Cellule Timeline Programmes */}
                  <div
                    style={{ width: `${TOTAL_TIMELINE_WIDTH}px` }}
                    className="h-20 2xl:h-24 relative shrink-0 bg-[#0a0e17]"
                  >
                    {/* Marqueur vertical Temps Réel (Rouge / Crimson Sky Sport) */}
                    {nowOffsetPx !== null && (
                      <div
                        style={{ left: `${nowOffsetPx}px` }}
                        className="absolute top-0 bottom-0 w-px bg-[#e11d48] shadow-[0_0_8px_#e11d48] z-15 pointer-events-none"
                      />
                    )}

                    {progs.map((prog, progIdx) => {
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
                          data-grid-row={rowIdx}
                          data-grid-col={progIdx}
                          data-start-ms={prog.startMs}
                          data-stop-ms={prog.stopMs}
                          data-left-px={Math.round(leftPx)}
                          data-width-px={Math.round(widthPx)}
                          onClick={() => onSelectChannel(ch, prog)}
                          onKeyDown={(e) => {
                            if (
                              e.key === 'Enter' ||
                              e.key === ' ' ||
                              e.key === 'Select' ||
                              e.keyCode === 23 ||
                              e.keyCode === 66
                            ) {
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
                              ? 'bg-[#141a26] border-[#e11d48] shadow-[0_0_10px_rgba(225,29,72,0.3)] z-10'
                              : 'bg-[#141a26] hover:bg-[#1a202c] border-[#1a202c] hover:border-[#0055ff]/60'
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
                                <span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse shadow-[0_0_6px_#e11d48] shrink-0" />
                              )}
                              <p className="text-xs font-bold text-[#ffffff] truncate">
                                {activeLang === 'fr'
                                  ? translateEpgTextToFrenchSync(prog.title)
                                  : prog.title}
                              </p>
                            </div>
                            {prog.subTitle && allowGridSE && widthPx > 130 && (
                              <p className="text-[10px] text-[#cbd5e1] truncate">
                                {activeLang === 'fr'
                                  ? translateEpgTextToFrenchSync(prog.subTitle)
                                  : prog.subTitle}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1 text-[10px] text-[#cbd5e1] font-mono">
                            <span className="truncate">
                              {formatTimeShort(prog.startMs)} -{' '}
                              {formatTimeShort(prog.stopMs)}
                            </span>
                            {formattedGridSE && widthPx > 140 ? (
                              <span className="px-1 py-0.2 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 text-[9px] font-sans font-medium truncate max-w-[65px]">
                                {formattedGridSE}
                              </span>
                            ) : (
                              prog.category &&
                              widthPx > 140 && (
                                <span className="px-1.5 py-0.2 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 text-[9px] font-sans truncate max-w-[90px]">
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
