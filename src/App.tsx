import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Baby,
  Bell,
  BellRing,
  ChevronDown,
  ChevronUp,
  Clock,
  Compass,
  Film,
  Globe,
  Heart,
  Languages,
  LayoutGrid,
  Music,
  Newspaper,
  Radio,
  RefreshCw,
  RotateCcw,
  Satellite,
  Scale,
  Search,
  Settings,
  Sparkles,
  Subtitles,
  Trash2,
  Trophy,
  Tv,
  Volume2,
  X,
} from 'lucide-react';
import {
  AppLanguage,
  AppSettings,
  BouquetFilter,
  ChannelCountryFilter,
  ChannelGroup,
  ContentCategoryFilter,
  EpgCacheMetadata,
  EpgChannel,
  EpgProgramme,
  ProgrammeReminder,
  SatelliteFilter,
  WorkerProgressMessage,
  WorkerRequestMessage,
  WorkerResponseMessage,
} from './types/epg';
import {
  addRecentSearch,
  buildOfflineFallbackEpgSnapshot,
  buildOfflineFallbackEpgSnapshotAsync,
  buildSourcesSignature,
  CHANNEL_COUNTRY_FILTER_OPTIONS,
  channelMatchesCountryFilter,
  clearEpgCache,
  clearRecentSearches,
  DEFAULT_EPG_SOURCES,
  DEFAULT_SETTINGS,
  detectInitialTvProfileFromSystemLanguage,
  ensureSchedulesCoverTargetTime,
  extractChannelCountries,
  getBouquetsForSatellite,
  inferTvProfileFromBouquets,
  isBouquetFilterAllowedBySettings,
  isCategoryFilterAllowedBySettings,
  isChannelAllowedBySettings,
  isSatelliteFilterAllowedBySettings,
  loadAppSettings,
  loadAppSettingsAsync,
  loadEpgFromCache,
  loadFavoriteChannels,
  loadRecentSearches,
  loadReminders,
  MAX_ACTIVE_BOUQUETS,
  pruneSchedulesToActiveWindow,
  RAM_LIMIT_WARNING_MESSAGE,
  removeRecentSearch,
  resolveGlobalFavoriteChannels,
  SAT_TO_BOUQUETS_MAP,
  saveAppSettings,
  saveEpgToCache,
  saveFavoriteChannels,
  saveReminders,
  STRICT_SAT_FILTER_LIST,
  syncAppSettingsFromCapacitorPreferences,
  syncGlobalFavoritesFromDb,
  syncSourcesWithSelectedBouquets,
  TV_PROFILES_CATALOG,
} from './services/storageService';
import {
  APP_TIMEZONE_LABEL,
  formatDateInputValue,
  formatDateTimeLocalValue,
  formatDayLabel,
  formatTimeInputValue,
  formatTimeShort,
  getCasablancaTimestampForHour,
  parseDateInputWithCurrentTime,
  parseDateTimeLocalValue,
  parseTimeInputWithCurrentDate,
} from './utils/timeFormat';
import { ChannelRowCard } from './components/ChannelRowCard';
import { TimeGridView } from './components/TimeGridView';
import { ChannelDetailPanel } from './components/ChannelDetailPanel';
import { SettingsModal } from './components/SettingsModal';
import { LoadingStatusBanner } from './components/LoadingStatusBanner';
import { PWAInstallButton } from './components/PWAInstallButton';
import { InAppReminderBanner } from './components/InAppReminderBanner';
import { RemindersChronologicalView } from './components/RemindersChronologicalView';
import { PulseEpgLogo } from './components/PulseEpgLogo';
import {
  cancelProgrammeNotification,
  ensureEpgNotificationChannel,
  playInAppNotificationSound,
  requestSystemNotificationPermissions,
  scheduleProgrammeNotification,
  syncSavedRemindersWithSystemNotifications,
} from './services/nativeNotificationsService';
import {
  clearEnrichedMetadataCache,
  enrichProgrammeMetadata,
} from './services/metadataEnricher';
import {
  CHANNEL_COUNTRY_FLAGS,
  getChannelCountryFlag,
  getLanguageOption,
  getTranslations,
  LANGUAGE_OPTIONS,
  setActiveLanguage,
  translateBouquetFilter,
  translateCategoryFilter,
  translateChannelCountryFilter,
  translateSatelliteFilter,
  translateSubGenreGroup,
} from './utils/i18n';
import {
  cleanXmltvChannelId,
  isExclusivelySportChannel,
  isPlaceholderProgrammeTitle,
  matchesProgrammeCategory,
  matchesProgrammeGenreGroup,
} from './utils/xmltvParser';

type ViewMode = 'live' | 'grid' | 'favorites' | 'reminders';
type ActiveTimePreset = 'minus' | 'now' | 'prime' | 'plus';

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

const SATELLITE_OPTIONS: SatelliteFilter[] = STRICT_SAT_FILTER_LIST;

const BOUQUET_OPTIONS: BouquetFilter[] = SAT_TO_BOUQUETS_MAP['Tous'];

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

// Paramètres de virtualisation (Windowing) de la liste des chaînes pour Android TV & Mobile
const VIRTUAL_ROW_GAP = 10; // space-y-2.5 (0.625rem = 10px)
const VIRTUAL_OVERSCAN_COUNT = 6; // Buffer de pré-rendu haut/bas pour D-Pad fluide sans saccade
const VIRTUAL_INITIAL_MIN_ITEMS = 12; // Nombre minimal d'éléments rendus à l'écran initial

interface VirtualViewportState {
  scrollTop: number;
  viewportHeight: number;
  listOffsetTop: number;
  isDesktopLayout: boolean;
}

/**
 * Cède la main au thread principal (via setTimeout / Promise) pour laisser le DOM
 * s'afficher immédiatement avant les opérations de lecture profil / parsing EPG
 * sur les processeurs de Box Android TV moins puissants (ex: Echolink Atomo).
 */
function yieldToTvMainThread(delayMs = 20): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

