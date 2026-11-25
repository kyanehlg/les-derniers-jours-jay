# Les Derniers Jours — Jay

Une aventure narrative de survie dans le désert. Explore une carte topographique, gère les réserves de Jay, relie les indices d’un convoi disparu et décide qui franchira la frontière avec lui.

## Jouer

**Jouer en ligne :** <https://kyanehlg.github.io/les-derniers-jours-jay/>

Ouvre `index.html` dans un navigateur moderne, ou lance le serveur :

```sh
npm install
npm start
```

Le jeu est servi sur <http://localhost:3000>. Aucun compte ni service externe n’est nécessaire. Les préférences sonores et trois emplacements de progression sont enregistrés localement dans le navigateur. Les anciennes sauvegardes sont importées dans l’emplacement principal.

Le menu propose une scène désertique originale dessinée en SVG, les trois emplacements à charger, les paramètres audio/accessibilité et les crédits. Les images et les sons sont générés ou intégrés localement; aucune ressource distante n’est requise. Le navigateur ne permet pas de fermer de façon fiable l’onglet du joueur, donc aucun faux bouton « Quitter » n’est affiché.

## Campagne

- **Prologue — La tempête approche :** commence à 14:30 et prépare-toi avant la tempête de 17:00. Le temps ne défile jamais tout seul : les trajets, fouilles, examens, lectures et décisions font avancer l’horloge; consulter la carte, le sac, les menus ou le journal ne consomme aucun temps.
- **Chapitre 1 — La piste du Sud :** retrouve deux indices du convoi et réponds à Mira au relais.
- **Chapitre 2 — Les voix de la pierre :** traverse les gorges en résolvant une énigme. Une mauvaise piste coûte du temps et de la vitalité, mais ne bloque pas la progression.
- **Chapitre 3 — La dernière traversée :** prépare les vivres et choisis de partir seul, avec Mira, ou d’escorter les familles de Leïla. Des rencontres imprévues peuvent changer les ressources ou les pistes.

La carte affiche le relief, les chemins, la position de Jay et les lieux découverts. Les destinations éloignées restent dans le brouillard jusqu’à ce qu’une piste les révèle. Sélectionne un lieu pour voir sa distance et la durée du trajet; zoome avec les boutons ou la molette, puis fais glisser la carte pour l’explorer. Une fois sur place, les plans locaux révèlent les pièces et les points d’examen réellement disponibles; choisir un repère lance la même fouille minutée que depuis la liste d’actions.

Explorer un bâtiment ouvre une scène de fouille plein écran, dessinée en SVG original avec des objets repérables. Examine les meubles, ouvre certains tiroirs pour révéler des éléments cachés, puis consulte ou retourne les documents récupérés. Les fouilles secondaires sont consignées dans le journal et consomment leur durée affichée; les menus et l’inspection visuelle ne font pas avancer l’horloge. Après avoir repris une sauvegarde, **Explorer la pièce** permet de poursuivre une fouille sans perdre les repères déjà examinés. Les documents restent lisibles depuis le sac ou le journal, et le tableau d’enquête permet de relier des pièces à conviction. Des objets peuvent être combinés et utilisés à un lieu précis; le sac a une capacité de 8 kg.

La mission secondaire de Leïla et les succès sont facultatifs. L’horloge avance à la fin de chaque action et entraîne les événements du soir, de l’aube et les besoins quotidiens. La progression, la position, les objets, les documents, les liens d’enquête et l’heure sont sauvegardés; **Continuer** reprend l’emplacement sélectionné.

Les repères dorés de la carte indiquent des pistes plausibles selon l’objectif en cours. Le bouton **Indice** donne une orientation contextuelle sans révéler la réponse de l’énigme. Une apparition furtive peut se déclencher la nuit, après la tempête, dans certains lieux et lorsque la pression de Jay est élevée.

## Commandes et accessibilité

Les lieux, bâtiments, repères de fouille et décisions sont de vrais boutons HTML utilisables au clavier, à la souris ou au toucher. Le bouton **SON** active ou coupe l’ambiance et les sons d’interface générés localement; le curseur règle leur volume. Les paramètres proposent aussi une réduction des mouvements, en complément de la préférence du système. Le jeu reste en 2.5D SVG/Web Audio : aucun modèle photoréaliste ou asset 3D externe n’est fourni par ce projet, donc Three.js n’est pas ajouté comme dépendance décorative.
