# Itération 14 — Le même jeu, dans un téléphone Android

Base : `e62a03c`. Une seule demande : **produire un APK installable sur un
smartphone Android récent — cinq ans au maximum — et dire comment vérifier,
depuis ce Mac, qu'il fonctionnera.**

Le rapport précédent reste dans
[Cinq lieux qui ne se ressemblent plus](../iteration-13/README.md).

---

## 1. Le choix : Capacitor, et rien d'autre

Le projet embarque déjà **Capacitor 8** pour iOS. Le jeu est un seul fichier
HTML autonome de 839 kio, sans réseau, sans build côté navigateur. Trois voies
étaient possibles ; une seule ne coûtait rien de nouveau.

| Voie | Ce qu'elle apporte | Ce qu'elle coûte |
| --- | --- | --- |
| **Capacitor Android** | La plateforme sœur d'iOS. Même `dist/`, même pont, même `js/platform.js`, même contrat de sauvegarde. | Une commande : `npx cap add android`. |
| PWA installable | Aucun APK. Pas d'installation hors boutique, pas de plein écran garanti, pas de miroir de fichier pour la sauvegarde. | Réécrire l'écran de démarrage et la persistance. |
| Moteur natif (Godot, LibGDX…) | Rien ici : il faudrait réécrire le jeu. | Tout. |

**Capacitor.** La WebView d'Android est Chromium ; celle d'iOS est WebKit. Les
suites navigateur du dépôt tournent déjà sur les deux moteurs. Le choix ne
crée aucune seconde source de vérité : `js/platform.js` est le seul endroit
qui sait qu'il existe une coquille native, et il ne distingue pas les deux.

### Quel Android, exactement

Un téléphone de cinq ans est sorti sous Android 11 (API 30). Le plancher du
projet est plus bas et le plafond plus haut :

- **`minSdkVersion 24`** (Android 7.0) — le défaut de Capacitor 8. Aucun
  téléphone visé n'en est loin ; ce n'est pas la version d'Android qui décide,
  c'est la WebView.
- **`minWebViewVersion 90`** — le vrai plancher. Le jeu utilise `:is()` et
  `aspect-ratio`, arrivés avec Chrome 88. La WebView se met à jour par le Play
  Store : un téléphone de 2020 est aujourd'hui au-delà de 120. En deçà de 90,
  Capacitor l'écrit dans Logcat et charge quand même : l'app n'est pas bloquée,
  mais un écran cassé porte alors son explication.
- **`targetSdkVersion 36`** (Android 16) — sans quoi le bord-à-bord et la
  rotation des grands écrans ne s'appliquent pas.
- **Un seul APK universel.** Capacitor n'embarque aucun binaire propre à une
  architecture : le même fichier installe sur ARM et sur x86.

`#app` gardait `height:100dvh` sans repli. `dvh` n'existe qu'à partir de
Chrome 108 ; sans lui la page s'effondrait. Une déclaration `height:100%`
passe devant. Le plancher de 90 est désormais vrai.

---

## 2. Ce que la coquille Android doit faire que l'iPhone ne demandait pas

Six points, tous dans `MainActivity.java` sauf le dernier.

**Le bord-à-bord.** Android 15 et suivants dessinent sous les barres qu'on le
veuille ou non. `setDecorFitsSystemWindows(false)` et le mode d'encoche
`SHORT_EDGES` sont ce qui donne des valeurs à `env(safe-area-inset-*)` : sans
eux, le CSS du jeu reçoit des zéros et le HUD passe sous la pastille.

**Les barres disparaissent.** `BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE`, et elles
repartent à chaque retour de focus — une notification balayée les ramène
sinon.

**Le pouce garde le bas de l'écran.** C'est le point le plus important.
En navigation gestuelle, « retour » est un balayage depuis un bord et
« accueil » depuis le bas — exactement là où vivent les commandes tactiles.
`setSystemGestureExclusionRects` rend au jeu la bande de 200 dp du bas,
le maximum qu'Android accorde.

**L'écran ne s'éteint pas** (`FLAG_KEEP_SCREEN_ON`) et **la cadence est tenue**
(`setSustainedPerformanceMode`) : une chute thermique après trois minutes est
pire qu'un pic de départ.

**Le paysage, sauf sur grand écran.** `sensorLandscape` verrouille le
téléphone ; Android 16 rend la rotation aux écrans de plus de 600 dp. C'est
le comportement de l'iPad, obtenu sans seconde déclaration.

