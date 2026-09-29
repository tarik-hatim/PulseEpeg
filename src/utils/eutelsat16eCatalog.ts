import {
  BouquetFilter,
  ChannelGroup,
  ContentCategoryFilter,
  CountryCode,
  EpgBouquetId,
  SatelliteFilter,
} from '../types/epg';

export interface SupplementalChannelSpec {
  id: string;
  displayName: string;
  contentCategory: Exclude<ContentCategoryFilter, 'Tous'>;
  group: Exclude<ChannelGroup, 'Tous'>;
  country: Exclude<CountryCode, 'Tous'>;
  satellite: Exclude<SatelliteFilter, 'Tous'>;
  orbitalPosition: string;
  bouquets: Exclude<BouquetFilter, 'Tous'>[];
  bouquetId: EpgBouquetId;
  audioTrackLabel: string;
  subtitleTrackLabel: string;
  scheduleTemplates: Array<{
    title: string;
    subTitle: string;
    description: string;
    category: string;
    durationMins: number;
  }>;
}

function classifyByTitleAndHint(
  name: string,
  hint?: 'sport' | 'cinema' | 'series' | 'doc' | 'news' | 'kids' | 'music' | 'general'
): {
  contentCategory: Exclude<ContentCategoryFilter, 'Tous'>;
  group: Exclude<ChannelGroup, 'Tous'>;
} {
  const lower = name.toLowerCase();
  if (
    hint === 'sport' ||
    /\b(supersport|tring\s*sport|sport\s*klub|arena\s*\d|arena\s*sport|sportska|nw\s*sport|canal\+\s*sport|canal\+\s*golf|l'équipe|l’équipe|equidia|seasons|bein\s*sports|rmc\s*sport|automoto|eurosport)\b/i.test(
      lower
    )
  ) {
    return {
      contentCategory: 'Sport / Football',
      group: 'Sport / Football',
    };
  }
  if (
    hint === 'kids' ||
    /\b(junior|çufo|cufo|bang\s*bang|rtl\s*kockica|pink\s*kids|pink\s*super\s*kids|nickelodeon|nick\s*jr|nicktoons|minimax|pikaboo|jimjam|mini\s*tv|canal\s*j|tivi5|canal\+\s*kids|piwi|télétoon|teletoon|mangas|tiji|gulli)\b/i.test(
      lower
    )
  ) {
    return {
      contentCategory: 'Jeunesse / Enfants',
      group: 'Jeunesse / Enfants',
    };
  }
  if (
    hint === 'doc' ||
    /\b(travel\s*channel|explorer\s*natyra|explorer\s*histori|explorer\s*shkenc|pink\s*pedia|discovery|history|national\s*geographic|viasat\s*nature|viasat\s*explore|viasat\s*history|crime.*investigation|planète|planete|trek|histoire\s*tv)\b/i.test(
      lower
    )
  ) {
    return {
      contentCategory: 'Documentaires',
      group: 'Documentaires',
    };
  }
  if (
    hint === 'news' ||
    /\b(scan\b|euronews|a2\s*cnn|city\s*news|fax\s*news|syri\s*tv|news\s*24|ora\s*news|top\s*news|n1\s*bosna|nw\s*info|nw\s*news|nw\s*economie|bfm\s*tv|bbc\s*news|cgtn|lcp|public\s*sénat)\b/i.test(
      lower
    )
  ) {
    return {
      contentCategory: 'Actualités / News',
      group: 'Actualités / News',
    };
  }
  if (
    hint === 'music' ||
    /\b(my\s*music|top\s*albania\s*radio|klan\s*music|melody\s*tv|pink\s*music|pink\s*hits|pink\s*koncert|pink\s*folk|pink\s*zabava|pink\s*show|pink\s*kuvar|pink\s*reality|pink\s*style|red\s*tv|24\s*kitchen|tlc|nw\s*muzik|nw\s*mix|c\s*star|tv\s*cuisines|mtv|trace|rfm\s*tv|m6\s*music)\b/i.test(
      lower
    )
  ) {
    return {
      contentCategory: 'Musique & Divertissement',
      group: 'Musique & Divertissement',
    };
  }
  if (
    /\b(aksion|action|thriller|crime|horror|frisson)\b/i.test(lower)
  ) {
    return {
      contentCategory: 'Films & Séries',
      group: 'Action & Thriller',
    };
  }
  if (
    /\b(komedi|comedy|comédie|comedie|family|famille|6ter)\b/i.test(lower)
  ) {
    return {
      contentCategory: 'Films & Séries',
      group: 'Comédie & Famille',
    };
  }
  if (
    /\b(autor|classic|classics|arte|eurofilm)\b/i.test(lower)
  ) {
    return {
      contentCategory: 'Films & Séries',
      group: 'Classiques & Culte',
    };
  }
  if (
    hint === 'series' ||
    /\b(serije|series|séries|novelas|epic\s*drama|romance|pickbox|zee\s*magic|nollywood|téva|teva|tfx)\b/i.test(
      lower
    )
  ) {
    return {
      contentCategory: 'Films & Séries',
      group: 'Séries TV & US',
    };
  }
  return {
    contentCategory: 'Films & Séries',
    group: 'Cinéma Premières',
  };
}

