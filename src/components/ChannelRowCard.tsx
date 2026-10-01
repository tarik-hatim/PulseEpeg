import React from 'react';
import {
  Bell,
  BellRing,
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
  ProgrammeReminder,
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
  cleanBouquetName,
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
  onSelectChannel: (
    channel: EpgChannel,
    currentProgramme?: EpgProgramme | null
  ) => void;
  isSelected: boolean;
  language?: AppLanguage;
  activeSatellite?: SatelliteFilter;
  activeBouquet?: BouquetFilter;
  selectedBouquets?: EpgBouquetId[];
  reminders?: ProgrammeReminder[];
  hasCurrentReminder?: boolean;
  hasNextReminder?: boolean;
  onToggleReminder?: (prog: EpgProgramme, channel: EpgChannel) => void;
  dataIndex?: number;
  lcnNumber?: number;
  measureRef?: (el: HTMLDivElement | null) => void;
  isMemorizedTarget?: boolean;
}

const COUNTRY_ACCENTS: Record<
  string,
  { badge: string; border: string; glow: string; flag: string }
> = {
  DE: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇩🇪',
  },
  ES: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇪🇸',
  },
  FR: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇫🇷',
  },
  IT: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇮🇹',
  },
  PL: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇵🇱',
  },
  AR: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇲🇦/🇦🇪',
  },
  EU: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇪🇺',
  },
  BR: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🇧🇷',
  },
  LATAM: {
    badge: 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50',
    border: 'hover:border-[#e11d48]/70',
    glow: 'from-transparent',
    flag: '🌎',
  },
};

// ============================================================================
// CACHE PERSISTANT DE LOGOS DE CHAÎNES VIA LOCALSTORAGE + MÉMOIRE (ANDROID TV)
// Évite les re-téléchargements réseau et les cascades d'erreurs lors du scroll
// rapide sur les listes virtualisées (Windowing).
// ============================================================================
const LOGO_CACHE_STORAGE_KEY = 'pulse_epg_channel_logo_cache_v1';
const LOGO_CACHE_MAX_ENTRIES = 220;
const LOGO_CACHE_TTL_MS = 7 * 24 * 3600 * 1000; // 7 jours
const MAX_INLINE_DATA_URI_LENGTH = 10240; // ~10 Ko max par miniature inline

interface CachedLogoEntry {
  src: string;
  ts: number;
}

let memoryLogoCache: Map<string, CachedLogoEntry> | null = null;
const failedLogoUrlsMemory = new Set<string>();
const pendingDataUriUpgrades = new Set<string>();
let flushCacheTimer: ReturnType<typeof setTimeout> | null = null;

function ensureMemoryLogoCacheLoaded(): Map<string, CachedLogoEntry> {
  if (memoryLogoCache) return memoryLogoCache;
  memoryLogoCache = new Map<string, CachedLogoEntry>();

  if (typeof window === 'undefined' || !window.localStorage) {
    return memoryLogoCache;
  }

  try {
    const raw = window.localStorage.getItem(LOGO_CACHE_STORAGE_KEY);
    if (!raw) return memoryLogoCache;
    const parsed = JSON.parse(raw) as Record<string, CachedLogoEntry | string>;
    const now = Date.now();
    for (const [key, val] of Object.entries(parsed)) {
      if (!val) continue;
      if (typeof val === 'string') {
        memoryLogoCache.set(key, { src: val, ts: now });
      } else if (
        typeof val === 'object' &&
        typeof val.src === 'string' &&
        now - (val.ts || 0) < LOGO_CACHE_TTL_MS
      ) {
        memoryLogoCache.set(key, { src: val.src, ts: val.ts || now });
      }
    }
  } catch {
    // Ignore JSON or storage access errors
  }

  return memoryLogoCache;
}

