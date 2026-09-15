# Itération 05 : Une Seule Identité

Point de départ inspecté : `e805bb4`, et non la référence proposée `996b4c5`.
L'arbre de travail était propre. Aucun pull, changement de branche ou push.

## Chantiers Fermés

- Lumen est le personnage unique ; l'ancien dessin de campagne est supprimé.
  Les quatre pouvoirs, leur expiration, les dégâts, la glissade, la ruée et
  la défaite passent par le dessin du Chant. Les ailes lui restent réservées.
- L'île 1 est l'entrée, titre et invitation sur la simulation vivante,
  effacés au premier mouvement. La campagne a une carte dans l'atlas.
  L'observatoire ne compte plus dans ses onze chapitres.
- Les palettes, terrains, facettes, feuillages, nuages, mer et notes sont
  communs. Les huit thèmes de campagne ont une palette nocturne explicite.
  HUD, typographie, cartes et cadrage utilisent la direction du Chant.
- Une idée sur l'île 2 et une sur l'île 3, sans note, plateforme ou longueur
  supplémentaire. Aucun chantier d'expédition reporté n'est commencé.
- Les copies de transfert sont retirées par `git rm` et ignorées. Le portable
  est régénéré ; aucune ressource externe n'est ajoutée.

## Deux Décisions

**Île 2 : orienter le courant.** Le courant central porte latéralement vers
la gauche. Une onde du joueur inverse sa dérive ; le mouvement des feuilles
et des traits indique le sens. Lumen peut le retourner pour franchir le vide,
ou le garder pour revenir sur les corniches. Replier les ailes permet de
quitter le courant. Un relais ne peut pas annuler involontairement le choix,
et une même onde ne le retourne qu'une fois.

Ce choix réutilise le vent et la Résonance, sans minuterie supplémentaire ni
nouveau bouton. Il a été préféré à une chaîne de notes punitive : le geste
change un trajet sans retirer des notes déjà gagnées et fonctionne en Balade
comme en Élan. Sa compréhension sans texte reste une hypothèse à observer.

**Île 3 : rejoindre Nève en mouvement.** Un seul écho parcourt un segment
d'environ 293 unités entre deux corniches existantes, à 90 unités par seconde, moins
vite que Lumen. Sa petite traîne montre son sens. Le joueur peut poursuivre
ou couper son trajet et appeler depuis l'une des corniches ; nul besoin
d'attendre qu'une fenêtre invulnérable expire. Une fois retrouvé, il suit
Lumen comme les autres et cesse son aller-retour.

Ce choix rend la destination mobile plutôt que plus lointaine. Il réutilise
les échos, les corniches et la portée d'appel, sans créature dangereuse ou
nouveau système. Les nombres restent 73/82/90 notes, 4/5/5 sols, 9/12/13
corniches et 4 200/4 700/5 100 unités de longueur. Les deux rythmes terminent
les trois îles par les vraies entrées du moteur.

## Validation

**`npm run verify` réussit intégralement, code de sortie 0 : 134 contrôles
Node, 12 parcours physiques et 29 contrôles navigateur.**

Les commandes et leurs sorties intégrales sont dans
[verify-character.txt](verify-character.txt) pour le jalon personnage,
validé avant l'harmonisation, et [verify-final.txt](verify-final.txt) pour
l'itération complète. Les résultats structurés restent dans
[tests](../../tests).

| Suite Node | Contrôles |
| --- | ---: |
| Apparence | 4 |
| Audio | 5 |
| Langues et nom propre | 9 |
| Promesses du jalon A | 28 |
| Moteur | 60 |
| Rendu | 13 |
| Expédition | 15 |
| Parcours physiques | 12 parcours |

Les 29 contrôles navigateur incluent les 27 surfaces précédentes plus le
parcours entre aventures et la galerie de plateformes. Le contrôle tactile
attend un sol et deux images, puis 450 ms de simulation, pas un délai réel
variable. Le contrôle de cadrage ne rapporte plus de FPS logiciel.

Pour chaque plateforme, les mesures vérifient une différence de luminance
d'au moins 0,12 et un contraste d'au moins 3:1 entre la silhouette bicolore
et chaque fond de thème. Le bord et les marques de comportement ont un
contraste séparé. Le navigateur vérifie les pixels du bord réellement peint
et huit empreintes distinctes en niveaux de gris. Le clignotement d'une
plateforme solide ne masque plus sa surface de réception.

Le parcours démarre sur l'île, passe par la carte de campagne, joue le premier
chapitre puis revient à l'île. Aucune téléportation, aucun `complete()` manuel,
aucune invulnérabilité injectée. Les chutes sont celles du moteur ; le record
est comparé avant et après retour et rechargement, en source et en portable.

Le build est aussi exécuté dans un dossier sans `node_modules` et produit
le même portable. Les clés v1/v2/v3, les identifiants de chapitres et de
transformations sont inchangés. Les modules de sauvegarde, génération,
souvenirs et données des chapitres historiques n'ont pas été modifiés.

## Preuves Et Limites

Commits fonctionnels : `2148a4b` (hygiène), `0908780` (personnage),
`7631b07` (entrée et atlas), `67815e9` (rendu commun), `ba3eb14` (idées des îles),
`294e336` (captures, HUD et validation). Aucun n'a été poussé.

[Les 28 captures avant/après](captures/README.md) viennent de Playwright,
en `file://`, bureau jour et mobile nuit. Les manifestes comparent les
scènes, positions, caméras, horloges et viewports. L'ancienne identité n'est
conservée que dans l'historique et ces preuves avant.

**Aucun playtest humain n'a eu lieu.** La beauté, la lisibilité perçue et la
compréhension des deux décisions sans texte ne sont pas des résultats
acquis. Les empreintes distinctes ne prouvent pas une reconnaissance au
premier regard. Aucun téléphone physique, écoute humaine ou relecture native
n'est revendiqué. Les travaux reportés restent dans le
[backlog](../../BACKLOG.md).