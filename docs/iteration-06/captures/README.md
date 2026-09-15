# Captures de l'itération 06

Les images de `before/` proviennent de la référence `0806ceb`. Celles de
`after/` sont produites par `node tests/journey-captures.cjs after`.
Les deux manifestes conservent les profils, dimensions, langue, apparence,
graine cosmétique, temps figé et entrée utilisée. Le script compare ces
conditions et les empreintes des profils avant d'accepter la série.

## Comparaison de la carte

Les trois profils préparés sont des **états forcés**, pas des parties jouées :
`fresh`, `mid`, `full`. Chaque profil est montré en jour/nuit, bureau/mobile,
depuis les deux anciennes entrées (Chant et campagne), soit 24 paires.
Après le changement, les deux entrées ouvrent le même atlas.

Le profil `full` reste exactement celui de la référence : il termine les
anciens lieux et laisse les six nouveaux à découvrir. Les quatre images
`all-current-*` montrent en supplément un profil où tous les lieux actuels
sont terminés. Elles sont exclues de la comparaison à profil identique.

| État | Avant | Après |
| --- | --- | --- |
| Neuf, bureau, jour | [Avant](before/fresh-light-desktop-archipelago.png) | [Après](after/fresh-light-desktop-archipelago.png) |
| Intermédiaire, mobile, nuit | [Avant](before/mid-dark-mobile-archipelago.png) | [Après](after/mid-dark-mobile-archipelago.png) |
| Ancienne campagne terminée, bureau, nuit | [Avant](before/full-dark-desktop-campaign.png) | [Après](after/full-dark-desktop-campaign.png) |
| Tous les lieux actuels, mobile, jour | — | [Après](after/all-current-light-mobile-archipelago.png) |

## Les six nouveaux lieux

Les douze images `place-<clé>-<light|dark>-desktop.png` sont obtenues par
rejeu d'entrées depuis le départ du niveau. Un profil complet accorde l'accès,
mais le personnage n'est pas déplacé pour composer l'image. Les manifestes
enregistrent position, temps et compteurs de mécanique. Les versions jour
et nuit doivent correspondre au même état physique.

Les contrats navigateur vérifient séparément une victoire réellement jouée,
la naissance de sa lumière et sa conservation après rechargement, ainsi que
la navigation par Gamepad API simulée. Les contrastes et formes des huit
plateformes sont mesurés dans `../platforms/measurements.json`.

Ces images ne prouvent ni le plaisir de jeu, ni la lisibilité perçue, ni les
performances d'un appareil physique.
