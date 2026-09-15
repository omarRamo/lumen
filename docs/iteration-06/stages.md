# Six lieux, six décisions

Les clés ci-dessous font partie du contrat de sauvegarde. La réussite d’un
parcours automatique vérifie sa traversabilité ; elle ne remplace pas une
observation de joueur et ne suffit pas à établir qu’il est amusant.

## Acte I — Sur le dos d’un songe (`dos-du-songe`)

**L’idée.** Un dormeur apaisé devient une monture : son dos porte Lumen pendant
que le jardin défile. La surface sur laquelle on prépare son prochain saut se
déplace avec un être vivant.

**La décision.** Rester à bord et prolonger son apaisement par un appel, ou
quitter le dos au bon moment pour une branche facultative. Il faut lire la
destination du dormeur avant de s’élancer.

**Pourquoi ici.** Le premier acte introduit un changement de référentiel sans
demander une nouvelle combinaison de touches. Le rythme lent de la créature
rend sa trajectoire compréhensible.

**Le lieu.** Un jardin suspendu à hauteur de feuilles, sous des frondaisons
immenses. La monture possède un ventre, des pattes, des yeux fermés et un dos
clairement horizontal ; son mouvement vient de la plateforme physique.

## Acte I — Le petit astre égaré (`astre-a-guider`)

**L’idée.** Une petite lumière avance d’elle-même vers les corolles réveillées.
Lumen prépare le chemin de quelqu’un d’autre.

**La décision.** Courir réveiller la prochaine fleur ou attendre de vérifier que
l’astre a rejoint le bon repère. Aller vite ne suffit plus : l’ordre compte.

**Pourquoi ici.** L’appel appris sur l’île devient un outil d’orientation. La
réponse visible de l’astre relie immédiatement le geste à son effet.

**Le lieu.** Une pépinière céleste : de grandes tiges portent des corolles
creuses, les fleurs éveillées composent une ligne et la petite lumière en est
le visiteur. La lumière provient des fleurs utiles, plutôt que d’un soleil
décoratif omniprésent.

## Acte II — Le pont des veilleurs (`pont-des-veilleurs`)

**L’idée.** Un passage tient grâce à une chaîne de créatures éveillées ensemble.
La continuité du pont est une conséquence de leur état.

**La décision.** Entretenir la chaîne depuis une position sûre ou s’engager
pendant sa fenêtre d’ouverture. Les silhouettes éveillées annoncent les
appuis ; leur relâchement annonce la disparition.

**Pourquoi ici.** L’appel n’est plus seulement une impulsion devant un objet.
Il demande de regarder un ensemble et de choisir quand commencer à traverser.

**Le lieu.** Des petits gardiens forment une arche vivante au-dessus d’une faille.
Leurs dos relient deux culées anciennes. La structure ouverte remplace les
collines et les îlots du paysage habituel.

## Acte II — La rivière sans lune (`riviere-sans-lune`)

**L’idée.** Une rivière a perdu ses repères lumineux. Les rendre visibles
permet de reconstruire un passage que l’on ne peut pas lire d’un seul regard.

**La décision.** Rallumer un repère avant de quitter le précédent, puis avancer
en fonction des appuis réellement présents. L’élan aveugle cède sa place à
l’observation.

**Pourquoi ici.** Une fin d’acte peut être tendue par l’incertitude de l’espace,
sans augmenter la vitesse ou remplir la rivière d’ennemis.

**Le lieu.** Un cours d’eau sombre et horizontal, des roseaux maigres, de larges
espaces silencieux. Les reflets reviennent localement avec les repères
réveillés. Le personnage et les surfaces restent lisibles, même de nuit.

## Acte III — La colonne des saisons (`colonne-des-saisons`)

**L’idée.** Un jardin se gravit. Les racines, paliers et tremplins proposent une
ascension plutôt qu’une traversée horizontale.

**La décision.** Choisir le prochain palier et régler la hauteur du saut avant
de s’engager. Un appui au-dessus compte davantage que la distance vers la droite.

**Pourquoi ici.** La même précision de déplacement sert une autre lecture du
décor. Le changement d’architecture renouvelle les gestes acquis.

**Le lieu.** Un puits ouvert dans une racine monumentale, traversé par des
branches et une lumière venue d’en haut. Le défilement vertical se lit dans
les strates du bois ; le fond ne ressemble pas à une mer d’îles repeinte.

## Acte III — Là où pleut la lumière (`pluie-de-lumiere`)

**L’idée.** Les appuis poussent là où tombe une pluie lumineuse. Le paysage
indique où un passage est en train de se former.

**La décision.** Regarder devant soi et appeler pour y envoyer le nuage, ou se
retourner pour rappeler la pluie sur un appui à revisiter. Attendre ensuite une
pousse assez ferme, puis la rejoindre avant de préparer la suivante. Il faut
choisir où il pleut et lire une phase de croissance.

**Pourquoi ici.** La dernière constellation rassemble lecture de l’espace et
choix du moment. Une météorologie utile vaut mieux qu’une couche supplémentaire
de particules décoratives.

**Le lieu.** Quelques nuages bas au-dessus d’un vide clair. Des filets de lumière
descendent précisément sur les pousses jouables ; seules ces zones reçoivent
le mouvement nécessaire à la mécanique.

## Contrat visuel commun

Les décors spécifiques sont dessinés par `js/place-art.js`, à partir du même
état vivant que la physique (`game.place`, plateformes et réveils). Le rendu
n’invente ni collision, ni réveil, ni progression. Les contours supérieurs et
les signes des huit familles de plateformes restent la référence : racines,
facettes, flèches, pétales, fracture, anneaux, tirets et chevrons. Les variantes
jour et nuit changent la lumière, sans changer ces formes.
