export type AppLanguage = 'fr' | 'en' | 'ar' | 'es' | 'de' | 'pt' | 'it' | 'tr';

export type TvProfileId =
  | 'france_europe_fr'
  | 'moyen_orient_golfe'
  | 'maghreb_mena'
  | 'espagne'
  | 'italie'
  | 'amerique_sud_latam'
  | 'europe_standard'
  | 'all_satellites'
  | 'custom';

export type ContentCategoryFilter =
  | 'Tous'
  | 'Films & Séries'
  | 'Documentaires'
  | 'Actualités / News'
  | 'Jeunesse / Enfants'
  | 'Musique & Divertissement'
  | 'Sport / Football';

export type ThematicCategoryId =
  | 'Films & Séries'
  | 'Documentaires'
  | 'Actualités / News'
  | 'Jeunesse / Enfants'
  | 'Musique & Divertissement'
  | 'Sport / Football'
  | 'Classiques & Culte'
  | 'Jeunesse & Famille';

export type EpgBouquetId =
  | 'nilesat_osn_mbc'
  | 'badr_bein_ssc'
  | 'astra_canal_fr'
  | 'astra_tnt_fr'
  | 'tnt_fr'
  | 'movistar_es'
  | 'sky_de'
  | 'sky_it'
  | 'canal_pl'
  | 'hotbird_bis_fr'
  | 'hispasat_meo_nos'
  | 'eutelsat_16e_digitalb'
  | 'thor_08w_focussat'
  | 'eutelsat_16e_thor'
  | 'turkmenalem_52e_alem'
  | 'monacosat_52e_persiana'
  | 'trt_network'
  | 'starone_70w_claro_br'
  | 'amazonas_61w_latam'
  | 'intelsat_43w_directv';

export type TimeFilterPreset =
  | 'minus2h'
  | 'minus1h'
  | 'now'
  | 'prime'
  | 'plus1h'
  | 'plus2h';

export type ChannelGroup =
  | 'Tous'
  | 'Toutes'
  | 'Cinéma Premières'
  | 'Action & Thriller'
  | 'Séries TV & US'
  | 'Comédie & Famille'
  | 'Classiques & Culte'
  | 'Documentaires'
  | 'Actualités / News'
  | 'Jeunesse / Enfants'
  | 'Musique & Divertissement'
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

export type ChannelCountryFilter =
  | 'Tous'
  | 'TR'
  | 'AL'
  | 'SN'
  | 'CI'
  | 'CM'
  | 'ML'
  | 'FR'
  | 'ES'
  | 'PT'
  | 'DE'
  | 'IT'
  | 'PL'
  | 'RO'
  | 'HU'
  | 'RS'
  | 'HR'
  | 'TM'
  | 'IR'
  | 'AR'
  | 'BR'
  | 'LATAM';

export type SatelliteFilter =
  | 'Tous'
  | 'Nilesat 7°W'
  | 'Badr 26°E'
  | "Badr / Es'hailSat 26°E"
  | 'Astra 19.2°E'
  | 'Hotbird 13°E'
  | 'Hispasat 30°W'
  | 'Eutelsat 16°E'
  | 'Türksat 42°E'
  | 'Türksat 42°E / Eutelsat 7°E'
  | 'Thor 0.8°W'
  | 'Thor 0.8°W / Intelsat 10-02'
  | 'TurkmenÄlem 52°E'
  | 'MonacoSat 52°E'
  | 'Star One 70°W'
  | 'Star One D2 70°W'
  | 'Amazonas 61°W'
  | 'SES-6 40.5°W'
  | 'Intelsat 43.1°W / SES-6 40.5°W'
  | 'Intelsat 43.1°W & SES-6 40.5°W';

