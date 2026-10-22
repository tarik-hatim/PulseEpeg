/**
 * Moteur de détection sportive multilingue, filtrage de compétitions,
 * gestion des équipes favorites et résumés vidéo officiels.
 * Importé et amélioré depuis satellite-stream-buddy pour PulseEPG.
 */

export const PREFIX =
  /^\s*(?:live|en direct|direct|directo|en vivo|ao vivo|live:|canlı|مباشر|بث مباشر|القمة)\s*[:\-–|]?\s*/i;

// Séparateur strict de match de sport : vs, v., versus, contre, gegen, contra, et équivalents arabes réels (ضد, أمام, مقابل)
// EXCLUSIONS STRICTES :
// - JAMAIS "مع" (qui signifie "avec" en arabe, générant de faux matchs pour les interviews et émissions !)
// - JAMAIS "x" ou "×" seul (qui matche les animes comme "Hunter x Hunter", les formats 10x10, etc.)
// - JAMAIS les tirets seuls (-, –, —) qui séparent titres et sous-titres
export const SEP = /\s+(?:vs\.?|\bv\.\b|versus|contre|gegen|contra|ضد|أمام|مقابل)\s+/i;

export const REPLAY =
  /\b(?:rediffusion|rediff\w*|replay|rerun|re-run|retransmission|différé|relive|re-live|recorded|resume|résumé|highlights?|best of|magazine|mag|repeticion|resumen|melhores momentos|tekrar|ozet|özet|wiederholung|zusammenfassung|classic match|classic|archive|retro|podcast|talk|doku|documentary|documentaire|resumo|preview|avant-match|pre-?game|studio|sezon|season|analyse|talk|debrief|ozeti|zapping|revue|entretien)\b|إعادة|اعادة|ملخص|أرشيف|سهرة|حوار|استوديو|تسجيل|مسجل/i;

export const NON_MATCH_TERMS =
  /\b(?:film|movie|serie|série|episode|épisode|saison|season|journal|news|mag|magazine|doku|docu|documentaire|reportage|edition|édition|show|emission|émission|part|parte|fallout|dead reckoning|skyfall|vo\+sub|inédit|direct 24|talk|chronique|special|spécial|multiplex|top gun|mission impossible|dune|the rookie|chicago fire|law & order|fbi|csi|montre|contre-la-montre|seul contre|tous contre|batman|superman|godzilla|kong|hunter|anime|manga|débat|face-à-face|face à face|justice|tribunal|crime|police|guerre|politique|invité|entretien|interview|conférence|zapping|revue|debrief|soir de|jour de foot|club|studio|avant-match|pre-?game|replay|rediff|clash)\b/i;

export const LIVE_INDICATOR_REGEX =
  /\b(?:live|en direct|direct|directo|en vivo|ao vivo|canlı|مباشر|بث مباشر)\b/i;

/** Détecte si un titre ou description possède une mention explicite de diffusion en DIRECT */
export function isExplicitlyLive(title: string, description = '', category = ''): boolean {
  if (isReplay(title) || (description && isReplay(description))) return false;
  return (
    PREFIX.test(title) ||
    LIVE_INDICATOR_REGEX.test(title) ||
    (description ? LIVE_INDICATOR_REGEX.test(description) : false) ||
    /\b(?:live|direct|en direct|directo|en vivo)\b/i.test(category)
  );
}

/** Détection stricte d'un indicateur de direct DANS LE TITRE ou description (exclut les catégories génériques de chaînes) */
export function isExplicitlyLiveTitle(title: string, description = ''): boolean {
  if (isReplay(title) || (description && isReplay(description))) return false;
  return (
    PREFIX.test(title) ||
    LIVE_INDICATOR_REGEX.test(title) ||
    (description ? LIVE_INDICATOR_REGEX.test(description) : false)
  );
}

export const norm = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/\b(fc|cf|sc|ac|afc|cd|club|as|rc|us|ogc|rb)\b/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

export interface MatchInfo {
  home: string;
  away: string;
  rawHome: string;
  rawAway: string;
}

