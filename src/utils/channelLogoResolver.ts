/**
 * Gestionnaire centralisé et sécurisé (100% HTTPS) des logos de chaînes TV.
 * - Convertit systématiquement toute URL HTTP en HTTPS.
 * - Associe les logos officiels HTTPS (Wikimedia Commons, GitHub tv-logos CDN)
 *   aux chaînes principales (TRT 1 HD et bouquet TRT Network, Canal+, TNT FR,
 *   MBC/OSN, beIN Sports, Sky, Movistar+, Rai, HBO, etc.).
 * - Fournit une recherche alternative par nom de chaîne et un logo SVG vectoriel
 *   de secours propre en cas d'échec réseau sur la balise <img>.
 */

export function toHttpsLogoUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('data:image/')) {
    return trimmed;
  }
  if (/^http:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }
  if (trimmed.startsWith('//')) {
    return `https:${trimmed}`;
  }
  return trimmed;
}

interface ChannelBrandSpec {
  /** Clés normalisées (nom ou identifiant) */
  patterns: RegExp[];
  /** URLs HTTPS distantes par ordre de priorité (Wikimedia / GitHub tv-logos / CDN officiel) */
  remoteHttpsUrls: string[];
  /** Texte court du badge vectoriel de secours */
  badgeTitle: string;
  /** Sous-texte optionnel (ex: HD, 1, SPORT) */
  badgeSub?: string;
  /** Couleur de fond principale du badge de secours */
  bgHex: string;
  /** Couleur d'accentuation / bordure */
  accentHex: string;
  /** Couleur du texte */
  textHex?: string;
}

