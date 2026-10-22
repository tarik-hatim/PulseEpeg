# PulseEPG — Dossier d'Architecture Technique & Spécifications Système (DAT)

**Projet** : PulseEPG (دليلك الشامل للقنوات)  
**Version** : 2.4.0  
**Statut** : Architecture Validée  
**Environnement** : Node.js Express + React 19 SPA + Web Workers + Firebase/Supabase  

---

## 1. Vue d'Ensemble de l'Architecture (Diagramme de Composants & Déploiement)

Le système PulseEPG adopte une architecture découplée assurant une latence minimale, une tolérance totale aux pannes réseau et une fluidité à 60 FPS sur mobile.

```mermaid
%%{init: {'theme': 'dark'}}%%
graph TB
    subgraph Client ["Client : Navigateur Web (PWA) / Application Android (Capacitor)"]
        UI["🎨 React 19 UI (App, SportsView, EpgGrid)"]
        State["🧠 State Manager & Cache Mémoire (Hooks)"]
        Worker["⚡ Web Worker (epgWorker.ts - Décompression & Indexation)"]
        IDB[("💾 IndexedDB & LocalStorage (Persistance Offline)")]
        SW["📡 Service Worker (sw.js - Cache Assets & PWA)"]

        UI <--> State
        State <--> Worker
        Worker <--> IDB
        UI <--> IDB
    end

    subgraph Serveur ["Serveur d'Applet Node.js (server.ts - Port 3000)"]
        Express["🚀 Serveur Express HTTPS"]
        ProxyEPG["🔄 Proxy Streaming EPG (/api/epg-proxy)"]
        SportService["⚽ Service Affiches & Scores (/api/sports/fixtures)"]
        YTService["🎥 Service Résumés Vidéo (/api/public/yt)"]
        TMDBService["🎬 Enrichissement Cinéma (/api/metadata-enrich)"]
        AuthGuard["🛡️ JWT Auth Guard Pro (/api/epg/extended)"]
        MemCache[("⚡ In-Memory Cache (TTL Dynamique)")]

        Express --> ProxyEPG
        Express --> SportService
        Express --> YTService
        Express --> TMDBService
        Express --> AuthGuard
        SportService <--> MemCache
        TMDBService <--> MemCache
    end

    subgraph Services_Externes ["Services Tiers & Cloud"]
        EPGSource["🌐 Fournisseur EPG (epgshare01.online XML.GZ)"]
        ESPN["🌐 ESPN Scoreboards API (Foot, UCL, MLS, etc.)"]
        YT["🌐 YouTube Data & oEmbed Services"]
        TMDB["🌐 The Movie Database (TMDB v3 API)"]
        Firebase[("🔥 Google Cloud Firestore (Rules, Profils, Favoris)")]
        Supabase["⚡ Supabase Auth (JWT Verification)"]
    end

    ProxyEPG <-->|Stream HTTP| EPGSource
    SportService <-->|REST JSON| ESPN
    YTService <-->|HTTP Scraping / oEmbed| YT
    TMDBService <-->|REST HTTPS| TMDB
    AuthGuard <-->|Vérification Bearer| Supabase
    UI <-->|Sync Favoris & Règles| Firebase
    State <-->|Fetch API| Express
```

---

## 2. Diagrammes de Séquence UML

### 2.1 Flux de Chargement et Décompression EPG (Optimisation Web Worker)
Le fichier XMLTV compressé en GZIP fait plusieurs dizaines de mégaoctets. Pour ne jamais bloquer le thread principal de rendu de React, la décompression et l'indexation sont déportées dans un Web Worker.

```mermaid
%%{init: {'theme': 'dark'}}%%
sequenceDiagram
    autonumber
    actor U as Utilisateur
    participant UI as React UI (App.tsx)
    participant WW as Web Worker (epgWorker.ts)
    participant SRV as Serveur Express (/api/epg-proxy)
    participant SRC as Source EPG (epgshare01.online)
    participant IDB as IndexedDB Client

    U->>UI: Ouvre l'application
    UI->>IDB: Vérifie si un snapshot valide existe en cache local
    alt Snapshot local valide (< TTL)
        IDB-->>UI: Restitution immédiate (Affichage instantané en <50ms)
    else Snapshot expiré ou inexistant
        UI->>WW: PostMessage: { type: 'PARSE_EPG', url: sourceUrl }
        WW->>SRV: GET /api/epg-proxy?url=...
        SRV->>SRC: Fetch flux binaire .xml.gz (Streaming)
        SRC-->>SRV: Stream HTTP Octet-stream
        SRV-->>WW: Stream transféré sans blocage CORS
        Note over WW: Décompression GZIP en mémoire (pako)<br/>Parsing XML incrémental (sax/regex)<br/>Mapping transpondeurs et satellites
        WW->>IDB: Stocke le snapshot indexé (SnapshotStore)
        WW-->>UI: PostMessage: { type: 'EPG_READY', channels, schedules }
        UI->>UI: Rendu fluide de la grille des chaînes
    end
```

### 2.2 Flux de Synchronisation des Matchs et Scores en Direct
Garantit que les scores sont mis à jour toutes les 30 secondes en direct, et que tout match terminé est basculé hors du direct.

