import { AppLanguage, EpgProgramme } from '../types/epg';
import { getActiveLanguage, getLanguageOption } from '../utils/i18n';
import {
  cleanEpgTitleForSearch,
  EnrichedProgrammeResult,
  formatSeasonEpisodeCode,
  parseSeasonAndEpisode,
  resolveOfficialFrenchMetadata,
} from '../utils/metadataResolverCore';
import { ensureHttpsUrl } from '../utils/xmltvParser';

const memoryCache = new Map<string, EpgProgramme>();
const rawResultCache = new Map<string, EnrichedProgrammeResult>();
const inFlightRequests = new Map<string, Promise<EpgProgramme>>();

function getProgrammeCacheKey(
  programme: EpgProgramme,
  lang: AppLanguage
): string {
  const searchTitle = cleanEpgTitleForSearch(
    programme.originalTitle || programme.title
  )
    .toLowerCase()
    .trim();
  const { season, episode } = parseSeasonAndEpisode(
    programme.episodeNum,
    programme.originalTitle || programme.title,
    programme.subTitle
  );
  return `${lang}::${searchTitle}::${programme.date || ''}::${
    season ?? ''
  }::${episode ?? ''}`;
}

export function getCachedEnrichedMetadata(
  programme: EpgProgramme,
  lang?: AppLanguage
): EnrichedProgrammeResult | null {
  const activeLang = lang || getActiveLanguage();
  const key = getProgrammeCacheKey(programme, activeLang);
  return rawResultCache.get(key) || null;
}

/**
 * Enrichit les métadonnées d'un programme EPG en interrogeant TMDB / TVMaze / Wikipedia
 * dans la langue active sélectionnée (ex: fr-FR, en-US, ar-SA, es-ES, de-DE, pt-BR).
 */
export async function enrichProgrammeMetadata(
  programme: EpgProgramme,
  langOverride?: AppLanguage
): Promise<EpgProgramme> {
  const activeLang = langOverride || getActiveLanguage();
  const langOption = getLanguageOption(activeLang);
  const tmdbLocale = langOption.tmdbLocale;

  const cacheKey = getProgrammeCacheKey(programme, activeLang);
  const cached = memoryCache.get(cacheKey);
  if (cached) {
    return {
      ...programme,
      ...cached,
      id: programme.id,
      channelId: programme.channelId,
      startMs: programme.startMs,
      stopMs: programme.stopMs,
    };
  }

  const existingPromise = inFlightRequests.get(cacheKey);
  if (existingPromise) {
    const resolved = await existingPromise;
    return {
      ...programme,
      ...resolved,
      id: programme.id,
      channelId: programme.channelId,
      startMs: programme.startMs,
      stopMs: programme.stopMs,
    };
  }

  const task = (async (): Promise<EpgProgramme> => {
    try {
      const params = new URLSearchParams({
        title: programme.title,
        originalTitle: programme.originalTitle || '',
        subTitle: programme.subTitle || '',
        description: programme.description || '',
        icon: programme.icon || '',
        episodeNum: programme.episodeNum || '',
        year: programme.date || '',
        category: programme.category || '',
        rawCategory: programme.rawCategory || '',
        xmlOriginCountry: programme.country || '',
        lang: tmdbLocale,
        language: tmdbLocale,
      });

      let result: EnrichedProgrammeResult | null = null;

      try {
        const res = await fetch(`/api/metadata-enrich?${params.toString()}`);
        if (res.ok) {
          result = (await res.json()) as EnrichedProgrammeResult;
        }
      } catch {
        // Fallback client-side resolution
      }

      if (!result) {
        result = await resolveOfficialFrenchMetadata({
          title: programme.title,
          originalTitle: programme.originalTitle,
          subTitle: programme.subTitle,
          description: programme.description,
          icon: programme.icon,
          episodeNum: programme.episodeNum,
          year: programme.date,
          category: programme.category,
          rawCategory: programme.rawCategory,
          xmlOriginCountry: programme.country,
          lang: tmdbLocale,
          language: tmdbLocale,
        });
      }

      rawResultCache.set(cacheKey, result);

      const formattedSE = formatSeasonEpisodeCode(
        result.seasonNumber,
        result.episodeNumber
      );

      const enriched: EpgProgramme = {
        ...programme,
        title: result.frenchTitle || programme.title,
        originalTitle: result.originalTitle || programme.originalTitle,
        subTitle:
          result.frenchEpisodeTitle ||
          result.originalEpisodeTitle ||
          programme.subTitle,
        description: result.frenchSynopsis || programme.description,
        category:
          result.genres && result.genres.length > 0
            ? result.genres.join(', ')
            : programme.category,
        icon: ensureHttpsUrl(result.posterUrl || programme.icon),
        backdrop: ensureHttpsUrl(result.backdropUrl || programme.backdrop),
        rating:
          typeof result.rating === 'number' && result.rating > 0
            ? `${result.rating.toFixed(1)}/10`
            : programme.rating,
        date: result.releaseDate || result.releaseYear || programme.date,
        country:
          result.originCountries && result.originCountries.length > 0
            ? result.originCountries[0]
            : programme.country,
        episodeNum: formattedSE || programme.episodeNum,
        directors:
          result.directors && result.directors.length > 0
            ? result.directors
            : programme.directors,
        actors:
          result.cast && result.cast.length > 0
            ? result.cast
            : programme.actors,
        enrichedSource: result.sourceProvider || 'tmdb',
      };

      memoryCache.set(cacheKey, enriched);
      return enriched;
    } catch {
      return programme;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  inFlightRequests.set(cacheKey, task);
  return task;
}

export async function enrichProgrammeWithFrenchMetadata(
  programme: EpgProgramme,
  _channelCountry?: string,
  langOverride?: AppLanguage
): Promise<EpgProgramme> {
  return enrichProgrammeMetadata(programme, langOverride);
}

export function clearEnrichedMetadataCache(): void {
  memoryCache.clear();
  rawResultCache.clear();
  inFlightRequests.clear();
}
