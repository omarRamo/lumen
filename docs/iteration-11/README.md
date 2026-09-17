# Itération 11 — Le premier contact

Base : `bb419c7`. Le rapport précédent reste dans [Vies et rivière](vies-et-riviere.md).

## Diagnostic avant modification

L’iPhone jumelé est indisponible (`devicectl`). **Aucune mesure physique n’a pu être obtenue.** Les mesures suivantes proviennent de WebKit, viewport 956 × 440, tactile, DPR 3, marges latérales simulées 62 px et basse 21 px. Elles ne remplacent pas le retest sur appareil.

| Mode | `lumen-touch` | Directions | Action | Saut | Source effective |
| --- | --- | --- | --- | --- | --- |
| Île Chant | présente | 72 × 74 | 66 × 68 | 86 × 86 | `play.css` |
| Jardin | présente | 72 × 74 | 66 × 68 | 86 × 86 | `play.css` |

Le conteneur était à 70 px des côtés et 29 px du bas. La classe manquante n’est pas reproduite. Trois feuilles avaient toutefois leurs propres dimensions, dont des réductions sous 600 px. Les règles de géométrie et d’apparence des commandes sont désormais regroupées dans `play.css`, indépendamment de la détection tactile. La visibilité reste décidée par le mode et le périphérique.
