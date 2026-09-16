# Itération 08 — LUMEN sur iPhone et iPad

Base : `origin/main` à `567f0f4`. Travail local dans `/Users/omartrabelsi/Repos/lumen`, sur `codex/iteration-08`. Aucun push, compte créé, accord accepté ou build envoyé pendant cette itération.

Le jeu conserve sa source HTML/CSS/JS et son édition autonome `LUMEN.html`. Capacitor 8 charge cette même édition dans une application universelle iOS. Le projet Xcode et le workflow sont prêts ; **aucun IPA signé ni essai sur appareil réel n’a encore été validé**. Ce Mac dispose des Command Line Tools, mais pas de Xcode complet. Les informations du brief relatives à un poste Windows ne décrivent donc pas l’environnement utilisé ici.

## Ce qu’Omar doit faire, dans l’ordre

1. **Adhérer au programme Apple.** Depuis [Apple Developer Program](https://developer.apple.com/programs/enroll/), choisir **Start Your Enrollment**, se connecter, vérifier son identité, choisir son statut puis accepter et payer soi-même. Le tarif annoncé est de 99 USD/an, ou l’équivalent local. Prévoir une marge de 24–48 h pour la validation ; ce n’est pas un délai garanti. Attendre que l’adhésion soit active et accepter les éventuels accords Apple en attente.
2. **Créer le Bundle ID.** Dans [Developer Account](https://developer.apple.com/account/), ouvrir **Certificates, Identifiers & Profiles → Identifiers → + → App IDs → App**, nommer l’app LUMEN, choisir un identifiant **Explicit** et saisir `com.omartrabelsi.lumen`. Continuer puis **Register**. Aucune capacité supplémentaire n’est nécessaire. Dans **Membership details**, relever aussi le **Team ID** : il est distinct de l’Issuer ID de la clé API.
3. **Créer la fiche.** Dans [App Store Connect](https://appstoreconnect.apple.com/), **My Apps → + → New App**, choisir **iOS**, le nom LUMEN (ou un nom disponible), le français comme langue principale, le Bundle ID précédent, et un SKU personnel, par exemple `lumen-ios`. Créer la fiche. Ceci ne soumet pas l’app à l’App Store.
4. **Créer la clé API d’équipe.** **Users and Access → Integrations → App Store Connect API → Team Keys → Generate API Key** ; demander d’abord l’accès API si Apple le propose. Nommer la clé `LUMEN GitHub Actions`, choisir le rôle **App Manager**, puis télécharger le `.p8` soi-même : Apple ne permet ce téléchargement qu’une fois. Relever le **Key ID** et l’**Issuer ID**. Vérifier l’accès de l’équipe à **Certificates, Identifiers & Profiles** et à la signature cloud. Le rôle App Manager ne constitue pas, à lui seul, une preuve que le provisioning automatique sera autorisé sur ce compte ; le premier build le validera. Ne transmettre aucune valeur dans une conversation et ne rien déposer dans le dépôt. [Documentation API Apple](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-api).
5. **Configurer GitHub.** Dans [le dépôt](https://github.com/omarRamo/lumen), **Settings → Secrets and variables → Actions → Secrets → New repository secret**, créer soi-même `APPSTORE_ISSUER_ID`, `APPSTORE_KEY_ID` et `APPSTORE_PRIVATE_KEY` (contenu complet du `.p8`, avec ses vraies lignes). Dans l’onglet **Variables → New repository variable**, créer `APPLE_TEAM_ID`. Cette quatrième valeur, non secrète, est indispensable à Xcode ; elle manquait dans le brief initial. Ne pas la confondre avec le Bundle ID.
6. **Pousser et lancer.** Examiner les quatre commits, puis les intégrer/pousser soi-même sur `main`. Un push sur `main` lance **Actions → LUMEN · TestFlight interne** ; un lancement manuel est aussi disponible via **Run workflow** une fois le workflow connu sur la branche par défaut. La CI vérifie la configuration avant de construire, installe Node 22, exécute `npm ci`, les suites Chromium/WebKit, puis `cap sync ios`. Elle sélectionne Xcode 26 sur `macos-26`, archive avec la clé API, exporte et conserve l’IPA avant de l’envoyer. `CFBundleVersion` prend `github.run_number`. Après un upload réussi, demander un **nouveau lancement manuel** pour un nouveau numéro ; relancer simplement le même run ne l’incrémente pas.
7. **Se déclarer testeur interne.** Dans **My Apps → LUMEN → TestFlight → Internal Testing → +**, créer un groupe, activer la distribution automatique si souhaitée, puis **Add Testers** et sélectionner son propre utilisateur App Store Connect. Ajouter le build lorsqu’il est disponible. Remplir les informations de test ou de conformité réclamées par Apple, le cas échéant. Ne créer aucun groupe externe et ne cliquer sur aucune soumission à App Review.
8. **Installer sur les deux appareils.** Installer TestFlight depuis l’App Store sur l’iPhone et l’iPad, accepter l’invitation avec l’Apple Account du testeur, puis choisir LUMEN → **Install**. Le même build couvre les deux appareils ; leurs progressions restent indépendantes et locales.

Les tests **internes** ne nécessitent pas de Beta App Review. Apple autorise jusqu’à **100 testeurs internes** ; chaque build reste testable **90 jours**. Il faut toutefois attendre le traitement du build et son affectation au groupe. Les « 10–30 minutes » du brief sont une estimation pratique, pas une garantie Apple. [TestFlight](https://developer.apple.com/testflight/), [ajout de testeurs internes](https://developer.apple.com/help/app-store-connect/test-a-beta-version/add-internal-testers).

## Ce qui a changé

| Avant | Après |
| --- | --- |
| Un seul fichier portable généré | `LUMEN.html` et `dist/index.html` strictement identiques ; `dist/` contient seulement `index.html` |
| Tests navigateur Chromium | Mêmes suites sous Chromium et WebKit, avec vérification de `file://` et des requêtes |
| Aucun projet natif | Projet Xcode versionné, scheme partagé `LUMEN`, Swift Package Manager, iOS 15 minimum, iPhone et iPad |
| Ressources du modèle Capacitor | Icône opaque de 8,6 Kio dérivée de `icon.svg`, master universel 1024 px ; lancement uni `#dce6d5` et label natif « ✦ LUMEN » |
| Dépendances npm non verrouillées | `package-lock.json` versionné pour rendre `npm ci` utilisable ; aucun fichier à extension `.lock` ajouté |

`dist/`, Pods, public natif, sorties de build et DerivedData restent ignorés. Le budget de poids exclut explicitement `dist/` et `ios/App/Pods/`. L’unique exception PNG est l’icône iOS requise par Xcode : elle reste comptée dans les budgets et possède son propre plafond de 128 Kio. Les budgets globaux sont inchangés.

Les packages Capacitor sont des dépendances de développement. Aucun SDK npm n’est ajouté à l’édition web : iOS injecte son pont et les proxies des plugins App, Filesystem et StatusBar. Le manifeste de confidentialité décrit les API de fichiers et de préférences utilisées. `WKAppBoundDomains` autorise uniquement `localhost`, l’hôte local Capacitor.

## Les six points iOS et la veille

| Point | Traitement |
| --- | --- |
| Plein écran | `#song-fullscreen` masqué en natif, barre d’état cachée, iPhone paysage ; iPad dans les quatre orientations demandées |
| Audio | Un point de reprise réutilise `audio.unlock()` lorsque le contexte est suspendu, au retour visible et au signal natif actif ; pas de changement à `AVAudioSession` |
| Cycle de vie | `appStateChange` inactif met en pause, coupe les entrées et demande la vidange du miroir ; les écouteurs web sont conservés ; retour actif sans reprise automatique de la partie |
| ProMotion | `CADisableMinimumFrameDurationOnPhone=true` ; la simulation à pas fixe ne change pas. La fréquence réelle reste déterminée par l’appareil et iOS |
| Stockage | `SaveStore` reste synchrone. Hors natif, l’adaptateur retourne exactement `localStorage`. En natif, miroir JSON des quatre clés LUMEN, debounce 400 ms, écritures sérialisées via fichier temporaire puis renommage. Réhydratation avant création du moteur seulement si aucune clé LUMEN n’existe. Les sauvegardes existantes et les anciennes versions gardent la priorité |
| Rebond et gestes | `scrollEnabled=false`, CSS limité à `.lumen-native`, sélection et menu contextuel désactivés sur canvas/boutons ; viewport web inchangé |
| Veille | Wake Lock demandé en jeu, libéré en pause/sortie/arrière-plan ; un verrou qui arrive après la pause est immédiatement libéré ; absence ou refus de l’API tolérés |

Le miroir se trouve dans le répertoire `DATA` de l’app, sous `lumen-progress.json`, hors cache WebKit. Il ne constitue pas une synchronisation cloud et ne survit pas à une désinstallation. Une fermeture brutale avant l’écriture différée peut perdre les dernières modifications du miroir, tout en conservant la sauvegarde primaire si WebKit la garde. En cas d’erreur disque, la partie continue avec `localStorage`.

Ne jamais changer `server.iosScheme`, `appId`, `webDir` ni l’hôte de l’origine sans plan explicite de migration. Les tests figent le schéma `capacitor` et la configuration attendue.

Le support du Wake Lock dans Safari 16.4 ne suffit pas à garantir son fonctionnement dans toutes les versions de WKWebView. Le code teste la présence de l’API et tolère son refus ; l’absence de veille doit donc être vérifiée sur l’iPhone et l’iPad cibles. [Annonce WebKit 16.4](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).

## Vérifications et limites

Exécuté localement :

- `npm run verify` : suites hors navigateur et Chromium vertes ; **30/30** contrôles navigateur et **6/6** contrôles journey-browser.
- `npm run test:browser:webkit` : **30/30 + 6/6**, mêmes assertions et parcours.
- `npm run test:native` : configuration/orientations, autonomie du build, stockage web identique, restauration d’une progression, debounce, migrations non destructives v1/v2, erreurs disque, cycle de vie, audio et courses de Wake Lock.
- Démarrage natif simulé dans les deux navigateurs : lecture disque retardée, progression restaurée avant démarrage, bouton masqué, pause native et absence de réseau.
- `npm run ios:sync` : trois plugins détectés ; `plutil -lint` valide le projet et les plist.
- Prévalidation CI : chaque configuration manquante est nommée, sans afficher sa valeur.

Playwright WebKit constitue un filet contre les régressions du moteur web ; il ne remplace pas WKWebView sur un vrai appareil. Restent à vérifier avec le premier build signé : provisioning Apple, installation et mise à jour conservant la progression, icône et lancement rendus par Xcode, rotation/safe-area, interruption par appel ou Siri, respect de l’interrupteur silencieux, Wake Lock et ProMotion.

La CI suit la route API + `-allowProvisioningUpdates`, sans `.p12`. Apple documente la distribution automatisée avec clé API et signature cloud, mais les droits réels du compte, les certificats et profils existants peuvent encore bloquer une archive sur runner neuf. Lire l’erreur de l’étape ; vérifier d’abord les accords et autorisations. Aucune route `.p12` n’a été ajoutée sans échec réel constaté. [Signature cloud Apple](https://developer.apple.com/videos/play/wwdc2021/10204/), [certificats gérés dans le cloud](https://developer.apple.com/help/account/certificates/cloud-managed-certificates).

L’IPA est un artefact conservé 14 jours, disponible même si l’envoi échoue. C’est un binaire de distribution App Store Connect, pas un IPA installable directement par câble sans autre signature. L’export porte `testFlightInternalTestingOnly=true` et n’effectue aucune soumission à la revue.

Pour reproduire les tests :

```sh
npm ci
npx playwright install chromium webkit
npm run verify
npm run test:browser:webkit
npm run ios:sync
```

Pour régénérer l’icône après une modification de `icon.svg` : `npm run ios:assets`. [Prérequis Capacitor 8](https://capacitorjs.com/docs/getting-started/environment-setup), [configuration Capacitor](https://capacitorjs.com/docs/config), [runner macos-26](https://github.blog/changelog/2026-02-26-macos-26-is-now-generally-available-for-github-hosted-runners/).

## Android ensuite

Ajouter `@capacitor/android@^8`, exécuter `npm run build`, `npx cap add android`, puis `npx cap sync android`. Les mêmes HTML/JS, plugins et adaptateur pourront servir. Il restera un SDK Android/JDK, les icônes, la configuration système/orientations, la signature et les essais sur appareil ; c’est peu de travail applicatif, mais pas une livraison gratuite de toute validation. Aucun projet Android n’a été créé ici.
