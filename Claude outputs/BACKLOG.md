# LUMEN — ce qui reste à faire

Ce fichier ne liste **que ce qui n'est pas fait**. Ce qui est terminé est
décrit dans le README, couvert par les tests, et l'audit du jalon A est dans
`docs/audit-iteration-04.md`. Rien n'y figure deux fois.

Chaque entrée dit ce qui manque, pourquoi c'est à ce rang, et à quoi on
reconnaîtra que c'est fini.

**État des jalons de l'itération 04.** Jalon A (défauts P0) : **fait**, 28
promesses tenues par `tests/test-p0.cjs`. Jalons B, C et D : **non entamés**.

---

## Les trois prochaines hypothèses, classées par impact

Une hypothèse n'est pas une tâche : c'est une chose qu'on croit, qu'il faut
éprouver, et qu'on garde ou qu'on jette selon ce qu'on observe.

**1. Le joueur n'apprend pas la Résonance parce qu'il ne la rencontre pas
assez tôt.** Le bouton principal de l'accueil mène au chapitre 1, où la
Résonance n'a rien à réveiller ; la première utilisation significative est au
chapitre 10. Si c'est vrai, une séquence d'ouverture de deux minutes devrait
suffire à faire apparaître le premier appel volontaire dans la première
minute de jeu. *À mesurer : le temps avant le premier appel volontaire, chez
trois personnes qui n'ont rien lu.* (P1-3)

**2. Le bouton d'action trahit l'intention quand Nilo porte `comet`.** Le même
appui appelle une onde et déclenche une ruée : vouloir un pont provoque une
chute. Si c'est vrai, on devrait voir des morts jugées injustes exactement
dans les salles à pont, et seulement chez les porteurs de `comet`. *À mesurer :
les morts par chute dans les deux minutes suivant le ramassage de `comet`.*
(P1-1)

**3. Les souvenirs ne changent rien parce qu'ils ne sont jamais utilisables.**
`powersSeen` reste vide, aucun module ne distribue de pouvoir, et l'onde du
souffle ne sème pas de corolle : l'« Escalier de corolles » est une
description sans effet. Si c'est vrai, un joueur à qui l'on demande « qu'est-ce
que ce souvenir t'a permis de faire ? » ne devrait pas savoir répondre.
*À mesurer : la réponse à cette question, après une nuit complète.* (P1 / §3.1)

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

À relever, dans cet ordre : le temps avant le **premier appel volontaire** de
la Résonance, les **erreurs de commande** (une action déclenchée sans l'avoir
voulu), les endroits où l'on **meurt deux fois de suite**, les **décisions
comprises** (« pourquoi as-tu pris ce chemin ? »), les **moments de
découverte**, et l'**envie déclarée** de recommencer. La durée de session ne
prouve rien à elle seule. Trois personnes servent à trouver des problèmes, pas
à prédire un succès.

### 1.2 Le tactile sur un appareil réel

Les contrôles sont vérifiés par un navigateur qui simule le tactile : cibles
d'au moins 48 px, trois doigts simultanés, aucun doigt collé après une
annulation. **Aucun doigt humain ne les a touchés.** Et un test à trois
pointeurs ne démontre pas que le chemin principal se joue **à deux pouces** :
c'est cela qu'il faut éprouver. Restent aussi à voir : la latence réelle, le
pouce qui masque Nilo, l'encoche, la barre de geste iOS, la suspension et la
reprise, l'audio après interruption, l'autonomie et l'échauffement.

### 1.3 La course automatique après 0,38 s

Le maintien de la direction déclenche la course au bout de 0,38 seconde.
Personne n'a comparé ce comportement à une alternative plus prévisible (un
bouton de course, ou un seuil de vitesse). **Ne pas le changer sans test
utilisateur** — mais le tester fait partie du rang 1.

### 1.4 Le clic avalé pendant le fondu

Chaque changement d'écran pose un fondu de 620 ms pendant lequel `transition()`
**ignore silencieusement** toute commande. Un joueur qui enchaîne deux clics
perd le second sans aucun retour. C'est un défaut de « commandes fiables »,
trouvé par le test de bout en bout du jalon A. À trancher : file d'attente
d'une commande, fondu plus court, ou retour visuel pendant le fondu.

### 1.5 Le portrait letterboxé

En portrait, le canevas se réduit à une bande centrale entourée de deux zones
vides. C'est jouable mais laid. À trancher : étirer la scène (sans étirer
Nilo), remonter le HUD dans la bande haute, ou assumer le paysage comme format
recommandé avec une invitation claire à tourner l'appareil.

---

## Rang 2 — Jalon B : les souvenirs et l'intention d'action

### 2.1 Les souvenirs sont inertes

Quatre défauts distincts, tous confirmés par lecture du code et aucun encore
corrigé :

- `powersSeen` est initialisé à `[]` et **rien ne l'alimente** ; `offer()`
  retombe donc toujours sur son pool de secours et propose `souffle` ou
  `sillage` à qui n'a jamais vu `breeze` ni `comet` ;
