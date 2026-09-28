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

const DB_NAME = 'PulseEpgCacheDB';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'epg_snapshots';
const SNAPSHOT_KEY = 'active_epg_whitelist_v5';

const LS_META_KEY = 'pulse_epg_meta_v5';
const LS_SETTINGS_KEY = 'pulse_epg_settings_v5';
const LS_TZ_CASA_MIGRATED_KEY = 'pulse_epg_tz_casablanca_utc0_v1';
const LS_FAVORITES_KEY = 'pulse_epg_favorites_v1';
const LS_REMINDERS_KEY = 'pulse_epg_reminders_v1';

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

export const EPG_BOUQUET_CATALOG: BouquetOptionSpec[] = [
  {
    id: 'nilesat_osn_mbc',
    flag: '🇲🇦/🇦🇪',
    label: '🇲🇦/🇦🇪 Nilesat 7°W & Badr 26°E (OSN, MBC, beIN Sports MENA, SSC Sports)',
    satellite: 'Nilesat 7°W / Badr 26°E',
    description:
      'OSN Movies Premiere/Action/Hollywood, OSN Series, MBC 2/Max/Action, Dubai One, beIN Sports MENA & SSC Sports',
    estRamMb: 4.5,
    estimatedRamMb: 4.5,
    sampleChannels: ['OSN Movies', 'MBC 2 / Max', 'beIN Sports MENA', 'SSC Sports'],
  },
  {
    id: 'astra_canal_fr',
    flag: '🇫🇷',
    label: '🇫🇷 Astra 19.2°E (Canal+ France, TNT)',
    satellite: 'Astra 19.2°E',
    description:
      'Canal+ France, Canal+ Box Office, Grand Écran, Cinéma(s), Séries, Docs, Foot, Sport, Ciné+ OCS & TNT HD',
    estRamMb: 3.8,
    estimatedRamMb: 3.8,
    sampleChannels: ['Canal+ FR', 'C+ Box Office', 'C+ Foot', 'TNT / Ciné+'],
  },
  {
    id: 'movistar_es',
    flag: '🇪🇸',
    label: '🇪🇸 Hispasat 30°W / Astra 19.2°E (Movistar+, MEO, NOS)',
    satellite: 'Hispasat 30°W / Astra 19.2°E',
    description:
      'Movistar Plus+, M+ Estrenos, Acción, Drama, Clásicos, LaLiga, Liga de Campeones, DAZN ES, MEO & NOS',
    estRamMb: 4.2,
    estimatedRamMb: 4.2,
    sampleChannels: ['Movistar+', 'M+ LaLiga', 'MEO / NOS', 'DAZN ES'],
  },
  {
    id: 'sky_de',
    flag: '🇩🇪',
    label: '🇩🇪 Astra 19.2°E (Sky Deutschland, DAZN DE, ZDF/ARD)',
    satellite: 'Astra 19.2°E',
    description:
      'Sky Cinema Premiere/Action/Classics, Sky Atlantic, Warner TV, Sky Bundesliga, DAZN DE, ZDF HD & Das Erste ARD',
    estRamMb: 4.0,
    estimatedRamMb: 4.0,
    sampleChannels: ['Sky Deutschland', 'DAZN DE', 'ZDF / ARD', 'Sky Sport'],
  },
  {
    id: 'sky_it',
    flag: '🇮🇹',
    label: '🇮🇹 Hotbird 13°E (Sky Italia, Rai, Mediaset)',
    satellite: 'Hotbird 13°E',
    description:
      'Sky Cinema Uno/Due/Collection/Action, Sky Serie, Sky Sport Calcio/Uno/Max, DAZN IT, Rai 1–4 & Mediaset Infinity',
    estRamMb: 3.9,
    estimatedRamMb: 3.9,
    sampleChannels: ['Sky Italia', 'Rai HD', 'Mediaset', 'Sky Calcio'],
  },
  {
    id: 'canal_pl',
    flag: '🇵🇱',
    label: '🇵🇱 Hotbird 13°E (Canal+ Polska, Polsat Box, Eleven Sports)',
    satellite: 'Hotbird 13°E',
    description:
      'Canal+ Premium/Film/Series/Sport Polska, Polsat Box, HBO 1–3, Cinemax 1–2, Eleven Sports 1–4, FilmBox & AXN',
    estRamMb: 3.6,
    estimatedRamMb: 3.6,
    sampleChannels: ['Canal+ Polska', 'Polsat Box', 'Eleven Sports', 'HBO 1–3'],
  },
  {
    id: 'eutelsat_16e_thor',
    flag: '🇪🇺',
    label: '🇪🇺 Eutelsat 16°E / Thor 0.8°W (DigitAlb, Total TV, Focus Sat)',
    satellite: 'Eutelsat 16°E / Thor 0.8°W',
    description:
      'DigitAlb HD, SuperSport, Total TV, Focus Sat, Arena Sport, FilmBox Extra & HBO Europe Centrale',
    estRamMb: 3.2,
    estimatedRamMb: 3.2,
    sampleChannels: ['DigitAlb', 'Total TV', 'Focus Sat', 'SuperSport'],
  },
  {
    id: 'starone_70w_claro_br',
    flag: '🇧🇷',
    label: '🇧🇷 Star One D2 70°W (Claro TV Brasil)',
    satellite: 'Star One D2 70°W',
    description:
      'Claro TV+ Brasil, Telecine Premium/Action/Pipoca/Cult, HBO Brasil, SporTV 1–3, Premiere FC & ESPN Brasil',
    estRamMb: 3.4,
    estimatedRamMb: 3.4,
    sampleChannels: ['Claro TV Brasil', 'Telecine HD', 'SporTV', 'Premiere FC'],
  },
  {
    id: 'amazonas_61w_latam',
    flag: '🌎',
    label: '🌎 Amazonas 61°W (Vivo TV, Movistar TV LATAM)',
    satellite: 'Amazonas 61°W',
    description:
      'Vivo TV & Movistar TV LATAM, HBO Mundi/Xtreme, Cinecanal, TNT Series, ESPN LATAM & Fox Sports',
    estRamMb: 3.3,
    estimatedRamMb: 3.3,
    sampleChannels: ['Vivo TV', 'Movistar TV LATAM', 'Cinecanal', 'ESPN LATAM'],
  },
  {
    id: 'intelsat_43w_directv',
    flag: '🇦🇷/🇨🇴',
    label: '🇦🇷/🇨🇴 Intelsat 43.1°W & SES-6 40.5°W (DirecTV Latin America, Sky Brasil, Oi TV)',
    satellite: 'Intelsat 43.1°W / SES-6 40.5°W',
    description:
      'DSports (DirecTV Sports), Sky Brasil, Oi TV, HBO Plus LATAM, Universal Premiere, TNT Sports & TyC Sports',
    estRamMb: 3.5,
    estimatedRamMb: 3.5,
    sampleChannels: ['DirecTV LATAM', 'Sky Brasil', 'Oi TV', 'DSports HD'],
  },
];

