export interface EnrichQueryInput {
  title: string;
  originalTitle?: string;
  subTitle?: string;
  description?: string;
  icon?: string;
  episodeNum?: string;
  year?: string;
  category?: string;
  country?: string;
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
  rating?: number;
  sourceProvider: string;
  resolvedAtMs: number;
}

/**
 * Extrait les numéros de saison et d'épisode depuis une chaîne (ex: "S17E17", "S2E116", "2x05")
 */
export function parseSeasonAndEpisode(
  episodeNum?: string,
  title?: string,
  subTitle?: string
): { season?: number; episode?: number } {
  const combined = `${episodeNum || ''} ${title || ''} ${subTitle || ''}`;

  const seMatch = combined.match(/\bS(\d{1,2})\s*E(\d{1,3})\b/i);
  if (seMatch) {
    return {
      season: parseInt(seMatch[1], 10),
      episode: parseInt(seMatch[2], 10),
    };
  }

  const xMatch = combined.match(/\b(\d{1,2})x(\d{1,3})\b/i);
  if (xMatch) {
    return {
      season: parseInt(xMatch[1], 10),
      episode: parseInt(xMatch[2], 10),
    };
  }

  const epOnlyMatch = (episodeNum || '').match(/^\s*E?(\d{1,3})\s*$/i);
  if (epOnlyMatch) {
    // Chercher si la saison est à la fin du titre (ex: "Murdoch Mysteries 17")
    const titleSeasonMatch = (title || '').match(/\s+(\d{1,2})\s*$/);
    return {
      season: titleSeasonMatch ? parseInt(titleSeasonMatch[1], 10) : undefined,
      episode: parseInt(epOnlyMatch[1], 10),
    };
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

/**
 * Interroge l'API officielle TMDB (avec language=fr-FR) si une clé TMDB_API_KEY est configurée
 */
async function tryTmdbFrenchLookup(
  queries: string[],
  seasonNumber?: number,
  episodeNumber?: number,
  year?: string,
  tmdbApiKey?: string
): Promise<Partial<EnrichedProgrammeResult> | null> {
  if (!tmdbApiKey || !tmdbApiKey.trim()) return null;
  const key = tmdbApiKey.trim();
  const isBearer = key.length > 45;

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
        `https://api.themoviedb.org/3/search/multi?language=fr-FR&query=${encodeURIComponent(
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

      const result: Partial<EnrichedProgrammeResult> = {
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
        rating: best.vote_average
          ? Math.round(best.vote_average * 10) / 10
          : undefined,
        sourceProvider: 'TMDB (fr-FR)',
      };

      // Si c'est une série et qu'on a Saison + Épisode, récupérer le titre officiel FR de l'épisode
      if (
        best.media_type === 'tv' &&
        seasonNumber !== undefined &&
        episodeNumber !== undefined
      ) {
        try {
          const epUrl = appendAuthParam(
            `https://api.themoviedb.org/3/tv/${best.id}/season/${seasonNumber}/episode/${episodeNumber}?language=fr-FR`
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
 * Interroge TVMaze (AKAs officiels FR, Poster HD, Épisodes SxxExx)
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
      )}&embed[]=episodes&embed[]=akas`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = (await res.json()) as {
        name?: string;
        premiered?: string;
        summary?: string;
        rating?: { average?: number };
        image?: { original?: string; medium?: string };
        _embedded?: {
          akas?: Array<{
            name: string;
            country?: { code?: string };
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

      const result: Partial<EnrichedProgrammeResult> = {
        frenchTitle: formattedFrTitle,
        originalTitle: data.name,
        posterUrl: data.image?.original || data.image?.medium,
        releaseYear: data.premiered ? data.premiered.slice(0, 4) : undefined,
        rating: data.rating?.average || undefined,
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

        // Récupérer les sitelinks frwiki et enwiki + labels officiels FR
        const entityUrl = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${match.id}&props=labels|descriptions|sitelinks&languages=fr|en&sitefilter=frwiki|enwiki&format=json&origin=*`;
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
            }
          >;
        };

        const entity = entData.entities?.[match.id];
        if (!entity) continue;

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

        if (frWikiRawTitle) {
          const frExtractUrl = `https://fr.wikipedia.org/w/api.php?action=query&prop=extracts|pageimages&explaintext=1&exchars=1250&piprop=original&titles=${encodeURIComponent(
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
  countryCode?: string
): Promise<string | undefined> {
  if (!text || text.trim().length < 2) return undefined;
  const trimmed = text.trim();

  const langMap: Record<string, string> = {
    PL: 'pl',
    ES: 'es',
    IT: 'it',
    DE: 'de',
    AR: 'auto',
  };
  const sl = (countryCode && langMap[countryCode]) || 'auto';

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=fr&dt=t&q=${encodeURIComponent(
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
 * Pipeline complet de résolution des métadonnées officielles en français (TMDB + TVMaze + Catalogue FR + Traduction FR systématique)
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
    `${input.category || ''} ${input.title || ''}`
  );

  const isSeries =
    !isSportOrFootball &&
    (season !== undefined ||
      episode !== undefined ||
      Boolean(input.episodeNum) ||
      /série|serial|serie/i.test(input.category || ''));

  const cleanedOriginal = input.originalTitle
    ? cleanEpgTitleForSearch(input.originalTitle, season, isSeries)
    : '';
  const cleanedRaw = cleanEpgTitleForSearch(input.title, season, isSeries);

  const queries = Array.from(
    new Set(
      [
        cleanedOriginal,
        cleanedRaw,
        input.originalTitle || '',
        input.title,
      ].filter(Boolean)
    )
  );

  const queryKey = `${cleanedOriginal || cleanedRaw}_${season || ''}_${episode || ''}_${input.year || ''}`.toLowerCase();

  // 1. Pour les Films & Séries : interroger TMDB (language=fr-FR), TVMaze et Wikidata/Wikipedia FR
  let tmdbResult: Partial<EnrichedProgrammeResult> | null = null;
  let rawTvMazeResult: Partial<EnrichedProgrammeResult> | null = null;
  let wikiResult: Partial<EnrichedProgrammeResult> | null = null;

  if (!isSportOrFootball) {
    tmdbResult = await tryTmdbFrenchLookup(
      queries,
      season,
      episode,
      input.year,
      tmdbApiKey
    );

    [rawTvMazeResult, wikiResult] = await Promise.all([
      tryTvMazeLookup(queries, season, episode),
      tryWikidataAndWikipediaFrenchLookup(queries, input.country, isSeries),
    ]);
  }

  const tvMazeResult =
    rawTvMazeResult &&
    (isSeries ||
      queries.some(
        (q) =>
          q.toLowerCase() ===
          (rawTvMazeResult?.originalTitle || '').toLowerCase()
      ))
      ? rawTvMazeResult
      : null;

  let frenchTitle =
    tmdbResult?.frenchTitle ||
    wikiResult?.frenchTitle ||
    tvMazeResult?.frenchTitle ||
    undefined;

  const originalTitle =
    tmdbResult?.originalTitle ||
    tvMazeResult?.originalTitle ||
    wikiResult?.originalTitle ||
    cleanedOriginal ||
    undefined;

  let frenchEpisodeTitle = tmdbResult?.frenchEpisodeTitle;
  let frenchSynopsis =
    tmdbResult?.frenchSynopsis || wikiResult?.frenchSynopsis || undefined;

  // 2. Si c'est un épisode de série (ex: S17E17) et qu'il manque le titre officiel FR de l'épisode ou son résumé FR
  if (
    !isSportOrFootball &&
    season !== undefined &&
    episode !== undefined &&
    (frenchTitle || cleanedOriginal) &&
    (!frenchEpisodeTitle || !frenchSynopsis)
  ) {
    const epFr = await tryFrenchSeasonEpisodeLookup(
      frenchTitle || cleanedOriginal || cleanedRaw,
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

  // 3. Traduction systématique en français quand le titre, sous-titre ou synopsis est dans une autre langue
  const translationTasks: Promise<void>[] = [];

  if (!frenchTitle && input.title) {
    translationTasks.push(
      translateTextToFrench(cleanedRaw || input.title, input.country).then(
        (tr) => {
          if (tr) frenchTitle = tr;
        }
      )
    );
  }

  if (
    !frenchEpisodeTitle &&
    (input.subTitle || tvMazeResult?.originalEpisodeTitle)
  ) {
    const rawSub = input.subTitle || tvMazeResult?.originalEpisodeTitle;
    translationTasks.push(
      translateTextToFrench(rawSub, input.country).then((tr) => {
        if (tr) frenchEpisodeTitle = tr;
      })
    );
  }

  if (!frenchSynopsis && input.description) {
    translationTasks.push(
      translateTextToFrench(input.description, input.country).then((tr) => {
        if (tr) frenchSynopsis = tr;
      })
    );
  }

  if (translationTasks.length > 0) {
    await Promise.all(translationTasks);
  }

  const posterUrl =
    tmdbResult?.posterUrl ||
    tvMazeResult?.posterUrl ||
    wikiResult?.posterUrl ||
    input.icon ||
    undefined;

  const backdropUrl =
    tmdbResult?.backdropUrl ||
    tvMazeResult?.backdropUrl ||
    input.icon ||
    posterUrl ||
    undefined;

  const sourceProvider = tmdbResult
    ? 'TMDB (fr-FR)'
    : tvMazeResult && wikiResult
    ? 'TVMaze & Catalogue Officiel FR'
    : wikiResult
    ? 'Catalogue Officiel FR'
    : tvMazeResult
    ? 'TVMaze & Traduction FR'
    : 'Traduction & Enrichissement FR';

  return {
    queryKey,
    frenchTitle,
    originalTitle,
    frenchEpisodeTitle,
    originalEpisodeTitle: tvMazeResult?.originalEpisodeTitle,
    seasonNumber: season,
    episodeNumber: episode,
    frenchSynopsis,
    posterUrl,
    backdropUrl,
    releaseYear:
      tmdbResult?.releaseYear || tvMazeResult?.releaseYear || input.year,
    rating: tmdbResult?.rating || tvMazeResult?.rating,
    sourceProvider,
    resolvedAtMs: Date.now(),
  };
}
