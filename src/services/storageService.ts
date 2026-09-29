import {
  AppLanguage,
  AppSettings,
  BouquetFilter,
  ContentCategoryFilter,
  CountryCode,
  EpgBouquetId,
  EpgCacheMetadata,
  EpgChannel,
  EpgProgramme,
  EpgSourceItem,
  ProgrammeReminder,
  SatelliteFilter,
  ThematicCategoryId,
} from '../types/epg';
import { applyDocumentLanguageDir, SUPPORTED_LANGUAGES } from '../utils/i18n';
import { configureActiveTimezone } from '../utils/timeFormat';
import {
  cleanXmltvChannelId,
  isPlaceholderProgrammeTitle,
} from '../utils/xmltvParser';

const DB_NAME = 'PulseEpgCacheDB';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'epg_snapshots';
const SNAPSHOT_KEY = 'active_epg_whitelist_v12';

const LS_META_KEY = 'pulse_epg_meta_v12';
const LS_SETTINGS_KEY = 'pulse_epg_settings_v5';
const LS_TZ_CASA_MIGRATED_KEY = 'pulse_epg_tz_casablanca_utc0_v1';
const LS_BOUQUETS_V8_MIGRATED_KEY = 'pulse_epg_bouquets_separated_v8';
const LS_CATEGORIES_V9_MIGRATED_KEY = 'pulse_epg_categories_all_v9';
const LS_FAVORITES_KEY = 'pulse_epg_favorites_v1';
const LS_REMINDERS_KEY = 'pulse_epg_reminders_v1';

export const MAX_ACTIVE_BOUQUETS = 3;
export const MAX_ACTIVE_SATELLITES = 2;
export const RAM_LIMIT_WARNING_MESSAGE =
  "Maximum 3 bouquets actifs simultanément pour garantir la fluidité de l'application";

export const STRICT_SAT_FILTER_LIST: SatelliteFilter[] = [
  'Tous',
  'Nilesat 7°W',
  "Badr / Es'hailSat 26°E",
  'Astra 19.2°E',
  'Hotbird 13°E',
  'Hispasat 30°W',
];

export const SAT_TO_BOUQUETS_MAP: Record<string, BouquetFilter[]> = {
  'Nilesat 7°W': ['Tous', 'Nilesat MBC/OSN/Rotana', 'TNT Arabe/Égypte'],
  "Badr / Es'hailSat 26°E": [
    'Tous',
    'Badr beIN (Sports & Movies)',
    'Badr SSC',
    'Badr TV Arabes/Al Kass',
  ],
  'Badr 26°E': [
    'Tous',
    'Badr beIN (Sports & Movies)',
    'Badr SSC',
    'Badr TV Arabes/Al Kass',
  ],
  'Astra 19.2°E': [
    'Tous',
    'Astra Canal+ France',
    'Astra TNT France',
    'Astra Movistar+ España',
  ],
  'Hotbird 13°E': ['Tous', 'Hotbird Polsat/Cyfra+', 'Hotbird Bis TV/Rai'],
  'Hispasat 30°W': ['Tous', 'Hispasat Meo/NOS/Movistar'],
  Tous: [
    'Tous',
    'Nilesat MBC/OSN/Rotana',
    'TNT Arabe/Égypte',
    'Badr beIN (Sports & Movies)',
    'Badr SSC',
    'Badr TV Arabes/Al Kass',
    'Astra Canal+ France',
    'Astra TNT France',
    'Astra Movistar+ España',
    'Hotbird Polsat/Cyfra+',
    'Hotbird Bis TV/Rai',
    'Hispasat Meo/NOS/Movistar',
  ],
};

export function getBouquetsForSatellite(sat: SatelliteFilter): BouquetFilter[] {
  return SAT_TO_BOUQUETS_MAP[sat] || SAT_TO_BOUQUETS_MAP['Tous'];
}

export interface BouquetOptionSpec {
  id: EpgBouquetId;
  flag: string;
  label: string;
  satellite: string;
  description: string;
  estRamMb: number;
  estimatedRamMb: number;
  sampleChannels: string[];
}

export interface SatelliteGroupSpec {
  satelliteId: string;
  orbitalPosition: string;
  title: string;
  flag: string;
  subtitle: string;
  bouquets: BouquetOptionSpec[];
}

