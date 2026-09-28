import { EpgProgramme } from '../types/epg';
import {
  cleanEpgTitleForSearch,
  EnrichedProgrammeResult,
  parseSeasonAndEpisode,
  resolveOfficialFrenchMetadata,
} from '../utils/metadataResolverCore';

const LS_ENRICHED_CACHE_KEY = 'pulse_epg_enriched_fr_v2';

const memoryCache = new Map<string, EnrichedProgrammeResult>();
const inFlightRequests = new Map<string, Promise<EnrichedProgrammeResult>>();

// Charger le cache initial depuis LocalStorage au démarrage
try {
  if (typeof localStorage !== 'undefined') {
    const raw = localStorage.getItem(LS_ENRICHED_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, EnrichedProgrammeResult>;
      for (const [k, v] of Object.entries(parsed)) {
        memoryCache.set(k, v);
      }
    }
  }
} catch {
  // Ignore
}

function persistMemoryCacheToLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    const entries = Array.from(memoryCache.entries()).slice(-450);
    const obj: Record<string, EnrichedProgrammeResult> = {};
    for (const [k, v] of entries) {
      obj[k] = v;
    }
    localStorage.setItem(LS_ENRICHED_CACHE_KEY, JSON.stringify(obj));
  } catch {
    // Ignore storage quota errors
  }
}

export function getProgrammeEnrichKey(prog: EpgProgramme): string {
  const { season, episode } = parseSeasonAndEpisode(
    prog.episodeNum,
    prog.originalTitle || prog.title,
    prog.subTitle
  );
  const baseTitle = cleanEpgTitleForSearch(
    prog.originalTitle || prog.title,
    season,
    Boolean(prog.episodeNum)
  );
  return `${baseTitle}|${prog.subTitle || ''}|${season || ''}|${episode || ''}|${prog.date || ''}`.toLowerCase();
}

export function getCachedEnrichedMetadata(
  prog: EpgProgramme
): EnrichedProgrammeResult | null {
  const key = getProgrammeEnrichKey(prog);
  return memoryCache.get(key) || null;
}

/**
 * Récupère le titre officiel français, le titre de l'épisode en français,
 * le vrai synopsis FR et l'affiche officielle via le proxy serveur TMDB/TVMaze
 * (ou directement côté client pour un APK Capacitor autonome).
 */
export async function enrichProgrammeWithFrenchMetadata(
  prog: EpgProgramme,
  countryCode?: string
): Promise<EnrichedProgrammeResult> {
  const key = getProgrammeEnrichKey(prog);
  const existing = memoryCache.get(key);
  if (existing) {
    return existing;
  }

  const inFlight = inFlightRequests.get(key);
  if (inFlight) {
    return inFlight;
  }

  const promise = (async (): Promise<EnrichedProgrammeResult> => {
    const params = new URLSearchParams({
      title: prog.title,
      ...(prog.originalTitle ? { originalTitle: prog.originalTitle } : {}),
      ...(prog.subTitle ? { subTitle: prog.subTitle } : {}),
      ...(prog.description
        ? { description: prog.description.slice(0, 750) }
        : {}),
      ...(prog.icon ? { icon: prog.icon } : {}),
      ...(prog.episodeNum ? { episodeNum: prog.episodeNum } : {}),
      ...(prog.date ? { year: prog.date } : {}),
      ...(prog.category ? { category: prog.category } : {}),
      ...(countryCode ? { country: countryCode } : {}),
    });

    try {
      const res = await fetch(`/api/metadata-enrich?${params.toString()}`);
      if (res.ok) {
        const data = (await res.json()) as EnrichedProgrammeResult;
        memoryCache.set(key, data);
        persistMemoryCacheToLocalStorage();
        return data;
      }
    } catch {
      // Fallback autonome côté client (ex: APK Android Capacitor sans serveur Node local)
    }

    const clientResult = await resolveOfficialFrenchMetadata({
      title: prog.title,
      originalTitle: prog.originalTitle,
      subTitle: prog.subTitle,
      description: prog.description,
      icon: prog.icon,
      episodeNum: prog.episodeNum,
      year: prog.date,
      category: prog.category,
      country: countryCode,
    });

    memoryCache.set(key, clientResult);
    persistMemoryCacheToLocalStorage();
    return clientResult;
  })();

  inFlightRequests.set(key, promise);

  try {
    return await promise;
  } finally {
    inFlightRequests.delete(key);
  }
}
