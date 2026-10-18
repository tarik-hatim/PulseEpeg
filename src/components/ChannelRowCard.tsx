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
import { lookupTransponderSync } from '../services/satelliteCatalogService';
import { isFreeChannel } from '../utils/sportsEngine';
import {
  calculateProgress,
  formatRemainingTime,
  formatTimeShort,
  toStandardDigits,
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
  translateChannelCountryFilter,
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

  const isRtl = activeLang === 'ar';

  const tpInfo = React.useMemo(
    () => lookupTransponderSync(channel.displayName),
    [channel.displayName]
  );
  const isFree = isFreeChannel(channel.displayName, tpInfo?.isEncrypted ?? false);

  const satBadges = React.useMemo(() => {
    const list: string[] = [];
    if (channel.orbitalPosition) {
      list.push(channel.orbitalPosition);
    }
    if (channel.satellites && channel.satellites.length > 0) {
      for (const s of channel.satellites) {
        if (s && !list.includes(s)) {
          list.push(s);
        }
      }
    }
    if (list.length === 0 && singleSatBadge) {
      list.push(singleSatBadge);
    }
    return list.slice(0, 2);
  }, [channel.orbitalPosition, channel.satellites, singleSatBadge]);

  const initials = React.useMemo(() => {
    return (
      channel.displayName
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 3)
        .toUpperCase() || 'TV'
    );
  }, [channel.displayName]);

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
      className={`tv-card-focusable group relative rounded-2xl border cursor-pointer transition-all p-3.5 sm:p-4 space-y-3 ${
        isSelected
          ? 'selected-program bg-[#0f172a] border-2 border-[#f59e0b] shadow-[0_0_20px_rgba(245,158,11,0.25)]'
          : 'bg-[#0c121e] border-[#1a2333] hover:border-[#2a364f] hover:bg-[#0e1626]'
      }`}
    >
      {/* 1. En-tête de la carte : Logo cercle + Nom de chaîne + Badges SAT/Audio/Clair + Bouton Favori */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-12 h-12 rounded-full bg-[#111c2e] border border-[#1e293b] flex items-center justify-center shrink-0 overflow-hidden shadow-sm">
            {secureChannelLogoUrl && !failedLogoUrlsMemory.has(secureChannelLogoUrl) ? (
              <img
                src={secureChannelLogoUrl}
                alt={channel.displayName}
                className="w-8 h-8 object-contain"
                decoding="async"
                onError={(e) => {
                  if (secureChannelLogoUrl && !secureChannelLogoUrl.startsWith('data:image/')) {
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
              <span className="text-xs font-black text-[#38bdf8] tracking-wider">
                {initials}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <h3 className="font-bold text-white text-base sm:text-lg truncate leading-tight">
                {cleanOfficialChannelName(channel.displayName)}
              </h3>
              {typeof lcnNumber === 'number' && lcnNumber > 0 && (
                <span className="text-[10px] font-mono font-bold text-[#38bdf8] px-1.5 py-0.2 rounded bg-[#0a0e17] border border-[#1e293b] shrink-0">
                  #{toStandardDigits(lcnNumber)}
                </span>
              )}
            </div>

            {/* Badges horizontaux en pilules : BADR 26.0°E, NILESAT 7.0°W, DE, Clair */}
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              {satBadges.map((sat, sIdx) => (
                <span
                  key={sIdx}
                  className="px-2 py-0.5 rounded-full text-[10px] font-semibold border border-[#0055ff]/40 bg-[#0055ff]/10 text-[#38bdf8] uppercase tracking-wider shrink-0"
                >
                  {sat}
                </span>
              ))}

              {tpInfo && tpInfo.frequency && (
                <span
                  title={`Transpondeur Satellite : ${tpInfo.frequency} ${tpInfo.polarization} ${tpInfo.symbolRate}`}
                  className="px-2 py-0.5 rounded-full text-[10px] font-mono font-medium bg-[#1e293b]/80 border border-[#334155] text-[#38bdf8] shrink-0"
                >
                  {tpInfo.frequency} {tpInfo.polarization} {tpInfo.symbolRate ? `· ${tpInfo.symbolRate}` : ''}
                </span>
              )}

              {channel.audioTrackLabel ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1e293b] text-[#94a3b8] flex items-center gap-1 shrink-0">
                  <Volume2 className="w-2.5 h-2.5 text-[#60a5fa] shrink-0" />
                  <span>{channel.audioTrackLabel}</span>
                </span>
              ) : channel.country ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#1e293b] text-[#94a3b8] flex items-center gap-1 shrink-0">
                  <Volume2 className="w-2.5 h-2.5 text-[#60a5fa] shrink-0" />
                  <span>{translateChannelCountryFilter(channel.country as any, activeLang)}</span>
                </span>
              ) : null}

              {isFree ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#0055ff] text-white shrink-0">
                  {activeLang === 'ar' ? 'مفتوح' : activeLang === 'en' ? 'Free' : 'Clair'}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#1e293b] text-[#94a3b8] shrink-0">
                  {activeLang === 'ar' ? 'مشفر' : activeLang === 'en' ? 'Pay TV' : 'Crypté'}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bouton Favori cœur ♡ dans un carré arrondi */}
        <button
          type="button"
          data-channel-fav="true"
          data-selected={isFavorite ? 'true' : undefined}
          data-favorite={isFavorite ? 'true' : undefined}
          aria-pressed={isFavorite}
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(channel.id);
          }}
          className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-90 ${
            isFavorite
              ? 'bg-[#e11d48] text-white shadow-[0_0_12px_rgba(225,29,72,0.45)]'
              : 'bg-[#141a26] border border-[#1e293b] text-[#94a3b8] hover:text-white hover:border-[#f59e0b]/50'
          }`}
          aria-label={tr.favLabel}
        >
          <Heart className={`w-4 h-4 ${isFavorite ? 'fill-current text-white' : ''}`} />
        </button>
      </div>

      {/* 2. Programme En Direct */}
      {currentProgramme ? (
        <div className="space-y-1.5 pt-0.5">
          {/* Ligne Timing : • DIRECT + 22:05 — 22:30 + 19 min restant */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {isActualLive ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ef4444] text-white text-[11px] font-bold tracking-wider shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse shrink-0" />
                  {activeLang === 'ar' ? 'مباشر' : activeLang === 'en' ? 'LIVE' : 'DIRECT'}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[#1e293b] text-[#94a3b8] shrink-0">
                  <Clock className="w-3 h-3 text-[#60a5fa]" />
                  {activeLang === 'ar' ? 'مبرمج' : activeLang === 'en' ? 'Scheduled' : 'Programmé'}
                </span>
              )}

              <span className="text-xs sm:text-sm font-semibold text-white font-mono">
                {formatTimeShort(currentProgramme.startMs)} — {formatTimeShort(currentProgramme.stopMs)}
              </span>

              {formattedCurrentSE && (
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1d4ed8]/20 text-[#38bdf8] border border-[#0055ff]/40 font-mono font-bold">
                  {formattedCurrentSE}
                </span>
              )}
            </div>

            {isActualLive && (
              <span className="text-xs text-[#94a3b8] font-medium shrink-0">
                {formatRemainingTime(currentProgramme.stopMs, nowMs, activeLang)}
              </span>
            )}
          </div>

          {/* Titre du Programme — Large, blanc, lisible directement */}
          <h4 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2">
            {activeLang === 'fr'
              ? translateEpgTextToFrenchSync(currentProgramme.title)
              : currentProgramme.title}
          </h4>

          {/* Description complète du Programme — 3 à 4 lignes lisibles directement à l'écran */}
          {currentProgramme.description && (
            <p className="text-xs sm:text-sm text-[#94a3b8] leading-relaxed line-clamp-3 sm:line-clamp-4">
              {currentProgramme.description}
            </p>
          )}

          {/* Barre de progression fine et nette En Direct */}
          <div className="w-full h-1.5 rounded-full bg-[#1e293b] overflow-hidden mt-2">
            <div
              className="h-full bg-gradient-to-r from-[#e11d48] via-[#ec4899] to-[#0055ff] rounded-full transition-all duration-300"
              style={{ width: `${isActualLive ? progress : 100}%` }}
            />
          </div>

          {/* Ensuite (Programme Suivant) — Directement sous la barre */}
          {nextProgramme && (
            <div className="text-xs text-[#64748b] truncate pt-1 flex items-center gap-1.5">
              <span className="text-[#94a3b8] font-medium shrink-0">
                {activeLang === 'ar' ? 'التالي:' : activeLang === 'en' ? 'Next:' : 'Ensuite:'}
              </span>
              <span className="font-mono text-[#cbd5e1] shrink-0">
                {formatTimeShort(nextProgramme.startMs)}
              </span>
              <span className="text-[#cbd5e1] truncate">
                {activeLang === 'fr'
                  ? translateEpgTextToFrenchSync(nextProgramme.title)
                  : nextProgramme.title}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="py-3 text-xs text-[#94a3b8] italic flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#64748b]" />
          <span>{tr.noProgramCommunicated}</span>
        </div>
      )}
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
