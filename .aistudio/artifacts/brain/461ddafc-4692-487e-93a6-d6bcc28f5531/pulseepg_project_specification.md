# PulseEPG (دليلك الشامل للقنوات) — Spécification & Documentation Complète du Projet

---

## 1. Vision et Présentation du Produit

**PulseEPG** est une application web progressive (PWA) et mobile (Capacitor Android) haute performance dédiée au guide des programmes de télévision et au suivi en temps réel des grands événements sportifs internationaux et régionaux.

L'application est conçue pour répondre aux besoins d'une audience multilingue (Arabe, Français, Anglais, Espagnol) avec une attention particulière apportée aux bouquets satellites majeurs du monde arabe et européen :
- **Nilesat (7.0°W)**
- **Badr / Es'hailSat (26.0°E)**
- **Astra (19.2°E & 28.2°E)**
- **Hotbird (13.0°E)**

### Fonctionnalités Clés :
1. **Guide TV Interactif (EPG)** :
   - Grille dynamique jour par jour (Aujourd'hui, J+1 à J+7, et Replay/Catch-up jusqu'à J-7).
   - Décompression et parsing en arrière-plan via Web Worker (`epgWorker.ts`).
   - Filtrage par bouquets (Nilesat, beIN / SSC, Canal+, bouquets gratuits FTA, etc.).
   - Prise en charge RTL native pour l'arabe avec typographie adaptée et sans débordement.
2. **Espace Sports & Matchs en Direct** :
   - Détection automatique et catégorisation des affiches sportives (Football, Rugby, Basketball, Tennis, F1, MotoGP, etc.).
   - Suivi certifié des matchs en direct (**Direct Réel** avec temps écoulé et score instantané).
   - Élimination stricte des faux directs : un match terminé (joué hier ou plus tôt) est toujours classé sous "Matchs terminés" avec son score final réel.
   - Consultation des chaînes diffusant chaque rencontre sur chaque position orbitale.
3. **Résumés Vidéo Officiels In-App** :
   - Intégration directe des temps forts (Highlights) sans redirection externe.
   - Sélecteur de langue des commentateurs (Commentaires arabes beIN Sports / SSC, français Canal+/RMC, anglais TNT/CBS, espagnol Movistar).
4. **Catalogue Satellite & Transpondeurs** :
   - Fréquences complètes, polarisations (H/V), débits de symboles (SR), FEC et normes (DVB-S/S2, QPSK, 8PSK).
5. **Comptes & Mode Pro (PulseEPG Pro)** :
   - Synchronisation des favoris et alertes/rappels sur Cloud Firestore.
   - Accès exclusif à la grille EPG étendue (J+1 à J+7) et au Replay pour les membres Pro.
   - Compte testeur Premium Pro configuré : `tarik.hatim@gmail.com`.

---

## 2. Architecture Technique

### 2.1 Stack Technologique
- **Frontend** : React 19, TypeScript 5.8, Tailwind CSS v4, Lucide React (icônes vectorielles).
- **Backend / Serveur d'Applet** : Node.js, Express, `server.ts` exécuté avec `tsx`.
- **Packaging Mobile** : Capacitor 7 (Android / Web).
- **Bases de Données & Services Cloud** :
  - **Firebase Firestore** : Rôles, profils utilisateurs, favoris, rappels de diffusion et paramètres.
  - **Supabase Auth** : Authentification JWT, table `public.profiles`.
  - **APIs Externes** : Scoreboards ESPN (scores certifiés), YouTube Data/oEmbed (résumés vidéo), TMDB / TVMaze (métadonnées cinéma & séries).

### 2.2 Schéma de Flux des Données
```
[ Source EPG XML.GZ ] 
       │
       ▼
[ Serveur Express /api/epg-proxy ] ──(Streaming sans blocage CORS)──► [ Web Worker client (epgWorker.ts) ]
                                                                                │
                                                                 (Décompression pako / parsing XML)
                                                                                │
                                                                                ▼
[ ESPN Scoreboards API ] ──► [ Express /api/sports/fixtures ] ──► [ Moteur Sportif (sportsEngine.ts) ]
                                                                                │
                                                                                ▼
                                                                     [ Interface React (SportsView.tsx) ]
```

---

## 3. Moteur Sportif & Gestion Certifiée des Scores

