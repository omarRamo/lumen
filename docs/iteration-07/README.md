# Itération 07 — Finir ce qui est commencé

Aucune fonctionnalité nouvelle, aucun lieu nouveau. Cinq défauts nommés par
la relecture de l'itération 06, corrigés dans l'ordre où ils gênaient.

## 1 — La carte est devenue un lieu

**Le constat.** `js/journey-ui.js` construisait la carte entièrement en DOM :
belle interface, typographie soignée, points et filets — mais un document, pas
un endroit du monde. En clair elle ressemblait à une feuille de route d'outil
de gestion ; l'acquis de l'itération 05, « une seule identité partout », y
avait un trou.

**Ce qui a été gardé.** Le squelette DOM, entièrement. C'est lui qui porte les
22 lieux atteignables à la manette, les cibles de 48 px, les états distincts en
niveaux de gris, le focus, le RTL arabe et `translateDOM`. Le réécrire en
canvas aurait coûté tout cela pour un gain d'apparence.

**Ce qui a changé.** Un `<canvas class="journey-backdrop">` se glisse derrière
le DOM, en `z-index:0` et sans événements, et reçoit **le ciel de
`js/world-art.js`** — le même `horizon()` qui dessine les îles et les jardins :
nuages, astre, mer, îles lointaines, feuillages, palettes jour et nuit.

Le ciel **suit l'acte regardé** — aube, midi, couchant. Changer de
constellation change l'heure du jour, et la carte devient un endroit d'où l'on
regarde le voyage au lieu d'un tableau qui le résume.

Le décor reste à sa place : flou de 3 px, saturation à 82 %, opacité à 62 %,
et un voile dégradé par-dessus. On sent le ciel ; on n'a jamais à le regarder
pour lire le nom d'un lieu. La hiérarchie habituelle tient — décor en dernier.

Les filets pointillés sont devenus **un chemin de lumière** : des grains qui
avancent d'un lieu au suivant, avec un halo doux, dans la couleur des étoiles.

**Mouvements réduits.** Le ciel s'immobilise et le chemin cesse d'avancer. Ni
l'un ni l'autre ne disparaît : l'information reste, seul le mouvement s'en va.
`prefers-reduced-motion` est honoré en plus du réglage du jeu.

## 2 — La colonne est devenue un puits

Le décor était **écrit et invisible**. Le lieu portait le thème `sky` — des
parois bleu pâle sur fond bleu pâle — et `rootShaft()` les dessinait à 29 %
d'opacité, ses strates à 12 %.

Elle a maintenant sa palette, `shaft`, sombre au fond et ouverte en haut, en
jour comme en nuit. Et le décor raconte la montée : le ciel s'interpole avec
l'altitude, les parois se resserrent vers le fond et s'écartent vers le haut,
les strates défilent avec la caméra, des motes descendent, et la couronne
n'apparaît que dans le dernier tiers.

Le contrôle de contraste des huit plateformes couvre `shaft` sans une ligne de
plus : son compte est désormais dérivé du catalogue au lieu d'être figé à 128.

## 3 — Six lieux habités

Moyenne de l'itération 06 : **0,3 créature par lieu**, quatre sur six sans
aucune. Après : **2,2**, et zéro lieu vide. Objets : 29 → 42. Aucune largeur
n'a bougé — on remplit l'espace, on n'allonge pas.

Chaque ajout sert l'idée du lieu :

| Lieu | Ce qui a été ajouté | Pourquoi ça sert l'idée |
| --- | --- | --- |
| `dos-du-songe` | un essaim sur la route, un sauteur à l'arrivée | rester à bord devient une décision, en descendre aussi |
| `astre-a-guider` | un dormeur devant la 4ᵉ fleur, un patrouilleur | une seule onde apaise ET ouvre la corolle ; la course en avant se paie |
| `pont-des-veilleurs` | un dormeur près du 2ᵉ maillon, un patrouilleur sur l'autre rive | la même onde sert à la chaîne et à lui ; le pont expire, lui non |
| `riviere-sans-lune` | une tourelle face à la 2ᵉ balise | l'ordre d'allumage devient aussi une question de position |
| `colonne-des-saisons` | deux paliers gardés | dans une ascension, une créature décide du moment où l'on quitte le palier |
| `pluie-de-lumiere` | deux essaims | les seules créatures qui n'aient pas besoin d'un sol, dans un lieu qui n'en a pas |