```mermaid
%%{init: {'theme': 'dark'}}%%
sequenceDiagram
    autonumber
    participant UI as SportsView.tsx
    participant ENG as sportsEngine.ts
    participant SRV as Server (/api/sports/fixtures)
    participant ESPN as ESPN Scoreboards API

    loop Polling adaptatif (30s si match en cours, 180s sinon)
        UI->>SRV: GET /api/sports/fixtures
        alt Cache serveur encore frais (< TTL)
            SRV-->>UI: Renvoie données en cache mémoire (Ultra rapide)
        else Cache expiré
            SRV->>ESPN: Requête scores pour toutes les ligues (UCL, Botola, LaLiga...)
            ESPN-->>SRV: Données brutes (events, status, competitors, scores)
            Note over SRV: Normalisation :<br/>1. Calcul strict isEnded (FT / Final / Terminé)<br/>2. Calcul strict isLive (!isEnded && in-progress)<br/>3. Isolation des scores réels (pas de 0 artificiel)
            SRV-->>UI: Liste certifiée des affiches (JSON)
        end
        UI->>ENG: Traitement de fusion avec les grilles TV locales
        Note over ENG: Élimination des rediffusions :<br/>Si match déjà terminé dans le flux officiel,<br/>bannir de liveEvents !
        UI->>UI: Mise à jour du badge "مباشر الآن" et des scores réels
    end
```

---

## 3. Schéma Entité-Relation des Données (ERD)

```mermaid
%%{init: {'theme': 'dark'}}%%
erDiagram
    EPG_CHANNEL ||--o{ EPG_PROGRAMME : diffuse
    EPG_CHANNEL ||--o{ SATELLITE_TRANSPONDER : relie_a
    EPG_PROGRAMME ||--o| GLOBAL_SPORT_FIXTURE : enrichi_par
    USER ||--o{ FAVORITE_TEAM : suit
    USER ||--o{ REMINDER : programme
    USER ||--|| USER_PROFILE : possede

    EPG_CHANNEL {
        string id PK "Identifiant canonique (ex: beIN.Sports.1.badr)"
        string displayName "Nom complet affiché"
        string orbitalPosition "Position orbitale (ex: 26.0°E)"
        string country "Code pays (AR, FR, ES...)"
        string contentCategory "Catégorie principale"
        string group "Sous-groupe thématique"
        string audioTrackLabel "Langue audio par défaut"
    }

    EPG_PROGRAMME {
        string id PK "Identifiant unique"
        string channelId FK "Référence chaîne"
        string title "Titre du programme / affiche"
        string category "Catégorie EPG"
        int64 startMs "Horodatage de début (Epoch ms)"
        int64 stopMs "Horodatage de fin (Epoch ms)"
        string description "Synopsis ou détails"
    }

    GLOBAL_SPORT_FIXTURE {
        string id PK "Identifiant ESPN / Compétition"
        string competitionId "Code compétition (ucl, botola, laliga...)"
        string competitionLabel "Nom de la compétition"
        string homeTeam "Équipe domicile"
        string homeScore "Score domicile (string ou undefined)"
        string awayTeam "Équipe extérieur"
        string awayScore "Score extérieur (string ou undefined)"
        boolean isLive "Indicateur direct réel certifié"
        boolean isEnded "Indicateur de match achevé"
        string statusText "Statut officiel (FT, 45', Mi-temps...)"
    }

    SATELLITE_TRANSPONDER {
        string id PK "Nom ou clé (ex: 12012_V_29700)"
        string satellite "Satellite cible (Astra 19.2°E, Nilesat 7°W...)"
        int frequency "Fréquence en MHz"
        string polarization "Polarisation (H ou V)"
        int symbolRate "Débit de symboles en kbauds"
        string fec "Forward Error Correction (ex: 2/3)"
        boolean isEncrypted "Crypté ou FTA (clair)"
    }

    USER_PROFILE {
        string uid PK "UID Firebase / Supabase"
        string email "Adresse email de l'utilisateur"
        boolean is_pro "Statut d'abonnement PulseEPG Pro"
        string role "Rôle système (free, pro, admin)"
        int64 created_at "Date de création du compte"
    }

    REMINDER {
        string id PK "Identifiant du rappel"
        string userId FK "Propriétaire du rappel"
        string programmeId FK "Programme ciblé"
        string channelId FK "Chaîne ciblée"
        int64 triggerTimeMs "Heure de notification (-5 min)"
    }
```

---

## 4. Stratégie de Performance & Sécurité

### 4.1 Politique de Mise en Cache HTTP & Mémoire
- **Assets PWA (`/`, `/index.html`, `/assets/*`)** : Gérés par le Service Worker (`public/sw.js`) avec stratégie *Stale-While-Revalidate* pour démarrage instantané hors-ligne.
- **Flux EPG (`/api/epg-proxy`)** : En-tête `Cache-Control: public, max-age=1800` (30 minutes) pour éviter de saturer la source distante.
- **Résumés Vidéo (`/api/public/yt`)** : En-tête `Cache-Control: public, max-age=3600` (1 heure).
- **Matchs en Direct (`/api/sports/fixtures`)** : En-tête dynamique : `max-age=30` secondes lorsqu'au moins un match est en cours, et `max-age=180` secondes en période creuse.

### 4.2 Sécurisation & Contrôle d'Accès
1. **Sanitization des requêtes** : Toutes les chaînes de recherche passées aux endpoints YouTube ou TMDB sont assainies via des regex Unicode strictes (`\p{L}\p{N}`) pour interdire toute injection.
2. **Cloisonnement des flux proxy** : Seuls les protocoles `https:` sont acceptés par `/api/epg-proxy` pour interdire tout contournement SSRF.
3. **Guard d'Authentification JWT** : L'accès aux jours J+1 à J+7 et au Replay passe obligatoirement par la vérification cryptographique du jeton Bearer auprès des profils de la base de données.
