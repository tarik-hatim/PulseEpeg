import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Clock,
  Database,
  Film,
  Globe,
  LayoutGrid,
  Moon,
  Orbit,
  Plus,
  RefreshCw,
  Search,
  Star,
  Sun,
  Trash2,
  Trophy,
  Tv,
  X,
} from 'lucide-react';
import {
  AppSettings,
  BouquetFilter,
  ChannelGroup,
  ContentCategoryFilter,
  CountryCode,
  EpgCacheMetadata,
  EpgChannel,
  EpgLoadingProgress,
  EpgProgramme,
  ProgrammeReminder,
  SatelliteFilter,
  TimeFilterPreset,
  WorkerResponseMessage,
} from './types/epg';
import {
  buildSourcesSignature,
  clearEpgCache,
  loadAppSettings,
  loadEpgFromCache,
  loadFavoriteChannels,
  loadReminders,
  saveAppSettings,
  saveEpgToCache,
  saveFavoriteChannels,
  saveReminders,
} from './services/storageService';
import {
  findCurrentAndUpcoming,
  formatLocalTime,
  formatLocalTimeRange,
  formatShortDate,
  getLocalTimezoneLabel,
} from './utils/timeFormat';
import {
  enrichProgrammeWithFrenchMetadata,
  getCachedEnrichedMetadata,
} from './services/metadataEnricher';
import { LoadingStatusBanner } from './components/LoadingStatusBanner';
import { ChannelRowCard } from './components/ChannelRowCard';
import { ChannelDetailPanel } from './components/ChannelDetailPanel';
import { TimeGridView } from './components/TimeGridView';
import { CacheAndCapacitorView } from './components/CacheAndCapacitorView';
import { PWAInstallButton } from './components/PWAInstallButton';

type ActiveTab = 'live' | 'grid' | 'favorites' | 'settings';

const CONTENT_CATEGORIES: { code: ContentCategoryFilter; label: string }[] = [
  { code: 'Tous', label: 'Tous' },
  { code: 'Films & Séries', label: 'Films & Séries' },
  { code: 'Sport / Football', label: 'Sport / Football' },
];

const CHANNEL_GROUPS: ChannelGroup[] = [
  'Tous',
  'Cinéma Premières',
  'Action & Thriller',
  'Séries TV & US',
  'Comédie & Famille',
  'Classiques & Culte',
  'Sport / Football',
];

const SATELLITE_FILTERS: { code: SatelliteFilter; label: string }[] = [
  { code: 'Tous', label: 'Tous satellites' },
  { code: 'Astra 19.2°E', label: 'Astra 19.2°E' },
  { code: 'Hotbird 13°E', label: 'Hotbird 13°E' },
  { code: 'Hispasat 30°W', label: 'Hispasat 30°W' },
  { code: 'Nilesat 7°W', label: 'Nilesat 7°W' },
];

const COUNTRY_FILTERS: { code: CountryCode; label: string }[] = [
  { code: 'Tous', label: 'Tous pays' },
  { code: 'PL', label: 'PL · Pologne (VO / Sport)' },
  { code: 'ES', label: 'ES · Movistar+ / DAZN' },
  { code: 'DE', label: 'DE · Allemagne / Sky DE' },
  { code: 'IT', label: 'IT · Sky Italia / DAZN' },
  { code: 'AR', label: 'Nilesat 7°W · OSN / MBC / beIN' },
];

