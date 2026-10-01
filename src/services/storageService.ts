import {
  AppLanguage,
  AppSettings,
  BouquetFilter,
  ChannelCountryFilter,
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
  TvProfileId,
} from '../types/epg';
import {
  applyDocumentLanguageDir,
  cleanBouquetName,
  sanitizeBouquetDisplayName,
  SUPPORTED_LANGUAGES,
} from '../utils/i18n';
export { cleanBouquetName, sanitizeBouquetDisplayName };
import { configureActiveTimezone } from '../utils/timeFormat';
import {
  cleanOfficialChannelName,
  cleanXmltvChannelId,
  ensureHttpsUrl,
  isAdultChannel,
  isPlaceholderProgrammeTitle,
  normalizeSingleOrbitalPosition,
  supplementSatelliteBouquetsCoverage,
} from '../utils/xmltvParser';
import { resolveOfficialChannelLogoUrl } from '../utils/channelLogoResolver';

const DB_NAME = 'PulseEpgCacheDB';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'epg_snapshots';
const SNAPSHOT_KEY = 'active_epg_whitelist_v19';

const LS_META_KEY = 'pulse_epg_meta_v19';
const LS_SETTINGS_KEY = 'pulse_epg_settings_v5';
export const LS_TV_PROFILE_KEY = 'pulse_epg_tv_profile_v1';
const LS_STRICT_PROFILE_V12_MIGRATED_KEY = 'pulse_epg_strict_fr_ar_v16';
const LS_TZ_CASA_MIGRATED_KEY = 'pulse_epg_tz_casablanca_utc0_v1';
const LS_BOUQUETS_V8_MIGRATED_KEY = 'pulse_epg_bouquets_separated_v8';
const LS_BOUQUETS_V10_MIGRATED_KEY = 'pulse_epg_bouquets_16e_52e_v10';
const LS_BOUQUETS_V11_MIGRATED_KEY = 'pulse_epg_bouquets_16e_trt_v11';
const LS_CATEGORIES_V9_MIGRATED_KEY = 'pulse_epg_categories_all_v9';
const LS_FAVORITES_KEY = 'pulse_epg_favorites_v1';
const LS_REMINDERS_KEY = 'pulse_epg_reminders_v1';
const LS_RECENT_SEARCHES_KEY = 'pulse_epg_recent_searches_v1';

export const EUTELSAT_16E_AFRICA_TRANSPONDERS = [
  '10804/H/30000',
  '11024/H/3333',
  '12562/H/30000',
  '12604/H/30000',
  '12687/H/29980',
  '11596/H/29980',
  '11637/H/30000',
] as const;

export const MAX_RECENT_SEARCHES = 5;

export const MAX_ACTIVE_BOUQUETS = 3;
export const MAX_ACTIVE_SATELLITES = 3;
export const RAM_LIMIT_WARNING_MESSAGE =
  "Limite atteinte : Maximum 3 bouquets actifs simultanément pour garantir la fluidité et éviter la saturation mémoire (RAM) de votre TV. Désactivez un bouquet avant d'en ajouter un nouveau.";

export const STRICT_SAT_FILTER_LIST: SatelliteFilter[] = [
  'Tous',
  'Nilesat 7°W',
  "Badr / Es'hailSat 26°E",
  'Astra 19.2°E',
  'Hotbird 13°E',
  'Hispasat 30°W',
  'Eutelsat 16°E',
  'Türksat 42°E',
  'Thor 0.8°W / Intelsat 10-02',
  'TurkmenÄlem 52°E',
  'MonacoSat 52°E',
  'Star One D2 70°W',
  'Amazonas 61°W',
  'Intelsat 43.1°W / SES-6 40.5°W',
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
    'Sky DE / DAZN DE',
  ],
  'Hotbird 13°E': [
    'Tous',
    'Hotbird Polsat/Cyfra+',
    'Hotbird Bis TV/Rai',
  ],
  'Hispasat 30°W': ['Tous', 'Hispasat Meo/NOS/Movistar'],
  'Eutelsat 16°E': [
    'Tous',
    'DigitAlb (Albanie)',
    'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)',
    'MAXtv / A1 Croatia',
    'New World TV (Afrique)',
    'Canal+ Réunion / Afrique',
    'Autres chaînes africaines / francophones',
  ],
  'Türksat 42°E': ['Tous', 'TRT Network'],
  'Türksat 42°E / Eutelsat 7°E': ['Tous', 'TRT Network'],
  'Thor 0.8°W / Intelsat 10-02': [
    'Tous',
    'Focus Sat (Roumanie)',
    'Direct One (Hongrie)',
    'Digi TV',
  ],
  'Thor 0.8°W': [
    'Tous',
    'Focus Sat (Roumanie)',
    'Direct One (Hongrie)',
    'Digi TV',
  ],
  'TurkmenÄlem 52°E': [
    'Tous',
    'Groupe Persiana',
    'Groupe WNS',
    'Information (Iran Intl / Afghanistan Intl)',
    'Bouquet National Turkmène',
    'Alem TV',
  ],
  'MonacoSat 52°E': [
    'Tous',
    'Groupe Persiana',
    'Groupe WNS',
    'Information (Iran Intl / Afghanistan Intl)',
    'Bouquet National Turkmène',
    'Alem TV',
  ],
  'Star One D2 70°W': ['Tous', 'Claro TV Brasil'],
  'Amazonas 61°W': ['Tous', 'Vivo TV / Movistar LATAM'],
  'Intelsat 43.1°W / SES-6 40.5°W': ['Tous', 'DirecTV LATAM / Sky Brasil'],
  'Intelsat 43.1°W & SES-6 40.5°W': ['Tous', 'DirecTV LATAM / Sky Brasil'],
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
    'Sky DE / DAZN DE',
    'Hotbird Polsat/Cyfra+',
    'Hotbird Bis TV/Rai',
    'Hispasat Meo/NOS/Movistar',
    'DigitAlb (Albanie)',
    'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)',
    'MAXtv / A1 Croatia',
    'New World TV (Afrique)',
    'Canal+ Réunion / Afrique',
    'Autres chaînes africaines / francophones',
    'TRT Network',
    'Focus Sat (Roumanie)',
    'Direct One (Hongrie)',
    'Digi TV',
    'Groupe Persiana',
    'Groupe WNS',
    'Information (Iran Intl / Afghanistan Intl)',
    'Bouquet National Turkmène',
    'Alem TV',
    'Claro TV Brasil',
    'Vivo TV / Movistar LATAM',
    'DirecTV LATAM / Sky Brasil',
  ],
};

export function getBouquetsForSatellite(sat: SatelliteFilter): BouquetFilter[] {
  return SAT_TO_BOUQUETS_MAP[sat] || SAT_TO_BOUQUETS_MAP['Tous'];
}

export const CHANNEL_COUNTRY_FILTER_OPTIONS: ChannelCountryFilter[] = [
  'Tous',
  'TR',
  'AL',
  'SN',
  'CI',
  'CM',
  'ML',
  'FR',
  'ES',
  'PT',
  'DE',
  'IT',
  'PL',
  'RO',
  'HU',
  'RS',
  'HR',
  'TM',
  'IR',
  'AR',
  'BR',
  'LATAM',
];

/**
 * Extrait automatiquement le ou les pays associés à une chaîne à partir de la nationalité
 * de son bouquet ou de l'identifiant / nom officiel de la chaîne
 * (ex: Turquie pour TRT, Albanie pour DigitAlb/RTSH, Sénégal pour 2S TV/RTS 1, etc.).
 */
export function extractChannelCountries(
  ch: EpgChannel
): Exclude<ChannelCountryFilter, 'Tous'>[] {
  const countries = new Set<Exclude<ChannelCountryFilter, 'Tous'>>();
  const idLower = (ch.id || '').toLowerCase();
  const nameLower = (ch.displayName || '').toLowerCase();
  const combined = `${idLower} ${nameLower}`;
  const chBouquets = ch.bouquets || [];

  // 1. Turquie (TRT Network, .tr, chaînes TRT)
  if (
    ch.bouquetId === 'trt_network' ||
    chBouquets.includes('TRT Network') ||
    idLower.endsWith('.tr') ||
    /\btrt\b/i.test(combined)
  ) {
    countries.add('TR');
  }

  // 2. Sénégal (2S TV, RTS 1 Sénégal, TFM, .sn)
  if (
    idLower.endsWith('.sn') ||
    /\b(2s\s*tv|2stv|rts\s*1|tfm|sen\s*tv|walf|sénégal|senegal)\b/i.test(combined)
  ) {
    countries.add('SN');
  }

  // 3. Côte d'Ivoire (RTI 1, RTI 2, NCI, Life TV, .ci)
  if (
    idLower.endsWith('.ci') ||
    /\b(rti\s*1|rti\s*2|rti|nci|life\s*tv|a\+\s*ivoire|ivoire)\b/i.test(combined)
  ) {
    countries.add('CI');
  }

  // 4. Cameroun (CRTV, Canal 2 International, .cm)
  if (
    idLower.endsWith('.cm') ||
    /\b(crtv|canal\s*2|equinoxe|cameroun)\b/i.test(combined)
  ) {
    countries.add('CM');
  }

  // 5. Mali (ORTM 1, TM2, Africable, .ml)
  if (
    idLower.endsWith('.ml') ||
    /\b(ortm|tm2|africable|mali)\b/i.test(combined)
  ) {
    countries.add('ML');
  }

  // 6. Albanie (DigitAlb, RTSH, .al)
  if (
    chBouquets.includes('DigitAlb (Albanie)') ||
    chBouquets.includes('Bouquet National RTSH (Albanie FTA)') ||
    idLower.endsWith('.al') ||
    /\b(digitalb|rtsh|klan\s*tv|top\s*channel|film\s*aksion|film\s*autor)\b/i.test(
      combined
    )
  ) {
    countries.add('AL');
  }

  // 7. Croatie (MAXtv / A1 Croatia, MAXSport, HRT, .hr)
  if (
    chBouquets.includes('MAXtv / A1 Croatia') ||
    chBouquets.includes('MAXtv (Croatie)') ||
    chBouquets.includes('MaxTV Sat (Croatie)') ||
    idLower.endsWith('.hr') ||
    /\b(maxsport|hrt\s*[1-4])\b/i.test(combined)
  ) {
    countries.add('HR');
  }

  // 8. Serbie / Balkans (Total TV, Arena Sport, Sport Klub, .rs)
  if (
    chBouquets.includes(
      'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)'
    ) ||
    chBouquets.includes('Total TV (Balkans / Serbie / Croatie)') ||
    chBouquets.includes('Total TV (Balkans)') ||
    idLower.endsWith('.rs') ||
    /\b(arena\s*sport|sport\s*klub|nova\s*s)\b/i.test(combined)
  ) {
    countries.add('RS');
  }

  // 9. Roumanie (TVR, Focus Sat, Digi TV, .ro)
  if (
    chBouquets.includes('Bouquet National TVR (Roumanie FTA)') ||
    chBouquets.includes('TVR / Chaînes Nationales (Roumanie)') ||
    chBouquets.includes('Focus Sat (Roumanie)') ||
    chBouquets.includes('Digi TV') ||
    idLower.endsWith('.ro') ||
    /\b(tvr|digi\s*sport|prima\s*sport|pro\s*tv|antena\s*1)\b/i.test(combined)
  ) {
    countries.add('RO');
  }

  // 10. Hongrie (Direct One, M4 Sport, Spíler, .hu)
  if (
    chBouquets.includes('Direct One (Hongrie)') ||
    idLower.endsWith('.hu') ||
    /\b(m4\s*sport|spíler|spiler|arena4)\b/i.test(combined)
  ) {
    countries.add('HU');
  }

  // 11. Turkménistan (Bouquet National Turkmène, Alem TV, .tm, .uz)
  if (
    ch.bouquetId === 'turkmenalem_52e_alem' ||
    chBouquets.includes('Bouquet National Turkmène') ||
    chBouquets.includes('Turkmenistan National TV') ||
    chBouquets.includes('Alem TV') ||
    idLower.endsWith('.tm') ||
    idLower.endsWith('.uz') ||
    /\b(altyn\s*asyr|yaslyk|miras|turkmenistan|alem\s*sport|alem\s*cinema|alem\s*discovery)\b/i.test(
      combined
    )
  ) {
    countries.add('TM');
  }

  // 12. Iran / Farsi (Groupe Persiana, Groupe WNS, Information 52°E, .mc, .ir)
  if (
    ch.bouquetId === 'monacosat_52e_persiana' ||
    chBouquets.includes('Groupe Persiana') ||
    chBouquets.includes('Persiana Media Group (Farsi/Sport/Cinema)') ||
    chBouquets.includes('Groupe WNS') ||
    chBouquets.includes('Information (Iran Intl / Afghanistan Intl)') ||
    chBouquets.includes('Information') ||
    idLower.endsWith('.mc') ||
    idLower.endsWith('.ir') ||
    /\b(persiana|ava\s*family|ava\s*series|avang|4u\s*family|pmc|iran\s*international|afghanistan\s*international)\b/i.test(
      combined
    )
  ) {
    countries.add('IR');
  }

  // 13. Portugal (MEO / NOS, .pt, Sport TV, RTP, SIC, TVI, BTV)
  const isPortugal =
    idLower.endsWith('.pt') ||
    /\b(sport\s*tv|rtp\s*[1-3]|sic\b|tvi\b|eleven.*portugal|btv\b|benfica\s*tv|porto\s*canal)\b/i.test(
      combined
    );
  if (isPortugal) {
    countries.add('PT');
  }

  // 14. Espagne (Movistar+, .es)
  if (
    idLower.endsWith('.es') ||
    chBouquets.includes('Astra Movistar+ España') ||
    (ch.country === 'ES' && !isPortugal)
  ) {
    countries.add('ES');
  }

  // 15. France (Astra Canal+ France, TNT France, Bis TV, TV5Monde, France 24, .fr)
  if (
    ch.country === 'FR' ||
    idLower.endsWith('.fr') ||
    chBouquets.includes('Astra Canal+ France') ||
    chBouquets.includes('Astra TNT France') ||
    /\b(tv5\s*monde|tv5monde|france\s*24|africanews)\b/i.test(combined)
  ) {
    countries.add('FR');
  }

  // 16. Allemagne (Sky DE / DAZN DE, .de)
  if (
    ch.country === 'DE' ||
    idLower.endsWith('.de') ||
    chBouquets.includes('Sky DE / DAZN DE')
  ) {
    countries.add('DE');
  }

  // 17. Italie (Sky Italia / Rai / Mediaset, .it)
  if (
    ch.country === 'IT' ||
    idLower.endsWith('.it') ||
    /\b(rai\s*[1-5]|sky\s*italia|mediaset|canale\s*5|italia\s*1)\b/i.test(combined)
  ) {
    countries.add('IT');
  }

  // 18. Pologne (Polsat / Cyfra+ / Eleven, .pl)
  if (
    ch.country === 'PL' ||
    idLower.endsWith('.pl') ||
    chBouquets.includes('Hotbird Polsat/Cyfra+')
  ) {
    countries.add('PL');
  }

  // 19. Monde Arabe / MENA (Nilesat 7°W, Badr 26°E)
  if (
    ch.country === 'AR' ||
    ch.bouquetId === 'nilesat_osn_mbc' ||
    ch.bouquetId === 'badr_bein_ssc' ||
    chBouquets.includes('Nilesat MBC/OSN/Rotana') ||
    chBouquets.includes('TNT Arabe/Égypte') ||
    chBouquets.includes('Badr beIN (Sports & Movies)') ||
    chBouquets.includes('Badr SSC') ||
    chBouquets.includes('Badr TV Arabes/Al Kass')
  ) {
    countries.add('AR');
  }

  // 20. Brésil & Amérique Latine
  if (
    ch.country === 'BR' ||
    idLower.endsWith('.br') ||
    chBouquets.includes('Claro TV Brasil')
  ) {
    countries.add('BR');
  }
  if (
    ch.country === 'LATAM' ||
    chBouquets.includes('Vivo TV / Movistar LATAM') ||
    chBouquets.includes('DirecTV LATAM / Sky Brasil')
  ) {
    countries.add('LATAM');
  }

  if (countries.size === 0 && ch.country && ch.country !== 'EU' && ch.country !== 'Autre') {
    countries.add(ch.country as Exclude<ChannelCountryFilter, 'Tous'>);
  }

  return Array.from(countries);
}