Les objets remplissent les onze vides de plus de 400 px relevés, en suivant le
trajet de chaque idée. **Les six contrats d'idée restent verts**, zéro mort au
pilote, temps de traversée inchangés à la dixième de seconde.

## 4 — Le dos est devenu un dos

`mount()` dessinait une bête soignée, puis posait dessus un `roundRect` en
`p.grass` avec le liseré standard : une dalle d'herbe, d'où l'autocollant.

La surface est maintenant une carapace mousseuse dans les couleurs de la bête —
écailles qui se resserrent vers la tête, touffes sur l'arête. **La boîte de
collision n'a pas bougé d'un pixel** et le liseré d'atterrissage reste le
repère le plus net de l'image : c'était un travail de dessin, pas un compromis
de lisibilité.

## 5 — Le dépôt

| | Avant | Après |
| --- | --- | --- |
| Images suivies | 145 PNG, 24 Mo | 104 WebP, **3,9 Mo** |
| Dépôt suivi | 40 Mo | **6,0 Mo** |
| Rapport au jeu | ×30 | **×4** |

Les captures encore utiles passent en WebP (÷6,3, sans perte visible : ce sont
des aplats). Les captures binaires de l'itération 05 sortent du dépôt — leur
bilan est écrit, leur comparaison close, et leur README dit ce qu'elles étaient.
La galerie de plateformes quitte `docs/iteration-06/` pour `docs/platforms/` :
elle sert à chaque itération, elle n'appartient à aucune.

`tools/capture.cjs` remplace les appels directs à `page.screenshot` : Playwright
n'encode que PNG et JPEG, le helper passe par `sharp` et se rabat sur le PNG
s'il manque — le contrôle de poids le dira alors, et il dira pourquoi.

**Recommandation sur l'historique, non appliquée.** Les 48 Mo d'objets des
itérations 05 et 06 restent dans l'historique : `git rm` ne les en sort pas.
Un `git filter-repo` ramènerait le dépôt sous 10 Mo, mais réécrirait tous les
identifiants de commits et casserait chaque clone. Pour un dépôt personnel
c'est faisable et sans doute souhaitable à terme — ce n'est pas une décision
de passe de finition. **À trancher par Omar, pas par l'itération.**

## Les garde-fous ajoutés

- `tests/test-repo-weight.cjs` — format interdit, budget d'images, budget
  total. Passer le budget reste permis ; le faire sans l'écrire ne l'est plus.
- `tests/test-density.cjs` — un **plancher par lieu**, rapporté à la largeur :
  un lieu court et concentré passe, un lieu long et vide échoue. Pas de
  plancher sur les plateformes : un jardin bâti sur un sol continu n'en
  déclare qu'une, et ce n'est pas un vide. Le contrôle vérifie aussi que les
  trois îles restent sans créature ni danger — c'est une décision.
- Le contrôle de contraste des plateformes, désormais dérivé du catalogue de
  thèmes : un thème ajouté est couvert sans rien toucher.

## Résultats

| Suite | Résultat |
| --- | --- |
| `test-repo-weight` | 3 / 3 |
| `test-density` | 4 / 4 |
| `test-p0` | 28 / 28 |
| `test-engine` | 60 / 60 |
| `test-renderer` | 13 / 13 |
| `test-expedition` | 15 / 15 |
| `test-journey` | 12 / 12 |
| `test-places` | 9 / 9 |
| `test-i18n` / `audio` / `appearance` | 11 / 5 / 4 |
| `playthrough` · `places-playthrough` | 6 parcours · 6 contrats d'idée |
| `test-browser` | 29 / 29 |
| `test-journey-browser` | 6 / 6 |

Captures avant/après dans [`captures/`](captures/).

## Ce que cette itération ne prouve pas

- Qu'une carte ressemble au jeu **ne se teste pas** : la preuve est une image,
  et elle est dans `captures/`. Jugez-la.
- Qu'un lieu soit habité ne dit pas qu'il soit agréable à traverser.
- **Personne n'a toujours regardé quelqu'un jouer.** Il y a 22 lieux, une
  carte, six idées documentées, et une édition portable de 1,7 Mo qui s'ouvre
  d'un double-clic. Aucun test de ce dépôt ne peut dire laquelle de ces six
  idées se comprend sans qu'on l'explique.
