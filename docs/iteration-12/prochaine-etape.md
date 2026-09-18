# Prompt — itération 13 de LUMEN

> À coller tel quel dans une nouvelle session, avec le dépôt `~/Repos/lumen`
> connecté. Tout le contexte nécessaire est dedans.

---

Tu reprends LUMEN, mon jeu de plateforme 2D (dépôt `~/Repos/lumen`, branche
`main`). L'itération 12 vient d'être terminée et poussée ; l'arbre est propre.
Lis `docs/iteration-12/README.md` avant de commencer : il décrit exactement ce
qui a été fait et ce qui ne l'a pas été.

## Ce qui est déjà réglé — ne pas y revenir

- **Les commandes tactiles.** Elles ont été refaites : cible inchangée
  (88 / 96 / 80 px), encre réduite (66 / 72 / 62 px), disques de verre
  translucides, plus de bandeau, plus de bouton « bas ». Verrouillé par
  `tests/test-mobile.cjs` et `tests/test-browser.cjs`. N'y touche pas sans
  que je le demande.
- **L'issue #3, première moitié — le portail bloqué.** Les lieux gardés
  annoncent leur condition en permanence, un portail fermé répond quand on
  arrive dessus, et une balise au bord de l'écran désigne ce qui manque quand
  c'est hors champ. Les aides de niveau atteignent enfin le tactile.
  Verrouillé par `tests/test-places.cjs` et un contrôle navigateur dédié.
- **Les palettes.** `Le petit astre égaré` et `Là où pleut la lumière`
  partageaient la palette `secret` ; ils ont maintenant `dusk` et `rain`. Les
  six lieux ont six ciels distincts.

## Ce qui reste — la vraie demande

L'issue #3 dit aussi : « créativité très nulle, c'est le même stage répété,
il faut changer de voyage, de thème et d'épreuve ». Le constat est juste, et
il est structurel, pas cosmétique.

Les six lieux (`js/levels.js`, ids 12 à 17) proposent bien six idées
différentes — porter, escorter, enchaîner, rallumer, monter, faire pousser —
mais :

- **quatre d'entre elles se jouent avec le même verbe** : appeler avec la
  Résonance, au bon endroit, au bon moment ;
- **cinq sur six sont une bande de sol plat parcourue de gauche à droite**,
  avec trois à six corniches entre y=375 et y=490 et des arcs de notes. Seule
  `colonne-des-saisons` s'en distingue vraiment — et c'est justement celle
  qu'on reconnaît du premier coup d'œil.

### Commence par me faire choisir

**Ne code rien avant que j'aie tranché.** Analyse d'abord les six lieux et
présente-moi, en une page maximum, ce que tu proposes selon ces trois axes —
avec pour chacun le lieu concerné, ce qui change concrètement, et ce que ça
coûte en risque de régression :

1. **Varier le verbe.** Un lieu qui ne se résout pas par un appel : du
   placement, du rythme, une contrainte de trajet, un objet à porter.
2. **Varier la silhouette.** Rompre le sol continu : archipel, descente,
   aller-retour, boucle. Les places `escort`, `rain` et `ride` sont les plus
   plates.
3. **Varier l'épreuve dans le temps.** Un lieu qui change d'état à
   mi-parcours au lieu de tenir un seul mécanisme de bout en bout.

Pose-moi une question à choix multiples pour que je décide de la direction et
du nombre de lieux à retravailler. Ensuite seulement, implémente.

## Contraintes fermes

- **Le pilote doit continuer à finir chaque lieu.** `tests/place-pilot.cjs`
  rejoue les lieux avec de vraies entrées et des waypoints
  (`level.place.pilot`). Si tu changes la géométrie, mets les waypoints à jour
  et prouve la jouabilité avec `npm run test:places` — pas d'astuce, pas de
  téléportation, pas d'invulnérabilité injectée.
- **Les contrats de lieu tiennent** : `CONTRACTS` dans
  `tests/test-places-playthrough.cjs` (métriques minimales par type de lieu).
- **Chaque lieu garde** 3 éclats, ≥ 2 lanternes posées sur du sol sûr, ≥ 1
  passage secret — vérifié par le premier test de `tests/test-places.cjs`.
- **L'ordre du voyage ne change pas** : `npm run test:order`.
- **Toute phrase nouvelle visible par le joueur** (nom, sous-titre, objectif,
  aide) doit être traduite dans les cinq langues, sinon `tests/test-i18n.cjs`
  échoue. Et **n'écris aucune aide qui nomme une touche du clavier** si elle
  doit atteindre le tactile — relis la règle `namesAKey` dans `js/ui.js`.
- **Le poids des images suivies est à 5,3 Mo sur un budget de 6,0 Mo.** Si tu
  régénères `docs/platforms/`, surveille `npm run test:weight`.

## Méthode que je veux

- Un jalon = un commit, message en français, dans le style de l'historique
  récent : ce qui n'allait pas, ce qui a été décidé, ce qui a été vérifié.
- `npm run verify` vert avant chaque commit (build + 17 suites Node + les
  suites navigateur Chromium).
- Des captures avant / après dans `docs/iteration-13/`, et un rapport qui dit
  aussi ce qui n'a **pas** été fait et pourquoi.
- **Commite localement, ne pousse pas.** Je pousse moi-même.

## Réserve à répéter dans le rapport

WebKit n'est pas installable dans la session (réseau restreint) et aucun
iPhone physique n'est interrogé. Les contrôles prouvent des règles appliquées,
pas le ressenti du pouce.
