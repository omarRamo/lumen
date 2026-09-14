# Le Chant Des Îles : Bilan De Conception

## Le Diagnostic

Le dépôt possédait une base solide : simulation à pas fixe, collisions
indépendantes du rendu, sauvegardes versionnées, campagne écrite à la main,
génération d’expéditions et tests de comportement. Une réécriture intégrale
aurait abandonné cette fiabilité sans garantir un meilleur jeu.

Le problème de direction était plus concret : le premier chapitre ressemblait
à un jeu de plateforme classique, tandis que la Résonance, son geste le plus
singulier, arrivait beaucoup plus tard dans la campagne. L’accueil expliquait
une aventure avant de la faire vivre. Le cadrage portrait conservait des
bandes inutilisées. Ces constats sont cohérents avec le backlog existant.

La réponse implémentée est une nouvelle aventure autonome dans le même jeu,
pas une promesse de succès commercial : **le mouvement compose la musique,
et la musique rassemble le monde**.

## Les Décisions

### Une Entrée Immédiate

Le premier écran est le monde jouable. Le personnage, les premières notes,
les chemins en hauteur et Pip sont présents dans l’ouverture. Les menus
restent disponibles, mais ne constituent plus le début obligatoire.

### Un Geste À Plusieurs Conséquences

Une note prise en l’air rend le second saut disponible, joue une note
harmonique et prolonge un enchaînement. Les notes servent donc de trajectoire,
de retour sonore et d’objectif de maîtrise. Elles ne sont pas consommées
deux fois après une chute.

Chanter retrouve un écho. Celui-ci suit Nilo, amplifie les appels suivants,
enrichit la musique, fait avancer le réveil du décor et contribue à ouvrir
la sortie. Les mêmes ondes réveillent aussi les fleurs, ponts et carillons
hérités du moteur classique.

### Une Tolérance Choisie

Balade et Élan partagent le même monde, mais pas la même tolérance. Balade
revient au sol stable le plus récent après une chute. Élan revient à la
lanterne et réduit la fenêtre des enchaînements. Aucun de ces modes ne
retire un compagnon déjà retrouvé ni ne produit de game over.

La collection complète n’est pas obligatoire pour avancer : seuls les trois
échos ouvrent le passage ; les trois souvenirs sont des détours de maîtrise.
Les résultats des deux rythmes sont enregistrés séparément. Changer de rythme
demande confirmation et recommence l’île pour éviter de falsifier un record.

### Une Direction Artistique Locale

Les îles utilisent des silhouettes découpées, des roches facettées, des ruines
claires, des végétaux corail, un ciel d’aube puis de récif et de crépuscule.
Les décors structurants sont mis en cache ; le personnage, les compagnons,
les courants et le voyageur céleste restent animés.

Le monde occupe tout l’écran sans étirer les personnages. Les contrôles
s’adaptent au portrait et au paysage. Un voile atmosphérique sur les petits
écrans en paysage préserve la lisibilité de l’en-tête.

### Du Jour À La Nuit

Le joueur choisit son confort visuel, pas une difficulté supplémentaire.
Le mode sombre baisse la luminance des grands aplats de ciel et des menus,
mais garde une lumière franche sur Nilo, les notes et les bords des plateformes.
Les trois îles ont des palettes nocturnes distinctes ; le corail, les verts
végétaux et les lumières dorées restent présents. Le réglage suit le système
par défaut et ne modifie jamais l’état de la simulation.

Les nouvelles matières donnent des repères d’échelle et de fabrication :
strates minérales, cernes de bois, pierre gravée et bannières brodées. Le
motif étoilé se retrouve dans les architectures, la tunique et les ailes.
Les textures sont discrètes sur les surfaces jouables et calculées en cache.

### Un Ensemble Qui Répond

Une phrase pentatonique de cinq notes relie les trois partitions aux petites
récompenses sonores du jeu. Cordes pincées, kalimba, souffle et chœur sont
synthétisés localement. Les compagnons ne déclenchent plus une simple fanfare
de collectible : leur réponse utilise la même gamme que l’île.

Le son environnemental traduit des informations physiques : vitesse dans le
vent, déploiement des ailes, altitude et position des cascades. Les trois
canaux indépendants permettent d’atténuer la musique sans perdre ces repères,
ou de garder seulement l’ambiance. Le mode nocturne change les timbres et la
densité percussive sans désynchroniser la partition.

L’immersion implique aussi le silence : aucune lecture avant le premier geste,
fondus courts à la pause, silence du mixage à zéro, voix et connexions bornées.
La démonstration dans les réglages est le seul son autorisé explicitement
pendant cette pause. Les échantillons sont mesurés dans un vrai moteur Web Audio,
mais cela ne remplace pas une séance d’écoute humaine.

## Les Contrats Préservés

```mermaid
flowchart LR
  Song[Îles et règles du Chant] --> Engine[Simulation 120 Hz]
  Classic[Campagne et expéditions] --> Engine
  Inputs[Clavier, pointeurs, manette] --> Engine
  Engine --> Resonance[Résonance partagée]
  Engine --> Store[Sauvegarde v3, clés distinctes]
  Engine --> Art[Rendu Canvas en lecture seule]
  Engine --> UI[Interface DOM accessible]
  Engine --> Audio[Musique et notes Web Audio]
```

- Aucun changement des clés ou de l’ordre des anciens chapitres.
- Aucun souvenir d’expédition actif dans une île du Chant.
- Aucune modification des sauts de la campagne classique.
- Aucun framework ou paquet requis pour jouer.
- Aucun service réseau, compte, classement public, achat ou télémétrie ajouté.
- Les licences des polices Fredoka et Outfit et des pictogrammes Lucide sont
  livrées avec les fichiers locaux.

## La Preuve Et Ses Limites

Le pilote de parcours connaît les lieux mais n’écrit jamais la position du
personnage, les objets collectés ou l’état de victoire. Il agit sur les mêmes
entrées que les commandes du jeu. Il termine les trois îles dans les deux
rythmes, sans chute, avec les neuf échos et les neuf souvenirs, et ne tient
jamais plus de deux actions simultanées.

Les tests navigateur vérifient également les vrais événements clavier et
pointeur, l’annulation des entrées, les menus, la persistance du confort,
l’enchaînement des îles, la coexistence avec les sauvegardes classiques et
l’édition hors ligne. Les cinq formats de capture incluent un téléphone de
320 pixels de large et un écran de 2560 pixels.

Ces tests prouvent la cohérence et l’accessibilité physique des parcours.
Ils ne prouvent pas que le jeu est amusant, intuitif pour un enfant ou assez
riche pour une sortie commerciale. Les trois îles constituent une petite
aventure complète et un terrain de playtest, pas un catalogue de contenu fini.

La prochaine décision doit venir de personnes qui jouent : un enfant avec
son adulte, un débutant sur téléphone et une personne habituée aux jeux de
plateforme. Observer le premier chant volontaire, la compréhension du
vol plané, les notes aériennes remarquées et l’envie de refaire un trajet.

Avant une diffusion mobile plus large : tester Safari iOS et Chrome Android
sur matériel réel, le son après interruption, la batterie, les grandes tailles
de commande, une manette physique et les lecteurs d’écran. Un empaquetage
PWA ou natif pourra ensuite être décidé ; il n’est pas réalisé ici.