export function channelMatchesCountryFilter(
  ch: EpgChannel,
  countryFilter: ChannelCountryFilter
): boolean {
  if (countryFilter === 'Tous') return true;
  const extracted = extractChannelCountries(ch);
  return extracted.includes(countryFilter);
}

/**
 * Vérifie strictement si une chaîne appartient au satellite sélectionné.
 */
export function channelMatchesSatelliteFilter(
  ch: EpgChannel,
  satFilter: SatelliteFilter
): boolean {
  if (isAdultChannel(ch.id, ch.displayName)) return false;
  if (satFilter === 'Tous') return true;
  if (satFilter === "Badr / Es'hailSat 26°E" || satFilter === 'Badr 26°E') {
    return Boolean(
      ch.satellites?.some((s) => s.includes('Badr') || s.includes('26°E')) ||
        ch.orbitalPosition?.includes('Badr')
    );
  }
  if (satFilter === 'Thor 0.8°W / Intelsat 10-02' || satFilter === 'Thor 0.8°W') {
    return Boolean(
      ch.satellites?.some(
        (s) => s.includes('Thor') || s.includes('0.8°W') || s.includes('Intelsat 10-02')
      ) || ch.orbitalPosition?.includes('Thor')
    );
  }
  if (satFilter === 'Eutelsat 16°E') {
    if (
      ch.bouquetId === 'trt_network' ||
      ch.bouquets?.includes('TRT Network') ||
      /\.tr$/i.test(ch.id || '')
    ) {
      return false;
    }
    return Boolean(
      ch.satellites?.some((s) => s.includes('Eutelsat 16')) ||
        ch.orbitalPosition === 'Eutelsat 16°E'
    );
  }
  if (
    satFilter === 'Türksat 42°E' ||
    satFilter === 'Türksat 42°E / Eutelsat 7°E'
  ) {
    return Boolean(
      ch.satellites?.some(
        (s) => s.includes('Türksat') || s.includes('42°E')
      ) ||
        ch.orbitalPosition?.includes('Türksat') ||
        ch.bouquetId === 'trt_network' ||
        ch.bouquets?.includes('TRT Network')
    );
  }
  if (satFilter === 'TurkmenÄlem 52°E') {
    return Boolean(
      ch.satellites?.some((s) => s.includes('Turkmen') || s.includes('52°E')) ||
        ch.orbitalPosition === 'TurkmenÄlem 52°E' ||
        ch.orbitalPosition === 'MonacoSat 52°E'
    );
  }
  if (satFilter === 'MonacoSat 52°E') {
    return Boolean(
      ch.satellites?.some((s) => s.includes('MonacoSat') || s.includes('52°E')) ||
        ch.orbitalPosition === 'MonacoSat 52°E' ||
        ch.orbitalPosition === 'TurkmenÄlem 52°E'
    );
  }
  if (satFilter === 'Star One D2 70°W' || satFilter === 'Star One 70°W') {
    return Boolean(
      ch.satellites?.some((s) => s.includes('Star One') || s.includes('70°W')) ||
        ch.orbitalPosition?.includes('Star One') ||
        ch.orbitalPosition?.includes('70°W')
    );
  }
  if (satFilter === 'Amazonas 61°W') {
    return Boolean(
      ch.satellites?.some((s) => s.includes('Amazonas') || s.includes('61°W')) ||
        ch.orbitalPosition?.includes('Amazonas') ||
        ch.orbitalPosition?.includes('61°W')
    );
  }
  if (
    satFilter === 'Intelsat 43.1°W / SES-6 40.5°W' ||
    satFilter === 'Intelsat 43.1°W & SES-6 40.5°W' ||
    satFilter === 'SES-6 40.5°W'
  ) {
    return Boolean(
      ch.satellites?.some(
        (s) => s.includes('SES-6') || s.includes('40.5°W') || s.includes('43.1°W')
      ) ||
        ch.orbitalPosition?.includes('SES-6') ||
        ch.orbitalPosition?.includes('40.5°W') ||
        ch.orbitalPosition?.includes('43.1°W')
    );
  }
  return Boolean(ch.satellites?.includes(satFilter));
}

/**
 * Vérifie strictement si une chaîne appartient au bouquet sélectionné
 * (avec prise en compte des alias canoniques et de la dépendance au satellite actif).
 */
export function channelMatchesBouquetFilter(
  ch: EpgChannel,
  bouquetFilter: BouquetFilter,
  activeSatellite: SatelliteFilter = 'Tous'
): boolean {
  if (activeSatellite !== 'Tous' && !channelMatchesSatelliteFilter(ch, activeSatellite)) {
    return false;
  }
  if (bouquetFilter === 'Tous') return true;

  // Vérifier que le bouquet fait bien partie des bouquets autorisés pour le satellite actif
  if (activeSatellite !== 'Tous') {
    const allowedForSat = getBouquetsForSatellite(activeSatellite);
    if (!allowedForSat.includes(bouquetFilter)) {
      return false;
    }
  }

  const chBouquets = ch.bouquets || [];
  if (chBouquets.includes(bouquetFilter)) return true;

  if (
    bouquetFilter === 'TRT Network' &&
    activeSatellite !== 'Eutelsat 16°E' &&
    (ch.bouquetId === 'trt_network' || /\btrt\b/i.test(`${ch.id} ${ch.displayName}`))
  ) {
    return true;
  }

  if (
    (bouquetFilter ===
      'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)' ||
      bouquetFilter === 'Total TV (Balkans / Serbie / Croatie)' ||
      bouquetFilter === 'Total TV (Balkans)') &&
    (chBouquets.includes(
      'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)'
    ) ||
      chBouquets.includes('Total TV (Balkans / Serbie / Croatie)') ||
      chBouquets.includes('Total TV (Balkans)'))
  ) {
    return true;
  }
  if (
    (bouquetFilter === 'MAXtv / A1 Croatia' ||
      bouquetFilter === 'MAXtv (Croatie)' ||
      bouquetFilter === 'MaxTV Sat (Croatie)') &&
    (chBouquets.includes('MAXtv / A1 Croatia') ||
      chBouquets.includes('MAXtv (Croatie)') ||
      chBouquets.includes('MaxTV Sat (Croatie)') ||
      chBouquets.includes('A1 Bulgaria / A1 Hrvatska'))
  ) {
    return true;
  }
  if (
    (bouquetFilter === 'Autres chaînes africaines / francophones' ||
      bouquetFilter === 'Bouquet Afrique Francophone (2S TV, RTI, CRTV)') &&
    (chBouquets.includes('Autres chaînes africaines / francophones') ||
      chBouquets.includes('Bouquet Afrique Francophone (2S TV, RTI, CRTV)'))
  ) {
    return true;
  }
  if (
    (bouquetFilter === 'Bouquet National TVR (Roumanie FTA)' ||
      bouquetFilter === 'TVR / Chaînes Nationales (Roumanie)') &&
    (chBouquets.includes('Bouquet National TVR (Roumanie FTA)') ||
      chBouquets.includes('TVR / Chaînes Nationales (Roumanie)'))
  ) {
    return true;
  }
  if (
    (bouquetFilter === 'Groupe Persiana' ||
      bouquetFilter === 'Persiana Media Group (Farsi/Sport/Cinema)') &&
    (chBouquets.includes('Groupe Persiana') ||
      chBouquets.includes('Persiana Media Group (Farsi/Sport/Cinema)'))
  ) {
    return true;
  }
  if (
    (bouquetFilter === 'Bouquet National Turkmène' ||
      bouquetFilter === 'Turkmenistan National TV') &&
    (chBouquets.includes('Bouquet National Turkmène') ||
      chBouquets.includes('Turkmenistan National TV'))
  ) {
    return true;
  }
  if (
    bouquetFilter === 'Astra Canal+ France' &&
    (chBouquets.includes('Canal+ France') || chBouquets.includes('Astra Canal+'))
  ) {
    return true;
  }
  if (
    bouquetFilter === 'Astra TNT France' &&
    chBouquets.includes('TNT France')
  ) {
    return true;
  }
  if (
    bouquetFilter === 'Astra Movistar+ España' &&
    chBouquets.includes('Movistar+ / DAZN ES')
  ) {
    return true;
  }
  if (
    bouquetFilter === 'Hotbird Polsat/Cyfra+' &&
    (chBouquets.includes('Polsat / Cyfra+ / Eleven') ||
      chBouquets.includes('Canal+ / Eleven / FilmBox'))
  ) {
    return true;
  }
  if (
    bouquetFilter === 'Hotbird Bis TV/Rai' &&
    (chBouquets.includes('Bis TV (Hotbird 13°E)') ||
      chBouquets.includes('Bis TV France') ||
      chBouquets.includes('Rai / Sky Italia / Mediaset') ||
      chBouquets.includes('Sky Italia / DAZN IT'))
  ) {
    return true;
  }
  if (
    bouquetFilter === 'Hispasat Meo/NOS/Movistar' &&
    (chBouquets.includes('MEO / NOS / Movistar (30°W)') ||
      chBouquets.includes('Meo / NOS / Movistar 30°W'))
  ) {
    return true;
  }

  return false;
}

/**
 * Retourne exclusivement le nom exact du satellite actif (si sélectionné)
 * ou la position orbitale unique de la chaîne, sans jamais grouper deux positions orbitales.
 */
export function getSingleSatelliteBadgeForChannel(
  ch: EpgChannel,
  activeSatellite?: SatelliteFilter,
  selectedBouquets?: EpgBouquetId[]
): string {
  if (
    ch.bouquetId === 'trt_network' ||
    ch.bouquets?.includes('TRT Network') ||
    /\.tr$/i.test(ch.id || '')
  ) {
    return 'Türksat 42°E / Eutelsat 7°E';
  }
  if (
    activeSatellite &&
    activeSatellite !== 'Tous' &&
    channelMatchesSatelliteFilter(ch, activeSatellite)
  ) {
    if (activeSatellite === "Badr / Es'hailSat 26°E") return 'Badr 26°E';
    return activeSatellite;
  }
  if (selectedBouquets && selectedBouquets.length > 0 && ch.satellites?.length) {
    const allowedSat = ch.satellites.find((s) =>
      isSatelliteFilterAllowedBySettings(s, selectedBouquets)
    );
    if (allowedSat) {
      return normalizeSingleOrbitalPosition(allowedSat, [allowedSat]);
    }
  }
  return normalizeSingleOrbitalPosition(ch.orbitalPosition, ch.satellites);
}

/**
 * Retourne le bouquet de la chaîne correspondant au satellite/bouquet actif,
 * sanitisé dynamiquement pour supprimer le préfixe du satellite s'il est répété
 * (ex: "Astra Canal+ France" -> "Canal+ France", "Hotbird Bis TV/Rai" -> "Bis TV/Rai").
 */
