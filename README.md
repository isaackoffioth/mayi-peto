# Mayi Peto — filtre à eau low-cost pour la RDC

> *Mayi peto* signifie « eau propre » en lingala.

Projet **Engineers Without Borders — IMT Atlantique (FISE A2, 2026-2027)**, sujet *Low-Cost Water Purification for Rural Communities in developing countries*. Pays choisi : la **République démocratique du Congo**.

🌐 **Site :** https://isaackoffioth.github.io/mayi-peto/

## Le purificateur

Le système fonctionne par gravité, en trois étapes et sans électricité :

| Étape | Contenant | Contenu |
|---|---|---|
| 1. Pré-traitement | Seau 20 L | Décantation 1–2 h + graines de **moringa** (coagulant) + **pagne** plié en 4 |
| 2. Filtration | Fût alimentaire 60 L sur plateforme surélevée | Diffuseur, 5 cm d'eau + biofilm, **sable fin 30 cm**, tissu, **charbon (makala) 5 cm**, sable grossier 4 cm, gravier 5 cm, **sortie surélevée** |
| 3. Désinfection | Seau 20 L fermé avec robinet | **Chlore** (30 min) ou **SODIS** (6 h de soleil) |

- Coût indicatif : **≈ 13 € (≈ 33 000 FC)** à l'achat, ≈ 0,60 € (≈ 1 600 FC) par mois en fonctionnement
  - Les estimations de base sont en dollars US. Le site les convertit avec 1 $ ≈ 0,89 € et 1 € ≈ 2 547 FC (taux de la Banque Centrale du Congo, 11/11/2026). Pour mettre à jour les taux, modifiez `RATE` dans `js/main.js`.
- Débit : ≤ 0,4 L/min, soit 30–40 L/jour (famille de 5)
- Objectif : niveau ★ « protecteur » de l'OMS **avec désinfection**. La potabilité devra être confirmée par analyse en laboratoire.

## Le site

| Onglet | Contenu |
|---|---|
| Accueil | Problème, chiffres clés, innovation |
| Le filtre | Schéma en coupe, étapes, coûts, fabrication, entretien, comparaison, Afrique vs Asie du Sud |
| Simulateur | Construction d'un filtre couche par couche : qualité de l'eau, débit, coût et erreurs de conception (modèle pédagogique calibré sur l'OMS 2022) |
| Sensibilisation | Maladies, 6 bons gestes en pictogrammes, idées reçues, SODIS, moringa, quiz |
| Carte | 2 453 points d'eau de RDC issus d'OpenStreetMap |
| Le projet | PESTLE, plan de mise en œuvre, partenaires, sources |

Le site est bilingue (FR/EN), avec un bouton pour choisir le fond noir ou le fond blanc (le choix est mémorisé). C'est un site statique : HTML, CSS et JavaScript, sans étape de compilation.

**Style :** design éditorial sombre (grandes capitales grotesk, italique serif, étiquettes en mono, une couleur d'accent cyan). Le motion design est dans `js/motion.js` :

- apparitions au défilement et titres révélés ligne par ligne
- texte qui s'allume mot à mot, compteurs animés et parallaxe
- bandeau défilant, barre de progression, curseur personnalisé et rideau animé entre les onglets

Les animations sont désactivées si le système demande de réduire les animations. Pour changer la couleur d'accent, modifiez `--accent` dans `css/style.css`.

### Lancer en local

```bash
python -m http.server 8000
```
puis ouvrir http://localhost:8000.

### Mettre à jour les données de la carte

`data/waterpoints.json` est un extrait d'OpenStreetMap (© contributeurs OSM, licence ODbL), obtenu via l'API Overpass avec les tags `amenity=drinking_water|water_point`, `man_made=water_well|water_tap|water_tower|water_works` et `natural=spring` dans la zone `ISO3166-1=CD`.

## Limites

- Les paramètres du simulateur sont des **estimations pédagogiques**, pas des mesures.
- Les prix sont indicatifs et doivent être vérifiés sur un marché local.
- Les données OSM sont incomplètes, surtout en zone rurale.

## Équipe

*À compléter.*
