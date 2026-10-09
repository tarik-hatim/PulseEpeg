import {
  AppLanguage,
  BouquetFilter,
  ChannelCountryFilter,
  ChannelGroup,
  ContentCategoryFilter,
  CountryCode,
  EpgBouquetId,
  SatelliteFilter,
  ThematicCategoryId,
} from '../types/epg';

export interface LanguageOption {
  code: AppLanguage;
  flag: string;
  label: string;
  shortLabel: string;
  tmdbLocale: string;
  intlLocale: string;
  wikiLang: string;
  itunesCountry: string;
  translateTarget: string;
  dir: 'ltr' | 'rtl';
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    code: 'fr',
    flag: '🇫🇷',
    label: 'Français (FR)',
    shortLabel: 'FR',
    tmdbLocale: 'fr-FR',
    intlLocale: 'fr-FR',
    wikiLang: 'fr',
    itunesCountry: 'fr',
    translateTarget: 'fr',
    dir: 'ltr',
  },
  {
    code: 'en',
    flag: '🇬🇧',
    label: 'English (EN)',
    shortLabel: 'EN',
    tmdbLocale: 'en-US',
    intlLocale: 'en-US',
    wikiLang: 'en',
    itunesCountry: 'us',
    translateTarget: 'en',
    dir: 'ltr',
  },
  {
    code: 'ar',
    flag: '🇦🇪',
    label: 'العربية (AR)',
    shortLabel: 'AR',
    tmdbLocale: 'ar-SA',
    intlLocale: 'ar-AE',
    wikiLang: 'ar',
    itunesCountry: 'sa',
    translateTarget: 'ar',
    dir: 'rtl',
  },
  {
    code: 'es',
    flag: '🇪🇸',
    label: 'Español (EU)',
    shortLabel: 'ES (EU)',
    tmdbLocale: 'es-ES',
    intlLocale: 'es-ES',
    wikiLang: 'es',
    itunesCountry: 'es',
    translateTarget: 'es',
    dir: 'ltr',
  },
  {
    code: 'es_latam',
    flag: '🌎',
    label: 'Español (Latino)',
    shortLabel: 'ES (Latino)',
    tmdbLocale: 'es-MX',
    intlLocale: 'es-419',
    wikiLang: 'es',
    itunesCountry: 'mx',
    translateTarget: 'es',
    dir: 'ltr',
  },
  {
    code: 'de',
    flag: '🇩🇪',
    label: 'Deutsch (DE)',
    shortLabel: 'DE',
    tmdbLocale: 'de-DE',
    intlLocale: 'de-DE',
    wikiLang: 'de',
    itunesCountry: 'de',
    translateTarget: 'de',
    dir: 'ltr',
  },
  {
    code: 'pt',
    flag: '🇵🇹',
    label: 'Português (EU)',
    shortLabel: 'PT (EU)',
    tmdbLocale: 'pt-PT',
    intlLocale: 'pt-PT',
    wikiLang: 'pt',
    itunesCountry: 'pt',
    translateTarget: 'pt',
    dir: 'ltr',
  },
  {
    code: 'pt_br',
    flag: '🇧🇷',
    label: 'Português (Latino / Brasil)',
    shortLabel: 'PT (Brasil)',
    tmdbLocale: 'pt-BR',
    intlLocale: 'pt-BR',
    wikiLang: 'pt',
    itunesCountry: 'br',
    translateTarget: 'pt',
    dir: 'ltr',
  },
  {
    code: 'it',
    flag: '🇮🇹',
    label: 'Italiano (IT)',
    shortLabel: 'IT',
    tmdbLocale: 'it-IT',
    intlLocale: 'it-IT',
    wikiLang: 'it',
    itunesCountry: 'it',
    translateTarget: 'it',
    dir: 'ltr',
  },
  {
    code: 'tr',
    flag: '🇹🇷',
    label: 'Türkçe (TR)',
    shortLabel: 'TR',
    tmdbLocale: 'tr-TR',
    intlLocale: 'tr-TR',
    wikiLang: 'tr',
    itunesCountry: 'tr',
    translateTarget: 'tr',
    dir: 'ltr',
  },
  {
    code: 'nl',
    flag: '🇳🇱',
    label: 'Nederlands (NL)',
    shortLabel: 'NL',
    tmdbLocale: 'nl-NL',
    intlLocale: 'nl-NL',
    wikiLang: 'nl',
    itunesCountry: 'nl',
    translateTarget: 'nl',
    dir: 'ltr',
  },
];

export const SUPPORTED_LANGUAGES = LANGUAGE_OPTIONS;

let currentActiveLanguage: AppLanguage = 'fr';

export function getActiveLanguage(): AppLanguage {
  return currentActiveLanguage;
}

export function setActiveLanguage(lang: AppLanguage): void {
  try {
    const safeLang: AppLanguage = LANGUAGE_OPTIONS.some((l) => l.code === lang)
      ? lang
      : 'fr';
    currentActiveLanguage = safeLang;
    if (typeof document !== 'undefined' && document.documentElement) {
      const opt = getLanguageOption(safeLang);
      document.documentElement.lang = opt.code === 'pt' ? 'pt-BR' : opt.code;
      document.documentElement.dir = opt.dir;
    }
  } catch {
    currentActiveLanguage = 'fr';
  }
}

export function applyDocumentLanguageDir(lang: AppLanguage): void {
  try {
    setActiveLanguage(lang);
  } catch {
    // Ignore DOM attribute errors on legacy WebViews
  }
}

export function getLanguageOption(lang?: AppLanguage): LanguageOption {
  try {
    const target = lang || currentActiveLanguage;
    return (
      LANGUAGE_OPTIONS.find((l) => l.code === target) || LANGUAGE_OPTIONS[0]
    );
  } catch {
    return LANGUAGE_OPTIONS[0];
  }
}

export interface Translations {
  appSubtitle: string;
  liveTab: string;
  gridTab: string;
  favoritesTab: string;
  sourcesTab: string;
  refreshBtn: string;
  refreshingBtn: string;
  settingsTitle: string;
  installApp: string;
  pwaActive: string;
  searchPlaceholder: string;
  presetMinus1h: string;
  presetNow: string;
  presetPrime: string;
  presetPlus1h: string;
  filterCatLabel: string;
  filterSatLabel: string;
  filterBouquetLabel: string;
  filterZoneLabel: string;
  filterCountryLabel?: string;
  filterGenreLabel: string;
  resetFiltersBtn: string;
  channelsDisplayed: string;
  activeProgrammes: string;
  noChannelsFoundTitle: string;
  noChannelsFoundDesc: string;
  showAllSatellitesBtn: string;
  loadMoreChannels: string;
  remainingLabel: string;
  liveBadge: string;
  slotBadge: string;
  upNext: string;
  unspecified: string;
  noProgramCommunicated: string;
  addToFavorites: string;
  removeFromFavorites: string;
  favLabel: string;
  close: string;
  ended: string;
  remainingPrefix: string;
  minUnit: string;
  badgeOriginalAudio: string;
  badgeSubtitles: string;
  badgeAudioStadium: string;
  badgeFootballLive: string;
  badgeVoEnglish: string;
  badgeSubDvb: string;
  modalOriginalTitle: string;
  modalReleaseDate: string;
  modalGenre: string;
  modalOrigin: string;
  modalNotProvided: string;
  modalInternationalProd: string;
  modalSummary: string;
  modalVerifiedSummary: string;
  modalNoDescription: string;
  modalDirectedBy: string;
  modalCast: string;
  officialSheet: string;
  hdPoster: string;
  syncingTmdb: string;
  liveBroadcast: string;
  reminderActive: string;
  reminderBtn: string;
  cancelReminder: string;
  remindProgram: string;
  startedAt: string;
  endsAt: string;
  yesterday: string;
  today: string;
  tomorrow: string;
  allDay: string;
  morning: string;
  afternoon: string;
  eveningPrime: string;
  noProgramForSlot: string;
  selectAnotherDayOrRefresh: string;
  emissionsAvailable: string;
  voPrefix: string;
  activeChannelsOnGrid: string;
  gridChannelHeader: string;
  gridVoSubHeader: string;
  workerTitle: string;
  workerStreams: string;
  workerChannelsCount: string;
  workerProgrammesCount: string;
  settingsModalTitle: string;
  settingsModalSubtitle: string;
  tabBouquetsFilters: string;
  tabXmltvCache: string;
  tabLegalPlayStore: string;
  languageSectionTitle: string;
  languageSectionDesc: string;
  bouquetsSectionTitle: string;
  bouquetsSectionDesc: string;
  enableAllBouquets: string;
  thematicCategoriesTitle: string;
  thematicCategoriesDesc: string;
  audioSubtitlesTitle: string;
  excludePolishLektorTitle: string;
  excludePolishLektorDesc: string;
  requireSubtitlesTitle: string;
  requireSubtitlesDesc: string;
  cacheIndexedDbTitle: string;
  noCacheStored: string;
  autoRefresh12h: string;
  clearCacheBtn: string;
  xmltvSourcesActiveTitle: string;
  restoreDefaultCatalog: string;
  addCustomXmltvTitle: string;
  sourceNamePlaceholder: string;
  addSourceBtn: string;
  cancelBtn: string;
  saveBtn: string;
  saveAndApplyBtn: string;
  updatedAtLabel: string;
  channelsCountLabel: string;
  programmesCountLabel: string;
  legalTmdbTitle: string;
  legalTmdbNotice: string;
  legalNonStreamingTitle: string;
  legalNonStreamingClause: string;
  legalPrivacyTitle: string;
  legalPrivacyDesc: string;
  pwaModalTitle: string;
  pwaModalDesc: string;
  pwaAndroidStep: string;
  pwaIosStep: string;
  pwaPcStep: string;
  understood: string;
  savedRemindersTitle: string;
}