export function getActiveBouquetBadgeForChannel(
  ch: EpgChannel,
  activeSatellite?: SatelliteFilter,
  activeBouquet?: BouquetFilter
): string | undefined {
  const resolvedSat = getSingleSatelliteBadgeForChannel(ch, activeSatellite);
  const chBouquets = ch.bouquets || [];

  if (
    activeBouquet &&
    activeBouquet !== 'Tous' &&
    channelMatchesBouquetFilter(ch, activeBouquet, activeSatellite || 'Tous')
  ) {
    return sanitizeBouquetDisplayName(activeBouquet, resolvedSat);
  }

  if (activeSatellite && activeSatellite !== 'Tous') {
    const allowedForSat = getBouquetsForSatellite(activeSatellite);
    const matching = chBouquets.find((b) => allowedForSat.includes(b));
    if (matching) {
      return sanitizeBouquetDisplayName(matching, resolvedSat);
    }
  }

  if (chBouquets.length > 0) {
    return sanitizeBouquetDisplayName(chBouquets[0], resolvedSat);
  }

  // Fallback dynamique basé sur le bouquetId si ch.bouquets est vide
  const fallbackBouquetId = resolveChannelBouquetId(ch);
  const fallbackNames: Partial<Record<EpgBouquetId, string>> = {
    astra_canal_fr: 'Canal+ France',
    astra_tnt_fr: 'TNT France',
    tnt_fr: 'TNT France',
    hotbird_bis_fr: 'Bis TV/Rai',
    movistar_es: 'Movistar+ España',
    hispasat_meo_nos: 'Meo/NOS/Movistar',
    sky_de: 'Sky DE / DAZN DE',
    sky_it: 'Bis TV/Rai',
    canal_pl: 'Polsat/Cyfra+',
    nilesat_osn_mbc: 'MBC/OSN/Rotana',
    badr_bein_ssc: 'beIN (Sports & Movies)',
    eutelsat_16e_digitalb: 'DigitAlb (Albanie)',
    trt_network: 'TRT Network',
    thor_08w_focussat: 'Focus Sat (Roumanie)',
    turkmenalem_52e_alem: 'Alem TV',
    monacosat_52e_persiana: 'Groupe Persiana',
    starone_70w_claro_br: 'Claro TV Brasil',
    amazonas_61w_latam: 'Vivo TV / Movistar LATAM',
    intelsat_43w_directv: 'DirecTV LATAM / Sky Brasil',
  };
  const fallback = fallbackNames[fallbackBouquetId];
  return fallback
    ? sanitizeBouquetDisplayName(fallback, resolvedSat)
    : undefined;
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
    label: 'Bis TV/Rai',
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
    label: 'Meo/NOS/Movistar',
    satellite: 'Hispasat 30°W',
    description:
      'MEO & NOS Portugal (TVCine Top/Edition/Emotion/Action, Canal Hollywood, AXN PT, Star Channel, Sport TV 1–5, BTV) & Movistar 30°W',
    estRamMb: 2.8,
    estimatedRamMb: 2.8,
    sampleChannels: ['MEO / NOS', 'TVCine / Hollywood', 'Sport TV 1–5', 'Movistar'],
  },
  {
    id: 'eutelsat_16e_digitalb',
    flag: '🇦🇱/🇷🇸/🇭🇷/🇸🇮/🌍',
    label:
      'DigitAlb (Albanie), Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie), MAXtv / A1 Croatia, New World TV (Afrique), Canal+ Réunion / Afrique & Autres chaînes africaines / francophones',
    satellite: 'Eutelsat 16°E',
    description:
      'Eutelsat 16°E : DigitAlb (Albanie), Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie), MAXtv / A1 Croatia, New World TV (Afrique), Canal+ Réunion / Afrique & Autres chaînes africaines / francophones',
    estRamMb: 2.8,
    estimatedRamMb: 2.8,
    sampleChannels: [
      'DigitAlb (Albanie)',
      'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)',
      'MAXtv / A1 Croatia',
      'New World TV (Afrique)',
      'Canal+ Réunion / Afrique',
      'Autres chaînes africaines / francophones',
    ],
  },
  {
    id: 'trt_network',
    flag: '🇹🇷',
    label:
      'TRT Network (TRT 1 HD, TRT Haber HD, TRT Spor HD, TRT Spor 2, TRT World, TRT Çocuk, TRT Belgesel, TRT Müzik, TRT Avaz, TRT Türk)',
    satellite: 'Türksat 42°E / Eutelsat 7°E',
    description:
      'Bouquet officiel TRT Network (Türksat 42°E / Eutelsat 7°E) : TRT 1 HD, TRT Haber HD, TRT Spor HD, TRT Spor 2, TRT World, TRT Çocuk, TRT Belgesel, TRT Müzik, TRT Avaz, TRT Türk',
    estRamMb: 1.6,
    estimatedRamMb: 1.6,
    sampleChannels: [
      'TRT 1 HD / TRT Haber HD',
      'TRT Spor HD / TRT Spor 2',
      'TRT World / TRT Belgesel',
      'TRT Çocuk / TRT Müzik / TRT Avaz / TRT Türk',
    ],
  },
  {
    id: 'thor_08w_focussat',
    flag: '🇷🇴/🇭🇺',
    label: 'Focus Sat (Roumanie), Direct One (Hongrie), Digi TV',
    satellite: 'Thor 0.8°W / Intelsat 10-02',
    description:
      'Thor 0.8°W / Intelsat 10-02 : Focus Sat (Roumanie), Direct One (Hongrie), Digi TV, Pro TV, Digi Sport, FilmBox & HBO',
    estRamMb: 2.6,
    estimatedRamMb: 2.6,
    sampleChannels: [
      'Focus Sat (Roumanie)',
      'Direct One (Hongrie)',
      'Digi TV',
    ],
  },
  {
    id: 'turkmenalem_52e_alem',
    flag: '🇹🇲',
    label:
      'Bouquet National Turkmène (Altyn Asyr, Yaslyk, Miras, Turkmenistan Sport) & Alem TV (Alem Sport 1 & 2 HD, Alem Cinema Premiere HD, Alem Discovery)',
    satellite: 'TurkmenÄlem 52°E',
    description:
      'TurkmenÄlem / MonacoSat 52°E : Bouquet National Turkmène (Altyn Asyr, Yaslyk, Miras, Turkmenistan Sport), Alem TV (Alem Sport 1 & 2 HD, Alem Cinema Premiere HD, Alem Discovery), Groupe Persiana, Groupe WNS & Information (Iran Intl, Afghanistan Intl)',
    estRamMb: 2.0,
    estimatedRamMb: 2.0,
    sampleChannels: [
      'Bouquet National Turkmène',
      'Alem Sport 1 & 2 HD / Alem Cinema / Discovery',
      'Groupe Persiana & Groupe WNS',
      'Iran International / Afghanistan International',
    ],
  },
  {
    id: 'monacosat_52e_persiana',
    flag: '🇲🇨',
    label:
      'Groupe Persiana (Sports 1 & 2, Cinema, Series, Family, Junior, Comedy, Docs, Music), Groupe WNS (AVA, FX 1 & 2, Avang, 4U, PMC Royale) & Information (Iran Intl, Afghanistan Intl)',
    satellite: 'MonacoSat 52°E',
    description:
      'MonacoSat / TurkmenÄlem 52°E : Groupe Persiana (Persiana Sports 1 & 2, Cinema, Series, Family, Junior, Comedy, Docs, Music), Groupe WNS (AVA Family, AVA Series, FX 1, FX 2, Avang TV, 4U Family, PMC Royale), Information (Iran International, Afghanistan International), Bouquet National Turkmène & Alem TV',
    estRamMb: 2.2,
    estimatedRamMb: 2.2,
    sampleChannels: [
      'Groupe Persiana (Sports 1 & 2, Cinema, Series, Docs, Music)',
      'Groupe WNS (AVA Family/Series, FX 1 & 2, Avang, 4U, PMC)',
      'Information (Iran International, Afghanistan International)',
      'Bouquet National Turkmène & Alem TV',
    ],
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
    satelliteId: 'sat_eutelsat_16e',
    orbitalPosition: 'Eutelsat 16°E',
    title:
      'Eutelsat 16°E — DigitAlb, Total TV (Balkans), MAXtv / A1 Croatia, New World TV & Canal+ Réunion / Afrique',
    flag: '🇦🇱/🇷🇸/🇭🇷/🇸🇮/🌍',
    subtitle:
      'Bouquets : DigitAlb (Albanie), Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie), MAXtv / A1 Croatia, New World TV (Afrique), Canal+ Réunion / Afrique & Autres chaînes africaines / francophones',
    bouquets: EPG_BOUQUET_CATALOG.filter(
      (b) => b.id === 'eutelsat_16e_digitalb'
    ),
  },
  {
    satelliteId: 'sat_turksat_42e',
    orbitalPosition: 'Türksat 42°E / Eutelsat 7°E',
    title: 'Türksat 42°E / Eutelsat 7°E — TRT Network (Turquie)',
    flag: '🇹🇷',
    subtitle:
      'Bouquet officiel TRT Network : TRT 1 HD, TRT Haber HD, TRT Spor HD, TRT Spor 2, TRT World, TRT Çocuk, TRT Belgesel, TRT Müzik, TRT Avaz, TRT Türk',
    bouquets: EPG_BOUQUET_CATALOG.filter((b) => b.id === 'trt_network'),
  },
  {
    satelliteId: 'sat_thor_08w',
    orbitalPosition: 'Thor 0.8°W / Intelsat 10-02',
    title:
      'Thor 0.8°W / Intelsat 10-02 — Focus Sat (Roumanie), Direct One (Hongrie), Digi TV',
    flag: '🇷🇴/🇭🇺',
    subtitle: 'Bouquets : Focus Sat (Roumanie), Direct One (Hongrie), Digi TV',
    bouquets: EPG_BOUQUET_CATALOG.filter((b) => b.id === 'thor_08w_focussat'),
  },
  {
    satelliteId: 'sat_turkmenalem_52e',
    orbitalPosition: 'TurkmenÄlem 52°E',
    title:
      'TurkmenÄlem 52°E — Bouquet National Turkmène, Alem TV, Groupe Persiana, Groupe WNS & Information',
    flag: '🇹🇲',
    subtitle:
      'Bouquets : Bouquet National Turkmène (Altyn Asyr, Yaslyk, Miras, Turkmenistan Sport), Alem TV (Alem Sport 1 & 2 HD, Alem Cinema Premiere HD, Alem Discovery), Groupe Persiana, Groupe WNS, Information',
    bouquets: EPG_BOUQUET_CATALOG.filter(
      (b) => b.id === 'turkmenalem_52e_alem'
    ),
  },
  {
    satelliteId: 'sat_monacosat_52e',
    orbitalPosition: 'MonacoSat 52°E',
    title:
      'MonacoSat 52°E — Groupe Persiana, Groupe WNS, Information, Bouquet National Turkmène & Alem TV',
    flag: '🇲🇨',
    subtitle:
      'Bouquets : Groupe Persiana (Sports 1 & 2, Cinema, Series, Family, Junior, Comedy, Docs, Music), Groupe WNS (AVA, FX 1 & 2, Avang, 4U, PMC Royale), Information (Iran Intl, Afghanistan Intl)',
    bouquets: EPG_BOUQUET_CATALOG.filter(
      (b) => b.id === 'monacosat_52e_persiana'
    ),
  },
  {
    satelliteId: 'sat_other_global',
    orbitalPosition: 'Amérique Latine (70°W / 61°W / 43.1°W)',
    title: 'Amérique Latine (Star One D2 70°W, Amazonas 61°W, Intelsat 43.1°W)',
    flag: '🇧🇷/🌎',
    subtitle:
      'Star One D2 70°W (Claro TV), Amazonas 61°W (Vivo / Movistar), Intelsat 43.1°W (DirecTV)',
    bouquets: EPG_BOUQUET_CATALOG.filter((b) =>
      [
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
  'astra_canal_fr',
  'astra_tnt_fr',
  'hotbird_bis_fr',
];

export interface TvProfileOptionalExtension {
  id: string;
  bouquetIds: EpgBouquetId[];
  satellite: string;
  label: string;
}

export interface TvProfileSpec {
  id: Exclude<TvProfileId, 'custom'>;
  flag: string;
  label: string;
  shortLabel: string;
  satellitesSummary: string;
  satellitesList: string[];
  description: string;
  bouquets: EpgBouquetId[];
  optionalExtensions?: TvProfileOptionalExtension[];
}

export const MAGHREB_OPTIONAL_EXTENSIONS: TvProfileOptionalExtension[] = [
  {
    id: 'ext_52e',
    bouquetIds: ['turkmenalem_52e_alem', 'monacosat_52e_persiana'],
    satellite: 'TurkmenÄlem / MonacoSAT 52°E',
    label: 'TurkmenÄlem / MonacoSAT 52°E',
  },
  {
    id: 'ext_16e',
    bouquetIds: ['eutelsat_16e_digitalb'],
    satellite: 'Eutelsat 16°E',
    label: 'Eutelsat 16°E',
  },
  {
    id: 'ext_30w',
    bouquetIds: ['hispasat_meo_nos'],
    satellite: 'Hispasat 30°W',
    label: 'Hispasat 30°W',
  },
];

export const TV_PROFILES_CATALOG: TvProfileSpec[] = [
  {
    id: 'france_europe_fr',
    flag: '🇫🇷',
    label: 'France / Europe Francophone',
    shortLabel: 'France / Europe FR',
    satellitesSummary: 'Astra 19.2°E & Hotbird 13°E (2 satellites)',
    satellitesList: ['Astra 19.2°E', 'Hotbird 13°E'],
    description:
      'Charge par défaut UNIQUEMENT Astra 19.2°E (France : Canal+, TNT) et Hotbird 13°E (Bis TV, Italie, Pologne). Sans Nilesat.',
    bouquets: ['astra_canal_fr', 'astra_tnt_fr', 'hotbird_bis_fr'],
  },
  {
    id: 'moyen_orient_golfe',
    flag: '🇸🇦/🇦🇪/🇶🇦',
    label: 'Moyen-Orient / Golfe (AR)',
    shortLabel: 'Moyen-Orient / Golfe',
    satellitesSummary: 'Nilesat 7°W & Badr 26°E (2 satellites)',
    satellitesList: ['Nilesat 7°W', 'Badr 26°E'],
    description:
      'Charge par défaut UNIQUEMENT Nilesat 7°W (MBC, OSN, Rotana) et Badr 26°E (beIN Sports/Movies, SSC, Al Kass).',
    bouquets: ['nilesat_osn_mbc', 'badr_bein_ssc'],
  },
  {
    id: 'maghreb_mena',
    flag: '🇲🇦/🇩🇿/🇹🇳',
    label: 'Maghreb / MENA (AR)',
    shortLabel: 'Maghreb / MENA',
    satellitesSummary: 'Nilesat 7°W & Badr 26°E (2 satellites)',
    satellitesList: ['Nilesat 7°W', 'Badr 26°E'],
    description:
      'Charge par défaut UNIQUEMENT Nilesat 7°W (MBC, OSN, Rotana) et Badr 26°E (beIN Sports, SSC, Al Kass).',
    bouquets: ['nilesat_osn_mbc', 'badr_bein_ssc'],
    optionalExtensions: MAGHREB_OPTIONAL_EXTENSIONS,
  },
  {
    id: 'espagne',
    flag: '🇪🇸',
    label: 'Espagne & Lusophonie',
    shortLabel: 'Espagne / PT',
    satellitesSummary: 'Astra 19.2°E, Hispasat 30°W & Star One 70°W (3 satellites)',
    satellitesList: ['Astra 19.2°E', 'Hispasat 30°W', 'Star One 70°W'],
    description:
      'Charge Astra 19.2°E (Movistar Plus+, DAZN ES), Hispasat 30°W (Meo/NOS/Movistar) et Star One 70°W (Claro TV).',
    bouquets: ['movistar_es', 'hispasat_meo_nos', 'starone_70w_claro_br'],
  },
  {
    id: 'italie',
    flag: '🇮🇹',
    label: 'Italie',
    shortLabel: 'Italie',
    satellitesSummary: 'Hotbird 13°E uniquement (1 satellite)',
    satellitesList: ['Hotbird 13°E'],
    description:
      'Charge uniquement Hotbird 13°E (Tivùsat Rai 1–4, Mediaset & Sky Italia / DAZN IT).',
    bouquets: ['sky_it'],
  },
  {
    id: 'amerique_sud_latam',
    flag: '🇧🇷/🇦🇷/🌎',
    label: 'Amérique du Sud / LATAM',
    shortLabel: 'Amérique du Sud / LATAM',
    satellitesSummary:
      'Star One 70°W, Amazonas 61°W & SES-6 40.5°W (3 satellites)',
    satellitesList: ['Star One 70°W', 'Amazonas 61°W', 'SES-6 40.5°W'],
    description:
      'Charge uniquement Star One 70°W (Claro TV Brasil), Amazonas 61°W (Vivo / Movistar LATAM) et SES-6 40.5°W (DirecTV / Sky).',
    bouquets: [
      'starone_70w_claro_br',
      'amazonas_61w_latam',
      'intelsat_43w_directv',
    ],
  },
  {
    id: 'europe_standard',
    flag: '🇪🇺',
    label: 'Europe Standard',
    shortLabel: 'Europe Standard',
    satellitesSummary: 'Astra 19.2°E & Hotbird 13°E (Max 3 bouquets)',
    satellitesList: ['Astra 19.2°E', 'Hotbird 13°E'],
    description:
      'Charge Astra 19.2°E (Canal+ FR, Sky DE) et Hotbird 13°E (Bis TV / Sky IT) dans la limite stricte de 3 bouquets actifs.',
    bouquets: [
      'astra_canal_fr',
      'sky_de',
      'hotbird_bis_fr',
    ],
  },
  {
    id: 'all_satellites',
    flag: '🛰️',
    label: 'Tous les satellites',
    shortLabel: 'Tous les satellites',
    satellitesSummary:
      'Nilesat, Badr, Astra 19.2°E, Hotbird 13°E, Hispasat 30°W, Eutelsat 16°E, Türksat 42°E, Thor 0.8°W, 52°E & LATAM',
    satellitesList: [
      'Nilesat 7°W',
      'Badr 26°E',
      'Astra 19.2°E',
      'Hotbird 13°E',
      'Hispasat 30°W',
      'Eutelsat 16°E',
      'Türksat 42°E',
      'Thor 0.8°W',
      'TurkmenÄlem / MonacoSAT 52°E',
      'Star One 70°W / Amazonas 61°W / SES-6 40.5°W',
    ],
    description:
      'Active tous les satellites et bouquets disponibles sans restriction de zone.',
    bouquets: [...ALL_BOUQUET_IDS],
  },
];

export const MAX_ACTIVE_BOUQUETS_STRICT = 3;

export const RAM_BOUQUET_LIMIT_TOAST_MESSAGE =
  "Limite atteinte : Maximum 3 bouquets actifs simultanément pour garantir la fluidité et éviter la saturation mémoire (RAM) de votre TV. Désactivez un bouquet avant d'en ajouter un nouveau.";

/**
 * Associe dynamiquement les satellites et bouquets par défaut selon la langue sélectionnée :
 * - FR -> Astra 19.2°E / Hotbird 13°E [Canal+, TNT, Bis TV]
 * - AR -> Nilesat 7°W / Badr 26°E [OSN/MBC, beIN/SSC]
 * - ES/PT -> Astra 19.2°E / Hispasat 30°W / Star One 70°W [Movistar+, Meo/NOS, Claro TV]
 * - DE -> Astra 19.2°E [Sky DE]
 * - IT -> Hotbird 13°E [Sky IT]
 * - TR -> Türksat 42°E [TRT]
 */
export function getDynamicProfileForLanguage(lang: AppLanguage): {
  tvProfile: TvProfileId;
  selectedBouquets: EpgBouquetId[];
} {
  switch (lang) {
    case 'fr':
      return {
        tvProfile: 'france_europe_fr',
        selectedBouquets: ['astra_canal_fr', 'astra_tnt_fr', 'hotbird_bis_fr'],
      };
    case 'ar':
      return {
        tvProfile: 'maghreb_mena',
        selectedBouquets: ['nilesat_osn_mbc', 'badr_bein_ssc'],
      };
    case 'es':
    case 'pt':
      return {
        tvProfile: 'espagne',
        selectedBouquets: [
          'movistar_es',
          'hispasat_meo_nos',
          'starone_70w_claro_br',
        ],
      };
    case 'de':
      return {
        tvProfile: 'custom',
        selectedBouquets: ['sky_de'],
      };
    case 'it':
      return {
        tvProfile: 'italie',
        selectedBouquets: ['sky_it'],
      };
    case 'tr':
      return {
        tvProfile: 'custom',
        selectedBouquets: ['trt_network'],
      };
    case 'en':
    default:
      return {
        tvProfile: 'europe_standard',
        selectedBouquets: ['astra_canal_fr', 'nilesat_osn_mbc', 'sky_de'],
      };
  }
}

export function isStoredSessionPremium(): boolean {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem('pulseepg_optional_auth_session_v1');
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { isPremium?: boolean; plan?: string };
    return Boolean(parsed && (parsed.isPremium === true || parsed.plan === 'pro'));
  } catch {
    return false;
  }
}

export function getBouquetsForTvProfile(
  profileId: TvProfileId,
  isPremium: boolean = isStoredSessionPremium()
): EpgBouquetId[] {
  const found = TV_PROFILES_CATALOG.find((p) => p.id === profileId);
  if (found) {
    if (isPremium || profileId === 'all_satellites') {
      return [...found.bouquets];
    }
    return [...found.bouquets].slice(0, MAX_ACTIVE_BOUQUETS_STRICT);
  }
  return [...DEFAULT_ENABLED_BOUQUET_IDS].slice(0, MAX_ACTIVE_BOUQUETS_STRICT);
}

export function inferTvProfileFromBouquets(
  bouquets: EpgBouquetId[],
  explicitProfile?: TvProfileId
): TvProfileId {
  const normalizedSet = new Set(bouquets);

  if (
    explicitProfile &&
    explicitProfile !== 'custom' &&
    TV_PROFILES_CATALOG.some((p) => p.id === explicitProfile)
  ) {
    const expected = getBouquetsForTvProfile(explicitProfile);
    if (
      expected.length === normalizedSet.size &&
      expected.every((b) => normalizedSet.has(b))
    ) {
      return explicitProfile;
    }
    // Conserver le profil "maghreb_mena" si les 3 satellites principaux sont actifs + extensions Maghreb optionnelles (52°E, 16°E, 30°W)
    if (explicitProfile === 'maghreb_mena') {
      const maghrebCore = getBouquetsForTvProfile('maghreb_mena');
      const maghrebAllowed = new Set<EpgBouquetId>([
        ...maghrebCore,
        'turkmenalem_52e_alem',
        'monacosat_52e_persiana',
        'eutelsat_16e_digitalb',
        'hispasat_meo_nos',
        'badr_bein_ssc',
      ]);
      const hasAllCore = maghrebCore.every((b) => normalizedSet.has(b));
      const onlyMaghrebAllowed = Array.from(normalizedSet).every((b) =>
        maghrebAllowed.has(b)
      );
      if (hasAllCore && onlyMaghrebAllowed) {
        return 'maghreb_mena';
      }
    }
  }

  for (const profile of TV_PROFILES_CATALOG) {
    if (
      profile.bouquets.length === normalizedSet.size &&
      profile.bouquets.every((b) => normalizedSet.has(b))
    ) {
      return profile.id;
    }
  }
  if (normalizedSet.size >= ALL_BOUQUET_IDS.length - 1) {
    return 'all_satellites';
  }
  return 'custom';
}

const MAGHREB_COUNTRY_CODES = new Set(['MA', 'DZ', 'TN', 'LY', 'MR']);
const LATAM_COUNTRY_CODES = new Set([
  '419',
  'AR',
  'BO',
  'BR',
  'CL',
  'CO',
  'CR',
  'CU',
  'DO',
  'EC',
  'GT',
  'HN',
  'MX',
  'NI',
  'PA',
  'PE',
  'PR',
  'PY',
  'SV',
  'UY',
  'VE',
]);

/**
 * Détection automatique stricte du profil au démarrage (2 à 3 satellites max)
 * basée sur `navigator.language` et la région système :
 * - Profil "France / Europe Francophone" (Langue 'fr' hors Maghreb) -> UNIQUEMENT Astra 19.2°E et Hotbird 13°E
 * - Profil "Moyen-Orient / Golfe" (Langue 'ar' hors Maghreb) -> UNIQUEMENT Nilesat 7°W et Badr 26°E
 * - Profil "Maghreb / MENA Multi-Sat" (Région Maghreb détectée) -> UNIQUEMENT les 3 principaux : Nilesat 7°W, Astra 19.2°E, Hotbird 13°E
 * - Profil "Espagne" (Langue 'es' Espagne) -> UNIQUEMENT Astra 19.2°E et Hispasat 30°W
 * - Profil "Italie" (Langue 'it') -> UNIQUEMENT Hotbird 13°E
 * - Profil "Amérique du Sud / LATAM" (Langues 'es' LATAM / 'pt') -> UNIQUEMENT Star One 70°W, Amazonas 61°W, SES-6 40.5°W
 * - Autres langues -> Profil "Europe Standard" (Astra 19.2°E, Hotbird 13°E)
 */
export function detectInitialTvProfileFromSystemLanguage(
  sysLangOverride?: string
): {
  tvProfile: Exclude<TvProfileId, 'custom' | 'all_satellites'>;
  language: AppLanguage;
  selectedBouquets: EpgBouquetId[];
} {
  try {
    const browserLanguages: string[] =
      sysLangOverride !== undefined
        ? [sysLangOverride]
        : typeof navigator !== 'undefined'
        ? [
            ...(typeof navigator.language === 'string' && navigator.language
              ? [navigator.language]
              : []),
            ...(Array.isArray(navigator.languages) ? navigator.languages : []),
          ]
        : [];

    const primaryRaw = String(browserLanguages[0] || 'fr').trim();
    const langLower = primaryRaw.toLowerCase();
    const parts = primaryRaw.split(/[-_]/);
    const langPrefix = (parts[0] || 'fr').toLowerCase();
    let regionSubtag = (parts[1] || '').toUpperCase();

    if (!regionSubtag && browserLanguages.length > 1) {
      for (const candidate of browserLanguages) {
        if (typeof candidate !== 'string') continue;
        const cParts = candidate.trim().split(/[-_]/);
        if (
          cParts[0]?.toLowerCase() === langPrefix &&
          cParts[1] &&
          cParts[1].length >= 2
        ) {
          regionSubtag = cParts[1].toUpperCase();
          break;
        }
      }
    }

    let sysTimeZone = '';
    try {
      sysTimeZone =
        Intl.DateTimeFormat().resolvedOptions().timeZone?.toLowerCase() || '';
    } catch {
      sysTimeZone = '';
    }

    const isMaghrebTimezone =
      sysTimeZone.includes('casablanca') ||
      sysTimeZone.includes('algiers') ||
      sysTimeZone.includes('tunis') ||
      sysTimeZone.includes('tripoli') ||
      sysTimeZone.includes('nouakchott');

    const isMaghrebRegion =
      MAGHREB_COUNTRY_CODES.has(regionSubtag) || isMaghrebTimezone;

    const isLatamTimezone =
      sysTimeZone.startsWith('america/') &&
      !sysTimeZone.includes('new_york') &&
      !sysTimeZone.includes('chicago') &&
      !sysTimeZone.includes('denver') &&
      !sysTimeZone.includes('los_angeles') &&
      !sysTimeZone.includes('toronto') &&
      !sysTimeZone.includes('vancouver') &&
      !sysTimeZone.includes('montreal');

    // 1. Profil "FR" (Français) :
    // Charge par défaut UNIQUEMENT Astra 19.2°E (pour la France) et Hotbird 13°E (pour Pologne, Italie, Allemagne / Bis TV). Exclut Nilesat par défaut.
    if (langPrefix === 'fr') {
      return {
        tvProfile: 'france_europe_fr',
        language: 'fr',
        selectedBouquets: ['astra_canal_fr', 'astra_tnt_fr', 'hotbird_bis_fr'],
      };
    }

    // 2. Profil "AR" / Maghreb-MENA (Langue 'ar') :
    // Charge par défaut UNIQUEMENT Badr 26°E et Nilesat 7°W
    if (langPrefix === 'ar') {
      return {
        tvProfile: isMaghrebRegion ? 'maghreb_mena' : 'moyen_orient_golfe',
        language: 'ar',
        selectedBouquets: ['nilesat_osn_mbc', 'badr_bein_ssc'],
      };
    }

    // 4. Profil "Amérique du Sud / LATAM" (Langues 'es' LATAM / 'pt')
    // Charge UNIQUEMENT : Star One 70°W, Amazonas 61°W, SES-6 40.5°W
    if (
      langPrefix === 'pt' ||
      (langPrefix === 'es' &&
        (LATAM_COUNTRY_CODES.has(regionSubtag) ||
          (regionSubtag !== 'ES' && isLatamTimezone)))
    ) {
      return {
        tvProfile: 'amerique_sud_latam',
        language: langPrefix === 'pt' ? 'pt' : 'es',
        selectedBouquets: getBouquetsForTvProfile('amerique_sud_latam'),
      };
    }

    // 5. Profil "Espagne" (Langue 'es')
    // Charge UNIQUEMENT : Astra 19.2°E et Hispasat 30°W
    if (langLower.startsWith('es')) {
      return {
        tvProfile: 'espagne',
        language: 'es',
        selectedBouquets: getBouquetsForTvProfile('espagne'),
      };
    }

    // 6. Profil "Italie" (Langue 'it')
    // Charge UNIQUEMENT : Hotbird 13°E [Sky IT]
    if (langLower.startsWith('it')) {
      return {
        tvProfile: 'italie',
        language: 'it',
        selectedBouquets: ['sky_it'],
      };
    }

    // 7. Profil "Turquie" (Langue 'tr') -> Türksat 42°E [TRT]
    if (langLower.startsWith('tr')) {
      return {
        tvProfile: 'europe_standard',
        language: 'tr',
        selectedBouquets: ['trt_network'],
      };
    }

    // 8. Profil "Allemagne" (Langue 'de') -> Astra 19.2°E [Sky DE]
    if (langLower.startsWith('de')) {
      return {
        tvProfile: 'europe_standard',
        language: 'de',
        selectedBouquets: ['sky_de'],
      };
    }

    // 9. Autres langues -> Profil "Europe Standard" (Astra 19.2°E, Hotbird 13°E)
    return {
      tvProfile: 'europe_standard',
      language: 'en',
      selectedBouquets: getBouquetsForTvProfile('europe_standard'),
    };
  } catch {
    return {
      tvProfile: 'france_europe_fr',
      language: 'fr',
      selectedBouquets: [...DEFAULT_ENABLED_BOUQUET_IDS],
    };
  }
}

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
    name: '🇦🇱/🇷🇸/🇭🇷/🇸🇮/🌍 Eutelsat 16°E · DigitAlb, Total TV, MAXtv / A1 Croatia, New World TV & Canal+ Réunion / Afrique',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_RS1.xml.gz',
    country: 'EU',
    bouquetId: 'eutelsat_16e_digitalb',
    enabled: true,
  },
  {
    id: 'src_tr1',
    name: '🇹🇷 Türksat 42°E / Eutelsat 7°E · TRT Network (TRT 1 HD, TRT Haber HD, TRT Spor HD, TRT Spor 2, TRT World, TRT Çocuk, TRT Belgesel, TRT Müzik, TRT Avaz, TRT Türk)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_TR1.xml.gz',
    country: 'EU',
    bouquetId: 'trt_network',
    enabled: true,
  },
  {
    id: 'src_thor08w',
    name: '🇷🇴/🇭🇺 Thor 0.8°W / Intelsat 10-02 · Focus Sat (Roumanie), Direct One (Hongrie), Digi TV',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_RO1.xml.gz',
    country: 'EU',
    bouquetId: 'thor_08w_focussat',
    enabled: true,
  },
  {
    id: 'src_turkmenalem52e',
    name: '🇹🇲 TurkmenÄlem 52°E · Bouquet National Turkmène & Alem TV (Sport 1 & 2 HD, Cinema, Discovery)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_UZ1.xml.gz',
    country: 'EU',
    bouquetId: 'turkmenalem_52e_alem',
    enabled: true,
  },
  {
    id: 'src_monacosat52e',
    name: '🇲🇨 MonacoSat 52°E · Groupe Persiana, Groupe WNS & Information (Iran Intl, Afghanistan Intl)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_CY1.xml.gz',
    country: 'EU',
    bouquetId: 'monacosat_52e_persiana',
    enabled: true,
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
  if (
    u.includes('_uz1') ||
    u.includes('_tm1') ||
    source.bouquetId === 'turkmenalem_52e_alem'
  ) {
    return 'turkmenalem_52e_alem';
  }
  if (
    u.includes('_cy1') ||
    u.includes('_ir1') ||
    source.bouquetId === 'monacosat_52e_persiana'
  ) {
    return 'monacosat_52e_persiana';
  }
  if (u.includes('_tr1') || source.bouquetId === 'trt_network') {
    return 'trt_network';
  }
  if (
    u.includes('_rs1') ||
    u.includes('_hr1') ||
    u.includes('_al1') ||
    u.includes('_ba1') ||
    u.includes('_bg1') ||
    source.bouquetId === 'eutelsat_16e_digitalb'
  ) {
    return 'eutelsat_16e_digitalb';
  }
  if (
    u.includes('_ro1') ||
    u.includes('_hu1') ||
    source.bouquetId === 'thor_08w_focussat' ||
    source.country === 'EU'
  ) {
    return 'thor_08w_focussat';
  }
  if (u.includes('_br1') || source.country === 'BR') return 'starone_70w_claro_br';
  if (u.includes('_cl1') || u.includes('_pe1')) return 'amazonas_61w_latam';
  if (u.includes('_co1') || u.includes('_ar1') || source.country === 'LATAM') {
    return 'intelsat_43w_directv';
  }
  if (source.bouquetId && source.bouquetId !== 'eutelsat_16e_thor') {
    return source.bouquetId;
  }
  if (source.country === 'PL' || u.includes('_pl')) return 'canal_pl';
  if (source.country === 'FR' || u.includes('_fr')) return 'astra_canal_fr';
  if (source.country === 'ES' || u.includes('_es')) return 'movistar_es';
  if (source.country === 'DE' || u.includes('_de')) return 'sky_de';
  if (source.country === 'IT' || u.includes('_it')) return 'sky_it';
  return 'nilesat_osn_mbc';
}

