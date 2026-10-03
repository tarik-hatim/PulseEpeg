import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Baby,
  Bell,
  BellRing,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Compass,
  Crown,
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
  ProgrammeReminder,
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
  cleanBouquetName,
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
  getActiveBouquetBadgeForChannel,
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
  reminders?: ProgrammeReminder[];
  onToggleReminder?: (prog: EpgProgramme, channel: EpgChannel) => void;
  channelLcnMap?: Map<string, number>;
  onQuickJumpStep?: (
    delta: number,
    targetChannel?: EpgChannel,
    targetLcn?: number
  ) => void;
  isExtendedEpgUnlocked?: boolean;
  selectedEpgDayOffset?: number;
  isReplayMode?: boolean;
  onSelectEpgDay?: (dayOffset: number, replayMode?: boolean) => void;
  onRequestProEpgUpgrade?: (reason?: string) => void;
}

const PIXELS_PER_MINUTE = 4.6;
const DEFAULT_WINDOW_HOURS = 4;
const MAX_WINDOW_HOURS = 24;

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

interface GridChannelRowProps {
  ch: EpgChannel;
  rowIdx: number;
  lcn: number;
  isFav: boolean;
  progs: EpgProgramme[];
  windowStartMs: number;
  windowEndMs: number;
  timelineWidth?: number;
  nowMs: number;
  baseRealNowMs: number;
  nowOffsetPx: number | null;
  selectedSatellite: SatelliteFilter;
  selectedBouquet: BouquetFilter;
  activeLang: AppLanguage;
  reminderIdSet: Set<string>;
  cancelReminderLabel: string;
  remindProgramLabel: string;
  onSelectChannel: (channel: EpgChannel, programme?: EpgProgramme) => void;
  onToggleFavorite: (channelId: string) => void;
  onToggleReminder?: (prog: EpgProgramme, channel: EpgChannel) => void;
}