const TRANSLATIONS: Partial<Record<AppLanguage, Translations>> & {
  fr: Translations;
  en: Translations;
} = {
  fr: {
    appSubtitle:
      'Guide TV Global · Satellites Monde · Films/Séries & Sport Live',
    liveTab: 'En Direct',
    gridTab: 'Grille TV',
    favoritesTab: 'Favoris',
    sourcesTab: 'Sources & APK',
    refreshBtn: 'Actualiser EPG',
    refreshingBtn: 'Sync...',
    settingsTitle: 'Paramètres & Satellites',
    installApp: 'Installer l’App',
    pwaActive: 'Mode App Actif',
    searchPlaceholder: 'Recherche (ex: Canal+, Dune, Real...)',
    presetMinus1h: '-1h',
    presetNow: 'Maintenant',
    presetPrime: 'Prime 20h45',
    presetPlus1h: '+1h',
    filterCatLabel: 'Catégorie :',
    filterSatLabel: 'Sat :',
    filterBouquetLabel: 'Bouquet :',
    filterZoneLabel: 'Zone :',
    filterGenreLabel: 'Genre :',
    resetFiltersBtn: 'Réinitialiser les filtres',
    channelsDisplayed: 'chaînes affichées sur',
    activeProgrammes: 'programmes actifs',
    noChannelsFoundTitle: 'Aucune chaîne ne correspond à vos filtres',
    noChannelsFoundDesc:
      'Essayez de sélectionner « Tous » dans la barre des satellites ou vérifiez vos bouquets cochés dans Paramètres.',
    showAllSatellitesBtn: 'Afficher tous les satellites',
    loadMoreChannels: 'Afficher plus de chaînes',
    remainingLabel: 'restantes',
    liveBadge: 'Direct',
    slotBadge: 'Créneau',
    upNext: 'À suivre',
    unspecified: 'Non renseigné',
    noProgramCommunicated: 'Aucun programme communiqué sur ce créneau',
    addToFavorites: 'Ajouter aux favoris',
    removeFromFavorites: 'Retirer des favoris',
    favLabel: 'Favori',
    close: 'Fermer',
    ended: 'Terminé',
    remainingPrefix: 'Reste',
    minUnit: 'min',
    badgeOriginalAudio: 'Audio VO Anglais / Original',
    badgeSubtitles: 'Sous-titres DVB / Teletext',
    badgeAudioStadium: 'Audio Stadium / Live',
    badgeFootballLive: 'Football En Direct',
    badgeVoEnglish: 'VO Anglais',
    badgeSubDvb: 'Sub DVB/TXT',
    modalOriginalTitle: 'Titre original :',
    modalReleaseDate: 'Date de sortie :',
    modalGenre: 'Genre :',
    modalOrigin: 'Origine :',
    modalNotProvided: 'Non communiquée',
    modalInternationalProd: 'Production internationale',
    modalSummary: 'Résumé du programme',
    modalVerifiedSummary: 'Synopsis officiel vérifié',
    modalNoDescription:
      'Aucune description communiquée pour cette diffusion.',
    modalDirectedBy: 'Réalisation :',
    modalCast: 'Avec :',
    officialSheet: 'Fiche Officielle',
    hdPoster: 'Affiche HD',
    syncingTmdb: 'Synchronisation TMDB...',
    liveBroadcast: 'En Direct',
    reminderActive: 'Rappel actif',
    reminderBtn: 'Rappel',
    cancelReminder: 'Annuler le rappel',
    remindProgram: 'M’alerter au début du programme',
    startedAt: 'Début',
    endsAt: 'Fin',
    yesterday: 'Hier',
    today: "Aujourd'hui",
    tomorrow: 'Demain',
    allDay: 'Toute la journée',
    morning: 'Matin (05h-12h)',
    afternoon: 'Après-midi (12h-19h)',
    eveningPrime: 'Soirée & Prime (19h-05h)',
    noProgramForSlot: 'Aucun programme pour cette tranche horaire',
    selectAnotherDayOrRefresh:
      'Sélectionnez un autre jour ou actualisez le flux XMLTV.',
    emissionsAvailable: 'émissions disponibles',
    voPrefix: 'VO :',
    activeChannelsOnGrid: 'chaînes actives',
    gridChannelHeader: 'Chaîne Satellite',
    gridVoSubHeader: 'VO + SUB',
    workerTitle: 'Web Worker XMLTV Multi-Flux',
    workerStreams: 'flux',
    workerChannelsCount: 'chaînes',
    workerProgrammesCount: 'prog.',
    settingsModalTitle: 'Paramètres & Couverture Mondiale EPG',
    settingsModalSubtitle:
      'Langues (i18n), Satellites & Bouquets mondiaux, Filtres VO/ST et Mentions légales Play Store',
    tabBouquetsFilters: 'Bouquets, Satellites & Langue',
    tabXmltvCache: 'Flux XMLTV & Cache',
    tabLegalPlayStore: 'À propos & Mentions Légales',
    languageSectionTitle: 'Langue de l’application & Métadonnées TMDB (i18n)',
    languageSectionDesc:
      'Traduit toute l’interface et charge les titres, résumés et affiches HD TMDB/TVMaze dans la langue choisie.',
    bouquetsSectionTitle: 'Couverture Globale des Satellites & Bouquets',
    bouquetsSectionDesc:
      'N’exécute le téléchargement et le parsing XMLTV en arrière-plan QUE pour les bouquets cochés.',
    enableAllBouquets: 'Tout cocher',
    thematicCategoriesTitle: 'Catégories Thématiques Actives',
    thematicCategoriesDesc:
      'Sélectionnez les thématiques de chaînes et programmes à conserver dans votre guide.',
    audioSubtitlesTitle: 'Filtres Audio VO & Sous-titres',
    excludePolishLektorTitle: 'Exclure le doublage « Lektor » Polonais',
    excludePolishLektorDesc:
      'Écarte automatiquement les chaînes et programmes polonais diffusés uniquement avec voix-off Lektor sans sous-titres.',
    requireSubtitlesTitle: 'Exiger Audio VO + Sous-titres DVB/Teletext',
    requireSubtitlesDesc:
      'Ne conserve que les chaînes Cinéma/Séries diffusant la piste originale avec sous-titres.',
    cacheIndexedDbTitle: 'Cache Local IndexedDB',
    noCacheStored: 'Aucun cache enregistré',
    autoRefresh12h: 'Auto-refresh 12h',
    clearCacheBtn: 'Vider le cache',
    xmltvSourcesActiveTitle: 'Sources XMLTV (.xml.gz) actives',
    restoreDefaultCatalog: 'Restaurer le catalogue par défaut',
    addCustomXmltvTitle: 'Ajouter un flux XMLTV (.xml / .xml.gz) personnalisé',
    sourceNamePlaceholder: 'Nom du bouquet (ex: Sky UK)',
    addSourceBtn: 'Ajouter la source',
    cancelBtn: 'Annuler',
    saveBtn: 'Enregistrer',
    saveAndApplyBtn: 'Enregistrer et appliquer',
    updatedAtLabel: 'MAJ',
    channelsCountLabel: 'chaînes',
    programmesCountLabel: 'programmes',
    legalTmdbTitle: 'Attribution Officielle TMDB & Métadonnées',
    legalTmdbNotice:
      'This product uses the TMDB API but is not endorsed or certified by TMDB. Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB. Les données complémentaires de séries proviennent de TVMaze API (CC BY-SA).',
    legalNonStreamingTitle:
      'Clause d’Agrégation d’Informations (Application Non-Stream)',
    legalNonStreamingClause:
      'PulseEPG est exclusivement un agrégateur de grilles horaires électroniques (EPG / XMLTV) et de métadonnées culturelles à but informatif. Cette application ne fournit, n’héberge, ne relaie et ne vend AUCUN flux vidéo ou audio (IPTV, m3u8, streaming en direct ou VOD).',
    legalPrivacyTitle: 'Protection des Données & Stockage Local',
    legalPrivacyDesc:
      'Vos préférences de langue, favoris, rappels et sélections de satellites sont stockés exclusivement en local sur votre appareil (LocalStorage & IndexedDB). Aucune donnée personnelle n’est collectée ni transmise à des tiers.',
    pwaModalTitle: 'Installer PulseEPG',
    pwaModalDesc:
      'Installez l’application sur votre écran d’accueil pour un lancement plein écran instantané et une consultation hors-ligne.',
    pwaAndroidStep:
      'Ouvrez le menu ⋮ du navigateur puis appuyez sur « Installer l’application ».',
    pwaIosStep:
      'Appuyez sur le bouton Partager puis sur « Sur l’écran d’accueil ».',
    pwaPcStep:
      'Cliquez sur l’icône d’installation dans la barre d’adresse à droite.',
    understood: 'Compris',
    savedRemindersTitle: 'Rappels de programmes enregistrés',
  },
  en: {
    appSubtitle:
      'Global TV Guide · World Satellites · Movies/Series & Live Sports',
    liveTab: 'Live Now',
    gridTab: 'TV Grid',
    favoritesTab: 'Favorites',
    sourcesTab: 'Sources & APK',
    refreshBtn: 'Refresh EPG',
    refreshingBtn: 'Syncing...',
    settingsTitle: 'Settings & Satellites',
    installApp: 'Install App',
    pwaActive: 'App Mode Active',
    searchPlaceholder: 'Search (e.g. Canal+, Dune, Real...)',
    presetMinus1h: '-1h',
    presetNow: 'Now',
    presetPrime: 'Prime 20:45',
    presetPlus1h: '+1h',
    filterCatLabel: 'Category:',
    filterSatLabel: 'Sat:',
    filterBouquetLabel: 'Bouquet:',
    filterZoneLabel: 'Zone:',
    filterGenreLabel: 'Genre:',
    resetFiltersBtn: 'Reset filters',
    channelsDisplayed: 'channels displayed out of',
    activeProgrammes: 'active programmes',
    noChannelsFoundTitle: 'No channels match your active filters',
    noChannelsFoundDesc:
      'Try selecting "All" in the satellite bar or check your enabled bouquets in Settings.',
    showAllSatellitesBtn: 'Show all satellites',
    loadMoreChannels: 'Load more channels',
    remainingLabel: 'remaining',
    liveBadge: 'Live',
    slotBadge: 'Slot',
    upNext: 'Up Next',
    unspecified: 'Not specified',
    noProgramCommunicated: 'No programme scheduled for this time slot',
    addToFavorites: 'Add to favorites',
    removeFromFavorites: 'Remove from favorites',
    favLabel: 'Favorite',
    close: 'Close',
    ended: 'Ended',
    remainingPrefix: 'Left:',
    minUnit: 'min',
    badgeOriginalAudio: 'Original Audio / VO',
    badgeSubtitles: 'DVB / Teletext Subtitles',
    badgeAudioStadium: 'Stadium / Live Audio',
    badgeFootballLive: 'Live Football',
    badgeVoEnglish: 'Original Audio',
    badgeSubDvb: 'DVB/TXT Sub',
    modalOriginalTitle: 'Original Title:',
    modalReleaseDate: 'Release Date:',
    modalGenre: 'Genre:',
    modalOrigin: 'Origin:',
    modalNotProvided: 'Not specified',
    modalInternationalProd: 'International Production',
    modalSummary: 'Programme Synopsis',
    modalVerifiedSummary: 'Verified Official Synopsis',
    modalNoDescription: 'No synopsis provided for this broadcast.',
    modalDirectedBy: 'Directed by:',
    modalCast: 'Cast:',
    officialSheet: 'Official Info',
    hdPoster: 'HD Poster',
    syncingTmdb: 'Syncing TMDB...',
    liveBroadcast: 'Live Now',
    reminderActive: 'Reminder Set',
    reminderBtn: 'Remind Me',
    cancelReminder: 'Cancel reminder',
    remindProgram: 'Notify me when programme starts',
    startedAt: 'Start',
    endsAt: 'End',
    yesterday: 'Yesterday',
    today: 'Today',
    tomorrow: 'Tomorrow',
    allDay: 'All Day',
    morning: 'Morning (05:00-12:00)',
    afternoon: 'Afternoon (12:00-19:00)',
    eveningPrime: 'Evening & Prime (19:00-05:00)',
    noProgramForSlot: 'No programmes for this time period',
    selectAnotherDayOrRefresh: 'Select another day or refresh the XMLTV feed.',
    emissionsAvailable: 'programmes available',
    voPrefix: 'Original:',
    activeChannelsOnGrid: 'active channels',
    gridChannelHeader: 'Satellite Channel',
    gridVoSubHeader: 'VO + SUB',
    workerTitle: 'Multi-Stream XMLTV Web Worker',
    workerStreams: 'streams',
    workerChannelsCount: 'channels',
    workerProgrammesCount: 'prog.',
    settingsModalTitle: 'Settings & Global Satellite Coverage',
    settingsModalSubtitle:
      'Languages (i18n), Global Satellites & Bouquets, Audio/Subtitle Filters & Play Store Legal Notices',
    tabBouquetsFilters: 'Bouquets, Satellites & Language',
    tabXmltvCache: 'XMLTV Feeds & Cache',
    tabLegalPlayStore: 'About & Legal Notices',
    languageSectionTitle: 'Application Language & TMDB Metadata (i18n)',
    languageSectionDesc:
      'Translates the entire interface and fetches localized titles, synopses, and HD posters from TMDB/TVMaze.',
    bouquetsSectionTitle: 'Global Satellites & Bouquets Coverage',
    bouquetsSectionDesc:
      'Downloads and parses XMLTV feeds in the background ONLY for checked bouquets.',
    enableAllBouquets: 'Select All',
    thematicCategoriesTitle: 'Active Thematic Categories',
    thematicCategoriesDesc:
      'Choose the channel and programme categories to include in your TV guide.',
    audioSubtitlesTitle: 'Original Audio & Subtitles Filters',
    excludePolishLektorTitle: 'Exclude Polish "Lektor" Voice-over',
    excludePolishLektorDesc:
      'Automatically filters out Polish channels and broadcasts with single-voice Lektor dubbing and no subtitles.',
    requireSubtitlesTitle: 'Require Original Audio + DVB/Teletext Subtitles',
    requireSubtitlesDesc:
      'Keeps only Movies/Series channels broadcasting original audio tracks with subtitles.',
    cacheIndexedDbTitle: 'Local IndexedDB Cache',
    noCacheStored: 'No cache stored',
    autoRefresh12h: 'Auto-refresh 12h',
    clearCacheBtn: 'Clear Cache',
    xmltvSourcesActiveTitle: 'Active XMLTV (.xml.gz) Sources',
    restoreDefaultCatalog: 'Restore default catalog',
    addCustomXmltvTitle: 'Add a custom XMLTV (.xml / .xml.gz) stream',
    sourceNamePlaceholder: 'Bouquet name (e.g. Sky UK)',
    addSourceBtn: 'Add source',
    cancelBtn: 'Cancel',
    saveBtn: 'Save',
    saveAndApplyBtn: 'Save and Apply',
    updatedAtLabel: 'Updated',
    channelsCountLabel: 'channels',
    programmesCountLabel: 'programmes',
    legalTmdbTitle: 'Official TMDB Attribution & Metadata',
    legalTmdbNotice:
      'This product uses the TMDB API but is not endorsed or certified by TMDB. Additional TV series metadata is provided by the TVMaze API (CC BY-SA).',
    legalNonStreamingTitle:
      'Non-Streaming Information Aggregation Clause',
    legalNonStreamingClause:
      'PulseEPG is strictly an Electronic Program Guide (EPG / XMLTV) and cultural metadata aggregator for informational purposes only. This application does NOT provide, host, relay, or sell any video or audio streams (no IPTV, m3u8, live streaming, or VOD).',
    legalPrivacyTitle: 'Data Privacy & Local Storage',
    legalPrivacyDesc:
      'Your language preferences, favorite channels, reminders, and satellite selections are stored exclusively locally on your device (LocalStorage & IndexedDB). No personal data is collected or shared with third parties.',
    pwaModalTitle: 'Install PulseEPG',
    pwaModalDesc:
      'Install the app on your home screen for instant full-screen launch and offline access.',
    pwaAndroidStep:
      'Open the browser ⋮ menu and tap "Install app" or "Add to Home screen".',
    pwaIosStep: 'Tap the Share button and select "Add to Home Screen".',
    pwaPcStep: 'Click the install icon on the right side of the address bar.',
    understood: 'Got it',
    savedRemindersTitle: 'Saved programme reminders',
  },
  ar: {
    appSubtitle:
      'دليل التلفزيون العالمي · الأقمار الصناعية · أفلام ومسلسلات ورياضة مباشرة',
    liveTab: 'مباشر الآن',
    gridTab: 'شبكة البرامج',
    favoritesTab: 'المفضلة',
    sourcesTab: 'المصادر و APK',
    refreshBtn: 'تحديث الدليل',
    refreshingBtn: 'جاري التحديث...',
    settingsTitle: 'الإعدادات والأقمار الصناعية',
    installApp: 'تثبيت التطبيق',
    pwaActive: 'وضع التطبيق مفعل',
    searchPlaceholder: 'بحث (مثل: Canal+, Dune, Real...)',
    presetMinus1h: '-1 سا',
    presetNow: 'الآن',
    presetPrime: 'السهرة 20:45',
    presetPlus1h: '+1 سا',
    filterCatLabel: 'الفئة :',
    filterSatLabel: 'القمر :',
    filterBouquetLabel: 'الباقة :',
    filterZoneLabel: 'المنطقة :',
    filterGenreLabel: 'النوع :',
    resetFiltersBtn: 'إعادة ضبط الفلاتر',
    channelsDisplayed: 'قناة معروضة من أصل',
    activeProgrammes: 'برنامج نشط',
    noChannelsFoundTitle: 'لا توجد قنوات تطابق الفلاتر المحددة',
    noChannelsFoundDesc:
      'جرب اختيار "الكل" في شريط الأقمار الصناعية أو تحقق من الباقات المفعلة في الإعدادات.',
    showAllSatellitesBtn: 'عرض جميع الأقمار الصناعية',
    loadMoreChannels: 'عرض المزيد من القنوات',
    remainingLabel: 'متبقية',
    liveBadge: 'مباشر',
    slotBadge: 'فترة',
    upNext: 'التالي',
    unspecified: 'غير محدد',
    noProgramCommunicated: 'لا يوجد برنامج مدرج في هذه الفترة الزمنية',
    addToFavorites: 'إضافة إلى المفضلة',
    removeFromFavorites: 'إزالة من المفضلة',
    favLabel: 'مفضلة',
    close: 'إغلاق',
    ended: 'انتهى',
    remainingPrefix: 'متبقي',
    minUnit: 'دقيقة',
    badgeOriginalAudio: 'صوت أصلي VO / متعدد',
    badgeSubtitles: 'ترجمة DVB / Teletext',
    badgeAudioStadium: 'صوت الملعب / مباشر',
    badgeFootballLive: 'كرة قدم مباشرة',
    badgeVoEnglish: 'صوت أصلي EN',
    badgeSubDvb: 'ترجمة DVB',
    modalOriginalTitle: 'العنوان الأصلي :',
    modalReleaseDate: 'تاريخ الإصدار :',
    modalGenre: 'Genre : النوع :',
    modalOrigin: 'Origine : بلد الإنتاج :',
    modalNotProvided: 'غير متوفر',
    modalInternationalProd: 'إنتاج دولي',
    modalSummary: 'ملخص البرنامج',
    modalVerifiedSummary: 'ملخص رسمي موثق',
    modalNoDescription: 'لا يوجد وصف متاح لهذا البث.',
    modalDirectedBy: 'إخراج :',
    modalCast: 'بطولة :',
    officialSheet: 'بطاقة رسمية',
    hdPoster: 'ملصق HD',
    syncingTmdb: 'مزامنة TMDB...',
    liveBroadcast: 'يبث الآن',
    reminderActive: 'التذكير مفعل',
    reminderBtn: 'تذكير',
    cancelReminder: 'إلغاء التذكير',
    remindProgram: 'تنبيهي عند بدء البرنامج',
    startedAt: 'البداية',
    endsAt: 'النهاية',
    yesterday: 'أمس',
    today: 'اليوم',
    tomorrow: 'غداً',
    allDay: 'طوال اليوم',
    morning: 'الصباح (05:00-12:00)',
    afternoon: 'بعد الظهر (12:00-19:00)',
    eveningPrime: 'المساء والسهرة (19:00-05:00)',
    noProgramForSlot: 'لا توجد برامج في هذه الفترة الزمنية',
    selectAnotherDayOrRefresh: 'اختر يوماً آخر أو قم بتحديث بيانات XMLTV.',
    emissionsAvailable: 'برنامج متاح',
    voPrefix: 'الأصلي :',
    activeChannelsOnGrid: 'قناة نشطة',
    gridChannelHeader: 'القناة الفضائية',
    gridVoSubHeader: 'VO + ترجمة',
    workerTitle: 'معالج XMLTV متعدد المصادر',
    workerStreams: 'مصادر',
    workerChannelsCount: 'قناة',
    workerProgrammesCount: 'برنامج',
    settingsModalTitle: 'الإعدادات والتغطية العالمية للأقمار الصناعية',
    settingsModalSubtitle:
      'اللغات (i18n + RTL)، الأقمار الصناعية والباقات العالمية، فلاتر الصوت والترجمة، والإشعارات القانونية لمتجر Play',
    tabBouquetsFilters: 'الباقات والأقمار واللغة',
    tabXmltvCache: 'مصادر XMLTV والذاكرة المؤقتة',
    tabLegalPlayStore: 'حول التطبيق والإشعارات القانونية',
    languageSectionTitle: 'لغة التطبيق وبيانات TMDB (i18n)',
    languageSectionDesc:
      'يترجم واجهة التطبيق بالكامل مع دعم الاتجاه من اليمين إلى اليسار (RTL) وجلب الملخصات والملصقات بلغة الاختيار.',
    bouquetsSectionTitle: 'التغطية العالمية للأقمار الصناعية والباقات',
    bouquetsSectionDesc:
      'يتم تنزيل وتحليل ملفات XMLTV في الخلفية فقط للباقات المحددة لتوفير الذاكرة.',
    enableAllBouquets: 'تحديد الكل',
    thematicCategoriesTitle: 'الفئات الموضوعية النشطة',
    thematicCategoriesDesc: 'اختر فئات القنوات والبرامج التي ترغب في إظهارها.',
    audioSubtitlesTitle: 'فلاتر الصوت الأصلي والترجمة',
    excludePolishLektorTitle: 'استبعاد الدبلجة البولندية الأحادية (Lektor)',
    excludePolishLektorDesc:
      'يستبعد تلقائياً القنوات والبرامج التي تحتوي فقط على تعليق صوتي بولندي بدون ترجمة.',
    requireSubtitlesTitle: 'اشتراط الصوت الأصلي + ترجمة DVB/Teletext',
    requireSubtitlesDesc:
      'الإبقاء فقط على قنوات الأفلام والمسلسلات التي تبث بالصوت الأصلي مع الترجمة.',
    cacheIndexedDbTitle: 'الذاكرة المحلية المؤقتة IndexedDB',
    noCacheStored: 'لا توجد ذاكرة مخزنة',
    autoRefresh12h: 'تحديث تلقائي كل 12 ساعة',
    clearCacheBtn: 'مسح الذاكرة المؤقتة',
    xmltvSourcesActiveTitle: 'مصادر XMLTV (.xml.gz) النشطة',
    restoreDefaultCatalog: 'استعادة القائمة الافتراضية',
    addCustomXmltvTitle: 'إضافة رابط XMLTV (.xml / .xml.gz) مخصص',
    sourceNamePlaceholder: 'اسم الباقة (مثال: OSN)',
    addSourceBtn: 'إضافة المصدر',
    cancelBtn: 'إلغاء',
    saveBtn: 'حفظ',
    saveAndApplyBtn: 'حفظ وتطبيق',
    updatedAtLabel: 'تحديث',
    channelsCountLabel: 'قناة',
    programmesCountLabel: 'برنامج',
    legalTmdbTitle: 'إشعار attribution الرسمي لـ TMDB',
    legalTmdbNotice:
      'This product uses the TMDB API but is not endorsed or certified by TMDB. يستخدم هذا المنتج واجهة برمجة تطبيقات TMDB ولكنه غير معتمد أو مصدق من قبل TMDB.',
    legalNonStreamingTitle: 'بيان تجميع المعلومات فقط (بدون بث فيديو)',
    legalNonStreamingClause:
      'تطبيق PulseEPG هو دليل إلكتروني لبرامج التلفزيون (EPG / XMLTV) ومجمع للبيانات الثقافية لأغراض إعلامية بحتة. لا يقدم هذا التطبيق ولا يستضيف ولا يبث أي قنوات أو تدفقات فيديو أو صوت (لا يحتوي على IPTV أو بث مباشر).',
    legalPrivacyTitle: 'الخصوصية والتخزين المحلي',
    legalPrivacyDesc:
      'يتم حفظ تفضيلات اللغة والقنوات المفضلة والتذكيرات محلياً على جهازك فقط. لا يتم جمع أو مشاركة أي بيانات شخصية.',
    pwaModalTitle: 'تثبيت تطبيق PulseEPG',
    pwaModalDesc:
      'ثبّت التطبيق على شاشتك الرئيسية للوصول السريع بملء الشاشة والعمل دون اتصال.',
    pwaAndroidStep: 'افتح قائمة المتصفح ⋮ ثم اضغط على "تثبيت التطبيق".',
    pwaIosStep: 'اضغط على زر المشاركة ثم اختر "إضافة إلى الشاشة الرئيسية".',
    pwaPcStep: 'انقر فوق أيقونة التثبيت في شريط العنوان.',
    understood: 'حسناً',
    savedRemindersTitle: 'تذكيرات البرامج المحفوظة',
  },
  es: {
    appSubtitle:
      'Guía TV Global · Satélites del Mundo · Cine/Series y Deporte en Vivo',
    liveTab: 'En Vivo',
    gridTab: 'Parrilla TV',
    favoritesTab: 'Favoritos',
    sourcesTab: 'Fuentes y APK',
    refreshBtn: 'Actualizar EPG',
    refreshingBtn: 'Sincronizando...',
    settingsTitle: 'Ajustes y Satélites',
    installApp: 'Instalar App',
    pwaActive: 'Modo App Activo',
    searchPlaceholder: 'Buscar (ej: Canal+, Dune, Real...)',
    presetMinus1h: '-1h',
    presetNow: 'Ahora',
    presetPrime: 'Prime 20:45',
    presetPlus1h: '+1h',
    filterCatLabel: 'Categoría:',
    filterSatLabel: 'Sat:',
    filterBouquetLabel: 'Operador:',
    filterZoneLabel: 'Zona:',
    filterGenreLabel: 'Género:',
    resetFiltersBtn: 'Restablecer filtros',
    channelsDisplayed: 'canales mostrados de',
    activeProgrammes: 'programas activos',
    noChannelsFoundTitle: 'Ningún canal coincide con los filtros activos',
    noChannelsFoundDesc:
      'Prueba a seleccionar "Todos" en la barra de satélites o revisa tus operadores marcados en Ajustes.',
    showAllSatellitesBtn: 'Mostrar todos los satélites',
    loadMoreChannels: 'Mostrar más canales',
    remainingLabel: 'restantes',
    liveBadge: 'En Vivo',
    slotBadge: 'Franja',
    upNext: 'A continuación',
    unspecified: 'No especificado',
    noProgramCommunicated: 'Sin programación comunicada en esta franja',
    addToFavorites: 'Añadir a favoritos',
    removeFromFavorites: 'Quitar de favoritos',
    favLabel: 'Favorito',
    close: 'Cerrar',
    ended: 'Finalizado',
    remainingPrefix: 'Quedan',
    minUnit: 'min',
    badgeOriginalAudio: 'Audio VO / Dual',
    badgeSubtitles: 'Subtítulos DVB / Teletexto',
    badgeAudioStadium: 'Audio Estadio / En Vivo',
    badgeFootballLive: 'Fútbol En Vivo',
    badgeVoEnglish: 'VO Inglés',
    badgeSubDvb: 'Sub DVB/TXT',
    modalOriginalTitle: 'Título original :',
    modalReleaseDate: 'Fecha de estreno :',
    modalGenre: 'Genre : Género :',
    modalOrigin: 'Origine : Origen :',
    modalNotProvided: 'No especificada',
    modalInternationalProd: 'Producción internacional',
    modalSummary: 'Sinopsis del programa',
    modalVerifiedSummary: 'Sinopsis oficial verificada',
    modalNoDescription: 'No hay descripción disponible para esta emisión.',
    modalDirectedBy: 'Dirección :',
    modalCast: 'Reparto :',
    officialSheet: 'Ficha Oficial',
    hdPoster: 'Póster HD',
    syncingTmdb: 'Sincronizando TMDB...',
    liveBroadcast: 'En Vivo',
    reminderActive: 'Recordatorio activo',
    reminderBtn: 'Recordar',
    cancelReminder: 'Cancelar recordatorio',
    remindProgram: 'Avisarme al empezar el programa',
    startedAt: 'Inicio',
    endsAt: 'Fin',
    yesterday: 'Ayer',
    today: 'Hoy',
    tomorrow: 'Mañana',
    allDay: 'Todo el día',
    morning: 'Mañana (05h-12h)',
    afternoon: 'Tarde (12h-19h)',
    eveningPrime: 'Noche y Prime (19h-05h)',
    noProgramForSlot: 'No hay programas para esta franja horaria',
    selectAnotherDayOrRefresh: 'Selecciona otro día o actualiza el flujo XMLTV.',
    emissionsAvailable: 'emisiones disponibles',
    voPrefix: 'VO :',
    activeChannelsOnGrid: 'canales activos',
    gridChannelHeader: 'Canal Satélite',
    gridVoSubHeader: 'VO + SUB',
    workerTitle: 'Web Worker XMLTV Multi-Flujo',
    workerStreams: 'flujos',
    workerChannelsCount: 'canales',
    workerProgrammesCount: 'prog.',
    settingsModalTitle: 'Ajustes y Cobertura Global de Satélites',
    settingsModalSubtitle:
      'Idiomas (i18n), Satélites y Operadores Globales, Filtros VO/Sub y Aviso Legal para Google Play Store',
    tabBouquetsFilters: 'Operadores, Satélites e Idioma',
    tabXmltvCache: 'Fuentes XMLTV y Caché',
    tabLegalPlayStore: 'Acerca de y Aviso Legal',
    languageSectionTitle: 'Idioma de la Aplicación y Metadatos TMDB (i18n)',
    languageSectionDesc:
      'Traduce toda la interfaz y carga títulos oficiales, sinopsis y pósters HD en el idioma seleccionado.',
    bouquetsSectionTitle: 'Cobertura Global de Satélites y Operadores',
    bouquetsSectionDesc:
      'Descarga y analiza en segundo plano ÚNICAMENTE los operadores seleccionados.',
    enableAllBouquets: 'Marcar todos',
    thematicCategoriesTitle: 'Categorías Temáticas Activas',
    thematicCategoriesDesc:
      'Selecciona las temáticas de canales y programas que deseas conservar en la guía.',
    audioSubtitlesTitle: 'Filtros de Audio Original y Subtítulos',
    excludePolishLektorTitle: 'Excluir doblaje polaco "Lektor"',
    excludePolishLektorDesc:
      'Descarta automáticamente canales y emisiones polacas con locución única sin subtítulos.',
    requireSubtitlesTitle: 'Exigir Audio VO + Subtítulos DVB/Teletexto',
    requireSubtitlesDesc:
      'Conserva solo canales de Cine/Series con pista de audio original y subtítulos.',
    cacheIndexedDbTitle: 'Caché Local IndexedDB',
    noCacheStored: 'Sin caché almacenada',
    autoRefresh12h: 'Auto-actualizar 12h',
    clearCacheBtn: 'Vaciar caché',
    xmltvSourcesActiveTitle: 'Fuentes XMLTV (.xml.gz) activas',
    restoreDefaultCatalog: 'Restaurar catálogo predeterminado',
    addCustomXmltvTitle: 'Añadir flujo XMLTV (.xml / .xml.gz) personalizado',
    sourceNamePlaceholder: 'Nombre del operador (ej: Movistar+)',
    addSourceBtn: 'Añadir fuente',
    cancelBtn: 'Cancelar',
    saveBtn: 'Guardar',
    saveAndApplyBtn: 'Guardar y aplicar',
    updatedAtLabel: 'Act.',
    channelsCountLabel: 'canales',
    programmesCountLabel: 'programas',
    legalTmdbTitle: 'Atribución Oficial TMDB y Metadatos',
    legalTmdbNotice:
      'This product uses the TMDB API but is not endorsed or certified by TMDB. Este producto utiliza la API de TMDB pero no está respaldado ni certificado por TMDB.',
    legalNonStreamingTitle:
      'Cláusula de Agregación de Información (Aplicación No-Stream)',
    legalNonStreamingClause:
      'PulseEPG es exclusivamente un agregador de guías electrónicas de programación (EPG / XMLTV) y metadatos culturales con fines informativos. Esta aplicación NO proporciona, aloja, retransmite ni vende ningún flujo de vídeo o audio (sin IPTV ni streaming).',
    legalPrivacyTitle: 'Privacidad de Datos y Almacenamiento Local',
    legalPrivacyDesc:
      'Tus preferencias de idioma, favoritos, recordatorios y satélites se guardan únicamente en tu dispositivo (LocalStorage e IndexedDB).',
    pwaModalTitle: 'Instalar PulseEPG',
    pwaModalDesc:
      'Instala la aplicación en tu pantalla de inicio para acceso rápido a pantalla completa y soporte offline.',
    pwaAndroidStep:
      'Abre el menú ⋮ del navegador y pulsa en "Instalar aplicación".',
    pwaIosStep:
      'Pulsa el botón Compartir y selecciona "Añadir a la pantalla de inicio".',
    pwaPcStep:
      'Haz clic en el icono de instalación en la barra de direcciones.',
    understood: 'Entendido',
    savedRemindersTitle: 'Recordatorios de programas guardados',
  },
  de: {
    appSubtitle:
      'Globaler TV-Guide · Weltweite Satelliten · Filme/Serien & Live-Sport',
    liveTab: 'Live TV',
    gridTab: 'TV-Programm',
    favoritesTab: 'Favoriten',
    sourcesTab: 'Quellen & APK',
    refreshBtn: 'EPG Aktualisieren',
    refreshingBtn: 'Synchronisiere...',
    settingsTitle: 'Einstellungen & Satelliten',
    installApp: 'App Installieren',
    pwaActive: 'App-Modus Aktiv',
    searchPlaceholder: 'Suche (z.B. Canal+, Dune, Real...)',
    presetMinus1h: '-1 Std',
    presetNow: 'Jetzt',
    presetPrime: 'Prime 20:45',
    presetPlus1h: '+1 Std',
    filterCatLabel: 'Kategorie:',
    filterSatLabel: 'Sat:',
    filterBouquetLabel: 'Anbieter:',
    filterZoneLabel: 'Region:',
    filterGenreLabel: 'Genre:',
    resetFiltersBtn: 'Filter zurücksetzen',
    channelsDisplayed: 'Sender angezeigt von',
    activeProgrammes: 'aktive Sendungen',
    noChannelsFoundTitle: 'Keine Sender entsprechen Ihren Filtern',
    noChannelsFoundDesc:
      'Wählen Sie „Alle“ in der Satellitenleiste oder prüfen Sie Ihre aktivierten Bouquets in den Einstellungen.',
    showAllSatellitesBtn: 'Alle Satelliten anzeigen',
    loadMoreChannels: 'Mehr Sender anzeigen',
    remainingLabel: 'verbleibend',
    liveBadge: 'Live',
    slotBadge: 'Zeitfenster',
    upNext: 'Danach',
    unspecified: 'Keine Angabe',
    noProgramCommunicated: 'Kein Programm für dieses Zeitfenster gemeldet',
    addToFavorites: 'Zu Favoriten hinzufügen',
    removeFromFavorites: 'Aus Favoriten entfernen',
    favLabel: 'Favorit',
    close: 'Schließen',
    ended: 'Beendet',
    remainingPrefix: 'Noch',
    minUnit: 'Min.',
    badgeOriginalAudio: 'Originalton VO / Zweikanal',
    badgeSubtitles: 'DVB / Teletext Untertitel',
    badgeAudioStadium: 'Stadionton / Live',
    badgeFootballLive: 'Live-Fußball',
    badgeVoEnglish: 'Originalton EN',
    badgeSubDvb: 'DVB/TXT UT',
    modalOriginalTitle: 'Originaltitel :',
    modalReleaseDate: 'Erscheinungsdatum :',
    modalGenre: 'Genre :',
    modalOrigin: 'Origine / Herkunft :',
    modalNotProvided: 'Nicht angegeben',
    modalInternationalProd: 'Internationale Produktion',
    modalSummary: 'Programminhalt & Synopsis',
    modalVerifiedSummary: 'Verifizierte offizielle Synopsis',
    modalNoDescription: 'Keine Beschreibung für diese Sendung verfügbar.',
    modalDirectedBy: 'Regie :',
    modalCast: 'Besetzung :',
    officialSheet: 'Offizielles Datenblatt',
    hdPoster: 'HD-Poster',
    syncingTmdb: 'TMDB-Synchronisation...',
    liveBroadcast: 'Live auf Sendung',
    reminderActive: 'Erinnerung aktiv',
    reminderBtn: 'Erinnerung',
    cancelReminder: 'Erinnerung löschen',
    remindProgram: 'Bei Sendungsbeginn erinnern',
    startedAt: 'Beginn',
    endsAt: 'Ende',
    yesterday: 'Gestern',
    today: 'Heute',
    tomorrow: 'Morgen',
    allDay: 'Ganztägig',
    morning: 'Vormittag (05-12 Uhr)',
    afternoon: 'Nachmittag (12-19 Uhr)',
    eveningPrime: 'Abend & Prime (19-05 Uhr)',
    noProgramForSlot: 'Keine Sendungen für diesen Zeitraum',
    selectAnotherDayOrRefresh:
      'Wählen Sie einen anderen Tag oder aktualisieren Sie den XMLTV-Feed.',
    emissionsAvailable: 'Sendungen verfügbar',
    voPrefix: 'OV :',
    activeChannelsOnGrid: 'aktive Sender',
    gridChannelHeader: 'Satellitensender',
    gridVoSubHeader: 'OV + UT',
    workerTitle: 'Multi-Stream XMLTV Web Worker',
    workerStreams: 'Streams',
    workerChannelsCount: 'Sender',
    workerProgrammesCount: 'Send.',
    settingsModalTitle: 'Einstellungen & Weltweite Satellitenabdeckung',
    settingsModalSubtitle:
      'Sprachen (i18n), Weltweite Satelliten & Bouquets, OV/Untertitel-Filter & Play Store Rechtliche Hinweise',
    tabBouquetsFilters: 'Bouquets, Satelliten & Sprache',
    tabXmltvCache: 'XMLTV-Quellen & Cache',
    tabLegalPlayStore: 'Über & Rechtliche Hinweise',
    languageSectionTitle: 'App-Sprache & TMDB-Metadaten (i18n)',
    languageSectionDesc:
      'Übersetzt die gesamte Oberfläche und lädt offizielle Titel, Beschreibungen und HD-Poster in der gewählten Sprache.',
    bouquetsSectionTitle: 'Weltweite Satelliten- & Bouquet-Abdeckung',
    bouquetsSectionDesc:
      'Lädt und verarbeitet XMLTV-Feeds im Hintergrund NUR für ausgewählte Bouquets.',
    enableAllBouquets: 'Alle auswählen',
    thematicCategoriesTitle: 'Aktive Themenkategorien',
    thematicCategoriesDesc:
      'Wählen Sie die Sender- und Programmkategorien für Ihren TV-Guide.',
    audioSubtitlesTitle: 'Originalton- & Untertitel-Filter',
    excludePolishLektorTitle: 'Polnischen „Lektor“-Voiceover ausschließen',
    excludePolishLektorDesc:
      'Filtert polnische Sender und Sendungen ohne Untertitel automatisch heraus.',
    requireSubtitlesTitle: 'Originalton + DVB/Teletext-Untertitel erfordern',
    requireSubtitlesDesc:
      'Behält nur Film-/Seriensender mit Originaltonspur und Untertiteln.',
    cacheIndexedDbTitle: 'Lokaler IndexedDB-Cache',
    noCacheStored: 'Kein Cache gespeichert',
    autoRefresh12h: 'Auto-Refresh 12h',
    clearCacheBtn: 'Cache leeren',
    xmltvSourcesActiveTitle: 'Aktive XMLTV (.xml.gz) Quellen',
    restoreDefaultCatalog: 'Standardkatalog wiederherstellen',
    addCustomXmltvTitle: 'Benutzerdefinierten XMLTV-Stream hinzufügen',
    sourceNamePlaceholder: 'Bouquet-Name (z.B. Sky DE)',
    addSourceBtn: 'Quelle hinzufügen',
    cancelBtn: 'Abbrechen',
    saveBtn: 'Speichern',
    saveAndApplyBtn: 'Speichern und anwenden',
    updatedAtLabel: 'Stand',
    channelsCountLabel: 'Sender',
    programmesCountLabel: 'Sendungen',
    legalTmdbTitle: 'Offizielle TMDB-Quellenangabe & Metadaten',
    legalTmdbNotice:
      'This product uses the TMDB API but is not endorsed or certified by TMDB. Dieses Produkt nutzt die TMDB API, ist jedoch nicht von TMDB unterstützt oder zertifiziert.',
    legalNonStreamingTitle:
      'Hinweis zur reinen Informationsaggregation (Kein Streaming)',
    legalNonStreamingClause:
      'PulseEPG ist ausschließlich ein elektronischer Programmführer (EPG / XMLTV) und Metadaten-Aggregator zu Informationszwecken. Diese App bietet, hostet oder überträgt KEINE Video- oder Audiostreams (kein IPTV, kein Live-Streaming).',
    legalPrivacyTitle: 'Datenschutz & Lokale Speicherung',
    legalPrivacyDesc:
      'Ihre Spracheinstellungen, Favoriten, Erinnerungen und Satellitenauswahlen werden ausschließlich lokal auf Ihrem Gerät gespeichert.',
    pwaModalTitle: 'PulseEPG installieren',
    pwaModalDesc:
      'Installieren Sie die App auf Ihrem Startbildschirm für schnellen Vollbildzugriff und Offline-Unterstützung.',
    pwaAndroidStep:
      'Öffnen Sie das Browser-Menü ⋮ und tippen Sie auf „App installieren“.',
    pwaIosStep:
      'Tippen Sie auf „Teilen“ und anschließend auf „Zum Home-Bildschirm“.',
    pwaPcStep: 'Klicken Sie auf das Installationssymbol in der Adressleiste.',
    understood: 'Verstanden',
    savedRemindersTitle: 'Gespeicherte Programmerinnerungen',
  },
  pt: {
    appSubtitle:
      'Guia de TV Global · Satélites Mundiais · Filmes/Séries e Esportes ao Vivo',
    liveTab: 'Ao Vivo',
    gridTab: 'Grade de TV',
    favoritesTab: 'Favoritos',
    sourcesTab: 'Fontes e APK',
    refreshBtn: 'Atualizar EPG',
    refreshingBtn: 'Sincronizando...',
    settingsTitle: 'Configurações e Satélites',
    installApp: 'Instalar App',
    pwaActive: 'Modo App Ativo',
    searchPlaceholder: 'Buscar (ex: Canal+, Dune, Real...)',
    presetMinus1h: '-1h',
    presetNow: 'Agora',
    presetPrime: 'Prime 20:45',
    presetPlus1h: '+1h',
    filterCatLabel: 'Categoria:',
    filterSatLabel: 'Sat:',
    filterBouquetLabel: 'Operadora:',
    filterZoneLabel: 'Região:',
    filterGenreLabel: 'Gênero:',
    resetFiltersBtn: 'Redefinir filtros',
    channelsDisplayed: 'canais exibidos de',
    activeProgrammes: 'programas ativos',
    noChannelsFoundTitle: 'Nenhum canal corresponde aos filtros selecionados',
    noChannelsFoundDesc:
      'Tente selecionar "Todos" na barra de satélites ou verifique as operadoras marcadas em Configurações.',
    showAllSatellitesBtn: 'Mostrar todos os satélites',
    loadMoreChannels: 'Carregar mais canais',
    remainingLabel: 'restantes',
    liveBadge: 'Ao Vivo',
    slotBadge: 'Horário',
    upNext: 'A seguir',
    unspecified: 'Não informado',
    noProgramCommunicated: 'Nenhum programa informado neste horário',
    addToFavorites: 'Adicionar aos favoritos',
    removeFromFavorites: 'Remover dos favoritos',
    favLabel: 'Favorito',
    close: 'Fechar',
    ended: 'Encerrado',
    remainingPrefix: 'Restam',
    minUnit: 'min',
    badgeOriginalAudio: 'Áudio Original VO / Dual',
    badgeSubtitles: 'Legendas DVB / Closed Caption',
    badgeAudioStadium: 'Áudio Estádio / Ao Vivo',
    badgeFootballLive: 'Futebol Ao Vivo',
    badgeVoEnglish: 'Áudio Original',
    badgeSubDvb: 'Legendas DVB',
    modalOriginalTitle: 'Título original :',
    modalReleaseDate: 'Data de lançamento :',
    modalGenre: 'Genre : Gênero :',
    modalOrigin: 'Origine : Origem :',
    modalNotProvided: 'Não informada',
    modalInternationalProd: 'Produção internacional',
    modalSummary: 'Sinopse do programa',
    modalVerifiedSummary: 'Sinopse oficial verificada',
    modalNoDescription: 'Nenhuma descrição disponível para esta transmissão.',
    modalDirectedBy: 'Direção :',
    modalCast: 'Elenco :',
    officialSheet: 'Ficha Oficial',
    hdPoster: 'Pôster HD',
    syncingTmdb: 'Sincronizando TMDB...',
    liveBroadcast: 'Ao Vivo',
    reminderActive: 'Lembrete ativo',
    reminderBtn: 'Lembrar',
    cancelReminder: 'Cancelar lembrete',
    remindProgram: 'Avisar quando o programa começar',
    startedAt: 'Início',
    endsAt: 'Fim',
    yesterday: 'Ontem',
    today: 'Hoje',
    tomorrow: 'Amanhã',
    allDay: 'Dia inteiro',
    morning: 'Manhã (05h-12h)',
    afternoon: 'Tarde (12h-19h)',
    eveningPrime: 'Noite e Prime (19h-05h)',
    noProgramForSlot: 'Nenhum programa para esta faixa de horário',
    selectAnotherDayOrRefresh:
      'Selecione outro dia ou atualize o fluxo XMLTV.',
    emissionsAvailable: 'programas disponíveis',
    voPrefix: 'VO :',
    activeChannelsOnGrid: 'canais ativos',
    gridChannelHeader: 'Canal via Satélite',
    gridVoSubHeader: 'VO + LEG',
    workerTitle: 'Web Worker XMLTV Multi-Fluxo',
    workerStreams: 'fluxos',
    workerChannelsCount: 'canais',
    workerProgrammesCount: 'prog.',
    settingsModalTitle: 'Configurações e Cobertura Global de Satélites',
    settingsModalSubtitle:
      'Idiomas (i18n), Satélites e Operadoras Globais (Claro, Vivo, DirecTV, Sky, Europa/MENA) e Avisos Legais Play Store',
    tabBouquetsFilters: 'Operadoras, Satélites e Idioma',
    tabXmltvCache: 'Fontes XMLTV e Cache',
    tabLegalPlayStore: 'Sobre e Avisos Legais',
    languageSectionTitle: 'Idioma do Aplicativo e Metadados TMDB (i18n)',
    languageSectionDesc:
      'Traduz toda a interface e carrega títulos oficiais, sinopses e pôsteres HD no idioma selecionado.',
    bouquetsSectionTitle: 'Cobertura Global de Satélites e Operadoras',
    bouquetsSectionDesc:
      'Executa o download e análise XMLTV em segundo plano APENAS para as operadoras marcadas.',
    enableAllBouquets: 'Marcar todos',
    thematicCategoriesTitle: 'Categorias Temáticas Ativas',
    thematicCategoriesDesc:
      'Selecione as categorias de canais e programas que deseja manter no guia.',
    audioSubtitlesTitle: 'Filtros de Áudio Original e Legendas',
    excludePolishLektorTitle: 'Excluir dublagem polonesa "Lektor"',
    excludePolishLektorDesc:
      'Remove automaticamente canais poloneses transmitidos apenas com locução única sem legendas.',
    requireSubtitlesTitle: 'Exigir Áudio Original + Legendas DVB',
    requireSubtitlesDesc:
      'Mantém apenas canais de Filmes/Séries com áudio original e legendas.',
    cacheIndexedDbTitle: 'Cache Local IndexedDB',
    noCacheStored: 'Nenhum cache armazenado',
    autoRefresh12h: 'Auto-atualizar 12h',
    clearCacheBtn: 'Limpar cache',
    xmltvSourcesActiveTitle: 'Fontes XMLTV (.xml.gz) ativas',
    restoreDefaultCatalog: 'Restaurar catálogo padrão',
    addCustomXmltvTitle: 'Adicionar fluxo XMLTV (.xml / .xml.gz) personalizado',
    sourceNamePlaceholder: 'Nome da operadora (ex: Claro TV)',
    addSourceBtn: 'Adicionar fonte',
    cancelBtn: 'Cancelar',
    saveBtn: 'Salvar',
    saveAndApplyBtn: 'Salvar e aplicar',
    updatedAtLabel: 'Atual.',
    channelsCountLabel: 'canais',
    programmesCountLabel: 'programas',
    legalTmdbTitle: 'Atribuição Oficial TMDB e Metadados',
    legalTmdbNotice:
      'This product uses the TMDB API but is not endorsed or certified by TMDB. Este produto utiliza a API do TMDB, mas não é endossado ou certificado pelo TMDB.',
    legalNonStreamingTitle:
      'Cláusula de Agregação de Informações (Aplicativo Não-Streaming)',
    legalNonStreamingClause:
      'O PulseEPG é exclusivamente um agregador de guias eletrônicos de programação (EPG / XMLTV) e metadados culturais para fins informativos. Este aplicativo NÃO fornece, hospeda, retransmite nem vende nenhum fluxo de vídeo ou áudio (sem IPTV ou streaming).',
    legalPrivacyTitle: 'Privacidade de Dados e Armazenamento Local',
    legalPrivacyDesc:
      'Suas preferências de idioma, canais favoritos, lembretes e satélites selecionados são armazenados exclusivamente no seu dispositivo (LocalStorage e IndexedDB).',
    pwaModalTitle: 'Instalar PulseEPG',
    pwaModalDesc:
      'Instale o aplicativo na tela inicial para acesso rápido em tela cheia e suporte offline.',
    pwaAndroidStep:
      'Abra o menu ⋮ do navegador e toque em "Instalar aplicativo".',
    pwaIosStep:
      'Toque no botão Compartilhar e selecione "Adicionar à Tela de Início".',
    pwaPcStep: 'Clique no ícone de instalação na barra de endereços.',
    understood: 'Entendi',
    savedRemindersTitle: 'Lembretes de programas salvos',
  },
  nl: {
    appSubtitle:
      'Wereldwijde TV-gids · Satellieten · Films/Series & Live Sport',
    liveTab: 'Live',
    gridTab: 'TV-Gids',
    favoritesTab: 'Favorieten',
    sourcesTab: 'Bronnen & APK',
    refreshBtn: 'EPG Vernieuwen',
    refreshingBtn: 'Sync...',
    settingsTitle: 'Instellingen & Satellieten',
    installApp: 'App Installeren',
    pwaActive: 'App-modus actief',
    searchPlaceholder: 'Zoeken (bijv. NPO, RTL, ESPN...)',
    presetMinus1h: '-1u',
    presetNow: 'Nu',
    presetPrime: 'Primetime 20:30',
    presetPlus1h: '+1u',
    filterCatLabel: 'Categorie :',
    filterSatLabel: 'Sat :',
    filterBouquetLabel: 'Boeket :',
    filterZoneLabel: 'Regio :',
    filterCountryLabel: 'Land :',
    filterGenreLabel: 'Genre :',
    resetFiltersBtn: 'Filters resetten',
    channelsDisplayed: 'zenders weergegeven van',
    activeProgrammes: 'actieve programma’s',
    noChannelsFoundTitle: 'Geen zenders gevonden voor uw filters',
    noChannelsFoundDesc:
      'Probeer « Alle » te selecteren in de satellietbalk of controleer uw boeketten in Instellingen.',
    showAllSatellitesBtn: 'Toon alle satellieten',
    loadMoreChannels: 'Meer zenders laden',
    remainingLabel: 'resterend',
    liveBadge: 'Live',
    slotBadge: 'Tijdslot',
    upNext: 'Hierna',
    unspecified: 'Niet opgegeven',
    noProgramCommunicated: 'Geen programma-informatie voor dit tijdslot',
    addToFavorites: 'Aan favorieten toevoegen',
    removeFromFavorites: 'Uit favorieten verwijderen',
    favLabel: 'Favoriet',
    close: 'Sluiten',
    ended: 'Afgelopen',
    remainingPrefix: 'nog',
    minUnit: 'min',
    badgeOriginalAudio: 'Originele Audio',
    badgeSubtitles: 'Ondertiteling',
    badgeAudioStadium: 'Stadioneffect',
    badgeFootballLive: 'Live Voetbal',
    badgeVoEnglish: 'Engelse Audio',
    badgeSubDvb: 'DVB Ondertitels',
    modalOriginalTitle: 'Oorspronkelijke titel :',
    modalReleaseDate: 'Jaar van uitgave :',
    modalGenre: 'Genre :',
    modalOrigin: 'Land van herkomst :',
    modalNotProvided: 'Niet opgegeven',
    modalInternationalProd: 'Internationale productie',
    modalSummary: 'Samenvatting',
    modalVerifiedSummary: 'Geverifieerde samenvatting (TMDB)',
    modalNoDescription: 'Geen beschrijving verstrekt door de zender.',
    modalDirectedBy: 'Regie :',
    modalCast: 'Cast :',
    officialSheet: 'Officiële fiche',
    hdPoster: 'HD Poster',
    syncingTmdb: 'TMDB metadata laden...',
    liveBroadcast: 'Live Uitzending',
    reminderActive: 'Herinnering actief',
    reminderBtn: 'Herinner mij',
    cancelReminder: 'Herinnering annuleren',
    remindProgram: 'Herinner mij aan dit programma',
    startedAt: 'Begonnen om',
    endsAt: 'Eindigt om',
    yesterday: 'Gisteren',
    today: 'Vandaag',
    tomorrow: 'Morgen',
    allDay: 'Hele dag',
    morning: 'Ochtend',
    afternoon: 'Middag',
    eveningPrime: 'Avond Primetime',
    noProgramForSlot: 'Geen programma voor dit tijdvak',
    selectAnotherDayOrRefresh: 'Kies een andere dag of vernieuw de EPG.',
    emissionsAvailable: 'uitzendingen beschikbaar',
    voPrefix: 'Originele Versie',
    activeChannelsOnGrid: 'zenders in de gids',
    gridChannelHeader: 'Zender',
    gridVoSubHeader: 'Origineel / Ondertitels',
    workerTitle: 'Multi-stream XMLTV Parser',
    workerStreams: 'Actieve streams',
    workerChannelsCount: 'Verwerkte zenders',
    workerProgrammesCount: 'Gelezen programma’s',
    settingsModalTitle: 'Instellingen & Satellieten',
    settingsModalSubtitle:
      'Configureer uw satellietposities, boeketten en voorkeuren',
    tabBouquetsFilters: 'Satellieten & Boeketten',
    tabXmltvCache: 'Cache & Bronnen',
    tabLegalPlayStore: 'Wettelijk & Info',
    languageSectionTitle: 'Taal van de interface',
    languageSectionDesc:
      'Selecteer uw voorkeurstaal voor de interface en metadata.',
    bouquetsSectionTitle: 'Satellietboeketten',
    bouquetsSectionDesc:
      'Kies de gewenste satellieten en boeketten voor de zenderlijst.',
    enableAllBouquets: 'Alle boeketten inschakelen',
    thematicCategoriesTitle: 'Thematische categorieën',
    thematicCategoriesDesc: 'Filter zenders op basis van hun hoofdgenre.',
    audioSubtitlesTitle: 'Audio & Ondertiteling',
    excludePolishLektorTitle: 'Poolse Lektor uitsluiten',
    excludePolishLektorDesc: 'Verberg audiotracks met Poolse voice-over.',
    requireSubtitlesTitle: 'Ondertiteling vereisen',
    requireSubtitlesDesc:
      'Toon bij voorkeur zenders met beschikbare ondertiteling.',
    cacheIndexedDbTitle: 'Lokale IndexedDB Cache',
    noCacheStored: 'Geen gegevens in cache.',
    autoRefresh12h: 'Automatisch verversen elke 12 uur',
    clearCacheBtn: 'Cache wissen',
    xmltvSourcesActiveTitle: 'Actieve XMLTV bronnen',
    restoreDefaultCatalog: 'Standaard catalogus herstellen',
    addCustomXmltvTitle: 'Aangepaste XMLTV-bron toevoegen',
    sourceNamePlaceholder: 'Naam van de bron...',
    addSourceBtn: 'Bron toevoegen',
    cancelBtn: 'Annuleren',
    saveBtn: 'Opslaan',
    saveAndApplyBtn: 'Opslaan en Toepassen',
    updatedAtLabel: 'Bijgewerkt op',
    channelsCountLabel: 'Zenders :',
    programmesCountLabel: 'Programma’s :',
    legalTmdbTitle: 'The Movie Database (TMDB)',
    legalTmdbNotice:
      'Dit product gebruikt de TMDB API, maar is niet goedgekeurd of gecertificeerd door TMDB.',
    legalNonStreamingTitle: 'Geen streaming',
    legalNonStreamingClause:
      'PulseEPG biedt uitsluitend programmagidsgegevens en zendt geen videostreams uit.',
    legalPrivacyTitle: 'Privacybeleid',
    legalPrivacyDesc:
      'Uw instellingen, favorieten en herinneringen worden uitsluitend lokaal op uw apparaat bewaard.',
    pwaModalTitle: 'Installeer PulseEPG',
    pwaModalDesc:
      'Installeer de app op uw startscherm voor snellere toegang en offline ondersteuning.',
    pwaAndroidStep: 'Open het menu ⋮ en tik op "App installeren".',
    pwaIosStep: 'Tik op het Deel-icoon en kies "Zet op beginscherm".',
    pwaPcStep: 'Klik op het installatie-icoon in de adresbalk.',
    understood: 'Begrepen',
    savedRemindersTitle: 'Opgeslagen programma-herinneringen',
  },
};