**Le bouton « retour ».** Sans traitement, il quitte l'application au milieu
d'un saut. Il emprunte maintenant la route d'Échap — la seule qui connaisse
l'atlas, la pause et les panneaux — en visant l'élément actif comme le ferait
une vraie touche. Au titre seulement, il rend la main au système par
`minimizeApp()`. Six lignes dans `js/platform.js`, aucune règle dupliquée.

---

## 3. Deux voies pour l'APK, dont une sans rien configurer

`.github/workflows/android.yml` construit l'APK à chaque poussée sur `main`
ou sur une branche `iteration-**`, et le dépose en artefact pour 14 jours.

- **Voie de test (par défaut).** Aucun secret : l'APK est signé par la clé de
  débogage du runner. Il s'installe, il se joue. Son empreinte change d'un run
  à l'autre : pour mettre à jour, il faut désinstaller, ce qui efface la
  progression.
- **Voie de version.** Dès que les quatre secrets `ANDROID_KEYSTORE_BASE64`,
  `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
  existent, l'APK est signé par ce magasin et se réinstalle par-dessus le
  précédent en gardant la sauvegarde.

`tools/android-release.cjs` décide de la voie, et refuse une configuration à
moitié posée avant d'appeler Gradle — une signature à trois secrets sur quatre
est un piège silencieux. Les mots de passe passent par l'environnement, jamais
par `-P` : une propriété Gradle se relit dans `ps` et dans les traces d'erreur.
Toute sortie d'erreur est masquée avant d'être affichée.

`--verify` prouve, avant le téléphone, que l'APK porte une signature v2 :
Android 11 et suivants refusent les autres.

### Le lien qui se partage

Un artefact d'Actions exige un compte GitHub pour être téléchargé — même sur
un dépôt public — et disparaît au bout de 14 jours. Une pièce jointe de
release, non. Le workflow attache donc l'APK à une prerelease au tag fixe
`android-test`, écrasée à chaque construction : l'adresse ne change jamais et
sert toujours la dernière.

<https://github.com/omarRamo/lumen/releases/download/android-test/LUMEN.apk>

C'est le seul endroit du workflow qui écrit dans le dépôt ; le droit
`contents: write` est posé sur le job, pas sur le fichier.

---

## 4. Simuler depuis ce Mac

Ce Mac n'a ni JDK, ni SDK Android, ni Android Studio. Deux niveaux de preuve,
dans cet ordre.

### Sans rien installer — `npm run test:android` et `npm run test:mobile`

`tests/test-android.cjs` lit le projet Android et vérifie le contrat avant
tout Gradle : orientation, bord-à-bord, encoche, exclusion de gestes, origine
de sauvegarde gelée, permissions (`INTERNET` et rien d'autre), plancher
WebView, poids des ressources (23 kio), et que l'icône adaptative ne déborde
pas de sa zone sûre — l'encre qui dépasse serait rognée par le masque.

`tests/test-mobile.cjs` joue vraiment le jeu dans **Chromium**, qui est le
moteur de la WebView Android. Trois formats Android s'ajoutent aux six
iPhone/iPad, en français et en arabe :

| Profil | Taille CSS en paysage | Correspond à |
| --- | --- | --- |
| Android pastille | 915 × 412 | Pixel 7 / 8, encoche sur un bord court |
| Android compact | 780 × 360 | Galaxy S23 / S24 |
| Android pliable | 841 × 701 | Pixel Fold, Galaxy Z Fold ouvert |

Le bouton « retour » y est éprouvé dans le vrai DOM : il ouvre la pause, la
referme, recule dans l'atlas sans en sortir, et ne rend le téléphone qu'au
titre.

### Avec l'émulateur — `npm run android:doctor`

Le script n’installe rien : il regarde ce poste et donne la commande exacte
qui manque. Aujourd'hui il en donne quatre.

```
brew install --cask temurin@21
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
brew install --cask android-commandlinetools
export ANDROID_HOME="$HOME/Library/Android/sdk"
sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-36" \
  "build-tools;36.0.0" "emulator" "system-images;android-35;google_apis_playstore;arm64-v8a"
avdmanager create avd -n lumen-pixel \
  -k "system-images;android-35;google_apis_playstore;arm64-v8a" -d pixel_8