- les onze modules ont tous `provides: []` : **aucun pouvoir ne circule** dans
  une expédition, et le contrôle de dépendance des capacités, bien que réel,
  ne contraint rien ;
- `emitResonance` n'appelle `dropCorolle()` que pour `source === 'player'` ;
  le second saut émet avec `source === 'souffle'`, donc l'**Escalier de
  corolles ne fonctionne pas** ;
- les tests de combinaison vérifient le **texte** de la combinaison, pas son
  effet physique.

Une politique à choisir et à écrire : ou bien le souvenir **accorde** la
capacité dont il dépend pendant la nuit, ou bien la route **garantit** son
acquisition avant de proposer le souvenir. Un pouvoir aperçu puis expiré ne
rend pas une offre utile.

### 2.2 Le remplacement automatique du plus ancien souvenir

`equip()` fait `list.shift()` quand les deux places sont prises : le joueur
perd un souvenir sans l'avoir décidé. À remplacer par un choix explicite de
l'emplacement, une comparaison courte des deux effets, et la possibilité de
refuser sans pénalité.

### 2.3 L'intention d'action avec `comet`

Voir l'hypothèse 2 ci-dessus. Contraintes à ne pas perdre : pas de troisième
bouton obligatoire, pas de délai ajouté à toutes les actions pour distinguer
deux gestes, saut variable / coyote time / saut mémorisé intacts, et toute
modification de cadence documentée et testée.

### 2.4 La lisibilité de l'appel

Le joueur doit pouvoir voir : ce qui peut répondre, ce qui est à portée, si
l'appel est disponible, quel objet a relayé l'onde, et combien de temps un
passage reste actif. Aujourd'hui l'enveloppe visuelle de l'onde et son
enveloppe de détection ne sont pas alignées, un carillon actif disparaît au
lieu de sonner, et un appel pendant la recharge ne produit aucun retour.

---

## Rang 3 — Jalon C : le contenu qui manque

### 3.1 Les premières minutes

Le bouton de démarrage mène au chapitre 1, où la Résonance n'a rien à
réveiller. La séquence d'ouverture demandée (marcher → observer un phénomène →
déclencher → varier → détour facultatif → conséquence visible) n'existe pas.
Contrainte : préserver les clés historiques et la progression si l'ordre de
campagne change.

### 3.2 « La rivière qui avait oublié la lune »

Le chapitre phare n'existe pas. Structure demandée : apprentissage sûr,
variation par relais, choix bas tolérant / haut exigeant, combinaison avec une
créature apaisée, transformation visible, conclusion courte. Avec une réussite
principale claire, trois secrets de natures différentes (observation, maîtrise,
combinaison), un checkpoint avant le passage complexe, une solution sans
pouvoir temporaire, et une route experte.

### 3.3 Le Jardinier des marées

La salle finale d'une expédition réutilise le Veilleur de la campagne tel quel.
Le gardien propre aux rêves n'existe pas : trois étapes courtes, pas d'attente
invulnérable, un budget d'interactions par fenêtre, et une victoire possible
sans combinaison rare.

### 3.4 L'arc narratif en trois actes

Seul l'acte I existe, en germe : un observatoire, deux personnages, une quête.
Il manque la bascule de l'acte II et la résolution de l'acte III, qui doit
**rétablir un équilibre** plutôt que supprimer toute obscurité — idée
aujourd'hui absente du jeu, où le Veilleur reste un adversaire qu'on éteint.

### 3.5 Plus de modules (quatre au maximum)

Onze modules produisent des nuits valides, pas des nuits variées. Les quatre
autorisés doivent produire des **décisions nouvelles**, pas des dimensions
nouvelles : un relais à deux conséquences observables, un passage bas sûr
doublé d'un détour récompensé, une traversée exploitant une combinaison, une
courte rencontre liée à une découverte. Les invariants existants les valideront
sans travail supplémentaire. À mesurer sur un corpus fixe : taux de répétition
et taux de repli.

### 3.6 La récompense durable

`codex` et `transformations` existent dans la sauvegarde et ne sont alimentés
que par la quête de la coupole. Rien n'utilise encore le carnet des créatures,
les apparences, les décors d'observatoire ni les souvenirs narratifs.

---

## Rang 4 — Jalon D : génération, présentation, mesure

### 4.1 Apparence et gameplay sont encore mêlés

Le thème `frost` est tiré du **flux cosmétique** et modifie pourtant la
friction au sol (`engine.js`, `friction = theme === 'frost' ? 520 : 2300`).
Une donnée d'apparence change une règle de jeu : à séparer en deux jeux de
données, `apparence` (palette, décor, nom) et `gameplay` (friction, eau, vent,
danger, capacités).

### 4.2 L'aléatoire non versé au flux

La pluie du Veilleur place ses marqueurs avec `Math.random()` : une tentative
n'est donc pas reproductible jusqu'au bout. Tout tirage qui influence le
résultat d'une tentative doit passer par un flux nommé.

