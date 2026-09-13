# LUMEN — ce qui reste à faire

Ce fichier ne liste **que ce qui n'est pas fait**. Ce qui est terminé est
décrit dans le README et couvert par les tests ; rien n'y figure deux fois.

Chaque entrée dit ce qui manque, pourquoi c'est à ce rang, et à quoi on
reconnaîtra que c'est fini.

---

## Rang 1 — À faire avant tout le reste

### 1.1 Playtests humains

**Rien de ce qui suit ne devrait être priorisé avant d'avoir regardé trois
personnes jouer.** Le cahier des charges les demande explicitement, et aucun
n'a eu lieu : tout ce qui est écrit ici sur le plaisir, la lisibilité ou la
difficulté reste une hypothèse.

Les trois profils à observer, sans explication orale préalable :

- une personne débutante, au tactile, sur son propre téléphone ;
- une personne habituée aux jeux de plateforme, au clavier ou à la manette ;
- une personne qui découvre le jeu seule, sans que personne ne commente.

À mesurer : le temps avant le premier appel volontaire de la Résonance, les
endroits où l'on meurt deux fois de suite, les commandes déclenchées sans
l'avoir voulu, les moments où l'on sourit, et la réponse à « voulez-vous
recommencer ? ». La durée de session ne prouve rien à elle seule.

### 1.2 Le tactile sur un appareil réel

Les contrôles sont vérifiés par un navigateur qui simule le tactile : cibles
d'au moins 48 px, trois doigts simultanés, aucun doigt collé après une
annulation. **Aucun doigt humain ne les a touchés.** Restent à éprouver : la
latence réelle, le pouce qui masque Nilo, l'encoche, la barre de geste iOS,
et la question de savoir si la course au maintien est agréable ou surprenante.

### 1.3 Le portrait letterboxé

En portrait, le canevas se réduit à une bande centrale entourée de deux zones
vides. C'est jouable mais laid. À trancher : étirer la scène, remonter le HUD
dans la bande haute, ou assumer le paysage comme format recommandé avec une
invitation claire à tourner l'appareil.

---

## Rang 2 — Le contenu qui manque pour que ce soit un jeu

### 2.1 L'arc narratif en trois actes

Seul l'acte I existe, et seulement en germe : un observatoire, deux
personnages, une quête. Il manque la bascule de l'acte II — comprendre que le
Veilleur retenait des rêves devenus instables — et la résolution de l'acte III,
qui doit rétablir un équilibre plutôt que supprimer toute obscurité. Cette
dernière idée n'est nulle part dans le jeu actuel ; le Veilleur y est encore
un adversaire qu'on éteint.

### 2.2 Les situations mémorables annoncées

Aucune des quatre situations du cahier des charges n'est faite : traverser un
jardin sur le dos d'une créature endormie (le dormeur apaisé n'est qu'une
marche immobile, pas une monture) ; remettre en circulation une rivière de
lumière ; guider un petit astre à l'aide de fleurs ; reconstruire un pont par
les réactions d'êtres vivants.

### 2.3 Les gardiens des rêves

La salle finale d'une expédition réutilise le Veilleur de la campagne tel
quel. C'est honnête pour un premier jalon, mais une nuit mérite son propre
adversaire — au minimum deux variantes qui exploitent la Résonance plutôt que
l'esquive seule.

### 2.4 Plus de modules

Onze modules suffisent à produire des nuits valides, pas des nuits variées :
au bout de trois expéditions, on reconnaît les pièces. Viser une vingtaine,
dont des modules à eau et à verticalité forte. Les quatre invariants existants
(bords, raccords, capacités, franchissabilité) les valideront sans travail
supplémentaire.

### 2.5 La progression permanente

`codex` et `transformations` existent dans la sauvegarde et ne sont alimentés
que par la quête de la coupole. Rien n'utilise encore : le carnet des
créatures, les apparences, les décors d'observatoire, les souvenirs narratifs.

---

## Rang 3 — Dette technique assumée

### 3.1 La migration TypeScript

Le cahier des charges demande une migration **progressive** vers TypeScript
strict. Elle n'a pas commencé, et c'est délibéré : §12 interdit de remplacer
le premier jalon par une refonte technique sans contenu jouable, et le budget
de la session est allé au gameplay.

Le chemin le moins risqué, dans cet ordre : `tsconfig.json` avec `checkJs` et
`allowJs`, typage par JSDoc des modules déjà purs (`rng`, `save`, `resonance`,
`modules`, `expedition`, `upgrades`), puis `engine`, puis `renderer` en
dernier. Contrainte à ne pas perdre : le jeu doit rester ouvrable en `file://`
sans étape de construction, donc tout outillage doit produire du JavaScript
classique — ou `tools/build.cjs` doit être étendu pour le faire.

### 3.2 `engine.js` est devenu trop gros

Plus de mille lignes, et quatre responsabilités qui cohabitent : simulation,
expéditions, observatoire, progression. Les découper est facile — les trois
dernières ne touchent presque pas à la physique — mais mérite d'être fait
avant d'ajouter un cinquième sujet.

### 3.3 Le profilage n'a pas eu lieu

Aucune optimisation n'a été faite, et c'est volontaire : §11 demande de
mesurer avant d'optimiser. Il faut donc d'abord mesurer, sur de vrais
appareils. Les pistes à examiner ensuite, dans l'ordre de suspicion : le coût
de dessin du décor en parallaxe à 1440 px de large, les tableaux temporaires
créés chaque image dans `updateResonance` et `updateEnemies`, et le cache de
ciel qui n'est jamais purgé quand on change de thème.

### 3.4 Ce qui n'est pas testé

Honnêtement, et sans emballage :

- **le son** n'a aucun test ; il est simulé partout. Personne n'a vérifié que
  la couche de tension entre correctement, ni que le silence iOS se comporte
  bien ;
- **la manette** n'est vérifiée par aucun test, seulement par du code ;
- **le rendu** est testé contre un canevas factice : il prouve qu'aucune
  routine ne manque et qu'aucun NaN ne passe, pas que l'image est belle ni
  même correcte ;
- **les 1 000 graines** contrôlent des invariants géométriques, pas le plaisir.
  Une nuit peut être valide et ennuyeuse ;
- **la reprise d'expédition** est testée en Node et en navigateur, mais jamais
  après une vraie fermeture d'onglet de plusieurs jours ;
- **aucun test de performance** ne garde la cadence : le chiffre relevé par
  `npm run test:browser` est indicatif et varie du simple au quintuple selon
  la charge de la machine.

---

## Rang 4 — Plus tard, volontairement

Reportés parce que §12 le demande, pas parce qu'ils sont sans intérêt :
la grande campagne, les biomes nombreux, le multijoueur, un backend, la
publication en boutique, et le paquetage PWA ou Capacitor. Le code reste
compatible avec ces deux derniers — aucune requête externe, aucun état
serveur — mais emballer n'est pas valider : rien ne remplacera un essai sur
un appareil réel.
