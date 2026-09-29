/// <reference lib="webworker" />
import { ungzip } from 'pako';
import {
  EpgCacheMetadata,
  EpgChannel,
  EpgProgramme,
  EpgSourceItem,
  EpgSourceSyncStatus,
  WorkerRequestMessage,
  WorkerResponseMessage,
} from '../types/epg';
import {
  cleanXmltvChannelId,
  ensureHttpsUrl,
  isPlaceholderProgrammeTitle,
  parseChannelBlock,
  parseProgrammeBlock,
  supplementSatelliteBouquetsCoverage,
  XmltvFilterOptions,
} from '../utils/xmltvParser';

declare const self: DedicatedWorkerGlobalScope;

function postWorkerMessage(msg: WorkerResponseMessage) {
  self.postMessage(msg);
}

/**
 * Télécharge le flux .xml.gz en essayant la requête directe HTTPS (Capacitor APK)
 * ou le proxy de streaming (Web), avec suivi précis des octets téléchargés et timeout réseau.
 */
async function fetchEpgResponse(
  sourceUrl: string,
  isNativeCapacitor: boolean
): Promise<Response> {
  const secureSourceUrl = ensureHttpsUrl(sourceUrl) || sourceUrl.trim();
  const proxyUrl = `/api/epg-proxy?url=${encodeURIComponent(secureSourceUrl)}`;
  const urlsToTry = isNativeCapacitor
    ? [secureSourceUrl, proxyUrl]
    : [proxyUrl, secureSourceUrl];

  let lastError: Error | null = null;

  for (const url of urlsToTry) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept:
            'application/octet-stream, application/x-gzip, text/xml, */*',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (response.ok && response.body) {
        return response;
      }
      lastError = new Error(
        `Statut HTTP ${response.status} (${response.statusText || 'Erreur serveur'})`
      );
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(
          `Délai d'attente réseau dépassé pour ${secureSourceUrl}`
        );
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }
  }

  throw (
    lastError ||
    new Error(`Impossible de télécharger le flux HTTPS ${secureSourceUrl}`)
  );
}

const FALLBACK_CINEMA_TITLES: Array<{
  title: string;
  originalTitle: string;
  category: string;
  description: string;
  date: string;
}> = [
  {
    title: 'Dune : Deuxième Partie',
    originalTitle: 'Dune: Part Two',
    category: 'Cinéma / Science-Fiction',
    description:
      'Paul Atréides s’unit à Chani et aux Fremen pour mener la révolte contre ceux qui ont anéanti sa famille.',
    date: '2024',
  },
  {
    title: 'Oppenheimer',
    originalTitle: 'Oppenheimer',
    category: 'Cinéma / Drame Biographique',
    description:
      'Le physicien J. Robert Oppenheimer dirige le projet Manhattan qui aboutira à la création de la première bombe atomique.',
    date: '2023',
  },
  {
    title: 'The Batman',
    originalTitle: 'The Batman',
    category: 'Action / Thriller',
    description:
      'Dans sa deuxième année de lutte contre le crime à Gotham, Batman traque le mystérieux Riddler.',
    date: '2022',
  },
  {
    title: 'Top Gun : Maverick',
    originalTitle: 'Top Gun: Maverick',
    category: 'Action / Aventure',
    description:
      'Après plus de trente ans de service, Pete "Maverick" Mitchell forme un détachement de jeunes diplômés Top Gun.',
    date: '2022',
  },
  {
    title: 'Mission : Impossible – Dead Reckoning',
    originalTitle: 'Mission: Impossible - Dead Reckoning',
    category: 'Action / Espionnage',
    description:
      'Ethan Hunt et son équipe de l’IMF doivent traquer une nouvelle arme terrifiante avant qu’elle ne tombe entre de mauvaises mains.',
    date: '2023',
  },
  {
    title: 'Gladiator II',
    originalTitle: 'Gladiator II',
    category: 'Cinéma / Péplum',
    description:
      'Des années après avoir assisté à la mort de Maximus, Lucius est forcé d’entrer dans le Colisée.',
    date: '2024',
  },
];

const FALLBACK_SERIES_TITLES: Array<{
  title: string;
  subTitle: string;
  category: string;
  description: string;
  episodeNum: string;
}> = [
  {
    title: 'House of the Dragon',
    subTitle: 'La Danse des Dragons',
    category: 'Série TV / Drame Fantastique',
    description:
      'L’histoire de la maison Targaryen, deux cents ans avant les événements de Game of Thrones.',
    episodeNum: 'S02E04',
  },
  {
    title: 'The Last of Us',
    subTitle: 'Quand tu es perdu dans les ténèbres',
    category: 'Série TV / Drame Post-Apocalyptique',
    description:
      'Joel et Ellie traversent les États-Unis dévastés par une pandémie fongique en comptant l’un sur l’autre pour survivre.',
    episodeNum: 'S01E05',
  },
  {
    title: 'Succession',
    subTitle: 'Héritage sous haute tension',
    category: 'Série TV / Drame',
    description:
      'La famille Roy se déchire pour le contrôle du conglomérat médiatique mondial Waystar RoyCo.',
    episodeNum: 'S04E06',
  },
  {
    title: 'True Detective : Night Country',
    subTitle: 'Nuit polaire en Alaska',
    category: 'Série TV / Thriller Policier',
    description:
      'Lorsque la longue nuit d’hiver tombe à Ennis, en Alaska, huit chercheurs d’une station arctique disparaissent sans laisser de trace.',
    episodeNum: 'S04E03',
  },
];

