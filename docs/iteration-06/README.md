# Itération 06 — La carte, le souffle et les lieux

Référence de départ : `0806ceb`. L'application web reste autonome, sans
serveur, compte ni ressource distante. Le personnage s'appelle **Lumen**.

## Une seule carte

Trois constellations réunissent les îles et les jardins. Les îles, plus
grandes, ouvrent chaque acte ; l'observatoire et les Rêves sont accessibles
hors du trajet principal. Le démarrage reste directement sur l'île 1.
La carte n'apparaît que sur demande. Elle suspend une île ou un chapitre ;
le retour reprend cette session. Quitter une expédition conserve ses règles
de session spécifiques.

Sur bureau, les trois actes se voient ensemble. Sur téléphone, des boutons
d'acte changent explicitement de constellation. Choisir une lumière ouvre
son détail, puis une action distincte lance le lieu ou montre son prérequis.
Cette séparation rend les lieux verrouillés consultables au clavier, à la
manette et au doigt. Les cibles ne rétrécissent pas avec le nombre de lieux.

Une grille et trois cartes d'îles séparées ont été écartées : elles ne
montraient pas la relation entre les étapes. Un ciel panoramique à faire
glisser a également été écarté pour conserver le portrait sans défilement
horizontal ni geste obligatoire de déplacement.

## Contrats conservés

- Le modèle `js/journey.js` lit les niveaux et les sauvegardes ; il ne
  possède pas une seconde progression.
- `isUnlocked()` décide de l'accès aux stages ; `canEnterDreams()` reste la
  seule règle des Rêves. Une île suivante demande l'acte précédent, avec
  conservation des îles déjà terminées et des accès historiques.
- Les détours et fragments restent facultatifs. Le trajet obligatoire
  contourne le jardin bonus sans modifier sa propre règle d'accès.
- Une lumière acquise n'est jamais retirée. Les nouveaux succès se voient
  à la prochaine ouverture de la carte, y compris sans animation ni son.
- Le seul champ ajouté est `chapters[key].secrets`, validé, borné et
  monotone. Les clés et le schéma v3 ne changent pas. Le stockage reste
  injecté dans `SaveStore`.

## Six lieux supplémentaires

La campagne compte maintenant 17 stages ; l'atlas réunit 22 lieux. Deux
nouveaux stages sont placés dans chaque acte, avant sa borne historique.
Les clés existantes gardent leur sens, y compris dans un profil déjà avancé.
Les totaux sont calculés depuis les données : 60 fragments facultatifs et
21 passages secrets, sans condition supplémentaire pour atteindre la finale.

Chaque nouveau lieu associe une règle physique à une composition propre :
monture, astre guidé, pont de créatures, rivière à rallumer, ascension et pluie
qui fait pousser le sol. Les [six notes](stages.md) décrivent l'idée, la
décision et le choix artistique. `places.js` porte l'état de visite ;
`place-art.js` le dessine sans le modifier.

Les tests de parcours traversent les six lieux depuis leur départ avec
uniquement les commandes du jeu, sans mort sur ces routes. Ils vérifient
également l'emploi de chaque mécanique, et pas seulement l'arrivée à la
sortie. Le [rapport des parcours](places-playthrough.txt) précise leurs
mesures et les détours qu'ils ne couvrent pas.

La validation a également corrigé deux défauts exposés par ces parcours :
une entrée virtuelle inactive coupait le rebond des tremplins ; un réessai
de campagne pouvait reprendre une ancienne expédition perdue. Des tests
de régression couvrent les deux transitions.
La revue des captures a aussi conduit à poser le titre du chapitre sur une
plaque discrète, pour qu'il reste lisible sur les paysages sombres en journée.

## Preuves et limites

`npm run verify` est passé intégralement. Le
[rapport complet](verify-final.txt) contient les suites suivantes :

| Suite | Contrôles réussis |
| --- | ---: |
| Apparence / audio / cinq langues | 4 / 5 / 11 |
| Promesses P0 | 28 |
| Moteur / rendu / expéditions | 60 / 13 / 15 |
| Carte / mécaniques des nouveaux lieux | 12 / 9 |
| Parcours joués, dont les six nouveaux lieux | 18 |
| Navigateur historique / atlas commun | 29 / 6 |

Les 28 contextes de contraste couvrent huit thèmes et six compositions de
lieux, chacun en jour et en nuit. Chaque contexte garde huit formes distinctes
en gris ; le minimum mesuré est 228 pixels de bord à un contraste d'au moins
3:1, pour un seuil de 144. Ce contrôle de pixels est limité à la galerie
définie par le test, pas à chaque position possible du personnage.

`baseline.txt` décrit les contrôles de la référence. Les captures comparées
utilisent les mêmes profils, dimensions et thèmes :
`captures/before/manifest.json` et `captures/after/manifest.json`.
Les profils préparés pour montrer la carte vide, intermédiaire ou remplie
sont explicitement des **états forcés**.

À côté, les tests font réellement jouer le premier chapitre par le moteur,
ouvrent la carte après la victoire, puis rechargent entièrement la page :
ni déplacement injecté, ni invulnérabilité, ni appel manuel à `complete()`.
La manette est simulée par `navigator.getGamepads()` ; ce n'est pas une
validation sur manette physique. Les contrôles de pixels en niveaux de gris
ne remplacent pas une observation humaine de la lisibilité.

Le rapport final doit être lu avec ces limites : aucun playtest humain ni
profilage sur appareil physique n'est réalisé par ces suites.

Le profil rempli et rejoué cent fois reste sous le seuil de 32 Kio imposé
par le test. Les listes validées et les compteurs restent bornés. Aucun
backend, identifiant de joueur ou nouveau schéma de sauvegarde n'est ajouté.
