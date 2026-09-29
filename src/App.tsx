import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Baby,
  Bell,
  Clock,
  Compass,
  Film,
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
  buildSourcesSignature,
  clearEpgCache,
  DEFAULT_EPG_SOURCES,
  DEFAULT_SETTINGS,
  getBouquetsForSatellite,
  isBouquetFilterAllowedBySettings,
  isCategoryFilterAllowedBySettings,
  isChannelAllowedBySettings,
  isSatelliteFilterAllowedBySettings,
  loadAppSettings,
  loadEpgFromCache,
  loadFavoriteChannels,
  loadReminders,
  MAX_ACTIVE_BOUQUETS,
  pruneSchedulesToActiveWindow,
  RAM_LIMIT_WARNING_MESSAGE,
  SAT_TO_BOUQUETS_MAP,
  saveAppSettings,
  saveEpgToCache,
  saveFavoriteChannels,
  saveReminders,
  STRICT_SAT_FILTER_LIST,
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

type ViewMode = 'live' | 'grid' | 'favorites';
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
  const [selectedBouquetsList, setSelectedBouquetsList] = useState<
    BouquetFilter[]
  >([]);
  const [ramWarningMessage, setRamWarningMessage] = useState<string | null>(
    null
  );
  const [selectedGroup, setSelectedGroup] = useState<ChannelGroup>('Tous');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [timeOffsetMinutes, setTimeOffsetMinutes] = useState<number>(0);
  const [activeTimePreset, setActiveTimePreset] =
    useState<ActiveTimePreset>('now');

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

  // Chargement initial : lecture instantanée du cache IndexedDB (TTL 12h) ou lancement du Worker
  useEffect(() => {
    let mounted = true;
    (async () => {
      const cached = await loadEpgFromCache();

      if (cached && cached.channels.length > 0) {
        if (!mounted) return;
        const allowedCachedChannels = cached.channels.filter((ch) =>
          isChannelAllowedBySettings(ch, settings)
        );
        const prunedSchedules = pruneSchedulesToActiveWindow(
          cached.schedulesByChannel,
          Date.now()
        );
        setChannels(
          allowedCachedChannels.length > 0
            ? allowedCachedChannels
            : cached.channels
        );
        setSchedulesByChannel(prunedSchedules);
        setCacheMeta(cached.metadata);

        const cacheAgeMs =
          Date.now() - (cached.metadata.lastUpdatedMs || 0);
        const isOlderThan12Hours = cacheAgeMs > 12 * 3600 * 1000;
        if (isOlderThan12Hours && settings.autoRefreshHours > 0) {
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
      const cleanId = cleanXmltvChannelId(ch.id);
      const list =
        schedulesByChannel[cleanId] || schedulesByChannel[ch.id] || [];
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
      const pair = currentAndNextByChannel[ch.id];
      if (!pair?.current && !pair?.next) return false;
      if (viewMode === 'favorites' && !favoriteSet.has(ch.id)) return false;
      if (q && !matchesSearch(ch, q)) return false;
      return true;
    });
  }, [
    settingsAllowedChannels,
    currentAndNextByChannel,
    viewMode,
    favoriteSet,
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
        ch.satellites.includes('Badr 26°E')
      );
    }
    return ch.satellites.includes(sat);
  };

  const matchesSingleBouquet = (ch: EpgChannel, bq: BouquetFilter): boolean => {
    if (bq === 'Tous') return true;
    const combined = `${ch.id} ${ch.displayName}`.toLowerCase();

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
          ch.bouquetId === 'sky_de' ||
          ch.bouquets.includes('Movistar+ / DAZN ES') ||
          ch.bouquets.includes('Sky DE / DAZN DE'))
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
    return ch.bouquets.includes(bq);
  };

  const matchesBouquet = useCallback(
    (ch: EpgChannel, bq: BouquetFilter): boolean => {
      if (selectedBouquetsList.length > 0 && bq === selectedBouquet) {
        return selectedBouquetsList.some((item) =>
          matchesSingleBouquet(ch, item)
        );
      }
      return matchesSingleBouquet(ch, bq);
    },
    [selectedBouquetsList, selectedBouquet]
  );

  // Gestion stricte du changement de Satellite : réinitialise immédiatement tout bouquet hors du satellite choisi
  const handleSelectSatellite = useCallback((sat: SatelliteFilter) => {
    setSelectedSatellite(sat);
    setRamWarningMessage(null);
    const allowedBouquets = getBouquetsForSatellite(sat);
    setSelectedBouquetsList((prev) =>
      sat === 'Tous'
        ? prev
        : prev.filter((b) => allowedBouquets.includes(b)).slice(0, 1)
    );
    setSelectedBouquet((prev) =>
      allowedBouquets.includes(prev) ? prev : 'Tous'
    );
  }, []);

  // Gestion de la sélection de Bouquet avec limite stricte de 3 bouquets simultanés max (RAM < 50 Mo)
  const handleSelectBouquet = useCallback(
    (bq: BouquetFilter) => {
      if (bq === 'Tous') {
        setSelectedBouquet('Tous');
        setSelectedBouquetsList([]);
        setRamWarningMessage(null);
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

  // Recalcul en temps réel des compteurs croisés ([CATÉGORIE] -> [SATELLITE / BOUQUET] -> [GENRE])
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
    selectedGroup,
    settings.enabledCategories,
    matchesCategory,
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
      'Eutelsat 16°E / Thor 0.8°W': 0,
      'Star One D2 70°W': 0,
      'Amazonas 61°W': 0,
      'Intelsat 43.1°W / SES-6 40.5°W': 0,
      'Intelsat 43.1°W & SES-6 40.5°W': 0,
    };

    const pool = baseViewChannels.filter(
      (ch) =>
        matchesCategory(ch, selectedCategory) &&
        matchesGroup(ch, selectedGroup)
    );

    counts.Tous = pool.length;
    for (const ch of pool) {
      for (const sat of ch.satellites) {
        counts[sat] = (counts[sat] || 0) + 1;
        if (sat === "Badr / Es'hailSat 26°E") {
          counts['Badr 26°E'] = (counts['Badr 26°E'] || 0) + 1;
        }
      }
    }
    return counts;
  }, [
    baseViewChannels,
    selectedCategory,
    selectedGroup,
    matchesCategory,
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
    selectedGroup,
    matchesCategory,
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
        matchesBouquet(ch, selectedBouquet)
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
    matchesCategory,
    matchesGroup,
  ]);

  // Auto-réinitialisation si un filtre actif est désactivé dans Settings ou tombe à 0 chaîne
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
      selectedGroup !== 'Tous' &&
      selectedGroup !== 'Toutes' &&
      (groupCounts[selectedGroup] ?? 0) === 0
    ) {
      setSelectedGroup('Tous');
    }
  }, [
    baseViewChannels.length,
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
    selectedGroup,
    settings.enabledCategories,
    settings.selectedBouquets,
    categoryCounts,
    satelliteCounts,
    bouquetCounts,
    groupCounts,
  ]);

  // Options visibles : masque strictement tout satellite/bouquet/catégorie/genre inactif dans Réglages ou dont le compteur = 0
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

  // Filtrage final dynamique des chaînes (alimente à la fois En Direct, Grille TV et Favoris)
  const filteredChannels = useMemo(() => {
    return baseViewChannels.filter((ch) => {
      if (!matchesCategory(ch, selectedCategory)) return false;
      if (!matchesSatellite(ch, selectedSatellite)) return false;
      if (!matchesBouquet(ch, selectedBouquet)) return false;
      if (!matchesGroup(ch, selectedGroup)) return false;
      return true;
    });
  }, [
    baseViewChannels,
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
    selectedGroup,
    matchesCategory,
    matchesGroup,
  ]);

  useEffect(() => {
    setVisibleLimit(60);
  }, [
    selectedCategory,
    selectedSatellite,
    selectedBouquet,
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
    setActiveTimePreset('prime');
  };

  const resetAllFilters = () => {
    setSelectedCategory('Tous');
    setSelectedSatellite('Tous');
    setSelectedBouquet('Tous');
    setSelectedBouquetsList([]);
    setRamWarningMessage(null);
    setSelectedGroup('Tous');
    setSearchQuery('');
    setTimeOffsetMinutes(0);
    setActiveTimePreset('now');
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
                type="button"
                onClick={() => {
                  setTimeOffsetMinutes((prev) => prev - 120);
                  setActiveTimePreset('minus');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                  activeTimePreset === 'minus'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700/70 hover:bg-slate-800'
                }`}
              >
                -2h
              </button>

              <button
                type="button"
                onClick={() => {
                  setTimeOffsetMinutes(0);
                  setActiveTimePreset('now');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                  activeTimePreset === 'now'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700/70 hover:bg-slate-800'
                }`}
              >
                {tr.presetNow}
              </button>

              <button
                type="button"
                onClick={jumpToPrimeTimeTonight}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                  activeTimePreset === 'prime'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700/70 hover:bg-slate-800'
                }`}
              >
                {tr.presetPrime}
              </button>

              <button
                type="button"
                onClick={() => {
                  setTimeOffsetMinutes((prev) => prev + 120);
                  setActiveTimePreset('plus');
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                  activeTimePreset === 'plus'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md shadow-amber-500/25'
                    : 'bg-slate-800/90 text-slate-300 border-slate-700/70 hover:bg-slate-800'
                }`}
              >
                +2h
              </button>
            </div>
          </div>

          {/* Barres de filtres rapides [CATÉGORIE] -> [SATELLITE / BOUQUET] -> [GENRE] */}
          {viewMode !== 'grid' && (
            <div className="pt-2.5 border-t border-slate-800/80 space-y-2">
              {/* Ligne 1 : [CATÉGORIE] */}
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
                      type="button"
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
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/60">
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
                          onClick={() => handleSelectSatellite(sat)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 cursor-pointer border ${
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
                          onClick={() => handleSelectBouquet(bq)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium shrink-0 cursor-pointer border ${
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
                        onClick={() => setSelectedGroup(grp)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all shrink-0 cursor-pointer border ${
                          active
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-sm'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
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
              (selectedGroup !== 'Tous' && selectedGroup !== 'Toutes') ||
              searchQuery ||
              timeOffsetMinutes !== 0) && (
              <button
                type="button"
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
            onSelectSatellite={handleSelectSatellite}
            selectedBouquet={selectedBouquet}
            onSelectBouquet={handleSelectBouquet}
            selectedBouquetsList={selectedBouquetsList}
            ramWarningMessage={ramWarningMessage}
            selectedGroup={selectedGroup}
            onSelectGroup={setSelectedGroup}
            categoryCounts={categoryCounts}
            satelliteCounts={satelliteCounts}
            bouquetCounts={bouquetCounts}
            groupCounts={groupCounts}
            allowedSatelliteOptions={visibleSatelliteOptions}
            allowedBouquetOptions={visibleBouquetOptions}
            allowedCategoryCodes={visibleCategoryOptions.map((c) => c.code)}
            allowedGroupOptions={visibleGroupOptions}
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
          programmes={
            schedulesByChannel[cleanXmltvChannelId(selectedChannel.id)] ||
            schedulesByChannel[selectedChannel.id] ||
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
