import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckSquare,
  Compass,
  Database,
  ExternalLink,
  Film,
  Filter,
  Globe,
  HardDrive,
  Info,
  Languages,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  Satellite,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Square,
  Subtitles,
  Trash2,
  Trophy,
  Volume2,
  X,
} from 'lucide-react';
import {
  AppLanguage,
  AppSettings,
  CountryCode,
  EpgBouquetId,
  EpgCacheMetadata,
  EpgSourceItem,
  ThematicCategoryId,
  TvProfileId,
} from '../types/epg';
import {
  ALL_BOUQUET_IDS,
  detectInitialTvProfileFromSystemLanguage,
  EPG_BOUQUET_CATALOG,
  EPG_THEMATIC_CATEGORIES,
  getBouquetsForTvProfile,
  getDynamicProfileForLanguage,
  inferTvProfileFromBouquets,
  MAGHREB_OPTIONAL_EXTENSIONS,
  MAX_ACTIVE_BOUQUETS,
  MAX_ACTIVE_SATELLITES,
  RAM_LIMIT_WARNING_MESSAGE,
  SATELLITE_GROUPS_CATALOG,
  syncSourcesWithSelectedBouquets,
  TV_PROFILES_CATALOG,
} from '../services/storageService';
import { LauncherIconsPreviewCard } from './PulseEpgLogo';
import {
  getActiveLanguage,
  getBouquetLocalizedText,
  getCategoryLocalizedText,
  getLanguageOption,
  getTranslations,
  LANGUAGE_OPTIONS,
} from '../utils/i18n';
import { ensureHttpsUrl } from '../utils/xmltvParser';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  cacheMeta: EpgCacheMetadata | null;
  onSaveSettings: (newSettings: AppSettings, forceReload: boolean) => void;
  onResetDefaults: () => void;
  onClearCache: () => void;
  initialTab?: 'filters' | 'sources' | 'legal';
  onChangeLanguage?: (lang: AppLanguage) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  cacheMeta,
  onSaveSettings,
  onResetDefaults,
  onClearCache,
  initialTab = 'filters',
  onChangeLanguage,
}) => {
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<'filters' | 'sources' | 'legal'>(
    initialTab
  );
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCountry, setNewCountry] =
    useState<Exclude<CountryCode, 'Tous'>>('FR');
  const [limitWarning, setLimitWarning] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings);
    setLimitWarning(null);
  }, [settings, isOpen]);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  if (!isOpen) return null;

  const activeLang: AppLanguage = draft.language || getActiveLanguage();
  const tr = getTranslations(activeLang);
  const langOpt = getLanguageOption(activeLang);

  const activeProfileId: TvProfileId =
    draft.tvProfile ||
    inferTvProfileFromBouquets(draft.selectedBouquets, draft.tvProfile);

  const systemLocaleLabel =
    typeof navigator !== 'undefined' && navigator.language
      ? navigator.language
      : 'fr-FR';

  const handleSelectTvProfile = (
    profileId: Exclude<TvProfileId, 'custom'>
  ) => {
    const nextBouquets = getBouquetsForTvProfile(profileId);
    setLimitWarning(null);
    setDraft((prev) => ({
      ...prev,
      tvProfile: profileId,
      selectedBouquets: nextBouquets,
      sources: syncSourcesWithSelectedBouquets(
        nextBouquets,
        prev.sources,
        profileId
      ),
    }));
  };

  const handleAutoDetectTvProfile = () => {
    const detected = detectInitialTvProfileFromSystemLanguage();
    setLimitWarning(null);
    setDraft((prev) => ({
      ...prev,
      tvProfile: detected.tvProfile,
      selectedBouquets: [...detected.selectedBouquets],
      sources: syncSourcesWithSelectedBouquets(
        detected.selectedBouquets,
        prev.sources,
        detected.tvProfile
      ),
    }));
  };

  const handleSelectLanguage = (lang: AppLanguage) => {
    const dyn = getDynamicProfileForLanguage(lang);
    setLimitWarning(null);
    setDraft((prev) => ({
      ...prev,
      language: lang,
      tvProfile: dyn.tvProfile,
      selectedBouquets: dyn.selectedBouquets,
      sources: syncSourcesWithSelectedBouquets(
        dyn.selectedBouquets,
        prev.sources,
        dyn.tvProfile
      ),
    }));
    if (onChangeLanguage) {
      onChangeLanguage(lang);
    }
  };

  const countActiveSatellites = (bouquetIds: EpgBouquetId[]): number => {
    return SATELLITE_GROUPS_CATALOG.filter((satGroup) =>
      satGroup.bouquets.some((b) => bouquetIds.includes(b.id))
    ).length;
  };

  const toggleBouquet = (bouquetId: EpgBouquetId) => {
    setDraft((prev) => {
      const exists = prev.selectedBouquets.includes(bouquetId);
      if (exists) {
        const nextBouquets = prev.selectedBouquets.filter(
          (b) => b !== bouquetId
        );
        const finalBouquets =
          nextBouquets.length > 0
            ? nextBouquets
            : ([bouquetId] as EpgBouquetId[]);
        const nextProfile = inferTvProfileFromBouquets(
          finalBouquets,
          prev.tvProfile
        );
        setLimitWarning(null);
        return {
          ...prev,
          tvProfile: nextProfile,
          selectedBouquets: finalBouquets,
          sources: syncSourcesWithSelectedBouquets(
            finalBouquets,
            prev.sources,
            nextProfile
          ),
        };
      }

      if (prev.selectedBouquets.length >= MAX_ACTIVE_BOUQUETS) {
        setLimitWarning(RAM_LIMIT_WARNING_MESSAGE);
        return prev;
      }

      const candidate = [...prev.selectedBouquets, bouquetId];
      if (
        candidate.length > MAX_ACTIVE_BOUQUETS ||
        countActiveSatellites(candidate) > MAX_ACTIVE_SATELLITES
      ) {
        setLimitWarning(RAM_LIMIT_WARNING_MESSAGE);
        return prev;
      }

      const nextProfile = inferTvProfileFromBouquets(
        candidate,
        prev.tvProfile
      );
      setLimitWarning(null);
      return {
        ...prev,
        tvProfile: nextProfile,
        selectedBouquets: candidate,
        sources: syncSourcesWithSelectedBouquets(
          candidate,
          prev.sources,
          nextProfile
        ),
      };
    });
  };

  const selectAllBouquets = () => {
    setLimitWarning(RAM_LIMIT_WARNING_MESSAGE);
  };

  const toggleSatelliteGroup = (groupIds: EpgBouquetId[]) => {
    setDraft((prev) => {
      const allChecked = groupIds.every((id) =>
        prev.selectedBouquets.includes(id)
      );
      if (allChecked) {
        const remaining = prev.selectedBouquets.filter(
          (id) => !groupIds.includes(id)
        );
        const nextBouquets =
          remaining.length > 0 ? remaining : ([groupIds[0]] as EpgBouquetId[]);
        const nextProfile = inferTvProfileFromBouquets(
          nextBouquets,
          prev.tvProfile
        );
        setLimitWarning(null);
        return {
          ...prev,
          tvProfile: nextProfile,
          selectedBouquets: nextBouquets,
          sources: syncSourcesWithSelectedBouquets(
            nextBouquets,
            prev.sources,
            nextProfile
          ),
        };
      }

      const merged = Array.from(
        new Set<EpgBouquetId>([...prev.selectedBouquets, ...groupIds])
      );
      if (
        merged.length > MAX_ACTIVE_BOUQUETS ||
        countActiveSatellites(merged) > MAX_ACTIVE_SATELLITES
      ) {
        setLimitWarning(RAM_LIMIT_WARNING_MESSAGE);
        return prev;
      }

      const nextProfile = inferTvProfileFromBouquets(merged, prev.tvProfile);
      setLimitWarning(null);
      return {
        ...prev,
        tvProfile: nextProfile,
        selectedBouquets: merged,
        sources: syncSourcesWithSelectedBouquets(
          merged,
          prev.sources,
          nextProfile
        ),
      };
    });
  };

  const toggleCategory = (catId: ThematicCategoryId) => {
    setDraft((prev) => {
      const exists = prev.enabledCategories.includes(catId);
      const nextCats = exists
        ? prev.enabledCategories.filter((c) => c !== catId)
        : [...prev.enabledCategories, catId];
      return {
        ...prev,
        enabledCategories:
          nextCats.length > 0 ? nextCats : ([catId] as ThematicCategoryId[]),
      };
    });
  };

  const handleToggleSource = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      sources: prev.sources.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s
      ),
    }));
  };

  const handleDeleteSource = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      sources: prev.sources.filter((s) => s.id !== id),
    }));
  };

  const handleAddSource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newUrl.trim()) return;
    const secureUrl = ensureHttpsUrl(newUrl) || newUrl.trim();
    const item: EpgSourceItem = {
      id: `custom-${Date.now()}`,
      name: newName.trim(),
      url: secureUrl,
      country: newCountry,
      enabled: true,
    };
    setDraft((prev) => ({
      ...prev,
      sources: [...prev.sources, item],
    }));
    setNewName('');
    setNewUrl('');
  };

  const getCategoryIcon = (id: ThematicCategoryId) => {
    if (id === 'Sport / Football')
      return <Trophy className="w-4 h-4 text-cyan-400" />;
    if (id === 'Documentaires')
      return <Compass className="w-4 h-4 text-cyan-400" />;
    if (id === 'Films & Séries')
      return <Film className="w-4 h-4 text-blue-400" />;
    return <Sparkles className="w-4 h-4 text-blue-400" />;
  };

  return (
    <div
      dir={langOpt.dir}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#0a0e17]/88 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        data-tv-modal="true"
        className="w-full max-w-4xl bg-[#141a26] border border-[#1a202c] rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div className="p-4 sm:p-5 bg-[#0a0e17] border-b border-[#1a202c] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#e11d48] border border-[#ff0033] flex items-center justify-center text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)]">
              <Filter className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-[#ffffff]">
                {tr.settingsModalTitle}
              </h2>
              <p className="text-xs text-[#cbd5e1]">
                {tr.settingsModalSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#e11d48]/60 transition-colors cursor-pointer"
            title={tr.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation par Onglets — Rouge Crimson Sky Sport pour les boutons actifs */}
        <div
          data-tv-row="settings-tabs"
          className="px-4 sm:px-5 py-2.5 bg-[#0a0e17] border-b border-[#1a202c] flex items-center gap-2 overflow-x-auto no-scrollbar"
        >
          <button
            type="button"
            onClick={() => setActiveTab('filters')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm transition-all cursor-pointer shrink-0 ${
              activeTab === 'filters'
                ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
            }`}
          >
            <Satellite className="w-4 h-4" />
            {tr.tabBouquetsFilters}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sources')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm transition-all cursor-pointer shrink-0 ${
              activeTab === 'sources'
                ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
            }`}
          >
            <Database className="w-4 h-4" />
            {tr.tabXmltvCache}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('legal')}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs sm:text-sm transition-all cursor-pointer shrink-0 ${
              activeTab === 'legal'
                ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
            }`}
          >
            <Scale className="w-4 h-4" />
            {tr.tabLegalPlayStore}
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-6 flex-1">
          {/* Sélecteur de Langue International (i18n + RTL) toujours accessible */}
          <div className="p-4 rounded-lg bg-[#0a0e17] border border-[#1a202c] space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-sm font-bold text-[#ffffff] flex items-center gap-2">
                  <Languages className="w-4 h-4 text-[#0055ff]" />
                  {tr.languageSectionTitle}
                </h3>
                <p className="text-xs text-[#cbd5e1] mt-0.5">
                  {tr.languageSectionDesc}
                </p>
              </div>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 font-semibold">
                {langOpt.flag} {langOpt.label} · TMDB {langOpt.tmdbLocale}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {LANGUAGE_OPTIONS.map((opt) => {
                const isSelected = activeLang === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onClick={() => handleSelectLanguage(opt.code)}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1d4ed8] border-[1.5px] border-[#0055ff] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(0,85,255,0.45)]'
                        : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="text-base leading-none">{opt.flag}</span>
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#ffffff] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === 'filters' && (
            <>
              {/* Sélecteur manuel de Zone / Profil TV (avec détection intelligente au 1er lancement) */}
              <div className="p-4 rounded-lg bg-[#0a0e17] border border-[#1a202c] space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-sm font-bold text-[#ffffff] flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#0055ff]" />
                      Zone / Profil TV
                    </h3>
                    <p className="text-xs text-[#cbd5e1] mt-0.5">
                      Filtre la base EPG dès l&apos;initialisation pour ne charger en mémoire que les chaînes du profil sélectionné (détection auto selon <code className="text-[#ffffff] font-mono">navigator.language</code> : <span className="text-[#ffffff] font-semibold">{systemLocaleLabel}</span>).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleAutoDetectTvProfile}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#141a26] hover:bg-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] border border-[#1a202c] hover:border-[#0055ff]/60 text-xs font-medium transition-colors cursor-pointer"
                      title="Réappliquer la détection automatique selon la langue du système"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-[#0055ff]" />
                      <span>Auto ({systemLocaleLabel})</span>
                    </button>
                    {activeProfileId === 'custom' && (
                      <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 font-semibold">
                        ⚙️ Profil personnalisé ({draft.selectedBouquets.length} bouquets)
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {TV_PROFILES_CATALOG.map((profile) => {
                    const isSelected = activeProfileId === profile.id;
                    const isAllSats = profile.id === 'all_satellites';
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() => handleSelectTvProfile(profile.id)}
                        className={`flex flex-col items-start justify-between gap-1.5 p-3 rounded-lg text-start transition-all cursor-pointer ${
                          isSelected
                            ? isAllSats
                              ? 'bg-[#e11d48]/20 border-[1.5px] border-[#ff0033] text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.35)]'
                              : 'bg-[#1d4ed8]/25 border-[1.5px] border-[#0055ff] text-[#ffffff] shadow-[0_0_12px_rgba(0,85,255,0.35)]'
                            : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2 font-bold text-xs sm:text-sm text-[#ffffff] truncate">
                            <span className="text-base leading-none shrink-0">
                              {profile.flag}
                            </span>
                            <span className="truncate">{profile.label}</span>
                          </span>
                          {isSelected && (
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                                isAllSats
                                  ? 'bg-[#e11d48] text-[#ffffff]'
                                  : 'bg-[#1d4ed8] text-[#ffffff]'
                              }`}
                            >
                              Actif
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#cbd5e1] line-clamp-2 leading-snug">
                          {profile.satellitesSummary}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Extensions optionnelles pour le profil Maghreb / MENA Multi-Sat */}
                {activeProfileId === 'maghreb_mena' && (
                  <div className="mt-2 p-3 rounded-lg bg-[#141a26] border border-[#0055ff]/40 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#ffffff] flex items-center gap-1.5">
                        <Satellite className="w-3.5 h-3.5 text-[#ec4899]" />
                        Satellites complémentaires Maghreb / MENA (Optionnels) :
                      </span>
                      <span className="text-[10px] font-mono text-[#cbd5e1]">
                        3 satellites principaux chargés par défaut (Nilesat 7°W, Astra 19.2°E, Hotbird 13°E)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {MAGHREB_OPTIONAL_EXTENSIONS.map((ext) => {
                        const isExtActive = ext.bouquetIds.every((id) =>
                          draft.selectedBouquets.includes(id)
                        );
                        return (
                          <button
                            key={ext.id}
                            type="button"
                            onClick={() => toggleSatelliteGroup(ext.bouquetIds)}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                              isExtActive
                                ? 'bg-[#1d4ed8]/30 border-[#ec4899] text-[#ffffff] shadow-[0_0_10px_rgba(236,72,153,0.3)]'
                                : 'bg-[#0a0e17] border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]'
                            }`}
                          >
                            {isExtActive ? (
                              <CheckSquare className="w-3.5 h-3.5 text-[#ec4899]" />
                            ) : (
                              <Square className="w-3.5 h-3.5 text-[#cbd5e1]/60" />
                            )}
                            <span>{ext.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Section 1 : Couverture Globale des Satellites & Bouquets */}
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-sm font-bold text-[#ffffff] flex items-center gap-2">
                      <Satellite className="w-4 h-4 text-[#0055ff]" />
                      {tr.bouquetsSectionTitle}
                    </h3>
                    <p className="text-xs text-[#cbd5e1] mt-0.5">
                      {tr.bouquetsSectionDesc}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-[#0a0e17] text-[#cbd5e1] border border-[#1a202c] text-xs font-mono font-medium">
                      RAM &lt; 50 Mo · {draft.selectedBouquets.length}/
                      {ALL_BOUQUET_IDS.length} Bouquets actifs
                    </span>
                    <button
                      type="button"
                      onClick={selectAllBouquets}
                      className="px-2.5 py-1 rounded-lg bg-[#e11d48] hover:bg-[#ff0033] text-[#ffffff] border border-[#ff0033] text-xs font-semibold shadow-[0_0_10px_rgba(225,29,72,0.35)] cursor-pointer"
                    >
                      Tous les satellites
                    </button>
                  </div>
                </div>

                {limitWarning && (
                  <div className="p-3 rounded-lg bg-[#0a0e17] border border-[#0055ff]/50 text-[#ffffff] text-xs font-medium flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-[#0055ff] shrink-0" />
                    <span>{limitWarning}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {SATELLITE_GROUPS_CATALOG.map((satGroup) => {
                    const groupBouquets = satGroup.bouquets;
                    const groupIds = groupBouquets.map((bq) => bq.id);
                    const activeCount = groupIds.filter((id) =>
                      draft.selectedBouquets.includes(id)
                    ).length;
                    const allChecked =
                      groupIds.length > 0 && activeCount === groupIds.length;
                    const someChecked = activeCount > 0;

                    return (
                      <div
                        key={satGroup.satelliteId}
                        className={`rounded-lg border p-3.5 transition-all flex flex-col gap-2.5 ${
                          someChecked
                            ? 'bg-[#0a0e17] border-[#0055ff]/60'
                            : 'bg-[#0a0e17]/60 border-[#1a202c] opacity-75 hover:opacity-100'
                        }`}
                      >
                        {/* En-tête de la carte Satellite par Position Orbitale */}
                        <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#1a202c]">
                          <div
                            tabIndex={0}
                            role="button"
                            onClick={() => toggleSatelliteGroup(groupIds)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                toggleSatelliteGroup(groupIds);
                              }
                            }}
                            className="flex items-start gap-2.5 cursor-pointer min-w-0 flex-1 rounded-md p-0.5"
                          >
                            <div className="mt-0.5 text-[#0055ff] shrink-0">
                              {allChecked ? (
                                <CheckSquare className="w-4 h-4" />
                              ) : (
                                <Square
                                  className={`w-4 h-4 ${
                                    someChecked
                                      ? 'text-[#0055ff]'
                                      : 'text-[#cbd5e1]/60'
                                  }`}
                                />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-bold text-[#ffffff]">
                                  {satGroup.flag} {satGroup.title}
                                </span>
                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50">
                                  {satGroup.orbitalPosition}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#cbd5e1] mt-0.5 leading-snug">
                                {satGroup.subtitle}
                              </p>
                            </div>
                          </div>

                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 shrink-0">
                            {activeCount}/{groupIds.length}
                          </span>
                        </div>

                        {/* Sous-cases de sélection des bouquets pour ce satellite */}
                        <div className="space-y-2">
                          {groupBouquets.map((bq) => {
                            const checked = draft.selectedBouquets.includes(
                              bq.id
                            );
                            const loc = getBouquetLocalizedText(
                              bq.id,
                              activeLang,
                              bq.label,
                              bq.description
                            );
                            return (
                              <div
                                key={bq.id}
                                tabIndex={0}
                                role="button"
                                onClick={() => toggleBouquet(bq.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    toggleBouquet(bq.id);
                                  }
                                }}
                                className={`p-2.5 rounded-lg transition-all cursor-pointer flex items-start gap-2.5 ${
                                  checked
                                    ? 'bg-[#141a26] border-[1.5px] border-[#0055ff] text-[#ffffff]'
                                    : 'bg-[#141a26]/60 border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff]'
                                }`}
                              >
                                <div className="mt-0.5 shrink-0">
                                  {checked ? (
                                    <CheckSquare className="w-4 h-4 text-[#0055ff]" />
                                  ) : (
                                    <Square className="w-4 h-4 text-[#cbd5e1]/60" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-[#ffffff] truncate">
                                      {bq.flag} {loc.label}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[#cbd5e1] mt-0.5 leading-relaxed">
                                    {loc.description}
                                  </p>
                                  {bq.sampleChannels &&
                                    bq.sampleChannels.length > 0 && (
                                      <div className="flex flex-wrap gap-1.5 mt-2">
                                        {bq.sampleChannels.map((sample) => (
                                          <span
                                            key={sample}
                                            className={`text-[10px] font-medium px-2 py-0.5 rounded border ${
                                              checked
                                                ? 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50'
                                                : 'bg-[#0a0e17] text-[#cbd5e1] border-[#1a202c]'
                                            }`}
                                          >
                                            {sample}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 2 : Catégories Thématiques */}
              <div className="space-y-3 pt-2 border-t border-[#1a202c]">
                <div>
                  <h3 className="text-sm font-bold text-[#ffffff] flex items-center gap-2">
                    <Film className="w-4 h-4 text-[#e11d48]" />
                    {tr.thematicCategoriesTitle}
                  </h3>
                  <p className="text-xs text-[#cbd5e1] mt-0.5">
                    {tr.thematicCategoriesDesc}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {EPG_THEMATIC_CATEGORIES.map((cat) => {
                    const checked = draft.enabledCategories.includes(cat.id);
                    const locCat = getCategoryLocalizedText(
                      cat.id,
                      activeLang,
                      cat.label,
                      cat.description
                    );
                    return (
                      <div
                        key={cat.id}
                        tabIndex={0}
                        role="button"
                        onClick={() => toggleCategory(cat.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            toggleCategory(cat.id);
                          }
                        }}
                        className={`p-3 rounded-lg transition-all cursor-pointer flex items-start gap-2.5 ${
                          checked
                            ? 'bg-[#0a0e17] border-[1.5px] border-[#e11d48]'
                            : 'bg-[#0a0e17]/60 border border-[#1a202c] opacity-75 hover:opacity-100'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {checked ? (
                            <CheckSquare className="w-4 h-4 text-[#e11d48]" />
                          ) : (
                            <Square className="w-4 h-4 text-[#cbd5e1]/60" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            {getCategoryIcon(cat.id)}
                            <span className="text-xs font-bold text-[#ffffff] truncate">
                              {locCat.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#cbd5e1] mt-1 leading-snug">
                            {locCat.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Section 3 : Filtres Audio VO & Anti-Lektor Polonais */}
              <div className="space-y-3 pt-2 border-t border-[#1a202c]">
                <h3 className="text-sm font-bold text-[#ffffff] flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-[#0055ff]" />
                  {tr.audioSubtitlesTitle}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    tabIndex={0}
                    role="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        excludePolishLektor: !prev.excludePolishLektor,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDraft((prev) => ({
                          ...prev,
                          excludePolishLektor: !prev.excludePolishLektor,
                        }));
                      }
                    }}
                    className={`p-3.5 rounded-lg transition-all cursor-pointer flex items-start gap-3 ${
                      draft.excludePolishLektor
                        ? 'bg-[#0a0e17] border-[1.5px] border-[#0055ff]'
                        : 'bg-[#0a0e17]/60 border border-[#1a202c]'
                    }`}
                  >
                    <div className="mt-0.5">
                      {draft.excludePolishLektor ? (
                        <CheckSquare className="w-4 h-4 text-[#0055ff]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#cbd5e1]/60" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#0055ff]" />
                        <span className="text-xs font-bold text-[#ffffff]">
                          {tr.excludePolishLektorTitle}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#cbd5e1] mt-1 leading-relaxed">
                        {tr.excludePolishLektorDesc}
                      </p>
                    </div>
                  </div>

                  <div
                    tabIndex={0}
                    role="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        excludeNoSubtitles: !prev.excludeNoSubtitles,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setDraft((prev) => ({
                          ...prev,
                          excludeNoSubtitles: !prev.excludeNoSubtitles,
                        }));
                      }
                    }}
                    className={`p-3.5 rounded-lg transition-all cursor-pointer flex items-start gap-3 ${
                      draft.excludeNoSubtitles
                        ? 'bg-[#0a0e17] border-[1.5px] border-[#0055ff]'
                        : 'bg-[#0a0e17]/60 border border-[#1a202c]'
                    }`}
                  >
                    <div className="mt-0.5">
                      {draft.excludeNoSubtitles ? (
                        <CheckSquare className="w-4 h-4 text-[#0055ff]" />
                      ) : (
                        <Square className="w-4 h-4 text-[#cbd5e1]/60" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Subtitles className="w-3.5 h-3.5 text-[#0055ff]" />
                        <span className="text-xs font-bold text-[#ffffff]">
                          {tr.requireSubtitlesTitle}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#cbd5e1] mt-1 leading-relaxed">
                        {tr.requireSubtitlesDesc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Aperçu & Formats de l'Icône de Lancement Multi-Terminaux (Smartphone, Tablette, Android TV, TV Box) */}
              <LauncherIconsPreviewCard language={draft.language} />
            </>
          )}

          {activeTab === 'sources' && (
            <>
              {/* État du Cache IndexedDB */}
              <div className="p-4 rounded-lg bg-[#0a0e17] border border-[#1a202c] flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <HardDrive className="w-5 h-5 text-[#0055ff] shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#ffffff]">
                      {tr.cacheIndexedDbTitle}
                    </h3>
                    {cacheMeta ? (
                      <p className="text-xs text-[#cbd5e1] mt-0.5">
                        {cacheMeta.channelCount} {tr.channelsCountLabel} ·{' '}
                        {cacheMeta.programmeCount.toLocaleString()}{' '}
                        {tr.programmesCountLabel} · {tr.updatedAtLabel}{' '}
                        {new Date(cacheMeta.lastUpdatedMs).toLocaleTimeString(
                          langOpt.intlLocale,
                          {
                            hour: '2-digit',
                            minute: '2-digit',
                          }
                        )}
                      </p>
                    ) : (
                      <p className="text-xs text-[#cbd5e1] mt-0.5">
                        {tr.noCacheStored}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-xs text-[#ffffff] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.autoRefreshHours > 0}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          autoRefreshHours: e.target.checked ? 12 : 0,
                        }))
                      }
                      className="rounded border-[#1a202c] bg-[#141a26] text-[#e11d48] focus:ring-[#e11d48]"
                    />
                    {tr.autoRefresh12h}
                  </label>

                  <button
                    type="button"
                    onClick={onClearCache}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#141a26] hover:bg-[#1a202c] text-[#ffffff] border border-[#1a202c] text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#cbd5e1]" />
                    {tr.clearCacheBtn}
                  </button>
                </div>
              </div>

              {/* Liste des flux XMLTV configurés */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#cbd5e1] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#0055ff]" />
                    {tr.xmltvSourcesActiveTitle} (
                    {draft.sources.filter((s) => s.enabled).length}/
                    {draft.sources.length})
                  </h3>
                  <button
                    type="button"
                    onClick={onResetDefaults}
                    className="inline-flex items-center gap-1 text-xs text-[#cbd5e1] hover:text-[#ffffff] cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {tr.restoreDefaultCatalog}
                  </button>
                </div>

                <div className="space-y-2">
                  {draft.sources.map((source) => (
                    <div
                      key={source.id}
                      className={`p-3 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                        source.enabled
                          ? 'bg-[#0a0e17] border-[#1a202c]'
                          : 'bg-[#0a0e17]/40 border-[#1a202c]/50 opacity-60'
                      }`}
                    >
                      <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={source.enabled}
                          onChange={() => handleToggleSource(source.id)}
                          className="w-4 h-4 rounded border-[#1a202c] bg-[#141a26] text-[#e11d48] focus:ring-[#e11d48]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-[#1d4ed8]/25 text-[#ffffff] border border-[#0055ff]/50">
                              {source.country}
                            </span>
                            <span className="text-sm font-semibold text-[#ffffff] truncate">
                              {source.name}
                            </span>
                          </div>
                          <p className="text-[11px] font-mono text-[#cbd5e1] truncate mt-0.5">
                            {source.url}
                          </p>
                        </div>
                      </label>

                      {source.id.startsWith('custom-') && (
                        <button
                          type="button"
                          onClick={() => handleDeleteSource(source.id)}
                          className="p-1.5 rounded-lg text-[#cbd5e1] hover:text-[#ffffff] hover:bg-[#141a26] transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Ajouter un flux XMLTV personnalisé */}
              <form
                onSubmit={handleAddSource}
                className="p-4 rounded-lg bg-[#0a0e17] border border-[#1a202c] space-y-3"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#ffffff] flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-[#e11d48]" />
                  {tr.addCustomXmltvTitle}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <select
                    value={newCountry}
                    onChange={(e) =>
                      setNewCountry(
                        e.target.value as Exclude<CountryCode, 'Tous'>
                      )
                    }
                    className="px-3 py-2 rounded-lg bg-[#141a26] border border-[#1a202c] text-xs text-[#ffffff] focus:outline-none focus:border-[#0055ff]"
                  >
                    <option value="AR">🇲🇦/🇦🇪 Nilesat 7°W / Badr 26°E (AR)</option>
                    <option value="FR">🇫🇷 France (FR)</option>
                    <option value="ES">🇪🇸 Espagne / Portugal (ES)</option>
                    <option value="DE">🇩🇪 Allemagne (DE)</option>
                    <option value="IT">🇮🇹 Italie (IT)</option>
                    <option value="PL">🇵🇱 Pologne (PL)</option>
                    <option value="EU">🇷🇴/🇭🇺 Thor 0.8°W / Balkans 16°E (EU)</option>
                    <option value="BR">🇧🇷 Brésil Star One D2 (BR)</option>
                    <option value="LATAM">🌎 Amérique Latine (LATAM)</option>
                  </select>

                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={tr.sourceNamePlaceholder}
                    className="px-3 py-2 rounded-lg bg-[#141a26] border border-[#1a202c] text-xs text-[#ffffff] placeholder-[#cbd5e1]/60 focus:outline-none focus:border-[#0055ff]"
                  />

                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://.../epg.xml.gz"
                    className="sm:col-span-2 px-3 py-2 rounded-lg bg-[#141a26] border border-[#1a202c] text-xs text-[#ffffff] placeholder-[#cbd5e1]/60 font-mono focus:outline-none focus:border-[#0055ff]"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#e11d48] hover:bg-[#ff0033] border-[1.5px] border-[#ff0033] text-xs font-bold text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)] transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {tr.addSourceBtn}
                  </button>
                </div>
              </form>
            </>
          )}

          {activeTab === 'legal' && (
            <div className="space-y-4">
              {/* Mention de non-fourniture de flux vidéo (Clause Google Play Store) */}
              <div className="p-4 rounded-lg bg-[#0a0e17] border border-[#1a202c] space-y-2">
                <div className="flex items-center gap-2 text-[#ffffff] font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-[#0055ff] shrink-0" />
                  <span>{tr.legalNonStreamingTitle}</span>
                </div>
                <p className="text-xs text-[#cbd5e1] leading-relaxed">
                  {tr.legalNonStreamingClause}
                </p>
              </div>

              {/* Attribution Officielle TMDB & TVMaze */}
              <div className="p-4 rounded-lg bg-[#0a0e17] border border-[#1a202c] space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-[#ffffff] font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-[#e11d48] shrink-0" />
                    <span>{tr.legalTmdbTitle}</span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded bg-[#1d4ed8]/25 text-[#ffffff] border border-[#0055ff]/50 text-[11px] font-bold tracking-wider">
                    TMDB API v3
                  </span>
                </div>

                <p className="text-xs text-[#cbd5e1] leading-relaxed">
                  {tr.legalTmdbNotice}
                </p>

                <div className="p-3 rounded-lg bg-[#141a26] border border-[#1a202c] text-[11px] text-[#cbd5e1] font-mono leading-relaxed">
                  "This product uses the TMDB API but is not endorsed or
                  certified by TMDB."
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <a
                    href="https://www.themoviedb.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#cbd5e1] hover:text-[#ffffff] font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    The Movie Database (TMDB)
                  </a>
                  <span className="text-[#cbd5e1]">•</span>
                  <a
                    href="https://www.tvmaze.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[#cbd5e1] hover:text-[#ffffff] font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    TVMaze API (CC BY-SA)
                  </a>
                </div>
              </div>

              {/* Politique de Confidentialité & RGPD */}
              <div className="p-4 rounded-lg bg-[#0a0e17] border border-[#1a202c] space-y-2.5">
                <div className="flex items-center gap-2 text-[#ffffff] font-bold text-sm">
                  <Lock className="w-4 h-4 text-[#0055ff] shrink-0" />
                  <span>{tr.legalPrivacyTitle}</span>
                </div>
                <p className="text-xs text-[#cbd5e1] leading-relaxed">
                  {tr.legalPrivacyDesc}
                </p>
              </div>

              {/* Informations de Version & PWA / Android */}
              <div className="p-4 rounded-lg bg-[#0a0e17] border border-[#1a202c] flex flex-wrap items-center justify-between gap-3 text-xs text-[#cbd5e1]">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#cbd5e1]" />
                  <span>
                    <strong className="text-[#ffffff]">
                      PulseEPG - Your Ultimate TV Guide
                    </strong>{' '}
                    · v2.5.0 (Play Store Release Ready)
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded bg-[#1d4ed8]/25 text-[#ffffff] border border-[#0055ff]/50 font-semibold text-[11px]">
                  PWA Standalone & Android TV Ready
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions — Rouge/Crimson Sky Sport pour l'action principale */}
        <div className="p-4 sm:p-5 bg-[#0a0e17] border-t border-[#1a202c] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-[#141a26] hover:bg-[#1a202c] text-xs font-semibold text-[#cbd5e1] hover:text-[#ffffff] border border-[#1a202c] transition-colors cursor-pointer"
          >
            {tr.cancelBtn}
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                onSaveSettings(draft, false);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1d4ed8] hover:bg-[#0055ff] text-xs font-semibold text-[#ffffff] border border-[#0055ff] transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4 text-[#ffffff]" />
              {tr.saveBtn}
            </button>

            <button
              type="button"
              onClick={() => {
                onSaveSettings(draft, true);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#e11d48] hover:bg-[#ff0033] border-[1.5px] border-[#ff0033] text-xs font-bold text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)] transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              {tr.saveAndApplyBtn}
            </button>
          </div>
        </div>

        {/* Toast d'alerte flottant en cas de dépassement de la limite stricte de 3 bouquets actifs */}
        {limitWarning && (
          <div
            role="alert"
            aria-live="assertive"
            className="toast-notification border-[#f59e0b]"
          >
            <AlertTriangle className="w-5 h-5 text-[#f59e0b] shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-[#ffffff]">
              {limitWarning}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
