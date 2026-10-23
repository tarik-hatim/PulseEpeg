# Plan d'Architecture & Implémentation : Filtres Unifiés & Expérience Sportive PulseEPG

## Résumé du Projet
Ce projet unifie l'architecture de filtrage et de recherche de PulseEPG en remplaçant la dispersion actuelle par une recherche unique par onglet, un volet compact de filtres TV partagé (tiroir latéral escamotable) organisé par intention, des filtres sportifs clarifiés (ruban de dates, périmètre bouquets réel, suppression de « Matchs uniquement »), et une fiche détaillée dédiée aux événements sportifs éradiquant les métadonnées cinématographiques hors sujet (acteurs, année de film, pays de production).

---

## Décisions Confirmées & Choix Produits

> [!IMPORTANT]
> Les trois choix d'interface clés ont été validés directement avec l'utilisateur lors de la phase de cadrage :
> 1. **Format du volet de filtres TV** : Tiroir latéral compact escamotable (*slide-over drawer* à droite, z-index 50, avec backdrop estompé et poignée de fermeture).
> 2. **Sélection de dates pour les matchs sportifs à venir** : Ruban horizontal de boutons de dates interactifs (`Toutes`, `Aujourd'hui`, `Demain`, `J+2`...) avec défilement fluide et indicateur actif.
> 3. **Fiche détaillée d'un événement sportif** : Fiche sportive pure et ciblée, sans métadonnées cinéma (aucun acteur, aucun pays de production de studio de film, aucune année de sortie), affichant le pays/zone, le nom de la compétition, la saison (ex: `2026/2027`), la journée ou phase (`Journée X` ou `Phase de ligue / 16e de finale`), avec illustration officielle de la compétition à la place du poster cinéma.

---

## 1. Vue d'Ensemble & Périmètre Fonctionnel

### A. Une seule recherche par onglet
- **En direct & Grille TV** : La barre de recherche principale en en-tête est la recherche universelle unique. Suppression du champ de recherche doublon qui figurait à l'intérieur de l'ancien volet de filtres. Conservation de l'effacement rapide et des recherches récentes.
- **Sport (`SportsView`)** : Conservation exclusive de la recherche sportive dédiée « Équipe, match ou compétition ». Masquage de la recherche générale TV qui n'agissait pas sur les matchs sportifs internationaux.
- **Favoris** : Recherche et tri des chaînes favorites uniquement, sans critères superflus non pertinents.

### B. Volet de filtres TV unifié par intention (Tiroir latéral escamotable)
- **Composant unique partagé** : `TvFilterDrawer.tsx` utilisé à la fois par la vue *En direct* (`LiveNow`) et la vue *Grille TV* (`TimeGridView`), éliminant la duplication de contrôles.
- **Rubriques claires par intention** :
  1. **Contenu** : *Tous*, *Films et séries*, *Sport*, *Documentaires*, *Actualités*, *Jeunesse*, *Musique et divertissement*.
  2. **Affiner films et séries** : *Premières cinéma*, *Action & thriller*, *Séries*, *Comédie & famille*, *Classiques* — affiché uniquement si *Films et séries* est actif.
  3. **Réception** : Sélecteur étagé Satellite puis Bouquet avec indication du nombre réel de chaînes correspondantes.
  4. **Pays / Marché** : Pays disponibles détectés dans les chaînes actives (France, Maroc, Espagne, Royaume-Uni, Allemagne, Italie, etc.) avec regroupements régionaux pertinents.