Le moteur sportif (`src/utils/sportsEngine.ts` et `src/components/SportsView.tsx`) a été entièrement renforcé pour garantir l'exactitude des informations :

### 3.1 Règles de Classification des Événements
1. **Match en Direct (`liveEvents`)** :
   - **Condition 1** : La rencontre provient de l'API officielle (`fixtureMeta`) avec `isLive === true` et `!isEnded`.
   - **Condition 2** : Si issue d'une grille TV locale, elle doit être dans sa fenêtre horaire (`startMs <= nowMs < stopMs`), comporter une mention explicite de DIRECT dans le titre (`isExplicitlyLiveTitle`), ne pas être une rediffusion (`!isReplay`), et sa durée depuis le coup d'envoi doit être **inférieure ou égale à 105 minutes** (90 min de temps de jeu + 15 min de mi-temps).
   - **Condition 3** : Tout match répertorié comme achevé dans le calendrier mondial ne peut jamais être classé en direct.
2. **Matchs Terminés (`endedEvents`)** :
   - Regroupe tous les matchs achevés (statut `FT`, `Final`, `Terminé`, `نهاية المباراة`).
   - Affiche le score exact officiel (ex: `Paris Saint-Germain 4 - 2 Barcelona`).
3. **Matchs À Venir (`upcomingEvents`)** :
   - Regroupe les affiches programmées dont le coup d'envoi est postérieur au temps présent (`startMs > nowMs`).
   - N'affiche pas de faux score `0 - 0` tant que le coup d'envoi n'a pas été donné.

### 3.2 Prévention des "Trois Zéros" (`0 | 0 : 0 | 0`)
Auparavant, lorsqu'un score n'était pas disponible dans le flux, le système affichait par défaut `'0'`. Désormais :
- Les scores ne s'affichent que si des données officielles réelles existent (`homeScore !== undefined && awayScore !== undefined`).
- Pour une retransmission télévisuelle sans télémétrie de score en temps réel, l'interface affiche proprement un indicateur textuel certifié `[ بث مباشر جاري / Diffusion en direct ]` sans forcer un faux `0 : 0`.

---

## 4. Endpoints d'API du Serveur (`server.ts`)

