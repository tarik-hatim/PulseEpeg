# PulseEPG — Dossier de Conception Détaillée & Diagrammes UML

**Projet** : PulseEPG (دليلك الشامل للقنوات)  
**Version** : 2.4.0  
**Statut** : Document de Conception Validé  

---

## 1. Diagramme de Classes UML (Domain Class Diagram)

Ce diagramme modélise les entités maîtresses du système, leurs attributs, leurs méthodes et leurs relations d'agrégation et de dépendance.

```mermaid
%%{init: {'theme': 'dark'}}%%
classDiagram
    direction TB

    class EpgChannel {
        +string id
        +string displayName
        +string orbitalPosition
        +string contentCategory
        +string group
        +string country
        +string[] satellites
        +string[] bouquets
        +string audioTrackLabel
        +string subtitleTrackLabel
        +number channelNumber
        +number programmeCount
        +lookupTransponder() TransponderInfo
    }

    class EpgProgramme {
        +string id
        +string channelId
        +string title
        +string subTitle
        +string description
        +string category
        +number startMs
        +number stopMs
        +string icon
        +isLiveNow(nowMs: number) boolean
        +getDurationMinutes() number
    }

    class GlobalSportFixture {
        +string id
        +string competitionId
        +string competitionLabel
        +string homeTeam
        +string homeTeamLogo
        +string homeScore
        +string awayTeam
        +string awayTeamLogo
        +string awayScore
        +number startMs
        +number stopMs
        +boolean isLive
        +boolean isEnded
        +string statusText
        +BroadcasterInfo[] broadcasters
    }

    class SportsEngine {
        +parseMatch(title: string) MatchInfo
        +isReplay(title: string) boolean
        +isExplicitlyLive(title: string, desc: string) boolean
        +isExplicitlyLiveTitle(title: string, desc: string) boolean
        +isMatchEqual(homeA, awayA, homeB, awayB) boolean
        +formatLiveMatchTiming(elapsedMs, sportType, statusText, lang) string
        +detectSport(title, cat, channel) SportInfo
        +detectCompetition(title, cat) CompetitionDef
    }

    class VideoHighlight {
        +string id
        +string title
        +string channel
        +string channelId
        +boolean verified
        +number ageMs
        +number dur
        +boolean streamed
        +getEmbedUrl() string
    }

    class SatelliteTransponder {
        +string id
        +string satellite
        +number frequency
        +string polarization
        +number symbolRate
        +string fec
        +string standard
        +string modulation
        +boolean isEncrypted
        +string coverageBeam
    }

    class UserAccount {
        +string uid
        +string email
        +boolean isPro
        +string role
        +toggleFavoriteChannel(channelId: string)
        +toggleFavoriteTeam(teamName: string)
        +setReminder(programmeId: string)
    }

    EpgChannel "1" *-- "0..*" EpgProgramme : planifie
    EpgChannel "0..*" o-- "1" SatelliteTransponder : fréquence_satellite
    EpgProgramme "0..1" <.. "0..1" GlobalSportFixture : enrichit_avec_scores
    SportsEngine ..> GlobalSportFixture : synchronise_et_filtre
    SportsEngine ..> EpgProgramme : analyse_titres
    GlobalSportFixture "0..1" o-- "0..*" VideoHighlight : propose_résumés
    UserAccount "1" --> "0..*" EpgChannel : favoris
```

---

## 2. Machine à États Finis UML (Statechart) — Cycle de Vie d'un Match

Ce diagramme d'états modélise la transition rigoureuse entre les différentes phases d'un match de sport, garantissant qu'aucun match terminé ne puisse régresser ou être maintenu en direct.