function scheduleFlushLogoCacheToLocalStorage(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (flushCacheTimer !== null) return;

  flushCacheTimer = setTimeout(() => {
    flushCacheTimer = null;
    if (!memoryLogoCache) return;

    // Éviction LRU si le nombre d'entrées dépasse LOGO_CACHE_MAX_ENTRIES
    if (memoryLogoCache.size > LOGO_CACHE_MAX_ENTRIES) {
      const sorted = Array.from(memoryLogoCache.entries()).sort(
        (a, b) => a[1].ts - b[1].ts
      );
      const toRemove = sorted.length - LOGO_CACHE_MAX_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        memoryLogoCache.delete(sorted[i][0]);
      }
    }

    const serializedObj: Record<string, CachedLogoEntry> = {};
    for (const [k, v] of memoryLogoCache.entries()) {
      serializedObj[k] = v;
    }

    try {
      window.localStorage.setItem(
        LOGO_CACHE_STORAGE_KEY,
        JSON.stringify(serializedObj)
      );
    } catch {
      // En cas de dépassement de quota LocalStorage, purger la moitié la plus ancienne
      try {
        const entries = Array.from(memoryLogoCache.entries()).sort(
          (a, b) => b[1].ts - a[1].ts
        );
        const kept = entries.slice(0, Math.floor(LOGO_CACHE_MAX_ENTRIES / 2));
        memoryLogoCache = new Map(kept);
        const compactObj: Record<string, CachedLogoEntry> = {};
        for (const [k, v] of memoryLogoCache.entries()) {
          compactObj[k] = v;
        }
        window.localStorage.setItem(
          LOGO_CACHE_STORAGE_KEY,
          JSON.stringify(compactObj)
        );
      } catch {
        // Ignore storage quota error
      }
    }
  }, 280);
}

function getCachedChannelLogo(channelKey: string): string | null {
  const cache = ensureMemoryLogoCacheLoaded();
  const entry = cache.get(channelKey);
  if (!entry) return null;
  if (failedLogoUrlsMemory.has(entry.src)) {
    cache.delete(channelKey);
    return null;
  }
  return entry.src;
}

function setCachedChannelLogo(channelKey: string, resolvedSrc: string): void {
  if (!channelKey || !resolvedSrc) return;
  const cache = ensureMemoryLogoCacheLoaded();
  const existing = cache.get(channelKey);
  if (existing && existing.src === resolvedSrc) {
    return;
  }
  // Ne pas écraser une miniature Data-URI déjà convertie par une simple URL distante
  if (
    existing &&
    existing.src.startsWith('data:image/webp') &&
    !resolvedSrc.startsWith('data:image/')
  ) {
    return;
  }
  cache.set(channelKey, { src: resolvedSrc, ts: Date.now() });
  scheduleFlushLogoCacheToLocalStorage();
}

/**
 * Convertit en arrière-plan un logo distant CORS (ex: GitHub tv-logos, Wikimedia)
 * en miniature Data-URI WebP compacte (<= 96x64px) stockée dans localStorage
 * pour un affichage instantané (0 requête réseau) lors du scroll rapide Android TV.
 */