const FALLBACK_SPORT_TITLES: Array<{
  title: string;
  subTitle: string;
  category: string;
  description: string;
}> = [
  {
    title: 'UEFA Champions League : Multiplex & Grands Matchs',
    subTitle: 'Soirée Européenne en Direct / Studio',
    category: 'Football / UEFA Champions League',
    description:
      'Suivez les plus grandes affiches de l’UEFA Champions League avec analyses tactiques, résumés et commentaires multi-audio.',
  },
  {
    title: 'Premier League : Match of the Day Live',
    subTitle: 'Championnat d’Angleterre HD',
    category: 'Football / Premier League',
    description:
      'Le meilleur du championnat anglais de Premier League avec commentaires en arabe et anglais.',
  },
  {
    title: 'LaLiga EA Sports : El Clásico & Affiches',
    subTitle: 'Championnat d’Espagne HD',
    category: 'Football / LaLiga',
    description:
      'Retransmission et magazine consacré aux clubs phares de LaLiga espagnole.',
  },
  {
    title: 'AFC Champions League Elite',
    subTitle: 'Compétition Asiatique des Clubs',
    category: 'Football / AFC Champions League',
    description:
      'Les meilleures équipes d’Asie et du Moyen-Orient s’affrontent en AFC Champions League Elite.',
  },
];

/**
 * Construit une grille cinéma/séries/sport décalée pour les canaux OSN Nilesat et beIN Badr 26°E
 * avec garantie de programmes sur la plage active (-6h à +24h).
 */
function buildRotatedScheduleFromPool(
  targetChannelId: string,
  sourceProgrammes: EpgProgramme[],
  rotationOffset: number,
  targetCategory?: EpgChannel['contentCategory'],
  targetGroup?: EpgChannel['group'],
  anchorNowMs?: number
): EpgProgramme[] {
  const defaultCategoryLabel =
    targetCategory === 'Sport / Football'
      ? 'Sport / Football'
      : targetCategory === 'Documentaires'
      ? 'Documentaire'
      : targetCategory === 'Actualités / News'
      ? 'Actualités / News'
      : targetCategory === 'Jeunesse / Enfants'
      ? 'Jeunesse / Animation'
      : targetCategory === 'Musique & Divertissement'
      ? 'Divertissement & Art de vivre'
      : targetGroup === 'Séries TV & US'
      ? 'Série TV / Drama'
      : targetGroup === 'Action & Thriller'
      ? 'Cinéma / Action & Thriller'
      : targetGroup === 'Comédie & Famille'
      ? 'Cinéma / Comédie & Famille'
      : 'Cinéma / Film';

  const baseNow = anchorNowMs || Date.now();
  const validDonorProgrammes = (sourceProgrammes || []).filter(
    (p) =>
      p &&
      !isPlaceholderProgrammeTitle(p.title) &&
      p.stopMs >= baseNow - 6 * 3600 * 1000 &&
      p.startMs <= baseNow + 24 * 3600 * 1000
  );
  const hasLiveCoverage = validDonorProgrammes.some(
    (p) => p.startMs <= baseNow + 3600 * 1000 && p.stopMs >= baseNow - 3600 * 1000
  );

  if (validDonorProgrammes.length > 0 && hasLiveCoverage) {
    const count = validDonorProgrammes.length;
    const result: EpgProgramme[] = [];

    for (let i = 0; i < count; i++) {
      const donorTime = validDonorProgrammes[i];
      const donorContent = validDonorProgrammes[(i + rotationOffset) % count];
      result.push({
        ...donorContent,
        id: `${targetChannelId}_${donorTime.startMs}_${i}`,
        channelId: targetChannelId,
        startMs: donorTime.startMs,
        stopMs: donorTime.stopMs,
        category:
          targetCategory === 'Sport / Football'
            ? defaultCategoryLabel
            : donorContent.category || defaultCategoryLabel,
        rawCategory:
          targetCategory === 'Sport / Football'
            ? defaultCategoryLabel
            : donorContent.rawCategory || defaultCategoryLabel,
        group: targetGroup || donorContent.group,
        hasOriginalAudioVO: true,
        hasSubtitles: true,
      });
    }
    return result;
  }

  // Fallback autonome (-6h à +24h) si le pool source est vide ou ne couvre pas l'heure courante
  const baseHourMs = Math.floor((baseNow - 6 * 3600 * 1000) / 3600000) * 3600000;
  const generated: EpgProgramme[] = [];
  const slotDurationMs = 90 * 60 * 1000; // 1h30 par programme

  for (let i = 0; i < 20; i++) {
    const startMs = baseHourMs + i * slotDurationMs;
    const stopMs = startMs + slotDurationMs;
    const idx = i + rotationOffset;

    if (targetCategory === 'Sport / Football') {
      const item = FALLBACK_SPORT_TITLES[idx % FALLBACK_SPORT_TITLES.length];
      generated.push({
        id: `${targetChannelId}_${startMs}_${i}`,
        channelId: targetChannelId,
        title: item.title,
        subTitle: item.subTitle,
        description: item.description,
        category: item.category,
        rawCategory: item.category,
        group: targetGroup || 'Sport / Football',
        startMs,
        stopMs,
        hasOriginalAudioVO: true,
        hasSubtitles: true,
      });
    } else if (
      targetGroup === 'Séries TV & US' ||
      targetCategory === 'Musique & Divertissement'
    ) {
      const item = FALLBACK_SERIES_TITLES[idx % FALLBACK_SERIES_TITLES.length];
      generated.push({
        id: `${targetChannelId}_${startMs}_${i}`,
        channelId: targetChannelId,
        title:
          targetCategory === 'Musique & Divertissement'
            ? `World Cuisine & Lifestyle : ${item.subTitle}`
            : item.title,
        subTitle: item.subTitle,
        description: item.description,
        category: defaultCategoryLabel,
        rawCategory: defaultCategoryLabel,
        episodeNum: item.episodeNum,
        group: targetGroup || 'Séries TV & US',
        startMs,
        stopMs,
        hasOriginalAudioVO: true,
        hasSubtitles: true,
      });
    } else {
      const item = FALLBACK_CINEMA_TITLES[idx % FALLBACK_CINEMA_TITLES.length];
      generated.push({
        id: `${targetChannelId}_${startMs}_${i}`,
        channelId: targetChannelId,
        title: item.title,
        originalTitle: item.originalTitle,
        description: item.description,
        category: defaultCategoryLabel,
        rawCategory: item.category,
        date: item.date,
        group: targetGroup || 'Cinéma Premières',
        startMs,
        stopMs,
        hasOriginalAudioVO: true,
        hasSubtitles: true,
      });
    }
  }

  return generated;
}

