import { Player, Note, Session, Entity, Category, CampaignChapter } from '../types';

export const MOCK_CHAPTERS: CampaignChapter[] = [];

export const MOCK_PLAYERS: Player[] = [];

export const MOCK_CATEGORIES: Category[] = [
 {
 _id: 'cat_lore',
 title: 'Lore & Storia',
 slug: { current: 'lore' },
 color: '#D4AF37',
 icon: 'book',
 },
 {
 _id: 'cat_combat',
 title: 'Combattimento & Tattica',
 slug: { current: 'combat' },
 color: '#EF4444',
 icon: 'swords',
 },
 {
 _id: 'cat_quest',
 title: 'Indizi & Missioni',
 slug: { current: 'quest' },
 color: '#3B82F6',
 icon: 'target',
 },
 {
 _id: 'cat_secret',
 title: 'Segreti & Teorie',
 slug: { current: 'secret' },
 color: '#8B5CF6',
 icon: 'eye',
 },
];

export const MOCK_SESSIONS: Session[] = [];

export const MOCK_ENTITIES: Entity[] = [];

export const MOCK_NOTES: Note[] = [];

