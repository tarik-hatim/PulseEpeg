import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  Database,
  Globe,
  Plus,
  RefreshCw,
  RotateCcw,
  Smartphone,
  Trash2,
} from 'lucide-react';
import {
  AppSettings,
  CountryCode,
  EpgCacheMetadata,
  EpgSourceItem,
} from '../types/epg';
import {
  DEFAULT_EPG_SOURCES,
  PRESET_EPG_CATALOG,
} from '../services/storageService';
import {
  formatBytes,
  formatFullDateTime,
  getLocalTimezoneLabel,
} from '../utils/timeFormat';

interface CacheAndCapacitorViewProps {
  metadata: EpgCacheMetadata | null;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings, triggerSync?: boolean) => void;
  onForceRefresh: () => void;
  onClearCache: () => void;
  isSyncing: boolean;
  isLight: boolean;
}

const COUNTRY_OPTIONS: Exclude<CountryCode, 'Tous'>[] = [
  'PL',
  'ES',
  'IT',
  'DE',
  'AR',
  'Autre',
];

export const CacheAndCapacitorView: React.FC<CacheAndCapacitorViewProps> = ({
  metadata,
  settings,
  onUpdateSettings,
  onForceRefresh,
  onClearCache,
  isSyncing,
  isLight,
}) => {
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCountry, setNewCountry] =
    useState<Exclude<CountryCode, 'Tous'>>('PL');
  const [copiedCmd, setCopiedCmd] = useState(false);

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedUrl = newUrl.trim();
    if (!trimmedUrl) return;

    const label =
      newName.trim() ||
      `Source ${newCountry} (${
        trimmedUrl.split('/').pop() || 'Flux XML.GZ'
      })`;

    const newItem: EpgSourceItem = {
      id: `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: label,
      url: trimmedUrl,
      country: newCountry,
      enabled: true,
    };

    const updatedSources = [...settings.sources, newItem];
    setNewName('');
    setNewUrl('');
    onUpdateSettings(
      {
        ...settings,
        sources: updatedSources,
      },
      true
    );
  };

  const handleToggleSource = (id: string) => {
    const updated = settings.sources.map((s) =>
      s.id === id ? { ...s, enabled: !s.enabled } : s
    );
    onUpdateSettings({ ...settings, sources: updated }, false);
  };

  const handleDeleteSource = (id: string) => {
    const updated = settings.sources.filter((s) => s.id !== id);
    onUpdateSettings({ ...settings, sources: updated }, false);
  };

  const handleResetDefaultSources = () => {
    onUpdateSettings(
      {
        ...settings,
        sources: DEFAULT_EPG_SOURCES,
      },
      true
    );
  };

  const handleAddCatalogPreset = (
    preset: Omit<EpgSourceItem, 'id' | 'enabled'>
  ) => {
    const existing = settings.sources.find(
      (s) => s.url.toLowerCase() === preset.url.toLowerCase()
    );
    if (existing) {
      if (!existing.enabled) {
        handleToggleSource(existing.id);
      }
      return;
    }

    const newItem: EpgSourceItem = {
      id: `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: preset.name,
      url: preset.url,
      country: preset.country,
      enabled: true,
    };

    onUpdateSettings(
      {
        ...settings,
        sources: [...settings.sources, newItem],
      },
      false
    );
  };

  const buildCommands = `npm run build
npx cap add android
npx cap sync android
npx cap open android`;

  const copyCommands = () => {
    navigator.clipboard?.writeText(buildCommands);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const cardClass = `rounded-3xl p-6 border ${
    isLight
      ? 'bg-white border-slate-200 text-slate-900'
      : 'bg-[#131B2E] border-slate-800/90 text-slate-100'
  }`;

  const enabledCount = settings.sources.filter((s) => s.enabled).length;

  return (
    <div className="space-y-6">
      {/* Section Principale : Gestionnaire Multi-Sources EPG (.xml.gz) */}
      <div className={cardClass}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold tracking-tight">
                Sources EPG · Whitelist Films/Séries (VO + ST) & Sport / Football
              </h2>
              <p
                className={`text-xs mt-0.5 ${
                  isLight ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                Filtrage strict actif : Astra 19.2°E (Sky DE / DAZN DE / Movistar+),
                Hotbird 13°E (Sky IT / Cinéma PL sans Lektor / Canal+ Sport & Eleven
                PL), Hispasat 30°W (Movistar+ / DAZN ES) et Nilesat 7°W (MBC
                2/Max/Action, Dubai One, OSN Movies/Series, beIN Sports / SSC / AD
                Sports).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaultSources}
              disabled={isSyncing}
              className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restaurer le pack (PL, ES, IT, DE, AR)</span>
            </button>

            <button
              type="button"
              disabled={isSyncing || enabledCount === 0}
              onClick={onForceRefresh}
              className="min-h-[40px] px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-semibold text-xs flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`}
              />
              <span>
                Fusionner les {enabledCount} sources actives
              </span>
            </button>
          </div>
        </div>

        {/* Liste des URLs EPG enregistrées */}
        <div className="space-y-2.5 mb-6">
          {settings.sources.map((src, index) => {
            const syncStat = metadata?.sourceResults?.find(
              (r) => r.url === src.url
            );

            return (
              <div
                key={src.id}
                className={`rounded-2xl p-3.5 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                  src.enabled
                    ? isLight
                      ? 'bg-slate-50/90 border-slate-200'
                      : 'bg-[#0B0F17]/80 border-slate-800'
                    : isLight
                    ? 'bg-slate-100/50 border-slate-200/60 opacity-60'
                    : 'bg-[#0B0F17]/30 border-slate-800/40 opacity-55'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <button
                    type="button"
                    onClick={() => handleToggleSource(src.id)}
                    aria-label={
                      src.enabled ? 'Désactiver la source' : 'Activer la source'
                    }
                    className={`min-h-[40px] min-w-[40px] rounded-xl font-mono text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                      src.enabled
                        ? 'bg-amber-500 text-slate-950'
                        : isLight
                        ? 'bg-slate-200 text-slate-500'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {src.country}
                  </button>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono tabular-nums text-slate-500">
                        #{index + 1}
                      </span>
                      <p className="text-sm font-semibold truncate">
                        {src.name}
                      </p>
                    </div>
                    <p
                      className={`text-xs font-mono truncate mt-0.5 ${
                        isLight ? 'text-slate-500' : 'text-slate-400'
                      }`}
                    >
                      {src.url}
                    </p>
                    {syncStat && (
                      <p className="text-[11px] font-mono tabular-nums text-emerald-400 mt-1">
                        {syncStat.status === 'done'
                          ? `Whitelist VO+Sub : +${syncStat.channelsAdded} chaînes retenues (${
                              syncStat.channelsFilteredOut || 0
                            } FTA/Sport/Lektor exclues) · +${syncStat.programmesAdded.toLocaleString(
                              'fr-FR'
                            )} films/séries (${formatBytes(syncStat.bytesLoaded)})`
                          : syncStat.error
                          ? `Erreur : ${syncStat.error}`
                          : ''}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleSource(src.id)}
                    className={`min-h-[38px] px-3 py-1 rounded-xl text-xs font-medium transition-colors ${
                      src.enabled
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : isLight
                        ? 'bg-slate-200 text-slate-600'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {src.enabled ? 'Actif' : 'Inactif'}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteSource(src.id)}
                    aria-label={`Supprimer ${src.name}`}
                    className={`min-h-[38px] min-w-[38px] rounded-xl flex items-center justify-center transition-colors ${
                      isLight
                        ? 'text-slate-400 hover:bg-red-50 hover:text-red-600'
                        : 'text-slate-500 hover:bg-red-950/50 hover:text-red-400'
                    }`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Formulaire d'ajout d'une nouvelle URL EPG (.xml.gz) */}
        <form
          onSubmit={handleAddSource}
          className={`rounded-2xl p-4 border ${
            isLight
              ? 'bg-slate-50 border-slate-200'
              : 'bg-[#0B0F17]/60 border-slate-800/80'
          }`}
        >
          <p className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-amber-400" />
            <span>Ajouter une nouvelle URL EPG (.xml.gz ou .xml) à la liste</span>
          </p>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            <div className="md:col-span-2">
              <select
                value={newCountry}
                onChange={(e) =>
                  setNewCountry(
                    e.target.value as Exclude<CountryCode, 'Tous'>
                  )
                }
                aria-label="Pays de la source EPG"
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-xs font-semibold border focus:outline-none focus:border-amber-400 ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-[#131B2E] border-slate-700 text-slate-100'
                }`}
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    Pays : {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom (ex: Bouquet Sky IT)"
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs border focus:outline-none focus:border-amber-400 ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-[#131B2E] border-slate-700 text-slate-100'
                }`}
              />
            </div>

            <div className="md:col-span-5">
              <input
                type="url"
                required
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://epgshare01.online/epgshare01/epg_ripper_..."
                className={`w-full min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-mono border focus:outline-none focus:border-amber-400 ${
                  isLight
                    ? 'bg-white border-slate-300 text-slate-900'
                    : 'bg-[#131B2E] border-slate-700 text-slate-100'
                }`}
              />
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="w-full min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter</span>
              </button>
            </div>
          </div>

          {/* Catalogue rapide 1-clic */}
          <div className="mt-4 pt-3 border-t border-slate-800/40">
            <p
              className={`text-[11px] mb-2 ${
                isLight ? 'text-slate-500' : 'text-slate-400'
              }`}
            >
              Ajout rapide depuis le catalogue epgshare01 :
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_EPG_CATALOG.map((preset) => {
                const alreadyAdded = settings.sources.some(
                  (s) => s.url.toLowerCase() === preset.url.toLowerCase()
                );
                return (
                  <button
                    key={preset.url}
                    type="button"
                    onClick={() => handleAddCatalogPreset(preset)}
                    className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                      alreadyAdded
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : isLight
                        ? 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        : 'bg-[#131B2E] border border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {alreadyAdded ? (
                      <CheckCircle2 className="w-3 h-3" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    <span className="font-mono font-semibold">
                      {preset.country}
                    </span>
                    <span>·</span>
                    <span className="truncate max-w-[180px]">
                      {preset.name.split('·')[1] || preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 2: Cache Local IndexedDB & LocalStorage */}
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <Database className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold tracking-tight">
                Stockage Local & Cache Fusionné
              </h2>
            </div>
            <span className="text-xs font-mono tabular-nums text-emerald-400">
              IndexedDB + LocalStorage
            </span>
          </div>

          {metadata ? (
            <div
              className={`rounded-2xl p-4 space-y-2.5 text-xs mb-5 ${
                isLight ? 'bg-slate-50' : 'bg-[#0B0F17]/70'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                  Dernière fusion multi-sources
                </span>
                <span className="font-mono tabular-nums font-medium">
                  {formatFullDateTime(metadata.lastUpdatedMs)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                  Validité du cache jusqu’à
                </span>
                <span className="font-mono tabular-nums font-medium">
                  {formatFullDateTime(metadata.expiresAtMs)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                  Chaînes Cinéma/Séries (VO + Sub) retenues
                </span>
                <span className="font-mono tabular-nums font-semibold text-amber-400">
                  {metadata.channelCount.toLocaleString('fr-FR')} chaînes
                </span>
              </div>
              {metadata.channelsExcludedCount !== undefined && (
                <div className="flex items-center justify-between">
                  <span
                    className={isLight ? 'text-slate-500' : 'text-slate-400'}
                  >
                    Chaînes FTA / Sport / Lektor PL éliminées
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-emerald-400">
                    {metadata.channelsExcludedCount.toLocaleString('fr-FR')}{' '}
                    écartées
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                  Total programmes en cache
                </span>
                <span className="font-mono tabular-nums font-semibold text-amber-400">
                  {metadata.programmeCount.toLocaleString('fr-FR')} émissions
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                  Volume total GZ → XML décompressé
                </span>
                <span className="font-mono tabular-nums">
                  {formatBytes(metadata.compressedBytes)} →{' '}
                  {formatBytes(metadata.uncompressedBytes)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                  Durée totale Web Worker
                </span>
                <span className="font-mono tabular-nums">
                  {(metadata.parseDurationMs / 1000).toFixed(2)} s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className={isLight ? 'text-slate-500' : 'text-slate-400'}>
                  Fuseau horaire local appliqué
                </span>
                <span className="font-mono tabular-nums">
                  {getLocalTimezoneLabel()}
                </span>
              </div>
            </div>
          ) : (
            <div
              className={`rounded-2xl p-4 text-xs mb-5 ${
                isLight
                  ? 'bg-slate-50 text-slate-500'
                  : 'bg-[#0B0F17]/70 text-slate-400'
              }`}
            >
              Aucune donnée actuellement stockée dans le cache IndexedDB.
            </div>
          )}

          {/* Retention & Cache TTL Selectors */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div>
              <span className="block text-xs font-medium mb-1.5">
                Validité du cache IndexedDB
              </span>
              <div className="flex items-center gap-1.5">
                {[6, 12, 24, 48].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() =>
                      onUpdateSettings(
                        { ...settings, cacheTtlHours: h },
                        false
                      )
                    }
                    className={`min-h-[40px] flex-1 rounded-xl text-xs font-mono tabular-nums font-medium transition-colors ${
                      settings.cacheTtlHours === h
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : isLight
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-[#0B0F17] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-medium mb-1.5">
                Fenêtre horaire conservée
              </span>
              <div className="flex items-center gap-1.5">
                {[36, 48, 72].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({ ...settings, windowHours: w }, true)
                    }
                    className={`min-h-[40px] flex-1 rounded-xl text-xs font-mono tabular-nums font-medium transition-colors ${
                      settings.windowHours === w
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : isLight
                        ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        : 'bg-[#0B0F17] text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {w}h
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isSyncing || !metadata}
              onClick={onClearCache}
              className={`min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-medium flex items-center gap-2 transition-colors whitespace-nowrap disabled:opacity-40 ${
                isLight
                  ? 'bg-red-50 text-red-700 hover:bg-red-100'
                  : 'bg-red-950/40 text-red-300 hover:bg-red-950/70 border border-red-900/50'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>Purger le cache IndexedDB</span>
            </button>
          </div>
        </div>

        {/* Section 3: Export APK Android avec Capacitor */}
        <div className={cardClass}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-5 h-5 text-amber-400" />
              <h2 className="text-lg font-bold tracking-tight">
                Export APK Android (Capacitor)
              </h2>
            </div>
            <span className="text-xs font-mono tabular-nums text-amber-400">
              capacitor.config.ts prêt
            </span>
          </div>

          <p
            className={`text-xs leading-relaxed mb-4 ${
              isLight ? 'text-slate-600' : 'text-slate-400'
            }`}
          >
            L’architecture multi-sources de{' '}
            <strong className="font-semibold">PulseEPG</strong> est prête pour
            Android (<code className="font-mono">.apk</code>) via Capacitor. Le
            plugin <code className="font-mono">CapacitorHttp</code> permet de
            télécharger successivement tous les fichiers{' '}
            <code className="font-mono">.xml.gz</code> (PL, ES, IT, DE, AR) sans
            blocage CORS.
          </p>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold">
                Commandes de génération APK Android
              </span>
              <button
                type="button"
                onClick={copyCommands}
                className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                }`}
              >
                {copiedCmd ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>

            <pre
              className={`rounded-2xl p-4 text-xs font-mono overflow-x-auto leading-relaxed ${
                isLight
                  ? 'bg-slate-900 text-slate-100'
                  : 'bg-[#0B0F17] text-amber-300 border border-slate-800/80'
              }`}
            >
              {buildCommands}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
