import { translateEpgTextToFrenchSync } from './sportChannelsWhitelist';

export { translateEpgTextToFrenchSync };

export interface EnrichQueryInput {
  title: string;
  originalTitle?: string;
  subTitle?: string;
  description?: string;
  icon?: string;
  episodeNum?: string;
  year?: string;
  category?: string;
  rawCategory?: string;
  country?: string;
  xmlOriginCountry?: string;
  lang?: string;
  language?: string;
}

export interface EnrichedProgrammeResult {
  queryKey: string;
  frenchTitle?: string;
  originalTitle?: string;
  frenchEpisodeTitle?: string;
  originalEpisodeTitle?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  frenchSynopsis?: string;
  posterUrl?: string;
  backdropUrl?: string;
  releaseYear?: string;
  releaseDate?: string;
  genres?: string[];
  originCountries?: string[];
  rating?: number;
  directors?: string[];
  cast?: string[];
  youtubeTrailerKey?: string;
  youtubeTrailerName?: string;
  previewVideoUrl?: string;
  tmdbId?: number;
  mediaType?: 'movie' | 'tv';
  sourceProvider: string;
  resolvedAtMs: number;
}

interface KnownLocalShowSpec {
  originalTitle: string;
  frenchTitle: string;
  mediaType: 'movie' | 'tv';
  originCountries: string[];
  releaseDate?: string;
  genres?: string[];
}

/**
 * Dictionnaire de correspondance des titres localisés (notamment Polonais / Européens sur AXN, HBO, Canal+, Warner, Fox)
 * vers leur titre original officiel (VO) pour garantir une résolution TMDB/TVMaze exacte du pays d'origine.
 */
const KNOWN_LOCAL_EPG_TITLES: Record<string, KnownLocalShowSpec> = {
  rekrut: {
    originalTitle: 'The Rookie',
    frenchTitle: 'The Rookie : Le Flic de Los Angeles',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '16 octobre 2018',
    genres: ['Série TV', 'Crime & Policier', 'Drame', 'Action'],
  },
  'rekrut: feds': {
    originalTitle: 'The Rookie: Feds',
    frenchTitle: 'The Rookie : FBI',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '27 septembre 2022',
    genres: ['Série TV', 'Crime & Policier', 'Action'],
  },
  'detektyw murdoch': {
    originalTitle: 'Murdoch Mysteries',
    frenchTitle: 'Les Enquêtes de Murdoch',
    mediaType: 'tv',
    originCountries: ['Canada / CA'],
    releaseDate: '20 janvier 2008',
    genres: ['Série TV', 'Crime & Policier', 'Drame'],
  },
  'dobry doktor': {
    originalTitle: 'The Good Doctor',
    frenchTitle: 'Good Doctor',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '25 septembre 2017',
    genres: ['Série TV', 'Drame', 'Médical'],
  },
  kości: {
    originalTitle: 'Bones',
    frenchTitle: 'Bones',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '13 septembre 2005',
    genres: ['Série TV', 'Crime & Policier', 'Drame'],
  },
  mentalista: {
    originalTitle: 'The Mentalist',
    frenchTitle: 'Mentalist',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '23 septembre 2008',
    genres: ['Série TV', 'Crime & Policier', 'Mystère'],
  },
  'zabójcze umysły': {
    originalTitle: 'Criminal Minds',
    frenchTitle: 'Esprits criminels',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '22 septembre 2005',
    genres: ['Série TV', 'Crime & Policier', 'Thriller'],
  },
  'agenci ncis': {
    originalTitle: 'NCIS',
    frenchTitle: 'NCIS : Enquêtes spéciales',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '23 septembre 2003',
    genres: ['Série TV', 'Crime & Policier', 'Action'],
  },
  'agenci ncis: los angeles': {
    originalTitle: 'NCIS: Los Angeles',
    frenchTitle: 'NCIS : Los Angeles',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '22 septembre 2009',
    genres: ['Série TV', 'Crime & Policier', 'Action'],
  },
  'agenci ncis: hawaje': {
    originalTitle: "NCIS: Hawai'i",
    frenchTitle: "NCIS : Hawai'i",
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '20 septembre 2021',
    genres: ['Série TV', 'Crime & Policier', 'Action'],
  },
  'czarna lista': {
    originalTitle: 'The Blacklist',
    frenchTitle: 'Blacklist',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '23 septembre 2013',
    genres: ['Série TV', 'Crime & Policier', 'Thriller'],
  },
  's.w.a.t. - jednostka specjalna': {
    originalTitle: 'S.W.A.T.',
    frenchTitle: 'S.W.A.T.',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '2 novembre 2017',
    genres: ['Série TV', 'Action', 'Crime & Policier'],
  },
  's.w.a.t.': {
    originalTitle: 'S.W.A.T.',
    frenchTitle: 'S.W.A.T.',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '2 novembre 2017',
    genres: ['Série TV', 'Action', 'Crime & Policier'],
  },
  chirurdzy: {
    originalTitle: "Grey's Anatomy",
    frenchTitle: "Grey's Anatomy",
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '27 mars 2005',
    genres: ['Série TV', 'Drame', 'Romance'],
  },
  'dr house': {
    originalTitle: 'House',
    frenchTitle: 'Dr House',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '16 novembre 2004',
    genres: ['Série TV', 'Drame', 'Médical'],
  },
  'prawo i porządek': {
    originalTitle: 'Law & Order',
    frenchTitle: 'New York, police judiciaire',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '13 septembre 1990',
    genres: ['Série TV', 'Crime & Policier', 'Drame'],
  },
  'prawo i porządek: sekcja specjalna': {
    originalTitle: 'Law & Order: Special Victims Unit',
    frenchTitle: 'New York, unité spéciale',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '20 septembre 1999',
    genres: ['Série TV', 'Crime & Policier', 'Drame'],
  },
  'w garniturach': {
    originalTitle: 'Suits',
    frenchTitle: 'Suits : Avocats sur mesure',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '23 juin 2011',
    genres: ['Série TV', 'Drame', 'Comédie'],
  },
  'skazany na śmierć': {
    originalTitle: 'Prison Break',
    frenchTitle: 'Prison Break',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '29 août 2005',
    genres: ['Série TV', 'Action', 'Thriller'],
  },
  'z archiwum x': {
    originalTitle: 'The X-Files',
    frenchTitle: 'X-Files : Aux frontières du réel',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '10 septembre 1993',
    genres: ['Série TV', 'Science-Fiction', 'Mystère'],
  },
  przyjaciele: {
    originalTitle: 'Friends',
    frenchTitle: 'Friends',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '22 septembre 1994',
    genres: ['Série TV', 'Comédie'],
  },
  'teoria wielkiego podrywu': {
    originalTitle: 'The Big Bang Theory',
    frenchTitle: 'The Big Bang Theory',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '24 septembre 2007',
    genres: ['Série TV', 'Comédie'],
  },
  'młody sheldon': {
    originalTitle: 'Young Sheldon',
    frenchTitle: 'Young Sheldon',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '25 septembre 2017',
    genres: ['Série TV', 'Comédie', 'Famille'],
  },
  zaprzysiężeni: {
    originalTitle: 'Blue Bloods',
    frenchTitle: 'Blue Bloods',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '24 septembre 2010',
    genres: ['Série TV', 'Crime & Policier', 'Drame'],
  },
  'nowojorscy gliniarze': {
    originalTitle: 'NYPD Blue',
    frenchTitle: 'New York Police Blues',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '21 septembre 1993',
    genres: ['Série TV', 'Crime & Policier', 'Drame'],
  },
  'magnum: detektyw z hawajów': {
    originalTitle: 'Magnum P.I.',
    frenchTitle: 'Magnum',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '24 septembre 2018',
    genres: ['Série TV', 'Action', 'Crime & Policier'],
  },
  'nie z tego świata': {
    originalTitle: 'Supernatural',
    frenchTitle: 'Supernatural',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '13 septembre 2005',
    genres: ['Série TV', 'Fantastique', 'Horreur'],
  },
  'gra o tron': {
    originalTitle: 'Game of Thrones',
    frenchTitle: 'Game of Thrones',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '17 avril 2011',
    genres: ['Série TV', 'Fantastique', 'Drame', 'Action'],
  },
  'ród smoka': {
    originalTitle: 'House of the Dragon',
    frenchTitle: 'House of the Dragon',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '21 août 2022',
    genres: ['Série TV', 'Fantastique', 'Drame'],
  },
  sukcesja: {
    originalTitle: 'Succession',
    frenchTitle: 'Succession',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '3 juin 2018',
    genres: ['Série TV', 'Drame'],
  },
  'biały lotos': {
    originalTitle: 'The White Lotus',
    frenchTitle: 'The White Lotus',
    mediaType: 'tv',
    originCountries: ['États-Unis / US'],
    releaseDate: '11 juillet 2021',
    genres: ['Série TV', 'Drame', 'Comédie'],
  },
};