export const EPG_BOUQUET_CATALOG: BouquetOptionSpec[] = [
  {
    id: 'nilesat_osn_mbc',
    flag: '🇲🇦/🇪🇬',
    label: 'Bouquets Arabes (MBC, OSN, Rotana, Al Jazeera, Spacetoon…)',
    satellite: 'Nilesat 7°W',
    description:
      'Films & Séries (MBC 2/Max/Action/Drama, OSN Movies/Series, Rotana Cinema, Dubai One), Documentaires (NatGeo AD, Al Jazeera Doc), News (Al Jazeera, Al Arabiya, Sky News), Jeunesse (MBC 3, Spacetoon, CN), Musique & Sport (ON Time, Arryadia)',
    estRamMb: 2.8,
    estimatedRamMb: 2.8,
    sampleChannels: ['MBC 1–4 / Max / Action / Drama', 'OSN & Rotana Cinema/Music', 'Al Jazeera / Al Arabiya / NatGeo', 'MBC 3 / Spacetoon / ON Time Sports'],
  },
  {
    id: 'badr_bein_ssc',
    flag: '🇶🇦/🇸🇦',
    label: 'Bouquets MENA, Cinéma, News & Sport (beIN, SSC, MBC, Al Kass, Rotana)',
    satellite: "Badr / Es'hailSat 26°E",
    description:
      'Films & Séries (beIN Movies 1–4, beIN Series/Drama, MBC, Rotana), Documentaires (Al Jazeera Doc, Asharq Discovery, NatGeo), News (Al Jazeera, Al Arabiya, Asharq), Jeunesse (Jeem, Baraem, MBC 3), Divertissement (Fatafeat, MBC 1, Wannasah) & Sport (beIN Sports, SSC, Al Kass, AD Sports)',
    estRamMb: 2.8,
    estimatedRamMb: 2.8,
    sampleChannels: ['beIN Movies & Series / MBC / Rotana', 'beIN Sports 1–7 / SSC / Al Kass', 'Al Jazeera / Al Arabiya / Doc', 'Jeem / Baraem / Fatafeat'],
  },
  {
    id: 'astra_canal_fr',
    flag: '🇫🇷',
    label: 'Canal+ France (Cinéma, Séries, Sport & Ciné+ OCS)',
    satellite: 'Astra 19.2°E',
    description:
      'Canal+ HD/UHD, Canal+ Box Office, Grand Écran, Cinéma(s), Séries, Docs, Foot, Sport, Ciné+ Frisson/Émotion/Classic, OCS, Planète+ & RMC Sport',
    estRamMb: 2.4,
    estimatedRamMb: 2.4,
    sampleChannels: ['Canal+ FR', 'C+ Box Office', 'Ciné+ OCS', 'C+ Foot / Sport'],
  },
  {
    id: 'astra_tnt_fr',
    flag: '🇫🇷',
    label: 'TNT France (TF1, France 2, France 3, M6, W9, TMC, TFX…)',
    satellite: 'Astra 19.2°E',
    description:
      'TF1, France 2, France 3, France 4, France 5, M6, Arte, W9, TMC, TFX, NRJ12, LCP, BFMTV, CNEWS, CSTAR, Gulli, TF1 Séries Films, L’Équipe, 6ter, RMC Story, RMC Découverte, Chérie 25',
    estRamMb: 2.2,
    estimatedRamMb: 2.2,
    sampleChannels: ['TF1 / M6', 'France 2 / 3 / 5', 'Arte / W9 / TMC / TFX', 'CSTAR / Gulli / L’Équipe'],
  },
  {
    id: 'movistar_es',
    flag: '🇪🇸',
    label: 'Movistar+ / DAZN España',
    satellite: 'Astra 19.2°E',
    description:
      'Movistar Plus+, M+ Estrenos, Acción, Drama, Clásicos, Comedia, M+ LaLiga, Liga de Campeones & DAZN 1–4 España',
    estRamMb: 3.0,
    estimatedRamMb: 3.0,
    sampleChannels: ['Movistar Plus+', 'M+ Estrenos', 'M+ LaLiga', 'DAZN España'],
  },
  {
    id: 'sky_de',
    flag: '🇩🇪',
    label: 'Sky Deutschland, DAZN DE & ZDF / ARD',
    satellite: 'Astra 19.2°E',
    description:
      'Sky Cinema Premiere/Action/Classics, Sky Atlantic, Warner TV, Sky Bundesliga, DAZN 1–2 DE, Das Erste ARD, ZDF, ProSieben & RTL',
    estRamMb: 3.4,
    estimatedRamMb: 3.4,
    sampleChannels: ['Sky Cinema DE', 'DAZN DE', 'ZDF / ARD', 'Sky Bundesliga'],
  },
  {
    id: 'canal_pl',
    flag: '🇵🇱',
    label: 'Polsat, Cyfra+ (Canal+ Polska), HBO & Eleven Sports',
    satellite: 'Hotbird 13°E',
    description:
      'Polsat Box, Cyfra+ / Canal+ Premium/Film/Series/Sport PL, HBO 1–3, Cinemax 1–2, Eleven Sports 1–4, FilmBox & AXN',
    estRamMb: 3.2,
    estimatedRamMb: 3.2,
    sampleChannels: ['Polsat / Cyfra+', 'Canal+ Polska', 'HBO 1–3', 'Eleven Sports'],
  },
  {
    id: 'hotbird_bis_fr',
    flag: '🇫🇷',
    label: 'Bis TV France (Hotbird 13°E)',
    satellite: 'Hotbird 13°E',
    description:
      'Bouquet Bis TV sur Hotbird 13°E : TF1, France 2–5, M6, Arte, W9, TMC, TFX, Gulli, RTL9, Action, Téva, Mangas, Science & Vie TV, Toute l’Histoire',
    estRamMb: 1.8,
    estimatedRamMb: 1.8,
    sampleChannels: ['Bis TV', 'RTL9 / Action / Téva', 'TF1 / France TV', 'Toute l’Histoire'],
  },
  {
    id: 'sky_it',
    flag: '🇮🇹',
    label: 'Rai, Mediaset & Sky Italia',
    satellite: 'Hotbird 13°E',
    description:
      'Rai 1, Rai 2, Rai 3, Rai 4, Rai Movie, Rai Premium, Canale 5, Italia 1, Rete 4, Iris, Cine34, Sky Cinema Uno/Due/Action & Sky Sport Calcio',
    estRamMb: 3.4,
    estimatedRamMb: 3.4,
    sampleChannels: ['Rai 1–4 / Rai Movie', 'Canale 5 / Italia 1', 'Sky Cinema IT', 'Sky Calcio'],
  },
  {
    id: 'hispasat_meo_nos',
    flag: '🇵🇹/🇪🇸',
    label: 'Meo, NOS & Movistar (Hispasat 30°W)',
    satellite: 'Hispasat 30°W',
    description:
      'MEO & NOS Portugal (TVCine Top/Edition/Emotion/Action, Canal Hollywood, AXN PT, Star Channel, Sport TV 1–5, BTV) & Movistar 30°W',
    estRamMb: 2.8,
    estimatedRamMb: 2.8,
    sampleChannels: ['MEO / NOS', 'TVCine / Hollywood', 'Sport TV 1–5', 'Movistar 30°W'],
  },
  {
    id: 'eutelsat_16e_thor',
    flag: '🇪🇺',
    label: 'DigitAlb, Total TV & Focus Sat',
    satellite: 'Eutelsat 16°E / Thor 0.8°W',
    description:
      'DigitAlb HD, SuperSport, Total TV, Focus Sat, Arena Sport, FilmBox Extra & HBO Europe Centrale',
    estRamMb: 2.8,
    estimatedRamMb: 2.8,
    sampleChannels: ['DigitAlb', 'Total TV', 'Focus Sat', 'SuperSport'],
  },
  {
    id: 'starone_70w_claro_br',
    flag: '🇧🇷',
    label: 'Claro TV Brasil',
    satellite: 'Star One D2 70°W',
    description:
      'Claro TV+ Brasil, Telecine Premium/Action/Pipoca/Cult, HBO Brasil, SporTV 1–3, Premiere FC & ESPN Brasil',
    estRamMb: 3.0,
    estimatedRamMb: 3.0,
    sampleChannels: ['Claro TV Brasil', 'Telecine HD', 'SporTV', 'Premiere FC'],
  },
  {
    id: 'amazonas_61w_latam',
    flag: '🌎',
    label: 'Vivo TV & Movistar TV LATAM',
    satellite: 'Amazonas 61°W',
    description:
      'Vivo TV & Movistar TV LATAM, HBO Mundi/Xtreme, Cinecanal, TNT Series, ESPN LATAM & Fox Sports',
    estRamMb: 2.9,
    estimatedRamMb: 2.9,
    sampleChannels: ['Vivo TV', 'Movistar TV LATAM', 'Cinecanal', 'ESPN LATAM'],
  },
  {
    id: 'intelsat_43w_directv',
    flag: '🇦🇷/🇨🇴',
    label: 'DirecTV Latin America, Sky Brasil & Oi TV',
    satellite: 'Intelsat 43.1°W / SES-6 40.5°W',
    description:
      'DSports (DirecTV Sports), Sky Brasil, Oi TV, HBO Plus LATAM, Universal Premiere, TNT Sports & TyC Sports',
    estRamMb: 3.1,
    estimatedRamMb: 3.1,
    sampleChannels: ['DirecTV LATAM', 'Sky Brasil', 'Oi TV', 'DSports HD'],
  },
];

