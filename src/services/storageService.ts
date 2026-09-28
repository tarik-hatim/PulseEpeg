import {
  AppSettings,
  EpgCacheMetadata,
  EpgChannel,
  EpgProgramme,
  EpgSourceItem,
  ProgrammeReminder,
} from '../types/epg';

const DB_NAME = 'PulseEpgCacheDB';
const DB_VERSION = 1;
const SNAPSHOT_STORE = 'epg_snapshots';
const SNAPSHOT_KEY = 'active_epg_whitelist_v5';

const LS_META_KEY = 'pulse_epg_meta_v5';
const LS_SETTINGS_KEY = 'pulse_epg_settings_v5';
const LS_FAVORITES_KEY = 'pulse_epg_favorites_v1';
const LS_REMINDERS_KEY = 'pulse_epg_reminders_v1';

export const DEFAULT_EPG_SOURCE_URL =
  'https://epgshare01.online/epgshare01/epg_ripper_PL1.xml.gz';

export const DEFAULT_EPG_SOURCES: EpgSourceItem[] = [
  {
    id: 'src_pl1',
    name: 'Hotbird 13°E · Pologne Cinéma VO Sans Lektor (HBO, Cinemax, AXN, Canal+ Film, FilmBox) & Football (Canal+ Sport, Eleven Sports)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_PL1.xml.gz',
    country: 'PL',
    enabled: true,
  },
  {
    id: 'src_es1',
    name: 'Hispasat 30°W / Astra 19.2°E · Movistar+ Cinéma/Séries VO & Football (M+ LaLiga, Liga de Campeones, DAZN ES)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_ES1.xml.gz',
    country: 'ES',
    enabled: true,
  },
  {
    id: 'src_de1',
    name: 'Astra 19.2°E · Allemagne / Sky DE Cinéma/Séries VO & Football (Sky Sport Premier League, Bundesliga, DAZN DE)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_DE1.xml.gz',
    country: 'DE',
    enabled: true,
  },
  {
    id: 'src_it1',
    name: 'Hotbird 13°E · Sky Italia Cinéma/Séries VO & Football (Sky Sport Calcio, Uno, Max, Arena, DAZN IT)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_IT1.xml.gz',
    country: 'IT',
    enabled: true,
  },
  {
    id: 'src_ae1',
    name: 'Nilesat 7°W · US Movies VO (MBC 2, MBC Action, Dubai One) & Football (AD Sports 1/2/Extra HD)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_AE1.xml.gz',
    country: 'AR',
    enabled: true,
  },
  {
    id: 'src_sa2',
    name: 'Nilesat 7°W · Hollywood Movies VO (MBC Max, OSN Action) & Football (SSC 1/2/3/4/5/Extra HD)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_SA2.xml.gz',
    country: 'AR',
    enabled: true,
  },
  {
    id: 'src_sa1',
    name: 'Nilesat 7°W · Bouquet OSN TV (OSN Movies Premiere, Action, Hollywood, OSN Series)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_SA1.xml.gz',
    country: 'AR',
    enabled: true,
  },
  {
    id: 'src_bein1',
    name: 'Nilesat 7°W · Bouquet beIN Sports MENA (beIN Sports 1–7 HD, English 1–2, French 1–2, Max, Xtra)',
    url: 'https://epgshare01.online/epgshare01/epg_ripper_BEIN1.xml.gz',
    country: 'AR',
    enabled: true,
  },
];

export const PRESET_EPG_CATALOG: Omit<EpgSourceItem, 'id' | 'enabled'>[] = [
  ...DEFAULT_EPG_SOURCES.map(({ name, url, country }) => ({
    name,
    url,
    country,
  })),
];

export const DEFAULT_SETTINGS: AppSettings = {
  sourceUrl: DEFAULT_EPG_SOURCE_URL,
  sources: DEFAULT_EPG_SOURCES,
  cacheTtlHours: 12,
  windowHours: 48,
  theme: 'dark',
};

export function buildSourcesSignature(sources: EpgSourceItem[]): string {
  return (
    'whitelist_v5|' +
    sources
      .filter((s) => s.enabled && s.url.trim().length > 0)
      .map((s) => `${s.country}:${s.url.trim()}`)
      .join('|')
  );
}

export interface StoredEpgSnapshot {
  id: string;
  metadata: EpgCacheMetadata;
  channels: EpgChannel[];
  schedulesByChannel: Record<string, EpgProgramme[]>;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB non disponible sur cet appareil.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SNAPSHOT_STORE)) {
        db.createObjectStore(SNAPSHOT_STORE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error || new Error("Impossible d'ouvrir IndexedDB."));
  });
}

/**
 * Sauvegarde les données EPG multi-sources filtrées (Whitelist Cinéma/Séries) dans IndexedDB
 */
export async function saveEpgToCache(
  metadata: EpgCacheMetadata,
  channels: EpgChannel[],
  schedulesByChannel: Record<string, EpgProgramme[]>
): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LS_META_KEY, JSON.stringify(metadata));
    }
  } catch {
    // Ignore quota errors on localStorage
  }

  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
    const store = tx.objectStore(SNAPSHOT_STORE);

    const payload: StoredEpgSnapshot = {
      id: SNAPSHOT_KEY,
      metadata,
      channels,
      schedulesByChannel,
    };

    store.put(payload);

    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Erreur écriture IndexedDB'));
    };
  });
}

/**
 * Charge les données EPG depuis IndexedDB si elles existent
 */
export async function loadEpgFromCache(): Promise<StoredEpgSnapshot | null> {
  try {
    const db = await openDatabase();
    return await new Promise<StoredEpgSnapshot | null>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readonly');
      const store = tx.objectStore(SNAPSHOT_STORE);
      const req = store.get(SNAPSHOT_KEY);

      req.onsuccess = () => {
        db.close();
        const result = req.result as StoredEpgSnapshot | undefined;
        if (result && result.metadata && Array.isArray(result.channels)) {
          resolve(result);
        } else {
          resolve(null);
        }
      };

      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch {
    return null;
  }
}

/**
 * Supprime toutes les données EPG en cache (IndexedDB + LocalStorage)
 */
export async function clearEpgCache(): Promise<void> {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(LS_META_KEY);
    }
  } catch {
    // Ignore
  }

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, 'readwrite');
      const store = tx.objectStore(SNAPSHOT_STORE);
      store.delete(SNAPSHOT_KEY);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  } catch {
    // Ignore
  }
}

export function loadAppSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(LS_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    const sanitizedSources = Array.isArray(parsed.sources)
      ? parsed.sources.filter(
          (s) =>
            (s.country as string) !== 'GR' &&
            !s.url.toLowerCase().includes('epg_ripper_gr') &&
            !s.url.toLowerCase().includes('epg_ripper_ar1')
        )
      : [];
    const sources =
      sanitizedSources.length > 0 ? sanitizedSources : DEFAULT_EPG_SOURCES;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      sources,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveAppSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Ignore
  }
}

export function loadFavoriteChannels(): string[] {
  try {
    const raw = localStorage.getItem(LS_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFavoriteChannels(channelIds: string[]): void {
  try {
    localStorage.setItem(LS_FAVORITES_KEY, JSON.stringify(channelIds));
  } catch {
    // Ignore
  }
}

export function loadReminders(): ProgrammeReminder[] {
  try {
    const raw = localStorage.getItem(LS_REMINDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveReminders(reminders: ProgrammeReminder[]): void {
  try {
    localStorage.setItem(LS_REMINDERS_KEY, JSON.stringify(reminders));
  } catch {
    // Ignore
  }
}