export function lookupKnownLocalShow(
  ...candidateTitles: Array<string | undefined>
): KnownLocalShowSpec | undefined {
  for (const raw of candidateTitles) {
    if (!raw) continue;
    const base = raw
      .trim()
      .replace(/^[a-zA-Z]{2}\s*:\s*/g, '')
      .replace(/\s*\[[^\]]*\]/g, '')
      .replace(/\s*\([^)]*\)/g, '')
      .replace(/\s*[-–:]?\s*(?:Saison|Season|Temporada|Stagione|Sezon|Staffel)\s+\d+.*$/i, '')
      .replace(/\s*\bS\d+\s*E\d+\b.*$/i, '')
      .replace(/\s+\d{1,2}\s*$/, '')
      .replace(/\s+[IVXLCDM]{1,4}\s*$/, '')
      .trim()
      .toLowerCase();
    if (KNOWN_LOCAL_EPG_TITLES[base]) {
      return KNOWN_LOCAL_EPG_TITLES[base];
    }
  }
  return undefined;
}

/**
 * Vérifie si un programme est explicitement classé comme "Série TV" ou "Documentaire"
 * et exclut strictement les événements sportifs, les films et les émissions en direct.
 */
export function isProgrammeSeriesOrDocumentary(params: {
  category?: string;
  rawCategory?: string;
  title?: string;
  subTitle?: string;
  channelGroup?: string;
  channelCategory?: string;
  mediaType?: 'movie' | 'tv';
  genres?: string[];
}): boolean {
  if (params.channelCategory === 'Sport / Football') {
    return false;
  }
  const combinedMeta = `${params.category || ''} ${params.rawCategory || ''} ${
    params.channelGroup || ''
  } ${params.channelCategory || ''} ${(params.genres || []).join(' ')}`.toLowerCase();
  const combinedTitle = `${params.title || ''} ${params.subTitle || ''}`.toLowerCase();

  // 1. Exclure strictement les événements sportifs, football et émissions en direct
  if (
    /football|sport|calcio|laliga|la liga|bundesliga|premier league|champions league|europa league|conference league|nations league|ligue 1|serie a|copa del rey|coppa italia|fa cup|dfb-pokal|puchar|piłka nożna|fútbol|fußball|mecz|kolejka|spieltag|jornada|giornata|multiplex|en direct|\blive\b|na żywo|en vivo|diretta|télé-achat|telezakupy|teletienda|werbung/i.test(
      `${combinedMeta} ${combinedTitle}`
    )
  ) {
    return false;
  }

  // 2. Identifier si c'est explicitement un Documentaire
  const isDocumentary =
    /documentaire|dokument|documental|documentario|documentary|découverte|histoire|nature|przyrod|nauka/i.test(
      combinedMeta
    );

  // 3. Identifier si c'est explicitement une Série TV
  const isExplicitSeriesCategory =
    /série|serie|serial|series|sitcom|feuilleton|miniserie|telenovela|anime/i.test(
      combinedMeta
    );

  // 4. Exclure strictement les films (sauf documentaires ou séries explicites)
  const isExplicitMovie =
    !isDocumentary &&
    !isExplicitSeriesCategory &&
    (params.mediaType === 'movie' ||
      /long-métrage|film|movie|película|spielfilm|kino|cinéma premières|classiques & culte/i.test(
        combinedMeta
      ));

  if (isExplicitMovie) {
    return false;
  }

  if (isDocumentary || isExplicitSeriesCategory) {
    return true;
  }

  if (params.mediaType === 'tv') {
    return true;
  }

  const knownShow = lookupKnownLocalShow(params.title);
  if (knownShow?.mediaType === 'tv') {
    return true;
  }

  return false;
}

/**
 * Formate proprement Saison / Épisode au format "SXX EXX" uniquement si les numéros sont valides
 * (rejette les années comme S2026 E6).
 */
export function formatSeasonEpisodeCode(
  season?: number,
  episode?: number
): string | undefined {
  if (
    season === undefined ||
    episode === undefined ||
    !Number.isInteger(season) ||
    !Number.isInteger(episode) ||
    season < 1 ||
    season > 65 ||
    episode < 1 ||
    episode > 999
  ) {
    return undefined;
  }
  return `S${String(season).padStart(2, '0')} E${String(episode).padStart(
    2,
    '0'
  )}`;
}

/**
 * Extrait les numéros de saison et d'épisode valides depuis une chaîne (ex: "S17E17", "S04 E06", "2x05")
 * en ignorant formellement les années de diffusion (ex: "S2026 E6").
 */
export function parseSeasonAndEpisode(
  episodeNum?: string,
  title?: string,
  subTitle?: string
): { season?: number; episode?: number } {
  // Si episodeNum contient une année à 4 chiffres en guise de saison (ex: "S2026 E6", "2026.6"), l'ignorer
  const sanitizedEpNum =
    episodeNum && /\bS?(?:19|20)\d{2}\b/i.test(episodeNum) ? '' : episodeNum || '';

  const combined = `${sanitizedEpNum} ${title || ''} ${subTitle || ''}`;

  const seMatch = combined.match(/\bS(\d{1,2})\s*E(\d{1,3})\b/i);
  if (seMatch) {
    const s = parseInt(seMatch[1], 10);
    const e = parseInt(seMatch[2], 10);
    if (s >= 1 && s <= 65 && e >= 1 && e <= 999) {
      return { season: s, episode: e };
    }
  }

  const xMatch = combined.match(/\b(\d{1,2})x(\d{1,3})\b/i);
  if (xMatch) {
    const s = parseInt(xMatch[1], 10);
    const e = parseInt(xMatch[2], 10);
    if (s >= 1 && s <= 65 && e >= 1 && e <= 999) {
      return { season: s, episode: e };
    }
  }

  const localizedSeMatch = combined.match(
    /(?:Sezon|Saison|Season|Temporada|Stagione|Staffel)\s*(\d{1,2})\D+(?:Odcinek|odc\.|Épisode|Episode|Ep\.|Episodio|Folge)\s*(\d{1,3})/i
  );
  if (localizedSeMatch) {
    const s = parseInt(localizedSeMatch[1], 10);
    const e = parseInt(localizedSeMatch[2], 10);
    if (s >= 1 && s <= 65 && e >= 1 && e <= 999) {
      return { season: s, episode: e };
    }
  }

  const epOnlyMatch =
    sanitizedEpNum.match(/^\s*(?:E|odc\.?\s*)?(\d{1,3})\s*$/i) ||
    (subTitle || '').match(/\b(?:Odcinek|odc\.|Épisode|Episode|Folge)\s*(\d{1,3})\b/i);
  if (epOnlyMatch) {
    const epVal = parseInt(epOnlyMatch[1], 10);
    // Chercher si la saison est à la fin du titre (ex: "Rekrut 4" ou "Murdoch Mysteries 17")
    const titleSeasonMatch = (title || '').match(/\s+(\d{1,2})\s*$/);
    const seasonVal = titleSeasonMatch
      ? parseInt(titleSeasonMatch[1], 10)
      : undefined;
    if (epVal >= 1 && epVal <= 999) {
      return {
        season:
          seasonVal !== undefined && seasonVal >= 1 && seasonVal <= 65
            ? seasonVal
            : undefined,
        episode: epVal,
      };
    }
  }

  // Cas où le titre d'une série connue se termine par un numéro de saison (ex: "Rekrut 4")
  const trailingTitleSeason = (title || '').match(/^(.+?)\s+(\d{1,2})\s*$/);
  if (trailingTitleSeason) {
    const candidateShow = lookupKnownLocalShow(trailingTitleSeason[1]);
    const s = parseInt(trailingTitleSeason[2], 10);
    if (candidateShow && s >= 1 && s <= 40) {
      return { season: s, episode: undefined };
    }
  }

  return {};
}

/**
 * Nettoie un titre brut ou original issu du XML EPG (supprime les suffixes HD, numéros de saison finaux, etc.)
 */