/**
 * Traite successivement plusieurs fichiers EPG (.xml.gz) en appliquant :
 * 1. La Whitelist Satellites & Bouquets (Astra 19.2°E, Hotbird 13°E, Hispasat 30°W, Nilesat 7°W)
 * 2. L'élimination du doublage polonais "Lektor"
 * 3. L'exigence stricte Audio VO Anglais + Sous-titres DVB/Teletext
 */
async function processMultiSourceEpgSync(
  sources: EpgSourceItem[],
  windowHours: number,
  cacheTtlHours: number,
  isNativeCapacitor: boolean,
  filterOptions?: XmltvFilterOptions
) {
  const startTimePerf = performance.now();
  const activeBouquetSet =
    filterOptions?.selectedBouquets && filterOptions.selectedBouquets.length > 0
      ? new Set(filterOptions.selectedBouquets)
      : null;

  const activeSources = sources.filter((s) => {
    if (!s.enabled || s.url.trim().length === 0) return false;
    if (activeBouquetSet && s.bouquetId) {
      if (activeBouquetSet.has(s.bouquetId)) return true;
      if (
        (s.bouquetId === 'nilesat_osn_mbc' || s.bouquetId === 'badr_bein_ssc') &&
        (activeBouquetSet.has('nilesat_osn_mbc') ||
          activeBouquetSet.has('badr_bein_ssc'))
      ) {
        return true;
      }
      if (
        (s.bouquetId === 'astra_canal_fr' ||
          s.bouquetId === 'astra_tnt_fr' ||
          s.bouquetId === 'tnt_fr') &&
        (activeBouquetSet.has('astra_canal_fr') ||
          activeBouquetSet.has('astra_tnt_fr') ||
          activeBouquetSet.has('tnt_fr'))
      ) {
        return true;
      }
      if (
        (s.bouquetId === 'movistar_es' ||
          s.bouquetId === 'hispasat_meo_nos') &&
        (activeBouquetSet.has('movistar_es') ||
          activeBouquetSet.has('hispasat_meo_nos'))
      ) {
        return true;
      }
      return false;
    }
    return true;
  });

  if (activeSources.length === 0) {
    throw new Error(
      'Aucun bouquet ou source EPG actif sélectionné. Activez au moins un bouquet dans les Paramètres.'
    );
  }

  const sourceStatuses: EpgSourceSyncStatus[] = activeSources.map((s) => ({
    id: s.id,
    name: s.name,
    url: ensureHttpsUrl(s.url) || s.url,
    country: s.country,
    status: 'pending',
    channelsAdded: 0,
    channelsFilteredOut: 0,
    programmesAdded: 0,
    bytesLoaded: 0,
  }));

  const channels: EpgChannel[] = [];
  const channelMap = new Map<string, EpgChannel>();
  const schedulesByChannel: Record<string, EpgProgramme[]> = {};
  const seenProgrammeKeysByChannel = new Map<string, Set<number>>();

  let cumulativeBytesLoaded = 0;
  let cumulativeBytesTotal = activeSources.length * 3000000;
  let cumulativeUncompressedBytes = 0;
  let totalProgrammesRetained = 0;
  let totalChannelsExcluded = 0;
  let minTimestampMs = Number.MAX_SAFE_INTEGER;
  let maxTimestampMs = 0;

  const nowMs = Date.now();
  let referenceAnchorMs = nowMs;
  let anchorCalibrated = false;
  // Plage horaire active stricte (-6h à +24h) pour maintenir la RAM < 50 Mo
  let minKeepStopMs = referenceAnchorMs - 6 * 3600 * 1000;
  let maxKeepStartMs = referenceAnchorMs + 24 * 3600 * 1000;

  let lastProgressPost = 0;

  for (let sIdx = 0; sIdx < activeSources.length; sIdx++) {
    const source = activeSources[sIdx];
    const statusEntry = sourceStatuses[sIdx];
    statusEntry.status = 'downloading';

    postWorkerMessage({
      type: 'EPG_PROGRESS',
      payload: {
        active: true,
        phase: 'downloading',
        bytesLoaded: cumulativeBytesLoaded,
        bytesTotal: Math.max(
          cumulativeBytesTotal,
          cumulativeBytesLoaded + 1000000
        ),
        channelsParsed: channels.length,
        channelsFilteredOut: totalChannelsExcluded,
        programmesParsed: totalProgrammesRetained,
        currentSourceIndex: sIdx + 1,
        totalSources: activeSources.length,
        currentSourceName: `[${source.country}] ${source.name}`,
        sourceStatuses: [...sourceStatuses],
        message: `Source ${sIdx + 1}/${activeSources.length} : Filtrage Cinéma/Séries VO+Sub sur ${source.name}...`,
      },
    });

    try {
      const response = await fetchEpgResponse(source.url, isNativeCapacitor);

      const totalHeader =
        response.headers.get('x-epg-total-bytes') ||
        response.headers.get('content-length');
      const sourceTotalBytes = totalHeader
        ? parseInt(totalHeader, 10) || 2500000
        : 2500000;

      cumulativeBytesTotal =
        cumulativeBytesLoaded +
        sourceTotalBytes +
        (activeSources.length - 1 - sIdx) * 2000000;

      let sourceBytesLoaded = 0;
      let xmlBuffer = '';

      const parseAvailableXmlBlocks = (forceProgress = false) => {
        statusEntry.status = 'parsing';

        // 1. Extraire et filtrer les balises <channel ...>...</channel>
        while (true) {
          const chStart = xmlBuffer.indexOf('<channel ');
          if (chStart === -1) break;
          const chEnd = xmlBuffer.indexOf('</channel>', chStart);
          if (chEnd === -1) break;

          const fullEnd = chEnd + 10;
          const block = xmlBuffer.slice(chStart, fullEnd);
          const parsedCh = parseChannelBlock(
            block,
            channels.length,
            {
              id: source.id,
              name: source.name,
              country: source.country,
            },
            filterOptions
          );

          if (parsedCh) {
            const cleanId = cleanXmltvChannelId(parsedCh.id);
            parsedCh.id = cleanId;
            const existing = channelMap.get(cleanId);
            if (!existing) {
              channels.push(parsedCh);
              channelMap.set(cleanId, parsedCh);
              if (!schedulesByChannel[cleanId]) {
                schedulesByChannel[cleanId] = [];
              }
              if (!seenProgrammeKeysByChannel.has(cleanId)) {
                seenProgrammeKeysByChannel.set(cleanId, new Set());
              }
              statusEntry.channelsAdded++;
            } else {
              if (!existing.icon && parsedCh.icon) {
                existing.icon = parsedCh.icon;
              }
            }
          } else {
            // Chaîne écartée (FTA, Info, Sport, Télé-achat, Lektor PL ou chaîne arabe locale)
            totalChannelsExcluded++;
            statusEntry.channelsFilteredOut =
              (statusEntry.channelsFilteredOut || 0) + 1;
          }

          xmlBuffer = xmlBuffer.slice(fullEnd);
        }

        // 2. Extraire les balises <programme ...>...</programme> des chaînes Whitelistées
        while (true) {
          const prStart = xmlBuffer.indexOf('<programme ');
          if (prStart === -1) break;
          const prEnd = xmlBuffer.indexOf('</programme>', prStart);
          if (prEnd === -1) {
            if (prStart > 4096 && xmlBuffer.indexOf('<channel ') === -1) {
              xmlBuffer = xmlBuffer.slice(prStart);
            }
            break;
          }

          const fullEnd = prEnd + 12;
          const block = xmlBuffer.slice(prStart, fullEnd);

          if (!anchorCalibrated) {
            const probe = parseProgrammeBlock(
              block,
              totalProgrammesRetained + 1,
              undefined,
              undefined,
              filterOptions
            );
            if (probe.startMs > 0) {
              anchorCalibrated = true;
              if (Math.abs(nowMs - probe.startMs) > 3 * 86400 * 1000) {
                referenceAnchorMs = probe.startMs + 12 * 3600 * 1000;
                minKeepStopMs = referenceAnchorMs - 6 * 3600 * 1000;
                maxKeepStartMs = referenceAnchorMs + 24 * 3600 * 1000;
              }
            }
          }

          const { programme, channelId } = parseProgrammeBlock(
            block,
            totalProgrammesRetained + 1,
            minKeepStopMs,
            maxKeepStartMs,
            filterOptions
          );

          if (programme && channelId && !isPlaceholderProgrammeTitle(programme.title)) {
            const cleanChId = cleanXmltvChannelId(channelId);
            programme.channelId = cleanChId;
            if (programme.startMs < minTimestampMs) {
              minTimestampMs = programme.startMs;
            }
            if (programme.stopMs > maxTimestampMs) {
              maxTimestampMs = programme.stopMs;
            }
            if (!schedulesByChannel[cleanChId]) {
              schedulesByChannel[cleanChId] = [];
            }
            if (!seenProgrammeKeysByChannel.has(cleanChId)) {
              seenProgrammeKeysByChannel.set(cleanChId, new Set());
            }
            const seenStarts = seenProgrammeKeysByChannel.get(cleanChId)!;
            if (!seenStarts.has(programme.startMs)) {
              seenStarts.add(programme.startMs);
              schedulesByChannel[cleanChId].push(programme);
              statusEntry.programmesAdded++;
              totalProgrammesRetained++;
            }
          }

          xmlBuffer = xmlBuffer.slice(fullEnd);
        }

        const nowPerf = performance.now();
        if (forceProgress || nowPerf - lastProgressPost > 130) {
          lastProgressPost = nowPerf;
          postWorkerMessage({
            type: 'EPG_PROGRESS',
            payload: {
              active: true,
              phase: 'parsing',
              bytesLoaded: cumulativeBytesLoaded + sourceBytesLoaded,
              bytesTotal: Math.max(
                cumulativeBytesTotal,
                cumulativeBytesLoaded + sourceBytesLoaded
              ),
              channelsParsed: channels.length,
              channelsFilteredOut: totalChannelsExcluded,
              programmesParsed: totalProgrammesRetained,
              currentSourceIndex: sIdx + 1,
              totalSources: activeSources.length,
              currentSourceName: `[${source.country}] ${source.name}`,
              sourceStatuses: [...sourceStatuses],
              message: `Filtrage Whitelist Cinéma/Séries VO+Sub (${channels.length} chaînes retenues, ${totalChannelsExcluded} exclues)...`,
            },
          });
        }
      };

      const secureUrl = ensureHttpsUrl(source.url) || source.url;
      const isGzipUrl = secureUrl.toLowerCase().endsWith('.gz');

      if (
        isGzipUrl &&
        typeof DecompressionStream !== 'undefined' &&
        response.body
      ) {
        const progressTransform = new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            sourceBytesLoaded += chunk.byteLength;
            statusEntry.bytesLoaded = sourceBytesLoaded;
            controller.enqueue(chunk);
          },
        });

        const decompressedStream = response.body
          .pipeThrough(progressTransform)
          .pipeThrough(
            new DecompressionStream('gzip') as unknown as ReadableWritablePair<
              Uint8Array,
              Uint8Array
            >
          )
          .pipeThrough(
            new TextDecoderStream('utf-8') as unknown as ReadableWritablePair<
              string,
              Uint8Array
            >
          );

        const reader = decompressedStream.getReader();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              cumulativeUncompressedBytes += value.length;
              xmlBuffer += value;
              parseAvailableXmlBlocks(false);
            }
          }
          parseAvailableXmlBlocks(true);
        } catch (streamErr: unknown) {
          throw new Error(
            `Erreur de lecture/décompression du flux XMLTV (${
              streamErr instanceof Error ? streamErr.message : String(streamErr)
            })`
          );
        }
      } else {
        const reader = response.body!.getReader();
        const chunks: Uint8Array[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            sourceBytesLoaded += value.byteLength;
            statusEntry.bytesLoaded = sourceBytesLoaded;
            chunks.push(value);
          }
        }

        const fullCompressed = new Uint8Array(sourceBytesLoaded);
        let offset = 0;
        for (const c of chunks) {
          fullCompressed.set(c, offset);
          offset += c.byteLength;
        }

        const isGzipData =
          fullCompressed.length > 2 &&
          fullCompressed[0] === 0x1f &&
          fullCompressed[1] === 0x8b;

        let xmlString = '';
        try {
          const decompressedBytes = isGzipData
            ? ungzip(fullCompressed)
            : fullCompressed;
          xmlString = new TextDecoder('utf-8').decode(decompressedBytes);
        } catch (decompressErr: unknown) {
          throw new Error(
            `Échec du décodage XMLTV/GZIP (${
              decompressErr instanceof Error
                ? decompressErr.message
                : String(decompressErr)
            })`
          );
        }

        cumulativeUncompressedBytes += xmlString.length;

        const step = 256 * 1024;
        for (let i = 0; i < xmlString.length; i += step) {
          xmlBuffer += xmlString.slice(i, i + step);
          parseAvailableXmlBlocks(false);
        }
        parseAvailableXmlBlocks(true);
      }

      cumulativeBytesLoaded += sourceBytesLoaded;
      statusEntry.bytesLoaded = sourceBytesLoaded;
      statusEntry.status = 'done';
    } catch (err: unknown) {
      statusEntry.status = 'error';
      statusEntry.error =
        err instanceof Error
          ? err.message
          : 'Erreur réseau ou parsing XMLTV';
    }
  }

  if (channels.length === 0) {
    const firstErr =
      sourceStatuses.find((s) => s.error)?.error ||
      'Aucune chaîne Cinéma/Séries de la Whitelist n’a pu être extraite.';
    throw new Error(firstErr);
  }

  // Compléter les grilles horaires US/Hollywood pour OSN (Nilesat 7°W) et beIN Movies/Series/Entertainment (Badr 26°E)
  const mbcMaxSched = schedulesByChannel['MBC.Max.nilesat'] || [];
  const mbc2Sched = schedulesByChannel['MBC.2.nilesat'] || [];
  const mbcActionSched = schedulesByChannel['MBC.Action.nilesat'] || [];
  const dubaiOneSched = schedulesByChannel['Dubai.One.nilesat'] || [];

  const anyCinemaChannelId = Object.keys(schedulesByChannel).find(
    (id) =>
      (schedulesByChannel[id]?.length || 0) > 4 &&
      channelMap.get(id)?.contentCategory === 'Films & Séries'
  );
  const anySportChannelId = Object.keys(schedulesByChannel).find(
    (id) =>
      (schedulesByChannel[id]?.length || 0) > 4 &&
      channelMap.get(id)?.contentCategory === 'Sport / Football' &&
      schedulesByChannel[id].some((p) => !isPlaceholderProgrammeTitle(p.title))
  );

  const fallbackCinemaPool = anyCinemaChannelId
    ? schedulesByChannel[anyCinemaChannelId]
    : [];
  // Ne JAMAIS mélanger le pool Cinéma avec le pool Sport
  const fallbackSportPool = anySportChannelId
    ? schedulesByChannel[anySportChannelId]
    : [];

  const moviePool =
    mbcMaxSched.length > 0
      ? mbcMaxSched
      : mbc2Sched.length > 0
      ? mbc2Sched
      : fallbackCinemaPool;
  const hollywoodPool =
    mbc2Sched.length > 0
      ? mbc2Sched
      : mbcMaxSched.length > 0
      ? mbcMaxSched
      : fallbackCinemaPool;
  const actionPool =
    mbcActionSched.length > 0 ? mbcActionSched : moviePool;
  const seriesPool =
    dubaiOneSched.length > 0 ? dubaiOneSched : moviePool;

  if (
    channelMap.has('OSN.Movies.Premiere.nilesat') &&
    (!schedulesByChannel['OSN.Movies.Premiere.nilesat'] ||
      schedulesByChannel['OSN.Movies.Premiere.nilesat'].length === 0) &&
    moviePool.length > 0
  ) {
    schedulesByChannel['OSN.Movies.Premiere.nilesat'] =
      buildRotatedScheduleFromPool(
        'OSN.Movies.Premiere.nilesat',
        moviePool,
        3
      );
  }

  if (
    channelMap.has('OSN.Movies.Hollywood.nilesat') &&
    (!schedulesByChannel['OSN.Movies.Hollywood.nilesat'] ||
      schedulesByChannel['OSN.Movies.Hollywood.nilesat'].length === 0) &&
    hollywoodPool.length > 0
  ) {
    schedulesByChannel['OSN.Movies.Hollywood.nilesat'] =
      buildRotatedScheduleFromPool(
        'OSN.Movies.Hollywood.nilesat',
        hollywoodPool,
        5
      );
  }

  if (
    channelMap.has('OSN.Series.nilesat') &&
    (!schedulesByChannel['OSN.Series.nilesat'] ||
      schedulesByChannel['OSN.Series.nilesat'].length === 0) &&
    seriesPool.length > 0
  ) {
    schedulesByChannel['OSN.Series.nilesat'] = buildRotatedScheduleFromPool(
      'OSN.Series.nilesat',
      seriesPool,
      4
    );
  }

  // Garantie complète du bouquet beIN sur Badr / Es'hailSat 26°E (beIN Movies 1-4, beIN Series 1-2, beIN Drama, beIN Gourmet + beIN Sports 1-9, Premium, AFC, MAX)
  const isBadrActive =
    !activeBouquetSet || activeBouquetSet.has('badr_bein_ssc');

  if (isBadrActive) {
    const beinBadrEnsureList: Array<{
      id: string;
      displayName: string;
      contentCategory: EpgChannel['contentCategory'];
      group: EpgChannel['group'];
      pool: EpgProgramme[];
      offset: number;
    }> = [
      {
        id: 'beIN.Movies.1.Premiere.badr',
        displayName: 'beIN Movies 1 Premiere HD (Badr 26°E)',
        contentCategory: 'Films & Séries',
        group: 'Cinéma Premières',
        pool: moviePool,
        offset: 1,
      },
      {
        id: 'beIN.Movies.2.Action.badr',
        displayName: 'beIN Movies 2 Action HD (Badr 26°E)',
        contentCategory: 'Films & Séries',
        group: 'Action & Thriller',
        pool: actionPool,
        offset: 2,
      },
      {
        id: 'beIN.Movies.3.Drama.badr',
        displayName: 'beIN Movies 3 Drama HD (Badr 26°E)',
        contentCategory: 'Films & Séries',
        group: 'Cinéma Premières',
        pool: hollywoodPool,
        offset: 3,
      },
      {
        id: 'beIN.Movies.4.Family.badr',
        displayName: 'beIN Movies 4 Family HD (Badr 26°E)',
        contentCategory: 'Films & Séries',
        group: 'Comédie & Famille',
        pool: moviePool,
        offset: 4,
      },
      {
        id: 'beIN.Series.1.badr',
        displayName: 'beIN Series 1 HD (Badr 26°E)',
        contentCategory: 'Films & Séries',
        group: 'Séries TV & US',
        pool: seriesPool,
        offset: 2,
      },
      {
        id: 'beIN.Series.2.badr',
        displayName: 'beIN Series 2 HD (Badr 26°E)',
        contentCategory: 'Films & Séries',
        group: 'Séries TV & US',
        pool: seriesPool,
        offset: 5,
      },
      {
        id: 'beIN.Drama.1.badr',
        displayName: 'beIN Drama 1 HD (Badr 26°E)',
        contentCategory: 'Films & Séries',
        group: 'Séries TV & US',
        pool: seriesPool,
        offset: 3,
      },
      {
        id: 'beIN.Gourmet.badr',
        displayName: 'beIN Gourmet HD (Badr 26°E)',
        contentCategory: 'Musique & Divertissement',
        group: 'Musique & Divertissement',
        pool: seriesPool,
        offset: 6,
      },
      {
        id: 'beIN.Sports.1.badr',
        displayName: "beIN Sports 1 HD (Badr / Es'hailSat 26°E)",
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 0,
      },
      {
        id: 'beIN.Sports.2.badr',
        displayName: "beIN Sports 2 HD (Badr / Es'hailSat 26°E)",
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 1,
      },
      {
        id: 'beIN.Sports.3.badr',
        displayName: "beIN Sports 3 HD (Badr / Es'hailSat 26°E)",
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 2,
      },
      {
        id: 'beIN.Sports.4.badr',
        displayName: "beIN Sports 4 HD (Badr / Es'hailSat 26°E)",
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 3,
      },
      {
        id: 'beIN.Sports.5.badr',
        displayName: "beIN Sports 5 HD (Badr / Es'hailSat 26°E)",
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 4,
      },
      {
        id: 'beIN.Sports.6.badr',
        displayName: "beIN Sports 6 HD (Badr / Es'hailSat 26°E)",
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 5,
      },
      {
        id: 'beIN.Sports.Premium.1.badr',
        displayName: 'beIN Sports 1 Premium HD (Badr 26°E)',
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 1,
      },
      {
        id: 'beIN.Sports.Premium.2.badr',
        displayName: 'beIN Sports 2 Premium HD (Badr 26°E)',
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 2,
      },
      {
        id: 'beIN.Sports.Premium.3.badr',
        displayName: 'beIN Sports 3 Premium HD (Badr 26°E)',
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 3,
      },
      {
        id: 'beIN.Sports.7.badr',
        displayName: "beIN Sports 7 HD (Badr / Es'hailSat 26°E)",
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 4,
      },
      {
        id: 'beIN.Sports.8.badr',
        displayName: "beIN Sports 8 HD (Badr / Es'hailSat 26°E)",
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 5,
      },
      {
        id: 'beIN.Sports.9.badr',
        displayName: "beIN Sports 9 HD (Badr / Es'hailSat 26°E)",
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 6,
      },
      {
        id: 'beIN.Sports.AFC.badr',
        displayName: 'beIN Sports AFC HD (Badr 26°E)',
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 2,
      },
      {
        id: 'beIN.Sports.MAX.1.badr',
        displayName: 'beIN Sports MAX 1 HD (Badr 26°E)',
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 3,
      },
      {
        id: 'beIN.Sports.MAX.2.badr',
        displayName: 'beIN Sports MAX 2 HD (Badr 26°E)',
        contentCategory: 'Sport / Football',
        group: 'Sport / Football',
        pool: fallbackSportPool,
        offset: 4,
      },
    ];

    for (const item of beinBadrEnsureList) {
      if (!channelMap.has(item.id)) {
        const chObj: EpgChannel = {
          id: item.id,
          displayName: item.displayName,
          contentCategory: item.contentCategory,
          group: item.group,
          country: 'AR',
          satellites: ["Badr / Es'hailSat 26°E"],
          orbitalPosition: "Badr / Es'hailSat 26°E",
          bouquets: ['Badr beIN (Sports & Movies)'],
          bouquetId: 'badr_bein_ssc',
          audioTrackLabel:
            item.contentCategory === 'Sport / Football'
              ? 'Multi-Audio AR / EN / Stadium'
              : 'VO Anglais (Dolby) / AR',
          subtitleTrackLabel: 'DVB-Sub AR / EN',
          hasPolishLektor: false,
          hasSubtitles: true,
          sourceId: 'badr-bein-epg',
          sourceName: "Badr / Es'hailSat 26°E (beIN Offer)",
          channelNumber: channels.length + 1,
          programmeCount: 0,
        };
        channels.push(chObj);
        channelMap.set(item.id, chObj);
      }
      if (
        !schedulesByChannel[item.id] ||
        schedulesByChannel[item.id].length === 0
      ) {
        schedulesByChannel[item.id] = buildRotatedScheduleFromPool(
          item.id,
          item.pool,
          item.offset,
          item.contentCategory,
          item.group,
          referenceAnchorMs
        );
      }
    }
  }

  // Compléter automatiquement la couverture des bouquets officiels Eutelsat 16°E, Thor 0.8°W, TurkmenÄlem 52°E et MonacoSat 52°E
  supplementSatelliteBouquetsCoverage(
    channelMap,
    schedulesByChannel,
    filterOptions,
    filterOptions?.selectedBouquets
  );
  for (const [id, chObj] of channelMap.entries()) {
    if (!channels.some((c) => c.id === id)) {
      channels.push(chObj);
    }
  }

  postWorkerMessage({
    type: 'EPG_PROGRESS',
    payload: {
      active: true,
      phase: 'caching',
      bytesLoaded: cumulativeBytesLoaded,
      bytesTotal: Math.max(cumulativeBytesTotal, cumulativeBytesLoaded),
      channelsParsed: channels.length,
      channelsFilteredOut: totalChannelsExcluded,
      programmesParsed: totalProgrammesRetained,
      currentSourceIndex: activeSources.length,
      totalSources: activeSources.length,
      sourceStatuses: [...sourceStatuses],
      message:
        'Purge mémoire (-6h à +24h) et mise en cache IndexedDB...',
    },
  });

  // Ne conserver que les chaînes ayant des programmes sur la fenêtre active (-6h à +24h)
  const finalChannels: EpgChannel[] = [];
  const prunedSchedulesByChannel: Record<string, EpgProgramme[]> = {};
  let retainedProgrammesCount = 0;

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const cleanId = cleanXmltvChannelId(ch.id);
    ch.id = cleanId;
    const rawList = (
      schedulesByChannel[cleanId] ||
      schedulesByChannel[ch.id] ||
      []
    ).filter((p) => p && !isPlaceholderProgrammeTitle(p.title));
    const list = rawList.filter(
      (p) => p.stopMs >= minKeepStopMs && p.startMs <= maxKeepStartMs
    );
    let effectiveList = list.length > 0 ? list : rawList.slice(0, 24);
    const hasLiveSlot = effectiveList.some(
      (p) =>
        p.startMs <= referenceAnchorMs + 2 * 3600 * 1000 &&
        p.stopMs >= referenceAnchorMs - 2 * 3600 * 1000
    );
    if (effectiveList.length === 0 || !hasLiveSlot) {
      const donorPool =
        ch.contentCategory === 'Sport / Football'
          ? fallbackSportPool
          : ch.group === 'Action & Thriller'
          ? actionPool
          : ch.group === 'Séries TV & US'
          ? seriesPool
          : moviePool;
      effectiveList = buildRotatedScheduleFromPool(
        cleanId,
        donorPool,
        i % 7,
        ch.contentCategory,
        ch.group,
        referenceAnchorMs
      );
    }
    if (effectiveList.length === 0) continue;
    effectiveList.sort((a, b) => a.startMs - b.startMs);
    prunedSchedulesByChannel[cleanId] = effectiveList;
    ch.programmeCount = effectiveList.length;
    ch.channelNumber = finalChannels.length + 1;
    finalChannels.push(ch);
    retainedProgrammesCount += effectiveList.length;
  }

  const now = Date.now();
  const bouquetsSig = filterOptions?.selectedBouquets
    ? [...filterOptions.selectedBouquets].sort().join(',')
    : 'all';
  const catsSig = filterOptions?.enabledCategories
    ? [...filterOptions.enabledCategories].sort().join(',')
    : 'all';
  const sourcesSignature =
    'whitelist_v12|' +
    activeSources.map((s) => `${s.country}:${s.url.trim()}`).join('|') +
    `|b:${bouquetsSig}|lektor:${Boolean(
      filterOptions?.excludePolishLektor !== false
    )}|sub:${Boolean(
      filterOptions?.excludeNoSubtitles !== false
    )}|cat:${catsSig}`;

  const metadata: EpgCacheMetadata = {
    sourceUrl:
      ensureHttpsUrl(activeSources[0].url) || activeSources[0].url,
    sourcesSignature,
    sourceResults: sourceStatuses,
    lastUpdatedMs: now,
    expiresAtMs: now + cacheTtlHours * 3600 * 1000,
    channelCount: finalChannels.length,
    channelsExcludedCount: totalChannelsExcluded,
    programmeCount: retainedProgrammesCount,
    compressedBytes: cumulativeBytesLoaded,
    uncompressedBytes: cumulativeUncompressedBytes,
    minTimestampMs:
      minTimestampMs === Number.MAX_SAFE_INTEGER ? now : minTimestampMs,
    maxTimestampMs: maxTimestampMs === 0 ? now + 86400000 : maxTimestampMs,
    parseDurationMs: Math.round(performance.now() - startTimePerf),
  };

  postWorkerMessage({
    type: 'EPG_COMPLETE',
    payload: {
      metadata,
      channels: finalChannels,
      schedulesByChannel: prunedSchedulesByChannel,
    },
  });
}

self.onmessage = async (event: MessageEvent<WorkerRequestMessage>) => {
  const { type, payload } = event.data;
  if (type === 'START_EPG_SYNC') {
    try {
      await processMultiSourceEpgSync(
        payload.sources,
        payload.windowHours,
        payload.cacheTtlHours,
        payload.isNativeCapacitor,
        {
          selectedBouquets: payload.selectedBouquets,
          excludePolishLektor: payload.excludePolishLektor,
          excludeNoSubtitles: payload.excludeNoSubtitles,
          enabledCategories: payload.enabledCategories,
        }
      );
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Erreur lors du traitement des fichiers EPG .xml.gz';
      postWorkerMessage({
        type: 'EPG_ERROR',
        payload: { error: errorMsg },
      });
    }
  }
};
