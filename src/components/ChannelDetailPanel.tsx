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
  Trophy,
  Shield,
  MapPin,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { detectCompetition, parseMatch, detectSport } from '../utils/sportsEngine';
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
import { lookupTransponderSync } from '../services/satelliteCatalogService';
import {
  calculateProgress,
  formatDayLabel,
  formatDurationMinutes,
  formatRemainingTime,
  formatTimeShort,
  getCasablancaHourNumber,
  toStandardDigits,
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
  cleanBouquetName,
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
  isExtendedEpgUnlocked?: boolean;
  onRequestProEpgUpgrade?: (reason?: string) => void;
}

const DAY_OFFSETS = [-1, 0, 1, 2, 3, 4, 5, 6, 7];

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
  isExtendedEpgUnlocked = false,
  onRequestProEpgUpgrade,
}) => {
  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);
  const langOpt = getLanguageOption(activeLang);

  const [selectedDayOffset, setSelectedDayOffset] = useState<number>(0);
  const [pendingLockedOffset, setPendingLockedOffset] = useState<number | null>(
    null
  );
  const [periodFilter, setPeriodFilter] = useState<
    'all' | 'morning' | 'afternoon' | 'evening'
  >('all');
  const [selectedProgramme, setSelectedProgramme] =
    useState<EpgProgramme | null>(initialSelectedProgramme);

  const [enrichedProg, setEnrichedProg] = useState<EpgProgramme | null>(
    initialSelectedProgramme
  );
  const [isParaboleOpen, setIsParaboleOpen] = useState<boolean>(false);

  const tpInfo = useMemo(
    () => lookupTransponderSync(channel.displayName),
    [channel.displayName]
  );

  // Déblocage instantané du jour cliqué dès que l'utilisateur passe en mode Connecté + Premium (is_premium: true)
  useEffect(() => {
    if (isExtendedEpgUnlocked && pendingLockedOffset !== null) {
      setSelectedDayOffset(pendingLockedOffset);
      setPendingLockedOffset(null);
    } else if (!isExtendedEpgUnlocked && selectedDayOffset !== 0) {
      setSelectedDayOffset(0);
    }
  }, [isExtendedEpgUnlocked, pendingLockedOffset, selectedDayOffset]);

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
      const formattedDate = formatDayLabel(startOfDay, activeLang);
      const label =
        offset === -1
          ? (activeLang === 'ar' ? `إعادة العرض · ${tr.yesterday}` : `Catch-up · ${tr.yesterday}`)
          : offset === 0
          ? (activeLang === 'ar' ? `${tr.today} (24 سا)` : `${tr.today} (24h)`)
          : offset === 1
          ? (activeLang === 'ar' ? `غداً · +1` : `J+1 · ${tr.tomorrow}`)
          : (activeLang === 'ar' ? `+${toStandardDigits(offset)} · ${formattedDate}` : `J+${offset} · ${formattedDate}`);

      const count = expandedProgrammes.filter(
        (p) => p.stopMs > startOfDay && p.startMs < endOfDay
      ).length;

      const isLocked = offset !== 0 && !isExtendedEpgUnlocked;

      return { offset, startOfDay, endOfDay, label, count, isLocked };
    });
  }, [nowMs, expandedProgrammes, tr, activeLang, isExtendedEpgUnlocked]);

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

  const sportDetails = useMemo(() => {
    if (!displayProg) return null;
    const title = displayProg.title || '';
    const subTitle = displayProg.subTitle || '';
    const desc = displayProg.description || '';
    const category = displayProg.category || '';
    const chCat = channel.contentCategory || '';
    const chGroup = channel.group || '';

    const comp = detectCompetition(title, category);
    const match = parseMatch(title);
    const isSportChannel = chCat === 'Sport / Football' || chGroup === 'Sport / Football';
    const isSportCat = /sport|football|soccer|tennis|rugby|basket|f1|moto|combat|cyclisme/i.test(category);

    if (!comp && !match && !isSportChannel && !isSportCat) {
      return null;
    }

    // 1. Saison {YYYY/YYYY+1}
    const progDate = new Date(displayProg.startMs);
    const progYear = progDate.getFullYear();
    const progMonth = progDate.getMonth() + 1;
    const season = progMonth >= 7 ? `${progYear}/${progYear + 1}` : `${progYear - 1}/${progYear}`;

    // 2. Compétition et Pays / Zone
    let competitionName = comp?.label || '';
    let countryOrZone = '';
    let sportType = comp?.sport || 'Football';

    const combined = `${title} ${subTitle} ${desc} ${category}`.toLowerCase();

    if (comp) {
      switch (comp.id) {
        case 'ucl':
          competitionName = 'UEFA Champions League';
          countryOrZone = activeLang === 'ar' ? 'أوروبا / الويفا' : 'Europe / UEFA';
          break;
        case 'uecl':
          competitionName = 'UEFA Conference League';
          countryOrZone = activeLang === 'ar' ? 'أوروبا / الويفا' : 'Europe / UEFA';
          break;
        case 'uel':
          competitionName = 'UEFA Europa League';
          countryOrZone = activeLang === 'ar' ? 'أوروبا / الويفا' : 'Europe / UEFA';
          break;
        case 'uefa_nl':
          competitionName = 'UEFA Nations League';
          countryOrZone = activeLang === 'ar' ? 'أوروبا / الويفا' : 'Europe / UEFA';
          break;
        case 'pl':
          competitionName = 'Premier League';
          countryOrZone = activeLang === 'ar' ? 'إنجلترا' : 'Angleterre';
          break;
        case 'eng2':
          competitionName = 'EFL Championship';
          countryOrZone = activeLang === 'ar' ? 'إنجلترا' : 'Angleterre';
          break;
        case 'laliga':
          competitionName = 'LaLiga';
          countryOrZone = activeLang === 'ar' ? 'إسبانيا' : 'Espagne';
          break;
        case 'copa_del_rey':
          competitionName = 'Copa del Rey';
          countryOrZone = activeLang === 'ar' ? 'إسبانيا' : 'Espagne';
          break;
        case 'seriea':
          competitionName = 'Serie A';
          countryOrZone = activeLang === 'ar' ? 'إيطاليا' : 'Italie';
          break;
        case 'bundesliga':
          competitionName = 'Bundesliga';
          countryOrZone = activeLang === 'ar' ? 'ألمانيا' : 'Allemagne';
          break;
        case 'ligue1':
          competitionName = 'Ligue 1';
          countryOrZone = activeLang === 'ar' ? 'فرنسا' : 'France';
          break;
        case 'botola':
          competitionName = 'Botola Pro Inwi';
          countryOrZone = activeLang === 'ar' ? 'المغرب' : 'Maroc';
          break;
        case 'spl':
          competitionName = 'Saudi Pro League (Roshn)';
          countryOrZone = activeLang === 'ar' ? 'المملكة العربية السعودية' : 'Arabie Saoudite';
          break;
        case 'afc':
          competitionName = 'AFC Champions League';
          countryOrZone = activeLang === 'ar' ? 'آسيا / AFC' : 'Asie / AFC';
          break;
        case 'can':
          competitionName = "Coupe d'Afrique des Nations (CAN)";
          countryOrZone = activeLang === 'ar' ? 'إفريقيا / CAF' : 'Afrique / CAF';
          break;
        case 'mls':
          competitionName = 'Major League Soccer (MLS)';
          countryOrZone = activeLang === 'ar' ? 'الولايات المتحدة' : 'États-Unis';
          break;
        case 'f1':
          competitionName = 'Formule 1 (FIA Formula One)';
          countryOrZone = activeLang === 'ar' ? 'عالمي / FIA' : 'Monde / FIA';
          sportType = 'Auto';
          break;
        case 'motogp':
          competitionName = 'MotoGP (FIM Road Racing)';
          countryOrZone = activeLang === 'ar' ? 'عالمي / FIM' : 'Monde / FIM';
          sportType = 'Moto';
          break;
        case 'nba':
          competitionName = 'NBA Basketball';
          countryOrZone = activeLang === 'ar' ? 'أمريكا الشمالية' : 'États-Unis';
          sportType = 'Basket';
          break;
        case 'tennis':
          competitionName = 'Tournoi ATP/WTA';
          countryOrZone = activeLang === 'ar' ? 'دولي' : 'International';
          sportType = 'Tennis';
          break;
        case 'rugby':
          competitionName = 'Rugby (Top 14 / Six Nations)';
          countryOrZone = activeLang === 'ar' ? 'أوروبا / دولي' : 'Europe / International';
          sportType = 'Rugby';
          break;
        case 'mma':
          competitionName = 'UFC / PFL MMA';
          countryOrZone = activeLang === 'ar' ? 'عالمي' : 'International';
          sportType = 'Combat';
          break;
      }
    } else {
      if (/premier league|fa cup|carabao/i.test(combined)) {
        competitionName = 'Football Anglais';
        countryOrZone = activeLang === 'ar' ? 'إنجلترا' : 'Angleterre';
      } else if (/laliga|copa del rey|liga ea sports/i.test(combined)) {
        competitionName = 'Football Espagnol';
        countryOrZone = activeLang === 'ar' ? 'إسبانيا' : 'Espagne';
      } else if (/serie a|coppa italia|calcio/i.test(combined)) {
        competitionName = 'Serie A';
        countryOrZone = activeLang === 'ar' ? 'إيطاليا' : 'Italie';
      } else if (/ligue 1|coupe de france/i.test(combined)) {
        competitionName = 'Ligue 1';
        countryOrZone = activeLang === 'ar' ? 'فرنسا' : 'France';
      } else if (/bundesliga|dfb-pokal/i.test(combined)) {
        competitionName = 'Bundesliga';
        countryOrZone = activeLang === 'ar' ? 'ألمانيا' : 'Allemagne';
      } else if (/champions league|uefa/i.test(combined)) {
        competitionName = 'UEFA Champions League';
        countryOrZone = activeLang === 'ar' ? 'أوروبا / الويفا' : 'Europe / UEFA';
      } else {
        competitionName = category || 'Événement sportif';
        countryOrZone = activeLang === 'ar' ? 'دولي' : 'International';
      }
    }

    // 3. Phase / Journée / Tour
    let roundOrPhase = '';
    const matchdayMatch = combined.match(/(?:journée|journee|j\.?|matchday|giornata|jornada|spieltag)\s*(\d+)/i);
    if (matchdayMatch) {
      roundOrPhase = activeLang === 'ar' ? `الجولة ${toStandardDigits(matchdayMatch[1])}` : `Journée ${matchdayMatch[1]}`;
    } else if (/phase de (?:ligue|classement)|league phase|classement/i.test(combined)) {
      roundOrPhase = activeLang === 'ar' ? 'مرحلة الدوري / الترتيب' : 'Phase de ligue / classement';
    } else if (/32(?:e|th)?(?:\s*de\s*finale)?|round of 32|seizi[èe]mes?/i.test(combined)) {
      roundOrPhase = activeLang === 'ar' ? 'دور الـ 32' : '32e de finale (Round of 32)';
    } else if (/16(?:e|th)?(?:\s*de\s*finale)?|round of 16|huiti[èe]mes?|8e de finale/i.test(combined)) {
      roundOrPhase = activeLang === 'ar' ? 'ثمن النهائي (دور الـ 16)' : '8e de finale (Round of 16)';
    } else if (/quarts?(?:\s*de\s*finale)?|quarter-?finals?/i.test(combined)) {
      roundOrPhase = activeLang === 'ar' ? 'ربع النهائي' : 'Quarts de finale';
    } else if (/demi-?finales?|semi-?finals?/i.test(combined)) {
      roundOrPhase = activeLang === 'ar' ? 'نصف النهائي' : 'Demi-finale';
    } else if (/finale\b|final\b/i.test(combined)) {
      roundOrPhase = activeLang === 'ar' ? 'النهائي' : 'Finale';
    } else if (/essais libres|free practice|fp[1-3]/i.test(combined)) {
      roundOrPhase = activeLang === 'ar' ? 'تجارب حرة' : 'Essais Libres';
    } else if (/qualifications?|qualifying/i.test(combined)) {
      roundOrPhase = activeLang === 'ar' ? 'التصفيات التأهيلية' : 'Qualifications';
    } else if (/course|grand prix|gp\b/i.test(combined)) {
      roundOrPhase = activeLang === 'ar' ? 'السباق الرسمي' : 'Course officielle';
    } else {
      roundOrPhase = activeLang === 'ar' ? 'لقاء رسمي' : 'Rencontre officielle';
    }

    return {
      isSport: true,
      competitionName,
      season,
      countryOrZone,
      roundOrPhase,
      sportType,
      matchInfo: match,
    };
  }, [displayProg, channel, activeLang]);

  return (
    <div
      dir={langOpt.dir}
      data-tv-modal-overlay="true"
      className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-[#0a0e17]/90 backdrop-blur-md p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      {/* Conteneur principal du modal / Sheet : pleine largeur sur mobile avec coins arrondis supérieurs */}
      <div
        data-tv-modal="true"
        data-tv-modal-scroll="true"
        className="relative w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] overflow-y-auto bg-[#0d121f] border-t sm:border border-[#1a202c] rounded-t-2xl sm:rounded-xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête simplifié et collant : Nom de chaîne + Badges + Actions (Bouton X Fermer unique) */}
        <div
          data-tv-modal-zone="header"
          className="sticky top-0 z-30 px-4 py-3 bg-[#0b0f19] border-b border-[#1a202c] flex items-center justify-between gap-3 shrink-0"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="channel-logo-container w-10 h-10 rounded-lg bg-[#f8fafc] border border-[#e2e8f0]/85 flex items-center justify-center p-1 shrink-0 shadow-sm overflow-hidden">
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
                className="channel-logo-img w-full h-full object-contain"
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
                {/* Badge 1 : Nom du Satellite uniquement (ex: "ASTRA 19.2°E") */}
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#2563eb]/20 text-[#38bdf8] border border-[#38bdf8]/40 uppercase tracking-wider">
                  {getSingleSatelliteBadgeForChannel(
                    channel,
                    activeSatellite,
                    selectedBouquets
                  )}
                </span>
                {/* Badge 2 : Nom du Bouquet nettoyé uniquement (ex: "Canal+ France") */}
                {getActiveBouquetBadgeForChannel(
                  channel,
                  activeSatellite,
                  activeBouquet
                ) && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#ec4899]/20 text-[#ffffff] border border-[#ec4899]/60">
                    {cleanBouquetName(
                      getActiveBouquetBadgeForChannel(
                        channel,
                        activeSatellite,
                        activeBouquet
                      ) || '',
                      getSingleSatelliteBadgeForChannel(
                        channel,
                        activeSatellite,
                        selectedBouquets
                      )
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div
            data-tv-row="modal-header"
            className="flex items-center gap-2 shrink-0"
          >
            <button
              type="button"
              data-tv-focusable="true"
              onClick={() => onToggleFavorite(channel.id)}
              className={`p-2 rounded-lg transition-all cursor-pointer ${
                isFavorite
                  ? 'bg-[#ec4899] border-[1.5px] border-[#f472b6] text-[#ffffff] shadow-[0_0_12px_rgba(236,72,153,0.45)]'
                  : 'bg-[#141a26] border border-[#1e293b] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#ec4899]/60'
              }`}
              title={isFavorite ? tr.removeFromFavorites : tr.addToFavorites}
            >
              <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#ffffff] text-[#ffffff]' : ''}`} />
            </button>
            <button
              type="button"
              data-tv-focusable="true"
              onClick={onClose}
              aria-label={tr.close}
              className="tv-dpad-btn inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#1e293b] hover:bg-[#334155] border border-[#334155] text-[#cbd5e1] hover:text-[#ffffff] transition-colors cursor-pointer shrink-0"
              title={tr.close}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corps de la fiche programme (Épuré, sans double conteneur imbriqué ni marge morte superflue) */}
        <div className="p-4 sm:p-5 space-y-4">
          {displayProg && displayMetadata && (
            <div className="space-y-3.5 pb-4 border-b border-[#1a202c]">
              {/* Horaires/Progression + Bouton Rappel */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {isLiveActiveProg ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase tracking-wider bg-[#ef4444] text-[#ffffff] border border-[#f87171] shadow-[0_0_12px_rgba(239,68,68,0.5)]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#ffffff] animate-pulse shadow-[0_0_6px_#ffffff] shrink-0" />
                      {tr.liveBadge} · {formatTimeShort(displayProg.startMs)} →{' '}
                      {formatTimeShort(displayProg.stopMs)} (
                      {formatRemainingTime(displayProg.stopMs, nowMs, activeLang)})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-medium bg-[#2563eb]/20 text-[#38bdf8] border border-[#38bdf8]/40">
                      <Clock className="w-3 h-3 text-[#60a5fa]" />
                      {formatTimeShort(displayProg.startMs)} →{' '}
                      {formatTimeShort(displayProg.stopMs)} (
                      {formatDurationMinutes(
                        displayProg.startMs,
                        displayProg.stopMs,
                        activeLang
                      )}
                      )
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-[#2563eb]/20 text-[#38bdf8] border border-[#38bdf8]/40">
                    <Sparkles className="w-3 h-3 text-[#60a5fa]" />
                    {tr.officialSheet} {langOpt.shortLabel}
                  </span>

                  {reminderIds.has(displayProg.id) && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-[#ffffff] border border-[#ec4899] shadow-[0_0_10px_rgba(236,72,153,0.45)]">
                      <BellRing className="w-3.5 h-3.5 text-[#ffffff]" />
                      {tr.reminderActive}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {displayProg.stopMs > nowMs && (
                    <button
                      type="button"
                      data-tv-focusable="true"
                      onClick={() => onToggleReminder(displayProg, channel)}
                      className={`tv-focusable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer shrink-0 ${
                        reminderIds.has(displayProg.id)
                          ? 'bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] border-[1.5px] border-[#ec4899] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(236,72,153,0.5)]'
                          : 'bg-[#141a26] border border-[#38bdf8]/60 text-[#ffffff] hover:border-[#ec4899] font-semibold'
                      }`}
                    >
                      {reminderIds.has(displayProg.id) ? (
                        <>
                          <BellRing className="w-3.5 h-3.5 text-[#ffffff]" />
                          {tr.reminderActive}
                        </>
                      ) : (
                        <>
                          <Bell className="w-3.5 h-3.5 text-[#60a5fa]" />
                          {tr.reminderBtn}
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Barre de progression temporelle colorée En Direct (#ec4899 -> #8b5cf6 sur rail rgba(255,255,255,0.1)) */}
              {isLiveActiveProg && (
                <div className="mb-4">
                  <div className="live-progress-rail w-full overflow-hidden">
                    <div
                      className="live-progress-fill h-full transition-all duration-500"
                      style={{ width: `${activeProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Affichage conditionnel : Fiche sportive pure VS Fiche Cinéma / Séries */}
              {sportDetails?.isSport ? (
                <div className="space-y-4 mb-4">
                  {/* Disposition spécifique Sport : petite illustration de la compétition + métadonnées sportives pures */}
                  <div className="flex flex-row gap-3 sm:gap-4 items-start">
                    {/* Vignette compacte de la compétition (remplace le poster cinéma) */}
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl bg-gradient-to-br from-[#1e293b] via-[#111827] to-[#0f172a] border border-[#38bdf8]/40 flex flex-col items-center justify-center p-2 text-center shadow-md shrink-0">
                      <Trophy className="w-7 h-7 sm:w-8 sm:h-8 text-[#38bdf8] mb-1" />
                      <span className="text-[9px] font-bold text-[#ffffff] uppercase tracking-wider line-clamp-2 leading-tight">
                        {sportDetails.competitionName}
                      </span>
                    </div>

                    {/* Informations de la rencontre sportive */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-black text-[#ffffff] leading-snug mb-2">
                        {displayMetadata.mainTitle}
                      </h3>

                      <div className="space-y-1.5 text-xs">
                        {/* Ligne 1 : Pays / Zone géographique */}
                        <div className="flex items-center gap-2">
                          <span className="text-[#94a3b8] font-medium min-w-[75px]">
                            {activeLang === 'ar' ? 'البلد / المنطقة' : 'Pays / Zone'}
                          </span>
                          <span className="font-bold text-[#38bdf8] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[#38bdf8]" />
                            {sportDetails.countryOrZone}
                          </span>
                        </div>

                        {/* Ligne 2 : Compétition & Saison {YYYY/YYYY+1} */}
                        <div className="flex items-center gap-2">
                          <span className="text-[#94a3b8] font-medium min-w-[75px]">
                            {activeLang === 'ar' ? 'البطولة' : 'Compétition'}
                          </span>
                          <span className="font-bold text-[#ffffff]">
                            {sportDetails.competitionName}{' '}
                            <span className="text-[#38bdf8] font-semibold">{`{${sportDetails.season}}`}</span>
                          </span>
                        </div>

                        {/* Ligne 3 : Tour / Phase / Journée */}
                        <div className="flex items-center gap-2">
                          <span className="text-[#94a3b8] font-medium min-w-[75px]">
                            {activeLang === 'ar' ? 'المرحلة' : 'Phase'}
                          </span>
                          <span className="font-semibold text-[#ec4899]">
                            {sportDetails.roundOrPhase}
                          </span>
                        </div>

                        {/* Ligne 4 : Diffuseur / Satellite */}
                        <div className="flex items-center gap-2 pt-0.5">
                          <span className="text-[#94a3b8] font-medium min-w-[75px]">
                            {activeLang === 'ar' ? 'البث' : 'Diffusion'}
                          </span>
                          <span className="font-medium text-[#cbd5e1] truncate">
                            {channel.displayName} · {getSingleSatelliteBadgeForChannel(channel, activeSatellite, selectedBouquets)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Détails complémentaires du match (si disponibles) */}
                  {displayProg.description && (
                    <div className="mt-3 pt-3 border-t border-[#1a202c]">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#94a3b8] mb-1">
                        {activeLang === 'ar' ? 'معلومات اللقاء' : 'Détails de la rencontre'}
                      </div>
                      <p className="text-xs text-[#cbd5e1] leading-relaxed whitespace-pre-line">
                        {displayProg.description}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Disposition classique Cinéma / Séries / Documentaires */}
                  <div className="flex flex-row gap-3 sm:gap-4 lg:gap-5 items-start mb-4">
                    {ensureHttpsUrl(displayProg.icon) ? (
                      <div className="w-24 flex-shrink-0 lg:w-32 lg:max-w-[120px]">
                        <img
                          src={ensureHttpsUrl(displayProg.icon)}
                          alt={displayMetadata.mainTitle}
                          className="w-24 h-[135px] sm:w-28 sm:h-[155px] lg:w-32 lg:h-[176px] rounded-lg object-cover bg-[#141a26] border border-[#1a202c]"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="w-24 h-[135px] sm:w-28 sm:h-[155px] lg:w-32 lg:h-[176px] rounded-lg bg-[#141a26] border border-[#1a202c] flex flex-col items-center justify-center p-2 text-center flex-shrink-0 lg:w-32 lg:max-w-[120px]">
                        <Film className="w-6 h-6 text-[#cbd5e1] mb-1" />
                        <span className="text-[10px] font-semibold text-[#cbd5e1] line-clamp-3">
                          {displayMetadata.mainTitle}
                        </span>
                      </div>
                    )}

                    {/* Droite : Bloc d'informations aligné à côté de l'affiche */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base sm:text-lg font-extrabold text-[#ffffff] leading-snug mb-3">
                        {displayMetadata.mainTitle}
                      </h3>

                      {displayMetadata.allowSeasonEpisode &&
                        (displayMetadata.formattedSE ||
                          displayMetadata.cleanEpisodeTitle) && (
                          <div className="mt-1 mb-2.5 flex items-center gap-1.5 flex-wrap">
                            {displayMetadata.formattedSE && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold bg-[#1d4ed8]/20 text-[#ffffff] border border-[#2563eb]/50">
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
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-[#2563eb]/20 text-[#38bdf8] border border-[#38bdf8]/40">
                            <span>{displayProg.rating}</span>
                            <Star className="w-3.5 h-3.5 fill-[#f59e0b] text-[#f59e0b]" />
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
                            <Film className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
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
                          <Users className="w-3.5 h-3.5 text-[#38bdf8] shrink-0" />
                          <span className="text-[#cbd5e1]">{tr.modalCast}</span>
                          <span className="text-[#ffffff] font-medium">
                            {displayProg.actors.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Accordéon "Infos parabole" (détails transpondeur satellite pour télespectateurs parabole) */}
              <div className="mt-4 pt-3.5 border-t border-[#1a202c]">
                <button
                  type="button"
                  data-tv-focusable="true"
                  onClick={() => setIsParaboleOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between py-1 text-left cursor-pointer group hover:text-[#38bdf8] transition-colors"
                >
                  <div className="flex items-center gap-2 text-sm font-bold text-[#ffffff] group-hover:text-[#38bdf8]">
                    <Radio className="w-4 h-4 text-[#38bdf8]" />
                    <span>{activeLang === 'ar' ? 'معلومات الدش / Parabole' : 'Infos parabole'}</span>
                  </div>
                  {isParaboleOpen ? (
                    <ChevronUp className="w-4 h-4 text-[#cbd5e1] group-hover:text-[#38bdf8]" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-[#cbd5e1] group-hover:text-[#38bdf8]" />
                  )}
                </button>

                {isParaboleOpen && (
                  <div className="mt-2.5 p-3.5 sm:p-4 rounded-xl bg-[#0a0e17] border border-[#1a202c] grid grid-cols-2 gap-y-3 gap-x-4 text-xs animate-fadeIn">
                    <div>
                      <div className="text-[11px] font-medium text-[#94a3b8] mb-0.5">Satellite</div>
                      <div className="font-bold text-[#ffffff] text-sm truncate">
                        {getSingleSatelliteBadgeForChannel(channel, activeSatellite, selectedBouquets) || channel.orbitalPosition || 'Astra 19.2°E'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-[#94a3b8] mb-0.5">Fréquence</div>
                      <div className="font-bold text-[#38bdf8] text-sm font-mono truncate">
                        {tpInfo?.frequency ? `${tpInfo.frequency} MHz` : '11488 MHz'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-[#94a3b8] mb-0.5">Polarisation</div>
                      <div className="font-bold text-[#ffffff] text-sm font-mono">
                        {tpInfo?.polarization || 'H'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-[#94a3b8] mb-0.5">Débit symbole (SR)</div>
                      <div className="font-bold text-[#ffffff] text-sm font-mono truncate">
                        {tpInfo?.symbolRate ? `${tpInfo.symbolRate} kS/s` : '27500 kS/s'}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-medium text-[#94a3b8] mb-0.5">Accès</div>
                      <div className="font-bold text-[#ffffff] text-sm">
                        {tpInfo ? (tpInfo.isEncrypted ? 'Crypté' : 'Clair (FTA)') : 'Crypté'}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sélecteur de Jour 7 Jours & Tranche Horaire — Cadenas 🔒 sur J+1..J+7 et Catch-up en Mode Invité / Gratuit */}
          <div
            data-tv-modal-zone="tabs"
            className="rounded-lg bg-[#0a0e17] border border-[#1a202c] p-3 space-y-2.5"
          >
            <div
              data-tv-row="modal-days"
              className="flex flex-row overflow-x-auto whitespace-nowrap gap-2 py-1 no-scrollbar my-2 items-center"
            >
              <Calendar className="w-4 h-4 text-[#38bdf8] shrink-0 me-1" />
              {dayTabs.map((tab) => {
                const isSelected = tab.offset === selectedDayOffset;
                return (
                  <button
                    key={tab.offset}
                    type="button"
                    data-tv-focusable="true"
                    onClick={() => {
                      if (tab.isLocked) {
                        setPendingLockedOffset(tab.offset);
                        onRequestProEpgUpgrade?.();
                        return;
                      }
                      setSelectedDayOffset(tab.offset);
                    }}
                    title={
                      tab.isLocked
                        ? activeLang === 'fr'
                          ? `${tab.label} 🔒 — Réservé aux membres PulseEPG Pro`
                          : `${tab.label} 🔒 — PulseEPG Pro required`
                        : tab.label
                    }
                    className={`px-3 py-1.5 rounded-lg text-xs transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] border-[1.5px] border-[#60a5fa] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(37,99,235,0.45)]'
                        : tab.isLocked
                        ? 'bg-[#141a26]/80 border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#38bdf8]/60 font-medium'
                        : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#38bdf8]/60 font-medium'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {tab.isLocked ? (
                      <span
                        aria-label="Verrouillé PulseEPG Pro"
                        className="text-[11px] leading-none shrink-0"
                      >
                        🔒
                      </span>
                    ) : (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                          isSelected
                            ? 'bg-[#0a0e17]/80 text-[#ffffff] border border-[#ff0033]/50 font-bold'
                            : 'bg-[#0a0e17] text-[#cbd5e1]'
                        }`}
                      >
                        {toStandardDigits(tab.count)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div
              data-tv-row="modal-periods"
              className="flex items-center gap-2 flex-wrap pt-1"
            >
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
                    data-tv-focusable="true"
                    onClick={() => setPeriodFilter(period.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                      active
                        ? 'bg-[#ec4899] border-[1.5px] border-[#f43f5e] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(236,72,153,0.45)]'
                        : 'bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#ec4899]/60 font-medium'
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
                    data-programme-card="true"
                    data-tv-focusable="true"
                    onClick={() => setSelectedProgramme(prog)}
                    onKeyDown={(e) => {
                      if (
                        e.key === 'Enter' ||
                        e.key === ' ' ||
                        e.key === 'Select' ||
                        e.keyCode === 23 ||
                        e.keyCode === 66
                      ) {
                        e.preventDefault();
                        setSelectedProgramme(prog);
                      }
                    }}
                    className={`tv-card-focusable group rounded-lg p-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'selected-program bg-[#1a202c] border-2 border-[#ec4899] shadow-[0_0_15px_rgba(236,72,153,0.4)]'
                        : hasReminder
                        ? 'bg-gradient-to-r from-[#ec4899]/15 via-[#0a0e17] to-[#8b5cf6]/15 border-[1.5px] border-[#ec4899]/80 shadow-[0_0_12px_rgba(236,72,153,0.25)]'
                        : isLive
                        ? 'bg-[#0a0e17] border border-[#ef4444]/60'
                        : isPast
                        ? 'bg-[#0a0e17]/60 border border-[#1a202c] opacity-70 hover:opacity-100'
                        : 'bg-[#0a0e17] border border-[#1a202c] hover:border-[#38bdf8]/60'
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
                            <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider bg-[#ef4444] text-[#ffffff] border border-[#f87171] shadow-[0_0_8px_rgba(239,68,68,0.45)] rounded">
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
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2563eb]/20 text-[#38bdf8] border border-[#38bdf8]/40 font-medium">
                                {formattedListSE}
                              </span>
                            )}
                            {prog.date && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#2563eb]/15 text-[#cbd5e1] border border-[#38bdf8]/30 font-medium">
                                {formatReleaseYearOrDate(prog.date)}
                              </span>
                            )}
                            {prog.category && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-[#2563eb]/20 text-[#38bdf8] border border-[#38bdf8]/40">
                                {translateDynamicGenre(
                                  prog.category,
                                  activeLang
                                )}
                              </span>
                            )}
                            {hasReminder && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] text-[#ffffff] border border-[#ec4899] shadow-[0_0_10px_rgba(236,72,153,0.4)]">
                                <BellRing className="w-2.5 h-2.5 text-[#ffffff]" />
                                {tr.reminderActive}
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
                                className="h-full bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] shadow-[0_0_8px_#ec4899] rounded-full"
                                style={{ width: `${progProgress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-[11px] font-mono text-[#cbd5e1]">
                          {formatDurationMinutes(prog.startMs, prog.stopMs, activeLang)}
                        </span>
                        {prog.stopMs > nowMs && (
                          <button
                            type="button"
                            data-tv-focusable="true"
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleReminder(prog, channel);
                            }}
                            onKeyDown={(e) => {
                              if (
                                e.key === 'Enter' ||
                                e.key === ' ' ||
                                e.key === 'Select' ||
                                e.keyCode === 23 ||
                                e.keyCode === 66
                              ) {
                                e.stopPropagation();
                                e.preventDefault();
                                onToggleReminder(prog, channel);
                              }
                            }}
                            className={`tv-focusable inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                              hasReminder
                                ? 'bg-gradient-to-r from-[#ec4899] to-[#8b5cf6] border-[1.5px] border-[#ec4899] text-[#ffffff] shadow-[0_0_12px_rgba(236,72,153,0.5)]'
                                : 'bg-[#141a26] border border-[#38bdf8]/45 text-[#cbd5e1] hover:text-[#ffffff] hover:border-[#ec4899]'
                            }`}
                            title={
                              hasReminder ? tr.cancelReminder : tr.remindProgram
                            }
                          >
                            {hasReminder ? (
                              <>
                                <BellRing className="w-3.5 h-3.5 text-[#ffffff]" />
                                <span className="hidden sm:inline">
                                  {tr.reminderActive}
                                </span>
                              </>
                            ) : (
                              <>
                                <Bell className="w-3.5 h-3.5 text-[#60a5fa]" />
                                <span className="hidden sm:inline">
                                  {tr.reminderBtn}
                                </span>
                              </>
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