/**
 * Groupement strict par Satellite / Position Orbitale (Nilesat 7°W et Badr 26°E toujours séparés !)
 */
export const SATELLITE_GROUPS_CATALOG: SatelliteGroupSpec[] = [
  {
    satelliteId: 'sat_nilesat_7w',
    orbitalPosition: 'Nilesat (7°W)',
    title: 'Nilesat (7°W) — Bouquets Arabes (Cinéma, Séries, Docs, News, Kids, Sport)',
    flag: '🇲🇦/🇪🇬',
    subtitle: 'MBC, OSN, Rotana, Al Jazeera, Al Arabiya, NatGeo, Spacetoon, ON Time',
    bouquets: EPG_BOUQUET_CATALOG.filter((b) => b.id === 'nilesat_osn_mbc'),
  },
  {
    satelliteId: 'sat_badr_26e',
    orbitalPosition: "Badr / Es'hailSat (26°E)",
    title: "Badr / Es'hailSat (26°E) — Bouquets MENA Complet (beIN, MBC, Rotana, SSC, Al Kass)",
    flag: '🇶🇦/🇸🇦',
    subtitle: 'beIN Movies/Series/Sports, SSC, Al Kass, MBC, Rotana, Al Jazeera, Jeem, Baraem',
    bouquets: EPG_BOUQUET_CATALOG.filter((b) => b.id === 'badr_bein_ssc'),
  },
  {
    satelliteId: 'sat_astra_19e',
    orbitalPosition: 'Astra (19.2°E)',
    title: 'Astra (19.2°E) — France, Espagne & Allemagne',
    flag: '🇫🇷/🇪🇸/🇩🇪',
    subtitle: 'Canal+ France, TNT France, Movistar+ / DAZN ES, Sky DE',
    bouquets: EPG_BOUQUET_CATALOG.filter((b) =>
      ['astra_canal_fr', 'astra_tnt_fr', 'movistar_es', 'sky_de'].includes(b.id)
    ),
  },
  {
    satelliteId: 'sat_hotbird_13e',
    orbitalPosition: 'Hotbird (13°E)',
    title: 'Hotbird (13°E) — Polsat, Cyfra+, Bis TV & Rai',
    flag: '🇵🇱/🇫🇷/🇮🇹',
    subtitle: 'Polsat Box, Cyfra+ (Canal+ PL), Bis TV France, Rai & Sky Italia',
    bouquets: EPG_BOUQUET_CATALOG.filter((b) =>
      ['canal_pl', 'hotbird_bis_fr', 'sky_it'].includes(b.id)
    ),
  },
  {
    satelliteId: 'sat_hispasat_30w',
    orbitalPosition: 'Hispasat (30°W)',
    title: 'Hispasat (30°W) — Meo, NOS & Movistar',
    flag: '🇵🇹/🇪🇸',
    subtitle: 'Meo, NOS Portugal (TVCine, Sport TV, Hollywood) & Movistar',
    bouquets: EPG_BOUQUET_CATALOG.filter((b) => b.id === 'hispasat_meo_nos'),
  },
  {
    satelliteId: 'sat_other_global',
    orbitalPosition: 'Autres Positions Orbitales (16°E / 0.8°W / 70°W / 61°W / 43°W)',
    title: 'Europe Centrale & Amérique Latine',
    flag: '🇪🇺/🌎',
    subtitle: 'Eutelsat 16°E, Thor 0.8°W, Star One D2 70°W, Amazonas 61°W, Intelsat 43.1°W',
    bouquets: EPG_BOUQUET_CATALOG.filter((b) =>
      [
        'eutelsat_16e_thor',
        'starone_70w_claro_br',
        'amazonas_61w_latam',
        'intelsat_43w_directv',
      ].includes(b.id)
    ),
  },
];

export const ALL_BOUQUET_IDS: EpgBouquetId[] = EPG_BOUQUET_CATALOG.map(
  (b) => b.id
);

export const DEFAULT_ENABLED_BOUQUET_IDS: EpgBouquetId[] = [
  'nilesat_osn_mbc',
  'badr_bein_ssc',
  'astra_canal_fr',
  'astra_tnt_fr',
  'movistar_es',
  'sky_de',
  'canal_pl',
  'hotbird_bis_fr',
  'sky_it',
  'hispasat_meo_nos',
];

export const THEMATIC_CATEGORIES_CATALOG: {
  id: ThematicCategoryId;
  label: string;
  description: string;
}[] = [
  {
    id: 'Films & Séries',
    label: 'Films & Séries',
    description: 'Cinéma, Drama, Action, Thriller, Comédie, Séries TV & Classiques',
  },
  {
    id: 'Documentaires',
    label: 'Documentaires & Culture',
    description:
      'Histoire, Nature, Science, Découverte & Géopolitique (NatGeo, Discovery, Planète+, Al Jazeera Doc, France 5, Arte)',
  },
  {
    id: 'Actualités / News',
    label: 'Actualités / News',
    description:
      'Information en continu, Débats & Économie (Al Jazeera, Al Arabiya, Sky News, BFMTV, CNEWS, LCI, France 24, 24h, Rai News)',
  },
  {
    id: 'Jeunesse / Enfants',
    label: 'Jeunesse / Enfants',
    description:
      'Dessins animés, Animation & Jeunesse (MBC 3, Spacetoon, Jeem, Baraem, Gulli, Cartoon Network, Disney, Nickelodeon, KiKA)',
  },
  {
    id: 'Musique & Divertissement',
    label: 'Musique & Divertissement',
    description:
      'Concerts, Clips, Variétés, Talk-shows & Divertissement (MBC 1, Rotana Music, Wannasah, CSTAR, MTV, Mezzo, NRJ, Fatafeat)',
  },
  {
    id: 'Sport / Football',
    label: 'Sport / Football',
    description:
      'Football, UEFA Champions League, Premier League, LaLiga, Serie A, Bundesliga, Roshn League & Sports généraux',
  },
  {
    id: 'Classiques & Culte',
    label: 'Classiques & Culte',
    description:
      'Cinéma de patrimoine, films d’auteur, Arte, TCM, Cinemax 2, Sky Classics, Rotana Classic',
  },
  {
    id: 'Jeunesse & Famille',
    label: 'Jeunesse & Famille',
    description:
      'Comédies familiales, films d’animation, Gulli, France 4, Sky Cinema Family, beIN Movies Family',
  },
];

export const EPG_THEMATIC_CATEGORIES = THEMATIC_CATEGORIES_CATALOG;

export const ALL_THEMATIC_CATEGORIES: ThematicCategoryId[] =
  THEMATIC_CATEGORIES_CATALOG.map((c) => c.id);

