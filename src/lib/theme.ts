export interface ClassTheme {
  id: string;
  name: string;
  icon: string;
  mainColor: string;
  mainColorLabel: string;
  accentColor: string;
  accentColorLabel: string;
  vibe: string;
  isLight?: boolean;
  colors: {
    surface0: string;
    surface1: string;
    surface2: string;
    surface3: string;
    surface4: string;
    content1: string;
    content2: string;
    content3: string;
    primary: string;
    primaryHover: string;
    primaryMuted: string;
    gazetteBorder: string;
    gazetteAccent: string;
  };
}

export const CLASS_THEMES: ClassTheme[] = [
  // ==========================================
  // 1. DUNGEON MASTER (Dark & Light)
  // ==========================================
  {
    id: 'dungeon-master',
    name: 'Dungeon Master',
    icon: '🐉',
    mainColor: '#1E2430',
    mainColorLabel: 'Ossidiana & Drago',
    accentColor: '#D4AF37',
    accentColorLabel: 'Oro Antico D&D',
    vibe: 'Lo Schermo del DM: classico, regale, oro puro su ossidiana',
    isLight: false,
    colors: {
      surface0: '#0b0d11',
      surface1: '#141820',
      surface2: '#1e2430',
      surface3: '#2f394a',
      surface4: '#445168',
      content1: '#f8fafc',
      content2: '#cbd5e1',
      content3: '#8c9bae',
      primary: '#D4AF37',
      primaryHover: '#f3cf55',
      primaryMuted: 'rgba(212, 175, 55, 0.18)',
      gazetteBorder: '#8c642b',
      gazetteAccent: '#b8860b',
    },
  },
  {
    id: 'dungeon-master-light',
    name: 'Dungeon Master',
    icon: '🐉',
    mainColor: '#FAF4EF',
    mainColorLabel: 'Pergamena & Cremisi',
    accentColor: '#B91C1C',
    accentColorLabel: 'Rosso D&D / Rubino',
    vibe: 'Lo Schermo del DM: rosso D&D, pergamena antica e sigilli dorati',
    isLight: true,
    colors: {
      surface0: '#f9f3ec',
      surface1: '#ffffff',
      surface2: '#f1e5d8',
      surface3: '#e2cfbd',
      surface4: '#cbb39c',
      content1: '#260a0a',
      content2: '#4a1d1f',
      content3: '#7c4347',
      primary: '#B91C1C',
      primaryHover: '#991b1b',
      primaryMuted: 'rgba(185, 28, 28, 0.15)',
      gazetteBorder: '#991b1b',
      gazetteAccent: '#b91c1c',
    },
  },

  // ==========================================
  // 2. WARLOCK (Dark & Light)
  // ==========================================
  {
    id: 'warlock',
    name: 'Warlock',
    icon: '🔮',
    mainColor: '#201B2E',
    mainColorLabel: 'Ossidiana Viola',
    accentColor: '#BA78FF',
    accentColorLabel: 'Neon Eldritch',
    vibe: 'Occulto, misterioso, dark mode',
    isLight: false,
    colors: {
      surface0: '#0d0b12',
      surface1: '#15121e',
      surface2: '#201b2e',
      surface3: '#322a45',
      surface4: '#473b61',
      content1: '#fbf9fe',
      content2: '#dcd5ea',
      content3: '#9b8fb3',
      primary: '#BA78FF',
      primaryHover: '#cd98ff',
      primaryMuted: 'rgba(186, 120, 255, 0.18)',
      gazetteBorder: '#6c449c',
      gazetteAccent: '#BA78FF',
    },
  },
  {
    id: 'warlock-light',
    name: 'Warlock',
    icon: '🔮',
    mainColor: '#F6F1FD',
    mainColorLabel: 'Nebbia Lavanda',
    accentColor: '#8B5CF6',
    accentColorLabel: 'Viola Eldritch',
    vibe: 'Grimorio occulto chiaro, glicine e patti arcani',
    isLight: true,
    colors: {
      surface0: '#f5effc',
      surface1: '#ffffff',
      surface2: '#e9ddf7',
      surface3: '#d5c4ef',
      surface4: '#bca6e0',
      content1: '#1f132e',
      content2: '#3c2d52',
      content3: '#6f5e88',
      primary: '#8B5CF6',
      primaryHover: '#7c3aed',
      primaryMuted: 'rgba(139, 92, 246, 0.15)',
      gazetteBorder: '#7c3aed',
      gazetteAccent: '#8b5cf6',
    },
  },

  // ==========================================
  // 3. STREGONE / SORCERER (Dark & Light)
  // ==========================================
  {
    id: 'sorcerer',
    name: 'Stregone',
    icon: '✨',
    mainColor: '#261A28',
    mainColorLabel: 'Grafite Ametista',
    accentColor: '#FF4081',
    accentColorLabel: 'Fucsia Magico',
    vibe: 'Magia caotica, energia pura',
    isLight: false,
    colors: {
      surface0: '#0f0b10',
      surface1: '#19121a',
      surface2: '#261a28',
      surface3: '#3d263f',
      surface4: '#553558',
      content1: '#fff5f8',
      content2: '#e8d2dc',
      content3: '#a88899',
      primary: '#FF4081',
      primaryHover: '#ff669a',
      primaryMuted: 'rgba(255, 64, 129, 0.18)',
      gazetteBorder: '#8c2c47',
      gazetteAccent: '#FF4081',
    },
  },
  {
    id: 'sorcerer-light',
    name: 'Stregone',
    icon: '✨',
    mainColor: '#FAF0F4',
    mainColorLabel: 'Quarzo Rosa',
    accentColor: '#E11D48',
    accentColorLabel: 'Fucsia Caotico',
    vibe: 'Magia caotica radiosa, cristalli e scintille',
    isLight: true,
    colors: {
      surface0: '#f8edf2',
      surface1: '#ffffff',
      surface2: '#f3dbe6',
      surface3: '#e7c3d4',
      surface4: '#d5a4bd',
      content1: '#260f1b',
      content2: '#472236',
      content3: '#7d4d67',
      primary: '#E11D48',
      primaryHover: '#be123c',
      primaryMuted: 'rgba(225, 29, 72, 0.15)',
      gazetteBorder: '#be123c',
      gazetteAccent: '#e11d48',
    },
  },

  // ==========================================
  // 4. MAGO / WIZARD (Dark & Light)
  // ==========================================
  {
    id: 'wizard',
    name: 'Mago',
    icon: '🧙',
    mainColor: '#1B2234',
    mainColorLabel: 'Zaffiro Notte',
    accentColor: '#38BDF8',
    accentColorLabel: 'Azzurro Arcano',
    vibe: 'Accademico, ordinato, cosmico',
    isLight: false,
    colors: {
      surface0: '#0a0d14',
      surface1: '#111622',
      surface2: '#1b2234',
      surface3: '#2a3550',
      surface4: '#3a496d',
      content1: '#f2f7fc',
      content2: '#cbd9e7',
      content3: '#839bb5',
      primary: '#38BDF8',
      primaryHover: '#60a5fa',
      primaryMuted: 'rgba(56, 189, 248, 0.18)',
      gazetteBorder: '#283593',
      gazetteAccent: '#0288d1',
    },
  },
  {
    id: 'wizard-light',
    name: 'Mago',
    icon: '🧙',
    mainColor: '#EEF5FC',
    mainColorLabel: 'Ghiaccio Arcano',
    accentColor: '#0284C7',
    accentColorLabel: 'Zaffiro Arcano',
    vibe: 'Torre d\'avorio, pergamene celesti e tomi di rune',
    isLight: true,
    colors: {
      surface0: '#ecf3fa',
      surface1: '#ffffff',
      surface2: '#dbe8f5',
      surface3: '#c5d7eb',
      surface4: '#a5c0dc',
      content1: '#0c1b2f',
      content2: '#233956',
      content3: '#546d8e',
      primary: '#0284C7',
      primaryHover: '#0369a1',
      primaryMuted: 'rgba(2, 132, 199, 0.15)',
      gazetteBorder: '#0369a1',
      gazetteAccent: '#0284c7',
    },
  },

  // ==========================================
  // 5. CHIERICO / CLERIC (Light & Dark)
  // ==========================================
  {
    id: 'cleric',
    name: 'Chierico',
    icon: '☀️',
    mainColor: '#F5F5F4',
    mainColorLabel: 'Pergamena Chiara',
    accentColor: '#B08400',
    accentColorLabel: 'Oro Divino',
    vibe: 'Sacro, pulito, luce celestiale',
    isLight: true,
    colors: {
      surface0: '#f4f1ea',
      surface1: '#ffffff',
      surface2: '#eae5d8',
      surface3: '#dad3c3',
      surface4: '#c5bcab',
      content1: '#1a1714',
      content2: '#3d3730',
      content3: '#6e6558',
      primary: '#b08400',
      primaryHover: '#946f00',
      primaryMuted: 'rgba(176, 132, 0, 0.15)',
      gazetteBorder: '#c69500',
      gazetteAccent: '#b08400',
    },
  },
  {
    id: 'cleric-dark',
    name: 'Chierico',
    icon: '☀️',
    mainColor: '#241F16',
    mainColorLabel: 'Ossidiana Solare',
    accentColor: '#FFD700',
    accentColorLabel: 'Oro Radioso',
    vibe: 'Tempio sacro di notte, luce aurea nel buio',
    isLight: false,
    colors: {
      surface0: '#0f0c08',
      surface1: '#1a1610',
      surface2: '#262017',
      surface3: '#3d3323',
      surface4: '#554730',
      content1: '#fffcf2',
      content2: '#ded7c5',
      content3: '#a49880',
      primary: '#F59E0B',
      primaryHover: '#fbbf24',
      primaryMuted: 'rgba(245, 158, 11, 0.18)',
      gazetteBorder: '#b45309',
      gazetteAccent: '#f59e0b',
    },
  },

  // ==========================================
  // 6. DRUIDO / DRUID (Dark & Light)
  // ==========================================
  {
    id: 'druid',
    name: 'Druido',
    icon: '🌿',
    mainColor: '#1B2820',
    mainColorLabel: 'Smeraldo Notte',
    accentColor: '#4ADE80',
    accentColorLabel: 'Germoglio',
    vibe: 'Organico, naturale, ancestrale',
    isLight: false,
    colors: {
      surface0: '#0b100d',
      surface1: '#121a15',
      surface2: '#1b2820',
      surface3: '#2c3f33',
      surface4: '#3e5847',
      content1: '#f3fbf6',
      content2: '#cee2d6',
      content3: '#8da898',
      primary: '#4ADE80',
      primaryHover: '#6ee7b7',
      primaryMuted: 'rgba(74, 222, 128, 0.18)',
      gazetteBorder: '#2d6a4f',
      gazetteAccent: '#38b000',
    },
  },
  {
    id: 'druid-light',
    name: 'Druido',
    icon: '🌿',
    mainColor: '#F0F7F2',
    mainColorLabel: 'Nebbia di Bosco',
    accentColor: '#16A34A',
    accentColorLabel: 'Smeraldo Silvano',
    vibe: 'Radura soleggiata, betulla e foglie primaverili',
    isLight: true,
    colors: {
      surface0: '#edf5ef',
      surface1: '#ffffff',
      surface2: '#dcece1',
      surface3: '#c6dfce',
      surface4: '#a6cbb2',
      content1: '#0f2416',
      content2: '#23442e',
      content3: '#52755e',
      primary: '#16A34A',
      primaryHover: '#15803d',
      primaryMuted: 'rgba(22, 163, 74, 0.15)',
      gazetteBorder: '#15803d',
      gazetteAccent: '#16a34a',
    },
  },

  // ==========================================
  // 7. PALADINO / PALADIN (Dark & Light)
  // ==========================================
  {
    id: 'paladin',
    name: 'Paladino',
    icon: '👑',
    mainColor: '#28231E',
    mainColorLabel: 'Bronzo Nobile',
    accentColor: '#F59E0B',
    accentColorLabel: 'Oro Radioso',
    vibe: 'Nobile, cavalleresco, solido',
    isLight: false,
    colors: {
      surface0: '#0f0e0c',
      surface1: '#1a1714',
      surface2: '#28231e',
      surface3: '#3e362e',
      surface4: '#554a3e',
      content1: '#faf7f0',
      content2: '#ded7c7',
      content3: '#a19783',
      primary: '#F59E0B',
      primaryHover: '#fbbf24',
      primaryMuted: 'rgba(245, 158, 11, 0.18)',
      gazetteBorder: '#8c642b',
      gazetteAccent: '#b8860b',
    },
  },
  {
    id: 'paladin-light',
    name: 'Paladino',
    icon: '👑',
    mainColor: '#F9F5EE',
    mainColorLabel: 'Marmo d\'Avorio',
    accentColor: '#D97706',
    accentColorLabel: 'Bronzo Ambrato',
    vibe: 'Cattedrale baciata dal sole, giuramento e giustizia',
    isLight: true,
    colors: {
      surface0: '#f5eee1',
      surface1: '#ffffff',
      surface2: '#eae0cc',
      surface3: '#d8ccb2',
      surface4: '#c2b393',
      content1: '#261b0c',
      content2: '#473721',
      content3: '#756348',
      primary: '#D97706',
      primaryHover: '#b45309',
      primaryMuted: 'rgba(217, 119, 6, 0.15)',
      gazetteBorder: '#b45309',
      gazetteAccent: '#d97706',
    },
  },

  // ==========================================
  // 8. RANGER (Dark & Light)
  // ==========================================
  {
    id: 'ranger',
    name: 'Ranger',
    icon: '🏹',
    mainColor: '#22261D',
    mainColorLabel: 'Oliva Notte',
    accentColor: '#A3B18A',
    accentColorLabel: 'Salvia',
    vibe: 'Militare, mimetico, esplorativo',
    isLight: false,
    colors: {
      surface0: '#0e100c',
      surface1: '#161913',
      surface2: '#22261d',
      surface3: '#343b2d',
      surface4: '#495340',
      content1: '#f4f6f1',
      content2: '#d4dacd',
      content3: '#949f8b',
      primary: '#A3B18A',
      primaryHover: '#b7c4a0',
      primaryMuted: 'rgba(163, 177, 138, 0.18)',
      gazetteBorder: '#4a5d37',
      gazetteAccent: '#606c38',
    },
  },
  {
    id: 'ranger-light',
    name: 'Ranger',
    icon: '🏹',
    mainColor: '#F2F4ED',
    mainColorLabel: 'Sabbia Tattica',
    accentColor: '#65A30D',
    accentColorLabel: 'Oliva Selvaggia',
    vibe: 'Mappe topografiche chiare, sentieri e confini',
    isLight: true,
    colors: {
      surface0: '#edf1e4',
      surface1: '#ffffff',
      surface2: '#dee6d0',
      surface3: '#cad6b6',
      surface4: '#aec095',
      content1: '#1b2410',
      content2: '#354325',
      content3: '#62734f',
      primary: '#65A30D',
      primaryHover: '#4d7c0f',
      primaryMuted: 'rgba(101, 163, 13, 0.15)',
      gazetteBorder: '#4d7c0f',
      gazetteAccent: '#65a30d',
    },
  },

  // ==========================================
  // 9. BARDO / BARD (Dark & Light)
  // ==========================================
  {
    id: 'bard',
    name: 'Bardo',
    icon: '🎭',
    mainColor: '#2A1922',
    mainColorLabel: 'Prugna Notte',
    accentColor: '#F43F5E',
    accentColorLabel: 'Cremisi Rosa',
    vibe: 'Artistico, stravagante, vibrante',
    isLight: false,
    colors: {
      surface0: '#100a0d',
      surface1: '#1b1116',
      surface2: '#2a1922',
      surface3: '#422635',
      surface4: '#5c344a',
      content1: '#fff5f9',
      content2: '#ebd0dc',
      content3: '#aa8697',
      primary: '#F43F5E',
      primaryHover: '#fb7185',
      primaryMuted: 'rgba(244, 63, 94, 0.18)',
      gazetteBorder: '#881337',
      gazetteAccent: '#e11d48',
    },
  },
  {
    id: 'bard-light',
    name: 'Bardo',
    icon: '🎭',
    mainColor: '#FAF0F3',
    mainColorLabel: 'Seta Damascata',
    accentColor: '#E11D48',
    accentColorLabel: 'Rubino Lirico',
    vibe: 'Spartito di pergamena elegante, ballata e teatro',
    isLight: true,
    colors: {
      surface0: '#f7ecf0',
      surface1: '#ffffff',
      surface2: '#f3d8e0',
      surface3: '#e7becc',
      surface4: '#d79cb0',
      content1: '#2e0f17',
      content2: '#4f2430',
      content3: '#835260',
      primary: '#E11D48',
      primaryHover: '#be123c',
      primaryMuted: 'rgba(225, 29, 72, 0.15)',
      gazetteBorder: '#be123c',
      gazetteAccent: '#e11d48',
    },
  },

  // ==========================================
  // 10. BARBARO / BARBARIAN (Dark & Light)
  // ==========================================
  {
    id: 'barbarian',
    name: 'Barbaro',
    icon: '🔴',
    mainColor: '#281A1A',
    mainColorLabel: 'Cenere Vulcanica',
    accentColor: '#EF4444',
    accentColorLabel: 'Rabbia Primordiale',
    vibe: 'Viscerale, aggressivo, d\'impatto',
    isLight: false,
    colors: {
      surface0: '#100a0a',
      surface1: '#1a1111',
      surface2: '#281a1a',
      surface3: '#402828',
      surface4: '#5c3737',
      content1: '#fff5f5',
      content2: '#e8d0d0',
      content3: '#a68585',
      primary: '#EF4444',
      primaryHover: '#f87171',
      primaryMuted: 'rgba(239, 68, 68, 0.18)',
      gazetteBorder: '#8a0a0a',
      gazetteAccent: '#dc2626',
    },
  },
  {
    id: 'barbarian-light',
    name: 'Barbaro',
    icon: '🔴',
    mainColor: '#FAF1F1',
    mainColorLabel: 'Pietra Arenaria',
    accentColor: '#DC2626',
    accentColorLabel: 'Rosso Primordiale',
    vibe: 'Pittura di guerra su roccia chiara, forza selvaggia',
    isLight: true,
    colors: {
      surface0: '#f8eeee',
      surface1: '#ffffff',
      surface2: '#f4dbdb',
      surface3: '#e9c1c1',
      surface4: '#da9e9e',
      content1: '#2b0f0f',
      content2: '#4a2222',
      content3: '#7f4e4e',
      primary: '#DC2626',
      primaryHover: '#b91c1c',
      primaryMuted: 'rgba(220, 38, 38, 0.15)',
      gazetteBorder: '#b91c1c',
      gazetteAccent: '#dc2626',
    },
  },

  // ==========================================
  // 11. GUERRIERO / FIGHTER (Dark & Light)
  // ==========================================
  {
    id: 'fighter',
    name: 'Guerriero',
    icon: '⚔️',
    mainColor: '#1F252E',
    mainColorLabel: 'Ferro Battuto',
    accentColor: '#94A3B8',
    accentColorLabel: 'Acciaio Lucido',
    vibe: 'Tattico, marziale, solido',
    isLight: false,
    colors: {
      surface0: '#0c0e12',
      surface1: '#14181f',
      surface2: '#1f252e',
      surface3: '#303947',
      surface4: '#455163',
      content1: '#f8fafc',
      content2: '#cbd5e1',
      content3: '#8897ab',
      primary: '#94A3B8',
      primaryHover: '#cbd5e1',
      primaryMuted: 'rgba(148, 163, 184, 0.18)',
      gazetteBorder: '#475569',
      gazetteAccent: '#64748b',
    },
  },
  {
    id: 'fighter-light',
    name: 'Guerriero',
    icon: '⚔️',
    mainColor: '#F0F3F7',
    mainColorLabel: 'Armatura a Piastre',
    accentColor: '#475569',
    accentColorLabel: 'Acciaio Brunito',
    vibe: 'Tavola tattica marziale, metallo lucido e precisione',
    isLight: true,
    colors: {
      surface0: '#ecf0f5',
      surface1: '#ffffff',
      surface2: '#dce3ec',
      surface3: '#c6d1e0',
      surface4: '#a7b7cc',
      content1: '#111827',
      content2: '#334155',
      content3: '#64748b',
      primary: '#475569',
      primaryHover: '#334155',
      primaryMuted: 'rgba(71, 85, 105, 0.15)',
      gazetteBorder: '#334155',
      gazetteAccent: '#475569',
    },
  },

  // ==========================================
  // 12. LADRO / ROGUE (Dark & Light)
  // ==========================================
  {
    id: 'rogue',
    name: 'Ladro',
    icon: '🥷',
    mainColor: '#121212',
    mainColorLabel: 'Nero Assoluto',
    accentColor: '#8A8A8A',
    accentColorLabel: 'Grigio Fumo',
    vibe: 'Stealth, minimale, spettrale',
    isLight: false,
    colors: {
      surface0: '#0a0a0a',
      surface1: '#121212',
      surface2: '#1e1e1e',
      surface3: '#2d2d2d',
      surface4: '#3f3f3f',
      content1: '#f5f5f5',
      content2: '#d4d4d4',
      content3: '#8a8a8a',
      primary: '#A3A3A3',
      primaryHover: '#d4d4d4',
      primaryMuted: 'rgba(163, 163, 163, 0.2)',
      gazetteBorder: '#404040',
      gazetteAccent: '#525252',
    },
  },
  {
    id: 'rogue-light',
    name: 'Ladro',
    icon: '🥷',
    mainColor: '#F2F2F4',
    mainColorLabel: 'Pietra di Selce',
    accentColor: '#52525B',
    accentColorLabel: 'Grafite d\'Ombra',
    vibe: 'Mappa cartografica, vicoli nebbiosi e contratti',
    isLight: true,
    colors: {
      surface0: '#edeeef',
      surface1: '#ffffff',
      surface2: '#dededf',
      surface3: '#cacad0',
      surface4: '#a9a9b2',
      content1: '#18181b',
      content2: '#3f3f46',
      content3: '#71717a',
      primary: '#52525B',
      primaryHover: '#3f3f46',
      primaryMuted: 'rgba(82, 82, 91, 0.15)',
      gazetteBorder: '#3f3f46',
      gazetteAccent: '#52525b',
    },
  },

  // ==========================================
  // 13. MONACO / MONK (Dark & Light)
  // ==========================================
  {
    id: 'monk',
    name: 'Monaco',
    icon: '🧘',
    mainColor: '#292017',
    mainColorLabel: 'Teak Spirituale',
    accentColor: '#FB923C',
    accentColorLabel: 'Zafferano Radioso',
    vibe: 'Bilanciato, spirituale, caldo',
    isLight: false,
    colors: {
      surface0: '#100d09',
      surface1: '#1a150f',
      surface2: '#292017',
      surface3: '#3e3124',
      surface4: '#564432',
      content1: '#fff8f0',
      content2: '#e8dbcc',
      content3: '#a69581',
      primary: '#FB923C',
      primaryHover: '#fdba74',
      primaryMuted: 'rgba(251, 146, 60, 0.18)',
      gazetteBorder: '#c2410c',
      gazetteAccent: '#ea580c',
    },
  },
  {
    id: 'monk-light',
    name: 'Monaco',
    icon: '🧘',
    mainColor: '#FAF3E8',
    mainColorLabel: 'Legno di Bambù',
    accentColor: '#EA580C',
    accentColorLabel: 'Zafferano Solare',
    vibe: 'Dojo sereno, meditazione all\'alba e pergamene zen',
    isLight: true,
    colors: {
      surface0: '#f6ede0',
      surface1: '#ffffff',
      surface2: '#ede0cd',
      surface3: '#decbb0',
      surface4: '#c7b090',
      content1: '#26180a',
      content2: '#47321c',
      content3: '#7a5e40',
      primary: '#EA580C',
      primaryHover: '#c2410c',
      primaryMuted: 'rgba(234, 88, 12, 0.15)',
      gazetteBorder: '#c2410c',
      gazetteAccent: '#ea580c',
    },
  },

  // ==========================================
  // 14. ARTEFICE / ARTIFICER (Dark & Light)
  // ==========================================
  {
    id: 'artificer',
    name: 'Artefice',
    icon: '⚙️',
    mainColor: '#25211E',
    mainColorLabel: 'Ghisa Fusa',
    accentColor: '#EA580C',
    accentColorLabel: 'Rame Vivo',
    vibe: 'Steampunk, industriale, fuoco d\'officina',
    isLight: false,
    colors: {
      surface0: '#0e0d0c',
      surface1: '#171513',
      surface2: '#25211e',
      surface3: '#3b342e',
      surface4: '#534940',
      content1: '#faf5f0',
      content2: '#dbd3cb',
      content3: '#998e84',
      primary: '#EA580C',
      primaryHover: '#f97316',
      primaryMuted: 'rgba(234, 88, 12, 0.18)',
      gazetteBorder: '#795548',
      gazetteAccent: '#b45309',
    },
  },
  {
    id: 'artificer-light',
    name: 'Artefice',
    icon: '⚙️',
    mainColor: '#F8F3EA',
    mainColorLabel: 'Ottone Brunito',
    accentColor: '#C2410C',
    accentColorLabel: 'Rame Meccanico',
    vibe: 'Progetto su carta millimetrata, bottega d\'ingranaggi',
    isLight: true,
    colors: {
      surface0: '#f4ede0',
      surface1: '#ffffff',
      surface2: '#eadbc7',
      surface3: '#dac4a8',
      surface4: '#c3a785',
      content1: '#28170c',
      content2: '#493121',
      content3: '#7c5a44',
      primary: '#C2410C',
      primaryHover: '#9a3412',
      primaryMuted: 'rgba(194, 65, 12, 0.15)',
      gazetteBorder: '#9a3412',
      gazetteAccent: '#c2410c',
    },
  },
];