TRANSLATIONS.es_latam = TRANSLATIONS.es;
TRANSLATIONS.pt_br = TRANSLATIONS.pt;

export function getTranslations(lang?: AppLanguage): Translations {
  const target = lang || currentActiveLanguage;
  const fallback =
    target === 'es_latam' ? 'es' : target === 'pt_br' ? 'pt' : target;
  return (
    TRANSLATIONS[target] ||
    TRANSLATIONS[fallback] ||
    TRANSLATIONS.en ||
    TRANSLATIONS.fr
  );
}

export type ReminderTranslationKey =
  | 'reminders.tabLabel'
  | 'reminders.title'
  | 'reminders.programmed'
  | 'reminders.description'
  | 'reminders.clearAll'
  | 'reminders.testAlert'
  | 'reminders.testAlertTooltip'
  | 'reminders.filterAll'
  | 'reminders.filterImminent'
  | 'reminders.filterSport'
  | 'reminders.filterCinema'
  | 'reminders.activeBadge'
  | 'reminders.removeBtn'
  | 'reminders.removeTooltip'
  | 'reminders.emptyTitle'
  | 'reminders.emptyCategoryTitle'
  | 'reminders.emptyDescPrefix'
  | 'reminders.emptyDescBadge'
  | 'reminders.emptyDescSuffix'
  | 'reminders.suggestionsTitle'
  | 'reminders.suggestionsHintPrefix'
  | 'reminders.suggestionsHintKey'
  | 'reminders.suggestionsHintSuffix'
  | 'reminders.addReminderBtn'
  | 'reminders.countdownEnded'
  | 'reminders.countdownLive'
  | 'reminders.countdownImminent'
  | 'reminders.countdownInMinutes'
  | 'reminders.countdownInHours'
  | 'reminders.countdownInHoursMinutes'
  | 'reminders.satelliteFallback'
  | 'reminders.bannerAriaLabel'
  | 'reminders.bannerLive'
  | 'reminders.bannerInMinutes'
  | 'reminders.bannerSaved'
  | 'reminders.bannerOpenTab'
  | 'reminders.bannerOpenTabTitle'
  | 'reminders.bannerDismissTitle'
  | 'reminders.demoAlertTitle'
  | 'reminders.demoAlertSubTitle';

