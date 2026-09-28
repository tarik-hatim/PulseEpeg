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
  titleHint?: string
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
    combined.includes('afcon')
  ) {
    return 'Sport & Football Live';
  }

  if (!rawCategory) return 'Cinéma & Série VO';
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
    lower.includes('comedy') ||
    lower.includes('sitcom')
  ) {
    return isSeriesHint ? 'Série TV · Comédie' : 'Comédie';
  }
  if (
    lower.includes('obyczajow') ||
    lower.includes('dramat') ||
    lower.includes('drama') ||
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
    lower.includes('series') ||
    isSeriesHint
  ) {
    return 'Série TV US/Euro';
  }
  if (
    lower.includes('film') ||
    lower.includes('spielfilm') ||
    lower.includes('kino') ||
    lower.includes('cine') ||
    lower.includes('película') ||
    lower.includes('movie')
  ) {
    return 'Long-Métrage Cinéma';
  }
  if (
    lower.includes('animowan') ||
    lower.includes('animación') ||
    lower.includes('animazione') ||
    lower.includes('animation') ||
    lower.includes('famil')
  ) {
    return 'Cinéma Famille & Animation';
  }

  return rawCategory.charAt(0).toUpperCase() + rawCategory.slice(1);
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
  // 5. NILESAT 7°W — EXCLUSIVEMENT LES 9 CHAÎNES US/EURO (VO ANGLAIS + SOUS-TITRES)
  // MBC 2, MBC Max, MBC Action, MBC 4, OSN TV Movies Premiere, OSN TV Movies Action,
  // OSN TV Movies Hollywood, OSN TV Series, Dubai One.
  // ===========================================================================
  'mbc.2.ae': {
    canonicalId: 'MBC.2.nilesat',
    displayName: 'MBC 2',
    country: 'AR',
    satellites: ['Nilesat OSN/MBC'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'mbc.2.eg': {
    canonicalId: 'MBC.2.nilesat',
    displayName: 'MBC 2',
    country: 'AR',
    satellites: ['Nilesat OSN/MBC'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'en:.mbc.max.sa': {
    canonicalId: 'MBC.Max.nilesat',
    displayName: 'MBC Max',
    country: 'AR',
    satellites: ['Nilesat OSN/MBC'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'mbc.max.eg': {
    canonicalId: 'MBC.Max.nilesat',
    displayName: 'MBC Max',
    country: 'AR',
    satellites: ['Nilesat OSN/MBC'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'mbc.action.ae': {
    canonicalId: 'MBC.Action.nilesat',
    displayName: 'MBC Action',
    country: 'AR',
    satellites: ['Nilesat OSN/MBC'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'en:.mbc.action.sa': {
    canonicalId: 'MBC.Action.nilesat',
    displayName: 'MBC Action',
    country: 'AR',
    satellites: ['Nilesat OSN/MBC'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'mbc.action.eg': {
    canonicalId: 'MBC.Action.nilesat',
    displayName: 'MBC Action',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'osn.tv.movies.premiere.sa': {
    canonicalId: 'OSN.Movies.Premiere.nilesat',
    displayName: 'OSN TV Movies Premiere',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Dolby)',
    subtitleTrackLabel: 'DVB-Sub AR/EN',
    defaultIcon: 'https://content.osn.com/logo/channel/cropped/OM1.png',
  },
  'osn.tv.movies.action.sa': {
    canonicalId: 'OSN.Movies.Action.nilesat',
    displayName: 'OSN TV Movies Action',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais (Dolby)',
    subtitleTrackLabel: 'DVB-Sub AR/EN',
    defaultIcon: 'https://content.osn.com/logo/channel/cropped/AHD.png',
  },
  'en:.movies.action.sa': {
    canonicalId: 'OSN.Movies.Action.nilesat',
    displayName: 'OSN TV Movies Action',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Action & Thriller',
    audioTrackLabel: 'VO Anglais (Dolby)',
    subtitleTrackLabel: 'DVB-Sub AR/EN',
    defaultIcon: 'https://content.osn.com/logo/channel/cropped/AHD.png',
  },
  'osn.tv.movies.hollywood.sa': {
    canonicalId: 'OSN.Movies.Hollywood.nilesat',
    displayName: 'OSN TV Movies Hollywood',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais (Dolby)',
    subtitleTrackLabel: 'DVB-Sub AR/EN',
    defaultIcon: 'https://content.osn.com/logo/channel/cropped/OPR.png',
  },
  'osn.tv.showcase.sa': {
    canonicalId: 'OSN.Series.nilesat',
    displayName: 'OSN TV Series',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais (Dolby)',
    subtitleTrackLabel: 'DVB-Sub AR/EN',
    defaultIcon: 'https://content.osn.com/logo/channel/cropped/OSH.png',
  },
  'osn.tv.one.sa': {
    canonicalId: 'OSN.Series.nilesat',
    displayName: 'OSN TV Series',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Séries TV & US',
    audioTrackLabel: 'VO Anglais (Dolby)',
    subtitleTrackLabel: 'DVB-Sub AR/EN',
    defaultIcon: 'https://content.osn.com/logo/channel/cropped/OSH.png',
  },
  'dubai.one.hd.ae': {
    canonicalId: 'Dubai.One.nilesat',
    displayName: 'Dubai One',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
  },
  'dubai.one.eg': {
    canonicalId: 'Dubai.One.nilesat',
    displayName: 'Dubai One',
    country: 'AR',
    satellites: ['Nilesat 7°W'],
    orbitalPosition: 'Nilesat 7°W',
    bouquets: ['OSN / MBC (Nilesat)'],
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
  }
): EpgBouquetId {
  if (spec.bouquetId) return spec.bouquetId;
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

function resolveDynamicGlobalSpec(rawId: string): WhitelistedChannelSpec | null {
  const key = rawId.trim().toLowerCase();

  // Eutelsat 16°E / Thor 0.8°W (RO / EU - Focus Sat, Total TV, DigitAlb)
  if (key.endsWith('.ro') || key.endsWith('.hr') || key.endsWith('.rs')) {
    const isSport =
      key.includes('sport') ||
      key.includes('digisport') ||
      key.includes('digi.sport') ||
      key.includes('primasport') ||
      key.includes('prima.sport') ||
      key.includes('arena') ||
      key.includes('eurosport');
    const isDoc =
      key.includes('discovery') ||
      key.includes('nat.geo') ||
      key.includes('national.geographic') ||
      key.includes('viasat.explore') ||
      key.includes('viasat.history') ||
      key.includes('viasat.nature') ||
      key.includes('history') ||
      key.includes('docu') ||
      key.includes('animal.planet');
    const isCinemaOrSeries =
      key.includes('hbo') ||
      key.includes('cinemax') ||
      key.includes('filmbox') ||
      key.includes('axn') ||
      key.includes('warner') ||
      key.includes('diva') ||
      key.includes('pro.cinema') ||
      key.includes('film.cafe') ||
      key.includes('epic.drama') ||
      key.includes('amc') ||
      key.includes('comedy.central');

    if (!isSport && !isDoc && !isCinemaOrSeries) return null;

    const cleanName = rawId
      .replace(/\.(ro|hr|rs)$/i, '')
      .replace(/\./g, ' ')
      .trim();

    return {
      canonicalId: rawId,
      displayName: `${cleanName} (Eutelsat/Thor)`,
      contentCategory: isSport
        ? 'Sport / Football'
        : isDoc
        ? 'Documentaires'
        : 'Films & Séries',
      country: 'EU',
      satellites: ['Eutelsat 16°E / Thor 0.8°W'],
      orbitalPosition: 'Eutelsat 16°E / Thor 0.8°W',
      bouquets: ['DigitAlb / Total TV / Focus Sat'],
      bouquetId: 'eutelsat_16e_thor',
      group: isSport
        ? 'Sport / Football'
        : isDoc
        ? 'Documentaires'
        : key.includes('axn') || key.includes('action')
        ? 'Action & Thriller'
        : 'Cinéma Premières',
      audioTrackLabel: 'Dual VO / Multi-Audio',
      subtitleTrackLabel: 'DVB-Sub EU / Teletext',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  // Star One D2 70°W / Amazonas 61°W / Intelsat 43.1°W & SES-6 40.5°W (BR & LATAM)
  if (
    key.endsWith('.br') ||
    key.endsWith('.ar') ||
    key.endsWith('.co') ||
    key.endsWith('.cl') ||
    key.endsWith('.mx')
  ) {
    const isSport =
      key.includes('sportv') ||
      key.includes('premiere') ||
      key.includes('espn') ||
      key.includes('band.sports') ||
      key.includes('fox.sports') ||
      key.includes('tnt.sports') ||
      key.includes('tyc.sports') ||
      key.includes('directv.sports') ||
      key.includes('win.sports');
    const isDoc =
      key.includes('discovery') ||
      key.includes('nat.geo') ||
      key.includes('national.geographic') ||
      key.includes('history') ||
      key.includes('animal.planet') ||
      key.includes('curta');
    const isCinemaOrSeries =
      key.includes('telecine') ||
      key.includes('hbo') ||
      key.includes('cinemax') ||
      key.includes('megapix') ||
      key.includes('tnt') ||
      key.includes('space') ||
      key.includes('warner') ||
      key.includes('sony') ||
      key.includes('axn') ||
      key.includes('universal') ||
      key.includes('studio.universal') ||
      key.includes('paramount') ||
      key.includes('amc') ||
      key.includes('star.channel') ||
      key.includes('cinelatino') ||
      key.includes('golden');

    if (!isSport && !isDoc && !isCinemaOrSeries) return null;

    const cleanName = rawId
      .replace(/\.(br|ar|co|cl|mx)$/i, '')
      .replace(/\./g, ' ')
      .trim();
    const isBrazil = key.endsWith('.br');

    return {
      canonicalId: rawId,
      displayName: `${cleanName} (${isBrazil ? 'BR 70°W' : 'LATAM'})`,
      contentCategory: isSport
        ? 'Sport / Football'
        : isDoc
        ? 'Documentaires'
        : 'Films & Séries',
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
      group: isSport
        ? 'Sport / Football'
        : isDoc
        ? 'Documentaires'
        : key.includes('action') || key.includes('space') || key.includes('axn')
        ? 'Action & Thriller'
        : 'Cinéma Premières',
      audioTrackLabel: 'Dual Audio PT/ES + VO EN',
      subtitleTrackLabel: 'Closed Captions / DVB-Sub',
      hasPolishLektor: false,
      hasSubtitles: true,
    };
  }

  return null;
}

export function matchesChannelFilterOptions(
  spec: WhitelistedChannelSpec,
  filterOptions?: EpgParseFilterOptions
): boolean {
  if (!filterOptions) return !spec.hasPolishLektor && spec.hasSubtitles !== false;

  const bouquetId = inferChannelBouquetId(spec);
  if (
    filterOptions.selectedBouquets &&
    filterOptions.selectedBouquets.length > 0
  ) {
    const selected = filterOptions.selectedBouquets;
    const isLatamMatch =
      (spec.country === 'BR' || spec.country === 'LATAM') &&
      (selected.includes('starone_70w_claro_br') ||
        selected.includes('amazonas_61w_latam') ||
        selected.includes('intelsat_43w_directv'));
    if (!selected.includes(bouquetId) && !isLatamMatch) {
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
    spec.contentCategory !== 'Sport / Football'
  ) {
    return false;
  }

  if (
    filterOptions.enabledCategories &&
    filterOptions.enabledCategories.length > 0
  ) {
    const enabled = filterOptions.enabledCategories;
    const cat =
      spec.contentCategory ||
      (spec.group === 'Sport / Football'
        ? 'Sport / Football'
        : spec.group === 'Documentaires'
        ? 'Documentaires'
        : 'Films & Séries');

    let matchedCategory = false;
    if (cat === 'Sport / Football' && enabled.includes('Sport / Football')) {
      matchedCategory = true;
    }
    if (cat === 'Documentaires' && enabled.includes('Documentaires')) {
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
  const key = rawId.trim().toLowerCase();

  const sportSpec = SPORT_FOOTBALL_WHITELIST[key];
  if (sportSpec) {
    const fullSportSpec: WhitelistedChannelSpec = {
      ...sportSpec,
      bouquetId: inferChannelBouquetId(sportSpec),
      hasSubtitles: sportSpec.hasSubtitles ?? true,
    };
    return matchesChannelFilterOptions(fullSportSpec, filterOptions)
      ? fullSportSpec
      : null;
  }

  const cinemaSpec =
    STRICT_CHANNEL_WHITELIST[key] || resolveDynamicGlobalSpec(rawId);
  if (!cinemaSpec) return null;

  const normalizedBouquets = cinemaSpec.bouquets.map(normalizeBouquetName);
  const bouquetId = inferChannelBouquetId(cinemaSpec);
  if (
    bouquetId === 'nilesat_osn_mbc' &&
    !normalizedBouquets.includes('Nilesat OSN/MBC')
  ) {
    normalizedBouquets.push('Nilesat OSN/MBC');
  }

  const fullCinemaSpec: WhitelistedChannelSpec = {
    ...cinemaSpec,
    bouquetId,
    contentCategory:
      cinemaSpec.contentCategory ||
      (cinemaSpec.group === 'Documentaires'
        ? 'Documentaires'
        : 'Films & Séries'),
    satellites: cinemaSpec.satellites.map(normalizeSatelliteName),
    bouquets: normalizedBouquets,
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
  return spec ? spec.canonicalId : null;
}

/**
 * Extrait la valeur d'un attribut dans une balise XML ouvrante
 */
export function extractXmlAttr(tagHeader: string, attrName: string): string {
  const token = `${attrName}="`;
  const startIdx = tagHeader.indexOf(token);
  if (startIdx === -1) return '';
  const valStart = startIdx + token.length;
  const valEnd = tagHeader.indexOf('"', valStart);
  if (valEnd === -1) return '';
  return tagHeader.slice(valStart, valEnd);
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
  const canonicalChannelId = resolveCanonicalChannelId(
    rawChannelId,
    filterOptions
  );
  if (!canonicalChannelId) {
    return { programme: null, startMs: 0, stopMs: 0, channelId: '' };
  }

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
  const rawPrimaryTitle = titles[0] || 'Programme sans titre';
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
  const category = normalizeCategoryLabel(rawCategory, rawPrimaryTitle);
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