export function App() {
  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      return DEFAULT_SETTINGS;
    } catch {
      return loadAppSettings();
    }
  });
  const [isProfileBootstrapping, setIsProfileBootstrapping] =
    useState<boolean>(true);
  const [channels, setChannels] = useState<EpgChannel[]>([]);
  const [schedulesByChannel, setSchedulesByChannel] = useState<
    Record<string, EpgProgramme[]>
  >({});
  const [cacheMeta, setCacheMeta] = useState<EpgCacheMetadata | null>(null);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [workerProgress, setWorkerProgress] =
    useState<WorkerProgressMessage | null>(null);
  const [epgError, setEpgError] = useState<string | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const [selectedCategory, setSelectedCategory] =
    useState<ContentCategoryFilter>('Tous');
  const [selectedSatellite, setSelectedSatellite] =
    useState<SatelliteFilter>('Tous');
  const [selectedBouquet, setSelectedBouquet] =
    useState<BouquetFilter>('Tous');
  const [selectedBouquetsList, setSelectedBouquetsList] = useState<
    BouquetFilter[]
  >([]);
  const [ramWarningMessage, setRamWarningMessage] = useState<string | null>(
    null
  );
  const [selectedGroup, setSelectedGroup] = useState<ChannelGroup>('Tous');
  const [selectedCountry, setSelectedCountry] =
    useState<ChannelCountryFilter>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] =
    useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const isTypingSessionRef = useRef<boolean>(false);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState<number>(0);
  const [activeTimePreset, setActiveTimePreset] =
    useState<ActiveTimePreset>('now');
  const [liveSyncCount, setLiveSyncCount] = useState<number>(0);

  const [favorites, setFavorites] = useState<string[]>([]);
  const [reminders, setReminders] = useState<ProgrammeReminder[]>([]);
  const [dismissedBannerIds, setDismissedBannerIds] = useState<string[]>([]);
  const [recentlyAddedReminder, setRecentlyAddedReminder] =
    useState<ProgrammeReminder | null>(null);
  const recentReminderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const [selectedChannel, setSelectedChannel] = useState<EpgChannel | null>(
    null
  );
  const [selectedModalProgramme, setSelectedModalProgramme] =
    useState<EpgProgramme | null>(null);

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<
    'filters' | 'sources' | 'legal'
  >('filters');

  // États et références pour la Virtualisation de liste (Windowing)
  const virtualListContainerRef = useRef<HTMLDivElement | null>(null);
  const measuredRowHeightsRef = useRef<Map<string, number>>(new Map());
  const rowNodeToChannelIdMapRef = useRef<WeakMap<Element, string>>(
    new WeakMap()
  );
  const rowResizeObserverRef = useRef<ResizeObserver | null>(null);
  const rowMeasureCallbacksRef = useRef<
    Map<string, (el: HTMLDivElement | null) => void>
  >(new Map());
  const measureRafRef = useRef<number | null>(null);
  const [heightMeasureVersion, setHeightMeasureVersion] = useState<number>(0);
  const [focusedChannelIndex, setFocusedChannelIndex] = useState<number | null>(
    null
  );
  const [lastFocusedChannelIndex, setLastFocusedChannelIndex] =
    useState<number>(0);
  const lastFocusedChannelIndexRef = useRef<number>(0);
  const filterRowColMemoryRef = useRef<Record<string, number>>({});
  const zoneTransitionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [activeDpadZone, setActiveDpadZone] = useState<
    'header' | 'filters' | 'channels' | null
  >(null);
  const activeDpadZoneRef = useRef<'header' | 'filters' | 'channels' | null>(
    null
  );
  activeDpadZoneRef.current = activeDpadZone;
  const [activeFilterRow, setActiveFilterRow] = useState<string | null>(null);
  const [dpadState, setDpadState] = useState<{
    previousZone: 'header' | 'filters' | 'channels' | null;
    lastDirection: 'up' | 'down' | 'left' | 'right' | 'jump' | null;
    isZoneTransitioning: boolean;
    transitionSeq: number;
    filterRowIndex: number;
    totalFilterRows: number;
    filterColIndex: number;
    channelActionCol: number;
  }>({
    previousZone: null,
    lastDirection: null,
    isZoneTransitioning: false,
    transitionSeq: 0,
    filterRowIndex: 0,
    totalFilterRows: 0,
    filterColIndex: 0,
    channelActionCol: 0,
  });
  const [virtualViewport, setVirtualViewport] = useState<VirtualViewportState>(
    () => ({
      scrollTop: typeof window !== 'undefined' ? window.scrollY : 0,
      viewportHeight:
        typeof window !== 'undefined' ? Math.max(window.innerHeight, 720) : 900,
      listOffsetTop: 260,
      isDesktopLayout:
        typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
    })
  );
  const virtualViewportRef = useRef<VirtualViewportState>(virtualViewport);
  virtualViewportRef.current = virtualViewport;

  const workerRef = useRef<Worker | null>(null);

  const activeLang: AppLanguage = settings.language || 'fr';
  const tr = getTranslations(activeLang);
  const langOpt = getLanguageOption(activeLang);

  // Synchronise la langue active et la direction RTL/LTR sur <html dir="..." lang="...">
  useEffect(() => {
    setActiveLanguage(activeLang);
  }, [activeLang]);

  const handleChangeLanguage = useCallback((newLang: AppLanguage) => {
    setActiveLanguage(newLang);
    clearEnrichedMetadataCache();
    setSettings((prev) => {
      const updated: AppSettings = {
        ...prev,
        language: newLang,
      };
      saveAppSettings(updated);
      return updated;
    });
  }, []);

  // Horloge temps réel (rafraîchie toutes les 15s pour détecter les rappels à J-5 min et en direct)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Sauvegarde automatique (debounce) des 5 dernières recherches dans LocalStorage
  const commitSearchToRecent = useCallback(
    (queryToSave: string, replacePrefix = false) => {
      const trimmed = queryToSave.trim();
      if (!trimmed) return;
      setRecentSearches((prev) =>
        addRecentSearch(trimmed, prev, replacePrefix)
      );
    },
    []
  );

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    const timer = setTimeout(() => {
      setRecentSearches((prev) =>
        addRecentSearch(trimmed, prev, isTypingSessionRef.current)
      );
      isTypingSessionRef.current = true;
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fermeture du menu déroulant Recent Searches au clic à l'extérieur
  useEffect(() => {
    if (!isSearchDropdownOpen) return;
    const handlePointerDownOutside = (event: MouseEvent | TouchEvent) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside);
    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, [isSearchDropdownOpen]);

  // Force l'horodateur sur le temps réel actuel sans possibilité de décalage en vue "Live Now"
  useEffect(() => {
    if (viewMode === 'live') {
      setNowMs(Date.now());
      setTimeOffsetMinutes(0);
      setActiveTimePreset('now');
    }
  }, [viewMode]);

  const effectiveTimeMs = useMemo(
    () => (viewMode === 'grid' ? nowMs + timeOffsetMinutes * 60000 : nowMs),
    [viewMode, nowMs, timeOffsetMinutes]
  );

  const handleLoadOfflineFallback = useCallback(
    (targetSettings: AppSettings = settings) => {
      void buildOfflineFallbackEpgSnapshotAsync(targetSettings).then(
        (fallback) => {
          if (fallback.channels.length > 0) {
            setChannels(fallback.channels);
            setSchedulesByChannel(fallback.schedulesByChannel);
            setCacheMeta(fallback.metadata);
          }
        }
      );
    },
    [settings]
  );

  const triggerEpgSync = useCallback((currentSettings: AppSettings) => {
    try {
      if (workerRef.current) {
        try {
          workerRef.current.terminate();
        } catch {
          // Ignore terminate error
        }
        workerRef.current = null;
      }

      if (typeof Worker === 'undefined') {
        void buildOfflineFallbackEpgSnapshotAsync(currentSettings).then(
          (fallback) => {
            setIsSyncing(false);
            setWorkerProgress(null);
            setChannels((prev) => (prev.length > 0 ? prev : fallback.channels));
            setSchedulesByChannel((prev) =>
              Object.keys(prev).length > 0 ? prev : fallback.schedulesByChannel
            );
            setCacheMeta((prev) => prev || fallback.metadata);
          }
        );
        return;
      }

      let worker: Worker;
      try {
        worker = new Worker(
          new URL('./workers/epgWorker.ts', import.meta.url),
          { type: 'module' }
        );
      } catch {
        worker = new Worker(
          new URL('./workers/epgWorker.ts', import.meta.url)
        );
      }
      workerRef.current = worker;

      setIsSyncing(true);
      setEpgError(null);

      worker.onmessage = async (event: MessageEvent<WorkerResponseMessage>) => {
        const msg = event.data;
        if (!msg) return;
        if (msg.type === 'WORKER_FETCH_REQUEST') {
          const { requestId, url } = msg.payload;
          try {
            const cap = (
              window as unknown as {
                Capacitor?: {
                  Plugins?: {
                    CapacitorHttp?: {
                      get?: (opts: {
                        url: string;
                        responseType?: string;
                        headers?: Record<string, string>;
                      }) => Promise<{ status: number; data: unknown }>;
                    };
                  };
                };
              }
            ).Capacitor;

            let resultBuffer: ArrayBuffer | null = null;

            if (cap?.Plugins?.CapacitorHttp?.get) {
              try {
                const capRes = await cap.Plugins.CapacitorHttp.get({
                  url,
                  responseType: 'arraybuffer',
                  headers: {
                    Accept: 'application/octet-stream, application/x-gzip, */*',
                  },
                });
                if (
                  capRes &&
                  capRes.status >= 200 &&
                  capRes.status < 300 &&
                  capRes.data
                ) {
                  if (typeof capRes.data === 'string') {
                    const binStr = atob(capRes.data);
                    const bytes = new Uint8Array(binStr.length);
                    for (let i = 0; i < binStr.length; i++) {
                      bytes[i] = binStr.charCodeAt(i);
                    }
                    resultBuffer = bytes.buffer;
                  } else if (capRes.data instanceof ArrayBuffer) {
                    resultBuffer = capRes.data;
                  }
                }
              } catch {
                // Fallback to window.fetch below
              }
            }

            if (!resultBuffer) {
              const res = await window.fetch(url, {
                method: 'GET',
                headers: {
                  Accept: 'application/octet-stream, application/x-gzip, */*',
                },
              });
              if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
              }
              const ct = (res.headers.get('content-type') || '').toLowerCase();
              if (ct.includes('text/html')) {
                throw new Error('Réponse HTML non valide');
              }
              resultBuffer = await res.arrayBuffer();
            }

            worker.postMessage(
              {
                type: 'WORKER_FETCH_RESPONSE',
                payload: {
                  requestId,
                  ok: true,
                  buffer: resultBuffer,
                },
              },
              [resultBuffer]
            );
          } catch (fetchErr: unknown) {
            worker.postMessage({
              type: 'WORKER_FETCH_RESPONSE',
              payload: {
                requestId,
                ok: false,
                error:
                  fetchErr instanceof Error
                    ? fetchErr.message
                    : String(fetchErr),
              },
            });
          }
          return;
        }

        if (msg.type === 'EPG_PROGRESS') {
          setWorkerProgress(msg);
        } else if (msg.type === 'EPG_COMPLETE') {
          const {
            metadata,
            channels: parsedChannels,
            schedulesByChannel: parsedSchedules,
          } = msg.payload;
          setTimeout(async () => {
            setChannels(parsedChannels);
            setSchedulesByChannel(parsedSchedules);
            setCacheMeta(metadata);
            setIsSyncing(false);
            setWorkerProgress(null);
            setEpgError(null);

            try {
              await saveEpgToCache(metadata, parsedChannels, parsedSchedules);
            } catch {
              // Ignore IndexedDB quota error
            }
          }, 0);
          try {
            worker.terminate();
          } catch {
            // Ignore
          }
          workerRef.current = null;
        } else if (msg.type === 'EPG_ERROR') {
          const errText =
            msg.payload?.error ||
            'Échec du chargement ou du parsing XMLTV HTTPS. Vérifiez votre connexion réseau ou réessayez.';
          void buildOfflineFallbackEpgSnapshotAsync(currentSettings).then(
            (fallback) => {
              setIsSyncing(false);
              setWorkerProgress(null);
              setEpgError(fallback.channels.length > 0 ? null : errText);
              setChannels((prev) =>
                prev.length > 0 ? prev : fallback.channels
              );
              setSchedulesByChannel((prev) =>
                Object.keys(prev).length > 0
                  ? prev
                  : fallback.schedulesByChannel
              );
              setCacheMeta((prev) => prev || fallback.metadata);
            }
          );
          try {
            worker.terminate();
          } catch {
            // Ignore
          }
          workerRef.current = null;
        }
      };

      worker.onerror = (errEvent) => {
        void buildOfflineFallbackEpgSnapshotAsync(currentSettings).then(
          (fallback) => {
            setIsSyncing(false);
            setWorkerProgress(null);
            setEpgError(
              fallback.channels.length > 0
                ? null
                : errEvent.message ||
                    'Erreur inattendue lors du traitement du flux XMLTV HTTPS.'
            );
            setChannels((prev) =>
              prev.length > 0 ? prev : fallback.channels
            );
            setSchedulesByChannel((prev) =>
              Object.keys(prev).length > 0 ? prev : fallback.schedulesByChannel
            );
            setCacheMeta((prev) => prev || fallback.metadata);
          }
        );
        try {
          worker.terminate();
        } catch {
          // Ignore
        }
        workerRef.current = null;
      };

      const isNativeCapacitor =
        typeof window !== 'undefined' &&
        Boolean(
          (
            window as unknown as {
              Capacitor?: { isNativePlatform?: () => boolean };
            }
          ).Capacitor?.isNativePlatform?.() ||
            window.location.protocol === 'capacitor:' ||
            (window.location.hostname === 'localhost' && !window.location.port)
        );

      const resolvedTvProfile =
        currentSettings.tvProfile ||
        inferTvProfileFromBouquets(
          currentSettings.selectedBouquets,
          currentSettings.tvProfile
        );

      // Lancement asynchrone du parsing Worker pour ne jamais bloquer le thread UI
      setTimeout(() => {
        try {
          const req: WorkerRequestMessage = {
            type: 'START_EPG_SYNC',
            payload: {
              sources: syncSourcesWithSelectedBouquets(
                currentSettings.selectedBouquets,
                currentSettings.sources,
                resolvedTvProfile
              ),
              windowHours: currentSettings.windowHours,
              cacheTtlHours: currentSettings.cacheTtlHours,
              isNativeCapacitor,
              tvProfile: resolvedTvProfile,
              selectedBouquets: currentSettings.selectedBouquets,
              excludePolishLektor: currentSettings.excludePolishLektor,
              excludeNoSubtitles: currentSettings.excludeNoSubtitles,
              enabledCategories: currentSettings.enabledCategories,
            },
          };
          worker.postMessage(req);
        } catch {
          void buildOfflineFallbackEpgSnapshotAsync(currentSettings).then(
            (fallback) => {
              setIsSyncing(false);
              setChannels((prev) =>
                prev.length > 0 ? prev : fallback.channels
              );
              setSchedulesByChannel((prev) =>
                Object.keys(prev).length > 0
                  ? prev
                  : fallback.schedulesByChannel
              );
              setCacheMeta((prev) => prev || fallback.metadata);
            }
          );
        }
      }, 25);
    } catch {
      void buildOfflineFallbackEpgSnapshotAsync(currentSettings).then(
        (fallback) => {
          setIsSyncing(false);
          setWorkerProgress(null);
          setChannels((prev) => (prev.length > 0 ? prev : fallback.channels));
          setSchedulesByChannel((prev) =>
            Object.keys(prev).length > 0 ? prev : fallback.schedulesByChannel
          );
          setCacheMeta((prev) => prev || fallback.metadata);
        }
      );
    }
  }, []);

  // Chargement initial totalement asynchrone (via setTimeout / Promise + try/catch) :
  // Laisse le temps au DOM de s'afficher d'abord sur les processeurs TV moins puissants (ex: Echolink Atomo)
  useEffect(() => {
    let mounted = true;

    const timerId = setTimeout(() => {
      void (async () => {
        let effectiveSettings: AppSettings = DEFAULT_SETTINGS;
        try {
          // Étape 1 : Céder la main au moteur de rendu DOM avant de lire le profil et LocalStorage
          await yieldToTvMainThread(16);
          if (!mounted) return;

          // Hydratation asynchrone sécurisée des recherches récentes, favoris et rappels
          try {
            setRecentSearches(loadRecentSearches());
            setFavorites(loadFavoriteChannels());
            const initialReminders = loadReminders();
            setReminders(initialReminders);
            void ensureEpgNotificationChannel();
            void syncSavedRemindersWithSystemNotifications(initialReminders);
          } catch {
            // Ignore storage errors
          }

          // Étape 2 : Détection et chargement asynchrone du profil TV et des préférences Capacitor
          const localLoadedSettings = await loadAppSettingsAsync();
          const capSyncedSettings =
            await syncAppSettingsFromCapacitorPreferences();
          effectiveSettings =
            capSyncedSettings || localLoadedSettings || DEFAULT_SETTINGS;

          if (mounted) {
            setSettings(effectiveSettings);
          }

          // Étape 3 : Céder la main au DOM avant l'ouverture d'IndexedDB et le filtrage des chaînes
          await yieldToTvMainThread(16);
          if (!mounted) return;

          const expectedSignature = buildSourcesSignature(effectiveSettings);
          const cached = await loadEpgFromCache(effectiveSettings);

          if (cached && cached.channels.length > 0) {
            if (!mounted) return;
            await yieldToTvMainThread(12);
            if (!mounted) return;

            const allowedCachedChannels = cached.channels.filter((ch) =>
              isChannelAllowedBySettings(ch, effectiveSettings)
            );
            const signatureMatches =
              cached.metadata.sourcesSignature === expectedSignature;

            if (allowedCachedChannels.length > 0 && signatureMatches) {
              const allowedIds = new Set(
                allowedCachedChannels.flatMap((ch) => [
                  ch.id,
                  cleanXmltvChannelId(ch.id),
                ])
              );
              const prunedAll = pruneSchedulesToActiveWindow(
                cached.schedulesByChannel,
                Date.now()
              );
              const filteredSchedules: Record<string, EpgProgramme[]> = {};
              for (const chId of Object.keys(prunedAll)) {
                if (
                  allowedIds.has(chId) ||
                  allowedIds.has(cleanXmltvChannelId(chId))
                ) {
                  filteredSchedules[chId] = prunedAll[chId];
                }
              }

              if (!mounted) return;
              setChannels(allowedCachedChannels);
              setSchedulesByChannel(filteredSchedules);
              setCacheMeta(cached.metadata);
              setIsProfileBootstrapping(false);

              const cacheAgeMs =
                Date.now() - (cached.metadata.lastUpdatedMs || 0);
              const isOlderThan12Hours = cacheAgeMs > 12 * 3600 * 1000;
              if (isOlderThan12Hours && effectiveSettings.autoRefreshHours > 0) {
                setTimeout(() => {
                  if (mounted) triggerEpgSync(effectiveSettings);
                }, 80);
              }
              return;
            }
          }

          // Étape 4 : Construction asynchrone de la grille de secours initiale puis lancement différé du Worker
          if (!mounted) return;
          const initialSnapshot =
            await buildOfflineFallbackEpgSnapshotAsync(effectiveSettings);
          if (!mounted) return;

          if (initialSnapshot.channels.length > 0) {
            setChannels(initialSnapshot.channels);
            setSchedulesByChannel(initialSnapshot.schedulesByChannel);
            setCacheMeta(initialSnapshot.metadata);
          }
          setIsProfileBootstrapping(false);

          setTimeout(() => {
            if (mounted) {
              triggerEpgSync(effectiveSettings);
            }
          }, 60);
        } catch (initErr) {
          console.warn(
            'Erreur interceptée lors de l’initialisation asynchrone Android TV:',
            initErr
          );
          if (!mounted) return;
          try {
            const fallback =
              await buildOfflineFallbackEpgSnapshotAsync(effectiveSettings);
            if (mounted && fallback.channels.length > 0) {
              setChannels(fallback.channels);
              setSchedulesByChannel(fallback.schedulesByChannel);
              setCacheMeta(fallback.metadata);
            }
          } catch {
            // Ignore
          }
          if (mounted) {
            setIsProfileBootstrapping(false);
          }
        }
      })();
    }, 10);

    return () => {
      mounted = false;
      clearTimeout(timerId);
      if (workerRef.current) {
        try {
          workerRef.current.terminate();
        } catch {
          // Ignore
        }
      }
    };
  }, []);

  // Synchronisation initiale et inter-onglets des Favoris Globaux (LocalStorage + IndexedDB / Room DB)
  useEffect(() => {
    let active = true;
    syncGlobalFavoritesFromDb().then((synced) => {
      if (active) {
        setFavorites(synced);
      }
    });
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'pulse_epg_favorites_v1') {
        setFavorites(loadFavoriteChannels());
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      active = false;
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Liste des chaînes autorisées par les Paramètres (Settings)
  const settingsAllowedChannels = useMemo(
    () => channels.filter((ch) => isChannelAllowedBySettings(ch, settings)),
    [channels, settings]
  );

  const favoriteSet = useMemo(() => {
    const set = new Set<string>();
    for (const id of favorites) {
      set.add(id);
      set.add(cleanXmltvChannelId(id));
    }
    return set;
  }, [favorites]);

  // Garantit que chaque chaîne dispose d'une grille complète pour la date/heure cible (hier, demain, J+2..J+7, etc.)
  const activeSchedulesByChannel = useMemo(
    () =>
      ensureSchedulesCoverTargetTime(
        channels,
        schedulesByChannel,
        effectiveTimeMs
      ),
    [channels, schedulesByChannel, effectiveTimeMs]
  );

  // Résolution globale des chaînes favorites (peu importe leur satellite ou bouquet d'origine)
  const { favoriteChannels: globalFavoriteChannels, supplementedSchedules } =
    useMemo(
      () =>
        resolveGlobalFavoriteChannels(
          channels,
          activeSchedulesByChannel,
          favorites
        ),
      [channels, activeSchedulesByChannel, favorites]
    );

  // Map des programmes en cours et suivants pour chaque chaîne à l'instant `effectiveTimeMs`
  const currentAndNextByChannel = useMemo(() => {
    const map: Record<
      string,
      { current: EpgProgramme | null; next: EpgProgramme | null }
    > = {};

    const allKnownChannels = [
      ...settingsAllowedChannels,
      ...globalFavoriteChannels,
    ];

    for (const ch of allKnownChannels) {
      const cleanId = cleanXmltvChannelId(ch.id);
      const list =
        supplementedSchedules[cleanId] ||
        supplementedSchedules[ch.id] ||
        activeSchedulesByChannel[cleanId] ||
        activeSchedulesByChannel[ch.id] ||
        [];
      let current: EpgProgramme | null = null;
      let next: EpgProgramme | null = null;

      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (!p || isPlaceholderProgrammeTitle(p.title)) continue;
        if (p.startMs <= effectiveTimeMs && p.stopMs > effectiveTimeMs) {
          current = p;
          for (let j = i + 1; j < list.length; j++) {
            if (list[j] && !isPlaceholderProgrammeTitle(list[j].title)) {
              next = list[j];
              break;
            }
          }
          break;
        }
        if (p.startMs > effectiveTimeMs) {
          next = p;
          break;
        }
      }

      map[ch.id] = { current, next };
      if (cleanId !== ch.id) {
        map[cleanId] = { current, next };
      }
    }
    return map;
  }, [
    settingsAllowedChannels,
    globalFavoriteChannels,
    supplementedSchedules,
    activeSchedulesByChannel,
    effectiveTimeMs,
  ]);

  const matchesSearch = useCallback(
    (ch: EpgChannel, query: string): boolean => {
      if (!query) return true;
      const q = query.toLowerCase();
      const matchName =
        ch.displayName.toLowerCase().includes(q) ||
        ch.id.toLowerCase().includes(q) ||
        ch.orbitalPosition.toLowerCase().includes(q) ||
        ch.bouquets.some((b) => b.toLowerCase().includes(q));
      if (matchName) return true;

      const pair = currentAndNextByChannel[ch.id];
      const curr = pair?.current;
      const nxt = pair?.next;

      return Boolean(
        (curr &&
          (curr.title.toLowerCase().includes(q) ||
            curr.originalTitle?.toLowerCase().includes(q) ||
            curr.subTitle?.toLowerCase().includes(q) ||
            curr.category?.toLowerCase().includes(q) ||
            curr.actors?.some((a) => a.toLowerCase().includes(q)))) ||
          (nxt &&
            (nxt.title.toLowerCase().includes(q) ||
              nxt.originalTitle?.toLowerCase().includes(q)))
      );
    },
    [currentAndNextByChannel]
  );

  const baseViewChannels = useMemo(() => {
    const q = searchQuery.trim();
    if (viewMode === 'favorites') {
      // En vue "Favorites", affiche toutes les chaînes favorites globales,
      // peu importe leur satellite ou bouquet d'origine
      return globalFavoriteChannels.filter((ch) => {
        if (q && !matchesSearch(ch, q)) return false;
        return true;
      });
    }
    return settingsAllowedChannels.filter((ch) => {
      const pair = currentAndNextByChannel[ch.id];
      if (!pair?.current && !pair?.next) return false;
      if (q && !matchesSearch(ch, q)) return false;
      return true;
    });
  }, [
    settingsAllowedChannels,
    globalFavoriteChannels,
    currentAndNextByChannel,
    viewMode,
    searchQuery,
    matchesSearch,
  ]);

  const matchesCategory = useCallback(
    (ch: EpgChannel, cat: ContentCategoryFilter): boolean => {
      const pair = currentAndNextByChannel[ch.id];
      if (!pair?.current && !pair?.next) return false;
      if (cat === 'Tous') return true;

      // Règle stricte : masquer impérativement toute chaîne exclusivement sportive (ex: beIN Sports 1 HD)
      // lorsque le filtre "Films & Séries" ou toute catégorie non-sportive est active
      if (cat !== 'Sport / Football' && isExclusivelySportChannel(ch)) {
        return false;
      }
      if (cat === 'Sport / Football' && !isExclusivelySportChannel(ch)) {
        return false;
      }

      if (ch.contentCategory && ch.contentCategory !== cat) {
        return false;
      }

      return (
        matchesProgrammeCategory(pair?.current, cat, ch.contentCategory) ||
        matchesProgrammeCategory(pair?.next, cat, ch.contentCategory)
      );
    },
    [currentAndNextByChannel]
  );

  const matchesSatellite = (ch: EpgChannel, sat: SatelliteFilter): boolean => {
    if (sat === 'Tous') return true;
    if (sat === "Badr / Es'hailSat 26°E" || sat === 'Badr 26°E') {
      return (
        ch.satellites.includes("Badr / Es'hailSat 26°E") ||
        ch.satellites.includes('Badr 26°E') ||
        ch.orbitalPosition?.includes('Badr')
      );
    }
    if (sat === 'Thor 0.8°W / Intelsat 10-02' || sat === 'Thor 0.8°W') {
      return (
        ch.satellites.includes('Thor 0.8°W / Intelsat 10-02') ||
        ch.satellites.includes('Thor 0.8°W') ||
        ch.orbitalPosition?.includes('Thor')
      );
    }
    if (sat === 'Eutelsat 16°E') {
      if (
        ch.bouquetId === 'trt_network' ||
        ch.bouquets.includes('TRT Network') ||
        /\.tr$/i.test(ch.id || '')
      ) {
        return false;
      }
      return (
        ch.satellites.includes('Eutelsat 16°E') ||
        ch.orbitalPosition === 'Eutelsat 16°E' ||
        ch.orbitalPosition?.includes('16°E')
      );
    }
    if (
      sat === 'Türksat 42°E' ||
      sat === 'Türksat 42°E / Eutelsat 7°E'
    ) {
      return (
        ch.satellites.includes('Türksat 42°E') ||
        ch.satellites.includes('Türksat 42°E / Eutelsat 7°E') ||
        ch.orbitalPosition?.includes('Türksat') ||
        ch.bouquetId === 'trt_network' ||
        ch.bouquets.includes('TRT Network')
      );
    }
    if (sat === 'TurkmenÄlem 52°E') {
      return (
        ch.satellites.includes('TurkmenÄlem 52°E') ||
        ch.orbitalPosition === 'TurkmenÄlem 52°E' ||
        ch.orbitalPosition === 'MonacoSat 52°E'
      );
    }
    if (sat === 'MonacoSat 52°E') {
      return (
        ch.satellites.includes('MonacoSat 52°E') ||
        ch.orbitalPosition === 'MonacoSat 52°E' ||
        ch.orbitalPosition === 'TurkmenÄlem 52°E'
      );
    }
    if (sat === 'Star One D2 70°W' || sat === 'Star One 70°W') {
      return (
        ch.satellites.includes('Star One D2 70°W') ||
        ch.satellites.includes('Star One 70°W') ||
        ch.orbitalPosition?.includes('70°W')
      );
    }
    if (
      sat === 'Intelsat 43.1°W / SES-6 40.5°W' ||
      sat === 'Intelsat 43.1°W & SES-6 40.5°W' ||
      sat === 'SES-6 40.5°W'
    ) {
      return (
        ch.satellites.includes('Intelsat 43.1°W / SES-6 40.5°W') ||
        ch.satellites.includes('Intelsat 43.1°W & SES-6 40.5°W') ||
        ch.satellites.includes('SES-6 40.5°W') ||
        ch.orbitalPosition?.includes('40.5°W') ||
        ch.orbitalPosition?.includes('43.1°W')
      );
    }
    return ch.satellites.includes(sat) || ch.orbitalPosition === sat;
  };

  const matchesSingleBouquet = (ch: EpgChannel, bq: BouquetFilter): boolean => {
    if (bq === 'Tous') return true;
    const combined = `${ch.id} ${ch.displayName}`.toLowerCase();

    if (bq === 'TRT Network') {
      return (
        ch.bouquets.includes('TRT Network') ||
        ch.bouquetId === 'trt_network' ||
        /\btrt\b/i.test(combined)
      );
    }
    if (bq === 'Nilesat MBC/OSN/Rotana') {
      return (
        ch.satellites.includes('Nilesat 7°W') &&
        (ch.bouquets.includes('Nilesat MBC/OSN/Rotana') ||
          /mbc|osn|rotana|wanasah|dubai\s*one|star\s*movies|star\s*world/i.test(
            combined
          ))
      );
    }
    if (bq === 'TNT Arabe/Égypte') {
      return (
        ch.satellites.includes('Nilesat 7°W') &&
        (ch.bouquets.includes('TNT Arabe/Égypte') ||
          !/mbc|osn|rotana|wanasah|dubai\s*one|star\s*movies|star\s*world/i.test(
            combined
          ))
      );
    }
    if (bq === 'Badr beIN (Sports & Movies)') {
      return (
        matchesSatellite(ch, "Badr / Es'hailSat 26°E") &&
        (ch.bouquets.includes('Badr beIN (Sports & Movies)') ||
          /bein|baraem|jeem|fatafeat/i.test(combined))
      );
    }
    if (bq === 'Badr SSC') {
      return (
        matchesSatellite(ch, "Badr / Es'hailSat 26°E") &&
        (ch.bouquets.includes('Badr SSC') || /\bssc\b/i.test(combined))
      );
    }
    if (bq === 'Badr TV Arabes/Al Kass') {
      return (
        matchesSatellite(ch, "Badr / Es'hailSat 26°E") &&
        (ch.bouquets.includes('Badr TV Arabes/Al Kass') ||
          !/bein|baraem|jeem|fatafeat|\bssc\b/i.test(combined))
      );
    }
    if (
      bq === 'Astra Canal+ France' ||
      bq === 'Canal+ France' ||
      bq === 'Astra Canal+'
    ) {
      return (
        ch.satellites.includes('Astra 19.2°E') &&
        (ch.bouquets.includes('Astra Canal+ France') ||
          ch.bouquetId === 'astra_canal_fr' ||
          ch.bouquets.includes('Canal+ France') ||
          ch.bouquets.includes('Astra Canal+'))
      );
    }
    if (bq === 'Astra TNT France' || bq === 'TNT France') {
      return (
        ch.satellites.includes('Astra 19.2°E') &&
        (ch.bouquets.includes('Astra TNT France') ||
          ch.bouquetId === 'astra_tnt_fr' ||
          ch.bouquetId === 'tnt_fr' ||
          ch.bouquets.includes('TNT France'))
      );
    }
    if (bq === 'Astra Movistar+ España' || bq === 'Movistar+ / DAZN ES') {
      return (
        ch.satellites.includes('Astra 19.2°E') &&
        (ch.bouquets.includes('Astra Movistar+ España') ||
          ch.bouquetId === 'movistar_es' ||
          ch.bouquets.includes('Movistar+ / DAZN ES'))
      );
    }
    if (bq === 'Sky DE / DAZN DE') {
      return (
        ch.satellites.includes('Astra 19.2°E') &&
        (ch.bouquets.includes('Sky DE / DAZN DE') ||
          ch.bouquetId === 'sky_de' ||
          ch.country === 'DE')
      );
    }
    if (
      bq === 'Hotbird Polsat/Cyfra+' ||
      bq === 'Polsat / Cyfra+ / Eleven' ||
      bq === 'Canal+ / Eleven / FilmBox'
    ) {
      return (
        ch.satellites.includes('Hotbird 13°E') &&
        (ch.bouquets.includes('Hotbird Polsat/Cyfra+') ||
          ch.bouquetId === 'canal_pl' ||
          ch.country === 'PL')
      );
    }
    if (
      bq === 'Hotbird Bis TV/Rai' ||
      bq === 'Bis TV France' ||
      bq === 'Bis TV (Hotbird 13°E)' ||
      bq === 'Rai / Sky Italia / Mediaset' ||
      bq === 'Sky Italia / DAZN IT'
    ) {
      return (
        ch.satellites.includes('Hotbird 13°E') &&
        (ch.bouquets.includes('Hotbird Bis TV/Rai') ||
          ch.bouquetId === 'hotbird_bis_fr' ||
          ch.bouquetId === 'sky_it' ||
          ch.country === 'IT' ||
          ch.bouquets.some((b) => b.includes('Bis') || b.includes('Rai')))
      );
    }
    if (
      bq === 'Hispasat Meo/NOS/Movistar' ||
      bq === 'Meo / NOS / Movistar 30°W' ||
      bq === 'MEO / NOS / Movistar (30°W)'
    ) {
      return (
        ch.satellites.includes('Hispasat 30°W') &&
        (ch.bouquets.includes('Hispasat Meo/NOS/Movistar') ||
          ch.bouquetId === 'hispasat_meo_nos' ||
          ch.bouquets.some(
            (b) => b.includes('30°W') || b.includes('MEO') || b.includes('Meo')
          ))
      );
    }
    if (
      bq === 'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)' ||
      bq === 'Total TV (Balkans / Serbie / Croatie)' ||
      bq === 'Total TV (Balkans)'
    ) {
      return (
        matchesSatellite(ch, 'Eutelsat 16°E') &&
        (ch.bouquets.includes(
          'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)'
        ) ||
          ch.bouquets.includes('Total TV (Balkans / Serbie / Croatie)') ||
          ch.bouquets.includes('Total TV (Balkans)'))
      );
    }
    if (
      bq === 'MAXtv / A1 Croatia' ||
      bq === 'MAXtv (Croatie)' ||
      bq === 'MaxTV Sat (Croatie)'
    ) {
      return (
        matchesSatellite(ch, 'Eutelsat 16°E') &&
        (ch.bouquets.includes('MAXtv / A1 Croatia') ||
          ch.bouquets.includes('MAXtv (Croatie)') ||
          ch.bouquets.includes('MaxTV Sat (Croatie)') ||
          ch.bouquets.includes('A1 Bulgaria / A1 Hrvatska'))
      );
    }
    if (
      bq === 'DigitAlb (Albanie)' ||
      bq === 'New World TV (Afrique)' ||
      bq === 'Canal+ Réunion / Afrique' ||
      bq === 'Autres chaînes africaines / francophones' ||
      bq === 'Bouquet National RTSH (Albanie FTA)' ||
      bq === 'Bouquet Afrique Francophone (2S TV, RTI, CRTV)' ||
      bq === 'A1 Bulgaria / A1 Hrvatska'
    ) {
      return (
        matchesSatellite(ch, 'Eutelsat 16°E') &&
        (ch.bouquets.includes(bq) ||
          (bq === 'Autres chaînes africaines / francophones' &&
            ch.bouquets.includes('Bouquet Afrique Francophone (2S TV, RTI, CRTV)')))
      );
    }
    if (
      bq === 'Focus Sat (Roumanie)' ||
      bq === 'Direct One (Hongrie)' ||
      bq === 'Digi TV'
    ) {
      return (
        matchesSatellite(ch, 'Thor 0.8°W / Intelsat 10-02') &&
        ch.bouquets.includes(bq)
      );
    }
    if (
      bq === 'Bouquet National Turkmène' ||
      bq === 'Turkmenistan National TV'
    ) {
      return (
        (matchesSatellite(ch, 'TurkmenÄlem 52°E') ||
          matchesSatellite(ch, 'MonacoSat 52°E')) &&
        (ch.bouquets.includes('Bouquet National Turkmène') ||
          ch.bouquets.includes('Turkmenistan National TV'))
      );
    }
    if (bq === 'Alem TV') {
      return (
        (matchesSatellite(ch, 'TurkmenÄlem 52°E') ||
          matchesSatellite(ch, 'MonacoSat 52°E')) &&
        ch.bouquets.includes('Alem TV')
      );
    }
    if (
      bq === 'Groupe Persiana' ||
      bq === 'Persiana Media Group (Farsi/Sport/Cinema)'
    ) {
      return (
        (matchesSatellite(ch, 'MonacoSat 52°E') ||
          matchesSatellite(ch, 'TurkmenÄlem 52°E')) &&
        (ch.bouquets.includes('Groupe Persiana') ||
          ch.bouquets.includes('Persiana Media Group (Farsi/Sport/Cinema)'))
      );
    }
    if (
      bq === 'Groupe WNS' ||
      bq === 'Information (Iran Intl / Afghanistan Intl)' ||
      bq === 'Information' ||
      bq === 'Big Bang TV'
    ) {
      return (
        (matchesSatellite(ch, 'MonacoSat 52°E') ||
          matchesSatellite(ch, 'TurkmenÄlem 52°E')) &&
        (ch.bouquets.includes(bq) ||
          (bq === 'Information (Iran Intl / Afghanistan Intl)' &&
            ch.bouquets.includes('Information')))
      );
    }
    return ch.bouquets.includes(bq);
  };

  const matchesBouquet = useCallback(
    (ch: EpgChannel, bq: BouquetFilter): boolean => {
      if (bq === 'Tous' && selectedBouquetsList.length === 0) {
        return true;
      }
      if (selectedBouquetsList.length > 0 && bq === selectedBouquet) {
        return selectedBouquetsList.some((item) =>
          matchesSingleBouquet(ch, item)
        );
      }
      return matchesSingleBouquet(ch, bq);
    },
    [selectedBouquetsList, selectedBouquet]
  );

  // Quand l'utilisateur clique sur un satellite, réinitialise automatiquement le filtre "BOUQUET" sur "All" ("Tous")
  // et affiche toutes les chaînes associées au satellite sans restreindre par défaut aux seuls bouquets nommés.
  const handleSelectSatellite = useCallback((sat: SatelliteFilter) => {
    setSelectedSatellite(sat);
    setSelectedBouquet('Tous');
    setSelectedBouquetsList([]);
    setSelectedCountry('Tous');
    setRamWarningMessage(null);
  }, []);

  const matchesCountry = useCallback(
    (ch: EpgChannel, country: ChannelCountryFilter): boolean => {
      if (country === 'Tous') return true;
      return channelMatchesCountryFilter(ch, country);
    },
    []
  );

  // Gestion de la sélection de Bouquet avec limite stricte de 3 bouquets simultanés max (RAM < 50 Mo)
  const handleSelectBouquet = useCallback(
    (bq: BouquetFilter) => {
      if (bq === 'Tous') {
        setSelectedBouquet('Tous');
        setSelectedBouquetsList([]);
        setRamWarningMessage(null);
        return;
      }

      if (bq === 'TRT Network') {
        setRamWarningMessage(null);
        setSelectedBouquetsList((prev) => {
          if (prev.includes('TRT Network')) {
            const next = prev.filter((item) => item !== 'TRT Network');
            setSelectedBouquet(next[0] || 'Tous');
            return next;
          }
          setSelectedSatellite('Türksat 42°E');
          setSelectedBouquet('TRT Network');
          return ['TRT Network'];
        });
        return;
      }

      if (selectedSatellite !== 'Tous') {
        setRamWarningMessage(null);
        setSelectedBouquetsList((prev) => {
          if (prev.includes(bq)) {
            const next = prev.filter((item) => item !== bq);
            setSelectedBouquet(next[0] || 'Tous');
            return next;
          }
          if (prev.length >= MAX_ACTIVE_BOUQUETS) {
            setRamWarningMessage(RAM_LIMIT_WARNING_MESSAGE);
            return prev;
          }
          const next = [bq];
          setSelectedBouquet(bq);
          return next;
        });
        return;
      }

      setSelectedBouquetsList((prev) => {
        if (prev.includes(bq)) {
          const next = prev.filter((item) => item !== bq);
          setSelectedBouquet(next[0] || 'Tous');
          setRamWarningMessage(null);
          return next;
        }
        if (prev.length >= MAX_ACTIVE_BOUQUETS) {
          setRamWarningMessage(RAM_LIMIT_WARNING_MESSAGE);
          return prev;
        }
        const next = [...prev, bq];
        setSelectedBouquet(bq);
        setRamWarningMessage(null);
        return next;
      });
    },
    [selectedSatellite]
  );

  const matchesGroup = useCallback(
    (ch: EpgChannel, grp: ChannelGroup): boolean => {
      const pair = currentAndNextByChannel[ch.id];
      if (!pair?.current && !pair?.next) return false;
      if (grp === 'Toutes' || grp === 'Tous') return true;

      // Règle stricte : masquer impérativement toute chaîne exclusivement sportive (ex: beIN Sports 1 HD)
      // lorsque "Cinéma Premières" ou tout autre genre non-sportif est actif
      if (grp !== 'Sport / Football' && isExclusivelySportChannel(ch)) {
        return false;
      }
      if (grp === 'Sport / Football' && !isExclusivelySportChannel(ch)) {
        return false;
      }

      const isCinemaSubGenre =
        grp === 'Cinéma Premières' ||
        grp === 'Action & Thriller' ||
        grp === 'Séries TV & US' ||
        grp === 'Comédie & Famille' ||
        grp === 'Classiques & Culte';

      if (
        isCinemaSubGenre &&
        ch.contentCategory &&
        ch.contentCategory !== 'Films & Séries'
      ) {
        return false;
      }

      return (
        matchesProgrammeGenreGroup(
          pair?.current,
          grp,
          ch.group,
          ch.contentCategory
        ) ||
        matchesProgrammeGenreGroup(
          pair?.next,
          grp,
          ch.group,
          ch.contentCategory
        )
      );
    },
    [currentAndNextByChannel]
  );

  // Recalcul en temps réel des compteurs croisés ([CATÉGORIE] -> [SATELLITE / BOUQUET / COUNTRY] -> [GENRE])
  const categoryCounts = useMemo(() => {
    const counts: Record<ContentCategoryFilter, number> = {
      Tous: 0,
      'Films & Séries': 0,
      Documentaires: 0,
      'Actualités / News': 0,
      'Jeunesse / Enfants': 0,
      'Musique & Divertissement': 0,
      'Sport / Football': 0,
    };

    const pool = baseViewChannels.filter(
      (ch) =>
        matchesSatellite(ch, selectedSatellite) &&
        matchesBouquet(ch, selectedBouquet) &&
        matchesCountry(ch, selectedCountry) &&
        matchesGroup(ch, selectedGroup)
    );

    counts.Tous = pool.length;
    for (const ch of pool) {
      for (const catOpt of CATEGORY_OPTIONS) {
        if (
          catOpt.code !== 'Tous' &&
          isCategoryFilterAllowedBySettings(
            catOpt.code,
            settings.enabledCategories
          ) &&
          matchesCategory(ch, catOpt.code)
        ) {
          counts[catOpt.code] = (counts[catOpt.code] || 0) + 1;
        }
      }
    }
    return counts;
  }, [
    baseViewChannels,
    selectedSatellite,
    selectedBouquet,
    selectedCountry,
    selectedGroup,
    settings.enabledCategories,
    matchesCategory,
    matchesCountry,
    matchesGroup,
  ]);

  const satelliteCounts = useMemo(() => {
    const counts: Record<SatelliteFilter, number> = {
      Tous: 0,
      'Nilesat 7°W': 0,
      'Badr 26°E': 0,
      "Badr / Es'hailSat 26°E": 0,
      'Astra 19.2°E': 0,
      'Hotbird 13°E': 0,
      'Hispasat 30°W': 0,
      'Eutelsat 16°E': 0,
      'Türksat 42°E': 0,
      'Türksat 42°E / Eutelsat 7°E': 0,
      'Thor 0.8°W': 0,
      'Thor 0.8°W / Intelsat 10-02': 0,
      'TurkmenÄlem 52°E': 0,
      'MonacoSat 52°E': 0,
      'Star One 70°W': 0,
      'Star One D2 70°W': 0,
      'Amazonas 61°W': 0,
      'SES-6 40.5°W': 0,
      'Intelsat 43.1°W / SES-6 40.5°W': 0,
      'Intelsat 43.1°W & SES-6 40.5°W': 0,
    };

    const pool = baseViewChannels.filter(
      (ch) =>
        matchesCategory(ch, selectedCategory) &&
        (selectedBouquet === 'TRT Network'
          ? matchesBouquet(ch, selectedBouquet)
          : true) &&
        matchesCountry(ch, selectedCountry) &&
        matchesGroup(ch, selectedGroup)
    );

    counts.Tous = pool.length;
    for (const ch of pool) {
      const uniqueSats = new Set(ch.satellites);
      for (const sat of uniqueSats) {
        counts[sat] = (counts[sat] || 0) + 1;
      }
      if (
        uniqueSats.has('Türksat 42°E / Eutelsat 7°E') &&
        !uniqueSats.has('Türksat 42°E')
      ) {
        counts['Türksat 42°E'] = (counts['Türksat 42°E'] || 0) + 1;
      }
      if (
        uniqueSats.has("Badr / Es'hailSat 26°E") &&
        !uniqueSats.has('Badr 26°E')
      ) {
        counts['Badr 26°E'] = (counts['Badr 26°E'] || 0) + 1;
      }
      if (
        uniqueSats.has('Thor 0.8°W') &&
        !uniqueSats.has('Thor 0.8°W / Intelsat 10-02')
      ) {
        counts['Thor 0.8°W / Intelsat 10-02'] =
          (counts['Thor 0.8°W / Intelsat 10-02'] || 0) + 1;
      }
      if (
        uniqueSats.has('Thor 0.8°W / Intelsat 10-02') &&
        !uniqueSats.has('Thor 0.8°W')
      ) {
        counts['Thor 0.8°W'] = (counts['Thor 0.8°W'] || 0) + 1;
      }
      if (
        uniqueSats.has('TurkmenÄlem 52°E') &&
        !uniqueSats.has('MonacoSat 52°E')
      ) {
        counts['MonacoSat 52°E'] = (counts['MonacoSat 52°E'] || 0) + 1;
      }
      if (
        uniqueSats.has('MonacoSat 52°E') &&
        !uniqueSats.has('TurkmenÄlem 52°E')
      ) {
        counts['TurkmenÄlem 52°E'] = (counts['TurkmenÄlem 52°E'] || 0) + 1;
      }
    }
    return counts;
  }, [
    baseViewChannels,
    selectedCategory,
    selectedCountry,
    selectedGroup,
    matchesCategory,
    matchesCountry,
    matchesGroup,
  ]);

  const bouquetCounts = useMemo(() => {
    const counts = {} as Record<BouquetFilter, number>;
    for (const bq of BOUQUET_OPTIONS) {
      counts[bq] = 0;
    }

    const pool = baseViewChannels.filter(
      (ch) =>
        matchesCategory(ch, selectedCategory) &&
        matchesSatellite(ch, selectedSatellite) &&
        matchesCountry(ch, selectedCountry) &&
        matchesGroup(ch, selectedGroup)
    );

    counts.Tous = pool.length;
    const targetBouquets = getBouquetsForSatellite(selectedSatellite);
    for (const ch of pool) {
      for (const bq of targetBouquets) {
        if (bq !== 'Tous' && matchesSingleBouquet(ch, bq)) {
          counts[bq] = (counts[bq] || 0) + 1;
        }
      }
    }
    return counts;
  }, [
    baseViewChannels,
    selectedCategory,
    selectedSatellite,
    selectedCountry,
    selectedGroup,
    matchesCategory,
    matchesCountry,
    matchesGroup,
  ]);

  const countryCounts = useMemo(() => {
    const counts = {} as Record<ChannelCountryFilter, number>;
    for (const c of CHANNEL_COUNTRY_FILTER_OPTIONS) {
      counts[c] = 0;
    }

    const pool = baseViewChannels.filter(
      (ch) =>
        matchesCategory(ch, selectedCategory) &&
        matchesSatellite(ch, selectedSatellite) &&
        matchesBouquet(ch, selectedBouquet) &&
        matchesGroup(ch, selectedGroup)
    );

    counts.Tous = pool.length;
    for (const ch of pool) {
      const extracted = extractChannelCountries(ch);
      for (const c of extracted) {
        counts[c] = (counts[c] || 0) + 1;
      }
    }
    return counts;
  }, [
    baseViewChannels,
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
    selectedGroup,
    matchesCategory,
    matchesBouquet,
    matchesGroup,
  ]);

  const groupCounts = useMemo(() => {
    const counts: Record<ChannelGroup, number> = {
      Tous: 0,
      Toutes: 0,
      'Cinéma Premières': 0,
      'Action & Thriller': 0,
      'Séries TV & US': 0,
      'Comédie & Famille': 0,
      'Classiques & Culte': 0,
      Documentaires: 0,
      'Actualités / News': 0,
      'Jeunesse / Enfants': 0,
      'Musique & Divertissement': 0,
      'Sport / Football': 0,
    };

    const pool = baseViewChannels.filter(
      (ch) =>
        matchesCategory(ch, selectedCategory) &&
        matchesSatellite(ch, selectedSatellite) &&
        matchesBouquet(ch, selectedBouquet) &&
        matchesCountry(ch, selectedCountry)
    );

    counts.Toutes = pool.length;
    counts.Tous = pool.length;
    for (const ch of pool) {
      for (const grp of GROUP_OPTIONS) {
        if (grp !== 'Tous' && grp !== 'Toutes' && matchesGroup(ch, grp)) {
          counts[grp] = (counts[grp] || 0) + 1;
        }
      }
    }
    return counts;
  }, [
    baseViewChannels,
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
    selectedCountry,
    matchesCategory,
    matchesCountry,
    matchesGroup,
  ]);

  // Auto-réinitialisation si un filtre actif est désactivé dans Settings ou tombe à 0 chaîne
  useEffect(() => {
    if (baseViewChannels.length === 0 || viewMode === 'favorites') return;

    if (
      selectedCategory !== 'Tous' &&
      (!isCategoryFilterAllowedBySettings(
        selectedCategory,
        settings.enabledCategories
      ) ||
        (categoryCounts[selectedCategory] ?? 0) === 0)
    ) {
      setSelectedCategory('Tous');
    }
    if (
      selectedSatellite !== 'Tous' &&
      (!isSatelliteFilterAllowedBySettings(
        selectedSatellite,
        settings.selectedBouquets
      ) ||
        (satelliteCounts[selectedSatellite] ?? 0) === 0)
    ) {
      setSelectedSatellite('Tous');
      setSelectedBouquet('Tous');
      setSelectedBouquetsList([]);
    }
    if (
      selectedBouquet !== 'Tous' &&
      (!isBouquetFilterAllowedBySettings(
        selectedBouquet,
        settings.selectedBouquets
      ) ||
        (bouquetCounts[selectedBouquet] ?? 0) === 0)
    ) {
      setSelectedBouquet('Tous');
      setSelectedBouquetsList((prev) =>
        prev.filter(
          (b) =>
            isBouquetFilterAllowedBySettings(b, settings.selectedBouquets) &&
            (bouquetCounts[b] ?? 0) > 0
        )
      );
    }
    if (
      selectedCountry !== 'Tous' &&
      (countryCounts[selectedCountry] ?? 0) === 0
    ) {
      setSelectedCountry('Tous');
    }
    if (
      selectedGroup !== 'Tous' &&
      selectedGroup !== 'Toutes' &&
      (groupCounts[selectedGroup] ?? 0) === 0
    ) {
      setSelectedGroup('Tous');
    }
  }, [
    baseViewChannels.length,
    viewMode,
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
    selectedCountry,
    selectedGroup,
    settings.enabledCategories,
    settings.selectedBouquets,
    categoryCounts,
    satelliteCounts,
    bouquetCounts,
    countryCounts,
    groupCounts,
  ]);

  // Options visibles : masque strictement tout satellite/bouquet/pays/catégorie/genre inactif dans Réglages ou dont le compteur = 0
  const visibleCategoryOptions = useMemo(
    () =>
      CATEGORY_OPTIONS.filter((cat) => {
        if (
          cat.code !== 'Tous' &&
          !isCategoryFilterAllowedBySettings(
            cat.code,
            settings.enabledCategories
          )
        ) {
          return false;
        }
        return (categoryCounts[cat.code] ?? 0) > 0;
      }),
    [settings.enabledCategories, categoryCounts]
  );

  // Ne liste dans la barre "SAT" QUE les satellites activés dans Réglages et ayant > 0 chaîne
  const visibleSatelliteOptions = useMemo(
    () =>
      STRICT_SAT_FILTER_LIST.filter((sat) => {
        if (
          sat !== 'Tous' &&
          !isSatelliteFilterAllowedBySettings(sat, settings.selectedBouquets)
        ) {
          return false;
        }
        return (satelliteCounts[sat] ?? 0) > 0;
      }),
    [settings.selectedBouquets, satelliteCounts]
  );

  // Liaison dynamique stricte + masquage des bouquets inactifs ou avec compteur = 0
  const visibleBouquetOptions = useMemo(
    () =>
      getBouquetsForSatellite(selectedSatellite).filter((bq) => {
        if (
          bq !== 'Tous' &&
          !isBouquetFilterAllowedBySettings(bq, settings.selectedBouquets)
        ) {
          return false;
        }
        return (bouquetCounts[bq] ?? 0) > 0;
      }),
    [selectedSatellite, settings.selectedBouquets, bouquetCounts]
  );

  // Liste dynamique des pays disponibles (ex: Turquie pour TRT, Albanie pour DigitAlb, Sénégal pour 2S TV)
  const visibleCountryOptions = useMemo(
    () =>
      CHANNEL_COUNTRY_FILTER_OPTIONS.filter(
        (c) => (countryCounts[c] ?? 0) > 0
      ),
    [countryCounts]
  );

  // Masque automatiquement tout bouton de genre dont le compteur est égal à 0
  const visibleGroupOptions = useMemo(
    () =>
      GROUP_OPTIONS.filter((grp) => {
        const count =
          (groupCounts[grp] ?? 0) ||
          (grp === 'Tous' ? (groupCounts['Toutes'] ?? 0) : 0);
        return count > 0;
      }),
    [groupCounts]
  );

  // Filtrage final dynamique des chaînes :
  // - En vue "Favorites", affiche TOUTES les chaînes favorites peu importe leur satellite ou bouquet d'origine
  // - En vue "En Direct" / "Grille TV", applique les filtres CATÉGORIE, SAT, BOUQUET, COUNTRY et GENRE
  const filteredChannels = useMemo(() => {
    if (viewMode === 'favorites') {
      return baseViewChannels;
    }
    return baseViewChannels.filter((ch) => {
      if (!matchesCategory(ch, selectedCategory)) return false;
      if (!matchesSatellite(ch, selectedSatellite)) return false;
      if (!matchesBouquet(ch, selectedBouquet)) return false;
      if (!matchesCountry(ch, selectedCountry)) return false;
      if (!matchesGroup(ch, selectedGroup)) return false;
      return true;
    });
  }, [
    viewMode,
    baseViewChannels,
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
    selectedCountry,
    selectedGroup,
    matchesCategory,
    matchesBouquet,
    matchesCountry,
    matchesGroup,
  ]);

  useEffect(() => {
    const maxIdx = Math.max(0, filteredChannels.length - 1);
    const clampedLastIdx = Math.min(lastFocusedChannelIndexRef.current, maxIdx);
    lastFocusedChannelIndexRef.current = clampedLastIdx;
    setLastFocusedChannelIndex(clampedLastIdx);
    setFocusedChannelIndex((prev) =>
      prev !== null ? Math.min(prev, maxIdx) : null
    );
    if (typeof window !== 'undefined' && virtualListContainerRef.current) {
      const rect = virtualListContainerRef.current.getBoundingClientRect();
      const nextListTop = Math.max(0, rect.top + window.scrollY);
      setVirtualViewport({
        scrollTop: window.scrollY,
        viewportHeight: Math.max(window.innerHeight, 720),
        listOffsetTop: nextListTop,
        isDesktopLayout: window.innerWidth >= 1024,
      });
    }
  }, [
    filteredChannels.length,
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
    selectedCountry,
    selectedGroup,
    searchQuery,
    viewMode,
  ]);

  const handleToggleFavorite = useCallback((channelId: string) => {
    const cleanTarget = cleanXmltvChannelId(channelId);
    setFavorites((prev) => {
      const exists = prev.some(
        (id) => id === channelId || cleanXmltvChannelId(id) === cleanTarget
      );
      const next = exists
        ? prev.filter(
            (id) => id !== channelId && cleanXmltvChannelId(id) !== cleanTarget
          )
        : [...prev, channelId];
      saveFavoriteChannels(next);
      return next;
    });
  }, []);

  const handleToggleReminder = useCallback(
    (programme: EpgProgramme, channel: EpgChannel) => {
      setReminders((prev) => {
        const exists = prev.some((r) => r.id === programme.id);
        if (exists) {
          const next = prev.filter((r) => r.id !== programme.id);
          saveReminders(next);
          void cancelProgrammeNotification(programme.id);
          setRecentlyAddedReminder((curr) =>
            curr?.id === programme.id ? null : curr
          );
          return next;
        }

        const newReminder: ProgrammeReminder = {
          id: programme.id,
          channelId: channel.id,
          channelName: channel.displayName,
          channelIcon: channel.icon,
          orbitalPosition: channel.orbitalPosition,
          title: programme.title,
          subTitle: programme.subTitle,
          description: programme.description,
          icon: programme.icon,
          startMs: programme.startMs,
          stopMs: programme.stopMs,
          category: programme.category,
        };

        const next = [...prev, newReminder].sort(
          (a, b) => a.startMs - b.startMs
        );
        saveReminders(next);

        // Demande la permission système LocalNotifications et programme l'alarme Android (canal 'epg_reminders' avec son)
        void scheduleProgrammeNotification(newReminder);

        setDismissedBannerIds((old) =>
          old.filter((id) => id !== newReminder.id)
        );
        setRecentlyAddedReminder(newReminder);
        if (recentReminderTimerRef.current) {
          clearTimeout(recentReminderTimerRef.current);
        }
        recentReminderTimerRef.current = setTimeout(() => {
          setRecentlyAddedReminder(null);
        }, 5000);

        return next;
      });
    },
    []
  );

  const handleRemoveReminderById = useCallback((reminderId: string) => {
    void cancelProgrammeNotification(reminderId);
    setReminders((prev) => {
      const next = prev.filter((r) => r.id !== reminderId);
      saveReminders(next);
      return next;
    });
    setRecentlyAddedReminder((curr) =>
      curr?.id === reminderId ? null : curr
    );
  }, []);

  const handleClearExpiredReminders = useCallback(() => {
    const currentNow = Date.now();
    setReminders((prev) => {
      const hasExpired = prev.some((r) => r.stopMs <= currentNow);
      const removed = hasExpired
        ? prev.filter((r) => r.stopMs <= currentNow)
        : prev;
      for (const r of removed) {
        void cancelProgrammeNotification(r.id);
      }
      const next = hasExpired
        ? prev.filter((r) => r.stopMs > currentNow)
        : [];
      saveReminders(next);
      return next;
    });
  }, []);

  const handleDismissBannerAlert = useCallback((reminderId: string) => {
    setDismissedBannerIds((prev) =>
      prev.includes(reminderId) ? prev : [...prev, reminderId]
    );
    setRecentlyAddedReminder((curr) =>
      curr?.id === reminderId ? null : curr
    );
  }, []);

  const handleSelectReminderTarget = useCallback(
    (rem: ProgrammeReminder) => {
      const cleanTarget = cleanXmltvChannelId(rem.channelId);
      const foundChannel =
        channels.find(
          (c) =>
            c.id === rem.channelId ||
            cleanXmltvChannelId(c.id) === cleanTarget
        ) ||
        ({
          id: rem.channelId,
          displayName: rem.channelName,
          icon: rem.channelIcon,
          orbitalPosition: rem.orbitalPosition || 'Astra 19.2°E',
          satellites: ['Astra 19.2°E'],
          bouquets: ['Astra Canal+ France'],
          country: 'FR',
          group: 'Cinéma Premières',
          contentCategory: (rem.category as EpgChannel['contentCategory']) || 'Films & Séries',
          audioTrackLabel: 'VO Audio',
          subtitleTrackLabel: 'SUB DVB',
          sourceId: 'fallback',
          sourceName: 'PulseEPG',
          hasOriginalAudioVO: true,
          hasSubtitles: true,
        } as unknown as EpgChannel);

      const channelSchedule =
        activeSchedulesByChannel[cleanXmltvChannelId(foundChannel.id)] ||
        activeSchedulesByChannel[foundChannel.id] ||
        [];

      const matchedProg =
        channelSchedule.find(
          (p) =>
            p.id === rem.id ||
            (p.startMs === rem.startMs && p.title === rem.title)
        ) ||
        ({
          id: rem.id,
          channelId: foundChannel.id,
          title: rem.title,
          subTitle: rem.subTitle,
          description: rem.description,
          icon: rem.icon,
          category: rem.category || 'Films & Séries',
          rawCategory: rem.category || 'Films & Séries',
          group: foundChannel.group || 'Films & Séries',
          startMs: rem.startMs,
          stopMs: rem.stopMs,
          hasOriginalAudioVO: true,
          hasSubtitles: true,
        } as EpgProgramme);

      setSelectedChannel(foundChannel);
      setSelectedModalProgramme(matchedProg);
      handleDismissBannerAlert(rem.id);
    },
    [channels, activeSchedulesByChannel, handleDismissBannerAlert]
  );

  const handleTriggerTestAlertBanner = useCallback(() => {
    const currentNow = Date.now();
    setNowMs(currentNow);
    setDismissedBannerIds([]);

    // Demande la permission système LocalNotifications et joue le carillon sonore
    void requestSystemNotificationPermissions();
    playInAppNotificationSound();

    // Si un rappel est déjà à J-5 min ou en direct, le réafficher immédiatement et déclencher la notification système
    const existingImminent = reminders.find((r) => {
      const diff = r.startMs - currentNow;
      return (
        (diff > 0 && diff <= 5 * 60 * 1000) ||
        (r.startMs <= currentNow && r.stopMs > currentNow)
      );
    });
    if (existingImminent) {
      void scheduleProgrammeNotification(existingImminent, {
        isImmediateTest: true,
      });
      return;
    }

    // Sinon créer un rappel de démonstration commençant dans 3 minutes sur la 1ère chaîne active
    const sampleChannel = settingsAllowedChannels[0] || channels[0];
    if (!sampleChannel) return;
    const samplePair = currentAndNextByChannel[sampleChannel.id];
    const sampleProg = samplePair?.next || samplePair?.current;

    const demoReminder: ProgrammeReminder = {
      id: `demo_alert_${sampleChannel.id}_${Math.floor(currentNow / 60000)}`,
      channelId: sampleChannel.id,
      channelName: sampleChannel.displayName,
      channelIcon: sampleChannel.icon,
      orbitalPosition: sampleChannel.orbitalPosition,
      title:
        sampleProg?.title ||
        (activeLang === 'fr'
          ? 'Soirée Ligue des Champions / Grand Cinéma HD'
          : 'Champions League Night / Prime Cinema HD'),
      subTitle:
        sampleProg?.subTitle ||
        (activeLang === 'fr'
          ? 'Diffusion Imminente (Test Bandeau TV)'
          : 'Starting Soon (TV Banner Test)'),
      description: sampleProg?.description,
      icon: sampleProg?.icon,
      startMs: currentNow + 3 * 60 * 1000,
      stopMs: currentNow + 95 * 60 * 1000,
      category: sampleChannel.contentCategory || 'Sport / Football',
    };

    // Programme la vraie notification système Android (avec son sur le canal 'epg_reminders')
    void scheduleProgrammeNotification(demoReminder, {
      isImmediateTest: true,
    });

    setReminders((prev) => {
      const filtered = prev.filter((r) => !r.id.startsWith('demo_alert_'));
      const next = [...filtered, demoReminder].sort(
        (a, b) => a.startMs - b.startMs
      );
      saveReminders(next);
      return next;
    });
  }, [
    reminders,
    settingsAllowedChannels,
    channels,
    currentAndNextByChannel,
    activeLang,
  ]);

  const activeRemindersCount = useMemo(
    () => reminders.filter((r) => r.stopMs > nowMs).length,
    [reminders, nowMs]
  );

  const hasImminentOrLiveReminder = useMemo(
    () =>
      reminders.some((r) => {
        const diff = r.startMs - nowMs;
        return (
          (diff > 0 && diff <= 5 * 60 * 1000) ||
          (r.startMs <= nowMs && r.stopMs > nowMs)
        );
      }),
    [reminders, nowMs]
  );

  const handleSaveSettings = useCallback(
    async (newSettings: AppSettings, forceReload: boolean) => {
      const resolvedProfile =
        newSettings.tvProfile ||
        inferTvProfileFromBouquets(
          newSettings.selectedBouquets,
          newSettings.tvProfile
        );
      const syncedSources = syncSourcesWithSelectedBouquets(
        newSettings.selectedBouquets,
        newSettings.sources,
        resolvedProfile
      );
      const finalizedSettings: AppSettings = {
        ...newSettings,
        tvProfile: resolvedProfile,
        sources: syncedSources,
      };

      const prevSignature = buildSourcesSignature(settings);
      const nextSignature = buildSourcesSignature(finalizedSettings);
      const signatureChanged = prevSignature !== nextSignature;

      setSettings(finalizedSettings);
      saveAppSettings(finalizedSettings);

      if (
        selectedSatellite !== 'Tous' &&
        !isSatelliteFilterAllowedBySettings(
          selectedSatellite,
          finalizedSettings.selectedBouquets
        )
      ) {
        setSelectedSatellite('Tous');
        setSelectedBouquet('Tous');
        setSelectedBouquetsList([]);
      } else if (
        selectedBouquet !== 'Tous' &&
        !isBouquetFilterAllowedBySettings(
          selectedBouquet,
          finalizedSettings.selectedBouquets
        )
      ) {
        setSelectedBouquet('Tous');
        setSelectedBouquetsList([]);
      }

      // Construit un snapshot de base filtré pour le nouveau profil afin que les chaînes
      // d'un nouveau profil activé soient immédiatement disponibles en mémoire
      const profileFallback =
        buildOfflineFallbackEpgSnapshot(finalizedSettings);

      const allowedFromExisting = channels.filter((ch) =>
        isChannelAllowedBySettings(ch, finalizedSettings)
      );
      const { favoriteChannels: favResolved } = resolveGlobalFavoriteChannels(
        channels,
        schedulesByChannel,
        favorites
      );

      const mergedMap = new Map<string, EpgChannel>();
      for (const ch of allowedFromExisting) mergedMap.set(ch.id, ch);
      for (const ch of profileFallback.channels) {
        if (!mergedMap.has(ch.id)) {
          mergedMap.set(ch.id, ch);
        }
      }
      for (const ch of favResolved) mergedMap.set(ch.id, ch);

      const purgedChannels = Array.from(mergedMap.values());
      const allowedChannelIds = new Set(
        purgedChannels.flatMap((c: EpgChannel) => [
          c.id,
          cleanXmltvChannelId(c.id),
        ])
      );
      const purgedSchedules: Record<string, EpgProgramme[]> = {};
      let remainingProgCount = 0;

      for (const chId of Object.keys(schedulesByChannel)) {
        if (
          allowedChannelIds.has(chId) ||
          allowedChannelIds.has(cleanXmltvChannelId(chId))
        ) {
          purgedSchedules[chId] = schedulesByChannel[chId];
          remainingProgCount += schedulesByChannel[chId].length;
        }
      }
      for (const chId of Object.keys(profileFallback.schedulesByChannel)) {
        if (
          !purgedSchedules[chId] &&
          (allowedChannelIds.has(chId) ||
            allowedChannelIds.has(cleanXmltvChannelId(chId)))
        ) {
          purgedSchedules[chId] = profileFallback.schedulesByChannel[chId];
          remainingProgCount += profileFallback.schedulesByChannel[chId].length;
        }
      }

      setChannels(purgedChannels);
      setSchedulesByChannel(purgedSchedules);

      if (selectedChannel && !allowedChannelIds.has(selectedChannel.id)) {
        setSelectedChannel(null);
        setSelectedModalProgramme(null);
      }

      const updatedMeta: EpgCacheMetadata = {
        ...(cacheMeta || profileFallback.metadata),
        sourcesSignature: nextSignature,
        channelCount: purgedChannels.length,
        programmeCount: remainingProgCount,
      };
      setCacheMeta(updatedMeta);
      try {
        await saveEpgToCache(updatedMeta, purgedChannels, purgedSchedules);
      } catch {
        // Ignore quota error
      }

      if (forceReload || signatureChanged) {
        triggerEpgSync(finalizedSettings);
      }
    },
    [
      settings,
      channels,
      schedulesByChannel,
      selectedChannel,
      selectedSatellite,
      selectedBouquet,
      cacheMeta,
      favorites,
      triggerEpgSync,
    ]
  );

  const handleResetDefaults = useCallback(() => {
    const detected = detectInitialTvProfileFromSystemLanguage();
    const reset: AppSettings = {
      ...DEFAULT_SETTINGS,
      language: detected.language,
      tvProfile: detected.tvProfile,
      selectedBouquets: [...detected.selectedBouquets],
      sources: syncSourcesWithSelectedBouquets(
        detected.selectedBouquets,
        DEFAULT_EPG_SOURCES,
        detected.tvProfile
      ),
    };
    setSettings(reset);
    saveAppSettings(reset);
    const fallback = buildOfflineFallbackEpgSnapshot(reset);
    setChannels(fallback.channels);
    setSchedulesByChannel(fallback.schedulesByChannel);
    setCacheMeta(fallback.metadata);
    triggerEpgSync(reset);
  }, [triggerEpgSync]);

  const handleClearCache = useCallback(async () => {
    await clearEpgCache();
    setCacheMeta(null);
    triggerEpgSync(settings);
  }, [settings, triggerEpgSync]);

  const shiftTimeOffsetMinutes = useCallback((deltaMinutes: number) => {
    setTimeOffsetMinutes((prev) => {
      const next = prev + deltaMinutes;
      setActiveTimePreset(next === 0 ? 'now' : next < 0 ? 'minus' : 'plus');
      return next;
    });
  }, []);

  const handleSyncToLive = useCallback(() => {
    setNowMs(Date.now());
    setTimeOffsetMinutes(0);
    setActiveTimePreset('now');
    setLiveSyncCount((prev) => prev + 1);
  }, []);

  const jumpToPrimeTimeTonight = useCallback(() => {
    const currentRealNow = Date.now();
    setNowMs(currentRealNow);
    const referenceDayMs =
      viewMode === 'grid'
        ? currentRealNow + timeOffsetMinutes * 60000
        : currentRealNow;
    const target = getCasablancaTimestampForHour(referenceDayMs, 20, 45);
    const diffMins = Math.round((target - currentRealNow) / 60000);
    setTimeOffsetMinutes(diffMins);
    setActiveTimePreset('prime');
  }, [viewMode, timeOffsetMinutes]);

  const handleSelectCustomDateTime = useCallback((targetMs: number) => {
    const currentRealNow = Date.now();
    setNowMs(currentRealNow);
    const diffMins = Math.round((targetMs - currentRealNow) / 60000);
    setTimeOffsetMinutes(diffMins);
    setActiveTimePreset(
      diffMins === 0 ? 'now' : diffMins < 0 ? 'minus' : 'plus'
    );
  }, []);

  const isTimeViewOffset =
    viewMode === 'grid' &&
    (timeOffsetMinutes !== 0 || activeTimePreset !== 'now');

  const formattedOffsetBadge = useMemo(() => {
    if (activeTimePreset === 'prime') {
      return 'Prime 20:45';
    }
    const hours = Math.round((timeOffsetMinutes / 60) * 10) / 10;
    return `${hours > 0 ? '+' : ''}${hours}h`;
  }, [activeTimePreset, timeOffsetMinutes]);

  const resetAllFilters = () => {
    setSelectedCategory('Tous');
    setSelectedSatellite('Tous');
    setSelectedBouquet('Tous');
    setSelectedBouquetsList([]);
    setSelectedCountry('Tous');
    setRamWarningMessage(null);
    setSelectedGroup('Tous');
    setSearchQuery('');
    handleSyncToLive();
  };

  const reminderIdSet = useMemo(
    () => new Set(reminders.map((r) => r.id)),
    [reminders]
  );

  const handleSelectChannelFromRow = useCallback(
    (channel: EpgChannel, currentProg?: EpgProgramme | null) => {
      setSelectedChannel(channel);
      setSelectedModalProgramme(currentProg ?? null);
    },
    []
  );

  // Initialisation du ResizeObserver partagé pour mesurer dynamiquement la hauteur réelle des cartes visibles
  useEffect(() => {
    if (typeof window === 'undefined' || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      let hasChange = false;
      for (const entry of entries) {
        const chId = rowNodeToChannelIdMapRef.current.get(entry.target);
        if (!chId) continue;
        const measured =
          (entry.target as HTMLElement).offsetHeight ||
          Math.round(entry.contentRect.height);
        if (measured > 0) {
          const prev = measuredRowHeightsRef.current.get(chId);
          if (prev === undefined || Math.abs(prev - measured) > 1) {
            measuredRowHeightsRef.current.set(chId, measured);
            hasChange = true;
          }
        }
      }

      if (hasChange && measureRafRef.current === null) {
        measureRafRef.current = window.requestAnimationFrame(() => {
          measureRafRef.current = null;
          setHeightMeasureVersion((v) => v + 1);
        });
      }
    });

    rowResizeObserverRef.current = observer;
    return () => {
      observer.disconnect();
      rowResizeObserverRef.current = null;
      if (measureRafRef.current !== null) {
        window.cancelAnimationFrame(measureRafRef.current);
        measureRafRef.current = null;
      }
    };
  }, []);

  const getRowMeasureRef = useCallback((channelId: string) => {
    let cb = rowMeasureCallbacksRef.current.get(channelId);
    if (!cb) {
      cb = (el: HTMLDivElement | null) => {
        if (!el) return;
        rowNodeToChannelIdMapRef.current.set(el, channelId);
        rowResizeObserverRef.current?.observe(el);
        const h = el.offsetHeight;
        if (h > 0) {
          const prev = measuredRowHeightsRef.current.get(channelId);
          if (prev === undefined || Math.abs(prev - h) > 1) {
            measuredRowHeightsRef.current.set(channelId, h);
            if (measureRafRef.current === null && typeof window !== 'undefined') {
              measureRafRef.current = window.requestAnimationFrame(() => {
                measureRafRef.current = null;
                setHeightMeasureVersion((v) => v + 1);
              });
            }
          }
        }
      };
      rowMeasureCallbacksRef.current.set(channelId, cb);
    }
    return cb;
  }, []);

  // Écouteurs passifs de défilement (scroll) et redimensionnement (resize) cadencés par requestAnimationFrame
  useEffect(() => {
    if (typeof window === 'undefined' || viewMode === 'grid' || viewMode === 'reminders') {
      return;
    }

    let rafId: number | null = null;

    const syncViewportMetrics = () => {
      rafId = null;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const viewportHeight = Math.max(window.innerHeight || 720, 480);
      const isDesktopLayout = window.innerWidth >= 1024;
      let listOffsetTop = virtualViewportRef.current.listOffsetTop;

      if (virtualListContainerRef.current) {
        const rect = virtualListContainerRef.current.getBoundingClientRect();
        listOffsetTop = Math.max(0, rect.top + scrollTop);
      }

      setVirtualViewport((prev) => {
        if (
           prev.isDesktopLayout !== isDesktopLayout ||
          Math.abs(prev.scrollTop - scrollTop) >= 14 ||
          Math.abs(prev.viewportHeight - viewportHeight) >= 12 ||
          Math.abs(prev.listOffsetTop - listOffsetTop) >= 8
        ) {
          if (prev.isDesktopLayout !== isDesktopLayout) {
            measuredRowHeightsRef.current.clear();
          }
          return {
            scrollTop,
            viewportHeight,
            listOffsetTop,
            isDesktopLayout,
          };
        }
        return prev;
      });
    };

    const handleScrollOrResize = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(syncViewportMetrics);
      }
    };

    syncViewportMetrics();
    window.addEventListener('scroll', handleScrollOrResize, { passive: true });
    window.addEventListener('resize', handleScrollOrResize, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize);
      window.removeEventListener('resize', handleScrollOrResize);
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, [viewMode, filteredChannels.length]);

  // Calcul de la fenêtre virtuelle (Windowing) : offsets cumulés, recherche binaire et spacers haut/bas
  const virtualWindow = useMemo(() => {
    const count = filteredChannels.length;
    const defaultRowHeight = virtualViewport.isDesktopLayout ? 116 : 196;
    const offsets = new Float64Array(count);
    const heights = new Float64Array(count);

    let currentTop = 0;
    for (let i = 0; i < count; i++) {
      const ch = filteredChannels[i];
      const h = measuredRowHeightsRef.current.get(ch.id) || defaultRowHeight;
      offsets[i] = currentTop;
      heights[i] = h;
      currentTop += h + (i < count - 1 ? VIRTUAL_ROW_GAP : 0);
    }
    const totalHeight = currentTop;

    if (count === 0) {
      return {
        startIndex: 0,
        endIndex: -1,
        topSpacerPx: 0,
        bottomSpacerPx: 0,
        totalHeight: 0,
        totalCount: 0,
        items: [] as EpgChannel[],
        offsets,
        heights,
      };
    }

    const relScrollTop = Math.max(
      0,
      virtualViewport.scrollTop - virtualViewport.listOffsetTop
    );
    const relScrollBottom =
      relScrollTop + Math.max(virtualViewport.viewportHeight, 720);

    // Recherche binaire du premier élément visible
    let low = 0;
    let high = count - 1;
    let firstVisibleIdx = 0;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (offsets[mid] + heights[mid] >= relScrollTop) {
        firstVisibleIdx = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    // Recherche binaire du dernier élément visible
    low = firstVisibleIdx;
    high = count - 1;
    let lastVisibleIdx = firstVisibleIdx;
    while (low <= high) {
      const mid = (low + high) >>> 1;
      if (offsets[mid] <= relScrollBottom) {
        lastVisibleIdx = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    let startIndex = Math.max(0, firstVisibleIdx - VIRTUAL_OVERSCAN_COUNT);
    let endIndex = Math.min(
      count - 1,
      Math.max(
        firstVisibleIdx + VIRTUAL_INITIAL_MIN_ITEMS - 1,
        lastVisibleIdx + VIRTUAL_OVERSCAN_COUNT
      )
    );

    // Garantit que la carte ciblée au D-Pad Android TV (ou le dernier index mémorisé) et ses voisines immédiates sont montées
    const pinnedIndex =
      focusedChannelIndex !== null
        ? focusedChannelIndex
        : lastFocusedChannelIndex;
    if (
      pinnedIndex !== null &&
      pinnedIndex >= 0 &&
      pinnedIndex < count &&
      (focusedChannelIndex !== null ||
        Math.abs(pinnedIndex - firstVisibleIdx) <= 30)
    ) {
      startIndex = Math.min(
        startIndex,
        Math.max(0, pinnedIndex - VIRTUAL_OVERSCAN_COUNT)
      );
      endIndex = Math.max(
        endIndex,
        Math.min(count - 1, pinnedIndex + VIRTUAL_OVERSCAN_COUNT)
      );
    }

    const topSpacerPx = startIndex > 0 ? offsets[startIndex] : 0;
    const endBottomPx =
      endIndex >= 0 && endIndex < count
        ? offsets[endIndex] + heights[endIndex]
        : 0;
    const bottomSpacerPx = Math.max(0, totalHeight - endBottomPx);

    return {
      startIndex,
      endIndex,
      topSpacerPx,
      bottomSpacerPx,
      totalHeight,
      totalCount: count,
      items: filteredChannels.slice(startIndex, endIndex + 1),
      offsets,
      heights,
    };
  }, [
    filteredChannels,
    virtualViewport,
    focusedChannelIndex,
    lastFocusedChannelIndex,
    heightMeasureVersion,
  ]);

  const virtualWindowRef = useRef(virtualWindow);
  virtualWindowRef.current = virtualWindow;

  const visibleChannels = virtualWindow.items;

  // Enrichissement automatique en arrière-plan (dans la langue active) des programmes actuellement visibles dans la fenêtre virtuelle
  useEffect(() => {
    if (viewMode === 'grid' || viewMode === 'reminders' || visibleChannels.length === 0) return;

    let cancelled = false;
    const subset = visibleChannels.slice(0, 12);

    const timer = setTimeout(async () => {
      for (const ch of subset) {
        if (cancelled) break;
        const curr = currentAndNextByChannel[ch.id]?.current;
        if (
          curr &&
          !curr.enrichedSource &&
          (ch.contentCategory === 'Films & Séries' ||
            ch.contentCategory === 'Documentaires')
        ) {
          try {
            const enriched = await enrichProgrammeMetadata(curr, activeLang);
            if (
              !cancelled &&
              enriched.enrichedSource &&
              enriched.enrichedSource !== 'fallback'
            ) {
              setSchedulesByChannel((prev) => {
                const channelList = prev[ch.id];
                if (!channelList) return prev;
                const idx = channelList.findIndex((p) => p.id === curr.id);
                if (idx === -1) return prev;
                const updated = [...channelList];
                updated[idx] = enriched;
                return { ...prev, [ch.id]: updated };
              });
            }
          } catch {
            // Ignore enrichment error
          }
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [visibleChannels, viewMode, currentAndNextByChannel, activeLang]);

  // Auto-focus du premier élément interactif à l'ouverture d'un modal (Android TV D-Pad)
  useEffect(() => {
    if (!selectedChannel && !isSettingsOpen) return;
    const timer = setTimeout(() => {
      const modalEl = document.querySelector<HTMLElement>(
        '[data-tv-modal="true"]'
      );
      if (!modalEl) return;
      const firstFocusable = modalEl.querySelector<HTMLElement>(
        '[data-programme-card="true"], button:not([disabled]), [role="button"], select:not([disabled]), input:not([disabled])'
      );
      firstFocusable?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedChannel, isSettingsOpen]);

  // Déclencheur d'animation de transition inter-zones dans la machine à états D-Pad
  const triggerZoneTransition = useCallback(
    (
      fromZone: 'header' | 'filters' | 'channels' | null,
      toZone: 'header' | 'filters' | 'channels',
      direction: 'up' | 'down' | 'left' | 'right' | 'jump'
    ) => {
      if (zoneTransitionTimerRef.current) {
        clearTimeout(zoneTransitionTimerRef.current);
      }
      const isCrossZone = fromZone !== null && fromZone !== toZone;
      setActiveDpadZone(toZone);
      setDpadState((prev) => ({
        ...prev,
        previousZone: isCrossZone ? fromZone : prev.previousZone,
        lastDirection: direction,
        isZoneTransitioning: isCrossZone,
        transitionSeq: prev.transitionSeq + 1,
      }));
      if (isCrossZone) {
        zoneTransitionTimerRef.current = setTimeout(() => {
          setDpadState((prev) => ({
            ...prev,
            isZoneTransitioning: false,
          }));
        }, 380);
      }
    },
    []
  );

  // Fonction déterministe de la machine à états pour focaliser précisément un index de la liste des chaînes
  const focusChannelAtIndex = useCallback(
    (
      targetIndex: number,
      actionCol = 0,
      direction: 'up' | 'down' | 'left' | 'right' | 'jump' = 'down'
    ): boolean => {
      const totalCount = virtualWindowRef.current.totalCount;
      if (totalCount <= 0) return false;

      const clampedIdx = Math.max(0, Math.min(totalCount - 1, targetIndex));
      const prevZone = activeDpadZoneRef.current;

      lastFocusedChannelIndexRef.current = clampedIdx;
      setLastFocusedChannelIndex(clampedIdx);
      setFocusedChannelIndex(clampedIdx);
      setActiveFilterRow(null);
      triggerZoneTransition(prevZone, 'channels', direction);
      setDpadState((prev) => ({
        ...prev,
        channelActionCol: actionCol,
      }));

      const applyCardFocus = (cardEl: HTMLElement) => {
        if (actionCol > 0) {
          const actions = Array.from(
            cardEl.querySelectorAll<HTMLElement>(
              '[data-channel-reminder="true"], [data-channel-fav="true"]'
            )
          ).filter((btn) => {
            const r = btn.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
          const targetAction = actions[Math.min(actionCol - 1, actions.length - 1)];
          if (targetAction) {
            targetAction.focus({ preventScroll: true });
            cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
        }
        cardEl.focus({ preventScroll: true });
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      };

      const existingCard = document.querySelector<HTMLElement>(
        `[data-channel-card="true"][data-channel-index="${clampedIdx}"]`
      );
      if (existingCard) {
        applyCardFocus(existingCard);
        return true;
      }

      const targetTop =
        virtualViewportRef.current.listOffsetTop +
        (virtualWindowRef.current.offsets[clampedIdx] || 0) -
        window.innerHeight * 0.38;
      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: 'auto',
      });
      window.requestAnimationFrame(() => {
        const mountedCard = document.querySelector<HTMLElement>(
          `[data-channel-card="true"][data-channel-index="${clampedIdx}"]`
        );
        if (mountedCard) {
          applyCardFocus(mountedCard);
        }
      });
      return true;
    },
    [triggerZoneTransition]
  );

  // Fonction déterministe de la machine à états pour focaliser une ligne de filtres (avec mémoire de colonne)
  const focusFilterGridRow = useCallback(
    (
      targetRowStrategy: 'first' | 'last' | number,
      options?: {
        preferCenterX?: number;
        preferRememberedCol?: boolean;
        direction?: 'up' | 'down' | 'left' | 'right' | 'jump';
      }
    ): boolean => {
      const filterZone = document.querySelector<HTMLElement>(
        '[data-tv-zone="filters"]'
      );
      if (!filterZone) return false;

      const selector =
        'button:not([disabled]), [role="button"]:not([tabindex="-1"]), a[href], select:not([disabled]), input:not([disabled])';

      const visibleRows = Array.from(
        filterZone.querySelectorAll<HTMLElement>('[data-tv-row]')
      ).filter((row) => {
        const r = row.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) return false;
        const items = Array.from(row.querySelectorAll<HTMLElement>(selector)).filter(
          (el) => {
            const er = el.getBoundingClientRect();
            return er.width > 0 && er.height > 0;
          }
        );
        return items.length > 0;
      });

      if (visibleRows.length === 0) return false;

      const rowIdx =
        targetRowStrategy === 'first'
          ? 0
          : targetRowStrategy === 'last'
          ? visibleRows.length - 1
          : Math.max(0, Math.min(visibleRows.length - 1, targetRowStrategy));

      const targetRow = visibleRows[rowIdx];
      const rowName = targetRow.getAttribute('data-tv-row') || `row-${rowIdx}`;
      const rowItems = Array.from(
        targetRow.querySelectorAll<HTMLElement>(selector)
      ).filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      });

      if (rowItems.length === 0) return false;

      let chosenItem = rowItems[0];
      let chosenColIdx = 0;

      const rememberedCol = filterRowColMemoryRef.current[rowName];
      const activeChipIdx = rowItems.findIndex(
        (b) => b.getAttribute('data-filter-active') === 'true'
      );

      if (
        options?.preferRememberedCol &&
        rememberedCol !== undefined &&
        rememberedCol >= 0 &&
        rememberedCol < rowItems.length
      ) {
        chosenColIdx = rememberedCol;
        chosenItem = rowItems[chosenColIdx];
      } else if (options?.preferRememberedCol && activeChipIdx !== -1) {
        chosenColIdx = activeChipIdx;
        chosenItem = rowItems[activeChipIdx];
      } else if (options?.preferCenterX !== undefined) {
        let minHorizDist = Infinity;
        rowItems.forEach((item, idx) => {
          const ir = item.getBoundingClientRect();
          const icx = ir.left + ir.width / 2;
          const dist = Math.abs(icx - options.preferCenterX!);
          if (dist < minHorizDist) {
            minHorizDist = dist;
            chosenItem = item;
            chosenColIdx = idx;
          }
        });
      } else if (activeChipIdx !== -1) {
        chosenColIdx = activeChipIdx;
        chosenItem = rowItems[activeChipIdx];
      }

      filterRowColMemoryRef.current[rowName] = chosenColIdx;
      const prevZone = activeDpadZoneRef.current;
      setFocusedChannelIndex(null);
      setActiveFilterRow(rowName);
      triggerZoneTransition(
        prevZone,
        'filters',
        options?.direction || 'up'
      );
      setDpadState((prev) => ({
        ...prev,
        filterRowIndex: rowIdx,
        totalFilterRows: visibleRows.length,
        filterColIndex: chosenColIdx,
      }));

      chosenItem.focus({ preventScroll: true });
      chosenItem.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
      return true;
    },
    [triggerZoneTransition]
  );

  // Suivi en temps réel de la machine à états de focus D-Pad (En-tête, Lignes de Filtres, Liste des Chaînes)
  useEffect(() => {
    const selector =
      'button:not([disabled]), [role="button"]:not([tabindex="-1"]), a[href], select:not([disabled]), input:not([disabled])';

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const channelCard = target.closest<HTMLElement>('[data-channel-card="true"]');
      if (channelCard) {
        const prevZone = activeDpadZoneRef.current;
        const idxAttr = channelCard.getAttribute('data-channel-index');
        const parsedIdx = idxAttr !== null ? Number(idxAttr) : 0;
        if (!Number.isNaN(parsedIdx) && parsedIdx >= 0) {
          lastFocusedChannelIndexRef.current = parsedIdx;
          setLastFocusedChannelIndex(parsedIdx);
          setFocusedChannelIndex(parsedIdx);
        }
        const actions = Array.from(
          channelCard.querySelectorAll<HTMLElement>(
            '[data-channel-reminder="true"], [data-channel-fav="true"]'
          )
        );
        const actionIdx = actions.indexOf(target);
        setActiveFilterRow(null);
        triggerZoneTransition(
          prevZone,
          'channels',
          prevZone === 'filters' ? 'down' : 'jump'
        );
        setDpadState((prev) => ({
          ...prev,
          channelActionCol: actionIdx >= 0 ? actionIdx + 1 : 0,
        }));
        return;
      }

      const tvRow = target.closest<HTMLElement>('[data-tv-row]');
      if (tvRow) {
        const rowName = tvRow.getAttribute('data-tv-row') || '';
        const rowItems = Array.from(
          tvRow.querySelectorAll<HTMLElement>(selector)
        ).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const colIdx = Math.max(0, rowItems.indexOf(target));
        filterRowColMemoryRef.current[rowName] = colIdx;

        if (rowName === 'header-tabs' || rowName === 'header-actions') {
          const prevZone = activeDpadZoneRef.current;
          setFocusedChannelIndex(null);
          setActiveFilterRow(null);
          triggerZoneTransition(prevZone, 'header', 'up');
        } else {
          const prevZone = activeDpadZoneRef.current;
          const filterZone = tvRow.closest<HTMLElement>('[data-tv-zone="filters"]');
          const visibleRows = filterZone
            ? Array.from(
                filterZone.querySelectorAll<HTMLElement>('[data-tv-row]')
              ).filter((rEl) => {
                const r = rEl.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              })
            : [];
          const rIdx = Math.max(0, visibleRows.indexOf(tvRow));
          setFocusedChannelIndex(null);
          setActiveFilterRow(rowName);
          triggerZoneTransition(
            prevZone,
            'filters',
            prevZone === 'channels' ? 'up' : 'down'
          );
          setDpadState((prev) => ({
            ...prev,
            filterRowIndex: rIdx,
            totalFilterRows: visibleRows.length,
            filterColIndex: colIdx,
          }));
        }
        return;
      }

      if (target.closest('[data-tv-zone="filters"]')) {
        const prevZone = activeDpadZoneRef.current;
        setFocusedChannelIndex(null);
        triggerZoneTransition(
          prevZone,
          'filters',
          prevZone === 'channels' ? 'up' : 'down'
        );
        return;
      }
    };

    window.addEventListener('focusin', handleFocusIn);
    return () => window.removeEventListener('focusin', handleFocusIn);
  }, [triggerZoneTransition]);

  // Machine à états de navigation en grille (D-Pad Grid-Navigation State Machine) pour Android TV
  useEffect(() => {
    const handleGlobalDpadKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      const isTextInput =
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') &&
        (activeEl as HTMLInputElement).type !== 'checkbox';

      if (
        e.key === 'Escape' ||
        e.key === 'BrowserBack' ||
        e.key === 'GoBack' ||
        (e.key === 'Backspace' && !isTextInput)
      ) {
        if (isSearchDropdownOpen) {
          e.preventDefault();
          setIsSearchDropdownOpen(false);
          return;
        }
        if (selectedChannel) {
          e.preventDefault();
          setSelectedChannel(null);
          setSelectedModalProgramme(null);
          return;
        }
        if (isSettingsOpen) {
          e.preventDefault();
          setIsSettingsOpen(false);
          return;
        }
      }

      // Raccourci PageUp / PageDown pour basculer instantanément entre Lignes de Filtres et Liste des Chaînes (sur le dernier index focalisé)
      if (!modalScopeExists() && !isTextInput) {
        if (e.key === 'PageUp' && activeDpadZoneRef.current === 'channels') {
          e.preventDefault();
          focusFilterGridRow('last', {
            preferRememberedCol: true,
            direction: 'up',
          });
          return;
        }
        if (e.key === 'PageDown' && activeDpadZoneRef.current === 'filters') {
          e.preventDefault();
          focusChannelAtIndex(lastFocusedChannelIndexRef.current, 0, 'down');
          return;
        }
      }

      if (
        e.key !== 'ArrowUp' &&
        e.key !== 'ArrowDown' &&
        e.key !== 'ArrowLeft' &&
        e.key !== 'ArrowRight'
      ) {
        return;
      }

      // Laisser l'utilisateur déplacer son curseur dans un champ texte avec Gauche/Droite
      if (isTextInput && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        return;
      }

      // Si le focus est dans la Grille TV et que ce n'est pas une sortie par le haut (ligne 0),
      // laisser le gestionnaire dédié de TimeGridView agir
      if (activeEl?.getAttribute('data-grid-focusable') === 'true') {
        const gridRow = Number(activeEl.getAttribute('data-grid-row') || '0');
        if (!(e.key === 'ArrowUp' && gridRow === 0)) {
          return;
        }
      }

      function modalScopeExists() {
        return Boolean(
          document.querySelector<HTMLElement>('[data-tv-modal="true"]')
        );
      }

      const modalScope = document.querySelector<HTMLElement>(
        '[data-tv-modal="true"]'
      );
      const rootScope: ParentNode = modalScope || document;

      // ========================================================================
      // ÉTAT 1 : ZONE LISTE DES CHAÎNES ([data-channel-card="true"])
      // Navigation 2D (Lignes = Chaînes virtualisées, Colonnes = Carte / Rappel / Favori)
      // ========================================================================
      const parentChannelCard = activeEl?.closest<HTMLElement>(
        '[data-channel-card="true"]'
      );
      if (parentChannelCard && !modalScope) {
        const rawIdx = parentChannelCard.getAttribute('data-channel-index');
        const virtualIdx =
          rawIdx !== null ? Number(rawIdx) : lastFocusedChannelIndexRef.current;
        if (!Number.isNaN(virtualIdx) && virtualIdx >= 0) {
          lastFocusedChannelIndexRef.current = virtualIdx;
        }

        const cardActions = Array.from(
          parentChannelCard.querySelectorAll<HTMLElement>(
            '[data-channel-reminder="true"], [data-channel-fav="true"]'
          )
        ).filter((btn) => {
          const r = btn.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });

        const isRtl = document.documentElement.dir === 'rtl';
        const forwardKey = isRtl ? 'ArrowLeft' : 'ArrowRight';
        const backwardKey = isRtl ? 'ArrowRight' : 'ArrowLeft';

        if (e.key === forwardKey) {
          if (activeEl === parentChannelCard && cardActions.length > 0) {
            e.preventDefault();
            cardActions[0].focus({ preventScroll: true });
            return;
          }
          const actionIdx = activeEl ? cardActions.indexOf(activeEl) : -1;
          if (actionIdx >= 0 && actionIdx < cardActions.length - 1) {
            e.preventDefault();
            cardActions[actionIdx + 1].focus({ preventScroll: true });
            return;
          }
        }

        if (e.key === backwardKey) {
          const actionIdx = activeEl ? cardActions.indexOf(activeEl) : -1;
          if (actionIdx > 0) {
            e.preventDefault();
            cardActions[actionIdx - 1].focus({ preventScroll: true });
            return;
          }
          if (actionIdx === 0) {
            e.preventDefault();
            parentChannelCard.focus({ preventScroll: true });
            return;
          }
          // Depuis la colonne 0 d'une carte de chaîne, Flèche Gauche remonte directement aux lignes de filtres
          // tout en conservant lastFocusedChannelIndex intact pour un retour exact !
          if (activeEl === parentChannelCard) {
            if (
              focusFilterGridRow('last', {
                preferRememberedCol: true,
                direction: 'up',
              })
            ) {
              e.preventDefault();
              return;
            }
          }
        }

        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          const totalCount = virtualWindowRef.current.totalCount;

          if (virtualIdx >= 0 && totalCount > 0) {
            if (e.key === 'ArrowDown') {
              if (virtualIdx < totalCount - 1) {
                e.preventDefault();
                focusChannelAtIndex(virtualIdx + 1, 0, 'down');
                return;
              }
            } else if (e.key === 'ArrowUp') {
              if (virtualIdx > 0) {
                e.preventDefault();
                focusChannelAtIndex(virtualIdx - 1, 0, 'up');
                return;
              } else {
                // virtualIdx === 0 : transition vers la dernière ligne de filtres (lastFocusedChannelIndex reste mémorisé à 0)
                lastFocusedChannelIndexRef.current = 0;
                setLastFocusedChannelIndex(0);
                if (
                  focusFilterGridRow('last', {
                    preferRememberedCol: true,
                    direction: 'up',
                  })
                ) {
                  e.preventDefault();
                  return;
                }
              }
            }
          }
        }
      }

      // 1B. Navigation déterministe sur la liste chronologique "Mes Rappels"
      const parentReminderCard = activeEl?.closest<HTMLElement>(
        '[data-reminder-card="true"]'
      );
      if (parentReminderCard && !modalScope) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          const remCards = Array.from(
            document.querySelectorAll<HTMLElement>('[data-reminder-card="true"]')
          ).filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
          const idx = remCards.indexOf(parentReminderCard);
          if (e.key === 'ArrowDown' && idx >= 0 && idx < remCards.length - 1) {
            e.preventDefault();
            const nextRem = remCards[idx + 1];
            nextRem.focus({ preventScroll: true });
            nextRem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          } else if (e.key === 'ArrowUp' && idx > 0) {
            e.preventDefault();
            const prevRem = remCards[idx - 1];
            prevRem.focus({ preventScroll: true });
            prevRem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
          }
        }
      }

      // 2. Navigation déterministe sur la liste chronologique des programmes dans la fiche chaîne
      const parentProgCard = activeEl?.closest<HTMLElement>(
        '[data-programme-card="true"]'
      );
      if (parentProgCard && modalScope) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          const progCards = Array.from(
            modalScope.querySelectorAll<HTMLElement>(
              '[data-programme-card="true"]'
            )
          ).filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0;
          });
          const idx = progCards.indexOf(parentProgCard);
          if (e.key === 'ArrowDown' && idx >= 0 && idx < progCards.length - 1) {
            e.preventDefault();
            const nextProg = progCards[idx + 1];
            nextProg.focus({ preventScroll: true });
            nextProg.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
            });
            return;
          } else if (e.key === 'ArrowUp' && idx > 0) {
            e.preventDefault();
            const prevProg = progCards[idx - 1];
            prevProg.focus({ preventScroll: true });
            prevProg.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
            });
            return;
          }
        }
      }

      const selector =
        'button:not([disabled]), [role="button"]:not([tabindex="-1"]), a[href], select:not([disabled]), input:not([disabled])';

      // ========================================================================
      // ÉTAT 2 : NAVIGATION HORIZONTALE DANS LES LIGNES ([data-tv-row])
      // ========================================================================
      const activeRow = activeEl?.closest<HTMLElement>('[data-tv-row]');
      if (
        activeRow &&
        activeEl &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        const rowName = activeRow.getAttribute('data-tv-row') || '';
        const rowItems = Array.from(
          activeRow.querySelectorAll<HTMLElement>(selector)
        ).filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        });
        const rowIdx = rowItems.indexOf(activeEl);
        if (rowIdx !== -1) {
          const isRtl = document.documentElement.dir === 'rtl';
          const step =
            (e.key === 'ArrowRight' ? 1 : -1) * (isRtl ? -1 : 1);
          const nextColIdx = rowIdx + step;
          const nextInRow = rowItems[nextColIdx];
          if (nextInRow) {
            e.preventDefault();
            filterRowColMemoryRef.current[rowName] = nextColIdx;
            setDpadState((prev) => ({
              ...prev,
              filterColIndex: nextColIdx,
              lastDirection: e.key === 'ArrowRight' ? 'right' : 'left',
            }));
            nextInRow.focus({ preventScroll: true });
            nextInRow.scrollIntoView({
              behavior: 'smooth',
              block: 'nearest',
              inline: 'center',
            });
            return;
          }
        }
      }

      // ========================================================================
      // ÉTAT 2B : NAVIGATION VERTICALE INTERNE AU HEADER & TRANSITION -> FILTRES
      // ========================================================================
      const parentHeaderZone = activeEl?.closest<HTMLElement>('header');
      if (
        parentHeaderZone &&
        !modalScope &&
        (e.key === 'ArrowDown' || e.key === 'ArrowUp')
      ) {
        const currentHeaderRowName =
          activeRow?.getAttribute('data-tv-row') || '';

        if (e.key === 'ArrowDown') {
          if (currentHeaderRowName === 'header-top') {
            const tabsRow = parentHeaderZone.querySelector<HTMLElement>(
              '[data-tv-row="header-tabs"]'
            );
            if (tabsRow) {
              const tabBtns = Array.from(
                tabsRow.querySelectorAll<HTMLElement>(selector)
              ).filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              });
              if (tabBtns.length > 0) {
                e.preventDefault();
                const rememberedTabIdx =
                  filterRowColMemoryRef.current['header-tabs'] ?? 0;
                const targetTab =
                  tabBtns[
                    Math.max(0, Math.min(tabBtns.length - 1, rememberedTabIdx))
                  ] || tabBtns[0];
                targetTab.focus({ preventScroll: true });
                targetTab.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest',
                });
                return;
              }
            }
          }

          if (
            focusFilterGridRow('first', {
              preferRememberedCol: true,
              direction: 'down',
            })
          ) {
            e.preventDefault();
            return;
          }
        } else if (
          e.key === 'ArrowUp' &&
          currentHeaderRowName === 'header-tabs'
        ) {
          const topRow = parentHeaderZone.querySelector<HTMLElement>(
            '[data-tv-row="header-top"]'
          );
          if (topRow) {
            const topBtns = Array.from(
              topRow.querySelectorAll<HTMLElement>(selector)
            ).filter((el) => {
              const r = el.getBoundingClientRect();
              return r.width > 0 && r.height > 0;
            });
            if (topBtns.length > 0) {
              e.preventDefault();
              const rememberedTopIdx =
                filterRowColMemoryRef.current['header-top'] ??
                topBtns.length - 1;
              const targetTop =
                topBtns[
                  Math.max(0, Math.min(topBtns.length - 1, rememberedTopIdx))
                ] || topBtns[topBtns.length - 1];
              targetTop.focus({ preventScroll: true });
              targetTop.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
              });
              return;
            }
          }
        }
      }

      // ========================================================================
      // ÉTAT 3 : MACHINE À ÉTATS DE LA GRILLE DE FILTRES ([data-tv-zone="filters"])
      // Transition verticale déterministe Ligne i <-> Ligne i+1
      // et atterrissage exact sur lastFocusedChannelIndex lors du passage aux chaînes
      // ========================================================================
      const parentFilterZone = activeEl?.closest<HTMLElement>(
        '[data-tv-zone="filters"]'
      );
      if (
        parentFilterZone &&
        activeEl &&
        !modalScope &&
        (e.key === 'ArrowDown' || e.key === 'ArrowUp')
      ) {
        const filterRows = Array.from(
          parentFilterZone.querySelectorAll<HTMLElement>('[data-tv-row]')
        ).filter((row) => {
          const r = row.getBoundingClientRect();
          if (r.width <= 0 || r.height <= 0) return false;
          const items = Array.from(
            row.querySelectorAll<HTMLElement>(selector)
          ).filter((el) => {
            const er = el.getBoundingClientRect();
            return er.width > 0 && er.height > 0;
          });
          return items.length > 0;
        });

        const currentRowIdx = activeRow ? filterRows.indexOf(activeRow) : -1;
        const curRect = activeEl.getBoundingClientRect();
        const curCenterX = curRect.left + curRect.width / 2;

        if (e.key === 'ArrowDown') {
          if (currentRowIdx !== -1 && currentRowIdx < filterRows.length - 1) {
            e.preventDefault();
            focusFilterGridRow(currentRowIdx + 1, {
              preferCenterX: curCenterX,
              direction: 'down',
            });
            return;
          } else {
            // Sortie de la dernière ligne de filtres (ou du bouton Reset) ->
            // Atterrissage PRÉCIS sur le dernier index focalisé de la liste des chaînes (lastFocusedChannelIndex)
            if (
              focusChannelAtIndex(
                lastFocusedChannelIndexRef.current,
                0,
                'down'
              )
            ) {
              e.preventDefault();
              return;
            }
          }
        } else if (e.key === 'ArrowUp') {
          if (currentRowIdx > 0) {
            e.preventDefault();
            focusFilterGridRow(currentRowIdx - 1, {
              preferCenterX: curCenterX,
              direction: 'up',
            });
            return;
          } else if (currentRowIdx === -1 && filterRows.length > 0) {
            e.preventDefault();
            focusFilterGridRow('last', {
              preferCenterX: curCenterX,
              direction: 'up',
            });
            return;
          } else if (currentRowIdx === 0) {
            // Remontée de la 1re ligne de filtres vers la barre d'en-tête (Header)
            const headerTabsRow = document.querySelector<HTMLElement>(
              '[data-tv-row="header-tabs"]'
            );
            if (headerTabsRow) {
              const headerBtns = Array.from(
                headerTabsRow.querySelectorAll<HTMLElement>(selector)
              ).filter((el) => {
                const r = el.getBoundingClientRect();
                return r.width > 0 && r.height > 0;
              });
              if (headerBtns.length > 0) {
                e.preventDefault();
                const rememberedIdx =
                  filterRowColMemoryRef.current['header-tabs'] ?? 0;
                const targetHeaderBtn =
                  headerBtns[
                    Math.max(0, Math.min(headerBtns.length - 1, rememberedIdx))
                  ] || headerBtns[0];
                triggerZoneTransition('filters', 'header', 'up');
                targetHeaderBtn.focus({ preventScroll: true });
                targetHeaderBtn.scrollIntoView({
                  behavior: 'smooth',
                  block: 'nearest',
                });
                return;
              }
            }
          }
        }
      }

      const allNodes = Array.from(
        rootScope.querySelectorAll<HTMLElement>(selector)
      ).filter((el) => {
        if (
          el.getAttribute('data-channel-fav') === 'true' ||
          el.getAttribute('data-channel-reminder') === 'true'
        ) {
          return false;
        }
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });

      if (allNodes.length === 0) return;

      if (!activeEl || activeEl === document.body || !rootScope.contains(activeEl)) {
        e.preventDefault();
        if (
          !modalScope &&
          viewMode !== 'grid' &&
          viewMode !== 'reminders' &&
          virtualWindowRef.current.totalCount > 0
        ) {
          focusChannelAtIndex(lastFocusedChannelIndexRef.current, 0, 'jump');
          return;
        }
        const initialTarget =
          rootScope.querySelector<HTMLElement>('[data-grid-focusable="true"]') ||
          allNodes[0];
        initialTarget.focus({ preventScroll: true });
        initialTarget.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
        return;
      }

      const curRect = activeEl.getBoundingClientRect();
      const cx = curRect.left + curRect.width / 2;
      const cy = curRect.top + curRect.height / 2;

      let bestCandidate: HTMLElement | null = null;
      let bestScore = Infinity;

      for (const el of allNodes) {
        if (el === activeEl || activeEl.contains(el)) continue;
        const r = el.getBoundingClientRect();
        const ex = r.left + r.width / 2;
        const ey = r.top + r.height / 2;
        const dx = ex - cx;
        const dy = ey - cy;

        if (e.key === 'ArrowRight' && dx > 6 && Math.abs(dy) < 56) {
          const score = dx + Math.abs(dy) * 4;
          if (score < bestScore) {
            bestScore = score;
            bestCandidate = el;
          }
        } else if (e.key === 'ArrowLeft' && dx < -6 && Math.abs(dy) < 56) {
          const score = Math.abs(dx) + Math.abs(dy) * 4;
          if (score < bestScore) {
            bestScore = score;
            bestCandidate = el;
          }
        } else if (e.key === 'ArrowDown' && dy > 12) {
          const horizDist =
            cx >= r.left && cx <= r.right
              ? 0
              : Math.min(Math.abs(cx - r.left), Math.abs(cx - r.right));
          const score = dy * 2.5 + horizDist * 0.35;
          if (score < bestScore) {
            bestScore = score;
            bestCandidate = el;
          }
        } else if (e.key === 'ArrowUp' && dy < -12) {
          const horizDist =
            cx >= r.left && cx <= r.right
              ? 0
              : Math.min(Math.abs(cx - r.left), Math.abs(cx - r.right));
          const score = Math.abs(dy) * 2.5 + horizDist * 0.35;
          if (score < bestScore) {
            bestScore = score;
            bestCandidate = el;
          }
        }
      }

      if (bestCandidate) {
        e.preventDefault();
        if (bestCandidate.getAttribute('data-channel-card') === 'true') {
          focusChannelAtIndex(
            lastFocusedChannelIndexRef.current,
            0,
            e.key === 'ArrowUp' ? 'up' : 'down'
          );
          return;
        }
        bestCandidate.focus({ preventScroll: true });
        bestCandidate.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      }
    };

    window.addEventListener('keydown', handleGlobalDpadKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalDpadKeyDown);
  }, [
    selectedChannel,
    isSettingsOpen,
    isSearchDropdownOpen,
    viewMode,
    focusChannelAtIndex,
    focusFilterGridRow,
    triggerZoneTransition,
  ]);

  return (
    <div
      dir={langOpt.dir}
      className="min-h-screen bg-[#0a0e17] text-[#ffffff] flex flex-col selection:bg-[#e11d48] selection:text-[#ffffff]"
    >
      {/* Top Navigation Bar — Layout Fixe avec Marges de Sécurité TV Overscan (16px-24px) */}
      <header
        data-tv-zone="header"
        data-dpad-active={activeDpadZone === 'header' ? 'true' : undefined}
        className="sticky top-0 z-30 w-full bg-[#0a0e17] border-b border-[#1a202c] pt-safe overflow-x-hidden"
      >
        <div className="max-w-[1600px] w-full mx-auto">
          {/* Ligne supérieure fixe : justify-between (Logo + Langue à gauche, Actions compactes Rafraîchir + Paramètres ⚙️ à droite avec marge Overscan 16px-24px) */}
          <div
            data-tv-row="header-top"
            className="tv-overscan-header-row w-full flex flex-nowrap items-center justify-between gap-2 py-2.5"
          >
            {/* Gauche : Logo + Sélecteur de Langue + Badge Zone/Profil TV */}
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="flex items-center gap-2 min-w-0 shrink-0">
                <PulseEpgLogo adaptiveTerminalSize={true} />
                <div className="hidden sm:block min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-sm sm:text-base 2xl:text-lg font-bold tracking-tight text-[#ffffff] truncate">
                      PulseEPG
                    </h1>
                    <span className="hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-[#1d4ed8]/25 text-[#ffffff] border border-[#0055ff]/60 shrink-0">
                      <Volume2 className="w-3 h-3 text-[#60a5fa]" />
                      VO + SUB
                    </span>
                  </div>
                  <p className="hidden sm:block text-[10px] font-normal text-[#cbd5e1] tracking-wide leading-tight truncate">
                    Your Ultimate TV Guide
                  </p>
                </div>
              </div>

              {/* Sélecteur de Langue calé à gauche */}
              <div className="relative flex items-center shrink-0">
                <Languages className="w-3.5 h-3.5 text-[#60a5fa] absolute start-2.5 pointer-events-none" />
                <select
                  value={activeLang}
                  onChange={(e) =>
                    handleChangeLanguage(e.target.value as AppLanguage)
                  }
                  aria-label={tr.languageSectionTitle}
                  className="ps-7 pe-5 py-1.5 rounded-lg bg-[#141a26] hover:bg-[#1a202c] text-xs font-medium text-[#ffffff] border border-[#0055ff]/60 focus:outline-none focus:border-[#e11d48] transition-colors cursor-pointer"
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option
                      key={opt.code}
                      value={opt.code}
                      className="bg-[#141a26] text-[#ffffff]"
                    >
                      {opt.flag} {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Bouton d'accès rapide au sélecteur "Zone / Profil TV" (écrans md+) */}
              {(() => {
                const currentProfileId =
                  settings.tvProfile ||
                  inferTvProfileFromBouquets(
                    settings.selectedBouquets,
                    settings.tvProfile
                  );
                const matchedSpec = TV_PROFILES_CATALOG.find(
                  (p) => p.id === currentProfileId
                );
                const badgeFlag = matchedSpec?.flag || '⚙️';
                const badgeLabel = matchedSpec?.shortLabel || 'Profil perso';
                return (
                  <button
                    type="button"
                    onClick={() => {
                      setSettingsInitialTab('filters');
                      setIsSettingsOpen(true);
                    }}
                    title="Changer de Zone / Profil TV (Paramètres)"
                    className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141a26] hover:bg-[#1a202c] text-xs font-semibold text-[#ffffff] border border-[#0055ff]/60 transition-colors cursor-pointer shrink-0"
                  >
                    <Globe className="w-3.5 h-3.5 text-[#60a5fa] shrink-0" />
                    <span>{badgeFlag}</span>
                    <span className="truncate max-w-[120px]">{badgeLabel}</span>
                  </button>
                );
              })()}
            </div>

            {/* Droite : Boutons d'actions compacts (PWA masqué sur APK, Icône Rafraîchir compacte & Icône Paramètres ⚙️ fixe shrink-0) */}
            <div className="flex items-center justify-end gap-2 shrink-0">
              <PWAInstallButton language={activeLang} />

              <button
                type="button"
                onClick={() => triggerEpgSync(settings)}
                disabled={isSyncing}
                className="tv-fixed-action-btn shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg bg-[#141a26] hover:bg-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] border border-[#1a202c] hover:border-[#0055ff]/60 transition-colors cursor-pointer disabled:opacity-50"
                title={isSyncing ? tr.refreshingBtn : tr.refreshBtn}
                aria-label={isSyncing ? tr.refreshingBtn : tr.refreshBtn}
              >
                <RefreshCw
                  className={`w-4 h-4 shrink-0 text-[#cbd5e1] ${
                    isSyncing ? 'animate-spin text-[#e11d48]' : ''
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => {
                  setSettingsInitialTab('filters');
                  setIsSettingsOpen(true);
                }}
                className="tv-fixed-action-btn shrink-0 w-9 h-9 inline-flex items-center justify-center rounded-lg bg-[#141a26] hover:bg-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] border border-[#1a202c] hover:border-[#0055ff]/60 transition-colors cursor-pointer"
                title={tr.settingsTitle}
                aria-label={tr.settingsTitle}
              >
                <Settings className="w-4 h-4 shrink-0" />
              </button>
            </div>
          </div>

          {/* Ligne de navigation des vues (En Direct / Grille TV / Favoris / Mes Rappels) */}
          <div
            data-tv-row="header-tabs"
            className="tv-overscan-tabs-row w-full flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2 border-t border-[#1a202c]"
          >
            <button
              type="button"
              onClick={() => {
                setNowMs(Date.now());
                setTimeOffsetMinutes(0);
                setActiveTimePreset('now');
                setViewMode('live');
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
                viewMode === 'live'
                  ? 'bg-[#e11d48] border border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_14px_rgba(225,29,72,0.5)]'
                  : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  viewMode === 'live'
                    ? 'bg-[#ffffff] shadow-[0_0_8px_#ffffff] animate-pulse'
                    : 'bg-[#e11d48]'
                }`}
              />
              <span>{tr.liveTab}</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
                viewMode === 'grid'
                  ? 'bg-[#e11d48] border border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_14px_rgba(225,29,72,0.5)]'
                  : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
              <span>{tr.gridTab}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedSatellite('Tous');
                setSelectedBouquet('Tous');
                setSelectedBouquetsList([]);
                setSelectedCountry('Tous');
                setSelectedCategory('Tous');
                setSelectedGroup('Tous');
                setViewMode('favorites');
              }}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
                viewMode === 'favorites'
                  ? 'bg-[#e11d48] border border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_14px_rgba(225,29,72,0.5)]'
                  : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
              }`}
            >
              <Heart
                className={`w-3.5 h-3.5 shrink-0 ${
                  viewMode === 'favorites'
                    ? 'text-[#ffffff] fill-[#ffffff]'
                    : favorites.length > 0
                      ? 'text-[#e11d48]'
                      : ''
                }`}
              />
              <span>{tr.favoritesTab}</span>
              {favorites.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    viewMode === 'favorites'
                      ? 'bg-[#0a0e17] text-[#ffffff] border border-[#ff0033]/60 font-bold'
                      : 'bg-[#1d4ed8]/25 text-[#ffffff] border border-[#0055ff]/50'
                  }`}
                >
                  {favorites.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setViewMode('reminders')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
                viewMode === 'reminders'
                  ? 'bg-gradient-to-r from-[#0055ff] to-[#ec4899] border border-[#ec4899] text-[#ffffff] font-bold shadow-[0_0_14px_rgba(236,72,153,0.55)]'
                  : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#ec4899]/70 font-medium'
              }`}
            >
              {hasImminentOrLiveReminder ? (
                <BellRing className="w-3.5 h-3.5 text-[#ec4899] animate-bounce shrink-0" />
              ) : (
                <Bell
                  className={`w-3.5 h-3.5 shrink-0 ${
                    viewMode === 'reminders'
                      ? 'text-[#ffffff]'
                      : activeRemindersCount > 0
                      ? 'text-[#ec4899]'
                      : ''
                  }`}
                />
              )}
              <span>
                {activeLang === 'fr'
                  ? 'Mes Rappels'
                  : activeLang === 'es'
                  ? 'Mis Recordatorios'
                  : activeLang === 'ar'
                  ? 'تذكيراتي'
                  : 'My Reminders'}
              </span>
              {reminders.length > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                    viewMode === 'reminders'
                      ? 'bg-[#0a0e17] text-[#ffffff] border border-[#ec4899]/80 font-bold'
                      : 'bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] font-bold'
                  }`}
                >
                  {activeRemindersCount || reminders.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content (10-Foot UI & TV Overscan 16px-24px compatible) */}
      <main className="tv-overscan-main flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 2xl:px-10 py-4 sm:py-5">
        {/* Bannière de progression Web Worker & État d'erreur visuel */}
        <LoadingStatusBanner
          progress={workerProgress}
          isSyncing={isSyncing}
          errorMessage={epgError}
          onRetry={() => triggerEpgSync(settings)}
          onLoadOfflineFallback={() => handleLoadOfflineFallback(settings)}
          language={activeLang}
        />

        {/* Barre de Recherche & Contrôle Temporel Rapide + Zone de Filtres D-Pad */}
        <div
          data-tv-zone="filters"
          data-dpad-active={activeDpadZone === 'filters' ? 'true' : undefined}
          data-dpad-transition={
            dpadState.isZoneTransitioning && activeDpadZone === 'filters'
              ? dpadState.lastDirection || 'jump'
              : undefined
          }
          className="mb-3 rounded-lg bg-[#141a26] border border-[#1a202c] p-3 sm:p-4 space-y-3"
        >
          <div
            data-tv-row="filter-search"
            data-row-active={
              activeFilterRow === 'filter-search' ? 'true' : undefined
            }
            className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3"
          >
            {/* Search Input & Recent Searches Dropdown */}
            <div ref={searchContainerRef} className="relative flex-1">
              <Search className="w-4 h-4 text-[#cbd5e1] absolute start-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onClick={() => setIsSearchDropdownOpen(true)}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  const val = e.target.value;
                  if (!val.trim()) {
                    isTypingSessionRef.current = false;
                  }
                  setSearchQuery(val);
                  setIsSearchDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    commitSearchToRecent(
                      searchQuery,
                      isTypingSessionRef.current
                    );
                    isTypingSessionRef.current = false;
                    setIsSearchDropdownOpen(false);
                  } else if (e.key === 'Escape') {
                    setIsSearchDropdownOpen(false);
                  }
                }}
                onBlur={() => {
                  if (searchQuery.trim()) {
                    commitSearchToRecent(
                      searchQuery,
                      isTypingSessionRef.current
                    );
                    isTypingSessionRef.current = false;
                  }
                }}
                placeholder={tr.searchPlaceholder}
                className="w-full ps-10 pe-9 py-2 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-xs sm:text-sm text-[#ffffff] placeholder-[#cbd5e1]/70 focus:outline-none focus:border-[#0055ff] transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    if (searchQuery.trim()) {
                      commitSearchToRecent(
                        searchQuery,
                        isTypingSessionRef.current
                      );
                    }
                    isTypingSessionRef.current = false;
                    setSearchQuery('');
                    setIsSearchDropdownOpen(true);
                  }}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-[#cbd5e1] hover:text-[#ffffff] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Recent Searches Dropdown */}
              {isSearchDropdownOpen && (
                <div
                  role="listbox"
                  aria-label="Recent Searches"
                  className="absolute start-0 end-0 top-full mt-1.5 z-50 rounded-lg bg-[#141a26] border border-[#1a202c] shadow-2xl overflow-hidden"
                >
                  <div className="flex items-center justify-between px-3.5 py-2 bg-[#0a0e17] border-b border-[#1a202c]">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#ffffff]">
                      <Clock className="w-3.5 h-3.5 text-[#0055ff]" />
                      <span>Recent Searches</span>
                    </div>
                    {recentSearches.length > 0 && (
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          clearRecentSearches();
                          setRecentSearches([]);
                        }}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#cbd5e1] hover:text-[#e11d48] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{activeLang === 'fr' ? 'Effacer' : 'Clear'}</span>
                      </button>
                    )}
                  </div>

                  {recentSearches.length === 0 ? (
                    <div className="px-3.5 py-3 text-xs text-[#cbd5e1]">
                      {activeLang === 'fr'
                        ? 'Aucune recherche récente (vos 5 dernières recherches seront enregistrées ici).'
                        : 'No recent searches yet (your last 5 searches will be saved here).'}
                    </div>
                  ) : (
                    <ul className="divide-y divide-[#1a202c] max-h-60 overflow-y-auto">
                      {recentSearches.slice(0, 5).map((item) => (
                        <li
                          key={item}
                          className="flex items-center justify-between hover:bg-[#1a202c] transition-colors"
                        >
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              isTypingSessionRef.current = false;
                              setSearchQuery(item);
                              setRecentSearches((prev) =>
                                addRecentSearch(item, prev, false)
                              );
                              setIsSearchDropdownOpen(false);
                            }}
                            className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 text-start text-xs sm:text-sm text-[#ffffff] transition-colors cursor-pointer truncate"
                          >
                            <Clock className="w-3.5 h-3.5 text-[#cbd5e1] shrink-0" />
                            <span className="truncate font-medium">{item}</span>
                          </button>
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRecentSearches((prev) =>
                                removeRecentSearch(item, prev)
                              );
                            }}
                            title={
                              activeLang === 'fr'
                                ? 'Supprimer cette recherche'
                                : 'Remove search'
                            }
                            className="p-2 me-1.5 rounded-lg text-[#cbd5e1] hover:text-[#ffffff] hover:bg-[#0a0e17] transition-colors cursor-pointer shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Horodateur Temps Réel (Live Now) vs Barre de Contrôle Temporel (EXCLUSIVEMENT en vue TV Grid) */}
            {viewMode === 'grid' ? (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-xs font-mono text-[#cbd5e1] shrink-0">
                  <Clock className="w-3.5 h-3.5 text-[#cbd5e1]" />
                  <span>{formatDayLabel(effectiveTimeMs, activeLang)}</span>
                  <span className="font-bold text-[#ffffff]">
                    {formatTimeShort(effectiveTimeMs)}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1d4ed8]/25 text-[#ffffff] border border-[#0055ff]/50 font-sans font-medium">
                    {APP_TIMEZONE_LABEL}
                  </span>
                </div>

                <input
                  type="date"
                  value={formatDateInputValue(effectiveTimeMs)}
                  onChange={(e) => {
                    const parsed = parseDateInputWithCurrentTime(
                      e.target.value,
                      effectiveTimeMs
                    );
                    if (parsed !== null) {
                      handleSelectCustomDateTime(parsed);
                    }
                  }}
                  aria-label={
                    activeLang === 'fr' ? 'Sélecteur de date' : 'Date selector'
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-xs font-mono text-[#ffffff] focus:outline-none focus:border-[#0055ff] transition-colors cursor-pointer shrink-0"
                />

                <input
                  type="time"
                  value={formatTimeInputValue(effectiveTimeMs)}
                  onChange={(e) => {
                    const parsed = parseTimeInputWithCurrentDate(
                      e.target.value,
                      effectiveTimeMs
                    );
                    if (parsed !== null) {
                      handleSelectCustomDateTime(parsed);
                    }
                  }}
                  aria-label={
                    activeLang === 'fr' ? "Sélecteur d'heure" : 'Time selector'
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-xs font-mono text-[#ffffff] focus:outline-none focus:border-[#0055ff] transition-colors cursor-pointer shrink-0"
                />

                <button
                  type="button"
                  onClick={() => shiftTimeOffsetMinutes(-120)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
                    activeTimePreset === 'minus'
                      ? 'bg-[#e11d48] border border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                      : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] font-medium'
                  }`}
                >
                  -2h
                </button>

                <button
                  type="button"
                  onClick={handleSyncToLive}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
                    activeTimePreset === 'now'
                      ? 'bg-[#e11d48] border border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                      : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] font-medium'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff] shadow-[0_0_8px_#ffffff] shrink-0 animate-pulse" />
                  <span>{tr.presetNow}</span>
                </button>

                <button
                  type="button"
                  onClick={jumpToPrimeTimeTonight}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
                    activeTimePreset === 'prime'
                      ? 'bg-[#e11d48] border border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                      : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] font-medium'
                  }`}
                >
                  {tr.presetPrime}
                </button>

                <button
                  type="button"
                  onClick={() => shiftTimeOffsetMinutes(120)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
                    activeTimePreset === 'plus'
                      ? 'bg-[#e11d48] border border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                      : 'bg-[#0a0e17] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] font-medium'
                  }`}
                >
                  +2h
                </button>
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-xs font-mono text-[#cbd5e1] shrink-0 select-none">
                <span className="w-1.5 h-1.5 rounded-full bg-[#e11d48] shadow-[0_0_8px_#e11d48] shrink-0 animate-pulse" />
                <Clock className="w-3.5 h-3.5 text-[#cbd5e1]" />
                <span>{formatDayLabel(nowMs, activeLang)}</span>
                <span className="font-bold text-[#ffffff]">
                  {formatTimeShort(nowMs)}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1d4ed8]/25 text-[#ffffff] border border-[#0055ff]/50 font-sans font-medium">
                  {APP_TIMEZONE_LABEL}
                </span>
              </div>
            )}
          </div>

          {/* Barres de filtres rapides en rubans horizontaux défilables [CATÉGORIE] -> [SATELLITE / BOUQUET] -> [ZONE] -> [GENRE] */}
          {viewMode !== 'grid' && (
            <div className="pt-2.5 border-t border-[#1a202c] space-y-2 select-none">
              {/* Ligne 1 : [CATÉGORIE] */}
              <div
                data-tv-row="live-categories"
                data-row-active={
                  activeFilterRow === 'live-categories' ? 'true' : undefined
                }
                className="filter-ribbon no-scrollbar"
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
                      onClick={() => setSelectedCategory(cat.code)}
                      onKeyDown={(e) => {
                        if (
                          e.key === 'Enter' ||
                          e.key === ' ' ||
                          e.key === 'Select' ||
                          e.keyCode === 23 ||
                          e.keyCode === 66
                        ) {
                          e.preventDefault();
                          setSelectedCategory(cat.code);
                        }
                      }}
                      className={`filter-badge ${
                        active ? 'active selected-filter' : ''
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
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                          active
                            ? 'bg-[#0a0e17]/70 text-[#ffffff] font-bold'
                            : 'bg-[#0a0e17]/60 text-[#cbd5e1]'
                        }`}
                      >
                        {count}
                      </span>
                    </div>
                  );
                })}

                {/* Filtre Rapide "Mes Rappels" directement dans la barre des filtres */}
                <div
                  role="button"
                  tabIndex={0}
                  data-filter-active={viewMode === 'reminders' ? 'true' : undefined}
                  onClick={() =>
                    setViewMode(viewMode === 'reminders' ? 'live' : 'reminders')
                  }
                  onKeyDown={(e) => {
                    if (
                      e.key === 'Enter' ||
                      e.key === ' ' ||
                      e.key === 'Select' ||
                      e.keyCode === 23 ||
                      e.keyCode === 66
                    ) {
                      e.preventDefault();
                      setViewMode(viewMode === 'reminders' ? 'live' : 'reminders');
                    }
                  }}
                  className={`filter-badge ms-1 ${
                    viewMode === 'reminders' ? 'active selected-filter' : ''
                  }`}
                >
                  <BellRing className="w-3.5 h-3.5 text-[#ec4899]" />
                  <span>
                    {activeLang === 'fr'
                      ? 'Mes Rappels'
                      : activeLang === 'es'
                      ? 'Mis Recordatorios'
                      : activeLang === 'ar'
                      ? 'تذكيراتي'
                      : 'My Reminders'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono bg-gradient-to-r from-[#0055ff] to-[#ec4899] text-[#ffffff] font-bold">
                    {activeRemindersCount || reminders.length}
                  </span>
                </div>
              </div>

              {/* Ligne 2 : [SATELLITE] */}
              {visibleSatelliteOptions.length > 1 && (
                <div
                  data-tv-row="live-satellites"
                  data-row-active={
                    activeFilterRow === 'live-satellites' ? 'true' : undefined
                  }
                  className="filter-ribbon no-scrollbar pt-1 border-t border-[#1a202c]"
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
                        onClick={() => handleSelectSatellite(sat)}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' ||
                            e.key === ' ' ||
                            e.key === 'Select' ||
                            e.keyCode === 23 ||
                            e.keyCode === 66
                          ) {
                            e.preventDefault();
                            handleSelectSatellite(sat);
                          }
                        }}
                        className={`filter-badge ${
                          active ? 'active selected-filter' : ''
                        }`}
                      >
                        <span>{label}</span>
                        <span
                          className={`text-[10px] px-1.5 rounded-full font-mono ${
                            active
                              ? 'bg-[#0a0e17]/70 text-[#ffffff] font-bold'
                              : 'bg-[#0a0e17]/60 text-[#cbd5e1]'
                          }`}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ligne 2B : [BOUQUET] */}
              {visibleBouquetOptions.length > 1 && (
                <div
                  data-tv-row="live-bouquets"
                  data-row-active={
                    activeFilterRow === 'live-bouquets' ? 'true' : undefined
                  }
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
                    const label = translateBouquetFilter(bq, activeLang);
                    return (
                      <div
                        key={bq}
                        role="button"
                        tabIndex={0}
                        data-filter-active={active ? 'true' : undefined}
                        onClick={() => handleSelectBouquet(bq)}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' ||
                            e.key === ' ' ||
                            e.key === 'Select' ||
                            e.keyCode === 23 ||
                            e.keyCode === 66
                          ) {
                            e.preventDefault();
                            handleSelectBouquet(bq);
                          }
                        }}
                        className={`filter-badge ${
                          active ? 'active selected-filter' : ''
                        }`}
                      >
                        <span>{label}</span>
                        <span
                          className={`text-[10px] px-1.5 rounded-full font-mono ${
                            active
                              ? 'bg-[#0a0e17]/70 text-[#ffffff] font-bold'
                              : 'bg-[#0a0e17]/60 text-[#cbd5e1]'
                          }`}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {ramWarningMessage && (
                <div className="px-3 py-2 rounded-lg bg-[#0a0e17] border border-[#0055ff]/60 text-[#ffffff] text-xs font-medium flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0055ff] shrink-0" />
                  <span>{ramWarningMessage}</span>
                </div>
              )}

              {/* Ligne 3 : [ZONE / PAYS] (Ruban horizontal défilable de badges <div> cliquables sur tous les écrans) */}
              {visibleCountryOptions.length > 1 && (
                <div
                  data-tv-row="live-countries"
                  data-row-active={
                    activeFilterRow === 'live-countries' ? 'true' : undefined
                  }
                  className="filter-ribbon no-scrollbar pt-1 border-t border-[#1a202c]"
                >
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-[#cbd5e1] me-1 shrink-0 select-none">
                    <Globe className="w-3.5 h-3.5 text-[#0055ff]" />
                    {tr.filterCountryLabel || tr.filterZoneLabel}
                  </span>
                  {visibleCountryOptions.map((cCode) => {
                    const active = selectedCountry === cCode;
                    const count = countryCounts[cCode] ?? 0;
                    const label = translateChannelCountryFilter(
                      cCode,
                      activeLang
                    );
                    const flag = CHANNEL_COUNTRY_FLAGS[cCode] || '🌍';
                    return (
                      <div
                        key={cCode}
                        role="button"
                        tabIndex={0}
                        data-filter-active={active ? 'true' : undefined}
                        onClick={() => setSelectedCountry(cCode)}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' ||
                            e.key === ' ' ||
                            e.key === 'Select' ||
                            e.keyCode === 23 ||
                            e.keyCode === 66
                          ) {
                            e.preventDefault();
                            setSelectedCountry(cCode);
                          }
                        }}
                        className={`filter-badge ${
                          active ? 'active selected-filter' : ''
                        }`}
                      >
                        <span>{flag}</span>
                        <span>{label}</span>
                        <span
                          className={`text-[10px] px-1.5 rounded-full font-mono ${
                            active
                              ? 'bg-[#0a0e17]/70 text-[#ffffff] font-bold'
                              : 'bg-[#0a0e17]/60 text-[#cbd5e1]'
                          }`}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Ligne 4 : [GENRE] */}
              {visibleGroupOptions.length > 1 && (
                <div
                  data-tv-row="live-genres"
                  data-row-active={
                    activeFilterRow === 'live-genres' ? 'true' : undefined
                  }
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
                        onClick={() => setSelectedGroup(grp)}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' ||
                            e.key === ' ' ||
                            e.key === 'Select' ||
                            e.keyCode === 23 ||
                            e.keyCode === 66
                          ) {
                            e.preventDefault();
                            setSelectedGroup(grp);
                          }
                        }}
                        className={`filter-badge ${
                          active ? 'active selected-filter' : ''
                        }`}
                      >
                        <span>{label}</span>
                        <span
                          className={`text-[10px] px-1.5 rounded-full font-mono ${
                            active
                              ? 'bg-[#0a0e17]/70 text-[#ffffff] font-bold'
                              : 'bg-[#0a0e17]/60 text-[#cbd5e1]'
                          }`}
                        >
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Résumé Statut & Bouton Reset Filtres */}
          <div className="pt-2 border-t border-[#1a202c] flex flex-wrap items-center justify-between gap-2 text-xs text-[#cbd5e1]">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-[#ffffff]">
                {filteredChannels.length}
              </span>
              <span>
                {tr.channelsDisplayed} {settingsAllowedChannels.length}
              </span>
              {cacheMeta && (
                <>
                  <span className="text-[#cbd5e1]/60">•</span>
                  <span>
                    {cacheMeta.programmeCount.toLocaleString()}{' '}
                    {tr.activeProgrammes}
                  </span>
                </>
              )}
              <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 font-medium ms-1">
                <Subtitles className="w-3 h-3 text-[#60a5fa]" />
                VO + SUB
              </span>
            </div>

            {(selectedCategory !== 'Tous' ||
              selectedSatellite !== 'Tous' ||
              selectedBouquet !== 'Tous' ||
              selectedCountry !== 'Tous' ||
              (selectedGroup !== 'Tous' && selectedGroup !== 'Toutes') ||
              searchQuery ||
              isTimeViewOffset) && (
              <button
                type="button"
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#e11d48] border border-[#ff0033] text-xs font-bold text-[#ffffff] shadow-[0_0_10px_rgba(225,29,72,0.4)] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {tr.resetFiltersBtn}
              </button>
            )}
          </div>
        </div>

        {/* Rappels actifs dans l'onglet Favoris */}
        {viewMode === 'favorites' && reminders.length > 0 && (
          <div className="mb-4 rounded-lg p-4 bg-[#141a26] border border-[#1a202c] space-y-2.5">
            <h3 className="text-xs font-bold flex items-center gap-1.5 text-[#ffffff] uppercase tracking-wider">
              <Bell className="w-3.5 h-3.5 text-[#e11d48]" />
              {tr.savedRemindersTitle} ({reminders.length})
            </h3>
            <div className="divide-y divide-[#1a202c]">
              {reminders.map((rem) => (
                <div
                  key={rem.id}
                  className="py-2 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-[#ffffff] truncate">{rem.title}</p>
                    <p className="text-[11px] font-mono text-[#cbd5e1]">
                      {rem.channelName} ·{' '}
                      {formatDayLabel(rem.startMs, activeLang)}{' '}
                      {formatTimeShort(rem.startMs)} –{' '}
                      {formatTimeShort(rem.stopMs)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveReminderById(rem.id)}
                    className="p-1.5 rounded-lg text-[#cbd5e1] hover:text-[#e11d48] cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contenu Principal : Vue Mes Rappels, Vue Grille TV ou Vue Liste En Direct */}
        {viewMode === 'reminders' ? (
          <RemindersChronologicalView
            reminders={reminders}
            channels={channels}
            schedulesByChannel={activeSchedulesByChannel}
            nowMs={nowMs}
            language={activeLang}
            onSelectReminder={handleSelectReminderTarget}
            onRemoveReminder={handleRemoveReminderById}
            onClearAllReminders={handleClearExpiredReminders}
            onToggleReminder={handleToggleReminder}
            onSimulateImminentAlert={handleTriggerTestAlertBanner}
          />
        ) : viewMode === 'grid' ? (
          <TimeGridView
            channels={filteredChannels}
            programmesByChannel={activeSchedulesByChannel}
            nowMs={effectiveTimeMs}
            realNowMs={nowMs}
            timeOffsetMinutes={timeOffsetMinutes}
            activeTimePreset={activeTimePreset}
            liveSyncCount={liveSyncCount}
            onShiftTimeOffset={shiftTimeOffsetMinutes}
            onResetToLive={handleSyncToLive}
            onJumpToPrimeTime={jumpToPrimeTimeTonight}
            onSelectDateTime={handleSelectCustomDateTime}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onSelectChannel={(ch, prog) => {
              setSelectedChannel(ch);
              setSelectedModalProgramme(prog || null);
            }}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            selectedSatellite={selectedSatellite}
            onSelectSatellite={handleSelectSatellite}
            selectedBouquet={selectedBouquet}
            onSelectBouquet={handleSelectBouquet}
            selectedBouquetsList={selectedBouquetsList}
            ramWarningMessage={ramWarningMessage}
            selectedCountry={selectedCountry}
            onSelectCountry={setSelectedCountry}
            selectedGroup={selectedGroup}
            onSelectGroup={setSelectedGroup}
            categoryCounts={categoryCounts}
            satelliteCounts={satelliteCounts}
            bouquetCounts={bouquetCounts}
            countryCounts={countryCounts}
            groupCounts={groupCounts}
            allowedSatelliteOptions={visibleSatelliteOptions}
            allowedBouquetOptions={visibleBouquetOptions}
            allowedCountryOptions={visibleCountryOptions}
            allowedCategoryCodes={visibleCategoryOptions.map((c) => c.code)}
            allowedGroupOptions={visibleGroupOptions}
            language={activeLang}
            reminders={reminders}
            onToggleReminder={handleToggleReminder}
          />
        ) : filteredChannels.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#1a202c] bg-[#141a26] p-10 text-center max-w-lg mx-auto my-8">
            {isProfileBootstrapping || (isSyncing && channels.length === 0) ? (
              <>
                <RefreshCw className="w-10 h-10 text-[#38bdf8] mx-auto mb-3 animate-spin" />
                <h3 className="text-base font-bold text-[#ffffff]">
                  {activeLang === 'fr'
                    ? 'Chargement...'
                    : 'Loading...'}
                </h3>
                <p className="text-xs text-[#cbd5e1] mt-1 leading-relaxed">
                  {activeLang === 'fr'
                    ? 'Initialisation asynchrone du profil TV et des chaînes en cours...'
                    : 'Asynchronously initializing TV profile and channels...'}
                </p>
              </>
            ) : epgError ? (
              <>
                <AlertTriangle className="w-10 h-10 text-[#e11d48] mx-auto mb-3" />
                <h3 className="text-base font-bold text-[#ffffff]">
                  {activeLang === 'fr'
                    ? 'Échec du chargement du flux EPG HTTPS'
                    : 'Failed to load HTTPS EPG feed'}
                </h3>
                <p className="text-xs text-[#cbd5e1] mt-1 leading-relaxed">
                  {epgError}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => triggerEpgSync(settings)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e11d48] border border-[#ff0033] text-[#ffffff] font-bold text-xs shadow-[0_0_12px_rgba(225,29,72,0.45)] cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {tr.refreshBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleLoadOfflineFallback(settings);
                      resetAllFilters();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1d4ed8]/25 border border-[#0055ff] text-[#ffffff] hover:bg-[#1d4ed8] font-semibold text-xs cursor-pointer"
                  >
                    <Satellite className="w-3.5 h-3.5" />
                    {activeLang === 'fr'
                      ? 'Grille locale de secours'
                      : 'Local fallback schedule'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <Satellite className="w-10 h-10 text-[#0055ff] mx-auto mb-3" />
                <h3 className="text-base font-bold text-[#ffffff]">
                  {tr.noChannelsFoundTitle}
                </h3>
                <p className="text-xs text-[#cbd5e1] mt-1 leading-relaxed">
                  {tr.noChannelsFoundDesc}
                </p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e11d48] border border-[#ff0033] text-[#ffffff] font-bold text-xs shadow-[0_0_12px_rgba(225,29,72,0.45)] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {tr.showAllSatellitesBtn}
                </button>
              </>
            )}
          </div>
        ) : (
          <div
            ref={virtualListContainerRef}
            data-tv-list="channels"
            data-virtualized="true"
            data-dpad-active={
              activeDpadZone === 'channels' ? 'true' : undefined
            }
            data-dpad-transition={
              dpadState.isZoneTransitioning && activeDpadZone === 'channels'
                ? dpadState.lastDirection || 'jump'
                : undefined
            }
            style={{
              paddingTop:
                virtualWindow.topSpacerPx > 0
                  ? `${virtualWindow.topSpacerPx}px`
                  : undefined,
              paddingBottom:
                virtualWindow.bottomSpacerPx > 0
                  ? `${virtualWindow.bottomSpacerPx}px`
                  : undefined,
            }}
          >
            <div className="space-y-2.5">
              {virtualWindow.items.map((ch, localIdx) => {
                const virtualIndex = virtualWindow.startIndex + localIdx;
                const pair = currentAndNextByChannel[ch.id] || {
                  current: null,
                  next: null,
                };
                return (
                  <ChannelRowCard
                    key={ch.id}
                    dataIndex={virtualIndex}
                    isMemorizedTarget={
                      activeDpadZone === 'filters' &&
                      virtualIndex === lastFocusedChannelIndex
                    }
                    measureRef={getRowMeasureRef(ch.id)}
                    channel={ch}
                    currentProgramme={pair.current}
                    nextProgramme={pair.next}
                    nowMs={effectiveTimeMs}
                    isFavorite={favoriteSet.has(ch.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onSelectChannel={handleSelectChannelFromRow}
                    isSelected={selectedChannel?.id === ch.id}
                    language={activeLang}
                    activeSatellite={selectedSatellite}
                    activeBouquet={selectedBouquet}
                    selectedBouquets={settings.selectedBouquets}
                    hasCurrentReminder={Boolean(
                      pair.current && reminderIdSet.has(pair.current.id)
                    )}
                    hasNextReminder={Boolean(
                      pair.next && reminderIdSet.has(pair.next.id)
                    )}
                    onToggleReminder={handleToggleReminder}
                  />
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Floating Action Button: Sync to Live (visible exclusively in TV Grid when time view is offset) */}
      {viewMode === 'grid' && isTimeViewOffset && (
        <div className="fixed bottom-6 end-6 z-40 flex items-center">
          <button
            type="button"
            onClick={handleSyncToLive}
            aria-label="Sync to Live"
            title="Sync to Live"
            className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-lg bg-[#e11d48] hover:bg-[#ff0033] text-[#ffffff] font-bold text-xs sm:text-sm shadow-[0_0_20px_rgba(225,29,72,0.55)] border border-[#ff0033] transition-colors cursor-pointer"
          >
            <span className="w-2 h-2 rounded-full bg-[#ffffff] shadow-[0_0_8px_#ffffff] shrink-0 animate-pulse" />
            <Radio className="w-4 h-4 text-[#ffffff] shrink-0" />
            <span>Sync to Live</span>
            <span className="px-2 py-0.5 rounded bg-[#0a0e17] text-[#ffffff] border border-[#ff0033]/60 font-mono text-[11px] font-bold">
              {formattedOffsetBadge}
            </span>
          </button>
        </div>
      )}

      {/* Footer Légal & Attribution TMDB (Conformité Google Play Store) */}
      <footer className="mt-auto border-t border-[#1a202c] bg-[#0a0e17] py-4 px-4 sm:px-6 text-[11px] text-[#cbd5e1]">
        <div className="max-w-[1600px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="font-bold text-[#ffffff]">
              PulseEPG - Your Ultimate TV Guide
            </span>
            <span>•</span>
            <span>
              This product uses the TMDB API but is not endorsed or certified by
              TMDB.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setSettingsInitialTab('legal');
              setIsSettingsOpen(true);
            }}
            className="inline-flex items-center gap-1.5 text-[#cbd5e1] hover:text-[#ffffff] font-semibold cursor-pointer"
          >
            <Scale className="w-3.5 h-3.5 text-[#0055ff]" />
            <span>{tr.tabLegalPlayStore}</span>
          </button>
        </div>
      </footer>

      {/* Panneau Latéral / Modal Fiche Programme & Grille Complète par Chaîne */}
      {selectedChannel && (
        <ChannelDetailPanel
          channel={selectedChannel}
          programmes={
            activeSchedulesByChannel[cleanXmltvChannelId(selectedChannel.id)] ||
            activeSchedulesByChannel[selectedChannel.id] ||
            []
          }
          nowMs={effectiveTimeMs}
          isFavorite={favoriteSet.has(selectedChannel.id)}
          onToggleFavorite={handleToggleFavorite}
          reminders={reminders}
          onToggleReminder={handleToggleReminder}
          onClose={() => {
            setSelectedChannel(null);
            setSelectedModalProgramme(null);
          }}
          initialSelectedProgramme={selectedModalProgramme}
          language={activeLang}
          activeSatellite={selectedSatellite}
          activeBouquet={selectedBouquet}
          selectedBouquets={settings.selectedBouquets}
        />
      )}

      {/* Bandeau d'Alerte Visuel In-App (TV D-Pad & Tablette) : programmes commençant dans <= 5 min ou en cours */}
      <InAppReminderBanner
        reminders={reminders}
        realNowMs={nowMs}
        dismissedIds={dismissedBannerIds}
        recentAddedReminder={recentlyAddedReminder}
        onSelectReminder={handleSelectReminderTarget}
        onOpenRemindersTab={() => setViewMode('reminders')}
        onDismissReminder={handleDismissBannerAlert}
        onDismissRecentToast={() => setRecentlyAddedReminder(null)}
        language={activeLang}
        isModalOpen={Boolean(selectedChannel) || isSettingsOpen}
      />

      {/* Modal Paramètres & Sources XMLTV */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        cacheMeta={cacheMeta}
        onSaveSettings={handleSaveSettings}
        onResetDefaults={handleResetDefaults}
        onClearCache={handleClearCache}
        initialTab={settingsInitialTab}
        onChangeLanguage={handleChangeLanguage}
      />
    </div>
  );
}

export default App;