export function resolveChannelBouquetId(ch: {
  id?: string;
  bouquetId?: EpgBouquetId;
  country: Exclude<CountryCode, 'Tous'>;
  bouquets?: string[];
  satellites?: string[];
}): EpgBouquetId {
  if (ch.bouquetId && ch.bouquetId !== 'eutelsat_16e_thor') return ch.bouquetId;
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
  if (
    ch.satellites?.some((s) => s.includes('MonacoSat')) ||
    ch.bouquets?.some(
      (b) =>
        b.includes('Persiana') ||
        b.includes('WNS') ||
        b.includes('Information') ||
        b.includes('Big Bang')
    ) ||
    /\.(mc|ir)$/i.test(ch.id || '')
  ) {
    return 'monacosat_52e_persiana';
  }
  if (
    ch.satellites?.some((s) => s.includes('Turkmen')) ||
    ch.bouquets?.some(
      (b) =>
        b.includes('Alem TV') ||
        b.includes('Turkmène') ||
        b.includes('Turkmenistan')
    ) ||
    /\.(tm|uz)$/i.test(ch.id || '')
  ) {
    return 'turkmenalem_52e_alem';
  }
  if (
    ch.satellites?.some((s) => s.includes('Türksat') || s.includes('42°E')) ||
    ch.bouquets?.some((b) => b === 'TRT Network' || b.includes('TRT')) ||
    /\.tr$/i.test(ch.id || '')
  ) {
    return 'trt_network';
  }
  if (
    ch.satellites?.some((s) => s.includes('Eutelsat 16')) ||
    ch.bouquets?.some(
      (b) =>
        b.includes('DigitAlb') ||
        b.includes('Total TV') ||
        b.includes('MAXtv') ||
        b.includes('MaxTV') ||
        b.includes('New World TV') ||
        b.includes('Canal+ Réunion') ||
        b.includes('africaines / francophones') ||
        b.includes('RTSH') ||
        b.includes('Afrique Francophone') ||
        b.includes('A1 Bulgaria') ||
        b.includes('A1 Hrvatska')
    ) ||
    /\.(al|rs|hr|ba|si|mk|me|bg|16e|fr16e|sn|ci|cm|ml|bf|ga)$/i.test(ch.id || '')
  ) {
    return 'eutelsat_16e_digitalb';
  }
  if (
    ch.satellites?.some((s) => s.includes('Thor')) ||
    ch.bouquets?.some(
      (b) =>
        b.includes('Focus Sat') ||
        b.includes('Direct One') ||
        b.includes('Digi TV')
    ) ||
    /\.(ro|hu|sk|cz)$/i.test(ch.id || '')
  ) {
    return 'thor_08w_focussat';
  }
  if (ch.country === 'EU') return 'thor_08w_focussat';
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
    return active.includes('astra_canal_fr');
  }
  if (b === 'Astra TNT France' || b === 'TNT France') {
    return active.includes('astra_tnt_fr') || active.includes('tnt_fr');
  }
  if (
    b === 'Hotbird Bis TV/Rai' ||
    b === 'Bis TV (Hotbird 13°E)' ||
    b === 'Bis TV France' ||
    b === 'Rai / Sky Italia / Mediaset' ||
    b === 'Sky Italia / DAZN IT'
  ) {
    return active.includes('hotbird_bis_fr') || active.includes('sky_it');
  }
  if (b === 'Astra Movistar+ España' || b === 'Movistar+ / DAZN ES') {
    return active.includes('movistar_es');
  }
  if (
    b === 'Hispasat Meo/NOS/Movistar' ||
    b === 'MEO / NOS / Movistar (30°W)' ||
    b === 'Meo / NOS / Movistar 30°W'
  ) {
    return active.includes('hispasat_meo_nos');
  }
  if (b === 'Sky DE / DAZN DE') {
    return (
      active.includes('sky_de') ||
      (active.includes('astra_canal_fr') &&
        active.includes('hotbird_bis_fr') &&
        !active.includes('nilesat_osn_mbc'))
    );
  }
  if (
    b === 'Hotbird Polsat/Cyfra+' ||
    b === 'Polsat / Cyfra+ / Eleven' ||
    b === 'Canal+ / Eleven / FilmBox' ||
    b === 'HBO / Cinemax' ||
    b === 'AXN / Warner / Sci-Fi'
  ) {
    return (
      active.includes('canal_pl') ||
      (active.includes('hotbird_bis_fr') &&
        active.includes('astra_canal_fr') &&
        !active.includes('nilesat_osn_mbc'))
    );
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
  if (b === 'TRT Network') {
    return active.includes('trt_network');
  }
  if (
    b === 'DigitAlb (Albanie)' ||
    b === 'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)' ||
    b === 'Total TV (Balkans / Serbie / Croatie)' ||
    b === 'Total TV (Balkans)' ||
    b === 'MAXtv / A1 Croatia' ||
    b === 'MAXtv (Croatie)' ||
    b === 'MaxTV Sat (Croatie)' ||
    b === 'New World TV (Afrique)' ||
    b === 'Canal+ Réunion / Afrique' ||
    b === 'Autres chaînes africaines / francophones' ||
    b === 'Bouquet National RTSH (Albanie FTA)' ||
    b === 'Bouquet National TVR (Roumanie FTA)' ||
    b === 'Bouquet Afrique Francophone (2S TV, RTI, CRTV)' ||
    b === 'A1 Bulgaria / A1 Hrvatska' ||
    b === 'TVR / Chaînes Nationales (Roumanie)'
  ) {
    return (
      active.includes('eutelsat_16e_digitalb') ||
      active.includes('eutelsat_16e_thor')
    );
  }
  if (
    b === 'Focus Sat (Roumanie)' ||
    b === 'Direct One (Hongrie)' ||
    b === 'Digi TV'
  ) {
    return (
      active.includes('thor_08w_focussat') ||
      active.includes('eutelsat_16e_thor')
    );
  }
  if (
    b === 'Alem TV' ||
    b === 'Bouquet National Turkmène' ||
    b === 'Turkmenistan National TV' ||
    b === 'Groupe Persiana' ||
    b === 'Persiana Media Group (Farsi/Sport/Cinema)' ||
    b === 'Groupe WNS' ||
    b === 'Information (Iran Intl / Afghanistan Intl)' ||
    b === 'Information' ||
    b === 'Big Bang TV'
  ) {
    return (
      active.includes('turkmenalem_52e_alem') ||
      active.includes('monacosat_52e_persiana')
    );
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
    return active.includes('hispasat_meo_nos');
  }
  if (sat === 'Eutelsat 16°E') {
    return (
      active.includes('eutelsat_16e_digitalb') ||
      active.includes('eutelsat_16e_thor')
    );
  }
  if (sat === 'Türksat 42°E' || sat === 'Türksat 42°E / Eutelsat 7°E') {
    return active.includes('trt_network');
  }
  if (sat === 'Thor 0.8°W / Intelsat 10-02' || sat === 'Thor 0.8°W') {
    return (
      active.includes('thor_08w_focussat') ||
      active.includes('eutelsat_16e_thor')
    );
  }
  if (sat === 'TurkmenÄlem 52°E') {
    return active.includes('turkmenalem_52e_alem');
  }
  if (sat === 'MonacoSat 52°E') {
    return active.includes('monacosat_52e_persiana');
  }
  if (sat === 'Star One D2 70°W' || sat === 'Star One 70°W') {
    return active.includes('starone_70w_claro_br');
  }
  if (sat === 'Amazonas 61°W') {
    return active.includes('amazonas_61w_latam');
  }
  if (
    sat === 'Intelsat 43.1°W / SES-6 40.5°W' ||
    sat === 'Intelsat 43.1°W & SES-6 40.5°W' ||
    sat === 'SES-6 40.5°W'
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
  if (c === 'DE') {
    return (
      active.includes('sky_de') ||
      (active.includes('astra_canal_fr') &&
        active.includes('hotbird_bis_fr') &&
        !active.includes('nilesat_osn_mbc'))
    );
  }
  if (c === 'IT') {
    return (
      active.includes('sky_it') ||
      active.includes('hotbird_bis_fr')
    );
  }
  if (c === 'PL') {
    return (
      active.includes('canal_pl') ||
      (active.includes('hotbird_bis_fr') &&
        active.includes('astra_canal_fr') &&
        !active.includes('nilesat_osn_mbc'))
    );
  }
  if (c === 'AR') {
    return (
      active.includes('nilesat_osn_mbc') || active.includes('badr_bein_ssc')
    );
  }
  if (c === 'EU') {
    return (
      active.includes('eutelsat_16e_digitalb') ||
      active.includes('trt_network') ||
      active.includes('thor_08w_focussat') ||
      active.includes('turkmenalem_52e_alem') ||
      active.includes('monacosat_52e_persiana') ||
      active.includes('eutelsat_16e_thor')
    );
  }
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
  if (isAdultChannel(ch.id, ch.displayName)) {
    return false;
  }
  const activeBouquets =
    settings.selectedBouquets && settings.selectedBouquets.length > 0
      ? settings.selectedBouquets
      : DEFAULT_ENABLED_BOUQUET_IDS;
  const activeCats =
    settings.enabledCategories && settings.enabledCategories.length > 0
      ? settings.enabledCategories
      : ALL_THEMATIC_CATEGORIES;

  // Vérification stricte que la chaîne appartient à au moins un satellite actif du profil
  if (
    ch.satellites &&
    ch.satellites.length > 0 &&
    !ch.satellites.some((s) =>
      isSatelliteFilterAllowedBySettings(s, activeBouquets)
    )
  ) {
    return false;
  }

  const chBouquetId = resolveChannelBouquetId(ch);
  let bouquetAllowed = activeBouquets.includes(chBouquetId);

  if (
    !bouquetAllowed &&
    (chBouquetId === 'trt_network' || ch.bouquets?.includes('TRT Network'))
  ) {
    bouquetAllowed = activeBouquets.includes('trt_network');
  }

  // Autoriser les chaînes diffusées sur Nilesat 7°W ou Badr 26°E dès lors que le satellite correspondant est activé
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

  // Autoriser les chaînes Hotbird 13°E (Italie, Pologne) et Astra 19.2°E (Allemagne) dans le profil "FR" par défaut (tout en excluant strictement Nilesat)
  if (
    !bouquetAllowed &&
    settings.tvProfile === 'france_europe_fr' &&
    !activeBouquets.includes('nilesat_osn_mbc')
  ) {
    if (
      (chBouquetId === 'sky_it' || chBouquetId === 'canal_pl') &&
      activeBouquets.includes('hotbird_bis_fr')
    ) {
      bouquetAllowed = true;
    }
    if (
      chBouquetId === 'sky_de' &&
      activeBouquets.includes('astra_canal_fr')
    ) {
      bouquetAllowed = true;
    }
  }
  if (
    !bouquetAllowed &&
    (chBouquetId === 'astra_tnt_fr' || chBouquetId === 'tnt_fr')
  ) {
    bouquetAllowed =
      activeBouquets.includes('astra_tnt_fr') ||
      activeBouquets.includes('tnt_fr');
  }
  if (
    !bouquetAllowed &&
    (chBouquetId === 'turkmenalem_52e_alem' ||
      chBouquetId === 'monacosat_52e_persiana')
  ) {
    bouquetAllowed =
      activeBouquets.includes('turkmenalem_52e_alem') ||
      activeBouquets.includes('monacosat_52e_persiana');
  }
  if (
    !bouquetAllowed &&
    (chBouquetId === 'eutelsat_16e_digitalb' ||
      chBouquetId === 'eutelsat_16e_thor')
  ) {
    bouquetAllowed =
      activeBouquets.includes('eutelsat_16e_digitalb') ||
      activeBouquets.includes('eutelsat_16e_thor');
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

  // Filtrage strict par profil TV ("Espagne" = Movistar+ & TNT Abertis uniquement, sans chaînes portugaises MEO/NOS)
  if (settings.tvProfile === 'espagne') {
    const chCountries = extractChannelCountries(ch);
    if (chCountries.includes('PT') && !chCountries.includes('ES')) {
      return false;
    }
  }

  // Filtrage strict par profil TV ("Italie" = Tivùsat & Sky Italia uniquement)
  if (settings.tvProfile === 'italie') {
    if (chBouquetId !== 'sky_it' && ch.country !== 'IT') {
      return false;
    }
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
  secondArg?: EpgBouquetId[] | EpgSourceItem[],
  tvProfile?: TvProfileId
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

  const normalizedSources: EpgSourceItem[] = sources.map((s) => {
    const httpsUrl = ensureHttpsUrl(s.url) || s.url.trim();
    const matchedDefault = DEFAULT_EPG_SOURCES.find(
      (def) => def.url.toLowerCase() === httpsUrl.toLowerCase()
    );
    if (matchedDefault && !s.id.startsWith('custom-')) {
      return {
        ...matchedDefault,
        url: ensureHttpsUrl(matchedDefault.url) || matchedDefault.url,
        enabled: s.enabled,
      };
    }
    return {
      ...s,
      url: httpsUrl,
    };
  });

  const baseList: EpgSourceItem[] = [];
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();

  for (const defSrc of DEFAULT_EPG_SOURCES) {
    const existing = normalizedSources.find(
      (s) =>
        s.url.toLowerCase() === defSrc.url.toLowerCase() || s.id === defSrc.id
    );
    const merged: EpgSourceItem = existing
      ? {
          ...defSrc,
          enabled: existing.enabled,
        }
      : { ...defSrc };
    baseList.push(merged);
    seenIds.add(merged.id);
    seenUrls.add(merged.url.toLowerCase());
  }

  for (const s of normalizedSources) {
    const lowerUrl = s.url.toLowerCase();
    if (seenUrls.has(lowerUrl)) continue;
    let uniqueId = s.id;
    if (seenIds.has(uniqueId)) {
      uniqueId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }
    baseList.push({
      ...s,
      id: uniqueId,
    });
    seenIds.add(uniqueId);
    seenUrls.add(lowerUrl);
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
    // DE1, IT1, PL1 sont également activés pour le profil FR par défaut (Astra 19.2°E France/Allemagne + Hotbird 13°E Pologne/Italie)
    else if (u.includes('_de1')) {
      enabled =
        selectedBouquets.includes('sky_de') ||
        (tvProfile === 'france_europe_fr' &&
          selectedBouquets.includes('astra_canal_fr'));
    } else if (u.includes('_it1')) {
      enabled =
        selectedBouquets.includes('sky_it') ||
        (tvProfile === 'france_europe_fr' &&
          selectedBouquets.includes('hotbird_bis_fr'));
    } else if (u.includes('_pl1')) {
      enabled =
        selectedBouquets.includes('canal_pl') ||
        (tvProfile === 'france_europe_fr' &&
          selectedBouquets.includes('hotbird_bis_fr'));
    }
    // ES1 fournit Movistar+ (Astra 19.2°E) et TNT Abertis (Hispasat 30°W)
    else if (u.includes('_es1')) {
      enabled =
        selectedBouquets.includes('movistar_es') ||
        selectedBouquets.includes('hispasat_meo_nos');
    }
    // PT1 fournit MEO & NOS sur Hispasat 30°W (désactivé si le profil est strictement "Espagne")
    else if (u.includes('_pt1')) {
      enabled =
        tvProfile === 'espagne'
          ? false
          : selectedBouquets.includes('hispasat_meo_nos');
    }
    // BEIN1 fournit exclusivement Badr / Es'hailSat 26°E
    else if (u.includes('_bein1')) {
      enabled = selectedBouquets.includes('badr_bein_ssc');
    }
    // AE1 & SA1 fournissent Nilesat 7°W (MBC, OSN, Rotana)
    else if (u.includes('_ae1') || u.includes('_sa1')) {
      enabled = selectedBouquets.includes('nilesat_osn_mbc');
    }
    // SA2 fournit SSC Sports (Badr 26°E) et MBC Max / OSN Action (Nilesat 7°W)
    else if (u.includes('_sa2')) {
      enabled =
        selectedBouquets.includes('nilesat_osn_mbc') ||
        selectedBouquets.includes('badr_bein_ssc');
    }
    // BR1 fournit Star One 70°W (Claro TV Brasil)
    else if (u.includes('_br1')) {
      enabled = selectedBouquets.includes('starone_70w_claro_br');
    }
    // CL1 fournit Amazonas 61°W (Vivo TV & Movistar LATAM)
    else if (u.includes('_cl1')) {
      enabled = selectedBouquets.includes('amazonas_61w_latam');
    }
    // CO1 fournit SES-6 40.5°W / Intelsat 43.1°W (DirecTV LATAM, Sky Brasil, Oi TV)
    else if (u.includes('_co1')) {
      enabled = selectedBouquets.includes('intelsat_43w_directv');
    }

    // TR1 fournit le bouquet TRT Network (Türksat 42°E / Eutelsat 7°E)
    else if (u.includes('_tr1') || s.bouquetId === 'trt_network') {
      enabled = selectedBouquets.includes('trt_network');
    }
    // RS1 / HR1 fournissent Eutelsat 16°E (DigitAlb, Total TV, MAXtv, New World TV, Canal+ Réunion / Afrique)
    else if (u.includes('_rs1') || u.includes('_hr1') || u.includes('_al1') || u.includes('_bg1')) {
      enabled = activeBouquetsIncludes(selectedBouquets, 'eutelsat_16e_digitalb');
    }
    // RO1 / HU1 fournissent Thor 0.8°W / Intelsat 10-02 (Focus Sat, Direct One, Digi TV)
    else if (u.includes('_ro1') || u.includes('_hu1')) {
      enabled = activeBouquetsIncludes(selectedBouquets, 'thor_08w_focussat');
    }
    // UZ1 / TM1 fournissent TurkmenÄlem 52°E (Alem TV & Turkmenistan National TV)
    else if (u.includes('_uz1') || u.includes('_tm1')) {
      enabled = selectedBouquets.includes('turkmenalem_52e_alem');
    }
    // CY1 / IR1 fournissent MonacoSat 52°E (Persiana Media Group & Big Bang TV)
    else if (u.includes('_cy1') || u.includes('_ir1')) {
      enabled = selectedBouquets.includes('monacosat_52e_persiana');
    }

    return {
      ...s,
      bouquetId: bId,
      enabled,
    };
  });
}

function activeBouquetsIncludes(
  selectedBouquets: EpgBouquetId[],
  target: 'eutelsat_16e_digitalb' | 'thor_08w_focussat'
): boolean {
  return (
    selectedBouquets.includes(target) ||
    selectedBouquets.includes('eutelsat_16e_thor')
  );
}

export const PRESET_EPG_CATALOG: Omit<EpgSourceItem, 'id' | 'enabled'>[] = [
  ...DEFAULT_EPG_SOURCES.map(({ name, url, country, bouquetId }) => ({
    name,
    url,
    country,
    bouquetId,
  })),
];

function createSafeDefaultSettings(): AppSettings {
  try {
    const detected = detectInitialTvProfileFromSystemLanguage();
    return {
      language: detected.language,
      tvProfile: detected.tvProfile,
      sourceUrl: DEFAULT_EPG_SOURCE_URL,
      sources: syncSourcesWithSelectedBouquets(
        detected.selectedBouquets,
        DEFAULT_EPG_SOURCES,
        detected.tvProfile
      ),
      cacheTtlHours: 12,
      autoRefreshHours: 12,
      windowHours: 48,
      theme: 'dark',
      autoTimezone: true,
      manualTimezone: 'Africa/Casablanca',
      selectedBouquets: [...detected.selectedBouquets],
      excludePolishLektor: true,
      excludeNoSubtitles: true,
      enabledCategories: [...ALL_THEMATIC_CATEGORIES],
    };
  } catch {
    return {
      language: 'fr',
      tvProfile: 'france_europe_fr',
      sourceUrl: DEFAULT_EPG_SOURCE_URL,
      sources: [...DEFAULT_EPG_SOURCES],
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
  }
}

export const DEFAULT_SETTINGS: AppSettings = createSafeDefaultSettings();

export function buildSourcesSignature(
  sourcesOrSettings: EpgSourceItem[] | AppSettings
): string {
  const sources = Array.isArray(sourcesOrSettings)
    ? sourcesOrSettings
    : sourcesOrSettings.sources;
  const profilePart = Array.isArray(sourcesOrSettings)
    ? 'auto'
    : sourcesOrSettings.tvProfile || 'auto';
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
    `whitelist_v19|p:${profilePart}|` +
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
  const minKeepStopMs = nowMs - 24 * 3600 * 1000;
  const maxKeepStartMs = nowMs + 7 * 24 * 3600 * 1000;
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
      activeWindowList.length > 0 ? activeWindowList : rawList.slice(0, 48);
    pruned[cleanId] = finalList;
    if (chId !== cleanId) {
      pruned[chId] = finalList;
    }
  }

  return pruned;
}

/**
 * Garantit que chaque chaîne dispose d'une grille de programmes continue couvrant la date/heure
 * cible sélectionnée dans la Grille TV (quel que soit le jour choisi : hier, demain, J+2..J+7, etc.).
 */
export function ensureSchedulesCoverTargetTime(
  channels: EpgChannel[],
  schedulesByChannel: Record<string, EpgProgramme[]>,
  targetTimeMs: number
): Record<string, EpgProgramme[]> {
  if (!channels || channels.length === 0) return schedulesByChannel;

  const checkStartMs = targetTimeMs - 30 * 60 * 1000;
  const checkEndMs = targetTimeMs + 4 * 3600 * 1000;

  // Vérification rapide : si toutes les chaînes couvrent déjà la fenêtre cible, retourne directement la référence
  let needsProjection = false;
  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const cleanId = cleanXmltvChannelId(ch.id);
    const list = schedulesByChannel[cleanId] || schedulesByChannel[ch.id];
    const hasCoverage =
      Array.isArray(list) &&
      list.some(
        (p) =>
          p &&
          !isPlaceholderProgrammeTitle(p.title) &&
          p.stopMs > checkStartMs &&
          p.startMs < checkEndMs
      );
    if (!hasCoverage) {
      needsProjection = true;
      break;
    }
  }

  if (!needsProjection) {
    return schedulesByChannel;
  }

  const result: Record<string, EpgProgramme[]> = { ...schedulesByChannel };
  const genStartMs =
    Math.floor((targetTimeMs - 8 * 3600 * 1000) / (30 * 60 * 1000)) *
    (30 * 60 * 1000);
  const genEndMs = genStartMs + 32 * 3600 * 1000;
  const dayIndex = Math.round(targetTimeMs / (24 * 3600 * 1000));

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const cleanId = cleanXmltvChannelId(ch.id);
    const rawList = (
      schedulesByChannel[cleanId] ||
      schedulesByChannel[ch.id] ||
      []
    ).filter((p) => p && !isPlaceholderProgrammeTitle(p.title));

    const coveredInTargetWindow = rawList.filter(
      (p) => p.stopMs > checkStartMs && p.startMs < checkEndMs
    );

    // Si la chaîne couvre déjà au moins 3h sur les 4h de la fenêtre cible, on la conserve telle quelle
    const coveredDurationMs = coveredInTargetWindow.reduce((acc, p) => {
      const s = Math.max(p.startMs, checkStartMs);
      const e = Math.min(p.stopMs, checkEndMs);
      return acc + Math.max(0, e - s);
    }, 0);

    if (coveredDurationMs >= 2.5 * 3600 * 1000) {
      continue;
    }

    const donorPool: EpgProgramme[] =
      rawList.length > 0
        ? rawList
        : [
            {
              id: `${cleanId}_default_0`,
              channelId: cleanId,
              title:
                ch.contentCategory === 'Sport / Football'
                  ? `Direct Sport & Football : ${ch.displayName}`
                  : ch.contentCategory === 'Actualités / News'
                  ? `Édition Spéciale & Information : ${ch.displayName}`
                  : ch.contentCategory === 'Documentaires'
                  ? `Grand Documentaire Découverte : ${ch.displayName}`
                  : ch.contentCategory === 'Jeunesse / Enfants'
                  ? `Univers Jeunesse & Animation : ${ch.displayName}`
                  : `Grand Écran & Séries : ${ch.displayName}`,
              subTitle: 'Diffusion Haute Définition',
              description: `Programme diffusé sur ${ch.displayName} (${ch.orbitalPosition}).`,
              category: ch.contentCategory || 'Films & Séries',
              rawCategory: ch.contentCategory || 'Films & Séries',
              group: ch.group,
              startMs: genStartMs,
              stopMs: genStartMs + 90 * 60 * 1000,
              hasOriginalAudioVO: true,
              hasSubtitles: true,
            },
          ];

    const rotationOffset =
      Math.abs(dayIndex * 5 + i * 3 + cleanId.length) % donorPool.length;
    const projected: EpgProgramme[] = [];
    let cursorMs = genStartMs;
    let slotIdx = 0;

    while (cursorMs < genEndMs) {
      const donor =
        donorPool[(slotIdx + rotationOffset) % donorPool.length];
      const rawDuration = donor.stopMs - donor.startMs;
      const roundedDuration =
        Math.round(rawDuration / (15 * 60 * 1000)) * (15 * 60 * 1000);
      const durationMs = Math.max(
        45 * 60 * 1000,
        Math.min(150 * 60 * 1000, roundedDuration || 90 * 60 * 1000)
      );
      const stopMs = cursorMs + durationMs;

      projected.push({
        ...donor,
        id: `${cleanId}_proj_${cursorMs}_${slotIdx}`,
        channelId: cleanId,
        startMs: cursorMs,
        stopMs,
      });

      cursorMs = stopMs;
      slotIdx++;
    }

    // Fusion sans chevauchement avec les programmes existants hors de la plage projetée
    const nonOverlappingExisting = rawList.filter(
      (p) => p.stopMs <= genStartMs || p.startMs >= genEndMs
    );
    const merged = [...nonOverlappingExisting, ...projected].sort(
      (a, b) => a.startMs - b.startMs
    );

    result[cleanId] = merged;
    if (ch.id !== cleanId) {
      result[ch.id] = merged;
    }
  }

  return result;
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
  const filteredChannels = channels
    .filter((ch) => !isAdultChannel(ch.id, ch.displayName))
    .map((ch) => ({
      ...ch,
      icon: resolveOfficialChannelLogoUrl(
        ch.id,
        ch.displayName,
        ensureHttpsUrl(ch.icon)
      ),
      url: ensureHttpsUrl(ch.url),
    }));
  const sanitizedMetadata: EpgCacheMetadata = {
    ...metadata,
    sourceUrl: ensureHttpsUrl(metadata.sourceUrl) || metadata.sourceUrl,
  };

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_META_KEY, JSON.stringify(sanitizedMetadata));
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
      metadata: sanitizedMetadata,
      channels: filteredChannels,
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