export const ALL_BOUQUET_IDS: EpgBouquetId[] = EPG_BOUQUET_CATALOG.map(
  (b) => b.id
);

export const DEFAULT_ENABLED_BOUQUET_IDS: EpgBouquetId[] = [
  'nilesat_osn_mbc',
  'astra_canal_fr',
  'movistar_es',
  'sky_de',
  'sky_it',
  'canal_pl',
];

export const THEMATIC_CATEGORIES_CATALOG: {
  id: ThematicCategoryId;
  label: string;
  description: string;
}[] = [
  {
    id: 'Films & Séries',
    label: 'Films / Séries',
    description: 'Premières cinéma, blockbusters US/Euro, thrillers, séries TV',
  },
  {
    id: 'Sport / Football',
    label: 'Sport / Football',
    description:
      'UEFA Champions League, Premier League, LaLiga, Serie A, Bundesliga, Brasileirão & Libertadores',
  },
  {
    id: 'Documentaires',
    label: 'Documentaires',
    description:
      'Sciences, histoire, nature & géopolitique (Canal+ Docs, Planète+, NatGeo, Sky Doc)',
  },
  {
    id: 'Classiques & Culte',
    label: 'Classiques & Culte',
    description:
      'Cinéma de patrimoine, films d’auteur, TCM, Cinemax 2, Sky Classics, Telecine Cult',
  },
  {
    id: 'Jeunesse & Famille',
    label: 'Jeunesse & Famille',
    description:
      'Comédies familiales, films d’animation, Sky Cinema Family, FilmBox Family',
  },
];