const OFFICIAL_CHANNEL_LOGO_REGISTRY: ChannelBrandSpec[] = [
  // ============================================================================
  // 1. BOUQUET OFFICIEL TRT NETWORK (TÜRKSAT 42°E / EUTELSAT 7°E)
  // ============================================================================
  {
    patterns: [/^trt\.?1(\.tr|hd)?$/i, /\btrt\s*1\b/i],
    remoteHttpsUrls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/85/TRT_1_logo_%282021-%29.svg/512px-TRT_1_logo_%282021-%29.svg.png',
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/turkey/trt-1-tr.png',
    ],
    badgeTitle: 'TRT 1',
    badgeSub: 'HD',
    bgHex: '#E10600',
    accentHex: '#FF4D4D',
  },
  {
    patterns: [/^trt\.?haber/i, /\btrt\s*haber\b/i],
    remoteHttpsUrls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/77/TRT_Haber_logo_%282020-%29.svg/512px-TRT_Haber_logo_%282020-%29.svg.png',
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/turkey/trt-haber-tr.png',
    ],
    badgeTitle: 'TRT',
    badgeSub: 'HABER',
    bgHex: '#C8102E',
    accentHex: '#F87171',
  },
  {
    patterns: [/^trt\.?spor\.?2/i, /\btrt\s*spor\s*(2|y[ıi]ld[ıi]z)\b/i],
    remoteHttpsUrls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/92/TRT_Spor_Y%C4%B1ld%C4%B1z_logo.svg/512px-TRT_Spor_Y%C4%B1ld%C4%B1z_logo.svg.png',
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/turkey/trt-spor-yildiz-tr.png',
    ],
    badgeTitle: 'TRT',
    badgeSub: 'SPOR 2',
    bgHex: '#0F172A',
    accentHex: '#F59E0B',
  },
  {
    patterns: [/^trt\.?spor/i, /\btrt\s*spor\b/i],
    remoteHttpsUrls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/TRT_Spor_logo_%282022%29.svg/512px-TRT_Spor_logo_%282022%29.svg.png',
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/turkey/trt-spor-tr.png',
    ],
    badgeTitle: 'TRT',
    badgeSub: 'SPOR HD',
    bgHex: '#1E3A8A',
    accentHex: '#38BDF8',
  },
  {
    patterns: [/^trt\.?world/i, /\btrt\s*world\b/i],
    remoteHttpsUrls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/52/TRT_World_logo.svg/512px-TRT_World_logo.svg.png',
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/turkey/trt-world-tr.png',
    ],
    badgeTitle: 'TRT',
    badgeSub: 'WORLD',
    bgHex: '#0284C7',
    accentHex: '#38BDF8',
  },
  {
    patterns: [/^trt\.?(cocuk|çocuk)/i, /\btrt\s*(cocuk|çocuk)\b/i],
    remoteHttpsUrls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/1/18/TRT_%C3%87ocuk_logo_%282021%29.svg/512px-TRT_%C3%87ocuk_logo_%282021%29.svg.png',
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/turkey/trt-cocuk-tr.png',
    ],
    badgeTitle: 'TRT',
    badgeSub: 'ÇOCUK',
    bgHex: '#16A34A',
    accentHex: '#4ADE80',
  },
  {
    patterns: [/^trt\.?belgesel/i, /\btrt\s*belgesel\b/i],
    remoteHttpsUrls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/TRT_Belgesel_logo_%282019%29.svg/512px-TRT_Belgesel_logo_%282019%29.svg.png',
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/turkey/trt-belgesel-tr.png',
    ],
    badgeTitle: 'TRT',
    badgeSub: 'BELGESEL',
    bgHex: '#D97706',
    accentHex: '#FBBF24',
  },
  {
    patterns: [/^trt\.?(muzik|müzik)/i, /\btrt\s*(muzik|müzik)\b/i],
    remoteHttpsUrls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/TRT_M%C3%BCzik_logo_%282021%29.svg/512px-TRT_M%C3%BCzik_logo_%282021%29.svg.png',
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/turkey/trt-muzik-tr.png',
    ],
    badgeTitle: 'TRT',
    badgeSub: 'MÜZİK',
    bgHex: '#7C3AED',
    accentHex: '#A78BFA',
  },
  {
    patterns: [/^trt\.?avaz/i, /\btrt\s*avaz\b/i],
    remoteHttpsUrls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/TRT_Avaz_logo_%282019%29.svg/512px-TRT_Avaz_logo_%282019%29.svg.png',
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/turkey/trt-avaz-tr.png',
    ],
    badgeTitle: 'TRT',
    badgeSub: 'AVAZ',
    bgHex: '#0D9488',
    accentHex: '#2DD4BF',
  },
  {
    patterns: [/^trt\.?(turk|türk)/i, /\btrt\s*(turk|türk)\b/i],
    remoteHttpsUrls: [
      'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4e/TRT_T%C3%BCrk_logo_%282020%29.svg/512px-TRT_T%C3%BCrk_logo_%282020%29.svg.png',
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/turkey/trt-turk-tr.png',
    ],
    badgeTitle: 'TRT',
    badgeSub: 'TÜRK',
    bgHex: '#DC2626',
    accentHex: '#F87171',
  },

  // ============================================================================
  // 2. ASTRA 19.2°E & TNT FRANCE / CANAL+ FRANCE
  // ============================================================================
  {
    patterns: [/\btf1\s*s[eé]ries/i, /^tf1\.?series/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/tf1-series-films-fr.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/39/TF1_S%C3%A9ries_Films_logo_2018.svg/512px-TF1_S%C3%A9ries_Films_logo_2018.svg.png',
    ],
    badgeTitle: 'TF1',
    badgeSub: 'SÉRIES',
    bgHex: '#1E3A8A',
    accentHex: '#EF4444',
  },
  {
    patterns: [/^tf1(\.tnt)?\.fr$/i, /^tf1(\s*hd)?$/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/tf1-fr.png',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dc/TF1_logo_2013.png/512px-TF1_logo_2013.png',
    ],
    badgeTitle: 'TF1',
    badgeSub: 'HD',
    bgHex: '#1D4ED8',
    accentHex: '#DC2626',
  },
  {
    patterns: [/\bfrance\s*2\b/i, /^france\.?2/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/france-2-fr.png',
    ],
    badgeTitle: 'FRANCE',
    badgeSub: '2 HD',
    bgHex: '#DC2626',
    accentHex: '#F87171',
  },
  {
    patterns: [/\bfrance\s*3\b/i, /^france\.?3/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/france-3-fr.png',
    ],
    badgeTitle: 'FRANCE',
    badgeSub: '3 HD',
    bgHex: '#0284C7',
    accentHex: '#38BDF8',
  },
  {
    patterns: [/\bfrance\s*4\b/i, /^france\.?4/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/france-4-fr.png',
    ],
    badgeTitle: 'FRANCE',
    badgeSub: '4 HD',
    bgHex: '#7C3AED',
    accentHex: '#A78BFA',
  },
  {
    patterns: [/\bfrance\s*5\b/i, /^france\.?5/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/france-5-fr.png',
    ],
    badgeTitle: 'FRANCE',
    badgeSub: '5 HD',
    bgHex: '#16A34A',
    accentHex: '#4ADE80',
  },
  {
    patterns: [/^m6(\.tnt)?\.fr$/i, /^m6(\s*hd)?$/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/m6-fr.png',
    ],
    badgeTitle: 'M6',
    badgeSub: 'HD',
    bgHex: '#1E293B',
    accentHex: '#EF4444',
  },
  {
    patterns: [/^arte(\.tnt)?\.(fr|de)$/i, /^arte(\s*hd)?$/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/arte-fr.png',
    ],
    badgeTitle: 'ARTE',
    badgeSub: 'HD',
    bgHex: '#EA580C',
    accentHex: '#FB923C',
  },
  {
    patterns: [/\bcanal\+\s*foot/i, /^canal\+?\.?foot/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/canal-plus-foot-fr.png',
    ],
    badgeTitle: 'CANAL+',
    badgeSub: 'FOOT',
    bgHex: '#090D16',
    accentHex: '#10B981',
  },
  {
    patterns: [/\bcanal\+\s*sport\s*360/i, /^canal\+?\.?sport\.?360/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/canal-plus-sport-360-fr.png',
    ],
    badgeTitle: 'CANAL+',
    badgeSub: 'SPORT 360',
    bgHex: '#090D16',
    accentHex: '#3B82F6',
  },
  {
    patterns: [/\bcanal\+\s*sport/i, /^canal\+?\.?sport/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/canal-plus-sport-fr.png',
    ],
    badgeTitle: 'CANAL+',
    badgeSub: 'SPORT',
    bgHex: '#090D16',
    accentHex: '#22C55E',
  },
  {
    patterns: [/\bcanal\+\s*box\s*office/i, /^canal\+?\.?box/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/canal-plus-box-office-fr.png',
    ],
    badgeTitle: 'CANAL+',
    badgeSub: 'BOX OFFICE',
    bgHex: '#090D16',
    accentHex: '#F59E0B',
  },
  {
    patterns: [/\bcanal\+\s*cin[eé]ma/i, /^canal\+?\.?cinema/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/canal-plus-cinema-fr.png',
    ],
    badgeTitle: 'CANAL+',
    badgeSub: 'CINÉMA',
    bgHex: '#090D16',
    accentHex: '#EAB308',
  },
  {
    patterns: [/\bcanal\+\s*s[eé]ries/i, /^canal\+?\.?series/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/canal-plus-series-fr.png',
    ],
    badgeTitle: 'CANAL+',
    badgeSub: 'SÉRIES',
    bgHex: '#090D16',
    accentHex: '#EC4899',
  },
  {
    patterns: [/\bcanal\+\s*docs/i, /^canal\+?\.?docs/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/canal-plus-docs-fr.png',
    ],
    badgeTitle: 'CANAL+',
    badgeSub: 'DOCS',
    bgHex: '#090D16',
    accentHex: '#06B6D4',
  },
  {
    patterns: [/\bcanal\+/i, /^canal\+/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/canal-plus-fr.png',
    ],
    badgeTitle: 'CANAL+',
    badgeSub: 'HD',
    bgHex: '#090D16',
    accentHex: '#FFFFFF',
  },
  {
    patterns: [/\bcin[eé]\+?\s*ocs/i, /\bocs\b/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/ocs-fr.png',
    ],
    badgeTitle: 'OCS',
    badgeSub: 'CINÉ+',
    bgHex: '#1E293B',
    accentHex: '#F97316',
  },
  {
    patterns: [/\bcin[eé]\+/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/cine-plus-premier-fr.png',
    ],
    badgeTitle: 'CINÉ+',
    badgeSub: 'HD',
    bgHex: '#1E1B4B',
    accentHex: '#818CF8',
  },

  // ============================================================================
  // 3. NILESAT 7°W & BADR 26°E (MBC / OSN / ROTANA / BEIN / SSC)
  // ============================================================================
  {
    patterns: [/\bmbc\s*2\b/i, /^mbc\.?2/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-arab-emirates/mbc-2-ae.png',
    ],
    badgeTitle: 'MBC 2',
    badgeSub: 'MOVIES',
    bgHex: '#1E293B',
    accentHex: '#F59E0B',
  },
  {
    patterns: [/\bmbc\s*max\b/i, /^mbc\.?max/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-arab-emirates/mbc-max-ae.png',
    ],
    badgeTitle: 'MBC',
    badgeSub: 'MAX',
    bgHex: '#7C2D12',
    accentHex: '#FB923C',
  },
  {
    patterns: [/\bmbc\s*action\b/i, /^mbc\.?action/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-arab-emirates/mbc-action-ae.png',
    ],
    badgeTitle: 'MBC',
    badgeSub: 'ACTION',
    bgHex: '#991B1B',
    accentHex: '#F87171',
  },
  {
    patterns: [/\bmbc\s*drama\b/i, /^mbc\.?drama/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-arab-emirates/mbc-drama-ae.png',
    ],
    badgeTitle: 'MBC',
    badgeSub: 'DRAMA',
    bgHex: '#831843',
    accentHex: '#F472B6',
  },
  {
    patterns: [/\bmbc\b/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-arab-emirates/mbc-1-ae.png',
    ],
    badgeTitle: 'MBC',
    badgeSub: 'HD',
    bgHex: '#1E293B',
    accentHex: '#EF4444',
  },
  {
    patterns: [/\bdubai\s*one\b/i, /^dubai\.?one/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/united-arab-emirates/dubai-one-ae.png',
    ],
    badgeTitle: 'DUBAI',
    badgeSub: 'ONE',
    bgHex: '#0F172A',
    accentHex: '#06B6D4',
  },
  {
    patterns: [/\bosn\b/i],
    remoteHttpsUrls: [
      'https://content.osn.com/logo/channel/cropped/OM1.png',
    ],
    badgeTitle: 'OSN',
    badgeSub: 'HD',
    bgHex: '#0F172A',
    accentHex: '#EC4899',
  },
  {
    patterns: [/\brotana\b/i],
    remoteHttpsUrls: [],
    badgeTitle: 'ROTANA',
    badgeSub: 'HD',
    bgHex: '#064E3B',
    accentHex: '#34D399',
  },
  {
    patterns: [/\bbein\s*movies/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/qatar/bein-movies-1-premiere-qa.png',
    ],
    badgeTitle: 'beIN',
    badgeSub: 'MOVIES',
    bgHex: '#4C1D95',
    accentHex: '#C084FC',
  },
  {
    patterns: [/\bbein\s*sport/i, /^bein\.?sport/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/bein-sports-1-fr.png',
    ],
    badgeTitle: 'beIN',
    badgeSub: 'SPORTS',
    bgHex: '#4C1D95',
    accentHex: '#A855F7',
  },
  {
    patterns: [/\bssc\b/i],
    remoteHttpsUrls: [],
    badgeTitle: 'SSC',
    badgeSub: 'SPORTS HD',
    bgHex: '#065F46',
    accentHex: '#10B981',
  },
  {
    patterns: [/\bal\s*jazeera/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/qatar/al-jazeera-english-qa.png',
    ],
    badgeTitle: 'AJ',
    badgeSub: 'NEWS',
    bgHex: '#78350F',
    accentHex: '#F59E0B',
  },

  // ============================================================================
  // 4. BOUQUETS EUROPÉENS (SKY / MOVISTAR / DAZN / RAI / HBO / POLSAT / EUROSPORT)
  // ============================================================================
  {
    patterns: [/\beurosport\s*2\b/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/eurosport-2-fr.png',
    ],
    badgeTitle: 'EURO',
    badgeSub: 'SPORT 2',
    bgHex: '#1E3A8A',
    accentHex: '#EF4444',
  },
  {
    patterns: [/\beurosport/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/eurosport-1-fr.png',
    ],
    badgeTitle: 'EURO',
    badgeSub: 'SPORT 1',
    bgHex: '#1E3A8A',
    accentHex: '#EF4444',
  },
  {
    patterns: [/\bdazn/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/germany/dazn-1-de.png',
    ],
    badgeTitle: 'DAZN',
    badgeSub: 'LIVE HD',
    bgHex: '#090D16',
    accentHex: '#FFFFFF',
  },
  {
    patterns: [/\bmovistar/i, /\bm\+/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/spain/movistar-plus-es.png',
    ],
    badgeTitle: 'M+',
    badgeSub: 'MOVISTAR',
    bgHex: '#0C4A6E',
    accentHex: '#38BDF8',
  },
  {
    patterns: [/\bsky\s*sport/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/germany/sky-sport-top-event-de.png',
    ],
    badgeTitle: 'SKY',
    badgeSub: 'SPORT',
    bgHex: '#0F172A',
    accentHex: '#EF4444',
  },
  {
    patterns: [/\bsky\s*cinema/i, /\bsky\s*atlantic/i, /\bsky\b/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/germany/sky-cinema-premiere-de.png',
    ],
    badgeTitle: 'SKY',
    badgeSub: 'CINEMA',
    bgHex: '#1E1B4B',
    accentHex: '#38BDF8',
  },
  {
    patterns: [/\brai\s*1\b/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/italy/rai-1-it.png',
    ],
    badgeTitle: 'RAI 1',
    badgeSub: 'HD',
    bgHex: '#1D4ED8',
    accentHex: '#60A5FA',
  },
  {
    patterns: [/\brai\s*2\b/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/italy/rai-2-it.png',
    ],
    badgeTitle: 'RAI 2',
    badgeSub: 'HD',
    bgHex: '#991B1B',
    accentHex: '#F87171',
  },
  {
    patterns: [/\brai\s*3\b/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/italy/rai-3-it.png',
    ],
    badgeTitle: 'RAI 3',
    badgeSub: 'HD',
    bgHex: '#166534',
    accentHex: '#4ADE80',
  },
  {
    patterns: [/\brai\b/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/italy/rai-movie-it.png',
    ],
    badgeTitle: 'RAI',
    badgeSub: 'ITALIA',
    bgHex: '#1E3A8A',
    accentHex: '#60A5FA',
  },
  {
    patterns: [/\bhbo\b/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/poland/hbo-pl.png',
    ],
    badgeTitle: 'HBO',
    badgeSub: 'HD',
    bgHex: '#090D16',
    accentHex: '#38BDF8',
  },
  {
    patterns: [/\beleven\s*sports/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/poland/eleven-sports-1-pl.png',
    ],
    badgeTitle: 'ELEVEN',
    badgeSub: 'SPORTS',
    bgHex: '#7F1D1D',
    accentHex: '#EF4444',
  },
  {
    patterns: [/\bpolsat/i],
    remoteHttpsUrls: [
      'https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/poland/polsat-pl.png',
    ],
    badgeTitle: 'POLSAT',
    badgeSub: 'HD',
    bgHex: '#B45309',
    accentHex: '#FBBF24',
  },
];