export type BouquetFilter =
  | 'Tous'
  | 'Nilesat MBC/OSN/Rotana'
  | 'TNT Arabe/Égypte'
  | 'Badr beIN (Sports & Movies)'
  | 'Badr SSC'
  | 'Badr TV Arabes/Al Kass'
  | 'Astra Canal+ France'
  | 'Astra TNT France'
  | 'Astra Movistar+ España'
  | 'Hotbird Polsat/Cyfra+'
  | 'Hotbird Bis TV/Rai'
  | 'Hispasat Meo/NOS/Movistar'
  | 'DigitAlb (Albanie)'
  | 'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)'
  | 'Total TV (Balkans / Serbie / Croatie)'
  | 'Total TV (Balkans)'
  | 'MAXtv / A1 Croatia'
  | 'MAXtv (Croatie)'
  | 'MaxTV Sat (Croatie)'
  | 'New World TV (Afrique)'
  | 'Canal+ Réunion / Afrique'
  | 'Autres chaînes africaines / francophones'
  | 'Bouquet National RTSH (Albanie FTA)'
  | 'Bouquet National TVR (Roumanie FTA)'
  | 'Bouquet Afrique Francophone (2S TV, RTI, CRTV)'
  | 'A1 Bulgaria / A1 Hrvatska'
  | 'TVR / Chaînes Nationales (Roumanie)'
  | 'Focus Sat (Roumanie)'
  | 'Direct One (Hongrie)'
  | 'Digi TV'
  | 'Groupe Persiana'
  | 'Groupe WNS'
  | 'Information'
  | 'Information (Iran Intl / Afghanistan Intl)'
  | 'TRT Network'
  | 'Bouquet National Turkmène'
  | 'Alem TV'
  | 'Turkmenistan National TV'
  | 'Persiana Media Group (Farsi/Sport/Cinema)'
  | 'Big Bang TV'
  | 'Nilesat (MBC / OSN / Rotana)'
  | 'Badr 26°E (beIN / SSC / Al Kass)'
  | 'Badr Sport & MENA'
  | 'Canal+ France'
  | 'TNT France'
  | 'Bis TV France'
  | 'Movistar+ / DAZN ES'
  | 'Meo / NOS / Movistar 30°W'
  | 'Sky DE / DAZN DE'
  | 'Polsat / Cyfra+ / Eleven'
  | 'Bis TV (Hotbird 13°E)'
  | 'Rai / Sky Italia / Mediaset'
  | 'MEO / NOS / Movistar (30°W)'
  | 'HBO / Cinemax'
  | 'AXN / Warner / Sci-Fi'
  | 'Nilesat OSN/MBC'
  | 'beIN / SSC (MENA)'
  | 'Astra Canal+'
  | 'Sky Italia / DAZN IT'
  | 'Canal+ / Eleven / FilmBox'
  | 'OSN / MBC (Nilesat)'
  | 'beIN / SSC / AD Sports'
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
  group?: ChannelGroup;
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
  channelIcon?: string;
  orbitalPosition?: string;
  title: string;
  subTitle?: string;
  description?: string;
  icon?: string;
  startMs: number;
  stopMs: number;
  category: string;
}

export interface AppSettings {
  language: AppLanguage;
  tvProfile?: TvProfileId;
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

export interface WorkerStartSyncMessage {
  type: 'START_EPG_SYNC';
  payload: {
    sources: EpgSourceItem[];
    windowHours: number;
    cacheTtlHours: number;
    isNativeCapacitor: boolean;
    tvProfile?: TvProfileId;
    selectedBouquets?: EpgBouquetId[];
    excludePolishLektor?: boolean;
    excludeNoSubtitles?: boolean;
    enabledCategories?: ThematicCategoryId[];
  };
}

export interface WorkerFetchResponseMessage {
  type: 'WORKER_FETCH_RESPONSE';
  payload: {
    requestId: string;
    ok: boolean;
    buffer?: ArrayBuffer;
    error?: string;
  };
}

export type WorkerRequestMessage =
  | WorkerStartSyncMessage
  | WorkerFetchResponseMessage;

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

export interface WorkerFetchRequestMessage {
  type: 'WORKER_FETCH_REQUEST';
  payload: {
    requestId: string;
    url: string;
  };
}

export type WorkerResponseMessage =
  | WorkerProgressMessage
  | WorkerSuccessMessage
  | WorkerErrorMessage
  | WorkerFetchRequestMessage;