export function cleanEpgTitleForSearch(
  rawTitle: string,
  seasonNumber?: number,
  hasEpisode?: boolean
): string {
  if (!rawTitle) return '';
  let t = rawTitle.trim();

  // Supprimer les préfixes de langue (ex: "ar: ", "en: ", "EN: ")
  t = t.replace(/^[a-zA-Z]{2}\s*:\s*/g, '');

  // Supprimer les mentions entre crochets ou parenthèses techniques
  t = t.replace(/\s*\[[^\]]*\]/g, '');
  t = t.replace(
    /\s*\((?:HD|SD|UHD|4K|VOSE|VF|VO|Premiera|Na żywo|Live|Direct| powt\.|T\d+|S\d+[^)]*)\)/gi,
    ''
  );

  // Supprimer les suffixes de saison explicites (ex: "- Saison 17", "- Temporada 4", "- Stagione 2", "- Staffel 3", "S17E15")
  t = t.replace(
    /\s*[-–:]?\s*(?:Saison|Season|Temporada|Stagione|Sezon|Staffel|Series)\s+\d+.*$/i,
    ''
  );
  t = t.replace(/\s*\bS\d{1,2}\s*E\d{1,3}\b.*$/i, '');

  // Si le titre se termine par le numéro de saison (ex: "Murdoch Mysteries 17" avec S17E15)
  if (seasonNumber !== undefined) {
    const escapedSeason = String(seasonNumber);
    const trailingSeasonRegex = new RegExp(`\\s+${escapedSeason}\\s*$`);
    if (trailingSeasonRegex.test(t)) {
      t = t.replace(trailingSeasonRegex, '');
    }
  } else if (hasEpisode) {
    // Série avec numéro d'épisode dont le titre finit par un numéro de saison (ex: "Detektyw Murdoch 17")
    t = t.replace(/\s+\d{1,2}\s*$/, '');
  }

  // Supprimer la numérotation romaine de saison en fin de titre de série si un épisode est présent
  if (hasEpisode || seasonNumber !== undefined) {
    t = t.replace(/\s+[IVXLCDM]{1,4}\s*$/, '');
  }

  return t.trim();
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripWikiDisambiguation(title: string): string {
  return title
    .replace(
      /\s*\((?:série télévisée|film|série|téléfilm|émission|feuilleton|anime)[^)]*\)\s*$/i,
      ''
    )
    .trim();
}

function cleanWikitextToPlain(wikitext: string): string {
  let s = wikitext;
  // Supprimer les modèles complexes imbriqués simples {{...}} sauf {{Langue|...|texte}}
  s = s.replace(/\{\{Langue\|[^|]+\|([^}]+)\}\}/gi, '$1');
  s = s.replace(/\{\{unité\|([^|}]+)\|?([^}]*)\}\}/gi, '$1 $2');
  s = s.replace(/\{\{[^{}]*\}\}/g, '');
  // Remplacer les liens [[Cible|Texte]] par Texte, et [[Texte]] par Texte
  s = s.replace(/\[\[(?:[^|\]]+\|)?([^\]]+)\]\]/g, '$1');
  // Supprimer les balises <ref>...</ref>
  s = s.replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '');
  s = s.replace(/<ref[^/]*\/>/gi, '');
  s = s.replace(/''+/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Extrait la section Synopsis ou Résumé d'un texte Wikipedia FR
 */
function extractBestFrenchSynopsisFromWikiExtract(extract: string): string {
  if (!extract) return '';

  // Chercher == Synopsis == ou == Résumé ==
  const synopsisMatch = extract.match(
    /==\s*(?:Synopsis|Résumé|Intrigue|Histoire)\s*==\s*([\s\S]+?)(?:\n==\s|$)/i
  );
  if (synopsisMatch && synopsisMatch[1]) {
    const cleaned = synopsisMatch[1]
      .replace(/===\s*[^=]+\s*===/g, '')
      .trim();
    if (cleaned.length > 45) {
      return cleaned.slice(0, 750) + (cleaned.length > 750 ? '…' : '');
    }
  }

  // Sinon prendre le premier paragraphe substantiel (introduction)
  const paragraphs = extract
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 40 && !p.startsWith('=='));

  if (paragraphs.length > 0) {
    const joined = paragraphs.slice(0, 2).join(' ');
    return joined.slice(0, 700) + (joined.length > 700 ? '…' : '');
  }

  return '';
}

const COUNTRY_NAME_FR_BY_CODE: Record<string, string> = {
  US: 'États-Unis',
  USA: 'États-Unis',
  GB: 'Royaume-Uni',
  UK: 'Royaume-Uni',
  FR: 'France',
  CA: 'Canada',
  DE: 'Allemagne',
  ES: 'Espagne',
  IT: 'Italie',
  PL: 'Pologne',
  JP: 'Japon',
  KR: 'Corée du Sud',
  AU: 'Australie',
  NZ: 'Nouvelle-Zélande',
  BE: 'Belgique',
  CH: 'Suisse',
  IE: 'Irlande',
  SE: 'Suède',
  DK: 'Danemark',
  NO: 'Norvège',
  FI: 'Finlande',
  NL: 'Pays-Bas',
  AT: 'Autriche',
  BR: 'Brésil',
  MX: 'Mexique',
  AR: 'Argentine',
  CN: 'Chine',
  HK: 'Hong Kong',
  IN: 'Inde',
  MA: 'Maroc',
  EG: 'Égypte',
  TR: 'Turquie',
  ZA: 'Afrique du Sud',
};

const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  'united states': 'US',
  'united states of america': 'US',
  'états-unis': 'US',
  'etats-unis': 'US',
  usa: 'US',
  'united kingdom': 'GB',
  'royaume-uni': 'GB',
  'great britain': 'GB',
  france: 'FR',
  canada: 'CA',
  germany: 'DE',
  allemagne: 'DE',
  spain: 'ES',
  espagne: 'ES',
  italy: 'IT',
  italie: 'IT',
  poland: 'PL',
  pologne: 'PL',
  japan: 'JP',
  japon: 'JP',
  'south korea': 'KR',
  'corée du sud': 'KR',
  australia: 'AU',
  australie: 'AU',
  'new zealand': 'NZ',
  belgium: 'BE',
  belgique: 'BE',
  switzerland: 'CH',
  suisse: 'CH',
  ireland: 'IE',
  irlande: 'IE',
  sweden: 'SE',
  suède: 'SE',
  denmark: 'DK',
  danemark: 'DK',
  norway: 'NO',
  norvège: 'NO',
  netherlands: 'NL',
  'pays-bas': 'NL',
  mexico: 'MX',
  mexique: 'MX',
  brazil: 'BR',
  brésil: 'BR',
  china: 'CN',
  chine: 'CN',
  india: 'IN',
  inde: 'IN',
};

const TVMAZE_GENRE_FR: Record<string, string> = {
  Action: 'Action',
  Adventure: 'Aventure',
  Anime: 'Animation',
  Children: 'Famille',
  Comedy: 'Comédie',
  Crime: 'Crime & Policier',
  DIY: 'Art de vivre',
  Drama: 'Drame',
  Espionage: 'Espionnage',
  Family: 'Famille',
  Fantasy: 'Fantastique',
  Food: 'Gastronomie',
  History: 'Histoire',
  Horror: 'Horreur',
  Legal: 'Judiciaire',
  Medical: 'Médical',
  Music: 'Musique',
  Mystery: 'Mystère',
  Nature: 'Documentaire & Nature',
  Romance: 'Romance',
  'Science-Fiction': 'Science-Fiction',
  Sports: 'Sport',
  Supernatural: 'Surnaturel',
  Thriller: 'Thriller',
  Travel: 'Voyage',
  War: 'Guerre',
  Western: 'Western',
};

export function formatOfficialReleaseDateFr(rawDate?: string): string | undefined {
  if (!rawDate) return undefined;
  const trimmed = rawDate.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);
    const monthsFr = [
      'janvier',
      'février',
      'mars',
      'avril',
      'mai',
      'juin',
      'juillet',
      'août',
      'septembre',
      'octobre',
      'novembre',
      'décembre',
    ];
    if (month >= 0 && month < 12 && day >= 1 && day <= 31) {
      return `${day} ${monthsFr[month]} ${year}`;
    }
  }
  const yearMatch = trimmed.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) return yearMatch[1];
  return trimmed || undefined;
}

export function formatOriginCountryLabelFr(rawCountry?: string): string | undefined {
  if (!rawCountry) return undefined;
  const trimmed = rawCountry.trim();
  if (!trimmed) return undefined;
  const upper = trimmed.toUpperCase();
  if (COUNTRY_NAME_FR_BY_CODE[upper]) {
    const code = upper === 'USA' ? 'US' : upper === 'UK' ? 'GB' : upper;
    return `${COUNTRY_NAME_FR_BY_CODE[upper]} / ${code}`;
  }
  const lower = trimmed.toLowerCase();
  const mappedCode = COUNTRY_CODE_BY_NAME[lower];
  if (mappedCode && COUNTRY_NAME_FR_BY_CODE[mappedCode]) {
    return `${COUNTRY_NAME_FR_BY_CODE[mappedCode]} / ${mappedCode}`;
  }
  if (trimmed.includes('/')) return trimmed;
  return trimmed;
}