export const DEFAULT_EPG_SOURCE_URL =
  'https://epgshare01.online/epgshare01/epg_ripper_FR1.xml.gz';

export const DEFAULT_EPG_SOURCES: EpgSourceItem[] = [
  {
    id: 'src_fr1',
    name: '🇫🇷 Astra 19.2°E & Hotbird 13°E · Canal+ France, TNT France & Bis TV',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_FR1.xml.gz',
    country: 'FR',
    bouquetId: 'astra_canal_fr',
    enabled: true,
  },
  {
    id: 'src_es1',
    name: '🇪🇸 Astra 19.2°E & Hispasat 30°W · Movistar Plus+ & DAZN España',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_ES1.xml.gz',
    country: 'ES',
    bouquetId: 'movistar_es',
    enabled: true,
  },
  {
    id: 'src_pt1',
    name: '🇵🇹 Hispasat 30°W · MEO & NOS Portugal (TVCine, Canal Hollywood, Sport TV)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_PT1.xml.gz',
    country: 'ES',
    bouquetId: 'hispasat_meo_nos',
    enabled: true,
  },
  {
    id: 'src_de1',
    name: '🇩🇪 Astra 19.2°E · Sky Deutschland, DAZN DE & ZDF/ARD',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_DE1.xml.gz',
    country: 'DE',
    bouquetId: 'sky_de',
    enabled: true,
  },
  {
    id: 'src_it1',
    name: '🇮🇹 Hotbird 13°E · Rai, Mediaset, Sky Italia & DAZN IT',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_IT1.xml.gz',
    country: 'IT',
    bouquetId: 'sky_it',
    enabled: true,
  },
  {
    id: 'src_pl1',
    name: '🇵🇱 Hotbird 13°E · Polsat Box, Cyfra+ (Canal+ Polska), Eleven Sports, HBO & FilmBox',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_PL1.xml.gz',
    country: 'PL',
    bouquetId: 'canal_pl',
    enabled: true,
  },
  {
    id: 'src_ae1',
    name: '🇲🇦/🇪🇬 Nilesat 7°W · MBC 2, MBC Action, Dubai One & Rotana',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_AE1.xml.gz',
    country: 'AR',
    bouquetId: 'nilesat_osn_mbc',
    enabled: true,
  },
  {
    id: 'src_sa1',
    name: '🇲🇦/🇪🇬 Nilesat 7°W · Bouquet OSN (Movies Premiere, Hollywood, Series) & Alfa Cinema',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_SA1.xml.gz',
    country: 'AR',
    bouquetId: 'nilesat_osn_mbc',
    enabled: true,
  },
  {
    id: 'src_sa2',
    name: "🇶🇦/🇸🇦 Badr / Es'hailSat 26°E & Nilesat 7°W · SSC Sports HD, MBC Max & OSN Action",
    url: 'https://epgshare01.online/epgshare01/epg_ripper_SA2.xml.gz',
    country: 'AR',
    bouquetId: 'badr_bein_ssc',
    enabled: true,
  },
  {
    id: 'src_bein1',
    name: "🇶🇦/🇸🇦 Badr / Es'hailSat 26°E · beIN Sports MENA (1–7 HD, English, French, Max) & Al Kass 1–8",
    url: 'https://epgshare01.online/epgshare01/epg_ripper_BEIN1.xml.gz',
    country: 'AR',
    bouquetId: 'badr_bein_ssc',
    enabled: true,
  },
  {
    id: 'src_eu16e',
    name: '🇪🇺 Eutelsat 16°E / Thor 0.8°W · DigitAlb, Total TV & Focus Sat',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_RO1.xml.gz',
    country: 'EU',
    bouquetId: 'eutelsat_16e_thor',
    enabled: false,
  },
  {
    id: 'src_br70w',
    name: '🇧🇷 Star One D2 70°W · Claro TV Brasil (Telecine, HBO Brasil, SporTV, Premiere)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_BR1.xml.gz',
    country: 'BR',
    bouquetId: 'starone_70w_claro_br',
    enabled: false,
  },
  {
    id: 'src_latam61w',
    name: '🌎 Amazonas 61°W · Vivo TV & Movistar TV LATAM',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_CL1.xml.gz',
    country: 'LATAM',
    bouquetId: 'amazonas_61w_latam',
    enabled: false,
  },
  {
    id: 'src_directv43w',
    name: '🇦🇷/🇨🇴 Intelsat 43.1°W & SES-6 40.5°W · DirecTV Latin America, Sky Brasil & Oi TV',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_CO1.xml.gz',
    country: 'LATAM',
    bouquetId: 'intelsat_43w_directv',
    enabled: false,
  },
];

export function inferBouquetIdForSource(source: EpgSourceItem): EpgBouquetId {
  const u = source.url.toLowerCase();
  if (u.includes('_bein')) return 'badr_bein_ssc';
  if (u.includes('_pt1')) return 'hispasat_meo_nos';
  if (u.includes('_ro1') || source.country === 'EU') return 'eutelsat_16e_thor';
  if (u.includes('_br1') || source.country === 'BR') return 'starone_70w_claro_br';
  if (u.includes('_cl1') || u.includes('_pe1')) return 'amazonas_61w_latam';
  if (u.includes('_co1') || u.includes('_ar1') || source.country === 'LATAM') {
    return 'intelsat_43w_directv';
  }
  if (source.bouquetId) return source.bouquetId;
  if (source.country === 'PL' || u.includes('_pl')) return 'canal_pl';
  if (source.country === 'FR' || u.includes('_fr')) return 'astra_canal_fr';
  if (source.country === 'ES' || u.includes('_es')) return 'movistar_es';
  if (source.country === 'DE' || u.includes('_de')) return 'sky_de';
  if (source.country === 'IT' || u.includes('_it')) return 'sky_it';
  return 'nilesat_osn_mbc';
}

export function resolveChannelBouquetId(ch: {
  bouquetId?: EpgBouquetId;
  country: Exclude<CountryCode, 'Tous'>;
  bouquets?: string[];
  satellites?: string[];
}): EpgBouquetId {
  if (ch.bouquetId) return ch.bouquetId;
  if (ch.bouquets?.some((b) => b.includes('TNT France'))) return 'astra_tnt_fr';
  if (ch.bouquets?.some((b) => b.includes('Bis TV'))) return 'hotbird_bis_fr';
  if (ch.bouquets?.some((b) => b.includes('MEO / NOS'))) return 'hispasat_meo_nos';
  if (
    ch.bouquets?.some(
      (b) =>
        b.includes('beIN') ||
        b.includes('SSC') ||
        b.includes('Al Kass') ||
        b.includes('Badr')
    ) ||
    ch.satellites?.some((s) => s.includes('Badr'))
  ) {
    return 'badr_bein_ssc';
  }
  if (ch.country === 'EU') return 'eutelsat_16e_thor';
  if (ch.country === 'BR') return 'starone_70w_claro_br';
  if (ch.country === 'LATAM') {
    if (ch.bouquets?.some((b) => b.includes('Vivo'))) return 'amazonas_61w_latam';
    return 'intelsat_43w_directv';
  }
  if (ch.country === 'FR') return 'astra_canal_fr';
  if (ch.country === 'ES') return 'movistar_es';
  if (ch.country === 'DE') return 'sky_de';
  if (ch.country === 'IT') return 'sky_it';
  if (ch.country === 'PL') return 'canal_pl';
  return 'nilesat_osn_mbc';
}

