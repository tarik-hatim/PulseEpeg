import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Trophy,
  Play,
  Clock,
  Star,
  Bell,
  Search,
  X,
  Tv,
  Flame,
  CheckCircle2,
  RefreshCw,
  Maximize2,
  Minimize2,
  Crown,
} from 'lucide-react';
import { EpgChannel, EpgProgramme, EpgBouquetId } from '../types/epg';
import {
  parseMatch,
  isReplay,
  eventKey,
  norm,
  detectCompetition,
  POPULAR_COMPETITIONS,
  getFavoriteTeams,
  toggleFavoriteTeam,
  matchHasFavoriteTeam,
  isTeamFavorited,
  isFreeChannel,
  highlightFor,
  searchVideos,
  fetchCompetitionHighlights,
  fetchGlobalSportFixtures,
  isExplicitlyLive,
  formatVideoDuration,
  VideoHighlight,
  GlobalSportFixture,
  detectSport,
  formatLiveMatchTiming,
  SportInfo,
} from '../utils/sportsEngine';
import { lookupTransponderSync } from '../services/satelliteCatalogService';
import { toStandardDigits } from '../utils/timeFormat';

const COMPETITION_ARABIC_NAMES: Record<string, string> = {
  ucl: 'دوري أبطال أوروبا',
  afc: "دوري أبطال آسيا (AFC)",
  botola: 'البطولة الاحترافية إنوي',
  eng2: 'التشامبيونشيب (إنجلترا)',
  mls: 'الدوري الأمريكي (MLS)',
  pl: 'الدوري الإنجليزي الممتاز',
  laliga: 'الدوري الإسباني (لا ليغا)',
  ligue1: 'الدوري الفرنسي (ليغ 1)',
  seriea: 'الدوري الإيطالي (سيري آ)',
  bundesliga: 'الدوري الألماني (بوندسليغا)',
  spl: 'دوري روشن السعودي',
  uel: 'الدوري الأوروبي',
  f1: 'فورمولا 1 (F1)',
  motogp: 'موتو جي بي',
  nba: 'كرة السلة (NBA)',
  tennis: 'تنس (غراند سلام / ATP)',
  rugby: 'الرجبي',
  mma: 'الفنون القتالية (UFC / MMA)',
};

/**
 * Détermine si un diffuseur satellite correspond aux bouquets configurés
 * par l'utilisateur ou à sa langue de préférence (ex: évite d'afficher beIN Sports AR
 * pour un utilisateur européen non-arabophone sans satellite Nilesat/Badr).
 */
export function isBroadcasterMatchingBouquets(
  channelName: string,
  satellite: string,
  userBouquets: EpgBouquetId[] | undefined,
  channelByName: Map<string, EpgChannel>,
  activeLang: string
): boolean {
  const normName = channelName.toLowerCase().trim();

  // 1. Chaîne déjà présente dans le guide TV actif de l'utilisateur
  if (channelByName.has(normName)) {
    return true;
  }

  // 2. Si aucun bouquet n'est spécifié, autoriser par défaut
  if (!userBouquets || userBouquets.length === 0) {
    return true;
  }

  const isArabicBouquetActive = userBouquets.some((b) =>
    ['nilesat_osn_mbc', 'badr_bein_ssc'].includes(b)
  );
  const isFrenchBouquetActive = userBouquets.some((b) =>
    ['astra_canal_fr', 'astra_tnt_fr', 'tnt_fr', 'hotbird_bis_fr'].includes(b)
  );
  const isSpanishBouquetActive = userBouquets.includes('movistar_es');
  const isGermanBouquetActive = userBouquets.includes('sky_de');
  const isItalianBouquetActive = userBouquets.includes('sky_it');
  const isUkBouquetActive = userBouquets.some((b) =>
    ['sky_uk', 'freesat_uk'].includes(b)
  );

  const isArabicBroadcaster =
    /(?:bein\s*sports?\s*(?:[1-9]|max|premium|afc|english|global)?\s*(?:\(ar\)|ar|mena)?|ssc\s*[1-9]|abu\s*dhabi|arryadia|al\s*kass|dubai\s*sports|alkass|sharjah\s*sport|kuwait\s*sport)/i.test(
      channelName
    ) || /nilesat|badr|es'hail/i.test(satellite);

  const isFrenchBroadcaster =
    /(?:canal\+|canal\+\s*foot|canal\+\s*sport|canal\+\s*premier|bein\s*sports?\s*[1-9]\s*fr|bein\s*sports?\s*max|dazn\s*1|tf1|m6|rmc\s*sport|l'equipe|france\s*[2-5])/i.test(
      channelName
    );

  const isSpanishBroadcaster =
    /(?:movistar|laliga|dazn\s*laliga|teledeporte|gol\s*play|cuatro|la\s*1)/i.test(
      channelName
    );

  const isGermanBroadcaster =
    /(?:sky\s*sport\s*austria|sky\s*sport\s*bundesliga|dazn\s*de|zdf|ard|rtl|sat\.1)/i.test(
      channelName
    );

  const isItalianBroadcaster =
    /(?:sky\s*sport\s*calcio|sky\s*sport\s*uno|sky\s*sport\s*football|rai\s*sport|mediaset)/i.test(
      channelName
    );

  const isUkBroadcaster =
    /(?:sky\s*sports?\s*football|sky\s*sports?\s*main\s*event|sky\s*sports?\s*premier|tnt\s*sports|bbc|itv)/i.test(
      channelName
    );

  // Exclusion stricte des diffuseurs arabophones si l'utilisateur n'a aucun bouquet arabe
  if (isArabicBroadcaster) {
    return isArabicBouquetActive || activeLang === 'ar';
  }

  // Si diffuseur français
  if (isFrenchBroadcaster) {
    return isFrenchBouquetActive || activeLang === 'fr';
  }

  // Si diffuseur espagnol
  if (isSpanishBroadcaster) {
    return isSpanishBouquetActive || activeLang === 'es';
  }

  // Si diffuseur allemand
  if (isGermanBroadcaster) {
    return isGermanBouquetActive || activeLang === 'de';
  }

  // Si diffuseur italien
  if (isItalianBroadcaster) {
    return isItalianBouquetActive || activeLang === 'it';
  }

  // Si diffuseur UK
  if (isUkBroadcaster) {
    return isUkBouquetActive || activeLang === 'en';
  }

  return true;
}

export interface SportsEvent {
  key: string;
  programme: EpgProgramme;
  isMatch: boolean;
  matchInfo: ReturnType<typeof parseMatch>;
  competition: ReturnType<typeof detectCompetition>;
  sport: SportInfo;
  airings: Array<{
    channel: EpgChannel;
    programme: EpgProgramme;
    isFree: boolean;
  }>;
  fixtureMeta?: GlobalSportFixture;
}

interface SportsViewProps {
  channels: EpgChannel[];
  schedulesByChannel: Record<string, EpgProgramme[]>;
  nowMs: number;
  activeLang: string;
  selectedBouquets?: EpgBouquetId[];
  isPremium?: boolean;
  onRequestProUpgrade?: () => void;
  onSelectChannel: (channel: EpgChannel, programme?: EpgProgramme) => void;
  onToggleReminder?: (prog: EpgProgramme, channel: EpgChannel) => void;
  isProgrammeReminderSet?: (progId: string) => boolean;
}

