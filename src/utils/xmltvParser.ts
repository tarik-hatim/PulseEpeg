import {
  BouquetFilter,
  ChannelGroup,
  ContentCategoryFilter,
  CountryCode,
  EpgBouquetId,
  EpgChannel,
  EpgProgramme,
  SatelliteFilter,
  ThematicCategoryId,
  TvProfileId,
} from '../types/epg';
import {
  SPORT_FOOTBALL_WHITELIST,
  translateEpgTextToFrenchSync,
  WhitelistedChannelSpec,
} from './sportChannelsWhitelist';
import {
  formatSeasonEpisodeCode,
  isProgrammeSeriesOrDocumentary,
  parseSeasonAndEpisode,
} from './metadataResolverCore';
import { buildEutelsat16eExhaustiveChannels } from './eutelsat16eCatalog';
import { resolveOfficialChannelLogoUrl } from './channelLogoResolver';

export type { WhitelistedChannelSpec };

export interface EpgParseFilterOptions {
  tvProfile?: TvProfileId;
  selectedBouquets?: EpgBouquetId[];
  excludePolishLektor?: boolean;
  excludeNoSubtitles?: boolean;
  enabledCategories?: ThematicCategoryId[];
}

export type XmltvFilterOptions = EpgParseFilterOptions;

export const EUTELSAT_16E_AFRICA_TRANSPONDERS = [
  '10804/H/30000',
  '11024/H/3333',
  '12562/H/30000',
  '12604/H/30000',
  '12687/H/29980',
  '11596/H/29980',
  '11637/H/30000',
] as const;

/**
 * Nettoie strictement tout identifiant de chaîne (Channel ID / XMLTV ID)
 * en supprimant tous les espaces, caractères invisibles, guillemets et caractères spéciaux parasites
 * afin de garantir une correspondance 100% exacte entre <channel id="..."> et <programme channel="...">.
 */