export function isBouquetFilterAllowedBySettings(
  b: BouquetFilter,
  selectedBouquets?: EpgBouquetId[]
): boolean {
  if (b === 'Tous') return true;
  const active =
    selectedBouquets && selectedBouquets.length > 0
      ? selectedBouquets
      : DEFAULT_ENABLED_BOUQUET_IDS;

  if (
    b === 'Astra Canal+ France' ||
    b === 'Canal+ France' ||
    b === 'Astra Canal+'
  ) {
    return active.includes('astra_canal_fr') || active.includes('astra_tnt_fr');
  }
  if (b === 'Astra TNT France' || b === 'TNT France') {
    return (
      active.includes('astra_tnt_fr') ||
      active.includes('tnt_fr') ||
      active.includes('astra_canal_fr') ||
      active.includes('hotbird_bis_fr')
    );
  }
  if (
    b === 'Hotbird Bis TV/Rai' ||
    b === 'Bis TV (Hotbird 13°E)' ||
    b === 'Bis TV France' ||
    b === 'Rai / Sky Italia / Mediaset' ||
    b === 'Sky Italia / DAZN IT'
  ) {
    return (
      active.includes('hotbird_bis_fr') ||
      active.includes('sky_it') ||
      active.includes('astra_tnt_fr') ||
      active.includes('tnt_fr')
    );
  }
  if (b === 'Astra Movistar+ España' || b === 'Movistar+ / DAZN ES') {
    return (
      active.includes('movistar_es') ||
      active.includes('sky_de') ||
      active.includes('hispasat_meo_nos')
    );
  }
  if (
    b === 'Hispasat Meo/NOS/Movistar' ||
    b === 'MEO / NOS / Movistar (30°W)' ||
    b === 'Meo / NOS / Movistar 30°W'
  ) {
    return active.includes('hispasat_meo_nos') || active.includes('movistar_es');
  }
  if (b === 'Sky DE / DAZN DE') {
    return active.includes('sky_de');
  }
  if (
    b === 'Hotbird Polsat/Cyfra+' ||
    b === 'Polsat / Cyfra+ / Eleven' ||
    b === 'Canal+ / Eleven / FilmBox' ||
    b === 'HBO / Cinemax' ||
    b === 'AXN / Warner / Sci-Fi'
  ) {
    return active.includes('canal_pl');
  }
  if (
    b === 'Nilesat MBC/OSN/Rotana' ||
    b === 'TNT Arabe/Égypte' ||
    b === 'Nilesat (MBC / OSN / Rotana)' ||
    b === 'Nilesat OSN/MBC' ||
    b === 'OSN / MBC (Nilesat)'
  ) {
    return active.includes('nilesat_osn_mbc');
  }
  if (
    b === 'Badr beIN (Sports & Movies)' ||
    b === 'Badr SSC' ||
    b === 'Badr TV Arabes/Al Kass' ||
    b === 'Badr 26°E (beIN / SSC / Al Kass)' ||
    b === 'Badr Sport & MENA' ||
    b === 'beIN / SSC / AD Sports' ||
    b === 'beIN / SSC (MENA)'
  ) {
    return active.includes('badr_bein_ssc');
  }
  if (b === 'DigitAlb / Total TV / Focus Sat') {
    return active.includes('eutelsat_16e_thor');
  }
  if (b === 'Claro TV Brasil') {
    return active.includes('starone_70w_claro_br');
  }
  if (b === 'Vivo TV / Movistar LATAM') {
    return active.includes('amazonas_61w_latam');
  }
  if (b === 'DirecTV LATAM / Sky Brasil') {
    return active.includes('intelsat_43w_directv');
  }
  return true;
}

export function isSatelliteFilterAllowedBySettings(
  sat: SatelliteFilter,
  selectedBouquets?: EpgBouquetId[]
): boolean {
  if (sat === 'Tous') return true;
  const active =
    selectedBouquets && selectedBouquets.length > 0
      ? selectedBouquets
      : DEFAULT_ENABLED_BOUQUET_IDS;

  if (sat === 'Nilesat 7°W') {
    return active.includes('nilesat_osn_mbc');
  }
  if (sat === "Badr / Es'hailSat 26°E" || sat === 'Badr 26°E') {
    return active.includes('badr_bein_ssc');
  }
  if (sat === 'Astra 19.2°E') {
    return (
      active.includes('astra_canal_fr') ||
      active.includes('astra_tnt_fr') ||
      active.includes('movistar_es') ||
      active.includes('sky_de')
    );
  }
  if (sat === 'Hotbird 13°E') {
    return (
      active.includes('sky_it') ||
      active.includes('canal_pl') ||
      active.includes('hotbird_bis_fr')
    );
  }
  if (sat === 'Hispasat 30°W') {
    return (
      active.includes('hispasat_meo_nos') || active.includes('movistar_es')
    );
  }
  if (sat === 'Eutelsat 16°E / Thor 0.8°W') {
    return active.includes('eutelsat_16e_thor');
  }
  if (sat === 'Star One D2 70°W') {
    return active.includes('starone_70w_claro_br');
  }
  if (sat === 'Amazonas 61°W') {
    return active.includes('amazonas_61w_latam');
  }
  if (
    sat === 'Intelsat 43.1°W / SES-6 40.5°W' ||
    sat === 'Intelsat 43.1°W & SES-6 40.5°W'
  ) {
    return active.includes('intelsat_43w_directv');
  }
  return true;
}

export function isCountryFilterAllowedBySettings(
  c: CountryCode,
  selectedBouquets?: EpgBouquetId[]
): boolean {
  if (c === 'Tous') return true;
  const active =
    selectedBouquets && selectedBouquets.length > 0
      ? selectedBouquets
      : DEFAULT_ENABLED_BOUQUET_IDS;
  if (c === 'FR') {
    return (
      active.includes('astra_canal_fr') ||
      active.includes('astra_tnt_fr') ||
      active.includes('hotbird_bis_fr')
    );
  }
  if (c === 'ES') {
    return (
      active.includes('movistar_es') || active.includes('hispasat_meo_nos')
    );
  }
  if (c === 'DE') return active.includes('sky_de');
  if (c === 'IT') return active.includes('sky_it');
  if (c === 'PL') return active.includes('canal_pl');
  if (c === 'AR') {
    return (
      active.includes('nilesat_osn_mbc') || active.includes('badr_bein_ssc')
    );
  }
  if (c === 'EU') return active.includes('eutelsat_16e_thor');
  if (c === 'BR') return active.includes('starone_70w_claro_br');
  if (c === 'LATAM') {
    return (
      active.includes('amazonas_61w_latam') ||
      active.includes('intelsat_43w_directv')
    );
  }
  return true;
}