const BOUQUET_FILTERS: BouquetFilter[] = [
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

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());
  const [activeTab, setActiveTab] = useState<ActiveTab>('live');

  const [channels, setChannels] = useState<EpgChannel[]>([]);
  const [schedulesByChannel, setSchedulesByChannel] = useState<
    Record<string, EpgProgramme[]>
  >({});
  const [metadata, setMetadata] = useState<EpgCacheMetadata | null>(null);

  const [favorites, setFavorites] = useState<string[]>(() =>
    loadFavoriteChannels()
  );
  const [reminders, setReminders] = useState<ProgrammeReminder[]>(() =>
    loadReminders()
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] =
    useState<ContentCategoryFilter>('Tous');
  const [selectedSatellite, setSelectedSatellite] =
    useState<SatelliteFilter>('Tous');
  const [selectedGroup, setSelectedGroup] = useState<ChannelGroup>('Tous');
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('Tous');
  const [selectedBouquet, setSelectedBouquet] =
    useState<BouquetFilter>('Tous');

  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(
    null
  );
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const [visibleCount, setVisibleCount] = useState(36);
  const [referenceTimeMs, setReferenceTimeMs] = useState<number>(() =>
    Date.now()
  );
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [selectedTimeFilter, setSelectedTimeFilter] =
    useState<TimeFilterPreset>('now');
  const [, setEnrichTick] = useState(0);

  const handleMetadataResolved = useCallback(() => {
    setEnrichTick((t) => t + 1);
  }, []);

  const [loadingProgress, setLoadingProgress] = useState<EpgLoadingProgress>({
    active: true,
    phase: 'checking_cache',
    bytesLoaded: 0,
    bytesTotal: 15000000,
    channelsParsed: 0,
    programmesParsed: 0,
    message: 'Vérification du cache multi-sources IndexedDB...',
  });

  const workerRef = useRef<Worker | null>(null);

  const isLight = settings.theme === 'light';

  useEffect(() => {
    if (isCustomTime) return;
    const timer = setInterval(() => {
      setReferenceTimeMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, [isCustomTime]);

  const calibrateReferenceTime = useCallback((meta: EpgCacheMetadata) => {
    const now = Date.now();
    if (now >= meta.minTimestampMs && now <= meta.maxTimestampMs) {
      setReferenceTimeMs(now);
      setIsCustomTime(false);
      setSelectedTimeFilter('now');
    } else {
      const fallback = Math.min(
        meta.maxTimestampMs - 3600000,
        meta.minTimestampMs + 12 * 3600000
      );
      setReferenceTimeMs(fallback);
      setIsCustomTime(true);
    }
  }, []);

  const startBackgroundWorkerSync = useCallback(
    (currentSettings: AppSettings) => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }

      const activeSources = currentSettings.sources.filter(
        (s) => s.enabled && s.url.trim().length > 0
      );

      setLoadingProgress({
        active: true,
        phase: 'downloading',
        bytesLoaded: 0,
        bytesTotal: Math.max(1, activeSources.length) * 3000000,
        channelsParsed: 0,
        programmesParsed: 0,
        currentSourceIndex: 1,
        totalSources: activeSources.length,
        message: `Traitement successif de ${activeSources.length} fichiers EPG (.xml.gz) en arrière-plan...`,
      });

      const worker = new Worker(
        new URL('./workers/epgWorker.ts', import.meta.url),
        { type: 'module' }
      );
      workerRef.current = worker;

      const isNativeCapacitor = Boolean(
        (
          window as unknown as {
            Capacitor?: { isNativePlatform?: () => boolean };
          }
        ).Capacitor?.isNativePlatform?.()
      );

      worker.onmessage = async (event: MessageEvent<WorkerResponseMessage>) => {
        const msg = event.data;

        if (msg.type === 'EPG_PROGRESS') {
          setLoadingProgress(msg.payload);
        } else if (msg.type === 'EPG_COMPLETE') {
          const {
            metadata: newMeta,
            channels: newChannels,
            schedulesByChannel: newSchedules,
          } = msg.payload;

          setChannels(newChannels);
          setSchedulesByChannel(newSchedules);
          setMetadata(newMeta);

          if (newChannels.length > 0) {
            setSelectedChannelId((prev) => prev || newChannels[0].id);
          }

          calibrateReferenceTime(newMeta);

          try {
            await saveEpgToCache(newMeta, newChannels, newSchedules);
          } catch {
            // En cas de dépassement de quota IndexedDB, les données restent en mémoire vive
          }

          setLoadingProgress({
            active: false,
            phase: 'ready',
            bytesLoaded: newMeta.compressedBytes,
            bytesTotal: newMeta.compressedBytes,
            channelsParsed: newMeta.channelCount,
            programmesParsed: newMeta.programmeCount,
            message: 'Sources EPG fusionnées et mises en cache.',
            fromCache: false,
          });

          worker.terminate();
          workerRef.current = null;
        } else if (msg.type === 'EPG_ERROR') {
          setLoadingProgress((prev) => ({
            ...prev,
            active: false,
            phase: 'error',
            error: msg.payload.error,
          }));
          worker.terminate();
          workerRef.current = null;
        }
      };

      worker.onerror = (err) => {
        setLoadingProgress((prev) => ({
          ...prev,
          active: false,
          phase: 'error',
          error:
            err.message ||
            'Erreur interne du Web Worker lors de la fusion EPG.',
        }));
      };

      worker.postMessage({
        type: 'START_EPG_SYNC',
        payload: {
          sources: currentSettings.sources,
          windowHours: currentSettings.windowHours,
          cacheTtlHours: currentSettings.cacheTtlHours,
          isNativeCapacitor,
        },
      });
    },
    [calibrateReferenceTime]
  );

  // Initialisation : Lecture du cache multi-sources IndexedDB d'abord
  useEffect(() => {
    let cancelled = false;

    async function initEpg() {
      const cached = await loadEpgFromCache();
      if (cancelled) return;

      const now = Date.now();
      const expectedSignature = buildSourcesSignature(settings.sources);
      const isCacheValid =
        cached &&
        cached.metadata.sourcesSignature === expectedSignature &&
        cached.channels.length > 0 &&
        now < cached.metadata.expiresAtMs;

      if (cached && cached.channels.length > 0 && isCacheValid) {
        setChannels(cached.channels);
        setSchedulesByChannel(cached.schedulesByChannel);
        setMetadata(cached.metadata);
        setSelectedChannelId(cached.channels[0].id);
        calibrateReferenceTime(cached.metadata);

        setLoadingProgress({
          active: false,
          phase: 'ready',
          bytesLoaded: cached.metadata.compressedBytes,
          bytesTotal: cached.metadata.compressedBytes,
          channelsParsed: cached.metadata.channelCount,
          programmesParsed: cached.metadata.programmeCount,
          message: 'Chargé instantanément depuis le cache multi-sources IndexedDB.',
          fromCache: true,
        });
        return;
      }

      // Si des données partielles existent en cache pendant que les nouvelles sources chargent
      if (cached && cached.channels.length > 0) {
        setChannels(cached.channels);
        setSchedulesByChannel(cached.schedulesByChannel);
        setMetadata(cached.metadata);
        setSelectedChannelId(cached.channels[0].id);
        calibrateReferenceTime(cached.metadata);
      }

      startBackgroundWorkerSync(settings);
    }

    initEpg();

    return () => {
      cancelled = true;
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Calcul rapide O(log N) du programme en cours et à venir pour chaque chaîne
  const channelLiveMap = useMemo(() => {
    const map: Record<
      string,
      {
        current: EpgProgramme | null;
        next: EpgProgramme | null;
      }
    > = {};

    for (const ch of channels) {
      const sched = schedulesByChannel[ch.id];
      const { current, next } = findCurrentAndUpcoming(sched, referenceTimeMs);
      map[ch.id] = { current, next };
    }
    return map;
  }, [channels, schedulesByChannel, referenceTimeMs]);

  // Compteurs par catégorie principale (Tous, Films & Séries, Sport / Football)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      Tous: channels.length,
      'Films & Séries': 0,
      'Sport / Football': 0,
    };
    for (const ch of channels) {
      const cat =
        ch.contentCategory ||
        (ch.group === 'Sport / Football'
          ? 'Sport / Football'
          : 'Films & Séries');
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return counts;
  }, [channels]);

  const handleSelectCategory = useCallback(
    (cat: ContentCategoryFilter) => {
      setSelectedCategory(cat);
      if (cat === 'Sport / Football') {
        setSelectedGroup('Tous');
      } else if (
        cat === 'Films & Séries' &&
        selectedGroup === 'Sport / Football'
      ) {
        setSelectedGroup('Tous');
      }
    },
    [selectedGroup]
  );

  // Compteurs par satellite (Astra 19.2°E, Hotbird 13°E, Hispasat 30°W, Nilesat 7°W)
  const satelliteCounts = useMemo(() => {
    const counts: Record<string, number> = { Tous: 0 };
    for (const sat of SATELLITE_FILTERS) {
      if (sat.code !== 'Tous') counts[sat.code] = 0;
    }
    for (const ch of channels) {
      const cat =
        ch.contentCategory ||
        (ch.group === 'Sport / Football'
          ? 'Sport / Football'
          : 'Films & Séries');
      if (selectedCategory !== 'Tous' && cat !== selectedCategory) continue;
      counts.Tous++;
      if (ch.satellites) {
        for (const s of ch.satellites) {
          counts[s] = (counts[s] || 0) + 1;
        }
      }
    }
    return counts;
  }, [channels, selectedCategory]);

  // Compteurs par pays (PL, ES, DE, IT, AR)
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = { Tous: 0 };
    for (const c of COUNTRY_FILTERS) {
      if (c.code !== 'Tous') counts[c.code] = 0;
    }
    for (const ch of channels) {
      const cat =
        ch.contentCategory ||
        (ch.group === 'Sport / Football'
          ? 'Sport / Football'
          : 'Films & Séries');
      if (selectedCategory !== 'Tous' && cat !== selectedCategory) continue;
      if (
        selectedSatellite !== 'Tous' &&
        (!ch.satellites || !ch.satellites.includes(selectedSatellite))
      ) {
        continue;
      }
      counts.Tous++;
      counts[ch.country] = (counts[ch.country] || 0) + 1;
    }
    return counts;
  }, [channels, selectedCategory, selectedSatellite]);

  // Compteurs par bouquet
  const bouquetCounts = useMemo(() => {
    const counts: Record<string, number> = { Tous: 0 };
    for (const b of BOUQUET_FILTERS) {
      if (b !== 'Tous') counts[b] = 0;
    }

    for (const ch of channels) {
      const cat =
        ch.contentCategory ||
        (ch.group === 'Sport / Football'
          ? 'Sport / Football'
          : 'Films & Séries');
      if (selectedCategory !== 'Tous' && cat !== selectedCategory) continue;
      if (
        selectedSatellite !== 'Tous' &&
        (!ch.satellites || !ch.satellites.includes(selectedSatellite))
      ) {
        continue;
      }
      if (selectedCountry !== 'Tous' && ch.country !== selectedCountry) {
        continue;
      }
      counts.Tous++;
      if (ch.bouquets) {
        for (const b of ch.bouquets) {
          counts[b] = (counts[b] || 0) + 1;
        }
      }
    }
    return counts;
  }, [channels, selectedCategory, selectedSatellite, selectedCountry]);

  // Compteurs par thématique Cinéma, Séries & Football
  const groupCounts = useMemo(() => {
    const counts: Record<string, number> = { Tous: 0 };
    for (const g of CHANNEL_GROUPS) {
      if (g !== 'Tous') counts[g] = 0;
    }
    for (const ch of channels) {
      const cat =
        ch.contentCategory ||
        (ch.group === 'Sport / Football'
          ? 'Sport / Football'
          : 'Films & Séries');
      if (selectedCategory !== 'Tous' && cat !== selectedCategory) continue;
      if (
        selectedSatellite !== 'Tous' &&
        (!ch.satellites || !ch.satellites.includes(selectedSatellite))
      ) {
        continue;
      }
      if (selectedCountry !== 'Tous' && ch.country !== selectedCountry) {
        continue;
      }
      if (
        selectedBouquet !== 'Tous' &&
        (!ch.bouquets || !ch.bouquets.includes(selectedBouquet))
      ) {
        continue;
      }
      counts.Tous++;
      counts[ch.group] = (counts[ch.group] || 0) + 1;
    }
    return counts;
  }, [
    channels,
    selectedCategory,
    selectedSatellite,
    selectedCountry,
    selectedBouquet,
  ]);

  // Coordination intelligente lors du changement de Satellite
  const handleSelectSatellite = useCallback(
    (sat: SatelliteFilter) => {
      setSelectedSatellite(sat);
      if (sat !== 'Tous') {
        if (selectedCountry !== 'Tous') {
          const hasCountryOnSat = channels.some(
            (ch) =>
              ch.country === selectedCountry &&
              ch.satellites &&
              ch.satellites.includes(sat)
          );
          if (!hasCountryOnSat) {
            setSelectedCountry('Tous');
          }
        }
        if (selectedBouquet !== 'Tous') {
          const hasBouquetOnSat = channels.some(
            (ch) =>
              ch.bouquets &&
              ch.bouquets.includes(selectedBouquet) &&
              ch.satellites &&
              ch.satellites.includes(sat)
          );
          if (!hasBouquetOnSat) {
            setSelectedBouquet('Tous');
          }
        }
      }
    },
    [channels, selectedCountry, selectedBouquet]
  );

  // Coordination intelligente lors du changement de Pays
  const handleSelectCountry = useCallback(
    (country: CountryCode) => {
      setSelectedCountry(country);
      if (country !== 'Tous') {
        if (selectedSatellite !== 'Tous') {
          const hasSatInCountry = channels.some(
            (ch) =>
              ch.country === country &&
              ch.satellites &&
              ch.satellites.includes(selectedSatellite)
          );
          if (!hasSatInCountry) {
            setSelectedSatellite('Tous');
          }
        }
        if (selectedBouquet !== 'Tous') {
          const hasBouquetInCountry = channels.some(
            (ch) =>
              ch.country === country &&
              ch.bouquets &&
              ch.bouquets.includes(selectedBouquet)
          );
          if (!hasBouquetInCountry) {
            setSelectedBouquet('Tous');
          }
        }
      }
    },
    [channels, selectedSatellite, selectedBouquet]
  );

  // Coordination intelligente lors du changement de Bouquet
  const handleSelectBouquet = useCallback(
    (bouquet: BouquetFilter) => {
      setSelectedBouquet(bouquet);
      if (bouquet !== 'Tous') {
        if (selectedSatellite !== 'Tous') {
          const hasMatchInSat = channels.some(
            (ch) =>
              ch.satellites &&
              ch.satellites.includes(selectedSatellite) &&
              ch.bouquets &&
              ch.bouquets.includes(bouquet)
          );
          if (!hasMatchInSat) {
            setSelectedSatellite('Tous');
          }
        }
        if (selectedCountry !== 'Tous') {
          const hasMatchInCurrentCountry = channels.some(
            (ch) =>
              ch.country === selectedCountry &&
              ch.bouquets &&
              ch.bouquets.includes(bouquet)
          );
          if (!hasMatchInCurrentCountry) {
            setSelectedCountry('Tous');
          }
        }
      }
    },
    [channels, selectedSatellite, selectedCountry]
  );

  // Filtrage combiné : Catégorie (Tous / Films & Séries / Sport / Football) + Satellite + Pays + Bouquet + Groupe + Recherche
  const filteredChannels = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matched = channels.filter((ch) => {
      if (activeTab === 'favorites' && !favorites.includes(ch.id)) {
        return false;
      }
      const cat =
        ch.contentCategory ||
        (ch.group === 'Sport / Football'
          ? 'Sport / Football'
          : 'Films & Séries');
      if (selectedCategory !== 'Tous' && cat !== selectedCategory) {
        return false;
      }
      if (
        selectedSatellite !== 'Tous' &&
        (!ch.satellites || !ch.satellites.includes(selectedSatellite))
      ) {
        return false;
      }
      if (selectedCountry !== 'Tous' && ch.country !== selectedCountry) {
        return false;
      }
      if (
        selectedBouquet !== 'Tous' &&
        (!ch.bouquets || !ch.bouquets.includes(selectedBouquet))
      ) {
        return false;
      }
      if (selectedGroup !== 'Tous' && ch.group !== selectedGroup) {
        return false;
      }
      if (!q) return true;

      if (
        ch.displayName.toLowerCase().includes(q) ||
        ch.id.toLowerCase().includes(q) ||
        ch.country.toLowerCase().includes(q) ||
        ch.group.toLowerCase().includes(q) ||
        (ch.orbitalPosition && ch.orbitalPosition.toLowerCase().includes(q)) ||
        (ch.audioTrackLabel && ch.audioTrackLabel.toLowerCase().includes(q)) ||
        (ch.subtitleTrackLabel &&
          ch.subtitleTrackLabel.toLowerCase().includes(q)) ||
        (ch.bouquets &&
          ch.bouquets.some((b) => b.toLowerCase().includes(q)))
      ) {
        return true;
      }

      const live = channelLiveMap[ch.id];
      if (live?.current) {
        const cachedFr = getCachedEnrichedMetadata(live.current);
        if (
          live.current.title.toLowerCase().includes(q) ||
          (live.current.originalTitle &&
            live.current.originalTitle.toLowerCase().includes(q)) ||
          (cachedFr?.frenchTitle &&
            cachedFr.frenchTitle.toLowerCase().includes(q)) ||
          live.current.category.toLowerCase().includes(q) ||
          (live.current.subTitle &&
            live.current.subTitle.toLowerCase().includes(q))
        ) {
          return true;
        }
      }
      if (live?.next && live.next.title.toLowerCase().includes(q)) {
        return true;
      }

      return false;
    });

    if (selectedBouquet !== 'Tous') {
      const bLower = selectedBouquet.split('/')[0].trim().toLowerCase();
      matched.sort((a, b) => {
        const aDirect = a.displayName.toLowerCase().includes(bLower) ? 1 : 0;
        const bDirect = b.displayName.toLowerCase().includes(bLower) ? 1 : 0;
        if (aDirect !== bDirect) return bDirect - aDirect;
        return a.channelNumber - b.channelNumber;
      });
    }

    return matched;
  }, [
    channels,
    activeTab,
    favorites,
    selectedCategory,
    selectedSatellite,
    selectedCountry,
    selectedBouquet,
    selectedGroup,
    searchQuery,
    channelLiveMap,
  ]);

  useEffect(() => {
    setVisibleCount(36);
  }, [
    searchQuery,
    selectedCategory,
    selectedSatellite,
    selectedCountry,
    selectedBouquet,
    selectedGroup,
    activeTab,
  ]);

  const displayedChannels = useMemo(
    () => filteredChannels.slice(0, visibleCount),
    [filteredChannels, visibleCount]
  );

  // Enrichissement systématique TMDB + Traduction en français sur l'ensemble des chaînes affichées
  useEffect(() => {
    let cancelled = false;

    async function enrichVisibleChannels() {
      for (const ch of displayedChannels) {
        if (cancelled) break;
        const live = channelLiveMap[ch.id];
        if (live?.current && !getCachedEnrichedMetadata(live.current)) {
          try {
            await enrichProgrammeWithFrenchMetadata(live.current, ch.country);
            if (!cancelled) {
              setEnrichTick((t) => t + 1);
            }
          } catch {
            // Ignore
          }
        }
        if (cancelled) break;
        if (live?.next && !getCachedEnrichedMetadata(live.next)) {
          try {
            await enrichProgrammeWithFrenchMetadata(live.next, ch.country);
            if (!cancelled) {
              setEnrichTick((t) => t + 1);
            }
          } catch {
            // Ignore
          }
        }
      }
    }

    const timer = setTimeout(enrichVisibleChannels, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [displayedChannels, channelLiveMap]);

  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) || null,
    [channels, selectedChannelId]
  );

  const handleSelectChannel = useCallback((channelId: string) => {
    setSelectedChannelId(channelId);
    setMobileSheetOpen(true);
  }, []);

  const handleToggleFavorite = useCallback(
    (channelId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setFavorites((prev) => {
        const next = prev.includes(channelId)
          ? prev.filter((id) => id !== channelId)
          : [...prev, channelId];
        saveFavoriteChannels(next);
        return next;
      });
    },
    []
  );

  const handleToggleReminder = useCallback(
    (programme: EpgProgramme, channelName: string) => {
      setReminders((prev) => {
        const exists = prev.some((r) => r.id === programme.id);
        const next = exists
          ? prev.filter((r) => r.id !== programme.id)
          : [
              ...prev,
              {
                id: programme.id,
                channelId: programme.channelId,
                channelName,
                title: programme.title,
                startMs: programme.startMs,
                stopMs: programme.stopMs,
                category: programme.category,
              },
            ].sort((a, b) => a.startMs - b.startMs);
        saveReminders(next);
        return next;
      });
    },
    []
  );

  const handleUpdateSettings = useCallback(
    (newSettings: AppSettings, triggerSync = false) => {
      setSettings(newSettings);
      saveAppSettings(newSettings);

      if (triggerSync) {
        startBackgroundWorkerSync(newSettings);
      }
    },
    [startBackgroundWorkerSync]
  );

  const handleClearCache = useCallback(async () => {
    await clearEpgCache();
    setMetadata(null);
    setChannels([]);
    setSchedulesByChannel({});
  }, []);

  const toggleTheme = () => {
    const nextTheme = settings.theme === 'dark' ? 'light' : 'dark';
    handleUpdateSettings({ ...settings, theme: nextTheme }, false);
  };

  const activeSourcesCount = settings.sources.filter((s) => s.enabled).length;

  return (
    <div
      className={`min-h-screen flex flex-col transition-colors ${
        isLight
          ? 'bg-[#F8FAFC] text-slate-900'
          : 'bg-[#0B0F17] text-slate-100'
      }`}
    >
      {/* Top Bar Contract: 3 Zones (1. Brand Wordmark — 2. Nav Links — 3. Primary Actions) */}
      <header
        className={`sticky top-0 z-30 h-14 px-4 sm:px-6 border-b backdrop-blur-md flex items-center justify-between ${
          isLight
            ? 'bg-white/90 border-slate-200'
            : 'bg-[#0B0F17]/90 border-slate-800/80'
        }`}
      >
        {/* Zone 1: Single text element Brand Wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('live');
          }}
          className="text-lg font-display font-bold tracking-tight text-amber-400"
        >
          PulseEPG
        </a>

        {/* Zone 2: 4 Clean Text Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'live'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            En Direct & À venir
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('grid')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'grid'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Grille TV
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'favorites'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Favoris ({favorites.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-1 transition-colors whitespace-nowrap ${
              activeTab === 'settings'
                ? 'text-amber-400 underline underline-offset-8 decoration-2'
                : isLight
                ? 'text-slate-600 hover:text-slate-900'
                : 'text-slate-400 hover:text-slate-100'
            }`}
          >
            Sources EPG ({activeSourcesCount}) & APK
          </button>
        </nav>

        {/* Zone 3: Primary Actions + In-App PWA Install */}
        <div className="flex items-center gap-2">
          <PWAInstallButton isLight={isLight} />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Basculer le thème clair ou sombre"
            className={`min-h-[40px] min-w-[40px] rounded-xl flex items-center justify-center transition-colors ${
              isLight
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                : 'bg-[#131B2E] text-slate-300 hover:bg-slate-800'
            }`}
          >
            {isLight ? (
              <Moon className="w-4 h-4" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          <button
            type="button"
            disabled={loadingProgress.active}
            onClick={() => startBackgroundWorkerSync(settings)}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                loadingProgress.active ? 'animate-spin' : ''
              }`}
            />
            <span>Fusionner EPG ({activeSourcesCount})</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="flex-1 w-full max-w-[1400px] mx-auto px-4 sm:px-6 pt-4 pb-24 md:pb-10">
        {/* Background Sync / Initial Loading Banner */}
        <LoadingStatusBanner
          progress={loadingProgress}
          hasExistingData={channels.length > 0}
          onRetry={() => startBackgroundWorkerSync(settings)}
          isLight={isLight}
        />

        {activeTab === 'settings' ? (
          <CacheAndCapacitorView
            metadata={metadata}
            settings={settings}
            onUpdateSettings={handleUpdateSettings}
            onForceRefresh={() => startBackgroundWorkerSync(settings)}
            onClearCache={handleClearCache}
            isSyncing={loadingProgress.active}
            isLight={isLight}
          />
        ) : (
          channels.length > 0 && (
            <>
              {/* Search, Satellite/Bouquet Filter & Time Control Strip */}
              <section className="mb-5 space-y-2.5">
                <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                  {/* Search Input */}
                  <div className="relative flex-1">
                    <Search
                      className={`w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none ${
                        isLight ? 'text-slate-400' : 'text-slate-500'
                      }`}
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher une chaîne (Sky Sport, DAZN, Movistar LaLiga, Canal+ Sport, Eleven, beIN, SSC, HBO, OSN, MBC) ou un match / film..."
                      className={`w-full min-h-[44px] pl-10 pr-10 py-2 rounded-2xl text-sm border transition-colors focus:outline-none focus:border-amber-400 ${
                        isLight
                          ? 'bg-white border-slate-200 text-slate-900 placeholder:text-slate-400'
                          : 'bg-[#131B2E] border-slate-800/90 text-slate-100 placeholder:text-slate-500'
                      }`}
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        aria-label="Effacer la recherche"
                        className="min-h-[40px] min-w-[40px] absolute right-1 top-1/2 -translate-y-1/2 flex items-center justify-center text-slate-400 hover:text-slate-200"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Quick Time Selector Controls */}
                  <div
                    className={`flex items-center justify-between md:justify-end gap-1.5 p-1 rounded-2xl border overflow-x-auto no-scrollbar ${
                      isLight
                        ? 'bg-white border-slate-200'
                        : 'bg-[#131B2E] border-slate-800/90'
                    }`}
                  >
                    <div className="px-2.5 py-1 flex items-center gap-1.5 text-xs font-mono tabular-nums shrink-0">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        {formatShortDate(referenceTimeMs)}{' '}
                        {formatLocalTime(referenceTimeMs)}
                      </span>
                    </div>

                    <button
                      type="button"
                      aria-pressed={selectedTimeFilter === 'minus1h'}
                      onClick={() => {
                        setSelectedTimeFilter('minus1h');
                        setReferenceTimeMs((t) => t - 3600 * 1000);
                        setIsCustomTime(true);
                      }}
                      className={`min-h-[36px] px-2.5 py-1 rounded-xl text-xs font-mono tabular-nums transition-colors whitespace-nowrap ${
                        selectedTimeFilter === 'minus1h'
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold active btn-orange-active'
                          : isLight
                          ? 'hover:bg-slate-100 text-slate-700 btn-normal-inactive'
                          : 'hover:bg-slate-800 text-slate-300 btn-normal-inactive'
                      }`}
                    >
                      -1h
                    </button>

                    <button
                      type="button"
                      aria-pressed={selectedTimeFilter === 'now'}
                      onClick={() => {
                        setSelectedTimeFilter('now');
                        setReferenceTimeMs(Date.now());
                        setIsCustomTime(false);
                      }}
                      className={`min-h-[36px] px-3 py-1 rounded-xl text-xs transition-colors whitespace-nowrap ${
                        selectedTimeFilter === 'now'
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold active btn-orange-active'
                          : isLight
                          ? 'hover:bg-slate-100 text-slate-700 font-medium btn-normal-inactive'
                          : 'hover:bg-slate-800 text-slate-300 font-medium btn-normal-inactive'
                      }`}
                    >
                      Maintenant
                    </button>

                    <button
                      type="button"
                      aria-pressed={selectedTimeFilter === 'prime'}
                      onClick={() => {
                        setSelectedTimeFilter('prime');
                        const d = new Date(referenceTimeMs);
                        d.setHours(20, 45, 0, 0);
                        setReferenceTimeMs(d.getTime());
                        setIsCustomTime(true);
                      }}
                      className={`min-h-[36px] px-2.5 py-1 rounded-xl text-xs transition-colors whitespace-nowrap ${
                        selectedTimeFilter === 'prime'
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold active btn-orange-active'
                          : isLight
                          ? 'hover:bg-slate-100 text-slate-700 font-medium btn-normal-inactive'
                          : 'hover:bg-slate-800 text-slate-300 font-medium btn-normal-inactive'
                      }`}
                    >
                      Prime 20h45
                    </button>

                    <button
                      type="button"
                      aria-pressed={selectedTimeFilter === 'plus1h'}
                      onClick={() => {
                        setSelectedTimeFilter('plus1h');
                        setReferenceTimeMs((t) => t + 3600 * 1000);
                        setIsCustomTime(true);
                      }}
                      className={`min-h-[36px] px-2.5 py-1 rounded-xl text-xs font-mono tabular-nums transition-colors whitespace-nowrap ${
                        selectedTimeFilter === 'plus1h'
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold active btn-orange-active'
                          : isLight
                          ? 'hover:bg-slate-100 text-slate-700 btn-normal-inactive'
                          : 'hover:bg-slate-800 text-slate-300 btn-normal-inactive'
                      }`}
                    >
                      +1h
                    </button>
                  </div>
                </div>

                {/* Category, Satellite, Bouquet & Country Filter Bars (shown in En Direct & Favoris; Grille TV has its own integrated header) */}
                {activeTab !== 'grid' && (
                  <div className="space-y-2 pt-1">
                    {/* Row 0: Quick Category Filter ("Tous", "Films & Séries", "Sport / Football") */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      <span
                        className={`text-xs font-semibold flex items-center gap-1 pr-1 shrink-0 ${
                          isLight ? 'text-slate-700' : 'text-slate-200'
                        }`}
                      >
                        <Film className="w-3.5 h-3.5 text-amber-400" />
                        <span>Catégorie :</span>
                      </span>
                      {CONTENT_CATEGORIES.map((cat) => {
                        const active = selectedCategory === cat.code;
                        const count = categoryCounts[cat.code] || 0;
                        return (
                          <button
                            key={cat.code}
                            type="button"
                            onClick={() => handleSelectCategory(cat.code)}
                            className={`min-h-[38px] px-3.5 py-1 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                              active
                                ? 'bg-amber-500 text-slate-950 font-bold'
                                : isLight
                                ? 'bg-white border border-slate-200 text-slate-700 hover:text-slate-950'
                                : 'bg-[#131B2E] border border-slate-800/80 text-slate-200 hover:text-white'
                            }`}
                          >
                            {cat.code === 'Sport / Football' && (
                              <Trophy className="w-3.5 h-3.5" />
                            )}
                            <span>{cat.label}</span>
                            <span
                              className={`font-mono tabular-nums text-[11px] ${
                                active
                                  ? 'text-slate-900/80'
                                  : isLight
                                  ? 'text-slate-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Row 1: Satellite Quick Filter (Astra 19.2°E, Hotbird 13°E, Hispasat 30°W, Nilesat 7°W) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      <span
                        className={`text-xs font-semibold flex items-center gap-1 pr-1 shrink-0 ${
                          isLight ? 'text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        <Orbit className="w-3.5 h-3.5 text-amber-400" />
                        <span>Satellite :</span>
                      </span>
                      {SATELLITE_FILTERS.map((sat) => {
                        const active = selectedSatellite === sat.code;
                        const count = satelliteCounts[sat.code] || 0;
                        return (
                          <button
                            key={sat.code}
                            type="button"
                            onClick={() => handleSelectSatellite(sat.code)}
                            className={`min-h-[38px] px-3.5 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                              active
                                ? 'bg-amber-500 text-slate-950 font-semibold'
                                : isLight
                                ? 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                                : 'bg-[#131B2E] border border-slate-800/80 text-slate-300 hover:text-slate-100'
                            }`}
                          >
                            <span>{sat.label}</span>
                            <span
                              className={`font-mono tabular-nums text-[11px] ${
                                active
                                  ? 'text-slate-900/80'
                                  : isLight
                                  ? 'text-slate-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}

                      <button
                        type="button"
                        onClick={() => setActiveTab('settings')}
                        className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1 border border-dashed ${
                          isLight
                            ? 'border-amber-500/60 text-amber-700 hover:bg-amber-50'
                            : 'border-amber-500/40 text-amber-400 hover:bg-amber-500/10'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Gérer URLs EPG ({activeSourcesCount})</span>
                      </button>
                    </div>

                    {/* Row 2: Bouquet Filter (Movistar+, Sky DE, Sky Italia, HBO/Cinemax, Canal+/FilmBox, AXN/Warner, OSN/MBC) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      <span
                        className={`text-xs font-semibold flex items-center gap-1 pr-1 shrink-0 ${
                          isLight ? 'text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        <Tv className="w-3.5 h-3.5 text-amber-400" />
                        <span>Bouquet :</span>
                      </span>
                      {BOUQUET_FILTERS.map((b) => {
                        const active = selectedBouquet === b;
                        const count = bouquetCounts[b] || 0;
                        return (
                          <button
                            key={b}
                            type="button"
                            onClick={() => handleSelectBouquet(b)}
                            className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                              active
                                ? 'bg-amber-500 text-slate-950 font-semibold'
                                : isLight
                                ? 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                                : 'bg-[#131B2E] border border-slate-800/80 text-slate-300 hover:text-slate-100'
                            }`}
                          >
                            <span>{b === 'Tous' ? 'Tous bouquets' : b}</span>
                            <span
                              className={`font-mono tabular-nums text-[11px] ${
                                active
                                  ? 'text-slate-900/80'
                                  : isLight
                                  ? 'text-slate-400'
                                  : 'text-slate-500'
                              }`}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Row 3: Country / Zone Filter (PL, ES, DE, IT, AR) */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                      <span
                        className={`text-xs font-semibold flex items-center gap-1 pr-1 shrink-0 ${
                          isLight ? 'text-slate-600' : 'text-slate-400'
                        }`}
                      >
                        <Globe className="w-3.5 h-3.5 text-amber-400" />
                        <span>Zone :</span>
                      </span>
                      {COUNTRY_FILTERS.map((c) => {
                        const active = selectedCountry === c.code;
                        const count = countryCounts[c.code] || 0;
                        return (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => handleSelectCountry(c.code)}
                            className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                              active
                                ? 'bg-amber-500 text-slate-950 font-semibold'
                                : isLight
                                ? 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                                : 'bg-[#131B2E] border border-slate-800/80 text-slate-300 hover:text-slate-100'
                            }`}
                          >
                            <span>{c.label}</span>
                            <span
                              className={`font-mono tabular-nums text-[11px] ${
                                active
                                  ? 'text-slate-900/80'
                                  : isLight
                                  ? 'text-slate-400'
                                  : 'text-slate-500'
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

                {/* Row 4: Cinema & Series Thematic Group Filter Bar */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                  {CHANNEL_GROUPS.map((group) => {
                    const active = selectedGroup === group;
                    const count = groupCounts[group] || 0;
                    return (
                      <button
                        key={group}
                        type="button"
                        onClick={() => setSelectedGroup(group)}
                        className={`min-h-[38px] px-3.5 py-1 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                          active
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : isLight
                            ? 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                            : 'bg-[#131B2E] border border-slate-800/80 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span>
                          {group === 'Tous' ? 'Tous Films & Séries' : group}
                        </span>
                        <span
                          className={`font-mono tabular-nums text-[11px] ${
                            active
                              ? 'text-slate-900/80'
                              : isLight
                              ? 'text-slate-400'
                              : 'text-slate-500'
                          }`}
                        >
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Quiet Unboxed Summary Row */}
                <div
                  className={`flex flex-wrap items-center justify-between gap-2 text-xs ${
                    isLight ? 'text-slate-500' : 'text-slate-400'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-1.5 font-mono tabular-nums">
                    <span>
                      {filteredChannels.length.toLocaleString('fr-FR')} chaînes
                      (Films/Séries VO+Sub & Football Live)
                    </span>
                    {selectedCategory !== 'Tous' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-400 font-semibold">
                          Catégorie : {selectedCategory}
                        </span>
                      </>
                    )}
                    {selectedSatellite !== 'Tous' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-400 font-semibold">
                          Sat : {selectedSatellite}
                        </span>
                      </>
                    )}
                    {selectedBouquet !== 'Tous' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-amber-400 font-semibold">
                          Bouquet : {selectedBouquet}
                        </span>
                      </>
                    )}
                    {selectedCountry !== 'Tous' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Zone : {selectedCountry}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span>{getLocalTimezoneLabel()}</span>
                  </div>
                  {metadata && (
                    <div className="flex items-center gap-1.5 font-mono tabular-nums">
                      <span>
                        {loadingProgress.fromCache
                          ? 'Cache Whitelist IndexedDB'
                          : `${activeSourcesCount} flux XML.GZ filtrés`}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {metadata.programmeCount.toLocaleString('fr-FR')} films &
                        séries
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Active View Content */}
              {activeTab === 'grid' ? (
                <TimeGridView
                  channels={filteredChannels}
                  schedulesByChannel={schedulesByChannel}
                  referenceTimeMs={referenceTimeMs}
                  activeTimeFilter={selectedTimeFilter}
                  onSelectTimeFilter={setSelectedTimeFilter}
                  onChangeReferenceTime={(ms, preset) => {
                    setReferenceTimeMs(ms);
                    if (preset) {
                      setSelectedTimeFilter(preset);
                      setIsCustomTime(preset !== 'now');
                    } else {
                      setIsCustomTime(true);
                    }
                  }}
                  onSelectChannel={handleSelectChannel}
                  selectedCategory={selectedCategory}
                  onSelectCategory={handleSelectCategory}
                  categoryCounts={categoryCounts}
                  selectedSatellite={selectedSatellite}
                  onSelectSatellite={handleSelectSatellite}
                  satelliteCounts={satelliteCounts}
                  selectedCountry={selectedCountry}
                  onSelectCountry={handleSelectCountry}
                  countryCounts={countryCounts}
                  selectedBouquet={selectedBouquet}
                  onSelectBouquet={handleSelectBouquet}
                  bouquetCounts={bouquetCounts}
                  isLight={isLight}
                />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Channel List (En cours & À venir) */}
                  <div className="lg:col-span-7 space-y-3">
                    {activeTab === 'favorites' && reminders.length > 0 && (
                      <div
                        className={`rounded-2xl p-4 border mb-4 ${
                          isLight
                            ? 'bg-amber-50/60 border-amber-200'
                            : 'bg-[#131B2E] border-amber-500/30'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2.5">
                          <h3 className="text-xs font-semibold flex items-center gap-1.5 text-amber-400">
                            <Bell className="w-3.5 h-3.5" />
                            <span>
                              Rappels de programmes enregistrés (
                              {reminders.length})
                            </span>
                          </h3>
                        </div>
                        <div className="divide-y divide-slate-800/40">
                          {reminders.map((rem) => (
                            <div
                              key={rem.id}
                              className="py-2 flex items-center justify-between gap-3 text-xs"
                            >
                              <div className="min-w-0">
                                <p className="font-semibold truncate">
                                  {rem.title}
                                </p>
                                <p
                                  className={`font-mono tabular-nums text-[11px] ${
                                    isLight ? 'text-slate-500' : 'text-slate-400'
                                  }`}
                                >
                                  {rem.channelName} ·{' '}
                                  {formatShortDate(rem.startMs)} ·{' '}
                                  {formatLocalTimeRange(
                                    rem.startMs,
                                    rem.stopMs
                                  )}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const next = reminders.filter(
                                    (r) => r.id !== rem.id
                                  );
                                  setReminders(next);
                                  saveReminders(next);
                                }}
                                aria-label="Supprimer le rappel"
                                className="min-h-[36px] min-w-[36px] rounded-lg flex items-center justify-center text-slate-400 hover:text-red-400"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {filteredChannels.length === 0 ? (
                      <div
                        className={`rounded-3xl p-10 border text-center ${
                          isLight
                            ? 'bg-white border-slate-200 text-slate-600'
                            : 'bg-[#131B2E] border-slate-800/80 text-slate-400'
                        }`}
                      >
                        <p className="text-sm font-semibold">
                          {activeTab === 'favorites'
                            ? 'Aucune chaîne favorite enregistrée'
                            : 'Aucune chaîne ne correspond aux filtres sélectionnés'}
                        </p>
                        <p className="text-xs mt-1">
                          {activeTab === 'favorites'
                            ? 'Appuyez sur l’étoile d’une chaîne dans la liste En Direct pour l’ajouter à vos favoris locaux.'
                            : 'Essayez un autre satellite (Astra 19.2°E, Hotbird 13°E, Hispasat 30°W, Nilesat OSN/MBC) ou réinitialisez les filtres.'}
                        </p>
                        {(searchQuery ||
                          selectedSatellite !== 'Tous' ||
                          selectedCountry !== 'Tous' ||
                          selectedBouquet !== 'Tous' ||
                          selectedGroup !== 'Tous') && (
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery('');
                              setSelectedSatellite('Tous');
                              setSelectedCountry('Tous');
                              setSelectedBouquet('Tous');
                              setSelectedGroup('Tous');
                            }}
                            className="mt-4 min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs"
                          >
                            Réinitialiser tous les filtres
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {displayedChannels.map((channel) => {
                          const live = channelLiveMap[channel.id];
                          return (
                            <ChannelRowCard
                              key={channel.id}
                              channel={channel}
                              currentProgramme={live?.current || null}
                              nextProgramme={live?.next || null}
                              referenceTimeMs={referenceTimeMs}
                              isSelected={selectedChannelId === channel.id}
                              isFavorite={favorites.includes(channel.id)}
                              onSelectChannel={handleSelectChannel}
                              onToggleFavorite={handleToggleFavorite}
                              isLight={isLight}
                            />
                          );
                        })}

                        {visibleCount < filteredChannels.length && (
                          <div className="pt-2 text-center">
                            <button
                              type="button"
                              onClick={() => setVisibleCount((c) => c + 48)}
                              className={`min-h-[48px] w-full rounded-2xl font-semibold text-xs transition-colors border ${
                                isLight
                                  ? 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                                  : 'bg-[#131B2E] border-slate-800 hover:bg-slate-800/70 text-slate-200'
                              }`}
                            >
                              Afficher plus de chaînes (
                              {filteredChannels.length - visibleCount}{' '}
                              restantes)
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Right Column: Sticky Channel Detail Inspector (Desktop) */}
                  <div className="hidden lg:block lg:col-span-5 sticky top-20">
                    <ChannelDetailPanel
                      channel={selectedChannel}
                      schedule={
                        selectedChannel
                          ? schedulesByChannel[selectedChannel.id] || []
                          : []
                      }
                      referenceTimeMs={referenceTimeMs}
                      isFavorite={
                        selectedChannel
                          ? favorites.includes(selectedChannel.id)
                          : false
                      }
                      onToggleFavorite={handleToggleFavorite}
                      reminders={reminders}
                      onToggleReminder={handleToggleReminder}
                      onCloseMobile={() => setMobileSheetOpen(false)}
                      onMetadataResolved={handleMetadataResolved}
                      isLight={isLight}
                    />
                  </div>
                </div>
              )}
            </>
          )
        )}
      </main>

      {/* Mobile Bottom Sheet Drawer for Channel Schedule & Programme Details */}
      {mobileSheetOpen && selectedChannel && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end"
          onClick={() => setMobileSheetOpen(false)}
        >
          <div
            className="w-full max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <ChannelDetailPanel
              channel={selectedChannel}
              schedule={schedulesByChannel[selectedChannel.id] || []}
              referenceTimeMs={referenceTimeMs}
              isFavorite={favorites.includes(selectedChannel.id)}
              onToggleFavorite={handleToggleFavorite}
              reminders={reminders}
              onToggleReminder={handleToggleReminder}
              onCloseMobile={() => setMobileSheetOpen(false)}
              onMetadataResolved={handleMetadataResolved}
              isLight={isLight}
            />
          </div>
        </div>
      )}

      {/* Fixed Bottom Tab Bar on Mobile (Ergonomic Natural Thumb Zone, <= 15% sticky height) */}
      <nav
        aria-label="Navigation principale mobile"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-md pb-safe ${
          isLight
            ? 'bg-white/95 border-slate-200'
            : 'bg-[#0B0F17]/95 border-slate-800/90'
        }`}
      >
        <div className="grid grid-cols-4 items-center h-14">
          <button
            type="button"
            onClick={() => setActiveTab('live')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'live'
                ? 'text-amber-400'
                : isLight
                ? 'text-slate-500'
                : 'text-slate-400'
            }`}
          >
            <Tv className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              En Direct
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('grid')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'grid'
                ? 'text-amber-400'
                : isLight
                ? 'text-slate-500'
                : 'text-slate-400'
            }`}
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              Grille TV
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('favorites')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'favorites'
                ? 'text-amber-400'
                : isLight
                ? 'text-slate-500'
                : 'text-slate-400'
            }`}
          >
            <Star
              className="w-5 h-5"
              fill={activeTab === 'favorites' ? 'currentColor' : 'none'}
            />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              Favoris ({favorites.length})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'settings'
                ? 'text-amber-400'
                : isLight
                ? 'text-slate-500'
                : 'text-slate-400'
            }`}
          >
            <Database className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5 whitespace-nowrap">
              Sources ({activeSourcesCount})
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