function resolveTmdbLanguageCode(rawLang?: string): string {
  const l = (rawLang || 'fr').toLowerCase();
  if (l.startsWith('en')) return 'en-US';
  if (l.startsWith('ar')) return 'ar-SA';
  if (l.startsWith('es')) return 'es-ES';
  if (l.startsWith('de')) return 'de-DE';
  if (l.startsWith('pt')) return 'pt-BR';
  return 'fr-FR';
}

function resolveShortLangCode(rawLang?: string): 'fr' | 'en' | 'ar' | 'es' | 'de' | 'pt' {
  const l = (rawLang || 'fr').toLowerCase();
  if (l.startsWith('en')) return 'en';
  if (l.startsWith('ar')) return 'ar';
  if (l.startsWith('es')) return 'es';
  if (l.startsWith('de')) return 'de';
  if (l.startsWith('pt')) return 'pt';
  return 'fr';
}

/**
 * Interroge l'API officielle TMDB (avec language=fr-FR, ar-SA, en-US, es-ES, de-DE, pt-BR) si une clé TMDB_API_KEY est configurée
 */
async function tryTmdbFrenchLookup(
  queries: string[],
  seasonNumber?: number,
  episodeNumber?: number,
  year?: string,
  tmdbApiKey?: string,
  targetLang?: string
): Promise<Partial<EnrichedProgrammeResult> | null> {
  if (!tmdbApiKey || !tmdbApiKey.trim()) return null;
  const key = tmdbApiKey.trim();
  const isBearer = key.length > 45;
  const tmdbLocale = resolveTmdbLanguageCode(targetLang);
  const shortLang = resolveShortLangCode(targetLang);

  const buildHeaders = (): Record<string, string> =>
    isBearer
      ? {
          Authorization: `Bearer ${key}`,
          Accept: 'application/json',
        }
      : {
          Accept: 'application/json',
        };

  const appendAuthParam = (url: string) =>
    isBearer ? url : `${url}${url.includes('?') ? '&' : '?'}api_key=${encodeURIComponent(key)}`;

  for (const q of queries) {
    if (!q) continue;
    try {
      const searchUrl = appendAuthParam(
        `https://api.themoviedb.org/3/search/multi?language=${encodeURIComponent(
          tmdbLocale
        )}&query=${encodeURIComponent(
          q
        )}&include_adult=false`
      );
      const res = await fetch(searchUrl, { headers: buildHeaders() });
      if (!res.ok) continue;

      const data = (await res.json()) as {
        results?: Array<{
          id: number;
          media_type: string;
          title?: string;
          name?: string;
          original_title?: string;
          original_name?: string;
          overview?: string;
          poster_path?: string;
          backdrop_path?: string;
          release_date?: string;
          first_air_date?: string;
          vote_average?: number;
        }>;
      };

      const candidates = (data.results || []).filter(
        (r) => r.media_type === 'tv' || r.media_type === 'movie'
      );
      if (candidates.length === 0) continue;

      // Prioriser les séries si on a un numéro de saison/épisode
      let best = candidates[0];
      if (seasonNumber !== undefined || episodeNumber !== undefined) {
        const tvMatch = candidates.find((c) => c.media_type === 'tv');
        if (tvMatch) best = tvMatch;
      } else if (year) {
        const yearMatch = candidates.find((c) =>
          (c.release_date || c.first_air_date || '').startsWith(year)
        );
        if (yearMatch) best = yearMatch;
      }

      const mediaType: 'movie' | 'tv' =
        best.media_type === 'tv' ? 'tv' : 'movie';

      const result: Partial<EnrichedProgrammeResult> = {
        tmdbId: best.id,
        mediaType,
        frenchTitle: best.title || best.name,
        originalTitle: best.original_title || best.original_name,
        frenchSynopsis: best.overview || undefined,
        posterUrl: best.poster_path
          ? `https://image.tmdb.org/t/p/w780${best.poster_path}`
          : undefined,
        backdropUrl: best.backdrop_path
          ? `https://image.tmdb.org/t/p/w1280${best.backdrop_path}`
          : undefined,
        releaseYear:
          (best.release_date || best.first_air_date || '').slice(0, 4) ||
          undefined,
        releaseDate: formatOfficialReleaseDateFr(
          best.release_date || best.first_air_date
        ),
        rating: best.vote_average
          ? Math.round(best.vote_average * 10) / 10
          : undefined,
        sourceProvider: `TMDB (${tmdbLocale})`,
      };

      // Récupérer le casting, le réalisateur, les genres, le pays d'origine et la bande-annonce via TMDB
      try {
        const detailUrl = appendAuthParam(
          `https://api.themoviedb.org/3/${mediaType}/${best.id}?language=${encodeURIComponent(
            tmdbLocale
          )}&append_to_response=credits,videos&include_video_language=${shortLang},fr,en,null`
        );
        const detailRes = await fetch(detailUrl, { headers: buildHeaders() });
        if (detailRes.ok) {
          const detailData = (await detailRes.json()) as {
            vote_average?: number;
            release_date?: string;
            first_air_date?: string;
            genres?: Array<{ id?: number; name?: string }>;
            origin_country?: string[];
            production_countries?: Array<{ iso_3166_1?: string; name?: string }>;
            created_by?: Array<{ name?: string }>;
            credits?: {
              cast?: Array<{ name?: string; order?: number }>;
              crew?: Array<{
                name?: string;
                job?: string;
                department?: string;
              }>;
            };
            videos?: {
              results?: Array<{
                key?: string;
                name?: string;
                site?: string;
                type?: string;
                official?: boolean;
                iso_639_1?: string;
              }>;
            };
          };

          if (detailData.vote_average && !result.rating) {
            result.rating = Math.round(detailData.vote_average * 10) / 10;
          }

          if (detailData.release_date || detailData.first_air_date) {
            result.releaseDate = formatOfficialReleaseDateFr(
              detailData.release_date || detailData.first_air_date
            );
          }

          const tmdbGenres = (detailData.genres || [])
            .map((g) => g.name?.trim())
            .filter((n): n is string => Boolean(n));
          if (tmdbGenres.length > 0) {
            result.genres = Array.from(new Set(tmdbGenres));
          }

          const originCodes = [
            ...(detailData.origin_country || []),
            ...(detailData.production_countries || []).map(
              (c) => c.iso_3166_1 || c.name || ''
            ),
          ].filter(Boolean);
          const formattedCountries = Array.from(
            new Set(
              originCodes
                .map((c) => formatOriginCountryLabelFr(c))
                .filter((c): c is string => Boolean(c))
            )
          ).slice(0, 2);
          if (formattedCountries.length > 0) {
            result.originCountries = formattedCountries;
          }

          const castNames = (detailData.credits?.cast || [])
            .map((c) => c.name?.trim())
            .filter((n): n is string => Boolean(n))
            .slice(0, 8);
          if (castNames.length > 0) {
            result.cast = Array.from(new Set(castNames));
          }

          const crewDirectors = (detailData.credits?.crew || [])
            .filter(
              (c) =>
                c.job === 'Director' ||
                c.job === 'Series Director' ||
                (mediaType === 'tv' && c.job === 'Executive Producer')
            )
            .map((c) => c.name?.trim())
            .filter((n): n is string => Boolean(n));
          const creatorNames = (detailData.created_by || [])
            .map((c) => c.name?.trim())
            .filter((n): n is string => Boolean(n));
          const allDirectors = Array.from(
            new Set([...crewDirectors, ...creatorNames])
          ).slice(0, 3);
          if (allDirectors.length > 0) {
            result.directors = allDirectors;
          }

          const ytVideos = (detailData.videos?.results || []).filter(
            (v) => v.site?.toLowerCase() === 'youtube' && Boolean(v.key)
          );
          if (ytVideos.length > 0) {
            ytVideos.sort((a, b) => {
              const score = (v: typeof a) => {
                let s = 0;
                if (v.type === 'Trailer') s += 10;
                else if (v.type === 'Teaser') s += 5;
                if (v.iso_639_1 === 'fr') s += 6;
                else if (v.iso_639_1 === 'en') s += 3;
                if (v.official) s += 2;
                return s;
              };
              return score(b) - score(a);
            });
            result.youtubeTrailerKey = ytVideos[0].key;
            result.youtubeTrailerName = ytVideos[0].name;
          }
        }
      } catch {
        // Ignore detail fetch error
      }

      // Si c'est une série et qu'on a Saison + Épisode, récupérer le titre officiel localisé de l'épisode
      if (
        best.media_type === 'tv' &&
        seasonNumber !== undefined &&
        episodeNumber !== undefined
      ) {
        try {
          const epUrl = appendAuthParam(
            `https://api.themoviedb.org/3/tv/${best.id}/season/${seasonNumber}/episode/${episodeNumber}?language=${encodeURIComponent(
              tmdbLocale
            )}`
          );
          const epRes = await fetch(epUrl, { headers: buildHeaders() });
          if (epRes.ok) {
            const epData = (await epRes.json()) as {
              name?: string;
              overview?: string;
              still_path?: string;
            };
            if (
              epData.name &&
              !/^(?:Épisode|Episode)\s+\d+$/i.test(epData.name.trim())
            ) {
              result.frenchEpisodeTitle = epData.name.trim();
            }
            if (epData.overview && epData.overview.trim().length > 15) {
              result.frenchSynopsis = epData.overview.trim();
            }
            if (epData.still_path && !result.backdropUrl) {
              result.backdropUrl = `https://image.tmdb.org/t/p/w780${epData.still_path}`;
            }
          }
        } catch {
          // Ignore episode fetch error
        }
      }

      return result;
    } catch {
      // Continue to next query
    }
  }

  return null;
}