export function isCategoryFilterAllowedBySettings(
  cat: ContentCategoryFilter,
  enabledCategories?: ThematicCategoryId[]
): boolean {
  if (cat === 'Tous') return true;
  const active =
    enabledCategories && enabledCategories.length > 0
      ? enabledCategories
      : ALL_THEMATIC_CATEGORIES;
  if (cat === 'Sport / Football') return active.includes('Sport / Football');
  if (cat === 'Documentaires') return active.includes('Documentaires');
  if (cat === 'Actualités / News') return active.includes('Actualités / News');
  if (cat === 'Jeunesse / Enfants') {
    return (
      active.includes('Jeunesse / Enfants') ||
      active.includes('Jeunesse & Famille')
    );
  }
  if (cat === 'Musique & Divertissement') {
    return active.includes('Musique & Divertissement');
  }
  if (cat === 'Films & Séries') {
    return (
      active.includes('Films & Séries') ||
      active.includes('Classiques & Culte') ||
      active.includes('Jeunesse & Famille')
    );
  }
  return true;
}

export function isChannelAllowedBySettings(
  ch: EpgChannel,
  settings: AppSettings
): boolean {
  const activeBouquets =
    settings.selectedBouquets && settings.selectedBouquets.length > 0
      ? settings.selectedBouquets
      : DEFAULT_ENABLED_BOUQUET_IDS;
  const activeCats =
    settings.enabledCategories && settings.enabledCategories.length > 0
      ? settings.enabledCategories
      : ALL_THEMATIC_CATEGORIES;

  const chBouquetId = resolveChannelBouquetId(ch);
  let bouquetAllowed = activeBouquets.includes(chBouquetId);

  // Autoriser les chaînes diffusées sur Nilesat 7°W ou Badr 26°E dès lors que l'un des deux satellites correspondants est activé
  if (!bouquetAllowed) {
    if (
      ch.satellites?.includes('Nilesat 7°W') &&
      activeBouquets.includes('nilesat_osn_mbc')
    ) {
      bouquetAllowed = true;
    }
    if (
      ch.satellites?.includes("Badr / Es'hailSat 26°E") &&
      activeBouquets.includes('badr_bein_ssc')
    ) {
      bouquetAllowed = true;
    }
  }

  // Si la chaîne est une chaîne de la TNT Française / Bis TV, elle est autorisée
  // dès que l'utilisateur a coché "TNT France", "Canal+ France" (Astra 19.2°E) ou "Bis TV (Hotbird)"
  if (
    !bouquetAllowed &&
    (chBouquetId === 'astra_tnt_fr' || chBouquetId === 'tnt_fr')
  ) {
    bouquetAllowed =
      activeBouquets.includes('astra_tnt_fr') ||
      activeBouquets.includes('tnt_fr') ||
      activeBouquets.includes('astra_canal_fr') ||
      activeBouquets.includes('hotbird_bis_fr');
  }
  if (!bouquetAllowed && chBouquetId === 'hotbird_bis_fr') {
    bouquetAllowed =
      activeBouquets.includes('hotbird_bis_fr') ||
      activeBouquets.includes('astra_canal_fr') ||
      activeBouquets.includes('astra_tnt_fr') ||
      activeBouquets.includes('tnt_fr');
  }
  if (
    !bouquetAllowed &&
    (chBouquetId === 'movistar_es' || chBouquetId === 'hispasat_meo_nos')
  ) {
    if (
      ch.satellites?.includes('Hispasat 30°W') &&
      activeBouquets.includes('hispasat_meo_nos')
    ) {
      bouquetAllowed = true;
    }
    if (
      ch.satellites?.includes('Astra 19.2°E') &&
      activeBouquets.includes('movistar_es')
    ) {
      bouquetAllowed = true;
    }
  }

  if (!bouquetAllowed) {
    return false;
  }

  if (settings.excludePolishLektor && ch.hasPolishLektor) {
    return false;
  }

  const cat: Exclude<ContentCategoryFilter, 'Tous'> =
    ch.contentCategory ||
    (ch.group === 'Sport / Football'
      ? 'Sport / Football'
      : ch.group === 'Documentaires'
      ? 'Documentaires'
      : ch.group === 'Actualités / News'
      ? 'Actualités / News'
      : ch.group === 'Jeunesse / Enfants'
      ? 'Jeunesse / Enfants'
      : ch.group === 'Musique & Divertissement'
      ? 'Musique & Divertissement'
      : 'Films & Séries');

  if (
    settings.excludeNoSubtitles &&
    ch.hasSubtitles === false &&
    cat !== 'Sport / Football' &&
    cat !== 'Actualités / News' &&
    cat !== 'Musique & Divertissement'
  ) {
    return false;
  }

  let catAllowed = false;
  if (cat === 'Sport / Football' && activeCats.includes('Sport / Football')) {
    catAllowed = true;
  } else if (cat === 'Documentaires' && activeCats.includes('Documentaires')) {
    catAllowed = true;
  } else if (
    cat === 'Actualités / News' &&
    activeCats.includes('Actualités / News')
  ) {
    catAllowed = true;
  } else if (
    cat === 'Jeunesse / Enfants' &&
    (activeCats.includes('Jeunesse / Enfants') ||
      activeCats.includes('Jeunesse & Famille'))
  ) {
    catAllowed = true;
  } else if (
    cat === 'Musique & Divertissement' &&
    activeCats.includes('Musique & Divertissement')
  ) {
    catAllowed = true;
  } else if (cat === 'Films & Séries') {
    if (activeCats.includes('Films & Séries')) {
      catAllowed = true;
    } else if (
      ch.group === 'Classiques & Culte' &&
      activeCats.includes('Classiques & Culte')
    ) {
      catAllowed = true;
    } else if (
      ch.group === 'Comédie & Famille' &&
      activeCats.includes('Jeunesse & Famille')
    ) {
      catAllowed = true;
    }
  }

  return catAllowed;
}