function buildScheduleTemplates(
  displayName: string,
  contentCategory: Exclude<ContentCategoryFilter, 'Tous'>,
  bouquetLabel: string,
  orbitalLabel: string
): SupplementalChannelSpec['scheduleTemplates'] {
  if (contentCategory === 'Sport / Football') {
    return [
      {
        title: `${displayName} : Grand Match de Football en Direct`,
        subTitle: `Direct Live HD · ${bouquetLabel}`,
        description: `Retransmission sportive en haute définition sur ${displayName} (${bouquetLabel} · ${orbitalLabel}).`,
        category: 'Football',
        durationMins: 120,
      },
      {
        title: `Studio Sport & Résumés des Championnats`,
        subTitle: `Analyses & Temps Forts HD`,
        description: `Magazine sportif, buts et temps forts en direct sur ${displayName}.`,
        category: 'Sport',
        durationMins: 90,
      },
      {
        title: `Affiche Européenne & Compétitions Internationales`,
        subTitle: `Retransmission Intégrale HD`,
        description: `Les plus grandes compétitions sportives diffusées sur ${displayName} (${orbitalLabel}).`,
        category: 'Football',
        durationMins: 120,
      },
    ];
  }
  if (contentCategory === 'Documentaires') {
    return [
      {
        title: `Grand Documentaire : Exploration & Découverte`,
        subTitle: `${displayName} · Documentaire HD`,
        description: `Documentaire nature, histoire et sciences diffusé en version originale sous-titrée sur ${displayName} (${bouquetLabel}).`,
        category: 'Documentaire',
        durationMins: 90,
      },
      {
        title: `Chroniques de l’Histoire & Civilisations`,
        subTitle: `Dossier Culturel & Patrimoine`,
        description: `Enquête historique et culturelle en haute définition sur ${displayName} (${orbitalLabel}).`,
        category: 'Documentaire',
        durationMins: 90,
      },
    ];
  }
  if (contentCategory === 'Actualités / News') {
    return [
      {
        title: `Le Grand Journal & Direct Information 24/7`,
        subTitle: `${displayName} · Édition Spéciale`,
        description: `Information en continu, décryptages et reportages internationaux sur ${displayName} (${bouquetLabel} · ${orbitalLabel}).`,
        category: 'Actualités',
        durationMins: 90,
      },
      {
        title: `Débat, Économie & Géopolitique`,
        subTitle: `Magazine d’Actualité en Direct`,
        description: `Analyses politiques et économiques par la rédaction de ${displayName}.`,
        category: 'Actualités',
        durationMins: 90,
      },
    ];
  }
  if (contentCategory === 'Jeunesse / Enfants') {
    return [
      {
        title: `Les Grands Héros de l’Animation`,
        subTitle: `${displayName} · Dessins Animés & Jeunesse`,
        description: `Séries d’animation, aventures et programmes jeunesse sur ${displayName} (${bouquetLabel} · ${orbitalLabel}).`,
        category: 'Animation',
        durationMins: 90,
      },
      {
        title: `Cinéma Famille & Aventure Jeunesse`,
        subTitle: `Programme Enfants HD`,
        description: `Divertissement éducatif et films d’animation pour toute la famille sur ${displayName}.`,
        category: 'Animation',
        durationMins: 90,
      },
    ];
  }
  if (contentCategory === 'Musique & Divertissement') {
    return [
      {
        title: `Top Hits, Concerts & Grand Divertissement`,
        subTitle: `${displayName} · Sessions Live HD`,
        description: `Clips musicaux, concerts exclusifs et émissions de divertissement sur ${displayName} (${bouquetLabel} · ${orbitalLabel}).`,
        category: 'Musique',
        durationMins: 110,
      },
      {
        title: `Prime Time Show & Variétés Internationales`,
        subTitle: `Divertissement & Culture`,
        description: `Rendez-vous musical et culturel en haute définition sur ${displayName}.`,
        category: 'Divertissement',
        durationMins: 100,
      },
    ];
  }
  return [
    {
      title: `Soirée Cinéma & Première : Grand Écran`,
      subTitle: `${displayName} · Film en Version Originale`,
      description: `Long-métrage de première partie de soirée diffusé sur ${displayName} (${bouquetLabel} · ${orbitalLabel}).`,
      category: 'Cinéma',
      durationMins: 115,
    },
    {
      title: `Série Événement : Destins Croisés`,
      subTitle: `Saison 2 · Épisode Inédit HD`,
      description: `Série dramatique et suspense en haute définition sur ${displayName} (${orbitalLabel}).`,
      category: 'Série TV',
      durationMins: 95,
    },
  ];
}