export function cleanXmltvChannelId(rawId: string): string {
  if (!rawId) return '';
  return rawId
    .trim()
    .replace(/[\s\u200B-\u200D\uFEFF"'`<>\\|;:]+/g, '')
    .replace(/[^a-zA-Z0-9._+-]/g, '');
}

/**
 * Détecte les faux événements / placeholders vides dans les fichiers EPG XMLTV
 * tels que "No scheduled events", "No Information", "TBA", "Pas de programme", etc.
 */
export function isPlaceholderProgrammeTitle(title?: string | null): boolean {
  if (!title) return true;
  const t = title.trim().toLowerCase();
  if (!t || t === '-' || t === 'n/a' || t === 'na' || t === 'null') return true;
  return (
    t.includes('no scheduled event') ||
    t.includes('no events scheduled') ||
    t.includes('no event scheduled') ||
    t.includes('no information') ||
    t.includes('no program') ||
    t.includes('no guide data') ||
    t.includes('no listings') ||
    t === 'no info' ||
    t === 'no data' ||
    t === 'no epg' ||
    t === 'tba' ||
    t === 'tbc' ||
    t.includes('to be announced') ||
    t.includes('to be confirmed') ||
    t === 'off air' ||
    t === 'off-air' ||
    t === 'sign off' ||
    t.includes('programme sans titre') ||
    t.includes('pas de programme') ||
    t.includes('aucun programme') ||
    t.includes('programme non communiqué') ||
    t.includes('sin programación') ||
    t.includes('brak programu') ||
    t.includes('kein programm') ||
    t.includes('nessun programma') ||
    t.includes('لا توجد برامج')
  );
}

/**
 * Identifie de façon stricte si une chaîne est exclusivement sportive (ex: beIN Sports 1 HD, SSC, Al Kass, DAZN, Sky Sport, Canal+ Foot...)
 * afin de la masquer impérativement lorsque les filtres "Films & Séries" ou "Cinéma Premières" sont actifs.
 */
export function isExclusivelySportChannel(ch: {
  id?: string;
  displayName?: string;
  contentCategory?: ContentCategoryFilter;
  group?: ChannelGroup;
}): boolean {
  if (
    ch.contentCategory === 'Sport / Football' ||
    ch.group === 'Sport / Football'
  ) {
    return true;
  }
  const combined = `${ch.id || ''} ${ch.displayName || ''}`.toLowerCase();
  if (
    combined.includes('movie') ||
    combined.includes('series') ||
    combined.includes('série') ||
    combined.includes('drama') ||
    combined.includes('gourmet') ||
    combined.includes('fatafeat') ||
    combined.includes('baraem') ||
    combined.includes('jeem') ||
    combined.includes('cinema') ||
    combined.includes('cinéma') ||
    combined.includes('box office') ||
    combined.includes('box.office')
  ) {
    return false;
  }
  return /\b(bein\s*sport|bein\s*sports|bein_sport|ssc|al\s*kass|alkass|ad\s*sport|abu\s*dhabi\s*sport|dubai\s*sport|on\s*time\s*sport|arryadia|canal\+?\s*foot|canal\+?\s*sport|rmc\s*sport|eurosport|l'equipe|l’équipe|lequipe|dazn|sky\s*sport|eleven\s*sport|polsat\s*sport|sport\s*tv|movistar\s*laliga|liga\s*de\s*campeones|teledeporte|spor\s*tv|persiana\s*sport|alem\s*sport|turkmenistan\s*sport|türkmenistan\s*sport|supersport|sport\s*klub|maxsport|rtsh\s*sport|crtv\s*sport|digi\s*sport|spiler|spíler)\b/i.test(
    combined
  );
}

/**
 * Décode rapidement les entités XML/HTML courantes (&quot;, &apos;, &amp;, &lt;, &gt;, &#...;)
 */
export function decodeXmlEntities(text: string): string {
  if (!text || !text.includes('&')) return text;
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

/**
 * Convertit une date au format XMLTV (ex: "20260927010000 -0500")
 * en timestamp UTC (millisecondes) pour affichage dans le fuseau horaire local de l'appareil.
 */
export function parseXmltvDate(raw: string): number {
  if (!raw || raw.length < 12) return 0;
  const s = raw.trim();

  const year = parseInt(s.slice(0, 4), 10);
  const month = parseInt(s.slice(4, 6), 10) - 1;
  const day = parseInt(s.slice(6, 8), 10);
  const hour = parseInt(s.slice(8, 10), 10) || 0;
  const minute = parseInt(s.slice(10, 12), 10) || 0;
  const second = s.length >= 14 ? parseInt(s.slice(12, 14), 10) || 0 : 0;

  const utcMs = Date.UTC(year, month, day, hour, minute, second);

  const spaceIdx = s.indexOf(' ');
  if (spaceIdx !== -1 && s.length >= spaceIdx + 6) {
    const tzPart = s.slice(spaceIdx + 1).trim();
    const signChar = tzPart.charAt(0);
    if (signChar === '+' || signChar === '-') {
      const sign = signChar === '-' ? -1 : 1;
      const tzHours = parseInt(tzPart.slice(1, 3), 10) || 0;
      const tzMins = parseInt(tzPart.slice(3, 5), 10) || 0;
      const offsetMs = sign * (tzHours * 3600000 + tzMins * 60000);
      return utcMs - offsetMs;
    }
  }

  return utcMs;
}

/**
 * Traduit et normalise les catégories EPG multilingues (PL, ES, IT, DE, EN -> Français Cinéma, Séries & Football)
 */
export function normalizeCategoryLabel(
  rawCategory: string,
  titleHint?: string,
  channelCategory?: ContentCategoryFilter
): string {
  const combined = `${rawCategory || ''} ${titleHint || ''}`.trim().toLowerCase();

  if (
    combined.includes('champions league') ||
    combined.includes('liga mistrzów') ||
    combined.includes('liga de campeones') ||
    combined.includes('europa league') ||
    combined.includes('conference league') ||
    combined.includes('nations league') ||
    combined.includes('liga narodów')
  ) {
    return 'Football · Coupes d’Europe / UEFA';
  }
  if (
    combined.includes('premier league') ||
    combined.includes('liga angielska') ||
    combined.includes('fa cup') ||
    combined.includes('puchar anglii') ||
    combined.includes('laliga') ||
    combined.includes('la liga') ||
    combined.includes('liga hiszpańska') ||
    combined.includes('copa del rey') ||
    combined.includes('puchar króla') ||
    combined.includes('serie a') ||
    combined.includes('liga włoska') ||
    combined.includes('coppa italia') ||
    combined.includes('puchar włoch') ||
    combined.includes('bundesliga') ||
    combined.includes('liga niemiecka') ||
    combined.includes('dfb-pokal') ||
    combined.includes('puchar niemiec') ||
    combined.includes('calcio') ||
    combined.includes('piłka nożna') ||
    combined.includes('fútbol') ||
    combined.includes('fußball') ||
    combined.includes('football') ||
    combined.includes('soccer')
  ) {
    return 'Football · Grands Championnats & Coupes';
  }
  if (
    combined.includes('sport') ||
    combined.includes('deporte') ||
    combined.includes('afcon') ||
    channelCategory === 'Sport / Football'
  ) {
    return 'Sport & Football Live';
  }

  if (!rawCategory) {
    if (channelCategory === 'Documentaires') return 'Documentaire & Découverte';
    if (channelCategory === 'Actualités / News') return 'Actualités & Information';
    if (channelCategory === 'Jeunesse / Enfants') return 'Jeunesse & Animation';
    if (channelCategory === 'Musique & Divertissement') return 'Musique & Divertissement';
    return 'Cinéma & Série VO';
  }
  const lower = rawCategory.trim().toLowerCase();
  const isSeriesHint =
    /\b(?:serial|série|serie|series|sitcom|miniserie|feuilleton|telenovela)\b/i.test(
      lower
    ) || /\s+\d{1,2}\s*$/.test((titleHint || '').trim());

  if (
    lower.includes('dokument') ||
    lower.includes('documental') ||
    lower.includes('documentario') ||
    lower.includes('documentaire') ||
    lower.includes('documentary') ||
    lower.includes('historia') ||
    lower.includes('history') ||
    lower.includes('natura') ||
    lower.includes('nature') ||
    lower.includes('przyrod') ||
    lower.includes('ciencia') ||
    lower.includes('nauka')
  ) {
    return 'Documentaire & Découverte';
  }

  if (
    lower.includes('kryminaln') ||
    lower.includes('sensacyjn') ||
    lower.includes('policíac') ||
    lower.includes('poliziesco') ||
    lower.includes('krimi') ||
    lower.includes('crime') ||
    lower.includes('thriller') ||
    lower.includes('suspense')
  ) {
    return isSeriesHint
      ? 'Série TV · Thriller & Policier'
      : 'Thriller & Policier';
  }
  if (
    lower.includes('sci-fi') ||
    lower.includes('science') ||
    lower.includes('fantasty') ||
    lower.includes('fantasy') ||
    lower.includes('ciencia ficción') ||
    lower.includes('fantascienza')
  ) {
    return isSeriesHint
      ? 'Série TV · Sci-Fi & Fantastique'
      : 'Sci-Fi & Fantastique';
  }
  if (
    lower.includes('akcj') ||
    lower.includes('acción') ||
    lower.includes('azione') ||
    lower.includes('action') ||
    lower.includes('przygod') ||
    lower.includes('aventura') ||
    lower.includes('avventura') ||
    lower.includes('adventure') ||
    lower.includes('western') ||
    lower.includes('war') ||
    lower.includes('wojen')
  ) {
    return isSeriesHint ? 'Série TV · Action & Aventure' : 'Action & Aventure';
  }
  if (
    lower.includes('horror') ||
    lower.includes('grozy') ||
    lower.includes('terror')
  ) {
    return isSeriesHint ? 'Série TV · Horreur & Frissons' : 'Horreur & Frissons';
  }
  if (
    lower.includes('komedi') ||
    lower.includes('comedia') ||
    lower.includes('commedia') ||
    lower.includes('komödie') ||
    lower.includes('comédie') ||
    lower.includes('comedie') ||
    lower.includes('comedy') ||
    lower.includes('sitcom') ||
    lower.includes('humour')
  ) {
    return isSeriesHint ? 'Série TV · Comédie' : 'Comédie';
  }
  if (
    lower.includes('obyczajow') ||
    lower.includes('dramat') ||
    lower.includes('drama') ||
    lower.includes('drame') ||
    lower.includes('dramatique') ||
    lower.includes('drammatico') ||
    lower.includes('romans') ||
    lower.includes('romance') ||
    lower.includes('melodram')
  ) {
    return isSeriesHint ? 'Série TV · Drame & Romance' : 'Drame & Romance';
  }
  if (
    lower.includes('serial') ||
    lower.includes('serie') ||
    lower.includes('série') ||
    lower.includes('series') ||
    lower.includes('séries') ||
    lower.includes('téléfilm') ||
    lower.includes('telefilm') ||
    lower.includes('feuilleton') ||
    lower.includes('telenovela') ||
    isSeriesHint
  ) {
    return 'Série TV US/Euro';
  }
  if (
    lower.includes('film') ||
    lower.includes('films') ||
    lower.includes('spielfilm') ||
    lower.includes('kino') ||
    lower.includes('cine') ||
    lower.includes('cinéma') ||
    lower.includes('cinema') ||
    lower.includes('película') ||
    lower.includes('pelicula') ||
    lower.includes('movie') ||
    lower.includes('movies') ||
    lower.includes('fiction') ||
    lower.includes('long-métrage') ||
    lower.includes('long metrage')
  ) {
    return 'Long-Métrage Cinéma';
  }
  if (
    lower.includes('animowan') ||
    lower.includes('animación') ||
    lower.includes('animazione') ||
    lower.includes('animation') ||
    lower.includes('dessin animé') ||
    lower.includes('jeunesse') ||
    lower.includes('enfant') ||
    lower.includes('kids') ||
    lower.includes('children') ||
    lower.includes('cartoon') ||
    lower.includes('kinder') ||
    lower.includes('infantil') ||
    lower.includes('bambini') ||
    lower.includes('dla dzieci') ||
    lower.includes('أطفال') ||
    lower.includes('كرتون') ||
    lower.includes('famil')
  ) {
    return 'Jeunesse & Animation';
  }
  if (
    lower.includes('actualit') ||
    lower.includes('news') ||
    lower.includes('information') ||
    lower.includes('journal') ||
    lower.includes('débat') ||
    lower.includes('debat') ||
    lower.includes('politique') ||
    lower.includes('noticias') ||
    lower.includes('nachrichten') ||
    lower.includes('telegiornale') ||
    lower.includes('notiziario') ||
    lower.includes('wiadomości') ||
    lower.includes('informacj') ||
    lower.includes('أخبار') ||
    lower.includes('إخباري')
  ) {
    return 'Actualités & Information';
  }
  if (
    lower.includes('musique') ||
    lower.includes('music') ||
    lower.includes('concert') ||
    lower.includes('divertissement') ||
    lower.includes('entertainment') ||
    lower.includes('variété') ||
    lower.includes('variete') ||
    lower.includes('talk-show') ||
    lower.includes('talk show') ||
    lower.includes('show') ||
    lower.includes('entretenimiento') ||
    lower.includes('música') ||
    lower.includes('unterhaltung') ||
    lower.includes('musik') ||
    lower.includes('intrattenimento') ||
    lower.includes('musica') ||
    lower.includes('rozrywka') ||
    lower.includes('muzyka') ||
    lower.includes('موسيقى') ||
    lower.includes('ترفيه') ||
    lower.includes('منوعات')
  ) {
    return 'Musique & Divertissement';
  }

  return rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);
}

/**
 * Liste élargie des mots-clés de genres / catégories XMLTV pour "Films & Séries"
 */
export const FILM_SERIES_GENRE_KEYWORDS = [
  'film',
  'films',
  'movie',
  'movies',
  'cinéma',
  'cinema',
  'cine',
  'kino',
  'spielfilm',
  'película',
  'pelicula',
  'téléfilm',
  'telefilm',
  'long-métrage',
  'série',
  'serie',
  'series',
  'séries',
  'serial',
  'feuilleton',
  'sitcom',
  'telenovela',
  'fiction',
  'drama',
  'drame',
  'dramatique',
  'dramat',
  'drammatico',
  'action',
  'acción',
  'azione',
  'akcj',
  'aventure',
  'adventure',
  'aventura',
  'thriller',
  'suspense',
  'policier',
  'crime',
  'kryminał',
  'krimi',
  'comédie',
  'comedie',
  'comedy',
  'comedia',
  'commedia',
  'komödie',
  'komedi',
  'science-fiction',
  'sci-fi',
  'fantastique',
  'fantasy',
  'horreur',
  'horror',
  'épouvante',
  'romance',
  'romantique',
  'western',
  'animation',
  'famille',
  'family',
  'culte',
  'classique',
  'अफلام',
  'فيلم',
  'مسلسل',
  'دراما',
  'أكشن',
  'كوميديا',
];

/**
 * Détermine si un programme ou une chaîne correspond au filtre "Films & Séries".
 * Si la chaîne est catégorisée comme "Films & Séries" ou si le programme contient l'un
 * des mots-clés de cinéma/fiction/série dans sa catégorie, son sous-titre ou sa description.
 */
export function isFilmOrSeriesProgramme(
  programme:
    | {
        category?: string;
        rawCategory?: string;
        title?: string;
        subTitle?: string;
        description?: string;
      }
    | null
    | undefined,
  channelCategory?: ContentCategoryFilter
): boolean {
  // Une chaîne exclusivement sportive, documentaire, news, jeunesse ou musicale ne doit JAMAIS passer pour Films & Séries
  if (channelCategory && channelCategory !== 'Films & Séries') {
    return false;
  }
  if (!programme || isPlaceholderProgrammeTitle(programme.title)) {
    return false;
  }

  const combinedText = [
    programme.category || '',
    programme.rawCategory || '',
    programme.subTitle || '',
  ]
    .join(' ')
    .toLowerCase();

  if (
    combinedText.includes('football') ||
    combinedText.includes('sport & football') ||
    combinedText.includes('champions league') ||
    combinedText.includes('premier league') ||
    combinedText.includes('laliga') ||
    combinedText.includes('bundesliga') ||
    combinedText.includes('serie a')
  ) {
    return false;
  }

  if (FILM_SERIES_GENRE_KEYWORDS.some((kw) => combinedText.includes(kw))) {
    return true;
  }

  if (channelCategory === 'Films & Séries') {
    const isExplicitlyOther =
      combinedText.includes('documentaire') ||
      combinedText.includes('documentary') ||
      combinedText.includes('journal télévisé') ||
      combinedText.includes('météo');
    return !isExplicitlyOther;
  }

  return false;
}

const DOC_CULTURE_KEYWORDS = [
  'document',
  'dokument',
  'histoire',
  'historia',
  'history',
  'nature',
  'natura',
  'przyrod',
  'science',
  'ciencia',
  'nauka',
  'découverte',
  'decouverte',
  'discovery',
  'culture',
  'reportage',
  'géopolitique',
  'geopolitics',
  'biographie',
  'planète',
  'planete',
  'wildlife',
  'animal',
  'وثائقي',
  'ثقافة',
  'تاريخ',
  'طبيعة',
  'علوم',
];

const NEWS_INFO_KEYWORDS = [
  'actualit',
  'news',
  'information',
  'journal',
  'jt 20h',
  'jt 13h',
  'débat',
  'debat',
  'politique',
  'économie',
  'economie',
  'noticias',
  'informativo',
  'nachrichten',
  'tagesschau',
  'heute journal',
  'telegiornale',
  'notiziario',
  'wiadomości',
  'fakty',
  'wydarzenia',
  'telejornal',
  'أخبار',
  'نشرة',
  'إخباري',
  'حوار',
];

const KIDS_YOUTH_KEYWORDS = [
  'jeunesse',
  'enfant',
  'kids',
  'children',
  'cartoon',
  'dessin animé',
  'dessin anime',
  'animation',
  'animé',
  'anime',
  'manga',
  'kinder',
  'zeichentrick',
  'infantil',
  'dibujos',
  'bambini',
  'ragazzi',
  'animazione',
  'dla dzieci',
  'animowan',
  'desenhos',
  'أطفال',
  'كرتون',
  'رسوم متحركة',
  'براعم',
];

const MUSIC_ENT_KEYWORDS = [
  'musique',
  'music',
  'concert',
  'clip',
  'divertissement',
  'entertainment',
  'variété',
  'variete',
  'show',
  'talk-show',
  'talk show',
  'télé-réalité',
  'reality',
  'jeu ',
  'game show',
  'magazine',
  'lifestyle',
  'cuisine',
  'cooking',
  'gastronomie',
  'humour',
  'spectacle',
  'entretenimiento',
  'música',
  'unterhaltung',
  'musik',
  'intrattenimento',
  'musica',
  'rozrywka',
  'muzyka',
  'موسيقى',
  'ترفيه',
  'منوعات',
  'طبخ',
  'حفل',
];

const SPORT_KEYWORDS = [
  'sport',
  'football',
  'soccer',
  'fútbol',
  'futbol',
  'fußball',
  'fussball',
  'calcio',
  'piłka nożna',
  'futebol',
  'champions league',
  'europa league',
  'premier league',
  'laliga',
  'la liga',
  'serie a',
  'bundesliga',
  'ligue 1',
  'copa',
  'coupe',
  'tennis',
  'basketball',
  'nba',
  'formula 1',
  'formule 1',
  'motogp',
  'rugby',
  'handball',
  'ufc',
  'boxing',
  'boxe',
  'cyclisme',
  'athletics',
  'رياضة',
  'كرة القدم',
  'مباراة',
  'دوري',
];

export function matchesProgrammeCategory(
  programme:
    | {
        category?: string;
        rawCategory?: string;
        title?: string;
        subTitle?: string;
        description?: string;
        group?: ChannelGroup;
      }
    | null
    | undefined,
  targetCategory: ContentCategoryFilter,
  channelCategory?: Exclude<ContentCategoryFilter, 'Tous'>
): boolean {
  if (!programme || isPlaceholderProgrammeTitle(programme.title)) {
    return false;
  }
  if (targetCategory === 'Tous') return true;

  // Séparation stricte : une chaîne Sport / Football ne peut JAMAIS correspondre à une autre catégorie
  if (
    channelCategory === 'Sport / Football' &&
    targetCategory !== 'Sport / Football'
  ) {
    return false;
  }
  if (
    targetCategory === 'Sport / Football' &&
    channelCategory &&
    channelCategory !== 'Sport / Football'
  ) {
    return false;
  }

  if (targetCategory === 'Films & Séries') {
    return (
      channelCategory === 'Films & Séries' &&
      isFilmOrSeriesProgramme(programme, channelCategory)
    );
  }

  if (channelCategory === targetCategory) return true;

  const combined = [
    programme.category || '',
    programme.rawCategory || '',
    programme.title || '',
    programme.subTitle || '',
  ]
    .join(' ')
    .toLowerCase();

  if (
    targetCategory === 'Documentaires' &&
    channelCategory === 'Documentaires'
  ) {
    return DOC_CULTURE_KEYWORDS.some((kw) => combined.includes(kw)) || true;
  }
  if (
    targetCategory === 'Actualités / News' &&
    channelCategory === 'Actualités / News'
  ) {
    return NEWS_INFO_KEYWORDS.some((kw) => combined.includes(kw)) || true;
  }
  if (
    targetCategory === 'Jeunesse / Enfants' &&
    channelCategory === 'Jeunesse / Enfants'
  ) {
    return KIDS_YOUTH_KEYWORDS.some((kw) => combined.includes(kw)) || true;
  }
  if (
    targetCategory === 'Musique & Divertissement' &&
    channelCategory === 'Musique & Divertissement'
  ) {
    return MUSIC_ENT_KEYWORDS.some((kw) => combined.includes(kw)) || true;
  }
  return false;
}

export function matchesProgrammeGenreGroup(
  programme:
    | {
        category?: string;
        rawCategory?: string;
        title?: string;
        subTitle?: string;
        group?: ChannelGroup;
      }
    | null
    | undefined,
  targetGroup: ChannelGroup,
  channelGroup?: Exclude<ChannelGroup, 'Tous'>,
  channelCategory?: Exclude<ContentCategoryFilter, 'Tous'>
): boolean {
  if (!programme || isPlaceholderProgrammeTitle(programme.title)) {
    return false;
  }
  if (targetGroup === 'Toutes' || targetGroup === 'Tous') return true;

  // Masquage strict : une chaîne Sport / Football ne correspond JAMAIS à un genre Cinéma/Séries/Docu/etc.
  if (
    (channelGroup === 'Sport / Football' ||
      channelCategory === 'Sport / Football') &&
    targetGroup !== 'Sport / Football'
  ) {
    return false;
  }
  if (
    targetGroup === 'Sport / Football' &&
    channelGroup !== 'Sport / Football' &&
    channelCategory !== 'Sport / Football'
  ) {
    return false;
  }

  const isCinemaSubGenre =
    targetGroup === 'Cinéma Premières' ||
    targetGroup === 'Action & Thriller' ||
    targetGroup === 'Séries TV & US' ||
    targetGroup === 'Comédie & Famille' ||
    targetGroup === 'Classiques & Culte';

  // Si le filtre de genre est un sous-genre Cinéma/Séries, la chaîne DOIT appartenir à la catégorie Films & Séries
  if (
    isCinemaSubGenre &&
    channelCategory &&
    channelCategory !== 'Films & Séries'
  ) {
    return false;
  }

  if (channelGroup === targetGroup) return true;
  if (programme.group && programme.group === targetGroup) return true;

  const combined = [
    programme.category || '',
    programme.rawCategory || '',
    programme.title || '',
    programme.subTitle || '',
  ]
    .join(' ')
    .toLowerCase();

  // Protection contre "Serie A" / "Serie B" ou "Football" dans les genres Cinéma/Séries
  if (
    isCinemaSubGenre &&
    (combined.includes('football') ||
      combined.includes('calcio') ||
      combined.includes('serie a') ||
      combined.includes('serie b') ||
      combined.includes('champions league') ||
      combined.includes('premier league') ||
      combined.includes('laliga'))
  ) {
    return false;
  }

  if (targetGroup === 'Sport / Football') {
    return SPORT_KEYWORDS.some((kw) => combined.includes(kw));
  }
  if (targetGroup === 'Documentaires') {
    return (
      channelCategory === 'Documentaires' &&
      DOC_CULTURE_KEYWORDS.some((kw) => combined.includes(kw))
    );
  }
  if (targetGroup === 'Actualités / News') {
    return (
      channelCategory === 'Actualités / News' &&
      NEWS_INFO_KEYWORDS.some((kw) => combined.includes(kw))
    );
  }
  if (targetGroup === 'Jeunesse / Enfants') {
    return (
      channelCategory === 'Jeunesse / Enfants' &&
      KIDS_YOUTH_KEYWORDS.some((kw) => combined.includes(kw))
    );
  }
  if (targetGroup === 'Musique & Divertissement') {
    return (
      channelCategory === 'Musique & Divertissement' &&
      MUSIC_ENT_KEYWORDS.some((kw) => combined.includes(kw))
    );
  }
  if (targetGroup === 'Action & Thriller') {
    return (
      combined.includes('action') ||
      combined.includes('thriller') ||
      combined.includes('policier') ||
      combined.includes('crime') ||
      combined.includes('suspense') ||
      combined.includes('aventure') ||
      combined.includes('adventure') ||
      combined.includes('sci-fi') ||
      combined.includes('horreur') ||
      combined.includes('horror') ||
      combined.includes('أكشن') ||
      combined.includes('إثارة')
    );
  }
  if (targetGroup === 'Comédie & Famille') {
    return (
      combined.includes('comédie') ||
      combined.includes('comedie') ||
      combined.includes('comedy') ||
      combined.includes('comedia') ||
      combined.includes('humour') ||
      combined.includes('sitcom') ||
      combined.includes('famille') ||
      combined.includes('family') ||
      combined.includes('animation') ||
      combined.includes('كوميديا') ||
      combined.includes('عائلي')
    );
  }
  if (targetGroup === 'Séries TV & US') {
    return (
      combined.includes('série') ||
      combined.includes('serie') ||
      combined.includes('series') ||
      combined.includes('serial') ||
      combined.includes('feuilleton') ||
      combined.includes('telenovela') ||
      combined.includes('drama') ||
      combined.includes('drame') ||
      combined.includes('مسلسل') ||
      combined.includes('دراما')
    );
  }
  if (targetGroup === 'Classiques & Culte') {
    return (
      combined.includes('classique') ||
      combined.includes('classic') ||
      combined.includes('culte') ||
      combined.includes('western') ||
      combined.includes('أفلام كلاسيكية')
    );
  }
  if (targetGroup === 'Cinéma Premières') {
    return (
      channelGroup === 'Cinéma Premières' ||
      combined.includes('long-métrage') ||
      combined.includes('película') ||
      combined.includes('spielfilm') ||
      combined.includes('cinéma / film') ||
      combined.includes('فيلم') ||
      combined.includes('أفلام')
    );
  }
  return false;
}

interface RawCinemaChannelSpec {
  canonicalId: string;
  displayName: string;
  contentCategory?: Exclude<ContentCategoryFilter, 'Tous'>;
  country: Exclude<CountryCode, 'Tous'>;
  satellites: string[];
  orbitalPosition: string;
  bouquets: string[];
  bouquetId?: EpgBouquetId;
  group: Exclude<ChannelGroup, 'Tous'>;
  audioTrackLabel: string;
  subtitleTrackLabel: string;
  lektorStatus?: string;
  hasPolishLektor?: boolean;
  hasSubtitles?: boolean;
  defaultIcon?: string;
}

const STRICT_CHANNEL_WHITELIST: Record<string, RawCinemaChannelSpec> = {
  // ===========================================================================
  // 1. HOTBIRD 13°E — BOUQUETS CINÉMA POLOGNE (SANS LEKTOR · PISTE VO EN + DVB-SUB)
  // Exclusivement HBO 1/2/3, Cinemax 1/2, AXN, Canal+ Premium/Film/Series, FilmBox
  // ===========================================================================
  'hbo.hd.pl': {
    canonicalId: 'HBO.HD.pl',
    displayName: 'HBO 1 HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['HBO / Cinemax'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'hbo.pl': {
    canonicalId: 'HBO.HD.pl',
    displayName: 'HBO 1 HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['HBO / Cinemax'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'hbo2.hd.pl': {
    canonicalId: 'HBO2.HD.pl',
    displayName: 'HBO 2 HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['HBO / Cinemax'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'hbo2.pl': {
    canonicalId: 'HBO2.HD.pl',
    displayName: 'HBO 2 HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['HBO / Cinemax'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'hbo3.hd.pl': {
    canonicalId: 'HBO3.HD.pl',
    displayName: 'HBO 3 HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['HBO / Cinemax'],
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'hbo3.pl': {
    canonicalId: 'HBO3.HD.pl',
    displayName: 'HBO 3 HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['HBO / Cinemax'],
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'cinemax.hd.pl': {
    canonicalId: 'Cinemax.HD.pl',
    displayName: 'Cinemax 1 HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['HBO / Cinemax'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'cinemax.pl': {
    canonicalId: 'Cinemax.HD.pl',
    displayName: 'Cinemax 1 HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['HBO / Cinemax'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'cinemax2.hd.pl': {
    canonicalId: 'Cinemax2.HD.pl',
    displayName: 'Cinemax 2 HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['HBO / Cinemax'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'cinemax2.pl': {
    canonicalId: 'Cinemax2.HD.pl',
    displayName: 'Cinemax 2 HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['HBO / Cinemax'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'axn.hd.pl': {
    canonicalId: 'AXN.HD.pl',
    displayName: 'AXN HD (Hotbird)',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['AXN / Warner / Sci-Fi'],
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'axn.pl': {
    canonicalId: 'AXN.HD.pl',
    displayName: 'AXN HD (Hotbird)',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['AXN / Warner / Sci-Fi'],
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'axn.black.pl': {
    canonicalId: 'AXN.Black.pl',
    displayName: 'AXN Black (Hotbird)',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['AXN / Warner / Sci-Fi'],
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'axn.white.pl': {
    canonicalId: 'AXN.White.pl',
    displayName: 'AXN White (Hotbird)',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['AXN / Warner / Sci-Fi'],
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'axn.spin.hd.pl': {
    canonicalId: 'AXN.Spin.HD.pl',
    displayName: 'AXN Spin HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['AXN / Warner / Sci-Fi'],
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'axn.spin.pl': {
    canonicalId: 'AXN.Spin.HD.pl',
    displayName: 'AXN Spin HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['AXN / Warner / Sci-Fi'],
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'canal+.premium.hd.pl': {
    canonicalId: 'CANAL+.PREMIUM.HD.pl',
    displayName: 'Canal+ Premium HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'canal+.premium.pl': {
    canonicalId: 'CANAL+.PREMIUM.HD.pl',
    displayName: 'Canal+ Premium HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'canal+.1.hd.pl': {
    canonicalId: 'CANAL+.1.HD.pl',
    displayName: 'Canal+ 1 HD (Cinéma)',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'canal+.1.pl': {
    canonicalId: 'CANAL+.1.HD.pl',
    displayName: 'Canal+ 1 HD (Cinéma)',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'canal+.film.hd.pl': {
    canonicalId: 'CANAL+.Film.HD.pl',
    displayName: 'Canal+ Film HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'canal+.film.pl': {
    canonicalId: 'CANAL+.Film.HD.pl',
    displayName: 'Canal+ Film HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'canal+.seriale.hd.pl': {
    canonicalId: 'CANAL+.Seriale.HD.pl',
    displayName: 'Canal+ Series HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'canal+.seriale.pl': {
    canonicalId: 'CANAL+.Seriale.HD.pl',
    displayName: 'Canal+ Series HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'filmbox.premium.hd.pl': {
    canonicalId: 'FilmBox.Premium.HD.pl',
    displayName: 'FilmBox Premium HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'filmbox.extra.hd.pl': {
    canonicalId: 'FilmBox.Extra.HD.pl',
    displayName: 'FilmBox Extra HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'filmbox.action.pl': {
    canonicalId: 'FilmBox.Action.pl',
    displayName: 'FilmBox Action',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'filmbox.family.pl': {
    canonicalId: 'FilmBox.Family.pl',
    displayName: 'FilmBox Family',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Comédie & Famille',
    audioTrackLabel: 'VO Anglais (Original)',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'filmbox.arthouse.hd.pl': {
    canonicalId: 'FilmBox.Arthouse.HD.pl',
    displayName: 'FilmBox Arthouse HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'VO Originale',
    subtitleTrackLabel: 'DVB-Sub EN/PL',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'filmbox.arthouse.pl': {
    canonicalId: 'FilmBox.Arthouse.HD.pl',
    displayName: 'FilmBox Arthouse HD',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'VO Originale',
    subtitleTrackLabel: 'DVB-Sub EN/PL',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },

  // ===========================================================================
  // 2. HISPASAT 30°W / ASTRA 19.2°E — MOVISTAR+ (ESPAGNE · FILMS & SÉRIES VO + SUB)
  // ===========================================================================
  'movistar.plus+.es': {
    canonicalId: 'Movistar.Plus+.es',
    displayName: 'Movistar Plus+ HD',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'm+.estrenos.es': {
    canonicalId: 'M+.Estrenos.es',
    displayName: 'M+ Estrenos (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'estrenos.por.m+.es': {
    canonicalId: 'M+.Estrenos.es',
    displayName: 'M+ Estrenos (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'm+.acción.es': {
    canonicalId: 'M+.Acción.es',
    displayName: 'M+ Acción (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'acción.por.m+.es': {
    canonicalId: 'M+.Acción.es',
    displayName: 'M+ Acción (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'm+.drama.es': {
    canonicalId: 'M+.Drama.es',
    displayName: 'M+ Drama (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'drama.por.m+.es': {
    canonicalId: 'M+.Drama.es',
    displayName: 'M+ Drama (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'm+.comedia.es': {
    canonicalId: 'M+.Comedia.es',
    displayName: 'M+ Comedia (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Comédie & Famille',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'comedia.por.m+.es': {
    canonicalId: 'M+.Comedia.es',
    displayName: 'M+ Comedia (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Comédie & Famille',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'm+.clásicos.es': {
    canonicalId: 'M+.Clásicos.es',
    displayName: 'M+ Clásicos (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'clásicos.por.m+.es': {
    canonicalId: 'M+.Clásicos.es',
    displayName: 'M+ Clásicos (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'm+.hits.es': {
    canonicalId: 'M+.Hits.es',
    displayName: 'M+ Hits (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'hits.por.m+.es': {
    canonicalId: 'M+.Hits.es',
    displayName: 'M+ Hits (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'm+.indie.es': {
    canonicalId: 'M+.Indie.es',
    displayName: 'M+ Indie (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'indie.por.m+.es': {
    canonicalId: 'M+.Indie.es',
    displayName: 'M+ Indie (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'm+.originales.es': {
    canonicalId: 'M+.Originales.es',
    displayName: 'M+ Originales (Séries & Films)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'originales.por.m+.es': {
    canonicalId: 'M+.Originales.es',
    displayName: 'M+ Originales (Séries & Films)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'skyshowtime.1.es': {
    canonicalId: 'SkyShowtime.1.es',
    displayName: 'SkyShowtime 1 (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'skyshowtime.es': {
    canonicalId: 'SkyShowtime.1.es',
    displayName: 'SkyShowtime 1 (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'axn.es': {
    canonicalId: 'AXN.es',
    displayName: 'AXN HD (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+', 'AXN / Warner / Sci-Fi'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'axn.movies.es': {
    canonicalId: 'AXN.Movies.es',
    displayName: 'AXN Movies (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+', 'AXN / Warner / Sci-Fi'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'warner.tv.es': {
    canonicalId: 'Warner.TV.es',
    displayName: 'Warner TV (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+', 'AXN / Warner / Sci-Fi'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'calle.13.es': {
    canonicalId: 'Calle.13.es',
    displayName: 'Calle 13 (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+', 'AXN / Warner / Sci-Fi'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'syfy.es': {
    canonicalId: 'Syfy.es',
    displayName: 'Syfy (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+', 'AXN / Warner / Sci-Fi'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'cosmo.es': {
    canonicalId: 'COSMO.es',
    displayName: 'COSMO HD (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'hollywood.es': {
    canonicalId: 'Hollywood.es',
    displayName: 'Canal Hollywood (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'c.hollywood.es': {
    canonicalId: 'Hollywood.es',
    displayName: 'Canal Hollywood (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'amc.es': {
    canonicalId: 'AMC.es',
    displayName: 'AMC HD (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'comedy.central.hd.es': {
    canonicalId: 'Comedy.Central.HD.es',
    displayName: 'Comedy Central HD (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Comédie & Famille',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'tcm.es': {
    canonicalId: 'TCM.es',
    displayName: 'TCM Cinéma (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sundance.tv.es': {
    canonicalId: 'Sundance.TV.es',
    displayName: 'Sundance TV (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'xtrm.es': {
    canonicalId: 'XTRM.es',
    displayName: 'XTRM Action (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'dark.es': {
    canonicalId: 'Dark.es',
    displayName: 'Dark Horror (Movistar+)',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },

  // ===========================================================================
  // 3. ASTRA 19.2°E — SKY DEUTSCHLAND (ALLEMAGNE · FILMS & SÉRIES VO + SUB)
  // ===========================================================================
  'sky.cinema.premiere.hd.de': {
    canonicalId: 'Sky.Cinema.Premiere.HD.de',
    displayName: 'Sky Cinema Premiere HD (DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.action.hd.de': {
    canonicalId: 'Sky.Cinema.Action.HD.de',
    displayName: 'Sky Cinema Action HD (DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.highlights.hd.de': {
    canonicalId: 'Sky.Cinema.Highlights.HD.de',
    displayName: 'Sky Cinema Highlights HD (DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.family.hd.de': {
    canonicalId: 'Sky.Cinema.Family.HD.de',
    displayName: 'Sky Cinema Family HD (DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Comédie & Famille',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.classics.hd.de': {
    canonicalId: 'Sky.Cinema.Classics.HD.de',
    displayName: 'Sky Cinema Classics HD (DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.atlantic.hd.de': {
    canonicalId: 'Sky.Atlantic.HD.de',
    displayName: 'Sky Atlantic HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE', 'HBO / Cinemax'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.one.de': {
    canonicalId: 'Sky.One.de',
    displayName: 'Sky One HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.krimi.de': {
    canonicalId: 'Sky.Krimi.de',
    displayName: 'Sky Krimi HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.showcase.hd.de': {
    canonicalId: 'Sky.Showcase.HD.de',
    displayName: 'Sky Showcase HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.showcase.de': {
    canonicalId: 'Sky.Showcase.HD.de',
    displayName: 'Sky Showcase HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.replay.hd.de': {
    canonicalId: 'Sky.Replay.HD.de',
    displayName: 'Sky Replay HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.replay.de': {
    canonicalId: 'Sky.Replay.HD.de',
    displayName: 'Sky Replay HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.crime.de': {
    canonicalId: 'Sky.Crime.de',
    displayName: 'Sky Crime HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'warner.tv.film.de': {
    canonicalId: 'Warner.TV.Film.de',
    displayName: 'Warner TV Film HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE', 'AXN / Warner / Sci-Fi'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'warner.tv.serie.de': {
    canonicalId: 'Warner.TV.Serie.de',
    displayName: 'Warner TV Serie HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE', 'AXN / Warner / Sci-Fi'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'warner.tv.comedy.de': {
    canonicalId: 'Warner.TV.Comedy.de',
    displayName: 'Warner TV Comedy HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE', 'AXN / Warner / Sci-Fi'],
    group: 'Comédie & Famille',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  '13th.street.universal.de': {
    canonicalId: '13th.Street.Universal.de',
    displayName: '13th Street Universal (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE', 'AXN / Warner / Sci-Fi'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'syfy.de': {
    canonicalId: 'SyFy.de',
    displayName: 'Syfy HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE', 'AXN / Warner / Sci-Fi'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'universal.channel.hd.de': {
    canonicalId: 'Universal.Channel.HD.de',
    displayName: 'Universal TV HD (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'axn.black.de': {
    canonicalId: 'AXN.Black.de',
    displayName: 'AXN Black HD (Astra)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE', 'AXN / Warner / Sci-Fi'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'axn.white.de': {
    canonicalId: 'AXN.White.de',
    displayName: 'AXN White HD (Astra)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE', 'AXN / Warner / Sci-Fi'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'kinowelttv.de': {
    canonicalId: 'KinoweltTV.de',
    displayName: 'KinoweltTV (Sky DE)',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },

  // ===========================================================================
  // 4. HOTBIRD 13°E — SKY ITALIA (ITALIE · FILMS & SÉRIES VO + SUB)
  // ===========================================================================
  'sky.cinema.uno.it': {
    canonicalId: 'Sky.Cinema.Uno.it',
    displayName: 'Sky Cinema Uno HD (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.uno.+24.it': {
    canonicalId: 'Sky.Cinema.Uno.it',
    displayName: 'Sky Cinema Uno HD (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.due.it': {
    canonicalId: 'Sky.Cinema.Due.it',
    displayName: 'Sky Cinema Due HD (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.due.+24.it': {
    canonicalId: 'Sky.Cinema.Due.it',
    displayName: 'Sky Cinema Due HD (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Classiques & Culte',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.collection.it': {
    canonicalId: 'Sky.Cinema.Collection.it',
    displayName: 'Sky Cinema Collection (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.action.it': {
    canonicalId: 'Sky.Cinema.Action.it',
    displayName: 'Sky Cinema Action (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.suspense.it': {
    canonicalId: 'Sky.Cinema.Suspense.it',
    displayName: 'Sky Cinema Suspense (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.family.it': {
    canonicalId: 'Sky.Cinema.Family.it',
    displayName: 'Sky Cinema Family (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Comédie & Famille',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.romance.it': {
    canonicalId: 'Sky.Cinema.Romance.it',
    displayName: 'Sky Cinema Romance (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.drama.it': {
    canonicalId: 'Sky.Cinema.Drama.it',
    displayName: 'Sky Cinema Drama (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.cinema.comedy.it': {
    canonicalId: 'Sky.Cinema.Comedy.it',
    displayName: 'Sky Cinema Comedy (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Comédie & Famille',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.atlantic.it': {
    canonicalId: 'Sky.Atlantic.it',
    displayName: 'Sky Atlantic HD (Sky IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia', 'HBO / Cinemax'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.atlantic.maratone.it': {
    canonicalId: 'Sky.Atlantic.it',
    displayName: 'Sky Atlantic HD (Sky IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia', 'HBO / Cinemax'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.serie.it': {
    canonicalId: 'Sky.Serie.it',
    displayName: 'Sky Serie HD (Sky IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.serie.maratone.it': {
    canonicalId: 'Sky.Serie.it',
    displayName: 'Sky Serie HD (Sky IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.investigation.it': {
    canonicalId: 'Sky.Investigation.it',
    displayName: 'Sky Investigation HD (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.investigation.+1.hd.it': {
    canonicalId: 'Sky.Investigation.it',
    displayName: 'Sky Investigation HD (IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.uno.it': {
    canonicalId: 'Sky.Uno.it',
    displayName: 'Sky Uno HD (Sky IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Séries TV & US',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.crime.it': {
    canonicalId: 'Sky.Crime.it',
    displayName: 'Sky Crime HD (Sky IT)',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    group: 'Action & Thriller',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },

  // ===========================================================================
  // 5. NILESAT 7°W & BADR / ES'HAILSAT 26°E — BOUQUETS MENA TOUTES CATÉGORIES
  // (Films & Séries, Documentaires, Actualités/News, Jeunesse, Musique & Divertissement)
  // ===========================================================================
  'mbc.1.ae': {
    canonicalId: 'MBC.1.nilesat',
    displayName: 'MBC 1 HD (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Musique & Divertissement',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Musique & Divertissement',
    audioTrackLabel: 'Audio Arabe / Multi',
    subtitleTrackLabel: 'Séries, Divertissement & Variétés MENA',
  },
  'mbc.1.eg': {
    canonicalId: 'MBC.1.nilesat',
    displayName: 'MBC 1 HD (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Musique & Divertissement',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Musique & Divertissement',
    audioTrackLabel: 'Audio Arabe / Multi',
    subtitleTrackLabel: 'Séries, Divertissement & Variétés MENA',
  },
  'mbc.2.ae': {
    canonicalId: 'MBC.2.nilesat',
    displayName: 'MBC 2 HD (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'mbc.2.eg': {
    canonicalId: 'MBC.2.nilesat',
    displayName: 'MBC 2 HD (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'mbc.3.ae': {
    canonicalId: 'MBC.3.nilesat',
    displayName: 'MBC 3 HD Kids (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Jeunesse / Enfants',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Jeunesse / Enfants',
    audioTrackLabel: 'Dual Audio AR / EN',
    subtitleTrackLabel: 'Dessins Animés & Jeunesse',
  },
  'mbc.3.eg': {
    canonicalId: 'MBC.3.nilesat',
    displayName: 'MBC 3 HD Kids (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Jeunesse / Enfants',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Jeunesse / Enfants',
    audioTrackLabel: 'Dual Audio AR / EN',
    subtitleTrackLabel: 'Dessins Animés & Jeunesse',
  },
  'mbc.4.ae': {
    canonicalId: 'MBC.4.nilesat',
    displayName: 'MBC 4 HD Series (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais / Multi',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'mbc.4.eg': {
    canonicalId: 'MBC.4.nilesat',
    displayName: 'MBC 4 HD Series (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais / Multi',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'mbc.drama.ae': {
    canonicalId: 'MBC.Drama.nilesat',
    displayName: 'MBC Drama HD (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Séries TV & US',
    audioTrackLabel: 'Audio Original HD',
    subtitleTrackLabel: 'Séries & Feuilletons',
  },
  'en:.mbc.max.sa': {
    canonicalId: 'MBC.Max.nilesat',
    displayName: 'MBC Max HD (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'mbc.max.eg': {
    canonicalId: 'MBC.Max.nilesat',
    displayName: 'MBC Max HD (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'mbc.action.ae': {
    canonicalId: 'MBC.Action.nilesat',
    displayName: 'MBC Action HD (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'en:.mbc.action.sa': {
    canonicalId: 'MBC.Action.nilesat',
    displayName: 'MBC Action HD (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'mbc.action.eg': {
    canonicalId: 'MBC.Action.nilesat',
    displayName: 'MBC Action HD (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'osn.tv.movies.premiere.sa': {
    canonicalId: 'OSN.Movies.Premiere.nilesat',
    displayName: 'OSN TV Movies Premiere (Nilesat 7°W)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['Nilesat OSN/MBC'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Dolby)',
    subtitleTrackLabel: 'DVB-Sub AR/EN',
    defaultIcon: 'https://content.osn.com/logo/channel/cropped/OM1.png',
  },
  'osn.tv.movies.action.sa': {
    canonicalId: 'OSN.Movies.Action.nilesat',
    displayName: 'OSN TV Movies Action (Nilesat 7°W)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['Nilesat OSN/MBC'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais (Dolby)',
    subtitleTrackLabel: 'DVB-Sub AR/EN',
    defaultIcon: 'https://content.osn.com/logo/channel/cropped/AHD.png',
  },
  'en:.movies.action.sa': {
    canonicalId: 'OSN.Movies.Action.nilesat',
    displayName: 'OSN TV Movies Action (Nilesat 7°W)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['Nilesat OSN/MBC'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais (Dolby)',
    subtitleTrackLabel: 'DVB-Sub AR/EN',
    defaultIcon: 'https://content.osn.com/logo/channel/cropped/AHD.png',
  },
  'osn.tv.movies.hollywood.sa': {
    canonicalId: 'OSN.Movies.Hollywood.nilesat',
    displayName: 'OSN TV Movies Hollywood (Nilesat 7°W)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['Nilesat OSN/MBC'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Dolby)',
    subtitleTrackLabel: 'DVB-Sub AR/EN',
    defaultIcon: 'https://content.osn.com/logo/channel/cropped/OPR.png',
  },
  'osn.tv.showcase.sa': {
    canonicalId: 'OSN.Series.nilesat',
    displayName: 'OSN TV Series (Nilesat 7°W)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['Nilesat OSN/MBC'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais (Dolby)',
    subtitleTrackLabel: 'DVB-Sub AR/EN',
    defaultIcon: 'https://content.osn.com/logo/channel/cropped/OSH.png',
  },
  'osn.tv.one.sa': {
    canonicalId: 'OSN.Series.nilesat',
    displayName: 'OSN TV Series (Nilesat 7°W)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['Nilesat OSN/MBC'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais (Dolby)',
    subtitleTrackLabel: 'DVB-Sub AR/EN',
    defaultIcon: 'https://content.osn.com/logo/channel/cropped/OSH.png',
  },
  'dubai.one.hd.ae': {
    canonicalId: 'Dubai.One.nilesat',
    displayName: 'Dubai One HD (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'dubai.one.eg': {
    canonicalId: 'Dubai.One.nilesat',
    displayName: 'Dubai One HD (Nilesat 7°W / Badr 26°E)',
    contentCategory: 'Films & Séries',
    country: 'AR',
    satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
    orbitalPosition: 'Nilesat 7°W / Badr 26°E',
    bouquets: ['Nilesat OSN/MBC', 'Badr Sport & MENA'],
    bouquetId: 'nilesat_osn_mbc',
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },

  // ===========================================================================
  // 6. ASTRA 19.2°E — ASTRA CANAL+ (FRANCE · CINÉMA, SÉRIES & DOCUMENTAIRES)
  // ===========================================================================
  'canal+.fr': {
    canonicalId: 'CANAL+.HD.fr',
    displayName: 'Canal+ HD (Astra 19.2°E)',
    country: 'FR',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Canal+'],
    bouquetId: 'astra_canal_fr',
    group: 'Cinéma Premières',
    audioTrackLabel: 'VM Français / VO Anglais',
    subtitleTrackLabel: 'DVB-Sub FR / Malentendants',
  },
  'canal+.cinema.fr': {
    canonicalId: 'CANAL+.Cinema.fr',
    displayName: 'Canal+ Cinéma(s) HD (Astra)',
    country: 'FR',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Canal+'],
    bouquetId: 'astra_canal_fr',
    group: 'Cinéma Premières',
    audioTrackLabel: 'VM Français / VO Anglais',
    subtitleTrackLabel: 'DVB-Sub FR / VOST',
  },
  'canal+.box.office.fr': {
    canonicalId: 'CANAL+.Box.Office.fr',
    displayName: 'Canal+ Box Office HD (Astra)',
    country: 'FR',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Canal+'],
    bouquetId: 'astra_canal_fr',
    group: 'Cinéma Premières',
    audioTrackLabel: 'VM Français / VO Anglais',
    subtitleTrackLabel: 'DVB-Sub FR / VOST',
  },
  'canal+.grand.ecran.fr': {
    canonicalId: 'CANAL+.Grand.Ecran.fr',
    displayName: 'Canal+ Grand Écran HD (Astra)',
    country: 'FR',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Canal+'],
    bouquetId: 'astra_canal_fr',
    group: 'Classiques & Culte',
    audioTrackLabel: 'VM Français / VO Anglais',
    subtitleTrackLabel: 'DVB-Sub FR / VOST',
  },
  'canal+.series.fr': {
    canonicalId: 'CANAL+.Series.fr',
    displayName: 'Canal+ Séries HD (Astra)',
    country: 'FR',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Canal+'],
    bouquetId: 'astra_canal_fr',
    group: 'Séries TV & US',
    audioTrackLabel: 'VM Français / VO Anglais',
    subtitleTrackLabel: 'DVB-Sub FR / VOST',
  },
  'canal+.docs.fr': {
    canonicalId: 'CANAL+.Docs.fr',
    displayName: 'Canal+ Docs HD (Astra)',
    contentCategory: 'Documentaires',
    country: 'FR',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Canal+'],
    bouquetId: 'astra_canal_fr',
    group: 'Documentaires',
    audioTrackLabel: 'VM Français / VO Anglais',
    subtitleTrackLabel: 'DVB-Sub FR / VOST',
  },
  'cine+.premier.fr': {
    canonicalId: 'Cine+.Premier.fr',
    displayName: 'Ciné+ OCS Premier HD (Astra)',
    country: 'FR',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Canal+'],
    bouquetId: 'astra_canal_fr',
    group: 'Cinéma Premières',
    audioTrackLabel: 'VM Français / VO Anglais',
    subtitleTrackLabel: 'DVB-Sub FR / VOST',
  },
  'cine+.frisson.fr': {
    canonicalId: 'Cine+.Frisson.fr',
    displayName: 'Ciné+ Frisson HD (Astra)',
    country: 'FR',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Canal+'],
    bouquetId: 'astra_canal_fr',
    group: 'Action & Thriller',
    audioTrackLabel: 'VM Français / VO Anglais',
    subtitleTrackLabel: 'DVB-Sub FR / VOST',
  },
  'planete+.fr': {
    canonicalId: 'Planete+.fr',
    displayName: 'Planète+ HD (Astra Canal+)',
    contentCategory: 'Documentaires',
    country: 'FR',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Canal+'],
    bouquetId: 'astra_canal_fr',
    group: 'Documentaires',
    audioTrackLabel: 'Audio Français / VO',
    subtitleTrackLabel: 'DVB-Sub FR',
  },

  // ===========================================================================
  // 7. CHAÎNES DOCUMENTAIRES MULTI-SATELLITES (PL, DE, ES, IT, AR)
  // ===========================================================================
  'canal+.dokument.hd.pl': {
    canonicalId: 'CANAL+.Dokument.HD.pl',
    displayName: 'Canal+ Dokument HD (PL)',
    contentCategory: 'Documentaires',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    bouquetId: 'canal_pl',
    group: 'Documentaires',
    audioTrackLabel: 'VO Anglais / Original',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'canal+.dokument.pl': {
    canonicalId: 'CANAL+.Dokument.HD.pl',
    displayName: 'Canal+ Dokument HD (PL)',
    contentCategory: 'Documentaires',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    bouquetId: 'canal_pl',
    group: 'Documentaires',
    audioTrackLabel: 'VO Anglais / Original',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'planete+.hd.pl': {
    canonicalId: 'Planete+.HD.pl',
    displayName: 'Planete+ HD (Hotbird)',
    contentCategory: 'Documentaires',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    bouquetId: 'canal_pl',
    group: 'Documentaires',
    audioTrackLabel: 'VO Anglais / Original',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'planete+.pl': {
    canonicalId: 'Planete+.HD.pl',
    displayName: 'Planete+ HD (Hotbird)',
    contentCategory: 'Documentaires',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    bouquetId: 'canal_pl',
    group: 'Documentaires',
    audioTrackLabel: 'VO Anglais / Original',
    subtitleTrackLabel: 'DVB-Sub PL/EN',
    lektorStatus: 'Sans Lektor PL · VO Propre',
  },
  'sky.documentaries.hd.de': {
    canonicalId: 'Sky.Documentaries.HD.de',
    displayName: 'Sky Documentaries HD (DE)',
    contentCategory: 'Documentaires',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    bouquetId: 'sky_de',
    group: 'Documentaires',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.documentaries.de': {
    canonicalId: 'Sky.Documentaries.HD.de',
    displayName: 'Sky Documentaries HD (DE)',
    contentCategory: 'Documentaires',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    bouquetId: 'sky_de',
    group: 'Documentaires',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.nature.hd.de': {
    canonicalId: 'Sky.Nature.HD.de',
    displayName: 'Sky Nature HD (DE)',
    contentCategory: 'Documentaires',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    bouquetId: 'sky_de',
    group: 'Documentaires',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.nature.de': {
    canonicalId: 'Sky.Nature.HD.de',
    displayName: 'Sky Nature HD (DE)',
    contentCategory: 'Documentaires',
    country: 'DE',
    satellites: ['Astra 19.2°E'],
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE'],
    bouquetId: 'sky_de',
    group: 'Documentaires',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.documentaries.it': {
    canonicalId: 'Sky.Documentaries.it',
    displayName: 'Sky Documentaries HD (IT)',
    contentCategory: 'Documentaires',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    bouquetId: 'sky_it',
    group: 'Documentaires',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'sky.nature.it': {
    canonicalId: 'Sky.Nature.it',
    displayName: 'Sky Nature HD (IT)',
    contentCategory: 'Documentaires',
    country: 'IT',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Sky Italia'],
    bouquetId: 'sky_it',
    group: 'Documentaires',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'm+.documentales.es': {
    canonicalId: 'M+.Documentales.es',
    displayName: 'Movistar Documentales HD (ES)',
    contentCategory: 'Documentaires',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    bouquetId: 'movistar_es',
    group: 'Documentaires',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },
  'documentales.por.m+.es': {
    canonicalId: 'M+.Documentales.es',
    displayName: 'Movistar Documentales HD (ES)',
    contentCategory: 'Documentaires',
    country: 'ES',
    satellites: ['Hispasat 30°W', 'Astra 19.2°E'],
    orbitalPosition: 'Hispasat 30°W / Astra 19.2°E',
    bouquets: ['Movistar+'],
    bouquetId: 'movistar_es',
    group: 'Documentaires',
    audioTrackLabel: 'Dual VO Anglais',
    subtitleTrackLabel: 'DVB-Sub / Teletext',
  },

  // ===========================================================================
  // 8. CHAÎNES POLOGNE AVEC DOUBLAGE LEKTOR / SANS SOUS-TITRES (FILTRABLES VIA TOGGLES)
  // ===========================================================================
  'polsat.film.hd.pl': {
    canonicalId: 'Polsat.Film.HD.pl',
    displayName: 'Polsat Film HD (Lektor PL)',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    bouquetId: 'canal_pl',
    group: 'Cinéma Premières',
    audioTrackLabel: 'Lektor Polonais',
    subtitleTrackLabel: 'Sans sous-titres DVB',
    lektorStatus: 'Doublage Lektor PL',
    hasPolishLektor: true,
    hasSubtitles: false,
  },
  'polsat.film.pl': {
    canonicalId: 'Polsat.Film.HD.pl',
    displayName: 'Polsat Film HD (Lektor PL)',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    bouquetId: 'canal_pl',
    group: 'Cinéma Premières',
    audioTrackLabel: 'Lektor Polonais',
    subtitleTrackLabel: 'Sans sous-titres DVB',
    lektorStatus: 'Doublage Lektor PL',
    hasPolishLektor: true,
    hasSubtitles: false,
  },
  'tvn.fabula.hd.pl': {
    canonicalId: 'TVN.Fabula.HD.pl',
    displayName: 'TVN Fabuła HD (Lektor PL)',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    bouquetId: 'canal_pl',
    group: 'Séries TV & US',
    audioTrackLabel: 'Lektor Polonais',
    subtitleTrackLabel: 'Teletext partiel',
    lektorStatus: 'Doublage Lektor PL',
    hasPolishLektor: true,
    hasSubtitles: false,
  },
  'tvn.fabula.pl': {
    canonicalId: 'TVN.Fabula.HD.pl',
    displayName: 'TVN Fabuła HD (Lektor PL)',
    country: 'PL',
    satellites: ['Hotbird 13°E'],
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Canal+ / FilmBox'],
    bouquetId: 'canal_pl',
    group: 'Séries TV & US',
    audioTrackLabel: 'Lektor Polonais',
    subtitleTrackLabel: 'Teletext partiel',
    lektorStatus: 'Doublage Lektor PL',
    hasPolishLektor: true,
    hasSubtitles: false,
  },
};

function normalizeBouquetName(raw: string): Exclude<BouquetFilter, 'Tous'> {
  if (raw === 'Movistar+') return 'Movistar+ / DAZN ES';
  if (raw === 'Sky DE') return 'Sky DE / DAZN DE';
  if (raw === 'Sky Italia') return 'Sky Italia / DAZN IT';
  if (raw === 'Canal+ / FilmBox') return 'Canal+ / Eleven / FilmBox';
  if (
    raw === 'Total TV (Balkans)' ||
    raw === 'Total TV (Balkans / Serbie / Croatie)'
  ) {
    return 'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)';
  }
  if (
    raw === 'MaxTV Sat (Croatie)' ||
    raw === 'MAXtv (Croatie)' ||
    raw === 'A1 Bulgaria / A1 Hrvatska'
  ) {
    return 'MAXtv / A1 Croatia';
  }
  if (raw === 'Bouquet National RTSH (Albanie FTA)') {
    return 'DigitAlb (Albanie)';
  }
  if (raw === 'Bouquet Afrique Francophone (2S TV, RTI, CRTV)') {
    return 'Autres chaînes africaines / francophones';
  }
  if (
    raw === 'TVR / Chaînes Nationales (Roumanie)' ||
    raw === 'Bouquet National TVR (Roumanie FTA)'
  ) {
    return 'Focus Sat (Roumanie)';
  }
  if (raw === 'Turkmenistan National TV') return 'Bouquet National Turkmène';
  if (raw === 'Persiana Media Group (Farsi/Sport/Cinema)') {
    return 'Groupe Persiana';
  }
  return raw as Exclude<BouquetFilter, 'Tous'>;
}

function normalizeSatelliteName(raw: string): Exclude<SatelliteFilter, 'Tous'> {
  if (raw === 'Nilesat OSN/MBC') return 'Nilesat 7°W';
  return raw as Exclude<SatelliteFilter, 'Tous'>;
}

export function inferChannelBouquetId(
  spec: {
    canonicalId?: string;
    bouquetId?: EpgBouquetId;
    country: Exclude<CountryCode, 'Tous'>;
    bouquets?: string[];
    satellites?: string[];
  }
): EpgBouquetId {
  if (spec.bouquetId && spec.bouquetId !== 'eutelsat_16e_thor') {
    return spec.bouquetId;
  }
  if (spec.bouquets?.includes('TNT France')) return 'tnt_fr';
  if (spec.bouquets?.includes('Bis TV France')) return 'hotbird_bis_fr';
  if (
    spec.bouquets?.includes('Badr Sport & MENA') ||
    spec.satellites?.includes("Badr / Es'hailSat 26°E")
  ) {
    return 'badr_bein_ssc';
  }
  if (spec.bouquets?.includes('Meo / NOS / Movistar 30°W')) {
    return 'hispasat_meo_nos';
  }
  if (
    spec.satellites?.includes('TurkmenÄlem 52°E') ||
    spec.bouquets?.some(
      (b) =>
        b === 'Alem TV' ||
        b === 'Bouquet National Turkmène' ||
        b === 'Turkmenistan National TV'
    ) ||
    /\.(tm|uz)$/i.test(spec.canonicalId || '')
  ) {
    return 'turkmenalem_52e_alem';
  }
  if (
    spec.satellites?.includes('MonacoSat 52°E') ||
    spec.bouquets?.some(
      (b) =>
        b.includes('Persiana') ||
        b === 'Groupe WNS' ||
        b === 'Information' ||
        b === 'Big Bang TV'
    ) ||
    /\.(mc|ir|52e)$/i.test(spec.canonicalId || '')
  ) {
    return 'monacosat_52e_persiana';
  }
  if (
    spec.satellites?.includes('Thor 0.8°W / Intelsat 10-02') ||
    spec.satellites?.includes('Thor 0.8°W') ||
    spec.bouquets?.some(
      (b) =>
        b.includes('Focus Sat') ||
        b.includes('Direct One') ||
        b.includes('Digi TV')
    ) ||
    /\.(ro|hu|sk|cz)$/i.test(spec.canonicalId || '')
  ) {
    return 'thor_08w_focussat';
  }
  if (
    spec.bouquets?.includes('TRT Network') ||
    /\.tr$/i.test(spec.canonicalId || '')
  ) {
    return 'trt_network';
  }
  if (
    spec.satellites?.includes('Eutelsat 16°E') ||
    spec.bouquets?.some(
      (b) =>
        b.includes('DigitAlb') ||
        b.includes('Total TV') ||
        b.includes('MAXtv') ||
        b.includes('MaxTV') ||
        b.includes('RTSH') ||
        b.includes('Afrique Francophone') ||
        b.includes('A1 ') ||
        b.includes('TVR')
    ) ||
    /\.(al|rs|hr|ba|si|mk|me|bg|16e|sn|ci|cm|ml|bf|ga)$/i.test(spec.canonicalId || '')
  ) {
    return 'eutelsat_16e_digitalb';
  }
  if (spec.country === 'FR') return 'astra_canal_fr';
  if (spec.country === 'ES') return 'movistar_es';
  if (spec.country === 'DE') return 'sky_de';
  if (spec.country === 'IT') return 'sky_it';
  if (spec.country === 'PL') return 'canal_pl';
  if (spec.country === 'EU') return 'thor_08w_focussat';
  if (spec.country === 'BR') return 'starone_70w_claro_br';
  if (spec.country === 'LATAM') return 'intelsat_43w_directv';
  return 'nilesat_osn_mbc';
}

interface FrenchTntSpecDef {
  canonicalId: string;
  displayName: string;
  group: WhitelistedChannelSpec['group'];
  contentCategory?: Exclude<ContentCategoryFilter, 'Tous'>;
  bouquetId: 'tnt_fr' | 'astra_canal_fr';
  includeBisHotbird?: boolean;
}

const FRENCH_TNT_AND_CINEMA_MAP: Record<string, FrenchTntSpecDef> = {
  // Chaînes nationales TNT France (Astra 19.2°E TNTSAT / Canal+ & Hotbird 13°E Bis TV)
  'tf1.fr': {
    canonicalId: 'TF1.fr',
    displayName: 'TF1 HD (TNT France)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'tf1..fr': {
    canonicalId: 'TF1.fr',
    displayName: 'TF1 HD (TNT France)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'france.2.fr': {
    canonicalId: 'France.2.fr',
    displayName: 'France 2 HD (TNT France)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'france.2..fr': {
    canonicalId: 'France.2.fr',
    displayName: 'France 2 HD (TNT France)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'france.3.fr': {
    canonicalId: 'France.3.fr',
    displayName: 'France 3 HD (TNT France)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'france.4.fr': {
    canonicalId: 'France.4.fr',
    displayName: 'France 4 HD (TNT France)',
    group: 'Jeunesse / Enfants',
    contentCategory: 'Jeunesse / Enfants',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'france.5.fr': {
    canonicalId: 'France.5.fr',
    displayName: 'France 5 HD (TNT France)',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'm6.fr': {
    canonicalId: 'M6.fr',
    displayName: 'M6 HD (TNT France)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'arte.fr': {
    canonicalId: 'ARTE.fr',
    displayName: 'Arte HD (TNT France)',
    group: 'Classiques & Culte',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'w9.fr': {
    canonicalId: 'W9.fr',
    displayName: 'W9 HD (TNT France)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'tmc.fr': {
    canonicalId: 'TMC.fr',
    displayName: 'TMC HD (TNT France)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'tfx.fr': {
    canonicalId: 'TFX.fr',
    displayName: 'TFX HD (TNT France)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'nrj.12.fr': {
    canonicalId: 'NRJ.12.fr',
    displayName: 'NRJ 12 HD (TNT France)',
    group: 'Musique & Divertissement',
    contentCategory: 'Musique & Divertissement',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'nrj12.fr': {
    canonicalId: 'NRJ.12.fr',
    displayName: 'NRJ 12 HD (TNT France)',
    group: 'Musique & Divertissement',
    contentCategory: 'Musique & Divertissement',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'lcp.fr': {
    canonicalId: 'LCP.fr',
    displayName: 'LCP - Assemblée Nationale (TNT France)',
    group: 'Actualités / News',
    contentCategory: 'Actualités / News',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'public.senat.fr': {
    canonicalId: 'LCP.fr',
    displayName: 'LCP / Public Sénat (TNT France)',
    group: 'Actualités / News',
    contentCategory: 'Actualités / News',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'bfm.tv.fr': {
    canonicalId: 'BFM.TV.fr',
    displayName: 'BFMTV HD (TNT France)',
    group: 'Actualités / News',
    contentCategory: 'Actualités / News',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'bfmtv.fr': {
    canonicalId: 'BFM.TV.fr',
    displayName: 'BFMTV HD (TNT France)',
    group: 'Actualités / News',
    contentCategory: 'Actualités / News',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'cnews.fr': {
    canonicalId: 'CNews.fr',
    displayName: 'CNEWS HD (TNT France)',
    group: 'Actualités / News',
    contentCategory: 'Actualités / News',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'cstar.fr': {
    canonicalId: 'CStar.fr',
    displayName: 'CSTAR HD (TNT France)',
    group: 'Musique & Divertissement',
    contentCategory: 'Musique & Divertissement',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'gulli.fr': {
    canonicalId: 'Gulli.fr',
    displayName: 'Gulli HD (TNT France)',
    group: 'Jeunesse / Enfants',
    contentCategory: 'Jeunesse / Enfants',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'tf1.series.films.fr': {
    canonicalId: 'TF1.Series.Films.fr',
    displayName: 'TF1 Séries Films HD (TNT France)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'tf1.séries.films.fr': {
    canonicalId: 'TF1.Series.Films.fr',
    displayName: 'TF1 Séries Films HD (TNT France)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  '6ter.fr': {
    canonicalId: '6ter.fr',
    displayName: '6ter HD (TNT France)',
    group: 'Comédie & Famille',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'rmc.story.fr': {
    canonicalId: 'RMC.Story.fr',
    displayName: 'RMC Story HD (TNT France)',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'rmc.decouverte.fr': {
    canonicalId: 'RMC.Decouverte.fr',
    displayName: 'RMC Découverte HD (TNT France)',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'rmc.découverte.fr': {
    canonicalId: 'RMC.Decouverte.fr',
    displayName: 'RMC Découverte HD (TNT France)',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'cherie.25.fr': {
    canonicalId: 'Cherie.25.fr',
    displayName: 'Chérie 25 HD (TNT France)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'chérie.25.fr': {
    canonicalId: 'Cherie.25.fr',
    displayName: 'Chérie 25 HD (TNT France)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'c8.fr': {
    canonicalId: 'C8.fr',
    displayName: 'C8 HD (TNT France)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'franceinfo.fr': {
    canonicalId: 'Franceinfo.fr',
    displayName: 'franceinfo: HD (TNT France)',
    group: 'Actualités / News',
    contentCategory: 'Actualités / News',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'lci.fr': {
    canonicalId: 'LCI.fr',
    displayName: 'LCI HD (TNT France)',
    group: 'Actualités / News',
    contentCategory: 'Actualités / News',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'france.24.fr': {
    canonicalId: 'France.24.fr',
    displayName: 'France 24 HD (Astra / Hotbird)',
    group: 'Actualités / News',
    contentCategory: 'Actualités / News',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  'euronews.fr': {
    canonicalId: 'Euronews.fr',
    displayName: 'Euronews HD (Astra / Hotbird)',
    group: 'Actualités / News',
    contentCategory: 'Actualités / News',
    bouquetId: 'tnt_fr',
    includeBisHotbird: true,
  },
  // Chaînes Cinéma, Séries & Documentaires Canal+ France (Astra 19.2°E) avec variantes d'ID XMLTV (.fr)
  'canal+.box.office.fr': {
    canonicalId: 'CANAL+.Box.Office.fr',
    displayName: 'Canal+ Box Office HD (VOSTFR)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'canal+box.office.fr': {
    canonicalId: 'CANAL+.Box.Office.fr',
    displayName: 'Canal+ Box Office HD (VOSTFR)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'canal+grand.ecran.fr': {
    canonicalId: 'CANAL+.Grand.Ecran.fr',
    displayName: 'Canal+ Grand Écran HD (VOSTFR)',
    group: 'Classiques & Culte',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'canal+grand.écran.fr': {
    canonicalId: 'CANAL+.Grand.Ecran.fr',
    displayName: 'Canal+ Grand Écran HD (VOSTFR)',
    group: 'Classiques & Culte',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'canal+cinema(s).fr': {
    canonicalId: 'CANAL+.Cinema.fr',
    displayName: 'Canal+ Cinéma(s) HD (VOSTFR)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'canal+cinéma(s).fr': {
    canonicalId: 'CANAL+.Cinema.fr',
    displayName: 'Canal+ Cinéma(s) HD (VOSTFR)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'canal+series.fr': {
    canonicalId: 'CANAL+.Series.fr',
    displayName: 'Canal+ Séries HD (VOSTFR)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'canal+séries.fr': {
    canonicalId: 'CANAL+.Series.fr',
    displayName: 'Canal+ Séries HD (VOSTFR)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'canal+docs.fr': {
    canonicalId: 'CANAL+.Docs.fr',
    displayName: 'Canal+ Docs HD',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
  },
  'canal+kids.fr': {
    canonicalId: 'CANAL+.Kids.fr',
    displayName: 'Canal+ Kids HD',
    group: 'Jeunesse / Enfants',
    contentCategory: 'Jeunesse / Enfants',
    bouquetId: 'astra_canal_fr',
  },
  'ciné+.frisson.fr': {
    canonicalId: 'Cine+.Frisson.fr',
    displayName: 'Ciné+ OCS Frisson HD (VOSTFR)',
    group: 'Action & Thriller',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'ciné+.émotion.fr': {
    canonicalId: 'Cine+.Emotion.fr',
    displayName: 'Ciné+ OCS Émotion HD (VOSTFR)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'ciné+.emotion.fr': {
    canonicalId: 'Cine+.Emotion.fr',
    displayName: 'Ciné+ OCS Émotion HD (VOSTFR)',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'ciné+.famiz.fr': {
    canonicalId: 'Cine+.Famiz.fr',
    displayName: 'Ciné+ OCS Famiz HD (VOSTFR)',
    group: 'Comédie & Famille',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'ciné+.classic.fr': {
    canonicalId: 'Cine+.Classic.fr',
    displayName: 'Ciné+ OCS Classic HD (VOSTFR)',
    group: 'Classiques & Culte',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'ciné+.club.fr': {
    canonicalId: 'Cine+.Club.fr',
    displayName: 'Ciné+ OCS Club HD (VOSTFR)',
    group: 'Classiques & Culte',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'ciné+.festival.fr': {
    canonicalId: 'Cine+.Club.fr',
    displayName: 'Ciné+ OCS Festival HD (VOSTFR)',
    group: 'Classiques & Culte',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'cine+.festival.fr': {
    canonicalId: 'Cine+.Club.fr',
    displayName: 'Ciné+ OCS Festival HD (VOSTFR)',
    group: 'Classiques & Culte',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'warner.tv.fr': {
    canonicalId: 'Warner.TV.fr',
    displayName: 'Warner TV HD (VOSTFR)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'warner.tv.next.fr': {
    canonicalId: 'Warner.TV.Next.fr',
    displayName: 'Warner TV Next HD (VOSTFR)',
    group: 'Action & Thriller',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'rtl.9.fr': {
    canonicalId: 'RTL9.fr',
    displayName: 'RTL9 HD (Cinéma)',
    group: 'Action & Thriller',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'rtl9.fr': {
    canonicalId: 'RTL9.fr',
    displayName: 'RTL9 HD (Cinéma)',
    group: 'Action & Thriller',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'paris.premiere.fr': {
    canonicalId: 'Paris.Premiere.fr',
    displayName: 'Paris Première HD',
    group: 'Classiques & Culte',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'paris.première.fr': {
    canonicalId: 'Paris.Premiere.fr',
    displayName: 'Paris Première HD',
    group: 'Classiques & Culte',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'teva.fr': {
    canonicalId: 'Teva.fr',
    displayName: 'Téva HD (Séries & Films)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'téva.fr': {
    canonicalId: 'Teva.fr',
    displayName: 'Téva HD (Séries & Films)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'serie.club.fr': {
    canonicalId: 'Serie.Club.fr',
    displayName: 'Série Club HD (VOSTFR)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'série.club.fr': {
    canonicalId: 'Serie.Club.fr',
    displayName: 'Série Club HD (VOSTFR)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  '13eme.rue.fr': {
    canonicalId: '13eme.Rue.fr',
    displayName: '13ème Rue HD (Thriller VOSTFR)',
    group: 'Action & Thriller',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  '13ème.rue.fr': {
    canonicalId: '13eme.Rue.fr',
    displayName: '13ème Rue HD (Thriller VOSTFR)',
    group: 'Action & Thriller',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'syfy.fr': {
    canonicalId: 'Syfy.fr',
    displayName: 'Syfy France HD (Sci-Fi VOSTFR)',
    group: 'Action & Thriller',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'ab1.fr': {
    canonicalId: 'AB1.fr',
    displayName: 'AB1 HD (Bis TV / Astra)',
    group: 'Séries TV & US',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'action.fr': {
    canonicalId: 'Action.fr',
    displayName: 'Action HD (Cinéma Action)',
    group: 'Action & Thriller',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'paramount.channel.fr': {
    canonicalId: 'Paramount.Channel.fr',
    displayName: 'Paramount Network France HD',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'paramount.network.fr': {
    canonicalId: 'Paramount.Channel.fr',
    displayName: 'Paramount Network France HD',
    group: 'Cinéma Premières',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'tcm.cinema.fr': {
    canonicalId: 'TCM.Cinema.fr',
    displayName: 'TCM Cinéma HD (VOSTFR)',
    group: 'Classiques & Culte',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'tcm.cinéma.fr': {
    canonicalId: 'TCM.Cinema.fr',
    displayName: 'TCM Cinéma HD (VOSTFR)',
    group: 'Classiques & Culte',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'comedy.central.fr': {
    canonicalId: 'Comedy.Central.fr',
    displayName: 'Comedy Central France HD',
    group: 'Comédie & Famille',
    contentCategory: 'Films & Séries',
    bouquetId: 'astra_canal_fr',
  },
  'national.geographic.fr': {
    canonicalId: 'National.Geographic.fr',
    displayName: 'National Geographic HD France',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
  },
  'nat.geo.wild.fr': {
    canonicalId: 'Nat.Geo.Wild.fr',
    displayName: 'National Geographic Wild HD France',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
  },
  'planète+.fr': {
    canonicalId: 'Planete+.fr',
    displayName: 'Planète+ HD (Canal+ Docs)',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
  },
  'planete+.fr': {
    canonicalId: 'Planete+.fr',
    displayName: 'Planète+ HD (Canal+ Docs)',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
  },
  'planète+.crime.fr': {
    canonicalId: 'Planete+.Crime.fr',
    displayName: 'Planète+ Crime HD',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
  },
  'planète+.aventure.fr': {
    canonicalId: 'Planete+.Aventure.fr',
    displayName: 'Planète+ Aventure HD',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
  },
  'histoire.tv.fr': {
    canonicalId: 'Histoire.TV.fr',
    displayName: 'Histoire TV HD',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'ushuaia.tv.fr': {
    canonicalId: 'Ushuaia.TV.fr',
    displayName: 'Ushuaïa TV HD',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'ushuaïa.tv.fr': {
    canonicalId: 'Ushuaia.TV.fr',
    displayName: 'Ushuaïa TV HD',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'toute.l.histoire.fr': {
    canonicalId: 'Toute.L.Histoire.fr',
    displayName: 'Toute l\'Histoire HD (Bis TV / Astra)',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'animaux.fr': {
    canonicalId: 'Animaux.fr',
    displayName: 'Animaux HD (Bis TV / Astra)',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
  'science.et.vie.tv.fr': {
    canonicalId: 'Science.Et.Vie.TV.fr',
    displayName: 'Science & Vie TV HD (Bis TV / Astra)',
    group: 'Documentaires',
    contentCategory: 'Documentaires',
    bouquetId: 'astra_canal_fr',
    includeBisHotbird: true,
  },
};

export function isAdultChannel(
  idOrName?: string | null,
  displayName?: string | null
): boolean {
  const combined = `${idOrName || ''} ${displayName || ''}`.toLowerCase();
  if (!combined.trim()) return false;
  return (
    /\b(dorcel|penthouse|hustler|playboy|redlight|vivid\s*red|vivid\s*tv|vivid\s*touch|private\s*tv|private\s*hd|xxl\s*tv|xxl\b|x1\s*tv|x2\s*tv|brazzers|vixen|babes\s*tv|erox|eroxxx|erotik|erotic|superone|dusk\s*tv|extasy|pink\s*erotic|pink\s*o\b|man-x|centoxcento|sct\s*hd|sextreme|passion\s*xxx|venus\s*tv)\b/i.test(
      combined
    ) ||
    combined.includes('dorcel') ||
    combined.includes('penthouse') ||
    combined.includes('redlight') ||
    combined.includes('vivid.red') ||
    combined.includes('private.tv') ||
    combined.includes('x1.tv') ||
    combined.includes('xxl.tv') ||
    combined.includes('adult') ||
    combined.includes('xxx') ||
    combined.includes('playboy') ||
    combined.includes('hustler') ||
    combined.includes('brazzers')
  );
}

function classifyChannelCategoryAndGroup(
  lowerKey: string
): {
  contentCategory: Exclude<ContentCategoryFilter, 'Tous'>;
  group: Exclude<ChannelGroup, 'Tous'>;
} | null {
  // Exclure le télé-achat, adulte ou radio pure
  if (
    lowerKey.includes('teleshopping') ||
    lowerKey.includes('telezakupy') ||
    lowerKey.includes('teletienda') ||
    lowerKey.includes('qvc') ||
    lowerKey.includes('hse24') ||
    isAdultChannel(lowerKey)
  ) {
    return null;
  }

  // 1. Sport / Football
  if (
    lowerKey.includes('sport') ||
    lowerKey.includes('foot') ||
    lowerKey.includes('calcio') ||
    lowerKey.includes('bundesliga') ||
    lowerKey.includes('laliga') ||
    lowerKey.includes('la.liga') ||
    lowerKey.includes('campeones') ||
    lowerKey.includes('dazn') ||
    lowerKey.includes('eleven') ||
    lowerKey.includes('alkass') ||
    lowerKey.includes('al.kass') ||
    lowerKey.includes('ssc') ||
    lowerKey.includes('arryadia') ||
    lowerKey.includes('ontime') ||
    lowerKey.includes('on.time') ||
    lowerKey.includes('equipe') ||
    lowerKey.includes('équipe') ||
    lowerKey.includes('equidia') ||
    lowerKey.includes('automoto') ||
    lowerKey.includes('motor') ||
    lowerKey.includes('espn') ||
    lowerKey.includes('premiere.fc') ||
    lowerKey.includes('premiere.clubes') ||
    (lowerKey.includes('premiere') &&
      lowerKey.endsWith('.br') &&
      !lowerKey.includes('telecine') &&
      !lowerKey.includes('cinema') &&
      !lowerKey.includes('movie') &&
      !lowerKey.includes('universal')) ||
    lowerKey.includes('btv') ||
    lowerKey.includes('benfica') ||
    lowerKey.includes('bola') ||
    lowerKey.includes('teledeporte') ||
    lowerKey.includes('gol.') ||
    lowerKey.includes('real.madrid') ||
    lowerKey.includes('barça') ||
    lowerKey.includes('barca') ||
    (lowerKey.includes('bein') &&
      !lowerKey.includes('movie') &&
      !lowerKey.includes('series') &&
      !lowerKey.includes('drama') &&
      !lowerKey.includes('gourmet') &&
      !lowerKey.includes('baraem') &&
      !lowerKey.includes('jeem') &&
      !lowerKey.includes('fatafeat'))
  ) {
    return {
      contentCategory: 'Sport / Football',
      group: 'Sport / Football',
    };
  }

  // 2. Documentaires & Culture (Histoire, Nature, Science...)
  if (
    lowerKey.includes('doc') ||
    lowerKey.includes('discovery') ||
    lowerKey.includes('nat.geo') ||
    lowerKey.includes('natgeo') ||
    lowerKey.includes('national.geographic') ||
    lowerKey.includes('planete') ||
    lowerKey.includes('planète') ||
    lowerKey.includes('histoire') ||
    lowerKey.includes('historia') ||
    lowerKey.includes('história') ||
    lowerKey.includes('history') ||
    lowerKey.includes('storia') ||
    lowerKey.includes('ushuaia') ||
    lowerKey.includes('ushuaïa') ||
    lowerKey.includes('animaux') ||
    lowerKey.includes('animal') ||
    lowerKey.includes('science') ||
    lowerKey.includes('odisseia') ||
    lowerKey.includes('odisea') ||
    lowerKey.includes('viasat.explore') ||
    lowerKey.includes('viasat.nature') ||
    lowerKey.includes('viasat.history') ||
    lowerKey.includes('bbc.earth') ||
    lowerKey.includes('curiosity') ||
    lowerKey.includes('love.nature') ||
    lowerKey.includes('quest') ||
    lowerKey.includes('thaqaf') ||
    lowerKey.includes('kultura') ||
    lowerKey.includes('kultur') ||
    lowerKey.includes('museum') ||
    lowerKey.includes('trek') ||
    lowerKey.includes('chasse') ||
    lowerKey.includes('seasons') ||
    lowerKey.includes('fokus') ||
    lowerKey.includes('focus') ||
    lowerKey.includes('scuola') ||
    lowerKey.includes('3sat') ||
    lowerKey.includes('phoenix') ||
    lowerKey.includes('zdfinfo') ||
    lowerKey.includes('dmax') ||
    lowerKey.includes('crime.district')
  ) {
    return {
      contentCategory: 'Documentaires',
      group: 'Documentaires',
    };
  }

  // 3. Actualités / News (Information, Débats...)
  if (
    lowerKey.includes('news') ||
    lowerKey.includes('info') ||
    lowerKey.includes('bfm') ||
    lowerKey.includes('cnews') ||
    lowerKey.includes('lci') ||
    lowerKey.includes('lcp') ||
    lowerKey.includes('senat') ||
    lowerKey.includes('sénat') ||
    lowerKey.includes('france.24') ||
    lowerKey.includes('france24') ||
    lowerKey.includes('euronews') ||
    lowerKey.includes('jazeera') ||
    lowerKey.includes('arabiya') ||
    lowerKey.includes('hadath') ||
    lowerKey.includes('asharq') ||
    lowerKey.includes('ekhbariya') ||
    lowerKey.includes('cnbc') ||
    lowerKey.includes('bloomberg') ||
    lowerKey.includes('cnn') ||
    lowerKey.includes('bbc.world') ||
    lowerKey.includes('bbc.news') ||
    lowerKey.includes('dw.') ||
    lowerKey.includes('rt.') ||
    lowerKey.includes('i24') ||
    lowerKey.includes('24.horas') ||
    lowerKey.includes('24h') ||
    lowerKey.includes('tg24') ||
    lowerKey.includes('tgcom') ||
    lowerKey.includes('rainews') ||
    lowerKey.includes('rai.news') ||
    lowerKey.includes('tvn24') ||
    lowerKey.includes('tvn.24') ||
    lowerKey.includes('wydarzenia') ||
    lowerKey.includes('biznes') ||
    lowerKey.includes('n-tv') ||
    lowerKey.includes('ntv.de') ||
    lowerKey.includes('welt') ||
    lowerKey.includes('tagesschau') ||
    lowerKey.includes('noticias') ||
    lowerKey.includes('notícias') ||
    lowerKey.includes('rtp.3') ||
    lowerKey.includes('rtp3') ||
    lowerKey.includes('al.oula') ||
    lowerKey.includes('medi1') ||
    lowerKey.includes('extra.news') ||
    lowerKey.includes('al.qahera')
  ) {
    return {
      contentCategory: 'Actualités / News',
      group: 'Actualités / News',
    };
  }

  // 4. Jeunesse / Enfants (Dessins animés...)
  if (
    lowerKey.includes('kids') ||
    lowerKey.includes('kid') ||
    lowerKey.includes('gulli') ||
    lowerKey.includes('cartoon') ||
    lowerKey.includes('disney') ||
    lowerKey.includes('nickelodeon') ||
    lowerKey.includes('nick.') ||
    lowerKey.includes('nickjr') ||
    lowerKey.includes('nicktoons') ||
    lowerKey.includes('boing') ||
    lowerKey.includes('boomerang') ||
    lowerKey.includes('toonami') ||
    lowerKey.includes('tiji') ||
    lowerKey.includes('canal.j') ||
    lowerKey.includes('piwi') ||
    lowerKey.includes('mangas') ||
    lowerKey.includes('spacetoon') ||
    lowerKey.includes('space.toon') ||
    lowerKey.includes('mbc.3') ||
    lowerKey.includes('mbc3') ||
    lowerKey.includes('baraem') ||
    lowerKey.includes('jeem') ||
    lowerKey.includes('majid') ||
    lowerKey.includes('toyor') ||
    lowerKey.includes('karameesh') ||
    lowerKey.includes('cn.arabia') ||
    lowerKey.includes('kika') ||
    lowerKey.includes('super.rtl') ||
    lowerKey.includes('toggo') ||
    lowerKey.includes('clan') ||
    lowerKey.includes('panda') ||
    lowerKey.includes('biggs') ||
    lowerKey.includes('babytv') ||
    lowerKey.includes('baby.tv') ||
    lowerKey.includes('minimini') ||
    lowerKey.includes('teletoon') ||
    lowerKey.includes('tvp.abc') ||
    lowerKey.includes('jimjam') ||
    lowerKey.includes('cbeebies') ||
    lowerKey.includes('yoyo') ||
    lowerKey.includes('gulp') ||
    lowerKey.includes('cartoonito') ||
    lowerKey.includes('frisbee') ||
    lowerKey.includes('k2.') ||
    lowerKey.includes('super!') ||
    lowerKey.includes('france.4')
  ) {
    return {
      contentCategory: 'Jeunesse / Enfants',
      group: 'Jeunesse / Enfants',
    };
  }

  // 5. Musique & Divertissement
  if (
    lowerKey.includes('music') ||
    lowerKey.includes('musique') ||
    lowerKey.includes('muzyka') ||
    lowerKey.includes('musica') ||
    lowerKey.includes('música') ||
    lowerKey.includes('musik') ||
    lowerKey.includes('mtv') ||
    lowerKey.includes('vh1') ||
    lowerKey.includes('mezzo') ||
    lowerKey.includes('trace') ||
    lowerKey.includes('nrj') ||
    lowerKey.includes('rfm') ||
    lowerKey.includes('cstar') ||
    lowerKey.includes('melody') ||
    lowerKey.includes('olympia') ||
    lowerKey.includes('stingray') ||
    lowerKey.includes('deluxe.music') ||
    lowerKey.includes('eska') ||
    lowerKey.includes('polo.tv') ||
    lowerKey.includes('4fun') ||
    lowerKey.includes('stars.tv') ||
    lowerKey.includes('radioitalia') ||
    lowerKey.includes('rtl.102') ||
    lowerKey.includes('rotana.clip') ||
    lowerKey.includes('rotana.music') ||
    lowerKey.includes('wannasah') ||
    lowerKey.includes('wanasah') ||
    lowerKey.includes('mazzika') ||
    lowerKey.includes('aghani') ||
    lowerKey.includes('fatafeat') ||
    lowerKey.includes('gourmet') ||
    lowerKey.includes('mezze') ||
    lowerKey.includes('tlc') ||
    lowerKey.includes('food') ||
    lowerKey.includes('hgtv') ||
    lowerKey.includes('e!') ||
    lowerKey.includes('real.time') ||
    lowerKey.includes('dkiss') ||
    lowerKey.includes('divinity') ||
    lowerKey.includes('nova') ||
    lowerKey.includes('neox') ||
    lowerKey.includes('game.one') ||
    lowerKey.includes('j-one') ||
    lowerKey.includes('mbc.1') ||
    lowerKey.includes('mbc1') ||
    lowerKey.includes('mbc.masr') ||
    lowerKey.includes('mbc.maser') ||
    lowerKey.includes('mbc.iraq') ||
    lowerKey.includes('dubai.tv') ||
    lowerKey.includes('sama.dubai') ||
    lowerKey.includes('abu.dhabi.tv') ||
    lowerKey.includes('lbc') ||
    lowerKey.includes('rotana.khalijia')
  ) {
    return {
      contentCategory: 'Musique & Divertissement',
      group: 'Musique & Divertissement',
    };
  }

  // 6. Films & Séries (Cinéma, Drama, Action, Comédie, Généraliste...)
  if (
    lowerKey.includes('action') ||
    lowerKey.includes('frisson') ||
    lowerKey.includes('thriller') ||
    lowerKey.includes('crime') ||
    lowerKey.includes('investigation') ||
    lowerKey.includes('13eme') ||
    lowerKey.includes('13ème') ||
    lowerKey.includes('calle.13') ||
    lowerKey.includes('syfy') ||
    lowerKey.includes('sci-fi') ||
    lowerKey.includes('axn') ||
    lowerKey.includes('polar') ||
    lowerKey.includes('giallo') ||
    lowerKey.includes('top.crime') ||
    lowerKey.includes('energy')
  ) {
    return {
      contentCategory: 'Films & Séries',
      group: 'Action & Thriller',
    };
  }

  if (
    lowerKey.includes('serie') ||
    lowerKey.includes('série') ||
    lowerKey.includes('drama') ||
    lowerKey.includes('atlantic') ||
    lowerKey.includes('showcase') ||
    lowerKey.includes('warner') ||
    lowerKey.includes('novelas') ||
    lowerKey.includes('hekayat') ||
    lowerKey.includes('atreseries') ||
    lowerKey.includes('fdf') ||
    lowerKey.includes('factoria') ||
    lowerKey.includes('fox') ||
    lowerKey.includes('star.world') ||
    lowerKey.includes('mbc.4') ||
    lowerKey.includes('mbc4') ||
    lowerKey.includes('teva') ||
    lowerKey.includes('téva') ||
    lowerKey.includes('tfx') ||
    lowerKey.includes('cherie') ||
    lowerKey.includes('chérie') ||
    lowerKey.includes('rai.4') ||
    lowerKey.includes('rai.premium') ||
    lowerKey.includes('zdfneo')
  ) {
    return {
      contentCategory: 'Films & Séries',
      group: 'Séries TV & US',
    };
  }

  if (
    lowerKey.includes('comedy') ||
    lowerKey.includes('comedia') ||
    lowerKey.includes('comedie') ||
    lowerKey.includes('comédie') ||
    lowerKey.includes('famiz') ||
    lowerKey.includes('family') ||
    lowerKey.includes('familia') ||
    lowerKey.includes('6ter')
  ) {
    return {
      contentCategory: 'Films & Séries',
      group: 'Comédie & Famille',
    };
  }

  if (
    lowerKey.includes('classic') ||
    lowerKey.includes('clasico') ||
    lowerKey.includes('clásico') ||
    lowerKey.includes('tcm') ||
    lowerKey.includes('arte') ||
    lowerKey.includes('grand.ecran') ||
    lowerKey.includes('grand.écran') ||
    lowerKey.includes('club') ||
    lowerKey.includes('cult') ||
    lowerKey.includes('iris') ||
    lowerKey.includes('cine34') ||
    lowerKey.includes('paris.premiere') ||
    lowerKey.includes('kinowelt') ||
    lowerKey.includes('kabel.eins.classics')
  ) {
    return {
      contentCategory: 'Films & Séries',
      group: 'Classiques & Culte',
    };
  }

  return {
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
  };
}

function formatCleanChannelDisplayName(rawId: string, suffixRegex: RegExp): string {
  const base = rawId
    .replace(/^en:\.?/i, '')
    .replace(suffixRegex, '')
    .replace(/_digital_mono(?:-\d+)?(?:_en|_ar)?/gi, '')
    .replace(/_(?:en|ar)$/i, '')
    .replace(/[._]+/g, ' ')
    .trim();
  return cleanOfficialChannelName(base);
}

/**
 * Supprime tout suffixe entre parenthèses (satellite combiné, bouquet, pays, VOSTFR...)
 * pour ne conserver que le nom propre officiel de la chaîne (ex: "Pro 7", "Pro TV", "Canal+ HD").
 */
export function cleanOfficialChannelName(rawName: string): string {
  if (!rawName) return '';
  return rawName
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Retourne uniquement la position orbitale réelle de diffusion d'une chaîne (jamais de regroupement combiné).
 */
export function normalizeSingleOrbitalPosition(
  rawOrbitalPosition?: string,
  satellites?: string[]
): string {
  const primary = (rawOrbitalPosition || satellites?.[0] || '').trim();
  const combined = `${primary} ${(satellites || []).join(' ')}`;
  if (/Türksat|Turksat|42°E/i.test(primary) || /Türksat|Turksat|42°E/i.test(combined)) {
    return 'Türksat 42°E / Eutelsat 7°E';
  }
  if (
    /MonacoSat/i.test(primary) ||
    (/MonacoSat/i.test(combined) && !/Turkmen/i.test(primary))
  ) {
    return 'MonacoSat 52°E';
  }
  if (/Turkmen/i.test(primary) || /Turkmen/i.test(combined)) {
    return 'TurkmenÄlem 52°E';
  }
  if (
    /Thor\s*0\.8°W/i.test(primary) ||
    /Intelsat\s*10-02/i.test(primary) ||
    (/Thor\s*0\.8°W/i.test(combined) && !/Eutelsat\s*16/i.test(primary))
  ) {
    return 'Thor 0.8°W';
  }
  if (/Eutelsat\s*16°E/i.test(primary) || /Eutelsat\s*16°E/i.test(combined)) {
    return 'Eutelsat 16°E';
  }
  if (/Badr/i.test(primary) || /26°E/i.test(primary)) {
    return 'Badr 26°E';
  }
  if (/Nilesat/i.test(primary) || /7°W/i.test(primary)) {
    return 'Nilesat 7°W';
  }
  if (/Badr/i.test(combined) || /26°E/i.test(combined)) {
    return 'Badr 26°E';
  }
  if (/Nilesat/i.test(combined) || /7°W/i.test(combined)) {
    return 'Nilesat 7°W';
  }
  if (/Hispasat/i.test(primary) || /30°W/i.test(primary)) {
    return 'Hispasat 30°W';
  }
  if (/Hotbird/i.test(primary) || /13°E/i.test(primary)) {
    return 'Hotbird 13°E';
  }
  if (/Astra/i.test(primary) || /19\.2°E/i.test(primary)) {
    return 'Astra 19.2°E';
  }
  if (/Hispasat/i.test(combined) || /30°W/i.test(combined)) {
    return 'Hispasat 30°W';
  }
  if (/Hotbird/i.test(combined) || /13°E/i.test(combined)) {
    return 'Hotbird 13°E';
  }
  if (/Astra/i.test(combined) || /19\.2°E/i.test(combined)) {
    return 'Astra 19.2°E';
  }
  if (/Star\s*One/i.test(combined) || /70°W/i.test(combined)) {
    return 'Star One D2 70°W';
  }
  if (/Amazonas/i.test(combined) || /61°W/i.test(combined)) {
    return 'Amazonas 61°W';
  }
  if (/Intelsat\s*43/i.test(combined) || /43\.1°W/i.test(combined)) {
    return 'Intelsat 43.1°W';
  }
  return (rawOrbitalPosition || 'Astra 19.2°E').split('/')[0].trim();
}

function resolveCanonicalBeinChannelSpec(
  lowerKey: string
): {
  canonicalId: string;
  displayName: string;
  contentCategory: Exclude<ContentCategoryFilter, 'Tous'>;
  group: Exclude<ChannelGroup, 'Tous'>;
} | null {
  if (lowerKey.includes('movie')) {
    if (lowerKey.includes('2') || lowerKey.includes('action')) {
      return {
        canonicalId: 'beIN.Movies.2.Action.badr',
        displayName: 'beIN Movies 2 Action HD (Badr 26°E)',
        contentCategory: 'Films & Séries',
        group: 'Action & Thriller',
      };
    }
    if (lowerKey.includes('3') || lowerKey.includes('drama')) {
      return {
        canonicalId: 'beIN.Movies.3.Drama.badr',
        displayName: 'beIN Movies 3 Drama HD (Badr 26°E)',
        contentCategory: 'Films & Séries',
        group: 'Cinéma Premières',
      };
    }
    if (lowerKey.includes('4') || lowerKey.includes('family')) {
      return {
        canonicalId: 'beIN.Movies.4.Family.badr',
        displayName: 'beIN Movies 4 Family HD (Badr 26°E)',
        contentCategory: 'Films & Séries',
        group: 'Comédie & Famille',
      };
    }
    return {
      canonicalId: 'beIN.Movies.1.Premiere.badr',
      displayName: 'beIN Movies 1 Premiere HD (Badr 26°E)',
      contentCategory: 'Films & Séries',
      group: 'Cinéma Premières',
    };
  }

  if (lowerKey.includes('series')) {
    if (lowerKey.includes('2')) {
      return {
        canonicalId: 'beIN.Series.2.badr',
        displayName: 'beIN Series 2 HD (Badr 26°E)',
        contentCategory: 'Films & Séries',
        group: 'Séries TV & US',
      };
    }
    return {
      canonicalId: 'beIN.Series.1.badr',
      displayName: 'beIN Series 1 HD (Badr 26°E)',
      contentCategory: 'Films & Séries',
      group: 'Séries TV & US',
    };
  }

  if (lowerKey.includes('drama')) {
    return {
      canonicalId: 'beIN.Drama.1.badr',
      displayName: 'beIN Drama 1 HD (Badr 26°E)',
      contentCategory: 'Films & Séries',
      group: 'Séries TV & US',
    };
  }

  if (lowerKey.includes('gourmet') || lowerKey.includes('fatafeat')) {
    return {
      canonicalId: lowerKey.includes('fatafeat') ? 'Fatafeat.badr' : 'beIN.Gourmet.badr',
      displayName: lowerKey.includes('fatafeat')
        ? 'Fatafeat HD (Badr 26°E)'
        : 'beIN Gourmet HD (Badr 26°E)',
      contentCategory: 'Musique & Divertissement',
      group: 'Musique & Divertissement',
    };
  }

  if (lowerKey.includes('baraem') || lowerKey.includes('jeem')) {
    return {
      canonicalId: lowerKey.includes('baraem') ? 'Baraem.badr' : 'Jeem.badr',
      displayName: lowerKey.includes('baraem')
        ? 'Baraem HD (Badr 26°E)'
        : 'Jeem TV HD (Badr 26°E)',
      contentCategory: 'Jeunesse / Enfants',
      group: 'Jeunesse / Enfants',
    };
  }

  if (lowerKey.includes('bein')) {
    if (lowerKey.includes('news')) {
      return {
        canonicalId: 'beIN.Sports.News.badr',
        displayName: "beIN Sports News HD (Badr / Es'hailSat 26°E)",
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
      };
    }
    if (lowerKey.includes('afc')) {
      return {
        canonicalId: 'beIN.Sports.AFC.badr',
        displayName: 'beIN Sports AFC HD (Badr 26°E)',
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
      };
    }
    if (lowerKey.includes('nba')) {
      return {
        canonicalId: 'beIN.Sports.NBA.badr',
        displayName: 'beIN Sports NBA HD (Badr 26°E)',
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
      };
    }
    if (lowerKey.includes('premium')) {
      const pNum = lowerKey.includes('3') ? '3' : lowerKey.includes('2') ? '2' : '1';
      return {
        canonicalId: `beIN.Sports.Premium.${pNum}.badr`,
        displayName: `beIN Sports ${pNum} Premium HD (Badr 26°E)`,
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
      };
    }
    if (lowerKey.includes('english')) {
      const eNum = lowerKey.includes('3') ? '3' : lowerKey.includes('2') ? '2' : '1';
      return {
        canonicalId: `beIN.Sports.English.${eNum}.badr`,
        displayName: `beIN Sports ${eNum} English HD (Badr 26°E)`,
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
      };
    }
    if (lowerKey.includes('french')) {
      const fNum = lowerKey.includes('3') ? '3' : lowerKey.includes('2') ? '2' : '1';
      return {
        canonicalId: `beIN.Sports.French.${fNum}.badr`,
        displayName: `beIN Sports ${fNum} French HD (Badr 26°E)`,
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
      };
    }
    if (lowerKey.includes('max')) {
      const mNum = lowerKey.includes('4')
        ? '4'
        : lowerKey.includes('3')
        ? '3'
        : lowerKey.includes('2')
        ? '2'
        : '1';
      return {
        canonicalId: `beIN.Sports.MAX.${mNum}.badr`,
        displayName: `beIN Sports MAX ${mNum} HD (Badr 26°E)`,
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
      };
    }
    if (lowerKey.includes('xtra') || lowerKey.includes('extra')) {
      const xNum = lowerKey.includes('3') ? '3' : lowerKey.includes('2') ? '2' : '1';
      return {
        canonicalId: `beIN.Sports.Xtra.${xNum}.badr`,
        displayName: `beIN Sports Xtra ${xNum} HD (Badr 26°E)`,
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
      };
    }
    const stripped = lowerKey.replace(/mono-\d+/g, '');
    const numMatch = stripped.match(/sports?[._-]*(\d+)/i) || stripped.match(/bein[._-]*(\d+)/i);
    if (numMatch) {
      const rawNum = numMatch[1];
      const chNum =
        rawNum === '66'
          ? '6'
          : ['1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(rawNum)
          ? rawNum
          : '1';
      return {
        canonicalId: `beIN.Sports.${chNum}.badr`,
        displayName: `beIN Sports ${chNum} HD (Badr / Es'hailSat 26°E)`,
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
      };
    }
    return {
      canonicalId: 'beIN.Sports.1.badr',
      displayName: "beIN Sports 1 HD (Badr / Es'hailSat 26°E)",
      contentCategory: 'Sport / Football',
      group: 'Sport / Football',
    };
  }

  return null;
}

function resolveDynamicGlobalSpec(rawId: string): WhitelistedChannelSpec | null {
  const key = cleanXmltvChannelId(rawId).toLowerCase();

  // 1. Chaînes TNT France & Canal+ France / Bis TV (.fr) prédéfinies
  const frEntry = FRENCH_TNT_AND_CINEMA_MAP[key];
  if (frEntry) {
    const isTnt = frEntry.bouquetId === 'tnt_fr';
    const bouquets: Exclude<BouquetFilter, 'Tous'>[] = isTnt
      ? ['Astra TNT France', 'Astra Canal+ France', 'TNT France', 'Canal+ France']
      : ['Astra Canal+ France', 'Canal+ France'];
    if (frEntry.includeBisHotbird) {
      bouquets.push('Hotbird Bis TV/Rai', 'Bis TV (Hotbird 13°E)', 'Bis TV France');
    }
    const satellites: Exclude<SatelliteFilter, 'Tous'>[] = frEntry.includeBisHotbird
      ? ['Astra 19.2°E', 'Hotbird 13°E']
      : ['Astra 19.2°E'];
    return {
      canonicalId: frEntry.canonicalId,
      displayName: frEntry.displayName,
      contentCategory: frEntry.contentCategory || 'Films & Séries',
      country: 'FR',
      satellites,
      orbitalPosition: frEntry.includeBisHotbird
        ? 'Astra 19.2°E / Hotbird 13°E'
        : 'Astra 19.2°E',
      bouquets,
      bouquetId: frEntry.bouquetId,
      group: frEntry.group,
      audioTrackLabel: 'Audio FR + VO Multi',
      subtitleTrackLabel: 'Sous-titres DVB-Sub FR / Malentendants',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // 2. Autres chaînes Françaises (.fr) sur Astra 19.2°E & Hotbird 13°E (Tous genres & catégories)
  if (key.endsWith('.fr')) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;
    const cleanName = formatCleanChannelDisplayName(rawId, /\.fr$/i);
    if (!cleanName) return null;
    const isBis =
      key.includes('ab1') ||
      key.includes('action') ||
      key.includes('mangas') ||
      key.includes('teva') ||
      key.includes('rtl9') ||
      key.includes('histoire') ||
      key.includes('animaux') ||
      key.includes('science') ||
      key.includes('chasse') ||
      key.includes('trek');
    return {
      canonicalId: key,
      displayName: cleanName,
      contentCategory: classified.contentCategory,
      country: 'FR',
      satellites: isBis
        ? ['Astra 19.2°E', 'Hotbird 13°E']
        : ['Astra 19.2°E'],
      orbitalPosition: 'Astra 19.2°E',
      bouquets: isBis
        ? ['Astra Canal+ France', 'Hotbird Bis TV/Rai', 'Canal+ France', 'Bis TV France']
        : ['Astra Canal+ France', 'Canal+ France'],
      bouquetId: 'astra_canal_fr',
      group: classified.group,
      audioTrackLabel: 'Audio FR + VO Multi',
      subtitleTrackLabel: 'DVB-Sub FR / VOSTFR',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // 3. Nilesat 7°W & Badr / Es'hailSat 26°E (MENA : .ae, .sa, .eg, .bein, .qa, .kw, .lb, .ma)
  // Séparation stricte des bouquets par satellite :
  // - Nilesat 7°W : [Nilesat MBC/OSN/Rotana], [TNT Arabe/Égypte]
  // - Badr 26°E : [Badr beIN (Sports & Movies)], [Badr SSC], [Badr TV Arabes/Al Kass]
  if (
    key.endsWith('.ae') ||
    key.endsWith('.sa') ||
    key.endsWith('.eg') ||
    key.endsWith('.bein') ||
    key.endsWith('.qa') ||
    key.endsWith('.kw') ||
    key.endsWith('.lb') ||
    key.endsWith('.ma')
  ) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;

    const cleanName = formatCleanChannelDisplayName(
      rawId,
      /\.(ae|sa|eg|bein|qa|kw|lb|ma)$/i
    );
    if (!cleanName) return null;

    const isBeinOffer =
      key.endsWith('.bein') ||
      key.includes('bein') ||
      key.includes('baraem') ||
      key.includes('jeem') ||
      key.includes('fatafeat');

    const isSscOffer = key.includes('ssc');

    const isBadrGulfOrAlKass =
      key.includes('alkass') ||
      key.includes('al.kass') ||
      key.includes('ad.sport') ||
      key.includes('abu.dhabi') ||
      key.includes('dubai.sport') ||
      key.includes('dubai.tv') ||
      key.includes('sama.dubai') ||
      key.includes('saudi') ||
      key.includes('sbc') ||
      key.includes('ekhbariya') ||
      key.includes('asharq') ||
      key.includes('sky.news') ||
      key.includes('quest') ||
      key.includes('majid') ||
      key.includes('kuwait') ||
      key.includes('bahrain') ||
      key.includes('oman') ||
      key.includes('sharjah') ||
      key.endsWith('.qa');

    const isNilesatMbcOsnRotana =
      key.includes('osn') ||
      key.includes('alfa') ||
      key.includes('mbc') ||
      key.includes('rotana') ||
      key.includes('wanasah') ||
      key.includes('wannasah') ||
      key.includes('dubai.one') ||
      key.includes('star.movies') ||
      key.includes('star.world');

    if (isBeinOffer) {
      const canonicalBein = resolveCanonicalBeinChannelSpec(key);
      return {
        canonicalId: canonicalBein ? canonicalBein.canonicalId : key,
        displayName: canonicalBein
          ? cleanOfficialChannelName(canonicalBein.displayName)
          : cleanName,
        contentCategory: canonicalBein
          ? canonicalBein.contentCategory
          : classified.contentCategory,
        country: 'AR',
        satellites: ["Badr / Es'hailSat 26°E"],
        orbitalPosition: 'Badr 26°E',
        bouquets: ['Badr beIN (Sports & Movies)'],
        bouquetId: 'badr_bein_ssc',
        group: canonicalBein ? canonicalBein.group : classified.group,
        audioTrackLabel: 'Multi-Audio AR / VO EN (Dolby)',
        subtitleTrackLabel: 'DVB-Sub AR / EN',
        hasPolishLektor: false,
        hasSubtitles: true,
      };
    }

    if (isSscOffer) {
      return {
        canonicalId: key,
        displayName: cleanName,
        contentCategory: classified.contentCategory,
        country: 'AR',
        satellites: ["Badr / Es'hailSat 26°E"],
        orbitalPosition: 'Badr 26°E',
        bouquets: ['Badr SSC'],
        bouquetId: 'badr_bein_ssc',
        group: classified.group,
        audioTrackLabel: 'Audio AR / Stadium HD',
        subtitleTrackLabel: 'Roshn Saudi League · AFC',
        hasPolishLektor: false,
        hasSubtitles: true,
      };
    }

    if (isBadrGulfOrAlKass) {
      return {
        canonicalId: key,
        displayName: cleanName,
        contentCategory: classified.contentCategory,
        country: 'AR',
        satellites: ["Badr / Es'hailSat 26°E"],
        orbitalPosition: 'Badr 26°E',
        bouquets: ['Badr TV Arabes/Al Kass'],
        bouquetId: 'badr_bein_ssc',
        group: classified.group,
        audioTrackLabel: 'Audio Original AR / EN',
        subtitleTrackLabel: 'DVB-Sub AR / EN',
        hasPolishLektor: false,
        hasSubtitles: true,
      };
    }

    if (isNilesatMbcOsnRotana) {
      return {
        canonicalId: key,
        displayName: cleanName,
        contentCategory: classified.contentCategory,
        country: 'AR',
        satellites: ['Nilesat 7°W'],
        orbitalPosition: 'Nilesat 7°W',
        bouquets: ['Nilesat MBC/OSN/Rotana'],
        bouquetId: 'nilesat_osn_mbc',
        group: classified.group,
        audioTrackLabel: 'VO Anglais / Multi-Audio AR',
        subtitleTrackLabel: 'DVB-Sub AR / EN',
        hasPolishLektor: false,
        hasSubtitles: true,
      };
    }

    // Autres chaînes arabes / égyptiennes / maghrébines -> Nilesat 7°W [TNT Arabe/Égypte]
    return {
      canonicalId: key,
      displayName: cleanName,
      contentCategory: classified.contentCategory,
      country: 'AR',
      satellites: ['Nilesat 7°W'],
      orbitalPosition: 'Nilesat 7°W',
      bouquets: ['TNT Arabe/Égypte'],
      bouquetId: 'nilesat_osn_mbc',
      group: classified.group,
      audioTrackLabel: 'Audio Original AR / Multi',
      subtitleTrackLabel: 'DVB-Sub AR / EN',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // 4. Espagne (.es) — Astra 19.2°E & Hispasat 30°W (Movistar+ / DAZN ES / TDT)
  if (key.endsWith('.es')) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;
    const cleanName = formatCleanChannelDisplayName(rawId, /\.es$/i);
    if (!cleanName) return null;

    return {
      canonicalId: key,
      displayName: cleanName,
      contentCategory: classified.contentCategory,
      country: 'ES',
      satellites: ['Astra 19.2°E', 'Hispasat 30°W'],
      orbitalPosition: 'Astra 19.2°E',
      bouquets: ['Astra Movistar+ España', 'Hispasat Meo/NOS/Movistar'],
      bouquetId: 'movistar_es',
      group: classified.group,
      audioTrackLabel: 'Dual Audio ES + VO EN',
      subtitleTrackLabel: 'DVB-Sub ES / VO',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // 5. Hispasat 30°W (.pt — Portugal MEO / NOS & Movistar) — Toutes catégories
  if (key.endsWith('.pt')) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;

    const cleanName = formatCleanChannelDisplayName(rawId, /\.pt$/i);
    if (!cleanName) return null;

    return {
      canonicalId: key,
      displayName: cleanName,
      contentCategory: classified.contentCategory,
      country: 'ES',
      satellites: ['Hispasat 30°W'],
      orbitalPosition: 'Hispasat 30°W',
      bouquets: ['Hispasat Meo/NOS/Movistar'],
      bouquetId: 'hispasat_meo_nos',
      group: classified.group,
      audioTrackLabel: 'VO Anglais / PT Original',
      subtitleTrackLabel: 'DVB-Sub PT',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // 6. Allemagne (.de) — Astra 19.2°E (Sky DE / DAZN DE / ARD / ZDF) — Toutes catégories
  if (key.endsWith('.de')) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;
    const cleanName = formatCleanChannelDisplayName(rawId, /\.de$/i);
    if (!cleanName) return null;

    return {
      canonicalId: key,
      displayName: cleanName,
      contentCategory: classified.contentCategory,
      country: 'DE',
      satellites: ['Astra 19.2°E'],
      orbitalPosition: 'Astra 19.2°E',
      bouquets: ['Sky DE / DAZN DE'],
      bouquetId: 'sky_de',
      group: classified.group,
      audioTrackLabel: 'Dual Audio DE / VO EN',
      subtitleTrackLabel: 'DVB-Sub DE / Teletext',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // 7. Italie (.it) — Hotbird 13°E (Rai / Mediaset / Sky Italia) — Toutes catégories
  if (key.endsWith('.it')) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;
    const cleanName = formatCleanChannelDisplayName(rawId, /\.it$/i);
    if (!cleanName) return null;

    return {
      canonicalId: key,
      displayName: cleanName,
      contentCategory: classified.contentCategory,
      country: 'IT',
      satellites: ['Hotbird 13°E'],
      orbitalPosition: 'Hotbird 13°E',
      bouquets: ['Hotbird Bis TV/Rai'],
      bouquetId: 'sky_it',
      group: classified.group,
      audioTrackLabel: 'Dual Audio IT / VO EN',
      subtitleTrackLabel: 'DVB-Sub IT / Teletext',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // 8. Pologne (.pl) — Hotbird 13°E (Polsat / Cyfra+ / Canal+ PL) — Toutes catégories
  if (key.endsWith('.pl')) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;
    const cleanName = formatCleanChannelDisplayName(rawId, /\.pl$/i);
    if (!cleanName) return null;

    return {
      canonicalId: key,
      displayName: cleanName,
      contentCategory: classified.contentCategory,
      country: 'PL',
      satellites: ['Hotbird 13°E'],
      orbitalPosition: 'Hotbird 13°E',
      bouquets: ['Hotbird Polsat/Cyfra+'],
      bouquetId: 'canal_pl',
      group: classified.group,
      audioTrackLabel: 'Multi-Audio PL / VO EN',
      subtitleTrackLabel: 'DVB-Sub PL / EN',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // 9a. Eutelsat 16°E (Albanie, Balkans, Croatie, Bulgarie & TVR Roumanie : .al, .rs, .hr, .ba, .si, .mk, .me, .bg)
  // Bouquets officiels : DigitAlb (Albanie), Total TV (Balkans / Serbie / Croatie), MaxTV Sat (Croatie), A1 Bulgaria / A1 Hrvatska, TVR / Chaînes Nationales (Roumanie)
  if (
    key.endsWith('.al') ||
    key.endsWith('.rs') ||
    key.endsWith('.hr') ||
    key.endsWith('.ba') ||
    key.endsWith('.si') ||
    key.endsWith('.mk') ||
    key.endsWith('.me') ||
    key.endsWith('.bg')
  ) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;

    const cleanName = formatCleanChannelDisplayName(
      rawId,
      /\.(al|rs|hr|ba|si|mk|me|bg)$/i
    );
    if (!cleanName) return null;

    const isRtshNationalAl =
      key.includes('rtsh') || cleanName.toLowerCase().startsWith('rtsh');

    const isDigitAlb =
      key.endsWith('.al') ||
      key.includes('digitalb') ||
      key.includes('klan') ||
      key.includes('top.channel') ||
      key.includes('supersport') ||
      key.includes('vizion') ||
      key.includes('tring');

    const isMaxTvHr =
      key.endsWith('.hr') ||
      key.includes('hrt') ||
      key.includes('maxsport') ||
      key.includes('maxtv') ||
      key.includes('doma');

    const isA1 =
      key.endsWith('.bg') ||
      key.includes('diema') ||
      key.includes('bnt') ||
      key.includes('btv') ||
      key.includes('a1');

    const isPanBalkan =
      key.includes('arena') ||
      key.includes('sport.klub') ||
      key.includes('cinestar') ||
      key.includes('hbo') ||
      key.includes('cinemax') ||
      key.includes('fox') ||
      key.includes('star') ||
      key.includes('discovery') ||
      key.includes('nat.geo') ||
      key.includes('national.geographic') ||
      key.includes('history') ||
      key.includes('viasat') ||
      key.includes('pickbox') ||
      key.includes('diva') ||
      key.includes('epic.drama') ||
      key.includes('sci.fi') ||
      key.includes('axn');

    const eu16Bouquets: Exclude<BouquetFilter, 'Tous'>[] =
      isRtshNationalAl || isDigitAlb
        ? ['DigitAlb (Albanie)']
        : isMaxTvHr || isA1
        ? [
            'MAXtv / A1 Croatia',
            'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)',
          ]
        : isPanBalkan
        ? [
            'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)',
            'MAXtv / A1 Croatia',
          ]
        : [
            'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)',
          ];

    return {
      canonicalId: key,
      displayName: cleanName,
      contentCategory: classified.contentCategory,
      country: 'EU',
      satellites: ['Eutelsat 16°E'],
      orbitalPosition: 'Eutelsat 16°E',
      bouquets: eu16Bouquets,
      bouquetId: 'eutelsat_16e_digitalb',
      group: classified.group,
      audioTrackLabel: 'Dual VO / Multi-Audio',
      subtitleTrackLabel: 'DVB-Sub EU / Teletext',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // 9b. Thor 0.8°W / Intelsat 10-02 (Roumanie & Hongrie : .ro, .hu, .sk, .cz) — Focus Sat (Roumanie), Direct One (Hongrie), Digi TV
  if (
    key.endsWith('.ro') ||
    key.endsWith('.hu') ||
    key.endsWith('.sk') ||
    key.endsWith('.cz')
  ) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;

    const cleanName = formatCleanChannelDisplayName(
      rawId,
      /\.(ro|hu|sk|cz)$/i
    );
    if (!cleanName) return null;

    const isDirectOneHu =
      key.endsWith('.hu') || key.includes('direct.one') || key.includes('spiler');
    const isDigi =
      key.includes('digi') ||
      key.includes('film.now') ||
      key.includes('utv');

    const thorBouquets: Exclude<BouquetFilter, 'Tous'>[] = isDirectOneHu
      ? ['Direct One (Hongrie)', 'Digi TV']
      : isDigi
      ? ['Digi TV', 'Focus Sat (Roumanie)']
      : ['Focus Sat (Roumanie)', 'Digi TV', 'Direct One (Hongrie)'];

    return {
      canonicalId: key,
      displayName: cleanName,
      contentCategory: classified.contentCategory,
      country: 'EU',
      satellites: ['Thor 0.8°W / Intelsat 10-02', 'Thor 0.8°W'],
      orbitalPosition: 'Thor 0.8°W',
      bouquets: thorBouquets,
      bouquetId: 'thor_08w_focussat',
      group: classified.group,
      audioTrackLabel: 'Dual VO / Multi-Audio',
      subtitleTrackLabel: 'DVB-Sub RO/HU / Teletext',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // 9c. TurkmenÄlem 52°E / MonacoSat 52°E (.tm, .uz, alem) — Alem TV & Bouquet National Turkmène
  if (
    key.endsWith('.tm') ||
    key.endsWith('.uz') ||
    key.includes('alem.tv') ||
    key.includes('turkmen')
  ) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;
    const cleanName = formatCleanChannelDisplayName(rawId, /\.(tm|uz)$/i);
    if (!cleanName) return null;
    const isNationalTm =
      key.endsWith('.tm') ||
      key.includes('altyn') ||
      key.includes('miras') ||
      key.includes('yaslyk') ||
      key.includes('owazy') ||
      key.includes('turkmenistan');

    return {
      canonicalId: key,
      displayName: cleanName,
      contentCategory: classified.contentCategory,
      country: 'EU',
      satellites: ['TurkmenÄlem 52°E', 'MonacoSat 52°E'],
      orbitalPosition: 'TurkmenÄlem 52°E',
      bouquets: isNationalTm
        ? ['Bouquet National Turkmène', 'Turkmenistan National TV']
        : ['Alem TV'],
      bouquetId: 'turkmenalem_52e_alem',
      group: classified.group,
      audioTrackLabel: 'Multi-Audio / VO Original',
      subtitleTrackLabel: 'DVB-Sub / Multi',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // 9d. MonacoSat 52°E / TurkmenÄlem 52°E (.mc, .ir, .52e, persiana, wns, ava, iran.int, afghanistan.int, big.bang)
  if (
    key.endsWith('.mc') ||
    key.endsWith('.ir') ||
    key.endsWith('.52e') ||
    key.includes('persiana') ||
    key.includes('big.bang') ||
    key.includes('bigbang')
  ) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;
    const cleanName = formatCleanChannelDisplayName(rawId, /\.(mc|ir|52e)$/i);
    if (!cleanName) return null;
    const isBigBang = key.includes('big.bang') || key.includes('bigbang');
    const isInfo52e =
      key.includes('iran.int') || key.includes('afghanistan.int');
    const isWns52e =
      key.includes('ava.') ||
      key.includes('fx.') ||
      key.includes('avang') ||
      key.includes('4u.family') ||
      key.includes('pmc');

    return {
      canonicalId: key,
      displayName: cleanName,
      contentCategory: classified.contentCategory,
      country: 'EU',
      satellites: ['MonacoSat 52°E', 'TurkmenÄlem 52°E'],
      orbitalPosition: 'MonacoSat 52°E',
      bouquets: isBigBang
        ? ['Big Bang TV']
        : isInfo52e
        ? ['Information', 'Groupe WNS']
        : isWns52e
        ? ['Groupe WNS']
        : ['Groupe Persiana', 'Persiana Media Group (Farsi/Sport/Cinema)'],
      bouquetId: 'monacosat_52e_persiana',
      group: classified.group,
      audioTrackLabel: 'Audio Original / VO EN',
      subtitleTrackLabel: 'DVB-Sub Farsi / EN',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // 9e. Bouquet TRT Network complet (.tr ou identifiants officiels TRT)
  if (key.endsWith('.tr') || /\btrt[._0-9a-z]/i.test(key)) {
    const kNorm = key.replace(/[^a-z0-9]/g, '');
    const trtSpecs: Record<
      string,
      {
        canonicalId: string;
        displayName: string;
        contentCategory: Exclude<ContentCategoryFilter, 'Tous'>;
        group: Exclude<ChannelGroup, 'Tous'>;
        transponder: string;
        defaultIcon: string;
      }
    > = {
      trt1: {
        canonicalId: 'TRT.1.tr',
        displayName: 'TRT 1 HD',
        contentCategory: 'Films & Séries',
        group: 'Cinéma Premières',
        transponder: '11596/H/29980',
        defaultIcon:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/TRT_1_logo_%282021-%29.svg/512px-TRT_1_logo_%282021-%29.svg.png',
      },
      trthaber: {
        canonicalId: 'TRT.Haber.tr',
        displayName: 'TRT Haber HD',
        contentCategory: 'Actualités / News',
        group: 'Actualités / News',
        transponder: '11596/H/29980',
        defaultIcon:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/TRT_Haber_logo_%282020-%29.svg/512px-TRT_Haber_logo_%282020-%29.svg.png',
      },
      trtspor: {
        canonicalId: 'TRT.Spor.tr',
        displayName: 'TRT Spor HD',
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        transponder: '11596/H/29980',
        defaultIcon:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/TRT_Spor_logo_%282022%29.svg/512px-TRT_Spor_logo_%282022%29.svg.png',
      },
      trtspor2: {
        canonicalId: 'TRT.Spor.2.tr',
        displayName: 'TRT Spor 2',
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        transponder: '11596/H/29980',
        defaultIcon:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/TRT_Spor_Y%C4%B1ld%C4%B1z_logo.svg/512px-TRT_Spor_Y%C4%B1ld%C4%B1z_logo.svg.png',
      },
      trtsporyildiz: {
        canonicalId: 'TRT.Spor.2.tr',
        displayName: 'TRT Spor 2',
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        transponder: '11596/H/29980',
        defaultIcon:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/TRT_Spor_Y%C4%B1ld%C4%B1z_logo.svg/512px-TRT_Spor_Y%C4%B1ld%C4%B1z_logo.svg.png',
      },
      trtworld: {
        canonicalId: 'TRT.World.tr',
        displayName: 'TRT World',
        contentCategory: 'Actualités / News',
        group: 'Actualités / News',
        transponder: '11024/H/3333',
        defaultIcon:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/TRT_World_logo.svg/512px-TRT_World_logo.svg.png',
      },
      trtcocuk: {
        canonicalId: 'TRT.Cocuk.tr',
        displayName: 'TRT Çocuk',
        contentCategory: 'Jeunesse / Enfants',
        group: 'Jeunesse / Enfants',
        transponder: '11596/H/29980',
        defaultIcon:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/TRT_%C3%87ocuk_logo_%282021%29.svg/512px-TRT_%C3%87ocuk_logo_%282021%29.svg.png',
      },
      trtbelgesel: {
        canonicalId: 'TRT.Belgesel.tr',
        displayName: 'TRT Belgesel',
        contentCategory: 'Documentaires',
        group: 'Documentaires',
        transponder: '11637/H/30000',
        defaultIcon:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/TRT_Belgesel_logo_%282019%29.svg/512px-TRT_Belgesel_logo_%282019%29.svg.png',
      },
      trtmuzik: {
        canonicalId: 'TRT.Muzik.tr',
        displayName: 'TRT Müzik',
        contentCategory: 'Musique & Divertissement',
        group: 'Musique & Divertissement',
        transponder: '11637/H/30000',
        defaultIcon:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/TRT_M%C3%BCzik_logo_%282021%29.svg/512px-TRT_M%C3%BCzik_logo_%282021%29.svg.png',
      },
      trtavaz: {
        canonicalId: 'TRT.Avaz.tr',
        displayName: 'TRT Avaz',
        contentCategory: 'Films & Séries',
        group: 'Séries TV & US',
        transponder: '11637/H/30000',
        defaultIcon:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/TRT_Avaz_logo_%282019%29.svg/512px-TRT_Avaz_logo_%282019%29.svg.png',
      },
      trtturk: {
        canonicalId: 'TRT.Turk.tr',
        displayName: 'TRT Türk',
        contentCategory: 'Films & Séries',
        group: 'Comédie & Famille',
        transponder: '11024/H/3333',
        defaultIcon:
          'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/TRT_T%C3%BCrk_logo_%282020%29.svg/512px-TRT_T%C3%BCrk_logo_%282020%29.svg.png',
      },
    };

    const stripped = kNorm.replace(/(hd|tr|uk)$/g, '');
    const matchedTrt =
      trtSpecs[stripped] ||
      (stripped.startsWith('trtspor2') || stripped.includes('sporyildiz')
        ? trtSpecs.trtspor2
        : stripped.startsWith('trtspor')
        ? trtSpecs.trtspor
        : stripped.startsWith('trthaber')
        ? trtSpecs.trthaber
        : stripped.startsWith('trtworld')
        ? trtSpecs.trtworld
        : stripped.startsWith('trtcocuk')
        ? trtSpecs.trtcocuk
        : stripped.startsWith('trtbelgesel')
        ? trtSpecs.trtbelgesel
        : stripped.startsWith('trtmuzik')
        ? trtSpecs.trtmuzik
        : stripped.startsWith('trtavaz')
        ? trtSpecs.trtavaz
        : stripped.startsWith('trtturk')
        ? trtSpecs.trtturk
        : stripped.startsWith('trt1')
        ? trtSpecs.trt1
        : null);

    if (matchedTrt) {
      return {
        canonicalId: matchedTrt.canonicalId,
        displayName: matchedTrt.displayName,
        contentCategory: matchedTrt.contentCategory,
        country: 'EU',
        satellites: ['Türksat 42°E', 'Türksat 42°E / Eutelsat 7°E'],
        orbitalPosition: 'Türksat 42°E / Eutelsat 7°E',
        bouquets: ['TRT Network'],
        bouquetId: 'trt_network',
        group: matchedTrt.group,
        audioTrackLabel: 'Audio Original TR / EN HD',
        subtitleTrackLabel: 'TRT Network · Türksat 42°E / Eutelsat 7°E',
        hasPolishLektor: false,
        hasSubtitles: true,
        defaultIcon: matchedTrt.defaultIcon,
      };
    }
  }

  // 10. Star One D2 70°W / Amazonas 61°W / Intelsat 43.1°W & SES-6 40.5°W (BR & LATAM) — Toutes catégories
  if (
    key.endsWith('.br') ||
    key.endsWith('.ar') ||
    key.endsWith('.co') ||
    key.endsWith('.cl') ||
    key.endsWith('.mx')
  ) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;

    const cleanName = formatCleanChannelDisplayName(
      rawId,
      /\.(br|ar|co|cl|mx)$/i
    );
    if (!cleanName) return null;
    const isBrazil = key.endsWith('.br');

    return {
      canonicalId: key,
      displayName: cleanName,
      contentCategory: classified.contentCategory,
      country: isBrazil ? 'BR' : 'LATAM',
      satellites: isBrazil
        ? ['Star One D2 70°W', 'Amazonas 61°W', 'Intelsat 43.1°W / SES-6 40.5°W']
        : ['Amazonas 61°W', 'Intelsat 43.1°W / SES-6 40.5°W'],
      orbitalPosition: isBrazil ? 'Star One D2 70°W' : 'Amazonas 61°W',
      bouquets: isBrazil
        ? ['Claro TV Brasil', 'Vivo TV / Movistar LATAM', 'DirecTV LATAM / Sky Brasil']
        : ['Vivo TV / Movistar LATAM', 'DirecTV LATAM / Sky Brasil'],
      bouquetId: isBrazil ? 'starone_70w_claro_br' : 'intelsat_43w_directv',
      group: classified.group,
      audioTrackLabel: 'Dual Audio PT/ES + VO EN',
      subtitleTrackLabel: 'Closed Captions / DVB-Sub',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  return null;
}

function mapCanonicalSatelliteAndBouquets(
  spec: WhitelistedChannelSpec
): {
  satellites: Exclude<SatelliteFilter, 'Tous'>[];
  orbitalPosition: string;
  bouquets: Exclude<BouquetFilter, 'Tous'>[];
  bouquetId: EpgBouquetId;
} {
  const idLower = (spec.canonicalId || '').toLowerCase();
  const nameLower = (spec.displayName || '').toLowerCase();
  const combined = `${idLower} ${nameLower}`;

  // 1. Séparation stricte Nilesat 7°W vs Badr 26°E pour les chaînes MENA (country === 'AR')
  if (spec.country === 'AR') {
    const isBein =
      combined.includes('bein') ||
      combined.includes('baraem') ||
      combined.includes('jeem') ||
      combined.includes('fatafeat');
    if (isBein) {
      return {
        satellites: ["Badr / Es'hailSat 26°E"],
        orbitalPosition: "Badr / Es'hailSat 26°E",
        bouquets: ['Badr beIN (Sports & Movies)'],
        bouquetId: 'badr_bein_ssc',
      };
    }

    const isSsc = combined.includes('ssc');
    if (isSsc) {
      return {
        satellites: ["Badr / Es'hailSat 26°E"],
        orbitalPosition: "Badr / Es'hailSat 26°E",
        bouquets: ['Badr SSC'],
        bouquetId: 'badr_bein_ssc',
      };
    }

    const isSharedPanArabNewsDoc =
      combined.includes('aljazeera') ||
      combined.includes('al jazeera') ||
      combined.includes('al.jazeera') ||
      combined.includes('alarabiya') ||
      combined.includes('al arabiya') ||
      combined.includes('al.arabiya');

    if (isSharedPanArabNewsDoc) {
      return {
        satellites: ['Nilesat 7°W', "Badr / Es'hailSat 26°E"],
        orbitalPosition: "Nilesat 7°W / Badr 26°E",
        bouquets: ['TNT Arabe/Égypte', 'Badr TV Arabes/Al Kass'],
        bouquetId: 'nilesat_osn_mbc',
      };
    }

    const isBadrGulfOrAlKass =
      combined.includes('alkass') ||
      combined.includes('al kass') ||
      combined.includes('al.kass') ||
      combined.includes('ad sport') ||
      combined.includes('abu dhabi') ||
      combined.includes('dubai sport') ||
      combined.includes('dubai tv') ||
      combined.includes('sama dubai') ||
      combined.includes('saudi') ||
      combined.includes('sbc') ||
      combined.includes('ekhbariya') ||
      combined.includes('asharq') ||
      combined.includes('sky news') ||
      combined.includes('quest') ||
      combined.includes('majid') ||
      combined.includes('kuwait') ||
      combined.includes('bahrain') ||
      combined.includes('oman') ||
      combined.includes('sharjah');

    if (isBadrGulfOrAlKass) {
      return {
        satellites: ["Badr / Es'hailSat 26°E"],
        orbitalPosition: "Badr / Es'hailSat 26°E",
        bouquets: ['Badr TV Arabes/Al Kass'],
        bouquetId: 'badr_bein_ssc',
      };
    }

    const isNilesatMbcOsnRotana =
      combined.includes('osn') ||
      combined.includes('mbc') ||
      combined.includes('rotana') ||
      combined.includes('wanasah') ||
      combined.includes('dubai one') ||
      combined.includes('dubai.one') ||
      combined.includes('star movies') ||
      combined.includes('star world');

    if (isNilesatMbcOsnRotana) {
      return {
        satellites: ['Nilesat 7°W'],
        orbitalPosition: 'Nilesat 7°W',
        bouquets: ['Nilesat MBC/OSN/Rotana'],
        bouquetId: 'nilesat_osn_mbc',
      };
    }

    // Chaînes Égypte / Maghreb / TNT Arabe sur Nilesat 7°W
    return {
      satellites: ['Nilesat 7°W'],
      orbitalPosition: 'Nilesat 7°W',
      bouquets: ['TNT Arabe/Égypte'],
      bouquetId: 'nilesat_osn_mbc',
    };
  }

  // 2. Chaînes Européennes (Astra 19.2°E, Hotbird 13°E, Hispasat 30°W)
  const bouquetSet = new Set<Exclude<BouquetFilter, 'Tous'>>();
  const satSet = new Set<Exclude<SatelliteFilter, 'Tous'>>(
    spec.satellites.map(normalizeSatelliteName)
  );
  const bId = inferChannelBouquetId(spec);

  if (spec.country === 'FR') {
    if (
      bId === 'tnt_fr' ||
      bId === 'astra_tnt_fr' ||
      spec.bouquets.some((b) => b.includes('TNT'))
    ) {
      bouquetSet.add('Astra TNT France');
      satSet.add('Astra 19.2°E');
    }
    if (
      bId === 'astra_canal_fr' ||
      spec.bouquets.some((b) => b.includes('Canal+'))
    ) {
      bouquetSet.add('Astra Canal+ France');
      satSet.add('Astra 19.2°E');
    }
    if (
      bId === 'hotbird_bis_fr' ||
      spec.satellites.includes('Hotbird 13°E') ||
      spec.bouquets.some((b) => b.includes('Bis'))
    ) {
      bouquetSet.add('Hotbird Bis TV/Rai');
      satSet.add('Hotbird 13°E');
    }
  } else if (spec.country === 'ES') {
    if (satSet.has('Astra 19.2°E')) {
      bouquetSet.add('Astra Movistar+ España');
    }
    if (satSet.has('Hispasat 30°W')) {
      bouquetSet.add('Hispasat Meo/NOS/Movistar');
    }
  } else if (spec.country === 'DE') {
    satSet.add('Astra 19.2°E');
    bouquetSet.add('Sky DE / DAZN DE');
  } else if (spec.country === 'PL') {
    satSet.add('Hotbird 13°E');
    bouquetSet.add('Hotbird Polsat/Cyfra+');
  } else if (spec.country === 'IT') {
    satSet.add('Hotbird 13°E');
    bouquetSet.add('Hotbird Bis TV/Rai');
  } else {
    for (const b of spec.bouquets) {
      bouquetSet.add(normalizeBouquetName(b));
    }
  }

  return {
    satellites: Array.from(satSet),
    orbitalPosition: normalizeSingleOrbitalPosition(
      spec.orbitalPosition,
      Array.from(satSet)
    ),
    bouquets: Array.from(bouquetSet),
    bouquetId: bId,
  };
}

export function getAllowedSatellitesForBouquets(
  selectedBouquets?: EpgBouquetId[]
): Set<Exclude<SatelliteFilter, 'Tous'>> | null {
  if (!selectedBouquets || selectedBouquets.length === 0) return null;
  const allowed = new Set<Exclude<SatelliteFilter, 'Tous'>>();
  for (const bId of selectedBouquets) {
    if (bId === 'nilesat_osn_mbc') {
      allowed.add('Nilesat 7°W');
    } else if (bId === 'badr_bein_ssc') {
      allowed.add("Badr / Es'hailSat 26°E");
      allowed.add('Badr 26°E');
    } else if (
      bId === 'astra_canal_fr' ||
      bId === 'astra_tnt_fr' ||
      bId === 'tnt_fr' ||
      bId === 'movistar_es' ||
      bId === 'sky_de'
    ) {
      allowed.add('Astra 19.2°E');
    } else if (
      bId === 'hotbird_bis_fr' ||
      bId === 'sky_it' ||
      bId === 'canal_pl'
    ) {
      allowed.add('Hotbird 13°E');
    } else if (bId === 'hispasat_meo_nos') {
      allowed.add('Hispasat 30°W');
    } else if (bId === 'eutelsat_16e_digitalb') {
      allowed.add('Eutelsat 16°E');
    } else if (bId === 'trt_network') {
      allowed.add('Türksat 42°E');
      allowed.add('Türksat 42°E / Eutelsat 7°E');
    } else if (bId === 'thor_08w_focussat') {
      allowed.add('Thor 0.8°W / Intelsat 10-02');
      allowed.add('Thor 0.8°W');
    } else if (bId === 'eutelsat_16e_thor') {
      allowed.add('Eutelsat 16°E');
      allowed.add('Thor 0.8°W / Intelsat 10-02');
      allowed.add('Thor 0.8°W');
    } else if (bId === 'turkmenalem_52e_alem') {
      allowed.add('TurkmenÄlem 52°E');
      allowed.add('MonacoSat 52°E');
    } else if (bId === 'monacosat_52e_persiana') {
      allowed.add('MonacoSat 52°E');
      allowed.add('TurkmenÄlem 52°E');
    } else if (bId === 'starone_70w_claro_br') {
      allowed.add('Star One D2 70°W');
      allowed.add('Star One 70°W');
    } else if (bId === 'amazonas_61w_latam') {
      allowed.add('Amazonas 61°W');
    } else if (bId === 'intelsat_43w_directv') {
      allowed.add('Intelsat 43.1°W / SES-6 40.5°W');
      allowed.add('Intelsat 43.1°W & SES-6 40.5°W');
      allowed.add('SES-6 40.5°W');
    }
  }
  return allowed;
}

export function matchesChannelFilterOptions(
  spec: WhitelistedChannelSpec,
  filterOptions?: EpgParseFilterOptions
): boolean {
  if (!filterOptions) return !spec.hasPolishLektor && spec.hasSubtitles !== false;

  if (
    filterOptions.selectedBouquets &&
    filterOptions.selectedBouquets.length > 0
  ) {
    const allowedSats = getAllowedSatellitesForBouquets(
      filterOptions.selectedBouquets
    );
    if (
      allowedSats &&
      spec.satellites &&
      spec.satellites.length > 0 &&
      !spec.satellites.some((s) => allowedSats.has(s))
    ) {
      return false;
    }
  }

  if (
    filterOptions.selectedBouquets &&
    filterOptions.selectedBouquets.length > 0 &&
    spec.bouquetId
  ) {
    const activeSet = new Set<EpgBouquetId>(filterOptions.selectedBouquets);
    const bId = spec.bouquetId;
    let bouquetAllowed = activeSet.has(bId);

    if (
      !bouquetAllowed &&
      (bId === 'tnt_fr' || bId === 'astra_tnt_fr') &&
      (activeSet.has('astra_tnt_fr') || activeSet.has('tnt_fr'))
    ) {
      bouquetAllowed = true;
    }
    if (
      !bouquetAllowed &&
      (bId === 'turkmenalem_52e_alem' || bId === 'monacosat_52e_persiana') &&
      (activeSet.has('turkmenalem_52e_alem') ||
        activeSet.has('monacosat_52e_persiana'))
    ) {
      bouquetAllowed = true;
    }
    if (
      !bouquetAllowed &&
      (bId === 'eutelsat_16e_digitalb' || bId === 'eutelsat_16e_thor') &&
      (activeSet.has('eutelsat_16e_digitalb') ||
        activeSet.has('eutelsat_16e_thor'))
    ) {
      bouquetAllowed = true;
    }

    if (!bouquetAllowed) {
      return false;
    }
  }

  if (filterOptions.tvProfile === 'espagne') {
    const combined = `${spec.canonicalId || ''} ${spec.displayName || ''}`.toLowerCase();
    const isPortugalOnly =
      combined.endsWith('.pt') ||
      /\b(sport\s*tv|tvcine|rtp\s*[1-3]|sic\b|tvi\b|benfica\s*tv|porto\s*canal)\b/i.test(
        combined
      );
    if (isPortugalOnly) {
      return false;
    }
  }

  if (filterOptions.tvProfile === 'italie') {
    if (spec.bouquetId && spec.bouquetId !== 'sky_it' && spec.country !== 'IT') {
      return false;
    }
  }

  const excludeLektor = filterOptions.excludePolishLektor !== false;
  if (excludeLektor && spec.hasPolishLektor) {
    return false;
  }

  const excludeNoSub = filterOptions.excludeNoSubtitles !== false;
  if (
    excludeNoSub &&
    spec.hasSubtitles === false &&
    spec.contentCategory !== 'Sport / Football' &&
    spec.contentCategory !== 'Actualités / News' &&
    spec.contentCategory !== 'Musique & Divertissement'
  ) {
    return false;
  }

  if (
    filterOptions.enabledCategories &&
    filterOptions.enabledCategories.length > 0
  ) {
    const enabled = filterOptions.enabledCategories;
    const cat: Exclude<ContentCategoryFilter, 'Tous'> =
      spec.contentCategory ||
      (spec.group === 'Sport / Football'
        ? 'Sport / Football'
        : spec.group === 'Documentaires'
        ? 'Documentaires'
        : spec.group === 'Actualités / News'
        ? 'Actualités / News'
        : spec.group === 'Jeunesse / Enfants'
        ? 'Jeunesse / Enfants'
        : spec.group === 'Musique & Divertissement'
        ? 'Musique & Divertissement'
        : 'Films & Séries');

    let matchedCategory = false;
    if (cat === 'Sport / Football' && enabled.includes('Sport / Football')) {
      matchedCategory = true;
    }
    if (cat === 'Documentaires' && enabled.includes('Documentaires')) {
      matchedCategory = true;
    }
    if (cat === 'Actualités / News' && enabled.includes('Actualités / News')) {
      matchedCategory = true;
    }
    if (
      cat === 'Jeunesse / Enfants' &&
      (enabled.includes('Jeunesse / Enfants') ||
        enabled.includes('Jeunesse & Famille'))
    ) {
      matchedCategory = true;
    }
    if (
      cat === 'Musique & Divertissement' &&
      enabled.includes('Musique & Divertissement')
    ) {
      matchedCategory = true;
    }
    if (cat === 'Films & Séries') {
      if (enabled.includes('Films & Séries')) {
        matchedCategory = true;
      } else if (
        spec.group === 'Classiques & Culte' &&
        enabled.includes('Classiques & Culte')
      ) {
        matchedCategory = true;
      } else if (
        spec.group === 'Comédie & Famille' &&
        enabled.includes('Jeunesse & Famille')
      ) {
        matchedCategory = true;
      }
    }
    if (!matchedCategory) return false;
  }

  return true;
}

/**
 * Résout l'identifiant canonique d'une chaîne si et seulement si elle figure
 * dans la liste blanche stricte et respecte les filtres actifs de l'utilisateur.
 */
export function resolveWhitelistedChannelSpec(
  rawId: string,
  filterOptions?: EpgParseFilterOptions
): WhitelistedChannelSpec | null {
  if (!rawId || isAdultChannel(rawId)) return null;
  const key = cleanXmltvChannelId(rawId).toLowerCase();
  if (!key || isAdultChannel(key)) return null;
  const rawTrimmedLower = rawId.trim().toLowerCase();

  const allowedSats = getAllowedSatellitesForBouquets(
    filterOptions?.selectedBouquets
  );

  const sportSpec =
    SPORT_FOOTBALL_WHITELIST[rawTrimmedLower] || SPORT_FOOTBALL_WHITELIST[key];
  if (sportSpec) {
    const mapped = mapCanonicalSatelliteAndBouquets(sportSpec);
    const activeSatellites = allowedSats
      ? mapped.satellites.filter((s) => allowedSats.has(s))
      : mapped.satellites;
    if (allowedSats && activeSatellites.length === 0) {
      return null;
    }
    const fullSportSpec: WhitelistedChannelSpec = {
      ...sportSpec,
      canonicalId: cleanXmltvChannelId(sportSpec.canonicalId),
      displayName: cleanOfficialChannelName(sportSpec.displayName),
      satellites: activeSatellites,
      orbitalPosition: normalizeSingleOrbitalPosition(
        mapped.orbitalPosition,
        activeSatellites
      ),
      bouquets: mapped.bouquets,
      bouquetId: mapped.bouquetId,
      hasSubtitles: sportSpec.hasSubtitles ?? true,
    };
    return matchesChannelFilterOptions(fullSportSpec, filterOptions)
      ? fullSportSpec
      : null;
  }

  const cinemaSpec =
    STRICT_CHANNEL_WHITELIST[rawTrimmedLower] ||
    STRICT_CHANNEL_WHITELIST[key] ||
    resolveDynamicGlobalSpec(rawId);
  if (!cinemaSpec) return null;

  const mapped = mapCanonicalSatelliteAndBouquets(
    cinemaSpec as WhitelistedChannelSpec
  );
  const activeSatellites = allowedSats
    ? mapped.satellites.filter((s) => allowedSats.has(s))
    : mapped.satellites;
  if (allowedSats && activeSatellites.length === 0) {
    return null;
  }

  const fullCinemaSpec: WhitelistedChannelSpec = {
    ...cinemaSpec,
    canonicalId: cleanXmltvChannelId(cinemaSpec.canonicalId),
    displayName: cleanOfficialChannelName(cinemaSpec.displayName),
    bouquetId: mapped.bouquetId,
    contentCategory:
      cinemaSpec.contentCategory ||
      (cinemaSpec.group === 'Sport / Football'
        ? 'Sport / Football'
        : cinemaSpec.group === 'Documentaires'
        ? 'Documentaires'
        : cinemaSpec.group === 'Actualités / News'
        ? 'Actualités / News'
        : cinemaSpec.group === 'Jeunesse / Enfants'
        ? 'Jeunesse / Enfants'
        : cinemaSpec.group === 'Musique & Divertissement'
        ? 'Musique & Divertissement'
        : 'Films & Séries'),
    satellites: activeSatellites,
    orbitalPosition: normalizeSingleOrbitalPosition(
      mapped.orbitalPosition,
      activeSatellites
    ),
    bouquets: mapped.bouquets,
    hasPolishLektor: cinemaSpec.hasPolishLektor ?? false,
    hasSubtitles: cinemaSpec.hasSubtitles ?? true,
  };

  return matchesChannelFilterOptions(fullCinemaSpec, filterOptions)
    ? fullCinemaSpec
    : null;
}

export function resolveCanonicalChannelId(
  rawId: string,
  filterOptions?: EpgParseFilterOptions
): string | null {
  const spec = resolveWhitelistedChannelSpec(rawId, filterOptions);
  return spec ? cleanXmltvChannelId(spec.canonicalId) : null;
}

/**
 * Extrait la valeur d'un attribut dans une balise XML ouvrante
 */
export function extractXmlAttr(tagHeader: string, attrName: string): string {
  const tokenDouble = `${attrName}="`;
  const startIdx = tagHeader.indexOf(tokenDouble);
  if (startIdx !== -1) {
    const valStart = startIdx + tokenDouble.length;
    const valEnd = tagHeader.indexOf('"', valStart);
    if (valEnd !== -1) {
      return tagHeader.slice(valStart, valEnd).trim();
    }
  }
  const tokenSingle = `${attrName}='`;
  const startSingleIdx = tagHeader.indexOf(tokenSingle);
  if (startSingleIdx !== -1) {
    const valStart = startSingleIdx + tokenSingle.length;
    const valEnd = tagHeader.indexOf("'", valStart);
    if (valEnd !== -1) {
      return tagHeader.slice(valStart, valEnd).trim();
    }
  }
  return '';
}

/**
 * Extrait le contenu texte de la première balise XML correspondante
 */
export function extractXmlTagContent(
  xmlBlock: string,
  tagName: string
): string {
  const openToken = `<${tagName}`;
  const startTagIdx = xmlBlock.indexOf(openToken);
  if (startTagIdx === -1) return '';

  const closeAngleIdx = xmlBlock.indexOf('>', startTagIdx + openToken.length);
  if (closeAngleIdx === -1) return '';

  if (xmlBlock.charAt(closeAngleIdx - 1) === '/') return '';

  const closeToken = `</${tagName}>`;
  const endTagIdx = xmlBlock.indexOf(closeToken, closeAngleIdx + 1);
  if (endTagIdx === -1) return '';

  return decodeXmlEntities(xmlBlock.slice(closeAngleIdx + 1, endTagIdx).trim());
}

/**
 * Extrait toutes les occurrences d'une balise XML (ex: <actor>, <director>, <title>)
 */
export function extractAllXmlTagContents(
  xmlBlock: string,
  tagName: string,
  limit = 4
): string[] {
  const results: string[] = [];
  const openToken = `<${tagName}`;
  const closeToken = `</${tagName}>`;
  let searchPos = 0;

  while (results.length < limit) {
    const startTagIdx = xmlBlock.indexOf(openToken, searchPos);
    if (startTagIdx === -1) break;

    const nextChar = xmlBlock.charAt(startTagIdx + openToken.length);
    if (nextChar !== '>' && nextChar !== ' ') {
      searchPos = startTagIdx + openToken.length;
      continue;
    }

    const closeAngleIdx = xmlBlock.indexOf('>', startTagIdx + openToken.length);
    if (closeAngleIdx === -1) break;

    const endTagIdx = xmlBlock.indexOf(closeToken, closeAngleIdx + 1);
    if (endTagIdx === -1) break;

    const val = decodeXmlEntities(
      xmlBlock.slice(closeAngleIdx + 1, endTagIdx).trim()
    );
    if (val) results.push(val);
    searchPos = endTagIdx + closeToken.length;
  }

  return results;
}

/**
 * Convertit systématiquement toute URL non sécurisée (HTTP) en https://
 */
export function ensureHttpsUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (/^http:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  return trimmed;
}

/**
 * Parse un bloc <channel ...>...</channel> en appliquant le filtrage strict :
 * - Satellites Astra 19.2°E, Hotbird 13°E, Hispasat 30°W, Nilesat 7°W
 * - Uniquement Cinéma, Films & Séries Pay-TV
 * - Élimination des chaînes polonaises "Lektor"
 * - Exigence stricte Audio VO Anglais + Sous-titres DVB/Teletext
 */
export function parseChannelBlock(
  block: string,
  index: number,
  sourceMeta?: {
    id: string;
    name: string;
    country: Exclude<CountryCode, 'Tous'>;
  },
  filterOptions?: EpgParseFilterOptions
): EpgChannel | null {
  try {
    const headerEnd = block.indexOf('>');
    if (headerEnd === -1) return null;

    const header = block.slice(0, headerEnd);
    const rawId = decodeXmlEntities(extractXmlAttr(header, 'id'));
    if (!rawId) return null;

    // Vérification dans la Whitelist stricte Cinéma/Séries + VO + Sous-titres + Filtres Utilisateur
    const spec = resolveWhitelistedChannelSpec(rawId, filterOptions);
    if (!spec) {
      return null;
    }

    const url = ensureHttpsUrl(extractXmlTagContent(block, 'url'));

    let rawXmlIcon: string | undefined;
    const iconIdx = block.indexOf('<icon');
    if (iconIdx !== -1) {
      const iconEnd = block.indexOf('>', iconIdx);
      if (iconEnd !== -1) {
        rawXmlIcon = ensureHttpsUrl(
          extractXmlAttr(block.slice(iconIdx, iconEnd + 1), 'src')
        );
      }
    }
    const icon = resolveOfficialChannelLogoUrl(
      spec.canonicalId,
      spec.displayName,
      rawXmlIcon || ensureHttpsUrl(spec.defaultIcon)
    );

    return {
      id: spec.canonicalId,
      displayName: spec.displayName,
      url,
      icon,
      contentCategory:
        spec.contentCategory ||
        (spec.group === 'Sport / Football'
          ? 'Sport / Football'
          : spec.group === 'Documentaires'
          ? 'Documentaires'
          : 'Films & Séries'),
      group: spec.group,
      country: spec.country,
      satellites: spec.satellites,
      orbitalPosition: spec.orbitalPosition,
      bouquets: spec.bouquets,
      bouquetId: spec.bouquetId,
      audioTrackLabel: spec.audioTrackLabel,
      subtitleTrackLabel: spec.subtitleTrackLabel,
      lektorStatus: spec.lektorStatus,
      hasPolishLektor: spec.hasPolishLektor,
      hasSubtitles: spec.hasSubtitles,
      sourceId: sourceMeta?.id || 'default',
      sourceName: sourceMeta?.name || spec.orbitalPosition,
      channelNumber: index + 1,
      programmeCount: 0,
    };
  } catch {
    return null;
  }
}

/**
 * Vérifie qu'un programme ne contient pas de mention explicite "Tylko Lektor" (sans sous-titres)
 * ni d'émission purement sportive/télé-achat sur une chaîne généraliste premium
 */
function isExcludedProgrammeContent(
  title: string,
  rawCategory: string,
  block: string,
  filterOptions?: EpgParseFilterOptions
): boolean {
  if (isPlaceholderProgrammeTitle(title)) {
    return true;
  }
  const lowerTitle = title.toLowerCase();
  const lowerCat = rawCategory.toLowerCase();

  // Exclure le télé-achat, les journaux télévisés ou la publicité en inter-programme
  if (
    lowerCat.includes('teleshopping') ||
    lowerCat.includes('telezakupy') ||
    lowerCat.includes('teletienda') ||
    lowerCat.includes('werbung') ||
    lowerTitle.includes('teleshopping') ||
    lowerTitle.includes('telezakupy') ||
    lowerTitle.includes('teletienda')
  ) {
    return true;
  }

  const excludeLektor = filterOptions?.excludePolishLektor !== false;
  if (
    excludeLektor &&
    block.toLowerCase().includes('lektor') &&
    (block.toLowerCase().includes('brak napisów') ||
      block.toLowerCase().includes('tylko lektor'))
  ) {
    return true;
  }

  const excludeNoSub = filterOptions?.excludeNoSubtitles !== false;
  if (excludeNoSub && block.toLowerCase().includes('brak napisów')) {
    return true;
  }

  return false;
}

/**
 * Parse un bloc <programme ...>...</programme> uniquement s'il appartient à une chaîne de la Whitelist
 */
export function parseProgrammeBlock(
  block: string,
  index: number,
  minKeepStopMs?: number,
  maxKeepStartMs?: number,
  filterOptions?: EpgParseFilterOptions
): {
  programme: EpgProgramme | null;
  startMs: number;
  stopMs: number;
  channelId: string;
} {
  try {
    const headerEnd = block.indexOf('>');
    if (headerEnd === -1) {
      return { programme: null, startMs: 0, stopMs: 0, channelId: '' };
    }

    const header = block.slice(0, headerEnd);
    const rawChannelId = decodeXmlEntities(extractXmlAttr(header, 'channel'));
    if (!rawChannelId) {
      return { programme: null, startMs: 0, stopMs: 0, channelId: '' };
    }

    // Filtrage O(1) : ignorer immédiatement tout programme d'une chaîne hors Whitelist ou hors Bouquets cochés
    const spec = resolveWhitelistedChannelSpec(rawChannelId, filterOptions);
    if (!spec) {
      return { programme: null, startMs: 0, stopMs: 0, channelId: '' };
    }
    const canonicalChannelId = cleanXmltvChannelId(spec.canonicalId);

    const startRaw = extractXmlAttr(header, 'start');
    const stopRaw = extractXmlAttr(header, 'stop');

    const startMs = parseXmltvDate(startRaw);
    const stopMs = parseXmltvDate(stopRaw);

    if (!startMs || !stopMs) {
      return { programme: null, startMs: 0, stopMs: 0, channelId: '' };
    }

    if (minKeepStopMs !== undefined && stopMs < minKeepStopMs) {
      return { programme: null, startMs, stopMs, channelId: canonicalChannelId };
    }
    if (maxKeepStartMs !== undefined && startMs > maxKeepStartMs) {
      return { programme: null, startMs, stopMs, channelId: canonicalChannelId };
    }

    const titles = extractAllXmlTagContents(block, 'title', 2);
    const rawPrimaryTitle = (titles[0] || '').trim();
    if (isPlaceholderProgrammeTitle(rawPrimaryTitle)) {
      return { programme: null, startMs, stopMs, channelId: canonicalChannelId };
    }
    const title = translateEpgTextToFrenchSync(rawPrimaryTitle) || rawPrimaryTitle;
    const originalTitle =
      titles.length > 1 && titles[1] !== title
        ? titles[1]
        : rawPrimaryTitle !== title
        ? rawPrimaryTitle
        : undefined;

    const rawCategory = extractXmlTagContent(block, 'category') || '';

    if (
      isExcludedProgrammeContent(
        rawPrimaryTitle,
        rawCategory,
        block,
        filterOptions
      )
    ) {
      return { programme: null, startMs, stopMs, channelId: canonicalChannelId };
    }

    const rawSubTitle = extractXmlTagContent(block, 'sub-title') || undefined;
    const subTitle = rawSubTitle
      ? translateEpgTextToFrenchSync(rawSubTitle)
      : undefined;
    const description = extractXmlTagContent(block, 'desc') || undefined;
    const category = normalizeCategoryLabel(
      rawCategory,
      rawPrimaryTitle,
      spec.contentCategory
    );
    const date = extractXmlTagContent(block, 'date') || undefined;
    const country = extractXmlTagContent(block, 'country') || undefined;
    const rawEpisodeNum = extractXmlTagContent(block, 'episode-num') || undefined;

    // Conditionnement strict Saison / Épisode : uniquement pour Séries TV & Documentaires avec saison/épisode valides
    let episodeNum: string | undefined = undefined;
    if (
      isProgrammeSeriesOrDocumentary({
        category,
        rawCategory,
        title: rawPrimaryTitle,
        subTitle: rawSubTitle,
      })
    ) {
      const { season, episode } = parseSeasonAndEpisode(
        rawEpisodeNum,
        originalTitle || rawPrimaryTitle,
        rawSubTitle
      );
      episodeNum = formatSeasonEpisodeCode(season, episode);
    }

    let icon: string | undefined;
    const iconIdx = block.indexOf('<icon');
    if (iconIdx !== -1) {
      const iconEnd = block.indexOf('>', iconIdx);
      if (iconEnd !== -1) {
        icon = ensureHttpsUrl(
          extractXmlAttr(block.slice(iconIdx, iconEnd + 1), 'src')
        );
      }
    }

    let directors: string[] | undefined;
    let actors: string[] | undefined;
    if (block.includes('<credits>')) {
      const d = extractAllXmlTagContents(block, 'director', 2);
      const a = extractAllXmlTagContents(block, 'actor', 4);
      if (d.length > 0) directors = d;
      if (a.length > 0) actors = a;
    }

    return {
      channelId: canonicalChannelId,
      startMs,
      stopMs,
      programme: {
        id: `${canonicalChannelId}_${startMs}_${index}`,
        channelId: canonicalChannelId,
        title,
        originalTitle,
        subTitle,
        description,
        category,
        rawCategory: rawCategory || undefined,
        group: spec.group,
        icon,
        startMs,
        stopMs,
        date,
        country,
        episodeNum,
        directors,
        actors,
        hasOriginalAudioVO: true,
        hasSubtitles: true,
      },
    };
  } catch {
    return { programme: null, startMs: 0, stopMs: 0, channelId: '' };
  }
}

interface SupplementalChannelTemplate {
  id: string;
  displayName: string;
  icon?: string;
  contentCategory: Exclude<ContentCategoryFilter, 'Tous'>;
  group: Exclude<ChannelGroup, 'Tous'>;
  country: Exclude<CountryCode, 'Tous'>;
  satellite: Exclude<SatelliteFilter, 'Tous'>;
  orbitalPosition: string;
  bouquets: Exclude<BouquetFilter, 'Tous'>[];
  bouquetId: EpgBouquetId;
  audioTrackLabel: string;
  subtitleTrackLabel: string;
  scheduleTemplates: Array<{
    title: string;
    subTitle: string;
    description: string;
    category: string;
    durationMins: number;
  }>;
}

const SUPPLEMENTAL_SATELLITE_BOUQUET_CHANNELS: SupplementalChannelTemplate[] = [
  // =========================================================================
  // 1. EUTELSAT 16°E (16°E) — RÉFÉRENTIEL EXHAUSTIF OFFICIEL PAR BOUQUETS :
  //    DigitAlb (Albanie), Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie),
  //    MAXtv / A1 Croatia, New World TV (Afrique), Canal+ Réunion / Afrique,
  //    Autres chaînes africaines / francophones
  // =========================================================================
  ...buildEutelsat16eExhaustiveChannels(),

  // =========================================================================
  // 1B. BOUQUET TRT NETWORK COMPLET (TÜRKSAT 42°E / EUTELSAT 7°E) :
  //     TRT 1 HD, TRT Haber HD, TRT Spor HD, TRT Spor 2, TRT World,
  //     TRT Çocuk, TRT Belgesel, TRT Müzik, TRT Avaz, TRT Türk
  // =========================================================================
  {
    id: 'TRT.1.tr',
    displayName: 'TRT 1 HD',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/TRT_1_logo_%282021-%29.svg/512px-TRT_1_logo_%282021-%29.svg.png',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'EU',
    satellite: 'Türksat 42°E',
    orbitalPosition: 'Türksat 42°E / Eutelsat 7°E',
    bouquets: ['TRT Network'],
    bouquetId: 'trt_network',
    audioTrackLabel: 'Audio Original TR / VO HD',
    subtitleTrackLabel: 'TRT Network · Türksat 42°E / Eutelsat 7°E',
    scheduleTemplates: [
      {
        title: 'Teşkilat : Opération Spéciale (Prime Time)',
        subTitle: 'Série Événement TRT 1 HD',
        description: 'Grande série d’action et d’espionnage en haute définition sur TRT 1 HD (Türksat 42°E / Eutelsat 7°E).',
        category: 'Série TV',
        durationMins: 120,
      },
      {
        title: 'Gönül Dağı : Chroniques d’Anatolie',
        subTitle: 'Fiction Dramatique & Famille HD',
        description: 'Série phare de première partie de soirée diffusée en direct sur TRT 1 HD.',
        category: 'Série TV',
        durationMins: 120,
      },
      {
        title: 'UEFA Champions League / Football International Live',
        subTitle: 'Soirée Européenne sur TRT 1 HD',
        description: 'Retransmission officielle en clair des grandes affiches européennes sur TRT 1 HD.',
        category: 'Football',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'TRT.Haber.tr',
    displayName: 'TRT Haber HD',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/TRT_Haber_logo_%282020-%29.svg/512px-TRT_Haber_logo_%282020-%29.svg.png',
    contentCategory: 'Actualités / News',
    group: 'Actualités / News',
    country: 'EU',
    satellite: 'Türksat 42°E',
    orbitalPosition: 'Türksat 42°E / Eutelsat 7°E',
    bouquets: ['TRT Network'],
    bouquetId: 'trt_network',
    audioTrackLabel: 'Audio Direct TR HD',
    subtitleTrackLabel: 'TRT Network · Türksat 42°E / Eutelsat 7°E',
    scheduleTemplates: [
      {
        title: 'Ana Haber Bülteni & Direct International 24/7',
        subTitle: 'Information Continue TRT Haber HD',
        description: 'Journal télévisé, éditions spéciales et géopolitique en direct sur TRT Haber HD (Türksat 42°E / Eutelsat 7°E).',
        category: 'Actualités',
        durationMins: 90,
      },
      {
        title: 'Sıcak Nokta & Analyse Géopolitique',
        subTitle: 'Débats & Grands Reportages',
        description: 'Décryptage de l’actualité internationale en direct sur le bouquet TRT Network.',
        category: 'Actualités',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'TRT.Spor.tr',
    displayName: 'TRT Spor HD',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/TRT_Spor_logo_%282022%29.svg/512px-TRT_Spor_logo_%282022%29.svg.png',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'EU',
    satellite: 'Türksat 42°E',
    orbitalPosition: 'Türksat 42°E / Eutelsat 7°E',
    bouquets: ['TRT Network'],
    bouquetId: 'trt_network',
    audioTrackLabel: 'Audio Stadium / TR Live HD',
    subtitleTrackLabel: 'TRT Network · Türksat 42°E / Eutelsat 7°E',
    scheduleTemplates: [
      {
        title: 'Süper Lig & Coupe d’Europe : Match & Studio Live',
        subTitle: 'Football en Direct sur TRT Spor HD',
        description: 'Retransmission sportive en direct et analyses sur TRT Spor HD (Türksat 42°E / Eutelsat 7°E).',
        category: 'Football',
        durationMins: 120,
      },
      {
        title: 'Stadyum : Tous les Buts & Résumés',
        subTitle: 'Magazine Football Live HD',
        description: 'Le grand rendez-vous football du bouquet TRT Network en haute définition.',
        category: 'Football',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'TRT.Spor.2.tr',
    displayName: 'TRT Spor 2',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/TRT_Spor_Y%C4%B1ld%C4%B1z_logo.svg/512px-TRT_Spor_Y%C4%B1ld%C4%B1z_logo.svg.png',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'EU',
    satellite: 'Türksat 42°E',
    orbitalPosition: 'Türksat 42°E / Eutelsat 7°E',
    bouquets: ['TRT Network'],
    bouquetId: 'trt_network',
    audioTrackLabel: 'Audio Stadium / TR Live HD',
    subtitleTrackLabel: 'TRT Network · Türksat 42°E / Eutelsat 7°E',
    scheduleTemplates: [
      {
        title: 'Basketbol, Volleyball & Athlétisme : Direct Olympique',
        subTitle: 'Compétitions Internationales sur TRT Spor 2',
        description: 'Deuxième chaîne sportive officielle du réseau TRT (Türksat 42°E / Eutelsat 7°E).',
        category: 'Sport',
        durationMins: 120,
      },
      {
        title: 'Tournois ATP / WTA & Sports Mécaniques Live',
        subTitle: 'Direct Sportif HD',
        description: 'Diffusion en direct des compétitions internationales sur TRT Spor 2.',
        category: 'Sport',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'TRT.World.tr',
    displayName: 'TRT World',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/TRT_World_logo.svg/512px-TRT_World_logo.svg.png',
    contentCategory: 'Actualités / News',
    group: 'Actualités / News',
    country: 'EU',
    satellite: 'Türksat 42°E',
    orbitalPosition: 'Türksat 42°E / Eutelsat 7°E',
    bouquets: ['TRT Network'],
    bouquetId: 'trt_network',
    audioTrackLabel: 'Audio Original English HD',
    subtitleTrackLabel: 'TRT Network · Türksat 42°E / Eutelsat 7°E',
    scheduleTemplates: [
      {
        title: 'World Newsroom & Roundtable Live',
        subTitle: '24/7 International News in English',
        description: 'Chaîne d’information internationale anglophone du bouquet TRT Network (Türksat 42°E / Eutelsat 7°E).',
        category: 'Actualités',
        durationMins: 90,
      },
      {
        title: 'Across The Balkanz & Global Documentary',
        subTitle: 'Investigative Report HD',
        description: 'Grands reportages et analyses internationales en anglais sur TRT World.',
        category: 'Actualités',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'TRT.Cocuk.tr',
    displayName: 'TRT Çocuk',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/TRT_%C3%87ocuk_logo_%282021%29.svg/512px-TRT_%C3%87ocuk_logo_%282021%29.svg.png',
    contentCategory: 'Jeunesse / Enfants',
    group: 'Jeunesse / Enfants',
    country: 'EU',
    satellite: 'Türksat 42°E',
    orbitalPosition: 'Türksat 42°E / Eutelsat 7°E',
    bouquets: ['TRT Network'],
    bouquetId: 'trt_network',
    audioTrackLabel: 'Audio Original HD',
    subtitleTrackLabel: 'TRT Network · Türksat 42°E / Eutelsat 7°E',
    scheduleTemplates: [
      {
        title: 'Rafadan Tayfa & Dessins Animés d’Aventure',
        subTitle: 'Animation & Jeunesse HD',
        description: 'Chaîne jeunesse officielle du bouquet TRT Network (Türksat 42°E / Eutelsat 7°E).',
        category: 'Animation',
        durationMins: 90,
      },
      {
        title: 'Cinéma d’Animation Familial : Les Explorateurs',
        subTitle: 'Programme Enfants & Famille',
        description: 'Séries animées éducatives et films jeunesse en haute définition sur TRT Çocuk.',
        category: 'Animation',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'TRT.Belgesel.tr',
    displayName: 'TRT Belgesel',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/TRT_Belgesel_logo_%282019%29.svg/512px-TRT_Belgesel_logo_%282019%29.svg.png',
    contentCategory: 'Documentaires',
    group: 'Documentaires',
    country: 'EU',
    satellite: 'Türksat 42°E',
    orbitalPosition: 'Türksat 42°E / Eutelsat 7°E',
    bouquets: ['TRT Network'],
    bouquetId: 'trt_network',
    audioTrackLabel: 'Dual Audio TR / EN HD',
    subtitleTrackLabel: 'TRT Network · Türksat 42°E / Eutelsat 7°E',
    scheduleTemplates: [
      {
        title: 'Nature Sauvage & Expéditions Extrêmes',
        subTitle: 'Documentaire 4K/HD TRT Belgesel',
        description: 'Chaîne documentaire officielle du bouquet TRT Network (Türksat 42°E / Eutelsat 7°E).',
        category: 'Documentaire',
        durationMins: 90,
      },
      {
        title: 'Histoire des Civilisations & Archéologie',
        subTitle: 'Patrimoine Mondial & Découverte',
        description: 'Grands documentaires historiques et scientifiques en haute définition sur TRT Belgesel.',
        category: 'Documentaire',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'TRT.Muzik.tr',
    displayName: 'TRT Müzik',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/TRT_M%C3%BCzik_logo_%282021%29.svg/512px-TRT_M%C3%BCzik_logo_%282021%29.svg.png',
    contentCategory: 'Musique & Divertissement',
    group: 'Musique & Divertissement',
    country: 'EU',
    satellite: 'Türksat 42°E',
    orbitalPosition: 'Türksat 42°E / Eutelsat 7°E',
    bouquets: ['TRT Network'],
    bouquetId: 'trt_network',
    audioTrackLabel: 'Audio Stéréo Musical HD',
    subtitleTrackLabel: 'TRT Network · Türksat 42°E / Eutelsat 7°E',
    scheduleTemplates: [
      {
        title: 'Concerts Symphoniques & Sessions Acoustiques Live',
        subTitle: 'Musique & Spectacles en Direct HD',
        description: 'Chaîne musicale officielle du bouquet TRT Network (Türksat 42°E / Eutelsat 7°E).',
        category: 'Musique',
        durationMins: 120,
      },
      {
        title: 'Top Clips & Festival Musical International',
        subTitle: 'Divertissement Musical Non-Stop',
        description: 'Concerts exclusifs et variétés musicales en haute définition sur TRT Müzik.',
        category: 'Musique',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'TRT.Avaz.tr',
    displayName: 'TRT Avaz',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/TRT_Avaz_logo_%282019%29.svg/512px-TRT_Avaz_logo_%282019%29.svg.png',
    contentCategory: 'Films & Séries',
    group: 'Séries TV & US',
    country: 'EU',
    satellite: 'Türksat 42°E',
    orbitalPosition: 'Türksat 42°E / Eutelsat 7°E',
    bouquets: ['TRT Network'],
    bouquetId: 'trt_network',
    audioTrackLabel: 'Multi-Audio International HD',
    subtitleTrackLabel: 'TRT Network · Türksat 42°E / Eutelsat 7°E',
    scheduleTemplates: [
      {
        title: 'Cinéma & Grandes Fresques Historiques d’Eurasie',
        subTitle: 'Long-Métrage & Série Culturelle HD',
        description: 'Chaîne internationale culturelle et cinéma du bouquet TRT Network (Türksat 42°E / Eutelsat 7°E).',
        category: 'Cinéma',
        durationMins: 120,
      },
      {
        title: 'Documentaire : Des Balkans à l’Asie Centrale',
        subTitle: 'Découverte & Patrimoine',
        description: 'Voyage culturel et séries historiques sur TRT Avaz.',
        category: 'Documentaire',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'TRT.Turk.tr',
    displayName: 'TRT Türk',
    icon: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/TRT_T%C3%BCrk_logo_%282020%29.svg/512px-TRT_T%C3%BCrk_logo_%282020%29.svg.png',
    contentCategory: 'Films & Séries',
    group: 'Comédie & Famille',
    country: 'EU',
    satellite: 'Türksat 42°E',
    orbitalPosition: 'Türksat 42°E / Eutelsat 7°E',
    bouquets: ['TRT Network'],
    bouquetId: 'trt_network',
    audioTrackLabel: 'Audio Original HD',
    subtitleTrackLabel: 'TRT Network · Türksat 42°E / Eutelsat 7°E',
    scheduleTemplates: [
      {
        title: 'Soirée Cinéma & Séries Familiales',
        subTitle: 'Prime Time International TRT Türk',
        description: 'Chaîne internationale généraliste du bouquet TRT Network (Türksat 42°E / Eutelsat 7°E).',
        category: 'Cinéma',
        durationMins: 115,
      },
      {
        title: 'Magazine Européen & Divertissement Culturel',
        subTitle: 'Direct & Talk-Show',
        description: 'Émissions culturelles, séries et cinéma pour toute la famille sur TRT Türk.',
        category: 'Famille',
        durationMins: 95,
      },
    ],
  },

  // =========================================================================
  // 2. THOR 0.8°W / INTELSAT 10-02 — 3 BOUQUETS OFFICIELS
  // =========================================================================
  {
    id: 'Pro.TV.ro',
    displayName: 'Pro TV HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'EU',
    satellite: 'Thor 0.8°W / Intelsat 10-02',
    orbitalPosition: 'Thor 0.8°W',
    bouquets: ['Focus Sat (Roumanie)', 'Digi TV'],
    bouquetId: 'thor_08w_focussat',
    audioTrackLabel: 'VO Anglais + Audio RO',
    subtitleTrackLabel: 'DVB-Sub RO · Thor 0.8°W',
    scheduleTemplates: [
      {
        title: 'Film Pro TV : Mission Héroïque',
        subTitle: 'Blockbuster Hollywoodien VO',
        description: 'Grand film de soirée diffusé en version originale sous-titrée sur Thor 0.8°W.',
        category: 'Cinéma',
        durationMins: 120,
      },
      {
        title: 'Série Prime : Clanul',
        subTitle: 'Saison 3 · Épisode 9',
        description: 'Série policière à suspense en haute définition sur Focus Sat / Digi TV.',
        category: 'Série TV',
        durationMins: 90,
      },
      {
        title: 'UEFA Europa League : Soirée Européenne',
        subTitle: 'Football Direct HD',
        description: 'Affiche européenne diffusée en direct sur Pro TV HD (Thor 0.8°W).',
        category: 'Football',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'Digi.Sport.1.ro',
    displayName: 'Digi Sport 1 HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'EU',
    satellite: 'Thor 0.8°W / Intelsat 10-02',
    orbitalPosition: 'Thor 0.8°W',
    bouquets: ['Digi TV', 'Focus Sat (Roumanie)'],
    bouquetId: 'thor_08w_focussat',
    audioTrackLabel: 'Audio RO / Stadium HD',
    subtitleTrackLabel: 'Digi TV · Thor 0.8°W',
    scheduleTemplates: [
      {
        title: 'UEFA Champions League : Multiplex & Match Phare',
        subTitle: 'Direct sur Digi Sport 1 HD',
        description: 'Diffusion sur Thor 0.8°W / Intelsat 10-02 (Bouquets Digi TV & Focus Sat).',
        category: 'Football',
        durationMins: 120,
      },
      {
        title: 'LaLiga & Serie A : Le Grand Week-End',
        subTitle: 'Football Européen en Direct',
        description: 'Les plus belles affiches des championnats espagnol et italien.',
        category: 'Football',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'Spiler.1.hu',
    displayName: 'Spíler 1 TV HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'EU',
    satellite: 'Thor 0.8°W / Intelsat 10-02',
    orbitalPosition: 'Thor 0.8°W',
    bouquets: ['Direct One (Hongrie)', 'Digi TV'],
    bouquetId: 'thor_08w_focussat',
    audioTrackLabel: 'Audio HU / VO Anglais Stadium',
    subtitleTrackLabel: 'Direct One · Thor 0.8°W',
    scheduleTemplates: [
      {
        title: 'Premier League : Match au Sommet en Direct',
        subTitle: 'Championnat d’Angleterre sur Direct One',
        description: 'Retransmission HD sur Thor 0.8°W pour le bouquet Direct One (Hongrie).',
        category: 'Football',
        durationMins: 120,
      },
      {
        title: 'UEFA Nations League & Football International',
        subTitle: 'Studio & Résumés HD',
        description: 'Analyses et temps forts du football européen sur Spíler 1 HD.',
        category: 'Football',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'RTL.Klub.hu',
    displayName: 'RTL Magyarország HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'EU',
    satellite: 'Thor 0.8°W / Intelsat 10-02',
    orbitalPosition: 'Thor 0.8°W',
    bouquets: ['Direct One (Hongrie)'],
    bouquetId: 'thor_08w_focussat',
    audioTrackLabel: 'Dual Audio HU / VO EN',
    subtitleTrackLabel: 'DVB-Sub HU / EN',
    scheduleTemplates: [
      {
        title: 'Cinéma Grand Soir : L’Énigme de Budapest',
        subTitle: 'Thriller & Action en VO',
        description: 'Film international diffusé avec piste audio originale anglaise sur Direct One (0.8°W).',
        category: 'Cinéma',
        durationMins: 120,
      },
      {
        title: 'Série US : Enquêtes Spéciales',
        subTitle: 'Saison 4 · Épisode 10',
        description: 'Série policière américaine en haute définition.',
        category: 'Série TV',
        durationMins: 90,
      },
    ],
  },

  // =========================================================================
  // 3. TURKMENÄLEM 52°E / MONACOSAT 52°E — BOUQUETS FTA & PAYANTS COMPLETS :
  //    - Groupe Persiana : Persiana Sports 1 & 2, Persiana Cinema, Persiana Series,
  //      Persiana Family, Persiana Junior, Persiana Comedy, Persiana Docs, Persiana Music
  //    - Groupe WNS : AVA Family, AVA Series, FX 1, FX 2, Avang TV, 4U Family, PMC Royale
  //    - Information : Iran International, Afghanistan International
  //    - Bouquet National Turkmène : Altyn Asyr, Yaslyk, Miras, Turkmenistan Sport
  //    - Alem TV (Payant) : Alem Sport 1 & 2 HD, Alem Cinema Premiere HD, Alem Discovery
  // =========================================================================

  // --- GROUPE PERSIANA (FTA 52°E) ---
  {
    id: 'Persiana.Sports.1.mc',
    displayName: 'Persiana Sports 1 HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe Persiana'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'Dual Audio FA / VO Anglais Stadium',
    subtitleTrackLabel: 'Groupe Persiana · 52°E (10804 H)',
    scheduleTemplates: [
      {
        title: 'UEFA Champions League : Grand Match en Direct',
        subTitle: 'Football Européen sur Persiana Sports 1 HD',
        description: 'Diffusion FTA en haute définition sur TurkmenÄlem / MonacoSat 52°E (Groupe Persiana).',
        category: 'Football',
        durationMins: 120,
      },
      {
        title: 'Premier League & LaLiga : Choc du Championnat',
        subTitle: 'Direct Intégral HD',
        description: 'Les plus grandes affiches des championnats européens en direct sur 52°E.',
        category: 'Football',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'Persiana.Sports.2.mc',
    displayName: 'Persiana Sports 2 HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe Persiana'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'Dual Audio FA / VO Stadium',
    subtitleTrackLabel: 'Groupe Persiana · 52°E',
    scheduleTemplates: [
      {
        title: 'Serie A & Bundesliga : Multiplex Direct',
        subTitle: 'Football Européen Live HD',
        description: 'Deuxième canal sportif du Groupe Persiana sur TurkmenÄlem / MonacoSat 52°E.',
        category: 'Football',
        durationMins: 120,
      },
      {
        title: 'UFC, Boxe & Grands Tournois ATP',
        subTitle: 'Direct Sportif International',
        description: 'Retransmission en haute définition sur Persiana Sports 2 HD.',
        category: 'Sport',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'Persiana.Cinema.mc',
    displayName: 'Persiana Cinema HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe Persiana'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'VO Anglais + Audio FA',
    subtitleTrackLabel: 'DVB-Sub FA / EN · Groupe Persiana 52°E',
    scheduleTemplates: [
      {
        title: 'Box-Office Première : L’Empire des Ombres',
        subTitle: 'Blockbuster en Version Originale',
        description: 'Grand film de cinéma international diffusé en HD sur Persiana Cinema (52°E).',
        category: 'Cinéma',
        durationMins: 125,
      },
      {
        title: 'Soirée Thriller : Vengeance à Los Angeles',
        subTitle: 'Film Action & Suspense VO',
        description: 'Long-métrage américain en version originale sous-titrée.',
        category: 'Film Action',
        durationMins: 115,
      },
    ],
  },
  {
    id: 'Persiana.Series.mc',
    displayName: 'Persiana Series HD',
    contentCategory: 'Films & Séries',
    group: 'Séries TV & US',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe Persiana'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'VO Anglais / Multi-Audio',
    subtitleTrackLabel: 'DVB-Sub FA / EN · Groupe Persiana 52°E',
    scheduleTemplates: [
      {
        title: 'Série Événement : Les Chroniques du Futur',
        subTitle: 'Saison 3 · Épisode 4',
        description: 'Série américaine à grand spectacle sur Persiana Series HD (52°E).',
        category: 'Série TV',
        durationMins: 60,
      },
      {
        title: 'Marathon Séries US : Enquêtes Criminelles',
        subTitle: 'Saison 1 · Épisode 9',
        description: 'Double épisode en haute définition avec piste originale.',
        category: 'Série TV',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'Persiana.Family.mc',
    displayName: 'Persiana Family HD',
    contentCategory: 'Films & Séries',
    group: 'Comédie & Famille',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe Persiana'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'VO / Multi-Audio HD',
    subtitleTrackLabel: 'Groupe Persiana · 52°E',
    scheduleTemplates: [
      {
        title: 'Cinéma Famille : Aventure au Cœur du Monde',
        subTitle: 'Film Familial & Comédie HD',
        description: 'Divertissement et cinéma pour toute la famille sur Persiana Family HD (52°E).',
        category: 'Famille',
        durationMins: 110,
      },
      {
        title: 'Série Familiale : La Grande Maison',
        subTitle: 'Saison 2 · Épisode 5',
        description: 'Fiction familiale quotidienne en haute définition.',
        category: 'Série TV',
        durationMins: 70,
      },
    ],
  },
  {
    id: 'Persiana.Junior.mc',
    displayName: 'Persiana Junior HD',
    contentCategory: 'Jeunesse / Enfants',
    group: 'Jeunesse / Enfants',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe Persiana'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'Dual Audio EN / FA',
    subtitleTrackLabel: 'Groupe Persiana · 52°E',
    scheduleTemplates: [
      {
        title: 'Grands Classiques d’Animation : Le Royaume Magique',
        subTitle: 'Film d’Animation HD',
        description: 'Dessins animés et longs-métrages d’animation sur Persiana Junior HD (52°E).',
        category: 'Animation',
        durationMins: 90,
      },
      {
        title: 'Les Aventuriers de l’Espace',
        subTitle: 'Série Animée Jeunesse',
        description: 'Programme jeunesse quotidien en haute définition.',
        category: 'Animation',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'Persiana.Comedy.mc',
    displayName: 'Persiana Comedy HD',
    contentCategory: 'Films & Séries',
    group: 'Comédie & Famille',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe Persiana'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'VO / Multi-Audio HD',
    subtitleTrackLabel: 'Groupe Persiana · 52°E',
    scheduleTemplates: [
      {
        title: 'Soirée Comédie : Vacances Explosives',
        subTitle: 'Comédie Internationale HD',
        description: 'Les meilleures comédies et sitcoms sur Persiana Comedy HD (52°E).',
        category: 'Comédie',
        durationMins: 105,
      },
      {
        title: 'Sitcom Prestige : Amis & Voisins',
        subTitle: 'Saison 4 · Épisode 12',
        description: 'Humour et séries comiques en haute définition.',
        category: 'Comédie',
        durationMins: 75,
      },
    ],
  },
  {
    id: 'Persiana.Docs.mc',
    displayName: 'Persiana Docs HD',
    contentCategory: 'Documentaires',
    group: 'Documentaires',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe Persiana'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'VO Anglais + Audio FA',
    subtitleTrackLabel: 'Groupe Persiana · 52°E',
    scheduleTemplates: [
      {
        title: 'Planète Sauvage : Les Secrets des Océans',
        subTitle: 'Documentaire Nature & Science 4K/HD',
        description: 'Grands documentaires nature, histoire et sciences sur Persiana Docs HD (52°E).',
        category: 'Documentaire',
        durationMins: 90,
      },
      {
        title: 'Civilisations Anciennes : De Persépolis à Rome',
        subTitle: 'Histoire & Archéologie',
        description: 'Enquête historique en haute définition avec piste originale.',
        category: 'Documentaire',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'Persiana.Music.mc',
    displayName: 'Persiana Music HD',
    contentCategory: 'Musique & Divertissement',
    group: 'Musique & Divertissement',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe Persiana'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'Audio Stéréo AAC HD',
    subtitleTrackLabel: 'Groupe Persiana · 52°E',
    scheduleTemplates: [
      {
        title: 'Top Hits & Concerts Internationaux',
        subTitle: 'Clips & Live Sessions HD',
        description: 'Les meilleurs clips internationaux et concerts en haute définition sur Persiana Music HD.',
        category: 'Musique',
        durationMins: 120,
      },
      {
        title: 'Club Night & Pop Hits',
        subTitle: 'Sélection Musicale Non-Stop',
        description: 'Diffusion musicale en clair sur TurkmenÄlem / MonacoSat 52°E.',
        category: 'Musique',
        durationMins: 120,
      },
    ],
  },

  // --- GROUPE WNS (FTA 52°E) ---
  {
    id: 'AVA.Family.mc',
    displayName: 'AVA Family HD',
    contentCategory: 'Films & Séries',
    group: 'Comédie & Famille',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe WNS'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'VO / Multi-Audio HD',
    subtitleTrackLabel: 'Groupe WNS · 52°E (10762 V)',
    scheduleTemplates: [
      {
        title: 'Cinéma Grand Public : Le Trésor Perdu',
        subTitle: 'Film Aventure & Famille VO',
        description: 'Diffusion FTA sur le transpondeur WNS (TurkmenÄlem / MonacoSat 52°E).',
        category: 'Cinéma',
        durationMins: 115,
      },
      {
        title: 'Série Dramatique : Secrets de Famille',
        subTitle: 'Saison 2 · Épisode 10',
        description: 'Rendez-vous quotidien des séries et films sur AVA Family HD.',
        category: 'Série TV',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'AVA.Series.mc',
    displayName: 'AVA Series HD',
    contentCategory: 'Films & Séries',
    group: 'Séries TV & US',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe WNS'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'VO Anglais + Sous-titres',
    subtitleTrackLabel: 'Groupe WNS · 52°E',
    scheduleTemplates: [
      {
        title: 'Série US : Unité Spéciale Nocturne',
        subTitle: 'Saison 1 · Épisode 7',
        description: 'Chaîne 100% séries internationales du Groupe WNS sur 52°E.',
        category: 'Série TV',
        durationMins: 90,
      },
      {
        title: 'Thriller Série : Le Cartel du Nord',
        subTitle: 'Saison 3 · Épisode 2',
        description: 'Diffusion en haute définition sur AVA Series HD.',
        category: 'Série TV',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'FX.1.mc',
    displayName: 'FX 1 HD',
    contentCategory: 'Films & Séries',
    group: 'Action & Thriller',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe WNS'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'VO Anglais + Sous-titres DVB',
    subtitleTrackLabel: 'Groupe WNS · 52°E',
    scheduleTemplates: [
      {
        title: 'Hollywood Action : Impact Imminent',
        subTitle: 'Blockbuster Américain en VO',
        description: 'Films d’action et blockbusters américains en version originale sous-titrée sur FX 1 HD (52°E).',
        category: 'Film Action',
        durationMins: 120,
      },
      {
        title: 'Sci-Fi Première : Nébuleuse Alpha',
        subTitle: 'Science-Fiction & Suspense HD',
        description: 'Long-métrage grand spectacle sur le bouquet WNS 52°E.',
        category: 'Science-Fiction',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'FX.2.mc',
    displayName: 'FX 2 HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe WNS'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'VO Anglais + Sous-titres DVB',
    subtitleTrackLabel: 'Groupe WNS · 52°E',
    scheduleTemplates: [
      {
        title: 'Thriller Nocturne : La Traque Finale',
        subTitle: 'Suspense & Policier VO',
        description: 'Deuxième canal cinéma hollywoodien FX 2 HD sur TurkmenÄlem / MonacoSat 52°E.',
        category: 'Thriller',
        durationMins: 115,
      },
      {
        title: 'Série Action : Opération Cobra',
        subTitle: 'Saison 2 · Épisode 8',
        description: 'Série d’action internationale en haute définition.',
        category: 'Série TV',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'Avang.TV.mc',
    displayName: 'Avang TV HD',
    contentCategory: 'Musique & Divertissement',
    group: 'Musique & Divertissement',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe WNS'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'Audio Stéréo HD',
    subtitleTrackLabel: 'Groupe WNS · 52°E',
    scheduleTemplates: [
      {
        title: 'Avang Music Prestige & Concerts Live',
        subTitle: 'Clips, Concerts & Divertissement HD',
        description: 'Les plus grands artistes et concerts exclusifs sur Avang TV HD (Groupe WNS 52°E).',
        category: 'Musique',
        durationMins: 120,
      },
      {
        title: 'Show Musical & Variétés Internationales',
        subTitle: 'Prime Time Divertissement',
        description: 'Programmation musicale et culturelle en haute définition.',
        category: 'Divertissement',
        durationMins: 120,
      },
    ],
  },
  {
    id: '4U.Family.mc',
    displayName: '4U Family HD',
    contentCategory: 'Films & Séries',
    group: 'Comédie & Famille',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe WNS'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'Audio Original HD',
    subtitleTrackLabel: 'Groupe WNS · 52°E',
    scheduleTemplates: [
      {
        title: 'Cinéma & Séries pour la Famille',
        subTitle: 'Sélection 4U Family HD',
        description: 'Films, séries et émissions familiales diffusés en clair sur le bouquet WNS 52°E.',
        category: 'Famille',
        durationMins: 110,
      },
      {
        title: 'Comédie du Soir : Un Week-End Inoubliable',
        subTitle: 'Film Comédie HD',
        description: 'Détente et cinéma familial sur 4U Family HD.',
        category: 'Comédie',
        durationMins: 100,
      },
    ],
  },
  {
    id: 'PMC.Royale.mc',
    displayName: 'PMC Royale HD',
    contentCategory: 'Musique & Divertissement',
    group: 'Musique & Divertissement',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Groupe WNS'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'Audio Stéréo PCM HD',
    subtitleTrackLabel: 'Groupe WNS · 52°E',
    scheduleTemplates: [
      {
        title: 'PMC Top 20 & Hits Internationaux',
        subTitle: 'Musique & Clips Non-Stop HD',
        description: 'La chaîne musicale emblématique PMC Royale en haute définition sur 52°E.',
        category: 'Musique',
        durationMins: 120,
      },
      {
        title: 'Soirée Concerts & Dancefloor',
        subTitle: 'Sélection Prestige PMC Royale',
        description: 'Diffusion musicale haute fidélité sur le bouquet WNS.',
        category: 'Musique',
        durationMins: 120,
      },
    ],
  },

  // --- INFORMATION (FTA 52°E) ---
  {
    id: 'Iran.International.mc',
    displayName: 'Iran International HD',
    contentCategory: 'Actualités / News',
    group: 'Actualités / News',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Information (Iran Intl / Afghanistan Intl)'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'Audio Direct HD',
    subtitleTrackLabel: 'Information · 52°E',
    scheduleTemplates: [
      {
        title: 'Édition Spéciale & Journal International 24/7',
        subTitle: 'Actualités, Débats & Directs',
        description: 'Chaîne d’information internationale en continu diffusée en haute définition sur 52°E.',
        category: 'Actualités',
        durationMins: 90,
      },
      {
        title: 'Grand Dossier Géopolitique & Documentaire',
        subTitle: 'Analyse & Reportages Internationaux',
        description: 'Décryptage de l’actualité mondiale depuis Londres sur Iran International HD.',
        category: 'Actualités',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'Afghanistan.International.mc',
    displayName: 'Afghanistan International HD',
    contentCategory: 'Actualités / News',
    group: 'Actualités / News',
    country: 'EU',
    satellite: 'MonacoSat 52°E',
    orbitalPosition: 'MonacoSat 52°E',
    bouquets: ['Information (Iran Intl / Afghanistan Intl)'],
    bouquetId: 'monacosat_52e_persiana',
    audioTrackLabel: 'Audio Direct HD',
    subtitleTrackLabel: 'Information · 52°E',
    scheduleTemplates: [
      {
        title: 'Le Grand Journal d’Information & Analyses',
        subTitle: 'Direct 24/7 sur 52°E',
        description: 'Information continue, tables rondes et reportages internationaux sur Afghanistan International HD.',
        category: 'Actualités',
        durationMins: 90,
      },
      {
        title: 'Magazine International & Société',
        subTitle: 'Enquêtes & Correspondants',
        description: 'Couverture complète de l’actualité régionale et mondiale.',
        category: 'Actualités',
        durationMins: 90,
      },
    ],
  },

  // --- BOUQUET NATIONAL TURKMÈNE (FTA 52°E) ---
  {
    id: 'Altyn.Asyr.tm',
    displayName: 'Altyn Asyr HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'EU',
    satellite: 'TurkmenÄlem 52°E',
    orbitalPosition: 'TurkmenÄlem 52°E',
    bouquets: ['Bouquet National Turkmène'],
    bouquetId: 'turkmenalem_52e_alem',
    audioTrackLabel: 'Audio Original HD',
    subtitleTrackLabel: 'Bouquet National Turkmène · 52°E',
    scheduleTemplates: [
      {
        title: 'Cinéma & Patrimoine : Légendes du Karakoum',
        subTitle: 'Long-Métrage Historique HD',
        description: 'Diffusion sur la chaîne nationale Altyn Asyr HD via TurkmenÄlem 52°E (12265 V).',
        category: 'Cinéma',
        durationMins: 110,
      },
      {
        title: 'Documentaire : Chevaux Akhal-Teké, Trésor Vivant',
        subTitle: 'Culture & Nature HD',
        description: 'Reportage exceptionnel en haute définition sur TurkmenÄlem 52°E.',
        category: 'Documentaire',
        durationMins: 80,
      },
    ],
  },
  {
    id: 'Yaslyk.tm',
    displayName: 'Yaslyk HD',
    contentCategory: 'Jeunesse / Enfants',
    group: 'Jeunesse / Enfants',
    country: 'EU',
    satellite: 'TurkmenÄlem 52°E',
    orbitalPosition: 'TurkmenÄlem 52°E',
    bouquets: ['Bouquet National Turkmène'],
    bouquetId: 'turkmenalem_52e_alem',
    audioTrackLabel: 'Audio Original HD',
    subtitleTrackLabel: 'Bouquet National Turkmène · 52°E',
    scheduleTemplates: [
      {
        title: 'Jeunesse & Découverte : L’Univers des Enfants',
        subTitle: 'Animation & Programmes Éducatifs HD',
        description: 'Chaîne nationale jeunesse et familiale Yaslyk (Ýaşlyk) diffusée en clair sur TurkmenÄlem 52°E.',
        category: 'Jeunesse',
        durationMins: 90,
      },
      {
        title: 'Cinéma Famille & Contes Orientaux',
        subTitle: 'Long-Métrage Jeunesse HD',
        description: 'Programme familial en haute définition sur le bouquet national turkmène.',
        category: 'Famille',
        durationMins: 100,
      },
    ],
  },
  {
    id: 'Miras.tm',
    displayName: 'Miras HD',
    contentCategory: 'Documentaires',
    group: 'Documentaires',
    country: 'EU',
    satellite: 'TurkmenÄlem 52°E',
    orbitalPosition: 'TurkmenÄlem 52°E',
    bouquets: ['Bouquet National Turkmène'],
    bouquetId: 'turkmenalem_52e_alem',
    audioTrackLabel: 'Audio Original HD',
    subtitleTrackLabel: 'Bouquet National Turkmène · 52°E',
    scheduleTemplates: [
      {
        title: 'Patrimoine & Histoire de la Route de la Soie',
        subTitle: 'Documentaire Culturel HD',
        description: 'Chaîne culturelle et historique Miras HD diffusée en clair sur TurkmenÄlem 52°E.',
        category: 'Documentaire',
        durationMins: 90,
      },
      {
        title: 'Cinéma Classique & Archives du Monde',
        subTitle: 'Sélection Patrimoine Miras',
        description: 'Découverte des traditions, de l’archéologie et des arts classiques.',
        category: 'Documentaire',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'Turkmenistan.Sport.tm',
    displayName: 'Turkmenistan Sport HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'EU',
    satellite: 'TurkmenÄlem 52°E',
    orbitalPosition: 'TurkmenÄlem 52°E',
    bouquets: ['Bouquet National Turkmène'],
    bouquetId: 'turkmenalem_52e_alem',
    audioTrackLabel: 'Audio TM / International Stadium',
    subtitleTrackLabel: 'Bouquet National Turkmène · 52°E',
    scheduleTemplates: [
      {
        title: 'Football International & AFC Champions League',
        subTitle: 'Direct sur Turkmenistan Sport HD',
        description: 'Diffusion officielle FTA sur le transpondeur national de TurkmenÄlem 52°E (12265 V).',
        category: 'Football',
        durationMins: 120,
      },
      {
        title: 'Tournoi International de Tennis & Arts Martiaux',
        subTitle: 'Compétition Officielle HD',
        description: 'Retransmission en haute définition sur le bouquet national turkmène.',
        category: 'Sport',
        durationMins: 120,
      },
    ],
  },

  // --- BOUQUET PAYANT ALEM TV (52°E) ---
  {
    id: 'Alem.Sport.1.tm',
    displayName: 'Alem Sport 1 HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'EU',
    satellite: 'TurkmenÄlem 52°E',
    orbitalPosition: 'TurkmenÄlem 52°E',
    bouquets: ['Alem TV'],
    bouquetId: 'turkmenalem_52e_alem',
    audioTrackLabel: 'Multi-Audio RU / EN / Stadium',
    subtitleTrackLabel: 'Alem TV · TurkmenÄlem 52°E',
    scheduleTemplates: [
      {
        title: 'UEFA Champions League : Match en Direct',
        subTitle: 'Diffusion HD sur Alem Sport 1 HD (52°E)',
        description: 'Retransmission sportive en haute définition sur le bouquet Alem TV (TurkmenÄlem 52°E).',
        category: 'Football',
        durationMins: 120,
      },
      {
        title: 'Premier League : Affiche du Week-End',
        subTitle: 'Football Anglais Live HD',
        description: 'Rencontre au sommet du championnat d’Angleterre sur Alem Sport 1 HD.',
        category: 'Football',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'Alem.Sport.2.tm',
    displayName: 'Alem Sport 2 HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'EU',
    satellite: 'TurkmenÄlem 52°E',
    orbitalPosition: 'TurkmenÄlem 52°E',
    bouquets: ['Alem TV'],
    bouquetId: 'turkmenalem_52e_alem',
    audioTrackLabel: 'Multi-Audio RU / EN / Stadium',
    subtitleTrackLabel: 'Alem TV · TurkmenÄlem 52°E',
    scheduleTemplates: [
      {
        title: 'LaLiga & Serie A : Soirée Football Européen',
        subTitle: 'Direct sur Alem Sport 2 HD',
        description: 'Deuxième canal sportif premium du bouquet Alem TV sur TurkmenÄlem 52°E.',
        category: 'Football',
        durationMins: 120,
      },
      {
        title: ' Ligue Europa & Grands Tournois Internationaux',
        subTitle: 'Football & Sports Mécaniques HD',
        description: 'Diffusion intégrale haute définition sur Alem Sport 2 HD.',
        category: 'Football',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'Alem.Cinema.Premiere.tm',
    displayName: 'Alem Cinema Premiere HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'EU',
    satellite: 'TurkmenÄlem 52°E',
    orbitalPosition: 'TurkmenÄlem 52°E',
    bouquets: ['Alem TV'],
    bouquetId: 'turkmenalem_52e_alem',
    audioTrackLabel: 'Dual Audio VO EN / RU',
    subtitleTrackLabel: 'DVB-Sub Multi · Alem TV',
    scheduleTemplates: [
      {
        title: 'Hollywood Premiere : Horizon Infini',
        subTitle: 'Science-Fiction & Action en VO',
        description: 'Long-métrage grand spectacle diffusé sur le bouquet Alem TV (TurkmenÄlem 52°E).',
        category: 'Cinéma',
        durationMins: 125,
      },
      {
        title: 'Thriller du Soir : Code Silencieux',
        subTitle: 'Suspense & Espionnage HD',
        description: 'Film d’espionnage international en haute définition avec audio original.',
        category: 'Thriller',
        durationMins: 115,
      },
    ],
  },
  {
    id: 'Alem.Docu.Discovery.tm',
    displayName: 'Alem Discovery',
    contentCategory: 'Documentaires',
    group: 'Documentaires',
    country: 'EU',
    satellite: 'TurkmenÄlem 52°E',
    orbitalPosition: 'TurkmenÄlem 52°E',
    bouquets: ['Alem TV'],
    bouquetId: 'turkmenalem_52e_alem',
    audioTrackLabel: 'Dual Audio EN / RU',
    subtitleTrackLabel: 'DVB-Sub · Alem TV 52°E',
    scheduleTemplates: [
      {
        title: 'Planète Extrême : Les Montagnes Célestes',
        subTitle: 'Nature & Exploration 4K/HD',
        description: 'Expédition scientifique au cœur des chaînes montagneuses d’Asie Centrale sur Alem Discovery.',
        category: 'Documentaire',
        durationMins: 90,
      },
      {
        title: 'Ingénierie Moderne : Mégastructures',
        subTitle: 'Science & Technologie',
        description: 'Découverte des plus grands défis architecturaux contemporains sur Alem TV.',
        category: 'Documentaire',
        durationMins: 90,
      },
    ],
  },

  // =========================================================================
  // 5. ASTRA 19.2°E — CANAL+ FRANCE, TNT FRANCE, MOVISTAR+ ESPAÑA, SKY DE
  // =========================================================================
  {
    id: 'CanalPlus.fr',
    displayName: 'Canal+ HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'FR',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Canal+ France'],
    bouquetId: 'astra_canal_fr',
    audioTrackLabel: 'VM (VO Anglais / VF Dolby Atmos)',
    subtitleTrackLabel: 'DVB-Sub FR / Malentendants',
    scheduleTemplates: [
      {
        title: 'Dune : Deuxième Partie',
        subTitle: 'Cinéma Grand Spectacle UHD/HD · VO+SUB',
        description: 'Paul Atréides s’unit à Chani et aux Fremen pour mener la révolte sur Arrakis.',
        category: 'Cinéma / Science-Fiction',
        durationMins: 120,
      },
      {
        title: 'Canal Champions Club & Grande Soirée Européenne',
        subTitle: 'Direct Exclusif sur Canal+ HD',
        description: 'La grande soirée UEFA Champions League avec plateau, analyses et grand match en direct.',
        category: 'Sport / Football',
        durationMins: 120,
      },
      {
        title: 'Le Bureau des Légendes : Création Originale',
        subTitle: 'Série Création Originale Canal+ · S05E04',
        description: 'Plongée au cœur de la DGSE avec les agents clandestins en mission internationale.',
        category: 'Série TV / Espionnage',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'CanalPlus.BoxOffice.fr',
    displayName: 'Canal+ Box Office HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'FR',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Canal+ France'],
    bouquetId: 'astra_canal_fr',
    audioTrackLabel: 'VM (VO Anglais / VF Dolby Digital+)',
    subtitleTrackLabel: 'DVB-Sub FR / VOSTFR',
    scheduleTemplates: [
      {
        title: 'Oppenheimer',
        subTitle: 'Box-Office US & Mondial en VM (VO+SUB)',
        description: 'Le physicien J. Robert Oppenheimer dirige le projet Manhattan qui aboutira à la première bombe atomique.',
        category: 'Cinéma / Biopic',
        durationMins: 135,
      },
      {
        title: 'Gladiator II',
        subTitle: 'Première Exclusivité Box-Office HD',
        description: 'Des années après la mort de Maximus, Lucius est forcé d’entrer dans le Colisée.',
        category: 'Cinéma / Péplum Action',
        durationMins: 125,
      },
    ],
  },
  {
    id: 'CanalPlus.Foot.fr',
    displayName: 'Canal+ Foot HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'FR',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Canal+ France'],
    bouquetId: 'astra_canal_fr',
    audioTrackLabel: 'Audio Direct FR / Ambiance Stade',
    subtitleTrackLabel: 'DVB-Sub FR · Astra 19.2°E',
    scheduleTemplates: [
      {
        title: 'Premier League : Big Match Live',
        subTitle: 'Championnat d’Angleterre en Direct HD',
        description: 'Suivez les plus belles affiches de Premier League anglaise en exclusivité sur Canal+ Foot HD.',
        category: 'Football / Premier League',
        durationMins: 120,
      },
      {
        title: 'UEFA Champions League : Multiplex Intégral',
        subTitle: 'Soirée Ligue des Champions HD',
        description: 'Tous les buts et les temps forts de l’UEFA Champions League en direct.',
        category: 'Football / Champions League',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'TF1.fr',
    displayName: 'TF1 HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'FR',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra TNT France'],
    bouquetId: 'astra_tnt_fr',
    audioTrackLabel: 'VM (VO / VF Dolby Digital+)',
    subtitleTrackLabel: 'DVB-Sub FR · TNT Sat 19.2°E',
    scheduleTemplates: [
      {
        title: 'Ciné Dimanche : Top Gun Maverick',
        subTitle: 'Grand Film Prime Time en VM (VO+SUB)',
        description: 'Pete "Maverick" Mitchell reprend les commandes pour former une nouvelle génération de pilotes d’élite.',
        category: 'Cinéma / Action',
        durationMins: 125,
      },
      {
        title: 'Journal de 20H & Grands Reportages',
        subTitle: 'Information & Magazine TF1 HD',
        description: 'Toute l’actualité nationale et internationale suivie des grands reportages de la rédaction.',
        category: 'Actualités / Magazine',
        durationMins: 95,
      },
    ],
  },
  {
    id: 'France2.fr',
    displayName: 'France 2 HD',
    contentCategory: 'Films & Séries',
    group: 'Séries TV & US',
    country: 'FR',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra TNT France'],
    bouquetId: 'astra_tnt_fr',
    audioTrackLabel: 'VM (VO / VF Stéréo HD)',
    subtitleTrackLabel: 'DVB-Sub FR · TNT Sat 19.2°E',
    scheduleTemplates: [
      {
        title: 'Les Petits Meurtres & Grande Fiction Française',
        subTitle: 'Série Inédite en Haute Définition',
        description: 'Soirée polar et fiction événement sur France 2 HD.',
        category: 'Série TV / Polar',
        durationMins: 110,
      },
      {
        title: 'Envoyé Spécial & Complément d’Enquête',
        subTitle: 'Grand Magazine d’Investigation',
        description: 'Enquêtes et reportages exclusifs au cœur de l’actualité française et internationale.',
        category: 'Documentaire / Investigation',
        durationMins: 100,
      },
    ],
  },
  {
    id: 'M6.fr',
    displayName: 'M6 HD',
    contentCategory: 'Films & Séries',
    group: 'Action & Thriller',
    country: 'FR',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra TNT France'],
    bouquetId: 'astra_tnt_fr',
    audioTrackLabel: 'VM (VO Anglais / VF Dolby)',
    subtitleTrackLabel: 'DVB-Sub FR · TNT Sat 19.2°E',
    scheduleTemplates: [
      {
        title: 'Mission : Impossible – Dead Reckoning',
        subTitle: 'Soirée Action & Blockbuster en VM',
        description: 'Ethan Hunt et son équipe de l’IMF traquent une arme redoutable à travers le globe.',
        category: 'Cinéma / Action',
        durationMins: 130,
      },
      {
        title: 'Zone Interdite & Capital',
        subTitle: 'Grand Magazine Économie & Société',
        description: 'Décryptage des grands enjeux économiques et sociétaux sur M6 HD.',
        category: 'Documentaire',
        durationMins: 110,
      },
    ],
  },
  {
    id: 'Arte.fr',
    displayName: 'Arte HD',
    contentCategory: 'Documentaires',
    group: 'Documentaires',
    country: 'FR',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra TNT France'],
    bouquetId: 'astra_tnt_fr',
    audioTrackLabel: 'Multi-Audio VO / FR / DE',
    subtitleTrackLabel: 'DVB-Sub FR / DE / EN',
    scheduleTemplates: [
      {
        title: 'Les Grands Mystères de l’Histoire & Civilisations',
        subTitle: 'Documentaire Culture & Découverte HD',
        description: 'Exploration scientifique et historique des grandes civilisations mondiales sur Arte HD.',
        category: 'Documentaire',
        durationMins: 95,
      },
      {
        title: 'Cinéma d’Auteur & Patrimoine Mondial en VOST',
        subTitle: 'Sélection Festival de Cannes & Berlin',
        description: 'Chef-d’œuvre du cinéma international diffusé en version originale sous-titrée.',
        category: 'Cinéma / Classique',
        durationMins: 115,
      },
    ],
  },
  {
    id: 'Movistar.Plus.es',
    displayName: 'Movistar Plus+ HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'ES',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Movistar+ España'],
    bouquetId: 'movistar_es',
    audioTrackLabel: 'Dual Audio VO Anglais / ES Dolby',
    subtitleTrackLabel: 'DVB-Sub ES / EN · Movistar+ 19.2°E',
    scheduleTemplates: [
      {
        title: 'Cine Estreno : The Batman (VOSE)',
        subTitle: 'Première Movistar Plus+ HD · Dual VO+SUB',
        description: 'Dans sa deuxième année de lutte contre le crime à Gotham, Batman traque le mystérieux Riddler.',
        category: 'Cinéma / Thriller',
        durationMins: 135,
      },
      {
        title: 'El Día Después & Soirée LaLiga EA Sports',
        subTitle: 'Direct & Magazine Movistar Plus+ HD',
        description: 'Toute l’émotion du football espagnol et des grandes compétitions européennes.',
        category: 'Sport / Football',
        durationMins: 105,
      },
    ],
  },
  {
    id: 'Movistar.LaLiga.es',
    displayName: 'M+ LaLiga TV HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'ES',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Movistar+ España'],
    bouquetId: 'movistar_es',
    audioTrackLabel: 'Multi-Audio ES / EN / Stadium',
    subtitleTrackLabel: 'DVB-Sub ES · Astra 19.2°E',
    scheduleTemplates: [
      {
        title: 'LaLiga EA Sports : Real Madrid vs FC Barcelona',
        subTitle: 'El Clásico & Jornada en Direct HD',
        description: 'Retransmission officielle de LaLiga EA Sports en haute définition sur Movistar+.',
        category: 'Football / LaLiga',
        durationMins: 120,
      },
      {
        title: 'LaLiga Highlights & Studio Tactique',
        subTitle: 'Magazine Officiel LaLiga HD',
        description: 'Tous les résumés, buts et analyses de la journée du championnat espagnol.',
        category: 'Football / LaLiga',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'Movistar.Estrenos.es',
    displayName: 'M+ Estrenos HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'ES',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Movistar+ España'],
    bouquetId: 'movistar_es',
    audioTrackLabel: 'Dual Audio VO Anglais / ES Dolby',
    subtitleTrackLabel: 'DVB-Sub ES / EN · Movistar+ 19.2°E',
    scheduleTemplates: [
      {
        title: 'Estreno Exclusivo : Oppenheimer (VOSE)',
        subTitle: 'Cinéma Première Movistar+ Estrenos HD',
        description: 'Les plus grands films du box-office international diffusés en version originale sous-titrée.',
        category: 'Cinéma / Biopic',
        durationMins: 135,
      },
      {
        title: 'Noche de Acción : Top Gun Maverick',
        subTitle: 'Blockbuster US en Dual Audio VO+SUB',
        description: 'Soirée grand spectacle sur M+ Estrenos HD (Astra 19.2°E).',
        category: 'Cinéma / Action',
        durationMins: 125,
      },
    ],
  },
  {
    id: 'Movistar.LigaCampeones.es',
    displayName: 'M+ Liga de Campeones HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'ES',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Movistar+ España'],
    bouquetId: 'movistar_es',
    audioTrackLabel: 'Multi-Audio ES / Stadium Live',
    subtitleTrackLabel: 'Movistar+ · Astra 19.2°E',
    scheduleTemplates: [
      {
        title: 'UEFA Champions League : Noche de Champions Live',
        subTitle: 'Direct & Multiplex sur M+ Liga de Campeones HD',
        description: 'Retransmission intégrale de l’UEFA Champions League, Europa League et Conference League.',
        category: 'Football / UEFA Champions League',
        durationMins: 120,
      },
      {
        title: 'Champions Total : Résumés & Analyses',
        subTitle: 'Plateau Spécial Coupes d’Europe HD',
        description: 'Tous les buts et analyses des rencontres européennes.',
        category: 'Football',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'DAZN.1.es',
    displayName: 'DAZN 1 España HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'ES',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Astra Movistar+ España'],
    bouquetId: 'movistar_es',
    audioTrackLabel: 'Audio ES / Stadium Feed HD',
    subtitleTrackLabel: 'Movistar+ / DAZN · Astra 19.2°E',
    scheduleTemplates: [
      {
        title: 'LaLiga EA Sports & Premier League Live',
        subTitle: 'Direct sur DAZN 1 España HD (Astra 19.2°E)',
        description: 'Les grandes affiches de LaLiga EA Sports, Premier League, F1 et MotoGP en direct.',
        category: 'Football / LaLiga & Premier League',
        durationMins: 120,
      },
      {
        title: 'DAZN Super8 & Premier League Highlights',
        subTitle: 'Magazine Sport & Football HD',
        description: 'Décryptage, coulisses et résumés exclusifs sur DAZN España.',
        category: 'Sport / Football',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'La1.TVE.es',
    displayName: 'La 1 HD (TVE · TNT Abertis)',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'ES',
    satellite: 'Hispasat 30°W',
    orbitalPosition: 'Hispasat 30°W',
    bouquets: ['Hispasat Meo/NOS/Movistar', 'Astra Movistar+ España'],
    bouquetId: 'hispasat_meo_nos',
    audioTrackLabel: 'Dual Audio ES / VO Original',
    subtitleTrackLabel: 'DVB-Sub ES · TNT Abertis 30°W',
    scheduleTemplates: [
      {
        title: 'La Película de la Semana : El Reino (VOSE)',
        subTitle: 'Grand Cinéma Prime Time sur La 1 HD (TNT Abertis)',
        description: 'Le grand rendez-vous cinéma et fiction de RTVE diffusé sur TNT Abertis (Hispasat 30°W).',
        category: 'Cinéma / Thriller',
        durationMins: 125,
      },
      {
        title: 'Telediario & Informe Semanal',
        subTitle: 'Information & Grands Reportages RTVE HD',
        description: 'Actualité nationale et internationale en haute définition sur La 1 HD.',
        category: 'Actualités / Magazine',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'Antena3.es',
    displayName: 'Antena 3 HD (TNT Abertis)',
    contentCategory: 'Films & Séries',
    group: 'Séries TV & US',
    country: 'ES',
    satellite: 'Hispasat 30°W',
    orbitalPosition: 'Hispasat 30°W',
    bouquets: ['Hispasat Meo/NOS/Movistar', 'Astra Movistar+ España'],
    bouquetId: 'hispasat_meo_nos',
    audioTrackLabel: 'Dual Audio ES / VO Dolby',
    subtitleTrackLabel: 'DVB-Sub ES · TNT Abertis 30°W',
    scheduleTemplates: [
      {
        title: 'El Peliculón : Sin Tiempo para Morir (007)',
        subTitle: 'Cinéma Blockbuster sur Antena 3 HD (TNT Abertis)',
        description: 'Les plus grands succès du box-office en haute définition sur le réseau TNT Abertis Espagne.',
        category: 'Cinéma / Action',
        durationMins: 135,
      },
      {
        title: 'El Hormiguero & Series Atresmedia',
        subTitle: 'Prime Time Divertissement & Fiction HD',
        description: 'Soirée événement en direct et séries inédites sur Antena 3 HD.',
        category: 'Série TV / Divertissement',
        durationMins: 105,
      },
    ],
  },
  {
    id: 'Telecinco.es',
    displayName: 'Telecinco HD (TNT Abertis)',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'ES',
    satellite: 'Hispasat 30°W',
    orbitalPosition: 'Hispasat 30°W',
    bouquets: ['Hispasat Meo/NOS/Movistar', 'Astra Movistar+ España'],
    bouquetId: 'hispasat_meo_nos',
    audioTrackLabel: 'Dual Audio ES / VO Original',
    subtitleTrackLabel: 'DVB-Sub ES · TNT Abertis 30°W',
    scheduleTemplates: [
      {
        title: 'Cine 5 Estrellas : Jurassic World Dominion',
        subTitle: 'Soirée Grand Spectacle sur Telecinco HD (TNT Abertis)',
        description: 'Blockbuster américain en version duale (Espagnol / Version Originale) avec sous-titres.',
        category: 'Cinéma / Aventure',
        durationMins: 130,
      },
      {
        title: 'Entrevías & Fiction Mediaset España',
        subTitle: 'Série Dramatique Espagnole en HD',
        description: 'Diffusion prime time sur Telecinco HD (TNT Abertis Hispasat 30°W).',
        category: 'Série TV / Drame',
        durationMins: 110,
      },
    ],
  },
  {
    id: 'LaSexta.es',
    displayName: 'laSexta HD (TNT Abertis)',
    contentCategory: 'Actualités / News',
    group: 'Actualités / News',
    country: 'ES',
    satellite: 'Hispasat 30°W',
    orbitalPosition: 'Hispasat 30°W',
    bouquets: ['Hispasat Meo/NOS/Movistar', 'Astra Movistar+ España'],
    bouquetId: 'hispasat_meo_nos',
    audioTrackLabel: 'Dual Audio ES / VO',
    subtitleTrackLabel: 'DVB-Sub ES · TNT Abertis 30°W',
    scheduleTemplates: [
      {
        title: 'Al Rojo Vivo & laSexta Columna',
        subTitle: 'Information, Débats & Investigation HD',
        description: 'Analyses politiques, reportages d’investigation et cinéma sur laSexta HD (TNT Abertis).',
        category: 'Actualités / Investigation',
        durationMins: 105,
      },
      {
        title: 'El Taquillazo : Mad Max Fury Road',
        subTitle: 'Cinéma Action US en Dual VO+SUB',
        description: 'Grand film d’action en première partie de soirée sur laSexta HD.',
        category: 'Cinéma / Action',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'Teledeporte.es',
    displayName: 'Teledeporte HD (TNT Abertis)',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'ES',
    satellite: 'Hispasat 30°W',
    orbitalPosition: 'Hispasat 30°W',
    bouquets: ['Hispasat Meo/NOS/Movistar', 'Astra Movistar+ España'],
    bouquetId: 'hispasat_meo_nos',
    audioTrackLabel: 'Audio Direct ES / Stadium HD',
    subtitleTrackLabel: 'DVB-Sub ES · TNT Abertis 30°W',
    scheduleTemplates: [
      {
        title: 'Estudio Estadio & Copa del Rey Live',
        subTitle: 'Direct Sport & Football sur Teledeporte HD',
        description: 'Toute l’actualité sportive espagnole, football, tennis ATP et cyclisme sur TNT Abertis (30°W).',
        category: 'Sport / Football',
        durationMins: 120,
      },
      {
        title: 'Conexión TDP : Grands Événements Sportifs',
        subTitle: 'Retransmission Officielle RTVE Sport HD',
        description: 'Directs et résumés complets sur Teledeporte HD.',
        category: 'Sport',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'Sky.Cinema.Premiere.de',
    displayName: 'Sky Cinema Premiere HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'DE',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE / DAZN DE'],
    bouquetId: 'sky_de',
    audioTrackLabel: 'Dual Audio VO Anglais / DE Dolby',
    subtitleTrackLabel: 'DVB-Sub DE / EN · Sky DE 19.2°E',
    scheduleTemplates: [
      {
        title: 'Blockbuster Premiere : Dune Part Two (OV/DE)',
        subTitle: 'Sky Cinema Premiere HD · Zweikanalton VO+SUB',
        description: 'Exclusivité cinéma en haute définition avec piste audio originale anglaise et sous-titres.',
        category: 'Cinéma / Science-Fiction',
        durationMins: 130,
      },
      {
        title: 'Hollywood Night : Oppenheimer',
        subTitle: 'Biopic Événement en VO / Allemand',
        description: 'Diffusion grand écran sur Sky Cinema Premiere HD (Astra 19.2°E).',
        category: 'Cinéma / Drame',
        durationMins: 130,
      },
    ],
  },
  {
    id: 'DAZN.1.de',
    displayName: 'DAZN 1 Bar HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'DE',
    satellite: 'Astra 19.2°E',
    orbitalPosition: 'Astra 19.2°E',
    bouquets: ['Sky DE / DAZN DE'],
    bouquetId: 'sky_de',
    audioTrackLabel: 'Audio DE / Stadium Live',
    subtitleTrackLabel: 'Sky DE / DAZN · Astra 19.2°E',
    scheduleTemplates: [
      {
        title: 'UEFA Champions League & Bundesliga Konferenz',
        subTitle: 'Live Football sur DAZN 1 HD (Astra 19.2°E)',
        description: 'Les plus grandes rencontres de Bundesliga et d’UEFA Champions League en direct.',
        category: 'Football / Bundesliga',
        durationMins: 120,
      },
      {
        title: 'European Football Show : Serie A & LaLiga',
        subTitle: 'Direct & Résumés Européens HD',
        description: 'Le meilleur des championnats européens en direct sur DAZN 1 HD.',
        category: 'Football',
        durationMins: 120,
      },
    ],
  },

  // =========================================================================
  // 6. HOTBIRD 13°E — BIS TV FRANCE, RAI / SKY ITALIA, POLSAT / CANAL+ PL
  // =========================================================================
  {
    id: 'RTL9.fr',
    displayName: 'RTL9 HD',
    contentCategory: 'Films & Séries',
    group: 'Action & Thriller',
    country: 'FR',
    satellite: 'Hotbird 13°E',
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Hotbird Bis TV/Rai'],
    bouquetId: 'hotbird_bis_fr',
    audioTrackLabel: 'VM (VO / VF Stéréo HD)',
    subtitleTrackLabel: 'DVB-Sub FR · Bis TV 13°E',
    scheduleTemplates: [
      {
        title: 'Soirée Action US : John Wick Chapitre 4',
        subTitle: 'Cinéma Action & Suspense sur RTL9 HD',
        description: 'Grands films d’action américains et thrillers en première partie de soirée sur Bis TV (Hotbird 13°E).',
        category: 'Cinéma / Action',
        durationMins: 120,
      },
      {
        title: 'Blockbuster Club : Fast & Furious',
        subTitle: 'Adrénaline & Cinéma US HD',
        description: 'Diffusion haute définition sur le bouquet Bis TV France (Hotbird 13°E).',
        category: 'Cinéma / Action',
        durationMins: 115,
      },
    ],
  },
  {
    id: 'Rai.1.it',
    displayName: 'Rai 1 HD',
    contentCategory: 'Films & Séries',
    group: 'Séries TV & US',
    country: 'IT',
    satellite: 'Hotbird 13°E',
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Hotbird Bis TV/Rai'],
    bouquetId: 'sky_it',
    audioTrackLabel: 'Dual Audio IT / VO Anglais',
    subtitleTrackLabel: 'DVB-Sub IT / EN · Hotbird 13°E',
    scheduleTemplates: [
      {
        title: 'Prima Serata : Commissario Montalbano',
        subTitle: 'Fiction Prestige en HD sur Rai 1',
        description: 'Les enquêtes emblématiques du commissaire Montalbano en Sicile sur Rai 1 HD (Hotbird 13°E).',
        category: 'Série TV / Polar',
        durationMins: 120,
      },
      {
        title: 'Speciale Superquark : Science & Histoire',
        subTitle: 'Grand Documentaire Culturel Rai 1 HD',
        description: 'Voyage au cœur des merveilles de l’Italie et des découvertes scientifiques.',
        category: 'Documentaire',
        durationMins: 100,
      },
    ],
  },
  {
    id: 'Rai.2.it',
    displayName: 'Rai 2 HD (Tivùsat)',
    contentCategory: 'Films & Séries',
    group: 'Action & Thriller',
    country: 'IT',
    satellite: 'Hotbird 13°E',
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Hotbird Bis TV/Rai'],
    bouquetId: 'sky_it',
    audioTrackLabel: 'Dual Audio IT / VO Anglais',
    subtitleTrackLabel: 'DVB-Sub IT / EN · Tivùsat 13°E',
    scheduleTemplates: [
      {
        title: 'NCIS & FBI : Serata Crime USA (Dual VO+SUB)',
        subTitle: 'Séries Policières US sur Rai 2 HD (Tivùsat)',
        description: 'Diffusion en haute définition avec double piste audio Italien / Version Originale Anglaise.',
        category: 'Série TV / Thriller',
        durationMins: 110,
      },
      {
        title: 'La Domenica Sportiva : Serie A Live',
        subTitle: 'Magazine Officiel du Football Italien HD',
        description: 'Tous les buts, analyses et débats de la Serie A sur Rai 2 HD.',
        category: 'Sport / Football',
        durationMins: 110,
      },
    ],
  },
  {
    id: 'Rai.Movie.it',
    displayName: 'Rai Movie HD (Tivùsat)',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'IT',
    satellite: 'Hotbird 13°E',
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Hotbird Bis TV/Rai'],
    bouquetId: 'sky_it',
    audioTrackLabel: 'Dual Audio IT / VO Original',
    subtitleTrackLabel: 'DVB-Sub IT · Tivùsat 13°E',
    scheduleTemplates: [
      {
        title: 'Grande Cinema : C’era una volta in America',
        subTitle: 'Cinéma 24/7 en Version Originale & Italienne',
        description: 'Les chefs-d’œuvre du cinéma mondial et hollywoodien sur Rai Movie HD (Tivùsat Hotbird 13°E).',
        category: 'Cinéma / Classique',
        durationMins: 135,
      },
      {
        title: 'Hollywood Première : The Irishman',
        subTitle: 'Film Thriller & Drame en HD',
        description: 'Diffusion intégrale avec piste audio originale et sous-titres DVB.',
        category: 'Cinéma / Drame',
        durationMins: 130,
      },
    ],
  },
  {
    id: 'Canale5.it',
    displayName: 'Canale 5 HD (Tivùsat)',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'IT',
    satellite: 'Hotbird 13°E',
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Hotbird Bis TV/Rai'],
    bouquetId: 'sky_it',
    audioTrackLabel: 'Dual Audio IT / VO Dolby',
    subtitleTrackLabel: 'DVB-Sub IT · Tivùsat Mediaset 13°E',
    scheduleTemplates: [
      {
        title: 'Supercinema : Interstellar (Dual Audio)',
        subTitle: 'Prime Time Mediaset sur Canale 5 HD (Tivùsat)',
        description: 'Grand film de première partie de soirée et soirées Coppa Italia sur Canale 5 HD.',
        category: 'Cinéma / Science-Fiction',
        durationMins: 135,
      },
      {
        title: 'Coppa Italia & Serata Eventi Live',
        subTitle: 'Direct & Grands Événements sur Canale 5 HD',
        description: 'Diffusion haute définition sur le bouquet Tivùsat (Hotbird 13°E).',
        category: 'Sport / Football',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'Italia1.it',
    displayName: 'Italia 1 HD (Tivùsat)',
    contentCategory: 'Films & Séries',
    group: 'Action & Thriller',
    country: 'IT',
    satellite: 'Hotbird 13°E',
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Hotbird Bis TV/Rai'],
    bouquetId: 'sky_it',
    audioTrackLabel: 'Dual Audio IT / VO Anglais',
    subtitleTrackLabel: 'DVB-Sub IT · Tivùsat Mediaset 13°E',
    scheduleTemplates: [
      {
        title: 'Italia 1 Action : Mission Impossible – Fallout',
        subTitle: 'Blockbuster US en Dual Audio VO+SUB',
        description: 'Les plus grands films d’action américains et séries US sur Italia 1 HD (Tivùsat 13°E).',
        category: 'Cinéma / Action',
        durationMins: 130,
      },
      {
        title: 'Pressing Serie A & Sport Mediaset',
        subTitle: 'Magazine Football & Résumés HD',
        description: 'Analyses et temps forts du championnat italien sur Italia 1 HD.',
        category: 'Sport / Football',
        durationMins: 100,
      },
    ],
  },
  {
    id: 'Sky.Cinema.Uno.it',
    displayName: 'Sky Cinema Uno HD (Sky Italia)',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'IT',
    satellite: 'Hotbird 13°E',
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Hotbird Bis TV/Rai'],
    bouquetId: 'sky_it',
    audioTrackLabel: 'Doppio Audio VO Anglais / IT Dolby',
    subtitleTrackLabel: 'DVB-Sub IT / EN · Sky Italia 13°E',
    scheduleTemplates: [
      {
        title: 'Prima TV Sky : Dune – Parte Due (VO+SUB)',
        subTitle: 'Exclusivité Sky Cinema Uno HD · Hotbird 13°E',
        description: 'Première cinéma exclusive sur Sky Italia avec double piste audio originale anglaise et sous-titres.',
        category: 'Cinéma / Science-Fiction',
        durationMins: 135,
      },
      {
        title: 'Sky Original : Gomorra / Romanzo Criminale',
        subTitle: 'Série Événement Sky Italia HD',
        description: 'Production originale Sky en haute définition sur Hotbird 13°E.',
        category: 'Série TV / Thriller',
        durationMins: 110,
      },
    ],
  },
  {
    id: 'Sky.Sport.Calcio.it',
    displayName: 'Sky Sport Calcio HD (Sky Italia)',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'IT',
    satellite: 'Hotbird 13°E',
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Hotbird Bis TV/Rai'],
    bouquetId: 'sky_it',
    audioTrackLabel: 'Audio IT / Stadium Live Dolby',
    subtitleTrackLabel: 'Sky Italia · Hotbird 13°E',
    scheduleTemplates: [
      {
        title: 'Serie A Enilive : Inter vs AC Milan (Diretta)',
        subTitle: 'Grand Match Serie A sur Sky Sport Calcio HD',
        description: 'Retransmission en direct de la Serie A italienne avec Sky Calcio Club sur Hotbird 13°E.',
        category: 'Football / Serie A',
        durationMins: 120,
      },
      {
        title: 'Sky Calcio Club & UEFA Champions League Studio',
        subTitle: 'Débrief Tactique & Tous les Buts HD',
        description: 'Le grand plateau football de Sky Sport Italia en direct.',
        category: 'Football / Serie A',
        durationMins: 105,
      },
    ],
  },
  {
    id: 'Sky.TG24.it',
    displayName: 'Sky TG24 HD (Sky Italia)',
    contentCategory: 'Actualités / News',
    group: 'Actualités / News',
    country: 'IT',
    satellite: 'Hotbird 13°E',
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Hotbird Bis TV/Rai'],
    bouquetId: 'sky_it',
    audioTrackLabel: 'Audio Direct IT HD',
    subtitleTrackLabel: 'Sky Italia / Tivùsat · 13°E',
    scheduleTemplates: [
      {
        title: 'Sky TG24 Diretta : Edizione Giorno & Sera',
        subTitle: 'Information Continue 24/7 sur Hotbird 13°E',
        description: 'Toute l’actualité italienne, européenne et internationale en direct sur Sky TG24 HD.',
        category: 'Actualités / News',
        durationMins: 90,
      },
      {
        title: 'Sky TG24 Mondo & Approfondimento',
        subTitle: 'Débats & Dossiers Internationaux HD',
        description: 'Décryptage politique et économique en direct.',
        category: 'Actualités / Débat',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'CanalPlus.Premium.pl',
    displayName: 'Canal+ Premium HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'PL',
    satellite: 'Hotbird 13°E',
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Hotbird Polsat/Cyfra+'],
    bouquetId: 'canal_pl',
    audioTrackLabel: 'Piste VO Anglais (Oryginalna) + Dolby',
    subtitleTrackLabel: 'DVB-Sub PL / EN (Sans Lektor)',
    scheduleTemplates: [
      {
        title: 'Premiera Canal+ : The Last of Us (VO+SUB)',
        subTitle: 'Audio Original Anglais + Sous-titres DVB',
        description: 'Diffusion premium sur Hotbird 13°E avec piste audio originale sans doublage Lektor.',
        category: 'Série TV / Drame',
        durationMins: 110,
      },
      {
        title: 'Ekstraklasa & Premier League Live HD',
        subTitle: 'Grand Match en Direct sur Canal+ Premium',
        description: 'Affiche de prestige du football européen en haute définition sur Hotbird 13°E.',
        category: 'Sport / Football',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'Eleven.Sports.1.pl',
    displayName: 'Eleven Sports 1 HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'PL',
    satellite: 'Hotbird 13°E',
    orbitalPosition: 'Hotbird 13°E',
    bouquets: ['Hotbird Polsat/Cyfra+'],
    bouquetId: 'canal_pl',
    audioTrackLabel: 'Audio Direct / Stadium Feed HD',
    subtitleTrackLabel: 'Hotbird 13°E · Sport HD',
    scheduleTemplates: [
      {
        title: 'Serie A & LaLiga EA Sports : Match en Direct',
        subTitle: 'Football Européen Live sur Eleven Sports 1 HD',
        description: 'Les plus grands chocs de Serie A italienne et de LaLiga espagnole en direct sur Hotbird 13°E.',
        category: 'Football / Serie A & LaLiga',
        durationMins: 120,
      },
      {
        title: 'Eleven Gol Live : Tous les Buts d’Europe',
        subTitle: 'Magazine Football International HD',
        description: 'Résumés complets et analyses tactiques des championnats européens.',
        category: 'Football',
        durationMins: 90,
      },
    ],
  },

  // =========================================================================
  // 7. NILESAT 7°W — MBC, OSN, ROTANA, AL JAZEERA, NATGEO, ON TIME SPORTS
  // =========================================================================
  {
    id: 'MBC.2.nilesat',
    displayName: 'MBC 2 HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'AR',
    satellite: 'Nilesat 7°W',
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['Nilesat MBC/OSN/Rotana'],
    bouquetId: 'nilesat_osn_mbc',
    audioTrackLabel: 'VO Anglais 100% Original (Dolby)',
    subtitleTrackLabel: 'Sous-titres Arabe / Anglais (DVB)',
    scheduleTemplates: [
      {
        title: 'Hollywood Blockbuster : Inception',
        subTitle: 'Non-Stop Hollywood Movies en VO Sous-titrée',
        description: 'Dom Cobb est un voleur expérimenté dans l’art périlleux de l’extraction des secrets au cœur du subconscient.',
        category: 'Cinéma / Science-Fiction',
        durationMins: 130,
      },
      {
        title: 'Prime Time Movie : Interstellar',
        subTitle: 'Cinéma US Grand Spectacle sur MBC 2 HD',
        description: 'Une équipe d’explorateurs franchit un trou de ver spatial pour assurer la survie de l’humanité.',
        category: 'Cinéma / Science-Fiction',
        durationMins: 140,
      },
    ],
  },
  {
    id: 'MBC.Action.nilesat',
    displayName: 'MBC Action HD',
    contentCategory: 'Films & Séries',
    group: 'Action & Thriller',
    country: 'AR',
    satellite: 'Nilesat 7°W',
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['Nilesat MBC/OSN/Rotana'],
    bouquetId: 'nilesat_osn_mbc',
    audioTrackLabel: 'VO Anglais 100% Original',
    subtitleTrackLabel: 'Sous-titres Arabe (DVB)',
    scheduleTemplates: [
      {
        title: 'Action Night : Mad Max Fury Road',
        subTitle: 'Films & Séries d’Action US en VO sur MBC Action HD',
        description: 'Hanté par un lourd passé, Mad Max s’allie à Furiosa dans une course-poursuite explosive à travers le désert.',
        category: 'Cinéma / Action',
        durationMins: 120,
      },
      {
        title: 'Série US : Prison Break / Blacklist',
        subTitle: 'Suspense & Thriller Américain en VO',
        description: 'Épisodes inédits en version originale sous-titrée sur MBC Action HD (Nilesat 7°W).',
        category: 'Série TV / Thriller',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'OSN.Movies.Premiere.nilesat',
    displayName: 'OSN Movies Premiere HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'AR',
    satellite: 'Nilesat 7°W',
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['Nilesat MBC/OSN/Rotana'],
    bouquetId: 'nilesat_osn_mbc',
    audioTrackLabel: 'VO Anglais (Dolby Digital+)',
    subtitleTrackLabel: 'DVB-Sub AR / EN · Nilesat 7°W',
    scheduleTemplates: [
      {
        title: 'OSN Premiere : Dune Part Two',
        subTitle: 'Exclusivité Cinéma Hollywood sur OSN HD',
        description: 'Les plus grands films des studios hollywoodiens en première exclusivité sur Nilesat 7°W.',
        category: 'Cinéma / Box-Office',
        durationMins: 135,
      },
      {
        title: 'OSN Showcase : The Batman',
        subTitle: 'Cinéma US en Version Originale Dolby',
        description: 'Diffusion haute définition avec sous-titres DVB arabes et anglais.',
        category: 'Cinéma / Action',
        durationMins: 135,
      },
    ],
  },
  {
    id: 'Al.Jazeera.nilesat',
    displayName: 'Al Jazeera Channel HD',
    contentCategory: 'Actualités / News',
    group: 'Actualités / News',
    country: 'AR',
    satellite: 'Nilesat 7°W',
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['Nilesat MBC/OSN/Rotana', 'TNT Arabe/Égypte'],
    bouquetId: 'nilesat_osn_mbc',
    audioTrackLabel: 'Audio Direct Arabe HD',
    subtitleTrackLabel: 'Nilesat 7°W · Information 24/7',
    scheduleTemplates: [
      {
        title: 'Journal Télévisé International & Direct 24/7',
        subTitle: 'Couverture Mondiale en Direct sur Al Jazeera HD',
        description: 'Suivi en continu de l’actualité internationale, débats géopolitiques et envoyés spéciaux.',
        category: 'Actualités / News',
        durationMins: 60,
      },
      {
        title: 'Au-Delà de l’Actualité (Ma Waraa Al Khabar)',
        subTitle: 'Débat & Analyse Géopolitique',
        description: 'Décryptage approfondi des grands dossiers internationaux avec des experts invités.',
        category: 'Actualités / Débat',
        durationMins: 60,
      },
    ],
  },
  {
    id: 'OnTime.Sports.1.nilesat',
    displayName: 'ON Time Sports 1 HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'AR',
    satellite: 'Nilesat 7°W',
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['TNT Arabe/Égypte', 'Nilesat MBC/OSN/Rotana'],
    bouquetId: 'nilesat_osn_mbc',
    audioTrackLabel: 'Audio Arabe / Stadium HD',
    subtitleTrackLabel: 'Nilesat 7°W · Football FTA',
    scheduleTemplates: [
      {
        title: 'CAF Champions League & Championnat d’Égypte Live',
        subTitle: 'Grand Match en Direct sur ON Time Sports 1 HD',
        description: 'Retransmission en direct et studio analytique des grandes affiches du football africain et égyptien.',
        category: 'Football / Afrique',
        durationMins: 120,
      },
      {
        title: 'On Time Stadium : Analyse & Résumés',
        subTitle: 'Magazine Football en Direct',
        description: 'Tous les buts, interviews et analyses tactiques de la journée.',
        category: 'Sport / Football',
        durationMins: 90,
      },
    ],
  },

  // =========================================================================
  // 8. BADR / ES'HAILSAT 26°E — BEIN SPORTS, BEIN MOVIES, SSC, AL KASS
  // =========================================================================
  {
    id: 'beIN.Sports.1.badr',
    displayName: "beIN Sports 1 HD (Badr / Es'hailSat 26°E)",
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'AR',
    satellite: "Badr / Es'hailSat 26°E",
    orbitalPosition: "Badr / Es'hailSat 26°E",
    bouquets: ['Badr beIN (Sports & Movies)'],
    bouquetId: 'badr_bein_ssc',
    audioTrackLabel: 'Multi-Audio AR / EN / Stadium',
    subtitleTrackLabel: 'DVB-Sub AR / EN · Badr 26°E',
    scheduleTemplates: [
      {
        title: 'UEFA Champions League : Grande Soirée en Direct',
        subTitle: 'Studio Analytique & Match Phare en HD',
        description: 'Suivez les plus grandes affiches de l’UEFA Champions League en direct sur beIN Sports 1 HD (26°E).',
        category: 'Football / UEFA Champions League',
        durationMins: 120,
      },
      {
        title: 'Premier League : Match of the Day Live',
        subTitle: 'Championnat d’Angleterre en Direct HD',
        description: 'Les chocs du championnat anglais avec commentaires multi-audio sur Badr / Es’hailSat 26°E.',
        category: 'Football / Premier League',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'beIN.Movies.1.Premiere.badr',
    displayName: 'beIN Movies 1 Premiere HD (Badr 26°E)',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'AR',
    satellite: "Badr / Es'hailSat 26°E",
    orbitalPosition: "Badr / Es'hailSat 26°E",
    bouquets: ['Badr beIN (Sports & Movies)'],
    bouquetId: 'badr_bein_ssc',
    audioTrackLabel: 'VO Anglais (Dolby) / AR',
    subtitleTrackLabel: 'DVB-Sub AR / EN · Badr 26°E',
    scheduleTemplates: [
      {
        title: 'beIN Box-Office : Gladiator II',
        subTitle: 'Première Cinéma sur beIN Movies 1 HD',
        description: 'Les dernières sorties des grands studios hollywoodiens en VO sous-titrée sur Badr 26°E.',
        category: 'Cinéma / Action',
        durationMins: 130,
      },
      {
        title: 'Hollywood Première : Top Gun Maverick',
        subTitle: 'Grand Spectacle en Haute Définition',
        description: 'Film événement en version originale Dolby Digital avec sous-titres arabes et anglais.',
        category: 'Cinéma / Aventure',
        durationMins: 125,
      },
    ],
  },
  {
    id: 'SSC.1.badr',
    displayName: 'SSC 1 HD (Badr 26°E)',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'AR',
    satellite: "Badr / Es'hailSat 26°E",
    orbitalPosition: "Badr / Es'hailSat 26°E",
    bouquets: ['Badr SSC'],
    bouquetId: 'badr_bein_ssc',
    audioTrackLabel: 'Multi-Audio AR / EN Stadium',
    subtitleTrackLabel: 'Badr 26°E · Saudi Sports Company',
    scheduleTemplates: [
      {
        title: 'Roshn Saudi League & AFC Champions League Elite',
        subTitle: 'Grand Choc en Direct sur SSC 1 HD (Badr 26°E)',
        description: 'Retransmission officielle des grands matchs de la Roshn Saudi League et de l’AFC Champions League.',
        category: 'Football / Roshn League',
        durationMins: 120,
      },
      {
        title: 'Action Ya Dawri : Débrief & Temps Forts',
        subTitle: 'Magazine Quotidien du Football sur SSC 1 HD',
        description: 'Analyses, résumés et débats autour des grands clubs saoudiens et asiatiques.',
        category: 'Sport / Football',
        durationMins: 90,
      },
    ],
  },

  // =========================================================================
  // 9. HISPASAT 30°W — MEO, NOS PORTUGAL & MOVISTAR
  // =========================================================================
  {
    id: 'TVCine.Top.pt',
    displayName: 'TVCine Top HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'ES',
    satellite: 'Hispasat 30°W',
    orbitalPosition: 'Hispasat 30°W',
    bouquets: ['Hispasat Meo/NOS/Movistar'],
    bouquetId: 'hispasat_meo_nos',
    audioTrackLabel: 'VO Anglais 100% Original (Dolby)',
    subtitleTrackLabel: 'DVB-Sub Portugais · Hispasat 30°W',
    scheduleTemplates: [
      {
        title: 'Estreia TVCine : Oppenheimer (VOST)',
        subTitle: 'Cinéma Première en Version Originale sur Hispasat 30°W',
        description: 'Tous les films sur TVCine Top HD sont diffusés en version originale anglaise sous-titrée.',
        category: 'Cinéma / Biopic',
        durationMins: 135,
      },
      {
        title: 'Noite de Cinema : Dune Parte 2',
        subTitle: 'Grand Blockbuster US sur MEO / NOS (30°W)',
        description: 'Science-fiction et aventure épique en haute définition sur Hispasat 30°W.',
        category: 'Cinéma / Science-Fiction',
        durationMins: 135,
      },
    ],
  },
  {
    id: 'Sport.TV.1.pt',
    displayName: 'Sport TV 1 HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'ES',
    satellite: 'Hispasat 30°W',
    orbitalPosition: 'Hispasat 30°W',
    bouquets: ['Hispasat Meo/NOS/Movistar'],
    bouquetId: 'hispasat_meo_nos',
    audioTrackLabel: 'Multi-Audio PT / EN Stadium',
    subtitleTrackLabel: 'Hispasat 30°W · MEO / NOS',
    scheduleTemplates: [
      {
        title: 'Liga Portugal Betclic & UEFA Champions League',
        subTitle: 'Direct sur Sport TV 1 HD (Hispasat 30°W)',
        description: 'Les grandes affiches du championnat portugais et des coupes européennes en direct.',
        category: 'Football / Liga Portugal',
        durationMins: 120,
      },
      {
        title: 'Premier League & Serie A : Match en Direct',
        subTitle: 'Football International sur Sport TV 1 HD',
        description: 'Retransmission en haute définition sur le bouquet MEO / NOS (Hispasat 30°W).',
        category: 'Football',
        durationMins: 120,
      },
    ],
  },

  // =========================================================================
  // 10. AMÉRIQUE DU SUD / LATAM — STAR ONE 70°W, AMAZONAS 61°W, SES-6 40.5°W
  // =========================================================================
  {
    id: 'Telecine.Premium.br',
    displayName: 'Telecine Premium HD',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'BR',
    satellite: 'Star One D2 70°W',
    orbitalPosition: 'Star One 70°W',
    bouquets: ['Claro TV Brasil'],
    bouquetId: 'starone_70w_claro_br',
    audioTrackLabel: 'Dual Audio PT-BR / VO Anglais Dolby',
    subtitleTrackLabel: 'Legendas DVB PT-BR · Star One 70°W',
    scheduleTemplates: [
      {
        title: 'Superestreia Telecine : Dune - Parte Dois',
        subTitle: 'Estreia Exclusiva em HD · Dual Audio + Legendas',
        description: 'Os maiores sucessos do cinema mundial em primeira mão no Telecine Premium HD (Star One 70°W · Claro TV).',
        category: 'Cinéma / Science-Fiction',
        durationMins: 135,
      },
      {
        title: 'Sessão Blockbuster : Oppenheimer',
        subTitle: 'Cinema Premiado em VO + Legendas PT-BR',
        description: 'Superprodução internacional transmitida em alta definição no Star One D2 70°W.',
        category: 'Cinéma / Biopic',
        durationMins: 135,
      },
    ],
  },
  {
    id: 'SporTV.1.br',
    displayName: 'SporTV 1 HD',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'BR',
    satellite: 'Star One D2 70°W',
    orbitalPosition: 'Star One 70°W',
    bouquets: ['Claro TV Brasil'],
    bouquetId: 'starone_70w_claro_br',
    audioTrackLabel: 'Audio PT-BR / Estádio Ao Vivo HD',
    subtitleTrackLabel: 'Closed Captions · Star One 70°W',
    scheduleTemplates: [
      {
        title: 'Brasileirão Série A & Copa do Brasil : Jogo Ao Vivo',
        subTitle: 'Futebol Ao Vivo no SporTV 1 HD (Star One 70°W)',
        description: 'Transmissão exclusiva ao vivo dos grandes clássicos do futebol brasileiro no Star One 70°W.',
        category: 'Football / Brasileirão',
        durationMins: 120,
      },
      {
        title: 'Troca de Passes & Seleção SporTV',
        subTitle: 'Debate Esportivo & Gols da Rodada',
        description: 'Análise completa da rodada do Brasileirão e CONMEBOL Libertadores.',
        category: 'Football',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'Globo.HD.br',
    displayName: 'TV Globo HD',
    contentCategory: 'Films & Séries',
    group: 'Séries TV & US',
    country: 'BR',
    satellite: 'Star One D2 70°W',
    orbitalPosition: 'Star One 70°W',
    bouquets: ['Claro TV Brasil'],
    bouquetId: 'starone_70w_claro_br',
    audioTrackLabel: 'Audio Original PT-BR / SAP VO',
    subtitleTrackLabel: 'Closed Captions · Star One 70°W',
    scheduleTemplates: [
      {
        title: 'Novela das Nove & Cinema Especial',
        subTitle: 'Horário Nobre em Alta Definição',
        description: 'Grandes produções teledramatúrgicas, jornalismo e futebol ao vivo na TV Globo HD (Star One 70°W).',
        category: 'Série TV',
        durationMins: 105,
      },
      {
        title: 'Tela Quente : Grande Estreia da Semana',
        subTitle: 'Cinema Internacional Dual Audio',
        description: 'Sucesso de bilheteria exibido em alta definição via satélite Star One 70°W.',
        category: 'Cinéma',
        durationMins: 120,
      },
    ],
  },
  {
    id: 'TNT.Series.latam',
    displayName: 'TNT Series HD LATAM',
    contentCategory: 'Films & Séries',
    group: 'Action & Thriller',
    country: 'LATAM',
    satellite: 'Amazonas 61°W',
    orbitalPosition: 'Amazonas 61°W',
    bouquets: ['Vivo TV / Movistar LATAM'],
    bouquetId: 'amazonas_61w_latam',
    audioTrackLabel: 'Dual Audio ES / PT + VO Inglés',
    subtitleTrackLabel: 'Subtítulos DVB ES/PT · Amazonas 61°W',
    scheduleTemplates: [
      {
        title: 'The Rookie & CSI: Vegas — Maratón Estelar',
        subTitle: 'Series Policiales en Vivo · Audio Original + Sub',
        description: 'Las mejores series de acción, suspenso y drama en TNT Series HD (Amazonas 61°W · Movistar / Vivo TV).',
        category: 'Série TV / Policier',
        durationMins: 100,
      },
      {
        title: 'Hollywood Action Night : Misión Imposible',
        subTitle: 'Cine Taquillero en Alta Definición',
        description: 'Películas de acción y suspenso con audio original e idioma dual en Amazonas 61°W.',
        category: 'Cinéma / Action',
        durationMins: 125,
      },
    ],
  },
  {
    id: 'ESPN.Latam.ar',
    displayName: 'ESPN HD Sur / LATAM',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'LATAM',
    satellite: 'Amazonas 61°W',
    orbitalPosition: 'Amazonas 61°W',
    bouquets: ['Vivo TV / Movistar LATAM'],
    bouquetId: 'amazonas_61w_latam',
    audioTrackLabel: 'Audio ES / PT / Ambiente Estadio',
    subtitleTrackLabel: 'Amazonas 61°W · Movistar / Vivo LATAM',
    scheduleTemplates: [
      {
        title: 'CONMEBOL Libertadores & UEFA Champions League En Vivo',
        subTitle: 'Transmisión Oficial en Directo por ESPN HD',
        description: 'Los partidos más vibrantes de la Copa Libertadores y Champions League en vivo por Amazonas 61°W.',
        category: 'Football / Libertadores',
        durationMins: 120,
      },
      {
        title: 'SportsCenter & ESPN F90 en Vivo',
        subTitle: 'Debate y Resumen Deportivo Internacional',
        description: 'Toda la actualidad del fútbol sudamericano y europeo en alta definición.',
        category: 'Football',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'HBO.Mundi.latam',
    displayName: 'HBO HD LATAM',
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
    country: 'LATAM',
    satellite: 'Amazonas 61°W',
    orbitalPosition: 'Amazonas 61°W',
    bouquets: ['Vivo TV / Movistar LATAM'],
    bouquetId: 'amazonas_61w_latam',
    audioTrackLabel: 'VO Inglés Dolby 5.1 + Dual ES/PT',
    subtitleTrackLabel: 'Subtítulos DVB ES/PT · Amazonas 61°W',
    scheduleTemplates: [
      {
        title: 'House of the Dragon & The Last of Us',
        subTitle: 'Serie Original HBO en Vivo · VO+SUB',
        description: 'Estrenos mundiales de series originales y películas taquilleras en HBO HD LATAM (Amazonas 61°W).',
        category: 'Série TV / Fantastique',
        durationMins: 110,
      },
      {
        title: 'Estreno HBO : Batman & Universo DC',
        subTitle: 'Película Estelar en Alta Definición',
        description: 'Cine de estreno con audio original en inglés y subtítulos en español y portugués.',
        category: 'Cinéma / Action',
        durationMins: 130,
      },
    ],
  },
  {
    id: 'DSports.1.latam',
    displayName: 'DSports 1 HD (DirecTV Sports)',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'LATAM',
    satellite: 'Intelsat 43.1°W / SES-6 40.5°W',
    orbitalPosition: 'SES-6 40.5°W',
    bouquets: ['DirecTV LATAM / Sky Brasil'],
    bouquetId: 'intelsat_43w_directv',
    audioTrackLabel: 'Multi-Audio ES / Stadium Live HD',
    subtitleTrackLabel: 'SES-6 40.5°W · DirecTV / Sky LATAM',
    scheduleTemplates: [
      {
        title: 'LaLiga EA Sports & Copa Sudamericana : Partido En Vivo',
        subTitle: 'Exclusivo en Directo por DSports 1 HD (SES-6 40.5°W)',
        description: 'Cobertura exclusiva de LaLiga española, Copa Sudamericana y Eliminatorias en SES-6 40.5°W.',
        category: 'Football / LaLiga',
        durationMins: 120,
      },
      {
        title: 'Fútbol Total : Análisis de la Jornada Sudamericana',
        subTitle: 'Debate en Vivo desde Buenos Aires & Bogotá',
        description: 'El programa líder de debate futbolístico de Sudamérica en DSports HD.',
        category: 'Football',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'TNT.Sports.ar',
    displayName: 'TNT Sports HD Argentina / Chile',
    contentCategory: 'Sport / Football',
    group: 'Sport / Football',
    country: 'LATAM',
    satellite: 'Intelsat 43.1°W / SES-6 40.5°W',
    orbitalPosition: 'SES-6 40.5°W',
    bouquets: ['DirecTV LATAM / Sky Brasil'],
    bouquetId: 'intelsat_43w_directv',
    audioTrackLabel: 'Audio Estadio / Relato Oficial HD',
    subtitleTrackLabel: 'SES-6 40.5°W · Pack Fútbol',
    scheduleTemplates: [
      {
        title: 'Liga Profesional de Fútbol Argentino : Superclásico Live',
        subTitle: 'Fútbol En Vivo por TNT Sports HD (SES-6 40.5°W)',
        description: 'Transmisión en directo del Torneo de la Liga Profesional Argentina y Campeonato Chileno en SES-6 40.5°W.',
        category: 'Football',
        durationMins: 120,
      },
      {
        title: 'Todos Somos Técnicos & TNT Data Sports',
        subTitle: 'Resumen y Goles de la Fecha',
        description: 'Análisis táctico y todos los goles del fútbol sudamericano en alta definición.',
        category: 'Football',
        durationMins: 90,
      },
    ],
  },
  {
    id: 'Universal.Premiere.latam',
    displayName: 'Universal Premiere HD',
    contentCategory: 'Films & Séries',
    group: 'Séries TV & US',
    country: 'LATAM',
    satellite: 'Intelsat 43.1°W / SES-6 40.5°W',
    orbitalPosition: 'SES-6 40.5°W',
    bouquets: ['DirecTV LATAM / Sky Brasil'],
    bouquetId: 'intelsat_43w_directv',
    audioTrackLabel: 'VO Inglés + Audio Dual ES/PT',
    subtitleTrackLabel: 'Subtítulos DVB · SES-6 40.5°W',
    scheduleTemplates: [
      {
        title: 'Chicago Fire, FBI & Law & Order — Noche de Estrenos',
        subTitle: 'Series Norteamericanas en VO + Subtítulos',
        description: 'Estrenos exclusivos de las franquicias más exitosas en Universal Premiere HD (SES-6 40.5°W · Sky / DirecTV).',
        category: 'Série TV',
        durationMins: 105,
      },
      {
        title: 'Cine Universal : Jurassic World Dominion',
        subTitle: 'Blockbuster en Alta Definición',
        description: 'Grandes éxitos de Universal Pictures en versión original subtitulada.',
        category: 'Cinéma / Aventure',
        durationMins: 125,
      },
    ],
  },
];

/**
 * Complète automatiquement la couverture des bouquets satellites sélectionnés
 * (Eutelsat 16°E : 5 bouquets, Thor 0.8°W : 3 bouquets, TurkmenÄlem 52°E : 2 bouquets,
 * MonacoSat 52°E : 2 bouquets) afin qu'aucun bouquet officiel actif ne soit vide
 * et que chaque chaîne dispose d'une grille EPG complète sur 24h.
 */
export function supplementSatelliteBouquetsCoverage(
  channelsMap: Map<string, EpgChannel>,
  programmesByChannel: Record<string, EpgProgramme[]>,
  filterOptions?: EpgParseFilterOptions,
  activeBouquetIds?: EpgBouquetId[]
): number {
  const activeSet =
    activeBouquetIds && activeBouquetIds.length > 0
      ? new Set<EpgBouquetId>(activeBouquetIds)
      : null;

  const nowMs = Date.now();
  const baseHourMs = Math.floor(nowMs / (3600 * 1000)) * 3600 * 1000 - 4 * 3600 * 1000;
  let addedProgrammesCount = 0;

  for (const tpl of SUPPLEMENTAL_SATELLITE_BOUQUET_CHANNELS) {
    const is52East =
      tpl.bouquetId === 'turkmenalem_52e_alem' ||
      tpl.bouquetId === 'monacosat_52e_persiana';
    const isTrt = tpl.bouquetId === 'trt_network';
    if (activeSet) {
      const allowedByActiveSet = is52East
        ? activeSet.has('turkmenalem_52e_alem') ||
          activeSet.has('monacosat_52e_persiana')
        : isTrt
        ? activeSet.has('trt_network')
        : activeSet.has(tpl.bouquetId);
      if (!allowedByActiveSet) {
        continue;
      }
    }

    const channelSatellites: Exclude<SatelliteFilter, 'Tous'>[] = is52East
      ? ['TurkmenÄlem 52°E', 'MonacoSat 52°E']
      : isTrt
      ? ['Türksat 42°E', 'Türksat 42°E / Eutelsat 7°E']
      : [tpl.satellite];

    const pseudoSpec: WhitelistedChannelSpec = {
      canonicalId: tpl.id,
      displayName: tpl.displayName,
      contentCategory: tpl.contentCategory,
      country: tpl.country,
      satellites: channelSatellites,
      orbitalPosition: tpl.orbitalPosition,
      bouquets: tpl.bouquets,
      bouquetId: tpl.bouquetId,
      group: tpl.group,
      audioTrackLabel: tpl.audioTrackLabel,
      subtitleTrackLabel: tpl.subtitleTrackLabel,
      hasPolishLektor: false,
      hasSubtitles: true,
    };

    if (!matchesChannelFilterOptions(pseudoSpec, filterOptions)) {
      continue;
    }

    const existingCh = channelsMap.get(tpl.id);
    const resolvedIcon = resolveOfficialChannelLogoUrl(
      tpl.id,
      tpl.displayName,
      tpl.icon || existingCh?.icon
    );
    if (!existingCh) {
      channelsMap.set(tpl.id, {
        id: tpl.id,
        displayName: tpl.displayName,
        icon: resolvedIcon,
        contentCategory: tpl.contentCategory,
        group: tpl.group,
        country: tpl.country,
        satellites: channelSatellites,
        orbitalPosition: tpl.orbitalPosition,
        bouquets: tpl.bouquets,
        bouquetId: tpl.bouquetId,
        audioTrackLabel: tpl.audioTrackLabel,
        subtitleTrackLabel: tpl.subtitleTrackLabel,
        hasPolishLektor: false,
        hasSubtitles: true,
        sourceId: `supp_${tpl.bouquetId}`,
        sourceName: tpl.orbitalPosition,
        channelNumber: channelsMap.size + 1,
        programmeCount: 0,
      });
    } else {
      const mergedBouquets = Array.from(
        new Set<Exclude<BouquetFilter, 'Tous'>>([
          ...(isTrt ? [] : existingCh.bouquets || []),
          ...tpl.bouquets,
        ])
      );
      const allowedSats = getAllowedSatellitesForBouquets(
        activeBouquetIds || filterOptions?.selectedBouquets
      );
      const rawMergedSats = isTrt
        ? channelSatellites
        : Array.from(
            new Set<Exclude<SatelliteFilter, 'Tous'>>([
              ...(existingCh.satellites || []).filter((s) => s !== 'Türksat 42°E' && s !== 'Türksat 42°E / Eutelsat 7°E'),
              ...channelSatellites,
            ])
          );
      const mergedSats = allowedSats
        ? rawMergedSats.filter((s) => allowedSats.has(s))
        : rawMergedSats;
      channelsMap.set(tpl.id, {
        ...existingCh,
        displayName: tpl.displayName,
        icon: resolvedIcon,
        satellites: mergedSats.length > 0 ? mergedSats : channelSatellites,
        orbitalPosition: tpl.orbitalPosition,
        bouquets: mergedBouquets,
        bouquetId: tpl.bouquetId,
      });
    }

    const existingProgs = programmesByChannel[tpl.id];
    if (!existingProgs || existingProgs.length === 0) {
      const generated: EpgProgramme[] = [];
      let cursorMs = baseHourMs;
      const endWindowMs = baseHourMs + 36 * 3600 * 1000;
      let idx = 0;

      while (cursorMs < endWindowMs) {
        const item = tpl.scheduleTemplates[idx % tpl.scheduleTemplates.length];
        const durationMs = item.durationMins * 60 * 1000;
        const stopMs = cursorMs + durationMs;
        generated.push({
          id: `${tpl.id}_${cursorMs}_${idx}`,
          channelId: tpl.id,
          title: item.title,
          subTitle: item.subTitle,
          description: item.description,
          category: item.category,
          group: tpl.group,
          startMs: cursorMs,
          stopMs,
          hasOriginalAudioVO: true,
          hasSubtitles: true,
        });
        cursorMs = stopMs;
        idx++;
        addedProgrammesCount++;
      }

      programmesByChannel[tpl.id] = generated;
    }
  }

  return addedProgrammesCount;
}