- **Sélection de date préservée** : La navigation temporelle (Aujourd'hui, Hier, Demain, J+1..J+7) reste hors des filtres car il s'agit d'une navigation dans le temps du guide.
- **Suppression du désordre visuel** : Disparition des boutons « Filtres SAT » redondants, des faux horloges répétées et des listes déroulantes concurrentes.
- **Gestion des états** :
  - Badge numérique cohérent sur le bouton « Filtres » indiquant le nombre de critères actifs.
  - Ruban de puces effaçables (*chips* révocables) pour retirer un filtre en un clic.
  - Bouton « Effacer les filtres » réinitialisant uniquement les critères (laisse intacts la recherche, la date choisie et le tri).
  - En cas de 0 résultat, affichage d'un état vide explicite avec bouton d'action « Réinitialiser les critères » sans réinitialisation silencieuse destructive.

### C. Filtres spécifiques à la vue Sport
- **Suppression de « Matchs uniquement »** : Le flux mondial et le détecteur EPG sport ne traitent déjà que de véritables rencontres sportives.
- **Ruban de dates pour « À venir »** :
  - Boutons : *Toutes les dates*, *Aujourd'hui*, *Demain*, *J+2 (date)*, *J+3 (date)*...
  - Filtrage instantané des affiches programmées sur le jour choisi.
- **Périmètre des diffuseurs clarifié** :
  - **Tous les matchs** : Explorer l'intégralité des rencontres internationales (UEFA, Botola, Premier League, LaLiga, etc.), même sans diffuseur dans les bouquets actuels.
  - **Avec une chaîne dans mes bouquets** : Conserver uniquement les matchs diffusés par au moins une chaîne présente dans les bouquets configurés de l'utilisateur.
- **Filtre « En clair » (FTA) contextualisé** : S'applique strictement aux diffuseurs du périmètre choisi (évite d'indiquer un match comme "en clair" si la chaîne gratuite est sur un satellite non capté).
- **Distinction visuelle de diffusion** : Badge distinct entre une diffusion EPG confirmée et une correspondance générale par droits de compétition.

### D. Fiche détaillée sportive (`ChannelDetailPanel.tsx`)
- Remplacement du bloc cinéma (réalisateur, casting d'acteurs, pays d'origine du studio, année de sortie de film) par un bloc d'informations sportives authentiques :
  - Territoire ou confédération (ex: *Italie*, *Angleterre*, *Europe / UEFA*, *Afrique / CAF*, *Monde*).
  - Titre de la compétition avec millésime de saison : *Serie A {2026/2027}*, *Ligue des Champions UEFA {2026/2027}*, *Botola Pro Inwi {2026/2027}*.
  - Phase de la compétition : *Journée X*, *Phase de ligue (classement)*, *32e de finale*, *16e de finale*, *8e de finale*, *Quart de finale*, *Demi-finale*, *Finale*.
  - Vignette / illustration compacte aux couleurs ou logo de la compétition au lieu d'un poster de film fictif.
  - Tableau des scores en direct, chronomètre ou statut du match, et liste des fréquences / transpondeurs satellite du diffuseur.

---

## 2. Architecture des Composants & Schéma du Système

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Top Navigation Bar                              │
│  [Logo PulseEPG]   [Onglets: Direct | Grille | Sport | Favoris]        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
          ┌─────────────────────────┴────────────────────────┐
          ▼                                                  ▼
┌───────────────────────────────┐          ┌───────────────────────────────┐
│        Vue TV / Grille        │          │          Vue Sport            │
│  • Recherche principale unique│          │  • Recherche dédiée match/club│
│  • Bouton "Filtres" (Badge N) │          │  • Onglets: Direct | À venir  │
│  • Chips filtres actifs       │          │  • Ruban dates (Tous/Auj/Dem) │
└──────────────┬────────────────┘          │  • Périmètre: Tous vs Bouquets│
               │                           │  • Compétitions UEFA/Ligues   │
               │ (clic Filtres)            └───────────────┬───────────────┘
               ▼                                           │
┌───────────────────────────────┐                          │ (clic match/ch)
│   TvFilterDrawer (Tiroir)     │                          ▼
│  • Contenu (Catégories)       │          ┌───────────────────────────────┐
│  • Affiner films & séries     │          │      ChannelDetailPanel       │
│  • Réception (Sat -> Bouquet) │          │ ───────────────────────────── │
│  • Pays / Marchés             │          │ • [MODE SPORT DÉDIÉ] :        │
│  • Boutons Appliquer / Reset  │          │   - Compétition & Saison      │
└───────────────────────────────┘          │   - Pays / Zone & Phase/Journée│
                                           │   - Pas d'acteurs / pays ciné │
                                           │   - Vignette de compétition   │
                                           │   - Équipes, Scores & Transp. │
                                           └───────────────────────────────┘
