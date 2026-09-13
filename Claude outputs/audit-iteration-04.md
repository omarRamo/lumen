# LUMEN — itération 04, audit du jalon A

Audit mené sur le HEAD local du dépôt (commit `490a030`, « Documentation :
ce qui est fait, ce qui ne l'est pas »). Le commit de référence cité dans le
cahier des charges, `0cae0643`, **n'existe pas dans ce dépôt** : les six
commits de l'itération 03 n'ont jamais pu être poussés vers GitHub (le proxy
git de la session refuse `omarRamo/lumen`). L'audit porte donc sur l'état
réel du code que j'ai sous la main, et non sur une copie distante que je ne
peux pas lire. Si `0cae0643` est un état différent, cet audit est à relire.

Chaque constat est classé selon les quatre catégories demandées :

| Classe | Signification |
|---|---|
| **(1) reproduit** | un test écrit avant tout correctif échouait, avec un message précis |
| **(2) déduit** | lisible dans le code, mais non mis en échec par un test |
| **(3) hypothèse** | jugement de game design, ni prouvé ni mesuré |
| **(4) mesure** | un chiffre obtenu en exécutant quelque chose |

**Référence d'avant correctif** : `docs/jalon-a-reference.json` —
`tests/test-p0.cjs` exécuté contre le code d'origine : **3 réussites sur 28**.
Après le jalon A : **28 sur 28**. Les 25 tests qui échouaient sont la preuve
des défauts ; ils sont aussi la preuve des correctifs.

---

## A. Les branches ne changeaient pas la salle — **confirmé (1)**

`plan()` traduisait le choix du joueur en *intention de rythme* via
`intentForKind()`, puis composait la salle à partir du catalogue de cette
intention. Comme `KINDS_FOR.tension` contient quatre natures, choisir
« puzzle » ou « encounter » aboutissait au **même catalogue**, donc à la même
salle.

Mesures relevées sur un corpus de 120 graines (600 salles, 360 choix) :

| Constat | Chiffre avant correctif |
|---|---|
| Choix qui ne changeaient rien | **243 / 360** |
| Salles annonçant une nature qu'elles ne jouaient pas | **203 / 600** |
| Alternatives proposées mais irréalisables | **423** |
| Modules échappant à leur intention de rythme | **101** |

Deux causes distinctes, toutes deux vérifiées :

1. `intentForKind('platform')` rendait `'decouverte'`, parce que `platform`
   figure dans deux catalogues et que la boucle rendait le premier. Choisir
   « un chemin » dans une salle de **tension** ouvrait donc le catalogue de
   **découverte**, et pouvait livrer une clairière.
2. la nature affichée (`omen`) venait du **dernier module composé**, tandis
   que le libellé choisi venait du **choix du joueur**. Les deux n'avaient
   aucune raison de coïncider, et ne coïncidaient pas dans un tiers des cas.

**Correctif.** Le module final *définit* la salle : c'est lui qui porte la
nature choisie, et c'est lui que la carte annonce. L'intention de rythme reste
une contrainte séparée qui borne tout le reste de la chaîne. Chaque nature
possible est **réellement assemblée** avant d'être proposée, dans son propre
sous-flux ; ce qui ne s'assemble pas n'apparaît pas sur la carte.
La géométrie d'une salle ne dépend plus que de `(graine, indice, nature)`,
si bien que l'invariant « un choix ne modifie pas une salle déjà traversée »
n'est plus seulement testé : il est structurel.

**Mesure après correctif (4)** : sur 400 graines, 2 000 salles, **0 repli** et
**1 200 salles offrant deux alternatives** — c'est-à-dire toutes les salles
qui ne sont ni un refuge ni l'arène du gardien.

`GENERATION_VERSION` passe de 1 à 2. Les nuits enregistrées en version 1 ne
sont plus reprises : le jeu le dit et efface l'enregistrement, comme prévu.

---

## B. Le dormeur apaisé — **confirmé (1), et plus grave qu'annoncé**

Le cahier des charges demandait « un traitement explicite de l'état `calm` ».
Le constat exact : la machine à états du dormeur ne connaissait pas `calm`,
qui tombait donc dans la branche `else` (celle de `settle`) :

```js
} else { e.vx = approach(e.vx, 0, dt*320);
         if (e.timer <= 0) { e.state = 'sleep'; e.chargeProgress = 0; } }
```

`e.timer` est le minuteur générique de toutes les créatures ; il vaut
`0,9 + i × 0,19` au chargement et devient négatif après une seconde de jeu.
Autrement dit : **l'apaisement durait une image**, pas huit secondes. La
« créature apaisée qui sert de marche » n'a jamais fonctionné une seule fois
en jeu depuis son écriture. Aucun test ne le voyait : `test-engine.cjs`
vérifiait que l'onde **pose** l'état `calm`, ce qui était vrai, et jamais
qu'elle le **garde**.

**Correctif.** Trois durées nommées, `CALM_TIME = 8 s`, `CALM_WARNING = 1,5 s`,
`CALM_GRACE = 1,5 s`. Un unique propriétaire du compte à rebours
(`updateResonance`, qui tourne quelle que soit la distance à Nilo), une branche
`calm` explicite dans `updateEnemies` qui ne fait qu'immobiliser, un
avertissement avant la fin, et un répit après le réveil pour qu'aucune charge
ne parte dans la seconde. Le minuteur générique n'a plus voix au chapitre.

La posture visuelle demandée existe : apaisée, la créature s'**aplatit** et
un liseré clair souligne son dos — la marche est dessinée, pas devinée. Quand
le répit s'achève, elle se regonfle en pulsant. L'avertissement est une
**forme**, lisible sans son et sans distinction de couleur.

Testé avec des minuteurs initiaux de `0,9`, `0`, `−5` et `−120`.

---

## C. Restaurer le monde depuis la sauvegarde — **partiellement confirmé**

| Élément | Verdict |
|---|---|
| Le décor transformé (coupole allumée) | **réfuté (1)** — il était déjà relu du profil |
| Les dialogues | **réfuté (1)** — ils lisaient déjà `store.questState` |
| L'ouverture de la porte | **confirmé (1)** |
| L'accès aux expéditions | **confirmé (1)** |

La porte : `updateCharacters` sortait par
`if (!quest || questState === 'done') return;` **avant** la ligne
`this.exit.open = true`. La porte n'était donc ouverte qu'à l'instant précis
où la quête se terminait. En ressortir, ou recharger la page, la refermait
définitivement — et les carillons, remis à zéro par `applyLevel`, ne pouvaient
plus la rouvrir. Un joueur qui finissait la quête et quittait le lieu perdait
l'accès aux Rêves **pour de bon**.

L'accès : `ui.js` faisait `game.mode='dream'` sans aucune vérification. Le
menu ouvrait donc ce que le portail gardait fermé — le contournement
silencieux décrit par le cahier des charges.

**Correctif.** `restoreWorldState()`, appelée à chaque chargement de niveau,
rouvre ce qu'une quête achevée avait ouvert. `canEnterDreams()` est **la**
règle d'accès : le portail et le menu la consultent tous les deux, et le menu,
quand elle refuse, dit pourquoi et conduit le joueur à l'observatoire au lieu
de ne rien faire. Pas d'option de saut du tutoriel : une seule règle, sans
exception.

---

## D. Isoler campagne, hub et expédition — **confirmé (1), cinq défauts**

Toute la session se déduisait de `this.run`, que ni `showHome()`, ni
`showMap()`, ni `start()` n'effaçaient. Conséquences vérifiées :

1. atteindre la sortie d'un **chapitre de campagne** appelait `completeRoom()`
   et ouvrait l'écran de route d'une expédition ;
2. **mourir** dans un chapitre appelait `finishExpedition(false)` et concluait
   la nuit ;
3. les **souvenirs de rêve** restaient actifs dans la campagne
   (`hasUpgrade` ne regardait que `this.run`) ;
4. après une nuit perdue, `retry()` appelait `start(this.levelIndex)` avec
   `levelIndex === -1` — une salle de rêve n'est pas un chapitre. `start()`
   sortait en silence : **le bouton « recommencer » ne faisait rien**, et le
   joueur restait bloqué sur l'écran de fin ;
5. `resumeExpedition()` passait par `startExpedition()`, qui incrémentait
   `expeditions.runs` : **reprendre comptait comme une nouvelle tentative**.

**Correctif.** Un état de session déclaré, `game.session` ∈ `home` / `campaign`
/ `hub` / `expedition`, et des transitions explicites : `leaveExpedition()`,
`retryExpedition()`, et un `startExpedition({ resumed: true })` qui ne compte
pas. Les trois déductions sur `this.run` deviennent des lectures de `session`.
`showMap()` abandonne la nuit explicitement, et le menu de pause le dit
(« Quitter la nuit ✕ », avec la mention que seuls les refuges enregistrent).
Un indice de salle hors du plan ne vaut plus victoire : il ramène au début avec
un message.

Découvert au passage, par le test de bout en bout : le bandeau d'entrée
affichait « CHAPITRE 00 / 12 » dans une salle de rêve, et comptait
l'observatoire parmi les chapitres. Corrigé (« NUIT · SALLE 02 / 05 »,
« L'OBSERVATOIRE », « CHAPITRE 01 / 11 »).

---

## E. Sauvegarde défensive — **confirmé (1), cinq défauts sur six**

| Promesse | Verdict |
|---|---|
| Une donnée corrompue n'écrase pas une copie de secours valide | **confirmé** |
| Les versions futures ne sont pas réinterprétées | **confirmé** |
| Les indices de salles et identifiants sont validés | **confirmé** |
| Les emplacements d'amélioration sont respectés | **confirmé** |
| Les récompenses ne sont pas doublées après reprise | **réfuté (1)** — le jeton `upgrade:<salle>:<id>` tenait déjà |
| Les échecs de stockage sont signalés après l'init de l'interface | **confirmé** |

Le détail des quatre premiers :

- **le filet se détruisait lui-même.** Après une récupération, le premier
  `save()` faisait `writeRaw(BACKUP_KEY, previous)` où `previous` était la
  donnée corrompue. Une seconde de jeu suffisait à perdre la seule copie saine.
- **une version future était rétrogradée en silence.** `validate()` ne
  regardait jamais `raw.schema` ; un profil `schema: 4` était lu comme un v3,
  amputé de ses champs inconnus, puis réécrit avec `schema = 3`.
- **`roomIndex` n'avait pas de plafond.** Une sauvegarde portant `roomIndex:
  4242` menait `enterRoom()` à ne trouver aucune salle, donc à
  `finishExpedition(true)` : une expédition **terminée et payée 2 000 points**,
  offerte par une donnée trafiquée.
- **`upgrades` était tronqué à 8** alors que le jeu n'a que **2** emplacements,
  et aucun identifiant n'était vérifié.

**Correctif.** `protectBackup` interdit d'écraser le filet tant qu'une donnée
saine n'a pas été réécrite ; `futureSchema` + `readOnly` laissent un profil
plus récent strictement intact et font jouer la session en mémoire ;
`roomIndex` est borné par `ROOMS_PER_RUN`, la route par les natures connues,
les souvenirs par `SLOTS` et par les identifiants réels. Les messages destinés
au joueur passent par `notify()` / `flushNotices()` : émis pendant le
constructeur, ils n'avaient aucun auditeur et se perdaient.

---

## Constats du cahier des charges laissés pour le jalon B

Vérifiés mais **non corrigés** dans ce jalon, conformément à l'ordre demandé :

- `powersSeen` est initialisé à `[]` et **rien ne l'alimente jamais**
  (**confirmé (2)**). `offer()` retombe donc systématiquement sur son pool de
  secours, et les souvenirs `souffle` et `sillage` sont proposés sans que le
  pouvoir dont ils dépendent ait été rencontré.
- **aucun module procédural ne distribue de pouvoir** : les onze modules ont
  tous `provides: []` (**confirmé (2)**). Le contrôle de dépendance des
  capacités est donc réel mais vide de sens : seul `resonance` circule.
- **l'onde du souffle n'appelle pas `dropCorolle()`** (**confirmé (2)**) :
  `emitResonance` ne la déclenche que pour `source === 'player'`, et le second
  saut émet avec `source === 'souffle'`. L'« Escalier de corolles » ne marche
  pas.
- **le thème `frost` est tiré du flux cosmétique et modifie la friction**
  (**confirmé (2)**) : une donnée d'apparence change une règle de jeu.
- **la pluie du boss utilise `Math.random()`** (**confirmé (2)**), donc une
  tentative n'est pas reproductible jusqu'au bout.
- `inspect()` **range ses erreurs dans le plan sans jamais rien rejeter**
  (**confirmé (2)**). Le corpus n'en trouve aucune aujourd'hui, mais rien
  n'empêcherait une salle fautive d'être livrée.
- `cost` est **déclaré, testé, et jamais utilisé dans la composition**
  (**confirmé (2)**).
- un **clic pendant le fondu de transition est ignoré en silence**
  (**confirmé (1)**, découvert par le test de bout en bout) : 620 ms de
  latence après chaque changement d'écran. C'est un problème de « commandes
  fiables », à traiter avec P1-1.
- l'**observatoire figure encore dans les cartes de l'atlas** comme un
  douzième chapitre (**confirmé (2)**). Le décompte du bandeau est corrigé,
  la carte non.

---

## Ce qui n'a pas été fait, et ne doit pas être présenté autrement

- **aucun playtest humain.** Le protocole est au backlog ; il n'a pas été
  exécuté. Tout jugement de plaisir, de lisibilité ou de difficulté dans ce
  document est une **hypothèse (3)**.
- **aucune mesure sur appareil réel.** Les cadences relevées par
  `npm run test:browser` viennent d'un Chromium logiciel dans un conteneur
  partagé : elles varient de 23 à 60 images/s d'une exécution à l'autre **pour
  le même code**. Ce ne sont pas des mesures de performance du jeu, et elles
  ne valident aucune cible.
- **aucun profilage.** §11 demande de mesurer avant d'optimiser ; rien n'a
  encore été mesuré, donc rien n'a été optimisé.
- **les jalons B, C et D ne sont pas entamés.** La Résonance n'a pas été
  revue, le chapitre « La rivière qui avait oublié la lune » n'existe pas, le
  « Jardinier des marées » non plus, et la migration TypeScript n'a pas
  commencé.