export const SportsView: React.FC<SportsViewProps> = ({
  channels,
  schedulesByChannel,
  nowMs,
  activeLang,
  selectedBouquets = [],
  isPremium = false,
  onRequestProUpgrade,
  onSelectChannel,
  onToggleReminder,
  isProgrammeReminderSet,
}) => {
  const [viewTab, setViewTab] = useState<'live' | 'upcoming' | 'ended'>('upcoming');
  const [broadcasterScope, setBroadcasterScope] = useState<'my_bouquets' | 'all'>('my_bouquets');
  const [onlyMatches, setOnlyMatches] = useState(true);
  const [onlyFree, setOnlyFree] = useState(false);
  const [onlyFavoriteTeams, setOnlyFavoriteTeams] = useState(false);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [favoriteTeams, setFavoriteTeams] = useState<string[]>(() => getFavoriteTeams());

  // Affiches et rencontres d'envergure mondiale (Ligue des Champions UEFA & Asie, Botola Pro, MLS, Championship, etc.)
  const [globalFixtures, setGlobalFixtures] = useState<GlobalSportFixture[]>([]);
  const [isFixturesLoading, setIsFixturesLoading] = useState(false);

  // Flux de résumés vidéo automatiques (ex: Ligue des Champions, LaLiga, etc.)
  const [feedHighlights, setFeedHighlights] = useState<VideoHighlight[]>([]);
  const [isFeedLoading, setIsFeedLoading] = useState(false);

  // Lecteur vidéo 100% IN-APP (aucun lien externe)
  const [activePlayer, setActivePlayer] = useState<{
    videoId: string;
    title: string;
    channelName: string;
    alternateVideos?: VideoHighlight[];
  } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Synchronisation des équipes favorites
  const handleToggleFavoriteTeam = (teamName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = toggleFavoriteTeam(teamName);
    setFavoriteTeams(updated);
  };

  // Chargement des grands matchs mondiaux (UEFA, AFC, Botola Pro, MLS, etc.)
  useEffect(() => {
    let cancelled = false;
    setIsFixturesLoading(true);
    fetchGlobalSportFixtures()
      .then((data) => {
        if (!cancelled && data && data.length > 0) {
          setGlobalFixtures(data);
        }
      })
      .finally(() => {
        if (!cancelled) setIsFixturesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Chargement automatique des résumés officiels quand on est sur l'onglet "Résumés vidéo"
  const loadHighlightsFeed = useCallback(async (compId: string, query: string) => {
    setIsFeedLoading(true);
    try {
      if (query.trim().length >= 2) {
        const results = await searchVideos(`${query} resume officiel match highlights`);
        setFeedHighlights(results);
      } else {
        const results = await fetchCompetitionHighlights(compId === 'all' ? 'ucl' : compId);
        setFeedHighlights(results);
      }
    } catch {
      // Ignorer erreur
    } finally {
      setIsFeedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (viewTab === 'ended') {
      void loadHighlightsFeed(selectedCompetitionId, searchQuery);
    }
  }, [viewTab, selectedCompetitionId, searchQuery, loadHighlightsFeed]);

  const channelById = useMemo(() => {
    const map = new Map<string, EpgChannel>();
    for (const ch of channels) {
      map.set(ch.id, ch);
    }
    return map;
  }, [channels]);

  const channelByName = useMemo(() => {
    const map = new Map<string, EpgChannel>();
    for (const ch of channels) {
      map.set(ch.displayName.toLowerCase().trim(), ch);
    }
    return map;
  }, [channels]);

  // Agrégation et fusion : Guide TV local + Grands matchs d'audience mondiale
  const allSportsEvents = useMemo(() => {
    const horizonMs = nowMs + 48 * 3600_000;
    const pastHorizonMs = nowMs - 24 * 3600_000;
    const eventsMap = new Map<string, SportsEvent>();

    const sportRegex =
      /sport|football|soccer|champions|ligue|bein|ssc|eurosport|dazn|arena|espn|canal\+ sport|movistar (?:liga|deportes)|tivibu|arryadia/i;

    // 1. Traitement des chaînes locales du guide TV
    for (const [chId, progs] of Object.entries(schedulesByChannel)) {
      const channel = channelById.get(chId);
      if (!channel) continue;

      const tpInfo = lookupTransponderSync(channel.displayName);
      const isFree = isFreeChannel(channel.displayName, tpInfo?.isEncrypted ?? false);

      for (const p of progs) {
        if (p.stopMs <= pastHorizonMs || p.startMs > horizonMs) continue;

        const isSportChannel =
          channel.contentCategory === 'Sport / Football' ||
          channel.group === 'Sport / Football' ||
          sportRegex.test(channel.displayName);

        // Si la chaîne n'est pas spécialisée sport, exiger impérativement une catégorie sport dans l'EPG
        if (!isSportChannel && !/sport|football/i.test(p.category || '')) {
          continue;
        }

        if (isReplay(p.title) || (p.description && isReplay(p.description))) continue;

        const mInfo = parseMatch(p.title);
        // Doit obligatoirement être une affiche sportive valide identifiant 2 équipes distinctes
        if (!mInfo) continue;

        const comp = detectCompetition(p.title, p.category);
        const sport = detectSport(p.title, p.category || '', channel.displayName);
        const k = eventKey(p.title, p.startMs);

        const existing = eventsMap.get(k);
        if (existing) {
          if (!existing.airings.some((a) => a.channel.id === channel.id)) {
            existing.airings.push({ channel, programme: p, isFree });
          }
        } else {
          eventsMap.set(k, {
            key: k,
            programme: p,
            isMatch: true,
            matchInfo: mInfo,
            competition: comp,
            sport,
            airings: [{ channel, programme: p, isFree }],
          });
        }
      }
    }

    // 2. Fusion des affiches mondiales de premier rang (Ligue des Champions UEFA/Asie, Botola Pro, MLS, Championship, etc.)
    for (const f of globalFixtures) {
      if (f.stopMs <= pastHorizonMs || f.startMs > horizonMs) continue;

      const comp = {
        id: f.competitionId,
        label: f.competitionLabel,
        regex: new RegExp(f.competitionLabel, 'i'),
        sport: 'Football',
      };
      const sport = detectSport(
        `${f.homeTeam} vs ${f.awayTeam}`,
        f.competitionLabel,
        f.broadcasters[0]?.name || ''
      );
      const mInfo = {
        home: norm(f.homeTeam),
        away: norm(f.awayTeam),
        rawHome: f.homeTeam,
        rawAway: f.awayTeam,
      };
      const k = eventKey(`${f.homeTeam} vs ${f.awayTeam}`, f.startMs);

      const existing = eventsMap.get(k);
      if (existing) {
        existing.fixtureMeta = f;
        for (const b of f.broadcasters) {
          const found = channelByName.get(b.name.toLowerCase().trim());
          const targetChannel: EpgChannel = found || {
            id: `broadcaster-${b.name}`,
            displayName: b.name,
            orbitalPosition: b.satellite,
            contentCategory: 'Sport / Football',
            group: 'Sport / Football',
            country: 'EU' as const,
            satellites: [b.satellite as any],
            bouquets: ['Tous' as any],
            audioTrackLabel: 'Direct',
            subtitleTrackLabel: '',
            sourceId: 'live-fixture',
            sourceName: 'Satellite Feed',
            channelNumber: 1,
            programmeCount: 1,
          };
          if (!existing.airings.some((a) => a.channel.displayName === b.name)) {
            existing.airings.push({
              channel: targetChannel,
              programme: {
                id: `prog-${f.id}-${b.name}`,
                channelId: targetChannel.id,
                title: `${f.homeTeam} vs ${f.awayTeam}`,
                category: 'Sport / Football',
                startMs: f.startMs,
                stopMs: f.stopMs,
              },
              isFree: b.isFree,
            });
          }
        }
      } else {
        const airings = f.broadcasters.map((b) => {
          const found = channelByName.get(b.name.toLowerCase().trim());
          const targetChannel: EpgChannel = found || {
            id: `broadcaster-${b.name}`,
            displayName: b.name,
            orbitalPosition: b.satellite,
            contentCategory: 'Sport / Football',
            group: 'Sport / Football',
            country: 'EU' as const,
            satellites: [b.satellite as any],
            bouquets: ['Tous' as any],
            audioTrackLabel: 'Direct',
            subtitleTrackLabel: '',
            sourceId: 'live-fixture',
            sourceName: 'Satellite Feed',
            channelNumber: 1,
            programmeCount: 1,
          };
          return {
            channel: targetChannel,
            programme: {
              id: `prog-${f.id}-${b.name}`,
              channelId: targetChannel.id,
              title: `${f.homeTeam} vs ${f.awayTeam}`,
              category: 'Sport / Football',
              startMs: f.startMs,
              stopMs: f.stopMs,
            },
            isFree: b.isFree,
          };
        });

        eventsMap.set(k, {
          key: k,
          programme: {
            id: `fixture-${f.id}`,
            channelId: airings[0]?.channel.id || 'sport',
            title: `${f.homeTeam} vs ${f.awayTeam}`,
            category: 'Sport / Football',
            startMs: f.startMs,
            stopMs: f.stopMs,
          },
          isMatch: true,
          matchInfo: mInfo,
          competition: comp,
          sport,
          airings,
          fixtureMeta: f,
        });
      }
    }

    return Array.from(eventsMap.values()).sort(
      (a, b) => a.programme.startMs - b.programme.startMs
    );
  }, [channels, schedulesByChannel, globalFixtures, nowMs]);

  // Filtrage selon les options sélectionnées
  const filteredEvents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return allSportsEvents.filter((ev) => {
      if (onlyMatches && !ev.isMatch) return false;

      if (selectedCompetitionId !== 'all') {
        if (!ev.competition || ev.competition.id !== selectedCompetitionId) {
          return false;
        }
      }

      if (onlyFree && !ev.airings.some((a) => a.isFree)) return false;

      if (onlyFavoriteTeams && ev.matchInfo) {
        if (!matchHasFavoriteTeam(ev.matchInfo.home, ev.matchInfo.away, favoriteTeams)) {
          return false;
        }
      }

      if (q) {
        const titleMatch = ev.programme.title.toLowerCase().includes(q);
        const homeMatch = ev.matchInfo?.rawHome.toLowerCase().includes(q);
        const awayMatch = ev.matchInfo?.rawAway.toLowerCase().includes(q);
        const compMatch = ev.competition?.label.toLowerCase().includes(q);
        const channelMatch = ev.airings.some((a) =>
          a.channel.displayName.toLowerCase().includes(q)
        );
        if (!titleMatch && !homeMatch && !awayMatch && !compMatch && !channelMatch) {
          return false;
        }
      }

      return true;
    });
  }, [
    allSportsEvents,
    onlyMatches,
    selectedCompetitionId,
    onlyFree,
    onlyFavoriteTeams,
    favoriteTeams,
    searchQuery,
  ]);

  const liveEvents = useMemo(
    () =>
      filteredEvents.filter((e) => {
        // Cas 1 : Fixture sportive officielle issue du flux mondial en direct
        if (e.fixtureMeta) {
          return e.fixtureMeta.isLive === true && !e.fixtureMeta.isEnded;
        }

        // Cas 2 : Programme issu de l'EPG d'une chaîne
        // Pour être certifié sous "En direct", il doit impérativement :
        // 1. Être dans sa fenêtre de diffusion en cours
        // 2. Être une véritable affiche de match (isMatch)
        // 3. Ne pas être une rediffusion, archive ou résumé (isReplay)
        // 4. Comporter une mention explicite de DIRECT ("Direct", "Live", "En direct", "Directo", "مباشر", "بث مباشر")
        //    dans le titre, la description ou la catégorie EPG.
        //    (Sans cette mention, une chaîne de sport rediffusant un ancien match ne sera jamais affichée sous "En direct" !)
        const isTimingNow = e.programme.startMs <= nowMs && e.programme.stopMs > nowMs;
        if (!isTimingNow || !e.isMatch) return false;

        if (
          isReplay(e.programme.title) ||
          (e.programme.description && isReplay(e.programme.description))
        ) {
          return false;
        }

        return isExplicitlyLive(
          e.programme.title,
          e.programme.description,
          e.programme.category
        );
      }),
    [filteredEvents, nowMs]
  );

  const upcomingEvents = useMemo(
    () =>
      filteredEvents.filter((e) => {
        if (e.fixtureMeta) {
          return !e.fixtureMeta.isLive && !e.fixtureMeta.isEnded && e.programme.startMs > nowMs;
        }
        return e.programme.startMs > nowMs;
      }),
    [filteredEvents, nowMs]
  );

  const endedEvents = useMemo(
    () =>
      filteredEvents
        .filter((e) => {
          if (e.fixtureMeta) {
            return e.fixtureMeta.isEnded === true || (!e.fixtureMeta.isLive && e.programme.stopMs <= nowMs);
          }
          return e.programme.stopMs <= nowMs;
        })
        .slice(-60)
        .reverse(),
    [filteredEvents, nowMs]
  );

  // Matchs en clair d'aujourd'hui
  const todayFreeMatches = useMemo(() => {
    return allSportsEvents
      .filter((ev) => {
        const isToday =
          ev.programme.stopMs > nowMs &&
          ev.programme.startMs < nowMs + 24 * 3600_000;
        return isToday && ev.isMatch && ev.airings.some((a) => a.isFree);
      })
      .slice(0, 4);
  }, [allSportsEvents, nowMs]);

  // Lancer la lecture in-app du résumé officiel pour un match terminé
  const handlePlayMatchHighlight = async (ev: SportsEvent) => {
    const cleanTitle = ev.programme.title.replace(
      /^\s*(live|direct|en direct|directo|en vivo|canlı|مباشر)\s*[:\-–|]?\s*/i,
      ''
    );

    if (ev.matchInfo) {
      try {
        const res = await highlightFor(
          ev.matchInfo.home,
          ev.matchInfo.away,
          ev.programme.startMs
        );
        if (res?.v) {
          const alternates = await searchVideos(`${ev.matchInfo.home} ${ev.matchInfo.away}`);
          setActivePlayer({
            videoId: res.v.id,
            title: res.v.title || cleanTitle,
            channelName: res.v.channel,
            alternateVideos: alternates.filter((x) => x.id !== res.v.id).slice(0, 5),
          });
          return;
        }
      } catch {
        // En cas d'erreur
      }
    }

    const fallbackResults = await searchVideos(`${cleanTitle} highlights resume`);
    if (fallbackResults.length > 0) {
      const first = fallbackResults[0];
      setActivePlayer({
        videoId: first.id,
        title: first.title || cleanTitle,
        channelName: first.channel,
        alternateVideos: fallbackResults.slice(1, 6),
      });
    }
  };

  const handlePlayFeedVideo = (video: VideoHighlight) => {
    const alternates = feedHighlights.filter((v) => v.id !== video.id).slice(0, 6);
    setActivePlayer({
      videoId: video.id,
      title: video.title,
      channelName: video.channel,
      alternateVideos: alternates,
    });
  };

  const formatTime = (ms: number) => {
    const d = new Date(ms);
    const locale = activeLang === 'ar' ? 'ar-u-nu-latn' : 'fr-FR';
    const res = d.toLocaleTimeString(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return toStandardDigits(res);
  };

  const formatDate = (ms: number) => {
    const d = new Date(ms);
    const isToday = d.toDateString() === new Date(nowMs).toDateString();
    if (isToday) {
      if (activeLang === 'ar') return 'اليوم';
      if (activeLang === 'en') return 'Today';
      if (activeLang === 'es' || activeLang === 'es_latam') return 'Hoy';
      if (activeLang === 'de') return 'Heute';
      if (activeLang === 'it') return 'Oggi';
      if (activeLang === 'pt' || activeLang === 'pt_br') return 'Hoje';
      if (activeLang === 'nl') return 'Vandaag';
      return 'Aujourd’hui';
    }
    const isTomorrow =
      d.toDateString() === new Date(nowMs + 86400000).toDateString();
    if (isTomorrow) {
      if (activeLang === 'ar') return 'غداً';
      if (activeLang === 'en') return 'Tomorrow';
      if (activeLang === 'es' || activeLang === 'es_latam') return 'Mañana';
      if (activeLang === 'de') return 'Morgen';
      if (activeLang === 'it') return 'Domani';
      if (activeLang === 'pt' || activeLang === 'pt_br') return 'Amanhã';
      if (activeLang === 'nl') return 'Morgen';
      return 'Demain';
    }
    const locale = activeLang === 'ar' ? 'ar-u-nu-latn' : activeLang === 'en' ? 'en-US' : 'fr-FR';
    return toStandardDigits(
      d.toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
    );
  };

  return (
    <div className="w-full flex flex-col gap-4 pb-20 text-[#f8fafc] animate-fadeIn">
      {/* 1. BANNIÈRE EN CLAIR AUJOURD'HUI */}
      {todayFreeMatches.length > 0 && viewTab !== 'ended' && (
        <section
          aria-label="Matchs en clair aujourd'hui"
          className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#2563eb]/20 via-[#1d4ed8]/25 to-[#2563eb]/15 border border-[#2563eb]/40 p-4 shadow-lg backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563eb]/25 border border-[#2563eb]/50 text-[#38bdf8]">
                <Flame className="w-4 h-4 animate-pulse" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-[#ffffff] flex items-center gap-2">
                  {activeLang === 'ar' ? 'مباريات مجانية اليوم (قنوات مفتوحة / FTA)' : 'En clair aujourd’hui (Chaînes gratuites / FTA)'}
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#2563eb]/20 text-[#38bdf8] font-mono border border-[#2563eb]/40">
                    {activeLang === 'ar' ? 'بدون اشتراك' : 'Sans abonnement'}
                  </span>
                </h2>
                <p className="text-xs text-[#94a3b8]">
                  {activeLang === 'ar' ? 'البث على قنوات فضائية مفتوحة (الرياضية، TRT Spor، قنوات عامة)' : 'Diffusion sur chaînes ouvertes (Arryadia, TRT Spor, TV publiques)'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {todayFreeMatches.map((ev) => {
              const freeChannel = ev.airings.find((a) => a.isFree) || ev.airings[0];
              const isLive =
                (ev.programme.startMs <= nowMs && ev.programme.stopMs > nowMs) ||
                ev.fixtureMeta?.isLive === true;
              return (
                <div
                  key={`fta-${ev.key}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectChannel(freeChannel.channel, freeChannel.programme)}
                  className="group flex flex-col justify-between p-3 rounded-xl bg-[#0b101b]/80 border border-[#10b981]/30 hover:border-[#10b981] hover:bg-[#0b101b] transition-all cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                >
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-[#34d399] font-semibold flex items-center gap-1">
                      {isLive ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping" />
                          {activeLang === 'ar' ? 'مباشر' : 'EN DIRECT'}
                        </>
                      ) : (
                        `${formatDate(ev.programme.startMs)} · ${formatTime(ev.programme.startMs)}`
                      )}
                    </span>
                    <span className="text-[10px] text-[#cbd5e1] truncate max-w-[130px] flex items-center gap-1">
                      <span>{ev.sport?.icon || '⚽'}</span>
                      <span>{ev.competition?.label || (activeLang === 'ar' ? ev.sport?.name.ar : ev.sport?.name.fr)}</span>
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-[#ffffff] group-hover:text-[#34d399] line-clamp-2 leading-snug transition-colors">
                    {ev.programme.title}
                  </h3>

                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-[#94a3b8] pt-2 border-t border-[#1e293b]">
                    <span className="flex items-center gap-1.5 font-medium text-[#f1f5f9]">
                      <Tv className="w-3 h-3 text-[#10b981]" />
                      {freeChannel.channel.displayName}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#10b981]/20 text-[#34d399] font-mono text-[9px] font-bold">
                      {activeLang === 'ar' ? 'مفتوح' : activeLang === 'en' ? 'FREE' : 'CLAIR'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 2. BARRE D'ONGLETS PRINCIPAUX */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#0d131f]/90 p-2.5 rounded-2xl border border-[#1e293b] backdrop-blur-md">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setViewTab('live')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewTab === 'live'
                ? 'bg-[#ef4444] text-[#ffffff] shadow-[0_0_16px_rgba(239,68,68,0.4)] border border-[#f87171]'
                : 'bg-[#141c2c] text-[#94a3b8] hover:text-[#ffffff] border border-[#1e293b]'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                viewTab === 'live' ? 'bg-[#ffffff] animate-ping' : 'bg-[#ef4444]'
              }`}
            />
            <span>{activeLang === 'ar' ? 'مباشر الآن' : 'En direct'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono font-bold">
              {toStandardDigits(String(liveEvents.length))}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewTab('upcoming')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewTab === 'upcoming'
                ? 'bg-[#2563eb] text-[#ffffff] shadow-[0_0_16px_rgba(37,99,235,0.4)] border border-[#3b82f6]'
                : 'bg-[#141c2c] text-[#94a3b8] hover:text-[#ffffff] border border-[#1e293b]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{activeLang === 'ar' ? 'القادمة (24س-48س)' : 'À venir (24h-48h)'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono font-bold">
              {toStandardDigits(String(upcomingEvents.length))}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setViewTab('ended')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              viewTab === 'ended'
                ? 'bg-gradient-to-r from-[#7c3aed] to-[#a855f7] text-[#ffffff] shadow-[0_0_16px_rgba(168,85,247,0.4)] border border-[#a855f7]'
                : 'bg-[#141c2c] text-[#94a3b8] hover:text-[#ffffff] border border-[#1e293b]'
            }`}
          >
            <Play className="w-3.5 h-3.5 fill-current text-[#ffffff]" />
            <span>{activeLang === 'ar' ? 'ملخصات الفيديو' : 'Résumés vidéo'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-black/40 text-[10px] font-mono font-bold">
              {toStandardDigits(String(endedEvents.length > 0 ? endedEvents.length : feedHighlights.length || 'UCL'))}
            </span>
          </button>
        </div>

        {/* Barre de recherche */}
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#64748b]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeLang === 'ar' ? 'فريق، مباراة أو بطولة...' : 'Équipe, match ou compétition...'}
            className="w-full ps-9 pe-8 py-1.5 text-xs rounded-xl bg-[#141c2c] border border-[#1e293b] text-[#ffffff] placeholder-[#64748b] focus:outline-none focus:border-[#38bdf8]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[#64748b] hover:text-[#ffffff] cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 3. FILTRES SECONDAIRES & RUBAN DES COMPÉTITIONS */}
      <div className="flex flex-col gap-2.5 bg-[#0d131f]/60 p-3 rounded-2xl border border-[#1e293b]">
        <div className="flex flex-wrap items-center gap-2">
          {viewTab !== 'ended' && (
            <>
              {/* Matchs uniquement */}
              <button
                type="button"
                onClick={() => setOnlyMatches((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  onlyMatches
                    ? 'bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]/60 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                    : 'bg-[#141c2c] text-[#64748b] border border-[#1e293b] hover:text-[#cbd5e1]'
                }`}
              >
                <span>⚽</span>
                <span>{activeLang === 'ar' ? 'المباريات فقط' : 'Matchs uniquement'}</span>
                {onlyMatches && <span className="text-[10px] font-bold">✓</span>}
              </button>

              {/* Équipes favorites */}
              <button
                type="button"
                onClick={() => setOnlyFavoriteTeams((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  onlyFavoriteTeams
                    ? 'bg-[#f59e0b]/20 text-[#fbbf24] border border-[#f59e0b] shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                    : 'bg-[#141c2c] text-[#64748b] border border-[#1e293b] hover:text-[#cbd5e1]'
                }`}
              >
                <Star
                  className={`w-3.5 h-3.5 ${
                    onlyFavoriteTeams ? 'fill-[#fbbf24] text-[#fbbf24]' : 'text-[#64748b]'
                  }`}
                />
                <span>{activeLang === 'ar' ? `فرقي المفضلة (${toStandardDigits(String(favoriteTeams.length))})` : `Mes équipes (${favoriteTeams.length})`}</span>
              </button>

              {/* Filtre diffuseurs : Mes bouquets configurés vs Tous les satellites */}
              <div className="flex items-center gap-0.5 rounded-xl bg-[#141c2c] p-0.5 border border-[#1e293b]">
                <button
                  type="button"
                  onClick={() => setBroadcasterScope('my_bouquets')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    broadcasterScope === 'my_bouquets'
                      ? 'bg-[#2563eb] text-[#ffffff] shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                      : 'text-[#94a3b8] hover:text-[#ffffff]'
                  }`}
                  title={activeLang === 'ar' ? 'عرض قنوات باقاتك المحددة فقط' : 'Afficher uniquement les chaînes de vos bouquets configurés (ex: Canal+, TNT, Movistar, etc.)'}
                >
                  <Tv className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>{activeLang === 'ar' ? 'باقاتي' : 'Mes bouquets'}</span>
                  {broadcasterScope === 'my_bouquets' && <span className="text-[10px] font-bold">✓</span>}
                </button>
                <button
                  type="button"
                  onClick={() => setBroadcasterScope('all')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    broadcasterScope === 'all'
                      ? 'bg-[#2563eb] text-[#ffffff] shadow-[0_0_10px_rgba(37,99,235,0.4)]'
                      : 'text-[#94a3b8] hover:text-[#ffffff]'
                  }`}
                  title={activeLang === 'ar' ? 'عرض جميع القنوات الفضائية الدولية' : 'Afficher tous les diffuseurs satellites internationaux'}
                >
                  <span>🌐 {activeLang === 'ar' ? 'كل الأقمار' : 'Tous satellites'}</span>
                  {broadcasterScope === 'all' && <span className="text-[10px] font-bold">✓</span>}
                </button>
              </div>

              {/* En clair uniquement */}
              <button
                type="button"
                onClick={() => setOnlyFree((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  onlyFree
                    ? 'bg-[#2563eb]/25 text-[#38bdf8] border border-[#2563eb] shadow-[0_0_10px_rgba(37,99,235,0.35)]'
                    : 'bg-[#141c2c] text-[#64748b] border border-[#1e293b] hover:text-[#cbd5e1]'
                }`}
              >
                <span>🔓</span>
                <span>{activeLang === 'ar' ? 'مفتوحة مجاناً (FTA)' : 'En clair (FTA)'}</span>
                {onlyFree && <span className="text-[10px] font-bold">✓</span>}
              </button>

              {/* Bouton Pass Pro Sport */}
              {onRequestProUpgrade && !isPremium && (
                <button
                  type="button"
                  onClick={onRequestProUpgrade}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer bg-gradient-to-r from-[#f59e0b]/20 to-[#ec4899]/20 hover:from-[#f59e0b]/30 hover:to-[#ec4899]/30 text-[#fde047] border border-[#f59e0b]/60 hover:shadow-[0_0_12px_rgba(245,158,11,0.25)] ms-auto"
                >
                  <Crown className="w-3.5 h-3.5 fill-current text-[#fde047]" />
                  <span>{activeLang === 'ar' ? 'اشتراك برو VIP 👑' : 'Pass Pro VIP 👑'}</span>
                </button>
              )}
            </>
          )}

          {viewTab === 'ended' && (
            <div className="flex items-center gap-2 text-xs font-semibold text-[#a855f7]">
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{activeLang === 'ar' ? 'مشغّل مدمج · ملخصات رسمية لأبرز البطولات العالمية:' : 'Lecteur 100% In-App · Résumés officiels des grandes compétitions :'}</span>
            </div>
          )}
        </div>

        {/* Ruban horizontal des compétitions cibles à forte audience */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
          <button
            type="button"
            onClick={() => setSelectedCompetitionId('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all cursor-pointer ${
              selectedCompetitionId === 'all'
                ? 'bg-[#2563eb] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                : 'bg-[#141c2c] text-[#94a3b8] hover:text-[#ffffff] border border-[#1e293b]'
            }`}
          >
            {activeLang === 'ar' ? 'كل البطولات' : 'Toutes les compétitions'}
          </button>
          {POPULAR_COMPETITIONS.map((comp) => (
            <button
              key={comp.id}
              type="button"
              onClick={() => setSelectedCompetitionId(comp.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedCompetitionId === comp.id
                  ? 'bg-[#2563eb] text-[#ffffff] font-bold shadow-[0_0_12px_rgba(37,99,235,0.4)]'
                  : 'bg-[#141c2c] text-[#94a3b8] hover:text-[#ffffff] border border-[#1e293b]'
              }`}
            >
              <span>{activeLang === 'ar' ? COMPETITION_ARABIC_NAMES[comp.id] || comp.label : comp.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 4. VUE RÉSUMÉS VIDÉO (Flux direct de vidéos + Matchs terminés) */}
      {viewTab === 'ended' && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#ffffff] flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#a855f7]" />
              {activeLang === 'ar' ? 'الملخصات الرسمية والأهداف' : 'Résumés officiels & Temps forts vidéo'}
              <span className="text-xs font-normal text-[#94a3b8]">
                {activeLang === 'ar' ? '(تشغيل مدمج)' : '(Lecture intégrée directe)'}
              </span>
            </h3>
            {isFeedLoading && (
              <span className="flex items-center gap-1 text-xs text-[#a855f7]">
                <RefreshCw className="w-3 h-3 animate-spin" />
                {activeLang === 'ar' ? 'جاري التحديث...' : 'Actualisation...'}
              </span>
            )}
          </div>

          {/* Matchs terminés */}
          {endedEvents.length > 0 && (
            <div className="space-y-2 mb-4">
              <h4 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
                {activeLang === 'ar' ? 'آخر المباريات الملعوبة (أبرز المواجهات)' : 'Derniers matchs joués (Affiches majeures)'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {endedEvents.map((ev) => (
                  <article
                    key={`ended-${ev.key}`}
                    className="p-3.5 rounded-2xl bg-[#0f1422] border border-[#1e293b] flex flex-col justify-between gap-2.5 shadow-sm"
                  >
                    <div className="flex items-center justify-between text-xs text-[#94a3b8] flex-wrap gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#1e293b] text-white border border-[#334155] text-[10px] font-bold">
                          <span>{ev.sport?.icon || '⚽'}</span>
                          <span>{activeLang === 'ar' ? ev.sport?.name.ar : ev.sport?.name.fr}</span>
                        </span>
                        <span>{formatDate(ev.programme.startMs)} · {formatTime(ev.programme.startMs)}</span>
                      </div>
                      <span className="text-[11px] text-[#cbd5e1] font-semibold">
                        {ev.competition ? (activeLang === 'ar' ? COMPETITION_ARABIC_NAMES[ev.competition.id] || ev.competition.label : ev.competition.label) : (activeLang === 'ar' ? 'مباراة' : 'Match')}
                      </span>
                    </div>

                    {/* Affiche avec logos et score final (noms complets non tronqués) */}
                    <div className="p-2.5 rounded-xl bg-[#0a0e17] border border-[#1e293b] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {ev.fixtureMeta?.homeTeamLogo ? (
                            <img
                              src={ev.fixtureMeta.homeTeamLogo}
                              alt=""
                              className="w-5 h-5 object-contain shrink-0"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-[#1e293b] text-[9px] font-bold text-[#94a3b8] flex items-center justify-center shrink-0">
                              {(ev.matchInfo?.rawHome || ev.programme.title).charAt(0)}
                            </div>
                          )}
                          <span className="font-bold text-xs sm:text-sm text-[#ffffff] break-words line-clamp-2 leading-tight">
                            {ev.matchInfo?.rawHome || ev.programme.title}
                          </span>
                        </div>
                        {ev.fixtureMeta?.homeScore !== undefined && (
                          <span className="px-2 py-0.5 rounded bg-[#1e293b] text-xs font-mono font-bold text-[#fde047] shrink-0">
                            {toStandardDigits(String(ev.fixtureMeta.homeScore))}
                          </span>
                        )}
                      </div>

                      {ev.matchInfo?.rawAway && (
                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-[#1e293b]/60">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {ev.fixtureMeta?.awayTeamLogo ? (
                              <img
                                src={ev.fixtureMeta.awayTeamLogo}
                                alt=""
                                className="w-5 h-5 object-contain shrink-0"
                              />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-[#1e293b] text-[9px] font-bold text-[#94a3b8] flex items-center justify-center shrink-0">
                                {ev.matchInfo.rawAway.charAt(0)}
                              </div>
                            )}
                            <span className="font-bold text-xs sm:text-sm text-[#ffffff] break-words line-clamp-2 leading-tight">
                              {ev.matchInfo.rawAway}
                            </span>
                          </div>
                          {ev.fixtureMeta?.awayScore !== undefined && (
                            <span className="px-2 py-0.5 rounded bg-[#1e293b] text-xs font-mono font-bold text-[#fde047] shrink-0">
                              {toStandardDigits(String(ev.fixtureMeta.awayScore))}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePlayMatchHighlight(ev)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#7c3aed] hover:bg-[#6d28d9] text-[#ffffff] text-xs font-bold transition-all cursor-pointer shadow-[0_0_12px_rgba(124,58,237,0.35)]"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>{activeLang === 'ar' ? 'مشاهدة الملخص الرسمي' : 'Lire le résumé officiel'}</span>
                    </button>
                  </article>
                ))}
              </div>
            </div>
          )}

          {/* Grille des résumés officiels vidéo (YouTube Feed) */}
          {feedHighlights.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
                {activeLang === 'ar' ? 'فيديوهات وملخصات رسمية (UEFA والبطولات الكبرى)' : 'Vidéos officielles (UEFA, Ligues & Fédérations)'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                {feedHighlights.map((v) => {
                  const durText = formatVideoDuration(v.dur);
                  return (
                    <article
                      key={v.id}
                      onClick={() => handlePlayFeedVideo(v)}
                      className="group flex flex-col justify-between overflow-hidden rounded-2xl bg-[#0f1422] border border-[#1e293b] hover:border-[#a855f7] hover:shadow-[0_0_20px_rgba(168,85,247,0.25)] transition-all cursor-pointer"
                    >
                      <div className="relative aspect-video w-full overflow-hidden bg-black">
                        <img
                          src={`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`}
                          alt={v.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 flex items-center justify-center transition-colors">
                          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#7c3aed] text-white shadow-lg group-hover:scale-110 transition-transform">
                            <Play className="w-5 h-5 fill-current ms-0.5" />
                          </span>
                        </div>
                        {durText && (
                          <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 font-mono text-[10px] text-white font-bold backdrop-blur-sm">
                            {toStandardDigits(durText)}
                          </span>
                        )}
                      </div>

                      <div className="p-3 flex flex-col justify-between flex-1 gap-2">
                        <h4 className="text-xs font-bold text-[#ffffff] group-hover:text-[#c084fc] line-clamp-2 transition-colors leading-snug">
                          {v.title}
                        </h4>

                        <div className="flex items-center justify-between text-[11px] text-[#94a3b8] pt-1 border-t border-[#1e293b]/60">
                          <span className="flex items-center gap-1 font-semibold text-[#cbd5e1] truncate max-w-[150px]">
                            {v.channel}
                            {v.verified && (
                              <CheckCircle2 className="w-3 h-3 text-[#38bdf8] shrink-0" />
                            )}
                          </span>
                          <span className="text-[10px] text-[#a855f7] font-bold">
                            {activeLang === 'ar' ? 'مشاهدة ▷' : 'Regarder ▷'}
                          </span>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 5. VUE MATCHS EN DIRECT ET À VENIR */}
      {viewTab !== 'ended' && (() => {
        const currentList = viewTab === 'live' ? liveEvents : upcomingEvents;

        if (currentList.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center rounded-2xl border border-dashed border-[#1e293b] bg-[#0b101b]/50">
              <Trophy className="w-12 h-12 text-[#475569] mb-3" />
              <h3 className="text-base font-semibold text-[#ffffff] mb-1">
                {viewTab === 'live'
                  ? (activeLang === 'ar' ? 'لا توجد مباريات مباشرة في هذا الوقت' : 'Aucun match en direct en ce moment')
                  : (activeLang === 'ar' ? 'لا توجد مباريات مبرمجة في هذا التصنيف' : 'Aucun match programmé dans ce filtre')}
              </h3>
              <p className="text-xs text-[#94a3b8] max-w-md mb-4">
                {viewTab === 'live'
                  ? (activeLang === 'ar'
                      ? 'يتم عرض المباريات الجارية حالياً والمؤكدة هنا فقط. استعرض قسم «القادمة» لاكتشاف المباريات المقبلة!'
                      : 'Seuls les matchs officiellement en cours avec diffusion en direct certifiée sont affichés ici. Consultez l’onglet « À venir » pour découvrir les prochaines affiches !')
                  : (activeLang === 'ar'
                      ? 'جرّب اختيار «كل البطولات» لعرض كافة المباريات المبرمجة.'
                      : 'Essayez de sélectionner « Toutes les compétitions » pour découvrir l’ensemble des matchs programmés.')}
              </p>
              {viewTab === 'live' && (
                <button
                  type="button"
                  onClick={() => setViewTab('upcoming')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#ef4444] hover:bg-[#dc2626] text-xs font-bold text-white transition-all shadow-[0_0_15px_rgba(239,68,68,0.3)] cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  {activeLang === 'ar' ? 'استعراض المباريات القادمة' : 'Consulter les prochains matchs (À venir)'}
                </button>
              )}
            </div>
          );
        }

        return (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {currentList.map((ev) => {
              const isLive =
                (ev.programme.startMs <= nowMs && ev.programme.stopMs > nowMs) ||
                ev.fixtureMeta?.isLive === true;
              const durationMs = ev.programme.stopMs - ev.programme.startMs;
              const elapsedMs = Math.max(0, nowMs - ev.programme.startMs);
              const progressPct = Math.min(
                100,
                Math.max(0, (elapsedMs / (durationMs || 1)) * 100)
              );

              const hasReminder = isProgrammeReminderSet?.(ev.programme.id) ?? false;
              const isHomeFav = ev.matchInfo
                ? isTeamFavorited(ev.matchInfo.home, favoriteTeams)
                : false;
              const isAwayFav = ev.matchInfo
                ? isTeamFavorited(ev.matchInfo.away, favoriteTeams)
                : false;

              return (
                <article
                  key={ev.key}
                  className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 ${
                    isLive
                      ? 'bg-gradient-to-b from-[#141a29] to-[#0c101a] border-[#ef4444]/40 shadow-[0_4px_20px_rgba(239,68,68,0.12)]'
                      : 'bg-[#0f1422] border-[#1e293b] hover:border-[#38bdf8]/50'
                  }`}
                >
                  {/* Ligne 1 : Badge Sport + Timing + Compétition + Bouton Rappel */}
                  <div className="flex items-center justify-between text-xs mb-2 gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* Badge Sport (⚽ Football, 🏉 Rugby, 🏀 Basketball, etc.) */}
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#1e293b] text-white border border-[#334155] text-[11px] font-bold shadow-sm">
                        <span>{ev.sport?.icon || '⚽'}</span>
                        <span>
                          {activeLang === 'ar'
                            ? ev.sport?.name.ar || 'رياضة'
                            : ev.sport?.name.fr || 'Sport'}
                        </span>
                      </span>

                      {/* Statut En direct ou Heure programmée */}
                      {isLive ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#ef4444]/20 border border-[#ef4444]/60 text-[#f87171] font-bold font-mono text-[11px] animate-pulse">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#ef4444]" />
                          <span>{activeLang === 'ar' ? 'مباشر' : 'DIRECT'}</span>
                          <span>·</span>
                          <span>
                            {formatLiveMatchTiming(
                              elapsedMs,
                              ev.sport?.type || 'football',
                              ev.fixtureMeta?.statusText,
                              activeLang === 'ar' ? 'ar' : activeLang === 'en' ? 'en' : 'fr'
                            )}
                          </span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-[#2563eb]/15 border border-[#2563eb]/30 text-[#60a5fa] font-mono text-[11px]">
                          {formatDate(ev.programme.startMs)} · {formatTime(ev.programme.startMs)}
                        </span>
                      )}

                      {ev.competition && (
                        <span className="text-[11px] text-[#cbd5e1] font-semibold truncate max-w-[140px]">
                          {activeLang === 'ar' && COMPETITION_ARABIC_NAMES[ev.competition.id]
                            ? COMPETITION_ARABIC_NAMES[ev.competition.id]
                            : ev.competition.label}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {onToggleReminder && !isLive && (
                        <button
                          type="button"
                          onClick={() => onToggleReminder(ev.programme, ev.airings[0]?.channel)}
                          aria-label="Rappel"
                          className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                            hasReminder
                              ? 'bg-[#ec4899] border-[#ec4899] text-[#ffffff] shadow-[0_0_10px_rgba(236,72,153,0.5)]'
                              : 'bg-[#141c2c] border-[#1e293b] text-[#64748b] hover:text-[#ffffff]'
                          }`}
                        >
                          <Bell className={`w-3.5 h-3.5 ${hasReminder ? 'fill-current' : ''}`} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Ligne 2 : Clarification durée du sport vs créneau TV (évite toute confusion sur 119/120 min) */}
                  <div className="flex items-center justify-between text-[10px] text-[#94a3b8] px-2.5 py-1 rounded-lg bg-[#0a0e17] border border-[#1e293b]/70 mb-2.5">
                    <span className="flex items-center gap-1 font-medium text-[#cbd5e1]">
                      <Clock className="w-3 h-3 text-[#38bdf8] shrink-0" />
                      <span>
                        {activeLang === 'ar'
                          ? `المباراة : ${ev.sport?.regulationTime.ar || '90 دقيقة'}`
                          : `Match : ${ev.sport?.regulationTime.fr || '90 min'}`}
                      </span>
                    </span>
                    <span className="text-[#64748b] font-mono text-[9px] sm:text-[10px]">
                      {activeLang === 'ar'
                        ? `البث : ${formatTime(ev.programme.startMs)} — ${formatTime(ev.programme.stopMs)}`
                        : `Créneau TV : ${formatTime(ev.programme.startMs)} — ${formatTime(ev.programme.stopMs)}`}
                    </span>
                  </div>

                  {/* Ligne 3 : Affiche avec noms de clubs COMPLETS (non tronqués) et logos */}
                  {ev.matchInfo ? (
                    <div className="my-1.5 p-3 rounded-xl bg-[#090d16]/90 border border-[#1e293b] space-y-2.5">
                      {/* Club Domicile — Nom complet non tronqué */}
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {ev.fixtureMeta?.homeTeamLogo ? (
                            <img
                              src={ev.fixtureMeta.homeTeamLogo}
                              alt=""
                              className="w-6 h-6 object-contain shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-[#1e293b] border border-[#334155] text-[10px] font-bold text-[#94a3b8] flex items-center justify-center shrink-0">
                              {ev.matchInfo.rawHome.charAt(0)}
                            </div>
                          )}
                          <span className="font-bold text-xs sm:text-sm text-[#ffffff] break-words line-clamp-2 leading-tight">
                            {ev.matchInfo.rawHome}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isLive && (
                            <span className="px-2.5 py-1 rounded-lg bg-[#ef4444]/25 border border-[#ef4444]/60 text-xs sm:text-sm font-mono font-extrabold text-white min-w-[30px] text-center shadow-[0_0_8px_rgba(239,68,68,0.3)]">
                              {toStandardDigits(
                                String(ev.fixtureMeta?.homeScore !== undefined ? ev.fixtureMeta.homeScore : '0')
                              )}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleToggleFavoriteTeam(ev.matchInfo!.home, e)}
                            title={activeLang === 'ar' ? 'إضافة إلى الفرق المفضلة' : 'Ajouter aux équipes favorites'}
                            className="text-[#64748b] hover:text-[#fbbf24] transition-colors shrink-0 cursor-pointer p-1"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                isHomeFav ? 'fill-[#fbbf24] text-[#fbbf24]' : ''
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Séparateur / VS ou Tableau d'affichage central Score Exact en direct */}
                      {isLive ? (
                        <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#ef4444]/20 via-[#ef4444]/30 to-[#ef4444]/20 border border-[#ef4444]/50 my-1 shadow-[0_0_14px_rgba(239,68,68,0.2)]">
                          <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ef4444] opacity-80" />
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#ef4444]" />
                            </span>
                            <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#fca5a5]">
                              {activeLang === 'ar' ? 'النتيجة المباشرة' : 'Score en direct'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 font-mono font-black text-sm sm:text-base text-white">
                            <span className="px-2 py-0.5 rounded-md bg-black/60 border border-[#ef4444]/60 text-white min-w-[28px] text-center shadow-inner">
                              {toStandardDigits(
                                String(ev.fixtureMeta?.homeScore !== undefined ? ev.fixtureMeta.homeScore : '0')
                              )}
                            </span>
                            <span className="text-[#f87171] font-bold">:</span>
                            <span className="px-2 py-0.5 rounded-md bg-black/60 border border-[#ef4444]/60 text-white min-w-[28px] text-center shadow-inner">
                              {toStandardDigits(
                                String(ev.fixtureMeta?.awayScore !== undefined ? ev.fixtureMeta.awayScore : '0')
                              )}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between px-2 text-[9px] text-[#64748b] font-semibold border-t border-[#1e293b]/60 pt-1.5">
                          <span className="uppercase tracking-wider font-mono text-[9px] text-[#64748b]">
                            {activeLang === 'ar' ? 'ضد' : 'VS'}
                          </span>
                        </div>
                      )}

                      {/* Club Extérieur — Nom complet non tronqué */}
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          {ev.fixtureMeta?.awayTeamLogo ? (
                            <img
                              src={ev.fixtureMeta.awayTeamLogo}
                              alt=""
                              className="w-6 h-6 object-contain shrink-0"
                            />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-[#1e293b] border border-[#334155] text-[10px] font-bold text-[#94a3b8] flex items-center justify-center shrink-0">
                              {ev.matchInfo.rawAway.charAt(0)}
                            </div>
                          )}
                          <span className="font-bold text-xs sm:text-sm text-[#ffffff] break-words line-clamp-2 leading-tight">
                            {ev.matchInfo.rawAway}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isLive && (
                            <span className="px-2.5 py-1 rounded-lg bg-[#ef4444]/25 border border-[#ef4444]/60 text-xs sm:text-sm font-mono font-extrabold text-white min-w-[30px] text-center shadow-[0_0_8px_rgba(239,68,68,0.3)]">
                              {toStandardDigits(
                                String(ev.fixtureMeta?.awayScore !== undefined ? ev.fixtureMeta.awayScore : '0')
                              )}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleToggleFavoriteTeam(ev.matchInfo!.away, e)}
                            title={activeLang === 'ar' ? 'إضافة إلى الفرق المفضلة' : 'Ajouter aux équipes favorites'}
                            className="text-[#64748b] hover:text-[#fbbf24] transition-colors shrink-0 cursor-pointer p-1"
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                isAwayFav ? 'fill-[#fbbf24] text-[#fbbf24]' : ''
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <h3 className="my-2 font-bold text-sm text-[#ffffff] line-clamp-2 leading-snug">
                      {ev.programme.title}
                    </h3>
                  )}

                  {isLive && (
                    <div className="my-1.5 w-full bg-[#1e293b] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-[#ef4444] to-[#f43f5e] h-full transition-all duration-500 rounded-full"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  )}

                  {/* Diffuseurs TV & Satellites (Filtrés selon les bouquets ou tous les diffuseurs) */}
                  {(() => {
                    const matchingAirings = ev.airings.filter((a) =>
                      isBroadcasterMatchingBouquets(
                        a.channel.displayName,
                        a.channel.orbitalPosition || '',
                        selectedBouquets,
                        channelByName,
                        activeLang
                      )
                    );
                    const nonMatchingAirings = ev.airings.filter(
                      (a) => !matchingAirings.some((m) => m.channel.displayName === a.channel.displayName)
                    );
                    const isAllScope = broadcasterScope === 'all';
                    const displayedAirings = isAllScope
                      ? [...matchingAirings, ...nonMatchingAirings]
                      : matchingAirings;

                    return (
                      <div className="mt-3 pt-2.5 border-t border-[#1e293b]">
                        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                          <span className="text-[10px] text-[#64748b] font-medium block uppercase tracking-wider">
                            {activeLang === 'ar'
                              ? `يبث على (${toStandardDigits(displayedAirings.length)} ${isAllScope ? 'قناة · كل الأقمار' : 'قناة في باقاتك'})`
                              : `Diffusé sur (${displayedAirings.length} ${isAllScope ? 'chaîne(s) · Tous satellites' : 'chaîne(s) dans vos bouquets'})`}
                          </span>
                          {!isAllScope && nonMatchingAirings.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setBroadcasterScope('all')}
                              className="text-[10px] text-[#38bdf8] hover:text-[#ffffff] transition-colors cursor-pointer"
                            >
                              {activeLang === 'ar'
                                ? `+${toStandardDigits(nonMatchingAirings.length)} أخرى (متعدد الأقمار)`
                                : `+${nonMatchingAirings.length} autre${nonMatchingAirings.length > 1 ? 's' : ''} (Multi-Sat)`}
                            </button>
                          )}
                        </div>

                        {displayedAirings.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {displayedAirings.map((airing) => {
                              const isMyBouquet = matchingAirings.includes(airing);
                              const isLoadedInGuide = channelByName.has(
                                airing.channel.displayName.toLowerCase().trim()
                              );
                              return (
                                <button
                                  key={`${airing.channel.id}-${airing.channel.displayName}`}
                                  type="button"
                                  onClick={() => onSelectChannel(airing.channel, airing.programme)}
                                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer group/ch border ${
                                    isLoadedInGuide
                                      ? 'bg-[#141c2c] hover:bg-[#2563eb]/25 border-[#2563eb]/60 hover:border-[#2563eb]'
                                      : isMyBouquet
                                      ? 'bg-[#141c2c] hover:bg-[#1e293b] border-[#1e293b] hover:border-[#38bdf8]'
                                      : 'bg-[#0f1422]/60 hover:bg-[#141c2c] border-[#1e293b]/70 opacity-80 hover:opacity-100'
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      airing.isFree ? 'bg-[#38bdf8]' : 'bg-[#ef4444]'
                                    }`}
                                  />
                                  <span className="text-[#f1f5f9] font-medium group-hover/ch:text-[#ffffff]">
                                    {airing.channel.displayName}
                                  </span>
                                  {isLoadedInGuide && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-[#2563eb]/20 text-[#38bdf8] font-mono">
                                      {activeLang === 'ar' ? 'دليل القنوات' : 'Guide TV'}
                                    </span>
                                  )}
                                  <span className="text-[9px] text-[#64748b] font-mono">
                                    {airing.isFree
                                      ? (activeLang === 'ar' ? 'مفتوح' : 'Clair')
                                      : (activeLang === 'ar' ? 'مشفر' : 'Crypté')}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#141c2c]/70 border border-[#1e293b] text-xs text-[#94a3b8]">
                            <span className="truncate">
                              {activeLang === 'ar'
                                ? `يبث خارج باقاتك (${toStandardDigits(ev.airings.length)} قنوات فضائية دولية)`
                                : `Diffusé hors de vos bouquets (${ev.airings.length} diffuseurs internationaux)`}
                            </span>
                            <button
                              type="button"
                              onClick={() => setBroadcasterScope('all')}
                              className="px-2 py-0.5 rounded bg-[#1e293b] hover:bg-[#2563eb] text-[11px] font-semibold text-[#cbd5e1] hover:text-[#ffffff] transition-colors shrink-0 cursor-pointer"
                            >
                              {activeLang === 'ar' ? 'عرض' : 'Voir'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </article>
              );
            })}
          </div>
        );
      })()}

      {/* 6. LECTEUR VIDÉO 100% IN-APP */}
      {activePlayer && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setActivePlayer(null)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-md animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full ${
              isFullscreen ? 'max-w-none h-full' : 'max-w-4xl'
            } flex flex-col rounded-2xl border border-[#334155] bg-[#090d16] p-4 sm:p-5 shadow-2xl space-y-3.5 transition-all duration-200`}
          >
            {/* Header du lecteur */}
            <div className="flex items-center justify-between border-b border-[#1e293b] pb-3">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className="p-1.5 rounded-lg bg-[#7c3aed]/20 text-[#a855f7] shrink-0">
                  <Play className="w-4 h-4 fill-current" />
                </span>
                <div className="overflow-hidden">
                  <h3 className="font-bold text-sm text-[#ffffff] truncate">
                    {activePlayer.title}
                  </h3>
                  <p className="text-[11px] text-[#94a3b8] truncate">
                    {activeLang === 'ar' ? 'القناة الرسمية :' : 'Chaîne officielle :'} <strong className="text-[#38bdf8]">{activePlayer.channelName}</strong> · {activeLang === 'ar' ? 'مشغّل مدمج PulseEPG' : 'Lecture intégrée PulseEPG'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFullscreen((prev) => !prev)}
                  title={isFullscreen ? (activeLang === 'ar' ? 'تصغير' : 'Réduire') : (activeLang === 'ar' ? 'ملء الشاشة' : 'Plein écran')}
                  className="p-1.5 rounded-lg text-[#94a3b8] hover:text-[#ffffff] hover:bg-[#1e293b] transition-colors cursor-pointer"
                >
                  {isFullscreen ? (
                    <Minimize2 className="w-4 h-4" />
                  ) : (
                    <Maximize2 className="w-4 h-4" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActivePlayer(null);
                    setIsFullscreen(false);
                  }}
                  title={activeLang === 'ar' ? 'إغلاق المشغّل' : 'Fermer le lecteur'}
                  className="p-1.5 rounded-lg text-[#94a3b8] hover:text-[#ffffff] hover:bg-[#ef4444]/20 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Iframe vidéo in-app */}
            <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black border border-[#1e293b] shadow-inner">
              <iframe
                key={activePlayer.videoId}
                className="w-full h-full"
                src={`https://www.youtube-nocookie.com/embed/${activePlayer.videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1&enablejsapi=1`}
                title={activePlayer.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>

            {/* Résumés alternatifs */}
            {activePlayer.alternateVideos && activePlayer.alternateVideos.length > 0 && (
              <div className="pt-2 border-t border-[#1e293b]">
                <span className="text-[11px] text-[#94a3b8] font-semibold mb-2 block">
                  {activeLang === 'ar' ? 'ملخصات وزوايا أخرى للمباراة :' : 'Autres résumés & perspectives de la rencontre :'}
                </span>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {activePlayer.alternateVideos.map((alt) => (
                    <button
                      key={alt.id}
                      type="button"
                      onClick={() =>
                        setActivePlayer((prev) =>
                          prev
                            ? {
                                ...prev,
                                videoId: alt.id,
                                title: alt.title,
                                channelName: alt.channel,
                              }
                            : null
                        )
                      }
                      className="flex items-center gap-2 p-1.5 pe-3 rounded-lg bg-[#141c2c] hover:bg-[#7c3aed]/20 border border-[#1e293b] hover:border-[#7c3aed] text-left shrink-0 transition-all cursor-pointer group"
                    >
                      <img
                        src={`https://i.ytimg.com/vi/${alt.id}/hqdefault.jpg`}
                        alt={alt.title}
                        className="w-12 h-8 rounded object-cover"
                      />
                      <div className="max-w-[170px]">
                        <p className="text-[11px] font-bold text-[#ffffff] group-hover:text-[#c084fc] truncate">
                          {alt.title}
                        </p>
                        <p className="text-[10px] text-[#94a3b8] truncate">
                          {alt.channel}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