const REMINDERS_I18N: Record<
  ReminderTranslationKey,
  Partial<Record<AppLanguage, string>>
> = {
  'reminders.tabLabel': {
    fr: 'Mes Rappels',
    ar: 'تذكيراتي',
    en: 'My Reminders',
    es: 'Mis Recordatorios',
    de: 'Erinnerungen',
    pt: 'Meus Lembretes',
    it: 'Promemoria',
    tr: 'Hatırlatıcılarım',
  },
  'reminders.title': {
    fr: 'Mes Rappels & Notifications Système',
    ar: 'تذكيراتي وإشعارات النظام',
    en: 'My Reminders & System Notifications',
    es: 'Mis Recordatorios y Notificaciones del Sistema',
    de: 'Meine Erinnerungen & Systembenachrichtigungen',
    pt: 'Meus Lembretes e Notificações do Sistema',
    it: 'I Miei Promemoria e Notifiche di Sistema',
    tr: 'Hatırlatıcılarım ve Sistem Bildirimleri',
  },
  'reminders.programmed': {
    fr: 'programmé',
    ar: 'مجدول',
    en: 'scheduled',
    es: 'programado',
    de: 'geplant',
    pt: 'agendado',
    it: 'programmato',
    tr: 'planlandı',
  },
  'reminders.description': {
    fr: 'Agenda chronologique de vos matchs, films et émissions · Notification système Android avec son (même application fermée) + bandeau visuel In-App 5 min avant le début.',
    ar: 'جدول زمني لمبارياتك، أفلامك وبرامجك. إشعارات نظام Android مع صوت (حتى عند إغلاق التطبيق) + شريط تنبيه داخل التطبيق قبل 5 دقائق من البداية.',
    en: 'Chronological schedule of your matches, movies, and shows · Android system notification with sound (even when app is closed) + in-app alert banner 5 min before start.',
    es: 'Agenda cronológica de tus partidos, películas y programas · Notificación del sistema Android con sonido (incluso con la app cerrada) + aviso visual en la app 5 min antes del inicio.',
    de: 'Chronologischer Zeitplan Ihrer Spiele, Filme und Sendungen · Android-Systembenachrichtigung mit Ton (auch bei geschlossener App) + In-App-Banner 5 Min. vor Beginn.',
    pt: 'Agenda cronológica dos seus jogos, filmes e programas · Notificação do sistema Android com som (mesmo com o app fechado) + alerta visual no app 5 min antes do início.',
    it: 'Agenda cronologica di partite, film e programmi · Notifica di sistema Android con audio (anche ad app chiusa) + banner visivo In-App 5 min prima dell’inizio.',
    tr: 'Maçlarınızın, filmlerinizin ve programlarınızın kronolojik takvimi · Sesli Android sistem bildirimi (uygulama kapalıyken bile) + başlamadan 5 dk önce uygulama içi uyarı bandı.',
  },
  'reminders.clearAll': {
    fr: 'Tout effacer',
    ar: 'مسح الكل',
    en: 'Clear all',
    es: 'Borrar todo',
    de: 'Alle löschen',
    pt: 'Limpar tudo',
    it: 'Cancella tutto',
    tr: 'Tümünü temizle',
  },
  'reminders.testAlert': {
    fr: "Tester l'alerte TV (≤ 5 min)",
    ar: 'اختبار تنبيه التلفزيون (≤ 5 دقائق)',
    en: 'Test TV Alert (≤ 5 min)',
    es: 'Probar alerta TV (≤ 5 min)',
    de: 'TV-Alarm testen (≤ 5 Min.)',
    pt: 'Testar alerta TV (≤ 5 min)',
    it: 'Testa avviso TV (≤ 5 min)',
    tr: 'TV Uyarısını Test Et (≤ 5 dk)',
  },
  'reminders.testAlertTooltip': {
    fr: "Simuler un rappel commençant dans moins de 5 minutes pour tester le bandeau d'alerte TV",
    ar: 'محاكاة تذكير يبدأ خلال أقل من 5 دقائق لاختبار شريط تنبيه التلفزيون',
    en: 'Simulate a reminder starting in less than 5 minutes to test the TV alert banner',
    es: 'Simular un recordatorio que comienza en menos de 5 minutos para probar el aviso de TV',
    de: 'Eine Erinnerung in weniger als 5 Minuten simulieren, um das TV-Banner zu testen',
    pt: 'Simular um lembrete começando em menos de 5 minutos para testar o alerta de TV',
    it: 'Simula un promemoria che inizia tra meno di 5 minuti per testare il banner TV',
    tr: 'TV uyarı bandını test etmek için 5 dakikadan kısa sürede başlayan bir hatırlatıcı simüle edin',
  },
  'reminders.filterAll': {
    fr: 'Tous les rappels',
    ar: 'جميع التذكيرات',
    en: 'All reminders',
    es: 'Todos los recordatorios',
    de: 'Alle Erinnerungen',
    pt: 'Todos os lembretes',
    it: 'Tutti i promemoria',
    tr: 'Tüm hatırlatıcılar',
  },
  'reminders.filterImminent': {
    fr: 'Imminent ≤ 5 min / En Direct',
    ar: 'قريباً ≤ 5 دقائق / مباشر',
    en: 'Imminent ≤ 5 min / Live',
    es: 'Inminente ≤ 5 min / En Vivo',
    de: 'Gleich ≤ 5 Min. / Live',
    pt: 'Iminente ≤ 5 min / Ao Vivo',
    it: 'Imminente ≤ 5 min / In Diretta',
    tr: 'Yakında ≤ 5 dk / Canlı',
  },
  'reminders.filterSport': {
    fr: 'Matchs & Sport',
    ar: 'مباريات ورياضة',
    en: 'Matches & Sports',
    es: 'Partidos y Deporte',
    de: 'Spiele & Sport',
    pt: 'Jogos e Esportes',
    it: 'Partite e Sport',
    tr: 'Maçlar ve Spor',
  },
  'reminders.filterCinema': {
    fr: 'Films, Séries & Docs',
    ar: 'أفلام، مسلسلات ووثائقيات',
    en: 'Movies, Series & Docs',
    es: 'Cine, Series y Docs',
    de: 'Filme, Serien & Dokus',
    pt: 'Filmes, Séries e Docs',
    it: 'Film, Serie e Doc',
    tr: 'Filmler, Diziler ve Belgesel',
  },
  'reminders.activeBadge': {
    fr: 'RAPPEL ACTIF',
    ar: 'تذكير نشط',
    en: 'ACTIVE REMINDER',
    es: 'RECORDATORIO ACTIVO',
    de: 'ERINNERUNG AKTIV',
    pt: 'LEMBRETE ATIVO',
    it: 'PROMEMORIA ATTIVO',
    tr: 'AKTİF HATIRLATICI',
  },
  'reminders.removeBtn': {
    fr: 'Retirer',
    ar: 'إزالة',
    en: 'Remove',
    es: 'Quitar',
    de: 'Entfernen',
    pt: 'Remover',
    it: 'Rimuovi',
    tr: 'Kaldır',
  },
  'reminders.removeTooltip': {
    fr: 'Retirer ce rappel',
    ar: 'إزالة هذا التذكير',
    en: 'Remove this reminder',
    es: 'Quitar este recordatorio',
    de: 'Diese Erinnerung entfernen',
    pt: 'Remover este lembrete',
    it: 'Rimuovi questo promemoria',
    tr: 'Bu hatırlatıcıyı kaldır',
  },
  'reminders.emptyTitle': {
    fr: 'Aucun rappel programmé pour le moment',
    ar: 'لا يوجد أي تذكير مجدول حالياً',
    en: 'No reminders scheduled yet',
    es: 'No hay recordatorios programados por el momento',
    de: 'Derzeit sind keine Erinnerungen geplant',
    pt: 'Nenhum lembrete agendado no momento',
    it: 'Nessun promemoria programmato al momento',
    tr: 'Şu anda planlanmış hatırlatıcı yok',
  },
  'reminders.emptyCategoryTitle': {
    fr: 'Aucun rappel dans cette catégorie',
    ar: 'لا توجد تذكيرات في هذه الفئة',
    en: 'No reminders in this category',
    es: 'No hay recordatorios en esta categoría',
    de: 'Keine Erinnerungen in dieser Kategorie',
    pt: 'Nenhum lembrete nesta categoria',
    it: 'Nessun promemoria in questa categoria',
    tr: 'Bu kategoride hatırlatıcı yok',
  },
  'reminders.emptyDescPrefix': {
    fr: "Cliquez sur l'icône cloche",
    ar: 'اضغط على أيقونة الجرس',
    en: 'Click the bell icon',
    es: 'Pulsa en el icono de campana',
    de: 'Klicken Sie auf das Glockensymbol',
    pt: 'Clique no ícone de sino',
    it: "Clicca sull'icona della campana",
    tr: 'Başlamadan 5 dakika önce uyarı almak için yaklaşan herhangi bir programdaki',
  },
  'reminders.emptyDescBadge': {
    fr: 'Rappel',
    ar: 'تذكير',
    en: 'Remind Me',
    es: 'Recordar',
    de: 'Erinnerung',
    pt: 'Lembrar',
    it: 'Promemoria',
    tr: 'Hatırlat',
  },
  'reminders.emptyDescSuffix': {
    fr: "sur n'importe quel programme à venir (dans En Direct, la Grille TV ou ci-dessous) pour être alerté visuellement 5 minutes avant le coup d'envoi.",
    ar: 'على أي برنامج قادم (في المباشر الآن، شبكة البرامج أو أدناه) لتلقي تنبيه مرئي وصوتي قبل 5 دقائق من البداية.',
    en: 'on any upcoming programme (in Live Now, TV Grid, or below) to receive a visual alert 5 minutes before kick-off.',
    es: 'en cualquier programa próximo (en En Vivo, Parrilla TV o abajo) para recibir una alerta visual 5 minutos antes del inicio.',
    de: 'bei einer kommenden Sendung (in Live TV, TV-Programm oder unten), um 5 Minuten vor Beginn benachrichtigt zu werden.',
    pt: 'em qualquer programa futuro (em Ao Vivo, Grade de TV ou abaixo) para receber um alerta visual 5 minutos antes do início.',
    it: 'su qualsiasi programma in arrivo (in Diretta, Griglia TV o qui sotto) per ricevere un avviso 5 minuti prima dell’inizio.',
    tr: 'zil simgesine tıklayın.',
  },
  'reminders.suggestionsTitle': {
    fr: 'Événements, Matchs & Films à venir · Programmer en 1 clic',
    ar: 'أحداث، مباريات وأفلام قادمة · جدولة بنقرة واحدة',
    en: 'Upcoming Events, Matches & Movies · 1-Click Schedule',
    es: 'Próximos Eventos, Partidos y Películas · Programar en 1 clic',
    de: 'Kommende Events, Spiele & Filme · Mit 1 Klick planen',
    pt: 'Próximos Eventos, Jogos e Filmes · Agendar em 1 clique',
    it: 'Prossimi Eventi, Partite e Film · Programma in 1 clic',
    tr: 'Yaklaşan Etkinlikler, Maçlar ve Filmler · Tek Tıkla Planla',
  },
  'reminders.suggestionsHintPrefix': {
    fr: 'Appuyez sur',
    ar: 'اضغط على',
    en: 'Press',
    es: 'Pulsa',
    de: 'Drücken Sie',
    pt: 'Pressione',
    it: 'Premi',
    tr: 'Hatırlatıcılarınıza eklemek için',
  },
  'reminders.suggestionsHintKey': {
    fr: 'OK / Enter',
    ar: 'OK / Enter',
    en: 'OK / Enter',
    es: 'OK / Enter',
    de: 'OK / Enter',
    pt: 'OK / Enter',
    it: 'OK / Enter',
    tr: 'OK / Enter',
  },
  'reminders.suggestionsHintSuffix': {
    fr: 'pour ajouter à vos rappels',
    ar: 'للإضافة إلى تذكيراتك',
    en: 'to add to your reminders',
    es: 'para añadir a tus recordatorios',
    de: 'um zu Ihren Erinnerungen hinzuzufügen',
    pt: 'para adicionar aos seus lembretes',
    it: 'per aggiungere ai tuoi promemoria',
    tr: 'tuşuna basın',
  },
  'reminders.addReminderBtn': {
    fr: '+ Rappel',
    ar: '+ تذكير',
    en: '+ Remind',
    es: '+ Recordar',
    de: '+ Erinnerung',
    pt: '+ Lembrete',
    it: '+ Promemoria',
    tr: '+ Hatırlat',
  },
  'reminders.countdownEnded': {
    fr: 'Terminé',
    ar: 'انتهى',
    en: 'Ended',
    es: 'Finalizado',
    de: 'Beendet',
    pt: 'Encerrado',
    it: 'Terminato',
    tr: 'Bitti',
  },
  'reminders.countdownLive': {
    fr: 'EN DIRECT · Reste {min} min',
    ar: 'مباشر الآن · متبقي {min} دقيقة',
    en: 'LIVE NOW · {min} min left',
    es: 'EN VIVO · Quedan {min} min',
    de: 'LIVE · Noch {min} Min.',
    pt: 'AO VIVO · Restam {min} min',
    it: 'IN DIRETTA · Restano {min} min',
    tr: 'CANLI · {min} dk kaldı',
  },
  'reminders.countdownImminent': {
    fr: 'IMMINENT · Dans {min} min',
    ar: 'وشيك · خلال {min} دقائق',
    en: 'IMMINENT · In {min} min',
    es: 'INMINENTE · En {min} min',
    de: 'GLEICH · In {min} Min.',
    pt: 'IMINENTE · Em {min} min',
    it: 'IMMINENTE · Tra {min} min',
    tr: 'YAKINDA · {min} dk içinde',
  },
  'reminders.countdownInMinutes': {
    fr: 'Dans {min} min',
    ar: 'خلال {min} دقيقة',
    en: 'In {min} min',
    es: 'En {min} min',
    de: 'In {min} Min.',
    pt: 'Em {min} min',
    it: 'Tra {min} min',
    tr: '{min} dk içinde',
  },
  'reminders.countdownInHours': {
    fr: 'Dans {hours}h',
    ar: 'خلال {hours} س',
    en: 'In {hours}h',
    es: 'En {hours}h',
    de: 'In {hours} Std.',
    pt: 'Em {hours}h',
    it: 'Tra {hours}h',
    tr: '{hours} sa içinde',
  },
  'reminders.countdownInHoursMinutes': {
    fr: 'Dans {hours}h {min}min',
    ar: 'خلال {hours} س و {min} د',
    en: 'In {hours}h {min}min',
    es: 'En {hours}h {min}min',
    de: 'In {hours} Std. {min} Min.',
    pt: 'Em {hours}h {min}min',
    it: 'Tra {hours}h {min}min',
    tr: '{hours} sa {min} dk içinde',
  },
  'reminders.satelliteFallback': {
    fr: 'Satellite',
    ar: 'قمر صناعي',
    en: 'Satellite',
    es: 'Satélite',
    de: 'Satellit',
    pt: 'Satélite',
    it: 'Satellite',
    tr: 'Uydu',
  },
  'reminders.bannerAriaLabel': {
    fr: 'Alerte Rappel Programme TV',
    ar: 'تنبيه تذكير برنامج التلفزيون',
    en: 'TV Programme Reminder Alert',
    es: 'Alerta de Recordatorio de Programa TV',
    de: 'TV-Programmerinnerung',
    pt: 'Alerta de Lembrete de Programa de TV',
    it: 'Avviso Promemoria Programma TV',
    tr: 'TV Programı Hatırlatma Uyarısı',
  },
  'reminders.bannerLive': {
    fr: 'EN COURS · DIRECT',
    ar: 'يُعرض الآن · مباشر',
    en: 'LIVE NOW',
    es: 'EN CURSO · EN VIVO',
    de: 'JETZT LIVE',
    pt: 'EM EXIBIÇÃO · AO VIVO',
    it: 'IN CORSO · DIRETTA',
    tr: 'ŞU AN CANLI',
  },
  'reminders.bannerInMinutes': {
    fr: 'DANS {min} MIN',
    ar: 'خلال {min} دقائق',
    en: 'IN {min} MIN',
    es: 'EN {min} MIN',
    de: 'IN {min} MIN.',
    pt: 'EM {min} MIN',
    it: 'TRA {min} MIN',
    tr: '{min} DK İÇİNDE',
  },
  'reminders.bannerSaved': {
    fr: 'RAPPEL ENREGISTRÉ (-5 MIN)',
    ar: 'تم حفظ التذكير (-5 دقائق)',
    en: 'REMINDER SAVED (-5 MIN)',
    es: 'RECORDATORIO GUARDADO (-5 MIN)',
    de: 'ERINNERUNG GESPEICHERT (-5 MIN.)',
    pt: 'LEMBRETE SALVO (-5 MIN)',
    it: 'PROMEMORIA SALVATO (-5 MIN)',
    tr: 'HATIRLATICI KAYDEDİLDİ (-5 DK)',
  },
  'reminders.bannerOpenTab': {
    fr: 'Rappels ({count})',
    ar: 'تذكيراتي ({count})',
    en: 'Reminders ({count})',
    es: 'Recordatorios ({count})',
    de: 'Erinnerungen ({count})',
    pt: 'Lembretes ({count})',
    it: 'Promemoria ({count})',
    tr: 'Hatırlatıcılar ({count})',
  },
  'reminders.bannerOpenTabTitle': {
    fr: "Ouvrir l'onglet Mes Rappels",
    ar: 'فتح تبويب تذكيراتي',
    en: 'Open My Reminders tab',
    es: 'Abrir pestaña Mis Recordatorios',
    de: 'Tab Meine Erinnerungen öffnen',
    pt: 'Abrir aba Meus Lembretes',
    it: 'Apri scheda I Miei Promemoria',
    tr: 'Hatırlatıcılarım sekmesini aç',
  },
  'reminders.bannerDismissTitle': {
    fr: "Masquer l'alerte",
    ar: 'إخفاء التنبيه',
    en: 'Dismiss alert',
    es: 'Ocultar alerta',
    de: 'Hinweis ausblenden',
    pt: 'Ocultar alerta',
    it: 'Nascondi avviso',
    tr: 'Uyarıyı gizle',
  },
  'reminders.demoAlertTitle': {
    fr: 'Soirée Ligue des Champions / Grand Cinéma HD',
    ar: 'سهرة دوري أبطال أوروبا / السينما الكبرى HD',
    en: 'Champions League Night / Prime Cinema HD',
    es: 'Noche de Champions League / Gran Cine HD',
    de: 'Champions-League-Abend / Prime Kino HD',
    pt: 'Noite de Champions League / Grande Cinema HD',
    it: 'Serata Champions League / Grande Cinema HD',
    tr: 'Şampiyonlar Ligi Gecesi / Sinema HD',
  },
  'reminders.demoAlertSubTitle': {
    fr: 'Diffusion Imminente (Test Bandeau TV)',
    ar: 'بث وشيك (اختبار تنبيه التلفزيون)',
    en: 'Starting Soon (TV Banner Test)',
    es: 'Emisión Inminente (Prueba de Alerta TV)',
    de: 'Sendung beginnt gleich (TV-Banner-Test)',
    pt: 'Transmissão Iminente (Teste de Alerta TV)',
    it: 'Inizio Imminente (Test Avviso TV)',
    tr: 'Yakında Başlıyor (TV Uyarı Testi)',
  },
};

