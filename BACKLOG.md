# LUMEN : Ce Qui Reste

Ce fichier ne contient que du travail non terminé. Les changements fermés
sont dans la [note d'itération 06](docs/iteration-06/README.md). Les sujets
reportés attendent une décision explicite ; leur présence ici n'autorise pas
à les commencer pendant une itération d'identité.

## D'abord, Observer

1. **Trois playtests humains sans explication préalable.** Une personne
   débutante au tactile, une habituée au clavier ou à la manette, une qui
   découvre seule. Relever premier appel, erreurs de commande, chutes
   répétées, décisions comprises et envie de recommencer. Aucun n'a eu lieu.
2. **Éprouver les deux idées des îles.** Observer si l'inversion du courant
   est comprise en la voyant une fois et si Nève invite à poursuivre ou
   intercepter, pas à attendre. Comparer Balade et Élan sans ajouter de notes.
   Observer aussi les six nouveaux stages : comprendre la monture, accompagner
   l'astre, renouveler le pont, relayer la rivière, lire la montée et déplacer
   la pluie. Les parcours automatiques prouvent leur issue, pas leur plaisir.
3. **Évaluer la lisibilité perçue.** Reconnaître les huit plateformes, les six
   créatures, les dangers, la fin d'un pouvoir et les surfaces d'arrivée.
   Les seuils numériques ne remplacent pas ce test, notamment en basse vision.
4. **Jouer sur matériel réel.** Safari iOS, Chrome Android, encoche, manette
   physique, deux pouces, latence, chauffe, autonomie et interruptions.
   Tester la course automatique après 0,38 seconde avant de la changer.
5. **Relire les cinq langues et écouter le mixage.** Relecture native, polices
   de substitution et RTL sur appareils réels ; casque, haut-parleurs mobiles,
   bruit ambiant et contrastes en extérieur.
6. **Éprouver les reprises longues.** Expédition conservée plusieurs jours,
   onglet fermé, stockage restreint, mise à jour et changement d'origine.

## Reporté : Souvenirs Et Action

- **`powersSeen` et `provides`.** Les onze modules ne distribuent pas de
  pouvoirs. Décider si un souvenir accorde sa capacité ou si la route garantit
  son acquisition avant l'offre. L'avoir aperçu autrefois ne suffit pas.
- **`dropCorolle` au souffle.** L'onde du second saut ne sème pas la corolle ;
  tester l'effet physique de la combinaison, pas seulement son texte.
- **Remplacement par `equip()`.** Comparaison des emplacements, choix explicite
  et refus au lieu de supprimer le plus ancien souvenir.
- **Intention avec `comet`.** L'appel déclenche aussi une ruée. Observer les
  chutes involontaires avant de choisir une solution ; préserver les deux
  pouces, le saut variable, le coyote time et le saut mémorisé.
- **Lisibilité de l'appel classique.** Portée dessinée et détection, carillon
  actif, disponibilité pendant la recharge et durée des passages.

## Reporté : Contenu

- **Ouverture de campagne par la Résonance.** Le chapitre 1 des jardins ne
  contient pas de réveillable. L'entrée sur l'île ne remplace pas la décision
  sur l'ordre historique des chapitres.
- **Le Jardinier des marées.** Gardien propre aux Rêves, trois étapes courtes,
  victoire sans combinaison rare ni attentes invulnérables.
- **Arc narratif en trois actes.** Bascule du deuxième acte et résolution par
  équilibre plutôt que disparition de toute obscurité.
- **Quatre modules d'expédition supplémentaires au maximum.** Décisions
  différentes, pas dimensions supplémentaires ; mesurer répétition et repli.
- **Récompenses durables.** Usage du carnet, des apparences, des décors de
  l'observatoire et des souvenirs narratifs encore à concevoir.

## Reporté : Technique

- **`frost` issu du flux cosmétique.** Séparer la friction du choix d'apparence.
- **`Math.random()` du Veilleur.** Flux nommé et tests de répétabilité.
- **`inspect()` ne rejette rien.** Rejet, essais bornés et repli pour les
  capacités et conditions d'entrée réelles.
- **`cost` inutilisé.** Décider s'il pilote le rythme ou disparaît.
- **Menus à la manette et dialogues.** Navigation complète entre routes,
  récompenses d'expédition et réglages hors atlas ; avance manuelle des
  dialogues, avance automatique optionnelle. L'atlas commun est couvert.
- **Profilage sur appareils réels.** Mesurer matériel, navigateur, conditions,
  percentiles et mémoire pendant trente minutes avant toute optimisation.
  Les FPS de Chromium logiciel ne constituent pas une mesure du jeu.
- **Migration TypeScript progressive.** Modules purs et contrats d'abord,
  en conservant l'édition `file://` sans build.
- **Découpage du moteur.** Séparer ses responsabilités après décision de
  périmètre, pas à l'occasion d'un changement de dessin.

## Distribution À Décider

PWA, paquets mobiles, publication PC et boutiques restent à choisir et à
produire. Coopération, atelier de chemins et défis quotidiens ne sont pas
des fonctionnalités promises. Aucun backend, multijoueur ou nouveau chapitre
n'est engagé par cette liste.