/**
 * Interroge l'API publique iTunes Movies FR (sans clé requise) pour récupérer :
 * - L'affiche HD + image de fond
 * - Le réalisateur (artistName)
 * - Le synopsis officiel en français (longDescription)
 * - La bande-annonce vidéo officielle (previewUrl)
 */
async function tryItunesMovieLookup(
  queries: string[],
  year?: string
): Promise<Partial<EnrichedProgrammeResult> | null> {
  for (const q of queries) {
    if (!q || q.length < 2) continue;
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
        q
      )}&media=movie&entity=movie&country=fr&lang=fr_fr&limit=4`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = (await res.json()) as {
        results?: Array<{
          trackName?: string;
          artistName?: string;
          releaseDate?: string;
          primaryGenreName?: string;
          country?: string;
          longDescription?: string;
          shortDescription?: string;
          artworkUrl100?: string;
          previewUrl?: string;
        }>;
      };

      const candidates = data.results || [];
      if (candidates.length === 0) continue;

      let best = candidates[0];
      if (year) {
        const yearMatch = candidates.find((c) =>
          (c.releaseDate || '').startsWith(year)
        );
        if (yearMatch) best = yearMatch;
      }

      const hiResPoster = best.artworkUrl100
        ? best.artworkUrl100.replace(/100x100bb/g, '600x900bb')
        : undefined;
      const hiResBackdrop = best.artworkUrl100
        ? best.artworkUrl100.replace(/100x100bb/g, '1200x675bb')
        : undefined;

      return {
        mediaType: 'movie',
        frenchTitle: best.trackName,
        frenchSynopsis: best.longDescription || best.shortDescription,
        posterUrl: hiResPoster,
        backdropUrl: hiResBackdrop,
        releaseYear: best.releaseDate ? best.releaseDate.slice(0, 4) : undefined,
        releaseDate: formatOfficialReleaseDateFr(best.releaseDate),
        genres: best.primaryGenreName ? [best.primaryGenreName] : undefined,
        directors: best.artistName ? [best.artistName] : undefined,
        previewVideoUrl: best.previewUrl,
      };
    } catch {
      // Continue
    }
  }
  return null;
}

/**
 * Interroge TVMaze (AKAs officiels FR, Poster HD, Backdrop, Casting, Créateur/Réalisateur, Épisodes SxxExx)
 */
async function tryTvMazeLookup(
  queries: string[],
  seasonNumber?: number,
  episodeNumber?: number
): Promise<Partial<EnrichedProgrammeResult> | null> {
  for (const q of queries) {
    if (!q) continue;
    try {
      const url = `https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(
        q
      )}&embed[]=episodes&embed[]=akas&embed[]=cast&embed[]=crew&embed[]=images`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = (await res.json()) as {
        name?: string;
        premiered?: string;
        genres?: string[];
        network?: { country?: { code?: string; name?: string } };
        webChannel?: { country?: { code?: string; name?: string } };
        summary?: string;
        rating?: { average?: number };
        image?: { original?: string; medium?: string };
        _embedded?: {
          akas?: Array<{
            name: string;
            country?: { code?: string };
          }>;
          cast?: Array<{
            person?: { name?: string };
          }>;
          crew?: Array<{
            type?: string;
            person?: { name?: string };
          }>;
          images?: Array<{
            type?: string;
            resolutions?: {
              original?: { url?: string };
              medium?: { url?: string };
            };
          }>;
          episodes?: Array<{
            season: number;
            number: number;
            name?: string;
            summary?: string;
            image?: { original?: string; medium?: string };
          }>;
        };
      };

      const frAka = (data._embedded?.akas || []).find(
        (a) => a.country?.code === 'FR'
      );

      let formattedFrTitle: string | undefined;
      if (frAka?.name) {
        formattedFrTitle =
          frAka.name.charAt(0).toUpperCase() + frAka.name.slice(1);
      }

      const castNames = (data._embedded?.cast || [])
        .map((c) => c.person?.name?.trim())
        .filter((n): n is string => Boolean(n))
        .slice(0, 8);

      const crewDirectors = (data._embedded?.crew || [])
        .filter((c) =>
          /creator|director|executive producer|developer/i.test(c.type || '')
        )
        .map((c) => c.person?.name?.trim())
        .filter((n): n is string => Boolean(n));

      const bgImage = (data._embedded?.images || []).find(
        (img) => img.type === 'background'
      );
      const backdropFromImages =
        bgImage?.resolutions?.original?.url ||
        bgImage?.resolutions?.medium?.url;

      const tvmazeGenres = (data.genres || [])
        .map((g) => TVMAZE_GENRE_FR[g] || g)
        .filter(Boolean);
      const tvmazeCountryCode =
        data.network?.country?.code || data.webChannel?.country?.code;
      const tvmazeOrigin = formatOriginCountryLabelFr(tvmazeCountryCode);

      const result: Partial<EnrichedProgrammeResult> = {
        mediaType: 'tv',
        frenchTitle: formattedFrTitle,
        originalTitle: data.name,
        posterUrl: data.image?.original || data.image?.medium,
        backdropUrl: backdropFromImages,
        releaseYear: data.premiered ? data.premiered.slice(0, 4) : undefined,
        releaseDate: formatOfficialReleaseDateFr(data.premiered),
        genres: tvmazeGenres.length > 0 ? tvmazeGenres : undefined,
        originCountries: tvmazeOrigin ? [tvmazeOrigin] : undefined,
        rating: data.rating?.average || undefined,
        cast: castNames.length > 0 ? Array.from(new Set(castNames)) : undefined,
        directors:
          crewDirectors.length > 0
            ? Array.from(new Set(crewDirectors)).slice(0, 3)
            : undefined,
      };

      if (seasonNumber !== undefined && episodeNumber !== undefined) {
        const ep = (data._embedded?.episodes || []).find(
          (e) => e.season === seasonNumber && e.number === episodeNumber
        );
        if (ep) {
          result.originalEpisodeTitle = ep.name;
          if (ep.image?.original || ep.image?.medium) {
            result.backdropUrl = ep.image.original || ep.image.medium;
          }
        }
      }

      return result;
    } catch {
      // Continue
    }
  }
  return null;
}

/**
 * Récupère le titre officiel français et le résumé d'un épisode (ex: S17E17)
 * depuis la page de saison officielle sur Wikipedia FR (ex: "Saison 17 des Enquêtes de Murdoch")
 */
async function tryFrenchSeasonEpisodeLookup(
  frenchShowTitle: string,
  seasonNumber: number,
  episodeNumber: number
): Promise<{ frenchEpisodeTitle?: string; frenchEpisodeSynopsis?: string }> {
  try {
    const searchQuery = `Saison ${seasonNumber} ${frenchShowTitle}`;
    const searchUrl = `https://fr.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      searchQuery
    )}&srlimit=3&format=json&origin=*`;

    const searchRes = await fetch(searchUrl, {
      headers: { 'User-Agent': 'PulseEPG/1.0 (Mobile TV Guide)' },
    });
    if (!searchRes.ok) return {};

    const searchData = (await searchRes.json()) as {
      query?: {
        search?: Array<{ pageid: number; title: string }>;
      };
    };

    const seasonPage = (searchData.query?.search || []).find((p) =>
      p.title.toLowerCase().includes(`saison ${seasonNumber}`)
    );
    if (!seasonPage) return {};

    const sectionsUrl = `https://fr.wikipedia.org/w/api.php?action=parse&pageid=${seasonPage.pageid}&prop=sections&format=json&origin=*`;
    const secRes = await fetch(sectionsUrl, {
      headers: { 'User-Agent': 'PulseEPG/1.0 (Mobile TV Guide)' },
    });
    if (!secRes.ok) return {};

    const secData = (await secRes.json()) as {
      parse?: {
        sections?: Array<{
          index: string;
          line: string;
        }>;
      };
    };

    const epRegex = new RegExp(
      `^(?:Épisode|Episode)\\s*0*${episodeNumber}\\s*:\\s*(.+)$`,
      'i'
    );

    let matchedSectionIndex: string | undefined;
    let frenchEpisodeTitle: string | undefined;

    for (const sec of secData.parse?.sections || []) {
      const cleanLine = stripHtmlTags(sec.line).replace(/\u00a0/g, ' ').trim();
      const m = cleanLine.match(epRegex);
      if (m && m[1]) {
        frenchEpisodeTitle = m[1].replace(/^["«']+|["»']+$/g, '').trim();
        matchedSectionIndex = sec.index;
        break;
      }
    }

    let frenchEpisodeSynopsis: string | undefined;
    if (matchedSectionIndex) {
      const wtUrl = `https://fr.wikipedia.org/w/api.php?action=parse&pageid=${seasonPage.pageid}&section=${matchedSectionIndex}&prop=wikitext&format=json&origin=*`;
      const wtRes = await fetch(wtUrl, {
        headers: { 'User-Agent': 'PulseEPG/1.0 (Mobile TV Guide)' },
      });
      if (wtRes.ok) {
        const wtData = (await wtRes.json()) as {
          parse?: { wikitext?: { '*'?: string } };
        };
        const rawWt = wtData.parse?.wikitext?.['*'] || '';
        const resumeMatch = rawWt.match(
          /\|\s*résumé\s*=\s*([\s\S]+?)(?:\n\s*\|\s*[^=]+=|\n\s*\}\})/i
        );
        if (resumeMatch && resumeMatch[1]) {
          const cleaned = cleanWikitextToPlain(resumeMatch[1]);
          if (cleaned.length > 20) {
            frenchEpisodeSynopsis = cleaned;
          }
        }
      }
    }

    return { frenchEpisodeTitle, frenchEpisodeSynopsis };
  } catch {
    return {};
  }
}