export type AuthTranslationKey =
  | 'auth.guestMode'
  | 'auth.proBadge'
  | 'auth.myAccount'
  | 'auth.signInSignUp'
  | 'auth.subtitle'
  | 'auth.proReasonEpg7Days'
  | 'auth.proReasonBouquets'
  | 'auth.proBullet1'
  | 'auth.proBullet2'
  | 'auth.guestAccessInfo'
  | 'auth.signIn'
  | 'auth.signUp'
  | 'auth.continueWithGoogle'
  | 'auth.orWithEmail'
  | 'auth.displayName'
  | 'auth.displayNamePlaceholder'
  | 'auth.email'
  | 'auth.password'
  | 'auth.free'
  | 'auth.tierFree3Bouquets'
  | 'auth.tierPro7Days'
  | 'auth.createAccountBtn'
  | 'auth.signedInAs'
  | 'auth.epgGuideReplayLabel'
  | 'auth.epgGuideReplayPro'
  | 'auth.epgGuideReplayFree'
  | 'auth.simultaneousBouquetsLabel'
  | 'auth.bouquetsUnlimitedPro'
  | 'auth.bouquets3Free'
  | 'auth.subscriptionStatus'
  | 'auth.planFreeDesc'
  | 'auth.planProDesc'
  | 'auth.signOutGuest'
  | 'auth.continueBtn'
  | 'auth.close'
  | 'auth.errorInvalidEmail'
  | 'auth.errorGoogleOAuth'
  | 'auth.errorSupabase';

const AUTH_I18N: Record<AuthTranslationKey, Partial<Record<AppLanguage, string>>> = {
  'auth.guestMode': {
    fr: 'Mode Invité',
    ar: 'وضع الزائر',
    en: 'Guest Mode',
    es: 'Modo Invitado',
    de: 'Gastmodus',
    pt: 'Modo Convidado',
    it: 'Modalità Ospite',
    tr: 'Misafir Modu',
  },
  'auth.proBadge': {
    fr: 'PulseEPG Pro 👑',
    ar: 'PulseEPG برو 👑',
    en: 'PulseEPG Pro 👑',
    es: 'PulseEPG Pro 👑',
    de: 'PulseEPG Pro 👑',
    pt: 'PulseEPG Pro 👑',
    it: 'PulseEPG Pro 👑',
    tr: 'PulseEPG Pro 👑',
  },
  'auth.myAccount': {
    fr: 'Mon Compte PulseEPG',
    ar: 'حسابي في PulseEPG',
    en: 'My PulseEPG Account',
    es: 'Mi Cuenta PulseEPG',
    de: 'Mein PulseEPG-Konto',
    pt: 'Minha Conta PulseEPG',
    it: 'Il Mio Account PulseEPG',
    tr: 'PulseEPG Hesabım',
  },
  'auth.signInSignUp': {
    fr: "Se connecter / S'inscrire",
    ar: 'تسجيل الدخول / إنشاء حساب',
    en: 'Sign In / Sign Up',
    es: 'Iniciar sesión / Registrarse',
    de: 'Anmelden / Registrieren',
    pt: 'Entrar / Cadastrar-se',
    it: 'Accedi / Registrati',
    tr: 'Giriş Yap / Kaydol',
  },
  'auth.subtitle': {
    fr: 'Synchronisation cloud, EPG 7 jours & multi-bouquets',
    ar: 'مزامنة سحابية، دليل EPG 7 أيام وباقات متعددة',
    en: 'Cloud sync, 7-day EPG & multi-bouquets',
    es: 'Sincronización en la nube, EPG 7 días y multi-bouquets',
    de: 'Cloud-Sync, 7-Tage-EPG & Multi-Bouquets',
    pt: 'Sincronização em nuvem, EPG 7 dias e multi-bouquets',
    it: 'Sincronizzazione cloud, EPG 7 giorni e multi-bouquet',
    tr: 'Bulut senkronizasyonu, 7 günlük EPG ve çoklu paketler',
  },
  'auth.proReasonEpg7Days': {
    fr: 'Débloquez le Guide EPG étendu 7 jours (J+1 à J+7) et le mode Catch-up / Replay avec PulseEPG Pro (Connexion / Inscription requise)',
    ar: 'فتح دليل EPG الممتد 7 أيام (اليوم +1 إلى اليوم +7) ووضع Replay / Catch-up مع PulseEPG Pro (يتطلب التسجيل / الدخول)',
    en: 'Unlock 7-day extended EPG Guide (D+1 to D+7) & Catch-up / Replay mode with PulseEPG Pro (Sign In / Sign Up required)',
    es: 'Desbloquea la Guía EPG extendida de 7 días (D+1 a D+7) y modo Replay con PulseEPG Pro (Registro / Acceso requerido)',
    de: '7-Tage-EPG-Guide (T+1 bis T+7) & Replay-Modus mit PulseEPG Pro freischalten (Anmeldung erforderlich)',
    pt: 'Desbloqueie o Guia EPG de 7 dias (D+1 a D+7) e modo Replay com PulseEPG Pro (Login / Cadastro necessário)',
    it: 'Sblocca la Guida EPG 7 giorni (G+1 a G+7) e Catch-up / Replay con PulseEPG Pro (Accesso / Registrazione richiesta)',
    tr: 'PulseEPG Pro ile 7 günlük genişletilmiş EPG Rehberini ve Replay modunu açın (Giriş / Kayıt gereklidir)',
  },
  'auth.proReasonBouquets': {
    fr: 'Débloquez tous les bouquets avec PulseEPG Pro (Connexion / Inscription requise)',
    ar: 'فتح جميع الباقات مع PulseEPG Pro (يتطلب التسجيل / الدخول)',
    en: 'Unlock all bouquets with PulseEPG Pro (Sign In / Sign Up required)',
    es: 'Desbloquea todos los bouquets con PulseEPG Pro (Registro / Acceso requerido)',
    de: 'Alle Bouquets mit PulseEPG Pro freischalten (Anmeldung erforderlich)',
    pt: 'Desbloqueie todos os bouquets com PulseEPG Pro (Login / Cadastro necessário)',
    it: 'Sblocca tutti i bouquet con PulseEPG Pro (Accesso / Registrazione richiesta)',
    tr: 'PulseEPG Pro ile tüm paketleri açın (Giriş / Kayıt gereklidir)',
  },
  'auth.proBullet1': {
    fr: 'Guide EPG étendu 7 jours complets (J+1 à J+7) & Mode Catch-up / Replay',
    ar: 'دليل EPG الممتد 7 أيام كاملة (اليوم +1 إلى اليوم +7) ووضع Replay / Catch-up',
    en: 'Full 7-day extended EPG Guide (D+1 to D+7) & Catch-up / Replay Mode',
    es: 'Guía EPG extendida de 7 días completos (D+1 a D+7) y Modo Replay',
    de: 'Vollständiger 7-Tage-EPG-Guide (T+1 bis T+7) & Replay-Modus',
    pt: 'Guia EPG estendido de 7 dias completos (D+1 a D+7) e Modo Replay',
    it: 'Guida EPG estesa a 7 giorni completi (G+1 a G+7) e Modalità Replay',
    tr: 'Tam 7 günlük genişletilmiş EPG Rehberi ve Catch-up / Replay Modu',
  },
  'auth.proBullet2': {
    fr: 'Débloquez tous les bouquets avec PulseEPG Pro (Synchronisation multi-satellites)',
    ar: 'فتح جميع الباقات مع PulseEPG Pro (مزامنة سحابية متعددة الأقمار)',
    en: 'Unlock all bouquets with PulseEPG Pro (Multi-satellite sync)',
    es: 'Desbloquea todos los bouquets con PulseEPG Pro (Sincronización multi-satélite)',
    de: 'Alle Bouquets mit PulseEPG Pro freischalten (Multi-Satelliten-Sync)',
    pt: 'Desbloqueie todos os bouquets com PulseEPG Pro (Sincronização multi-satélite)',
    it: 'Sblocca tutti i bouquet con PulseEPG Pro (Sincronizzazione multi-satellite)',
    tr: 'PulseEPG Pro ile tüm paketleri açın (Çoklu uydu senkronizasyonu)',
  },
  'auth.guestAccessInfo': {
    fr: 'Accès Invité actif : la grille TV (24h) et 3 bouquets restent 100% accessibles sans compte.',
    ar: 'وصول الزائر نشط: شبكة التلفزيون (24 ساعة) و 3 باقات متاحة 100% بدون حساب.',
    en: 'Guest Access active: TV grid (24h) and 3 bouquets remain 100% accessible without an account.',
    es: 'Acceso de Invitado activo: la parrilla TV (24h) y 3 bouquets siguen 100% accesibles sin cuenta.',
    de: 'Gastzugang aktiv: TV-Guide (24h) und 3 Bouquets bleiben 100% ohne Konto verfügbar.',
    pt: 'Acesso de Convidado ativo: grade de TV (24h) e 3 bouquets continuam 100% acessíveis sem conta.',
    it: 'Accesso Ospite attivo: la guida TV (24h) e 3 bouquet rimangono accessibili al 100% senza account.',
    tr: 'Misafir Erişimi aktif: TV ızgarası (24 saat) ve 3 paket hesapsız %100 erişilebilir kalır.',
  },
  'auth.signIn': {
    fr: 'Se connecter',
    ar: 'تسجيل الدخول',
    en: 'Sign In',
    es: 'Iniciar sesión',
    de: 'Anmelden',
    pt: 'Entrar',
    it: 'Accedi',
    tr: 'Giriş Yap',
  },
  'auth.signUp': {
    fr: "S'inscrire",
    ar: 'إنشاء حساب',
    en: 'Sign Up',
    es: 'Registrarse',
    de: 'Registrieren',
    pt: 'Cadastrar-se',
    it: 'Registrati',
    tr: 'Kaydol',
  },
  'auth.continueWithGoogle': {
    fr: 'Continuer avec Google',
    ar: 'المتابعة باستخدام Google',
    en: 'Continue with Google',
    es: 'Continuar con Google',
    de: 'Weiter mit Google',
    pt: 'Continuar com o Google',
    it: 'Continua con Google',
    tr: 'Google ile Devam Et',
  },
  'auth.orWithEmail': {
    fr: 'ou par e-mail',
    ar: 'أو بواسطة البريد الإلكتروني',
    en: 'or with email',
    es: 'o por correo electrónico',
    de: 'oder per E-Mail',
    pt: 'ou por e-mail',
    it: 'oppure via email',
    tr: 'veya e-posta ile',
  },
  'auth.displayName': {
    fr: "Nom d'affichage",
    ar: 'اسم العرض',
    en: 'Display Name',
    es: 'Nombre para mostrar',
    de: 'Anzeigename',
    pt: 'Nome de exibição',
    it: 'Nome visualizzato',
    tr: 'Görünen Ad',
  },
  'auth.displayNamePlaceholder': {
    fr: 'Ex: Tarik',
    ar: 'مثال: طارق',
    en: 'Ex: Tarik',
    es: 'Ej: Tarik',
    de: 'Z.B.: Tarik',
    pt: 'Ex: Tarik',
    it: 'Es: Tarik',
    tr: 'Örn: Tarik',
  },
  'auth.email': {
    fr: 'Adresse e-mail',
    ar: 'البريد الإلكتروني',
    en: 'Email address',
    es: 'Dirección de correo',
    de: 'E-Mail-Adresse',
    pt: 'Endereço de e-mail',
    it: 'Indirizzo email',
    tr: 'E-posta adresi',
  },
  'auth.password': {
    fr: 'Mot de passe',
    ar: 'كلمة المرور',
    en: 'Password',
    es: 'Contraseña',
    de: 'Passwort',
    pt: 'Senha',
    it: 'Password',
    tr: 'Şifre',
  },
  'auth.free': {
    fr: 'Gratuit',
    ar: 'مجاني',
    en: 'Free',
    es: 'Gratis',
    de: 'Kostenlos',
    pt: 'Grátis',
    it: 'Gratis',
    tr: 'Ücretsiz',
  },
  'auth.tierFree3Bouquets': {
    fr: '3 bouquets inclus',
    ar: '3 باقات مشمولة',
    en: '3 bouquets included',
    es: '3 bouquets incluidos',
    de: '3 Bouquets enthalten',
    pt: '3 bouquets inclusos',
    it: '3 bouquet inclusi',
    tr: '3 paket dahil',
  },
  'auth.tierPro7Days': {
    fr: 'EPG 7 jours & illimité',
    ar: 'دليل 7 أيام وباقات غير محدودة',
    en: '7-day EPG & unlimited',
    es: 'EPG 7 días e ilimitado',
    de: '7-Tage-EPG & unbegrenzt',
    pt: 'EPG 7 dias e ilimitado',
    it: 'EPG 7 giorni e illimitato',
    tr: '7 günlük EPG ve sınırsız',
  },
  'auth.createAccountBtn': {
    fr: 'Créer mon compte',
    ar: 'إنشاء حساب',
    en: 'Create Account',
    es: 'Crear mi cuenta',
    de: 'Konto erstellen',
    pt: 'Criar minha conta',
    it: 'Crea account',
    tr: 'Hesap Oluştur',
  },
  'auth.signedInAs': {
    fr: 'Utilisateur connecté',
    ar: 'المستخدم المتصل',
    en: 'Signed in as',
    es: 'Conectado como',
    de: 'Angemeldet als',
    pt: 'Conectado como',
    it: 'Connesso come',
    tr: 'Olarak giriş yapıldı',
  },
  'auth.epgGuideReplayLabel': {
    fr: 'Guide EPG & Replay :',
    ar: 'دليل EPG والإعادة :',
    en: 'EPG Guide & Replay:',
    es: 'Guía EPG y Replay:',
    de: 'EPG-Guide & Replay:',
    pt: 'Guia EPG e Replay:',
    it: 'Guida EPG & Replay:',
    tr: 'EPG Rehberi ve Replay:',
  },
  'auth.epgGuideReplayPro': {
    fr: '7 Jours complets + Replay (Pro 👑)',
    ar: '7 أيام كاملة + الإعادة (برو 👑)',
    en: 'Full 7 Days + Replay (Pro 👑)',
    es: '7 días completos + Replay (Pro 👑)',
    de: 'Vollständige 7 Tage + Replay (Pro 👑)',
    pt: '7 dias completos + Replay (Pro 👑)',
    it: '7 giorni completi + Replay (Pro 👑)',
    tr: 'Tam 7 Gün + Replay (Pro 👑)',
  },
  'auth.epgGuideReplayFree': {
    fr: 'Journée en cours (24h)',
    ar: 'اليوم الحالي (24 ساعة)',
    en: 'Current day (24h)',
    es: 'Día actual (24h)',
    de: 'Aktueller Tag (24h)',
    pt: 'Dia atual (24h)',
    it: 'Giorno corrente (24h)',
    tr: 'Mevcut gün (24 saat)',
  },
  'auth.simultaneousBouquetsLabel': {
    fr: 'Bouquets simultanés :',
    ar: 'الباقات المتزامنة :',
    en: 'Simultaneous bouquets:',
    es: 'Bouquets simultáneos:',
    de: 'Gleichzeitige Bouquets:',
    pt: 'Bouquets simultâneos:',
    it: 'Bouquet simultanei:',
    tr: 'Eşzamanlı paketler:',
  },
  'auth.bouquetsUnlimitedPro': {
    fr: 'Illimités (Pro 👑)',
    ar: 'غير محدودة (برو 👑)',
    en: 'Unlimited (Pro 👑)',
    es: 'Ilimitados (Pro 👑)',
    de: 'Unbegrenzt (Pro 👑)',
    pt: 'Ilimitados (Pro 👑)',
    it: 'Illimitati (Pro 👑)',
    tr: 'Sınırsız (Pro 👑)',
  },
  'auth.bouquets3Free': {
    fr: '3 Bouquets Gratuits',
    ar: '3 باقات مجانية',
    en: '3 Free Bouquets',
    es: '3 Bouquets Gratuitos',
    de: '3 kostenlose Bouquets',
    pt: '3 Bouquets Gratuitos',
    it: '3 Bouquet Gratuiti',
    tr: '3 Ücretsiz Paket',
  },
  'auth.subscriptionStatus': {
    fr: 'Statut de votre abonnement',
    ar: 'حالة اشتراكك',
    en: 'Subscription Status',
    es: 'Estado de su suscripción',
    de: 'Abonnementstatus',
    pt: 'Status da assinatura',
    it: 'Stato dell’abbonamento',
    tr: 'Abonelik Durumu',
  },
  'auth.planFreeDesc': {
    fr: 'Grille 24h + 3 bouquets actifs',
    ar: 'شبكة 24 ساعة + 3 باقات نشطة',
    en: '24h TV Grid + 3 active bouquets',
    es: 'Parrilla 24h + 3 bouquets activos',
    de: '24h TV-Raster + 3 aktive Bouquets',
    pt: 'Grade 24h + 3 bouquets ativos',
    it: 'Guida 24h + 3 bouquet attivi',
    tr: '24 saatlik TV ızgarası + 3 aktif paket',
  },
  'auth.planProDesc': {
    fr: 'EPG 7 jours + Replay + Tous les bouquets',
    ar: 'دليل 7 أيام + الإعادة + جميع الباقات',
    en: '7-day EPG + Replay + All bouquets',
    es: 'EPG 7 días + Replay + Todos los bouquets',
    de: '7-Tage-EPG + Replay + Alle Bouquets',
    pt: 'EPG 7 dias + Replay + Todos os bouquets',
    it: 'EPG 7 giorni + Replay + Tutti i bouquet',
    tr: '7 günlük EPG + Replay + Tüm paketler',
  },
  'auth.signOutGuest': {
    fr: 'Se déconnecter (Mode Invité)',
    ar: 'تسجيل الخروج (وضع الزائر)',
    en: 'Sign out (Guest Mode)',
    es: 'Cerrar sesión (Modo Invitado)',
    de: 'Abmelden (Gastmodus)',
    pt: 'Sair (Modo Convidado)',
    it: 'Esci (Modalità Ospite)',
    tr: 'Çıkış Yap (Misafir Modu)',
  },
  'auth.continueBtn': {
    fr: 'Continuer',
    ar: 'متابعة',
    en: 'Continue',
    es: 'Continuar',
    de: 'Weiter',
    pt: 'Continuar',
    it: 'Continua',
    tr: 'Devam Et',
  },
  'auth.close': {
    fr: 'Fermer',
    ar: 'إغلاق',
    en: 'Close',
    es: 'Cerrar',
    de: 'Schließen',
    pt: 'Fechar',
    it: 'Chiudi',
    tr: 'Kapat',
  },
  'auth.errorInvalidEmail': {
    fr: 'Veuillez saisir une adresse e-mail valide.',
    ar: 'يرجى إدخال عنوان بريد إلكتروني صالح.',
    en: 'Please enter a valid email address.',
    es: 'Por favor, introduce un correo electrónico válido.',
    de: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    pt: 'Por favor, insira um endereço de e-mail válido.',
    it: 'Inserisci un indirizzo email valido.',
    tr: 'Lütfen geçerli bir e-posta adresi girin.',
  },
  'auth.errorGoogleOAuth': {
    fr: 'Erreur lors de la connexion Google OAuth.',
    ar: 'حدث خطأ أثناء تسجيل الدخول عبر Google OAuth.',
    en: 'Google OAuth sign-in error.',
    es: 'Error al iniciar sesión con Google OAuth.',
    de: 'Fehler bei der Google OAuth-Anmeldung.',
    pt: 'Erro ao fazer login com Google OAuth.',
    it: 'Errore durante l’accesso Google OAuth.',
    tr: 'Google OAuth ile giriş yaparken hata oluştu.',
  },
  'auth.errorSupabase': {
    fr: 'Erreur lors de la connexion Supabase.',
    ar: 'حدث خطأ أثناء الاتصال بالخادم.',
    en: 'Supabase sign-in error.',
    es: 'Error al conectar con Supabase.',
    de: 'Fehler bei der Supabase-Verbindung.',
    pt: 'Erro ao conectar ao Supabase.',
    it: 'Errore di connessione a Supabase.',
    tr: 'Sunucu bağlantısında hata oluştu.',
  },
};