export function syncSourcesWithSelectedBouquets(
  firstArg: EpgSourceItem[] | EpgBouquetId[],
  secondArg?: EpgBouquetId[] | EpgSourceItem[]
): EpgSourceItem[] {
  const isFirstBouquets =
    Array.isArray(firstArg) &&
    (firstArg.length === 0 || typeof firstArg[0] === 'string');

  const selectedBouquets: EpgBouquetId[] = isFirstBouquets
    ? (firstArg as EpgBouquetId[])
    : ((secondArg as EpgBouquetId[]) || DEFAULT_ENABLED_BOUQUET_IDS);

  const sources: EpgSourceItem[] = isFirstBouquets
    ? ((secondArg as EpgSourceItem[]) || DEFAULT_EPG_SOURCES)
    : (firstArg as EpgSourceItem[]);

  const baseList = [...sources];
  for (const defSrc of DEFAULT_EPG_SOURCES) {
    const exists = baseList.some(
      (s) => s.url.toLowerCase() === defSrc.url.toLowerCase()
    );
    if (!exists) {
      baseList.push({ ...defSrc });
    }
  }

  return baseList.map((s) => {
    const u = s.url.toLowerCase();
    const bId = inferBouquetIdForSource(s);

    let enabled = selectedBouquets.includes(bId);

    // FR1 fournit Astra Canal+ France, TNT France et Bis TV Hotbird
    if (u.includes('_fr1') || s.country === 'FR') {
      enabled =
        selectedBouquets.includes('astra_canal_fr') ||
        selectedBouquets.includes('astra_tnt_fr') ||
        selectedBouquets.includes('hotbird_bis_fr');
    }
    // ES1 fournit Movistar+ (Astra 19.2°E & Hispasat 30°W)
    else if (u.includes('_es1')) {
      enabled =
        selectedBouquets.includes('movistar_es') ||
        selectedBouquets.includes('hispasat_meo_nos');
    }
    // PT1 fournit MEO & NOS sur Hispasat 30°W
    else if (u.includes('_pt1')) {
      enabled = selectedBouquets.includes('hispasat_meo_nos');
    }
    // AE1, SA1, SA2, BEIN1 fournissent les chaînes MENA pour Nilesat 7°W et Badr / Es'hailSat 26°E
    else if (
      u.includes('_sa1') ||
      u.includes('_sa2') ||
      u.includes('_ae1') ||
      u.includes('_bein1')
    ) {
      enabled =
        selectedBouquets.includes('nilesat_osn_mbc') ||
        selectedBouquets.includes('badr_bein_ssc');
    }

    return {
      ...s,
      bouquetId: bId,
      enabled,
    };
  });
}

export const PRESET_EPG_CATALOG: Omit<EpgSourceItem, 'id' | 'enabled'>[] = [
  ...DEFAULT_EPG_SOURCES.map(({ name, url, country, bouquetId }) => ({
    name,
    url,
    country,
    bouquetId,
  })),
];

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'fr',
  sourceUrl: DEFAULT_EPG_SOURCE_URL,
  sources: DEFAULT_EPG_SOURCES,
  cacheTtlHours: 12,
  autoRefreshHours: 12,
  windowHours: 48,
  theme: 'dark',
  autoTimezone: true,
  manualTimezone: 'Africa/Casablanca',
  selectedBouquets: [...DEFAULT_ENABLED_BOUQUET_IDS],
  excludePolishLektor: true,
  excludeNoSubtitles: true,
  enabledCategories: [...ALL_THEMATIC_CATEGORIES],
};

export function buildSourcesSignature(
  sourcesOrSettings: EpgSourceItem[] | AppSettings
): string {
  const sources = Array.isArray(sourcesOrSettings)
    ? sourcesOrSettings
    : sourcesOrSettings.sources;
  const bouquetsPart = Array.isArray(sourcesOrSettings)
    ? ''
    : `|b:${(sourcesOrSettings.selectedBouquets || DEFAULT_ENABLED_BOUQUET_IDS)
        .slice()
        .sort()
        .join(',')}|lektor:${Boolean(
        sourcesOrSettings.excludePolishLektor
      )}|sub:${Boolean(sourcesOrSettings.excludeNoSubtitles)}|cat:${(
        sourcesOrSettings.enabledCategories || ALL_THEMATIC_CATEGORIES
      )
        .slice()
        .sort()
        .join(',')}`;

  return (
    'whitelist_v12|' +
    sources
      .filter((s) => s.enabled && s.url.trim().length > 0)
      .map((s) => `${s.country}:${s.url.trim()}`)
      .join('|') +
    bouquetsPart
  );
}

export interface StoredEpgSnapshot {
  id: string;
  metadata: EpgCacheMetadata;
  channels: EpgChannel[];
  schedulesByChannel: Record<string, EpgProgramme[]>;
}

/**
 * Filtre les programmes EPG chargés en mémoire JS uniquement sur la plage horaire active
 * (-6h à +24h par rapport à l'heure actuelle) afin d'éliminer les vieux programmes passés
 * et maintenir la RAM en dessous de 50 Mo, tout en nettoyant la clé de correspondance
 * et en éliminant tout événement vide ("No scheduled events").
 */
export function pruneSchedulesToActiveWindow(
  schedulesByChannel: Record<string, EpgProgramme[]>,
  nowMs: number = Date.now()
): Record<string, EpgProgramme[]> {
  const minKeepStopMs = nowMs - 6 * 3600 * 1000;
  const maxKeepStartMs = nowMs + 24 * 3600 * 1000;
  const pruned: Record<string, EpgProgramme[]> = {};

  for (const chId of Object.keys(schedulesByChannel)) {
    const cleanId = cleanXmltvChannelId(chId);
    if (!cleanId) continue;
    const rawList = (schedulesByChannel[chId] || []).filter(
      (p) => p && !isPlaceholderProgrammeTitle(p.title)
    );
    const activeWindowList = rawList.filter(
      (p) => p.stopMs >= minKeepStopMs && p.startMs <= maxKeepStartMs
    );
    const finalList =
      activeWindowList.length > 0 ? activeWindowList : rawList.slice(0, 24);
    pruned[cleanId] = finalList;
    if (chId !== cleanId) {
      pruned[chId] = finalList;
    }
  }

  return pruned;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non disponible sur cet appareil.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Impossible d'ouvrir IndexedDB."));
  });
}

export async function saveEpgToCache(
  metadata: EpgCacheMetadata,
  channels: EpgChannel[],
  schedulesByChannel: Record<string, EpgProgramme[]>
): Promise<void> {
  const prunedSchedules = pruneSchedulesToActiveWindow(schedulesByChannel);

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_META_KEY, JSON.stringify(metadata));
    }
  } catch {
    // Ignore quota errors on localStorage
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
    const store = tx.objectStore(SNAPSHOT_STORE);

    const payload: StoredEpgSnapshot = {
      id: SNAPSHOT_KEY,
      metadata,
      channels,
      schedulesByChannel: prunedSchedules,
    };

    store.put(payload);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Erreur écriture IndexedDB'));
    };
  });
}

