import { CampaignCalendar } from '../types';

export const HARPTOS_CALENDAR: CampaignCalendar = {
 id: 'harptos',
 name: 'Calendario di Harptos (Faerûn / Forgotten Realms)',
 yearSuffix: 'CV',
 currentYear: 1492,
 currentMonthIndex: 1, // Alturiak
 currentDay: 15,
 daysOfWeek: ['Primo Giorno', 'Secondo Giorno', 'Terzo Giorno', 'Quarto Giorno', 'Quinto Giorno', 'Sesto Giorno', 'Settimo Giorno', 'Ottavo Giorno', 'Nono Giorno', 'Decimo Giorno (Giorno di Riposo)'],
 months: [
 { id: 'm1', name: 'Hammer (Grande Inverno)', days: 30, season: 'Inverno' },
 { id: 'm2', name: 'Alturiak (Artiglio d’Inverno)', days: 30, season: 'Inverno' },
 { id: 'm3', name: 'Ches (Il Disgelo)', days: 30, season: 'Primavera' },
 { id: 'm4', name: 'Tarsakh (I Temporali)', days: 30, season: 'Primavera' },
 { id: 'm5', name: 'Mirtul (Lo Sbocciare)', days: 30, season: 'Primavera' },
 { id: 'm6', name: 'Kythorn (Tempo dei Fiori)', days: 30, season: 'Estate' },
 { id: 'm7', name: 'Flamerule (Sole Alto)', days: 30, season: 'Estate' },
 { id: 'm8', name: 'Eleasis (Il Caldo)', days: 30, season: 'Estate' },
 { id: 'm9', name: 'Eleint (Il Tramonto)', days: 30, season: 'Autunno' },
 { id: 'm10', name: 'Marpenoth (La Caduta)', days: 30, season: 'Autunno' },
 { id: 'm11', name: 'Uktar (La Notte Lunga)', days: 30, season: 'Autunno' },
 { id: 'm12', name: 'Nightal (L’Ombra)', days: 30, season: 'Inverno' },
 ],
 specialHolidays: [
 { name: 'Mezzinverno (Festa tra Hammer e Alturiak)', monthIndex: 0, day: 30 },
 { name: 'Praterba (Inizio Primavera)', monthIndex: 3, day: 30 },
 { name: 'Mezzestate (Solstizio Estivo)', monthIndex: 6, day: 30 },
 { name: 'Festa dello Scudo (Ogni 4 anni)', monthIndex: 6, day: 30 },
 { name: 'Granraccolto (Equinozio d’Autunno)', monthIndex: 8, day: 30 },
 { name: 'Festa della Luna (Giorno dei Morti)', monthIndex: 10, day: 30 },
 ],
};

export const CUSTOM_DEFAULT_CALENDAR: CampaignCalendar = {
 id: 'custom_default',
 name: 'Calendario Standard della Campagna',
 yearSuffix: 'Anno dell’Era',
 currentYear: 742,
 currentMonthIndex: 3,
 currentDay: 12,
 daysOfWeek: ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'],
 months: [
 { id: 'c1', name: 'Mese del Gelo', days: 30, season: 'Inverno' },
 { id: 'c2', name: 'Mese del Disgelo', days: 30, season: 'Inverno' },
 { id: 'c3', name: 'Mese dei Germogli', days: 30, season: 'Primavera' },
 { id: 'c4', name: 'Mese delle Piogge', days: 30, season: 'Primavera' },
 { id: 'c5', name: 'Mese dei Fiori', days: 30, season: 'Primavera' },
 { id: 'c6', name: 'Mese del Sole', days: 30, season: 'Estate' },
 { id: 'c7', name: 'Mese della Mietitura', days: 30, season: 'Estate' },
 { id: 'c8', name: 'Mese della Grano', days: 30, season: 'Estate' },
 { id: 'c9', name: 'Mese della Bruma', days: 30, season: 'Autunno' },
 { id: 'c10', name: 'Mese delle Foglie', days: 30, season: 'Autunno' },
 { id: 'c11', name: 'Mese delle Nebbie', days: 30, season: 'Autunno' },
 { id: 'c12', name: 'Mese delle Tenebre', days: 30, season: 'Inverno' },
 ],
};