/**
 * Fonction globale de traduction i18n dynamique (supporte les clés `auth.*`, `reminders.*` et les clés `Translations`)
 */
export function t(
  key: ReminderTranslationKey | AuthTranslationKey | keyof Translations,
  lang?: AppLanguage,
  params?: Record<string, string | number>
): string {
  const targetLang = lang || currentActiveLanguage;
  const fallbackLang: AppLanguage =
    targetLang === 'es_latam'
      ? 'es'
      : targetLang === 'pt_br'
      ? 'pt'
      : targetLang;

  if (key === 'reminders.programmed' && params?.count !== undefined) {
    const countNum = Number(params.count) || 0;
    const baseWord =
      REMINDERS_I18N['reminders.programmed'][targetLang] ||
      REMINDERS_I18N['reminders.programmed'][fallbackLang] ||
      REMINDERS_I18N['reminders.programmed'].fr;
    if (targetLang === 'ar') {
      return `${baseWord} ${countNum}`;
    }
    if (targetLang === 'fr') {
      return `${countNum} programmé${countNum > 1 ? 's' : ''}`;
    }
    if (targetLang === 'es' || targetLang === 'es_latam') {
      return `${countNum} programado${countNum > 1 ? 's' : ''}`;
    }
    if (targetLang === 'pt' || targetLang === 'pt_br') {
      return `${countNum} agendado${countNum > 1 ? 's' : ''}`;
    }
    if (targetLang === 'it') {
      return `${countNum} programmat${countNum > 1 ? 'i' : 'o'}`;
    }
    if (targetLang === 'nl') {
      return `${countNum} gepland${countNum > 1 ? 'e' : ''}`;
    }
    return `${countNum} ${baseWord}`;
  }

  const authEntry =
    AUTH_I18N[key as AuthTranslationKey]?.[targetLang] ||
    AUTH_I18N[key as AuthTranslationKey]?.[fallbackLang] ||
    AUTH_I18N[key as AuthTranslationKey]?.en ||
    AUTH_I18N[key as AuthTranslationKey]?.fr;

  const reminderEntry =
    REMINDERS_I18N[key as ReminderTranslationKey]?.[targetLang] ||
    REMINDERS_I18N[key as ReminderTranslationKey]?.[fallbackLang] ||
    REMINDERS_I18N[key as ReminderTranslationKey]?.en ||
    REMINDERS_I18N[key as ReminderTranslationKey]?.fr;

  let template =
    authEntry ??
    reminderEntry ??
    getTranslations(targetLang)[key as keyof Translations] ??
    String(key);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      template = template.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }

  return template;
}

const CATEGORY_FILTER_LABELS: Record<
  ContentCategoryFilter,
  Partial<Record<AppLanguage, string>>
> = {
  Tous: {
    fr: 'Tous',
    en: 'All',
    ar: 'الكل',
    es: 'Todos',
    de: 'Alle',
    pt: 'Todos',
    nl: 'Alle',
  },
  'Films & Séries': {
    fr: 'Films & Séries',
    en: 'Movies & Series',
    ar: 'أفلام ومسلسلات',
    es: 'Cine y Series',
    de: 'Filme & Serien',
    pt: 'Filmes e Séries',
    nl: 'Films & Series',
  },
  'Sport / Football': {
    fr: 'Sport / Football',
    en: 'Sports / Football',
    ar: 'رياضة / كرة قدم',
    es: 'Deportes / Fútbol',
    de: 'Sport / Fußball',
    pt: 'Esportes / Futebol',
    nl: 'Sport / Voetbal',
  },
  Documentaires: {
    fr: 'Documentaires & Culture',
    en: 'Documentaries & Culture',
    ar: 'وثائقيات وثقافة',
    es: 'Documentales y Cultura',
    de: 'Dokus & Kultur',
    pt: 'Documentários e Cultura',
    nl: 'Documentaires & Cultuur',
  },
  'Actualités / News': {
    fr: 'Actualités / News',
    en: 'News & Current Affairs',
    ar: 'أخبار ومعلومات',
    es: 'Noticias y Actualidad',
    de: 'Nachrichten / News',
    pt: 'Notícias e Jornalismo',
    nl: 'Nieuws & Actualiteiten',
  },
  'Jeunesse / Enfants': {
    fr: 'Jeunesse / Enfants',
    en: 'Kids & Animation',
    ar: 'أطفال ورسوم متحركة',
    es: 'Infantil y Animación',
    de: 'Kinder & Jugend',
    pt: 'Infantil e Desenhos',
    nl: 'Kinderen & Jeugd',
  },
  'Musique & Divertissement': {
    fr: 'Musique & Divertissement',
    en: 'Music & Entertainment',
    ar: 'موسيقى وترفيه',
    es: 'Música y Entretenimiento',
    de: 'Musik & Unterhaltung',
    pt: 'Música e Entretenimento',
    nl: 'Muziek & Amusement',
  },
};

export function translateCategoryFilter(
  cat: ContentCategoryFilter,
  lang?: AppLanguage
): string {
  const l = lang || currentActiveLanguage;
  const lookupLang = l === 'es_latam' ? 'es' : l === 'pt_br' ? 'pt' : l;
  return (
    CATEGORY_FILTER_LABELS[cat]?.[lookupLang] ||
    CATEGORY_FILTER_LABELS[cat]?.[l] ||
    CATEGORY_FILTER_LABELS[cat]?.en ||
    CATEGORY_FILTER_LABELS[cat]?.fr ||
    cat
  );
}

export const translateCategoryLabel = translateCategoryFilter;

const SUB_GENRE_LABELS: Record<
  ChannelGroup,
  Partial<Record<AppLanguage, string>>
> = {
  Tous: {
    fr: 'Tous les genres',
    en: 'All genres',
    ar: 'جميع الأنواع',
    es: 'Todos los géneros',
    de: 'Alle Genres',
    pt: 'Todos os gêneros',
    nl: 'Alle genres',
  },
  Toutes: {
    fr: 'Tous les genres',
    en: 'All genres',
    ar: 'جميع الأنواع',
    es: 'Todos los géneros',
    de: 'Alle Genres',
    pt: 'Todos os gêneros',
    nl: 'Alle genres',
  },
  'Sport / Football': {
    fr: 'Sport / Football',
    en: 'Sports / Football',
    ar: 'رياضة / كرة قدم',
    es: 'Deportes / Fútbol',
    de: 'Sport / Fußball',
    pt: 'Esportes / Futebol',
    nl: 'Sport / Voetbal',
  },
  Documentaires: {
    fr: 'Documentaires & Culture',
    en: 'Documentaries & Culture',
    ar: 'وثائقيات وثقافة',
    es: 'Documentales y Cultura',
    de: 'Dokus & Kultur',
    pt: 'Documentários e Cultura',
    nl: 'Documentaires & Cultuur',
  },
  'Actualités / News': {
    fr: 'Actualités / News',
    en: 'News & Current Affairs',
    ar: 'أخبار ومعلومات',
    es: 'Noticias y Actualidad',
    de: 'Nachrichten / News',
    pt: 'Notícias e Jornalismo',
    nl: 'Nieuws & Actualiteiten',
  },
  'Jeunesse / Enfants': {
    fr: 'Jeunesse / Enfants',
    en: 'Kids & Animation',
    ar: 'أطفال ورسوم متحركة',
    es: 'Infantil y Animación',
    de: 'Kinder & Jugend',
    pt: 'Infantil e Desenhos',
    nl: 'Kinderen & Jeugd',
  },
  'Musique & Divertissement': {
    fr: 'Musique & Divertissement',
    en: 'Music & Entertainment',
    ar: 'موسيقى وترفيه',
    es: 'Música y Entretenimiento',
    de: 'Musik & Unterhaltung',
    pt: 'Música e Entretenimento',
    nl: 'Muziek & Amusement',
  },
  'Cinéma Premières': {
    fr: 'Cinéma Premières',
    en: 'Cinema Premieres',
    ar: 'أفلام العرض الأول',
    es: 'Cine Estrenos',
    de: 'Kino-Premieren',
    pt: 'Cinema Estreias',
    nl: 'Film Premières',
  },
  'Séries TV & US': {
    fr: 'Séries TV & US',
    en: 'TV & US Series',
    ar: 'مسلسلات تلفزيونية وأمريكية',
    es: 'Series TV y EE.UU.',
    de: 'TV- & US-Serien',
    pt: 'Séries TV e EUA',
    nl: 'TV-series & VS',
  },
  'Action & Thriller': {
    fr: 'Action & Thriller',
    en: 'Action & Thriller',
    ar: 'أكشن وإثارة',
    es: 'Acción y Thriller',
    de: 'Action & Thriller',
    pt: 'Ação e Suspense',
    nl: 'Actie & Thriller',
  },
  'Comédie & Famille': {
    fr: 'Comédie & Famille',
    en: 'Comedy & Family',
    ar: 'كوميديا وعائلة',
    es: 'Comedia y Familia',
    de: 'Komödie & Familie',
    pt: 'Comédia e Família',
    nl: 'Komedie & Familie',
  },
  'Classiques & Culte': {
    fr: 'Classiques & Culte',
    en: 'Classics & Cult',
    ar: 'أفلام كلاسيكية',
    es: 'Clásicos y Culto',
    de: 'Klassiker & Kult',
    pt: 'Clássicos e Cult',
    nl: 'Klassiekers & Cult',
  },
};

export function translateSubGenreGroup(
  grp: ChannelGroup,
  lang?: AppLanguage
): string {
  const l = lang || currentActiveLanguage;
  const lookupLang = l === 'es_latam' ? 'es' : l === 'pt_br' ? 'pt' : l;
  return (
    SUB_GENRE_LABELS[grp]?.[lookupLang] ||
    SUB_GENRE_LABELS[grp]?.[l] ||
    SUB_GENRE_LABELS[grp]?.en ||
    SUB_GENRE_LABELS[grp]?.fr ||
    grp
  );
}

export const translateGroupLabel = translateSubGenreGroup;

export function translateSatelliteFilter(
  sat: SatelliteFilter,
  lang?: AppLanguage
): string {
  const l = lang || currentActiveLanguage;
  if (sat === 'Tous') {
    return CATEGORY_FILTER_LABELS.Tous[l] || 'Tous';
  }
  if (sat === "Badr / Es'hailSat 26°E" || sat === 'Badr 26°E') {
    return 'Badr 26°E';
  }
  if (sat === 'Star One D2 70°W' || sat === 'Star One 70°W') {
    return 'Star One 70°W';
  }
  if (
    sat === 'Intelsat 43.1°W / SES-6 40.5°W' ||
    sat === 'Intelsat 43.1°W & SES-6 40.5°W' ||
    sat === 'SES-6 40.5°W'
  ) {
    return 'SES-6 40.5°W';
  }
  return sat;
}

export const translateSatelliteLabel = translateSatelliteFilter;

/**
 * Sanitizer universel pour nettoyer dynamiquement les noms de bouquets et supprimer toute redondance
 * avec le nom du satellite ou sa position orbitale.
 * Exemples :
 * - "Astra Canal+ France" -> "Canal+ France"
 * - "Hotbird Bis TV/Rai" -> "Bis TV/Rai"
 * - "Astra TNT France" -> "TNT France"
 * - "Astra 19.2°E · Canal+ France" -> "Canal+ France"
 */
