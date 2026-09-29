import {
  AppLanguage,
  BouquetFilter,
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
    label: 'Español (ES)',
    shortLabel: 'ES',
    tmdbLocale: 'es-ES',
    intlLocale: 'es-ES',
    wikiLang: 'es',
    itunesCountry: 'es',
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
    flag: '🇧🇷',
    label: 'Português (PT-BR)',
    shortLabel: 'PT-BR',
    tmdbLocale: 'pt-BR',
    intlLocale: 'pt-BR',
    wikiLang: 'pt',
    itunesCountry: 'br',
    translateTarget: 'pt',
    dir: 'ltr',
  },
];

export const SUPPORTED_LANGUAGES = LANGUAGE_OPTIONS;

let currentActiveLanguage: AppLanguage = 'fr';

export function getActiveLanguage(): AppLanguage {
  return currentActiveLanguage;
}

export function setActiveLanguage(lang: AppLanguage): void {
  currentActiveLanguage = lang;
  if (typeof document !== 'undefined') {
    const opt = getLanguageOption(lang);
    document.documentElement.lang = opt.code === 'pt' ? 'pt-BR' : opt.code;
    document.documentElement.dir = opt.dir;
  }
}

export function applyDocumentLanguageDir(lang: AppLanguage): void {
  setActiveLanguage(lang);
}