/** Retourne les deux équipes si le titre correspond à une véritable affiche de sport */
export function parseMatch(title: string): MatchInfo | null {
  if (isReplay(title)) return null;

  // Rejeter d'emblée les expressions françaises courantes contenant "contre"
  if (
    /contre[\s-]la[\s-]montre|seul[\s-]contre[\s-]tous|tous[\s-]contre[\s-]un|lutte[\s-]contre|combat[\s-]contre|bataille[\s-]contre|guerre[\s-]contre|face[\s-]contre/i.test(
      title
    )
  ) {
    return null;
  }

  const clean = title
    .replace(PREFIX, '')
    .replace(/\s+(?:hlts?|hls|highlights|live|en direct|directo)\s*$/i, '');

  const segs = clean
    .split(/\s*[:|]\s*/)
    .filter((x) => SEP.test(` ${x} `.replace(/^ | $/g, ' ')) || SEP.test(x));
  const seg = (segs.length ? segs[segs.length - 1]! : clean).replace(/^.*?\bmecz\b\s*/i, '');
  const parts = seg.split(SEP);
  if (parts.length !== 2) return null;

  const rawHome = parts[0].trim();
  const rawAway = parts[1].trim();

  if (NON_MATCH_TERMS.test(rawHome) || NON_MATCH_TERMS.test(rawAway)) return null;

  const home = norm(rawHome);
  const away = norm(rawAway);

  // Filtrer les noms trop courts, trop longs ou expressions invalides
  if (!home || !away || home.length < 2 || away.length < 2 || home.length > 40 || away.length > 40) {
    return null;
  }

  // Élimination des faux positifs de noms d'équipes (termes génériques qui ne sont pas des clubs/équipes)
  const invalidTeamWords =
    /^(la montre|le montre|tous|personne|tout le monde|justice|crime|police|guerre|info|meteo|temps|nature|france 2|france 3|tf1|m6|canal\+|invit[eé]|monde|actu|soir)$/i;
  if (invalidTeamWords.test(home) || invalidTeamWords.test(away)) {
    return null;
  }

  return { home, away, rawHome, rawAway };
}