function upgradeRemoteLogoToLocalStorageDataUri(
  channelKey: string,
  remoteHttpsUrl: string
): void {
  if (
    typeof window === 'undefined' ||
    !remoteHttpsUrl.startsWith('https://') ||
    pendingDataUriUpgrades.has(channelKey)
  ) {
    return;
  }

  const cache = ensureMemoryLogoCacheLoaded();
  const current = cache.get(channelKey);
  if (current?.src.startsWith('data:image/')) {
    return;
  }

  pendingDataUriUpgrades.add(channelKey);

  const corsImg = new Image();
  corsImg.crossOrigin = 'anonymous';
  corsImg.decoding = 'async';

  corsImg.onload = () => {
    pendingDataUriUpgrades.delete(channelKey);
    try {
      const natW = corsImg.naturalWidth || 64;
      const natH = corsImg.naturalHeight || 64;
      const maxDim = 72;
      const scale = Math.min(1, maxDim / Math.max(natW, natH));
      const w = Math.max(16, Math.round(natW * scale));
      const h = Math.max(16, Math.round(natH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(corsImg, 0, 0, w, h);

      const dataUri = canvas.toDataURL('image/webp', 0.82);
      if (
        dataUri &&
        dataUri.startsWith('data:image/') &&
        dataUri.length <= MAX_INLINE_DATA_URI_LENGTH
      ) {
        setCachedChannelLogo(channelKey, dataUri);
      }
    } catch {
      // Si le serveur distant ne supporte pas CORS canvas, l'URL HTTPS vérifiée reste en cache localStorage
    }
  };

  corsImg.onerror = () => {
    pendingDataUriUpgrades.delete(channelKey);
  };

  corsImg.src = remoteHttpsUrl;
}

const ChannelRowCardInner: React.FC<ChannelRowCardProps> = ({
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
  reminders = [],
  hasCurrentReminder: propHasCurrentReminder,
  hasNextReminder: propHasNextReminder,
  onToggleReminder,
  dataIndex,
  lcnNumber,
  measureRef,
  isMemorizedTarget = false,
}) => {
  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);
  const reminderIdSet = React.useMemo(
    () => (reminders.length > 0 ? new Set(reminders.map((r) => r.id)) : null),
    [reminders]
  );
  const hasCurrentReminder =
    propHasCurrentReminder !== undefined
      ? propHasCurrentReminder
      : currentProgramme && reminderIdSet
      ? reminderIdSet.has(currentProgramme.id)
      : false;
  const hasNextReminder =
    propHasNextReminder !== undefined
      ? propHasNextReminder
      : nextProgramme && reminderIdSet
      ? reminderIdSet.has(nextProgramme.id)
      : false;
  const singleSatBadge = getSingleSatelliteBadgeForChannel(
    channel,
    activeSatellite,
    selectedBouquets
  );
  const rawBouquetBadge = getActiveBouquetBadgeForChannel(
    channel,
    activeSatellite,
    activeBouquet
  );
  const activeBouquetBadge = rawBouquetBadge
    ? cleanBouquetName(rawBouquetBadge, singleSatBadge)
    : null;

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

  const channelLogoCacheKey = React.useMemo(
    () => `${channel.id.toLowerCase()}::${channel.displayName.toLowerCase()}`,
    [channel.id, channel.displayName]
  );

  const logoCandidates = React.useMemo(() => {
    const rawList = getChannelLogoCandidates(
      channel.id,
      channel.displayName,
      channel.icon ? channel.icon.replace(/^http:\/\//i, 'https://') : undefined
    ).filter((url) => !failedLogoUrlsMemory.has(url));

    const cachedSrc = getCachedChannelLogo(channelLogoCacheKey);
    if (cachedSrc) {
      return [cachedSrc, ...rawList.filter((u) => u !== cachedSrc)];
    }
    return rawList;
  }, [channel.id, channel.displayName, channel.icon, channelLogoCacheKey]);

  const [logoCandidateIdx, setLogoCandidateIdx] = React.useState(0);

  React.useEffect(() => {
    setLogoCandidateIdx(0);
  }, [channelLogoCacheKey, channel.icon]);

  const rawLogoUrl =
    logoCandidates[Math.min(logoCandidateIdx, logoCandidates.length - 1)] ||
    buildCleanFallbackLogoDataUri(channel.displayName, channel.id);
  const secureChannelLogoUrl =
    rawLogoUrl.startsWith('data:image/')
      ? rawLogoUrl
      : ensureHttpsUrl(rawLogoUrl.replace(/^http:\/\//i, 'https://')) ||
        buildCleanFallbackLogoDataUri(channel.displayName, channel.id);

  return (
    <div
      ref={measureRef}
      tabIndex={0}
      role="button"
      data-channel-card="true"
      data-channel-id={channel.id}
      data-channel-index={dataIndex}
      data-channel-memorized={isMemorizedTarget ? 'true' : undefined}
      data-tv-focusable="true"
      onClick={() => onSelectChannel(channel, currentProgramme)}
      onKeyDown={(e) => {
        if (
          e.key === 'Enter' ||
          e.key === ' ' ||
          e.key === 'Select' ||
          e.keyCode === 23 ||
          e.keyCode === 66
        ) {
          e.preventDefault();
          onSelectChannel(channel, currentProgramme);
        }
      }}
      className={`tv-card-focusable group relative rounded-lg border cursor-pointer overflow-hidden transition-all ${
        isSelected
          ? 'selected-program bg-[#1a202c] border-2 border-[#ec4899] shadow-[0_0_15px_rgba(236,72,153,0.4)]'
          : `bg-[#141a26] border-[#1a202c] ${accent.border} hover:bg-[#1a202c]`
      }`}
    >
      <div className="p-3.5 sm:p-4 2xl:p-5 flex flex-col lg:flex-row lg:items-center gap-3.5 sm:gap-4 2xl:gap-6">
        {/* Identité Chaîne Satellite */}
        <div className="flex items-center justify-between lg:w-72 2xl:w-80 shrink-0 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative w-12 h-12 2xl:w-14 2xl:h-14 rounded-lg bg-[#0a0e17] border border-[#1a202c] flex items-center justify-center p-1.5 shrink-0">
              {secureChannelLogoUrl ? (
                <img
                  src={secureChannelLogoUrl}
                  alt={channel.displayName}
                  className="max-w-full max-h-full object-contain"
                  decoding="async"
                  onLoad={(e) => {
                    const loadedSrc =
                      e.currentTarget.currentSrc || e.currentTarget.src;
                    if (loadedSrc) {
                      setCachedChannelLogo(channelLogoCacheKey, loadedSrc);
                      if (loadedSrc.startsWith('https://')) {
                        upgradeRemoteLogoToLocalStorageDataUri(
                          channelLogoCacheKey,
                          loadedSrc
                        );
                      }
                    }
                  }}
                  onError={(e) => {
                    if (
                      secureChannelLogoUrl &&
                      !secureChannelLogoUrl.startsWith('data:image/')
                    ) {
                      failedLogoUrlsMemory.add(secureChannelLogoUrl);
                    }
                    if (logoCandidateIdx < logoCandidates.length - 1) {
                      setLogoCandidateIdx((prev) => prev + 1);
                    } else {
                      const fallbackUri = buildCleanFallbackLogoDataUri(
                        channel.displayName,
                        channel.id
                      );
                      setCachedChannelLogo(channelLogoCacheKey, fallbackUri);
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

            <div className="min-w-0 ms-3">
              <div className="flex items-center gap-2 min-w-0">
                {typeof lcnNumber === 'number' && lcnNumber > 0 && (
                  <span className="tv-lcn-badge hidden md:inline-flex items-center px-1.5 py-0.5 rounded bg-[#0a0e17] text-[#38bdf8] border border-[#334155] font-mono text-[11px] font-bold shrink-0">
                    #{lcnNumber}
                  </span>
                )}
                <h3 className="font-bold text-[#ffffff] text-sm sm:text-base 2xl:text-lg truncate">
                  {cleanOfficialChannelName(channel.displayName)}
                </h3>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap mt-1">
                {/* Badge 1 : Nom du Satellite uniquement (ex: "ASTRA 19.2°E") */}
                <span
                  className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${accent.badge}`}
                >
                  {singleSatBadge}
                </span>
                {/* Badge 2 : Nom du Bouquet nettoyé uniquement (ex: "Canal+ France") */}
                {activeBouquetBadge && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#ec4899]/20 text-[#ffffff] border border-[#ec4899]/60">
                    {activeBouquetBadge}
                  </span>
                )}
              </div>

              {/* Badges techniques Audio & Sous-titres désolidarisés du logo */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {channel.contentCategory === 'Sport / Football' ? (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded bg-[#1d4ed8]/15 text-[#ffffff] border border-[#0055ff]/45 shrink-0">
                      <Volume2 className="w-3 h-3 text-[#60a5fa] shrink-0" />
                      <span>{channel.audioTrackLabel || tr.badgeAudioStadium}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded bg-[#1d4ed8]/15 text-[#ffffff] border border-[#0055ff]/45 shrink-0">
                      <span>⚽ {channel.subtitleTrackLabel || tr.badgeFootballLive}</span>
                    </span>
                  </>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded bg-[#1d4ed8]/15 text-[#ffffff] border border-[#0055ff]/45 shrink-0">
                      <Volume2 className="w-3 h-3 text-[#60a5fa] shrink-0" />
                      <span>{channel.audioTrackLabel || tr.badgeVoEnglish}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium px-2 py-0.5 rounded bg-[#1d4ed8]/15 text-[#ffffff] border border-[#0055ff]/45 shrink-0">
                      <Subtitles className="w-3 h-3 text-[#60a5fa] shrink-0" />
                      <span>{channel.subtitleTrackLabel || tr.badgeSubDvb}</span>
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            data-channel-fav="true"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(channel.id);
            }}
            className={`tv-focusable p-2 rounded-lg transition-all lg:hidden cursor-pointer ${
              isFavorite
                ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60'
            }`}
            aria-label={tr.favLabel}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#ffffff] text-[#ffffff]' : ''}`} />
          </button>
        </div>

        {/* Programme En Direct */}
        <div className="flex-1 min-w-0 lg:ps-4 lg:border-s lg:border-[#1a202c]">
          {currentProgramme ? (
            <div>
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  {isActualLive ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-[#e11d48] text-[#ffffff] border border-[#ff0033] shadow-[0_0_12px_rgba(225,29,72,0.5)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff] shadow-[0_0_8px_#ffffff] shrink-0 animate-pulse" />
                      {tr.liveBadge}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50">
                      <Clock className="w-2.5 h-2.5 text-[#60a5fa]" />
                      {tr.slotBadge}
                    </span>
                  )}

                  <span className="text-[#cbd5e1] font-mono text-[11px] font-medium">
                    {formatTimeShort(currentProgramme.startMs)} –{' '}
                    {formatTimeShort(currentProgramme.stopMs)}
                  </span>

                  {formattedCurrentSE && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 font-medium">
                      {formattedCurrentSE}
                    </span>
                  )}

                  {currentProgramme.date && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1d4ed8]/15 text-[#cbd5e1] border border-[#0055ff]/40 font-medium">
                      {currentProgramme.date}
                    </span>
                  )}

                  {currentProgramme.category && (
                    <span className="hidden sm:inline-block text-[10px] px-2 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 truncate max-w-[140px]">
                      {translateDynamicGenre(
                        currentProgramme.category,
                        activeLang
                      )}
                    </span>
                  )}

                  {hasCurrentReminder && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] border border-[#ec4899]/80 shadow-[0_0_10px_rgba(236,72,153,0.4)]">
                      <BellRing className="w-2.5 h-2.5 text-[#ffffff] animate-bounce" />
                      {tr.reminderActive}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isActualLive && (
                    <span className="text-[11px] font-medium text-[#cbd5e1] shrink-0">
                      {formatRemainingTime(
                        currentProgramme.stopMs,
                        nowMs,
                        activeLang
                      )}
                    </span>
                  )}
                  {onToggleReminder && currentProgramme.startMs > Date.now() && (
                    <button
                      type="button"
                      data-channel-reminder="true"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleReminder(currentProgramme, channel);
                      }}
                      className={`tv-focusable inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        hasCurrentReminder
                          ? 'bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] border border-[#ec4899] shadow-[0_0_10px_rgba(236,72,153,0.45)]'
                          : 'bg-[#0a0e17] border border-[#0055ff]/50 text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#ec4899]'
                      }`}
                      title={
                        hasCurrentReminder ? tr.cancelReminder : tr.remindProgram
                      }
                    >
                      {hasCurrentReminder ? (
                        <BellRing className="w-3 h-3 text-[#ffffff]" />
                      ) : (
                        <Bell className="w-3 h-3 text-[#60a5fa]" />
                      )}
                      <span className="hidden xl:inline">
                        {hasCurrentReminder ? tr.reminderActive : tr.reminderBtn}
                      </span>
                    </button>
                  )}
                </div>
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

              {/* Barre de progression temporelle colorée En Direct (#ec4899 -> #8b5cf6 sur rail rgba(255,255,255,0.1)) */}
              <div className="live-progress-rail mt-2.5 w-full overflow-hidden">
                <div
                  className="live-progress-fill h-full"
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

        {/* Programme Suivant (À Venir) + Action Rappel Cloche & Badge Bleu/Rose */}
        <div className="lg:w-72 2xl:w-80 shrink-0 lg:border-s lg:border-[#1a202c] lg:ps-4 flex items-center justify-between gap-2.5 pt-2 lg:pt-0 border-t border-[#1a202c] lg:border-t-0">
          <div
            className={`min-w-0 flex-1 rounded-lg p-1.5 -m-1.5 transition-all ${
              hasNextReminder
                ? 'bg-gradient-to-r from-[#0055ff]/15 to-[#ec4899]/15 border border-[#ec4899]/50'
                : ''
            }`}
          >
            <div className="flex items-center gap-1.5 text-[11px] text-[#cbd5e1] font-medium flex-wrap">
              <span className="uppercase tracking-wider text-[10px] text-[#60a5fa] font-semibold">
                {tr.upNext}
              </span>
              {nextProgramme && (
                <span className="font-mono text-[#cbd5e1]">
                  {formatTimeShort(nextProgramme.startMs)}
                </span>
              )}
              {hasNextReminder && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] border border-[#ec4899]/80 shadow-[0_0_8px_rgba(236,72,153,0.4)]">
                  <BellRing className="w-2.5 h-2.5 text-[#ffffff]" />
                  {activeLang === 'fr' ? 'Rappel' : tr.reminderBtn}
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
            {nextProgramme && onToggleReminder && (
              <button
                type="button"
                data-channel-reminder="true"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleReminder(nextProgramme, channel);
                }}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' ||
                    e.key === ' ' ||
                    e.key === 'Select' ||
                    e.keyCode === 23 ||
                    e.keyCode === 66
                  ) {
                    e.stopPropagation();
                    e.preventDefault();
                    onToggleReminder(nextProgramme, channel);
                  }
                }}
                className={`tv-focusable p-2 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                  hasNextReminder
                    ? 'bg-gradient-to-r from-[#0055ff] to-[#ec4899] border-[1.5px] border-[#ec4899] text-[#ffffff] shadow-[0_0_12px_rgba(236,72,153,0.5)]'
                    : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#ec4899]/70'
                }`}
                title={
                  hasNextReminder
                    ? tr.cancelReminder
                    : `${tr.remindProgram} : ${
                        activeLang === 'fr'
                          ? translateEpgTextToFrenchSync(nextProgramme.title)
                          : nextProgramme.title
                      }`
                }
                aria-label={
                  hasNextReminder ? tr.cancelReminder : tr.remindProgram
                }
              >
                {hasNextReminder ? (
                  <BellRing className="w-4 h-4 text-[#ffffff]" />
                ) : (
                  <Bell className="w-4 h-4 text-[#60a5fa]" />
                )}
              </button>
            )}

            <button
              type="button"
              data-channel-fav="true"
              onClick={(e) => {
                e.stopPropagation();
                onToggleFavorite(channel.id);
              }}
              className={`tv-focusable hidden lg:flex p-2 rounded-lg transition-all cursor-pointer ${
                isFavorite
                  ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                  : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60'
              }`}
              title={isFavorite ? tr.removeFromFavorites : tr.addToFavorites}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#ffffff] text-[#ffffff]' : ''}`} />
            </button>

            <div className="p-2 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] group-hover:text-[#ffffff] group-hover:border-[#e11d48]/70 transition-colors">
              <ChevronRight className="w-4 h-4 rtl:rotate-180" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function areChannelRowPropsEqual(
  prev: ChannelRowCardProps,
  next: ChannelRowCardProps
): boolean {
  return (
    prev.channel === next.channel &&
    prev.dataIndex === next.dataIndex &&
    prev.lcnNumber === next.lcnNumber &&
    prev.isFavorite === next.isFavorite &&
    prev.isSelected === next.isSelected &&
    prev.isMemorizedTarget === next.isMemorizedTarget &&
    prev.hasCurrentReminder === next.hasCurrentReminder &&
    prev.hasNextReminder === next.hasNextReminder &&
    prev.language === next.language &&
    prev.activeSatellite === next.activeSatellite &&
    prev.activeBouquet === next.activeBouquet &&
    prev.selectedBouquets === next.selectedBouquets &&
    prev.currentProgramme?.id === next.currentProgramme?.id &&
    prev.currentProgramme?.enrichedSource ===
      next.currentProgramme?.enrichedSource &&
    prev.nextProgramme?.id === next.nextProgramme?.id &&
    Math.floor(prev.nowMs / 60000) === Math.floor(next.nowMs / 60000)
  );
}

export const ChannelRowCard = React.memo(
  ChannelRowCardInner,
  areChannelRowPropsEqual
);
