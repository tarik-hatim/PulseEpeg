export type AppLanguage = 'fr' | 'en' | 'ar' | 'es' | 'de' | 'pt';

export type ContentCategoryFilter =
  | 'Tous'
  | 'Films & Séries'
  | 'Sport / Football'
  | 'Documentaires';

export type ThematicCategoryId =
  | 'Films & Séries'
  | 'Sport / Football'
  | 'Documentaires'
  | 'Classiques & Culte'
  | 'Jeunesse & Famille';

export type EpgBouquetId =
  | 'nilesat_osn_mbc'
  | 'astra_canal_fr'
  | 'movistar_es'
  | 'sky_de'
  | 'sky_it'
  | 'canal_pl'
  | 'eutelsat_16e_thor'
  | 'starone_70w_claro_br'
  | 'amazonas_61w_latam'
  | 'intelsat_43w_directv';

export type TimeFilterPreset = 'now' | 'prime' | 'minus1h' | 'plus1h';

export type ChannelGroup =
  | 'Tous'
  | 'Toutes'
  | 'Cinéma Premières'
  | 'Action & Thriller'
  | 'Séries TV & US'
  | 'Comédie & Famille'
  | 'Classiques & Culte'
  | 'Documentaires'
  | 'Sport / Football';

export type CountryCode =
  | 'Tous'
  | 'PL'
  | 'ES'
  | 'IT'
  | 'DE'
  | 'FR'
  | 'AR'
  | 'EU'
  | 'BR'
  | 'LATAM'
  | 'Autre';

export type SatelliteFilter =
  | 'Tous'
  | 'Astra 19.2°E'
  | 'Hotbird 13°E'
  | 'Hispasat 30°W'
  | 'Nilesat 7°W'
  | 'Eutelsat 16°E / Thor 0.8°W'
  | 'Star One D2 70°W'
  | 'Amazonas 61°W'
  | 'Intelsat 43.1°W / SES-6 40.5°W'
  | 'Intelsat 43.1°W & SES-6 40.5°W';

export type BouquetFilter =
  | 'Tous'
  | 'Nilesat OSN/MBC'
  | 'beIN / SSC (MENA)'
  | 'Astra Canal+'
  | 'Movistar+ / DAZN ES'
  | 'Sky DE / DAZN DE'
  | 'Sky Italia / DAZN IT'
  | 'Canal+ / Eleven / FilmBox'
  | 'HBO / Cinemax'
  | 'AXN / Warner / Sci-Fi'
  | 'OSN / MBC (Nilesat)'
  | 'beIN / SSC / AD Sports'
  | 'DigitAlb / Total TV / Focus Sat'
  | 'Claro TV Brasil'
  | 'Vivo TV / Movistar LATAM'
  | 'DirecTV LATAM / Sky Brasil';

export interface EpgSourceItem {
  id: string;
  name: string;
  url: string;
  country: Exclude<CountryCode, 'Tous'>;
  bouquetId?: EpgBouquetId;
  enabled: boolean;
}

export interface EpgSourceSyncStatus {
  id: string;
  name: string;
  url: string;
  country: Exclude<CountryCode, 'Tous'>;
  status: 'pending' | 'downloading' | 'parsing' | 'done' | 'error';
  channelsAdded: number;
  channelsFilteredOut?: number;
  programmesAdded: number;
  bytesLoaded: number;
  error?: string;
}

export interface EpgChannel {
  id: string;
  displayName: string;
  url?: string;
  icon?: string;
  contentCategory: Exclude<ContentCategoryFilter, 'Tous'>;
  group: Exclude<ChannelGroup, 'Tous'>;
  country: Exclude<CountryCode, 'Tous'>;
  satellites: Exclude<SatelliteFilter, 'Tous'>[];
  orbitalPosition: string;
  bouquets: Exclude<BouquetFilter, 'Tous'>[];
  bouquetId?: EpgBouquetId;
  audioTrackLabel: string;
  subtitleTrackLabel: string;
  lektorStatus?: string;
  hasPolishLektor?: boolean;
  hasSubtitles?: boolean;
  sourceId: string;
  sourceName: string;
  channelNumber: number;
  programmeCount: number;
}

export interface EpgProgramme {
  id: string;
  channelId: string;
  title: string;
  originalTitle?: string;
  subTitle?: string;
  description?: string;
  category: string;
  rawCategory?: string;
  icon?: string;
  backdrop?: string;
  rating?: string;
  enrichedSource?: string;
  startMs: number;
  stopMs: number;
  date?: string;
  country?: string;
  episodeNum?: string;
  directors?: string[];
  actors?: string[];
  hasOriginalAudioVO?: boolean;
  hasSubtitles?: boolean;
}

export interface EpgCacheMetadata {
  sourceUrl: string;
  sourcesSignature: string;
  sourceResults?: EpgSourceSyncStatus[];
  lastUpdatedMs: number;
  expiresAtMs: number;
  channelCount: number;
  channelsExcludedCount?: number;
  programmeCount: number;
  compressedBytes: number;
  uncompressedBytes: number;
  minTimestampMs: number;
  maxTimestampMs: number;
  parseDurationMs: number;
}

export type LoadingPhase =
  | 'idle'
  | 'checking_cache'
  | 'downloading'
  | 'decompressing'
  | 'parsing'
  | 'caching'
  | 'ready'
  | 'error';

export interface EpgLoadingProgress {
  active: boolean;
  phase: LoadingPhase;
  bytesLoaded: number;
  bytesTotal: number;
  channelsParsed: number;
  channelsFilteredOut?: number;
  programmesParsed: number;
  message: string;
  currentSourceIndex?: number;
  completedSources?: number;
  totalSources?: number;
  currentSourceName?: string;
  sourceStatuses?: EpgSourceSyncStatus[];
  fromCache?: boolean;
  error?: string;
}

export interface ProgrammeReminder {
  id: string;
  channelId: string;
  channelName: string;
  title: string;
  startMs: number;
  stopMs: number;
  category: string;
}

export interface AppSettings {
  language: AppLanguage;
  sourceUrl: string;
  sources: EpgSourceItem[];
  cacheTtlHours: number;
  autoRefreshHours: number;
  windowHours: number;
  theme: 'dark' | 'light';
  autoTimezone: boolean;
  manualTimezone: string;
  selectedBouquets: EpgBouquetId[];
  excludePolishLektor: boolean;
  excludeNoSubtitles: boolean;
  enabledCategories: ThematicCategoryId[];
}

export interface WorkerRequestMessage {
  type: 'START_EPG_SYNC';
  payload: {
    sources: EpgSourceItem[];
    windowHours: number;
    cacheTtlHours: number;
    isNativeCapacitor: boolean;
    selectedBouquets?: EpgBouquetId[];
    excludePolishLektor?: boolean;
    excludeNoSubtitles?: boolean;
    enabledCategories?: ThematicCategoryId[];
  };
}

export interface WorkerProgressMessage {
  type: 'EPG_PROGRESS';
  payload: EpgLoadingProgress;
}

export interface WorkerSuccessMessage {
  type: 'EPG_COMPLETE';
  payload: {
    metadata: EpgCacheMetadata;
    channels: EpgChannel[];
    schedulesByChannel: Record<string, EpgProgramme[]>;
  };
}

export interface WorkerErrorMessage {
  type: 'EPG_ERROR';
  payload: {
    error: string;
  };
}

export type WorkerResponseMessage =
  | WorkerProgressMessage
  | WorkerSuccessMessage
  | WorkerErrorMessage;