export async function loadEpgFromCache(
  settings?: AppSettings
): Promise<StoredEpgSnapshot | null> {
  try {
    const effectiveSettings = settings || loadAppSettings();
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
          const sanitizedChannels: EpgChannel[] = result.channels
            .filter((ch) => !isAdultChannel(ch.id, ch.displayName))
            .map((ch) => {
              const isTrtChannel =
                ch.bouquetId === 'trt_network' ||
                ch.bouquets?.includes('TRT Network') ||
                /\.tr$/i.test(ch.id || '');
              return {
                ...ch,
                icon: resolveOfficialChannelLogoUrl(
                  ch.id,
                  ch.displayName,
                  ensureHttpsUrl(ch.icon)
                ),
                url: ensureHttpsUrl(ch.url),
                displayName: cleanOfficialChannelName(ch.displayName),
                satellites: (isTrtChannel
                  ? ['Türksat 42°E', 'Türksat 42°E / Eutelsat 7°E']
                  : (ch.satellites || []).filter(
                      (s) =>
                        s !== 'Türksat 42°E' &&
                        s !== 'Türksat 42°E / Eutelsat 7°E'
                    )) as EpgChannel['satellites'],
                orbitalPosition: isTrtChannel
                  ? 'Türksat 42°E / Eutelsat 7°E'
                  : normalizeSingleOrbitalPosition(
                      ch.orbitalPosition,
                      ch.satellites
                    ),
              };
            })
            .filter((ch) => isChannelAllowedBySettings(ch, effectiveSettings));

          const chMap = new Map<string, EpgChannel>();
          for (const ch of sanitizedChannels) {
            chMap.set(ch.id, ch);
          }
          supplementSatelliteBouquetsCoverage(
            chMap,
            prunedSchedules,
            {
              tvProfile: effectiveSettings.tvProfile,
              selectedBouquets: effectiveSettings.selectedBouquets,
              excludePolishLektor: effectiveSettings.excludePolishLektor,
              excludeNoSubtitles: effectiveSettings.excludeNoSubtitles,
              enabledCategories: effectiveSettings.enabledCategories,
            },
            effectiveSettings.selectedBouquets
          );

          const filteredProfileChannels = Array.from(chMap.values()).filter(
            (ch) => isChannelAllowedBySettings(ch, effectiveSettings)
          );
          const allowedIds = new Set(
            filteredProfileChannels.flatMap((ch) => [
              ch.id,
              cleanXmltvChannelId(ch.id),
            ])
          );
          const profileSchedules: Record<string, EpgProgramme[]> = {};
          for (const chId of Object.keys(prunedSchedules)) {
            if (allowedIds.has(chId) || allowedIds.has(cleanXmltvChannelId(chId))) {
              profileSchedules[chId] = prunedSchedules[chId];
            }
          }

          resolve({
            ...result,
            metadata: {
              ...result.metadata,
              sourceUrl:
                ensureHttpsUrl(result.metadata.sourceUrl) ||
                result.metadata.sourceUrl,
              channelCount: filteredProfileChannels.length,
            },
            channels: filteredProfileChannels,
            schedulesByChannel: profileSchedules,
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

export function buildOfflineFallbackEpgSnapshot(
  settings: AppSettings
): StoredEpgSnapshot {
  const chMap = new Map<string, EpgChannel>();
  const rawSchedulesByChannel: Record<string, EpgProgramme[]> = {};
  supplementSatelliteBouquetsCoverage(
    chMap,
    rawSchedulesByChannel,
    {
      tvProfile: settings.tvProfile,
      selectedBouquets: settings.selectedBouquets,
      excludePolishLektor: settings.excludePolishLektor,
      excludeNoSubtitles: settings.excludeNoSubtitles,
      enabledCategories: settings.enabledCategories,
    },
    settings.selectedBouquets
  );
  const channels = Array.from(chMap.values())
    .filter((ch) => isChannelAllowedBySettings(ch, settings))
    .map((ch, idx) => ({
      ...ch,
      icon: ensureHttpsUrl(ch.icon),
      url: ensureHttpsUrl(ch.url),
      channelNumber: idx + 1,
      programmeCount: (rawSchedulesByChannel[ch.id] || []).length,
    }));
  const schedulesByChannel: Record<string, EpgProgramme[]> = {};
  for (const ch of channels) {
    const cleanId = cleanXmltvChannelId(ch.id);
    const list = rawSchedulesByChannel[cleanId] || rawSchedulesByChannel[ch.id] || [];
    schedulesByChannel[cleanId] = list;
    if (ch.id !== cleanId) {
      schedulesByChannel[ch.id] = list;
    }
  }
  const programmeCount = Object.values(schedulesByChannel).reduce(
    (sum, list) => sum + list.length,
    0
  );
  const now = Date.now();
  return {
    id: SNAPSHOT_KEY,
    metadata: {
      sourceUrl: DEFAULT_EPG_SOURCE_URL,
      sourcesSignature: buildSourcesSignature(settings),
      lastUpdatedMs: now,
      expiresAtMs: now + settings.cacheTtlHours * 3600 * 1000,
      channelCount: channels.length,
      channelsExcludedCount: 0,
      programmeCount,
      compressedBytes: 0,
      uncompressedBytes: 0,
      minTimestampMs: now - 4 * 3600 * 1000,
      maxTimestampMs: now + 32 * 3600 * 1000,
      parseDurationMs: 15,
    },
    channels,
    schedulesByChannel,
  };
}

export function buildOfflineFallbackEpgSnapshotAsync(
  settings: AppSettings
): Promise<StoredEpgSnapshot> {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        resolve(buildOfflineFallbackEpgSnapshot(settings));
      } catch {
        const now = Date.now();
        resolve({
          id: SNAPSHOT_KEY,
          metadata: {
            sourceUrl: DEFAULT_EPG_SOURCE_URL,
            sourcesSignature: 'fallback_empty',
            lastUpdatedMs: now,
            expiresAtMs: now + 12 * 3600 * 1000,
            channelCount: 0,
            channelsExcludedCount: 0,
            programmeCount: 0,
            compressedBytes: 0,
            uncompressedBytes: 0,
            minTimestampMs: now,
            maxTimestampMs: now + 24 * 3600 * 1000,
            parseDurationMs: 0,
          },
          channels: [],
          schedulesByChannel: {},
        });
      }
    }, 0);
  });
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