### 4.3 `inspect()` ne rejette rien

La fonction range ses erreurs dans le plan et la salle est livrée telle quelle.
Le corpus n'en trouve aucune aujourd'hui, mais rien n'empêche une salle fautive
de sortir. À faire : rejeter, réessayer un nombre borné de fois, puis fournir
un repli valide pour les conditions d'entrée réelles. Et étendre les contrôles
à l'accessibilité réelle des plateformes, aux hauteurs et durées compatibles
avec les mouvements, à la portée des relais et à la route avec les capacités
réellement disponibles.

### 4.4 `cost` n'est utilisé nulle part

Le budget de difficulté est déclaré sur chaque module, vérifié par un test,
et **jamais lu par la composition**. Soit il pilote le rythme, soit il
disparaît.

### 4.5 L'observatoire est encore un chapitre dans l'atlas

Le bandeau d'entrée est corrigé (« L'OBSERVATOIRE », et les salles de rêve
annoncent « NUIT · SALLE n / 5 »), mais la carte de l'atlas affiche toujours
l'observatoire comme un douzième chapitre, numéroté.

### 4.6 La manette n'atteint pas tous les menus

Routes, récompenses, confirmation, retour, réglages et réessai doivent être
accessibles à la manette. Ce n'est vérifié par aucun test, seulement par du
code. Les dialogues avancent tout seuls : le joueur doit pouvoir les avancer
lui-même, l'avance automatique devenant une option.

### 4.7 Le profilage n'a pas eu lieu

Aucune optimisation n'a été faite, et c'est volontaire : §11 demande de mesurer
avant d'optimiser. Il faut donc d'abord mesurer, **sur de vrais appareils**, et
rapporter appareils, navigateurs, conditions et percentiles de temps de frame.
Pistes à examiner ensuite, dans l'ordre de suspicion : le coût de dessin du
décor en parallaxe à 1440 px, les tableaux temporaires créés chaque image dans
`updateResonance` et `updateEnemies`, et le cache de ciel — qu'il faut
**quantifier** avant de l'appeler une fuite : huit thèmes en cache n'en est
pas nécessairement une.

Cibles à valider une fois la mesure possible : 60 images/s sur mobile
intermédiaire, 30 en profil économique, mémoire stabilisée sur 30 minutes de
parcours et de changements de scène.

### 4.8 La migration TypeScript

Le cahier des charges demande une migration **progressive** vers TypeScript
strict. Elle n'a pas commencé, et c'est délibéré : le budget du jalon A est
allé aux défauts P0. Le chemin le moins risqué, dans cet ordre :
`tsconfig.json` avec `checkJs` et `allowJs`, typage par JSDoc des modules déjà
purs (`rng`, `save`, `resonance`, `modules`, `expedition`, `upgrades`), puis
`engine`, puis `renderer` en dernier. Contrainte à ne pas perdre : le jeu doit
rester ouvrable en `file://` sans étape de construction.

### 4.9 `engine.js` est devenu trop gros

Plus de mille cent lignes et quatre responsabilités : simulation, expéditions,
observatoire, progression. Le jalon A a ajouté un état de session explicite,
ce qui rend la découpe **plus facile qu'avant** — les trois dernières
responsabilités ne touchent presque pas à la physique.

---

## Rang 5 — Plus tard, volontairement

Reportés parce que le cahier des charges le demande, pas parce qu'ils sont sans
intérêt : la grande campagne, les biomes nombreux, le multijoueur, un backend,
la publication en boutique, et le paquetage PWA ou Capacitor. Le code reste
compatible avec ces deux derniers — aucune requête externe, aucun état serveur
— mais emballer n'est pas valider : rien ne remplacera un essai sur un appareil
réel.

---

## Ce qui n'est toujours pas testé

Honnêtement, et sans emballage :

- **le son** n'a aucun test ; il est simulé partout. Personne n'a vérifié que
  la couche de tension entre correctement, ni que le silence iOS se comporte
  bien ;
- **la manette** n'est vérifiée par aucun test ;
- **le rendu** est testé contre un canevas factice : il prouve qu'aucune
  routine ne manque et qu'aucun NaN ne passe, pas que l'image est belle ni même
  correcte. La nouvelle posture d'apaisement n'a été **vue par personne** ;
- **les 1 000 graines** contrôlent des invariants géométriques, pas le plaisir.
  Une nuit peut être valide et ennuyeuse. Elles ne garantissent pas non plus
  « toutes les graines » : elles garantissent celles-là ;
- **la reprise d'expédition** est testée en Node et en navigateur, mais jamais
  après une vraie fermeture d'onglet de plusieurs jours ;
- **aucun test de performance** ne garde la cadence : le chiffre relevé par
  `npm run test:browser` varie de 23 à 60 images/s d'une exécution à l'autre
  pour le même code. C'est une mesure de la machine, pas du jeu.
