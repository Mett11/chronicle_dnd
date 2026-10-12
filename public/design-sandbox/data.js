/* CHRONICLE DND — DESIGN SANDBOX DEMO DATASET
 * Campaign: L'Ombra dell'Eclissi Planare (Waterdeep & Faerûn)
 */

window.SANDBOX_DATA = {
  campaign: {
    code: 'WTR-1492',
    title: "L'Ombra dell'Eclissi Planare",
    subtitle: 'Cronache di Waterdeep e la Costa della Spada',
    system: 'D&D 5e (Edizione Planare)',
    currentDateHarptos: '14 Hammer (Ittide), 1492 DR',
    dmName: 'Mastro delle Ombre (DM)',
    activePlayersCount: 5,
    sessionsCount: 28,
    entitiesCount: 64,
    worldLoreArticlesCount: 19,
    currentChapter: 'Capitolo II: Il Labirinto di Giada',
    planarAlignment: 'Shadowfell Convergent (Phase 0.82)',
  },

  entities: [
    {
      id: 'ent_maelis_silverwing',
      name: 'Maelis Silverwing',
      type: 'npc',
      typeLabel: 'PNG // ALLEATO',
      status: 'ACTIVE',
      statusLabel: 'ATTIVO // IN VITA',
      statusColor: '#3B82F6',
      avatarUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
      tags: ['PNG', 'Alliato', 'Arpisti'],
      attributes: {
        Razza: 'Mezzo-Elfo delle Lune',
        Classe: 'Mago Bardo lvl 11',
        Fazione: 'Arpisti di Waterdeep',
        Allineamento: 'Neutrale Buono',
        Ubicazione: 'Quartiere Marittimo, Waterdeep',
      },
      relationships: [
        { targetId: 'ent_elion_vane', relation: 'Mentore Arcano', trust: 'Elevata' },
        { targetId: 'ent_culto_eclissi', relation: 'Nemico Dichiarato', trust: 'Ostile' },
        { targetId: 'ent_forte_eclissi', relation: 'Investigatore sul campo', trust: 'Neutrale' },
      ],
      sessionsMentioned: ['Sessione 24', 'Sessione 22', 'Sessione 18', 'Sessione 12'],
      bioMarkdown: `Maelis Silverwing è un'alta informatrice degli Arpisti a Waterdeep. Riconosciuta per la sua profonda conoscenza delle brecce planari tra Toril e la Selva Ombra, ha guidato il party verso la scoperta del Sigillo di Giada celato nelle profondità del quartiere marittimo.`
    },
    {
      id: 'ent_elion_vane',
      name: 'Elion Vane',
      type: 'character',
      typeLabel: 'PERSONAGGIO GIOCANTE',
      status: 'ALIVE',
      statusLabel: 'ATTIVO // IN VITA',
      statusColor: '#10B981',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      tags: ['PG', 'Warlock', 'Lama delle Ombre'],
      attributes: {
        Razza: 'Umano (Tethyrian)',
        Classe: 'Warlock / Lama Arcana lvl 9',
        Patrono: 'Il Re delle Ombre',
        Allineamento: 'Caotico Neutrale',
        Giocatore: 'Mattia (You)',
      },
      relationships: [
        { targetId: 'ent_maelis_silverwing', relation: 'Allievo Arcano', trust: 'Elevata' },
        { targetId: 'ent_lama_eclissi', relation: 'Possessore', trust: 'Legame d\'Ombra' },
      ],
      sessionsMentioned: ['Tutte le Sessioni (1-28)'],
      bioMarkdown: `Elion è nato nelle stradine inferiori di Baldur's Gate prima di stipulare un patto oscuro nelle rovine della Valle del Vento Gelido. Impugna la Lama dell'Eclissi, un frammento d'acciaio d'ombra capace di squarciare il velo tra le dimensioni.`
    },
    {
      id: 'ent_culto_eclissi',
      name: 'Culto dell\'Eclissi Sempiterna',
      type: 'faction',
      typeLabel: 'FAZIONE NEMICA',
      status: 'ACTIVE_THREAT',
      statusLabel: 'MINACCIA ATTIVA',
      statusColor: '#EF4444',
      avatarUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=400&q=80',
      tags: ['Fazione', 'Nemico', 'Occulto'],
      attributes: {
        Base: 'Forte dell\'Eclissi (Sotto-Monte)',
        Leader: 'L\'Apostolo del Vuoto (Identità Ignota)',
        'Membri Stimati': '200+ Fanatici & Evocatori',
        Obiettivo: 'Risvegliare il Titano d\'Ombra',
      },
      relationships: [
        { targetId: 'ent_maelis_silverwing', relation: 'Bersaglio Primario', trust: 'Ostile' },
      ],
      sessionsMentioned: ['Sessione 24', 'Sessione 23', 'Sessione 20', 'Sessione 19'],
      bioMarkdown: `Setta di occultisti ed evocatori arcanisti dedicati al ripristino dell'Era della Notte Sempiterna. Operano attraverso cripte sotterranee scavate nel Sottomonte di Waterdeep.`
    },
    {
      id: 'ent_forte_eclissi',
      name: 'Forte dell\'Eclissi (Cripta Bassa)',
      type: 'location',
      typeLabel: 'LUOGO // RUINA',
      status: 'EXPLORED',
      statusLabel: 'ESPLORATO // PERICOLO ALTO',
      statusColor: '#F59E0B',
      avatarUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=400&q=80',
      tags: ['Luogo', 'Dungeon', 'Sottomonte'],
      attributes: {
        Regione: 'Sottomonte - Livello 3',
        Clima: 'Sotterraneo / Umido Arcano',
        Pericolo: 'Grado 12 (Molto Alto)',
        Coordinate: 'LAT 44.12 // LON -12.84',
      },
      relationships: [
        { targetId: 'ent_culto_eclissi', relation: 'Fortezza Principale', trust: 'Dominio Nemico' },
      ],
      sessionsMentioned: ['Sessione 24', 'Sessione 23'],
      bioMarkdown: `Antica fortezza nanica riconvertita dal Culto dell'Eclissi in centro di evocazione planare. Le sue mura di selce nera assorbono qualsiasi fonte di luce divina.`
    },
    {
      id: 'ent_lama_eclissi',
      name: 'Lama dell\'Eclissi Planare',
      type: 'item',
      typeLabel: 'OGGETTO // ARTEFATTO',
      status: 'ATTUNED',
      statusLabel: 'SINTONIZZATO (ELION)',
      statusColor: '#8B5CF6',
      avatarUrl: 'https://images.unsplash.com/photo-1589241062272-c0a000072dfa?auto=format&fit=crop&w=400&q=80',
      tags: ['Artefatto', 'Leggendario', 'Arma'],
      attributes: {
        Rarità: 'Leggendario (Richiede Sintonizzazione)',
        Danno: '1d8 Tagliente + 2d6 Forza d\'Ombra',
        Proprietà: 'Varco Planare, Riflesso Lunare',
      },
      relationships: [
        { targetId: 'ent_elion_vane', relation: 'Padrone d\'Ombra', trust: 'Totale' },
      ],
      sessionsMentioned: ['Sessione 24', 'Sessione 15', 'Sessione 08'],
      bioMarkdown: `Spada bastarda forgiata nel metallo meteoritico del Selene. Permette a chi la impugna di fendere lo spazio e compiere passi d'ombra fino a 18 metri.`
    }
  ],

  sessions: [
    {
      id: 'sess_24',
      number: 24,
      title: 'La Cripta dell\'Eclissi e il Sigillo di Giada',
      dateHarptos: '14 Hammer, 1492 DR',
      chapterId: 'chap_02',
      chapterName: 'Capitolo II: Il Labirinto di Giada',
      summary: `Il party si è addentrato nel terzo livello del Sottomonte attraverso la breccia della Cripta Bassa. Dopo aver neutralizzato la guardia d'elite del Culto dell'Eclissi, Elion ha utilizzato la Lama d'Ombra per spezzare il primo sigillo di confinamento. Durante l'evocazione, Maelis Silverwing ha intercettato un messaggio criptico inviato dall'Apostolo del Vuoto verso le rovine della Valle del Vento Gelido.`,
      plotEvents: [
        'Ingresso furtivo nel terzo livello di Sottomonte tramite il condotto di scarico nanico.',
        'Scontro tattico con 4 Evocatori dell\'Eclissi e 2 Mastini d\'Ombra.',
        'Distruzione del Sigillo di Giada e recupero della Mappa delle Brecce Planari.',
        'Rivelazione della connessione tra il Culto dell\'Eclissi e le rovine di Netheril.'
      ],
      quotes: [
        { speaker: 'Maelis Silverwing', text: '"Se il terzo sigillo cede prima del solstizio, la luce di Lathander non toccherà più la Costa della Spada."' },
        { speaker: 'Elion Vane', text: '"L\'ombra non è nostra nemica... è soltanto lo scudo che ci separa dal fuoco del Vuoto."' }
      ],
      linkedEntityIds: ['ent_maelis_silverwing', 'ent_elion_vane', 'ent_culto_eclissi', 'ent_forte_eclissi', 'ent_lama_eclissi'],
      audioLogUrl: 'https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg',
      openQuestions: [
        'Chi è realmente l\'Apostolo del Vuoto menzionato nei pergamene del culto?',
        'Come è riuscito il Culto ad ottenere la chiave di giada della casata Silverwing?'
      ]
    },
    {
      id: 'sess_23',
      number: 23,
      title: 'I Passaggi Sotterranei di Waterdeep',
      dateHarptos: '08 Hammer, 1492 DR',
      chapterId: 'chap_02',
      chapterName: 'Capitolo II: Il Labirinto di Giada',
      summary: `Esplorazione dei cunicoli dei contrabbandieri sotto il Quartiere Marittimo. Incontro con gli informatori degli Arpisti e negoziazione dei passaggi d'accesso verso Sottomonte.`,
      plotEvents: [
        'Incontro segreto con Maelis alla Taverna del Drago Parlante.',
        'Mappatura dei passaggi segreti sotto il porto.',
        'Mancato agguato da parte degli assassini della Gilda di Xanathar.'
      ],
      quotes: [
        { speaker: 'Informatore Arpista', text: '"Sotto queste pietre non c\'è legge che valga, solo il prezzo del silenzio."' }
      ],
      linkedEntityIds: ['ent_maelis_silverwing', 'ent_forte_eclissi'],
      openQuestions: []
    }
  ],

  chapters: [
    {
      id: 'chap_01',
      number: 1,
      title: 'Capitolo I: Le Ombre di Waterdeep',
      status: 'COMPLETED',
      statusLabel: 'COMPLETATO // ARCHIVIATO',
      synopsis: 'L\'inizio dell\'indagine sulla scomparsa degli artefatti nei quartieri nobiliari della Città dello Splendore e la scoperta delle prime ramificazioni del Culto.',
      sessionsCount: 12,
      startDate: '15 Alturiak, 1491 DR',
      endDate: '28 Nightal, 1491 DR',
      color: '#3B82F6',
      coverUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'chap_02',
      number: 2,
      title: 'Capitolo II: Il Labirinto di Giada',
      status: 'IN_PROGRESS',
      statusLabel: 'IN CORSO // FASE ATTIVA',
      synopsis: 'La discesa nei condotti sotterranei di Sottomonte alla caccia dei tre Sigilli di Confinamento e l\'intercettazione delle brecce planari.',
      sessionsCount: 16,
      startDate: '01 Hammer, 1492 DR',
      endDate: 'In corso',
      color: '#D4AF37',
      coverUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?auto=format&fit=crop&w=600&q=80'
    },
    {
      id: 'chap_03',
      number: 3,
      title: 'Capitolo III: L\'Eclissi Sempiterna',
      status: 'UPCOMING',
      statusLabel: 'FUTURO // NON INIZIATO',
      synopsis: 'La spedizione finale verso le rovine ghiacciate di Netheril nella Valle del Vento Gelido per lo scontro definitivo con l\'Apostolo del Vuoto.',
      sessionsCount: 0,
      startDate: 'Pianificato',
      endDate: '-',
      color: '#8B5CF6',
      coverUrl: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=600&q=80'
    }
  ],

  mapPois: [
    {
      id: 'poi_waterdeep',
      name: 'Waterdeep (Città dello Splendore)',
      region: 'Costa della Spada Settentrionale',
      type: 'Metropoli / Capitale',
      danger: 'Basso (In superficie) // Estremo (Sottomonte)',
      coords: [34.8, 62.4],
      coordLabel: 'COORD: 34.80° N // 62.40° W',
      description: 'La più grande metropoli della Costa della Spada. Sotto i suoi eleganti quartieri si estende il vasto labirinto di Sottomonte.',
      linkedEntityId: 'ent_maelis_silverwing'
    },
    {
      id: 'poi_forte_eclissi',
      name: 'Forte dell\'Eclissi (Cripta Bassa)',
      region: 'Sottomonte Livello 3',
      type: 'Fortezza Nemica / Ruina',
      danger: 'Grado 12 (Molto Alto)',
      coords: [38.2, 58.1],
      coordLabel: 'COORD: 38.20° N // 58.10° W',
      description: 'Roccaforte sotterranea del Culto dell\'Eclissi. Sede del primo Sigillo di Giada distrutto dal party.',
      linkedEntityId: 'ent_forte_eclissi'
    },
    {
      id: 'poi_valle_vento_gelido',
      name: 'Valle del Vento Gelido (Rovine Netheril)',
      region: 'Estremo Nord',
      type: 'Regione Glaciale / Antica Magia',
      danger: 'Grado 15 (Estremo)',
      coords: [18.4, 82.6],
      coordLabel: 'COORD: 18.40° N // 82.60° W',
      description: 'Distesa congelata all\'estremo nord dove si celano le rovine galleggianti dell\'antico impero arcano di Netheril.',
      linkedEntityId: 'ent_culto_eclissi'
    }
  ],

  notes: [
    {
      id: 'note_01',
      title: 'Averla d\'Argento e gli Arpisti',
      category: 'Informatore',
      author: 'Elion Vane',
      date: '10 Hammer, 1492 DR',
      isPinned: true,
      askDm: false,
      contentMarkdown: `Maelis ci ha confermato che l'Apostolo del Vuoto non agisce da solo. Ci sono infiltrati tra i Lord Mascherati di Waterdeep. Dobbiamo prestare estrema attenzione quando rientriamo nel Quartiere Marittimo.`
    },
    {
      id: 'note_02',
      title: 'Chiarimento Arcano: Funzionamento del Sigillo di Giada',
      category: 'Chiarimento DM',
      author: 'Mastro delle Ombre (DM)',
      date: '14 Hammer, 1492 DR',
      isPinned: false,
      askDm: true,
      dmReply: 'Il Sigillo assorbe solo la magia divina dei primi 3 livelli. Le incantesimi d\'ombra e di forza non subiscono penalità nel raggio di 18 metri.',
      contentMarkdown: `Domanda al DM: Qual è il raggio d'azione preciso dell'aura di soppressione del Sigillo di Giada durante il combattimento?`
    }
  ]
};
