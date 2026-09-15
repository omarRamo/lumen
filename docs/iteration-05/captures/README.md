# Captures Avant Et Après

Captures réelles de l'édition source en `file://`, locale française, échelle
de pixels 1. Bureau : 1440 × 900 en jour. Mobile : 390 × 844 en nuit.
Les images avant sont prises sur un export temporaire du commit `e805bb4`.
Les images après sont prises sur le code de l'itération 05.

| Lieu | Bureau avant | Bureau après | Mobile avant | Mobile après |
| --- | --- | --- | --- | --- |
| Accueil | [Avant](before/desktop-home.png) | [Après](after/desktop-home.png) | [Avant](before/mobile-home.png) | [Après](after/mobile-home.png) |
| Chapitre 1 | [Avant](before/desktop-chapter-1.png) | [Après](after/desktop-chapter-1.png) | [Avant](before/mobile-chapter-1.png) | [Après](after/mobile-chapter-1.png) |
| Observatoire | [Avant](before/desktop-observatory.png) | [Après](after/desktop-observatory.png) | [Avant](before/mobile-observatory.png) | [Après](after/mobile-observatory.png) |
| Salle de rêve | [Avant](before/desktop-dream.png) | [Après](after/desktop-dream.png) | [Avant](before/mobile-dream.png) | [Après](after/mobile-dream.png) |
| Île 1 | [Avant](before/desktop-island-1.png) | [Après](after/desktop-island-1.png) | [Avant](before/mobile-island-1.png) | [Après](after/mobile-island-1.png) |
| Île 2 | [Avant](before/desktop-island-2.png) | [Après](after/desktop-island-2.png) | [Avant](before/mobile-island-2.png) | [Après](after/mobile-island-2.png) |
| Île 3 | [Avant](before/desktop-island-3.png) | [Après](after/desktop-island-3.png) | [Avant](before/mobile-island-3.png) | [Après](after/mobile-island-3.png) |

Le [script](../../../tests/identity-captures.cjs) attend les polices, les
premières images et la disparition des transitions, puis fige le cadrage.
Le profil possède la quête de la coupole terminée pour accéder au rêve.
La salle utilise la graine `verger-lune-lune-0`. L'observatoire est cadré à
la caméra x=530, Lumen à x=710 ; les autres scènes à caméra x=0, Lumen x=180.
L'horloge de rendu est 2 secondes. Les
[manifestes avant](before/manifest.json) et [après](after/manifest.json)
sont comparés automatiquement ; un écart de position ou de viewport échoue.

Ces mises en place sont des fixtures de capture, **pas un playtest**. Le
parcours séparé dans [test-browser.cjs](../../../tests/test-browser.cjs)
ne modifie ni position, ni invulnérabilité, ni état de réussite.

Pour reprendre les références, fournir un export du commit initial :

```sh
node tests/identity-captures.cjs before CHEMIN_EXPORT_E805BB4
node tests/identity-captures.cjs after
```

La [galerie des plateformes](../platforms/measurements.json) contient aussi
16 vues, une par thème et apparence, chacune avec les huit types.
Exemples : [prairies jour](../platforms/light-meadow.png),
[prairies nuit](../platforms/dark-meadow.png).

Les anciennes captures ailleurs dans `docs/` sont historiques. Elles ne
décrivent plus l'apparence livrée et ne sont pas utilisées par le jeu.