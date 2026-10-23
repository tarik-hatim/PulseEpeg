import React, { useEffect, useMemo } from 'react';
import {
  X,
  RotateCcw,
  SlidersHorizontal,
  Tv,
  Film,
  Trophy,
  FileText,
  Newspaper,
  Baby,
  Music,
  Satellite,
  Layers,
  Globe,
  Check,
} from 'lucide-react';
import {
  AppLanguage,
  BouquetFilter,
  ChannelCountryFilter,
  ChannelGroup,
  ContentCategoryFilter,
  SatelliteFilter,
} from '../types/epg';
import {
  getLanguageOption,
  getTranslations,
  translateBouquetFilter,
  translateCategoryFilter,
  translateChannelCountryFilter,
  translateSatelliteFilter,
  translateSubGenreGroup,
  toStandardDigits,
} from '../utils/i18n';
import { STRICT_SAT_FILTER_LIST } from '../services/storageService';

export interface TvFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  language?: AppLanguage;
  selectedCategory: ContentCategoryFilter;
  onSelectCategory: (category: ContentCategoryFilter) => void;
  selectedGroup: ChannelGroup;
  onSelectGroup: (group: ChannelGroup) => void;
  selectedSatellite: SatelliteFilter;
  onSelectSatellite: (satellite: SatelliteFilter) => void;
  selectedBouquet: BouquetFilter;
  onSelectBouquet: (bouquet: BouquetFilter) => void;
  selectedCountry: ChannelCountryFilter;
  onSelectCountry: (country: ChannelCountryFilter) => void;
  categoryCounts: Record<ContentCategoryFilter, number>;
  satelliteCounts: Record<SatelliteFilter, number>;
  bouquetCounts: Record<BouquetFilter, number>;
  countryCounts: Record<ChannelCountryFilter, number>;
  groupCounts: Record<ChannelGroup, number>;
  allowedSatelliteOptions?: SatelliteFilter[];
  allowedBouquetOptions?: BouquetFilter[];
  allowedCountryOptions?: ChannelCountryFilter[];
  onResetFilters: () => void;
  activeFiltersCount: number;
}

const CATEGORY_ITEMS: {
  code: ContentCategoryFilter;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { code: 'Tous', icon: Tv },
  { code: 'Films & Séries', icon: Film },
  { code: 'Sport / Football', icon: Trophy },
  { code: 'Documentaires', icon: FileText },
  { code: 'Actualités / News', icon: Newspaper },
  { code: 'Jeunesse / Enfants', icon: Baby },
  { code: 'Musique & Divertissement', icon: Music },
];

const SUBGENRE_ITEMS: ChannelGroup[] = [
  'Tous',
  'Cinéma Premières',
  'Action & Thriller',
  'Séries TV & US',
  'Comédie & Famille',
  'Classiques & Culte',
];