const THEME_STORAGE_KEY = 'chronicle_theme_class';

export function hasUserSavedTheme(): boolean {
  try {
    return Boolean(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return false;
  }
}

export function getStoredTheme(): ClassTheme {
  const storedId = localStorage.getItem(THEME_STORAGE_KEY);
  const found = CLASS_THEMES.find((t) => t.id === storedId);
  return found || CLASS_THEMES[0]; // Default to Warlock
}

export function applyTheme(themeId: string) {
  const theme = CLASS_THEMES.find((t) => t.id === themeId) || CLASS_THEMES[0];
  localStorage.setItem(THEME_STORAGE_KEY, theme.id);

  const root = document.documentElement;
  root.setAttribute('data-theme', theme.id);

  // Set individual CSS variables for guaranteed instant styling across all browsers and Tailwind
  root.style.setProperty('--color-surface-0', theme.colors.surface0);
  root.style.setProperty('--color-surface-1', theme.colors.surface1);
  root.style.setProperty('--color-surface-2', theme.colors.surface2);
  root.style.setProperty('--color-surface-3', theme.colors.surface3);
  root.style.setProperty('--color-surface-4', theme.colors.surface4);

  root.style.setProperty('--color-content-1', theme.colors.content1);
  root.style.setProperty('--color-content-2', theme.colors.content2);
  root.style.setProperty('--color-content-3', theme.colors.content3);

  root.style.setProperty('--color-primary', theme.colors.primary);
  root.style.setProperty('--color-primary-hover', theme.colors.primaryHover);
  root.style.setProperty('--color-primary-muted', theme.colors.primaryMuted);

  root.style.setProperty('--theme-main-color', theme.mainColor);
  root.style.setProperty('--theme-accent-color', theme.accentColor);
  root.style.setProperty('--theme-gazette-border', theme.colors.gazetteBorder);
  root.style.setProperty('--theme-gazette-accent', theme.colors.gazetteAccent);

  try {
    window.dispatchEvent(new CustomEvent('chronicle_theme_changed', { detail: { theme } }));
  } catch {}
}

export function initTheme() {
  const current = getStoredTheme();
  applyTheme(current.id);
}