export function getLanguageOption(lang?: AppLanguage): LanguageOption {
  const target = lang || currentActiveLanguage;
  return (
    LANGUAGE_OPTIONS.find((l) => l.code === target) || LANGUAGE_OPTIONS[0]
  );
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

const TRANSLATIONS: Record<AppLanguage, Translations> = {
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
    searchPlaceholder:
      'Rechercher un film, une série, un match (ex: Real Madrid, The Rookie, Dune) ou une chaîne (OSN, MBC, Canal+, Movistar, Sky, Claro)...',
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
    searchPlaceholder:
      'Search a movie, TV show, live match (e.g., Real Madrid, The Rookie, Dune) or channel (OSN, MBC, Canal+, Movistar, Sky, Claro)...',
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
    searchPlaceholder:
      'ابحث عن فيلم، مسلسل، مباراة مباشرة (مثل: ريال مدريد، The Rookie) أو قناة (OSN، MBC، beIN، SSC، Canal+، Movistar)...',
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
    searchPlaceholder:
      'Buscar película, serie, partido en vivo (ej: Real Madrid, The Rookie, Dune) o canal (Movistar+, DAZN, Canal+, OSN, MBC, Claro, DirecTV)...',
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
    searchPlaceholder:
      'Film, Serie, Live-Spiel (z.B. Bayern, Real Madrid, The Rookie) oder Sender (Sky DE, DAZN, Canal+, Movistar, OSN) suchen...',
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
    searchPlaceholder:
      'Buscar filme, série, jogo ao vivo (ex: Flamengo, Real Madrid, The Rookie) ou canal (Claro TV, Sky Brasil, Vivo, DirecTV, OSN, Canal+)...',
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
};

export function getTranslations(lang?: AppLanguage): Translations {
  return TRANSLATIONS[lang || currentActiveLanguage] || TRANSLATIONS.fr;
}

const CATEGORY_FILTER_LABELS: Record<
  ContentCategoryFilter,
  Record<AppLanguage, string>
> = {
  Tous: {
    fr: 'Tous',
    en: 'All',
    ar: 'الكل',
    es: 'Todos',
    de: 'Alle',
    pt: 'Todos',
  },
  'Films & Séries': {
    fr: 'Films & Séries',
    en: 'Movies & Series',
    ar: 'أفلام ومسلسلات',
    es: 'Cine y Series',
    de: 'Filme & Serien',
    pt: 'Filmes e Séries',
  },
  'Sport / Football': {
    fr: 'Sport / Football',
    en: 'Sports / Football',
    ar: 'رياضة / كرة قدم',
    es: 'Deportes / Fútbol',
    de: 'Sport / Fußball',
    pt: 'Esportes / Futebol',
  },
  Documentaires: {
    fr: 'Documentaires & Culture',
    en: 'Documentaries & Culture',
    ar: 'وثائقيات وثقافة',
    es: 'Documentales y Cultura',
    de: 'Dokus & Kultur',
    pt: 'Documentários e Cultura',
  },
  'Actualités / News': {
    fr: 'Actualités / News',
    en: 'News & Current Affairs',
    ar: 'أخبار ومعلومات',
    es: 'Noticias y Actualidad',
    de: 'Nachrichten / News',
    pt: 'Notícias e Jornalismo',
  },
  'Jeunesse / Enfants': {
    fr: 'Jeunesse / Enfants',
    en: 'Kids & Animation',
    ar: 'أطفال ورسوم متحركة',
    es: 'Infantil y Animación',
    de: 'Kinder & Jugend',
    pt: 'Infantil e Desenhos',
  },
  'Musique & Divertissement': {
    fr: 'Musique & Divertissement',
    en: 'Music & Entertainment',
    ar: 'موسيقى وترفيه',
    es: 'Música y Entretenimiento',
    de: 'Musik & Unterhaltung',
    pt: 'Música e Entretenimento',
  },
};

export function translateCategoryFilter(
  cat: ContentCategoryFilter,
  lang?: AppLanguage
): string {
  const l = lang || currentActiveLanguage;
  return CATEGORY_FILTER_LABELS[cat]?.[l] || cat;
}

export const translateCategoryLabel = translateCategoryFilter;

const SUB_GENRE_LABELS: Record<ChannelGroup, Record<AppLanguage, string>> = {
  Tous: {
    fr: 'Tous les genres',
    en: 'All genres',
    ar: 'جميع الأنواع',
    es: 'Todos los géneros',
    de: 'Alle Genres',
    pt: 'Todos os gêneros',
  },
  Toutes: {
    fr: 'Tous les genres',
    en: 'All genres',
    ar: 'جميع الأنواع',
    es: 'Todos los géneros',
    de: 'Alle Genres',
    pt: 'Todos os gêneros',
  },
  'Sport / Football': {
    fr: 'Sport / Football',
    en: 'Sports / Football',
    ar: 'رياضة / كرة قدم',
    es: 'Deportes / Fútbol',
    de: 'Sport / Fußball',
    pt: 'Esportes / Futebol',
  },
  Documentaires: {
    fr: 'Documentaires & Culture',
    en: 'Documentaries & Culture',
    ar: 'وثائقيات وثقافة',
    es: 'Documentales y Cultura',
    de: 'Dokus & Kultur',
    pt: 'Documentários e Cultura',
  },
  'Actualités / News': {
    fr: 'Actualités / News',
    en: 'News & Current Affairs',
    ar: 'أخبار ومعلومات',
    es: 'Noticias y Actualidad',
    de: 'Nachrichten / News',
    pt: 'Notícias e Jornalismo',
  },
  'Jeunesse / Enfants': {
    fr: 'Jeunesse / Enfants',
    en: 'Kids & Animation',
    ar: 'أطفال ورسوم متحركة',
    es: 'Infantil y Animación',
    de: 'Kinder & Jugend',
    pt: 'Infantil e Desenhos',
  },
  'Musique & Divertissement': {
    fr: 'Musique & Divertissement',
    en: 'Music & Entertainment',
    ar: 'موسيقى وترفيه',
    es: 'Música y Entretenimiento',
    de: 'Musik & Unterhaltung',
    pt: 'Música e Entretenimento',
  },
  'Cinéma Premières': {
    fr: 'Cinéma Premières',
    en: 'Cinema Premieres',
    ar: 'أفلام العرض الأول',
    es: 'Cine Estrenos',
    de: 'Kino-Premieren',
    pt: 'Cinema Estreias',
  },
  'Séries TV & US': {
    fr: 'Séries TV & US',
    en: 'TV & US Series',
    ar: 'مسلسلات تلفزيونية وأمريكية',
    es: 'Series TV y EE.UU.',
    de: 'TV- & US-Serien',
    pt: 'Séries TV e EUA',
  },
  'Action & Thriller': {
    fr: 'Action & Thriller',
    en: 'Action & Thriller',
    ar: 'أكشن وإثارة',
    es: 'Acción y Thriller',
    de: 'Action & Thriller',
    pt: 'Ação e Suspense',
  },
  'Comédie & Famille': {
    fr: 'Comédie & Famille',
    en: 'Comedy & Family',
    ar: 'كوميديا وعائلة',
    es: 'Comedia y Familia',
    de: 'Komödie & Familie',
    pt: 'Comédia e Família',
  },
  'Classiques & Culte': {
    fr: 'Classiques & Culte',
    en: 'Classics & Cult',
    ar: 'أفلام كلاسيكية',
    es: 'Clásicos y Culto',
    de: 'Klassiker & Kult',
    pt: 'Clássicos e Cult',
  },
};

export function translateSubGenreGroup(
  grp: ChannelGroup,
  lang?: AppLanguage
): string {
  const l = lang || currentActiveLanguage;
  return SUB_GENRE_LABELS[grp]?.[l] || grp;
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
  return sat;
}

export const translateSatelliteLabel = translateSatelliteFilter;

export function translateBouquetFilter(
  bq: BouquetFilter,
  lang?: AppLanguage
): string {
  const l = lang || currentActiveLanguage;
  if (bq === 'Tous') {
    return CATEGORY_FILTER_LABELS.Tous[l] || 'Tous';
  }
  return bq;
}

export const translateBouquetLabel = translateBouquetFilter;

const COUNTRY_FILTER_LABELS: Record<CountryCode, Record<AppLanguage, string>> =
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
      fr: 'Nilesat 7°W & Badr 26°E',
      en: 'Nilesat 7°W & Badr 26°E',
      ar: 'نايل سات 7°W وبدر 26°E',
      es: 'Nilesat 7°W y Badr 26°E',
      de: 'Nilesat 7°W & Badr 26°E',
      pt: 'Nilesat 7°W e Badr 26°E',
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
      fr: 'EU · Eutelsat 16°E / Thor 0.8°W',
      en: 'EU · Eutelsat 16°E / Thor 0.8°W',
      ar: 'أوروبا · Eutelsat 16°E / Thor',
      es: 'EU · Eutelsat 16°E / Thor 0.8°W',
      de: 'EU · Eutelsat 16°E / Thor 0.8°W',
      pt: 'EU · Eutelsat 16°E / Thor 0.8°W',
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
  return COUNTRY_FILTER_LABELS[c]?.[l] || c;
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
  Record<AppLanguage, string>
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

const GENRE_TERM_TRANSLATIONS: Record<string, Record<AppLanguage, string>> = {
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
    eutelsat_16e_thor: {
      en: {
        label: 'Eutelsat 16°E / Thor 0.8°W (DigitAlb, Total TV, Focus Sat)',
        description:
          'Central Europe & Balkans: DigitAlb, Total TV, Focus Sat, HBO, Cinemax, FilmBox, Digi Sport & Arena Sport',
      },
      ar: {
        label: 'يوتلسات 16°E / ثور 0.8°W (DigitAlb، Total TV، Focus Sat)',
        description:
          'أوروبا الوسطى والبلقان: باقات DigitAlb و Total TV و Focus Sat و HBO و Digi Sport',
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
    label: entry?.label || defaultLabel,
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
