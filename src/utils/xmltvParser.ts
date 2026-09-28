import {
  BouquetFilter,
  ChannelGroup,
  CountryCode,
  EpgChannel,
  EpgProgramme,
  SatelliteFilter,
} from '../types/epg';
import {
  SPORT_FOOTBALL_WHITELIST,
  translateEpgTextToFrenchSync,
  WhitelistedChannelSpec,
} from './sportChannelsWhitelist';

export type { WhitelistedChannelSpec };

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
    return 'Thriller & Policier';
  }
  if (
    lower.includes('sci-fi') ||
    lower.includes('science') ||
    lower.includes('fantasty') ||
    lower.includes('fantasy') ||
    lower.includes('ciencia ficción') ||
    lower.includes('fantascienza')
  ) {
    return 'Sci-Fi & Fantastique';
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
    return 'Action & Aventure';
  }
  if (
    lower.includes('horror') ||
    lower.includes('grozy') ||
    lower.includes('terror')
  ) {
    return 'Horreur & Frissons';
  }
  if (
    lower.includes('komedi') ||
    lower.includes('comedia') ||
    lower.includes('commedia') ||
    lower.includes('komödie') ||
    lower.includes('comedy') ||
    lower.includes('sitcom')
  ) {
    return 'Comédie';
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
    return 'Drame & Romance';
  }
  if (
    lower.includes('serial') ||
    lower.includes('serie') ||
    lower.includes('series')
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
  country: Exclude<CountryCode, 'Tous'>;
  satellites: string[];
  orbitalPosition: string;
  bouquets: string[];
  group: Exclude<ChannelGroup, 'Tous'>;
  audioTrackLabel: string;
  subtitleTrackLabel: string;
  lektorStatus?: string;
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
    group: 'Cinéma Premières',
    audioTrackLabel: 'VO Anglais 100%',
    subtitleTrackLabel: 'Subtitles DVB / Open Sub',
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

/**
 * Résout l'identifiant canonique d'une chaîne si et seulement si elle figure
 * dans la liste blanche stricte (Films/Séries VO+Sub Sans Lektor OU Sport/Football Grands Championnats).
 */
export function resolveWhitelistedChannelSpec(
  rawId: string
): WhitelistedChannelSpec | null {
  if (!rawId) return null;
  const key = rawId.trim().toLowerCase();

  const sportSpec = SPORT_FOOTBALL_WHITELIST[key];
  if (sportSpec) {
    return sportSpec;
  }

  const cinemaSpec = STRICT_CHANNEL_WHITELIST[key];
  if (!cinemaSpec) return null;

  return {
    ...cinemaSpec,
    contentCategory: 'Films & Séries',
    satellites: cinemaSpec.satellites.map(normalizeSatelliteName),
    bouquets: cinemaSpec.bouquets.map(normalizeBouquetName),
  };
}

export function resolveCanonicalChannelId(rawId: string): string | null {
  const spec = resolveWhitelistedChannelSpec(rawId);
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
  }
): EpgChannel | null {
  const headerEnd = block.indexOf('>');
  if (headerEnd === -1) return null;

  const header = block.slice(0, headerEnd);
  const rawId = decodeXmlEntities(extractXmlAttr(header, 'id'));
  if (!rawId) return null;

  // Vérification dans la Whitelist stricte Cinéma/Séries + VO + Sous-titres
  const spec = resolveWhitelistedChannelSpec(rawId);
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
        : 'Films & Séries'),
    group: spec.group,
    country: spec.country,
    satellites: spec.satellites,
    orbitalPosition: spec.orbitalPosition,
    bouquets: spec.bouquets,
    audioTrackLabel: spec.audioTrackLabel,
    subtitleTrackLabel: spec.subtitleTrackLabel,
    lektorStatus: spec.lektorStatus,
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
  block: string
): boolean {
  const lowerTitle = title.toLowerCase();
  const lowerCat = rawCategory.toLowerCase();

  // Exclure le télé-achat, les journaux télévisés ou le sport pur s'il en apparaît en inter-programme
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

  // Si un bloc XML mentionne explicitement un doublage Lektor sans sous-titres
  if (
    block.includes('lektor') &&
    (block.includes('brak napisów') || block.includes('tylko lektor'))
  ) {
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
  maxKeepStartMs?: number
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

  // Filtrage O(1) : ignorer immédiatement tout programme d'une chaîne hors Whitelist
  const canonicalChannelId = resolveCanonicalChannelId(rawChannelId);
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

  if (isExcludedProgrammeContent(rawPrimaryTitle, rawCategory, block)) {
    return { programme: null, startMs, stopMs, channelId: canonicalChannelId };
  }

  const rawSubTitle = extractXmlTagContent(block, 'sub-title') || undefined;
  const subTitle = rawSubTitle
    ? translateEpgTextToFrenchSync(rawSubTitle)
    : undefined;
  const description = extractXmlTagContent(block, 'desc') || undefined;
  const category = normalizeCategoryLabel(rawCategory, rawPrimaryTitle);
  const date = extractXmlTagContent(block, 'date') || undefined;
  const episodeNum = extractXmlTagContent(block, 'episode-num') || undefined;

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
      episodeNum,
      directors,
      actors,
      hasOriginalAudioVO: true,
      hasSubtitles: true,
    },
  };
}
