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

export type { WhitelistedChannelSpec };

export interface EpgParseFilterOptions {
  selectedBouquets?: EpgBouquetId[];
  excludePolishLektor?: boolean;
  excludeNoSubtitles?: boolean;
  enabledCategories?: ThematicCategoryId[];
}

export type XmltvFilterOptions = EpgParseFilterOptions;

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
  return /\b(bein\s*sport|bein\s*sports|bein_sport|ssc|al\s*kass|alkass|ad\s*sport|abu\s*dhabi\s*sport|dubai\s*sport|on\s*time\s*sport|arryadia|canal\+?\s*foot|canal\+?\s*sport|rmc\s*sport|eurosport|l'equipe|l’équipe|lequipe|dazn|sky\s*sport|eleven\s*sport|polsat\s*sport|sport\s*tv|movistar\s*laliga|liga\s*de\s*campeones|teledeporte|spor\s*tv)\b/i.test(
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
  return raw as Exclude<BouquetFilter, 'Tous'>;
}

function normalizeSatelliteName(raw: string): Exclude<SatelliteFilter, 'Tous'> {
  if (raw === 'Nilesat OSN/MBC') return 'Nilesat 7°W';
  return raw as Exclude<SatelliteFilter, 'Tous'>;
}

export function inferChannelBouquetId(
  spec: {
    bouquetId?: EpgBouquetId;
    country: Exclude<CountryCode, 'Tous'>;
    bouquets?: string[];
    satellites?: string[];
  }
): EpgBouquetId {
  if (spec.bouquetId) return spec.bouquetId;
  if (spec.bouquets?.includes('TNT France')) return 'tnt_fr';
  if (spec.bouquets?.includes('Bis TV France')) return 'hotbird_bis_fr';
  if (
    spec.bouquets?.includes('Badr Sport & MENA') ||
    spec.satellites?.includes('Badr / Es\'hailSat 26°E')
  ) {
    return 'badr_bein_ssc';
  }
  if (spec.bouquets?.includes('Meo / NOS / Movistar 30°W')) {
    return 'hispasat_meo_nos';
  }
  if (spec.country === 'FR') return 'astra_canal_fr';
  if (spec.country === 'ES') return 'movistar_es';
  if (spec.country === 'DE') return 'sky_de';
  if (spec.country === 'IT') return 'sky_it';
  if (spec.country === 'PL') return 'canal_pl';
  if (spec.country === 'EU') return 'eutelsat_16e_thor';
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
    lowerKey.includes('adult') ||
    lowerKey.includes('xxx') ||
    lowerKey.includes('playboy') ||
    lowerKey.includes('penthouse') ||
    lowerKey.includes('hustler')
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
  return rawId
    .replace(/^en:\.?/i, '')
    .replace(suffixRegex, '')
    .replace(/_digital_mono(?:-\d+)?(?:_en|_ar)?/gi, '')
    .replace(/_(?:en|ar)$/i, '')
    .replace(/[._]+/g, ' ')
    .trim();
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
      displayName: `${cleanName} (Astra 19.2°E)`,
      contentCategory: classified.contentCategory,
      country: 'FR',
      satellites: isBis
        ? ['Astra 19.2°E', 'Hotbird 13°E']
        : ['Astra 19.2°E'],
      orbitalPosition: isBis
        ? 'Astra 19.2°E / Hotbird 13°E'
        : 'Astra 19.2°E',
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
          ? canonicalBein.displayName
          : `${cleanName} (Badr 26°E)`,
        contentCategory: canonicalBein
          ? canonicalBein.contentCategory
          : classified.contentCategory,
        country: 'AR',
        satellites: ["Badr / Es'hailSat 26°E"],
        orbitalPosition: "Badr / Es'hailSat 26°E",
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
        displayName: `${cleanName} (Badr 26°E)`,
        contentCategory: classified.contentCategory,
        country: 'AR',
        satellites: ["Badr / Es'hailSat 26°E"],
        orbitalPosition: "Badr / Es'hailSat 26°E",
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
        displayName: `${cleanName} (Badr 26°E)`,
        contentCategory: classified.contentCategory,
        country: 'AR',
        satellites: ["Badr / Es'hailSat 26°E"],
        orbitalPosition: "Badr / Es'hailSat 26°E",
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
        displayName: `${cleanName} (Nilesat 7°W)`,
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
      displayName: `${cleanName} (Nilesat 7°W)`,
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
      displayName: `${cleanName} (Astra 19.2°E / 30°W)`,
      contentCategory: classified.contentCategory,
      country: 'ES',
      satellites: ['Astra 19.2°E', 'Hispasat 30°W'],
      orbitalPosition: 'Astra 19.2°E / Hispasat 30°W',
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
      displayName: `${cleanName} (Hispasat 30°W)`,
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
      displayName: `${cleanName} (Astra 19.2°E)`,
      contentCategory: classified.contentCategory,
      country: 'DE',
      satellites: ['Astra 19.2°E'],
      orbitalPosition: 'Astra 19.2°E',
      bouquets: ['Astra Movistar+ España', 'Sky DE / DAZN DE'],
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
      displayName: `${cleanName} (Hotbird 13°E)`,
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
      displayName: `${cleanName} (Hotbird 13°E)`,
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

  // 9. Eutelsat 16°E / Thor 0.8°W (RO / EU - Focus Sat, Total TV, DigitAlb) — Toutes catégories
  if (key.endsWith('.ro') || key.endsWith('.hr') || key.endsWith('.rs')) {
    const classified = classifyChannelCategoryAndGroup(key);
    if (!classified) return null;

    const cleanName = formatCleanChannelDisplayName(rawId, /\.(ro|hr|rs)$/i);
    if (!cleanName) return null;

    return {
      canonicalId: key,
      displayName: `${cleanName} (Eutelsat/Thor)`,
      contentCategory: classified.contentCategory,
      country: 'EU',
      satellites: ['Eutelsat 16°E / Thor 0.8°W'],
      orbitalPosition: 'Eutelsat 16°E / Thor 0.8°W',
      bouquets: ['DigitAlb / Total TV / Focus Sat'],
      bouquetId: 'eutelsat_16e_thor',
      group: classified.group,
      audioTrackLabel: 'Dual VO / Multi-Audio',
      subtitleTrackLabel: 'DVB-Sub EU / Teletext',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
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
      displayName: `${cleanName} (${isBrazil ? 'BR 70°W' : 'LATAM'})`,
      contentCategory: classified.contentCategory,
      country: isBrazil ? 'BR' : 'LATAM',
      satellites: isBrazil
        ? ['Star One D2 70°W', 'Amazonas 61°W', 'Intelsat 43.1°W / SES-6 40.5°W']
        : ['Amazonas 61°W', 'Intelsat 43.1°W / SES-6 40.5°W'],
      orbitalPosition: isBrazil
        ? 'Star One D2 70°W / SES-6'
        : 'Amazonas 61°W / Intelsat 43.1°W',
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
    bouquetSet.add('Astra Movistar+ España');
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
    orbitalPosition: spec.orbitalPosition,
    bouquets: Array.from(bouquetSet),
    bouquetId: bId,
  };
}

export function matchesChannelFilterOptions(
  spec: WhitelistedChannelSpec,
  filterOptions?: EpgParseFilterOptions
): boolean {
  if (!filterOptions) return !spec.hasPolishLektor && spec.hasSubtitles !== false;

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
  if (!rawId) return null;
  const key = cleanXmltvChannelId(rawId).toLowerCase();
  if (!key) return null;
  const rawTrimmedLower = rawId.trim().toLowerCase();

  const sportSpec =
    SPORT_FOOTBALL_WHITELIST[rawTrimmedLower] || SPORT_FOOTBALL_WHITELIST[key];
  if (sportSpec) {
    const mapped = mapCanonicalSatelliteAndBouquets(sportSpec);
    const fullSportSpec: WhitelistedChannelSpec = {
      ...sportSpec,
      canonicalId: cleanXmltvChannelId(sportSpec.canonicalId),
      satellites: mapped.satellites,
      orbitalPosition: mapped.orbitalPosition,
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

  const mapped = mapCanonicalSatelliteAndBouquets(cinemaSpec);

  const fullCinemaSpec: WhitelistedChannelSpec = {
    ...cinemaSpec,
    canonicalId: cleanXmltvChannelId(cinemaSpec.canonicalId),
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
    satellites: mapped.satellites,
    orbitalPosition: mapped.orbitalPosition,
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

  const url = extractXmlTagContent(block, 'url') || undefined;

  let icon: string | undefined = spec.defaultIcon;
  const iconIdx = block.indexOf('<icon');
  if (iconIdx !== -1) {
    const iconEnd = block.indexOf('>', iconIdx);
    if (iconEnd !== -1) {
      icon =
        extractXmlAttr(block.slice(iconIdx, iconEnd + 1), 'src') ||
        spec.defaultIcon;
    }
  }

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
      icon = extractXmlAttr(block.slice(iconIdx, iconEnd + 1), 'src') || undefined;
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
}
