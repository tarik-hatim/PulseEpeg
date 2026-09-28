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
  parseChannelBlock,
  parseProgrammeBlock,
  XmltvFilterOptions,
} from '../utils/xmltvParser';

declare const self: DedicatedWorkerGlobalScope;

function postWorkerMessage(msg: WorkerResponseMessage) {
  self.postMessage(msg);
}

/**
 * Télécharge le flux .xml.gz en essayant la requête directe (Capacitor APK)
 * ou le proxy de streaming (Web), avec suivi précis des octets téléchargés.
 */
async function fetchEpgResponse(
  sourceUrl: string,
  isNativeCapacitor: boolean
): Promise<Response> {
  const proxyUrl = `/api/epg-proxy?url=${encodeURIComponent(sourceUrl)}`;
  const urlsToTry = isNativeCapacitor
    ? [sourceUrl, proxyUrl]
    : [proxyUrl, sourceUrl];

  let lastError: Error | null = null;

  for (const url of urlsToTry) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept:
            'application/octet-stream, application/x-gzip, text/xml, */*',
        },
      });
      if (response.ok && response.body) {
        return response;
      }
      lastError = new Error(
        `Statut HTTP ${response.status} (${response.statusText})`
      );
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError || new Error(`Impossible de télécharger ${sourceUrl}`);
}

/**
 * Construit une grille cinéma/séries décalée pour les canaux OSN Nilesat dont l'EPG XML
 * ne contient que l'en-tête <channel> dans SA1, à partir du pool de films/séries US en VO.
 */
function buildRotatedScheduleFromPool(
  targetChannelId: string,
  sourceProgrammes: EpgProgramme[],
  rotationOffset: number
): EpgProgramme[] {
  if (!sourceProgrammes || sourceProgrammes.length === 0) return [];
  const count = sourceProgrammes.length;
  const result: EpgProgramme[] = [];

  for (let i = 0; i < count; i++) {
    const donorTime = sourceProgrammes[i];
    const donorContent = sourceProgrammes[(i + rotationOffset) % count];
    result.push({
      ...donorContent,
      id: `${targetChannelId}_${donorTime.startMs}_${i}`,
      channelId: targetChannelId,
      startMs: donorTime.startMs,
      stopMs: donorTime.stopMs,
      hasOriginalAudioVO: true,
      hasSubtitles: true,
    });
  }
  return result;
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
      return activeBouquetSet.has(s.bouquetId);
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
    url: s.url,
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
  let minKeepStopMs = referenceAnchorMs - 36 * 3600 * 1000;
  let maxKeepStartMs =
    referenceAnchorMs + Math.max(72, windowHours) * 3600 * 1000;

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
            const existing = channelMap.get(parsedCh.id);
            if (!existing) {
              channels.push(parsedCh);
              channelMap.set(parsedCh.id, parsedCh);
              schedulesByChannel[parsedCh.id] = [];
              seenProgrammeKeysByChannel.set(parsedCh.id, new Set());
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
                minKeepStopMs = referenceAnchorMs - 36 * 3600 * 1000;
                maxKeepStartMs =
                  referenceAnchorMs + Math.max(72, windowHours) * 3600 * 1000;
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

          if (programme && channelId) {
            if (programme.startMs < minTimestampMs) {
              minTimestampMs = programme.startMs;
            }
            if (programme.stopMs > maxTimestampMs) {
              maxTimestampMs = programme.stopMs;
            }
            if (!schedulesByChannel[channelId]) {
              schedulesByChannel[channelId] = [];
              seenProgrammeKeysByChannel.set(channelId, new Set());
            }
            const seenStarts = seenProgrammeKeysByChannel.get(channelId)!;
            if (!seenStarts.has(programme.startMs)) {
              seenStarts.add(programme.startMs);
              schedulesByChannel[channelId].push(programme);
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

      const isGzipUrl = source.url.toLowerCase().endsWith('.gz');

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

        const decompressedBytes = isGzipData
          ? ungzip(fullCompressed)
          : fullCompressed;
        const xmlString = new TextDecoder('utf-8').decode(decompressedBytes);

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
        err instanceof Error ? err.message : 'Erreur de téléchargement';
    }
  }

  if (channels.length === 0) {
    const firstErr =
      sourceStatuses.find((s) => s.error)?.error ||
      'Aucune chaîne Cinéma/Séries de la Whitelist n’a pu être extraite.';
    throw new Error(firstErr);
  }

  // Compléter les grilles horaires US/Hollywood pour les 3 canaux OSN Nilesat
  // si le flux SA1 ne fournit que leurs métadonnées de chaîne
  const mbcMaxSched = schedulesByChannel['MBC.Max.nilesat'] || [];
  const mbc2Sched = schedulesByChannel['MBC.2.nilesat'] || [];
  const dubaiOneSched = schedulesByChannel['Dubai.One.nilesat'] || [];

  const moviePool = mbcMaxSched.length > 0 ? mbcMaxSched : mbc2Sched;
  const hollywoodPool = mbc2Sched.length > 0 ? mbc2Sched : mbcMaxSched;
  const seriesPool = dubaiOneSched.length > 0 ? dubaiOneSched : moviePool;

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
        'Tri chronologique de la Whitelist (Films/Séries + Football) et mise en cache IndexedDB...',
    },
  });

  // Ne conserver que les chaînes Whitelistées ayant effectivement des programmes
  const finalChannels: EpgChannel[] = [];
  let retainedProgrammesCount = 0;

  for (let i = 0; i < channels.length; i++) {
    const ch = channels[i];
    const list = schedulesByChannel[ch.id] || [];
    if (list.length === 0) continue;
    list.sort((a, b) => a.startMs - b.startMs);
    ch.programmeCount = list.length;
    ch.channelNumber = finalChannels.length + 1;
    finalChannels.push(ch);
    retainedProgrammesCount += list.length;
  }

  const now = Date.now();
  const bouquetsSig = filterOptions?.selectedBouquets
    ? [...filterOptions.selectedBouquets].sort().join(',')
    : 'all';
  const catsSig = filterOptions?.enabledCategories
    ? [...filterOptions.enabledCategories].sort().join(',')
    : 'all';
  const sourcesSignature =
    'whitelist_v6|' +
    activeSources.map((s) => `${s.country}:${s.url.trim()}`).join('|') +
    `|b:${bouquetsSig}|lektor:${Boolean(
      filterOptions?.excludePolishLektor !== false
    )}|sub:${Boolean(
      filterOptions?.excludeNoSubtitles !== false
    )}|cat:${catsSig}`;

  const metadata: EpgCacheMetadata = {
    sourceUrl: activeSources[0].url,
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
      schedulesByChannel,
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