export async function loadEpgFromCache(): Promise<StoredEpgSnapshot | null> {
  try {
    const db = await openDatabase();
    return await new Promise<StoredEpgSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
      const store = tx.objectStore(SNAPSHOT_STORE);
      const req = store.get(SNAPSHOT_KEY);

      req.onsuccess = () => {
        db.close();
        const result = req.result as StoredEpgSnapshot | undefined;
        if (result && result.metadata && Array.isArray(result.channels)) {
          const prunedSchedules = pruneSchedulesToActiveWindow(
            result.schedulesByChannel || {}
          );
          resolve({
            ...result,
            schedulesByChannel: prunedSchedules,
          });
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

export async function clearEpgCache(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LS_META_KEY);
    }
  } catch {
    // Ignore
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE);
      store.delete(SNAPSHOT_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Ignore
  }
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    if (!raw) {
      localStorage.setItem(LS_TZ_CASA_MIGRATED_KEY, '1');
      localStorage.setItem(LS_BOUQUETS_V8_MIGRATED_KEY, '1');
      localStorage.setItem(LS_CATEGORIES_V9_MIGRATED_KEY, '1');
      configureActiveTimezone(
        DEFAULT_SETTINGS.autoTimezone,
        DEFAULT_SETTINGS.manualTimezone
      );
      applyDocumentLanguageDir(DEFAULT_SETTINGS.language);
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const tzMigrated = localStorage.getItem(LS_TZ_CASA_MIGRATED_KEY) === '1';
    if (!tzMigrated) {
      parsed.manualTimezone = 'Africa/Casablanca';
      parsed.autoTimezone = true;
      localStorage.setItem(LS_TZ_CASA_MIGRATED_KEY, '1');
    }

    const v8Migrated = localStorage.getItem(LS_BOUQUETS_V8_MIGRATED_KEY) === '1';
    const v9CatsMigrated =
      localStorage.getItem(LS_CATEGORIES_V9_MIGRATED_KEY) === '1';

    const sanitizedSources = Array.isArray(parsed.sources)
      ? parsed.sources.filter(
          (s) =>
            (s.country as string) !== 'GR' &&
            !s.url.toLowerCase().includes('epg_ripper_gr')
        )
      : [];

    let selectedBouquets =
      Array.isArray(parsed.selectedBouquets) &&
      parsed.selectedBouquets.length > 0
        ? parsed.selectedBouquets.filter((b) => ALL_BOUQUET_IDS.includes(b))
        : [...DEFAULT_SETTINGS.selectedBouquets];

    // Migration automatique v8 : séparation Nilesat 7°W / Badr 26°E + ajout TNT France, Bis TV et Hispasat Meo/NOS
    if (!v8Migrated) {
      if (
        selectedBouquets.includes('nilesat_osn_mbc') &&
        !selectedBouquets.includes('badr_bein_ssc')
      ) {
        selectedBouquets.push('badr_bein_ssc');
      }
      if (
        selectedBouquets.includes('astra_canal_fr') &&
        !selectedBouquets.includes('astra_tnt_fr')
      ) {
        selectedBouquets.push('astra_tnt_fr');
      }
      if (
        selectedBouquets.includes('canal_pl') &&
        !selectedBouquets.includes('hotbird_bis_fr')
      ) {
        selectedBouquets.push('hotbird_bis_fr');
      }
      if (
        selectedBouquets.includes('movistar_es') &&
        !selectedBouquets.includes('hispasat_meo_nos')
      ) {
        selectedBouquets.push('hispasat_meo_nos');
      }
      localStorage.setItem(LS_BOUQUETS_V8_MIGRATED_KEY, '1');
    }

    const validSelectedBouquets =
      selectedBouquets.length > 0
        ? selectedBouquets
        : DEFAULT_SETTINGS.selectedBouquets;

    const baseSources =
      sanitizedSources.length > 0 ? sanitizedSources : DEFAULT_EPG_SOURCES;

    const sources = syncSourcesWithSelectedBouquets(
      baseSources,
      validSelectedBouquets
    );

    let enabledCategories =
      Array.isArray(parsed.enabledCategories) &&
      parsed.enabledCategories.length > 0
        ? [...parsed.enabledCategories]
        : [...DEFAULT_SETTINGS.enabledCategories];

    if (!v9CatsMigrated) {
      for (const catId of ALL_THEMATIC_CATEGORIES) {
        if (!enabledCategories.includes(catId)) {
          enabledCategories.push(catId);
        }
      }
      localStorage.setItem(LS_CATEGORIES_V9_MIGRATED_KEY, '1');
    }

    const validLang: AppLanguage = SUPPORTED_LANGUAGES.some(
      (l) => l.code === parsed.language
    )
      ? (parsed.language as AppLanguage)
      : 'fr';

    const loaded: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      language: validLang,
      sources,
      selectedBouquets: validSelectedBouquets,
      enabledCategories,
      autoTimezone:
        typeof parsed.autoTimezone === 'boolean'
          ? parsed.autoTimezone
          : DEFAULT_SETTINGS.autoTimezone,
      manualTimezone:
        typeof parsed.manualTimezone === 'string' && parsed.manualTimezone
          ? parsed.manualTimezone
          : DEFAULT_SETTINGS.manualTimezone,
      excludePolishLektor:
        typeof parsed.excludePolishLektor === 'boolean'
          ? parsed.excludePolishLektor
          : DEFAULT_SETTINGS.excludePolishLektor,
      excludeNoSubtitles:
        typeof parsed.excludeNoSubtitles === 'boolean'
          ? parsed.excludeNoSubtitles
          : DEFAULT_SETTINGS.excludeNoSubtitles,
    };

    if (!tzMigrated || !v8Migrated || !v9CatsMigrated) {
      localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(loaded));
    }

    configureActiveTimezone(loaded.autoTimezone, loaded.manualTimezone);
    applyDocumentLanguageDir(loaded.language);
    return loaded;
  } catch {
    configureActiveTimezone(
      DEFAULT_SETTINGS.autoTimezone,
      DEFAULT_SETTINGS.manualTimezone
    );
    applyDocumentLanguageDir(DEFAULT_SETTINGS.language);
    return DEFAULT_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    configureActiveTimezone(settings.autoTimezone, settings.manualTimezone);
    applyDocumentLanguageDir(settings.language || 'fr');
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}

export function loadFavoriteChannels(): string[] {
  try {
    const raw = localStorage.getItem(LS_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFavoriteChannels(channelIds: string[]): void {
  try {
    localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(channelIds));
  } catch {
    // Ignore
  }
}

export function loadReminders(): ProgrammeReminder[] {
  try {
    const raw = localStorage.getItem(LS_REMINDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReminders(reminders: ProgrammeReminder[]): void {
  try {
    localStorage.setItem(LS_REMINDERS_KEY, JSON.stringify(reminders));
  } catch {
    // Ignore
  }
}