export const EPG_THEMATIC_CATEGORIES = THEMATIC_CATEGORIES_CATALOG;

export const ALL_THEMATIC_CATEGORIES: ThematicCategoryId[] =
  THEMATIC_CATEGORIES_CATALOG.map((c) => c.id);

export const DEFAULT_EPG_SOURCE_URL =
  'https://epgshare01.online/epgshare01/epg_ripper_PL1.xml.gz';

export const DEFAULT_EPG_SOURCES: EpgSourceItem[] = [
  {
    id: 'src_pl1',
    name: '🇵🇱 Hotbird 13°E · Canal+ Polska, Polsat Box, Eleven Sports, HBO & FilmBox',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_PL1.xml.gz',
    country: 'PL',
    bouquetId: 'canal_pl',
    enabled: true,
  },
  {
    id: 'src_fr1',
    name: '🇫🇷 Astra 19.2°E · Canal+ France (Box Office, Cinéma, Séries, Docs, Foot, Sport) & TNT',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_FR1.xml.gz',
    country: 'FR',
    bouquetId: 'astra_canal_fr',
    enabled: true,
  },
  {
    id: 'src_es1',
    name: '🇪🇸 Hispasat 30°W / Astra 19.2°E · Movistar+, MEO, NOS & DAZN ES',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_ES1.xml.gz',
    country: 'ES',
    bouquetId: 'movistar_es',
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
    name: '🇮🇹 Hotbird 13°E · Sky Italia, Rai, Mediaset & DAZN IT',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_IT1.xml.gz',
    country: 'IT',
    bouquetId: 'sky_it',
    enabled: true,
  },
  {
    id: 'src_ae1',
    name: '🇲🇦/🇦🇪 Nilesat 7°W & Badr 26°E · MBC 2, MBC Action, Dubai One & AD Sports',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_AE1.xml.gz',
    country: 'AR',
    bouquetId: 'nilesat_osn_mbc',
    enabled: true,
  },
  {
    id: 'src_sa2',
    name: '🇲🇦/🇦🇪 Nilesat 7°W & Badr 26°E · MBC Max, OSN Action & SSC Sports HD',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_SA2.xml.gz',
    country: 'AR',
    bouquetId: 'nilesat_osn_mbc',
    enabled: true,
  },
  {
    id: 'src_sa1',
    name: '🇲🇦/🇦🇪 Nilesat 7°W & Badr 26°E · Bouquet OSN (Movies Premiere, Hollywood, Series)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_SA1.xml.gz',
    country: 'AR',
    bouquetId: 'nilesat_osn_mbc',
    enabled: true,
  },
  {
    id: 'src_bein1',
    name: '🇲🇦/🇦🇪 Nilesat 7°W & Badr 26°E · Bouquet beIN Sports MENA (1–7 HD, English, French, Max)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_BEIN1.xml.gz',
    country: 'AR',
    bouquetId: 'nilesat_osn_mbc',
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
  if (source.bouquetId) return source.bouquetId;
  const u = source.url.toLowerCase();
  if (u.includes('_ro1') || source.country === 'EU') return 'eutelsat_16e_thor';
  if (u.includes('_br1') || source.country === 'BR') return 'starone_70w_claro_br';
  if (u.includes('_cl1') || u.includes('_pe1')) return 'amazonas_61w_latam';
  if (u.includes('_co1') || u.includes('_ar1') || source.country === 'LATAM') {
    return 'intelsat_43w_directv';
  }
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
}): EpgBouquetId {
  if (ch.bouquetId) return ch.bouquetId;
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
  if (b === 'Astra Canal+') return active.includes('astra_canal_fr');
  if (b === 'Movistar+ / DAZN ES') return active.includes('movistar_es');
  if (b === 'Sky DE / DAZN DE') return active.includes('sky_de');
  if (b === 'Sky Italia / DAZN IT') return active.includes('sky_it');
  if (
    b === 'Canal+ / Eleven / FilmBox' ||
    b === 'HBO / Cinemax' ||
    b === 'AXN / Warner / Sci-Fi'
  ) {
    return active.includes('canal_pl');
  }
  if (
    b === 'Nilesat OSN/MBC' ||
    b === 'OSN / MBC (Nilesat)' ||
    b === 'beIN / SSC / AD Sports'
  ) {
    return active.includes('nilesat_osn_mbc');
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
  if (sat === 'Astra 19.2°E') {
    return (
      active.includes('astra_canal_fr') ||
      active.includes('movistar_es') ||
      active.includes('sky_de')
    );
  }
  if (sat === 'Hotbird 13°E') {
    return active.includes('sky_it') || active.includes('canal_pl');
  }
  if (sat === 'Hispasat 30°W') {
    return active.includes('movistar_es');
  }
  if (sat === 'Nilesat 7°W') {
    return active.includes('nilesat_osn_mbc');
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
  if (sat === 'Intelsat 43.1°W / SES-6 40.5°W') {
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
  if (c === 'FR') return active.includes('astra_canal_fr');
  if (c === 'ES') return active.includes('movistar_es');
  if (c === 'DE') return active.includes('sky_de');
  if (c === 'IT') return active.includes('sky_it');
  if (c === 'PL') return active.includes('canal_pl');
  if (c === 'AR') return active.includes('nilesat_osn_mbc');
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
  if (!activeBouquets.includes(chBouquetId)) {
    return false;
  }

  if (settings.excludePolishLektor && ch.hasPolishLektor) {
    return false;
  }

  const cat =
    ch.contentCategory ||
    (ch.group === 'Sport / Football'
      ? 'Sport / Football'
      : ch.group === 'Documentaires'
      ? 'Documentaires'
      : 'Films & Séries');

  if (
    settings.excludeNoSubtitles &&
    ch.hasSubtitles === false &&
    cat !== 'Sport / Football'
  ) {
    return false;
  }

  let catAllowed = false;
  if (cat === 'Sport / Football' && activeCats.includes('Sport / Football')) {
    catAllowed = true;
  } else if (cat === 'Documentaires' && activeCats.includes('Documentaires')) {
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
    const bId = inferBouquetIdForSource(s);
    return {
      ...s,
      bouquetId: bId,
      enabled: selectedBouquets.includes(bId),
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
    'whitelist_v7|' +
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
      schedulesByChannel,
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
          resolve(result);
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

    const sanitizedSources = Array.isArray(parsed.sources)
      ? parsed.sources.filter(
          (s) =>
            (s.country as string) !== 'GR' &&
            !s.url.toLowerCase().includes('epg_ripper_gr')
        )
      : [];

    const selectedBouquets =
      Array.isArray(parsed.selectedBouquets) &&
      parsed.selectedBouquets.length > 0
        ? parsed.selectedBouquets.filter((b) => ALL_BOUQUET_IDS.includes(b))
        : DEFAULT_SETTINGS.selectedBouquets;

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

    const enabledCategories =
      Array.isArray(parsed.enabledCategories) &&
      parsed.enabledCategories.length > 0
        ? parsed.enabledCategories
        : DEFAULT_SETTINGS.enabledCategories;

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

    if (!tzMigrated) {
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