```

Ensuite `npm run android:run` construit et lance sur l'émulateur — une image
arm64 tourne à vitesse native sur un Mac Apple Silicon. Téléphone branché,
la même commande le propose dans la liste.

**Ce qui n'est toujours pas prouvé** : les FPS, la chauffe, la batterie, la
latence tactile réelle, le mixage au haut-parleur, et le comportement de la
WebView d'un constructeur particulier. L'émulateur ne mesure aucun des six.

---

## 5. Un défaut trouvé en chemin

Le format **Galaxy S23 en arabe** (780 × 360) a fait tomber la suite. La cause
n'était pas Android.

`#app` portait `overflow:hidden`. Un conteneur en `hidden` reste défilable
**par programme** : un `focus()` sur une lumière de l'atlas qui dépasse le bord
le décalait de 23 px à l'horizontale — et jusqu'à 269 px à la verticale — sans
que rien ne puisse le ramener. Tout le jeu glissait, définitivement.
Au clavier ou à la manette, ce déplacement est atteignable par un joueur.

`overflow:clip` ne crée pas de conteneur de défilement du tout. La classe
entière du défaut disparaît en un mot. Il est écrit derrière son repli
(`overflow:hidden;overflow:clip`) : `clip` arrive avec Chrome 90 — le plancher
WebView de cette itération — et Safari 16, alors que le projet accepte encore
iOS 15, qui garde alors le comportement d'aujourd'hui.

Ce changement en a révélé un second, plus ancien : `tests/test-mobile.cjs`
lançait un lieu par un second appui sur sa lumière. Sur un écran court, la
fiche du lieu **recouvre** cette lumière ; le test ne passait que parce que
Playwright défilait ce conteneur inatteignable au doigt. Le chemin réellement
touchable — le bouton de la fiche, déjà vérifié visible et non recouvert
juste au-dessus — est désormais celui que le test emprunte quand la lumière
est couverte. Le test dit maintenant ce qu'un doigt peut faire.

---

## 6. Deux choses vues en passant, et laissées telles quelles

**Une bascule audio sous WebKit.** `tests/test-browser.cjs` échoue sur cette
machine au contrôle « ce premier appui doit débloquer l'audio », sous WebKit.
Vérification faite sur un `git worktree` posé sur `e62a03c` sans aucune de ces
modifications : **l'échec est identique**. Il tient à ce poste — Chromium passe
32/32 — et n'appartient pas à cette itération.

Un détail utile au passage : quand un contrôle échoue, `test-browser.cjs` ne
ferme pas son contexte. La page fuitée garde son `AudioContext`, et le contrôle
suivant ne peut plus démarrer le sien. Un échec en fabrique un second. La
première fois, les deux ont disparu ensemble.

**Les relevés régénérés.** Un passage de `test-browser.cjs` réécrit les 29
captures de `docs/platforms/` et leurs empreintes. Sur le worktree posé sur
`e62a03c`, un passage les réécrit **aussi**, avec les mêmes écarts : ils
viennent du moteur de ce poste, pas du code. Ils sont donc laissés à leur état
de `e62a03c`, pour que la relecture ne contienne que ce qui a été décidé.

## 7. Ce qui a changé

| Fichier | Ce qu'il fait |
| --- | --- |
| `android/` | Projet Capacitor. Manifeste, thèmes, `MainActivity`, icône adaptative. |
| `js/platform.js` | Le bouton « retour » d'Android. Le reste était déjà commun. |
| `style.css` | `overflow:clip` sur `#app`, repli `height:100%` avant `100dvh`. |
| `capacitor.config.json` | Bloc `android` et `androidScheme: "https"` — l'origine de la sauvegarde, gelée. |
| `tools/android-assets.cjs` | Icônes depuis `icon.svg`. Aucun bitmap de démarrage : `drawable/splash.xml` compose. |
| `tools/android-release.cjs` | Les deux voies, la signature, le masquage, la vérification v2. |
| `tools/android-doctor.cjs` | Ce qui manque à ce Mac, et la commande exacte. |
| `tests/test-android.cjs` | Le contrat du projet Android, sans SDK. |
| `tests/test-android-ci.cjs` | La voie choisie, le refus d'une demi-signature, aucun secret affiché. |
| `tests/test-mobile.cjs` | Trois profils Android, le bouton « retour », le chemin de lancement honnête. |
| `.github/workflows/android.yml` | L'APK en artefact, à chaque poussée. |

Aucune règle de jeu, aucun niveau, aucun dessin n'a changé.