export const isReplay = (title: string): boolean =>
  REPLAY.test(title) || REPLAY.test(title.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

/** Clé de regroupement : même match sur différentes chaînes (tolérance ±30 min) */
export function eventKey(title: string, startMs: number): string {
  const m = parseMatch(title);
  const bucket = Math.round(startMs / 3_600_000);
  if (m) return `m:${[m.home, m.away].sort().join('|')}|${bucket}`;
  return `t:${norm(title.replace(PREFIX, ''))}|${Math.round(startMs / 900_000)}`;
}

/** Détection automatique de la compétition sportive */
export interface CompetitionDef {
  id: string;
  label: string;
  regex: RegExp;
  sport: string;
}

export const POPULAR_COMPETITIONS: CompetitionDef[] = [
  { id: 'ucl', label: 'Ligue des Champions UEFA', regex: /champions league|uefa champions|\bucl\b|ligue des champions|liga de campeones/i, sport: 'Football' },
  { id: 'afc', label: "Ligue des Champions d'Asie (AFC)", regex: /afc champions|\bafc\b|acl elite|champions league asia|دوري أبطال آسيا/i, sport: 'Football' },
  { id: 'botola', label: 'Botola Pro Inwi', regex: /botola|maroc pro|البطولة الاحترافية/i, sport: 'Football' },
  { id: 'eng2', label: 'Championship (Angleterre)', regex: /championship|efl championship/i, sport: 'Football' },
  { id: 'mls', label: 'Major League Soccer (MLS)', regex: /\bmls\b|major league soccer/i, sport: 'Football' },
  { id: 'pl', label: 'Premier League', regex: /premier league|\bepl\b/i, sport: 'Football' },
  { id: 'laliga', label: 'LaLiga', regex: /la ?liga|primera division/i, sport: 'Football' },
  { id: 'ligue1', label: 'Ligue 1', regex: /ligue 1|l1 mcdonald/i, sport: 'Football' },
  { id: 'seriea', label: 'Serie A', regex: /serie a|calcio/i, sport: 'Football' },
  { id: 'bundesliga', label: 'Bundesliga', regex: /bundesliga/i, sport: 'Football' },
  { id: 'spl', label: 'Saudi Pro League (Roshn)', regex: /roshn|saudi pro|spl|دوري روشن/i, sport: 'Football' },
  { id: 'uel', label: 'Europa League UEFA', regex: /europa league|\buel\b|ligue europa/i, sport: 'Football' },
  { id: 'f1', label: 'Formule 1 (F1)', regex: /formula 1|formule 1|\bf1\b|grand prix/i, sport: 'Auto' },
  { id: 'motogp', label: 'MotoGP', regex: /motogp|moto 2|moto 3/i, sport: 'Moto' },
  { id: 'nba', label: 'NBA / Basketball', regex: /\bnba\b|euroleague|basket/i, sport: 'Basket' },
  { id: 'tennis', label: 'Tennis (ATP/WTA/Grand Chelem)', regex: /atp|wta|roland garros|wimbledon|us open|australian open|tennis/i, sport: 'Tennis' },
  { id: 'rugby', label: 'Rugby (Top 14 / VI Nations)', regex: /top 14|six nations|xv de france|rugby/i, sport: 'Rugby' },
  { id: 'mma', label: 'UFC / MMA', regex: /\bufc\b|\bmma\b|pfl|bellator/i, sport: 'Combat' },
];

export function detectCompetition(title: string, category = ''): CompetitionDef | null {
  const combined = `${title} ${category}`;
  for (const comp of POPULAR_COMPETITIONS) {
    if (comp.regex.test(combined)) return comp;
  }
  return null;
}

export type SportType =
  | 'football'
  | 'rugby'
  | 'basketball'
  | 'tennis'
  | 'f1'
  | 'moto'
  | 'combat'
  | 'handball'
  | 'volleyball'
  | 'cycling'
  | 'other';

export interface SportInfo {
  type: SportType;
  icon: string;
  name: {
    fr: string;
    ar: string;
    en: string;
  };
  regulationTime: {
    fr: string;
    ar: string;
    en: string;
  };
  tvSlotExplanation: {
    fr: string;
    ar: string;
    en: string;
  };
}

export const SPORTS_REGISTRY: Record<SportType, SportInfo> = {
  football: {
    type: 'football',
    icon: '⚽',
    name: {
      fr: 'Football',
      ar: 'كرة القدم',
      en: 'Football',
    },
    regulationTime: {
      fr: "90 min (2×45')",
      ar: "90 دقيقة (شوطان 45')",
      en: "90 min (2×45')",
    },
    tvSlotExplanation: {
      fr: 'Match : 90 min (+ arrêts) · Créneau TV ~120 min avec avant-match et mi-temps',
      ar: 'المباراة : 90 دقيقة (+ وقت إضافي) · مدة البث التلفزيوني ~120 دقيقة مع الاستوديو والاستراحة',
      en: 'Match: 90 min (+ added time) · TV slot ~120 min with pre-game and halftime studio',
    },
  },
  rugby: {
    type: 'rugby',
    icon: '🏉',
    name: {
      fr: 'Rugby',
      ar: 'الرغبي',
      en: 'Rugby',
    },
    regulationTime: {
      fr: "80 min (2×40')",
      ar: "80 دقيقة (شوطان 40')",
      en: "80 min (2×40')",
    },
    tvSlotExplanation: {
      fr: 'Match : 80 min · Créneau TV ~115-120 min avec analyses',
      ar: 'المباراة : 80 دقيقة · مدة البث التلفزيوني ~120 دقيقة مع التحليل',
      en: 'Match: 80 min · TV slot ~120 min with post-match studio',
    },
  },
  basketball: {
    type: 'basketball',
    icon: '🏀',
    name: {
      fr: 'Basketball',
      ar: 'كرة السلة',
      en: 'Basketball',
    },
    regulationTime: {
      fr: '40 à 48 min (4 quarts-temps)',
      ar: '40 إلى 48 دقيقة (4 أشواط)',
      en: '40-48 min (4 quarters)',
    },
    tvSlotExplanation: {
      fr: 'Temps effectif : 40-48 min · Durée réelle de diffusion ~120 min',
      ar: 'الوقت الفعلي : 40-48 دقيقة · البث التلفزيوني الإجمالي ~ساعتان',
      en: 'Effective time: 40-48 min · Total TV broadcast ~2 hours',
    },
  },
  tennis: {
    type: 'tennis',
    icon: '🎾',
    name: {
      fr: 'Tennis',
      ar: 'التنس',
      en: 'Tennis',
    },
    regulationTime: {
      fr: '2 à 3 sets gagnants',
      ar: 'مجموعات (Sets)',
      en: 'Best of 3 or 5 sets',
    },
    tvSlotExplanation: {
      fr: 'Durée variable par sets gagnants',
      ar: 'مدة متغيرة بحسب المجموعات الرابحة',
      en: 'Variable duration by winning sets',
    },
  },
  f1: {
    type: 'f1',
    icon: '🏎️',
    name: {
      fr: 'Formule 1',
      ar: 'فورمولا 1',
      en: 'Formula 1',
    },
    regulationTime: {
      fr: 'Grand Prix (Course)',
      ar: 'سباق الجائزة الكبرى',
      en: 'Grand Prix Race',
    },
    tvSlotExplanation: {
      fr: 'Course F1 ~90-120 min · Créneau antenne complet',
      ar: 'سباق فورمولا 1 ~90-120 دقيقة',
      en: 'F1 Race ~90-120 min · Full TV broadcast window',
    },
  },
  moto: {
    type: 'moto',
    icon: '🏍️',
    name: {
      fr: 'MotoGP',
      ar: 'موتو جي بي',
      en: 'MotoGP',
    },
    regulationTime: {
      fr: 'Course Moto ~45 min',
      ar: 'سباق موتو ~45 دقيقة',
      en: 'MotoGP Race ~45 min',
    },
    tvSlotExplanation: {
      fr: "Course ~45 min + Tour d'honneur et podium",
      ar: 'السباق ~45 دقيقة + منصة التتويج',
      en: 'Race ~45 min + podium ceremony',
    },
  },
  combat: {
    type: 'combat',
    icon: '🥊',
    name: {
      fr: 'MMA / Boxe',
      ar: 'فنون القتال / ملاكمة',
      en: 'MMA / Combat',
    },
    regulationTime: {
      fr: '3 à 5 rounds',
      ar: '3 إلى 5 جولات',
      en: '3-5 rounds',
    },
    tvSlotExplanation: {
      fr: 'Combat par rounds · Durée totale carte ~120-180 min',
      ar: 'نزال بالجولات · بث الأمسية كاملة',
      en: 'Card bouts by rounds · Full broadcast window',
    },
  },
  handball: {
    type: 'handball',
    icon: '🤾',
    name: {
      fr: 'Handball',
      ar: 'كرة اليد',
      en: 'Handball',
    },
    regulationTime: {
      fr: "60 min (2×30')",
      ar: "60 دقيقة (شوطان 30')",
      en: "60 min (2×30')",
    },
    tvSlotExplanation: {
      fr: 'Match : 60 min · Créneau TV ~90-100 min',
      ar: 'المباراة : 60 دقيقة · البث التلفزيوني ~90 دقيقة',
      en: 'Match: 60 min · TV slot ~90-100 min',
    },
  },
  volleyball: {
    type: 'volleyball',
    icon: '🏐',
    name: {
      fr: 'Volleyball',
      ar: 'كرة الطائرة',
      en: 'Volleyball',
    },
    regulationTime: {
      fr: '3 sets gagnants',
      ar: '3 مجموعات رابحة',
      en: 'Best of 5 sets',
    },
    tvSlotExplanation: {
      fr: 'Durée variable par sets (3 sets gagnants)',
      ar: 'مدة متغيرة بحسب المجموعات (3 مجموعات رابحة)',
      en: 'Variable duration by sets',
    },
  },
  cycling: {
    type: 'cycling',
    icon: '🚴',
    name: {
      fr: 'Cyclisme',
      ar: 'سباق الدراجات',
      en: 'Cycling',
    },
    regulationTime: {
      fr: 'Étape en ligne',
      ar: 'مرحلة سباق',
      en: 'Cycling Stage',
    },
    tvSlotExplanation: {
      fr: 'Étape du jour · Diffusion en direct',
      ar: 'مرحلة اليوم · بث مباشر',
      en: 'Daily stage · Live broadcast',
    },
  },
  other: {
    type: 'other',
    icon: '🏆',
    name: {
      fr: 'Événement Sportif',
      ar: 'حدث رياضي',
      en: 'Sports Event',
    },
    regulationTime: {
      fr: 'Durée réglementaire',
      ar: 'المدة الرسمية',
      en: 'Regulation time',
    },
    tvSlotExplanation: {
      fr: 'Diffusion en direct du match',
      ar: 'بث مباشر للمواجهة الرياضية',
      en: 'Live match broadcast',
    },
  },
};

export function detectSport(title: string, category = '', channelName = ''): SportInfo {
  const t = `${title} ${category} ${channelName}`.toLowerCase();

  if (/\b(?:rugby|top 14|six nations|6 nations|pro d2|premiership rugby|super rugby|xv de france|all blacks|springboks|رغبي)\b/i.test(t)) {
    return SPORTS_REGISTRY.rugby;
  }
  if (/\b(?:basket|basketball|nba|euroleague|wnba|pro a|betclic elite|fiba|كرة السلة)\b/i.test(t)) {
    return SPORTS_REGISTRY.basketball;
  }
  if (/\b(?:tennis|atp|wta|roland[- ]garros|wimbledon|us open|australian open|grand chelem|davis cup|كأس ديفيز|التنس)\b/i.test(t)) {
    return SPORTS_REGISTRY.tennis;
  }
  if (/\b(?:formula 1|formule 1|\bf1\b|grand prix|indycar|nascar|rallye|wrc|le mans|24h du mans|فورمولا)\b/i.test(t)) {
    return SPORTS_REGISTRY.f1;
  }
  if (/\b(?:motogp|moto 2|moto 3|superbike|موتو)\b/i.test(t)) {
    return SPORTS_REGISTRY.moto;
  }
  if (/\b(?:ufc|mma|boxe|boxing|pfl|bellator|wwe|catch|kickboxing|قتال|ملاكمة)\b/i.test(t)) {
    return SPORTS_REGISTRY.combat;
  }
  if (/\b(?:handball|starligue|ehf|hand|كرة اليد)\b/i.test(t)) {
    return SPORTS_REGISTRY.handball;
  }
  if (/\b(?:volley|volleyball|كرة الطائرة)\b/i.test(t)) {
    return SPORTS_REGISTRY.volleyball;
  }
  if (/\b(?:cyclisme|cycling|tour de france|giro|vuelta|paris-roubaix|دراجات)\b/i.test(t)) {
    return SPORTS_REGISTRY.cycling;
  }
  return SPORTS_REGISTRY.football;
}

export function isMatchEqual(
  homeA: string,
  awayA: string,
  homeB: string,
  awayB: string
): boolean {
  const hA = norm(homeA);
  const aA = norm(awayA);
  const hB = norm(homeB);
  const aB = norm(awayB);

  const direct =
    (hA.includes(hB) || hB.includes(hA)) && (aA.includes(aB) || aB.includes(aA));
  const swapped =
    (hA.includes(aB) || aB.includes(hA)) && (aA.includes(hB) || hB.includes(aA));
  return direct || swapped;
}

export function formatLiveMatchTiming(
  elapsedMs: number,
  sportType: SportType = 'football',
  statusText?: string,
  lang: 'fr' | 'ar' | 'en' = 'fr'
): string {
  if (statusText && statusText.trim().length > 0) {
    if (/final|ft|full\s*time|terminé|termin|fin|نهاية/i.test(statusText)) {
      return lang === 'ar' ? 'نهاية المباراة' : lang === 'en' ? 'Full Time' : 'Fin du match';
    }
    return statusText;
  }

  const elapsedMins = Math.max(1, Math.round(elapsedMs / 60000));

  if (sportType === 'football') {
    if (elapsedMins <= 45) {
      return `${elapsedMins}'`;
    }
    if (elapsedMins > 45 && elapsedMins <= 60) {
      return lang === 'ar' ? 'استراحة (شوط 1)' : lang === 'en' ? 'Halftime' : 'Mi-temps';
    }
    if (elapsedMins > 60 && elapsedMins <= 105) {
      const secondHalfMin = 45 + (elapsedMins - 60);
      if (secondHalfMin > 90) {
        const added = Math.min(8, secondHalfMin - 90);
        return `90'+${added}`;
      }
      return `${secondHalfMin}'`;
    }
    return lang === 'ar' ? 'نهاية المباراة' : lang === 'en' ? 'Full Time' : 'Fin du match';
  }

  if (sportType === 'rugby') {
    if (elapsedMins <= 40) return `${elapsedMins}'`;
    if (elapsedMins > 40 && elapsedMins <= 55) {
      return lang === 'ar' ? 'استراحة (شوط 1)' : 'Mi-temps';
    }
    if (elapsedMins > 55 && elapsedMins <= 98) {
      const secondHalf = 40 + (elapsedMins - 55);
      return secondHalf > 80 ? `80'+${Math.min(5, secondHalf - 80)}` : `${secondHalf}'`;
    }
    return lang === 'ar' ? 'انتهت' : 'Terminé';
  }

  if (sportType === 'basketball') {
    return `${Math.min(48, elapsedMins)}'`;
  }

  return `${elapsedMins}'`;
}

/** Chaînes de sports généralement gratuites / en clair (FTA) */
export const FTA_SPORT_KEYWORDS = /arryadia|trt spor|bbc|itv|zdf|das erste|rai sport|servus tv|l'equipe|lequipe|al kass|ad sports|dubai sports|sharjah sports|kuwait sports/i;

export function isFreeChannel(channelName: string, isCaTagged = false): boolean {
  if (isCaTagged) return false;
  return FTA_SPORT_KEYWORDS.test(channelName);
}

/* =========================================================================
   GESTION DES ÉQUIPES FAVORITES (LocalStorage)
   ========================================================================= */

const LS_FAV_TEAMS_KEY = 'pulseepg_favorite_teams_v1';

export function getFavoriteTeams(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LS_FAV_TEAMS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function toggleFavoriteTeam(teamName: string): string[] {
  const normalized = norm(teamName);
  if (!normalized) return getFavoriteTeams();
  const list = getFavoriteTeams();
  const exists = list.some((t) => norm(t) === normalized);
  const updated = exists
    ? list.filter((t) => norm(t) !== normalized)
    : [...list, teamName.trim()];

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LS_FAV_TEAMS_KEY, JSON.stringify(updated));
  }
  return updated;
}