function makeSlugId(name: string, suffix: string): string {
  const clean = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\+/g, 'Plus')
    .replace(/[^a-zA-Z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${clean}.${suffix}`;
}

// 1. DIGITALB (ALBANIE) — Liste exhaustive officielle
const DIGITALB_CHANNEL_NAMES: string[] = [
  'RTV 21 Sat',
  'Kohavision',
  'In TV Albania',
  'Pro 1',
  'Gold Albania',
  'Max Albania',
  'DigitAlb 20 Vjet',
  'SuperSport 1',
  'SuperSport 2',
  'SuperSport 3',
  'SuperSport 4',
  'SuperSport 5',
  'SuperSport 6',
  'SuperSport 7',
  'RTSH 2',
  'Scan',
  'Arta',
  'MCN TV',
  'Premium Channel',
  'Travel Channel Europe',
  'Star Plus TV',
  'Dukagjini',
  'Star Movies Srbija',
  'Tring Sport News',
  'Tring Sport 1',
  'Tring Sport 2',
  'Tring Sport 3',
  'Tring Sport 6',
  'Tring Sport 7',
  'Euronews Albania',
  'TV Klan',
  'Junior TV',
  'Çufo',
  'My Music',
  'Explorer Natyra',
  'Explorer Histori',
  'Explorer Shkencë',
  'Eurofilm',
  'Klan Plus',
  'Zjarr TV',
  'A2 CNN',
  'Top Albania Radio TV',
  'Film Autor',
  'City News Albania',
  'Fax News',
  'ATV Kosovo',
  'RTK 1 Sat',
  'Bang Bang',
  'Syri TV',
  'Klan Music',
  'Stinët',
  'News 24 Albania',
  '21 Macedonia',
  'Ora News',
  'Film Hits',
  'Film Aksion',
  'Top News',
  'Top Channel',
  'Melody TV',
  'Film Komedi',
];

// 2. TOTAL TV (BALKANS - SERBIE, BOSNIE, CROATIE, SLOVÉNIE, MONTÉNÉGRO, MACÉDOINE) & MAXtv / A1 Croatia
const TOTAL_TV_GENERAL_AND_INFO: Array<{ name: string; suffix: string; includeMaxTv?: boolean }> = [
  { name: 'RTS 1', suffix: 'rs' },
  { name: 'RTS 2', suffix: 'rs' },
  { name: 'RTS 3', suffix: 'rs' },
  { name: 'RTS HD', suffix: 'rs' },
  { name: 'B92', suffix: 'rs' },
  { name: 'Prva Srpska TV', suffix: 'rs' },
  { name: 'Prva Plus', suffix: 'rs' },
  { name: 'Prva World', suffix: 'rs' },
  { name: 'Happy', suffix: 'rs' },
  { name: 'BHT 1', suffix: 'ba' },
  { name: 'Federalna TV', suffix: 'ba' },
  { name: 'OBN', suffix: 'ba' },
  { name: 'Nova BH', suffix: 'ba' },
  { name: 'N1 Bosna', suffix: 'ba' },
  { name: 'HRT 1', suffix: 'hr', includeMaxTv: true },
  { name: 'HRT 2', suffix: 'hr', includeMaxTv: true },
  { name: 'HRT 3', suffix: 'hr', includeMaxTv: true },
  { name: 'HRT 4', suffix: 'hr', includeMaxTv: true },
  { name: 'RTL', suffix: 'hr', includeMaxTv: true },
  { name: 'RTL 2', suffix: 'hr', includeMaxTv: true },
  { name: 'RTL Kockica', suffix: 'hr', includeMaxTv: true },
  { name: 'Nova TV', suffix: 'hr', includeMaxTv: true },
  { name: 'Doma Hrvatska', suffix: 'hr', includeMaxTv: true },
  { name: 'TV Slovenija 1', suffix: 'si' },
  { name: 'TV Slovenija 2', suffix: 'si' },
  { name: 'TV Slovenija 3', suffix: 'si' },
  { name: 'POP TV', suffix: 'si' },
  { name: 'Kanal A', suffix: 'si' },
  { name: 'Planet TV', suffix: 'si' },
  { name: 'RTCG 1', suffix: 'me' },
  { name: 'RTCG 2', suffix: 'me' },
  { name: 'RTCG 3', suffix: 'me' },
  { name: 'MRT 1', suffix: 'mk' },
  { name: 'MRT 2', suffix: 'mk' },
  { name: 'MRT 3', suffix: 'mk' },
  { name: 'Sitel', suffix: 'mk' },
  { name: 'Telma', suffix: 'mk' },
  { name: 'TV 21 Macedonia', suffix: 'mk' },
  { name: 'Alfa TV', suffix: 'mk' },
];

const TOTAL_TV_PINK_NETWORK: string[] = [
  'Pink',
  'Pink Plus',
  'Pink Extra',
  'Pink Action',
  'Pink Movies',
  'Pink Film',
  'Pink Music',
  'Pink Music 2',
  'Pink Family',
  'Pink Kids',
  'Pink Comedy',
  'Pink Horror',
  'Pink Classic',
  'Pink Serije',
  'Pink World Cinema',
  'Pink Show',
  'Pink Kuvar',
  'Pink Super Kids',
  'Pink BH',
  'Pink M',
  'Pink Srbija',
  'Pink Reality',
  'Pink Premium',
  'Pink Zabava',
  'Pink Pedia',
  'Pink Hits',
  'Pink Hits 2',
  'Pink Koncert',
  'Pink Folk',
  'Pink Folk 2',
  'Pink Thriller',
  'Pink Crime & Mystery',
  'Pink Romance',
  'Pink Sci-Fi & Fantasy',
  'Pink Western',
  'Pink Style',
  'Red TV',
];

const TOTAL_TV_SPORTS: Array<{ name: string; suffix: string; includeMaxTv?: boolean }> = [
  { name: 'Sport Klub 1', suffix: 'rs' },
  { name: 'Sport Klub 2', suffix: 'rs' },
  { name: 'Sport Klub 3', suffix: 'rs' },
  { name: 'Sport Klub 4', suffix: 'rs' },
  { name: 'Sport Klub Esports', suffix: 'rs' },
  { name: 'Sport Klub Slovenija 1', suffix: 'si' },
  { name: 'Sport Klub Slovenija 2', suffix: 'si' },
  { name: 'Sport Klub Slovenija 3', suffix: 'si' },
  { name: 'Sport Klub Hrvatska 1', suffix: 'hr', includeMaxTv: true },
  { name: 'Sport Klub Hrvatska 2', suffix: 'hr', includeMaxTv: true },
  { name: 'Sport Klub Hrvatska 3', suffix: 'hr', includeMaxTv: true },
  { name: 'Sport Klub Golf', suffix: 'rs' },
  { name: 'Arena 1 Premium', suffix: 'rs', includeMaxTv: true },
  { name: 'Arena 2 Premium', suffix: 'rs', includeMaxTv: true },
  { name: 'Arena 3 Premium', suffix: 'rs', includeMaxTv: true },
  { name: 'Arena 4 Premium', suffix: 'rs', includeMaxTv: true },
  { name: 'Arena 5 Premium', suffix: 'rs', includeMaxTv: true },
  { name: 'Arena Sport 1', suffix: 'hr', includeMaxTv: true },
  { name: 'Arena Sport 2', suffix: 'hr', includeMaxTv: true },
  { name: 'Arena Sport 3', suffix: 'hr', includeMaxTv: true },
  { name: 'Arena Sport 4', suffix: 'hr', includeMaxTv: true },
  { name: 'Arena Sport 5', suffix: 'hr', includeMaxTv: true },
  { name: 'Arena Sport 9', suffix: 'hr', includeMaxTv: true },
  { name: 'Arena Sport 10 Hrvatska', suffix: 'hr', includeMaxTv: true },
  { name: 'Sportska TV', suffix: 'hr', includeMaxTv: true },
];

const TOTAL_TV_CINEMA_SERIES: Array<{ name: string; suffix: string; includeMaxTv?: boolean }> = [
  { name: 'CineStar 1', suffix: 'hr', includeMaxTv: true },
  { name: 'CineStar Premiere 1', suffix: 'hr', includeMaxTv: true },
  { name: 'CineStar Premiere 2', suffix: 'hr', includeMaxTv: true },
  { name: 'CineStar Comedy', suffix: 'hr', includeMaxTv: true },
  { name: 'CineStar Action', suffix: 'hr', includeMaxTv: true },
  { name: 'HBO 1', suffix: 'hr', includeMaxTv: true },
  { name: 'HBO 2', suffix: 'hr', includeMaxTv: true },
  { name: 'HBO 3', suffix: 'hr', includeMaxTv: true },
  { name: 'Cinemax 1', suffix: 'hr', includeMaxTv: true },
  { name: 'Cinemax 2', suffix: 'hr', includeMaxTv: true },
  { name: 'Star Channel Srbija', suffix: 'rs' },
  { name: 'Cinemania', suffix: 'rs' },
  { name: 'AMC Balkan', suffix: 'rs', includeMaxTv: true },
  { name: 'FilmBox+ Hits Adria', suffix: 'rs', includeMaxTv: true },
  { name: 'FilmBox+ Emotion Adria', suffix: 'rs', includeMaxTv: true },
  { name: 'Pickbox 1 TV', suffix: 'hr', includeMaxTv: true },
];

const TOTAL_TV_KIDS_DISCOVERY: Array<{ name: string; suffix: string; includeMaxTv?: boolean }> = [
  { name: 'Nickelodeon', suffix: 'rs', includeMaxTv: true },
  { name: 'Nick Jr', suffix: 'rs', includeMaxTv: true },
  { name: 'Nicktoons Adria', suffix: 'rs', includeMaxTv: true },
  { name: 'Minimax', suffix: 'rs' },
  { name: 'Pikaboo', suffix: 'rs' },
  { name: 'JimJam', suffix: 'rs', includeMaxTv: true },
  { name: 'Mini TV', suffix: 'hr', includeMaxTv: true },
  { name: 'Discovery', suffix: 'rs', includeMaxTv: true },
  { name: 'TLC', suffix: 'rs', includeMaxTv: true },
  { name: 'History Europe', suffix: 'rs', includeMaxTv: true },
  { name: 'National Geographic Hrvatska', suffix: 'hr', includeMaxTv: true },
  { name: 'National Geographic Wild', suffix: 'hr', includeMaxTv: true },
  { name: 'Viasat Nature', suffix: 'rs', includeMaxTv: true },
  { name: 'Viasat Explore', suffix: 'rs', includeMaxTv: true },
  { name: 'Viasat History', suffix: 'rs', includeMaxTv: true },
  { name: 'Viasat Epic Drama', suffix: 'rs', includeMaxTv: true },
  { name: 'Crime + Investigation', suffix: 'rs', includeMaxTv: true },
  { name: '24 Kitchen', suffix: 'rs', includeMaxTv: true },
];

// 3. NEW WORLD TV & CANAL+ AFRIQUE / RÉUNION
const NEW_WORLD_TV_CHANNELS: Array<{ name: string; suffix: string }> = [
  { name: 'NW Sport 1', suffix: '16e' },
  { name: 'NW Sport 2', suffix: '16e' },
  { name: 'NW Sport 3', suffix: '16e' },
  { name: 'NW Sport 4', suffix: '16e' },
  { name: 'NW Sport 5', suffix: '16e' },
  { name: 'NW Sport 6', suffix: '16e' },
  { name: 'NW Sport 7', suffix: '16e' },
  { name: 'EPT TV', suffix: 'sn' },
  { name: 'Elohim Global TV', suffix: '16e' },
  { name: 'TVT Bénin', suffix: '16e' },
  { name: 'ORTM 1', suffix: 'ml' },
  { name: 'ORTM 2', suffix: 'ml' },
  { name: 'RTI 1', suffix: 'ci' },
  { name: 'RTI 2', suffix: 'ci' },
  { name: 'NW Cinema', suffix: '16e' },
  { name: 'NW Series', suffix: '16e' },
  { name: 'NW Transnat 1', suffix: '16e' },
  { name: 'NW Transnat 2', suffix: '16e' },
  { name: 'NW Transnat 3', suffix: '16e' },
  { name: 'NW Info', suffix: '16e' },
  { name: 'NW News', suffix: '16e' },
  { name: 'NW Economie', suffix: '16e' },
  { name: 'NW Muzik', suffix: '16e' },
  { name: 'NW Mix', suffix: '16e' },
  { name: 'Nina Novelas', suffix: '16e' },
  { name: 'Green TV', suffix: '16e' },
  { name: 'TV5Monde Afrique', suffix: '16e' },
  { name: 'Tivi5Monde', suffix: '16e' },
  { name: 'Zee Magic', suffix: '16e' },
  { name: 'Aforevo TV', suffix: '16e' },
  { name: 'Afro Novelas', suffix: '16e' },
  { name: 'BBC News Africa', suffix: '16e' },
  { name: 'CGTN Français', suffix: '16e' },
  { name: 'Nollywood TV', suffix: '16e' },
  { name: 'Wataaa TV', suffix: '16e' },
  { name: 'RTA SciFi', suffix: '16e' },
];

const CANAL_PLUS_REUNION_AFRIQUE_CHANNELS: string[] = [
  'Canal J',
  'BFM TV',
  'TFX',
  'ARTE',
  'National Geographic France',
  'National Geographic Wild France',
  'TV5Monde Style',
  'Antenne Réunion',
  'Canal+ Kids',
  'Canal+ Séries',
  'Canal+ Golf',
  'Canal+ Sport Réunion',
  'Canal+ Sport 4',
  'Canal+ Sport 5',
  'C Star',
  'Kanal Austral',
  'TV Cuisines',
  'MTV France',
  'MTV Hits',
  'Novelas+',
  'Paramount Network France',
  'Piwi+',
  'Planète+',
  'TéléToon+',
  'Trace Vanilla Islands',
  "L'Équipe",
  'Equidia',
  'RFM TV',
  'Seasons',
  'Planète+ Aventure',
  'M6',
  '6ter',
  'W9',
  'Téva',
  'TMC',
  'TF1',
  'RTL9',
  'beIN Sports 1 France',
  'beIN Sports 2 France',
  'beIN Sports Max 4 France',
  'Ciné+ Classic',
  'Ciné+ Family',
  'Ciné+ Émotion',
  'Ciné+ Festival',
  'Ciné+ Frisson',
  'Trek',
  'LCP',
  'Public Sénat',
  'Mangas',
  'Tiji',
  'Discovery Channel France',
  'TLC France',
  'M6 Music',
  'RMC Sport 1',
  'Action',
  'Automoto',
  'Eurosport 1 France',
  'Eurosport 2 France',
  'Histoire TV',
  'Comédie+',
  'Gulli',
  'Trace Caribbean',
];

// 4. AUTRES CHAÎNES AFRICAINES & FRANCOPHONES
const OTHER_AFRICAN_FRANCOPHONE_CHANNELS: Array<{ name: string; suffix: string }> = [
  { name: 'Télé Tchad', suffix: '16e' },
  { name: 'Equinoxe TV', suffix: 'cm' },
  { name: 'Alwilayah TV', suffix: '16e' },
  { name: 'Divin Amour TV', suffix: 'ci' },
  { name: 'Sikka TV', suffix: '16e' },
  { name: 'RTS 1 Sénégal', suffix: 'sn' },
  { name: 'RTS 2 Sénégal', suffix: 'sn' },
  { name: 'BNC TV', suffix: '16e' },
  { name: 'Télé Sahel', suffix: '16e' },
  { name: 'Afro Magic Channel', suffix: '16e' },
  { name: 'Passion Novelas', suffix: '16e' },
  { name: 'France 2', suffix: '16e' },
  { name: 'France 5', suffix: '16e' },
  { name: 'West Africa TV', suffix: 'sn' },
  { name: 'Dieu TV', suffix: '16e' },
  { name: 'Fulani Universal TV', suffix: '16e' },
  { name: '2S TV', suffix: 'sn' },
  { name: 'EMCI TV Afrique', suffix: '16e' },
  { name: 'QTV Gambia', suffix: '16e' },
  { name: 'Loveworld XP', suffix: '16e' },
  { name: 'Leral TV', suffix: 'sn' },
  { name: 'GRTS TV', suffix: '16e' },
  { name: 'TV Record Madagascar', suffix: '16e' },
  { name: 'Ma TV', suffix: '16e' },
  { name: 'Voir+ Réunion', suffix: '16e' },
  { name: 'Exo TV', suffix: '16e' },
  { name: 'Télé Kréol', suffix: '16e' },
  { name: 'Kwezi TV', suffix: '16e' },
];

export function buildEutelsat16eExhaustiveChannels(): SupplementalChannelSpec[] {
  const list: SupplementalChannelSpec[] = [];

  // 1. DIGITALB (ALBANIE)
  for (const name of DIGITALB_CHANNEL_NAMES) {
    const { contentCategory, group } = classifyByTitleAndHint(name);
    const id = makeSlugId(name, 'al');
    list.push({
      id,
      displayName: name,
      contentCategory,
      group,
      country: 'EU',
      satellite: 'Eutelsat 16°E',
      orbitalPosition: 'Eutelsat 16°E',
      bouquets: ['DigitAlb (Albanie)'],
      bouquetId: 'eutelsat_16e_digitalb',
      audioTrackLabel: 'Dual Audio SQ / VO Original',
      subtitleTrackLabel: 'DigitAlb · Eutelsat 16°E',
      scheduleTemplates: buildScheduleTemplates(
        name,
        contentCategory,
        'DigitAlb (Albanie)',
        'Eutelsat 16°E'
      ),
    });
  }

  // 2A. TOTAL TV — Généralistes & Info
  for (const item of TOTAL_TV_GENERAL_AND_INFO) {
    const { contentCategory, group } = classifyByTitleAndHint(item.name);
    const id = makeSlugId(item.name, item.suffix);
    const bouquets: Exclude<BouquetFilter, 'Tous'>[] = item.includeMaxTv
      ? [
          'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)',
          'MAXtv / A1 Croatia',
        ]
      : ['Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)'];
    list.push({
      id,
      displayName: item.name,
      contentCategory,
      group,
      country: 'EU',
      satellite: 'Eutelsat 16°E',
      orbitalPosition: 'Eutelsat 16°E',
      bouquets,
      bouquetId: 'eutelsat_16e_digitalb',
      audioTrackLabel: 'Audio Original / VO EN',
      subtitleTrackLabel: 'Total TV · Eutelsat 16°E',
      scheduleTemplates: buildScheduleTemplates(
        item.name,
        contentCategory,
        'Total TV (Balkans)',
        'Eutelsat 16°E'
      ),
    });
  }

  // 2B. TOTAL TV — Réseau Pink
  for (const name of TOTAL_TV_PINK_NETWORK) {
    const { contentCategory, group } = classifyByTitleAndHint(name);
    const id = makeSlugId(name, 'rs');
    list.push({
      id,
      displayName: name,
      contentCategory,
      group,
      country: 'EU',
      satellite: 'Eutelsat 16°E',
      orbitalPosition: 'Eutelsat 16°E',
      bouquets: ['Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)'],
      bouquetId: 'eutelsat_16e_digitalb',
      audioTrackLabel: 'Audio SR / VO Original',
      subtitleTrackLabel: 'Total TV · Eutelsat 16°E',
      scheduleTemplates: buildScheduleTemplates(
        name,
        contentCategory,
        'Total TV · Réseau Pink',
        'Eutelsat 16°E'
      ),
    });
  }

  // 2C. TOTAL TV — Sports
  for (const item of TOTAL_TV_SPORTS) {
    const { contentCategory, group } = classifyByTitleAndHint(item.name, 'sport');
    const id = makeSlugId(item.name, item.suffix);
    const bouquets: Exclude<BouquetFilter, 'Tous'>[] = item.includeMaxTv
      ? [
          'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)',
          'MAXtv / A1 Croatia',
        ]
      : ['Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)'];
    list.push({
      id,
      displayName: item.name,
      contentCategory,
      group,
      country: 'EU',
      satellite: 'Eutelsat 16°E',
      orbitalPosition: 'Eutelsat 16°E',
      bouquets,
      bouquetId: 'eutelsat_16e_digitalb',
      audioTrackLabel: 'Audio Stadium / Live HD',
      subtitleTrackLabel: 'Total TV · Eutelsat 16°E',
      scheduleTemplates: buildScheduleTemplates(
        item.name,
        contentCategory,
        'Total TV Sports',
        'Eutelsat 16°E'
      ),
    });
  }

  // 2D. TOTAL TV — Cinéma & Séries
  for (const item of TOTAL_TV_CINEMA_SERIES) {
    const { contentCategory, group } = classifyByTitleAndHint(item.name);
    const id = makeSlugId(item.name, item.suffix);
    const bouquets: Exclude<BouquetFilter, 'Tous'>[] = item.includeMaxTv
      ? [
          'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)',
          'MAXtv / A1 Croatia',
        ]
      : ['Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)'];
    list.push({
      id,
      displayName: item.name,
      contentCategory,
      group,
      country: 'EU',
      satellite: 'Eutelsat 16°E',
      orbitalPosition: 'Eutelsat 16°E',
      bouquets,
      bouquetId: 'eutelsat_16e_digitalb',
      audioTrackLabel: 'VO Anglais + Sous-titres DVB',
      subtitleTrackLabel: 'Total TV · Eutelsat 16°E',
      scheduleTemplates: buildScheduleTemplates(
        item.name,
        contentCategory,
        'Total TV Cinéma & Séries',
        'Eutelsat 16°E'
      ),
    });
  }

  // 2E. TOTAL TV — Jeunesse & Découverte
  for (const item of TOTAL_TV_KIDS_DISCOVERY) {
    const { contentCategory, group } = classifyByTitleAndHint(item.name);
    const id = makeSlugId(item.name, item.suffix);
    const bouquets: Exclude<BouquetFilter, 'Tous'>[] = item.includeMaxTv
      ? [
          'Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)',
          'MAXtv / A1 Croatia',
        ]
      : ['Total TV (Balkans / Serbie / Croatie / Bosnie / Slovénie)'];
    list.push({
      id,
      displayName: item.name,
      contentCategory,
      group,
      country: 'EU',
      satellite: 'Eutelsat 16°E',
      orbitalPosition: 'Eutelsat 16°E',
      bouquets,
      bouquetId: 'eutelsat_16e_digitalb',
      audioTrackLabel: 'Multi-Audio / VO Original',
      subtitleTrackLabel: 'Total TV · Eutelsat 16°E',
      scheduleTemplates: buildScheduleTemplates(
        item.name,
        contentCategory,
        'Total TV Découverte & Jeunesse',
        'Eutelsat 16°E'
      ),
    });
  }

  // 3A. NEW WORLD TV (AFRIQUE)
  for (const item of NEW_WORLD_TV_CHANNELS) {
    const { contentCategory, group } = classifyByTitleAndHint(item.name);
    const id = makeSlugId(item.name, item.suffix);
    list.push({
      id,
      displayName: item.name,
      contentCategory,
      group,
      country: 'EU',
      satellite: 'Eutelsat 16°E',
      orbitalPosition: 'Eutelsat 16°E',
      bouquets: ['New World TV (Afrique)', 'Canal+ Réunion / Afrique'],
      bouquetId: 'eutelsat_16e_digitalb',
      audioTrackLabel: 'Audio Français / Multi-Audio',
      subtitleTrackLabel: 'New World TV · Eutelsat 16°E',
      scheduleTemplates: buildScheduleTemplates(
        item.name,
        contentCategory,
        'New World TV (Afrique)',
        'Eutelsat 16°E'
      ),
    });
  }

  // 3B. CANAL+ RÉUNION / AFRIQUE
  for (const name of CANAL_PLUS_REUNION_AFRIQUE_CHANNELS) {
    const { contentCategory, group } = classifyByTitleAndHint(name);
    const id = makeSlugId(`${name}.16e`, 'fr16e');
    list.push({
      id,
      displayName: name,
      contentCategory,
      group,
      country: 'EU',
      satellite: 'Eutelsat 16°E',
      orbitalPosition: 'Eutelsat 16°E',
      bouquets: ['Canal+ Réunion / Afrique', 'New World TV (Afrique)'],
      bouquetId: 'eutelsat_16e_digitalb',
      audioTrackLabel: 'Audio FR + VO Multi',
      subtitleTrackLabel: 'Canal+ Réunion / Afrique · Eutelsat 16°E',
      scheduleTemplates: buildScheduleTemplates(
        name,
        contentCategory,
        'Canal+ Réunion / Afrique',
        'Eutelsat 16°E'
      ),
    });
  }

  // 4. AUTRES CHAÎNES AFRICAINES & FRANCOPHONES
  for (const item of OTHER_AFRICAN_FRANCOPHONE_CHANNELS) {
    const { contentCategory, group } = classifyByTitleAndHint(item.name);
    const id = makeSlugId(item.name, item.suffix);
    list.push({
      id,
      displayName: item.name,
      contentCategory,
      group,
      country: 'EU',
      satellite: 'Eutelsat 16°E',
      orbitalPosition: 'Eutelsat 16°E',
      bouquets: ['Autres chaînes africaines / francophones'],
      bouquetId: 'eutelsat_16e_digitalb',
      audioTrackLabel: 'Audio Français / International',
      subtitleTrackLabel: 'Afrique Francophone · Eutelsat 16°E',
      scheduleTemplates: buildScheduleTemplates(
        item.name,
        contentCategory,
        'Autres chaînes africaines / francophones',
        'Eutelsat 16°E'
      ),
    });
  }

  return list;
}