type CapacitorPreferencesPlugin = {
  get?: (opts: { key: string }) => Promise<{ value: string | null }>;
  set?: (opts: { key: string; value: string }) => Promise<void>;
};

function getCapacitorPreferencesPlugin(): CapacitorPreferencesPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (
    window as unknown as {
      Capacitor?: {
        Plugins?: {
          Preferences?: CapacitorPreferencesPlugin;
          Storage?: CapacitorPreferencesPlugin;
        };
      };
    }
  ).Capacitor;
  return cap?.Plugins?.Preferences || cap?.Plugins?.Storage || null;
}

export function persistSettingsToCapacitorPreferences(
  settings: AppSettings
): void {
  const prefs = getCapacitorPreferencesPlugin();
  if (!prefs?.set) return;
  const profileId =
    settings.tvProfile ||
    inferTvProfileFromBouquets(settings.selectedBouquets);
  void prefs
    .set({ key: LS_TV_PROFILE_KEY, value: profileId })
    .catch(() => undefined);
  void prefs
    .set({ key: LS_SETTINGS_KEY, value: JSON.stringify(settings) })
    .catch(() => undefined);
}

export async function syncAppSettingsFromCapacitorPreferences(): Promise<AppSettings | null> {
  const prefs = getCapacitorPreferencesPlugin();
  if (!prefs?.get) return null;
  try {
    const [profileRes, settingsRes] = await Promise.all([
      prefs.get({ key: LS_TV_PROFILE_KEY }),
      prefs.get({ key: LS_SETTINGS_KEY }),
    ]);
    if (settingsRes?.value) {
      const parsed = JSON.parse(settingsRes.value) as Partial<AppSettings>;
      if (parsed && Array.isArray(parsed.selectedBouquets)) {
        const storedLocal = localStorage.getItem(LS_TV_PROFILE_KEY);
        if (!storedLocal && profileRes?.value) {
          localStorage.setItem(LS_TV_PROFILE_KEY, profileRes.value);
          localStorage.setItem(LS_SETTINGS_KEY, settingsRes.value);
          return loadAppSettings();
        }
      }
    } else {
      // Sauvegarder la configuration initiale détectée dans Capacitor Preferences
      const current = loadAppSettings();
      persistSettingsToCapacitorPreferences(current);
    }
  } catch {
    // Ignore Capacitor bridge error
  }
  return null;
}

