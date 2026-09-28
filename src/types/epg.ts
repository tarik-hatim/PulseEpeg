export type ContentCategoryFilter =
  | 'Tous'
  | 'Films & Séries'
  | 'Sport / Football';

export type TimeFilterPreset = 'now' | 'prime' | 'minus1h' | 'plus1h';

export type ChannelGroup =
  | 'Tous'
  | 'Cinéma Premières'
  | 'Action & Thriller'
  | 'Séries TV & US'
  | 'Comédie & Famille'
  | 'Classiques & Culte'
  | 'Sport / Football';

export type CountryCode = 'Tous' | 'PL' | 'ES' | 'IT' | 'DE' | 'AR' | 'Autre';

export type SatelliteFilter =
  | 'Tous'
  | 'Astra 19.2°E'
  | 'Hotbird 13°E'
  | 'Hispasat 30°W'
  | 'Nilesat 7°W';

export type BouquetFilter =
  | 'Tous'
  | 'Movistar+ / DAZN ES'
  | 'Sky DE / DAZN DE'
  | 'Sky Italia / DAZN IT'
  | 'Canal+ / Eleven / FilmBox'
  | 'HBO / Cinemax'
  | 'AXN / Warner / Sci-Fi'
  | 'OSN / MBC (Nilesat)'
  | 'beIN / SSC / AD Sports';

export interface EpgSourceItem {
  id: string;
  name: string;
  url: string;
  country: Exclude<CountryCode, 'Tous'>;
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
  audioTrackLabel: string;
  subtitleTrackLabel: string;
  lektorStatus?: string;
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
  startMs: number;
  stopMs: number;
  date?: string;
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
  sourceUrl: string;
  sources: EpgSourceItem[];
  cacheTtlHours: number;
  windowHours: number;
  theme: 'dark' | 'light';
}

export interface WorkerRequestMessage {
  type: 'START_EPG_SYNC';
  payload: {
    sources: EpgSourceItem[];
    windowHours: number;
    cacheTtlHours: number;
    isNativeCapacitor: boolean;
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