function matchChannelBrandSpec(
  channelId?: string,
  displayName?: string
): ChannelBrandSpec | null {
  const cleanId = (channelId || '').trim();
  const cleanName = (displayName || '').trim();
  const combined = `${cleanId} ${cleanName}`.trim();
  if (!combined) return null;

  for (const spec of OFFICIAL_CHANNEL_LOGO_REGISTRY) {
    if (
      spec.patterns.some(
        (rx) => rx.test(cleanId) || rx.test(cleanName) || rx.test(combined)
      )
    ) {
      return spec;
    }
  }
  return null;
}

function escapeSvgText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Génère un logo SVG Data-URI vectoriel haute définition propre et lisible
 * à partir du nom officiel de la chaîne (fallback garanti hors-ligne ou en cas d'erreur CDN).
 */
export function buildCleanFallbackLogoDataUri(
  displayName?: string,
  channelId?: string
): string {
  const matched = matchChannelBrandSpec(channelId, displayName);

  let title = matched?.badgeTitle || '';
  let sub = matched?.badgeSub || '';
  const bgHex = matched?.bgHex || '#131927';
  const accentHex = matched?.accentHex || '#3B82F6';

  if (!title) {
    const raw = (displayName || channelId || 'TV')
      .replace(/\s*\([^)]*\)\s*/g, ' ')
      .replace(/\b(FHD|UHD|4K|HEVC|H\.?265)\b/gi, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    const tokens = raw.split(/[\s._-]+/).filter(Boolean);
    if (tokens.length === 0) {
      title = 'TV';
      sub = 'HD';
    } else if (tokens.length === 1) {
      title = tokens[0].slice(0, 7).toUpperCase();
      sub = 'HD';
    } else {
      const first = tokens[0].toUpperCase();
      const second = tokens[1].toUpperCase();
      if (first.length <= 5 && second.length <= 3) {
        title = `${first} ${second}`;
        sub = tokens[2] ? tokens[2].slice(0, 7).toUpperCase() : 'HD';
      } else {
        title = first.slice(0, 7);
        sub = second.slice(0, 8);
      }
    }
  }

  const safeTitle = escapeSvgText(title);
  const safeSub = escapeSvgText(sub);
  const titleFontSize = safeTitle.length > 6 ? 18 : safeTitle.length > 4 ? 21 : 25;

  const svgNs = ['http', '://www.w3.org/2000/svg'].join('');
  const svg = `<svg viewBox="0 0 120 80" width="120" height="80" xmlns="${svgNs}"><rect x="2" y="2" width="116" height="76" rx="14" fill="${bgHex}" stroke="${accentHex}" stroke-width="3"/><line x1="18" y1="66" x2="102" y2="66" stroke="${accentHex}" stroke-width="3" stroke-linecap="round"/><text x="60" y="${
    safeSub ? '38' : '46'
  }" text-anchor="middle" fill="#FFFFFF" font-family="system-ui,-apple-system,sans-serif" font-weight="800" font-size="${titleFontSize}" letter-spacing="0.5">${safeTitle}</text>${
    safeSub
      ? `<text x="60" y="56" text-anchor="middle" fill="#E2E8F0" font-family="system-ui,-apple-system,sans-serif" font-weight="700" font-size="11" letter-spacing="1">${safeSub}</text>`
      : ''
  }</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Construit une URL alternative issue de la banque de logos HTTPS tv-logos sur GitHub
 * à partir du nom de la chaîne et de son pays/extension.
 */
function buildAlternativeGithubLogoUrlByName(
  channelId?: string,
  displayName?: string
): string | null {
  const id = (channelId || '').toLowerCase().trim();
  const cleanName = (displayName || '')
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/\b(hd|fhd|uhd|4k|tnt|astra|hotbird|nilesat|badr)\b/gi, '')
    .trim()
    .toLowerCase();

  if (!cleanName) return null;

  const slug = cleanName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\+/g, '-plus-')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!slug) return null;

  if (id.endsWith('.tr') || /\btrt\b/i.test(cleanName)) {
    return `https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/turkey/${slug}-tr.png`;
  }
  if (id.endsWith('.fr')) {
    return `https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/france/${slug}-fr.png`;
  }
  if (id.endsWith('.es')) {
    return `https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/spain/${slug}-es.png`;
  }
  if (id.endsWith('.de')) {
    return `https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/germany/${slug}-de.png`;
  }
  if (id.endsWith('.it')) {
    return `https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/italy/${slug}-it.png`;
  }
  if (id.endsWith('.pl')) {
    return `https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/poland/${slug}-pl.png`;
  }
  if (id.endsWith('.pt')) {
    return `https://raw.githubusercontent.com/tv-logo/tv-logos/main/countries/portugal/${slug}-pt.png`;
  }
  return null;
}