function safeLocalStorageGet(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch {
    // Ignore storage access error on restricted WebViews
  }
  return null;
}

function safeLocalStorageSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch {
    // Ignore storage quota/security error on restricted WebViews
  }
}

export function loadAppSettingsAsync(): Promise<AppSettings> {
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        resolve(loadAppSettings());
      } catch {
        resolve(DEFAULT_SETTINGS);
      }
    }, 0);
  });
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = safeLocalStorageGet(LS_SETTINGS_KEY);
    const storedProfileRaw = safeLocalStorageGet(LS_TV_PROFILE_KEY) as
      | TvProfileId
      | null;
    const strictV12Migrated =
      safeLocalStorageGet(LS_STRICT_PROFILE_V12_MIGRATED_KEY) === '1';

    // 1. Tout premier lancement (ou migration vers le filtrage strict à 2-3 satellites max au démarrage) :
    // Détection automatique basée sur navigator.language et sauvegarde immédiate
    if (!raw || !storedProfileRaw || !strictV12Migrated) {
      const detected = detectInitialTvProfileFromSystemLanguage();
      let existingParsed: Partial<AppSettings> = {};
      if (raw) {
        try {
          existingParsed = (JSON.parse(raw) as Partial<AppSettings>) || {};
        } catch {
          existingParsed = {};
        }
      }

      const initialSettings: AppSettings = {
        ...DEFAULT_SETTINGS,
        ...existingParsed,
        language: detected.language,
        tvProfile: detected.tvProfile,
        selectedBouquets: [...detected.selectedBouquets],
        sources: syncSourcesWithSelectedBouquets(
          detected.selectedBouquets,
          DEFAULT_EPG_SOURCES,
          detected.tvProfile
        ),
        enabledCategories: [...ALL_THEMATIC_CATEGORIES],
      };

      safeLocalStorageSet(LS_TV_PROFILE_KEY, detected.tvProfile);
      safeLocalStorageSet(LS_STRICT_PROFILE_V12_MIGRATED_KEY, '1');
      safeLocalStorageSet(LS_TZ_CASA_MIGRATED_KEY, '1');
      safeLocalStorageSet(LS_BOUQUETS_V8_MIGRATED_KEY, '1');
      safeLocalStorageSet(LS_BOUQUETS_V10_MIGRATED_KEY, '1');
      safeLocalStorageSet(LS_BOUQUETS_V11_MIGRATED_KEY, '1');
      safeLocalStorageSet(LS_CATEGORIES_V9_MIGRATED_KEY, '1');
      safeLocalStorageSet(LS_SETTINGS_KEY, JSON.stringify(initialSettings));
      try {
        persistSettingsToCapacitorPreferences(initialSettings);
      } catch {
        // Ignore Capacitor bridge error
      }

      try {
        configureActiveTimezone(
          initialSettings.autoTimezone,
          initialSettings.manualTimezone
        );
        applyDocumentLanguageDir(initialSettings.language);
      } catch {
        // Ignore DOM/Timezone errors
      }
      return initialSettings;
    }

    let parsed: Partial<AppSettings> = {};
    try {
      parsed = (JSON.parse(raw) as Partial<AppSettings>) || {};
    } catch {
      parsed = {};
    }

    const tzMigrated = safeLocalStorageGet(LS_TZ_CASA_MIGRATED_KEY) === '1';
    if (!tzMigrated) {
      parsed.manualTimezone = 'Africa/Casablanca';
      parsed.autoTimezone = true;
      safeLocalStorageSet(LS_TZ_CASA_MIGRATED_KEY, '1');
    }

    const v9CatsMigrated =
      safeLocalStorageGet(LS_CATEGORIES_V9_MIGRATED_KEY) === '1';

    const sanitizedSources = Array.isArray(parsed.sources)
      ? parsed.sources.filter(
          (s) =>
            s &&
            typeof s.url === 'string' &&
            (s.country as string) !== 'GR' &&
            !s.url.toLowerCase().includes('epg_ripper_gr')
        )
      : [];

    const activeProfile: TvProfileId =
      parsed.tvProfile || storedProfileRaw || 'maghreb_mena';

    const rawSelectedBouquets = Array.isArray(parsed.selectedBouquets)
      ? parsed.selectedBouquets.flatMap((b): EpgBouquetId[] =>
          b === 'eutelsat_16e_thor'
            ? ['eutelsat_16e_digitalb', 'thor_08w_focussat']
            : [b]
        )
      : [];

    const isPremiumSession = isStoredSessionPremium();
    const deduplicatedBouquets =
      rawSelectedBouquets.length > 0
        ? Array.from(
            new Set(
              rawSelectedBouquets.filter((b) => ALL_BOUQUET_IDS.includes(b))
            )
          )
        : getBouquetsForTvProfile(activeProfile, isPremiumSession);

    const validSelectedBouquets = isPremiumSession
      ? deduplicatedBouquets
      : deduplicatedBouquets.slice(0, MAX_ACTIVE_BOUQUETS_STRICT);

    const resolvedProfile = inferTvProfileFromBouquets(
      validSelectedBouquets,
      activeProfile
    );

    const baseSources =
      sanitizedSources.length > 0 ? sanitizedSources : DEFAULT_EPG_SOURCES;

    const sources = syncSourcesWithSelectedBouquets(
      baseSources,
      validSelectedBouquets,
      resolvedProfile
    );

    const enabledCategories =
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
      safeLocalStorageSet(LS_CATEGORIES_V9_MIGRATED_KEY, '1');
    }

    const validLang: AppLanguage = SUPPORTED_LANGUAGES.some(
      (l) => l.code === parsed.language
    )
      ? (parsed.language as AppLanguage)
      : DEFAULT_SETTINGS.language;

    const loaded: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      tvProfile: resolvedProfile,
      sourceUrl:
        ensureHttpsUrl(parsed.sourceUrl) || DEFAULT_SETTINGS.sourceUrl,
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

    try {
      configureActiveTimezone(loaded.autoTimezone, loaded.manualTimezone);
      applyDocumentLanguageDir(loaded.language);
    } catch {
      // Ignore
    }
    return loaded;
  } catch {
    try {
      configureActiveTimezone(
        DEFAULT_SETTINGS.autoTimezone,
        DEFAULT_SETTINGS.manualTimezone
      );
      applyDocumentLanguageDir(DEFAULT_SETTINGS.language);
    } catch {
      // Ignore
    }
    return DEFAULT_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    const resolvedProfile =
      settings.tvProfile ||
      inferTvProfileFromBouquets(settings.selectedBouquets);
    const sanitized: AppSettings = {
      ...settings,
      tvProfile: resolvedProfile,
      sourceUrl:
        ensureHttpsUrl(settings.sourceUrl) || DEFAULT_SETTINGS.sourceUrl,
      sources: settings.sources.map((s) => ({
        ...s,
        url: ensureHttpsUrl(s.url) || s.url.trim(),
      })),
    };
    configureActiveTimezone(sanitized.autoTimezone, sanitized.manualTimezone);
    applyDocumentLanguageDir(sanitized.language || 'fr');
    localStorage.setItem(LS_TV_PROFILE_KEY, resolvedProfile);
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(sanitized));
    persistSettingsToCapacitorPreferences(sanitized);
  } catch {
    // Ignore
  }
}