const GridChannelRowInner: React.FC<GridChannelRowProps> = ({
  ch,
  rowIdx,
  lcn,
  isFav,
  progs,
  windowStartMs,
  windowEndMs,
  timelineWidth,
  nowMs,
  baseRealNowMs,
  nowOffsetPx,
  selectedSatellite,
  selectedBouquet,
  activeLang,
  reminderIdSet,
  cancelReminderLabel,
  remindProgramLabel,
  onSelectChannel,
  onToggleFavorite,
  onToggleReminder,
}) => {
  const flag = COUNTRY_FLAGS[ch.country] || '🛰️';
  const satBadge = getSingleSatelliteBadgeForChannel(ch, selectedSatellite);
  const rawBouquetBadge = getActiveBouquetBadgeForChannel(
    ch,
    selectedSatellite,
    selectedBouquet
  );
  const cleanedBouquetBadge = rawBouquetBadge
    ? cleanBouquetName(rawBouquetBadge, satBadge)
    : '';

  const timelineMinutes = Math.max(60, (windowEndMs - windowStartMs) / 60000);
  const effectiveTimelineWidth =
    timelineWidth ?? Math.round(timelineMinutes * PIXELS_PER_MINUTE);

  return (
    <div className="flex h-20 2xl:h-24 border-b border-[#1a202c]">
      {/* Cellule Chaîne Collante à Gauche */}
      <div
        tabIndex={0}
        role="button"
        data-grid-focusable="true"
        data-grid-row={rowIdx}
        data-grid-col="channel"
        data-channel-id={ch.id}
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
                    resolveOfficialChannelLogoUrl(ch.id, ch.displayName)
                  ).replace(/^http:\/\//i, 'https://')
                ) || buildCleanFallbackLogoDataUri(ch.displayName, ch.id)
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
                    : buildCleanFallbackLogoDataUri(ch.displayName, ch.id);
                if (currentSrc !== nextSrc) {
                  e.currentTarget.src = nextSrc;
                }
              }}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1 min-w-0">
              <span className="tv-lcn-badge hidden md:inline-flex items-center px-1 py-0.2 rounded bg-[#141a26] text-[#38bdf8] border border-[#334155] font-mono text-[9px] font-bold shrink-0">
                #{lcn}
              </span>
              <span className="text-[10px] shrink-0">{flag}</span>
              <p className="text-xs font-bold text-[#ffffff] truncate">
                {cleanOfficialChannelName(ch.displayName)}
              </p>
            </div>
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 truncate uppercase tracking-wider">
                {satBadge}
              </span>
              {cleanedBouquetBadge && (
                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-[#ec4899]/20 text-[#ffffff] border border-[#ec4899]/60 truncate max-w-[100px]">
                  {cleanedBouquetBadge}
                </span>
              )}
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
            isFav ? 'text-[#e11d48]' : 'text-[#cbd5e1] hover:text-[#ffffff]'
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${isFav ? 'fill-[#e11d48]' : ''}`} />
        </button>
      </div>

      {/* Cellule Timeline Programmes */}
      <div
        style={{ width: `${effectiveTimelineWidth}px` }}
        className="h-20 2xl:h-24 relative shrink-0 bg-[#0a0e17]"
      >
        {nowOffsetPx !== null && (
          <div
            style={{ left: `${nowOffsetPx}px` }}
            className="absolute top-0 bottom-0 w-px bg-[#e11d48] shadow-[0_0_8px_#e11d48] z-15 pointer-events-none"
          />
        )}

        {progs.map((prog, progIdx) => {
          const clampedStart = Math.max(prog.startMs, windowStartMs);
          const clampedStop = Math.min(prog.stopMs, windowEndMs);
          const leftPx =
            ((clampedStart - windowStartMs) / 60000) * PIXELS_PER_MINUTE;
          const widthPx = Math.max(
            36,
            ((clampedStop - clampedStart) / 60000) * PIXELS_PER_MINUTE - 3
          );
          const isLive = prog.startMs <= nowMs && prog.stopMs > nowMs;
          const hasReminder = reminderIdSet.has(prog.id);

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
                hasReminder
                  ? 'bg-gradient-to-r from-[#0055ff]/25 via-[#141a26] to-[#ec4899]/25 border-[1.5px] border-[#ec4899] shadow-[0_0_12px_rgba(236,72,153,0.4)] z-15'
                  : isLive
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
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isLive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] animate-pulse shadow-[0_0_6px_#e11d48] shrink-0" />
                    )}
                    {hasReminder && (
                      <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9px] font-extrabold uppercase bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] shrink-0">
                        <BellRing className="w-2.5 h-2.5 text-[#ffffff]" />
                      </span>
                    )}
                    <p className="text-xs font-bold text-[#ffffff] truncate">
                      {activeLang === 'fr'
                        ? translateEpgTextToFrenchSync(prog.title)
                        : prog.title}
                    </p>
                  </div>

                  {onToggleReminder &&
                    prog.stopMs > baseRealNowMs &&
                    widthPx >= 95 && (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleReminder(prog, ch);
                        }}
                        className={`p-1 rounded-md transition-all shrink-0 cursor-pointer ${
                          hasReminder
                            ? 'bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] shadow-[0_0_8px_rgba(236,72,153,0.5)]'
                            : 'bg-[#0a0e17]/80 text-[#cbd5e1] hover:text-[#ffffff] border border-[#1a202c] hover:border-[#ec4899]'
                        }`}
                        title={
                          hasReminder ? cancelReminderLabel : remindProgramLabel
                        }
                      >
                        {hasReminder ? (
                          <BellRing className="w-2.5 h-2.5" />
                        ) : (
                          <Bell className="w-2.5 h-2.5 text-[#60a5fa]" />
                        )}
                      </button>
                    )}
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
                      {translateDynamicGenre(prog.category, activeLang)}
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
};

const MemoizedGridChannelRow = React.memo(
  GridChannelRowInner,
  (prev, next) =>
    prev.ch === next.ch &&
    prev.rowIdx === next.rowIdx &&
    prev.lcn === next.lcn &&
    prev.isFav === next.isFav &&
    prev.progs === next.progs &&
    prev.windowStartMs === next.windowStartMs &&
    prev.windowEndMs === next.windowEndMs &&
    prev.timelineWidth === next.timelineWidth &&
    prev.selectedSatellite === next.selectedSatellite &&
    prev.selectedBouquet === next.selectedBouquet &&
    prev.activeLang === next.activeLang &&
    prev.reminderIdSet === next.reminderIdSet &&
    Math.floor(prev.nowMs / 60000) === Math.floor(next.nowMs / 60000)
);

const TimeGridViewInner: React.FC<TimeGridViewProps> = ({
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
  reminders = [],
  onToggleReminder,
  channelLcnMap,
  onQuickJumpStep,
  isExtendedEpgUnlocked = false,
  selectedEpgDayOffset = 0,
  isReplayMode = false,
  onSelectEpgDay,
  onRequestProEpgUpgrade,
}) => {
  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);
  const baseRealNowMs = realNowMs ?? nowMs;
  const reminderIdSet = useMemo(
    () => new Set(reminders.map((r) => r.id)),
    [reminders]
  );

  const [windowStartMs, setWindowStartMs] = useState<number>(() =>
    activeTimePreset === 'prime'
      ? getCasablancaTimestampForHour(nowMs, 20, 30)
      : floorToHalfHourCasablanca(nowMs - 30 * 60000)
  );
  const [activeTimeBtn, setActiveTimeBtn] = useState<
    'minus' | 'now' | 'prime' | 'plus'
  >(activeTimePreset);
  const [visibleHours, setVisibleHours] = useState<number>(DEFAULT_WINDOW_HOURS);
  const visibleMinutes = visibleHours * 60;
  const totalTimelineWidth = Math.round(visibleMinutes * PIXELS_PER_MINUTE);
  const windowEndMs = windowStartMs + visibleMinutes * 60000;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastScrollLeftRef = useRef<number>(0);
  const isExpandingRangeRef = useRef<boolean>(false);

  // Keep TimeGridView synchronized when parent time offset / preset or Sync to Live triggers
  useEffect(() => {
    if (activeTimePreset === 'prime') {
      setWindowStartMs(getCasablancaTimestampForHour(nowMs, 20, 30));
      setActiveTimeBtn('prime');
    } else {
      setWindowStartMs(floorToHalfHourCasablanca(nowMs - 30 * 60000));
      setActiveTimeBtn(activeTimePreset);
    }
    setVisibleHours(DEFAULT_WINDOW_HOURS);
  }, [nowMs, timeOffsetMinutes, activeTimePreset, liveSyncCount]);

  useEffect(() => {
    setVisibleHours(DEFAULT_WINDOW_HOURS);
  }, [selectedEpgDayOffset, isReplayMode]);

  // Barre de dates 7 jours : Catch-up (-1), Aujourd'hui (0 - 24h), et J+1 à J+7 (1..7)
  const sevenDayBarItems = useMemo(() => {
    const baseDate = new Date(baseRealNowMs);
    baseDate.setHours(0, 0, 0, 0);
    const offsets = [-1, 0, 1, 2, 3, 4, 5, 6, 7];

    return offsets.map((offset) => {
      const dayStartMs = baseDate.getTime() + offset * 86400000;
      const shortDateLabel = formatDayLabel(dayStartMs, activeLang);
      const isCatchUp = offset === -1;
      const isToday = offset === 0;
      const isLocked = !isToday && !isExtendedEpgUnlocked;

      let badgeLabel = '';
      if (isCatchUp) {
        badgeLabel = 'Catch-up';
      } else if (isToday) {
        badgeLabel =
          activeLang === 'fr' ? "Aujourd'hui (24h)" : `${tr.today} (24h)`;
      } else if (offset === 1) {
        badgeLabel = `J+1 · ${tr.tomorrow}`;
      } else {
        badgeLabel = `J+${offset} · ${shortDateLabel}`;
      }

      const isActive = isCatchUp
        ? isReplayMode || selectedEpgDayOffset === -1
        : !isReplayMode && selectedEpgDayOffset === offset;

      return {
        offset,
        dayStartMs,
        badgeLabel,
        isCatchUp,
        isToday,
        isLocked,
        isActive,
      };
    });
  }, [
    baseRealNowMs,
    activeLang,
    tr.today,
    tr.tomorrow,
    isExtendedEpgUnlocked,
    isReplayMode,
    selectedEpgDayOffset,
  ]);

  const timeSlots = useMemo(() => {
    const slots: number[] = [];
    const count = visibleHours * 2;
    for (let i = 0; i < count; i++) {
      slots.push(windowStartMs + i * 30 * 60000);
    }
    return slots;
  }, [windowStartMs, visibleHours]);

  const nowOffsetPx = useMemo(() => {
    if (baseRealNowMs < windowStartMs || baseRealNowMs > windowEndMs) return null;
    return ((baseRealNowMs - windowStartMs) / 60000) * PIXELS_PER_MINUTE;
  }, [baseRealNowMs, windowStartMs, windowEndMs]);

  const shiftWindow = (hours: number) => {
    const candidateMs = windowStartMs + hours * 3600000 + 30 * 60000;
    const todayDateStr = formatDateInputValue(baseRealNowMs);
    const candidateDateStr = formatDateInputValue(candidateMs);

    // En Mode Invité / Gratuit, l'utilisateur navigue librement sur la journée en cours (24h).
    // S'il tente de déborder sur J-1 (Catch-up) ou J+1..J+7, on ouvre le modal PulseEPG Pro.
    if (!isExtendedEpgUnlocked && candidateDateStr !== todayDateStr) {
      onRequestProEpgUpgrade?.();
      return;
    }

    if (onShiftTimeOffset) {
      onShiftTimeOffset(hours * 60);
    } else {
      setWindowStartMs((prev) => prev + hours * 3600000);
      setActiveTimeBtn(hours < 0 ? 'minus' : 'plus');
    }
  };

  const resetToNow = () => {
    if (onSelectEpgDay) {
      onSelectEpgDay(0, false);
    }
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
    const todayDateStr = formatDateInputValue(baseRealNowMs);
    if (!isExtendedEpgUnlocked && dateValue !== todayDateStr) {
      onRequestProEpgUpgrade?.();
      return;
    }

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

  const gridVisibleChannels = channels;

  // Virtualisation des lignes de la Grille TV (@tanstack/react-virtual) :
  // seules les 8 à 12 lignes visibles dans le viewport sont montées dans le DOM
  const rowVirtualizer = useVirtualizer({
    count: gridVisibleChannels.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () =>
      typeof window !== 'undefined' && window.innerWidth >= 1536 ? 96 : 80,
    initialRect: { width: 1280, height: 720 },
    overscan: 4,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalVirtualHeight = rowVirtualizer.getTotalSize();
  const topVirtualPadding =
    virtualRows.length > 0 ? virtualRows[0].start : 0;
  const bottomVirtualPadding =
    virtualRows.length > 0
      ? Math.max(0, totalVirtualHeight - virtualRows[virtualRows.length - 1].end)
      : 0;

  const visibleStartIdx =
    virtualRows.length > 0 ? virtualRows[0].index : 0;
  const visibleEndIdx =
    virtualRows.length > 0
      ? virtualRows[virtualRows.length - 1].index
      : Math.min(gridVisibleChannels.length - 1, 11);

  // Calcul EPG paresseux (Lazy EPG) : ne projette les programmes que pour les 8 à 15 chaînes actuellement visibles à l'écran !
  const visibleSliceChannels = useMemo(
    () =>
      gridVisibleChannels.slice(
        Math.max(0, visibleStartIdx),
        Math.max(0, visibleEndIdx + 1)
      ),
    [gridVisibleChannels, visibleStartIdx, visibleEndIdx]
  );

  const effectiveProgrammesByChannel = useMemo(
    () =>
      ensureSchedulesCoverTargetTime(
        visibleSliceChannels,
        programmesByChannel,
        windowStartMs + (visibleHours / 2) * 3600000
      ),
    [visibleSliceChannels, programmesByChannel, windowStartMs, visibleHours]
  );

  // Pré-filtre mémoïsé des programmes de la fenêtre horaire pour les seules lignes visibles
  const visibleWindowProgrammesMap = useMemo(() => {
    const map = new Map<string, EpgProgramme[]>();
    for (const ch of visibleSliceChannels) {
      const cleanId = cleanXmltvChannelId(ch.id);
      const rawChannelProgs =
        effectiveProgrammesByChannel[cleanId] ||
        effectiveProgrammesByChannel[ch.id] ||
        [];
      const filtered = rawChannelProgs.filter(
        (p) =>
          p &&
          !isPlaceholderProgrammeTitle(p.title) &&
          p.stopMs > windowStartMs &&
          p.startMs < windowEndMs
      );
      map.set(ch.id, filtered);
    }
    return map;
  }, [
    visibleSliceChannels,
    effectiveProgrammesByChannel,
    windowStartMs,
    windowEndMs,
  ]);

  useEffect(() => {
    if (nowOffsetPx !== null && scrollContainerRef.current) {
      const targetScroll = Math.max(0, nowOffsetPx - 160);
      scrollContainerRef.current.scrollLeft = targetScroll;
    }
  }, [liveSyncCount]);

  // Détection du défilement horizontal et chargement dynamique progressif (+2h / +4h jusqu'à 24h)
  const handleGridScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    const { scrollLeft, clientWidth, scrollWidth } = target;

    // Détection du sens de défilement vers la droite
    const isScrollingRight = scrollLeft > lastScrollLeftRef.current;
    lastScrollLeftRef.current = scrollLeft;

    // Détection d'approche du bord visible droit (- 200px)
    if (
      isScrollingRight &&
      !isExpandingRangeRef.current &&
      scrollLeft + clientWidth >= scrollWidth - 200
    ) {
      setVisibleHours((prevHours) => {
        if (prevHours >= MAX_WINDOW_HOURS) return prevHours;
        const nextHours = Math.min(MAX_WINDOW_HOURS, prevHours + 4);
        if (nextHours !== prevHours) {
          isExpandingRangeRef.current = true;
          window.requestAnimationFrame(() => {
            isExpandingRangeRef.current = false;
          });
          return nextHours;
        }
        return prevHours;
      });
    }
  }, []);

  // Assure une largeur de timeline suffisante sur très grands écrans / TV 4K
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (
      container.clientWidth >= container.scrollWidth - 200 &&
      visibleHours < MAX_WINDOW_HOURS
    ) {
      setVisibleHours((prev) => Math.min(MAX_WINDOW_HOURS, prev + 4));
    }
  }, [visibleHours, gridVisibleChannels.length]);

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

    const isPageUpKey =
      e.key === 'PageUp' ||
      e.key === 'ChannelUp' ||
      e.key === 'MediaTrackPrevious' ||
      e.keyCode === 33 ||
      e.keyCode === 166;
    const isPageDownKey =
      e.key === 'PageDown' ||
      e.key === 'ChannelDown' ||
      e.key === 'MediaTrackNext' ||
      e.keyCode === 34 ||
      e.keyCode === 167;

    if (
      e.key === 'ArrowRight' ||
      e.key === 'ArrowLeft' ||
      e.key === 'ArrowDown' ||
      e.key === 'ArrowUp' ||
      isPageUpKey ||
      isPageDownKey
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

            // Détection D-Pad : si l'utilisateur est sur le dernier programme visible de la ligne,
            // charge la tranche horaire suivante (+4h jusqu'à 24h)
            if (!targetEl && visibleHours < MAX_WINDOW_HOURS) {
              setVisibleHours((prev) => Math.min(MAX_WINDOW_HOURS, prev + 4));
            }
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
        } else if (
          e.key === 'ArrowDown' ||
          e.key === 'ArrowUp' ||
          isPageUpKey ||
          isPageDownKey
        ) {
          const isTvViewport =
            typeof window !== 'undefined' && window.innerWidth >= 768;
          const isFastJump =
            isTvViewport && (isPageUpKey || isPageDownKey || e.repeat);
          const isDownward = e.key === 'ArrowDown' || isPageDownKey;
          const stepDelta = isFastJump
            ? isDownward
              ? 10
              : -10
            : isDownward
            ? 1
            : -1;
          const maxRowIdx = Math.max(0, gridVisibleChannels.length - 1);

          if (!isFastJump && currentRow === 0 && !isDownward) {
            // Let global D-Pad handler move focus up to the Time Controls / Filters above the grid
            return;
          }

          const nextRow = Math.max(
            0,
            Math.min(maxRowIdx, currentRow + stepDelta)
          );
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
          } else {
            // Si la ligne cible est hors de la tranche virtualisée, scrolle le virtualizer puis focalise la ligne montée
            e.preventDefault();
            e.stopPropagation();
            rowVirtualizer.scrollToIndex(nextRow, { align: 'center' });
            if (isFastJump && onQuickJumpStep) {
              const jumpedCh = gridVisibleChannels[nextRow];
              const jumpedLcn = jumpedCh
                ? channelLcnMap?.get(jumpedCh.id) || nextRow + 1
                : nextRow + 1;
              onQuickJumpStep(stepDelta, jumpedCh, jumpedLcn);
            }
            window.requestAnimationFrame(() => {
              const mountedTarget =
                container.querySelector<HTMLElement>(
                  currentCol === 'channel'
                    ? `[data-grid-focusable="true"][data-grid-row="${nextRow}"][data-grid-col="channel"]`
                    : `[data-grid-focusable="true"][data-grid-row="${nextRow}"]`
                ) ||
                container.querySelector<HTMLElement>(
                  `[data-grid-focusable="true"][data-grid-row="${nextRow}"]`
                );
              if (mountedTarget) {
                mountedTarget.focus({ preventScroll: true });
                scrollGridElementIntoView(mountedTarget);
              }
            });
            return;
          }

          if (targetEl && isFastJump && onQuickJumpStep) {
            const jumpedCh = gridVisibleChannels[nextRow];
            const jumpedLcn = jumpedCh
              ? channelLcnMap?.get(jumpedCh.id) || nextRow + 1
              : nextRow + 1;
            onQuickJumpStep(stepDelta, jumpedCh, jumpedLcn);
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
    <div className="w-full">
      {/* 1. Bloc Isolé : Zone des Filtres (CATÉGORIE, SATELLITE, BOUQUET, ZONE, GENRE) */}
      <div
        data-tv-zone="filters"
        className="p-3 sm:p-4 rounded-xl bg-[#141a26] border border-[#1a202c] space-y-3 select-none"
      >
        {/* Ligne 1 : [CATÉGORIE] */}
        <div
          data-tv-row="grid-categories"
          className="filter-ribbon no-scrollbar border-b border-[#1a202c]"
        >
          <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] me-1 shrink-0 select-none">
            <Film className="w-3.5 h-3.5 text-[#e11d48]" />
            {tr.filterCatLabel}
          </span>
          {visibleCategoryOptions.map((cat) => {
            const active = selectedCategory === cat.code;
            const count = categoryCounts[cat.code] ?? 0;
            const label = translateCategoryFilter(cat.code, activeLang);
            return (
              <div
                key={cat.code}
                role="button"
                tabIndex={0}
                data-filter-active={active ? 'true' : undefined}
                onClick={() => onSelectCategory(cat.code)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' ||
                    e.key === ' ' ||
                    e.key === 'Select' ||
                    e.keyCode === 23 ||
                    e.keyCode === 66
                  ) {
                    e.preventDefault();
                    onSelectCategory(cat.code);
                  }
                }}
                className={`filter-badge ${
                  active ? 'active selected-filter' : ''
                }`}
              >
                <span className="filter-label">
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
                </span>
                <span className="filter-count">{count}</span>
              </div>
            );
          })}
        </div>

        {/* Ligne 2 : [SATELLITE] */}
        {visibleSatelliteOptions.length > 1 && (
          <div
            data-tv-row="grid-satellites"
            className="filter-ribbon no-scrollbar"
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] me-1 shrink-0 select-none">
              <Satellite className="w-3.5 h-3.5 text-[#0055ff]" />
              {tr.filterSatLabel}
            </span>
            {visibleSatelliteOptions.map((sat) => {
              const active = selectedSatellite === sat;
              const count = satelliteCounts[sat] ?? 0;
              const label = translateSatelliteFilter(sat, activeLang);
              return (
                <div
                  key={sat}
                  role="button"
                  tabIndex={0}
                  data-filter-active={active ? 'true' : undefined}
                  onClick={() => onSelectSatellite(sat)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' ||
                      e.key === ' ' ||
                      e.key === 'Select' ||
                      e.keyCode === 23 ||
                      e.keyCode === 66
                    ) {
                      e.preventDefault();
                      onSelectSatellite(sat);
                    }
                  }}
                  className={`filter-badge ${
                    active ? 'active selected-filter' : ''
                  }`}
                >
                  <span className="filter-label">{label}</span>
                  <span className="filter-count">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Ligne 2B : [BOUQUET] */}
        {visibleBouquetOptions.length > 1 && (
          <div
            data-tv-row="grid-bouquets"
            className="filter-ribbon no-scrollbar pt-1 border-t border-[#1a202c]"
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] me-1 shrink-0 select-none">
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
              const label = translateBouquetFilter(
                bq,
                activeLang,
                selectedSatellite
              );
              return (
                <div
                  key={bq}
                  role="button"
                  tabIndex={0}
                  data-filter-active={active ? 'true' : undefined}
                  onClick={() => onSelectBouquet(bq)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' ||
                      e.key === ' ' ||
                      e.key === 'Select' ||
                      e.keyCode === 23 ||
                      e.keyCode === 66
                    ) {
                      e.preventDefault();
                      onSelectBouquet(bq);
                    }
                  }}
                  className={`filter-badge ${
                    active ? 'active selected-filter' : ''
                  }`}
                >
                  <span className="filter-label">{label}</span>
                  <span className="filter-count">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {ramWarningMessage && (
          <div className="px-3 py-2 rounded-lg bg-[#0a0e17] border border-[#0055ff]/50 text-[#ffffff] text-xs font-medium flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#0055ff] shrink-0" />
            <span>{ramWarningMessage}</span>
          </div>
        )}

        {/* Ligne 3 : [ZONE / PAYS] (Ruban horizontal défilable de badges <div> cliquables sur tous les écrans) */}
        {onSelectCountry && visibleCountryOptions.length > 1 && (
          <div
            data-tv-row="grid-countries"
            className="filter-ribbon no-scrollbar pt-1 border-t border-[#1a202c]"
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] me-1 shrink-0 select-none">
              <Globe className="w-3.5 h-3.5 text-[#0055ff]" />
              {tr.filterCountryLabel || tr.filterZoneLabel}
            </span>
            {visibleCountryOptions.map((cCode) => {
              const active = selectedCountry === cCode;
              const count = countryCounts[cCode] ?? 0;
              const label = translateChannelCountryFilter(cCode, activeLang);
              const flag = CHANNEL_COUNTRY_FLAGS[cCode] || '🌍';
              return (
                <div
                  key={cCode}
                  role="button"
                  tabIndex={0}
                  data-filter-active={active ? 'true' : undefined}
                  onClick={() => onSelectCountry(cCode)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' ||
                      e.key === ' ' ||
                      e.key === 'Select' ||
                      e.keyCode === 23 ||
                      e.keyCode === 66
                    ) {
                      e.preventDefault();
                      onSelectCountry(cCode);
                    }
                  }}
                  className={`filter-badge ${
                    active ? 'active selected-filter' : ''
                  }`}
                >
                  <span className="filter-label">
                    <span>{flag}</span>
                    <span>{label}</span>
                  </span>
                  <span className="filter-count">{count}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Ligne 4 : [GENRE] */}
        {visibleGroupOptions.length > 1 && (
          <div
            data-tv-row="grid-genres"
            className="filter-ribbon no-scrollbar pt-1.5 border-t border-[#1a202c]"
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] me-1 shrink-0 select-none">
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
                <div
                  key={grp}
                  role="button"
                  tabIndex={0}
                  data-filter-active={active ? 'true' : undefined}
                  onClick={() => onSelectGroup(grp)}
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' ||
                      e.key === ' ' ||
                      e.key === 'Select' ||
                      e.keyCode === 23 ||
                      e.keyCode === 66
                    ) {
                      e.preventDefault();
                      onSelectGroup(grp);
                    }
                  }}
                  className={`filter-badge ${
                    active ? 'active selected-filter' : ''
                  }`}
                >
                  <span className="filter-label">{label}</span>
                  <span className="filter-count">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2.A Barre de Dates Guide EPG Étendu (7 Jours : J+1 à J+7 & Catch-up / Replay) */}
      <div
        data-tv-zone="filters"
        className="mt-4 p-3 sm:p-3.5 rounded-xl bg-[#141a26] border border-[#1a202c] space-y-2 select-none"
      >
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-bold text-[#ffffff]">
            <Calendar className="w-4 h-4 text-[#0055ff] shrink-0" />
            <span>
              {activeLang === 'fr'
                ? 'Guide EPG 7 Jours & Catch-up / Replay'
                : '7-Day EPG Guide & Catch-up / Replay'}
            </span>
            {isExtendedEpgUnlocked ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold bg-gradient-to-r from-[#f59e0b] to-[#ec4899] text-[#ffffff]">
                <Crown className="w-3 h-3 text-[#fde047]" />
                <span>
                  {activeLang === 'fr'
                    ? '7 Jours + Replay Débloqués (Pro 👑)'
                    : '7 Days + Replay Unlocked (Pro 👑)'}
                </span>
              </span>
            ) : (
              <span className="text-[11px] font-medium text-[#cbd5e1]">
                {activeLang === 'fr'
                  ? '· Mode Invité / Gratuit : Journée en cours (24h) accessible'
                  : '· Guest / Free Mode: Current day (24h) accessible'}
              </span>
            )}
          </div>

          {isReplayMode && isExtendedEpgUnlocked && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-[#ec4899]/20 border border-[#ec4899] text-[11px] font-extrabold text-[#ffffff]">
              <RotateCcw className="w-3 h-3 text-[#ec4899]" />
              <span>
                {activeLang === 'fr'
                  ? 'Mode Replay / Catch-up Actif'
                  : 'Replay / Catch-up Mode Active'}
              </span>
            </span>
          )}
        </div>

        <div
          data-tv-row="grid-7day-bar"
          className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1"
        >
          {sevenDayBarItems.map((item) => (
            <button
              key={item.offset}
              type="button"
              data-filter-active={item.isActive ? 'true' : undefined}
              onClick={() => {
                if (item.isLocked) {
                  if (onSelectEpgDay) {
                    onSelectEpgDay(item.offset, item.isCatchUp);
                  } else {
                    onRequestProEpgUpgrade?.();
                  }
                  return;
                }
                if (onSelectEpgDay) {
                  onSelectEpgDay(item.offset, item.isCatchUp);
                } else if (onSelectDateTime) {
                  onSelectDateTime(baseRealNowMs + item.offset * 86400000);
                }
              }}
              title={
                item.isLocked
                  ? activeLang === 'fr'
                    ? `${item.badgeLabel} 🔒 — Débloquez le Guide EPG 7 jours et le Catch-up avec PulseEPG Pro`
                    : `${item.badgeLabel} 🔒 — Unlock 7-day EPG & Catch-up with PulseEPG Pro`
                  : item.badgeLabel
              }
              className={`tv-dpad-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
                item.isActive
                  ? item.isCatchUp
                    ? 'bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] border-[1.5px] border-[#ec4899] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(236,72,153,0.45)]'
                    : 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                  : item.isLocked
                  ? 'bg-[#0a0e17]/90 border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#f59e0b]/70 font-medium'
                  : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
              }`}
            >
              {item.isCatchUp && !item.isLocked && (
                <RotateCcw className="w-3.5 h-3.5 text-[#ec4899] shrink-0" />
              )}
              <span>{item.badgeLabel}</span>
              {item.isLocked && (
                <span
                  aria-label="Verrouillé PulseEPG Pro"
                  className="text-[11px] leading-none shrink-0"
                >
                  🔒
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* 2.B Bloc Isolé : Ligne de Navigation Temporelle sous la zone des filtres (margin-top: 16px; display: flex; align-items: center; gap: 12px;) */}
      <div
        data-tv-zone="filters"
        style={{
          marginTop: '12px',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}
        className="grid-timeline-nav-block p-3 sm:p-4 rounded-xl bg-[#141a26] border border-[#1a202c]"
      >
        <div className="flex items-center gap-2.5 flex-wrap">
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
          style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
          className="flex flex-wrap items-center gap-3"
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
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
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
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
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
            className={`inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
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
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
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

      {/* 3. Bloc Isolé : Corps de la Grille multi-colonnes synchronisée verticalement et horizontalement (Navigation D-Pad TV fluide) */}
      <div className="rounded-xl border border-[#1a202c] bg-[#0a0e17] overflow-hidden shadow-2xl">
        <div
          dir="ltr"
          ref={scrollContainerRef}
          tabIndex={0}
          onKeyDown={handleGridKeyDown}
          onScroll={handleGridScroll}
          aria-label="TV Programme Grid"
          className="relative overflow-x-auto overflow-y-auto max-h-[70vh] 2xl:max-h-[74vh] focus:outline-none"
        >
        <div
          style={{ minWidth: `calc(13rem + ${totalTimelineWidth}px)` }}
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
              style={{ width: `${totalTimelineWidth}px` }}
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

          {/* Lignes virtualisées des chaînes filtrées et de leurs programmes (8 à 12 lignes dans le DOM) */}
          <div
            style={{
              paddingTop:
                topVirtualPadding > 0 ? `${topVirtualPadding}px` : undefined,
              paddingBottom:
                bottomVirtualPadding > 0
                  ? `${bottomVirtualPadding}px`
                  : undefined,
            }}
            className="w-full"
          >
            {virtualRows.map((virtualRow) => {
              const rowIdx = virtualRow.index;
              const ch = gridVisibleChannels[rowIdx];
              if (!ch) return null;
              const isFav = favoriteSet.has(ch.id);
              const lcn = channelLcnMap?.get(ch.id) || rowIdx + 1;
              const progs = visibleWindowProgrammesMap.get(ch.id) || [];

              return (
                <div
                  key={ch.id}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  className="w-full"
                >
                  <MemoizedGridChannelRow
                    ch={ch}
                    rowIdx={rowIdx}
                    lcn={lcn}
                    isFav={isFav}
                    progs={progs}
                    windowStartMs={windowStartMs}
                    windowEndMs={windowEndMs}
                    timelineWidth={totalTimelineWidth}
                    nowMs={nowMs}
                    baseRealNowMs={baseRealNowMs}
                    nowOffsetPx={nowOffsetPx}
                    selectedSatellite={selectedSatellite}
                    selectedBouquet={selectedBouquet}
                    activeLang={activeLang}
                    reminderIdSet={reminderIdSet}
                    cancelReminderLabel={tr.cancelReminder}
                    remindProgramLabel={tr.remindProgram}
                    onSelectChannel={onSelectChannel}
                    onToggleFavorite={onToggleFavorite}
                    onToggleReminder={onToggleReminder}
                  />
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

export const TimeGridView = React.memo(TimeGridViewInner);
