import React, { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  Calendar,
  Clock,
  Film,
  Heart,
  Info,
  Radio,
  Sparkles,
  Star,
  Tv,
  Users,
  X,
} from 'lucide-react';
import {
  AppLanguage,
  BouquetFilter,
  EpgBouquetId,
  EpgChannel,
  EpgProgramme,
  ProgrammeReminder,
  SatelliteFilter,
} from '../types/epg';
import {
  ensureSchedulesCoverTargetTime,
  getActiveBouquetBadgeForChannel,
  getSingleSatelliteBadgeForChannel,
} from '../services/storageService';
import {
  calculateProgress,
  formatDayLabel,
  formatDurationMinutes,
  formatRemainingTime,
  formatTimeShort,
  getCasablancaHourNumber,
} from '../utils/timeFormat';
import { enrichProgrammeMetadata } from '../services/metadataEnricher';
import {
  cleanEpgTitleForSearch,
  formatSeasonEpisodeCode,
  isProgrammeSeriesOrDocumentary,
  parseSeasonAndEpisode,
  translateEpgTextToFrenchSync,
} from '../utils/metadataResolverCore';
import { ensureHttpsUrl } from '../utils/xmltvParser';
import {
  buildCleanFallbackLogoDataUri,
  getChannelLogoCandidates,
  resolveOfficialChannelLogoUrl,
} from '../utils/channelLogoResolver';
import {
  getActiveLanguage,
  getLanguageOption,
  getTranslations,
  translateDynamicGenre,
  translateOriginCountry,
} from '../utils/i18n';

interface ChannelDetailPanelProps {
  channel: EpgChannel;
  programmes: EpgProgramme[];
  nowMs: number;
  isFavorite: boolean;
  onToggleFavorite: (channelId: string) => void;
  reminders: ProgrammeReminder[];
  onToggleReminder: (programme: EpgProgramme, channel: EpgChannel) => void;
  onClose: () => void;
  initialSelectedProgramme?: EpgProgramme | null;
  language?: AppLanguage;
  activeSatellite?: SatelliteFilter;
  activeBouquet?: BouquetFilter;
  selectedBouquets?: EpgBouquetId[];
}

const DAY_OFFSETS = [-1, 0, 1, 2, 3, 4, 5];

/**
 * Extrait l'année (YYYY) ou formate la date de manière concise
 */
function formatReleaseYearOrDate(rawDate: string | undefined): string | undefined {
  if (!rawDate) return undefined;
  const trimmed = rawDate.trim();
  if (!trimmed) return undefined;

  const yearMatch = trimmed.match(/\b(19\d{2}|20\d{2})\b/);
  if (yearMatch) {
    return yearMatch[1];
  }

  return trimmed;
}