export const TvFilterDrawer: React.FC<TvFilterDrawerProps> = ({
  isOpen,
  onClose,
  language = 'fr',
  selectedCategory,
  onSelectCategory,
  selectedGroup,
  onSelectGroup,
  selectedSatellite,
  onSelectSatellite,
  selectedBouquet,
  onSelectBouquet,
  selectedCountry,
  onSelectCountry,
  categoryCounts,
  satelliteCounts,
  bouquetCounts,
  countryCounts,
  groupCounts = {} as Record<ChannelGroup, number>,
  allowedSatelliteOptions,
  allowedBouquetOptions,
  allowedCountryOptions,
  onResetFilters,
  activeFiltersCount,
}) => {
  const tr = getTranslations(language);
  const langOpt = getLanguageOption(language);
  const isRtl = langOpt.dir === 'rtl';

  // Support de la touche Escape pour fermer le tiroir
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const satOptions = useMemo(() => {
    const list = allowedSatelliteOptions || STRICT_SAT_FILTER_LIST;
    return list.filter((s) => s === 'Tous' || (satelliteCounts[s] ?? 0) > 0 || s === selectedSatellite);
  }, [allowedSatelliteOptions, satelliteCounts, selectedSatellite]);

  const bouquetOptions = useMemo(() => {
    const list = allowedBouquetOptions || [];
    return list.filter((b) => b === 'Tous' || (bouquetCounts[b] ?? 0) > 0 || b === selectedBouquet);
  }, [allowedBouquetOptions, bouquetCounts, selectedBouquet]);

  const countryOptions = useMemo(() => {
    const list = allowedCountryOptions || ['Tous', 'FR', 'AR', 'ES', 'DE', 'IT', 'UK', 'US', 'INT'] as ChannelCountryFilter[];
    return list.filter((c) => c === 'Tous' || (countryCounts[c] ?? 0) > 0 || c === selectedCountry);
  }, [allowedCountryOptions, countryCounts, selectedCountry]);

  if (!isOpen) return null;

  return (
    <div
      dir={langOpt.dir}
      className="fixed inset-0 z-[2100] flex justify-end bg-black/70 backdrop-blur-sm transition-opacity animate-fadeIn"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-label={language === 'ar' ? 'فلاتر الدليل' : 'Filtres du guide TV'}
    >
      <div
        className={`relative w-full max-w-md sm:max-w-sm h-full bg-[#0d121f] border-s border-[#1a202c] shadow-2xl flex flex-col transform transition-transform duration-300 ease-out ${
          isRtl ? 'translate-x-0' : 'translate-x-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête du volet */}
        <div className="px-4 py-3.5 border-b border-[#1a202c] bg-[#0b0f19] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#2563eb]/20 border border-[#2563eb]/40 flex items-center justify-center text-[#38bdf8]">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>{language === 'ar' ? 'فلاتر القنوات' : 'Filtres TV'}</span>
                {activeFiltersCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#ec4899] text-white tabular-nums">
                    {toStandardDigits(String(activeFiltersCount))}
                  </span>
                )}
              </h2>
              <p className="text-[11px] text-[#94a3b8]">
                {language === 'ar' ? 'تخصيص العرض حسب الرغبة' : 'Affinez votre grille et direct'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === 'ar' ? 'إغلاق' : 'Fermer'}
            className="w-8 h-8 rounded-lg bg-[#141a26] hover:bg-[#1a202c] border border-[#1e293b] text-[#cbd5e1] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corps défilable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs">
          {/* Rubrique 1 : Contenu */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] flex items-center gap-1.5">
                <Tv className="w-3.5 h-3.5 text-[#38bdf8]" />
                {language === 'ar' ? 'نوع المحتوى' : 'Contenu'}
              </span>
              {selectedCategory !== 'Tous' && (
                <button
                  type="button"
                  onClick={() => onSelectCategory('Tous')}
                  className="text-[10px] text-[#38bdf8] hover:underline cursor-pointer"
                >
                  {language === 'ar' ? 'الكل' : 'Tous'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {CATEGORY_ITEMS.map(({ code, icon: IconComp }) => {
                const count = categoryCounts[code] ?? 0;
                const isSelected = selectedCategory === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => {
                      onSelectCategory(code);
                      if (code !== 'Films & Séries' && selectedGroup !== 'Tous') {
                        onSelectGroup('Tous');
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2563eb]/25 border border-[#38bdf8] text-white shadow-[0_0_8px_rgba(56,189,248,0.25)]'
                        : 'bg-[#141a26]/70 hover:bg-[#141a26] border border-[#1e293b] text-[#cbd5e1] hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <IconComp className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-[#38bdf8]' : 'text-[#64748b]'}`} />
                      <span className="truncate">{translateCategoryFilter(code, language)}</span>
                    </span>
                    <span className={`tabular-nums text-[11px] shrink-0 ms-2 ${isSelected ? 'text-[#38bdf8] font-bold' : 'text-[#64748b]'}`}>
                      {toStandardDigits(String(count))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Rubrique 2 : Affiner films et séries (Uniquement quand Films & Séries est actif) */}
          {selectedCategory === 'Films & Séries' && (
            <section className="space-y-2 p-3 rounded-xl bg-[#141a26]/40 border border-[#2563eb]/30 animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#38bdf8] flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-[#ec4899]" />
                  {language === 'ar' ? 'تخصيص الأفلام والمسلسلات' : 'Affiner films & séries'}
                </span>
                {selectedGroup !== 'Tous' && (
                  <button
                    type="button"
                    onClick={() => onSelectGroup('Tous')}
                    className="text-[10px] text-[#ec4899] hover:underline cursor-pointer"
                  >
                    {language === 'ar' ? 'إعادة ضبط' : 'Réinitialiser'}
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-1">
                {SUBGENRE_ITEMS.map((grp) => {
                  const count = groupCounts[grp] ?? 0;
                  const isSelected = selectedGroup === grp;
                  return (
                    <button
                      key={grp}
                      type="button"
                      onClick={() => onSelectGroup(grp)}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#ec4899]/20 border border-[#ec4899]/70 text-white font-semibold'
                          : 'hover:bg-[#141a26] text-[#cbd5e1] hover:text-white'
                      }`}
                    >
                      <span className="truncate">{translateSubGenreGroup(grp, language)}</span>
                      <span className={`tabular-nums text-[10px] shrink-0 ms-2 ${isSelected ? 'text-[#ec4899] font-bold' : 'text-[#64748b]'}`}>
                        {toStandardDigits(String(count))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Rubrique 3 : Réception (Satellite puis Bouquet) */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] flex items-center gap-1.5">
                <Satellite className="w-3.5 h-3.5 text-[#38bdf8]" />
                {language === 'ar' ? 'الاستقبال الفضائي' : 'Réception'}
              </span>
              {(selectedSatellite !== 'Tous' || selectedBouquet !== 'Tous') && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectSatellite('Tous');
                    onSelectBouquet('Tous');
                  }}
                  className="text-[10px] text-[#38bdf8] hover:underline cursor-pointer"
                >
                  {language === 'ar' ? 'الكل' : 'Tous'}
                </button>
              )}
            </div>

            {/* Choix Satellite */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[#cbd5e1] block">
                {language === 'ar' ? 'القمر الصناعي' : 'Satellite'}
              </label>
              <div className="grid grid-cols-1 gap-1 max-h-36 overflow-y-auto pe-1">
                {satOptions.map((sat) => {
                  const count = satelliteCounts[sat] ?? 0;
                  const isSelected = selectedSatellite === sat;
                  return (
                    <button
                      key={sat}
                      type="button"
                      onClick={() => {
                        onSelectSatellite(sat);
                        if (sat === 'Tous') {
                          onSelectBouquet('Tous');
                        }
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#2563eb]/25 border border-[#38bdf8] text-white font-semibold'
                          : 'bg-[#141a26]/70 hover:bg-[#141a26] border border-[#1e293b] text-[#cbd5e1]'
                      }`}
                    >
                      <span className="truncate">{translateSatelliteFilter(sat, language)}</span>
                      <span className={`tabular-nums text-[11px] shrink-0 ms-2 ${isSelected ? 'text-[#38bdf8] font-bold' : 'text-[#64748b]'}`}>
                        {toStandardDigits(String(count))}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Choix Bouquet */}
            {bouquetOptions.length > 1 && (
              <div className="space-y-1.5 pt-1">
                <label className="text-[11px] font-semibold text-[#cbd5e1] flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-[#38bdf8]" />
                  <span>{language === 'ar' ? 'الباقة' : 'Bouquet'}</span>
                </label>
                <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto pe-1">
                  {bouquetOptions.map((bq) => {
                    const count = bouquetCounts[bq] ?? 0;
                    const isSelected = selectedBouquet === bq;
                    return (
                      <button
                        key={bq}
                        type="button"
                        onClick={() => onSelectBouquet(bq)}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-[#2563eb]/25 border border-[#38bdf8] text-white font-semibold'
                            : 'bg-[#141a26]/70 hover:bg-[#141a26] border border-[#1e293b] text-[#cbd5e1]'
                        }`}
                      >
                        <span className="truncate">{translateBouquetFilter(bq, language, selectedSatellite)}</span>
                        <span className={`tabular-nums text-[11px] shrink-0 ms-2 ${isSelected ? 'text-[#38bdf8] font-bold' : 'text-[#64748b]'}`}>
                          {toStandardDigits(String(count))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Rubrique 4 : Pays / Marché */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-[#38bdf8]" />
                {language === 'ar' ? 'البلد / السوق' : 'Pays / Marché'}
              </span>
              {selectedCountry !== 'Tous' && (
                <button
                  type="button"
                  onClick={() => onSelectCountry('Tous')}
                  className="text-[10px] text-[#38bdf8] hover:underline cursor-pointer"
                >
                  {language === 'ar' ? 'الكل' : 'Tous'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {countryOptions.map((country) => {
                const count = countryCounts[country] ?? 0;
                const isSelected = selectedCountry === country;
                return (
                  <button
                    key={country}
                    type="button"
                    onClick={() => onSelectCountry(country)}
                    className={`flex items-center justify-between px-2.5 py-2 rounded-lg text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#2563eb]/25 border border-[#38bdf8] text-white font-semibold'
                        : 'bg-[#141a26]/70 hover:bg-[#141a26] border border-[#1e293b] text-[#cbd5e1]'
                    }`}
                  >
                    <span className="truncate">{translateChannelCountryFilter(country, language)}</span>
                    <span className={`tabular-nums text-[10px] shrink-0 ms-1 ${isSelected ? 'text-[#38bdf8] font-bold' : 'text-[#64748b]'}`}>
                      {toStandardDigits(String(count))}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        {/* Pied de page avec actions claires */}
        <div className="p-3.5 border-t border-[#1a202c] bg-[#0b0f19] flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onResetFilters}
            disabled={activeFiltersCount === 0}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              activeFiltersCount > 0
                ? 'bg-[#141a26] hover:bg-[#1a202c] border-[#1e293b] text-[#ef4444] hover:text-[#f87171]'
                : 'bg-[#141a26]/40 border-[#1e293b]/40 text-[#64748b] cursor-not-allowed opacity-50'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'مسح الفلاتر' : 'Effacer les filtres'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold text-xs shadow-md transition-all cursor-pointer active:scale-95"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{language === 'ar' ? 'تطبيق وإغلاق' : 'Appliquer'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
