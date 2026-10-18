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
  /\b(?:rediffusion|rediff\w*|replay|resume|résumé|highlights?|best of|magazine|mag|repeticion|resumen|melhores momentos|tekrar|ozet|özet|wiederholung|zusammenfassung|classic match|classic|archive|retro|podcast|talk|doku|documentary|documentaire|resumo|preview|avant-match|pre-?game|studio|sezon|season|analyse|talk|debrief|ozeti|zapping|revue|entretien)\b|إعادة|ملخص|أرشيف|سهرة|حوار|استوديو/i;

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
  'real', 'united', 'city', 'sport', 'sporting', 'deportivo', 'atletico',
]);

const tokens = (s: string) =>
  fold(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

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

export async function searchVideos(q: string): Promise<VideoHighlight[]> {
  const key = fold(q).trim();
  if (!searchMemo.has(key)) {
    searchMemo.set(
      key,
      fetch(`/api/public/yt?q=${encodeURIComponent(key)}`)
        .then((r) => (r.ok ? (r.json() as Promise<VideoHighlight[]>) : []))
        .catch(() => [])
    );
  }
  return searchMemo.get(key)!;
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
  startMs: number
): Promise<{ v: VideoHighlight; embed: boolean } | null> {
  const videos = await searchVideos(`${home} ${away}`);
  const ranked = rankHighlights(home, away, startMs, videos).slice(0, 5);
  for (const v of ranked) {
    if (await isEmbeddable(v.id)) return { v, embed: true };
  }
  return ranked[0] ? { v: ranked[0], embed: true } : null;
}

export const COMPETITION_HIGHLIGHT_QUERIES: Record<string, string> = {
  all: 'UEFA Champions League highlights official match',
  ucl: 'UEFA Champions League highlights official match',
  uel: 'UEFA Europa League highlights official',
  pl: 'Premier League highlights official match',
  laliga: 'LaLiga highlights official resume',
  ligue1: "Ligue 1 resume match",
  seriea: 'Serie A highlights official match',
  bundesliga: 'Bundesliga highlights official match',
  botola: 'Botola Pro inwi resume match Arryadia',
  spl: 'Saudi Pro League highlights Roshn match',
  f1: 'Formula 1 highlights official',
  nba: 'NBA game highlights official',
};

export async function fetchCompetitionHighlights(
  compId = 'ucl'
): Promise<VideoHighlight[]> {
  const q =
    COMPETITION_HIGHLIGHT_QUERIES[compId] ||
    COMPETITION_HIGHLIGHT_QUERIES.ucl;
  return searchVideos(q);
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