export const ChannelDetailPanel: React.FC<ChannelDetailPanelProps> = ({
  channel,
  programmes,
  nowMs,
  isFavorite,
  onToggleFavorite,
  reminders,
  onToggleReminder,
  onClose,
  initialSelectedProgramme = null,
  language,
  activeSatellite,
  activeBouquet,
  selectedBouquets,
}) => {
  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);
  const langOpt = getLanguageOption(activeLang);

  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [periodFilter, setPeriodFilter] = useState<
    'all' | 'morning' | 'afternoon' | 'evening'
  >('all');
  const [selectedProgramme, setSelectedProgramme] =
    useState<EpgProgramme | null>(initialSelectedProgramme);

  const [enrichedProg, setEnrichedProg] = useState<EpgProgramme | null>(
    initialSelectedProgramme
  );

  const expandedProgrammes = useMemo(() => {
    const baseDate = new Date(nowMs);
    baseDate.setHours(12, 0, 0, 0);
    let currentMap: Record<string, EpgProgramme[]> = {
      [channel.id]: programmes,
    };
    for (const offset of DAY_OFFSETS) {
      const targetNoonMs = baseDate.getTime() + offset * 86400000;
      currentMap = ensureSchedulesCoverTargetTime(
        [channel],
        currentMap,
        targetNoonMs
      );
    }
    return currentMap[channel.id] || programmes;
  }, [channel, programmes, nowMs]);

  const currentProgramme = useMemo(() => {
    return (
      expandedProgrammes.find(
        (p) => p.startMs <= nowMs && p.stopMs > nowMs
      ) || null
    );
  }, [expandedProgrammes, nowMs]);

  const activeProg =
    selectedProgramme || currentProgramme || expandedProgrammes[0] || null;

  useEffect(() => {
    if (!activeProg) {
      setEnrichedProg(null);
      return;
    }

    let cancelled = false;
    setEnrichedProg(activeProg);

    enrichProgrammeMetadata(activeProg, activeLang)
      .then((result) => {
        if (!cancelled) {
          setEnrichedProg(result);
        }
      })
      .catch(() => {
        // Ignore enrichment errors and keep fallback metadata
      });

    return () => {
      cancelled = true;
    };
  }, [activeProg, activeLang]);

  const displayProg = enrichedProg || activeProg;

  const dayTabs = useMemo(() => {
    const baseDate = new Date(nowMs);
    baseDate.setHours(0, 0, 0, 0);
    return DAY_OFFSETS.map((offset) => {
      const startOfDay = baseDate.getTime() + offset * 86400000;
      const endOfDay = startOfDay + 86400000;
      const label =
        offset === -1
          ? tr.yesterday
          : offset === 0
          ? tr.today
          : offset === 1
          ? tr.tomorrow
          : formatDayLabel(startOfDay, activeLang);

      const count = expandedProgrammes.filter(
        (p) => p.stopMs > startOfDay && p.startMs < endOfDay
      ).length;

      return { offset, startOfDay, endOfDay, label, count };
    });
  }, [nowMs, expandedProgrammes, tr, activeLang]);

  const activeDayTab =
    dayTabs.find((d) => d.offset === selectedDayOffset) || dayTabs[1];

  const filteredProgrammes = useMemo(() => {
    const dayProgs = expandedProgrammes.filter(
      (p) =>
        p.stopMs > activeDayTab.startOfDay && p.startMs < activeDayTab.endOfDay
    );

    if (periodFilter === 'all') return dayProgs;

    return dayProgs.filter((p) => {
      const hour = getCasablancaHourNumber(p.startMs);
      if (periodFilter === 'morning') return hour >= 5 && hour < 12;
      if (periodFilter === 'afternoon') return hour >= 12 && hour < 19;
      if (periodFilter === 'evening') return hour >= 19 || hour < 5;
      return true;
    });
  }, [expandedProgrammes, activeDayTab, periodFilter]);

  const reminderIds = useMemo(
    () => new Set(reminders.map((r) => r.id)),
    [reminders]
  );

  const isLiveActiveProg =
    displayProg &&
    displayProg.startMs <= nowMs &&
    displayProg.stopMs > nowMs;

  const activeProgress = displayProg
    ? calculateProgress(displayProg.startMs, displayProg.stopMs, nowMs)
    : 0;

  const displayMetadata = useMemo(() => {
    if (!displayProg) return null;

    const rawOrOrigTitle = displayProg.originalTitle || displayProg.title;
    const cleanedSearchTitle = cleanEpgTitleForSearch(rawOrOrigTitle);

    const mainTitle =
      activeLang === 'fr'
        ? translateEpgTextToFrenchSync(displayProg.title) ||
          cleanedSearchTitle ||
          displayProg.title
        : displayProg.title || cleanedSearchTitle;

    // Conditionnement strict de l'affichage Saison / Épisode :
    // UNIQUEMENT si classé explicitement comme "Série TV" ou "Documentaire"
    // Masqué impérativement pour le Sport, les Films et les émissions en Direct
    const allowSeasonEpisode = isProgrammeSeriesOrDocumentary({
      category: displayProg.category,
      rawCategory: displayProg.rawCategory,
      title: rawOrOrigTitle,
      subTitle: displayProg.subTitle,
      channelCategory: channel.contentCategory,
    });

    const parsedSE = allowSeasonEpisode
      ? parseSeasonAndEpisode(
          displayProg.episodeNum,
          rawOrOrigTitle,
          displayProg.subTitle
        )
      : {};

    const formattedSE = allowSeasonEpisode
      ? formatSeasonEpisodeCode(parsedSE.season, parsedSE.episode)
      : undefined;

    const rawSubTitle = displayProg.subTitle
      ? activeLang === 'fr'
        ? translateEpgTextToFrenchSync(displayProg.subTitle)
        : displayProg.subTitle
      : undefined;

    const cleanEpisodeTitle =
      rawSubTitle &&
      rawSubTitle.toLowerCase() !== mainTitle.toLowerCase() &&
      !/^s\d+\s*e\d+$/i.test(rawSubTitle.trim()) &&
      !/^(saison|season|staffel|temporada|sezon|stagione)\s*\d+/i.test(
        rawSubTitle.trim()
      )
        ? rawSubTitle
        : undefined;

    const originalTitleLine =
      displayProg.originalTitle || cleanedSearchTitle || mainTitle;

    const releaseDateLine =
      formatReleaseYearOrDate(displayProg.date) || tr.modalNotProvided;

    const rawGenre =
      displayProg.category ||
      (channel.contentCategory === 'Sport / Football'
        ? 'Sport / Football'
        : channel.contentCategory === 'Documentaires'
        ? 'Documentaire'
        : 'Cinéma & Série TV');

    const genreLine = translateDynamicGenre(rawGenre, activeLang);

    // Pays d'origine réel de la production (extrait de TMDB/TVMaze, et NON du pays de la chaîne)
    const originCountryLine =
      translateOriginCountry(displayProg.country, activeLang) ||
      tr.modalInternationalProd;

    return {
      mainTitle,
      allowSeasonEpisode,
      formattedSE,
      cleanEpisodeTitle,
      originalTitleLine,
      releaseDateLine,
      genreLine,
      originCountryLine,
    };
  }, [displayProg, channel.contentCategory, activeLang, tr]);

  return (
    <div
      dir={langOpt.dir}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#0a0e17]/88 backdrop-blur-md p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      {/* Conteneur principal du modal avec défilement vertical garanti sur mobile */}
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-[#141a26] border border-[#1a202c] rounded-t-xl sm:rounded-xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête simplifié et collant : Nom de chaîne + Actions */}
        <div className="sticky top-0 z-20 px-4 py-3 bg-[#0a0e17]/95 backdrop-blur-md border-b border-[#1a202c] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#0a0e17] border border-[#1a202c] flex items-center justify-center p-1.5 shrink-0">
              <img
                src={
                  ensureHttpsUrl(
                    (
                      channel.icon ||
                      resolveOfficialChannelLogoUrl(
                        channel.id,
                        channel.displayName
                      )
                    ).replace(/^http:\/\//i, 'https://')
                  ) ||
                  buildCleanFallbackLogoDataUri(channel.displayName, channel.id)
                }
                alt={channel.displayName}
                className="max-w-full max-h-full object-contain"
                onError={(e) => {
                  const candidates = getChannelLogoCandidates(
                    channel.id,
                    channel.displayName,
                    channel.icon
                  );
                  const currentSrc = e.currentTarget.src;
                  const idx = candidates.indexOf(currentSrc);
                  const nextSrc =
                    idx !== -1 && idx + 1 < candidates.length
                      ? candidates[idx + 1]
                      : buildCleanFallbackLogoDataUri(
                          channel.displayName,
                          channel.id
                        );
                  if (currentSrc !== nextSrc) {
                    e.currentTarget.src = nextSrc;
                  }
                }}
              />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-[#ffffff] truncate">
                {channel.displayName
                  .replace(/\s*\([^)]*\)\s*/g, ' ')
                  .replace(/\s{2,}/g, ' ')
                  .trim()}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 uppercase tracking-wider">
                  {getSingleSatelliteBadgeForChannel(
                    channel,
                    activeSatellite,
                    selectedBouquets
                  )}
                </span>
                {getActiveBouquetBadgeForChannel(
                  channel,
                  activeSatellite,
                  activeBouquet
                ) && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50">
                    {getActiveBouquetBadgeForChannel(
                      channel,
                      activeSatellite,
                      activeBouquet
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onToggleFavorite(channel.id)}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                isFavorite
                  ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                  : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60'
              }`}
              title={isFavorite ? tr.removeFromFavorites : tr.addToFavorites}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#ffffff] text-[#ffffff]' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#e11d48]/60 transition-colors cursor-pointer"
              title={tr.close}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Corps de la fiche programme */}
        <div className="p-4 sm:p-5 space-y-4">
          {displayProg && displayMetadata && (
            <div className="rounded-lg bg-[#0a0e17] border border-[#1a202c] p-3.5 sm:p-4">
              {/* En-tête épuré : Horaires/Progression + Badge Fiche FR */}
              <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  {isLiveActiveProg ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider bg-[#e11d48] text-[#ffffff] border border-[#ff0033] shadow-[0_0_12px_rgba(225,29,72,0.5)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff] animate-pulse shadow-[0_0_6px_#ffffff] shrink-0" />
                      {tr.liveBadge} · {formatTimeShort(displayProg.startMs)} →{' '}
                      {formatTimeShort(displayProg.stopMs)} (
                      {formatRemainingTime(displayProg.stopMs, nowMs, activeLang)})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50">
                      <Clock className="w-3 h-3 text-[#60a5fa]" />
                      {formatTimeShort(displayProg.startMs)} →{' '}
                      {formatTimeShort(displayProg.stopMs)} (
                      {formatDurationMinutes(
                        displayProg.startMs,
                        displayProg.stopMs
                      )}
                      )
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50">
                    <Sparkles className="w-3 h-3 text-[#60a5fa]" />
                    {tr.officialSheet} {langOpt.shortLabel}
                  </span>
                </div>

                {displayProg.startMs > nowMs && (
                  <button
                    type="button"
                    onClick={() => onToggleReminder(displayProg, channel)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
                      reminderIds.has(displayProg.id)
                        ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                        : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#e11d48]/60 font-medium'
                    }`}
                  >
                    {reminderIds.has(displayProg.id) ? (
                      <>
                        <BellRing className="w-3.5 h-3.5 text-[#ffffff]" />
                        {tr.reminderActive}
                      </>
                    ) : (
                      <>
                        <Bell className="w-3.5 h-3.5" />
                        {tr.reminderBtn}
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Barre de progression compacte si en direct (Rouge / Crimson Sky Sport) */}
              {isLiveActiveProg && (
                <div className="mb-3.5">
                  <div className="h-1.5 w-full bg-[#141a26] border border-[#1a202c] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#e11d48] to-[#ff0033] shadow-[0_0_10px_#e11d48] rounded-full transition-all duration-500"
                      style={{ width: `${activeProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Disposition compacte Side-by-Side (Gauche : Affiche 115px | Droite : Métadonnées) */}
              <div className="flex flex-row gap-3.5 sm:gap-4 items-start">
                {ensureHttpsUrl(displayProg.icon) ? (
                  <div className="w-[112px] sm:w-[120px] shrink-0">
                    <img
                      src={ensureHttpsUrl(displayProg.icon)}
                      alt={displayMetadata.mainTitle}
                      className="w-[112px] sm:w-[120px] h-[164px] sm:h-[176px] rounded-lg object-cover bg-[#141a26] border border-[#1a202c]"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="w-[112px] sm:w-[120px] h-[164px] sm:h-[176px] rounded-lg bg-[#141a26] border border-[#1a202c] flex flex-col items-center justify-center p-2.5 text-center shrink-0">
                    <Film className="w-7 h-7 text-[#cbd5e1] mb-1.5" />
                    <span className="text-[10px] font-semibold text-[#cbd5e1] line-clamp-3">
                      {displayMetadata.mainTitle}
                    </span>
                  </div>
                )}

                {/* Droite : Bloc d'informations aligné à côté de l'affiche */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-extrabold text-[#ffffff] leading-snug">
                    {displayMetadata.mainTitle}
                  </h3>

                  {displayMetadata.allowSeasonEpisode &&
                    (displayMetadata.formattedSE ||
                      displayMetadata.cleanEpisodeTitle) && (
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {displayMetadata.formattedSE && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50">
                            {displayMetadata.formattedSE}
                          </span>
                        )}
                        {displayMetadata.cleanEpisodeTitle && (
                          <span className="text-xs font-semibold text-[#cbd5e1]">
                            {displayMetadata.formattedSE ? '• ' : ''}«{' '}
                            {displayMetadata.cleanEpisodeTitle} »
                          </span>
                        )}
                      </div>
                    )}

                  <div className="mt-2 space-y-1 text-xs leading-relaxed">
                    <div className="text-[#cbd5e1]">
                      <span className="font-semibold text-[#cbd5e1]">
                        {tr.modalOriginalTitle}{' '}
                      </span>
                      <span className="font-bold text-[#ffffff]">
                        {displayMetadata.originalTitleLine}
                      </span>
                    </div>

                    <div className="text-[#cbd5e1]">
                      <span className="font-semibold text-[#cbd5e1]">
                        {tr.modalReleaseDate}{' '}
                      </span>
                      <span className="font-medium text-[#ffffff]">
                        {displayMetadata.releaseDateLine}
                      </span>
                    </div>

                    <div className="text-[#cbd5e1]">
                      <span className="font-semibold text-[#cbd5e1]">
                        {tr.modalGenre}{' '}
                      </span>
                      <span className="font-semibold text-[#ffffff]">
                        {displayMetadata.genreLine}
                      </span>
                    </div>

                    <div className="text-[#cbd5e1]">
                      <span className="font-semibold text-[#cbd5e1]">
                        {tr.modalOrigin}{' '}
                      </span>
                      <span className="font-medium text-[#ffffff]">
                        {displayMetadata.originCountryLine}
                      </span>
                    </div>
                  </div>

                  {displayProg.rating && (
                    <div className="mt-2.5">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50">
                        <span>{displayProg.rating}</span>
                        <Star className="w-3.5 h-3.5 fill-[#e11d48] text-[#e11d48]" />
                        <span className="text-[10px] font-semibold text-[#cbd5e1] uppercase tracking-wider">
                          TMDB
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section Résumé / Description */}
              <div className="mt-4 pt-3.5 border-t border-[#1a202c]">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[#ffffff] mb-1.5">
                  {tr.modalSummary}
                </div>
                {displayProg.description ? (
                  <p className="text-xs sm:text-sm text-[#cbd5e1] leading-relaxed whitespace-pre-line">
                    {displayProg.description}
                  </p>
                ) : (
                  <p className="text-xs text-[#cbd5e1] italic">
                    {tr.modalNoDescription}
                  </p>
                )}
              </div>

              {/* Casting & Réalisation (si disponibles) */}
              {(displayProg.directors?.length ||
                displayProg.actors?.length) && (
                <div className="mt-3 pt-2.5 border-t border-[#1a202c] flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-[#cbd5e1]">
                  {displayProg.directors &&
                    displayProg.directors.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-[#0055ff] shrink-0" />
                        <span className="text-[#cbd5e1]">
                          {tr.modalDirectedBy}
                        </span>
                        <span className="text-[#ffffff] font-medium">
                          {displayProg.directors.join(', ')}
                        </span>
                      </div>
                    )}
                  {displayProg.actors && displayProg.actors.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-[#0055ff] shrink-0" />
                      <span className="text-[#cbd5e1]">{tr.modalCast}</span>
                      <span className="text-[#ffffff] font-medium">
                        {displayProg.actors.join(', ')}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sélecteur de Jour & Tranche Horaire — Rouge Crimson pour les boutons actifs */}
          <div className="rounded-lg bg-[#0a0e17] border border-[#1a202c] p-3 space-y-2.5">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              <Calendar className="w-4 h-4 text-[#0055ff] shrink-0 me-1" />
              {dayTabs.map((tab) => {
                const isSelected = tab.offset === selectedDayOffset;
                return (
                  <button
                    key={tab.offset}
                    type="button"
                    onClick={() => setSelectedDayOffset(tab.offset)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                        : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                        isSelected
                          ? 'bg-[#0a0e17]/80 text-[#ffffff] border border-[#ff0033]/50 font-bold'
                          : 'bg-[#0a0e17] text-[#cbd5e1]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {(
                [
                  { id: 'all', label: tr.allDay },
                  { id: 'morning', label: tr.morning },
                  { id: 'afternoon', label: tr.afternoon },
                  { id: 'evening', label: tr.eveningPrime },
                ] as const
              ).map((period) => {
                const active = periodFilter === period.id;
                return (
                  <button
                    key={period.id}
                    type="button"
                    onClick={() => setPeriodFilter(period.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                      active
                        ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(225,29,72,0.45)]'
                        : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60 font-medium'
                    }`}
                  >
                    {period.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Liste chronologique des programmes */}
          <div className="space-y-2">
            {filteredProgrammes.length === 0 ? (
              <div className="text-center py-10 px-4 rounded-lg border border-dashed border-[#1a202c] bg-[#0a0e17]">
                <Info className="w-7 h-7 text-[#cbd5e1] mx-auto mb-2" />
                <p className="text-sm font-medium text-[#ffffff]">
                  {tr.noProgramForSlot}
                </p>
                <p className="text-xs text-[#cbd5e1] mt-1">
                  {tr.selectAnotherDayOrRefresh}
                </p>
              </div>
            ) : (
              filteredProgrammes.map((prog) => {
                const isLive = prog.startMs <= nowMs && prog.stopMs > nowMs;
                const isPast = prog.stopMs <= nowMs;
                const isSelected = activeProg?.id === prog.id;
                const hasReminder = reminderIds.has(prog.id);
                const progProgress = isLive
                  ? calculateProgress(prog.startMs, prog.stopMs, nowMs)
                  : 0;

                const allowListSE = isProgrammeSeriesOrDocumentary({
                  category: prog.category,
                  rawCategory: prog.rawCategory,
                  title: prog.originalTitle || prog.title,
                  subTitle: prog.subTitle,
                  channelCategory: channel.contentCategory,
                });
                const parsedListSE = allowListSE
                  ? parseSeasonAndEpisode(
                      prog.episodeNum,
                      prog.originalTitle || prog.title,
                      prog.subTitle
                    )
                  : {};
                const formattedListSE = allowListSE
                  ? formatSeasonEpisodeCode(
                      parsedListSE.season,
                      parsedListSE.episode
                    )
                  : undefined;

                return (
                  <div
                    key={prog.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => setSelectedProgramme(prog)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedProgramme(prog);
                      }
                    }}
                    className={`tv-card-focusable group rounded-lg p-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#1a202c] border-[1.5px] border-[#e11d48] shadow-[0_0_12px_rgba(225,29,72,0.35)]'
                        : isLive
                        ? 'bg-[#0a0e17] border border-[#e11d48]/60'
                        : isPast
                        ? 'bg-[#0a0e17]/60 border border-[#1a202c] opacity-70 hover:opacity-100'
                        : 'bg-[#0a0e17] border border-[#1a202c] hover:border-[#0055ff]/60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="w-20 shrink-0 pt-0.5">
                          <div className="text-xs font-mono font-bold text-[#ffffff]">
                            {formatTimeShort(prog.startMs)}
                          </div>
                          <div className="text-[10px] font-mono text-[#cbd5e1]">
                            → {formatTimeShort(prog.stopMs)}
                          </div>
                          {isLive && (
                            <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-[#e11d48] text-[#ffffff] border border-[#ff0033] shadow-[0_0_8px_rgba(225,29,72,0.45)] rounded">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff] animate-pulse shadow-[0_0_6px_#ffffff] shrink-0" />
                              {tr.liveBadge}
                            </span>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-semibold text-[#ffffff]">
                              {activeLang === 'fr'
                                ? translateEpgTextToFrenchSync(prog.title)
                                : prog.title}
                            </h4>
                            {formattedListSE && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50 font-medium">
                                {formattedListSE}
                              </span>
                            )}
                            {prog.date && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1d4ed8]/15 text-[#cbd5e1] border border-[#0055ff]/40 font-medium">
                                {formatReleaseYearOrDate(prog.date)}
                              </span>
                            )}
                            {prog.category && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-[#1d4ed8]/20 text-[#ffffff] border border-[#0055ff]/50">
                                {translateDynamicGenre(
                                  prog.category,
                                  activeLang
                                )}
                              </span>
                            )}
                          </div>

                          {prog.originalTitle &&
                            prog.originalTitle !== prog.title && (
                              <p className="text-[11px] text-[#cbd5e1] italic mt-0.5">
                                {tr.voPrefix} {prog.originalTitle}
                              </p>
                            )}

                          {prog.subTitle && allowListSE && (
                            <p className="text-xs text-[#cbd5e1] font-medium mt-0.5">
                              {activeLang === 'fr'
                                ? translateEpgTextToFrenchSync(prog.subTitle)
                                : prog.subTitle}
                            </p>
                          )}

                          {prog.description && (
                            <p className="text-xs text-[#cbd5e1] line-clamp-2 mt-1 leading-relaxed">
                              {prog.description}
                            </p>
                          )}

                          {isLive && (
                            <div className="mt-2 h-1.5 w-full bg-[#141a26] border border-[#1a202c] rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-[#e11d48] to-[#ff0033] shadow-[0_0_8px_#e11d48] rounded-full"
                                style={{ width: `${progProgress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-mono text-[#cbd5e1]">
                          {formatDurationMinutes(prog.startMs, prog.stopMs)}
                        </span>
                        {prog.startMs > nowMs && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleReminder(prog, channel);
                            }}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              hasReminder
                                ? 'bg-[#e11d48] border-[1.5px] border-[#ff0033] text-[#ffffff] shadow-[0_0_10px_rgba(225,29,72,0.45)]'
                                : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#0055ff]/60'
                            }`}
                            title={
                              hasReminder ? tr.cancelReminder : tr.remindProgram
                            }
                          >
                            {hasReminder ? (
                              <BellRing className="w-3.5 h-3.5 text-[#ffffff]" />
                            ) : (
                              <Bell className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