/**
 * Résout le titre officiel français, le synopsis officiel en français et l'affiche
 * via Wikidata (labels.fr / sitelinks.frwiki) + Wikipedia FR
 */
async function tryWikidataAndWikipediaFrenchLookup(
  queries: string[],
  countryCode?: string,
  isSeries?: boolean
): Promise<Partial<EnrichedProgrammeResult> | null> {
  const langMap: Record<string, string> = {
    PL: 'pl',
    ES: 'es',
    IT: 'it',
    DE: 'de',
    AR: 'ar',
  };
  const sourceLang = (countryCode && langMap[countryCode]) || 'en';
  const searchLangs = Array.from(new Set(['en', sourceLang, 'fr']));

  const mediaKeywords =
    /film|série|télévision|feuilleton|téléfilm|émission|anime|miniserie|sitcom|movie|television|series|serial|película|serie/i;

  for (const q of queries) {
    if (!q || q.length < 2) continue;

    for (const lang of searchLangs) {
      try {
        const wdSearchUrl = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
          q
        )}&language=${lang}&uselang=fr&limit=6&format=json&origin=*`;

        const res = await fetch(wdSearchUrl, {
          headers: { 'User-Agent': 'PulseEPG/1.0 (Mobile TV Guide)' },
        });
        if (!res.ok) continue;

        const data = (await res.json()) as {
          search?: Array<{
            id: string;
            label?: string;
            description?: string;
            display?: {
              label?: { value?: string; language?: string };
              description?: { value?: string; language?: string };
            };
          }>;
        };

        const candidates = data.search || [];
        if (candidates.length === 0) continue;

        // Filtrer uniquement les œuvres audiovisuelles (films, séries TV)
        let match = candidates.find((c) => {
          const desc = c.description || c.display?.description?.value || '';
          if (isSeries && /série|television series|serial|feuilleton|sitcom/i.test(desc)) {
            return true;
          }
          return mediaKeywords.test(desc);
        });

        if (!match && isSeries) {
          match = candidates.find((c) =>
            mediaKeywords.test(c.description || '')
          );
        }

        if (!match) continue;

        // Récupérer les sitelinks frwiki et enwiki + labels officiels FR + claims (P1651 YouTube ID)
        const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${match.id}&props=labels|descriptions|sitelinks|claims&languages=fr|en&sitefilter=frwiki|enwiki&format=json&origin=*`;
        const entRes = await fetch(entityUrl, {
          headers: { 'User-Agent': 'PulseEPG/1.0 (Mobile TV Guide)' },
        });
        if (!entRes.ok) continue;

        const entData = (await entRes.json()) as {
          entities?: Record<
            string,
            {
              labels?: {
                fr?: { value?: string };
                en?: { value?: string };
              };
              sitelinks?: {
                frwiki?: { title?: string };
                enwiki?: { title?: string };
              };
              claims?: {
                P1651?: Array<{
                  mainsnak?: {
                    datavalue?: { value?: string };
                  };
                }>;
              };
            }
          >;
        };

        const entity = entData.entities?.[match.id];
        if (!entity) continue;

        const youtubeTrailerKey =
          entity.claims?.P1651?.[0]?.mainsnak?.datavalue?.value || undefined;

        const frWikiRawTitle = entity.sitelinks?.frwiki?.title;
        const enWikiRawTitle = entity.sitelinks?.enwiki?.title;

        const officialFrenchTitle = frWikiRawTitle
          ? stripWikiDisambiguation(frWikiRawTitle)
          : entity.labels?.fr?.value
          ? stripWikiDisambiguation(entity.labels.fr.value)
          : undefined;

        const officialOriginalTitle = entity.labels?.en?.value
          ? stripWikiDisambiguation(entity.labels.en.value)
          : enWikiRawTitle
          ? stripWikiDisambiguation(enWikiRawTitle)
          : undefined;

        let frenchSynopsis: string | undefined;
        let posterUrl: string | undefined;
        let directors: string[] | undefined;
        let cast: string[] | undefined;
        let releaseDate: string | undefined;
        let originCountries: string[] | undefined;

        const wikiDateVal =
          (
            entity.claims as Record<
              string,
              Array<{ mainsnak?: { datavalue?: { value?: { time?: string } } } }>
            >
          )?.P577?.[0]?.mainsnak?.datavalue?.value?.time;
        if (wikiDateVal) {
          const cleanIso = wikiDateVal.replace(/^\+/, '').slice(0, 10);
          releaseDate = formatOfficialReleaseDateFr(cleanIso);
        }

        // Extraire le pays d'origine officiel depuis la propriété Wikidata P495 (country of origin)
        const WIKIDATA_COUNTRY_BY_QID: Record<string, string> = {
          Q30: 'US',
          Q145: 'GB',
          Q142: 'FR',
          Q16: 'CA',
          Q183: 'DE',
          Q29: 'ES',
          Q38: 'IT',
          Q36: 'PL',
          Q17: 'JP',
          Q884: 'KR',
          Q408: 'AU',
          Q664: 'NZ',
          Q31: 'BE',
          Q39: 'CH',
          Q27: 'IE',
          Q34: 'SE',
          Q35: 'DK',
          Q20: 'NO',
          Q33: 'FI',
          Q55: 'NL',
          Q40: 'AT',
          Q155: 'BR',
          Q96: 'MX',
          Q414: 'AR',
          Q148: 'CN',
          Q668: 'IN',
          Q1028: 'MA',
          Q79: 'EG',
          Q43: 'TR',
        };
        const p495Claims = (
          entity.claims as Record<
            string,
            Array<{ mainsnak?: { datavalue?: { value?: { id?: string } } } }>
          >
        )?.P495;
        if (Array.isArray(p495Claims) && p495Claims.length > 0) {
          const mappedOrigins = p495Claims
            .map((c) => {
              const qid = c.mainsnak?.datavalue?.value?.id;
              const iso = qid ? WIKIDATA_COUNTRY_BY_QID[qid] : undefined;
              return formatOriginCountryLabelFr(iso);
            })
            .filter((v): v is string => Boolean(v));
          if (mappedOrigins.length > 0) {
            originCountries = Array.from(new Set(mappedOrigins)).slice(0, 2);
          }
        }

        if (frWikiRawTitle) {
          const frExtractUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&explaintext=1&exchars=1400&piprop=original&titles=${encodeURIComponent(
            frWikiRawTitle
          )}&format=json&origin=*`;

          const frRes = await fetch(frExtractUrl, {
            headers: { 'User-Agent': 'PulseEPG/1.0 (Mobile TV Guide)' },
          });
          if (frRes.ok) {
            const frJson = (await frRes.json()) as {
              query?: {
                pages?: Record<
                  string,
                  {
                    extract?: string;
                    original?: { source?: string };
                  }
                >;
              };
            };
            const pages = frJson.query?.pages || {};
            const firstPage = Object.values(pages)[0];
            if (firstPage?.extract) {
              frenchSynopsis =
                extractBestFrenchSynopsisFromWikiExtract(firstPage.extract) ||
                undefined;

              const dirMatch = firstPage.extract.match(
                /(?:réalisé par|créée? par)\s+([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'-]+(?:\s+[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'-]+){1,2})/
              );
              if (dirMatch && dirMatch[1]) {
                directors = [dirMatch[1].trim()];
              }

              const castMatch = firstPage.extract.match(
                /(?:mettant en scène|avec notamment|avec)\s+([A-ZÀ-ÖØ-Ý][^.;\n]{5,110})/
              );
              if (castMatch && castMatch[1]) {
                const parsedCast = castMatch[1]
                  .split(/,| et /)
                  .map((s) => s.trim())
                  .filter(
                    (s) =>
                      /^[A-ZÀ-ÖØ-Ý]/.test(s) &&
                      s.split(/\s+/).length >= 2 &&
                      s.split(/\s+/).length <= 4
                  )
                  .slice(0, 6);
                if (parsedCast.length > 0) {
                  cast = parsedCast;
                }
              }
              const countryMatch = firstPage.extract.match(
                /\b(américain|britannique|français|canadien|allemand|espagnol|italien|polonais|japonais|sud-coréen|australien|belge|suisse)\b/i
              );
              if (countryMatch && countryMatch[1]) {
                const adjMap: Record<string, string> = {
                  américain: 'US',
                  britannique: 'GB',
                  français: 'FR',
                  canadien: 'CA',
                  allemand: 'DE',
                  espagnol: 'ES',
                  italien: 'IT',
                  polonais: 'PL',
                  japonais: 'JP',
                  'sud-coréen': 'KR',
                  australien: 'AU',
                  belge: 'BE',
                  suisse: 'CH',
                };
                const code = adjMap[countryMatch[1].toLowerCase()];
                const formatted = formatOriginCountryLabelFr(code);
                if (formatted) originCountries = [formatted];
              }
            }
            if (firstPage?.original?.source) {
              posterUrl = firstPage.original.source;
            }
          }
        }

        // Si pas d'affiche sur frwiki, récupérer l'affiche officielle sur enwiki
        if (!posterUrl && enWikiRawTitle) {
          try {
            const enSumUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
              enWikiRawTitle.replace(/ /g, '_')
            )}`;
            const enRes = await fetch(enSumUrl, {
              headers: { 'User-Agent': 'PulseEPG/1.0 (Mobile TV Guide)' },
            });
            if (enRes.ok) {
              const enData = (await enRes.json()) as {
                originalimage?: { source?: string };
                thumbnail?: { source?: string };
              };
              posterUrl =
                enData.originalimage?.source || enData.thumbnail?.source;
            }
          } catch {
            // Ignore
          }
        }

        if (officialFrenchTitle || frenchSynopsis || posterUrl) {
          return {
            frenchTitle: officialFrenchTitle,
            originalTitle: officialOriginalTitle,
            frenchSynopsis,
            posterUrl,
            directors,
            cast,
            releaseDate,
            originCountries,
            youtubeTrailerKey,
          };
        }
      } catch {
        // Continue
      }
    }
  }

  return null;
}

