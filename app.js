'use strict';
(() => {
  const SAVE_KEY = 'jay-survival-save-v5';
  const SAVE_SCHEMA_VERSION = 2;
  const SAVE_SLOT_KEYS = [1, 2, 3].map(slot => `${SAVE_KEY}-slot-${slot}`);
  const PREVIOUS_SAVE_KEY = 'jay-survival-save-v4';
  const LEGACY_SAVE_KEY = 'jay-survival-save-v3';
  const AUDIO_KEY = 'jay-survival-audio-v1';
  const OPTIONS_KEY = 'jay-survival-options-v1';
  const STORM_DEADLINE = 17 * 60;
  const START_CLOCK = 14 * 60 + 30;
  const GAME_START_DATE = Date.UTC(2026, 6, 14);
  const $ = id => document.getElementById(id);
  let selectedSlot = 1;
  let reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let reduceFlashes = false;
  let textScale = 1;
  let difficulty = 'normal';
  let hasMotionPreference = false;
  let syncStormAnimation = () => {};
  let atmosphereTimer = null;
  let stormCinematicTimer = null;
  let mapZoom = 1;
  let mapOffset = { x: 0, y: 0 };
  let mapDrag = null;
  let selectedEvidence = new Set();
  let explorationFocus = null;
  let explorationDocumentFace = 'front';
  let explorationDocumentZoomed = false;
  const resourceNames = { water: 'eau', food: 'ration(s)', materials: 'matériaux', medicine: 'soin(s)' };
  const achievementNames = {
    firstFind: 'Première fouille',
    cartographer: 'Cartographe',
    leila: 'Main tendue',
    riddle: 'Ouvreur de voie',
    reunion: 'Confiance gagnée',
    escape: 'Au-delà du sable'
  };
  const chapterNames = {
    1: 'La piste du Sud',
    2: 'Les voix de la pierre',
    3: 'La dernière traversée'
  };
  function createInitialState() {
    return {
      phase: 'welcome',
      chapter: 1,
      day: 1,
      clockMinutes: START_CLOCK,
      elapsedMinutes: 0,
      position: 'shelter',
      discovered: ['shelter', 'market', 'clinic', 'depot', 'village'],
      inspected: [],
      exploredDetails: [],
      inventory: { waterskin: 1, fieldTools: 1 },
      documents: [],
      readDocuments: [],
      linkedEvidence: [],
      resources: { water: 1, food: 1, materials: 1, medicine: 0 },
      health: 100,
      morale: 70,
      base: 60,
      route: 0,
      stress: 20,
      clues: 0,
      trust: 0,
      selectedZone: null,
      currentSite: null,
      searched: [],
      visited: [],
      journal: [],
      achievements: [],
      flags: {},
      encounterDays: [],
      randomSeed: 0,
      activeEncounter: null,
      pendingScene: null,
      ending: null,
      toastTimer: null
    };
  }

  const state = createInitialState();

  const itemCatalog = {
    waterskin: { name: 'Gourde cabossée', icon: '◉', category: 'Survie', weight: 0.6, description: 'La gourde de Jay, remplie juste avant la tempête.' },
    fieldTools: { name: 'Outils de terrain', icon: '⚒', category: 'Équipement', weight: 1.4, description: 'Une pince, une lame et un tournevis. De quoi ouvrir sans tout casser.' },
    cloth: { name: 'Bande de toile', icon: '▤', category: 'Matériel', weight: 0.2, description: 'Une toile propre, récupérée dans une armoire de l’infirmerie.' },
    charcoal: { name: 'Charbon filtrant', icon: '▧', category: 'Matériel', weight: 0.3, description: 'Des morceaux de charbon trouvés dans l’atelier. Ils peuvent filtrer l’eau.' },
    waterFilter: { name: 'Filtre artisanal', icon: '⌁', category: 'Équipement', weight: 0.5, description: 'Toile et charbon assemblés. Il peut purifier l’eau de la station de pompage.' },
    brassToken: { name: 'Jeton de la voie 9', icon: '◈', category: 'Indice', weight: 0.1, description: 'Un jeton en laiton gravé d’une étoile et du nombre 09.' },
    oldPhoto: { name: 'Photographie froissée', icon: '▧', category: 'Indice', weight: 0.1, description: 'Mira, Leïla et plusieurs familles posent devant le convoi. La photo est datée de la veille de la fuite.' },
    convoyMap: { name: 'Carte du convoi', icon: '⌖', category: 'Document', weight: 0.2, description: 'Un relevé ferroviaire annoté à la main. Le passage des gorges y est entouré.' },
    radioBattery: { name: 'Batterie de secours', icon: '▰', category: 'Équipement', weight: 0.4, description: 'Une batterie à demi chargée, compatible avec le relais 09.' }
  };

  const documentCatalog = {
    railwayNote: { title: 'Carnet du cheminot', source: 'Refuge 09 · bureau du gardien', content: '« Étoile, source, soleil. Les familles ont pris la voie basse. Le poste 09 sait où elles sont. » Une seconde écriture ajoute : « Ne faites pas confiance aux horaires affichés à la frontière. »' },
    clinicRegister: { title: 'Registre de l’infirmerie', source: 'Infirmerie · salle de soins', content: 'Leïla a enregistré trois blessés transférés vers l’oasis. Dans la marge : « La porte de l’ouest est surveillée. Passer par les arches après la nuit tombée. »' },
    marketReceipt: { title: 'Reçu de livraison', source: 'Bazar · épicerie', content: 'Une livraison de filtres et de médicaments a été déplacée vers la station de pompage. Le reçu est signé « M. » et daté de la veille du départ du convoi.' },
    convoyManifest: { title: 'Manifeste du convoi', source: 'Dépôt ferroviaire · wagon de fret', content: 'Les noms sont barrés au crayon, puis réécrits dans une autre colonne. Le convoi n’a pas été abandonné : son itinéraire a été volontairement effacé.' },
    familyPhotograph: { title: 'Au bord de la voie', source: 'Vieux village · maison aux volets bleus', content: 'Au dos de la photo, une phrase : « Si nous sommes séparés, retrouve-nous là où la pierre fait trois ombres. »' }
  };

  const zones = {
    shelter: {
      name: 'Refuge 09',
      description: 'Un abri fragile, envahi par le sable. C’est ici que Jay a trouvé le carnet du cheminot.',
      buildings: [
        {
          id: 'room', name: 'Dortoir effondré', icon: '⌂',
          loot: { water: 1, materials: 1 },
          text: 'Jay trouve une gourde marquée d’un soleil et des plaques de métal sous un lit.',
          choices: [
            { title: 'Renforcer la porte', detail: 'Dépense une pièce pour préparer le refuge.', action: { cost: { materials: 1 }, effect: { base: 18 }, log: 'Jay renforce la porte. Pour la première fois, le refuge ressemble à un endroit où l’on peut tenir.' } },
            { title: 'Se reposer un instant', detail: 'Une pause apaise Jay, mais la nuit avance.', action: { effect: { health: 8, morale: 5, stress: -5 }, log: 'Jay ferme les yeux. Dans le silence, il croit entendre la voix de sa sœur.' } }
          ]
        },
        {
          id: 'office', name: 'Bureau du gardien', icon: '▤',
          loot: { food: 1 },
          text: 'Un carnet de voie est resté ouvert sur une page couverte de poussière.',
          choices: [
            { title: 'Étudier les annotations', detail: 'Le vieux cheminot a laissé une première piste vers le sud.', action: { effect: { route: 1, clues: 1 }, log: 'Dans le carnet, Jay trouve une carte ferroviaire et le premier signe du convoi : une étoile gravée près du puits.' } },
            { title: 'Prendre la ration cachée', detail: 'Un peu de nourriture pour la route.', action: { effect: { food: 1 }, log: 'Jay découvre une ration dans le tiroir du gardien.' } }
          ]
        }
      ]
    },
    market: {
      name: 'Bazar abandonné',
      description: 'Les boutiques ont été vidées à la hâte. Un courant d’air fait battre une enseigne métallique.',
      buildings: [
        {
          id: 'grocery', name: 'Épicerie éventrée', icon: '▰',
          loot: { food: 2, water: 1 },
          text: 'Quelques boîtes sont intactes sous les étagères renversées.',
          choices: [
            { title: 'Partager les provisions', detail: 'Jay garde une partie du stock pour les familles du camp.', action: { effect: { morale: 8, trust: 1 }, log: 'Jay laisse une boîte près de la porte pour les familles qui suivront. La faim ne devrait pas décider de tout.' } },
            { title: 'Garder le stock', detail: 'Ces provisions peuvent faire la différence à la frontière.', action: { effect: { stress: -3 }, log: 'Jay remplit son sac. La route sera longue, et personne ne sait ce qui attend au sud.' } }
          ]
        },
        {
          id: 'workshop', name: 'Atelier de réparation', icon: '⚒',
          loot: { materials: 2 },
          text: 'Un établi renversé cache des outils et un filtre à eau démonté.',
          choices: [
            { title: 'Récupérer les pièces', detail: 'Renforce le refuge et les réparations futures.', action: { effect: { materials: 2, base: 5 }, log: 'Jay récupère des pièces utilisables et renforce un peu le refuge.' } },
            { title: 'Fabriquer un filtre', detail: 'Consomme une pièce pour purifier de l’eau.', action: { cost: { materials: 1 }, effect: { water: 2 }, log: 'Avec un morceau de toile et du charbon, Jay remet le filtre en état.' } }
          ]
        }
      ]
    },
    clinic: {
      name: 'Infirmerie',
      description: 'La petite clinique a été évacuée en urgence. Des traces de pas repartent vers l’oasis.',
      buildings: [
        {
          id: 'ward', name: 'Salle de soins', icon: '✚',
          loot: { medicine: 2 },
          text: 'Une armoire de secours est coincée sous un panneau tombé.',
          choices: [
            { title: 'Dégager l’armoire', detail: 'Récupère des soins malgré le risque de blessure.', action: { effect: { medicine: 2, health: -3 }, log: 'Jay libère l’armoire. Sur le registre, un nom revient plusieurs fois : Leïla, médecin du camp de l’oasis.' } },
            { title: 'Lire le registre', detail: 'Un mot de Leïla parle d’un camp au sud-est.', action: { effect: { clues: 1, morale: 3 }, log: 'Leïla a laissé une note : « Si quelqu’un trouve ceci, les familles sont à l’oasis. Ne partez pas sans elles. »' } }
          ]
        },
        {
          id: 'garage', name: 'Garage arrière', icon: '▧',
          loot: { materials: 1, water: 1 },
          text: 'Une porte de service donne sur une piste partiellement ensevelie.',
          choices: [
            { title: 'Suivre la piste', detail: 'La piste rejoint l’ancien tracé ferroviaire.', action: { effect: { route: 1, health: -4, stress: 4 }, log: 'La piste du garage rejoint la voie sud. Jay marque le détour sur sa carte.' } },
            { title: 'Fouiller les caisses', detail: 'Prends les ressources et repars.', action: { effect: { materials: 1, water: 1 }, log: 'Jay trouve une gourde et des pièces dans le garage.' } }
          ]
        }
      ]
    },
    depot: {
      name: 'Dépôt ferroviaire',
      description: 'Les wagons bloquent la voie. Sous le sable, le vieux réseau ferroviaire relie encore les villages.',
      buildings: [
        {
          id: 'wagon', name: 'Wagon de fret', icon: '▤',
          loot: { materials: 2, food: 1 },
          text: 'Une caisse est bloquée dans le wagon, sous une poutre instable.',
          choices: [
            { title: 'Dégager la caisse', detail: 'Risque de blessure, mais récupère les ressources.', action: { effect: { materials: 2, food: 1, health: -4 }, log: 'Jay dégage une caisse de pièces et de rations.' } },
            { title: 'Lire la carte du convoi', detail: 'Le deuxième signe révèle une voie sûre vers le sud.', action: { effect: { route: 2, clues: 1 }, flags: { secretCode: true }, log: 'La carte du wagon révèle le deuxième signe : « Étoile, source, soleil ». Le convoi a pris les gorges.' } }
          ]
        },
        {
          id: 'signal', name: 'Poste de signalisation', icon: '⌖',
          loot: { materials: 1 },
          text: 'Un panneau de contrôle indique les anciennes routes de fret.',
          choices: [
            { title: 'Lire le panneau', detail: 'Les trois entailles du signal pointent vers le sud-est.', action: { effect: { route: 1, clues: 1 }, flags: { secretCode: true }, log: 'Le panneau confirme une traversée par les gorges. Trois signes sont gravés sur la borne : étoile, source, soleil.' } },
            { title: 'Récupérer le câblage', detail: 'Le cuivre peut servir à réparer le refuge.', action: { effect: { materials: 2, base: 5 }, log: 'Jay récupère du câblage et consolide le refuge.' } }
          ]
        }
      ]
    },
    village: {
      name: 'Vieux village',
      description: 'Une poignée de maisons résiste encore au vent. Des lampes ont été laissées allumées.',
      buildings: [
        {
          id: 'house', name: 'Maison aux volets bleus', icon: '⌂',
          loot: { food: 1, water: 1 },
          text: 'Une lampe à huile est encore tiède. Sur la table, un bol porte deux prénoms.',
          choices: [
            { title: 'Fouiller la cuisine', detail: 'Récupère quelques provisions.', action: { effect: { food: 1, water: 1 }, log: 'Jay trouve de l’eau et une ration dans la cuisine.' } },
            { title: 'Suivre les traces au sol', detail: 'Des empreintes conduisent vers le convoi.', action: { effect: { route: 1, clues: 1, morale: 3 }, log: 'Les empreintes conduisent Jay vers le sud. Quelqu’un a écrit « nous sommes ensemble » dans la poussière.' } }
          ]
        },
        {
          id: 'cistern', name: 'Citerne commune', icon: '◉',
          loot: { water: 2 },
          text: 'La citerne est presque sèche, mais son filtre semble encore intact.',
          choices: [
            { title: 'Filtrer l’eau', detail: 'Récupère de l’eau potable.', action: { effect: { water: 2 }, log: 'Jay filtre l’eau restante de la citerne.' } },
            { title: 'Inspecter les gravures', detail: 'Un symbole indique un ancien passage frontalier.', action: { effect: { route: 1, clues: 1 }, log: 'Les gravures indiquent un ancien passage vers la frontière.' } }
          ]
        }
      ]
    },
    radio: {
      name: 'Relais 09',
      description: 'Un relais radio grésille au sommet de la dune. La fréquence 09 s’allume et s’éteint.',
      minChapter: 1,
      buildings: [
        {
          id: 'antenna', name: 'Antenne de secours', icon: '⌁',
          text: 'Une voix traverse les parasites : « Ici Mira. Si tu as trouvé la carte du convoi, réponds. »',
          choices: [
            { title: 'Partager les pistes', detail: 'Mira révèle ce qui est arrivé au convoi et fait confiance à Jay.', action: { requires: { clues: 2 }, flags: { miraContact: true }, effect: { trust: 2, morale: 5 }, log: '« Je m’appelle Mira. J’ai guidé les familles dans les gorges. Les soldats ferment la route, mais je connais l’ancien passage. Étoile, source, soleil — garde l’ordre en mémoire. »' } },
            { title: 'Répondre sans donner sa position', detail: 'Mira aide Jay, mais reste méfiante.', action: { requires: { clues: 2 }, flags: { miraContact: true }, effect: { trust: 1, stress: -3 }, log: '« Je suis Mira, éclaireuse. Je te guiderai jusqu’aux gorges, mais pas par radio. Il y a des oreilles partout. »' } }
          ]
        }
      ]
    },
    canyon: {
      name: 'Gorges des Veilleurs',
      description: 'Un passage étroit fend la roche. Trois arches portent les signes du carnet, mais une seule ouvre la voie.',
      minChapter: 2,
      buildings: [
        {
          id: 'arches', name: 'Les trois arches', icon: '⌁',
          text: 'Trois arches portent une étoile, une source et un soleil. Une phrase fend la pierre : « La nuit ouvre la route. L’eau seule nourrit la marche. Le jour la referme. »',
          choices: [
            { title: 'Étoile → source → soleil', detail: 'Suivre l’ordre donné par Mira.', action: { requires: { chapter: 2 }, flags: { puzzleSolved: true }, effect: { route: 1, trust: 1, morale: 5 }, log: 'Les trois arches s’ouvrent dans un grondement. Derrière, Jay découvre le registre du convoi : Mira a conduit les familles jusqu’à la frontière.' } },
            { title: 'Soleil → étoile → source', detail: 'Tenter l’ordre indiqué par les traces du vent.', action: { requires: { chapter: 2 }, effect: { health: -8, stress: 10 }, retryable: true, log: 'La mauvaise arche libère une rafale de sable. Jay recule, blessé, mais peut encore essayer.' } },
            { title: 'Forcer la porte de pierre', detail: 'Une pièce de métal pourrait dégager le mécanisme.', action: { requires: { chapter: 2 }, cost: { materials: 1 }, effect: { health: -3, stress: 5 }, retryable: true, log: 'Le mécanisme résiste. Jay comprend qu’il faut lire les signes, pas forcer la pierre.' } }
          ]
        }
      ]
    },
    oasis: {
      name: 'Oasis des familles',
      description: 'À l’abri des dunes, Leïla soigne les voyageurs dans une ancienne station de pompage.',
      buildings: [
        {
          id: 'camp', name: 'Tente de Leïla', icon: '✚',
          text: 'Leïla relève les yeux de son registre. « Les enfants passeront avant les caisses. C’est ma seule règle. »',
          choices: [
            { title: 'Lui confier une trousse', detail: 'Soigne les blessés et gagne la confiance du camp.', action: { cost: { medicine: 1 }, flags: { leilaSaved: true }, effect: { trust: 1, morale: 12 }, log: 'Jay remet une trousse à Leïla. « Tu n’as pas choisi la route la plus simple », dit-elle. « C’est pour ça que je viens avec vous. »' } },
            { title: 'Écouter le message des familles', detail: 'Leïla connaît une réserve d’eau dans les gorges.', action: { effect: { clues: 1, morale: 5 }, log: 'Leïla raconte que le convoi a caché des vivres derrière la troisième arche. Les familles comptent sur Mira.' } }
          ]
        },
        {
          id: 'well', name: 'Station de pompage', icon: '◉',
          text: 'Le moteur tousse, mais la pompe peut encore remplir quelques gourdes.',
          choices: [
            { title: 'Réparer le filtre', detail: 'Une pièce permet de récupérer trois eaux.', action: { cost: { materials: 1 }, effect: { water: 3 }, log: 'Jay répare le filtre. L’eau froide ranime les voyageurs.' } },
            { title: 'Partager les réserves', detail: 'Une ration pour le camp, un peu de moral pour tous.', action: { effect: { food: 2, morale: 8 }, log: 'Leïla partage les haricots de la réserve avec les familles.' } }
          ]
        }
      ]
    },
    border: {
      name: 'Poste-frontière',
      description: 'La route qui permet à Jay de quitter le pays. Au-delà, le convoi attend un signal.',
      minChapter: 3,
      buildings: [
        {
          id: 'checkpoint', name: 'Barrière effondrée', icon: '⇢',
          text: 'Le vent se calme. Une lumière répond depuis l’autre côté du poste.',
          choices: []
        }
      ]
    }
  };

  const refugeReinforcement = zones.shelter.buildings
    .find(building => building.id === 'room')
    .choices.find(choice => choice.action.effect?.base > 0);

  const roadGraph = {
    shelter: { market: 1.6, clinic: 2.4 },
    market: { shelter: 1.6, depot: 2.2, village: 1.8 },
    clinic: { shelter: 2.4, radio: 2.5, village: 2.7 },
    depot: { market: 2.2, village: 1.5, canyon: 3.2 },
    village: { market: 1.8, clinic: 2.7, depot: 1.5, oasis: 2.1 },
    radio: { clinic: 2.5, canyon: 2.0 },
    canyon: { radio: 2.0, depot: 3.2, oasis: 2.4, border: 3.1 },
    oasis: { village: 2.1, canyon: 2.4, border: 1.9 },
    border: { canyon: 3.1, oasis: 1.9 }
  };
  const stormShelterZones = ['shelter', 'clinic', 'depot', 'village', 'oasis'];

  const inspectionCatalog = {
    'shelter:room': [
      { id: 'lamp', name: 'Examiner la lampe à huile', duration: 3, result: 'Le métal est encore tiède. Quelqu’un a quitté le refuge quelques minutes avant Jay.', item: 'brassToken' },
      { id: 'floor', name: 'Soulever la latte descellée', duration: 5, result: 'Sous le plancher, Jay découvre une bande de toile sèche.', item: 'cloth' }
    ],
    'shelter:office': [
      { id: 'notebook', name: 'Lire le carnet du cheminot', duration: 4, result: 'Les signes du carnet reviennent dans les notes du gardien.', document: 'railwayNote', clues: 1, item: 'brassToken', x: 42, y: 48 }
    ],
    'market:grocery': [
      { id: 'receipt', name: 'Lire le reçu abandonné', duration: 3, result: 'Le reçu mène à une réserve de filtres déplacée vers la station de pompage.', document: 'marketReceipt', clues: 1 }
    ],
    'market:workshop': [
      { id: 'coal', name: 'Trier le bac à pièces', duration: 6, result: 'Sous les boulons, Jay récupère du charbon filtrant encore propre.', item: 'charcoal' },
      { id: 'radio', name: 'Examiner le poste démonté', duration: 4, result: 'La batterie est compatible avec le relais 09.', item: 'radioBattery' }
    ],
    'clinic:ward': [
      { id: 'register', name: 'Consulter le registre de garde', duration: 4, result: 'Le registre indique un transfert vers l’oasis et une porte surveillée à l’ouest.', document: 'clinicRegister', clues: 1, item: 'cloth' }
    ],
    'depot:wagon': [
      { id: 'manifest', name: 'Déplier le manifeste caché', duration: 5, result: 'Les noms ont été effacés après le départ : quelqu’un a voulu faire croire à la disparition du convoi.', document: 'convoyManifest', clues: 1, item: 'convoyMap' }
    ],
    'village:house': [
      { id: 'photograph', name: 'Retourner la photographie', duration: 3, result: 'Mira et Leïla étaient ensemble avant la fuite. Au dos, trois ombres sont dessinées.', document: 'familyPhotograph', clues: 1, item: 'oldPhoto' }
    ],
    'radio:antenna': [
      { id: 'battery-slot', name: 'Examiner le compartiment d’alimentation', duration: 2, result: 'Une batterie de secours manque au relais.', item: 'radioBattery' }
    ],
    'canyon:arches': [
      { id: 'scratches', name: 'Comparer les traces sur la pierre', duration: 4, result: 'Les marques les plus fraîches vont de l’étoile à la source, puis au soleil.', clues: 1 }
    ],
    'oasis:well': [
      { id: 'pump', name: 'Écouter le moteur de la pompe', duration: 3, result: 'La pompe tourne encore, mais le filtre est bouché par le sable.' }
    ]
  };

  const sitePlanLayouts = {
    'shelter:room': ['DORTOIR', 'ESPACE COMMUN', 'RÉSERVE'],
    'shelter:office': ['BUREAU', 'ARCHIVES', 'ENTRÉE'],
    'market:grocery': ['ÉTALS', 'RÉSERVE', 'COMPTOIR'],
    'market:workshop': ['ÉTABLI', 'PIÈCES', 'POSTE RADIO'],
    'clinic:ward': ['SOINS', 'ARMOIRE', 'COULOIR'],
    'clinic:garage': ['GARAGE', 'ATELIER', 'SORTIE SERVICE'],
    'depot:wagon': ['FOURGON', 'RÉSERVE', 'VOIE FERRÉE'],
    'depot:signal': ['POSTE', 'COMMANDES', 'QUAI'],
    'village:house': ['SÉJOUR', 'CUISINE', 'CHAMBRE'],
    'village:cistern': ['CITERNE', 'FILTRE', 'PUITS'],
    'radio:antenna': ['CABINE', 'PASSERELLE', 'ANTENNE'],
    'canyon:arches': ['ARCHE A', 'PASSAGE', 'ARCHE C'],
    'oasis:camp': ['TENTE SOINS', 'CAMP', 'RÉSERVES'],
    'oasis:well': ['POMPE', 'FILTRE', 'CUVE'],
    'border:checkpoint': ['BARRIÈRE', 'POSTE', 'SORTIE']
  };

  const explorationScenes = {
    'shelter:room': {
      art: 'dormitory',
      atmosphere: 'Un souffle passe sous la porte. La poussière garde des traces plus récentes que celles de Jay.',
      targets: [
        { id: 'bedframe', name: 'Sous le lit', x: 27, y: 70, duration: 2, result: 'Une empreinte de botte est imprimée dans le sable sous le cadre. Elle est trop nette pour dater de la tempête.' },
        { id: 'nightstand', name: 'Tiroir de chevet', x: 66, y: 61, duration: 2, result: 'Le tiroir coince. Jay le tire doucement et découvre une photographie sans légende.', reveals: ['nightstand-photo'] },
        { id: 'nightstand-photo', name: 'Photographie pliée', x: 66, y: 61, duration: 2, kind: 'photo', requires: 'nightstand', result: 'Une famille se tient devant un wagon, les visages tournés vers le soleil couchant.', back: 'Au dos, quelqu’un a écrit « demain, voie basse ». L’encre a bavé sous une goutte d’eau.' },
        { id: 'wardrobe', name: 'Armoire renversée', x: 84, y: 38, duration: 1, result: 'Les vêtements ont été fouillés à la hâte. Une manche porte une poussière rouge, différente du sable du refuge.' }
      ]
    },
    'shelter:office': {
      art: 'office',
      atmosphere: 'Le carnet du gardien est resté ouvert, mais les papiers autour ont été déplacés.',
      targets: [
        { id: 'desk-drawer', name: 'Tiroir du bureau', x: 59, y: 58, duration: 2, result: 'Le tiroir est vide, à l’exception d’une marque rectangulaire dans la poussière.', reveals: ['desk-compartment'] },
        { id: 'desk-compartment', name: 'Faux fond', x: 59, y: 58, duration: 3, kind: 'document', requires: 'desk-drawer', result: 'Jay pousse le panneau du fond. Une note de service est cachée derrière le bois : le signal 09 a été volontairement laissé sous tension.' },
        { id: 'wall-map', name: 'Carte punaisée', x: 78, y: 31, duration: 2, kind: 'document', result: 'Trois annotations encerclent le vieux puits. Une quatrième, grattée au couteau, pointait vers les gorges.' },
        { id: 'cup', name: 'Tasse ébréchée', x: 34, y: 57, duration: 1, result: 'Le fond est couvert d’une fine pellicule de sable. La tasse a été reposée après la dernière rafale.' }
      ]
    },
    'market:grocery': {
      art: 'market',
      atmosphere: 'Une enseigne claque dehors. Les rayons sont vides, sauf là où la poussière a été récemment remuée.',
      targets: [
        { id: 'shelves', name: 'Rayonnage effondré', x: 27, y: 45, duration: 2, result: 'Des boîtes ont été retirées proprement. Quelqu’un connaissait exactement ce qu’il cherchait.' },
        { id: 'counter-box', name: 'Caisse sous le comptoir', x: 69, y: 63, duration: 2, result: 'La caisse a été forcée de l’intérieur. Une pièce de monnaie est restée coincée dans la charnière.' },
        { id: 'backdoor', name: 'Porte de réserve', x: 88, y: 39, duration: 3, result: 'Des traces de craie indiquent les livraisons déplacées vers la station de pompage.' }
      ]
    },
    'market:workshop': {
      art: 'workshop',
      atmosphere: 'Le métal refroidit en grinçant. Une radio démontée repose sur l’établi, à côté d’outils nettoyés.',
      targets: [
        { id: 'tool-rack', name: 'Panneau d’outils', x: 23, y: 41, duration: 2, result: 'Les emplacements vides ont la forme de pinces et d’une clé plate. Les outils ont été emportés, pas perdus.' },
        { id: 'workbench', name: 'Dessous de l’établi', x: 53, y: 65, duration: 2, result: 'Un schéma de filtre à eau est griffonné sur une chute de métal. Le charbon et la toile y sont indiqués.' },
        { id: 'parts-crate', name: 'Caisse de pièces', x: 80, y: 70, duration: 3, result: 'La caisse contient des boîtiers vides. Sur le couvercle, un symbole de fréquence 09 a été gravé.' }
      ]
    },
    'clinic:ward': {
      art: 'clinic',
      atmosphere: 'Le rideau de séparation bouge sans courant d’air. Le registre de garde est encore ouvert.',
      targets: [
        { id: 'curtain', name: 'Derrière le rideau', x: 27, y: 43, duration: 2, result: 'Une deuxième couche de poussière dessine l’empreinte d’un lit déplacé vers la sortie ouest.' },
        { id: 'medicine-cabinet', name: 'Armoire à pharmacie', x: 73, y: 43, duration: 3, result: 'Les étiquettes ont été arrachées, mais une liste de transferts est coincée sous une étagère.' },
        { id: 'bedside', name: 'Table de soins', x: 47, y: 63, duration: 2, result: 'Un bracelet d’hôpital porte le numéro 09. Le nom a été effacé au crayon.' }
      ]
    },
    'clinic:garage': {
      art: 'workshop',
      atmosphere: 'La porte de service est entrouverte. Des outils ont été laissés en place, comme si le départ avait été brusque.',
      targets: [
        { id: 'toolbox', name: 'Boîte à outils', x: 30, y: 66, duration: 2, result: 'Une clé plate manque. La poussière autour de son emplacement est encore fraîche.' },
        { id: 'vehicle-seat', name: 'Siège du véhicule', x: 58, y: 52, duration: 2, result: 'Sous le siège, Jay trouve des fibres de toile identiques à celles du camp de l’oasis.' },
        { id: 'service-door', name: 'Porte arrière', x: 85, y: 39, duration: 1, result: 'Des marques sur le chambranle montrent qu’on l’a refermée depuis l’extérieur.' }
      ]
    },
    'depot:wagon': {
      art: 'wagon',
      atmosphere: 'Le wagon oscille à peine. Une chaîne frotte contre le métal à chaque rafale.',
      targets: [
        { id: 'luggage-rack', name: 'Porte-bagages', x: 24, y: 37, duration: 2, result: 'Une étiquette de bagage porte deux initiales : M. et L. Le sac a été emporté.' },
        { id: 'cargo-straps', name: 'Sangles de fret', x: 51, y: 62, duration: 2, result: 'Les sangles ont été coupées après le départ du convoi, pas pendant son chargement.' },
        { id: 'crate-seal', name: 'Scellé de la caisse', x: 80, y: 67, duration: 3, kind: 'document', result: 'Le numéro du scellé correspond à une livraison destinée à l’oasis.' }
      ]
    },
    'depot:signal': {
      art: 'office',
      atmosphere: 'Le poste de signalisation clignote encore. Le panneau ne devrait plus recevoir de courant.',
      targets: [
        { id: 'switchboard', name: 'Tableau de commande', x: 54, y: 44, duration: 2, result: 'Un circuit a été dérivé vers la fréquence 09. Le raccord est récent.' },
        { id: 'signal-log', name: 'Registre des passages', x: 30, y: 63, duration: 3, kind: 'document', result: 'Les départs de la voie basse ont été barrés à l’encre, puis réécrits dans une autre colonne.' },
        { id: 'signal-window', name: 'Fenêtre du poste', x: 82, y: 34, duration: 1, result: 'Depuis la vitre fendue, Jay distingue les traces d’un wagon qui s’éloignent vers le sud.' }
      ]
    },
    'village:house': {
      art: 'house',
      atmosphere: 'Une lampe reste allumée dans la maison. La poussière s’est déposée partout sauf sur la table.',
      targets: [
        { id: 'dining-table', name: 'Sous la table', x: 48, y: 65, duration: 2, result: 'Une marque de tasse et deux chaises déplacées suggèrent un repas interrompu.' },
        { id: 'wardrobe', name: 'Fond de l’armoire', x: 79, y: 42, duration: 2, result: 'Une étagère cache un petit trait de craie : trois arcs, dessinés l’un après l’autre.', reveals: ['wardrobe-note'] },
        { id: 'wardrobe-note', name: 'Note derrière l’étagère', x: 79, y: 42, duration: 2, kind: 'document', requires: 'wardrobe', result: '« Si nous sommes séparés, retrouve-nous là où la pierre fait trois ombres. »' }
      ]
    },
    'village:cistern': {
      art: 'pump',
      atmosphere: 'L’eau a presque disparu. Une goutte tombe encore quelque part dans la citerne.',
      targets: [
        { id: 'cistern-rim', name: 'Bord de la citerne', x: 27, y: 55, duration: 2, result: 'Les entailles du bord montrent trois niveaux d’eau. Le dernier est daté d’hier.' },
        { id: 'filter-housing', name: 'Logement du filtre', x: 56, y: 47, duration: 2, result: 'Le filtre est couvert de sable rouge; cette poussière vient des gorges.' },
        { id: 'well-chain', name: 'Chaîne du puits', x: 81, y: 62, duration: 1, result: 'La chaîne est tendue vers le sud, comme si quelqu’un avait fixé une charge en dessous.' }
      ]
    },
    'radio:antenna': {
      art: 'relay',
      atmosphere: 'Le relais grésille à travers le vent. La fréquence 09 répond à chaque impulsion.',
      targets: [
        { id: 'relay-console', name: 'Console de fréquence', x: 40, y: 62, duration: 2, result: 'Le cadran a été réglé à la main. Une marque au crayon indique l’heure du prochain appel.' },
        { id: 'tower-cables', name: 'Câbles de l’antenne', x: 76, y: 34, duration: 2, result: 'Un câble a été réparé avec un fil de cuivre récupéré au dépôt.' },
        { id: 'relay-log', name: 'Carnet des appels', x: 55, y: 71, duration: 3, kind: 'document', result: 'Plusieurs appels ont été notés après le passage de la tempête. Le dernier est signé « M ».' }
      ]
    },
    'canyon:arches': {
      art: 'canyon',
      atmosphere: 'Le vent s’engouffre dans les arches. Une vibration grave remonte de la pierre.',
      targets: [
        { id: 'arch-inscription', name: 'Inscription basse', x: 22, y: 50, duration: 2, result: 'Sous la poussière, une phrase apparaît : « La nuit ouvre la route. »' },
        { id: 'loose-stone', name: 'Pierre descellée', x: 54, y: 67, duration: 3, result: 'Derrière la pierre, Jay trouve des fibres de sac et une marque de roue fraîche.' },
        { id: 'arch-marks', name: 'Traces au sommet', x: 82, y: 39, duration: 2, result: 'Les marques forment une étoile, une source et un soleil. Une main les a polies dans cet ordre.' }
      ]
    },
    'oasis:camp': {
      art: 'clinic',
      atmosphere: 'Des voix basses viennent de l’autre côté des couvertures. Leïla continue d’écrire.',
      targets: [
        { id: 'medical-bag', name: 'Sac de soins', x: 72, y: 43, duration: 2, result: 'Le sac est prêt pour le départ. Une place a été réservée pour les médicaments des enfants.' },
        { id: 'family-bundles', name: 'Paquets des familles', x: 28, y: 69, duration: 2, result: 'Chaque paquet porte un nom et une destination. Aucun n’est marqué comme abandonné.' },
        { id: 'camp-ledger', name: 'Registre de Leïla', x: 53, y: 59, duration: 3, kind: 'document', result: 'La dernière ligne du registre dit : « Nous partirons ensemble, même si la route est plus longue. »' }
      ]
    },
    'oasis:well': {
      art: 'pump',
      atmosphere: 'Le moteur tousse derrière le mur. La conduite transmet une vibration régulière.',
      targets: [
        { id: 'pump-valve', name: 'Vanne principale', x: 41, y: 48, duration: 2, result: 'La vanne est bloquée par du sable, mais le mécanisme n’est pas cassé.' },
        { id: 'reservoir-gauge', name: 'Jauge de la cuve', x: 73, y: 39, duration: 2, result: 'La cuve contient assez d’eau pour le convoi si la pompe tient encore une nuit.' },
        { id: 'pipe-joint', name: 'Raccord de conduite', x: 56, y: 69, duration: 2, result: 'Un joint de fortune fuit lentement. La réparation demandera une pièce de métal.' }
      ]
    },
    'border:checkpoint': {
      art: 'checkpoint',
      atmosphere: 'La barrière est silencieuse. Une lumière traverse le poste, puis s’éteint.',
      targets: [
        { id: 'guard-desk', name: 'Bureau du poste', x: 52, y: 59, duration: 2, result: 'Les horaires affichés ont été remplacés. Sous la feuille, Jay retrouve l’ancien planning de relève.' },
        { id: 'barrier-mechanism', name: 'Mécanisme de la barrière', x: 78, y: 52, duration: 3, result: 'Le verrou peut être ouvert sans bruit, mais le levier est bloqué par une tige tordue.' },
        { id: 'checkpoint-window', name: 'Vitre du poste', x: 25, y: 37, duration: 1, result: 'Dans le reflet, une lumière répond depuis l’autre côté de la frontière.' }
      ]
    }
  };

  const encounters = [
    {
      title: 'La voix dans la poussière',
      description: 'Un vieux poste portatif capte un appel faible. Quelqu’un demande si la route est encore ouverte.',
      choices: [
        { title: 'Répondre et transmettre la piste', detail: 'Le signal peut aider une autre famille.', action: { effect: { clues: 1, trust: 1, stress: 4 }, log: 'Jay transmet les coordonnées. Une voix répond : « Nous vous attendrons à l’oasis. »' } },
        { title: 'Économiser la batterie', detail: 'Le silence protège la route de Mira.', action: { effect: { morale: 3, stress: -4 }, log: 'Jay coupe la radio. Le silence lui pèse, mais la batterie est préservée.' } }
      ]
    },
    {
      title: 'La rafale noire',
      description: 'Un mur de sable ferme le passage. Jay a quelques secondes pour choisir comment protéger le sac.',
      choices: [
        { title: 'Protéger les gourdes', detail: 'Sacrifie une pièce pour garder l’eau intacte.', action: { cost: { materials: 1 }, effect: { water: 1 }, log: 'Jay cale les gourdes dans une caisse et attend que la rafale passe.' } },
        { title: 'Se mettre à couvert', detail: 'Jay évite le pire, mais la rafale l’épuise.', action: { effect: { health: -4, stress: -8 }, log: 'Jay se plaque contre la roche. Le sable lui entaille les mains, mais le sac tient.' } }
      ]
    },
    {
      title: 'La lanterne de Leïla',
      description: 'Une lumière vacille loin derrière. Leïla n’a pas encore rejoint le passage.',
      choices: [
        { title: 'L’attendre quelques minutes', detail: 'Renforce le lien avec le camp, au prix d’un peu de temps.', action: { effect: { trust: 1, stress: 5 }, log: 'Jay attend la lanterne. Leïla arrive avec deux voyageurs et une carte annotée.' } },
        { title: 'Laisser un signe sur la roche', detail: 'La piste restera visible pour le groupe.', action: { effect: { route: 1, morale: 2 }, log: 'Jay grave une flèche dans la roche. La prochaine personne ne sera pas seule.' } }
      ]
    }
  ];

  function clamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, value));
  }

  function activeSaveKey() {
    return SAVE_SLOT_KEYS[selectedSlot - 1];
  }

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function hasSavedGame(slot = selectedSlot) {
    return getSaveSlotInfo(slot).valid;
  }

  function getSaveSlotInfo(slot) {
    try {
      let raw = localStorage.getItem(SAVE_SLOT_KEYS[slot - 1]);
      if (!raw && slot === 1) raw = localStorage.getItem(PREVIOUS_SAVE_KEY) || localStorage.getItem(LEGACY_SAVE_KEY);
      if (!raw) return { available: false, valid: false, summary: 'Aucune sauvegarde' };
      const saved = JSON.parse(raw);
      if (!isRecord(saved) || !['scavenge', 'story', 'ending', 'game'].includes(saved.phase)
        || (Number.isInteger(saved.saveVersion) && saved.saveVersion > SAVE_SCHEMA_VERSION)) {
        return { available: true, valid: false, summary: 'Données de sauvegarde illisibles' };
      }
      const chapter = saved.phase === 'scavenge' ? 'PROLOGUE' : `CHAPITRE ${String(saved.chapter || 1).padStart(2, '0')}`;
      const clock = Number.isFinite(saved.clockMinutes) ? formatClock(saved.clockMinutes) : '14:30';
      return { available: true, valid: true, summary: `${chapter} · JOUR ${String(saved.day || 1).padStart(2, '0')} · ${clock}` };
    } catch (error) {
      console.warn(`La sauvegarde de l’emplacement 0${slot} est inaccessible.`, error);
      return { available: true, valid: false, summary: 'Sauvegarde inaccessible' };
    }
  }

  function updateContinueButton() {
    $('continue-game').classList.toggle('hidden', !hasSavedGame());
    $('load-game').disabled = !SAVE_SLOT_KEYS.some((_, index) => {
      const info = getSaveSlotInfo(index + 1);
      return info.available && info.valid;
    });
  }

  function safeSave() {
    try {
      localStorage.setItem(activeSaveKey(), JSON.stringify({ ...state, saveVersion: SAVE_SCHEMA_VERSION }));
      if (selectedSlot === 1) {
        localStorage.removeItem(PREVIOUS_SAVE_KEY);
        localStorage.removeItem(LEGACY_SAVE_KEY);
      }
      $('save-status').textContent = `SAUVEGARDE 0${selectedSlot} · ENREGISTRÉE`;
      window.setTimeout(() => {
        if ($('save-status')) $('save-status').textContent = 'SAUVEGARDE ACTIVE';
      }, 1200);
    } catch (error) {
      $('save-status').textContent = 'SAUVEGARDE INDISPONIBLE';
      console.error('La progression n’a pas pu être sauvegardée.', error);
    }
  }

  function loadSave() {
    try {
      const currentKey = activeSaveKey();
      let raw = localStorage.getItem(currentKey);
      let sourceKey = currentKey;
      if (!raw && selectedSlot === 1) {
        raw = localStorage.getItem(PREVIOUS_SAVE_KEY);
        if (raw) sourceKey = PREVIOUS_SAVE_KEY;
        else {
          raw = localStorage.getItem(LEGACY_SAVE_KEY);
          if (raw) sourceKey = LEGACY_SAVE_KEY;
        }
      }
      const saved = JSON.parse(raw || 'null');
      if (!isRecord(saved) || !['scavenge', 'story', 'ending', 'game'].includes(saved.phase)
        || (Number.isInteger(saved.saveVersion) && saved.saveVersion > SAVE_SCHEMA_VERSION)) return false;
      const phase = saved.phase === 'game' ? 'scavenge' : saved.phase;
      const imported = sourceKey !== currentKey;
      const legacyStory = sourceKey === LEGACY_SAVE_KEY && phase === 'story';
      const defaults = createInitialState();
      const savedZone = zones[saved.selectedZone] ? saved.selectedZone : null;
      const savedResources = isRecord(saved.resources) ? saved.resources : {};
      const savedInventory = isRecord(saved.inventory) ? saved.inventory : {};
      const savedFlags = isRecord(saved.flags) ? saved.flags : {};
      const savedSite = zones[savedZone]?.buildings.some(building => building.id === saved.currentSite)
        ? saved.currentSite
        : null;
      const safeArray = value => Array.isArray(value) ? value.filter(item => typeof item === 'string') : [];
      const safeNumber = (value, fallback, min, max) => Number.isFinite(value)
        ? Math.floor(clamp(value, min, max))
        : fallback;
      const inventory = { waterskin: 1, fieldTools: 1 };
      for (const [id, amount] of Object.entries(savedInventory)) {
        if (itemCatalog[id] && Number.isFinite(amount) && amount >= 0) inventory[id] = Math.floor(clamp(amount, 0, 99));
      }
      const resources = {};
      for (const key of Object.keys(resourceNames)) {
        resources[key] = safeNumber(savedResources[key], defaults.resources[key], 0, 99);
      }
      const flags = Object.fromEntries(Object.entries(savedFlags)
        .filter(([, value]) => typeof value === 'boolean' || Number.isFinite(value)));
      const activeEncounter = encounters.find(encounter => encounter.title === saved.activeEncounter?.title) || null;
      const pendingScene = isRecord(saved.pendingScene)
        && typeof saved.pendingScene.kicker === 'string'
        && typeof saved.pendingScene.title === 'string'
        && typeof saved.pendingScene.description === 'string'
        ? {
          kicker: saved.pendingScene.kicker,
          title: saved.pendingScene.title,
          description: saved.pendingScene.description,
          important: !!saved.pendingScene.important
        }
        : null;
      Object.assign(state, defaults, saved, {
        phase,
        chapter: legacyStory ? 2 : safeNumber(saved.chapter, 1, 1, 3),
        day: safeNumber(saved.day, 1, 1, 9999),
        clockMinutes: safeNumber(saved.clockMinutes, START_CLOCK, 0, 1439),
        elapsedMinutes: safeNumber(saved.elapsedMinutes, 0, 0, 1000000000),
        position: zones[saved.position] ? saved.position : 'shelter',
        selectedZone: savedZone,
        currentSite: savedSite,
        discovered: Array.from(new Set([
          ...(safeArray(saved.discovered).length ? safeArray(saved.discovered) : defaults.discovered),
          saved.position
        ].filter(id => zones[id]))),
        inspected: safeArray(saved.inspected),
        exploredDetails: safeArray(saved.exploredDetails),
        inventory,
        documents: safeArray(saved.documents).filter(id => documentCatalog[id]),
        readDocuments: safeArray(saved.readDocuments).filter(id => documentCatalog[id]),
        linkedEvidence: safeArray(saved.linkedEvidence).filter(id => ['vanished-convoy', 'allies', 'hidden-supplies'].includes(id)),
        resources,
        health: safeNumber(saved.health, 100, 0, 100),
        morale: safeNumber(saved.morale, 70, 0, 100),
        base: safeNumber(saved.base, 60, 0, 100),
        route: safeNumber(saved.route, 0, 0, 99),
        stress: safeNumber(saved.stress, 20, 0, 100),
        clues: legacyStory ? 2 : safeNumber(saved.clues, 0, 0, 99),
        trust: safeNumber(saved.trust, 0, 0, 5),
        flags: { ...(legacyStory ? { miraContact: true } : {}), ...flags },
        searched: safeArray(saved.searched),
        visited: legacyStory ? safeArray(saved.visited).filter(site => site !== 'border:checkpoint') : safeArray(saved.visited),
        journal: safeArray(saved.journal).slice(0, 250),
        achievements: safeArray(saved.achievements).filter(id => Object.prototype.hasOwnProperty.call(achievementNames, id)),
        encounterDays: Array.isArray(saved.encounterDays)
          ? saved.encounterDays.filter(day => Number.isInteger(day) && day > 0 && day <= 9999)
          : [],
        randomSeed: safeNumber(saved.randomSeed, 0, 0, 0xffffffff) >>> 0,
        activeEncounter,
        pendingScene,
        ending: ['escape-alone', 'escape-together', 'escape-caravan', 'lost'].includes(saved.ending) ? saved.ending : null,
        toastTimer: null
      });
      delete state.timer;
      delete state.saveVersion;
      if (legacyStory) Object.assign(state.flags, { miraContact: true });
      if (state.phase === 'story' && state.flags.stormPassed) {
        state.flags.distressSignalAvailable = state.flags.distressSignalAvailable !== false;
        if (typeof state.flags.stormShelterSecured !== 'boolean') {
          state.flags.stormShelterSecured = isStormShelter(state.position);
        }
        if (typeof state.flags.stormOngoing !== 'boolean') {
          state.flags.stormOngoing = state.day === 1 && state.clockMinutes >= STORM_DEADLINE && state.clockMinutes < 19 * 60;
        }
        if (state.day > 1 || state.clockMinutes >= 19 * 60) state.flags.stormOngoing = false;
      }
      if (imported) safeSave();
      return true;
    } catch (error) {
      console.error('La sauvegarde de Jay est illisible.', error);
      return false;
    }
  }

  function toast(message, kind = '') {
    const element = $('toast');
    element.textContent = message;
    element.className = `toast visible ${kind}`.trim();
    window.clearTimeout(state.toastTimer);
    state.toastTimer = window.setTimeout(() => element.classList.remove('visible', 'achievement'), 2600);
  }

  function showScreen(screen) {
    for (const id of ['welcome-screen', 'game-screen', 'ending-screen']) {
      $(id).classList.toggle('hidden', id !== `${screen}-screen`);
    }
    const active = $(`${screen}-screen`);
    active.classList.remove('screen-enter');
    void active.offsetWidth;
    active.classList.add('screen-enter');
    document.body.classList.toggle('menu-active', screen === 'welcome');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    syncStormAnimation();
  }

  function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[character]);
  }

  function formatClock(minutes = state.clockMinutes) {
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  }

  function getWeatherProfile() {
    let stage = 'calm';
    let intensity = 0.06;
    const minute = state.clockMinutes;
    if (state.phase === 'welcome' || state.phase === 'ending') {
      return { stage, intensity: 0, wind: 0.12, visibility: 1 };
    }

    if (state.phase === 'scavenge') {
      if (minute >= 16 * 60 + 30) {
        stage = minute >= STORM_DEADLINE ? 'storm' : 'emergency';
        intensity = 0.55 + 0.45 * clamp((minute - (16 * 60 + 30)) / 30, 0, 1);
      } else if (minute >= 15 * 60 + 30) {
        stage = 'building';
        intensity = 0.08 + 0.47 * ((minute - (15 * 60 + 30)) / 60);
      }
    } else if (state.flags.stormOngoing) {
      const stormProgress = clamp((minute - STORM_DEADLINE) / (2 * 60), 0, 1);
      intensity = 1 - stormProgress * 0.62;
      stage = intensity > 0.76 ? 'storm' : intensity > 0.48 ? 'emergency' : 'aftermath';
    } else if (state.flags.stormPassed) {
      stage = 'aftermath';
      intensity = 0.08;
    }

    return {
      stage,
      intensity,
      wind: 0.12 + intensity * 0.88,
      visibility: Math.round((1 - intensity * 0.82) * 100) / 100
    };
  }

  function isStormShelter(zoneId) {
    return stormShelterZones.includes(zoneId);
  }

  function secureStormShelter(zoneId) {
    if (!state.flags.stormOngoing || !isStormShelter(zoneId) || state.flags.stormShelterSecured) return;
    state.flags.stormShelterSecured = true;
    addLog(`Jay atteint ${zones[zoneId].name}. Les murs tiennent sous les rafales; il peut reprendre son souffle.`);
  }

  function resolveStormTravel(from, destination, km, weather, stormWasActive) {
    if (!stormWasActive) return true;
    if (isStormShelter(destination)) {
      secureStormShelter(destination);
      return true;
    }
    if (weather.intensity < 0.48 || isStormShelter(from)) return true;
    const difficultyMultiplier = difficulty === 'story' ? 0.55 : difficulty === 'survival' ? 1.5 : 1;
    const distanceFactor = clamp(km / 2, 0.5, 1.5);
    const damage = Math.ceil(weather.intensity * 5 * distanceFactor * difficultyMultiplier);
    state.health = clamp(state.health - damage);
    state.stress = clamp(state.stress + Math.ceil(weather.intensity * 8));
    addLog(`Une rafale déporte Jay sur la piste. Il perd ${damage} points de vitalité et la pression monte.`);
    return !checkEndingConditions();
  }

  function updateClockDisplay() {
    const date = new Date(GAME_START_DATE + (state.day - 1) * 86400000);
    const month = new Intl.DateTimeFormat('fr-FR', { month: 'long', timeZone: 'UTC' }).format(date).toLocaleUpperCase('fr-FR');
    const dayOfMonth = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', timeZone: 'UTC' }).format(date);
    const clock = formatClock();
    $('timer').textContent = clock;
    $('header-clock').textContent = clock;
    $('game-date').textContent = `JOUR ${String(state.day).padStart(2, '0')} · ${dayOfMonth} ${month}`;
    $('elapsed-time').textContent = `ÉCOULÉ · ${state.elapsedMinutes} MIN`;
    const weather = getWeatherProfile();
    if (state.phase === 'scavenge' && state.clockMinutes < STORM_DEADLINE) {
      const remaining = STORM_DEADLINE - state.clockMinutes;
      $('storm-deadline').textContent = `${weather.stage === 'calm' ? 'TEMPÊTE' : 'ALERTE'} · ${Math.floor(remaining / 60)} H ${String(remaining % 60).padStart(2, '0')} MIN`;
      $('status-text').textContent = weather.stage === 'calm'
        ? 'AVANT LA TEMPÊTE'
        : weather.stage === 'building' ? 'LE VENT SE LÈVE' : 'URGENCE · TROUVE UN ABRI';
    } else if (weather.intensity > 0.2) {
      $('storm-deadline').textContent = `VISIBILITÉ · ${Math.round(weather.visibility * 100)} %`;
      $('status-text').textContent = 'TEMPÊTE EN COURS';
    } else {
      $('storm-deadline').textContent = state.clockMinutes >= 19 * 60 || state.clockMinutes < 6 * 60
        ? 'NUIT · VISIBILITÉ FAIBLE'
        : state.flags.stormPassed ? 'APRÈS-TEMPÊTE' : 'JOUR · VISIBILITÉ NORMALE';
      $('status-text').textContent = state.flags.stormPassed ? 'APRÈS LA TEMPÊTE' : 'JAY CHERCHE UNE ISSUE';
    }
  }

  function addItem(itemId) {
    if (!itemCatalog[itemId]) return;
    const currentWeight = inventoryWeight();
    if (currentWeight + itemCatalog[itemId].weight > 8) {
      toast('Le sac est plein. Libère de la place avant de ramasser cet objet.');
      return false;
    }
    state.inventory[itemId] = (state.inventory[itemId] || 0) + 1;
    renderInventoryCount();
    addLog(`Objet récupéré : ${itemCatalog[itemId].name}.`);
    return true;
  }

  function inventoryWeight() {
    return Object.entries(state.inventory).reduce((total, [id, quantity]) => (
      total + (itemCatalog[id]?.weight || 0) * quantity
    ), 0);
  }

  function addDocument(documentId) {
    if (!documentCatalog[documentId] || state.documents.includes(documentId)) return;
    state.documents.push(documentId);
    addLog(`Document ajouté au journal : ${documentCatalog[documentId].title}.`);
  }

  function discoverLocations() {
    const available = new Set(state.discovered);
    if (state.phase === 'story' || state.phase === 'ending' || state.clues > 0
      || state.flags.distressSignalAvailable) available.add('radio');
    if (state.chapter >= 2) {
      available.add('canyon');
      available.add('oasis');
    }
    if (state.chapter >= 3) available.add('border');
    for (const id of available) {
      if (!state.discovered.includes(id)) {
        state.discovered.push(id);
        addLog(`Nouvelle zone cartographiée : ${zones[id].name}.`);
      }
    }
  }

  function findRoute(from, to) {
    if (from === to) return { km: 0, route: [from] };
    const distances = Object.fromEntries(Object.keys(roadGraph).map(id => [id, Infinity]));
    const previous = {};
    const remaining = new Set(Object.keys(roadGraph));
    distances[from] = 0;
    while (remaining.size) {
      let nearest = null;
      for (const id of remaining) {
        if (nearest === null || distances[id] < distances[nearest]) nearest = id;
      }
      if (nearest === null || !Number.isFinite(distances[nearest])) break;
      remaining.delete(nearest);
      if (nearest === to) break;
      for (const [next, distance] of Object.entries(roadGraph[nearest] || {})) {
        const candidate = distances[nearest] + distance;
        if (candidate < distances[next]) {
          distances[next] = candidate;
          previous[next] = nearest;
        }
      }
    }
    if (!Number.isFinite(distances[to])) return null;
    const route = [to];
    while (route[0] !== from) route.unshift(previous[route[0]]);
    return { km: distances[to], route };
  }

  function travelDuration(route, km) {
    const daylight = state.clockMinutes >= 6 * 60 && state.clockMinutes < 19 * 60;
    const junctionDelay = Math.max(0, route.length - 2) * 3;
    const weather = getWeatherProfile();
    const stormFactor = 1 + weather.intensity * 2;
    const difficultyFactor = difficulty === 'story' ? 0.9 : difficulty === 'survival' ? 1.15 : 1;
    return Math.max(5, Math.ceil((km * (daylight ? 12 : 16) + junctionDelay) * stormFactor * difficultyFactor));
  }

  function advanceActionTime(duration) {
    const requested = Math.max(0, Math.ceil(Number(duration) || 0));
    if (!requested) return { elapsed: 0, completed: true, storm: false };
    const available = state.phase === 'scavenge' ? Math.max(0, STORM_DEADLINE - state.clockMinutes) : requested;
    const elapsed = Math.min(requested, available);
    let remaining = elapsed;
    state.elapsedMinutes += elapsed;

    while (remaining > 0) {
      const start = state.clockMinutes;
      const step = Math.min(remaining, 1440 - start);
      const end = start + step;
      for (const [threshold, message] of [
        [15 * 60 + 30, 'À 15 h 30, le vent se lève. Les volets claquent et la radio commence à grésiller.'],
        [16 * 60 + 30, 'À 16 h 30, le relais signale une muraille de sable. Les communications deviennent instables : il faut rejoindre un abri.']
      ]) {
        if (state.phase === 'scavenge' && start < threshold && end >= threshold) {
          state.clockMinutes = threshold;
          if (threshold === 16 * 60 + 30) state.flags.distressSignalAvailable = true;
          addLog(message);
        }
      }
      if (start < 19 * 60 && end >= 19 * 60) {
        state.clockMinutes = 19 * 60;
        if (state.flags.stormOngoing) {
          state.flags.stormOngoing = false;
          addLog('Les rafales retombent après deux heures. La poussière reste dans l’air, mais les chemins réapparaissent.');
        }
        state.stress = clamp(state.stress + 4);
        addLog('La nuit tombe. Les déplacements deviennent plus lents et la tempête masque les repères.');
      }
      if (start < 6 * 60 && end >= 6 * 60) {
        state.clockMinutes = 6 * 60;
        state.stress = clamp(state.stress - 3);
        addLog('Le jour se lève. Les reliefs redeviennent visibles.');
      }
      state.clockMinutes = end;
      remaining -= step;
      if (state.clockMinutes >= 1440) {
        state.clockMinutes = 0;
        state.day += 1;
        const shelterRelief = state.position === 'shelter' ? Math.round(state.base / 30) : 0;
        state.stress = clamp(state.stress + 5 - shelterRelief);
        if (shelterRelief) addLog('Le refuge tient pendant la nuit. Jay reprend un peu de calme.');
        if (state.resources.water > 0) state.resources.water -= 1;
        else {
          state.health = clamp(state.health - 10);
          state.stress = clamp(state.stress + 8);
          addLog('Jay manque d’eau. La chaleur devient dangereuse.');
        }
        if (state.resources.food > 0) state.resources.food -= 1;
        else {
          state.morale = clamp(state.morale - 7);
          addLog('La faim fragilise le groupe. Il faudra trouver des vivres.');
        }
        state.health = clamp(state.health - 1);
        addLog(`Une nouvelle journée commence. Réserves : ${state.resources.water} eau, ${state.resources.food} ration(s).`);
      }
    }

    const storm = state.phase === 'scavenge' && state.clockMinutes >= STORM_DEADLINE;
    updateClockDisplay();
    renderSidebar();
    updateStorm();
    if (checkEndingConditions()) return { elapsed, completed: elapsed === requested, storm: false, ended: true };
    return { elapsed, completed: elapsed === requested, storm };
  }

  function addLog(message) {
    state.journal.unshift(`[J${String(state.day).padStart(2, '0')} ${formatClock()}] ${message}`);
    state.journal = state.journal.slice(0, 250);
    renderJournal();
  }

  function renderJournal() {
    $('journal-list').innerHTML = state.journal.length
      ? state.journal.slice(0, 7).map(line => `<p>› ${escapeHtml(line)}</p>`).join('')
      : '<p>La tempête approche. Jay attend tes instructions.</p>';
  }

  function renderInventoryCount() {
    const count = Object.values(state.inventory).reduce((total, amount) => total + amount, 0);
    $('inventory-count').textContent = `${count} OBJET${count === 1 ? '' : 'S'}`;
  }

  function renderAchievements() {
    $('achievement-list').innerHTML = state.achievements
      .map(id => `<span class="achievement-chip" title="Succès débloqué">${escapeHtml(achievementNames[id] || id)}</span>`)
      .join('');
  }

  function unlockAchievement(id) {
    if (state.achievements.includes(id)) return;
    state.achievements.push(id);
    renderAchievements();
    playSound('achievement');
    toast(`Succès débloqué : ${achievementNames[id]}`, 'achievement');
  }

  function checkAchievements() {
    if (state.searched.length > 0) unlockAchievement('firstFind');
    if (state.clues >= 2) unlockAchievement('cartographer');
    if (state.flags.leilaSaved) unlockAchievement('leila');
    if (state.flags.puzzleSolved) unlockAchievement('riddle');
    if (state.trust >= 2) unlockAchievement('reunion');
  }

  function getObjectiveTargets() {
    if (state.phase === 'story' && state.flags.stormOngoing && !state.flags.stormShelterSecured) {
      const shelters = stormShelterZones.filter(id => state.discovered.includes(id));
      shelters.sort((left, right) => {
        const leftRoute = findRoute(state.position, left);
        const rightRoute = findRoute(state.position, right);
        return (leftRoute?.km ?? Infinity) - (rightRoute?.km ?? Infinity);
      });
      return shelters.slice(0, 1);
    }
    if (state.phase === 'story' && state.flags.distressSignalAvailable && !state.flags.rescueSignalAnswered) {
      return ['radio'];
    }
    if (state.phase === 'scavenge' || (state.chapter === 1 && !state.flags.miraContact)) {
      if (state.clues >= 2) return ['radio'];
      const clueSites = [
        ['market', 'market:grocery:receipt'],
        ['clinic', 'clinic:ward:register'],
        ['shelter', 'shelter:office:notebook'],
        ['depot', 'depot:wagon:manifest'],
        ['village', 'village:house:photograph']
      ];
      return clueSites
        .filter(([, token]) => !state.inspected.includes(token))
        .map(([zone]) => zone)
        .filter(zone => state.discovered.includes(zone))
        .slice(0, 2);
    }
    if (state.chapter === 2) return ['canyon'];
    if (state.chapter === 3) {
      const targets = [];
      if (state.route < 3) targets.push('depot');
      if (state.resources.water < 2 || state.resources.food < 1) targets.push('oasis');
      return targets.length ? targets : ['border'];
    }
    return [];
  }

  function getContextHint() {
    if (state.phase === 'scavenge') {
      return 'Les bâtiments du secteur gardent parfois des reçus, des carnets ou des traces. Chaque fouille prend du temps; la carte, elle, reste sûre à consulter.';
    }
    if (state.chapter === 1) {
      return state.clues >= 2
        ? 'La fréquence 09 a été entendue au relais. Vérifie la carte et approche-toi avant de répondre.'
        : 'Les papiers des commerces, des soins et du chemin de fer peuvent recouper la route du convoi.';
    }
    if (state.chapter === 2) {
      return 'Les pierres portent plusieurs marques. Examine les reliefs et compare-les à ce que Jay a déjà appris avant de choisir.';
    }
    if (state.route < 3) {
      return 'Les panneaux de voie et les archives du dépôt peuvent aider à trouver un passage praticable.';
    }
    if (state.resources.water < 2 || state.resources.food < 1) {
      return 'Avant la frontière, assure-toi que les réserves du groupe suffiront pour la traversée.';
    }
    return 'La route est ouverte. Choisis qui Jay emmènera avec lui; les décisions de la frontière sont définitives.';
  }

  function renderSidebar() {
    discoverLocations();
    $('resources').innerHTML = Object.entries(resourceNames).map(([key, label]) => {
      const icon = { water: '💧', food: '▰', materials: '▧', medicine: '✚' }[key];
      return `<div><span>${icon}</span><b>${state.resources[key]}</b><small>${label.toUpperCase()}</small></div>`;
    }).join('');

    for (const [key, value] of Object.entries({
      health: state.health, morale: state.morale, stress: state.stress, base: state.base
    })) {
      $(`${key}-value`).textContent = `${value}%`;
      $(`${key}-meter`).style.width = `${value}%`;
    }
    $('condition').textContent = state.health > 65 ? 'STABLE' : state.health > 30 ? 'FRAGILE' : 'CRITIQUE';
    document.body.classList.toggle('critical', state.stress >= 65);

    const chapter = state.chapter;
    $('chapter-number').textContent = `CHAPITRE 0${chapter}`;
    $('chapter-title').textContent = chapterNames[chapter];
    $('clue-counter').textContent = `PISTES ${Math.min(state.clues, 2)}/2 · CONFIANCE ${state.trust}`;
    let objective = '';
    let progress = 0;
    if (chapter === 1) {
      objective = state.flags.miraContact
        ? 'Trouve deux pistes du convoi au dépôt, au refuge ou au village.'
        : 'Trouve deux pistes, puis réponds à Mira au relais 09.';
      progress = Math.min(100, (Math.min(state.clues, 2) / 2) * 70 + (state.flags.miraContact ? 30 : 0));
    } else if (chapter === 2) {
      objective = 'Traverse les gorges en suivant l’ordre des trois signes.';
      progress = state.flags.puzzleSolved ? 100 : Math.min(75, 25 + state.clues * 15);
    } else {
      objective = 'Rejoins la frontière avec une route sûre, 2 eaux et 1 ration.';
      progress = Math.min(100, (state.route >= 3 ? 55 : state.route / 3 * 55)
        + (state.resources.water >= 2 ? 25 : state.resources.water / 2 * 25)
        + (state.resources.food >= 1 ? 20 : 0));
    }
    $('main-quest').textContent = objective;
    $('quest-meter').style.width = `${progress}%`;
    const sideQuest = $('side-quest-text');
    sideQuest.textContent = state.flags.stormOngoing && !state.flags.stormShelterSecured
      ? 'URGENT : rejoins un bâtiment solide avant la prochaine rafale.'
      : state.flags.distressSignalAvailable && !state.flags.rescueSignalAnswered
        ? state.flags.stormPassed
          ? 'Signal de détresse au relais 09 : Leïla demande de l’aide.'
          : 'Leïla appelle depuis l’oasis. Répondre avant 17 h est encore possible.'
        : state.flags.leilaSaved
          ? 'Leïla et les familles voyageront avec Jay.'
          : state.resources.medicine > 0
            ? 'Apporte une trousse à Leïla, au camp de l’oasis.'
            : 'Optionnel : trouve des soins à l’infirmerie pour Leïla.';
    sideQuest.parentElement.classList.toggle('complete', !!state.flags.leilaSaved);
    $('objective-text').textContent = state.flags.stormOngoing && !state.flags.stormShelterSecured
      ? 'La visibilité chute. Rejoins un abri signalé sur la carte.'
      : state.flags.distressSignalAvailable && !state.flags.rescueSignalAnswered
        ? state.flags.stormPassed
          ? 'Un appel de Leïla grésille au relais. Tu peux y répondre après avoir rejoint un abri.'
          : 'Leïla donne sa position au relais. Répondre prend 8 minutes; la tempête approche.'
        : chapter === 3
          ? 'La dernière traversée est ouverte. Prépare les vivres et choisis qui tu veux sauver avec Jay.'
          : chapter === 2
            ? 'Les gorges sont accessibles. Les signes indiquent une énigme plutôt qu’un chemin.'
            : 'Trouve les pistes du convoi et contacte Mira au relais.';
    $('field-objective').textContent = objective;
    $('border-label').textContent = chapter >= 3 ? 'DERNIÈRE ÉTAPE' : 'À DÉCOUVRIR';
    $('map').classList.toggle('route-open', state.route >= 2);
    renderAchievements();
  }

  function renderMap() {
    const objectiveTargets = new Set(getObjectiveTargets());
    document.querySelectorAll('.map-place').forEach(button => {
      const zone = button.dataset.zone;
      const discovered = state.discovered.includes(zone);
      button.hidden = !discovered;
      button.classList.toggle('selected', zone === state.selectedZone);
      button.classList.toggle('searched', state.searched.some(site => site.startsWith(`${zone}:`)));
      button.classList.toggle('visited', state.visited.some(site => site.startsWith(`${zone}:`)));
      button.classList.toggle('current-location', zone === state.position);
      button.classList.toggle('objective-location', objectiveTargets.has(zone));
      button.classList.toggle('storm-shelter', state.flags.stormOngoing && isStormShelter(zone));
      button.setAttribute('aria-current', zone === state.position ? 'location' : 'false');
      button.title = `${zones[zone].name}${zone === state.position ? ' · Jay est ici' : ''}`;
    });
    document.querySelectorAll('[data-fog]').forEach(mask => {
      mask.classList.toggle('cleared', state.discovered.includes(mask.dataset.fog));
    });
    $('map').classList.toggle('route-open', state.route >= 2);
    $('map').classList.toggle('storm-covered', getWeatherProfile().intensity > 0.55);
    $('map-zoom-label').textContent = `${Math.round(mapZoom * 100)}%`;
    $('map-world').style.transform = `translate(${mapOffset.x}px,${mapOffset.y}px) scale(${mapZoom})`;
    const position = zones[state.position];
    $('map-coordinate').textContent = `JAY · ${position?.name.toUpperCase() || 'POSITION INCONNUE'}`;
  }

  function storySiteToken(zoneId, siteId) {
    return zoneId === 'border'
      ? `${zoneId}:${siteId}:chapter${state.chapter}`
      : `${zoneId}:${siteId}`;
  }

  function render() {
    const scavenging = state.phase === 'scavenge';
    $('phase-label').textContent = scavenging
      ? 'PROLOGUE — LA TEMPÊTE APPROCHE'
      : `CHAPITRE 0${state.chapter} · JOUR ${String(state.day).padStart(2, '0')}`;
    $('game-title').innerHTML = scavenging
      ? 'CHOISIS UN LIEU<br><em>À FOUILLER.</em>'
      : state.chapter === 3
        ? 'LA DERNIÈRE<br><em>TRAVERSÉE.</em>'
        : 'TROUVE LA SORTIE.<br><em>LE TEMPS PRESSE.</em>';
    $('game-help').textContent = scavenging
      ? 'Le temps s’arrête quand tu consultes la carte. Chaque trajet et chaque fouille consomme des minutes jusqu’à la tempête de 17:00.'
      : 'Déplacements, examens et décisions avancent l’horloge. Les menus, la carte et la lecture du journal ne consomment aucun temps.';
    $('map-instruction').textContent = scavenging
      ? '① DESTINATION  →  ② TRAJET  →  ③ FOUILLE'
      : 'CARTE TACTIQUE · SÉLECTIONNE UNE DESTINATION';
    updateClockDisplay();
    renderSidebar();
    renderMap();
    renderInventoryCount();
    renderJournal();
    if (state.selectedZone && state.phase !== 'ending') showPlace(state.selectedZone);
    else $('place-panel').classList.add('hidden');
    if (scavenging) $('event-panel').classList.add('hidden');
    updateStorm();
  }

  function showPlace(key) {
    const zone = zones[key];
    if (!zone) return;
    state.selectedZone = key;
    $('place-panel').classList.remove('hidden');
    $('place-title').textContent = zone.name;
    $('place-description').textContent = zone.description;
    const atLocation = state.position === key;
    const route = findRoute(state.position, key);
    const duration = route ? travelDuration(route.route, route.km) : null;
    const weather = getWeatherProfile();
    const weatherWarning = weather.intensity > 0.4 ? ' · POUSSIÈRE / VISIBILITÉ RÉDUITE' : '';
    $('travel-strip').classList.toggle('hidden', atLocation);
    $('travel-distance').textContent = atLocation
      ? 'JAY EST SUR PLACE'
      : route ? `${route.km.toFixed(1)} KM · ${route.route.length - 1} TRONÇON${route.route.length === 2 ? '' : 'S'}${weatherWarning}` : 'AUCUNE ROUTE CARTOGRAPHIÉE';
    $('travel-button').disabled = !route;
    $('travel-button').dataset.destination = key;
    $('travel-button').textContent = route
      ? `SE RENDRE ICI · ${duration} MIN${weather.intensity > 0.75 ? ' · RAFALES' : ''} →`
      : 'ROUTE INDISPONIBLE';
    $('building-list').innerHTML = zone.buildings.map(building => {
      const token = `${key}:${building.id}`;
      const completed = state.phase === 'scavenge'
        ? state.searched.includes(token)
        : state.visited.includes(storySiteToken(key, building.id));
      const distressRevisit = key === 'radio' && building.id === 'antenna'
        && state.flags.stormPassed && !state.flags.rescueSignalAnswered;
      const locked = state.phase === 'story' && zone.minChapter > state.chapter;
      const disabled = (completed && !distressRevisit) || locked || !atLocation;
      const alreadyDone = completed && !distressRevisit;
      const subtitle = locked
        ? `DÉBLOQUÉ AU CHAPITRE 0${zone.minChapter}`
        : !atLocation ? 'VOYAGE NÉCESSAIRE AVANT D’EXPLORER'
        : alreadyDone ? 'DÉJÀ EXPLORÉ' : building.text;
      const actionLabel = disabled
        ? (locked ? 'VERROUILLÉ' : alreadyDone ? 'TERMINÉ' : 'NON SUR PLACE')
        : state.phase === 'scavenge' ? `FOUILLER · ${building.searchMinutes || 12} MIN` : 'EXPLORER';
      return `<button type="button" class="building-button ${completed ? 'done' : ''}" data-site="${escapeHtml(building.id)}" ${disabled ? 'disabled' : ''}>
        <span class="building-icon">${building.icon}</span>
        <span class="building-text"><b>${escapeHtml(building.name)}</b><small>${escapeHtml(subtitle)}</small></span>
        <span class="building-action">${actionLabel} <i>→</i></span>
      </button>`;
    }).join('');
    renderSitePlan(key);
    renderMap();
  }

  function getBuildingChoices(key, building) {
    if (key === 'canyon' && building.id === 'arches') {
      const step = state.flags.puzzleStep || 0;
      const symbols = [
        { id: 'star', title: 'Activer l’arche de l’étoile', detail: 'Le ciel ouvre la route.' },
        { id: 'source', title: 'Activer l’arche de la source', detail: 'L’eau nourrit la marche.' },
        { id: 'sun', title: 'Activer l’arche du soleil', detail: 'Le jour referme le chemin.' }
      ];
      return symbols.map(symbol => ({
        title: symbol.title,
        detail: state.flags.secretCode
          ? `Le carnet du wagon confirme l’ordre : étoile → source → soleil. ${symbol.detail}`
          : symbol.detail,
        action: { requires: { chapter: 2 }, puzzleSymbol: symbol.id }
      }));
    }
    if (key === 'radio' && building.id === 'antenna') {
      const choices = building.choices.filter(choice => !state.flags.miraContact
        || !choice.action.flags?.miraContact);
      if (state.flags.stormPassed && (state.flags.stormShelterSecured || !state.flags.stormOngoing)
        && !state.flags.rescueSignalAnswered) {
        choices.unshift({
          title: 'Répondre au signal de détresse de Leïla',
          detail: 'Le relais a été endommagé. Une voix demande de l’aide depuis l’oasis.',
          action: {
            duration: 8,
            keepSite: !state.flags.miraContact,
            flags: { rescueSignalAnswered: true, relayDamaged: false },
            effect: { trust: 1, morale: 5, stress: -8 },
            log: 'Jay rétablit une liaison brève. Leïla confirme que les familles tiennent à l’oasis et qu’elles ont besoin d’aide.'
          }
        });
      }
      return choices;
    }
    if (key === 'oasis' && building.id === 'camp'
      && (state.flags.rescueSignalAnswered || state.flags.distressSignalContacted) && !state.flags.leilaSaved) {
      return [...building.choices, {
        title: 'Guider Leïla et les familles vers le passage sûr',
        detail: 'La réponse radio a permis de retrouver le camp. Leïla accepte de partir avec Jay.',
        action: {
          flags: { leilaSaved: true },
          effect: { trust: 1, morale: 8 },
          log: 'Grâce à la réponse donnée au relais, Jay retrouve Leïla à l’abri des dunes. Elle rassemble les familles.'
        }
      }];
    }
    if (key !== 'border') return building.choices;
    if (state.chapter < 3) {
      return [{
        title: 'Observer la relève',
        detail: 'La route est encore fermée. Jay note la position des gardes.',
        action: { effect: { stress: 4 }, log: 'Jay observe les gardes. Il faut d’abord retrouver Mira et le passage des gorges.' }
      }];
    }
    const crossingRequirements = { chapter: 3, route: 3, flags: { puzzleSolved: true } };
    const choices = [
      {
        title: 'Partir seul à l’aube',
        detail: 'Jay franchit la frontière, mais abandonne le convoi derrière lui.',
        action: { cost: { water: 2, food: 1 }, requires: crossingRequirements, ending: 'escape-alone', log: 'Jay quitte le pays seul. Derrière lui, le relais s’éteint dans le sable.' }
      },
      {
        title: 'Attendre Mira et conduire le groupe',
        detail: 'La route sera plus risquée, mais personne ne sera laissé derrière.',
        action: { cost: { water: 2, food: 1 }, requires: { ...crossingRequirements, trust: 2 }, ending: 'escape-together', log: 'Mira rejoint Jay à la barrière. Ensemble, ils conduisent le convoi vers la frontière.' }
      }
    ];
    if (state.flags.leilaSaved) {
      choices.push({
        title: 'Escorter les familles de Leïla',
        detail: 'Jay renonce à partir vite pour ouvrir le passage aux familles.',
        action: { cost: { water: 2, food: 1 }, requires: { ...crossingRequirements, trust: 1, flags: { puzzleSolved: true, leilaSaved: true } }, ending: 'escape-caravan', log: 'Jay, Mira et Leïla ouvrent le poste aux familles. La fuite devient un exode, puis un nouveau départ.' }
      });
    }
    return choices;
  }

  function unmetRequirements(action) {
    const missing = [];
    for (const [resource, amount] of Object.entries(action.cost || {})) {
      if (state.resources[resource] < amount) missing.push(`${amount} ${resourceNames[resource]} requis`);
    }
    const needs = action.requires || {};
    if (needs.chapter && state.chapter < needs.chapter) missing.push(`chapitre ${needs.chapter} requis`);
    if (needs.route && state.route < needs.route) missing.push(`${needs.route} pistes requises`);
    if (needs.clues && state.clues < needs.clues) missing.push(`${needs.clues} pistes requises`);
    if (needs.trust && state.trust < needs.trust) missing.push(`confiance ${needs.trust} requise`);
    for (const [flag, value] of Object.entries(needs.flags || {})) {
      if (!!state.flags[flag] !== value) missing.push('objectif précédent requis');
    }
    return missing;
  }

  function getActionDuration(action) {
    let duration = Number.isFinite(action.duration) ? action.duration
      : action.puzzleSymbol ? 4
        : action.ending ? 20
          : action.retryable ? 12
            : Object.keys(action.cost || {}).length ? 10 : 7;
    if (state.flags.stormOngoing && !isStormShelter(state.position)) {
      duration = Math.ceil(duration * (1 + getWeatherProfile().intensity * 0.4));
    }
    return duration;
  }

  function setSpeaker(name, role, initial) {
    $('speaker-name').textContent = name;
    $('speaker-role').textContent = role;
    $('speaker-portrait').textContent = initial;
    $('speaker-card').classList.toggle('mira', name === 'MIRA');
    $('speaker-card').classList.toggle('leila', name === 'LEÏLA');
  }

  function renderInspections(zone, building) {
    const inspections = inspectionCatalog[`${state.selectedZone}:${building.id}`] || [];
    $('inspection-list').innerHTML = inspections.map(inspection => {
      const token = `${state.selectedZone}:${building.id}:${inspection.id}`;
      const complete = state.inspected.includes(token);
      const needsTools = inspection.requiresItem && !state.inventory[inspection.requiresItem];
      const duration = getActionDuration({ duration: inspection.duration });
      return `<button class="inspection-button ${complete ? 'done' : ''}" type="button" data-inspection="${escapeHtml(inspection.id)}" ${complete || needsTools ? 'disabled' : ''}>
        <span><b>${escapeHtml(inspection.name)}</b><small>${complete ? 'EXAMINÉ' : needsTools ? 'OUTIL NÉCESSAIRE' : escapeHtml(inspection.result)}</small></span>
        <span class="inspection-time">${complete ? '✓' : `${duration} MIN →`}</span>
      </button>`;
    }).join('');
    $('inspection-list').classList.toggle('hidden', inspections.length === 0);
    $('speaker-card').classList.remove('mira', 'leila');
    if (state.selectedZone === 'radio') setSpeaker('MIRA', 'ÉCLAIREUSE · FRÉQUENCE 09', 'M');
    else if (state.selectedZone === 'oasis') setSpeaker('LEÏLA', 'MÉDECIN · CAMP DE L’OASIS', 'L');
    else setSpeaker('JAY', 'TÉMOIN · CARNET PERSONNEL', 'J');
  }

  function renderSitePlan(zoneKey) {
    const container = $('site-plan');
    const rooms = sitePlanLayouts[`${zoneKey}:${state.currentSite}`];
    if (!rooms) {
      container.classList.add('hidden');
      container.innerHTML = '';
      return;
    }
    const inspections = inspectionCatalog[`${zoneKey}:${state.currentSite}`] || [];
    const roomLabels = rooms.map((name, index) => `<text x="${68 + index * 112}" y="34">${escapeHtml(name)}</text>`).join('');
    const points = inspections.map((inspection, index) => {
      const token = `${zoneKey}:${state.currentSite}:${inspection.id}`;
      const complete = state.inspected.includes(token);
      const needsItem = inspection.requiresItem && !state.inventory[inspection.requiresItem];
      const pointX = inspections.length === 1 ? 50 : 20 + index * (60 / (inspections.length - 1));
      return `<button type="button" class="plan-point ${complete ? 'done' : ''}" style="--point-x:${pointX}%" data-plan-inspection="${escapeHtml(inspection.id)}" ${complete || needsItem ? 'disabled' : ''} aria-label="${escapeHtml(inspection.name)}" title="${escapeHtml(inspection.name)}">${complete ? '✓' : String(index + 1).padStart(2, '0')}</button>`;
    }).join('');
    container.innerHTML = `<div class="plan-heading"><span>PLAN DE FOUILLE · ${escapeHtml(zones[zoneKey].name.toLocaleUpperCase('fr-FR'))}</span><small>REPÈRES RELEVÉS PAR JAY</small></div><div class="plan-drawing"><svg viewBox="0 0 360 112" role="img" aria-label="Plan local avec trois zones et un couloir de liaison"><defs><pattern id="plan-grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0V12" fill="none" stroke="#d7c49c" stroke-opacity=".08"/></pattern></defs><rect x="7" y="7" width="346" height="98" fill="url(#plan-grid)" stroke="#d7c49c" stroke-opacity=".5"/><path d="M14 14H124V63M124 14H236V63M236 14H346V63M14 63H346M14 63V98H346V63" fill="none" stroke="#d6c6a5" stroke-width="2"/><path d="M115 63v13m18-13v13m94-13v13m18-13v13m-132 9H245" fill="none" stroke="#e5c181" stroke-width="1.5" stroke-dasharray="3 4"/><path d="M112 63a13 13 0 0 1 13 13m98-13a13 13 0 0 1 13 13" fill="none" stroke="#e5c181" stroke-opacity=".7"/><g fill="#e1d3b6" fill-opacity=".72" font-family="DM Mono,monospace" font-size="7" text-anchor="middle" letter-spacing=".7">${roomLabels}<text x="180" y="92" fill="#d2af76">COULOIR / ISSUE</text></g><path d="M18 18h8m308 0h8M18 94h8m308 0h8" stroke="#d9a06a" stroke-width="2"/></svg><div class="plan-points">${points}</div></div><div class="plan-legend"><span>TRAJET INTÉRIEUR</span><span>POINT D’EXAMEN · SANS TEMPS SUPPLÉMENTAIRE POUR OUVRIR LE PLAN</span></div>`;
    container.classList.remove('hidden');
  }

  function renderEnvironmentArtwork(art, drawerOpen) {
    const scenes = {
      dormitory: `<g class="room-props">
        <path d="M92 121h223v196H92z" fill="#192022" stroke="#88795f" stroke-width="8"/><path d="M101 131h205v168H101z" fill="#8d7b5c"/><path d="M101 131h205v168H101z" fill="url(#window-light)"/>
        <path d="m101 131 111 82 94-82m-94 82v86" fill="none" stroke="#554a3a" stroke-width="7" opacity=".8"/>
        <path d="M288 367h618v54H288z" fill="#282521" stroke="#75634a" stroke-width="7"/><path d="M316 348h570l45 34H292z" fill="#897c67"/><path d="M360 356h143v49H360z" fill="#c6b59b"/><path d="m480 352 315 0 42 46-337 4z" fill="#777265"/><path d="M431 386q132 43 256 0l-10 34H445z" fill="#665744"/>
        <path d="M286 420v115m605-115v115" stroke="#28231c" stroke-width="16"/><path d="M316 431h44v73h-44z" fill="#4a392a"/>
        <g class="${drawerOpen ? 'drawer-open' : ''}"><path class="drawer-front" d="M315 455h47v44h-47z" fill="#5b452f" stroke="#967a50" stroke-width="3"/><path d="M330 476h17" stroke="#cfac6d" stroke-width="4"/></g>
        <path d="M940 279h123v201H940z" fill="#45372a" stroke="#88714c" stroke-width="7"/><path d="M951 292h101v74H951z" fill="#2c2922"/><path d="M951 380h101v84H951z" fill="#362d22"/><path d="M974 409h55" stroke="#a78b5c" stroke-width="4"/>
        <path d="M781 304h74v87h-74z" fill="#292923" stroke="#8d7450" stroke-width="4"/><circle cx="818" cy="346" r="18" fill="#c79255" opacity=".6"/><path d="M791 397h54" stroke="#88704f" stroke-width="7"/>
      </g>`,
      office: `<g class="room-props">
        <path d="M86 96h188v245H86z" fill="#272723" stroke="#75674f" stroke-width="7"/><path d="M99 111h162v61H99zm0 73h162v61H99zm0 73h162v69H99z" fill="#403a2e" stroke="#9e865d" stroke-width="4"/>
        <g fill="#9a7850"><path d="M116 123h18v38h-18zm28 7h20v31h-20zm33-10h16v41h-16zm34 8h29v33h-29z"/><path d="M115 195h25v32h-25zm37-7h17v39h-17zm33 4h26v35h-26zM119 273h19v49h-19zm27 10h34v39h-34zm43-14h28v53h-28z"/></g>
        <path d="M328 344h574v48H328z" fill="#5b4933" stroke="#a78a5b" stroke-width="5"/><path d="M369 391v143m483-143v143" stroke="#29251d" stroke-width="15"/>
        <path d="M391 314h104v28H391z" fill="#d0bd94"/><path d="M405 303h143v18H405z" fill="#91805f"/><path d="M530 321h123v14H530z" fill="#b9a784"/>
        <path d="M716 268h110v79H716z" fill="#212424" stroke="#aa8b5a" stroke-width="5"/><path d="M732 282h78v51H732z" fill="#7e6746"/><path d="M748 297h46m-46 12h34" stroke="#d4b77c" stroke-width="3"/>
        <g class="${drawerOpen ? 'drawer-open' : ''}"><path class="drawer-front" d="M668 349h108v38H668z" fill="#4c3b29" stroke="#a48858" stroke-width="3"/><path d="M715 367h16" stroke="#d0ad6d" stroke-width="4"/></g>
        <path d="M991 179h87v94h-87z" fill="#30302a" stroke="#8e7551" stroke-width="5"/><path d="M1004 192h61v67h-61z" fill="#7d6643"/>
      </g>`,
      market: `<g class="room-props">
        <path d="M73 174h293v256H73z" fill="#3d3528" stroke="#8e7652" stroke-width="7"/><path d="M87 204h264v12H87zm0 76h264v12H87zm0 74h264v12H87z" fill="#ad9064"/>
        <g fill="#b49b6a"><path d="M103 220h44v51h-44zm62 0h48v51h-48zm74 0h61v51h-61zM98 294h50v51H98zm67 0h61v51h-61zm81 0h40v51h-40zM100 369h61v51h-61zm79 0h50v51h-50zm70 0h80v51h-80z"/></g>
        <path d="M553 357h515v59H553z" fill="#473728" stroke="#9c7d50" stroke-width="6"/><path d="M579 416v113m458-113v113" stroke="#29241c" stroke-width="15"/><path d="M596 338h187v19H596zm208 7h109v13H804z" fill="#b7a17b"/>
        <path d="M847 187h233v120H847z" fill="#332d23" stroke="#92764d" stroke-width="7"/><path d="M865 207h197v81H865z" fill="#161c1d"/><path d="M862 153h201v30H862z" fill="#8c6941"/><path d="M883 164h161" stroke="#d5b17b" stroke-width="5"/>
        <path d="M399 431h108v90H399z" fill="#4a3724" stroke="#8e7147" stroke-width="5"/><path d="M418 448h69m-69 15h48" stroke="#c1a06b" stroke-width="4"/>
      </g>`,
      workshop: `<g class="room-props">
        <path d="M100 176h218v173H100z" fill="#242725" stroke="#87714d" stroke-width="6"/><path d="M116 195h184v138H116z" fill="#111819"/>
        <path d="m135 320 66-91 46 64 28-35" fill="none" stroke="#d6b77d" stroke-width="6"/><circle cx="204" cy="242" r="10" fill="#d6b77d"/>
        <path d="M352 365h687v53H352z" fill="#584632" stroke="#9a8055" stroke-width="5"/><path d="M390 418v123m605-123v123" stroke="#2b271f" stroke-width="17"/>
        <path d="M418 343h104v21H418zm150 2h62v18h-62zm96-3h124v21H664z" fill="#b59a6b"/>
        <path d="M475 282 497 209l20 73m-5-34h47m-26-21v43" fill="none" stroke="#c7a568" stroke-width="9"/>
        <path d="M773 292h160v65H773z" fill="#1c2526" stroke="#a38a59" stroke-width="5"/><path d="M795 307h116v33H795z" fill="#70827b"/><circle cx="811" cy="323" r="8" fill="#dcbd79"/><circle cx="887" cy="323" r="8" fill="#d17d58"/>
        <path d="M105 428h179v100H105z" fill="#4c3928" stroke="#8e7147" stroke-width="5"/><path d="m112 454 80-24 85 23v68H112z" fill="#705438"/>
      </g>`,
      clinic: `<g class="room-props">
        <path d="M122 156h957v13H122z" fill="#a99c81"/><path d="M122 169v275" stroke="#d5c7a5" stroke-width="8"/><path d="M130 178h203v218H130z" fill="#aaa087" opacity=".75"/>
        <path d="M382 372h475v48H382z" fill="#484238" stroke="#a49168" stroke-width="5"/><path d="M408 344h423v32H408z" fill="#d4cbb3"/><path d="M454 351h109v24H454z" fill="#eee2c5"/><path d="M462 420v113m367-113v113" stroke="#332e25" stroke-width="12"/>
        <path d="M931 181h162v253H931z" fill="#3d3930" stroke="#9b8258" stroke-width="6"/><path d="M949 201h127v63H949zm0 80h127v63H949zm0 80h127v54H949z" fill="#7f704f" stroke="#c2aa77" stroke-width="3"/>
        <g fill="#e1d7bc"><path d="M969 212h21v39h-21zm37 4h17v35h-17zm-35 77h27v43h-27zm40 6h25v37h-25z"/></g>
        <path d="M701 150v231" stroke="#967f5c" stroke-width="4"/><path d="M688 154h70v7h-70" stroke="#dfcfac" stroke-width="5"/>
      </g>`,
      wagon: `<g class="room-props">
        <path d="M77 91q526-172 1047 0v337H77z" fill="#313735" stroke="#8a7652" stroke-width="8"/><path d="M95 110q504-151 1011 0v251H95z" fill="#242b2a" stroke="#5d5b4b" stroke-width="4"/>
        <path d="M144 140h191v131H144zM862 140h191v131H862z" fill="#1a2425" stroke="#897250" stroke-width="7"/><path d="M155 151h169v106H155zM873 151h169v106H873z" fill="#987b4d" opacity=".54"/>
        <path d="M261 367h248v146H261zM516 338h245v176H516zM771 372h256v141H771z" fill="#5a4730" stroke="#a18455" stroke-width="7"/>
        <path d="M279 393h211v13H279zm256-27h208v14H535zm300 28h224v13H835z" fill="#c0a472"/>
        <path d="M0 535h1200" stroke="#91815f" stroke-width="10"/><path d="M178 563h844m-796 28h749" stroke="#454338" stroke-width="12"/>
        <path d="M436 83v319m306-323v321" stroke="#88704b" stroke-width="9"/>
      </g>`,
      house: `<g class="room-props">
        <path d="M143 142h237v211H143z" fill="#182122" stroke="#92754c" stroke-width="8"/><path d="M157 157h209v179H157z" fill="url(#window-light)"/><path d="m157 157 105 93 104-93m-104 93v86" stroke="#554333" stroke-width="7" fill="none"/>
        <path d="M422 384h429v38H422z" fill="#533f2c" stroke="#a08456" stroke-width="5"/><path d="M449 422v117m379-117v117" stroke="#30281e" stroke-width="14"/><path d="M521 354h149v29H521z" fill="#c7b491"/><path d="M697 365h84v18h-84z" fill="#9d8053"/>
        <path d="M936 213h153v224H936z" fill="#47382a" stroke="#94754a" stroke-width="7"/><path d="M953 231h118v86H953zm0 101h118v88H953z" fill="#61503a"/><path d="M1010 270h7m-7 125h7" stroke="#d4ba83" stroke-width="6"/>
        <path d="M221 390h103v69H221z" fill="#302b24" stroke="#9f8050" stroke-width="5"/><path d="M236 402h73v47h-73z" fill="#816443"/><circle cx="271" cy="424" r="13" fill="#c79159"/>
      </g>`,
      relay: `<g class="room-props">
        <path d="M0 428 158 356l117 46 171-128 158 104 131-79 185 92 126-63 154 66v256H0z" fill="#5d4933"/>
        <path d="M735 477 886 123l160 354m-228-181h278m-315 99h350m-383 75h423" fill="none" stroke="#283033" stroke-width="13"/>
        <path d="M752 477 886 123l160 354" fill="none" stroke="#d2a66c" stroke-opacity=".5" stroke-width="4"/>
        <path d="M108 417h323v145H108z" fill="#282a26" stroke="#9a7a4d" stroke-width="7"/><path d="M126 438h284v107H126z" fill="#171c1b"/>
        <path d="M170 472h102v53H170z" fill="#54452e" stroke="#c09a5e" stroke-width="4"/><path d="M185 485h70m-70 13h49" stroke="#d3b378" stroke-width="3"/>
        <circle cx="310" cy="498" r="17" fill="#b5824f"/><path d="M310 482v32m-16-16h32" stroke="#26231d" stroke-width="4"/>
      </g>`,
      canyon: `<g class="room-props">
        <path d="M0 0h1200v486q-106-46-196-24-116 26-195-12-121-58-221-5-127 69-237 12-102-53-351 33z" fill="#37352e"/>
        <path d="M0 0h230v402q-84-17-124 44L0 502zm970 0h230v523q-95-55-151-39-56 17-79 53z" fill="#514336"/>
        <path d="M278 452V190q0-162 168-162t168 162v262" fill="none" stroke="#aa8960" stroke-width="72"/>
        <path d="M350 450V196q0-104 96-104t96 104v254" fill="#202626" stroke="#70593d" stroke-width="11"/>
        <path d="M0 509q176-60 362-22t361 3q256-53 477 35v135H0z" fill="#685136"/>
        <path d="M303 212l27-23 23 14 29-34m115 164 30-24 24 14 32-37m-542 88 34-17 20 12 27-25" fill="none" stroke="#d3ad79" stroke-width="5" opacity=".62"/>
        <path d="M179 520h74m146-39h64m373 32h111" stroke="#302d26" stroke-width="12"/>
      </g>`,
      pump: `<g class="room-props">
        <path d="M124 90h921v411H124z" fill="#29302d" stroke="#927b55" stroke-width="8"/><path d="M145 110h879v357H145z" fill="#1d2525"/>
        <path d="M174 365h252v139H174z" fill="#52432e" stroke="#a58758" stroke-width="7"/><path d="M200 387h197v85H200z" fill="#7b6848"/>
        <path d="M518 190h127v214H518z" fill="#4b4537" stroke="#b19a6c" stroke-width="7"/><circle cx="582" cy="287" r="48" fill="#1b2221" stroke="#d0ad70" stroke-width="7"/><path d="M582 245v84m-42-42h84" stroke="#c69e61" stroke-width="5"/>
        <path d="M640 254h143v17H640zm-27 79h203v17H613zm123-64v88" fill="none" stroke="#b49a67" stroke-width="13"/>
        <path d="M800 392h209v80H800z" fill="#495047" stroke="#a38a5a" stroke-width="6"/><path d="M823 412h160v44H823z" fill="#879077"/><path d="M822 438h162" stroke="#b8c2a0" stroke-width="5"/>
        <path d="M92 537h1013" stroke="#938160" stroke-width="10"/><path d="M267 219v129m-34-103h69" stroke="#c4a26c" stroke-width="12"/>
      </g>`,
      checkpoint: `<g class="room-props">
        <path d="M114 170h443v320H114z" fill="#3b372d" stroke="#a08357" stroke-width="8"/><path d="M137 190h397v136H137z" fill="#131b1c"/><path d="M151 203h370v106H151z" fill="#8d7047" opacity=".63"/>
        <path d="M187 361h284v49H187z" fill="#55432e"/><path d="M210 411v111m243-111v111" stroke="#332b20" stroke-width="16"/>
        <path d="M678 417h443v29H678z" fill="#b58a57" stroke="#332a1d" stroke-width="5"/><path d="M700 446v76m395-76v76" stroke="#2a2720" stroke-width="14"/>
        <path d="M768 201h247v173H768z" fill="#2c312d" stroke="#a08357" stroke-width="7"/><path d="M788 220h207v132H788z" fill="#171e1d"/>
        <path d="M861 233h61v84h-61z" fill="#9a7b4e"/><path d="M872 244h39v62h-39z" fill="#d1b278"/>
        <path d="M593 479h68v31h-68z" fill="#6b5539"/><path d="M612 438v42" stroke="#c5a06a" stroke-width="8"/>
      </g>`
    };
    const opened = drawerOpen ? 'drawer-open' : '';
    return `<svg class="exploration-art art-${art}" viewBox="0 0 1200 650" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Décor original de fouille : ${art}"><defs>
      <linearGradient id="wall" x2="0" y2="1"><stop stop-color="#545147"/><stop offset="1" stop-color="#292d2b"/></linearGradient>
      <linearGradient id="floor" x2="0" y2="1"><stop stop-color="#4c4031"/><stop offset="1" stop-color="#1b1c1a"/></linearGradient>
      <linearGradient id="window-light" x2="1" y2="1"><stop stop-color="#eac28a" stop-opacity=".85"/><stop offset=".48" stop-color="#b27c50" stop-opacity=".47"/><stop offset="1" stop-color="#313a38"/></linearGradient>
      <radialGradient id="room-vignette"><stop offset=".52" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#090b0b" stop-opacity=".72"/></radialGradient>
      <pattern id="wall-dust" width="54" height="48" patternUnits="userSpaceOnUse"><circle cx="8" cy="12" r="1.1" fill="#e5d2ad" opacity=".2"/><circle cx="37" cy="31" r=".8" fill="#e5d2ad" opacity=".16"/><path d="M17 42h11M44 7h6" stroke="#e5d2ad" stroke-opacity=".1"/></pattern>
      <filter id="soft-shadow" x="-.3" y="-.3" width="1.6" height="1.7"><feGaussianBlur stdDeviation="13"/></filter>
    </defs>
    <rect width="1200" height="650" fill="url(#wall)"/><path d="M0 0h1200v430H0z" fill="url(#wall-dust)" opacity=".8"/>
    <path d="M0 434 1200 390v260H0z" fill="url(#floor)"/><path d="M0 438 1200 396" stroke="#a18b64" stroke-opacity=".42" stroke-width="7"/>
    <path d="M0 506 1200 462M0 580 1200 541M202 433l-72 217m332-204 5 204m300-216 61 216m216-225 96 225" stroke="#c8b18a" stroke-opacity=".1" stroke-width="3"/>
    <ellipse cx="604" cy="521" rx="440" ry="51" fill="#080909" opacity=".56" filter="url(#soft-shadow)"/>
    <path d="m0 118 92 41-18 83 90 35-41 54 74 34M1200 94l-84 51 18 79-74 40 56 60-70 48" fill="none" stroke="#191d1b" stroke-width="7" opacity=".52"/>
    <path d="M0 0h1200v650H0z" fill="url(#room-vignette)"/>
    <g class="exploration-dust" fill="#f3d9aa"><circle cx="413" cy="137" r="2"/><circle cx="464" cy="209" r="1.4"/><circle cx="637" cy="94" r="1.6"/><circle cx="716" cy="171" r="1.1"/><circle cx="551" cy="258" r="1.3"/><circle cx="877" cy="113" r="1.7"/></g>
    <g class="${opened}">${scenes[art] || scenes.dormitory}</g>
    <path d="M0 617q266-55 507-11t693-21v65H0z" fill="#101312" fill-opacity=".72"/>
    </svg>`;
  }

  function getExplorationTargets(siteKey) {
    const inspections = inspectionCatalog[siteKey] || [];
    const secondary = explorationScenes[siteKey]?.targets || [];
    const primaryTargets = inspections.map((inspection, index) => ({
      id: `inspection:${inspection.id}`,
      name: inspection.name,
      x: inspection.x ?? (inspections.length === 1 ? 50 : index === 0 ? 20 : 80),
      y: inspection.y ?? (index === 0 ? 57 : 70),
      duration: inspection.duration,
      type: 'inspection',
      inspection
    }));
    return [...primaryTargets, ...secondary];
  }

  function renderExplorationPanel(focusId = explorationFocus) {
    const zoneKey = state.selectedZone;
    const siteKey = `${zoneKey}:${state.currentSite}`;
    const zone = zones[zoneKey];
    const building = zone?.buildings.find(item => item.id === state.currentSite);
    if (!building) return;
    const scene = explorationScenes[siteKey] || {
      art: 'dormitory',
      atmosphere: 'La pièce est silencieuse. Les objets déplacés racontent un départ précipité.',
      targets: []
    };
    const targets = getExplorationTargets(siteKey);
    const visibleTargets = targets.filter(target => !target.requires
      || state.exploredDetails.includes(`${siteKey}:${target.requires}`));
    const selected = visibleTargets.find(target => target.id === focusId)
      || visibleTargets.find(target => !isExplorationTargetComplete(siteKey, target))
      || visibleTargets[0];
    if (!selected) return;
    explorationFocus = selected.id;
    const selectedInspection = selected.type === 'inspection' ? selected.inspection : null;
    const complete = isExplorationTargetComplete(siteKey, selected);
    const canCarry = !selectedInspection?.item
      || inventoryWeight() + (itemCatalog[selectedInspection.item]?.weight || 0) <= 8;
    const missingTool = selectedInspection?.requiresItem && !state.inventory[selectedInspection.requiresItem];
    const savedDocument = selectedInspection?.document
      ? documentCatalog[selectedInspection.document]
      : null;
    const item = selectedInspection?.item ? itemCatalog[selectedInspection.item] : null;
    const content = complete
      ? selectedInspection?.result || selected.result
      : selectedInspection
        ? 'L’objet n’a pas encore été examiné. Jay peut le manipuler, mais chaque fouille consomme du temps.'
        : selected.result;
    const visibleResult = complete ? content : scene.atmosphere;
    const drawerOpen = state.exploredDetails.some(detail => detail.startsWith(`${siteKey}:`)
      && ['nightstand', 'desk-drawer'].includes(detail.slice(siteKey.length + 1)));
    const hotspots = visibleTargets.map(target => {
      const done = isExplorationTargetComplete(siteKey, target);
      const active = target.id === selected.id;
      const title = target.name;
      return `<button type="button" class="exploration-hotspot ${done ? 'examined' : ''} ${active ? 'active' : ''}" style="--hotspot-x:${target.x}%;--hotspot-y:${target.y}%" data-exploration-focus="${escapeHtml(target.id)}" aria-label="${escapeHtml(title)}" aria-pressed="${active}" title="${escapeHtml(title)}"><span>${done ? '✓' : '＋'}</span><small>${escapeHtml(title)}</small></button>`;
    }).join('');
    const objectList = visibleTargets.map(target => {
      const done = isExplorationTargetComplete(siteKey, target);
      const active = target.id === selected.id;
      const duration = getActionDuration({ duration: target.duration });
      return `<button type="button" class="exploration-object ${done ? 'examined' : ''} ${active ? 'active' : ''}" data-exploration-focus="${escapeHtml(target.id)}"><span class="object-glyph">${done ? '✓' : target.kind === 'photo' ? '▧' : target.kind === 'document' ? '▤' : '◈'}</span><span><b>${escapeHtml(target.name)}</b><small>${done ? 'EXAMINÉ' : `EXAMINER · ${duration} MIN`}</small></span><i>${done ? '✓' : '→'}</i></button>`;
    }).join('');
    let actionMarkup = '';
    if (!complete) {
      const disabled = missingTool || !canCarry;
      const duration = getActionDuration({ duration: selected.duration });
      const label = missingTool ? 'OUTIL NÉCESSAIRE' : !canCarry ? 'SAC PLEIN' : `EXAMINER · ${duration} MIN`;
      actionMarkup = selectedInspection
        ? `<button type="button" class="exploration-action" data-exploration-inspection="${escapeHtml(selectedInspection.id)}" ${disabled ? 'disabled' : ''}>${label} <b>→</b></button>`
        : `<button type="button" class="exploration-action" data-exploration-detail="${escapeHtml(selected.id)}">FOUILLER CE DÉTAIL · ${duration} MIN <b>→</b></button>`;
    } else if (savedDocument && state.documents.includes(selectedInspection.document)
      && !state.readDocuments.includes(selectedInspection.document)) {
      actionMarkup = `<button type="button" class="exploration-action" data-exploration-read="${escapeHtml(selectedInspection.document)}">LIRE LE DOCUMENT · 2 MIN <b>→</b></button>`;
    } else if (savedDocument && state.readDocuments.includes(selectedInspection.document)) {
      actionMarkup = '<span class="exploration-read-state">DOCUMENT LU · TRANSCRIT AU JOURNAL</span>';
    }
    const inspectableObject = savedDocument || item || selected.kind === 'photo';
    const objectVisual = inspectableObject
      ? `<div class="paper-object ${explorationDocumentZoomed ? 'zoomed' : ''} ${explorationDocumentFace === 'back' ? 'back-face' : ''} ${selected.kind === 'photo' ? 'photo-object' : ''}">
          <span>${explorationDocumentFace === 'back' ? 'VERSO · TRACES ET ANNOTATIONS' : savedDocument ? escapeHtml(savedDocument.title) : escapeHtml(item?.name || selected.name)}</span>
          <p>${complete
            ? explorationDocumentFace === 'back'
              ? escapeHtml(selectedInspection?.result || selected.back || selected.result)
              : savedDocument && state.readDocuments.includes(selectedInspection.document)
                ? escapeHtml(savedDocument.content)
                : escapeHtml(savedDocument ? 'Le document est récupéré. Lis-le pour révéler sa transcription complète.' : item?.description || selected.result)
            : 'Détails encore masqués. Examine l’objet pour le manipuler.'}</p>
        </div><div class="object-tools"><button type="button" data-exploration-face ${complete ? '' : 'disabled'}>RETOURNER</button><button type="button" data-exploration-zoom>${explorationDocumentZoomed ? 'RÉDUIRE' : 'AGRANDIR'}</button></div>`
      : '';
    const history = state.journal.find(line => line.includes(selectedInspection?.result || selected.result));
    $('dialog-kicker').textContent = `FOUILLE · ${zone.name.toLocaleUpperCase('fr-FR')}`;
    $('dialog-title').textContent = building.name;
    $('game-dialog').classList.add('exploration-mode');
    $('dialog-content').innerHTML = `<div class="exploration-layout">
      <section class="exploration-scene-column">
        <div class="exploration-scene-shell">
          ${renderEnvironmentArtwork(scene.art, drawerOpen)}
          <div class="exploration-hotspots">${hotspots}</div>
          <div class="scene-readout"><span>SECTEUR 09 · ${escapeHtml(zone.name.toLocaleUpperCase('fr-FR'))}</span><span>${formatClock()} · ${state.elapsedMinutes} MIN ÉCOULÉES</span></div>
          <p class="scene-atmosphere">${escapeHtml(scene.atmosphere)}</p>
          <div class="scene-vignette-overlay"></div>
        </div>
        <div class="scene-footnote"><span>✦ ${visibleTargets.filter(target => isExplorationTargetComplete(siteKey, target)).length}/${visibleTargets.length} DÉTAILS EXAMINÉS</span><span>LES MENUS N’AVANCENT PAS L’HORLOGE</span></div>
      </section>
      <aside class="exploration-inspector">
        <div class="inspector-heading"><span>OBJET EN COURS</span><small>${complete ? 'OBSERVATION CONSIGNÉE' : 'INTERACTION DISPONIBLE'}</small></div>
        <h3>${escapeHtml(selected.name)}</h3>
        <p class="inspector-description">${escapeHtml(visibleResult)}</p>
        ${objectVisual}
        ${history && complete ? `<p class="inspector-evidence">✳ Cette observation figure dans le carnet de Jay.</p>` : ''}
        ${actionMarkup}
        <div class="exploration-object-list"><div class="object-list-heading"><span>REPÈRES DANS LA PIÈCE</span><span>${visibleTargets.length}</span></div>${objectList}</div>
        <button type="button" class="exploration-return" data-close-exploration>RETOURNER À LA CAMPAGNE <b>ÉCHAP</b></button>
      </aside>
    </div>`;
  }

  function isExplorationTargetComplete(siteKey, target) {
    if (target.type === 'inspection') {
      return state.inspected.includes(`${state.selectedZone}:${state.currentSite}:${target.inspection.id}`);
    }
    return state.exploredDetails.includes(`${siteKey}:${target.id}`);
  }

  function openExploration(focusId = null) {
    if (!state.selectedZone || !state.currentSite) {
      toast('Sélectionne d’abord un lieu à explorer.');
      return;
    }
    const dialog = $('game-dialog');
    explorationFocus = focusId
      ? (focusId.startsWith('inspection:') ? focusId : `inspection:${focusId}`)
      : null;
    explorationDocumentFace = 'front';
    explorationDocumentZoomed = false;
    renderExplorationPanel(explorationFocus);
    if (!dialog.open) dialog.showModal();
    else dialog.focus();
    updateStorm();
    playSound('panel');
  }

  function closeExploration() {
    const dialog = $('game-dialog');
    dialog.classList.remove('exploration-mode');
    if (dialog.open) dialog.close();
    updateStorm();
    explorationFocus = null;
    explorationDocumentFace = 'front';
    explorationDocumentZoomed = false;
  }

  function resolveExplorationDetail(id) {
    const siteKey = `${state.selectedZone}:${state.currentSite}`;
    const target = explorationScenes[siteKey]?.targets.find(item => item.id === id);
    if (!target || target.requires && !state.exploredDetails.includes(`${siteKey}:${target.requires}`)) return;
    const token = `${siteKey}:${target.id}`;
    if (state.exploredDetails.includes(token)) return;
    const time = advanceActionTime(getActionDuration({ duration: target.duration }));
    if (time.ended) return;
    if (!time.completed) {
      if (time.storm) {
        closeExploration();
        finishScavenge();
      }
      toast('La tempête interrompt la fouille avant que Jay ne puisse conclure.');
      return;
    }
    state.exploredDetails.push(token);
    addLog(target.result);
    playSound('inspect');
    render();
    safeSave();
    renderExplorationPanel(target.id);
  }

  function inspectObject(id) {
    const zone = state.selectedZone;
    const inspection = (inspectionCatalog[`${zone}:${state.currentSite}`] || []).find(item => item.id === id);
    if (!inspection) return;
    openExploration(`inspection:${id}`);
  }

  function completeInspection(id) {
    const zone = state.selectedZone;
    const building = zones[zone]?.buildings.find(item => item.id === state.currentSite);
    const inspection = (inspectionCatalog[`${zone}:${state.currentSite}`] || []).find(item => item.id === id);
    if (!building || !inspection) return;
    const keepExplorationOpen = $('game-dialog').classList.contains('exploration-mode');
    const token = `${zone}:${building.id}:${inspection.id}`;
    if (state.inspected.includes(token)) return;
    if (inspection.requiresItem && !state.inventory[inspection.requiresItem]) {
      toast('Jay n’a pas l’outil nécessaire.');
      return;
    }
    if (inspection.item && inventoryWeight() + (itemCatalog[inspection.item]?.weight || 0) > 8) {
      toast('Le sac est plein. Libère de la place avant de fouiller cet objet.');
      return;
    }
    const duration = getActionDuration({ duration: inspection.duration });
    const time = advanceActionTime(duration);
    if (time.ended) {
      if (keepExplorationOpen) closeExploration();
      return;
    }
    if (!time.completed) {
      if (time.storm) {
        if (keepExplorationOpen) closeExploration();
        finishScavenge();
      }
      toast('La tempête interrompt l’examen avant que Jay ne puisse conclure.');
      return;
    }
    state.inspected.push(token);
    if (inspection.item) addItem(inspection.item);
    if (inspection.document) addDocument(inspection.document);
    if (inspection.clues) state.clues += inspection.clues;
    addLog(inspection.result);
    playSound('inspect');
    checkAchievements();
    const chapterScene = advanceCampaign();
    render();
    if (time.storm) {
      if (keepExplorationOpen) closeExploration();
      finishScavenge();
    } else if (chapterScene) {
      if (keepExplorationOpen) closeExploration();
      showDialogue(chapterScene.kicker, chapterScene.title, chapterScene.description, chapterScene.important);
    }
    else if (state.phase === 'scavenge') showPrologueDetails(zone, building);
    else {
      const currentZone = zones[zone];
      showChoices(currentZone, building);
      toast(`${inspection.name} · ${duration} minutes.`);
    }
    if (keepExplorationOpen && !chapterScene && !time.storm && $('game-dialog').open) {
      $('game-dialog').classList.add('exploration-mode');
      renderExplorationPanel(`inspection:${id}`);
    }
    if (!chapterScene && !time.storm) animateInteraction(id);
  }

  function showPrologueDetails(zone, building) {
    const zoneKey = typeof zone === 'string'
      ? zone
      : Object.keys(zones).find(key => zones[key] === zone);
    $('event-panel').classList.remove('hidden', 'scene-beat', 'important-scene');
    $('event-kicker').textContent = `JOUR ${String(state.day).padStart(2, '0')} · FOUILLE`;
    $('event-title').textContent = building.name;
    $('event-description').textContent = building.text;
    renderInspections(zone, building);
    const canReinforce = zoneKey === 'shelter' && building.id === 'room';
    const reinforceLabel = state.flags.refugeReinforced
      ? 'REFUGE DÉJÀ RENFORCÉ'
      : state.resources.materials < refugeReinforcement.action.cost.materials
        ? 'MATÉRIAUX NÉCESSAIRES'
        : `−${refugeReinforcement.action.cost.materials} MATÉRIAU · ${getActionDuration(refugeReinforcement.action)} MIN`;
    const reinforceButton = canReinforce
      ? `<button class="choice-button" type="button" data-reinforce-refuge ${state.flags.refugeReinforced || state.resources.materials < refugeReinforcement.action.cost.materials ? 'disabled' : ''}>
          <span><b>Renforcer la porte du refuge</b><small>Améliore sa solidité et réduit la pression de la tempête à 17:00.</small></span>
          <span class="choice-cost">${reinforceLabel}</span>
        </button>`
      : '';
    const distressButton = zoneKey === 'radio' && building.id === 'antenna'
      && state.flags.distressSignalAvailable && !state.flags.distressSignalContacted
      ? `<button class="choice-button" type="button" data-distress-signal><span><b>Répondre à l’appel de détresse</b><small>Une voix de l’oasis demande de l’aide. La liaison risque de couper.</small></span><span class="choice-cost">8 MIN →</span></button>`
      : '';
    $('choice-list').innerHTML = `<button class="choice-button" type="button" data-open-exploration><span><b>Explorer la pièce</b><small>Ouvre les meubles et examine les détails visibles.</small></span><span class="choice-cost">→</span></button>${reinforceButton}${distressButton}<button class="choice-button dialogue-continue" type="button" data-dialogue-close><span><b>Continuer la fouille</b><small>La route attend.</small></span><span class="choice-cost">→</span></button>`;
    safeSave();
    $('event-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function reinforceRefuge() {
    if (state.phase !== 'scavenge' || state.position !== 'shelter'
      || state.selectedZone !== 'shelter' || state.currentSite !== 'room') return;
    const action = refugeReinforcement.action;
    if (state.flags.refugeReinforced) {
      toast('Le refuge est déjà renforcé.');
      return;
    }
    if (state.resources.materials < action.cost.materials) {
      toast('Jay a besoin d’un matériau pour renforcer le refuge.');
      return;
    }
    const time = advanceActionTime(getActionDuration(action));
    if (time.ended) return;
    if (!time.completed) {
      if (time.storm) finishScavenge();
      toast('La tempête interrompt les travaux avant leur achèvement.');
      return;
    }
    for (const [resource, amount] of Object.entries(action.cost)) {
      state.resources[resource] -= amount;
    }
    applyAction(action);
    state.flags.refugeReinforced = true;
    addLog(action.log);
    playSound('choice');
    render();
    if (time.storm) finishScavenge();
    else showPrologueDetails(zones.shelter, zones.shelter.buildings.find(building => building.id === 'room'));
    toast('Le refuge est renforcé. La tempête sera moins éprouvante ici.');
  }

  function answerPreStormDistressSignal() {
    if (state.phase !== 'scavenge' || state.clockMinutes < 16 * 60 + 30
      || state.position !== 'radio' || state.currentSite !== 'antenna'
      || state.flags.distressSignalContacted) return;
    const duration = 8;
    const time = advanceActionTime(duration);
    if (time.ended) return;
    if (!time.completed) {
      if (time.storm) finishScavenge();
      toast('La fréquence s’effondre avant que Jay puisse répondre. L’appel pourra peut-être être retrouvé après la tempête.');
      return;
    }
    state.flags.distressSignalContacted = true;
    state.flags.rescueSignalAnswered = true;
    state.trust = clamp(state.trust + 1, 0, 5);
    state.morale = clamp(state.morale + 4);
    addLog('Jay répond à Leïla sur la fréquence 09. Elle confirme que les familles sont à l’oasis et qu’elles ont besoin d’aide.');
    checkAchievements();
    render();
    safeSave();
    if (time.storm) finishScavenge();
    else showPrologueDetails(zones.radio, zones.radio.buildings.find(item => item.id === 'antenna'));
  }

  function animateInteraction(kind) {
    const panel = $('event-panel');
    panel.dataset.interaction = kind;
    panel.classList.remove('interaction-beat');
    void panel.offsetWidth;
    panel.classList.add('interaction-beat');
    window.setTimeout(() => panel.classList.remove('interaction-beat'), 500);
  }

  function showChoices(zone, building) {
    const choices = getBuildingChoices(state.selectedZone, building);
    $('event-panel').classList.remove('hidden', 'scene-beat', 'important-scene');
    $('event-kicker').textContent = `JOUR ${String(state.day).padStart(2, '0')} — ${zone.name.toUpperCase()}`;
    $('event-title').textContent = building.name;
    const puzzleStep = state.flags.puzzleStep || 0;
    $('event-description').textContent = state.selectedZone === 'canyon' && building.id === 'arches'
      ? `Signe ${puzzleStep + 1} sur 3. ${building.text}`
      : state.selectedZone === 'radio' && state.flags.relayDamaged
        ? `${building.text} Un éclair a fendu le boîtier; chaque rafale coupe le signal.`
        : building.text;
    renderInspections(zone, building);
    const explorationChoice = state.phase === 'scavenge'
      ? '<button class="choice-button" type="button" data-open-exploration><span><b>Explorer la pièce</b><small>Reprendre la fouille détaillée et examiner les objets restants.</small></span><span class="choice-cost">→</span></button>'
      : '';
    $('choice-list').innerHTML = explorationChoice + choices.map((choice, index) => {
      const missing = unmetRequirements(choice.action);
      const cost = Object.entries(choice.action.cost || {})
        .map(([resource, amount]) => `−${amount} ${resourceNames[resource]}`).join(' · ');
      const duration = getActionDuration(choice.action);
      const label = missing[0] || [cost, `${duration} MIN`].filter(Boolean).join(' · ');
      return `<button class="choice-button" type="button" data-choice="${index}" ${missing.length ? 'disabled' : ''}>
        <span><b>${escapeHtml(choice.title)}</b><small>${escapeHtml(choice.detail)}</small></span>
        <span class="choice-cost">${escapeHtml(label)} →</span>
      </button>`;
    }).join('');
    renderMap();
    safeSave();
    $('event-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    playSound('panel');
  }

  function showDialogue(kicker, title, description, important = false) {
    state.pendingScene = { kicker, title, description, important };
    $('event-panel').classList.remove('hidden');
    $('event-panel').classList.add('scene-beat');
    $('event-panel').classList.toggle('important-scene', important);
    $('event-kicker').textContent = kicker;
    $('event-title').textContent = title;
    $('event-description').textContent = description;
    $('inspection-list').classList.add('hidden');
    setSpeaker(kicker.includes('02') ? 'MIRA' : 'JAY', kicker.includes('02') ? 'ÉCLAIREUSE · FRÉQUENCE 09' : 'TÉMOIN · CARNET PERSONNEL', kicker.includes('02') ? 'M' : 'J');
    $('choice-list').innerHTML = '<button class="choice-button dialogue-continue" type="button" data-dialogue-close><span><b>Continuer</b><small>La route attend.</small></span><span class="choice-cost">→</span></button>';
    $('event-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    playSound(important ? 'chapter' : 'dialogue');
    safeSave();
  }

  function showEncounter(encounter) {
    state.activeEncounter = encounter;
    $('event-panel').classList.remove('hidden', 'scene-beat');
    $('event-panel').classList.add('important-scene');
    $('event-kicker').textContent = `IMPRÉVU · JOUR ${String(state.day).padStart(2, '0')}`;
    $('event-title').textContent = encounter.title;
    $('event-description').textContent = encounter.description;
    $('inspection-list').classList.add('hidden');
    setSpeaker(encounter.title.includes('Leïla') ? 'LEÏLA' : 'JAY', encounter.title.includes('Leïla') ? 'MÉDECIN · CAMP DE L’OASIS' : 'SURVIVANT · EN DÉPLACEMENT', encounter.title.includes('Leïla') ? 'L' : 'J');
    $('choice-list').innerHTML = encounter.choices.map((choice, index) => {
      const missing = unmetRequirements(choice.action);
      const label = missing[0] || Object.entries(choice.action.cost || {})
        .map(([resource, amount]) => `−${amount} ${resourceNames[resource]}`).concat(`${getActionDuration(choice.action)} MIN`).join(' · ');
      return `<button class="choice-button" type="button" data-encounter-choice="${index}" ${missing.length ? 'disabled' : ''}>
        <span><b>${escapeHtml(choice.title)}</b><small>${escapeHtml(choice.detail)}</small></span>
        <span class="choice-cost">${escapeHtml(label)} →</span>
      </button>`;
    }).join('');
    playSound('event');
    safeSave();
  }

  function applyAction(action) {
    for (const [key, amount] of Object.entries(action.effect || {})) {
      if (key === 'health' || key === 'morale' || key === 'base' || key === 'stress') {
        state[key] = clamp(state[key] + amount);
      } else if (key === 'route' || key === 'clues') {
        state[key] = Math.max(0, state[key] + amount);
      } else if (key === 'trust') {
        state.trust = clamp(state.trust + amount, 0, 5);
      } else if (key in state.resources) {
        state.resources[key] = Math.max(0, state.resources[key] + amount);
      }
    }
    Object.assign(state.flags, action.flags || {});
  }

  function advanceCampaign() {
    if (state.chapter === 1 && state.clues >= 2 && state.flags.miraContact) {
      state.chapter = 2;
      state.resources.water += 1;
      state.morale = clamp(state.morale + 5);
      addLog('Mira confirme la route des gorges. Une cache d’eau attend Jay à l’entrée du passage.');
      return {
        kicker: 'CHAPITRE 02 · LES VOIX DE LA PIERRE',
        title: '« La carte ne raconte pas tout. »',
        description: 'Mira réapparaît sur la fréquence : « Le convoi est passé par les gorges. Les trois arches sont un vieux verrou ferroviaire. Si tu lis les signes, tu nous retrouveras. »'
      };
    }
    if (state.chapter === 2 && state.flags.puzzleSolved) {
      state.chapter = 3;
      state.route += 1;
      state.health = clamp(state.health + 5);
      addLog('Le passage des gorges est ouvert. Au-delà, la lumière du poste-frontière répond au convoi.');
      return {
        kicker: 'CHAPITRE 03 · LA DERNIÈRE TRAVERSÉE',
        title: 'Le convoi n’a jamais disparu',
        description: 'Derrière les arches, Jay découvre le registre des familles. Mira n’a pas fui : elle a protégé le groupe. La frontière est proche. Il reste à décider qui Jay emmènera avec lui.',
        important: true
      };
    }
    return null;
  }

  function checkEndingConditions() {
    if (state.health <= 0 || state.morale <= 0) {
      endGame('lost');
      return true;
    }
    return false;
  }

  function chooseAction(index) {
    const key = state.selectedZone;
    const zone = zones[key];
    const building = zone?.buildings.find(item => item.id === state.currentSite);
    const choice = building && getBuildingChoices(key, building)[index];
    if (!choice) return;
    const action = choice.action;
    const missing = unmetRequirements(action);
    if (missing.length) {
      toast(missing[0]);
      return;
    }
    if (action.puzzleSymbol) {
      choosePuzzleSymbol(action.puzzleSymbol, zone, building);
      return;
    }
    for (const [resource, amount] of Object.entries(action.cost || {})) {
      state.resources[resource] -= amount;
    }
    if (advanceActionTime(getActionDuration(action)).ended) return;
    applyAction(action);
    addLog(action.log);
    playSound(action.ending ? 'ending' : 'choice');
    if (action.ending) {
      endGame(action.ending);
      return;
    }

    const token = storySiteToken(key, building.id);
    if (action.keepSite) {
      render();
      safeSave();
      showChoices(zone, building);
      toast('La fréquence reste ouverte. Jay peut poursuivre l’échange.');
      return;
    }
    if (!building.repeatable && !action.retryable && !state.visited.includes(token)) state.visited.push(token);
    state.currentSite = null;
    const chapterScene = advanceCampaign();
    discoverLocations();
    checkAchievements();
    if (checkEndingConditions()) return;

    state.selectedZone = null;
    state.activeEncounter = null;
    state.pendingScene = null;
    $('event-panel').classList.add('hidden');
    render();
    safeSave();
    if (chapterScene) {
      showDialogue(chapterScene.kicker, chapterScene.title, chapterScene.description, chapterScene.important);
    } else {
      maybeTriggerEncounter();
      toast(`Jour ${state.day} : le vent se rapproche. Jay doit continuer.`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function choosePuzzleSymbol(symbol, zone, building) {
    const sequence = ['star', 'source', 'sun'];
    const step = state.flags.puzzleStep || 0;
    if (advanceActionTime(symbol === sequence[step] ? 4 : 8).ended) return;
    if (symbol !== sequence[step]) {
      state.flags.puzzleStep = 0;
      state.health = clamp(state.health - 7);
      state.stress = clamp(state.stress + 8);
      addLog('La mauvaise arche libère une rafale de sable. La séquence se réinitialise, mais Jay peut encore essayer.');
      playSound('event');
      checkAchievements();
      if (checkEndingConditions()) return;
      render();
      showChoices(zone, building);
      safeSave();
      toast('La pierre se referme. Relis les signes et recommence la séquence.');
      return;
    }

    state.flags.puzzleStep = step + 1;
    playSound('choice');
    if (state.flags.puzzleStep < sequence.length) {
      addLog(`Le signe ${state.flags.puzzleStep} s’allume. Les arches vibrent sous la roche.`);
      render();
      showChoices(zone, building);
      safeSave();
      toast(`Premier signe reconnu : ${state.flags.puzzleStep}/3.`);
      return;
    }

    state.flags.puzzleSolved = true;
    delete state.flags.puzzleStep;
    state.route += 1;
    state.trust = clamp(state.trust + 1, 0, 5);
    state.morale = clamp(state.morale + 5);
    addLog('Les trois arches s’ouvrent. Derrière, Jay découvre le registre du convoi : Mira a conduit les familles jusqu’à la frontière.');
    state.visited.push(storySiteToken(state.selectedZone, building.id));
    state.currentSite = null;
    const chapterScene = advanceCampaign();
    discoverLocations();
    checkAchievements();
    if (checkEndingConditions()) return;
    state.selectedZone = null;
    $('event-panel').classList.add('hidden');
    render();
    safeSave();
    if (chapterScene) showDialogue(chapterScene.kicker, chapterScene.title, chapterScene.description, chapterScene.important);
  }

  function advanceRandomSeed() {
    state.randomSeed = (Math.imul(state.randomSeed || 1, 1664525) + 1013904223) >>> 0;
    return state.randomSeed / 4294967296;
  }

  function maybeTriggerEncounter() {
    if (state.chapter < 2 || state.encounterDays.includes(state.day)) return;
    state.encounterDays.push(state.day);
    if (advanceRandomSeed() > 0.32) {
      safeSave();
      return;
    }
    const encounter = encounters[Math.floor(advanceRandomSeed() * encounters.length)];
    showEncounter(encounter);
  }

  function animateArrival() {
    const map = $('map');
    map.classList.remove('arrival-beat');
    void map.offsetWidth;
    map.classList.add('arrival-beat');
    window.setTimeout(() => map.classList.remove('arrival-beat'), 900);
    $('game-screen').classList.remove('scene-transition');
    void $('game-screen').offsetWidth;
    $('game-screen').classList.add('scene-transition');
    window.setTimeout(() => $('game-screen').classList.remove('scene-transition'), 700);
  }

  function maybeTriggerAtmosphereCue() {
    if (state.phase !== 'story' || state.flags.nightFigureSeen
      || state.clockMinutes < 19 * 60 || state.stress < 55
      || !['village', 'depot', 'canyon'].includes(state.position)) return;
    state.flags.nightFigureSeen = true;
    addLog('Dans la poussière, une silhouette semble marcher derrière Jay. Quand il se retourne, la piste est vide.');
    playSound('distant');
    if (!reduceMotion) {
      const effect = $('atmosphere-beat');
      effect.classList.remove('figure-active');
      void effect.offsetWidth;
      effect.classList.add('figure-active');
      window.clearTimeout(atmosphereTimer);
      atmosphereTimer = window.setTimeout(() => effect.classList.remove('figure-active'), 3000);
    }
    safeSave();
  }

  function resolveEncounter(index) {
    const choice = state.activeEncounter?.choices[index];
    if (!choice) return;
    const missing = unmetRequirements(choice.action);
    if (missing.length) {
      toast(missing[0]);
      return;
    }
    for (const [resource, amount] of Object.entries(choice.action.cost || {})) {
      state.resources[resource] -= amount;
    }
    if (advanceActionTime(getActionDuration(choice.action)).ended) return;
    applyAction(choice.action);
    addLog(choice.action.log);
    state.activeEncounter = null;
    const scene = advanceCampaign();
    checkAchievements();
    if (checkEndingConditions()) return;
    render();
    safeSave();
    if (scene) showDialogue(scene.kicker, scene.title, scene.description, scene.important);
    else toast('Jay reprend la route.');
  }

  function startNew() {
    mapZoom = 1;
    mapOffset = { x: 0, y: 0 };
    selectedEvidence.clear();
    Object.assign(state, createInitialState(), {
      phase: 'scavenge',
      randomSeed: Math.floor(Math.random() * 0xffffffff)
    });
    addLog('Jay a rejoint le refuge. La tempête est attendue à 17:00.');
    document.body.classList.add('scene-launch');
    window.setTimeout(() => document.body.classList.remove('scene-launch'), 950);
    showScreen('game');
    render();
    safeSave();
    playSound('start');
    toast('Prologue : tu as 2 h 30 de temps de jeu avant la tempête. Le temps s’arrête quand tu n’agis pas.');
  }

  function finishScavenge() {
    if (state.phase !== 'scavenge') return;
    const sheltered = isStormShelter(state.position);
    const stormStress = Math.max(8, 25 - (state.position === 'shelter'
      ? Math.round(state.base * 0.15)
      : sheltered ? 8 : 0));
    state.phase = 'story';
    state.chapter = 1;
    state.stress = clamp(state.stress + stormStress);
    state.flags.stormOngoing = true;
    state.flags.stormShelterSecured = sheltered;
    state.flags.distressSignalAvailable = true;
    if (state.flags.distressSignalContacted) state.flags.rescueSignalAnswered = true;
    state.flags.relayDamaged = true;
    if (sheltered) {
      addLog(`Jay tient dans ${zones[state.position].name}. La structure le protège des pires rafales.`);
    } else {
      const damage = Math.ceil(8 * (difficulty === 'story' ? 0.5 : difficulty === 'survival' ? 1.5 : 1));
      state.health = clamp(state.health - damage);
      addLog('Jay est surpris loin du refuge. Le sable le blesse avant qu’il ne trouve un abri.');
    }
    state.selectedZone = null;
    state.currentSite = null;
    state.pendingScene = null;
    state.flags.stormPassed = true;
    addDocument('railwayNote');
    discoverLocations();
    addLog('Une muraille de sable engloutit le secteur. Un éclair endommage le relais 09; au milieu des parasites, une voix appelle à l’aide.');
    if (!state.flags.stormCinematicPlayed) {
      state.flags.stormCinematicPlayed = true;
      playStormCinematic();
      playSound('storm');
    }
    if (checkEndingConditions()) return;
    render();
    safeSave();
    showDialogue(
      'CHAPITRE 01 · LA PISTE DU SUD',
      'Quelqu’un répond sur la fréquence 09',
      `${sheltered
        ? 'Les murs de l’abri vibrent sous le choc. '
        : 'Jay est blessé par la première rafale et doit trouver un abri au plus vite. '}` +
        'Le relais 09 grésille : Mira parle du convoi disparu, puis une seconde voix — Leïla — demande de l’aide depuis l’oasis. La tempête continue; le secteur ne s’est pas encore tu.',
      true
    );
  }

  function playStormCinematic() {
    const overlay = $('storm-cinematic');
    window.clearTimeout(stormCinematicTimer);
    overlay.classList.remove('active');
    void overlay.offsetWidth;
    overlay.classList.add('active');
    stormCinematicTimer = window.setTimeout(() => {
      overlay.classList.remove('active');
    }, reduceMotion ? 1800 : 6200);
  }

  function selectZone(key) {
    if (state.phase === 'welcome' || state.phase === 'ending') return;
    if (state.activeEncounter) {
      toast('Choisis une réponse à l’imprévu avant de reprendre la route.');
      return;
    }
    const zone = zones[key];
    if (!zone || !state.discovered.includes(key)) return;
    state.selectedZone = key;
    state.currentSite = null;
    state.activeEncounter = null;
    state.pendingScene = null;
    $('event-panel').classList.add('hidden');
    showPlace(key);
    $('place-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    safeSave();
    playSound('map');
    toast(key === state.position ? `Jay se trouve à ${zone.name}.` : `Destination : ${zone.name}. Vérifie le trajet avant de partir.`);
  }

  function travelTo(destination) {
    if (!zones[destination] || !state.discovered.includes(destination)) return;
    if (state.activeEncounter) {
      toast('Réponds à l’imprévu avant de reprendre la route.');
      return;
    }
    if (destination === state.position) return;
    const route = findRoute(state.position, destination);
    if (!route) {
      toast('Aucun chemin connu ne relie ces lieux.');
      return;
    }
    const weatherAtDeparture = getWeatherProfile();
    const stormWasActive = state.flags.stormOngoing;
    const origin = state.position;
    const minutes = travelDuration(route.route, route.km);
    const result = advanceActionTime(minutes);
    if (result.ended) return;
    if (!result.completed) {
      if (result.storm) finishScavenge();
      toast(`La tempête coupe la route après ${result.elapsed} minutes. Jay n’a pas atteint sa destination.`);
      return;
    }
    state.position = destination;
    state.selectedZone = destination;
    state.currentSite = null;
    state.discovered = Array.from(new Set([...state.discovered, destination]));
    secureStormShelter(destination);
    if (!resolveStormTravel(origin, destination, route.km, weatherAtDeparture, stormWasActive)) return;
    render();
    safeSave();
    animateArrival();
    maybeTriggerAtmosphereCue();
    playSound('travel');
    toast(`Jay rejoint ${zones[destination].name} après ${minutes} minutes de marche (${route.km.toFixed(1)} km).`);
    if (result.storm) finishScavenge();
  }

  function selectBuilding(id) {
    const key = state.selectedZone;
    const zone = zones[key];
    const building = zone?.buildings.find(item => item.id === id);
    if (!building || zone.minChapter > state.chapter || state.position !== key) return;
    const token = `${key}:${id}`;
    if (state.phase === 'scavenge') {
      if (state.searched.includes(token)) {
        toast('Ce bâtiment a déjà été fouillé.');
        return;
      }
      const duration = building.searchMinutes || 12;
      const time = advanceActionTime(duration);
      if (time.ended) return;
      if (!time.completed) {
        finishScavenge();
        toast('La tempête surprend Jay avant la fin de la fouille.');
        return;
      }
      state.searched.push(token);
      state.currentSite = id;
      for (const [resource, amount] of Object.entries(building.loot || {})) {
        state.resources[resource] += amount;
      }
      state.stress = clamp(state.stress + 7);
      const loot = Object.entries(building.loot || {})
        .map(([resource, amount]) => `+${amount} ${resourceNames[resource]}`).join(', ');
      addLog(`${building.name} : ${loot || 'aucune ressource'}.`);
      checkAchievements();
      render();
      safeSave();
      playSound('search');
      toast(`Fouille terminée · ${duration} min : ${loot || 'aucune ressource'}.`);
      if (time.storm) finishScavenge();
      else {
        showPrologueDetails(zone, building);
        animateInteraction(id);
        openExploration();
      }
      return;
    }
    const distressRevisit = key === 'radio' && id === 'antenna'
      && state.flags.stormPassed && !state.flags.rescueSignalAnswered;
    if (state.phase !== 'story' || (state.visited.includes(storySiteToken(key, id)) && !distressRevisit)) return;
    state.currentSite = id;
    renderSitePlan(key);
    showChoices(zone, building);
    animateInteraction(id);
    openExploration();
  }

  function endGame(result) {
    state.phase = 'ending';
    state.ending = result;
    const endings = {
      'escape-alone': {
        title: 'JAY S’EST<br><em>ÉCHAPPÉ.</em>',
        kicker: 'UNE VIE À RECONSTRUIRE',
        text: 'Jay franchit la frontière seul. Il a survécu, mais la fréquence 09 continue de grésiller dans sa mémoire.'
      },
      'escape-together': {
        title: 'ILS ONT<br><em>TRAVERSÉ.</em>',
        kicker: 'UNE ROUTE PARTAGÉE',
        text: 'Mira rejoint Jay. Ensemble, ils guident le convoi vers un refuge sûr. Pour la première fois, personne ne marche seul.'
      },
      'escape-caravan': {
        title: 'PERSONNE<br><em>NE RESTE.</em>',
        kicker: 'LA CARAVANE DES VEILLEURS',
        text: 'Jay, Mira et Leïla ouvrent la route aux familles. Ce n’est plus une fuite : c’est le premier jour d’un nouveau foyer.'
      },
      lost: {
        title: 'LA TEMPÊTE<br><em>L’A RATTRAPÉ.</em>',
        kicker: 'FIN DE L’HISTOIRE',
        text: `Jay n’a plus la force de continuer après ${state.day} jours. La tempête a gagné, mais chaque piste découverte restera dans son journal.`
      }
    };
    const ending = endings[result] || endings.lost;
    $('ending-kicker').textContent = ending.kicker;
    $('ending-title').innerHTML = ending.title;
    $('ending-text').textContent = ending.text;
    $('ending-stats').innerHTML = `
      <div><b>${state.day}</b><small>JOURS SURVÉCUS</small></div>
      <div><b>${state.clues}</b><small>PISTES TROUVÉES</small></div>
      <div><b>${state.achievements.length}</b><small>SUCCÈS</small></div>`;
    if (result !== 'lost') {
      unlockAchievement('escape');
      try {
        localStorage.removeItem(activeSaveKey());
      } catch (error) {
        console.error('La sauvegarde terminée n’a pas pu être nettoyée.', error);
      }
    } else safeSave();
    showScreen('ending');
    updateStorm();
    playSound(result === 'lost' ? 'defeat' : 'ending');
  }

  function resume() {
    if (!loadSave()) {
      toast('Aucune sauvegarde valide n’a été trouvée.');
      return;
    }
    showScreen(state.phase === 'ending' ? 'ending' : 'game');
    render();
    if (state.phase === 'scavenge' && state.clockMinutes >= STORM_DEADLINE) {
      finishScavenge();
      return;
    }
    if (state.phase === 'ending') endGame(state.ending || 'lost');
    else if (state.activeEncounter) showEncounter(state.activeEncounter);
    else if (state.pendingScene) {
      const scene = state.pendingScene;
      showDialogue(scene.kicker, scene.title, scene.description, scene.important);
    }
    else if (state.currentSite && state.selectedZone) {
      const zone = zones[state.selectedZone];
      const building = zone?.buildings.find(item => item.id === state.currentSite);
      if (zone && building) {
        if (state.phase === 'scavenge') showPrologueDetails(zone, building);
        else showChoices(zone, building);
      }
    } else toast('Sauvegarde chargée. La route reprend là où Jay l’a laissée.');
  }

  function updateStorm() {
    const canvas = $('sandstorm');
    const weather = getWeatherProfile();
    document.documentElement.dataset.weather = weather.stage;
    document.documentElement.style.setProperty('--weather-intensity', String(weather.intensity));
    canvas.classList.toggle('calm', weather.intensity < 0.18);
    canvas.style.opacity = String(0.12 + weather.intensity * 0.72);
    document.body.classList.toggle('critical', state.stress >= 65);
    if (audioContext && ambientFilter && ambientGain) {
      const locationTone = { shelter: 230, market: 390, clinic: 310, depot: 470, village: 360, radio: 520, canyon: 290, oasis: 610, border: 440 };
      const night = state.clockMinutes >= 19 * 60 || state.clockMinutes < 6 * 60;
      const cutoff = state.phase === 'welcome' ? 190 : Math.max(130, (locationTone[state.position] || 340) - (night ? 100 : 0) + weather.intensity * 210);
      ambientFilter.frequency.setTargetAtTime(cutoff, audioContext.currentTime, 0.8);
      ambientGain.gain.setTargetAtTime($('game-dialog').open
        ? 0
        : state.phase === 'welcome' ? 0.05 : (night ? 0.1 : 0.12) + weather.intensity * 0.1,
      audioContext.currentTime,
      1);
      if (stormGain) stormGain.gain.setTargetAtTime(
        soundEnabled && !$('game-dialog').open ? weather.intensity * 0.22 : 0,
        audioContext.currentTime,
        0.7
      );
    }
    syncStormAnimation();
  }

  function initStorm() {
    const canvas = $('sandstorm');
    const context = canvas.getContext('2d');
    if (!context) return;
    let width = innerWidth;
    let height = innerHeight;
    let ratio = Math.min(devicePixelRatio || 1, 2);
    let particles = [];
    let flash = 0;
    let nextLightning = 7000;
    const worldPaused = () => ['welcome', 'ending'].includes(state.phase) || $('game-dialog').open;

    function resize() {
      width = innerWidth;
      height = innerHeight;
      ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      particles = Array.from({ length: Math.max(24, Math.min(220, Math.floor(width * height / 8500))) }, () => ({
        x: Math.random() * width,
        y: height * (0.52 + Math.random() * 0.48),
        depth: 0.2 + Math.random() * 0.8,
        length: 3 + Math.random() * 18,
        alpha: 0.12 + Math.random() * 0.25,
        size: 0.4 + Math.random() * 1.8
      }));
    }

    let lastFrame = 0;
    let animationFrame = 0;
    function frame(timestamp) {
      animationFrame = 0;
      if (worldPaused()) return;
      const delta = Math.min((timestamp - (lastFrame || timestamp)) / 1000, 0.04);
      lastFrame = timestamp;
      const weather = getWeatherProfile();
      const intensity = weather.intensity;
      context.clearRect(0, 0, width, height);
      if (intensity > 0.02) {
        const sky = context.createLinearGradient(0, 0, 0, height);
        sky.addColorStop(0, `rgba(30,34,39,${intensity * 0.31})`);
        sky.addColorStop(0.55, `rgba(112,91,77,${intensity * 0.15})`);
        sky.addColorStop(1, `rgba(176,132,82,${intensity * 0.12})`);
        context.fillStyle = sky;
        context.fillRect(0, 0, width, height);

        if (intensity > 0.35) {
          const horizon = height * (0.66 - intensity * 0.28);
          const wave = timestamp * (0.00015 + intensity * 0.00028);
          context.beginPath();
          context.moveTo(0, height);
          context.lineTo(0, horizon);
          for (let x = 0; x <= width + 60; x += 60) {
            const crest = Math.sin(x * 0.004 + wave) * height * 0.025
              + Math.sin(x * 0.0017 - wave * 0.7) * height * 0.035;
            context.lineTo(x, horizon + crest);
          }
          context.lineTo(width, height);
          context.closePath();
          context.fillStyle = `rgba(113,91,78,${intensity * 0.2})`;
          context.fill();
        }
      }

      if (!reduceFlashes && intensity > 0.58) {
        if (timestamp >= nextLightning) {
          flash = 0.12 + Math.random() * 0.12;
          nextLightning = timestamp + 7500 + Math.random() * 10000;
        }
        flash = Math.max(0, flash - delta * 0.65);
        if (flash > 0) {
          context.fillStyle = `rgba(225,231,235,${flash * intensity})`;
          context.fillRect(0, 0, width, height);
        }
      } else flash = 0;

      for (const particle of particles) {
        const speed = 26 + intensity * 520;
        const x = particle.x;
        const y = particle.y;
        context.beginPath();
        context.moveTo(x, y);
        context.lineTo(x - particle.length * (0.4 + weather.wind), y + particle.length * 0.1);
        context.strokeStyle = `rgba(${intensity > 0.55 ? '191,177,157' : '222,177,112'},${particle.alpha * (0.22 + intensity * 1.6)})`;
        context.lineWidth = particle.size * (0.5 + particle.depth);
        context.stroke();
        if (!reduceMotion) {
          particle.x += speed * particle.depth * delta;
          particle.y += speed * particle.depth * delta * (0.025 + intensity * 0.11);
          if (particle.x > width + 30 || particle.y > height + 12) {
            particle.x = -particle.length;
            particle.y = intensity > 0.4 ? Math.random() * height : height * (0.52 + Math.random() * 0.48);
          }
        }
      }
      if (!reduceMotion) animationFrame = requestAnimationFrame(frame);
    }
    syncStormAnimation = () => {
      const paused = worldPaused();
      document.body.classList.toggle('world-paused', paused);
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      if (paused) return;
      if (reduceMotion) {
        frame(performance.now());
      } else if (!animationFrame) animationFrame = requestAnimationFrame(frame);
    };
    addEventListener('resize', () => {
      resize();
      updateStorm();
    });
    resize();
    syncStormAnimation();
  }

  let audioContext = null;
  let masterGain = null;
  let ambientSource = null;
  let ambientGain = null;
  let ambientFilter = null;
  let ambientLfo = null;
  let stormGain = null;
  let stormFilter = null;
  let stormSource = null;
  let soundEnabled = false;
  let volume = 0.35;

  function saveAudioSettings() {
    try {
      localStorage.setItem(AUDIO_KEY, JSON.stringify({ enabled: soundEnabled, volume }));
    } catch (error) {
      console.warn('Les préférences audio n’ont pas pu être sauvegardées.', error);
    }
  }

  function saveOptions() {
    try {
      localStorage.setItem(OPTIONS_KEY, JSON.stringify({ reduceMotion, reduceFlashes, textScale, difficulty }));
    } catch (error) {
      console.warn('Les options de mouvement n’ont pas pu être sauvegardées.', error);
    }
  }

  function applyMotionPreference() {
    document.body.classList.toggle('reduced-motion', reduceMotion);
    document.body.classList.toggle('reduced-flashes', reduceFlashes);
    document.documentElement.style.fontSize = `${Math.round(textScale * 100)}%`;
    const control = $('reduce-motion-toggle');
    if (control) control.checked = reduceMotion;
    const flashControl = $('reduce-flashes-toggle');
    if (flashControl) flashControl.checked = reduceFlashes;
    const textControl = $('text-scale');
    if (textControl) textControl.value = String(Math.round(textScale * 100));
    const difficultyControl = $('difficulty-select');
    if (difficultyControl) difficultyControl.value = difficulty;
    syncStormAnimation();
  }

  function setReducedMotion(value) {
    reduceMotion = Boolean(value);
    hasMotionPreference = true;
    saveOptions();
    applyMotionPreference();
  }

  function loadOptions() {
    try {
      const options = JSON.parse(localStorage.getItem(OPTIONS_KEY) || 'null');
      if (typeof options?.reduceMotion === 'boolean') {
        reduceMotion = options.reduceMotion;
        hasMotionPreference = true;
      }
      if (typeof options?.reduceFlashes === 'boolean') reduceFlashes = options.reduceFlashes;
      if (Number.isFinite(options?.textScale)) textScale = clamp(options.textScale, 0.9, 1.25);
      if (['story', 'normal', 'survival'].includes(options?.difficulty)) difficulty = options.difficulty;
    } catch (error) {
      console.warn('Les options de mouvement sont illisibles.', error);
    }
    applyMotionPreference();
  }

  function loadAudioSettings() {
    try {
      const settings = JSON.parse(localStorage.getItem(AUDIO_KEY) || 'null');
      if (settings) {
        soundEnabled = !!settings.enabled;
        volume = clamp(Number(settings.volume) * 100, 0, 100) / 100;
      }
    } catch (error) {
      console.warn('Les préférences audio sont illisibles.', error);
    }
    $('volume-range').value = String(Math.round(volume * 100));
    updateSoundButton();
  }

  function updateSoundButton() {
    $('sound-toggle').textContent = `SON : ${soundEnabled ? 'ON' : 'OFF'}`;
    $('sound-toggle').setAttribute('aria-pressed', String(soundEnabled));
  }

  function ensureAudio() {
    if (audioContext) return audioContext;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      toast('Le son n’est pas pris en charge par ce navigateur.');
      soundEnabled = false;
      updateSoundButton();
      return null;
    }
    audioContext = new AudioContextClass();
    masterGain = audioContext.createGain();
    masterGain.gain.value = soundEnabled ? volume : 0;
    masterGain.connect(audioContext.destination);

    const buffer = audioContext.createBuffer(1, audioContext.sampleRate * 2, audioContext.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = (Math.random() * 2 - 1) * 0.22;
    ambientSource = audioContext.createBufferSource();
    ambientSource.buffer = buffer;
    ambientSource.loop = true;
    ambientFilter = audioContext.createBiquadFilter();
    ambientFilter.type = 'lowpass';
    ambientFilter.frequency.value = 340;
    ambientGain = audioContext.createGain();
    ambientGain.gain.value = 0.11;
    ambientLfo = audioContext.createOscillator();
    ambientLfo.frequency.value = 0.075;
    const lfoDepth = audioContext.createGain();
    lfoDepth.gain.value = 0.035;
    ambientLfo.connect(lfoDepth);
    lfoDepth.connect(ambientGain.gain);
    ambientSource.connect(ambientFilter);
    ambientFilter.connect(ambientGain);
    ambientGain.connect(masterGain);
    stormSource = audio.createBufferSource();
    stormSource.buffer = buffer;
    stormSource.loop = true;
    stormFilter = audio.createBiquadFilter();
    stormFilter.type = 'lowpass';
    stormFilter.frequency.value = 180;
    stormGain = audio.createGain();
    stormGain.gain.value = 0;
    stormSource.connect(stormFilter);
    stormFilter.connect(stormGain);
    stormGain.connect(masterGain);
    ambientSource.start();
    stormSource.start();
    ambientLfo.start();
    return audioContext;
  }

  function playSound(kind) {
    if (!soundEnabled) return;
    const audio = ensureAudio();
    if (!audio || !masterGain) return;
    if (audio.state === 'suspended') {
      audio.resume().catch(() => toast('Impossible d’activer le son. Vérifie les réglages du navigateur.'));
    }
    const notes = {
      start: [220, 330], map: [260], search: [340, 470], panel: [290], storm: [38, 53, 71],
      dialogue: [300, 390], choice: [360], event: [180, 260], chapter: [220, 330, 440],
      achievement: [523, 659], ending: [392, 523, 659], defeat: [220, 164],
      travel: [82, 196, 247], inspect: [190, 440, 554], read: [294, 370],
      distant: [73, 110, 147]
    }[kind] || [300];
    notes.forEach((frequency, index) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const panner = kind === 'distant' && audio.createStereoPanner ? audio.createStereoPanner() : null;
      oscillator.type = ['event', 'defeat', 'distant', 'storm'].includes(kind) ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      const start = audio.currentTime + index * 0.075;
      if (panner) panner.pan.value = Math.random() < 0.5 ? -0.78 : 0.78;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(kind === 'distant' ? 0.045 : kind === 'storm' ? 0.06 : 0.12, start + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + (kind === 'distant' ? 0.9 : kind === 'storm' ? 1.35 : 0.28));
      oscillator.connect(gain);
      if (panner) {
        gain.connect(panner);
        panner.connect(masterGain);
      } else gain.connect(masterGain);
      oscillator.start(start);
      oscillator.stop(start + (kind === 'distant' ? 0.92 : 0.3));
    });
    if (['search', 'inspect', 'travel', 'distant', 'storm'].includes(kind) && ambientSource?.buffer) {
      const noise = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const envelope = audio.createGain();
      const panner = kind === 'distant' && audio.createStereoPanner ? audio.createStereoPanner() : null;
      noise.buffer = ambientSource.buffer;
      filter.type = 'bandpass';
      filter.frequency.value = kind === 'travel' ? 185 : kind === 'storm' ? 110 : kind === 'distant' ? 420 : 780;
      filter.Q.value = kind === 'distant' ? 0.45 : 0.8;
      envelope.gain.setValueAtTime(0.0001, audio.currentTime);
      envelope.gain.exponentialRampToValueAtTime(kind === 'distant' ? 0.025 : kind === 'storm' ? 0.09 : 0.055, audio.currentTime + 0.025);
      envelope.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (kind === 'distant' ? 1.1 : kind === 'storm' ? 1.35 : 0.24));
      noise.connect(filter);
      filter.connect(envelope);
      if (panner) {
        panner.pan.value = Math.random() < 0.5 ? -0.86 : 0.86;
        envelope.connect(panner);
        panner.connect(masterGain);
      } else envelope.connect(masterGain);
      noise.start(audio.currentTime, Math.random() * 1.5, kind === 'distant' ? 1.1 : kind === 'storm' ? 1.35 : 0.24);
      noise.stop(audio.currentTime + (kind === 'distant' ? 1.1 : kind === 'storm' ? 1.35 : 0.24));
    }
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    if (soundEnabled) {
      const audio = ensureAudio();
      if (audio && masterGain) {
        masterGain.gain.setTargetAtTime(volume, audio.currentTime, 0.08);
        audio.resume().catch(() => toast('Le navigateur a bloqué l’audio.'));
      }
    } else if (audioContext && masterGain) {
      masterGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.08);
    }
    updateSoundButton();
    saveAudioSettings();
    if (soundEnabled) playSound('map');
    updateStorm();
    toast(soundEnabled ? 'Ambiance sonore activée.' : 'Son coupé.');
  }

  function renderInventoryPanel() {
    const items = Object.entries(state.inventory).filter(([, amount]) => amount > 0);
    const categories = Array.from(new Set(items.map(([id]) => itemCatalog[id].category)));
    const itemMarkup = items.length ? categories.map(category => `<h3>${escapeHtml(category)}</h3>${items.filter(([id]) => itemCatalog[id].category === category).map(([id, amount]) => {
      const item = itemCatalog[id];
      return `<article class="inventory-item"><span class="item-icon">${item.icon}</span><div class="inventory-copy"><b>${escapeHtml(item.name)} <small>×${amount}</small></b><p>${escapeHtml(item.description)}</p><span>${item.weight.toFixed(1)} kg</span></div><div class="inventory-actions"><button type="button" data-item-inspect="${id}">EXAMINER · 2 MIN</button><button type="button" data-item-use="${id}">UTILISER</button><label><input type="checkbox" data-combine-item="${id}"> COMBINER</label></div></article>`;
    }).join('')}`).join('') : '<p class="empty-state">Le sac est vide. Jay peut trouver des objets en examinant les lieux.</p>';
    $('dialog-content').innerHTML = `<div class="inventory-summary"><span>POIDS DU SAC</span><b>${inventoryWeight().toFixed(1)} / 8 KG</b><i style="--weight:${Math.min(100, inventoryWeight() / 8 * 100)}%"></i></div><div class="inventory-list">${itemMarkup}</div><div class="combine-row"><p>RECETTE · BANDE DE TOILE + CHARBON FILTRANT = FILTRE ARTISANAL</p><button type="button" id="combine-items" ${state.inventory.cloth && state.inventory.charcoal ? '' : 'disabled'}>ASSEMBLER LA SÉLECTION · 5 MIN</button></div><h3>DOCUMENTS CONSERVÉS</h3>${renderDocumentList()}`;
  }

  function renderDocumentList() {
    if (!state.documents.length) return '<p class="empty-state">Aucun document trouvé. Les papiers et objets consultés seront conservés ici.</p>';
    return `<div class="document-list">${state.documents.map(id => {
      const document = documentCatalog[id];
      if (!document) return '';
      const read = state.readDocuments.includes(id);
      return `<article class="document-card"><div><b>${escapeHtml(document.title)}</b><small>${escapeHtml(document.source)}</small>${read ? `<p>${escapeHtml(document.content)}</p>` : '<p>Contenu non consulté · 2 minutes pour lire</p>'}</div><button type="button" data-read-document="${id}" ${read ? 'disabled' : ''}>${read ? 'LU' : 'LIRE · 2 MIN'}</button></article>`;
    }).join('')}</div>`;
  }

  function renderJournalPanel() {
    const visited = state.visited.map(token => {
      const [zoneId] = token.split(':');
      return zones[zoneId]?.name;
    }).filter(Boolean);
    const mission = $('main-quest').textContent;
    const linkOptions = state.documents.map(id => {
      const document = documentCatalog[id];
      return `<label class="evidence-choice"><input type="checkbox" data-evidence="${id}" ${selectedEvidence.has(id) ? 'checked' : ''}><span><b>${escapeHtml(document.title)}</b><small>${escapeHtml(document.source)}</small></span></label>`;
    }).join('');
    const links = state.linkedEvidence.map(id => `<p class="linked-evidence">✳ ${escapeHtml(id === 'vanished-convoy' ? 'Le convoi a été effacé des registres, pas détruit.' : id === 'allies' ? 'Mira et Leïla organisaient ensemble l’évacuation.' : 'La réserve de l’oasis a été déplacée avant la fuite.')}</p>`).join('');
    $('dialog-content').innerHTML = `<section class="journal-mission"><span>OBJECTIF ACTUEL · CHAPITRE 0${state.chapter}</span><b>${escapeHtml(mission)}</b><small>${zones[state.position]?.name || 'Position inconnue'} · ${formatClock()} · ${state.elapsedMinutes} min écoulées</small></section><h3>TABLEAU D’ENQUÊTE</h3><p class="panel-hint">Relie au moins deux documents pour tester une hypothèse. La consultation du tableau ne fait pas avancer le temps.</p><div class="evidence-grid">${linkOptions || '<p class="empty-state">Trouve des documents dans les lieux pour commencer l’enquête.</p>'}</div><button type="button" id="connect-evidence" ${state.documents.length < 2 ? 'disabled' : ''}>RELIER LES DOCUMENTS SÉLECTIONNÉS</button><div class="linked-list">${links}</div><h3>JOURNAL DE JAY</h3><div class="full-journal">${state.journal.map(line => `<p>${escapeHtml(line)}</p>`).join('') || '<p class="empty-state">Aucun événement enregistré.</p>'}</div><h3>LIEUX EXPLORÉS</h3><p class="visited-list">${Array.from(new Set(visited)).map(escapeHtml).join(' · ') || 'Aucun lieu encore exploré.'}</p>`;
  }

  function renderLoadPanel() {
    $('dialog-content').innerHTML = `<p class="panel-hint">Choisis un emplacement pour reprendre exactement la progression correspondante. Les emplacements restent indépendants.</p><div class="load-slots">${SAVE_SLOT_KEYS.map((_, index) => {
      const slot = index + 1;
      const info = getSaveSlotInfo(slot);
      return `<button type="button" class="load-slot" data-load-slot="${slot}" ${!info.available || !info.valid ? 'disabled' : ''}><b>EMPLACEMENT 0${slot}</b><small>${escapeHtml(info.summary)}</small><span>${info.available && info.valid ? 'CHARGER →' : 'INDISPONIBLE'}</span></button>`;
    }).join('')}</div>`;
  }

  function renderSettingsPanel() {
    $('dialog-content').innerHTML = `<label class="settings-row"><span>AMBIANCE &amp; EFFETS<small>Vent, pas, interactions et événements du récit.</small></span><input id="dialog-volume-range" type="range" min="0" max="100" value="${Math.round(volume * 100)}" aria-label="Volume de l’ambiance et des effets"></label><label class="settings-row"><span>RÉDUIRE LES MOUVEMENTS<small>Réduit les déplacements de caméra et les particules animées.</small></span><input id="reduce-motion-toggle" type="checkbox" ${reduceMotion ? 'checked' : ''}></label><label class="settings-row"><span>RÉDUIRE LES FLASHES<small>Désactive les éclairs lumineux de la tempête.</small></span><input id="reduce-flashes-toggle" type="checkbox" ${reduceFlashes ? 'checked' : ''}></label><label class="settings-row"><span>TAILLE DU TEXTE<small>Augmente la lisibilité des panneaux de jeu.</small></span><input id="text-scale" type="range" min="90" max="125" step="5" value="${Math.round(textScale * 100)}" aria-label="Taille du texte"></label><label class="settings-row"><span>DIFFICULTÉ MÉTÉO<small>Modifie la durée des trajets et les blessures en tempête.</small></span><select id="difficulty-select"><option value="story" ${difficulty === 'story' ? 'selected' : ''}>Récit · dégâts réduits</option><option value="normal" ${difficulty === 'normal' ? 'selected' : ''}>Normal · équilibre conseillé</option><option value="survival" ${difficulty === 'survival' ? 'selected' : ''}>Survie · dégâts renforcés</option></select></label><p class="panel-hint">Les dialogues et les sons importants sont sous-titrés ou décrits à l’écran. Le jeu respecte aussi la préférence de mouvement de ton système.</p>`;
  }

  function renderCreditsPanel() {
    $('dialog-content').innerHTML = '<div class="credits-card"><p><b>LES DERNIERS JOURS — JAY</b><br>Une aventure de survie et d’enquête originale.</p><small>Écriture, univers, carte et illustrations vectorielles : création originale du projet.<br>Ambiance et effets sonores : synthèse locale par Web Audio.<br>Aucune image ni piste audio externe. Aucun service en ligne.</small></div>';
  }

  function renderHelpPanel() {
    const targets = getObjectiveTargets().map(id => zones[id]?.name).filter(Boolean);
    $('dialog-content').innerHTML = `<div class="help-card"><p>${escapeHtml(getContextHint())}</p><small>Les indices de la carte orientent la recherche sans révéler les solutions.</small></div><h3>REPÈRES</h3><p class="panel-hint">Choisis un lieu, vérifie le trajet, puis explore les bâtiments accessibles. La carte, le journal et l’inventaire n’avancent pas l’horloge.</p><div class="help-targets">${targets.map(name => `<span>PISTE · ${escapeHtml(name.toLocaleUpperCase('fr-FR'))}</span>`).join('') || '<span>AUCUN MARQUEUR ACTIF</span>'}</div>`;
  }

  function openGamePanel(panel) {
    if (panel === 'map') {
      focusMapOnPlayer();
      $('map').scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const panels = {
      inventory: ['ÉQUIPEMENT · DOSSIERS', 'Sac de Jay'],
      journal: ['CARNET · ENQUÊTE', 'Journal de route'],
      pause: ['PAUSE · TEMPS IMMOBILE', 'Pause'],
      settings: ['CONFORT DE JEU', 'Paramètres'],
      credits: ['GÉNÉRIQUE', 'Crédits'],
      help: ['GUIDAGE SANS SOLUTION', 'Repères de Jay'],
      load: ['SAUVEGARDES LOCALES', 'Charger une partie']
    };
    const [kicker, title] = panels[panel] || panels.pause;
    $('dialog-kicker').textContent = kicker;
    $('dialog-title').textContent = title;
    if (panel === 'inventory') renderInventoryPanel();
    else if (panel === 'journal') renderJournalPanel();
    else if (panel === 'settings') renderSettingsPanel();
    else if (panel === 'credits') renderCreditsPanel();
    else if (panel === 'help') renderHelpPanel();
    else if (panel === 'load') renderLoadPanel();
    else $('dialog-content').innerHTML = `<p class="pause-copy">Le monde attend. L’horloge ne bouge pas tant que Jay n’agit pas.</p><button type="button" class="dialog-save" data-open-panel="settings">PARAMÈTRES</button><button type="button" class="dialog-save" data-save-quit>SAUVEGARDER ET QUITTER</button>`;
    const dialog = $('game-dialog');
    if (!dialog.open) dialog.showModal();
    else dialog.focus();
    updateStorm();
  }

  function inspectInventoryItem(id) {
    const item = itemCatalog[id];
    if (!item || !state.inventory[id]) return;
    if (advanceActionTime(2).ended) return;
    addLog(`Jay examine ${item.name.toLocaleLowerCase('fr-FR')} : ${item.description}`);
    playSound('inspect');
    renderInventoryPanel();
    safeSave();
  }

  function readDocument(id) {
    const document = documentCatalog[id];
    if (!document || !state.documents.includes(id) || state.readDocuments.includes(id)) return;
    if (advanceActionTime(2).ended) return;
    state.readDocuments.push(id);
    addLog(`Jay lit « ${document.title} ».`);
    playSound('read');
    if ($('game-dialog').classList.contains('exploration-mode')) renderExplorationPanel(explorationFocus);
    else renderInventoryPanel();
    safeSave();
  }

  function combineSelectedItems() {
    const selected = Array.from(document.querySelectorAll('[data-combine-item]:checked'), input => input.dataset.combineItem);
    if (!selected.includes('cloth') || !selected.includes('charcoal')
      || !state.inventory.cloth || !state.inventory.charcoal) {
      toast('Sélectionne la toile et le charbon filtrant.');
      return;
    }
    if (advanceActionTime(5).ended) return;
    state.inventory.cloth -= 1;
    state.inventory.charcoal -= 1;
    addItem('waterFilter');
    addLog('Jay assemble un filtre artisanal avec la toile et le charbon.');
    playSound('inspect');
    renderInventoryPanel();
    safeSave();
  }

  function useInventoryItem(id) {
    if (!state.inventory[id]) return;
    if (id === 'waterFilter') {
      if (state.position !== 'oasis' || state.currentSite !== 'well') {
        toast('Le filtre ne peut servir qu’à la station de pompage de l’oasis.');
        return;
      }
      if (advanceActionTime(5).ended) return;
      state.inventory[id] -= 1;
      state.resources.water += 2;
      addLog('Le filtre artisanal purifie deux gourdes à la station de pompage.');
    } else if (id === 'radioBattery') {
      if (state.position !== 'radio' || state.currentSite !== 'antenna') {
        toast('La batterie doit être installée au relais 09.');
        return;
      }
      if (advanceActionTime(3).ended) return;
      state.inventory[id] -= 1;
      state.trust = clamp(state.trust + 1, 0, 5);
      state.flags.radioPowered = true;
      addLog('Jay installe la batterie. La voix de Mira devient plus claire.');
    } else {
      toast('Cet objet ne peut pas être utilisé ici.');
      return;
    }
    playSound('choice');
    render();
    renderInventoryPanel();
    safeSave();
  }

  function connectEvidence() {
    const selected = Array.from(document.querySelectorAll('[data-evidence]:checked'), input => input.dataset.evidence);
    const links = [
      { id: 'vanished-convoy', documents: ['railwayNote', 'convoyManifest'], log: 'Le carnet et le manifeste prouvent que le convoi a été effacé des registres, pas détruit.' },
      { id: 'allies', documents: ['clinicRegister', 'familyPhotograph'], log: 'Le registre et la photographie montrent que Mira et Leïla préparaient l’évacuation ensemble.' },
      { id: 'hidden-supplies', documents: ['marketReceipt', 'clinicRegister'], log: 'Le reçu et le registre confirment que les vivres ont été déplacés vers l’oasis.' }
    ];
    const link = links.find(candidate => candidate.documents.length === selected.length
      && candidate.documents.every(id => selected.includes(id)));
    if (!link) {
      toast('Ces documents ne forment pas encore une piste cohérente.');
      return;
    }
    if (state.linkedEvidence.includes(link.id)) {
      toast('Cette hypothèse est déjà inscrite dans le carnet.');
      return;
    }
    state.linkedEvidence.push(link.id);
    if (link.id === 'vanished-convoy') state.flags.secretCode = true;
    if (link.id === 'allies') state.trust = clamp(state.trust + 1, 0, 5);
    if (link.id === 'hidden-supplies') state.resources.water += 1;
    addLog(link.log);
    safeSave();
    renderJournalPanel();
    playSound('chapter');
    toast('Une nouvelle piste est consignée dans le carnet.');
  }

  function focusMapOnPlayer() {
    const marker = document.querySelector(`.map-place[data-zone="${state.position}"]`);
    if (!marker) return;
    mapZoom = Math.max(mapZoom, 1.25);
    const x = parseFloat(marker.style.getPropertyValue('--x')) / 100 * $('map').clientWidth;
    const y = parseFloat(marker.style.getPropertyValue('--y')) / 100 * $('map').clientHeight;
    mapOffset = {
      x: -(mapZoom - 1) * (x - $('map').clientWidth / 2),
      y: -(mapZoom - 1) * (y - $('map').clientHeight / 2)
    };
    renderMap();
  }

  function setMapZoom(value) {
    mapZoom = clamp(value, 1, 1.8);
    const maxX = $('map').clientWidth * (mapZoom - 1) / 2;
    const maxY = $('map').clientHeight * (mapZoom - 1) / 2;
    mapOffset.x = clamp(mapOffset.x, -maxX, maxX);
    mapOffset.y = clamp(mapOffset.y, -maxY, maxY);
    renderMap();
  }

  function saveAndQuit() {
    safeSave();
    if ($('game-dialog').open) $('game-dialog').close();
    showScreen('welcome');
    updateContinueButton();
    toast(`Emplacement 0${selectedSlot} sauvegardé. Le temps est resté immobile.`);
  }

  $('new-game').addEventListener('click', () => {
    if (hasSavedGame() && !confirm(`Une nouvelle partie remplacera l’emplacement 0${selectedSlot}. Continuer ?`)) return;
    startNew();
  });
  $('save-slot').addEventListener('change', event => {
    selectedSlot = Number(event.target.value);
    updateContinueButton();
  });
  $('continue-game').addEventListener('click', resume);
  $('map').addEventListener('click', event => {
    const button = event.target.closest('.map-place');
    if (button && $('map').contains(button)) selectZone(button.dataset.zone);
  });
  $('building-list').addEventListener('click', event => {
    const button = event.target.closest('[data-site]');
    if (button && !button.disabled) selectBuilding(button.dataset.site);
  });
  $('travel-button').addEventListener('click', event => travelTo(event.currentTarget.dataset.destination));
  $('inspection-list').addEventListener('click', event => {
    const button = event.target.closest('[data-inspection]');
    if (button && !button.disabled) inspectObject(button.dataset.inspection);
  });
  $('site-plan').addEventListener('click', event => {
    const button = event.target.closest('[data-plan-inspection]');
    if (button && !button.disabled) inspectObject(button.dataset.planInspection);
  });
  $('choice-list').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-dialogue-close')) {
      $('event-panel').classList.add('hidden');
      state.activeEncounter = null;
      state.pendingScene = null;
      safeSave();
    } else if (button.hasAttribute('data-open-exploration')) {
      openExploration();
    } else if (button.hasAttribute('data-reinforce-refuge')) {
      reinforceRefuge();
    } else if (button.hasAttribute('data-distress-signal')) {
      answerPreStormDistressSignal();
    } else if (button.hasAttribute('data-encounter-choice')) {
      resolveEncounter(Number(button.dataset.encounterChoice));
    } else if (button.hasAttribute('data-choice')) {
      chooseAction(Number(button.dataset.choice));
    }
  });
  $('close-place').addEventListener('click', () => {
    if (state.activeEncounter) {
      toast('Réponds à l’imprévu avant de quitter le lieu.');
      return;
    }
    state.selectedZone = null;
    state.currentSite = null;
    state.activeEncounter = null;
    $('place-panel').classList.add('hidden');
    $('event-panel').classList.add('hidden');
    renderMap();
    safeSave();
  });
  $('save-quit').addEventListener('click', () => {
    saveAndQuit();
  });
  $('restart').addEventListener('click', () => {
    try {
      localStorage.removeItem(activeSaveKey());
    } catch (error) {
      console.error('La sauvegarde n’a pas pu être supprimée.', error);
    }
    mapZoom = 1;
    mapOffset = { x: 0, y: 0 };
    selectedEvidence.clear();
    Object.assign(state, createInitialState());
    updateContinueButton();
    showScreen('welcome');
    render();
  });
  document.querySelectorAll('[data-open-panel]').forEach(button => {
    button.addEventListener('click', () => openGamePanel(button.dataset.openPanel));
  });
  $('load-game').addEventListener('click', () => openGamePanel('load'));
  $('settings-button').addEventListener('click', () => openGamePanel('settings'));
  $('credits-button').addEventListener('click', () => openGamePanel('credits'));
  $('welcome-screen').addEventListener('pointermove', event => {
    if (reduceMotion || event.pointerType === 'touch') return;
    const bounds = $('welcome-screen').getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    $('welcome-screen').style.setProperty('--scene-x', `${-x * 8}px`);
    $('welcome-screen').style.setProperty('--scene-y', `${-y * 5}px`);
  });
  $('welcome-screen').addEventListener('pointerleave', () => {
    $('welcome-screen').style.removeProperty('--scene-x');
    $('welcome-screen').style.removeProperty('--scene-y');
  });
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  motionQuery.addEventListener('change', event => {
    if (!hasMotionPreference) {
      reduceMotion = event.matches;
      applyMotionPreference();
    }
  });
  $('map-zoom-in').addEventListener('click', () => setMapZoom(mapZoom + 0.15));
  $('map-zoom-out').addEventListener('click', () => setMapZoom(mapZoom - 0.15));
  $('map-center').addEventListener('click', focusMapOnPlayer);
  $('map').addEventListener('pointerdown', event => {
    if (event.target.closest('button') || mapZoom <= 1) return;
    mapDrag = { x: event.clientX, y: event.clientY, offsetX: mapOffset.x, offsetY: mapOffset.y };
    $('map').classList.add('dragging');
    $('map').setPointerCapture(event.pointerId);
  });
  $('map').addEventListener('pointermove', event => {
    if (!mapDrag) return;
    const maxX = $('map').clientWidth * (mapZoom - 1) / 2;
    const maxY = $('map').clientHeight * (mapZoom - 1) / 2;
    mapOffset.x = clamp(mapDrag.offsetX + event.clientX - mapDrag.x, -maxX, maxX);
    mapOffset.y = clamp(mapDrag.offsetY + event.clientY - mapDrag.y, -maxY, maxY);
    renderMap();
  });
  const endMapDrag = event => {
    if (!mapDrag) return;
    mapDrag = null;
    $('map').classList.remove('dragging');
    if ($('map').hasPointerCapture(event.pointerId)) $('map').releasePointerCapture(event.pointerId);
  };
  $('map').addEventListener('pointerup', endMapDrag);
  $('map').addEventListener('pointercancel', endMapDrag);
  $('map').addEventListener('wheel', event => {
    event.preventDefault();
    setMapZoom(mapZoom + (event.deltaY < 0 ? 0.08 : -0.08));
  }, { passive: false });
  $('dialog-close').addEventListener('click', () => $('game-dialog').close());
  $('game-dialog').addEventListener('close', () => {
    $('game-dialog').classList.remove('exploration-mode');
    explorationFocus = null;
    explorationDocumentFace = 'front';
    explorationDocumentZoomed = false;
    updateStorm();
  });
  $('game-dialog').addEventListener('click', event => {
    if (event.target === $('game-dialog')) $('game-dialog').close();
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.hasAttribute('data-close-exploration')) closeExploration();
    else if (button.hasAttribute('data-exploration-focus')) {
      explorationFocus = button.dataset.explorationFocus;
      explorationDocumentFace = 'front';
      explorationDocumentZoomed = false;
      renderExplorationPanel(explorationFocus);
    } else if (button.hasAttribute('data-exploration-inspection')) completeInspection(button.dataset.explorationInspection);
    else if (button.hasAttribute('data-exploration-detail')) resolveExplorationDetail(button.dataset.explorationDetail);
    else if (button.hasAttribute('data-exploration-read')) readDocument(button.dataset.explorationRead);
    else if (button.hasAttribute('data-exploration-face')) {
      explorationDocumentFace = explorationDocumentFace === 'front' ? 'back' : 'front';
      renderExplorationPanel(explorationFocus);
    } else if (button.hasAttribute('data-exploration-zoom')) {
      explorationDocumentZoomed = !explorationDocumentZoomed;
      renderExplorationPanel(explorationFocus);
    } else if (button.id === 'combine-items') combineSelectedItems();
    else if (button.id === 'connect-evidence') connectEvidence();
    else if (button.hasAttribute('data-open-panel')) openGamePanel(button.dataset.openPanel);
    else if (button.hasAttribute('data-load-slot')) {
      selectedSlot = Number(button.dataset.loadSlot);
      $('save-slot').value = String(selectedSlot);
      updateContinueButton();
      $('game-dialog').close();
      resume();
    }
    else if (button.hasAttribute('data-item-inspect')) inspectInventoryItem(button.dataset.itemInspect);
    else if (button.hasAttribute('data-item-use')) useInventoryItem(button.dataset.itemUse);
    else if (button.hasAttribute('data-read-document')) readDocument(button.dataset.readDocument);
    else if (button.hasAttribute('data-save-quit')) saveAndQuit();
  });
  $('game-dialog').addEventListener('change', event => {
    const input = event.target;
    if (input.matches('[data-evidence]')) {
      if (input.checked) selectedEvidence.add(input.dataset.evidence);
      else selectedEvidence.delete(input.dataset.evidence);
    } else if (input.id === 'dialog-volume-range') {
      volume = Number(input.value) / 100;
      $('volume-range').value = input.value;
      if (soundEnabled && audioContext && masterGain) masterGain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.06);
      saveAudioSettings();
    } else if (input.id === 'reduce-motion-toggle') {
      setReducedMotion(input.checked);
    } else if (input.id === 'reduce-flashes-toggle') {
      reduceFlashes = input.checked;
      applyMotionPreference();
      saveOptions();
    } else if (input.id === 'text-scale') {
      textScale = clamp(Number(input.value) / 100, 0.9, 1.25);
      applyMotionPreference();
      saveOptions();
    } else if (input.id === 'difficulty-select') {
      difficulty = ['story', 'normal', 'survival'].includes(input.value) ? input.value : 'normal';
      saveOptions();
      render();
      renderSettingsPanel();
    }
  });
  $('sound-toggle').addEventListener('click', toggleSound);
  $('volume-range').addEventListener('input', event => {
    volume = Number(event.target.value) / 100;
    if (soundEnabled && audioContext && masterGain) {
      masterGain.gain.setTargetAtTime(volume, audioContext.currentTime, 0.06);
    }
    saveAudioSettings();
  });

  loadAudioSettings();
  loadOptions();
  updateContinueButton();
  showScreen('welcome');
  render();
  initStorm();
})();