```

---

## 3. Plan Détaillé des Fichiers & Modifications

### Étape 1 : Création du composant partagé `TvFilterDrawer.tsx`
- **Fichier** : `/src/components/TvFilterDrawer.tsx`
- **Rôle** : Tiroir latéral escamotable z-50 avec transition fluide droite-gauche.
- **Fonctionnalités** :
  - Rubrique **Contenu** (Tous, Films & Séries, Sport, Documentaires, Actualités, Jeunesse, Musique).
  - Rubrique **Affiner films & séries** (conditionnelle : uniquement si Contenu = Films & Séries).
  - Rubrique **Réception** : Satellite puis Bouquet, calculant dynamiquement le nombre de chaînes réelles.
  - Rubrique **Pays / Marché** : Liste des pays déduits des chaînes avec puces sélectionnables.
  - Masquage des rubriques sans choix disponible, sauf si un filtre y est actuellement actif.
  - Boutons d'action : « Réinitialiser les filtres » (efface uniquement les critères) et « Fermer / Appliquer ».
  - Support de l'accessibilité D-Pad télécommande, clavier (`Escape` pour fermer) et affichage RTL en langue arabe.

### Étape 2 : Intégration dans `App.tsx` & `TimeGridView.tsx`
- Remplacement des blocs de filtres éclatés dans `App.tsx` par un appel unique à `TvFilterDrawer`.
- Suppression du champ de recherche secondaire dans le volet.
- Affichage des puces révocables sous la barre de recherche dans `App.tsx` et dans `TimeGridView.tsx`.
- Suppression des boutons « Filtres SAT » doublons et harmonisation du badge de décompte des critères.

### Étape 3 : Refonte des filtres dans `SportsView.tsx`
- Suppression définitive du bouton inutile « Matchs uniquement ».
- Implémentation du **ruban horizontal de sélection de dates** pour les matchs à venir (*Toutes*, *Aujourd'hui*, *Demain*, *J+2*...).
- Séparation explicite des deux intentions de diffuseurs :
  - Bouton commutateur : `Tous les matchs (Monde)` vs `Avec chaîne dans mes bouquets`.
  - Si `Avec chaîne dans mes bouquets` est sélectionné, filtrer la liste des événements pour n'afficher que ceux disposant d'au moins une chaîne dans `selectedBouquets`.
- Alignement du filtre « En clair (FTA) » sur le périmètre choisi.
- Badge distinctif clair entre diffusion EPG confirmée et suggestion par droits de diffusion.

### Étape 4 : Fiche détaillée dédiée au sport dans `ChannelDetailPanel.tsx`
- Détection automatique si le programme sélectionné est un événement sportif :
  - `displayProg.category?.includes('Sport')`, ou `matchedEvent?.isMatch`, ou détection regex football/sport.
- **Remplacement de l'en-tête et métadonnées** :
  - Remplacement du pays de production cinéma par le pays/territoire de la compétition (Italie, Angleterre, Espagne, France, UEFA...).
  - Affichage de la saison sportive : `{2026/2027}` ou `{2025/2026}`.
  - Affichage de la journée ou phase (`Journée X`, `Phase de ligue`, `16e de finale`...) extrait du titre ou du sous-titre EPG.
  - Élimination complète de la section acteurs, réalisateurs et année de film pour les événements sportifs.
  - Remplacement de l'affiche de film (poster portrait) par une bannière/logo élégante de la compétition sportive.

### Étape 5 : Validation & Compilation
- Vérification TypeScript et exécution de `compile_applet`.
- Vérification visuelle sur les différents onglets (Direct, Grille, Sport) et scénarios de filtres vides.