export function isTeamFavorited(teamName: string, favList: string[]): boolean {
  const n = norm(teamName);
  return favList.some((t) => norm(t) === n);
}

export function matchHasFavoriteTeam(home: string, away: string, favList: string[]): boolean {
  return isTeamFavorited(home, favList) || isTeamFavorited(away, favList);
}

/* =========================================================================
   RÉSUMÉS VIDÉO YOUTUBE OFFICIELS
   ========================================================================= */

export interface VideoHighlight {
  id: string;
  title: string;
  channel: string;
  channelId: string;
  verified: boolean;
  ageMs: number;
  dur: number;
  streamed: boolean;
}

const LEAGUE_CHANNEL_IDS = new Set([
  'UCTv-XvfzLX3i4IGWAm4sbmA',
  'UCG5qGWdu8nIRZqJ_GgDwQ-w',
  'UCBJeMCIeLQos7wacox4hmLQ',
  'UC6UL29enLNe4mqwTfAyeNuw',
  'UCyGa1YEx9ST66rYrJTGIKOw',
  'UCJUCcJUeh0Cz2xyKwkw5Q1w',
  'UCfj4kQ6_mYO5r4hzX5KloVw',
  'UC_ZMGMdEVWKGWhwMaWKP4Xg',
  'UCshfmlozZdHI8cHajMkCLyA',
  'UCfYNqluOf8EbQkL44otydMw',
  'UC6c1z7bA__85CIWZ_jpCK-Q',
  'UCZ7wY7MRDSygp63HIEfdQZA',
]);