export function cleanBouquetName(
  bouquetName: string,
  satelliteName?: string
): string {
  if (!bouquetName) return '';
  let cleaned = bouquetName.trim();

  if (
    cleaned === 'Tous' ||
    cleaned === 'Toutes' ||
    cleaned === 'All' ||
    cleaned === 'Todos' ||
    cleaned === 'Tutti' ||
    cleaned === 'Alle' ||
    cleaned === 'Wszystkie' ||
    cleaned === 'الكل'
  ) {
    return cleaned;
  }

  // 1. Si le nom contient un séparateur explicite (· ou —) après un nom de satellite / position orbitale
  if (cleaned.includes('·')) {
    const parts = cleaned.split('·').map((p) => p.trim());
    if (
      parts.length >= 2 &&
      /(astra|hotbird|nilesat|badr|es'hailsat|hispasat|eutelsat|türksat|turksat|thor|intelsat|turkmen|monacosat|star\s*one|amazonas|ses-6|\d+(?:\.\d+)?°[ew])/i.test(
        parts[0]
      )
    ) {
      cleaned = parts.slice(1).join(' · ').trim();
    }
  }
  if (cleaned.includes('—')) {
    const parts = cleaned.split('—').map((p) => p.trim());
    if (
      parts.length >= 2 &&
      /(astra|hotbird|nilesat|badr|es'hailsat|hispasat|eutelsat|türksat|turksat|thor|intelsat|turkmen|monacosat|star\s*one|amazonas|ses-6|نايل\s*سات|بدر|أسترا|هوت\s*بيرد|هيسباسات|يوتلسات|توركسات|ثور|تركمان|موناكو|\d+(?:\.\d+)?°[ew])/i.test(
        parts[0]
      )
    ) {
      cleaned = parts.slice(1).join(' — ').trim();
    }
  }

  // 2. Si le format est "Satellite X°E (Nom du Bouquet)" -> extraire "Nom du Bouquet"
  const parenLeadingSatMatch = cleaned.match(
    /^(?:Astra|Hotbird|Nilesat|Badr(?:\s*\/\s*Es'hailSat)?|Hispasat|Eutelsat|Türksat|Turksat|Thor|Intelsat|TurkmenÄlem|MonacoSat|Star\s*One(?:\s*D2)?|Amazonas|SES-6|نايل\s*سات|بدر|أسترا|هوت\s*بيرد|هيسباسات|ستار\s*ون|أمازوناس|إنتلسات)[^()]*\(([^()]+)\)$/i
  );
  if (parenLeadingSatMatch && parenLeadingSatMatch[1]) {
    cleaned = parenLeadingSatMatch[1].trim();
  }

  // 3. Suppression dynamique basée sur le satellite actif / associé s'il est fourni
  if (satelliteName && satelliteName !== 'Tous') {
    const satTokens = satelliteName
      .replace(/[()]/g, ' ')
      .split(/[\s/&,·-]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 3);

    for (const token of satTokens) {
      const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const prefixRegex = new RegExp(`^${escaped}\\s+`, 'i');
      cleaned = cleaned.replace(prefixRegex, '').trim();
    }
  }

  // 4. Suppression des préfixes satellites connus en début de chaîne (FR / EN / ES / AR...)
  cleaned = cleaned
    .replace(
      /^(?:Astra(?:\s+19\.2°E|\s+23\.5°E)?|Hotbird(?:\s+13°E)?|Nilesat(?:\s+7°W)?|Badr(?:\s*\/\s*Es'hailSat)?(?:\s+26°E)?|Hispasat(?:\s+30°W)?|Eutelsat(?:\s+5°W|\s+16°E|\s+7°E)?|Türksat(?:\s+42°E)?|Turksat(?:\s+42°E)?|Thor(?:\s+0\.8°W)?|Intelsat(?:\s+10-02|\s+43\.1°W)?|TurkmenÄlem(?:\s+52°E)?|MonacoSat(?:\s+52°E)?|Star\s+One(?:\s+D2)?(?:\s+70°W)?|Amazonas(?:\s+61°W)?|SES-6(?:\s+40\.5°W)?)\s+/i,
      ''
    )
    .replace(
      /^(?:نايل\s*سات|نيلسات|بدر|أسترا|هوت\s*بيرد|هيسباسات|يوتلسات|توركسات|ثور)\s+/i,
      ''
    )
    .trim();

  // 5. Suppression des mentions satellites redondantes entre parenthèses en fin de libellé
  cleaned = cleaned
    .replace(
      /\s*\((?:Hotbird(?:\s*13°E)?|Astra(?:\s*19\.2°E|\s*23\.5°E)?|Nilesat(?:\s*7°W)?|Badr(?:\s*26°E)?|Hispasat(?:\s*30°W)?|30°W|19\.2°E|23\.5°E|13°E|7°W|26°E|16°E|42°E|52°E|0\.8°W|أسترا\s*19\.2°E|هوت\s*بيرد\s*13°E)\)\s*$/i,
      ''
    )
    .replace(/\s+30°W$/i, '')
    .trim();

  return cleaned || bouquetName.trim();
}

export const sanitizeBouquetDisplayName = cleanBouquetName;

export function translateBouquetFilter(
  bq: BouquetFilter,
  lang?: AppLanguage,
  satelliteContext?: string
): string {
  const l = lang || currentActiveLanguage;
  if (bq === 'Tous') {
    return CATEGORY_FILTER_LABELS.Tous[l] || 'Tous';
  }
  return cleanBouquetName(bq, satelliteContext);
}

export const translateBouquetLabel = translateBouquetFilter;

const COUNTRY_FILTER_LABELS: Record<
  CountryCode,
  Partial<Record<AppLanguage, string>>
> =
  {
    Tous: {
      fr: 'Tous',
      en: 'All',
      ar: 'الكل',
      es: 'Todos',
      de: 'Alle',
      pt: 'Todos',
    },
    AR: {
      fr: '🇦🇷 Argentine',
      en: '🇦🇷 Argentina',
      ar: '🇦🇷 الأرجنتين',
      es: '🇦🇷 Argentina',
      de: '🇦🇷 Argentinien',
      pt: '🇦🇷 Argentina',
    },
    SA: {
      fr: '🇸🇦 Monde Arabe · Nilesat & Badr',
      en: '🇸🇦 Arab World · Nilesat & Badr',
      ar: '🇸🇦 نايل سات 7°W وبدر 26°E',
      es: '🇸🇦 Mundo Árabe · Nilesat y Badr',
      de: '🇸🇦 Arabische Welt · Nilesat & Badr',
      pt: '🇸🇦 Mundo Árabe · Nilesat e Badr',
    },
    MX: {
      fr: '🇲🇽 Mexique',
      en: '🇲🇽 Mexico',
      ar: '🇲🇽 المكسيك',
      es: '🇲🇽 México',
      de: '🇲🇽 Mexiko',
      pt: '🇲🇽 México',
    },
    CL: {
      fr: '🇨🇱 Chili',
      en: '🇨🇱 Chile',
      ar: '🇨🇱 تشيلي',
      es: '🇨🇱 Chile',
      de: '🇨🇱 Chile',
      pt: '🇨🇱 Chile',
    },
    CO: {
      fr: '🇨🇴 Colombie',
      en: '🇨🇴 Colombia',
      ar: '🇨🇴 كولومبيا',
      es: '🇨🇴 Colombia',
      de: '🇨🇴 Kolumbien',
      pt: '🇨🇴 Colômbia',
    },
    PE: {
      fr: '🇵🇪 Pérou',
      en: '🇵🇪 Peru',
      ar: '🇵🇪 بيرو',
      es: '🇵🇪 Perú',
      de: '🇵🇪 Peru',
      pt: '🇵🇪 Peru',
    },
    FR: {
      fr: 'FR · Astra Canal+',
      en: 'FR · Astra Canal+',
      ar: 'فرنسا · Astra Canal+',
      es: 'FR · Astra Canal+',
      de: 'FR · Astra Canal+',
      pt: 'FR · Astra Canal+',
    },
    ES: {
      fr: 'ES · Movistar+ / MEO / NOS',
      en: 'ES · Movistar+ / MEO / NOS',
      ar: 'إسبانيا · Movistar+ / MEO',
      es: 'ES · Movistar+ / MEO / NOS',
      de: 'ES · Movistar+ / MEO / NOS',
      pt: 'ES · Movistar+ / MEO / NOS',
    },
    PT: {
      fr: 'PT · Hispasat MEO / NOS',
      en: 'PT · Hispasat MEO / NOS',
      ar: 'البرتغال · MEO / NOS',
      es: 'PT · Hispasat MEO / NOS',
      de: 'PT · Hispasat MEO / NOS',
      pt: 'PT · Hispasat MEO / NOS',
    },
    DE: {
      fr: 'DE · Sky DE / DAZN',
      en: 'DE · Sky DE / DAZN',
      ar: 'ألمانيا · Sky DE / DAZN',
      es: 'DE · Sky DE / DAZN',
      de: 'DE · Sky DE / DAZN',
      pt: 'DE · Sky DE / DAZN',
    },
    IT: {
      fr: 'IT · Sky Italia / Rai',
      en: 'IT · Sky Italia / Rai',
      ar: 'إيطاليا · Sky Italia / Rai',
      es: 'IT · Sky Italia / Rai',
      de: 'IT · Sky Italia / Rai',
      pt: 'IT · Sky Italia / Rai',
    },
    PL: {
      fr: 'PL · Canal+ / Polsat / Eleven',
      en: 'PL · Canal+ / Polsat / Eleven',
      ar: 'بولندا · Canal+ / Polsat',
      es: 'PL · Canal+ / Polsat / Eleven',
      de: 'PL · Canal+ / Polsat / Eleven',
      pt: 'PL · Canal+ / Polsat / Eleven',
    },
    EU: {
      fr: 'EU · Europe Centrale & Balkans',
      en: 'EU · Central Europe & Balkans',
      ar: 'أوروبا الوسطى والبلقان',
      es: 'EU · Europa Central y Balcanes',
      de: 'EU · Mitteleuropa & Balkan',
      pt: 'EU · Europa Central e Balcãs',
    },
    BR: {
      fr: 'BR · Star One D2 70°W (Claro)',
      en: 'BR · Star One D2 70°W (Claro)',
      ar: 'البرازيل · Star One D2 70°W',
      es: 'BR · Star One D2 70°W (Claro)',
      de: 'BR · Star One D2 70°W (Claro)',
      pt: 'BR · Star One D2 70°W (Claro)',
    },
    LATAM: {
      fr: 'LATAM · Amazonas 61°W & Intelsat 43.1°W',
      en: 'LATAM · Amazonas 61°W & Intelsat 43.1°W',
      ar: 'أمريكا اللاتينية · 61°W & 43.1°W',
      es: 'LATAM · Amazonas 61°W y DirecTV 43.1°W',
      de: 'LATAM · Amazonas 61°W & Intelsat 43.1°W',
      pt: 'LATAM · Amazonas 61°W e Intelsat 43.1°W',
    },
    NL: {
      fr: 'NL · Canal Digitaal & TV Vlaanderen',
      en: 'NL · Canal Digitaal & TV Vlaanderen',
      ar: 'هولندا · Canal Digitaal & TV Vlaanderen',
      es: 'NL · Canal Digitaal & TV Vlaanderen',
      de: 'NL · Canal Digitaal & TV Vlaanderen',
      pt: 'NL · Canal Digitaal & TV Vlaanderen',
    },
    UK: {
      fr: 'UK · Sky UK & Freesat',
      en: 'UK · Sky UK & Freesat',
      ar: 'المملكة المتحدة · Sky UK & Freesat',
      es: 'UK · Sky UK & Freesat',
      de: 'UK · Sky UK & Freesat',
      pt: 'UK · Sky UK & Freesat',
    },
    Autre: {
      fr: 'Autre',
      en: 'Other',
      ar: 'أخرى',
      es: 'Otro',
      de: 'Andere',
      pt: 'Outro',
    },
  };

export function translateCountryFilter(
  c: CountryCode,
  lang?: AppLanguage
): string {
  const l = lang || currentActiveLanguage;
  const lookupLang = l === 'es_latam' ? 'es' : l === 'pt_br' ? 'pt' : l;
  return (
    COUNTRY_FILTER_LABELS[c]?.[lookupLang] ||
    COUNTRY_FILTER_LABELS[c]?.[l] ||
    COUNTRY_FILTER_LABELS[c]?.en ||
    COUNTRY_FILTER_LABELS[c]?.fr ||
    c
  );
}

export const CHANNEL_COUNTRY_FLAGS: Record<ChannelCountryFilter, string> = {
  Tous: '🌍',
  TR: '🇹🇷',
  AL: '🇦🇱',
  SN: '🇸🇳',
  CI: '🇨🇮',
  CM: '🇨🇲',
  ML: '🇲🇱',
  FR: '🇫🇷',
  ES: '🇪🇸',
  PT: '🇵🇹',
  DE: '🇩🇪',
  IT: '🇮🇹',
  PL: '🇵🇱',
  RO: '🇷🇴',
  HU: '🇭🇺',
  RS: '🇷🇸',
  HR: '🇭🇷',
  TM: '🇹🇲',
  IR: '🇮🇷',
  SA: '🇸🇦',
  AR: '🇦🇷',
  MX: '🇲🇽',
  CL: '🇨🇱',
  CO: '🇨🇴',
  PE: '🇵🇪',
  BR: '🇧🇷',
  LATAM: '🌎',
  NL: '🇳🇱',
  UK: '🇬🇧',
};

const CHANNEL_COUNTRY_LABELS: Record<
  ChannelCountryFilter,
  Partial<Record<AppLanguage, string>>
> = {
  Tous: {
    fr: 'Tous',
    en: 'All',
    ar: 'الكل',
    es: 'Todos',
    de: 'Alle',
    pt: 'Todos',
  },
  TR: {
    fr: 'Turquie',
    en: 'Turkey',
    ar: 'تركيا',
    es: 'Turquía',
    de: 'Türkei',
    pt: 'Turquia',
  },
  AL: {
    fr: 'Albanie',
    en: 'Albania',
    ar: 'ألبانيا',
    es: 'Albania',
    de: 'Albanien',
    pt: 'Albânia',
  },
  SN: {
    fr: 'Sénégal',
    en: 'Senegal',
    ar: 'السنغال',
    es: 'Senegal',
    de: 'Senegal',
    pt: 'Senegal',
  },
  CI: {
    fr: 'Côte d’Ivoire',
    en: 'Ivory Coast',
    ar: 'ساحل العاج',
    es: 'Costa de Marfil',
    de: 'Elfenbeinküste',
    pt: 'Costa do Marfim',
  },
  CM: {
    fr: 'Cameroun',
    en: 'Cameroon',
    ar: 'الكاميرون',
    es: 'Camerún',
    de: 'Kamerun',
    pt: 'Camarões',
  },
  ML: {
    fr: 'Mali',
    en: 'Mali',
    ar: 'مالي',
    es: 'Malí',
    de: 'Mali',
    pt: 'Mali',
  },
  FR: {
    fr: 'France',
    en: 'France',
    ar: 'فرنسا',
    es: 'Francia',
    de: 'Frankreich',
    pt: 'França',
  },
  ES: {
    fr: 'Espagne',
    en: 'Spain',
    ar: 'إسبانيا',
    es: 'España',
    de: 'Spanien',
    pt: 'Espanha',
  },
  PT: {
    fr: 'Portugal',
    en: 'Portugal',
    ar: 'البرتغال',
    es: 'Portugal',
    de: 'Portugal',
    pt: 'Portugal',
  },
  DE: {
    fr: 'Allemagne',
    en: 'Germany',
    ar: 'ألمانيا',
    es: 'Alemania',
    de: 'Deutschland',
    pt: 'Alemanha',
  },
  IT: {
    fr: 'Italie',
    en: 'Italy',
    ar: 'إيطاليا',
    es: 'Italia',
    de: 'Italien',
    pt: 'Itália',
  },
  PL: {
    fr: 'Pologne',
    en: 'Poland',
    ar: 'بولندا',
    es: 'Polonia',
    de: 'Polen',
    pt: 'Polônia',
  },
  RO: {
    fr: 'Roumanie',
    en: 'Romania',
    ar: 'رومانيا',
    es: 'Rumania',
    de: 'Rumänien',
    pt: 'Romênia',
  },
  HU: {
    fr: 'Hongrie',
    en: 'Hungary',
    ar: 'المجر',
    es: 'Hungría',
    de: 'Ungarn',
    pt: 'Hungria',
  },
  RS: {
    fr: 'Serbie / Balkans',
    en: 'Serbia / Balkans',
    ar: 'صربيا / البلقان',
    es: 'Serbia / Balcanes',
    de: 'Serbien / Balkan',
    pt: 'Sérvia / Balcãs',
  },
  HR: {
    fr: 'Croatie',
    en: 'Croatia',
    ar: 'كرواتيا',
    es: 'Croacia',
    de: 'Kroatien',
    pt: 'Croácia',
  },
  TM: {
    fr: 'Turkménistan',
    en: 'Turkmenistan',
    ar: 'تركمانستان',
    es: 'Turkmenistán',
    de: 'Turkmenistan',
    pt: 'Turcomenistão',
  },
  IR: {
    fr: 'Iran / Farsi',
    en: 'Iran / Persian',
    ar: 'إيران / فارسي',
    es: 'Irán / Persa',
    de: 'Iran / Persisch',
    pt: 'Irã / Persa',
  },
  AR: {
    fr: 'Argentine',
    en: 'Argentina',
    ar: 'الأرجنتين',
    es: 'Argentina',
    de: 'Argentinien',
    pt: 'Argentina',
  },
  SA: {
    fr: 'Arabie Saoudite / Monde Arabe',
    en: 'Saudi Arabia / Arab World',
    ar: 'المملكة العربية السعودية / العالم العربي',
    es: 'Arabia Saudita / Mundo Árabe',
    de: 'Saudi-Arabien / Arabische Welt',
    pt: 'Arábia Saudita / Mundo Árabe',
  },
  MX: {
    fr: 'Mexique',
    en: 'Mexico',
    ar: 'المكسيك',
    es: 'México',
    de: 'Mexiko',
    pt: 'México',
  },
  CL: {
    fr: 'Chili',
    en: 'Chile',
    ar: 'تشيلي',
    es: 'Chile',
    de: 'Chile',
    pt: 'Chile',
  },
  CO: {
    fr: 'Colombie',
    en: 'Colombia',
    ar: 'كولومبيا',
    es: 'Colombia',
    de: 'Kolumbien',
    pt: 'Colômbia',
  },
  PE: {
    fr: 'Pérou',
    en: 'Peru',
    ar: 'بيرو',
    es: 'Perú',
    de: 'Peru',
    pt: 'Peru',
  },
  BR: {
    fr: 'Brésil',
    en: 'Brazil',
    ar: 'البرازيل',
    es: 'Brasil',
    de: 'Brasilien',
    pt: 'Brasil',
  },
  LATAM: {
    fr: 'Amérique Latine',
    en: 'Latin America',
    ar: 'أمريكا اللاتينية',
    es: 'Latinoamérica',
    de: 'Lateinamerika',
    pt: 'América Latina',
  },
  NL: {
    fr: 'Pays-Bas & Flandre',
    en: 'Netherlands & Flanders',
    ar: 'هولندا وفلاندرز',
    es: 'Países Bajos y Flandes',
    de: 'Niederlande & Flandern',
    pt: 'Países Baixos e Flandres',
  },
  UK: {
    fr: 'Royaume-Uni',
    en: 'United Kingdom',
    ar: 'المملكة المتحدة',
    es: 'Reino Unido',
    de: 'Vereinigtes Königreich',
    pt: 'Reino Unido',
  },
};

export function getChannelCountryFlag(c: ChannelCountryFilter): string {
  return CHANNEL_COUNTRY_FLAGS[c] || '🌍';
}

export function translateChannelCountryFilter(
  c: ChannelCountryFilter,
  lang?: AppLanguage
): string {
  const l = lang || currentActiveLanguage;
  const lookupLang = l === 'es_latam' ? 'es' : l === 'pt_br' ? 'pt' : l;
  return (
    CHANNEL_COUNTRY_LABELS[c]?.[lookupLang] ||
    CHANNEL_COUNTRY_LABELS[c]?.[l] ||
    CHANNEL_COUNTRY_LABELS[c]?.en ||
    CHANNEL_COUNTRY_LABELS[c]?.fr ||
    c
  );
}

export function translateCountryFilterLabel(
  country: CountryCode,
  defaultLabel: string,
  lang?: AppLanguage
): string {
  const l = lang || currentActiveLanguage;
  return COUNTRY_FILTER_LABELS[country]?.[l] || defaultLabel;
}

const ORIGIN_COUNTRY_TRANSLATIONS: Record<
  string,
  Partial<Record<AppLanguage, string>>
> = {
  US: {
    fr: 'États-Unis / US',
    en: 'United States / US',
    ar: 'الولايات المتحدة / US',
    es: 'Estados Unidos / US',
    de: 'Vereinigte Staaten / US',
    pt: 'Estados Unidos / US',
  },
  GB: {
    fr: 'Royaume-Uni / GB',
    en: 'United Kingdom / GB',
    ar: 'المملكة المتحدة / GB',
    es: 'Reino Unido / GB',
    de: 'Vereinigtes Königreich / GB',
    pt: 'Reino Unido / GB',
  },
  FR: {
    fr: 'France / FR',
    en: 'France / FR',
    ar: 'فرنسا / FR',
    es: 'Francia / FR',
    de: 'Frankreich / FR',
    pt: 'França / FR',
  },
  DE: {
    fr: 'Allemagne / DE',
    en: 'Germany / DE',
    ar: 'ألمانيا / DE',
    es: 'Alemania / DE',
    de: 'Deutschland / DE',
    pt: 'Alemanha / DE',
  },
  ES: {
    fr: 'Espagne / ES',
    en: 'Spain / ES',
    ar: 'إسبانيا / ES',
    es: 'España / ES',
    de: 'Spanien / ES',
    pt: 'Espanha / ES',
  },
  IT: {
    fr: 'Italie / IT',
    en: 'Italy / IT',
    ar: 'إيطاليا / IT',
    es: 'Italia / IT',
    de: 'Italien / IT',
    pt: 'Itália / IT',
  },
  CA: {
    fr: 'Canada / CA',
    en: 'Canada / CA',
    ar: 'كندا / CA',
    es: 'Canadá / CA',
    de: 'Kanada / CA',
    pt: 'Canadá / CA',
  },
  AU: {
    fr: 'Australie / AU',
    en: 'Australia / AU',
    ar: 'أستراليا / AU',
    es: 'Australia / AU',
    de: 'Australien / AU',
    pt: 'Austrália / AU',
  },
  JP: {
    fr: 'Japon / JP',
    en: 'Japan / JP',
    ar: 'اليابان / JP',
    es: 'Japón / JP',
    de: 'Japan / JP',
    pt: 'Japão / JP',
  },
  KR: {
    fr: 'Corée du Sud / KR',
    en: 'South Korea / KR',
    ar: 'كوريا الجنوبية / KR',
    es: 'Corea del Sur / KR',
    de: 'Südkorea / KR',
    pt: 'Coreia do Sul / KR',
  },
  BR: {
    fr: 'Brésil / BR',
    en: 'Brazil / BR',
    ar: 'البرازيل / BR',
    es: 'Brasil / BR',
    de: 'Brasilien / BR',
    pt: 'Brasil / BR',
  },
  AR: {
    fr: 'Argentine / AR',
    en: 'Argentina / AR',
    ar: 'الأرجنتين / AR',
    es: 'Argentina / AR',
    de: 'Argentinien / AR',
    pt: 'Argentina / AR',
  },
  MX: {
    fr: 'Mexique / MX',
    en: 'Mexico / MX',
    ar: 'المكسيك / MX',
    es: 'México / MX',
    de: 'Mexiko / MX',
    pt: 'México / MX',
  },
  PL: {
    fr: 'Pologne / PL',
    en: 'Poland / PL',
    ar: 'بولندا / PL',
    es: 'Polonia / PL',
    de: 'Polen / PL',
    pt: 'Polônia / PL',
  },
};

export function translateOriginCountry(
  rawOrigin: string | undefined,
  lang?: AppLanguage
): string | undefined {
  if (!rawOrigin) return undefined;
  const l = lang || currentActiveLanguage;
  if (l === 'fr') return rawOrigin;

  for (const [iso, map] of Object.entries(ORIGIN_COUNTRY_TRANSLATIONS)) {
    if (
      rawOrigin.endsWith(`/ ${iso}`) ||
      rawOrigin.toUpperCase() === iso ||
      rawOrigin === map.fr
    ) {
      return map[l] || rawOrigin;
    }
  }
  return rawOrigin;
}

const GENRE_TERM_TRANSLATIONS: Record<
  string,
  Partial<Record<AppLanguage, string>>
> = {
  'Série TV': {
    fr: 'Série TV',
    en: 'TV Series',
    ar: 'مسلسل تلفزيوني',
    es: 'Serie de TV',
    de: 'TV-Serie',
    pt: 'Série de TV',
  },
  Documentaire: {
    fr: 'Documentaire',
    en: 'Documentary',
    ar: 'وثائقي',
    es: 'Documental',
    de: 'Dokumentation',
    pt: 'Documentário',
  },
  'Sport / Football': {
    fr: 'Sport / Football',
    en: 'Sports / Football',
    ar: 'رياضة / كرة قدم',
    es: 'Deportes / Fútbol',
    de: 'Sport / Fußball',
    pt: 'Esportes / Futebol',
  },
  'Drame & Romance': {
    fr: 'Drame & Romance',
    en: 'Drama & Romance',
    ar: 'دراما ورومانسية',
    es: 'Drama y Romance',
    de: 'Drama & Romantik',
    pt: 'Drama e Romance',
  },
  Drame: {
    fr: 'Drame',
    en: 'Drama',
    ar: 'دراما',
    es: 'Drama',
    de: 'Drama',
    pt: 'Drama',
  },
  Action: {
    fr: 'Action',
    en: 'Action',
    ar: 'أكشن',
    es: 'Acción',
    de: 'Action',
    pt: 'Ação',
  },
  'Action & Aventure': {
    fr: 'Action & Aventure',
    en: 'Action & Adventure',
    ar: 'أكشن ومغامرة',
    es: 'Acción y Aventura',
    de: 'Action & Abenteuer',
    pt: 'Ação e Aventura',
  },
  Aventure: {
    fr: 'Aventure',
    en: 'Adventure',
    ar: 'مغامرة',
    es: 'Aventura',
    de: 'Abenteuer',
    pt: 'Aventura',
  },
  Comédie: {
    fr: 'Comédie',
    en: 'Comedy',
    ar: 'كوميديا',
    es: 'Comedia',
    de: 'Komödie',
    pt: 'Comédia',
  },
  'Thriller & Policier': {
    fr: 'Thriller & Policier',
    en: 'Crime & Thriller',
    ar: 'إثارة وجريمة',
    es: 'Suspense y Crimen',
    de: 'Krimi & Thriller',
    pt: 'Suspense e Policial',
  },
  Policier: {
    fr: 'Policier',
    en: 'Crime',
    ar: 'جريمة',
    es: 'Crimen',
    de: 'Krimi',
    pt: 'Policial',
  },
  Thriller: {
    fr: 'Thriller',
    en: 'Thriller',
    ar: 'إثارة',
    es: 'Suspense',
    de: 'Thriller',
    pt: 'Suspense',
  },
  'Science-Fiction': {
    fr: 'Science-Fiction',
    en: 'Sci-Fi',
    ar: 'خيال علمي',
    es: 'Ciencia Ficción',
    de: 'Sci-Fi',
    pt: 'Ficção Científica',
  },
  'Science-Fiction & Fantastique': {
    fr: 'Science-Fiction & Fantastique',
    en: 'Sci-Fi & Fantasy',
    ar: 'خيال علمي وفانتازيا',
    es: 'Ciencia Ficción y Fantasía',
    de: 'Sci-Fi & Fantasy',
    pt: 'Ficção Científica e Fantasia',
  },
  Fantastique: {
    fr: 'Fantastique',
    en: 'Fantasy',
    ar: 'فانتازيا',
    es: 'Fantasía',
    de: 'Fantasy',
    pt: 'Fantasia',
  },
  Horreur: {
    fr: 'Horreur',
    en: 'Horror',
    ar: 'رعب',
    es: 'Terror',
    de: 'Horror',
    pt: 'Terror',
  },
  Animation: {
    fr: 'Animation',
    en: 'Animation',
    ar: 'رسوم متحركة',
    es: 'Animación',
    de: 'Animation',
    pt: 'Animação',
  },
  Famille: {
    fr: 'Famille',
    en: 'Family',
    ar: 'عائلي',
    es: 'Familia',
    de: 'Familie',
    pt: 'Família',
  },
  Histoire: {
    fr: 'Histoire',
    en: 'History',
    ar: 'تاريخي',
    es: 'Historia',
    de: 'Historie',
    pt: 'História',
  },
  Guerre: {
    fr: 'Guerre',
    en: 'War',
    ar: 'حرب',
    es: 'Bélica',
    de: 'Kriegsfilm',
    pt: 'Guerra',
  },
  Mystère: {
    fr: 'Mystère',
    en: 'Mystery',
    ar: 'غموض',
    es: 'Misterio',
    de: 'Mystery',
    pt: 'Mistério',
  },
  'Cinéma & Série TV': {
    fr: 'Cinéma & Série TV',
    en: 'Movies & TV Series',
    ar: 'أفلام ومسلسلات',
    es: 'Cine y Series TV',
    de: 'Film & TV-Serie',
    pt: 'Filmes e Séries de TV',
  },
};

export function translateDynamicGenre(
  rawGenre: string | undefined,
  lang?: AppLanguage
): string {
  if (!rawGenre) return '';
  const l = lang || currentActiveLanguage;
  if (l === 'fr') return rawGenre;

  return rawGenre
    .split(',')
    .map((part) => {
      const trimmed = part.trim();
      const subParts = trimmed.split(' · ').map((sp) => {
        const cleanSp = sp.trim();
        return GENRE_TERM_TRANSLATIONS[cleanSp]?.[l] || cleanSp;
      });
      return subParts.join(' · ');
    })
    .join(', ');
}

export function getBouquetLocalizedText(
  id: EpgBouquetId,
  lang: AppLanguage,
  defaultLabel: string,
  defaultDesc: string
): { label: string; description: string } {
  const map: Partial<
    Record<
      EpgBouquetId,
      Partial<Record<AppLanguage, { label: string; description: string }>>
    >
  > = {
    nilesat_osn_mbc: {
      en: {
        label: 'Nilesat 7°W — Arabic & Cinema Bouquets (MBC, OSN, Rotana)',
        description:
          'Nilesat 7°W: MBC 2, MBC Action, MBC Max, MBC Drama, OSN Movies/Series, Rotana Cinema, Dubai One & Al Jazeera Doc',
      },
      ar: {
        label: 'نايل سات 7°W — الباقات العربية والسينمائية (MBC، OSN، روتانا)',
        description:
          'نايل سات 7°W: قنوات MBC 2 و MBC Action و MBC Max وباقة OSN للأفلام والمسلسلات وروتانا سينما ودبي ون',
      },
      es: {
        label: 'Nilesat 7°W — Bouquets Árabes (MBC, OSN, Rotana)',
        description:
          'Nilesat 7°W: MBC 2/Action/Max, OSN Movies/Series, Rotana Cinema, Dubai One',
      },
      de: {
        label: 'Nilesat 7°W — Arabische Bouquets (MBC, OSN, Rotana)',
        description:
          'Nilesat 7°W: MBC 2/Action/Max, OSN Movies/Series, Rotana Cinema, Dubai One',
      },
      pt: {
        label: 'Nilesat 7°W — Bouquets Árabes (MBC, OSN, Rotana)',
        description:
          'Nilesat 7°W: MBC 2/Action/Max, OSN Movies/Series, Rotana Cinema, Dubai One',
      },
    },
    badr_bein_ssc: {
      en: {
        label: 'Badr / Es\'hailSat 26°E — Sports & MENA (beIN Sports, SSC, Al Kass)',
        description:
          'Badr / Es\'hailSat 26°E: beIN Sports MENA 1-7 HD, beIN Premium 1-3, SSC Sports 1-5 HD, Al Kass 1-4 & AD Sports',
      },
      ar: {
        label: 'بدر / سهيل سات 26°E — باقات الرياضة (beIN Sports، SSC، الكأس)',
        description:
          'بدر / سهيل سات 26°E: قنوات beIN Sports MENA 1-7 HD و beIN Premium و SSC Sports 1-5 وقنوات الكأس وأبوظبي الرياضية',
      },
      es: {
        label: 'Badr / Es\'hailSat 26°E — Deportes y MENA (beIN Sports, SSC, Al Kass)',
        description:
          'Badr / Es\'hailSat 26°E: beIN Sports MENA, SSC Sports, Al Kass y AD Sports',
      },
    },
    astra_canal_fr: {
      en: {
        label: 'Canal+ France (Cinéma, Séries, Docs, Sport)',
        description:
          'Astra 19.2°E: Canal+ HD, Box Office, Grand Écran, Cinéma(s), Séries, Docs, Sport/Foot, Ciné+ OCS & beIN FR',
      },
      ar: {
        label: 'باقة Canal+ فرنسا (أفلام، مسلسلات، وثائقيات، رياضة)',
        description:
          'أسترا 19.2°E: باقة Canal+ الكاملة للأفلام والمسلسلات والوثائقيات والرياضة مع قنوات Ciné+ OCS',
      },
    },
    tnt_fr: {
      en: {
        label: 'TNT France (TF1, France 2/3/4/5, M6, Arte, W9, TMC, TFX...)',
        description:
          'Astra 19.2°E (TNTSAT / Canal+): TF1, France 2, France 3, France 4, France 5, M6, Arte, W9, TMC, TFX, NRJ12, LCP, BFMTV, CNEWS, CSTAR, Gulli, 6ter, RMC',
      },
      ar: {
        label: 'قنوات TNT الفرنسية (TF1، France 2/3/5، M6، Arte، W9، TMC...)',
        description:
          'أسترا 19.2°E: جميع قنوات TNT الوطنية الفرنسية (TF1، France 2/3/4/5، M6، Arte، W9، TMC، TFX، NRJ12، Gulli)',
      },
    },
    movistar_es: {
      en: {
        label: 'Movistar+ / DAZN España (Astra 19.2°E)',
        description:
          'Astra 19.2°E: Movistar Plus+ Estrenos/Acción/Series, M+ LaLiga, Liga de Campeones, DAZN 1-4 ES & Vamos',
      },
      ar: {
        label: 'باقة Movistar+ / DAZN إسبانيا (أسترا 19.2°E)',
        description:
          'أسترا 19.2°E: باقة Movistar+ للأفلام والمسلسلات والليغا ودوري الأبطال و DAZN ES',
      },
      es: {
        label: 'Movistar+ / DAZN España (Astra 19.2°E)',
        description:
          'Astra 19.2°E: Movistar Plus+ Estrenos, Acción, Comedia, Series, M+ LaLiga, Liga de Campeones y DAZN ES',
      },
    },
    hispasat_meo_nos: {
      en: {
        label: 'Hispasat 30°W — Meo, NOS, Movistar',
        description:
          'Hispasat 30°W: Meo, NOS, TVCine Top/Action/Edition/Emotion, Canal Hollywood, Sport TV 1-6, Eleven PT & Movistar',
      },
      ar: {
        label: 'هيسباسات 30°W — باقات Meo، NOS، Movistar',
        description:
          'هيسباسات 30°W: باقات Meo و NOS وقنوات TVCine و Sport TV 1-6 و Movistar',
      },
      es: {
        label: 'Hispasat 30°W — Meo, NOS, Movistar',
        description:
          'Hispasat 30°W: Meo, NOS, TVCine, Canal Hollywood, AXN, Sport TV 1-6 y Movistar',
      },
      pt: {
        label: 'Hispasat 30°W — Meo, NOS, Movistar',
        description:
          'Hispasat 30°W: Meo, NOS, TVCine Top/Action/Edition/Emotion, Canal Hollywood, Sport TV 1-6, BTV e Movistar',
      },
    },
    hotbird_bis_fr: {
      en: {
        label: 'Hotbird 13°E — Bis TV France',
        description:
          'Hotbird 13°E: Bis TV Panorama/Cinérama (TF1, France 2/3/4/5, M6, Arte, W9, TMC, TFX, RTL9, Action, AB1, Téva, Histoire, Science & Vie)',
      },
      ar: {
        label: 'هوت بيرد 13°E — باقة Bis TV الفرنسية',
        description:
          'هوت بيرد 13°E: باقة Bis TV الفرنسية (TF1، France 2/3/5، M6، Arte، RTL9، Action، AB1، Téva)',
      },
    },
    sky_de: {
      en: {
        label: 'Astra 19.2°E (Sky Deutschland, DAZN DE, ZDF/ARD)',
        description:
          'Germany: Sky Cinema Premiere/Action, Sky Atlantic, Warner TV, Sky Sport Bundesliga, DAZN 1/2 DE, ZDF/ARD',
      },
      ar: {
        label: 'أسترا 19.2°E (Sky ألمانيا، DAZN DE، ZDF/ARD)',
        description:
          'ألمانيا: قنوات Sky Cinema و Sky Atlantic و Warner TV والبوندسليغا و DAZN 1/2 DE',
      },
      de: {
        label: 'Astra 19.2°E (Sky Deutschland, DAZN DE, ZDF/ARD)',
        description:
          'Deutschland: Sky Cinema Premiere/Action, Sky Atlantic, Warner TV, Sky Sport Bundesliga, DAZN 1/2 DE, ZDF/ARD',
      },
    },
    sky_it: {
      en: {
        label: 'Hotbird 13°E (Sky Italia, Rai, Mediaset)',
        description:
          'Italy: Sky Cinema Uno/Due/Action, Sky Serie, Sky Sport Calcio/Uno, DAZN 1/2 IT, Rai & Mediaset',
      },
      ar: {
        label: 'هوت بيرد 13°E (Sky إيطاليا، Rai، Mediaset)',
        description:
          'إيطاليا: باقة Sky Cinema و Sky Serie و Sky Sport Calcio و DAZN IT و Rai و Mediaset',
      },
    },
    canal_pl: {
      en: {
        label: 'Hotbird 13°E (Canal+ Polska, Polsat Box, Eleven Sports)',
        description:
          'Poland: Canal+ Premium/Film/Sport, HBO 1-3, Cinemax, Eleven Sports 1-4, Polsat Box & FilmBox',
      },
      ar: {
        label: 'هوت بيرد 13°E (Canal+ بولندا، Polsat Box، Eleven Sports)',
        description:
          'بولندا: قنوات Canal+ و HBO 1-3 و Cinemax و Eleven Sports 1-4 و Polsat Box',
      },
    },
    eutelsat_16e_digitalb: {
      en: {
        label:
          'Eutelsat 16°E — DigitAlb, Total TV (Balkans), MAXtv / A1 Croatia, New World TV & Canal+ Réunion / Afrique',
        description:
          'Eutelsat 16°E: DigitAlb (Albania), Total TV (Balkans / Serbia / Croatia / Bosnia / Slovenia), MAXtv / A1 Croatia, New World TV (Africa), Canal+ Réunion / Africa & Other African / Francophone channels',
      },
      ar: {
        label:
          'يوتلسات 16°E — باقات DigitAlb، Total TV، MAXtv / A1 Croatia، New World TV و Canal+ Réunion / Afrique',
        description:
          'يوتلسات 16°E: باقات DigitAlb (ألبانيا)، Total TV (البلقان)، MAXtv / A1 Croatia، New World TV (أفريقيا)، Canal+ Réunion / Afrique وقنوات أفريقيا الفرنكوفونية',
      },
    },
    trt_network: {
      en: {
        label:
          'Türksat 42°E / Eutelsat 7°E — TRT Network (TRT 1 HD, TRT Haber HD, TRT Spor HD, TRT Spor 2, TRT World, TRT Çocuk, TRT Belgesel, TRT Müzik, TRT Avaz, TRT Türk)',
        description:
          'Official TRT Network Bouquet (Türksat 42°E / Eutelsat 7°E): TRT 1 HD, TRT Haber HD, TRT Spor HD, TRT Spor 2, TRT World, TRT Çocuk, TRT Belgesel, TRT Müzik, TRT Avaz, TRT Türk',
      },
      ar: {
        label:
          'توركسات 42°E / يوتلسات 7°E — باقة TRT Network الكاملة (TRT 1 HD، TRT Haber HD، TRT Spor HD، TRT Spor 2، TRT World، TRT Çocuk، TRT Belgesel، TRT Müzik، TRT Avaz، TRT Türk)',
        description:
          'باقة TRT Network التركية الرسمية الكاملة على Türksat 42°E / Eutelsat 7°E: TRT 1 HD و TRT Haber HD و TRT Spor HD و TRT Spor 2 و TRT World و TRT Çocuk و TRT Belgesel و TRT Müzik و TRT Avaz و TRT Türk',
      },
    },
    thor_08w_focussat: {
      en: {
        label: 'Thor 0.8°W / Intelsat 10-02 — Focus Sat (Romania), Direct One (Hungary), Digi TV',
        description:
          'Thor 0.8°W / Intelsat 10-02: Focus Sat (Romania), Direct One (Hungary), Digi TV, Pro TV, Digi Sport, HBO & FilmBox',
      },
      ar: {
        label: 'ثور 0.8°W / إنتلسات 10-02 — باقات Focus Sat (رومانيا)، Direct One (المجر)، Digi TV',
        description:
          'ثور 0.8°W / إنتلسات 10-02: باقات Focus Sat و Direct One و Digi TV و Pro TV و Digi Sport',
      },
    },
    turkmenalem_52e_alem: {
      en: {
        label:
          'TurkmenÄlem 52°E — Turkmen National Bouquet & Alem TV (Alem Sport 1 & 2 HD, Alem Cinema Premiere HD, Alem Discovery)',
        description:
          'TurkmenÄlem / MonacoSat 52°E: Turkmen National Bouquet (Altyn Asyr, Yaslyk, Miras, Turkmenistan Sport), Alem TV (Alem Sport 1 & 2 HD, Alem Cinema Premiere HD, Alem Discovery), Persiana Group, WNS Group & News',
      },
      ar: {
        label:
          'تركمان عالم 52°E — الباقة الوطنية التركمانية وباقة Alem TV (Alem Sport 1 & 2 HD، Alem Cinema، Alem Discovery)',
        description:
          'تركمان عالم 52°E: الباقة الوطنية التركمانية (Altyn Asyr، Yaslyk، Miras، Turkmenistan Sport) وباقة Alem TV الرياضية والسينمائية',
      },
    },
    monacosat_52e_persiana: {
      en: {
        label:
          'MonacoSat 52°E — Persiana Group, WNS Group & News (Iran International, Afghanistan International)',
        description:
          'MonacoSat / TurkmenÄlem 52°E: Persiana Group (Sports 1 & 2, Cinema, Series, Family, Junior, Comedy, Docs, Music), WNS Group (AVA Family/Series, FX 1 & 2, Avang TV, 4U Family, PMC Royale) & News (Iran Intl, Afghanistan Intl)',
      },
      ar: {
        label:
          'موناكو سات 52°E — مجموعة Persiana، مجموعة WNS وقنوات الأخبار (Iran International، Afghanistan International)',
        description:
          'موناكو سات 52°E: باقة Persiana الكاملة (Sports 1 & 2، Cinema، Series، Family، Junior، Comedy، Docs، Music) ومجموعة WNS (AVA، FX 1 & 2، Avang TV، 4U Family، PMC Royale)',
      },
    },
    eutelsat_16e_thor: {
      en: {
        label: 'Eutelsat 16°E — DigitAlb (Albania), Total TV (Balkans)',
        description:
          'Eutelsat 16°E: DigitAlb (Albania), Total TV (Balkans), SuperSport & Arena Sport',
      },
      ar: {
        label: 'يوتلسات 16°E — باقات DigitAlb و Total TV',
        description:
          'يوتلسات 16°E: باقات DigitAlb و Total TV و SuperSport',
      },
    },
    starone_70w_claro_br: {
      en: {
        label: 'Star One D2 70°W (Claro TV Brasil)',
        description:
          'Brazil: Claro TV HD, Telecine Premium/Action/Pipoca, HBO Brasil, SporTV 1-3, Premiere & ESPN Brasil',
      },
      ar: {
        label: 'ستار ون D2 70°W (Claro TV البرازيل)',
        description:
          'البرازيل: باقة Claro TV وقنوات Telecine و HBO Brasil و SporTV و Premiere و ESPN',
      },
      pt: {
        label: 'Star One D2 70°W (Claro TV Brasil)',
        description:
          'Brasil: Claro TV HD, Telecine Premium/Action/Pipoca/Cult, HBO Brasil, Cinemax, SporTV 1-3, Premiere e ESPN',
      },
    },
    amazonas_61w_latam: {
      en: {
        label: 'Amazonas 61°W (Vivo TV, Movistar TV LATAM)',
        description:
          'Latin America: Vivo TV & Movistar TV LATAM, HBO, TNT, Space, Warner, AXN, ESPN & Fox Sports',
      },
      ar: {
        label: 'أمازوناس 61°W (Vivo TV، Movistar TV أمريكا اللاتينية)',
        description:
          'أمريكا اللاتينية: باقات Vivo TV و Movistar TV LATAM وقنوات HBO و TNT و ESPN',
      },
      es: {
        label: 'Amazonas 61°W (Vivo TV, Movistar TV LATAM)',
        description:
          'Latinoamérica: Vivo TV y Movistar TV LATAM, HBO, Cinemax, TNT, Space, Warner, AXN, ESPN y Fox Sports',
      },
      pt: {
        label: 'Amazonas 61°W (Vivo TV, Movistar TV LATAM)',
        description:
          'América Latina: Vivo TV e Movistar TV LATAM, HBO, Cinemax, TNT, Space, Warner, AXN, ESPN e Fox Sports',
      },
    },
    intelsat_43w_directv: {
      en: {
        label: 'Intelsat 43.1°W & SES-6 40.5°W (DirecTV Latin America, Sky Brasil, Oi TV)',
        description:
          'South America: DirecTV Sports, Sky Brasil, Oi TV, TNT Sports, TyC Sports, Win Sports, Star & Universal',
      },
      ar: {
        label: 'إنتلسات 43.1°W و SES-6 40.5°W (DirecTV، Sky Brasil، Oi TV)',
        description:
          'أمريكا الجنوبية: باقات DirecTV Latin America و Sky Brasil و Oi TV و TNT Sports',
      },
      es: {
        label: 'Intelsat 43.1°W y SES-6 40.5°W (DirecTV Latin America, Sky Brasil, Oi TV)',
        description:
          'Sudamérica: DirecTV Sports, Sky Brasil, Oi TV, TNT Sports, TyC Sports, Win Sports, Star Channel y Universal',
      },
      pt: {
        label: 'Intelsat 43.1°W e SES-6 40.5°W (DirecTV Latin America, Sky Brasil, Oi TV)',
        description:
          'América do Sul: Sky Brasil, Oi TV, DirecTV Latin America, DirecTV Sports, TNT Sports, Star Channel e Universal',
      },
    },
  };

  const entry = map[id]?.[lang];
  return {
    label: sanitizeBouquetDisplayName(entry?.label || defaultLabel),
    description: entry?.description || defaultDesc,
  };
}

export function getCategoryLocalizedText(
  id: ThematicCategoryId,
  lang: AppLanguage,
  defaultLabel: string,
  defaultDesc: string
): { label: string; description: string } {
  const map: Record<
    ThematicCategoryId,
    Partial<Record<AppLanguage, { label: string; description: string }>>
  > = {
    'Films & Séries': {
      en: {
        label: 'Movies & TV Series',
        description:
          'First-run cinema, blockbusters, US/European TV series, thrillers & action',
      },
      ar: {
        label: 'أفلام ومسلسلات',
        description: 'أفلام العرض الأول، المسلسلات العالمية، الأكشن والإثارة',
      },
      es: {
        label: 'Cine y Series TV',
        description:
          'Estrenos de cine, taquillazos, series de TV, acción y suspense',
      },
      de: {
        label: 'Filme & Serien',
        description: 'Kino-Premieren, Blockbuster, US-Serien, Action & Thriller',
      },
      pt: {
        label: 'Filmes e Séries',
        description:
          'Estreias de cinema, blockbusters, séries de TV, ação e suspense',
      },
    },
    'Sport / Football': {
      en: {
        label: 'Sports / Live Football',
        description:
          'UEFA Champions League, Premier League, LaLiga, Serie A, Bundesliga, Brasileirão, Libertadores',
      },
      ar: {
        label: 'رياضة / كرة قدم مباشرة',
        description:
          'دوري أبطال أوروبا، الدوري الإنجليزي، الإسباني، الإيطالي، الألماني، السعودي والبرازيلي',
      },
      es: {
        label: 'Deportes / Fútbol en Vivo',
        description:
          'UEFA Champions League, LaLiga, Premier League, Serie A, Bundesliga, Libertadores',
      },
      de: {
        label: 'Sport / Live-Fußball',
        description:
          'UEFA Champions League, Bundesliga, Premier League, LaLiga, Serie A',
      },
      pt: {
        label: 'Esportes / Futebol ao Vivo',
        description:
          'Brasileirão, Libertadores, UEFA Champions League, Premier League, LaLiga, Serie A',
      },
    },
    Documentaires: {
      en: {
        label: 'Documentaries & Culture',
        description:
          'History, Science, Nature, Wildlife & Geopolitics (Nat Geo, Discovery, Planète+, Canal+ Docs)',
      },
      ar: {
        label: 'وثائقيات وثقافة',
        description: 'التاريخ، العلوم، الطبيعة والحياة البرية (Nat Geo، Discovery، الجزيرة الوثائقية)',
      },
      es: {
        label: 'Documentales y Cultura',
        description: 'Historia, Ciencia, Naturaleza y Geopolítica',
      },
      de: {
        label: 'Dokus & Kultur',
        description: 'Geschichte, Wissenschaft, Natur & Geopolitik',
      },
      pt: {
        label: 'Documentários e Cultura',
        description: 'História, Ciência, Natureza e Geopolítica',
      },
    },
    'Actualités / News': {
      en: {
        label: 'News & Current Affairs',
        description:
          'International & national news, debates, economy (Al Arabiya, Al Jazeera, Sky News, BFMTV, CNEWS, CNN, BBC)',
      },
      ar: {
        label: 'أخبار ومعلومات',
        description:
          'قنوات الأخبار والنقاشات والاقتصاد (العربية، الحدث، سكاي نيوز عربية، الجزيرة، فرانس 24، BBC)',
      },
      es: {
        label: 'Noticias y Actualidad',
        description: 'Información continua, debates y economía (24h, Euronews, CNN, BBC)',
      },
      de: {
        label: 'Nachrichten / News',
        description: 'Nachrichten, Debatten & Wirtschaft (Tagesschau24, n-tv, WELT, CNN, BBC)',
      },
      pt: {
        label: 'Notícias e Jornalismo',
        description: 'Jornalismo 24h, debates e economia (GloboNews, BandNews, CNN)',
      },
    },
    'Jeunesse / Enfants': {
      en: {
        label: 'Kids & Animation',
        description:
          'Cartoons, animated series & youth channels (Spacetoon, MBC 3, Gulli, Cartoon Network, Nickelodeon, Disney)',
      },
      ar: {
        label: 'أطفال ورسوم متحركة',
        description:
          'قنوات الأطفال والرسوم المتحركة (سبيستون، MBC 3، ماجد، كرتون نتورك، نيكلوديون)',
      },
      es: {
        label: 'Infantil y Animación',
        description: 'Dibujos animados y canales infantiles (Clan, Boing, Disney, Nickelodeon)',
      },
      de: {
        label: 'Kinder & Jugend',
        description: 'Zeichentrick & Kinderprogramm (KiKA, Super RTL, Disney, Nickelodeon)',
      },
      pt: {
        label: 'Infantil e Desenhos',
        description: 'Desenhos animados e programação infantil (Gloob, Cartoon Network, Nickelodeon)',
      },
    },
    'Musique & Divertissement': {
      en: {
        label: 'Music & Entertainment',
        description:
          'Music videos, concerts, talk shows, variety & general entertainment (Rotana Music, MTV, MBC 1, W9, TMC)',
      },
      ar: {
        label: 'موسيقى وترفيه',
        description:
          'قنوات الموسيقى والمنوعات والترفيه العائلي (روتانا موسيقى، وناسة، MBC 1، دبي، أبوظبي)',
      },
      es: {
        label: 'Música y Entretenimiento',
        description: 'Conciertos, videoclips, entretenimiento y variedades (MTV, Mezzo, Antena 3, Telecinco)',
      },
      de: {
        label: 'Musik & Unterhaltung',
        description: 'Musik, Konzerte, Shows & Unterhaltung (MTV, Deluxe Music, ProSieben, RTL)',
      },
      pt: {
        label: 'Música e Entretenimento',
        description: 'Videoclipes, shows, variedades e entretenimento (Multishow, Bis, MTV)',
      },
    },
    'Classiques & Culte': {
      en: {
        label: 'Classics & Cult Cinema',
        description: 'Masterpieces, heritage films, TCM, Cinemax 2, Sky Classics',
      },
      ar: {
        label: 'أفلام كلاسيكية وعالمية',
        description: 'روائع السينما العالمية والأفلام الكلاسيكية',
      },
      es: {
        label: 'Clásicos y Cine de Culto',
        description: 'Obras maestras del cine, TCM, Cinemax 2, Sky Classics',
      },
      de: {
        label: 'Klassiker & Kultfilme',
        description: 'Meisterwerke der Filmgeschichte, Sky Classics, KinoweltTV',
      },
      pt: {
        label: 'Clássicos e Cult',
        description: 'Obras-primas do cinema, Telecine Cult, TCM, Cinemax',
      },
    },
    'Jeunesse & Famille': {
      en: {
        label: 'Family & Animation',
        description: 'Family comedies, animated movies & adventure',
      },
      ar: {
        label: 'عائلي ورسوم متحركة',
        description: 'أفلام عائلية وكوميديا ورسوم متحركة',
      },
      es: {
        label: 'Familia y Animación',
        description: 'Comedias familiares, cine de animación y aventura',
      },
      de: {
        label: 'Familie & Animation',
        description: 'Familienkomödien, Animationsfilme & Abenteuer',
      },
      pt: {
        label: 'Família e Animação',
        description: 'Comédias familiares, filmes de animação e aventura',
      },
    },
  };

  const entry = map[id]?.[lang];
  return {
    label: entry?.label || defaultLabel,
    description: entry?.description || defaultDesc,
  };
}