```mermaid
%%{init: {'theme': 'dark'}}%%
stateDiagram-v2
    [*] --> Programmé : Coup d'envoi futur (startMs > nowMs)
    
    note right of Programmé
        • Onglet : "À venir" (القادمة)
        • Scores : undefined (aucun faux 0 - 0)
        • Badge : Heure prévue (ex: 21:00)
    end note

    Programmé --> EnDirect_1ereMiTemps : Coup d'envoi donné (state == 'in' / 0' à 45')

    state EnDirect_1ereMiTemps {
        [*] --> TempsReglementaire1
        TempsReglementaire1 --> TempsAdditionnel1 : 45' + arrêts de jeu
    }

    note right of EnDirect_1ereMiTemps
        • Onglet : "En direct" (مباشر الآن)
        • Badge : مباشر · 24'
        • Score : Score réel instantané
    end note

    EnDirect_1ereMiTemps --> MiTemps : Fin première période (STATUS_HALFTIME)
    
    note right of MiTemps
        • Onglet : "En direct" (مباشر الآن)
        • Badge : مباشر · استراحة (Mi-temps)
    end note

    MiTemps --> EnDirect_2emeMiTemps : Reprise de jeu (46' à 90')
    
    state EnDirect_2emeMiTemps {
        [*] --> TempsReglementaire2
        TempsReglementaire2 --> TempsAdditionnel2 : 90'+4'
    }

    EnDirect_2emeMiTemps --> Prolongations_TirsAuBut : Si match à élimination directe (STATUS_OVERTIME)
    
    Prolongations_TirsAuBut --> Termine : Coup de sifflet final (STATUS_FINAL)
    EnDirect_2emeMiTemps --> Termine : Coup de sifflet final (STATUS_FULL_TIME / FT)
    
    state Termine {
        [*] --> VerrouillageScore
        VerrouillageScore --> BanniDuDirect : isLive = false, isEnded = true
        BanniDuDirect --> ArchivageMatchsHier : Bascule dans onglet "Résumés vidéo"
    }

    note right of Termine
        • Onglet : "Résumés vidéo" (ملخصات الفيديو)
        • Badge : FT / نهاية المباراة
        • Score : Score final certifié (ex: 4 - 2)
        • VIDÉOS : Résumés officiels beIN Sports
    end note

    Termine --> [*]
```

---

## 3. Diagramme de Paquetages Applicatifs (Package Diagram)

Modélise l'organisation modulaire du code source et les frontières architecturales.

```mermaid
%%{init: {'theme': 'dark'}}%%
graph TB
    subgraph UI_Layer ["📦 Présentation & Composants (src/components)"]
        SportsComp["SportsView.tsx (Centre de Contrôle Sport)"]
        EpgComp["EpgGrid.tsx (Timeline Horizontale)"]
        ChannelComp["ChannelList.tsx (Sélection Bouquets)"]
        Modals["Modales (Settings, Transponder, Trailer)"]
    end

    subgraph Core_Services ["📦 Services Métier (src/services)"]
        SatService["satelliteCatalogService.ts (Annuaire Transpondeurs)"]
        StorageServ["storageService.ts (IndexedDB & Fallbacks)"]
        NotifServ["notificationService.ts (Web Audio & Notifications)"]
    end

    subgraph Utils_Layer ["📦 Moteurs de Calcul & Utilitaires (src/utils)"]
        SportEngine["sportsEngine.ts (Détection, Regex & Scores)"]
        MetaResolver["metadataResolverCore.ts (TMDB & Traduction)"]
        TimeUtils["timeFormat.ts (Formats Horaires & RTL Chiffres)"]
        WhiteList["sportChannelsWhitelist.ts (Mapping Satellite)"]
    end

    subgraph Workers_Layer ["📦 Threads d'Arrière-Plan (src/workers)"]
        EpgWorker["epgWorker.ts (Streaming & Parsing XMLTV)"]
    end

    subgraph Backend_Layer ["📦 Serveur Proxy & Endpoints (server.ts)"]
        ExpressRoutes["Routes Express (/api/sports, /api/epg, /api/yt)"]
    end

    UI_Layer --> Core_Services
    UI_Layer --> Utils_Layer
    Core_Services --> Utils_Layer
    Core_Services --> Workers_Layer
    Workers_Layer --> Backend_Layer
    UI_Layer --> Backend_Layer
```