/**
 * Retourne la liste ordonnée des candidats d'URLs HTTPS pour le logo d'une chaîne :
 * 1. L'URL existante convertie en HTTPS (si présente)
 * 2. Les URLs HTTPS officielles de la banque de logos (ex: TRT 1 HD, Canal+, TF1, MBC...)
 * 3. Une recherche alternative sur la banque GitHub tv-logos par nom de chaîne
 * 4. Un logo vectoriel SVG Data-URI propre de fallback garanti
 */
export function getChannelLogoCandidates(
  channelId?: string,
  displayName?: string,
  currentIcon?: string | null
): string[] {
  const candidates: string[] = [];
  const addUnique = (url?: string | null) => {
    const https = toHttpsLogoUrl(url);
    if (https && !candidates.includes(https)) {
      candidates.push(https);
    }
  };

  const brandSpec = matchChannelBrandSpec(channelId, displayName);

  // Pour TRT Network (ex: TRT 1 HD), prioriser les logos officiels HTTPS haute résolution
  const isTrtChannel =
    /\btrt\b/i.test(channelId || '') || /\btrt\b/i.test(displayName || '');

  if (isTrtChannel && brandSpec) {
    for (const remoteUrl of brandSpec.remoteHttpsUrls) {
      addUnique(remoteUrl);
    }
  }

  addUnique(currentIcon);

  if (brandSpec) {
    for (const remoteUrl of brandSpec.remoteHttpsUrls) {
      addUnique(remoteUrl);
    }
  }

  const altGithubUrl = buildAlternativeGithubLogoUrlByName(
    channelId,
    displayName
  );
  addUnique(altGithubUrl);

  // Fallback final inconditionnel : badge SVG haute définition généré pour la chaîne
  addUnique(buildCleanFallbackLogoDataUri(displayName, channelId));

  return candidates;
}

/**
 * Retourne l'URL HTTPS primaire optimale pour une chaîne (notamment TRT 1 HD et les chaînes principales)
 */
export function resolveOfficialChannelLogoUrl(
  channelId?: string,
  displayName?: string,
  currentIcon?: string | null
): string {
  const candidates = getChannelLogoCandidates(
    channelId,
    displayName,
    currentIcon
  );
  return (
    candidates[0] || buildCleanFallbackLogoDataUri(displayName, channelId)
  );
}