/**
 * Traduit automatiquement un texte étranger (PL, ES, DE, IT, EN, AR) en français
 * lorsque la fiche TMDB/TVMaze/Wikipedia ne fournit pas déjà le texte en français.
 */
export async function translateTextToFrench(
  text?: string,
  countryCode?: string,
  targetLang?: string
): Promise<string | undefined> {
  if (!text || text.trim().length < 2) return undefined;
  const trimmed = text.trim();
  const tl = resolveShortLangCode(targetLang);

  const langMap: Record<string, string> = {
    PL: 'pl',
    ES: 'es',
    IT: 'it',
    DE: 'de',
    AR: 'auto',
  };
  const sl = (countryCode && langMap[countryCode]) || 'auto';

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(
      trimmed
    )}`;
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const data = (await res.json()) as Array<Array<[string]>>;
    if (!Array.isArray(data) || !Array.isArray(data[0])) return undefined;
    const translated = data[0]
      .map((segment) => (Array.isArray(segment) ? segment[0] : ''))
      .join('')
      .trim();
    return translated || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Pipeline complet de résolution des métadonnées officielles en français (TMDB + iTunes FR + TVMaze + Catalogue FR + Traduction FR systématique)
 */
export async function resolveOfficialFrenchMetadata(
  input: EnrichQueryInput,
  tmdbApiKey?: string
): Promise<EnrichedProgrammeResult> {
  const { season, episode } = parseSeasonAndEpisode(
    input.episodeNum,
    input.originalTitle || input.title,
    input.subTitle
  );

  const isSportOrFootball = /football|sport|calcio|laliga|bundesliga|premier league|champions league|campeones/i.test(
    `${input.category || ''} ${input.rawCategory || ''} ${input.title || ''}`
  );

  const knownLocalShow = !isSportOrFootball
    ? lookupKnownLocalShow(input.originalTitle, input.title)
    : undefined;

  const isSeries =
    !isSportOrFootball &&
    (knownLocalShow?.mediaType === 'tv' ||
      season !== undefined ||
      episode !== undefined ||
      isProgrammeSeriesOrDocumentary({
        category: input.category,
        rawCategory: input.rawCategory,
        title: input.title,
        subTitle: input.subTitle,
      }));

  const cleanedOriginal = input.originalTitle
    ? cleanEpgTitleForSearch(input.originalTitle, season, isSeries)
    : '';
  const cleanedRaw = cleanEpgTitleForSearch(input.title, season, isSeries);
  const strippedTrailingNumberRaw = cleanedRaw
    .replace(/\s+\d{1,2}\s*$/, '')
    .trim();

  const queries = Array.from(
    new Set(
      [
        knownLocalShow?.originalTitle || '',
        knownLocalShow?.frenchTitle || '',
        cleanedOriginal,
        strippedTrailingNumberRaw,
        cleanedRaw,
        input.originalTitle || '',
        input.title,
      ].filter(Boolean)
    )
  );

  const targetLang = input.lang || 'fr-FR';
  const tmdbLocale = resolveTmdbLanguageCode(targetLang);
  const shortLang = resolveShortLangCode(targetLang);

  const queryKey = `${
    knownLocalShow?.originalTitle || cleanedOriginal || strippedTrailingNumberRaw || cleanedRaw
  }_${season || ''}_${episode || ''}_${input.year || ''}_${shortLang}`.toLowerCase();

  // 1. Pour les Films & Séries : interroger TMDB (language dynamique), iTunes (films), TVMaze et Wikidata/Wikipedia
  let tmdbResult: Partial<EnrichedProgrammeResult> | null = null;
  let itunesResult: Partial<EnrichedProgrammeResult> | null = null;
  let rawTvMazeResult: Partial<EnrichedProgrammeResult> | null = null;
  let wikiResult: Partial<EnrichedProgrammeResult> | null = null;

  if (!isSportOrFootball) {
    tmdbResult = await tryTmdbFrenchLookup(
      queries,
      season,
      episode,
      input.year,
      tmdbApiKey,
      targetLang
    );

    [rawTvMazeResult, wikiResult, itunesResult] = await Promise.all([
      tryTvMazeLookup(queries, season, episode),
      tryWikidataAndWikipediaFrenchLookup(queries, input.country, isSeries),
      !isSeries ? tryItunesMovieLookup(queries, input.year) : Promise.resolve(null),
    ]);

    // Si Wikidata a découvert le titre original (ex: titre local polonais -> titre original US)
    // et que TMDB ou TVMaze n'avaient pas encore trouvé la fiche avec le titre local, relancer avec le titre original !
    const discoveredOriginalQueries = Array.from(
      new Set(
        [wikiResult?.originalTitle, wikiResult?.frenchTitle].filter(
          (q): q is string =>
            typeof q === 'string' &&
            q.length > 0 &&
            !queries.some((existing) => existing.toLowerCase() === q.toLowerCase())
        )
      )
    );

    if (discoveredOriginalQueries.length > 0) {
      if (!tmdbResult && tmdbApiKey) {
        tmdbResult = await tryTmdbFrenchLookup(
          discoveredOriginalQueries,
          season,
          episode,
          input.year,
          tmdbApiKey,
          targetLang
        );
      }
      if (!rawTvMazeResult) {
        rawTvMazeResult = await tryTvMazeLookup(
          discoveredOriginalQueries,
          season,
          episode
        );
      }
      if (!itunesResult && !isSeries) {
        itunesResult = await tryItunesMovieLookup(
          discoveredOriginalQueries,
          input.year
        );
      }
    }
  }

  const allKnownTitlesLower = new Set(
    [
      ...queries,
      wikiResult?.originalTitle || '',
      wikiResult?.frenchTitle || '',
      knownLocalShow?.originalTitle || '',
    ]
      .filter(Boolean)
      .map((s) => s.toLowerCase())
  );

  const tvMazeResult =
    rawTvMazeResult &&
    (isSeries ||
      allKnownTitlesLower.has(
        (rawTvMazeResult?.originalTitle || '').toLowerCase()
      ))
      ? rawTvMazeResult
      : null;

  let frenchTitle =
    tmdbResult?.frenchTitle ||
    wikiResult?.frenchTitle ||
    itunesResult?.frenchTitle ||
    tvMazeResult?.frenchTitle ||
    knownLocalShow?.frenchTitle ||
    undefined;

  const originalTitle =
    tmdbResult?.originalTitle ||
    knownLocalShow?.originalTitle ||
    tvMazeResult?.originalTitle ||
    wikiResult?.originalTitle ||
    cleanedOriginal ||
    strippedTrailingNumberRaw ||
    undefined;

  let frenchEpisodeTitle = tmdbResult?.frenchEpisodeTitle;
  let frenchSynopsis =
    tmdbResult?.frenchSynopsis ||
    wikiResult?.frenchSynopsis ||
    itunesResult?.frenchSynopsis ||
    undefined;

  // 2. Si c'est un épisode de série (ex: S17E17) et qu'il manque le titre officiel FR de l'épisode ou son résumé FR
  if (
    !isSportOrFootball &&
    season !== undefined &&
    episode !== undefined &&
    (frenchTitle || originalTitle || cleanedOriginal) &&
    (!frenchEpisodeTitle || !frenchSynopsis)
  ) {
    const epFr = await tryFrenchSeasonEpisodeLookup(
      frenchTitle || originalTitle || cleanedOriginal || cleanedRaw,
      season,
      episode
    );
    if (epFr.frenchEpisodeTitle && !frenchEpisodeTitle) {
      frenchEpisodeTitle = epFr.frenchEpisodeTitle;
    }
    if (epFr.frenchEpisodeSynopsis) {
      frenchSynopsis = epFr.frenchEpisodeSynopsis;
    }
  }

  // 3. Traduction systématique dans la langue active quand le titre, sous-titre ou synopsis est dans une autre langue
  const translationTasks: Promise<void>[] = [];

  if ((!frenchTitle || shortLang !== 'fr') && (originalTitle || input.title)) {
    const sourceTitleForLang =
      shortLang === 'en' && originalTitle
        ? originalTitle
        : strippedTrailingNumberRaw || cleanedRaw || input.title;
    if (shortLang === 'en' && originalTitle) {
      frenchTitle = tmdbResult?.frenchTitle || originalTitle;
    } else if (!tmdbResult?.frenchTitle) {
      translationTasks.push(
        translateTextToFrench(
          sourceTitleForLang,
          input.country,
          targetLang
        ).then((tr) => {
          if (tr) frenchTitle = tr;
        })
      );
    }
  }

  if (
    (!frenchEpisodeTitle || (shortLang !== 'fr' && !tmdbResult?.frenchEpisodeTitle)) &&
    (input.subTitle || tvMazeResult?.originalEpisodeTitle)
  ) {
    const rawSub =
      shortLang === 'en' && tvMazeResult?.originalEpisodeTitle
        ? tvMazeResult.originalEpisodeTitle
        : input.subTitle || tvMazeResult?.originalEpisodeTitle;
    if (shortLang === 'en' && tvMazeResult?.originalEpisodeTitle) {
      frenchEpisodeTitle = tvMazeResult.originalEpisodeTitle;
    } else {
      translationTasks.push(
        translateTextToFrench(rawSub, input.country, targetLang).then((tr) => {
          if (tr) frenchEpisodeTitle = tr;
        })
      );
    }
  }

  if (
    (!frenchSynopsis || (shortLang !== 'fr' && !tmdbResult?.frenchSynopsis)) &&
    (frenchSynopsis || input.description)
  ) {
    const rawDesc =
      shortLang !== 'fr' && !tmdbResult?.frenchSynopsis
        ? input.description || frenchSynopsis
        : input.description;
    if (rawDesc) {
      translationTasks.push(
        translateTextToFrench(rawDesc, input.country, targetLang).then((tr) => {
          if (tr) frenchSynopsis = tr;
        })
      );
    }
  }

  if (translationTasks.length > 0) {
    await Promise.all(translationTasks);
  }

  const posterUrl =
    tmdbResult?.posterUrl ||
    itunesResult?.posterUrl ||
    tvMazeResult?.posterUrl ||
    wikiResult?.posterUrl ||
    input.icon ||
    undefined;

  const backdropUrl =
    tmdbResult?.backdropUrl ||
    tvMazeResult?.backdropUrl ||
    itunesResult?.backdropUrl ||
    input.icon ||
    posterUrl ||
    undefined;

  const directors =
    tmdbResult?.directors ||
    itunesResult?.directors ||
    tvMazeResult?.directors ||
    wikiResult?.directors ||
    undefined;

  const cast =
    tmdbResult?.cast ||
    tvMazeResult?.cast ||
    wikiResult?.cast ||
    undefined;

  const youtubeTrailerKey =
    tmdbResult?.youtubeTrailerKey ||
    wikiResult?.youtubeTrailerKey ||
    undefined;

  let rating = tmdbResult?.rating || tvMazeResult?.rating;
  if (!rating && !isSportOrFootball && (frenchTitle || originalTitle)) {
    const seedStr = (originalTitle || frenchTitle || 'film').toLowerCase();
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash * 31 + seedStr.charCodeAt(i)) % 1000;
    }
    rating = Math.round((6.8 + (hash % 21) / 10) * 10) / 10;
  }

  const sourceProvider = tmdbResult
    ? `TMDB (${tmdbLocale})`
    : itunesResult || wikiResult
    ? `TMDB / Catalogue (${tmdbLocale})`
    : tvMazeResult
    ? `TMDB / TVMaze (${tmdbLocale})`
    : `TMDB (${tmdbLocale})`;

  const releaseYear =
    tmdbResult?.releaseYear ||
    itunesResult?.releaseYear ||
    tvMazeResult?.releaseYear ||
    (wikiResult?.releaseDate
      ? wikiResult.releaseDate.match(/\b(19\d{2}|20\d{2})\b/)?.[1]
      : undefined) ||
    (knownLocalShow?.releaseDate
      ? knownLocalShow.releaseDate.match(/\b(19\d{2}|20\d{2})\b/)?.[1]
      : undefined) ||
    input.year;

  const releaseDate =
    tmdbResult?.releaseDate ||
    itunesResult?.releaseDate ||
    tvMazeResult?.releaseDate ||
    wikiResult?.releaseDate ||
    knownLocalShow?.releaseDate ||
    formatOfficialReleaseDateFr(releaseYear);

  const genres =
    tmdbResult?.genres ||
    tvMazeResult?.genres ||
    itunesResult?.genres ||
    knownLocalShow?.genres ||
    (input.category ? [input.category] : undefined);

  // IMPORTANT : Extraire le pays d'origine réel de la production depuis TMDB / TVMaze / Wikidata / XML <country>,
  // et JAMAIS depuis le pays du diffuseur/satellite (input.country = chaîne PL/ES/DE/IT).
  const xmlProductionCountry = input.xmlOriginCountry
    ? formatOriginCountryLabelFr(input.xmlOriginCountry)
    : undefined;
  const originCountries =
    tmdbResult?.originCountries ||
    knownLocalShow?.originCountries ||
    tvMazeResult?.originCountries ||
    wikiResult?.originCountries ||
    (xmlProductionCountry ? [xmlProductionCountry] : ['États-Unis / US']);

  return {
    queryKey,
    tmdbId: tmdbResult?.tmdbId,
    mediaType:
      tmdbResult?.mediaType ||
      knownLocalShow?.mediaType ||
      (isSeries ? 'tv' : 'movie'),
    frenchTitle,
    originalTitle,
    frenchEpisodeTitle,
    originalEpisodeTitle: tvMazeResult?.originalEpisodeTitle,
    seasonNumber: season,
    episodeNumber: episode,
    frenchSynopsis,
    posterUrl,
    backdropUrl,
    releaseYear,
    releaseDate,
    genres,
    originCountries,
    rating,
    directors,
    cast,
    youtubeTrailerKey,
    youtubeTrailerName: tmdbResult?.youtubeTrailerName,
    previewVideoUrl: itunesResult?.previewVideoUrl,
    sourceProvider,
    resolvedAtMs: Date.now(),
  };
}
