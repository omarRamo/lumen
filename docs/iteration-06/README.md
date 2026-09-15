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

## Preuves et limites

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
