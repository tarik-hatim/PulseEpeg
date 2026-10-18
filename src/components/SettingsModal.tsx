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
  cleanBouquetName,
  getActiveLanguage,
  getBouquetLocalizedText,
  getCategoryLocalizedText,
  getLanguageOption,
  getTranslations,
  LANGUAGE_OPTIONS,
  toStandardDigits,
} from '../utils/i18n';
import { ensureHttpsUrl } from '../utils/xmltvParser';
import { PRO_BOUQUETS_UPGRADE_MESSAGE } from '../services/supabaseService';

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
  isPremium?: boolean;
  onRequestProUpgrade?: () => void;
  watchedChannelsCount?: number;
  totalWatchCount?: number;
  onResetWatchHabits?: () => void;
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
  isPremium = false,
  onRequestProUpgrade,
  watchedChannelsCount = 0,
  totalWatchCount = 0,
  onResetWatchHabits,
}) => {
  const effectiveMaxBouquets = isPremium
    ? ALL_BOUQUET_IDS.length
    : MAX_ACTIVE_BOUQUETS;
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [activeTab, setActiveTab] = useState<'filters' | 'sources' | 'legal'>(
    initialTab
  );
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newCountry, setNewCountry] =
    useState<Exclude<CountryCode, 'Tous'>>('FR');
  const [limitWarning, setLimitWarning] = useState<string | null>(null);
  const [habitsResetFeedback, setHabitsResetFeedback] = useState(false);
  const [satFilterTab, setSatFilterTab] = useState<string>('all');

  useEffect(() => {
    setDraft(settings);
    setLimitWarning(null);
    setHabitsResetFeedback(false);
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
    setDraft((prev) => {
      const nextBouquets = [...dyn.selectedBouquets];
      const nextProfile = dyn.tvProfile;

      return {
        ...prev,
        language: lang,
        tvProfile: nextProfile,
        selectedBouquets: nextBouquets,
        sources: syncSourcesWithSelectedBouquets(
          nextBouquets,
          prev.sources,
          nextProfile
        ),
      };
    });
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
    const isCurrentlySelected = draft.selectedBouquets.includes(bouquetId);
    
    // Vérification du quota Freemium AVANT l'appel de setDraft (évite tout setState parent dans le reducer)
    if (!isCurrentlySelected && !isPremium && draft.selectedBouquets.length >= effectiveMaxBouquets) {
      setLimitWarning(PRO_BOUQUETS_UPGRADE_MESSAGE);
      if (onRequestProUpgrade) {
        onRequestProUpgrade();
      }
      return;
    }

    setLimitWarning(null);
    setDraft((prev) => {
      const exists = prev.selectedBouquets.includes(bouquetId);
      const nextBouquets = exists
        ? prev.selectedBouquets.filter((b) => b !== bouquetId)
        : [...prev.selectedBouquets, bouquetId];
      const nextProfile = inferTvProfileFromBouquets(
        nextBouquets,
        prev.tvProfile
      );
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
    });
  };

  const selectAllBouquets = () => {
    if (!isPremium) {
      setLimitWarning(PRO_BOUQUETS_UPGRADE_MESSAGE);
      if (onRequestProUpgrade) {
        onRequestProUpgrade();
      }
      return;
    }
    setLimitWarning(null);
    const allBouquets = [...ALL_BOUQUET_IDS];
    setDraft((prev) => ({
      ...prev,
      tvProfile: 'all_satellites',
      selectedBouquets: allBouquets,
      sources: syncSourcesWithSelectedBouquets(
        allBouquets,
        prev.sources,
        'all_satellites'
      ),
    }));
  };

  const toggleSatelliteGroup = (groupIds: EpgBouquetId[]) => {
    const allChecked = groupIds.every((id) =>
      draft.selectedBouquets.includes(id)
    );

    // Vérification du quota Freemium AVANT l'appel de setDraft
    if (!allChecked) {
      const merged = Array.from(
        new Set<EpgBouquetId>([...draft.selectedBouquets, ...groupIds])
      );
      if (
        !isPremium &&
        (merged.length > MAX_ACTIVE_BOUQUETS ||
          countActiveSatellites(merged) > MAX_ACTIVE_SATELLITES)
      ) {
        setLimitWarning(PRO_BOUQUETS_UPGRADE_MESSAGE);
        if (onRequestProUpgrade) {
          onRequestProUpgrade();
        }
        return;
      }
    }

    setLimitWarning(null);
    setDraft((prev) => {
      const isAllCurrentlyChecked = groupIds.every((id) =>
        prev.selectedBouquets.includes(id)
      );
      if (isAllCurrentlyChecked) {
        const remaining = prev.selectedBouquets.filter(
          (id) => !groupIds.includes(id)
        );
        const nextBouquets =
          remaining.length > 0 ? remaining : ([groupIds[0]] as EpgBouquetId[]);
        const nextProfile = inferTvProfileFromBouquets(
          nextBouquets,
          prev.tvProfile
        );
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
      const nextProfile = inferTvProfileFromBouquets(merged, prev.tvProfile);
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
      data-tv-modal-overlay="true"
      className="fixed inset-0 z-[2000] flex items-center justify-center p-1 sm:p-2.5 bg-[#0a0e17]/90 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        data-tv-modal="true"
        className="w-full max-w-4xl bg-[#101623] border border-[#1a202c] rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[94vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal — Compact, épuré et sans excès de marge latérale */}
        <div
          data-tv-modal-zone="header"
          data-tv-row="settings-header"
          className="shrink-0 px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0e17] border-b border-[#1a202c] flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#e11d48] border border-[#ff0033] flex items-center justify-center text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)] shrink-0">
              <Filter className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-[#ffffff] leading-tight">
                {tr.settingsModalTitle}
              </h2>
              <p className="text-[11px] sm:text-xs text-[#94a3b8] truncate">
                {tr.settingsModalSubtitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            data-tv-focusable="true"
            onClick={onClose}
            className="tv-dpad-btn p-1.5 sm:p-2 rounded-lg bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#e11d48]/70 transition-colors cursor-pointer shrink-0"
            title={tr.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation par Onglets — Encadrés uniformisés */}
        <div
          data-tv-modal-zone="tabs"
          data-tv-row="settings-tabs"
          className="shrink-0 px-3 sm:px-4 py-2 bg-[#0a0e17] border-b border-[#1a202c] flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar"
        >
          <button
            type="button"
            data-tv-focusable="true"
            data-selected={activeTab === 'filters' ? 'true' : undefined}
            aria-selected={activeTab === 'filters'}
            onClick={() => setActiveTab('filters')}
            className={`tv-dpad-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95 ${
              activeTab === 'filters'
                ? 'bg-[#e11d48] border border-[#ff0033] text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60'
            }`}
          >
            <Satellite className="w-3.5 h-3.5" />
            {tr.tabBouquetsFilters}
          </button>

          <button
            type="button"
            data-tv-focusable="true"
            data-selected={activeTab === 'sources' ? 'true' : undefined}
            aria-selected={activeTab === 'sources'}
            onClick={() => setActiveTab('sources')}
            className={`tv-dpad-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95 ${
              activeTab === 'sources'
                ? 'bg-[#e11d48] border border-[#ff0033] text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            {tr.tabXmltvCache}
          </button>

          <button
            type="button"
            data-tv-focusable="true"
            data-selected={activeTab === 'legal' ? 'true' : undefined}
            aria-selected={activeTab === 'legal'}
            onClick={() => setActiveTab('legal')}
            className={`tv-dpad-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 active:scale-95 ${
              activeTab === 'legal'
                ? 'bg-[#e11d48] border border-[#ff0033] text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            {tr.tabLegalPlayStore}
          </button>
        </div>

        {/* Body — Conteneur défilant compact, sans marges excessives gauche/droite */}
        <div
          data-tv-modal-scroll="true"
          className="px-2.5 sm:px-3.5 py-2.5 sm:py-3 pb-24 overflow-y-auto space-y-2.5 sm:space-y-3 flex-1 scroll-pb-24"
        >
          {/* Encadré 1 : Sélecteur de Langue International — Style ChannelRowCard */}
          <div className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] hover:border-[#e11d48]/40 transition-all space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="space-y-0.5">
                <h3 className="text-xs sm:text-sm font-bold text-[#ffffff] flex items-center gap-1.5">
                  <Languages className="w-3.5 h-3.5 text-[#0055ff]" />
                  {tr.languageSectionTitle}
                </h3>
                <p className="text-[11px] text-[#94a3b8]">
                  {tr.languageSectionDesc}
                </p>
              </div>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50">
                {langOpt.flag} {langOpt.label} · TMDB {langOpt.tmdbLocale}
              </span>
            </div>

            <div
              data-tv-modal-group="languages"
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2"
            >
              {LANGUAGE_OPTIONS.map((opt) => {
                const isSelected = activeLang === opt.code;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    data-tv-focusable="true"
                    onClick={() => handleSelectLanguage(opt.code)}
                    className={`tv-dpad-btn flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer font-semibold border ${
                      isSelected
                        ? 'bg-[#1a202c] border-2 border-[#0055ff] text-[#ffffff] shadow-[0_0_12px_rgba(0,85,255,0.35)]'
                        : 'bg-[#141a26] border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:bg-[#1a202c] hover:border-[#e11d48]/70'
                    }`}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span className="text-sm leading-none">{opt.flag}</span>
                      <span className="truncate">{opt.label}</span>
                    </span>
                    {isSelected && <Check className="w-3 h-3 text-[#ffffff] shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === 'filters' && (
            <>
              {/* Encadré 2 : Zone / Profil TV — Style ChannelRowCard */}
              <div className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] hover:border-[#e11d48]/40 transition-all space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="space-y-0.5">
                    <h3 className="text-xs sm:text-sm font-bold text-[#ffffff] flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-[#0055ff]" />
                      Zone / Profil TV
                    </h3>
                    <p className="text-[11px] text-[#94a3b8]">
                      Filtre la base EPG dès l&apos;initialisation (détection auto : <span className="text-[#ffffff] font-semibold">{systemLocaleLabel}</span>).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      data-tv-focusable="true"
                      onClick={handleAutoDetectTvProfile}
                      className="tv-dpad-btn inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0a0e17] hover:bg-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] border border-[#1a202c] hover:border-[#0055ff]/60 text-xs font-medium transition-colors cursor-pointer"
                      title="Réappliquer la détection automatique selon la langue du système"
                    >
                      <RotateCcw className="w-3 h-3 text-[#0055ff]" />
                      <span>Auto ({systemLocaleLabel})</span>
                    </button>
                    {activeProfileId === 'custom' && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50">
                        ⚙️ Profil personnalisé ({draft.selectedBouquets.length} bouquets)
                      </span>
                    )}
                  </div>
                </div>

                <div
                  data-tv-modal-group="profiles"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
                >
                  {TV_PROFILES_CATALOG.filter(
                    (profile) => profile.id !== 'all_satellites'
                  ).map((profile) => {
                    const isSelected = activeProfileId === profile.id;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        data-tv-focusable="true"
                        onClick={() => handleSelectTvProfile(profile.id)}
                        className={`tv-dpad-btn flex flex-col items-start justify-between gap-1.5 p-2.5 sm:p-3 rounded-lg text-start transition-all cursor-pointer min-h-[70px] border ${
                          isSelected
                            ? 'bg-[#1a202c] border-2 border-[#0055ff] text-[#ffffff] shadow-[0_0_12px_rgba(0,85,255,0.35)] font-bold'
                            : 'bg-[#141a26] border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:bg-[#1a202c] hover:border-[#e11d48]/70 font-medium'
                        }`}
                      >
                        <div className="w-full flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 font-bold text-xs text-[#ffffff] truncate">
                            <span className="text-sm leading-none shrink-0">
                              {profile.flag}
                            </span>
                            <span className="truncate">{profile.label}</span>
                          </span>
                          {isSelected && (
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 bg-[#0055ff] text-[#ffffff]">
                              {activeLang === 'ar' ? 'نشط' : activeLang === 'fr' ? 'Actif' : 'Active'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#94a3b8] line-clamp-2 leading-relaxed">
                          {profile.satellitesSummary}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Extensions optionnelles pour le profil Maghreb / MENA Multi-Sat */}
                {activeProfileId === 'maghreb_mena' && (
                  <div className="mt-1.5 p-2.5 rounded-lg bg-[#0a0e17] border border-[#0055ff]/40 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[#ffffff] flex items-center gap-1.5">
                        <Satellite className="w-3.5 h-3.5 text-[#ec4899]" />
                        {activeLang === 'ar'
                          ? 'أقمار إضافية للمغرب العربي والشرق الأوسط (اختياري) :'
                          : activeLang === 'fr'
                          ? 'Satellites complémentaires Maghreb / MENA (Optionnels) :'
                          : 'Additional Maghreb / MENA satellites (Optional):'}
                      </span>
                      <span className="text-[10px] font-mono text-[#94a3b8]">
                        {activeLang === 'ar'
                          ? 'نايل سات 7 غرب وبدر 26 شرق افتراضياً · حد أقصى 3 باقات'
                          : activeLang === 'fr'
                          ? 'Nilesat 7°W & Badr 26°E par défaut · Max 3 bouquets'
                          : 'Nilesat 7°W & Badr 26°E by default · Max 3 bouquets'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {MAGHREB_OPTIONAL_EXTENSIONS.map((ext) => {
                        const isExtActive = ext.bouquetIds.every((id) =>
                          draft.selectedBouquets.includes(id)
                        );
                        const wouldExceedMax =
                          !isPremium &&
                          !isExtActive &&
                          Array.from(
                            new Set([
                              ...draft.selectedBouquets,
                              ...ext.bouquetIds,
                            ])
                          ).length > MAX_ACTIVE_BOUQUETS;
                        return (
                          <button
                            key={ext.id}
                            type="button"
                            data-tv-focusable="true"
                            onClick={() => {
                              toggleSatelliteGroup(ext.bouquetIds);
                            }}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border cursor-pointer ${
                              wouldExceedMax
                                ? 'bg-[#0a0e17] border-[#1a202c] text-[#cbd5e1] opacity-65 hover:border-[#ec4899]'
                                : isExtActive
                                ? 'bg-[#1d4ed8]/30 border-[#ec4899] text-[#ffffff] shadow-[0_0_8px_rgba(236,72,153,0.3)]'
                                : 'bg-[#0a0e17] border-[#1e293b] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]'
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

              {/* Encadré 3 : Couverture Globale des Satellites & Bouquets — Style ChannelRowCard */}
              <div className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] hover:border-[#e11d48]/40 transition-all space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="text-xs sm:text-sm font-bold text-[#ffffff] flex items-center gap-2">
                      <Satellite className="w-4 h-4 text-[#0055ff]" />
                      {tr.bouquetsSectionTitle}
                    </h3>
                    <p className="text-xs text-[#cbd5e1] mt-0.5">
                      {isPremium
                        ? 'Mode PulseEPG Pro 👑 actif : Sélection illimitée de bouquets et synchronisation multi-satellites débloquées.'
                        : `Maximum ${MAX_ACTIVE_BOUQUETS} bouquets sélectionnés simultanément en mode Invité / Gratuit.`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider ${
                        isPremium
                          ? 'bg-gradient-to-r from-[#f59e0b]/20 to-[#ec4899]/20 text-[#fde047] border-[#f59e0b]'
                          : draft.selectedBouquets.length >= MAX_ACTIVE_BOUQUETS
                          ? 'bg-[#e11d48]/20 text-[#ffffff] border-[#e11d48]'
                          : 'bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50'
                      }`}
                    >
                      {isPremium
                        ? `${draft.selectedBouquets.length}/${ALL_BOUQUET_IDS.length} Bouquets (Illimité Pro 👑)`
                        : `${draft.selectedBouquets.length}/${MAX_ACTIVE_BOUQUETS} Bouquets actifs (Max ${MAX_ACTIVE_BOUQUETS})`}
                    </span>
                    <button
                      type="button"
                      data-tv-focusable="true"
                      onClick={selectAllBouquets}
                      className="tv-dpad-btn px-2.5 py-1 rounded-lg bg-gradient-to-r from-[#ec4899]/25 to-[#8b5cf6]/25 border border-[#ec4899] text-[11px] font-bold text-[#fde047] hover:bg-[#ec4899]/40 transition-all cursor-pointer"
                    >
                      {isPremium
                        ? '🛰️ Activer tous les bouquets (Multi-Satellites)'
                        : '👑 Débloquer tous les bouquets (Pro)'}
                    </button>
                  </div>
                </div>

                {limitWarning && (
                  <div className="p-2.5 rounded-lg bg-[#0a0e17] border border-[#f59e0b]/70 text-[#ffffff] text-xs font-medium flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-4 h-4 text-[#f59e0b] shrink-0" />
                      <span>{limitWarning}</span>
                    </div>
                    {!isPremium && onRequestProUpgrade && (
                      <button
                        type="button"
                        data-tv-focusable="true"
                        onClick={onRequestProUpgrade}
                        className="tv-dpad-btn px-2.5 py-1 rounded-lg bg-[#ec4899] text-[#ffffff] text-xs font-bold cursor-pointer shrink-0"
                      >
                        Activer Pro 👑
                      </button>
                    )}
                  </div>
                )}

                {/* Ruban rapide de sélection / filtre par satellite (Style épuré, compact et direct) */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
                  <button
                    type="button"
                    onClick={() => setSatFilterTab('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer ${
                      satFilterTab === 'all'
                        ? 'bg-[#0055ff] text-[#ffffff] shadow-[0_0_8px_rgba(0,85,255,0.4)]'
                        : 'bg-[#0a0e17] text-[#94a3b8] hover:text-[#ffffff] border border-[#1a202c]'
                    }`}
                  >
                    {activeLang === 'ar'
                      ? `جميع الأقمار (${toStandardDigits(SATELLITE_GROUPS_CATALOG.length)})`
                      : activeLang === 'fr'
                      ? `Tous les satellites (${SATELLITE_GROUPS_CATALOG.length})`
                      : `All satellites (${SATELLITE_GROUPS_CATALOG.length})`}
                  </button>
                  {SATELLITE_GROUPS_CATALOG.map((sg) => {
                    const isActive = satFilterTab === sg.satelliteId;
                    const hasSelected = sg.bouquets.some((b) =>
                      draft.selectedBouquets.includes(b.id)
                    );
                    return (
                      <button
                        key={sg.satelliteId}
                        type="button"
                        onClick={() => setSatFilterTab(sg.satelliteId)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-semibold shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-[#0055ff] text-[#ffffff] shadow-[0_0_8px_rgba(0,85,255,0.4)]'
                            : hasSelected
                            ? 'bg-[#0a0e17] text-[#38bdf8] border border-[#0055ff]/60'
                            : 'bg-[#0a0e17] text-[#94a3b8] hover:text-[#ffffff] border border-[#1a202c]'
                        }`}
                      >
                        <span className="text-sm leading-none">{sg.flag}</span>
                        <span>{sg.orbitalPosition}</span>
                        {hasSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Cartes satellites compactes et bouquets en puces lisibles */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {SATELLITE_GROUPS_CATALOG.filter(
                    (sg) => satFilterTab === 'all' || satFilterTab === sg.satelliteId
                  ).map((satGroup) => {
                    const groupBouquets = satGroup.bouquets;
                    const groupIds = groupBouquets.map((bq) => bq.id);
                    const activeCount = groupIds.filter((id) =>
                      draft.selectedBouquets.includes(id)
                    ).length;
                    const allChecked =
                      groupIds.length > 0 && activeCount === groupIds.length;
                    const someChecked = activeCount > 0;
                    const isMaxReached =
                      draft.selectedBouquets.length >= effectiveMaxBouquets;

                    return (
                      <div
                        key={satGroup.satelliteId}
                        data-tv-modal-group={`sat-${satGroup.satelliteId}`}
                        className={`rounded-lg border p-2.5 sm:p-3 transition-all flex flex-col gap-2.5 ${
                          someChecked
                            ? 'bg-[#0a0e17] border-[#0055ff]/70 shadow-[0_0_10px_rgba(0,85,255,0.2)]'
                            : 'bg-[#0a0e17]/80 border-[#1a202c] hover:border-[#e11d48]/60'
                        }`}
                      >
                        {/* En-tête compact de la carte Satellite */}
                        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1a202c]">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-base leading-none shrink-0">
                              {satGroup.flag}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs sm:text-sm font-bold text-[#ffffff] truncate">
                                  {satGroup.orbitalPosition}
                                </span>
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50">
                                  {activeCount}/{groupIds.length} actif{activeCount > 1 ? 's' : ''}
                                </span>
                              </div>
                              <p className="text-[11px] text-[#94a3b8] truncate">
                                {satGroup.subtitle}
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleSatelliteGroup(groupIds)}
                            className="tv-dpad-btn text-[11px] font-semibold text-[#cbd5e1] hover:text-[#ffffff] px-2 py-1 rounded bg-[#141a26] border border-[#1a202c] hover:border-[#0055ff] shrink-0 cursor-pointer transition-colors"
                          >
                            {allChecked ? 'Tout décocher' : 'Tout cocher'}
                          </button>
                        </div>

                        {/* Bouquets affichés sous forme de puces lisibles & compactes — Style ChannelRowCard */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {groupBouquets.map((bq) => {
                            const checked = draft.selectedBouquets.includes(bq.id);
                            const isLockedByFreemium =
                              !checked && !isPremium && isMaxReached;
                            const loc = getBouquetLocalizedText(
                              bq.id,
                              activeLang,
                              bq.label,
                              bq.description
                            );
                            const cleanedLabel = cleanBouquetName(
                              loc.label,
                              satGroup.title
                            );

                            return (
                              <div
                                key={bq.id}
                                role="checkbox"
                                aria-checked={checked}
                                tabIndex={0}
                                data-tv-focusable="true"
                                onClick={() => toggleBouquet(bq.id)}
                                onKeyDown={(e) => {
                                  if (
                                    e.key === 'Enter' ||
                                    e.key === ' ' ||
                                    e.key === 'Select' ||
                                    e.keyCode === 23 ||
                                    e.keyCode === 66
                                  ) {
                                    e.preventDefault();
                                    toggleBouquet(bq.id);
                                  }
                                }}
                                className={`tv-dpad-btn p-2 rounded-lg transition-all flex items-center justify-between gap-1.5 cursor-pointer border text-xs ${
                                  isLockedByFreemium
                                    ? 'bg-[#141a26]/40 border-[#1a202c] text-[#64748b] opacity-60'
                                    : checked
                                    ? 'bg-[#1a202c] border-2 border-[#0055ff] text-[#ffffff] shadow-[0_0_10px_rgba(0,85,255,0.3)] font-semibold'
                                    : 'bg-[#141a26] border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:bg-[#1a202c] hover:border-[#e11d48]/70 font-medium'
                                }`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  {checked ? (
                                    <CheckSquare className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                                  ) : (
                                    <Square className="w-3.5 h-3.5 text-[#64748b] shrink-0" />
                                  )}
                                  <span className="truncate">
                                    {bq.flag} {cleanedLabel}
                                  </span>
                                </div>
                                {bq.sampleChannels && bq.sampleChannels[0] && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0a0e17] text-[#38bdf8] border border-[#1a202c] shrink-0 truncate max-w-[80px]">
                                    {bq.sampleChannels[0]}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Encadré 4 : Catégories Thématiques — Style ChannelRowCard */}
              <div className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] hover:border-[#e11d48]/40 transition-all space-y-3">
                <div className="space-y-0.5">
                  <h3 className="text-xs sm:text-sm font-bold text-[#ffffff] flex items-center gap-2">
                    <Film className="w-4 h-4 text-[#e11d48]" />
                    {tr.thematicCategoriesTitle}
                  </h3>
                  <p className="text-xs text-[#cbd5e1] leading-relaxed">
                    {tr.thematicCategoriesDesc}
                  </p>
                </div>

                <div
                  data-tv-modal-group="categories"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2"
                >
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
                        data-tv-focusable="true"
                        onClick={() => toggleCategory(cat.id)}
                        onKeyDown={(e) => {
                          if (
                            e.key === 'Enter' ||
                            e.key === ' ' ||
                            e.key === 'Select' ||
                            e.keyCode === 23 ||
                            e.keyCode === 66
                          ) {
                            e.preventDefault();
                            toggleCategory(cat.id);
                          }
                        }}
                        className={`tv-dpad-btn p-2.5 sm:p-3 rounded-lg transition-all cursor-pointer flex items-start gap-2.5 border text-xs ${
                          checked
                            ? 'bg-[#1a202c] border-2 border-[#e11d48] text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.35)] font-semibold'
                            : 'bg-[#141a26] border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:bg-[#1a202c] hover:border-[#e11d48]/70 font-medium'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {checked ? (
                            <CheckSquare className="w-3.5 h-3.5 text-[#e11d48]" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-[#64748b]" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            {getCategoryIcon(cat.id)}
                            <span className="text-xs font-bold text-[#ffffff] leading-snug">
                              {locCat.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-[#94a3b8] leading-tight line-clamp-2">
                            {locCat.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Encadré 5 : Filtres Audio VO & Sous-titres — Style ChannelRowCard */}
              <div className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] hover:border-[#e11d48]/40 transition-all space-y-2.5">
                <h3 className="text-xs sm:text-sm font-bold text-[#ffffff] flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#0055ff]" />
                  {tr.audioSubtitlesTitle}
                </h3>

                <div
                  data-tv-modal-group="audio"
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                >
                  <div
                    tabIndex={0}
                    role="button"
                    data-tv-focusable="true"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        excludePolishLektor: !prev.excludePolishLektor,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' ||
                        e.key === ' ' ||
                        e.key === 'Select' ||
                        e.keyCode === 23 ||
                        e.keyCode === 66
                      ) {
                        e.preventDefault();
                        setDraft((prev) => ({
                          ...prev,
                          excludePolishLektor: !prev.excludePolishLektor,
                        }));
                      }
                    }}
                    className={`tv-dpad-btn p-2.5 sm:p-3 rounded-lg transition-all cursor-pointer flex items-start gap-2.5 border ${
                      draft.excludePolishLektor
                        ? 'bg-[#1a202c] border-2 border-[#0055ff] text-[#ffffff] shadow-[0_0_10px_rgba(0,85,255,0.3)]'
                        : 'bg-[#141a26] border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:bg-[#1a202c] hover:border-[#e11d48]/70'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {draft.excludePolishLektor ? (
                        <CheckSquare className="w-3.5 h-3.5 text-[#0055ff]" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-[#64748b]" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-[#0055ff]" />
                        <span className="text-xs font-bold text-[#ffffff]">
                          {tr.excludePolishLektorTitle}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#94a3b8] leading-tight">
                        {tr.excludePolishLektorDesc}
                      </p>
                    </div>
                  </div>

                  <div
                    tabIndex={0}
                    role="button"
                    data-tv-focusable="true"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        excludeNoSubtitles: !prev.excludeNoSubtitles,
                      }))
                    }
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' ||
                        e.key === ' ' ||
                        e.key === 'Select' ||
                        e.keyCode === 23 ||
                        e.keyCode === 66
                      ) {
                        e.preventDefault();
                        setDraft((prev) => ({
                          ...prev,
                          excludeNoSubtitles: !prev.excludeNoSubtitles,
                        }));
                      }
                    }}
                    className={`tv-dpad-btn p-2.5 sm:p-3 rounded-lg transition-all cursor-pointer flex items-start gap-2.5 border ${
                      draft.excludeNoSubtitles
                        ? 'bg-[#1a202c] border-2 border-[#0055ff] text-[#ffffff] shadow-[0_0_10px_rgba(0,85,255,0.3)]'
                        : 'bg-[#141a26] border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:bg-[#1a202c] hover:border-[#e11d48]/70'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      {draft.excludeNoSubtitles ? (
                        <CheckSquare className="w-3.5 h-3.5 text-[#0055ff]" />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-[#64748b]" />
                      )}
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Subtitles className="w-3.5 h-3.5 text-[#0055ff]" />
                        <span className="text-xs font-bold text-[#ffffff]">
                          {tr.requireSubtitlesTitle}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#94a3b8] leading-tight">
                        {tr.requireSubtitlesDesc}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Encadré 6 : Tri Intelligent & Habitudes de visionnage — Style ChannelRowCard */}
              <div
                data-tv-modal-group="watch-habits"
                className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] hover:border-[#e11d48]/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Sparkles className="w-4 h-4 text-[#ec4899] shrink-0" />
                    <h3 className="text-xs sm:text-sm font-bold text-[#ffffff]">
                      {activeLang === 'ar'
                        ? 'الترتيب الذكي وعادات المشاهدة'
                        : activeLang === 'fr'
                        ? 'Tri Intelligent & Habitudes de visionnage'
                        : 'Smart Sort & Viewing Habits'}
                    </h3>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50">
                      {toStandardDigits(watchedChannelsCount)}{' '}
                      {activeLang === 'ar' ? 'قناة' : activeLang === 'fr' ? 'chaînes' : 'channels'} ·{' '}
                      {toStandardDigits(totalWatchCount)}{' '}
                      {activeLang === 'ar' ? 'مشاهدة' : activeLang === 'fr' ? 'vues' : 'views'}
                    </span>
                  </div>
                  <p className="text-xs text-[#cbd5e1] leading-relaxed">
                    {activeLang === 'ar'
                      ? 'يحفظ محلياً تكرار المشاهدة وتوقيتها لتفضيل قنواتك الأكثر متابعة ورفعها تلقائياً للأعلى.'
                      : activeLang === 'fr'
                      ? 'Stocke localement (LocalStorage / IndexedDB / Supabase) la fréquence (watchCount) et l’horodatage (lastWatchedTimestamp) pour faire remonter vos chaînes les plus regardées selon Score = (Poids_LCN × Rang_LCN) + (Poids_Usage × Score_Fréquence).'
                      : 'Locally stores watchCount and lastWatchedTimestamp (LocalStorage / IndexedDB / Supabase) to promote your most-watched channels using Score = (LCN_Weight × LCN_Rank) + (Usage_Weight × Frequency_Score).'}
                  </p>
                </div>

                <button
                  type="button"
                  data-tv-focusable="true"
                  onClick={() => {
                    onResetWatchHabits?.();
                    setHabitsResetFeedback(true);
                    setTimeout(() => setHabitsResetFeedback(false), 3000);
                  }}
                  className="tv-dpad-btn inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg bg-[#0a0e17] hover:bg-[#1a202c] border border-[#ec4899]/60 hover:border-[#ec4899] text-xs font-bold text-[#ffffff] transition-all cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#ec4899] shrink-0" />
                  <span>
                    {habitsResetFeedback
                      ? activeLang === 'ar'
                        ? 'تمت إعادة تعيين العادات ✓'
                        : activeLang === 'fr'
                        ? 'Habitudes réinitialisées ✓'
                        : 'Viewing habits reset ✓'
                      : activeLang === 'ar'
                      ? 'إعادة تعيين عادات المشاهدة'
                      : activeLang === 'fr'
                      ? 'Réinitialiser les habitudes de visionnage'
                      : 'Reset viewing habits'}
                  </span>
                </button>
              </div>

              {/* Aperçu & Formats de l'Icône de Lancement Multi-Terminaux (Smartphone, Tablette, Android TV, TV Box) */}
              <LauncherIconsPreviewCard language={draft.language} />
            </>
          )}

          {activeTab === 'sources' && (
            <>
              {/* Encadré Sources 1 : État du Cache IndexedDB */}
              <div className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] hover:border-[#e11d48]/40 transition-all flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-[#0a0e17] border border-[#1a202c] flex items-center justify-center shrink-0">
                    <HardDrive className="w-4 h-4 text-[#0055ff]" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#ffffff]">
                      {tr.cacheIndexedDbTitle}
                    </h3>
                    {cacheMeta ? (
                      <p className="text-xs text-[#cbd5e1] mt-0.5 truncate">
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
                      data-tv-focusable="true"
                      checked={draft.autoRefreshHours > 0}
                      onChange={(e) =>
                        setDraft((prev) => ({
                          ...prev,
                          autoRefreshHours: e.target.checked ? 12 : 0,
                        }))
                      }
                      className="rounded border-[#1a202c] bg-[#0a0e17] text-[#e11d48] focus:ring-[#e11d48]"
                    />
                    {tr.autoRefresh12h}
                  </label>

                  <button
                    type="button"
                    data-tv-focusable="true"
                    onClick={onClearCache}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0a0e17] hover:bg-[#1a202c] text-[#ffffff] border border-[#1a202c] text-xs font-medium transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-[#cbd5e1]" />
                    {tr.clearCacheBtn}
                  </button>
                </div>
              </div>

              {/* Encadré Sources 2 : Liste des flux XMLTV configurés */}
              <div className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] hover:border-[#e11d48]/40 transition-all space-y-2.5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#cbd5e1] flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-[#0055ff]" />
                    {tr.xmltvSourcesActiveTitle} (
                    {draft.sources.filter((s) => s.enabled).length}/
                    {draft.sources.length})
                  </h3>
                  <button
                    type="button"
                    data-tv-focusable="true"
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
                      className={`p-2.5 rounded-lg border flex items-center justify-between gap-3 transition-colors ${
                        source.enabled
                          ? 'bg-[#0a0e17] border-[#1a202c]'
                          : 'bg-[#0a0e17]/50 border-[#1a202c]/50 opacity-60'
                      }`}
                    >
                      <label className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer">
                        <input
                          type="checkbox"
                          data-tv-focusable="true"
                          checked={source.enabled}
                          onChange={() => handleToggleSource(source.id)}
                          className="w-4 h-4 rounded border-[#1a202c] bg-[#141a26] text-[#e11d48] focus:ring-[#e11d48]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50">
                              {source.country}
                            </span>
                            <span className="text-xs sm:text-sm font-semibold text-[#ffffff] truncate">
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
                          data-tv-focusable="true"
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

              {/* Encadré Sources 3 : Ajouter un flux XMLTV personnalisé */}
              <form
                onSubmit={handleAddSource}
                className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] hover:border-[#e11d48]/40 transition-all space-y-3"
              >
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#ffffff] flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-[#e11d48]" />
                  {tr.addCustomXmltvTitle}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <select
                    value={newCountry}
                    data-tv-focusable="true"
                    onChange={(e) =>
                      setNewCountry(
                        e.target.value as Exclude<CountryCode, 'Tous'>
                      )
                    }
                    className="px-3 py-2 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-xs text-[#ffffff] focus:outline-none focus:border-[#0055ff]"
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
                    data-tv-focusable="true"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={tr.sourceNamePlaceholder}
                    className="px-3 py-2 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-xs text-[#ffffff] placeholder-[#cbd5e1]/60 focus:outline-none focus:border-[#0055ff]"
                  />

                  <input
                    type="url"
                    data-tv-focusable="true"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://.../epg.xml.gz"
                    className="sm:col-span-2 px-3 py-2 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-xs text-[#ffffff] placeholder-[#cbd5e1]/60 font-mono focus:outline-none focus:border-[#0055ff]"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    data-tv-focusable="true"
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
            <div className="space-y-3">
              {/* Encadré Légal 1 : Clause Google Play Store */}
              <div className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] hover:border-[#e11d48]/40 transition-all space-y-2">
                <div className="flex items-center gap-2 text-[#ffffff] font-bold text-sm">
                  <ShieldCheck className="w-5 h-5 text-[#0055ff] shrink-0" />
                  <span>{tr.legalNonStreamingTitle}</span>
                </div>
                <p className="text-xs text-[#cbd5e1] leading-relaxed">
                  {tr.legalNonStreamingClause}
                </p>
              </div>

              {/* Encadré Légal 2 : Attribution Officielle TMDB & TVMaze */}
              <div className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] hover:border-[#e11d48]/40 transition-all space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-[#ffffff] font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-[#e11d48] shrink-0" />
                    <span>{tr.legalTmdbTitle}</span>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50">
                    TMDB API v3
                  </span>
                </div>

                <p className="text-xs text-[#cbd5e1] leading-relaxed">
                  {tr.legalTmdbNotice}
                </p>

                <div className="p-2.5 rounded-lg bg-[#0a0e17] border border-[#1a202c] text-[11px] text-[#cbd5e1] font-mono leading-relaxed">
                  "This product uses the TMDB API but is not endorsed or
                  certified by TMDB."
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                  <a
                    href="https://www.themoviedb.org/"
                    target="_blank"
                    rel="noopener noreferrer"
                    data-tv-focusable="true"
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
                    data-tv-focusable="true"
                    className="inline-flex items-center gap-1.5 text-[#cbd5e1] hover:text-[#ffffff] font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    TVMaze API (CC BY-SA)
                  </a>
                </div>
              </div>

              {/* Encadré Légal 3 : Politique de Confidentialité & RGPD */}
              <div className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] hover:border-[#e11d48]/40 transition-all space-y-2">
                <div className="flex items-center gap-2 text-[#ffffff] font-bold text-sm">
                  <Lock className="w-4 h-4 text-[#0055ff] shrink-0" />
                  <span>{tr.legalPrivacyTitle}</span>
                </div>
                <p className="text-xs text-[#cbd5e1] leading-relaxed">
                  {tr.legalPrivacyDesc}
                </p>
              </div>

              {/* Encadré Légal 4 : Informations de Version & PWA / Android */}
              <div className="p-3 sm:p-3.5 rounded-lg bg-[#141a26] border border-[#1a202c] flex flex-wrap items-center justify-between gap-3 text-xs text-[#cbd5e1]">
                <div className="flex items-center gap-2">
                  <Info className="w-4 h-4 text-[#cbd5e1]" />
                  <span>
                    <strong className="text-[#ffffff]">
                      PulseEPG - Your Ultimate TV Guide
                    </strong>{' '}
                    · v2.5.0 (Play Store Release Ready)
                  </span>
                </div>
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded border uppercase tracking-wider bg-[#1d4ed8]/20 text-[#ffffff] border-[#0055ff]/50">
                  PWA Standalone & Android TV Ready
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions — Rouge/Crimson Sky Sport pour l'action principale */}
        <div
          data-tv-modal-zone="footer"
          data-tv-row="settings-footer"
          className="shrink-0 px-3 sm:px-4 py-2.5 sm:py-3 bg-[#0a0e17] border-t border-[#1a202c] flex flex-wrap items-center justify-between gap-2.5 z-20"
        >
          <button
            type="button"
            data-tv-focusable="true"
            onClick={onClose}
            className="tv-dpad-btn px-3.5 py-2 rounded-lg bg-[#141a26] hover:bg-[#1a202c] text-xs font-semibold text-[#cbd5e1] hover:text-[#ffffff] border border-[#1a202c] transition-colors cursor-pointer"
          >
            {tr.cancelBtn}
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              data-tv-focusable="true"
              onClick={() => {
                onSaveSettings(draft, false);
                onClose();
              }}
              className="tv-dpad-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#1d4ed8] hover:bg-[#0055ff] text-xs font-semibold text-[#ffffff] border border-[#0055ff] transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4 text-[#ffffff]" />
              {tr.saveBtn}
            </button>

            <button
              type="button"
              data-tv-focusable="true"
              onClick={() => {
                onSaveSettings(draft, true);
                onClose();
              }}
              className="tv-dpad-btn inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#e11d48] hover:bg-[#ff0033] border-[1.5px] border-[#ff0033] text-xs font-bold text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)] transition-all cursor-pointer"
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