const OFFICIAL_CHANNELS_REGEX =
  /laliga|premier league|serie a|bundesliga|ligue ?1|uefa|fifa|\bcaf\b|conmebol|eredivisie|liga portugal|s[uü]per lig|roshn|saudi pro|botola|frmf|bein|dazn|espn|sky sports|tnt sports|canal\+|movistar|eurosport|ssc|ad sports|abu dhabi sports|trt spor|rai sport/i;

const HL_REGEX =
  /highlight|resume|resumen|resumo|melhores|ozet|ملخص|اهداف|goals?|buts|goles|golleri|extended|zusammenfassung|sintesi/i;
const NOT_HL_REGEX =
  /press conference|conference de presse|rueda de prensa|preview|live:|\blive\b|watchalong|reaction|interview|training|مؤتمر/i;

export const fold = (s: string) =>
  s.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه');

const STOP_WORDS = new Set([
  'the', 'and', 'les', 'fc', 'cf', 'sc', 'ac', 'afc', 'club', 'de', 'del', 'la', 'le',
  'real', 'united', 'city', 'sport', 'sporting', 'deportivo',
]);

const tokens = (s: string) =>
  fold(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

/** Vérifie si un titre de vidéo contient effectivement les deux clubs ou équipes adverses */
export function isVideoMatchingBothTeams(videoTitle: string, home: string, away: string): boolean {
  const t = fold(videoTitle);
  const homeT = tokens(home).length ? tokens(home) : fold(home).split(/\s+/).filter((w) => w.length >= 3);
  const awayT = tokens(away).length ? tokens(away) : fold(away).split(/\s+/).filter((w) => w.length >= 3);

  const homeHit = homeT.length > 0 && homeT.some((w) => t.includes(w) || (w.length >= 5 && t.includes(w.slice(0, 5))));
  const awayHit = awayT.length > 0 && awayT.some((w) => t.includes(w) || (w.length >= 5 && t.includes(w.slice(0, 5))));

  return homeHit && awayHit;
}

function teamHit(team: string, words: string[]): number {
  const t = tokens(team).length ? tokens(team) : fold(team).split(/\s+/).filter(Boolean);
  if (!t.length) return 0;
  const hit = t.filter((w) =>
    words.some(
      (x) =>
        x === w ||
        (w.length >= 5 && x.startsWith(w.slice(0, 5))) ||
        (x.length >= 5 && w.startsWith(x.slice(0, 5)))
    )
  ).length;
  return hit / t.length;
}

export function rankHighlights(
  home: string,
  away: string,
  startMs: number,
  videos: VideoHighlight[],
  now = Date.now()
): VideoHighlight[] {
  const sinceKickoff = now - startMs;
  const homeT = tokens(home);
  const awayT = tokens(away);
  const ranked: [number, VideoHighlight][] = [];

  for (const v of videos) {
    if (!v.verified || v.streamed || NOT_HL_REGEX.test(fold(v.title))) continue;
    if (v.ageMs > sinceKickoff + 5 * 86_400_000) continue;
    if (v.dur && (v.dur < 45 || v.dur > 25 * 60)) continue;

    const words = tokens(v.title);
    const h = teamHit(home, words);
    const a = teamHit(away, words);
    if (h < 0.5 || a < 0.5) continue;

    const ch = tokens(v.channel);
    const league = LEAGUE_CHANNEL_IDS.has(v.channelId);
    const official = league || OFFICIAL_CHANNELS_REGEX.test(v.channel);
    const club = [...homeT, ...awayT].some((w) => ch.includes(w));
    if (!official && !club) continue;

    const score =
      h +
      a +
      (league ? 3 : official ? 2 : 1.5) +
      (HL_REGEX.test(fold(v.title)) ? 1 : 0) -
      v.ageMs / (7 * 86_400_000);
    ranked.push([score, v]);
  }
  return ranked.sort((x, y) => y[0] - x[0]).map((x) => x[1]);
}

const searchMemo = new Map<string, Promise<VideoHighlight[]>>();

export async function searchVideos(q: string, lang = 'fr'): Promise<VideoHighlight[]> {
  const cleanQ = q.trim();
  const cacheKey = `${cleanQ}_${lang}`;
  if (!searchMemo.has(cacheKey)) {
    searchMemo.set(
      cacheKey,
      fetch(`/api/public/yt?q=${encodeURIComponent(cleanQ)}&lang=${encodeURIComponent(lang)}`)
        .then((r) => (r.ok ? (r.json() as Promise<VideoHighlight[]>) : []))
        .catch(() => [])
    );
  }
  return searchMemo.get(cacheKey)!;
}

export async function isEmbeddable(id: string): Promise<boolean> {
  return fetch(`/api/public/yt?embed=${id}`)
    .then((r) => r.json() as Promise<{ ok: boolean }>)
    .then((r) => r.ok)
    .catch(() => false);
}

export async function highlightFor(
  home: string,
  away: string,
  _startMs: number,
  lang = 'fr'
): Promise<{ v: VideoHighlight; embed: boolean } | null> {
  const normLang = lang.toLowerCase().slice(0, 2);
  
  // Requêtes ciblées propres (sans surcharge de chaînes qui détourne les résultats vers d'autres affiches)
  let targetedQuery = `${home} ${away} highlights`;
  if (normLang === 'ar') {
    targetedQuery = `${home} ${away} ملخص اهداف`;
  } else if (normLang === 'fr') {
    targetedQuery = `${home} ${away} résumé buts`;
  } else if (normLang === 'es') {
    targetedQuery = `${home} ${away} resumen goles`;
  }

  // 1. Recherche avec requête ciblée
  const videos = await searchVideos(targetedQuery, normLang);
  
  // Chercher la vidéo qui contient STRICTEMENT les deux équipes adverses
  let matched = videos.find((v) => isVideoMatchingBothTeams(v.title, home, away));

  // 2. Si non trouvée, essayer avec "home away highlights" en anglais (officiel UEFA / diffuseurs)
  if (!matched) {
    const enVideos = await searchVideos(`${home} ${away} highlights`, 'en');
    matched = enVideos.find((v) => isVideoMatchingBothTeams(v.title, home, away));
  }

  // 3. Si non trouvée, essayer avec les guillemets stricts `"${home}" "${away}"`
  if (!matched) {
    const exactVideos = await searchVideos(`"${home}" "${away}"`, normLang);
    matched = exactVideos.find((v) => isVideoMatchingBothTeams(v.title, home, away));
  }

  // 4. Si toujours non trouvée, utiliser rankHighlights sur les vidéos retournées
  if (!matched && videos.length > 0) {
    const ranked = rankHighlights(home, away, _startMs, videos);
    if (ranked.length > 0) {
      matched = ranked[0];
    }
  }

  if (matched) {
    return { v: matched, embed: true };
  }

  // 5. En dernier recours, si au moins une vidéo existe et ne cite pas un club tiers évident (ex: Bayern Munich)
  if (videos.length > 0) {
    const firstNonRival = videos.find(
      (v) => !/bayern|barcelona|arsenal|liverpool|juventus|dortmund|city/i.test(v.title)
    );
    if (firstNonRival) {
      return { v: firstNonRival, embed: true };
    }
  }

  return null;
}

export const COMPETITION_HIGHLIGHT_QUERIES_BY_LANG: Record<string, Record<string, string>> = {
  ar: {
    all: 'ملخص دوري أبطال أوروبا bein sports تعليق عربي',
    ucl: 'ملخص دوري أبطال أوروبا bein sports تعليق عربي',
    uel: 'ملخص الدوري الأوروبي bein sports تعليق عربي',
    pl: 'ملخص الدوري الإنجليزي الممتاز bein sports تعليق عربي',
    laliga: 'ملخص الدوري الإسباني bein sports تعليق عربي',
    ligue1: 'ملخص الدوري الفرنسي bein sports تعليق عربي',
    seriea: 'ملخص الدوري الإيطالي أبوظبي الرياضية تعليق عربي',
    bundesliga: 'ملخص الدوري الألماني bein sports تعليق عربي',
    botola: 'ملخص البطولة الاحترافية المغربية الرياضية Arryadia',
    spl: 'ملخص دوري روشن السعودي شركة الرياضة السعودية SSC',
    afc: 'ملخص دوري أبطال آسيا beIN SPORTS SSC تعليق عربي',
    f1: 'ملخص سباق الفورمولا 1 بي ان سبورت',
    nba: 'ملخص دوري كرة السلة الأمريكي NBA بي ان سبورت',
  },
  fr: {
    all: 'Ligue des Champions résumé officiel Canal+ Foot beIN Sports',
    ucl: 'Ligue des Champions résumé officiel Canal+ Foot beIN Sports',
    uel: 'Ligue Europa résumé officiel Canal+ beIN Sports',
    pl: 'Premier League résumé match Canal+ Premier League',
    laliga: 'LaLiga résumé officiel buts beIN Sports France',
    ligue1: 'Ligue 1 résumé officiel buts DAZN beIN Sports',
    seriea: 'Serie A résumé officiel beIN Sports France',
    bundesliga: 'Bundesliga résumé officiel beIN Sports France',
    botola: 'Botola Pro inwi résumé match Arryadia',
    spl: 'Saudi Pro League résumé Canal+ Sport 360',
    afc: "Ligue des Champions d'Asie résumé beIN",
    f1: 'Formule 1 résumé Canal+ Sport',
    nba: 'NBA résumé officiel beIN Sports',
  },
  en: {
    all: 'UEFA Champions League highlights official match TNT Sports CBS Golazo',
    ucl: 'UEFA Champions League highlights official match TNT Sports CBS Golazo',
    uel: 'UEFA Europa League highlights official TNT Sports',
    pl: 'Premier League highlights official match Sky Sports',
    laliga: 'LaLiga highlights official resume',
    ligue1: 'Ligue 1 resume match',
    seriea: 'Serie A highlights official match',
    bundesliga: 'Bundesliga highlights official match',
    botola: 'Botola Pro Inwi match highlights',
    spl: 'Saudi Pro League highlights Roshn match',
    afc: 'AFC Champions League highlights',
    f1: 'Formula 1 highlights official',
    nba: 'NBA game highlights official',
  },
  es: {
    all: 'Champions League resumen oficial goles Movistar Liga de Campeones',
    ucl: 'Champions League resumen oficial goles Movistar Liga de Campeones',
    uel: 'Europa League resumen oficial Movistar',
    pl: 'Premier League resumen oficial DAZN',
    laliga: 'LaLiga resumen oficial goles DAZN Movistar',
    ligue1: 'Ligue 1 resumen oficial',
    seriea: 'Serie A resumen oficial',
    bundesliga: 'Bundesliga resumen oficial',
    botola: 'Botola Pro Inwi resumen',
    spl: 'Saudi Pro League resumen',
    afc: 'AFC Champions League resumen',
    f1: 'Formula 1 resumen Movistar DAZN',
    nba: 'NBA resumen oficial',
  },
  de: {
    all: 'UEFA Champions League Highlights DAZN Sky Sport',
    ucl: 'UEFA Champions League Highlights DAZN Sky Sport',
    uel: 'Europa League Highlights RTL Sky',
    pl: 'Premier League Highlights Sky Sport',
    laliga: 'LaLiga Highlights DAZN',
    ligue1: 'Ligue 1 Highlights DAZN',
    seriea: 'Serie A Highlights DAZN',
    bundesliga: 'Bundesliga Highlights DAZN Sky Sport',
    botola: 'Botola Pro Highlights',
    spl: 'Saudi Pro League Highlights',
    afc: 'AFC Champions League Highlights',
    f1: 'Formel 1 Highlights Sky Sport',
    nba: 'NBA Highlights DAZN',
  },
  it: {
    all: 'Champions League sintesi gol Sky Sport Mediaset',
    ucl: 'Champions League sintesi gol Sky Sport Mediaset',
    uel: 'Europa League sintesi gol Sky Sport',
    pl: 'Premier League sintesi gol Sky Sport',
    laliga: 'LaLiga sintesi gol DAZN',
    ligue1: 'Ligue 1 sintesi gol',
    seriea: 'Serie A sintesi gol DAZN Sky',
    bundesliga: 'Bundesliga sintesi gol Sky Sport',
    botola: 'Botola Pro sintesi',
    spl: 'Saudi Pro League sintesi',
    afc: 'AFC Champions League sintesi',
    f1: 'Formula 1 sintesi Sky Sport',
    nba: 'NBA sintesi Sky Sport',
  },
};

export const COMPETITION_HIGHLIGHT_QUERIES: Record<string, string> = COMPETITION_HIGHLIGHT_QUERIES_BY_LANG.en;

export async function fetchCompetitionHighlights(
  compId = 'ucl',
  lang = 'fr'
): Promise<VideoHighlight[]> {
  const normLang = lang.toLowerCase().slice(0, 2);
  const langTable =
    COMPETITION_HIGHLIGHT_QUERIES_BY_LANG[normLang] ||
    COMPETITION_HIGHLIGHT_QUERIES_BY_LANG.fr;
  const q =
    langTable[compId] ||
    langTable.ucl ||
    'UEFA Champions League highlights';
  return searchVideos(q, normLang);
}

export function formatVideoDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export interface GlobalSportFixture {
  id: string;
  competitionId: string;
  competitionLabel: string;
  homeTeam: string;
  homeTeamLogo?: string;
  homeScore?: string;
  awayTeam: string;
  awayTeamLogo?: string;
  awayScore?: string;
  startMs: number;
  stopMs: number;
  isLive: boolean;
  isEnded: boolean;
  statusText: string;
  broadcasters: Array<{
    name: string;
    satellite: string;
    isFree: boolean;
  }>;
}

export async function fetchGlobalSportFixtures(): Promise<GlobalSportFixture[]> {
  try {
    const res = await fetch('/api/sports/fixtures');
    if (!res.ok) return [];
    return (await res.json()) as GlobalSportFixture[];
  } catch {
    return [];
  }
}
