import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Clock,
  Compass,
  Film,
  Globe,
  Heart,
  Languages,
  LayoutGrid,
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
  ChannelGroup,
  ContentCategoryFilter,
  CountryCode,
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
  buildSourcesSignature,
  clearEpgCache,
  DEFAULT_EPG_SOURCES,
  DEFAULT_SETTINGS,
  isBouquetFilterAllowedBySettings,
  isCategoryFilterAllowedBySettings,
  isChannelAllowedBySettings,
  isCountryFilterAllowedBySettings,
  isSatelliteFilterAllowedBySettings,
  loadAppSettings,
  loadEpgFromCache,
  loadFavoriteChannels,
  loadReminders,
  saveAppSettings,
  saveEpgToCache,
  saveFavoriteChannels,
  saveReminders,
  syncSourcesWithSelectedBouquets,
} from './services/storageService';
import {
  APP_TIMEZONE_LABEL,
  formatDayLabel,
  formatTimeShort,
  getCasablancaTimestampForHour,
} from './utils/timeFormat';
import { ChannelRowCard } from './components/ChannelRowCard';
import { TimeGridView } from './components/TimeGridView';
import { ChannelDetailPanel } from './components/ChannelDetailPanel';
import { SettingsModal } from './components/SettingsModal';
import { LoadingStatusBanner } from './components/LoadingStatusBanner';
import { PWAInstallButton } from './components/PWAInstallButton';
import {
  clearEnrichedMetadataCache,
  enrichProgrammeMetadata,
} from './services/metadataEnricher';
import {
  getLanguageOption,
  getTranslations,
  LANGUAGE_OPTIONS,
  setActiveLanguage,
  translateBouquetFilter,
  translateCategoryFilter,
  translateCountryFilter,
  translateSatelliteFilter,
  translateSubGenreGroup,
} from './utils/i18n';

type ViewMode = 'live' | 'grid' | 'favorites';

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
  'Intelsat 43.1°W / SES-6 40.5°W',
];