| Méthode | Route | Description | Cache |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/sports/fixtures` | Récupère les rencontres officielles (UCL, UEL, Premier League, LaLiga, Serie A, Bundesliga, Botola Pro, MLS, etc.) avec scores certifiés, état (`isLive`, `isEnded`), et liste des diffuseurs satellites. | 30s (si live) / 180s |
| `GET` | `/api/public/yt` | Recherche et valide les vidéos de résumés officiels sur YouTube en fonction de la langue demandée (`ar`, `fr`, `en`, `es`). | 3600s |
| `GET` | `/api/epg-proxy` | Proxy de streaming HTTP pour télécharger les fichiers `.xml.gz` volumineux en contournant les restrictions CORS navigateur. | 1800s |
| `GET` | `/api/metadata-enrich`| Enrichissement des programmes cinéma/séries avec affiches HD TMDB, sous-titres et casting traduit. | 86400s |
| `GET` | `/api/trailer-search` | Détecte l'identifiant YouTube de la bande-annonce officielle d'un film ou série pour lecture in-app. | 86400s |
| `GET` | `/api/epg/extended` | Guard de sécurité côté serveur pour vérifier le statut Pro (Token JWT) avant de délivrer le guide étendu (J+1 à J+7). | Non mis en cache |

---

## 5. Satellites & Positions Orbitales Couverts

L'annuaire de fréquences et de correspondances (`src/utils/sportChannelsWhitelist.ts` et `src/services/satelliteCatalogService.ts`) intègre les positions suivantes :

1. **Nilesat 201 / 301 (7.0°W)** :
   - Chaînes phares : Arryadia TNT, ON Time Sports, beIN Sports News FTA, Abu Dhabi Sports, Al Kass, MBC, Dubai TV.
   - Fréquences optimisées : 11559 V (27500), 11474 V (27500), 12054 V (27500).
2. **Badr 4/5/6/7 / Es'hailSat (26.0°E)** :
   - Chaînes phares : Bouquet beIN Sports MENA (HD 1 à 9, Max 1 à 4, English 1-2, French 1-2), SSC (Saudi Sports Company 1-5), Al Kass One/Two.
   - Fréquences optimisées : 10850 H (27500), 12380 H (27500), 12418 H (27500).
3. **Astra 1KR/1L/1M/1N (19.2°E)** :
   - Chaînes phares : Canal+ Foot, Canal+ Sport 360, beIN Sports FR 1-3, DAZN 1, Movistar Liga de Campeones, Sky Sport Bundesliga.
   - Fréquences optimisées : 12012 V (29700), 11856 V (29700), 12515 H (22000).
4. **Hotbird 13F/13G (13.0°E)** :
   - Chaînes phares : Sky Sport Calcio, Polsat Sport 1-3, Rai Sport, Eurosport 1-2.
   - Fréquences optimisées : 11996 V (29900), 12284 H (27500).

---

## 6. Sécurité, Rôles & Données Utilisateur

### 6.1 Règles Firestore (`firestore.rules`)
- **Collection `users/{userId}`** : Chaque utilisateur a un contrôle d'accès strict (lecture/écriture restreinte à son propre `request.auth.uid`).
- **Collection `reminders/{reminderId}`** : Gestion des rappels de programmes programmés.
- **Vérification Pro** : Les champs `is_pro` et `role` dans `profiles` sont vérifiés côté serveur pour les fonctionnalités restreintes (Guide étendu, Replay J-7).

### 6.2 Utilisateur Testeur Pro
- **Email** : `tarik.hatim@gmail.com`
- **Statut** : Premium Pro Permanent (Accès total au guide étendu, tous satellites et Replay illimité).

---

## 7. Structure des Dossiers du Projet

```
.
├── server.ts                             # Serveur Express & Endpoints API (proxy EPG, sports, trailers, TMDB)
├── index.html                            # Entrée HTML principale (PWA, metas, configuration RTL)
├── package.json                          # Dépendances et scripts de build
├── firestore.rules                       # Règles de sécurité Firestore
├── firebase-blueprint.json               # Schéma des collections de la base de données
├── public/
│   ├── manifest.json                     # Configuration PWA & icônes
│   ├── sw.js                             # Service Worker de mise en cache offline
│   └── data/
│       ├── catalog.json                  # Catalogue condensé des chaînes satellites
│       └── oe_tr.xml                     # Base XML des transpondeurs et satellites
├── src/
│   ├── App.tsx                           # Composant racine, orchestration de l'état global et navigation
│   ├── main.tsx                          # Point de montage React 19
│   ├── index.css                         # Styles Tailwind CSS et corrections de marge RTL
│   ├── components/
│   │   ├── SportsView.tsx                # Vue Sports & Matchs, direct certifié, filtres & lecteur vidéo
│   │   ├── EpgGrid.tsx                   # Grille EPG interactive avec timeline horizontale
│   │   ├── ChannelList.tsx               # Liste des chaînes par bouquet/satellite
│   │   ├── TransponderModal.tsx          # Fiche technique du transpondeur / satellite
│   │   ├── SettingsModal.tsx             # Paramètres de profil TV, filtres satellites et langue
│   │   └── TrailerModal.tsx              # Lecteur in-app des bandes-annonces
│   ├── services/
│   │   ├── satelliteCatalogService.ts    # Moteur de recherche et mapping des transpondeurs
│   │   ├── storageService.ts             # Gestionnaire de cache IndexedDB et fallbacks
│   │   └── notificationService.ts        # Gestion des alertes de début de match/émission
│   ├── utils/
│   │   ├── sportsEngine.ts               # Détection multilingue des affiches, scores et direct
│   │   ├── sportChannelsWhitelist.ts     # Référentiel des chaînes sportives mondiales et satellites
│   │   ├── metadataResolverCore.ts       # Résolution des jaquettes TMDB et traductions
│   │   └── timeFormat.ts                 # Formats horaires et conversion de chiffres arabes/latins
│   └── workers/
│       └── epgWorker.ts                  # Web Worker de décompression .xml.gz et parsing XMLTV
```

---

## 8. Commandes et Déploiement

- **Lancement en développement** :
  ```bash
  npm run dev
  ```
  *(Démarre `server.ts` sur le port 3000 avec Vite monté en middleware)*
- **Compilation de production** :
  ```bash
  npm run build
  ```
- **Vérification TypeScript et Lint** :
  ```bash
  npm run lint
  ```
- **Synchronisation Mobile Capacitor (Android)** :
  ```bash
  npx cap sync android
  ```