const FAVORITES_DB_KEY = 'global_favorites_room_v1';

export function loadFavoriteChannels(): string[] {
  try {
    const raw = localStorage.getItem(LS_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return Array.from(
      new Set(
        parsed
          .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
          .map((id) => id.trim())
      )
    );
  } catch {
    return [];
  }
}

export function saveFavoriteChannels(channelIds: string[]): void {
  const deduplicated = Array.from(
    new Set(
      channelIds
        .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
        .map((id) => id.trim())
    )
  );
  try {
    localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(deduplicated));
  } catch {
    // Ignore LocalStorage quota error
  }

  // Synchronisation asynchrone en base locale (IndexedDB / Room DB Web)
  void (async () => {
    try {
      const db = await openDatabase();
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE);
      store.put({
        id: FAVORITES_DB_KEY,
        channelIds: deduplicated,
        updatedAtMs: Date.now(),
      });
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    } catch {
      // Ignore IndexedDB error
    }
  })();
}

export async function syncGlobalFavoritesFromDb(): Promise<string[]> {
  const localFavs = loadFavoriteChannels();
  try {
    const db = await openDatabase();
    const dbFavs = await new Promise<string[]>((resolve) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
      const store = tx.objectStore(SNAPSHOT_STORE);
      const req = store.get(FAVORITES_DB_KEY);
      req.onsuccess = () => {
        db.close();
        const res = req.result as { channelIds?: string[] } | undefined;
        resolve(Array.isArray(res?.channelIds) ? res.channelIds : []);
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });

    if (localFavs.length === 0 && dbFavs.length > 0) {
      try {
        localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(dbFavs));
      } catch {
        // Ignore
      }
      return dbFavs;
    }
    if (localFavs.length > 0 && dbFavs.length === 0) {
      saveFavoriteChannels(localFavs);
    }
    return localFavs;
  } catch {
    return localFavs;
  }
}

/**
 * Garantit que toutes les chaînes favorites globales sont disponibles avec leur grille EPG
 * peu importe leur satellite ou bouquet d'origine (même si le bouquet d'origine est désactivé).
 */
export function resolveGlobalFavoriteChannels(
  allChannels: EpgChannel[],
  schedulesByChannel: Record<string, EpgProgramme[]>,
  favoriteIds: string[]
): {
  favoriteChannels: EpgChannel[];
  supplementedSchedules: Record<string, EpgProgramme[]>;
} {
  if (favoriteIds.length === 0) {
    return { favoriteChannels: [], supplementedSchedules: schedulesByChannel };
  }

  const favCleanSet = new Set(
    favoriteIds.flatMap((id) => [id, cleanXmltvChannelId(id)])
  );

  const chMap = new Map<string, EpgChannel>();
  for (const ch of allChannels) {
    chMap.set(ch.id, ch);
  }

  const nextSchedules: Record<string, EpgProgramme[]> = { ...schedulesByChannel };
  // Injecte aussi toutes les chaînes de référence (tous satellites/bouquets confondus)
  // au cas où une chaîne favorite provient d'un bouquet non actif dans Settings
  supplementSatelliteBouquetsCoverage(chMap, nextSchedules);

  const favoriteChannels: EpgChannel[] = [];
  for (const ch of chMap.values()) {
    const cleanId = cleanXmltvChannelId(ch.id);
    if (favCleanSet.has(ch.id) || favCleanSet.has(cleanId)) {
      favoriteChannels.push(ch);
    }
  }

  return {
    favoriteChannels,
    supplementedSchedules: nextSchedules,
  };
}

export function loadReminders(): ProgrammeReminder[] {
  try {
    const raw = localStorage.getItem(LS_REMINDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as ProgrammeReminder[]).sort((a, b) => a.startMs - b.startMs);
  } catch {
    return [];
  }
}

export function saveReminders(reminders: ProgrammeReminder[]): void {
  const sorted = [...reminders].sort((a, b) => a.startMs - b.startMs);
  try {
    localStorage.setItem(LS_REMINDERS_KEY, JSON.stringify(sorted));
  } catch {
    // Ignore
  }
  void (async () => {
    try {
      const cap = getCapacitorPreferencesPlugin();
      if (cap?.set) {
        await cap.set({
          key: LS_REMINDERS_KEY,
          value: JSON.stringify(sorted),
        });
      }
    } catch {
      // Ignore Capacitor bridge error
    }
  })();
}

export function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(LS_RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
      .slice(0, MAX_RECENT_SEARCHES);
  } catch {
    return [];
  }
}

export function saveRecentSearches(searches: string[]): void {
  try {
    const sanitized = searches
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((item) => item.trim())
      .slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(LS_RECENT_SEARCHES_KEY, JSON.stringify(sanitized));
  } catch {
    // Ignore
  }
}

export function addRecentSearch(
  query: string,
  existing?: string[],
  replaceFirstIfPrefix = false
): string[] {
  const trimmed = query.trim();
  if (!trimmed) return existing ?? loadRecentSearches();

  const current = existing ? [...existing] : loadRecentSearches();
  const lower = trimmed.toLowerCase();

  if (
    replaceFirstIfPrefix &&
    current.length > 0 &&
    (lower.startsWith(current[0].toLowerCase()) ||
      current[0].toLowerCase().startsWith(lower))
  ) {
    const withoutRest = current
      .slice(1)
      .filter((item) => item.toLowerCase() !== lower);
    const updated = [trimmed, ...withoutRest].slice(0, MAX_RECENT_SEARCHES);
    saveRecentSearches(updated);
    return updated;
  }

  const filtered = current.filter((item) => item.toLowerCase() !== lower);
  const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES);
  saveRecentSearches(updated);
  return updated;
}

export function removeRecentSearch(
  queryToRemove: string,
  existing?: string[]
): string[] {
  const current = existing ? [...existing] : loadRecentSearches();
  const lower = queryToRemove.trim().toLowerCase();
  const updated = current.filter((item) => item.toLowerCase() !== lower);
  saveRecentSearches(updated);
  return updated;
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(LS_RECENT_SEARCHES_KEY);
  } catch {
    // Ignore
  }
}

// ============================================================================
// TRI INTELLIGENT ANDROID TV BOX (FRÉQUENCE DE VISIONNAGE + ORDRE LCN OFFICIEL)
// ============================================================================

export type TvSortMode = 'lcn' | 'smart' | 'alpha_asc' | 'alpha_desc' | 'genre';

export interface ChannelWatchHabit {
  channelId: string;
  viewCount: number;
  dwellSeconds: number;
  lastViewedAtMs: number;
}

const LS_TV_SORT_MODE_KEY = 'pulseepg_tv_sort_mode_v1';
const LS_CHANNEL_WATCH_HABITS_KEY = 'pulseepg_tv_channel_watch_habits_v1';

export function loadTvSortMode(): TvSortMode {
  try {
    if (typeof localStorage === 'undefined') return 'lcn';
    const raw = localStorage.getItem(LS_TV_SORT_MODE_KEY);
    if (
      raw === 'lcn' ||
      raw === 'smart' ||
      raw === 'alpha_asc' ||
      raw === 'alpha_desc' ||
      raw === 'genre'
    ) {
      return raw;
    }
    return 'lcn';
  } catch {
    return 'lcn';
  }
}

export function saveTvSortMode(mode: TvSortMode): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_TV_SORT_MODE_KEY, mode);
    }
  } catch {
    // Ignore
  }
}

export function loadChannelWatchHabits(): Record<string, ChannelWatchHabit> {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(LS_CHANNEL_WATCH_HABITS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, ChannelWatchHabit>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

export function saveChannelWatchHabits(
  habits: Record<string, ChannelWatchHabit>
): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_CHANNEL_WATCH_HABITS_KEY, JSON.stringify(habits));
    }
  } catch {
    // Ignore quota error
  }
  void (async () => {
    try {
      const cap = getCapacitorPreferencesPlugin();
      if (cap?.set) {
        await cap.set({
          key: LS_CHANNEL_WATCH_HABITS_KEY,
          value: JSON.stringify(habits),
        });
      }
    } catch {
      // Ignore Capacitor bridge error
    }
  })();
}

export function recordChannelViewHabit(
  channelId: string,
  options?: {
    viewIncrement?: number;
    dwellSecondsIncrement?: number;
    existing?: Record<string, ChannelWatchHabit>;
  }
): Record<string, ChannelWatchHabit> {
  const cleanId = cleanXmltvChannelId(channelId);
  if (!cleanId) return options?.existing ?? loadChannelWatchHabits();

  const current = options?.existing
    ? { ...options.existing }
    : loadChannelWatchHabits();
  const prev = current[cleanId] ||
    current[channelId] || {
      channelId: cleanId,
      viewCount: 0,
      dwellSeconds: 0,
      lastViewedAtMs: 0,
    };

  const viewInc = options?.viewIncrement ?? 1;
  const dwellInc = options?.dwellSecondsIncrement ?? 0;

  const updatedEntry: ChannelWatchHabit = {
    channelId: cleanId,
    viewCount: Math.round((prev.viewCount + viewInc) * 100) / 100,
    dwellSeconds: Math.max(0, Math.round(prev.dwellSeconds + dwellInc)),
    lastViewedAtMs: Date.now(),
  };

  current[cleanId] = updatedEntry;
  if (channelId !== cleanId) {
    current[channelId] = updatedEntry;
  }

  saveChannelWatchHabits(current);
  return current;
}

export function clearChannelWatchHabits(): Record<string, ChannelWatchHabit> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LS_CHANNEL_WATCH_HABITS_KEY);
    }
  } catch {
    // Ignore
  }
  return {};
}

/**
 * Calcule le score hybride pour le 'Tri intelligent' sur Android TV Box :
 * Combine la fréquence de visionnage (ouvertures, durée de consultation, récence,
 * affinité favoris/rappels) avec l'ordre LCN officiel du bouquet/satellite.
 */
export function computeSmartChannelSortScore(
  channelId: string,
  lcn: number,
  habits: Record<string, ChannelWatchHabit>,
  options?: {
    isFavorite?: boolean;
    hasReminder?: boolean;
    nowMs?: number;
  }
): {
  hasHabit: boolean;
  habitScore: number;
  hybridRank: number;
  viewCount: number;
} {
  const cleanId = cleanXmltvChannelId(channelId);
  const entry = habits[cleanId] || habits[channelId];
  const now = options?.nowMs ?? Date.now();

  const rawViews = entry?.viewCount ?? 0;
  const dwellMins = (entry?.dwellSeconds ?? 0) / 60;
  const ageDays =
    entry?.lastViewedAtMs && entry.lastViewedAtMs > 0
      ? Math.max(0, (now - entry.lastViewedAtMs) / 86400000)
      : 30;

  // Pondération de récence douce sur 14 jours (conserve au moins 55% du poids historique)
  const recencyFactor =
    rawViews > 0 ? 0.55 + 0.45 * Math.exp(-ageDays / 14) : 0;

  const frequencyPoints = rawViews * 14 * recencyFactor;
  const dwellPoints = Math.min(dwellMins, 45) * 3.5;
  const favBonus = options?.isFavorite ? 22 : 0;
  const reminderBonus = options?.hasReminder ? 12 : 0;

  const habitScore =
    Math.round((frequencyPoints + dwellPoints + favBonus + reminderBonus) * 10) /
    10;
  const hasHabit = habitScore > 0;

  // Combinaison hybride :
  // - Chaque point d'habitude remonte prioritairement la chaîne selon sa fréquence de visionnage
  // - À fréquence similaire, l'ordre LCN officiel départage naturellement les chaînes (poids LCN progressif)
  // - Les chaînes non visionnées conservent strictement leur ordre LCN officiel
  const safeLcn = Number.isFinite(lcn) && lcn > 0 ? lcn : 9999;
  const hybridRank = hasHabit
    ? -10000 - habitScore * 25 + safeLcn * 0.15
    : safeLcn;

  return {
    hasHabit,
    habitScore,
    hybridRank,
    viewCount: Math.ceil(rawViews),
  };
}

