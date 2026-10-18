/**
 * Service de gestion du catalogue des 13 satellites et des transpondeurs (Fréquence, Pol, SR, Cryptage).
 * Basé sur le catalogue catalog.json extrait de satellite-stream-buddy.
 */

export interface CatalogSatellite {
  index: number;
  name: string;
  position: number;
  formattedPosition: string;
  coverage: string[];
}

export const SATELLITES_13: readonly CatalogSatellite[] = [
  { index: 0, name: 'Astra 1', position: 19.2, formattedPosition: '19.2°E', coverage: ['EU', 'MENA'] },
  { index: 1, name: 'Badr 4/5/6/7', position: 26.0, formattedPosition: '26.0°E', coverage: ['MENA', 'GULF'] },
  { index: 2, name: 'Hotbird', position: 13.0, formattedPosition: '13.0°E', coverage: ['EU', 'MENA'] },
  { index: 3, name: 'Eutelsat 7B/7C', position: 7.0, formattedPosition: '7.0°E', coverage: ['EU', 'MENA', 'AFRICA'] },
  { index: 4, name: 'TurkmenÄlem/MonacoSat', position: 52.0, formattedPosition: '52.0°E', coverage: ['MENA', 'EU', 'CASIA'] },
  { index: 5, name: 'Astra 2', position: 28.2, formattedPosition: '28.2°E', coverage: ['UK', 'EU'] },
  { index: 6, name: 'Star One D2', position: -70.0, formattedPosition: '70.0°W', coverage: ['LATAM'] },
  { index: 7, name: 'Türksat 3A/4A', position: 42.0, formattedPosition: '42.0°E', coverage: ['TR', 'EU', 'MENA'] },
  { index: 8, name: 'Hispasat 30W', position: -30.0, formattedPosition: '30.0°W', coverage: ['EU', 'LATAM'] },
  { index: 9, name: 'Astra 3B', position: 23.5, formattedPosition: '23.5°E', coverage: ['EU'] },
  { index: 10, name: 'SES 6', position: -40.5, formattedPosition: '40.5°W', coverage: ['LATAM', 'NA'] },
  { index: 11, name: 'Nilesat 201', position: -7.0, formattedPosition: '7.0°W', coverage: ['MENA', 'AFRICA'] },
  { index: 12, name: 'Amazonas 2', position: -61.0, formattedPosition: '61.0°W', coverage: ['LATAM'] },
] as const;

export interface TransponderChannelInfo {
  id: string;
  name: string;
  isTv: boolean;
  provider: string;
  isEncrypted: boolean;
  languages: string[];
  satelliteIndex: number;
  satelliteName: string;
  frequency: string;
  polarization: string;
  symbolRate: string;
}

type CatalogRawRow = [
  string, // 0: id
  string, // 1: name
  number, // 2: tv
  string, // 3: provider
  number, // 4: ca (1 = crypté, 0 = clair)
  string[], // 5: langs
  number[], // 6: sats (indices)
  string, // 7: freq
  string, // 8: pol
  string, // 9: sr
  string? // 10: zone
];

let catalogCache: Map<string, TransponderChannelInfo> | null = null;
let loadingPromise: Promise<Map<string, TransponderChannelInfo>> | null = null;

const normKey = (s: string) =>
  s.toLowerCase()
    .replace(/\s*(hd|uhd|4k|fhd|sd|\+1|\+2)\b/gi, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();

export async function loadSatelliteCatalog(): Promise<Map<string, TransponderChannelInfo>> {
  if (catalogCache) return catalogCache;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const res = await fetch('/data/catalog.json');
      if (!res.ok) return new Map();
      const data = (await res.json()) as { c?: CatalogRawRow[] };
      const rows = data.c || [];
      const map = new Map<string, TransponderChannelInfo>();

      for (const row of rows) {
        const [id, name, tv, provider, ca, langs, sats, freq, pol, sr] = row;
        const satIdx = sats?.[0] ?? 0;
        const satObj = SATELLITES_13[satIdx] || SATELLITES_13[0];
        const info: TransponderChannelInfo = {
          id,
          name,
          isTv: tv === 1,
          provider: provider || '',
          isEncrypted: ca === 1,
          languages: langs || [],
          satelliteIndex: satIdx,
          satelliteName: satObj.name,
          frequency: freq ? `${freq} MHz` : '',
          polarization: pol || '',
          symbolRate: sr ? `${sr} kS/s` : '',
        };
        map.set(name.toLowerCase(), info);
        map.set(normKey(name), info);
      }

      catalogCache = map;
      return map;
    } catch {
      return new Map();
    }
  })();

  return loadingPromise;
}

export function lookupTransponderSync(channelName: string): TransponderChannelInfo | null {
  if (!catalogCache) return null;
  const exact = catalogCache.get(channelName.toLowerCase());
  if (exact) return exact;
  const normalized = catalogCache.get(normKey(channelName));
  return normalized || null;
}