const BOUQUET_OPTIONS: BouquetFilter[] = [
  'Tous',
  'Nilesat OSN/MBC',
  'beIN / SSC / AD Sports',
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

export function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadAppSettings());
  const [channels, setChannels] = useState<EpgChannel[]>([]);
  const [schedulesByChannel, setSchedulesByChannel] = useState<
    Record<string, EpgProgramme[]>
  >({});
  const [cacheMeta, setCacheMeta] = useState<EpgCacheMetadata | null>(null);

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [workerProgress, setWorkerProgress] =
    useState<WorkerProgressMessage | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>('live');
  const [selectedCategory, setSelectedCategory] =
    useState<ContentCategoryFilter>('Tous');
  const [selectedSatellite, setSelectedSatellite] =
    useState<SatelliteFilter>('Tous');
  const [selectedBouquet, setSelectedBouquet] =
    useState<BouquetFilter>('Tous');
  const [selectedCountry, setSelectedCountry] = useState<CountryCode>('Tous');
  const [selectedGroup, setSelectedGroup] = useState<ChannelGroup>('Toutes');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState<number>(0);

  const [favorites, setFavorites] = useState<string[]>(() =>
    loadFavoriteChannels()
  );
  const [reminders, setReminders] = useState<ProgrammeReminder[]>(() =>
    loadReminders()
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
  const [visibleLimit, setVisibleLimit] = useState<number>(60);

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

  // Horloge temps réel (rafraîchie toutes les 30s)
  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const effectiveTimeMs = useMemo(
    () => nowMs + timeOffsetMinutes * 60000,
    [nowMs, timeOffsetMinutes]
  );

  const triggerEpgSync = useCallback((currentSettings: AppSettings) => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    const worker = new Worker(
      new URL('./workers/epgWorker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    setIsSyncing(true);

    worker.onmessage = async (event: MessageEvent<WorkerResponseMessage>) => {
      const msg = event.data;
      if (msg.type === 'EPG_PROGRESS') {
        setWorkerProgress(msg);
      } else if (msg.type === 'EPG_COMPLETE') {
        const {
          metadata,
          channels: parsedChannels,
          schedulesByChannel: parsedSchedules,
        } = msg.payload;
        setChannels(parsedChannels);
        setSchedulesByChannel(parsedSchedules);
        setCacheMeta(metadata);
        setIsSyncing(false);
        setWorkerProgress(null);

        try {
          await saveEpgToCache(metadata, parsedChannels, parsedSchedules);
        } catch {
          // Ignore IndexedDB quota error
        }
        worker.terminate();
        workerRef.current = null;
      } else if (msg.type === 'EPG_ERROR') {
        setIsSyncing(false);
        setWorkerProgress(null);
        worker.terminate();
        workerRef.current = null;
      }
    };

    const req: WorkerRequestMessage = {
      type: 'START_EPG_SYNC',
      payload: {
        sources: syncSourcesWithSelectedBouquets(
          currentSettings.selectedBouquets,
          currentSettings.sources
        ),
        windowHours: currentSettings.windowHours,
        cacheTtlHours: currentSettings.cacheTtlHours,
        isNativeCapacitor: false,
        selectedBouquets: currentSettings.selectedBouquets,
        excludePolishLektor: currentSettings.excludePolishLektor,
        excludeNoSubtitles: currentSettings.excludeNoSubtitles,
        enabledCategories: currentSettings.enabledCategories,
      },
    };
    worker.postMessage(req);
  }, []);

  // Chargement initial : lecture instantanée du cache IndexedDB ou lancement du Worker
  useEffect(() => {
    let mounted = true;
    (async () => {
      const cached = await loadEpgFromCache();
      const expectedSig = buildSourcesSignature(settings);

      if (
        cached &&
        cached.channels.length > 0 &&
        cached.metadata.sourcesSignature === expectedSig
      ) {
        if (!mounted) return;
        const allowedCachedChannels = cached.channels.filter((ch) =>
          isChannelAllowedBySettings(ch, settings)
        );
        setChannels(allowedCachedChannels);
        setSchedulesByChannel(cached.schedulesByChannel);
        setCacheMeta(cached.metadata);

        const isExpired = Date.now() > cached.metadata.expiresAtMs;
        if (isExpired && settings.autoRefreshHours > 0) {
          triggerEpgSync(settings);
        }
      } else {
        if (!mounted) return;
        triggerEpgSync(settings);
      }
    })();

    return () => {
      mounted = false;
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, []);

  // Liste des chaînes autorisées par les Paramètres (Settings)
  const settingsAllowedChannels = useMemo(
    () => channels.filter((ch) => isChannelAllowedBySettings(ch, settings)),
    [channels, settings]
  );

  // Map des programmes en cours et suivants pour chaque chaîne à l'instant `effectiveTimeMs`
  const currentAndNextByChannel = useMemo(() => {
    const map: Record<
      string,
      { current: EpgProgramme | null; next: EpgProgramme | null }
    > = {};

    for (const ch of settingsAllowedChannels) {
      const list = schedulesByChannel[ch.id] || [];
      let current: EpgProgramme | null = null;
      let next: EpgProgramme | null = null;

      for (let i = 0; i < list.length; i++) {
        const p = list[i];
        if (p.startMs <= effectiveTimeMs && p.stopMs > effectiveTimeMs) {
          current = p;
          next = list[i + 1] || null;
          break;
        }
        if (p.startMs > effectiveTimeMs) {
          next = p;
          break;
        }
      }

      map[ch.id] = { current, next };
    }
    return map;
  }, [settingsAllowedChannels, schedulesByChannel, effectiveTimeMs]);

  const favoriteSet = useMemo(() => new Set(favorites), [favorites]);

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
    return settingsAllowedChannels.filter((ch) => {
      if (viewMode === 'favorites' && !favoriteSet.has(ch.id)) return false;
      if (q && !matchesSearch(ch, q)) return false;
      return true;
    });
  }, [
    settingsAllowedChannels,
    viewMode,
    favoriteSet,
    searchQuery,
    matchesSearch,
  ]);

  const matchesCategory = (
    ch: EpgChannel,
    cat: ContentCategoryFilter
  ): boolean => cat === 'Tous' || ch.contentCategory === cat;

  const matchesSatellite = (ch: EpgChannel, sat: SatelliteFilter): boolean =>
    sat === 'Tous' || ch.satellites.includes(sat);

  const matchesBouquet = (ch: EpgChannel, bq: BouquetFilter): boolean => {
    if (bq === 'Tous') return true;
    if (bq === 'Nilesat OSN/MBC') {
      return (
        ch.bouquets.includes('Nilesat OSN/MBC') ||
        ch.bouquets.includes('OSN / MBC (Nilesat)')
      );
    }
    if (bq === 'beIN / SSC / AD Sports' || bq === 'beIN / SSC (MENA)') {
      return (
        ch.bouquets.includes('beIN / SSC / AD Sports') ||
        ch.bouquets.includes('beIN / SSC (MENA)')
      );
    }
    return ch.bouquets.includes(bq);
  };

  const matchesCountry = (ch: EpgChannel, c: CountryCode): boolean =>
    c === 'Tous' || ch.country === c;

  const matchesGroup = (ch: EpgChannel, grp: ChannelGroup): boolean =>
    grp === 'Toutes' || grp === 'Tous' || ch.group === grp;

  // Recalcul en temps réel des compteurs croisés
  const categoryCounts = useMemo(() => {
    const counts: Record<ContentCategoryFilter, number> = {
      Tous: 0,
      'Films & Séries': 0,
      'Sport / Football': 0,
      Documentaires: 0,
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
      if (
        isCategoryFilterAllowedBySettings(
          ch.contentCategory,
          settings.enabledCategories
        )
      ) {
        counts[ch.contentCategory] = (counts[ch.contentCategory] || 0) + 1;
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
  ]);

  const satelliteCounts = useMemo(() => {
    const counts: Record<SatelliteFilter, number> = {
      Tous: 0,
      'Nilesat 7°W': 0,
      'Astra 19.2°E': 0,
      'Hotbird 13°E': 0,
      'Hispasat 30°W': 0,
      'Eutelsat 16°E / Thor 0.8°W': 0,
      'Star One D2 70°W': 0,
      'Amazonas 61°W': 0,
      'Intelsat 43.1°W / SES-6 40.5°W': 0,
      'Intelsat 43.1°W & SES-6 40.5°W': 0,
    };

    const pool = baseViewChannels.filter(
      (ch) =>
        matchesCategory(ch, selectedCategory) &&
        matchesBouquet(ch, selectedBouquet) &&
        matchesCountry(ch, selectedCountry) &&
        matchesGroup(ch, selectedGroup)
    );

    counts.Tous = pool.length;
    for (const ch of pool) {
      for (const sat of ch.satellites) {
        if (
          isSatelliteFilterAllowedBySettings(sat, settings.selectedBouquets)
        ) {
          counts[sat] = (counts[sat] || 0) + 1;
        }
      }
    }
    return counts;
  }, [
    baseViewChannels,
    selectedCategory,
    selectedBouquet,
    selectedCountry,
    selectedGroup,
    settings.selectedBouquets,
  ]);

  const bouquetCounts = useMemo(() => {
    const counts: Record<BouquetFilter, number> = {
      Tous: 0,
      'Nilesat OSN/MBC': 0,
      'beIN / SSC (MENA)': 0,
      'beIN / SSC / AD Sports': 0,
      'Astra Canal+': 0,
      'Movistar+ / DAZN ES': 0,
      'Sky DE / DAZN DE': 0,
      'Sky Italia / DAZN IT': 0,
      'Canal+ / Eleven / FilmBox': 0,
      'HBO / Cinemax': 0,
      'AXN / Warner / Sci-Fi': 0,
      'OSN / MBC (Nilesat)': 0,
      'DigitAlb / Total TV / Focus Sat': 0,
      'Claro TV Brasil': 0,
      'Vivo TV / Movistar LATAM': 0,
      'DirecTV LATAM / Sky Brasil': 0,
    };

    const pool = baseViewChannels.filter(
      (ch) =>
        matchesCategory(ch, selectedCategory) &&
        matchesSatellite(ch, selectedSatellite) &&
        matchesCountry(ch, selectedCountry) &&
        matchesGroup(ch, selectedGroup)
    );

    counts.Tous = pool.length;
    for (const ch of pool) {
      for (const bq of BOUQUET_OPTIONS) {
        if (
          bq !== 'Tous' &&
          isBouquetFilterAllowedBySettings(bq, settings.selectedBouquets) &&
          matchesBouquet(ch, bq)
        ) {
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
    settings.selectedBouquets,
  ]);

  const countryCounts = useMemo(() => {
    const counts: Record<CountryCode, number> = {
      Tous: 0,
      AR: 0,
      FR: 0,
      ES: 0,
      DE: 0,
      IT: 0,
      PL: 0,
      EU: 0,
      BR: 0,
      LATAM: 0,
      Autre: 0,
    };

    const pool = baseViewChannels.filter(
      (ch) =>
        matchesCategory(ch, selectedCategory) &&
        matchesSatellite(ch, selectedSatellite) &&
        matchesBouquet(ch, selectedBouquet) &&
        matchesGroup(ch, selectedGroup)
    );

    counts.Tous = pool.length;
    for (const ch of pool) {
      if (
        isCountryFilterAllowedBySettings(ch.country, settings.selectedBouquets)
      ) {
        counts[ch.country] = (counts[ch.country] || 0) + 1;
      }
    }
    return counts;
  }, [
    baseViewChannels,
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
    selectedGroup,
    settings.selectedBouquets,
  ]);

  const groupCounts = useMemo(() => {
    const counts: Record<ChannelGroup, number> = {
      Tous: 0,
      Toutes: 0,
      'Sport / Football': 0,
      Documentaires: 0,
      'Cinéma Premières': 0,
      'Séries TV & US': 0,
      'Action & Thriller': 0,
      'Comédie & Famille': 0,
      'Classiques & Culte': 0,
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
      counts[ch.group] = (counts[ch.group] || 0) + 1;
    }
    return counts;
  }, [
    baseViewChannels,
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
    selectedCountry,
  ]);

  // Auto-réinitialisation si un sous-filtre actif tombe à 0 ou est désactivé dans Settings
  useEffect(() => {
    if (baseViewChannels.length === 0) return;

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
    }

    if (
      selectedCountry !== 'Tous' &&
      (!isCountryFilterAllowedBySettings(
        selectedCountry,
        settings.selectedBouquets
      ) ||
        (countryCounts[selectedCountry] ?? 0) === 0)
    ) {
      setSelectedCountry('Tous');
    }

    if (
      selectedGroup !== 'Toutes' &&
      selectedGroup !== 'Tous' &&
      (groupCounts[selectedGroup] ?? 0) === 0
    ) {
      setSelectedGroup('Toutes');
    }
  }, [
    baseViewChannels.length,
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
    selectedCountry,
    selectedGroup,
    categoryCounts,
    satelliteCounts,
    bouquetCounts,
    countryCounts,
    groupCounts,
    settings.selectedBouquets,
    settings.enabledCategories,
  ]);

  // Options visibles (Masquage strict de tous les boutons dont le compteur est égal à 0)
  const visibleCategoryOptions = useMemo(
    () =>
      CATEGORY_OPTIONS.filter(
        (cat) =>
          cat.code === 'Tous' ||
          (isCategoryFilterAllowedBySettings(
            cat.code,
            settings.enabledCategories
          ) &&
            (categoryCounts[cat.code] ?? 0) > 0)
      ),
    [categoryCounts, settings.enabledCategories]
  );

  const visibleSatelliteOptions = useMemo(
    () =>
      SATELLITE_OPTIONS.filter(
        (sat) =>
          sat === 'Tous' ||
          (isSatelliteFilterAllowedBySettings(sat, settings.selectedBouquets) &&
            (satelliteCounts[sat] ?? 0) > 0)
      ),
    [satelliteCounts, settings.selectedBouquets]
  );

  const visibleBouquetOptions = useMemo(
    () =>
      BOUQUET_OPTIONS.filter(
        (bq) =>
          bq === 'Tous' ||
          (isBouquetFilterAllowedBySettings(bq, settings.selectedBouquets) &&
            (bouquetCounts[bq] ?? 0) > 0)
      ),
    [bouquetCounts, settings.selectedBouquets]
  );

  const visibleCountryOptions = useMemo(
    () =>
      COUNTRY_OPTIONS.filter(
        (c) =>
          c.code === 'Tous' ||
          (isCountryFilterAllowedBySettings(
            c.code,
            settings.selectedBouquets
          ) &&
            (countryCounts[c.code] ?? 0) > 0)
      ),
    [countryCounts, settings.selectedBouquets]
  );

  const visibleGroupOptions = useMemo(
    () =>
      GROUP_OPTIONS.filter(
        (grp) => grp === 'Toutes' || (groupCounts[grp] ?? 0) > 0
      ),
    [groupCounts]
  );

  // Filtrage final des chaînes
  const filteredChannels = useMemo(() => {
    return baseViewChannels.filter((ch) => {
      if (!matchesCategory(ch, selectedCategory)) return false;
      if (!matchesSatellite(ch, selectedSatellite)) return false;
      if (!matchesBouquet(ch, selectedBouquet)) return false;
      if (!matchesCountry(ch, selectedCountry)) return false;
      if (!matchesGroup(ch, selectedGroup)) return false;
      return true;
    });
  }, [
    baseViewChannels,
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
    selectedCountry,
    selectedGroup,
  ]);

  useEffect(() => {
    setVisibleLimit(60);
  }, [
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
    selectedCountry,
    selectedGroup,
    searchQuery,
    viewMode,
  ]);

  const handleToggleFavorite = useCallback((channelId: string) => {
    setFavorites((prev) => {
      const exists = prev.includes(channelId);
      const next = exists
        ? prev.filter((id) => id !== channelId)
        : [...prev, channelId];
      saveFavoriteChannels(next);
      return next;
    });
  }, []);

  const handleToggleReminder = useCallback(
    (programme: EpgProgramme, channel: EpgChannel) => {
      setReminders((prev) => {
        const exists = prev.some((r) => r.id === programme.id);
        const next = exists
          ? prev.filter((r) => r.id !== programme.id)
          : [
              ...prev,
              {
                id: programme.id,
                channelId: channel.id,
                channelName: channel.displayName,
                title: programme.title,
                startMs: programme.startMs,
                stopMs: programme.stopMs,
                category: programme.category,
              },
            ];
        saveReminders(next);
        return next;
      });
    },
    []
  );

  const handleSaveSettings = useCallback(
    async (newSettings: AppSettings, forceReload: boolean) => {
      const syncedSources = syncSourcesWithSelectedBouquets(
        newSettings.selectedBouquets,
        newSettings.sources
      );
      const finalizedSettings: AppSettings = {
        ...newSettings,
        sources: syncedSources,
      };

      setSettings(finalizedSettings);
      saveAppSettings(finalizedSettings);

      // Purge stricte et immédiate des bouquets désactivés du State et du Cache IndexedDB/LocalStorage
      const purgedChannels = channels.filter((ch) =>
        isChannelAllowedBySettings(ch, finalizedSettings)
      );
      const allowedChannelIds = new Set(purgedChannels.map((c) => c.id));
      const purgedSchedules: Record<string, EpgProgramme[]> = {};
      let remainingProgCount = 0;

      for (const chId of Object.keys(schedulesByChannel)) {
        if (allowedChannelIds.has(chId)) {
          purgedSchedules[chId] = schedulesByChannel[chId];
          remainingProgCount += schedulesByChannel[chId].length;
        }
      }

      setChannels(purgedChannels);
      setSchedulesByChannel(purgedSchedules);

      if (selectedChannel && !allowedChannelIds.has(selectedChannel.id)) {
        setSelectedChannel(null);
        setSelectedModalProgramme(null);
      }

      if (cacheMeta) {
        const updatedMeta: EpgCacheMetadata = {
          ...cacheMeta,
          sourcesSignature: buildSourcesSignature(finalizedSettings),
          channelCount: purgedChannels.length,
          programmeCount: remainingProgCount,
        };
        setCacheMeta(updatedMeta);
        try {
          await saveEpgToCache(updatedMeta, purgedChannels, purgedSchedules);
        } catch {
          // Ignore quota error
        }
      }

      if (forceReload) {
        triggerEpgSync(finalizedSettings);
      }
    },
    [
      channels,
      schedulesByChannel,
      selectedChannel,
      cacheMeta,
      triggerEpgSync,
    ]
  );

  const handleResetDefaults = useCallback(() => {
    const reset: AppSettings = {
      ...DEFAULT_SETTINGS,
      language: settings.language,
      sources: syncSourcesWithSelectedBouquets(
        DEFAULT_SETTINGS.selectedBouquets,
        DEFAULT_EPG_SOURCES
      ),
    };
    setSettings(reset);
    saveAppSettings(reset);
    triggerEpgSync(reset);
  }, [triggerEpgSync, settings.language]);

  const handleClearCache = useCallback(async () => {
    await clearEpgCache();
    setCacheMeta(null);
    triggerEpgSync(settings);
  }, [settings, triggerEpgSync]);

  const jumpToPrimeTimeTonight = () => {
    const target = getCasablancaTimestampForHour(nowMs, 20, 45);
    const diffMins = Math.round((target - nowMs) / 60000);
    setTimeOffsetMinutes(diffMins);
  };

  const resetAllFilters = () => {
    setSelectedCategory('Tous');
    setSelectedSatellite('Tous');
    setSelectedBouquet('Tous');
    setSelectedCountry('Tous');
    setSelectedGroup('Toutes');
    setSearchQuery('');
    setTimeOffsetMinutes(0);
  };

  const visibleChannels = useMemo(
    () => filteredChannels.slice(0, visibleLimit),
    [filteredChannels, visibleLimit]
  );

  // Enrichissement automatique en arrière-plan (dans la langue active) des programmes en direct visibles
  useEffect(() => {
    if (viewMode === 'grid' || visibleChannels.length === 0) return;

    let cancelled = false;
    const subset = visibleChannels.slice(0, 14);

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

  return (
    <div
      dir={langOpt.dir}
      className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-amber-500 selection:text-slate-950"
    >
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-xl border-b border-slate-800/80">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          {/* Brand Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
              <Satellite className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
                  Pulse<span className="text-amber-400">EPG</span>
                </h1>
                <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  <Volume2 className="w-3 h-3" />
                  VO + SUB
                </span>
                <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  <Trophy className="w-3 h-3" />
                  Global Satellites
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                {tr.appSubtitle}
              </p>
            </div>
          </div>

          {/* Mode Switcher (En Direct / Grille TV / Favoris) */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-2xl border border-slate-800">
            <button
              onClick={() => setViewMode('live')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'live'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>{tr.liveTab}</span>
            </button>

            <button
              onClick={() => setViewMode('grid')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{tr.gridTab}</span>
            </button>

            <button
              onClick={() => setViewMode('favorites')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'favorites'
                  ? 'bg-rose-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>{tr.favoritesTab}</span>
              {favorites.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-950/30">
                  {favorites.length}
                </span>
              )}
            </button>
          </div>

          {/* Right Actions : Sélecteur de Langue + PWA + Sync + Settings */}
          <div className="flex items-center gap-2">
            {/* Sélecteur de Langue Fluide dans le Header */}
            <div className="relative flex items-center">
              <Languages className="w-3.5 h-3.5 text-amber-400 absolute start-2.5 pointer-events-none" />
              <select
                value={activeLang}
                onChange={(e) =>
                  handleChangeLanguage(e.target.value as AppLanguage)
                }
                aria-label={tr.languageSectionTitle}
                className="ps-7 pe-6 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-100 border border-slate-800 focus:outline-none focus:border-amber-500 transition-colors cursor-pointer"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option
                    key={opt.code}
                    value={opt.code}
                    className="bg-slate-900 text-white"
                  >
                    {opt.flag} {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <PWAInstallButton language={activeLang} />

            <button
              onClick={() => triggerEpgSync(settings)}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 border border-slate-800 transition-colors cursor-pointer disabled:opacity-50"
              title={tr.refreshBtn}
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-amber-400 ${
                  isSyncing ? 'animate-spin' : ''
                }`}
              />
              <span className="hidden lg:inline">
                {isSyncing ? tr.refreshingBtn : tr.refreshBtn}
              </span>
            </button>

            <button
              onClick={() => {
                setSettingsInitialTab('filters');
                setIsSettingsOpen(true);
              }}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-colors cursor-pointer"
              title={tr.settingsTitle}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-5">
        {/* Bannière de progression Web Worker */}
        <LoadingStatusBanner
          progress={workerProgress}
          isSyncing={isSyncing}
          language={activeLang}
        />

        {/* Barre de Recherche & Contrôle Temporel Rapide */}
        <div className="mb-4 rounded-2xl bg-slate-900/90 border border-slate-800/90 p-3 sm:p-4 shadow-lg space-y-3">
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute start-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={tr.searchPlaceholder}
                className="w-full ps-10 pe-9 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/70 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Time Offset Presets */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono text-amber-300 shrink-0">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{formatDayLabel(effectiveTimeMs, activeLang)}</span>
                <span className="font-bold">
                  {formatTimeShort(effectiveTimeMs)}
                </span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-sans font-semibold">
                  {APP_TIMEZONE_LABEL}
                </span>
              </div>

              <button
                onClick={() => setTimeOffsetMinutes((prev) => prev - 60)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700/70 cursor-pointer shrink-0"
              >
                {tr.presetMinus1h}
              </button>

              <button
                onClick={() => setTimeOffsetMinutes(0)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                  timeOffsetMinutes === 0
                    ? 'bg-amber-500 text-slate-950 border-amber-400'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700/70 hover:bg-slate-800'
                }`}
              >
                {tr.presetNow}
              </button>

              <button
                onClick={jumpToPrimeTimeTonight}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-xs font-semibold text-indigo-300 border border-indigo-500/30 cursor-pointer shrink-0"
              >
                {tr.presetPrime}
              </button>

              <button
                onClick={() => setTimeOffsetMinutes((prev) => prev + 60)}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-xs font-semibold text-slate-300 border border-slate-700/70 cursor-pointer shrink-0"
              >
                {tr.presetPlus1h}
              </button>
            </div>
          </div>

          {/* Barres de filtres rapides (uniquement affichées en mode Live / Favoris) */}
          {viewMode !== 'grid' && (
            <div className="pt-2.5 border-t border-slate-800/80 space-y-2">
              {/* Ligne 0 : Catégories principales */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
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
                      onClick={() => setSelectedCategory(cat.code)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border ${
                        active
                          ? cat.code === 'Sport / Football'
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20'
                            : cat.code === 'Documentaires'
                            ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-500/20'
                            : 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/20'
                          : 'bg-slate-950 text-slate-200 border-slate-800 hover:bg-slate-800 hover:border-slate-700'
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
                          onClick={() => setSelectedSatellite(sat)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all shrink-0 cursor-pointer border ${
                            active
                              ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
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
                          onClick={() => setSelectedCountry(c.code)}
                          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer border ${
                            active
                              ? 'bg-indigo-600 text-white border-indigo-400 font-bold'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
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
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800/60">
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
                            onClick={() => setSelectedBouquet(bq)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer border ${
                              active
                                ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold'
                                : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
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
                            onClick={() => setSelectedGroup(grp)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer border ${
                              active
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                                : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
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
          )}

          {/* Résumé Statut & Bouton Reset Filtres */}
          <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white">
                {filteredChannels.length}
              </span>
              <span>
                {tr.channelsDisplayed} {settingsAllowedChannels.length}
              </span>
              {cacheMeta && (
                <>
                  <span className="text-slate-700">•</span>
                  <span>
                    {cacheMeta.programmeCount.toLocaleString()}{' '}
                    {tr.activeProgrammes}
                  </span>
                </>
              )}
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium ms-1">
                <Subtitles className="w-3.5 h-3.5" />
                VO + SUB
              </span>
            </div>

            {(selectedCategory !== 'Tous' ||
              selectedSatellite !== 'Tous' ||
              selectedBouquet !== 'Tous' ||
              selectedCountry !== 'Tous' ||
              selectedGroup !== 'Toutes' ||
              searchQuery ||
              timeOffsetMinutes !== 0) && (
              <button
                onClick={resetAllFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {tr.resetFiltersBtn}
              </button>
            )}
          </div>
        </div>

        {/* Rappels actifs dans l'onglet Favoris */}
        {viewMode === 'favorites' && reminders.length > 0 && (
          <div className="mb-4 rounded-2xl p-4 bg-slate-900/90 border border-amber-500/30 space-y-2.5">
            <h3 className="text-xs font-bold flex items-center gap-1.5 text-amber-400 uppercase tracking-wider">
              <Bell className="w-3.5 h-3.5" />
              {tr.savedRemindersTitle} ({reminders.length})
            </h3>
            <div className="divide-y divide-slate-800/60">
              {reminders.map((rem) => (
                <div
                  key={rem.id}
                  className="py-2 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{rem.title}</p>
                    <p className="text-[11px] font-mono text-slate-400">
                      {rem.channelName} ·{' '}
                      {formatDayLabel(rem.startMs, activeLang)}{' '}
                      {formatTimeShort(rem.startMs)} –{' '}
                      {formatTimeShort(rem.stopMs)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      const next = reminders.filter((r) => r.id !== rem.id);
                      setReminders(next);
                      saveReminders(next);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contenu Principal : Vue Grille TV ou Vue Liste En Direct */}
        {viewMode === 'grid' ? (
          <TimeGridView
            channels={filteredChannels}
            programmesByChannel={schedulesByChannel}
            nowMs={effectiveTimeMs}
            favorites={favorites}
            onToggleFavorite={handleToggleFavorite}
            onSelectChannel={(ch, prog) => {
              setSelectedChannel(ch);
              setSelectedModalProgramme(prog || null);
            }}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            selectedSatellite={selectedSatellite}
            onSelectSatellite={setSelectedSatellite}
            selectedBouquet={selectedBouquet}
            onSelectBouquet={setSelectedBouquet}
            selectedCountry={selectedCountry}
            onSelectCountry={setSelectedCountry}
            selectedGroup={selectedGroup}
            onSelectGroup={setSelectedGroup}
            categoryCounts={categoryCounts}
            satelliteCounts={satelliteCounts}
            bouquetCounts={bouquetCounts}
            countryCounts={countryCounts}
            groupCounts={groupCounts}
            language={activeLang}
          />
        ) : filteredChannels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/50 p-10 text-center max-w-lg mx-auto my-8">
            <Satellite className="w-10 h-10 text-amber-400/60 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white">
              {tr.noChannelsFoundTitle}
            </h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {tr.noChannelsFoundDesc}
            </p>
            <button
              onClick={resetAllFilters}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {tr.showAllSatellitesBtn}
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visibleChannels.map((ch) => {
              const pair = currentAndNextByChannel[ch.id] || {
                current: null,
                next: null,
              };
              return (
                <ChannelRowCard
                  key={ch.id}
                  channel={ch}
                  currentProgramme={pair.current}
                  nextProgramme={pair.next}
                  nowMs={effectiveTimeMs}
                  isFavorite={favoriteSet.has(ch.id)}
                  onToggleFavorite={handleToggleFavorite}
                  onSelectChannel={(channel) => {
                    setSelectedChannel(channel);
                    setSelectedModalProgramme(pair.current);
                  }}
                  isSelected={selectedChannel?.id === ch.id}
                  language={activeLang}
                />
              );
            })}

            {filteredChannels.length > visibleLimit && (
              <div className="pt-4 text-center">
                <button
                  onClick={() => setVisibleLimit((prev) => prev + 60)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-800 text-xs font-bold transition-colors cursor-pointer"
                >
                  {tr.loadMoreChannels} (
                  {filteredChannels.length - visibleLimit} {tr.remainingLabel})
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer Légal & Attribution TMDB (Conformité Google Play Store) */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/90 py-4 px-4 sm:px-6 text-[11px] text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
            <span className="font-bold text-slate-300">
              PulseEPG - Global TV Guide
            </span>
            <span>•</span>
            <span>
              This product uses the TMDB API but is not endorsed or certified by
              TMDB.
            </span>
          </div>
          <button
            onClick={() => {
              setSettingsInitialTab('legal');
              setIsSettingsOpen(true);
            }}
            className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
          >
            <Scale className="w-3.5 h-3.5" />
            <span>{tr.tabLegalPlayStore}</span>
          </button>
        </div>
      </footer>

      {/* Panneau Latéral / Modal Fiche Programme & Grille Complète par Chaîne */}
      {selectedChannel && (
        <ChannelDetailPanel
          channel={selectedChannel}
          programmes={schedulesByChannel[selectedChannel.id] || []}
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
        />
      )}

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
