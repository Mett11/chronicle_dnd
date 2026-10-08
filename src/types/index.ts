export type PlayerPartyStatus = 'active' | 'inactive' | 'retired' | 'dead';

export interface CampaignMemberRecord {
  campaignCode: string;
  userId: string;
  role: 'dm' | 'player' | 'co-dm' | 'comaster';
  characterName?: string;
  createdAt?: string;
}

export interface CampaignProfile {
  characterName: string;
  avatarUrl?: string;
  color?: string;
  status?: PlayerPartyStatus;
  tags?: string[];
  aliases?: string[];
  isCoDm?: boolean;
  isCoMaster?: boolean;
}

export interface UserPreferences {
  theme: {
    colorPalette: string;
    darkMode: boolean;
    campaignTitleFont?: CampaignTitleFont;
    campaignTitleEffect?: CampaignTitleEffect;
    titleUppercase?: boolean;
    titleTracking?: 'tight' | 'normal' | 'wide';
  };
  ai: {
    preferredProvider: 'gemini' | 'cloudflare' | 'openrouter';
    oracleModel: string;
    extractorModel: string;
    loreModel?: string;
    oracleProvider?: 'gemini' | 'cloudflare' | 'openrouter';
    oracleGeminiModel?: string;
    oracleOpenrouterModel?: string;
    oracleCloudflareModel?: string;
    loreProvider?: 'gemini' | 'cloudflare' | 'openrouter';
    loreGeminiModel?: string;
    loreOpenrouterModel?: string;
    loreCloudflareModel?: string;
    extractorProvider?: 'gemini' | 'cloudflare' | 'openrouter';
    extractorGeminiModel?: string;
    extractorOpenrouterModel?: string;
    extractorCloudflareModel?: string;
    favoriteModels?: string[];
    prismalinkPersona?: string;
    prismalinkCodexId?: string;
    effortMode?: string;
    temperature: number;
    maxTokens?: number;
  };
  reading: {
    pillTagsEnabled: boolean;
    dossierViewMode: 'edit' | 'read';
    includeDmAsPlayer: boolean;
    tutorialSeen?: boolean;
  };
  notifications?: {
    dismissedByCampaign?: Record<string, string[]>;
  };
  updatedAt?: string;

  // Legacy / direct flat aliases for backwards compatibility across existing components
  themeId?: string;
  aiProvider?: 'gemini' | 'cloudflare' | 'openrouter';
  oracleGeminiModel?: string;
  oracleCloudflareModel?: string;
  oracleOpenrouterModel?: string;
  extractionGeminiModel?: string;
  extractionCloudflareModel?: string;
  extractionOpenrouterModel?: string;
  showMentionTags?: boolean;
  viewMode?: 'edit' | 'read';
}

export interface UserAccount {
  id: string;
  email: string;
  characterName: string;
  isDm?: boolean;
  isCoDm?: boolean;
  isCoMaster?: boolean;
  dmCampaigns?: string[];
  color: string;
  avatarUrl?: string;
  createdAt: string;
  joinedCampaigns?: string[];
  lastCampaignCode?: string;
  campaignProfiles?: Record<string, CampaignProfile>;
  authProvider?: 'google' | 'password' | 'guest';
  tags?: string[];
  aliases?: string[];
  preferences?: UserPreferences;
}

export type CampaignTitleFont =
  | 'cinzel'
  | 'medieval'
  | 'uncial'
  | 'almendra'
  | 'pirata'
  | 'modern';

export type CampaignTitleEffect =
  | 'default'
  | 'gold'
  | 'ruby'
  | 'amethyst'
  | 'moonlight'
  | 'emerald';

export interface CampaignAiConfig {
  provider?: 'gemini' | 'openrouter';
  modelId?: string;
  oracleModel?: string;
  extractionModel?: string;
  allowedPartyModels?: string[];
}

export interface CampaignMeta {
  code: string;
  name: string;
  subtitle?: string;
  description?: string;
  createdAt: string;
  dmId?: string;
  dmName?: string;
  dmEmail?: string;
  dmIsPlayer?: boolean;
  activePlayerEmails?: string[];
  activePlayers?: any[];
  expelledAccountIds?: string[];
  mapFolders?: any[];
  titleFont?: CampaignTitleFont;
  titleEffect?: CampaignTitleEffect;
  titleUppercase?: boolean;
  titleTracking?: 'tight' | 'normal' | 'wide';
  aiConfig?: CampaignAiConfig;
}

export interface Player {
  _id: string;
  characterName: string;
  email?: string;
  isDm: boolean;
  isCoDm?: boolean;
  isCoMaster?: boolean;
  color?: string;
  aliases?: string[];
  avatarUrl?: string;
  avatar?: any;
  archived?: boolean;
  status?: PlayerPartyStatus;
  tags?: string[];
}

export interface Category {
  _id: string;
  title: string;
  slug: { current: string };
  icon?: string;
  color?: string;
  sortOrder?: number;
  archived?: boolean;
  defaultTemplate?: string;
}

export interface AudioLog {
  id: string;
  title: string;
  audioUrl: string; // Base64 or Object URL
  durationSeconds?: number;
  recordedBy?: string;
  createdAt: string;
  loreDate?: string;
  associatedType?: 'session' | 'entity' | 'note' | 'general';
  associatedId?: string;
}

export interface MapPin {
  id: string;
  title: string;
  description?: string;
  x: number; // Percentage 0-100
  y: number; // Percentage 0-100
  category: 'city' | 'dungeon' | 'tavern' | 'ruins' | 'landmark' | 'danger' | 'quest' | 'faction';
  entityId?: string; // Link to Codex Entity (place/npc/quest)
  entityType?: 'place' | 'npc' | 'monster' | 'item' | 'faction' | 'quest';
  sessionId?: string; // Link to Session
  loreDate?: string;
  color?: string;
  discovered: boolean;
}

export interface MapFolder {
  id: string;
  name: string;
  description?: string;
  color?: string; // e.g. "#3B82F6", "#10B981", "#8B5CF6", "#f59e0b", etc.
  placeEntityId?: string; // Relation to a Codex Place Entity
  createdAt: string;
  isSecret?: boolean;
  sharedWithDm?: boolean;
}

export interface WorldMap {
  id: string;
  title: string;
  description?: string;
  imageUrl: string;
  scaleLabel?: string; // e.g. "1 esagono = 10 miglia"
  isDefault?: boolean;
  pins: MapPin[];
  entityId?: string; // Link to Codex Place Entity
  folderId?: string; // Link to MapFolder
  createdAt: string;
  isSecret?: boolean;
  sharedWithDm?: boolean;
}

export interface ScrapbookItem {
  id: string;
  title: string;
  caption?: string;
  imageUrl: string;
  category: 'character' | 'place' | 'monster' | 'artifact' | 'map' | 'handout' | 'moment';
  loreDate?: string;
  sessionId?: string;
  entityId?: string;
  entityType?: 'npc' | 'monster' | 'place' | 'item' | 'faction' | 'quest' | 'character';
  authorName?: string;
  tags?: string[];
  createdAt: string;
  // Privacy specific fields
  isSecret?: boolean;
  sharedWithDm?: boolean;
}

export interface CampaignChapter {
  id: string;
  name: string; // e.g. "Prologo", "Atto I: L'Ombra della Miniera", "Capitolo 2"
  description?: string;
  color?: string; // e.g. "#D4AF37", "#3B82F6", "#10B981", "#8B5CF6", "#EF4444"
  order?: number;
  coverImageUrl?: string;
  createdAt?: string;
}

export interface SessionEvent {
  id: string;
  title: string;
  description: string;
  loreDate?: string;
  loreStartDay?: number;
  loreEndDay?: number;
  loreMonth?: string;
  loreEndMonth?: string;
  loreYear?: number;
  loreEndYear?: number;
  location?: string;
  impact?: 'major' | 'normal' | 'secret';
  eventType?: 'combat' | 'roleplay' | 'exploration' | 'investigation' | 'lore' | 'mixed';
  involvedCharacters?: string[];
  linkedEntityIds?: string[];
  images?: string[];
  audioLogs?: AudioLog[];
}

export interface GazetteBlock {
  id: string;
  type: 'paragraph' | 'image' | 'heading' | 'quote' | 'break';
  text?: string;
  imageUrl?: string;
  caption?: string;
  imageLayout?: 'full' | 'left' | 'right' | 'center';
}

export interface GazetteConfig {
  title?: string;
  subtitle?: string;
  blocks?: GazetteBlock[];
  showEvents?: boolean;
  showEntities?: boolean;
  showAttendees?: boolean;
  customNotes?: string;
  updatedAt?: string;
}

export interface Session {
  _id: string;
  number: number;
  date: string; // Real world date (YYYY-MM-DD)
  title: string;
  sessionType?: 'combat' | 'roleplay' | 'exploration' | 'investigation' | 'lore' | 'mixed';
  chapterId?: string; // Associated chapter ID
  chapterName?: string; // e.g. "Prologo", "Atto I: L'Ombra dell'Antico"
  linkedEntityIds?: string[];
  loreDate?: string; // Lore date string (e.g. "14 - 16 Alturiak, 1492 CV")
  loreStartDay?: number;
  loreEndDay?: number;
  loreMonth?: string;
  loreEndMonth?: string;
  loreYear?: number;
  loreEndYear?: number;
  recap?: any[];
  events?: SessionEvent[];
  images?: string[];
  coverImage?: any;
  attendees?: Player[];
  excludedPlayerIds?: string[]; // IDs dei PG che non erano presenti (es. entrati in campagna successivamente)
  attendeePlayerIds?: string[]; // IDs dei PG presenti alla sessione
  audioLogs?: AudioLog[];
  quotes?: { speaker: string; text: string }[];
  tags?: string[];
  entitiesExtracted?: boolean;
  entitiesExtractedAt?: string;
  memorySynced?: boolean;
  memorySyncedAt?: string;
  gazetteConfig?: GazetteConfig;
  createdAt?: string;
  updatedAt?: string;
}

export type RelationAttitude = 'friendly' | 'helpful' | 'neutral' | 'suspicious' | 'hostile' | 'fearful' | 'devoted';

export interface RelationMilestone {
  sessionId?: string;
  sessionNumber?: number;
  sessionTitle?: string;
  loreDate?: string;
  attitude: RelationAttitude;
  relationType?: string;
  event: string;                   // Descrizione specifica della svolta (es. "Forte delusione per il tomo proibito")
  trustLevel?: number;            // Eventuale livello di fiducia numerico
  createdAt?: string;
}

export interface EntityPartyRelation {
  playerId: string;
  characterName?: string;
  relationType?: string;
  attitude?: RelationAttitude;
  notes?: string;
  progression?: RelationMilestone[]; // Cronologia storica delle svolte e dell'evoluzione del legame
}

export interface EntityToEntityRelation {
  targetEntityId: string;
  targetEntityName?: string;
  targetEntityType?: 'npc' | 'monster' | 'place' | 'item' | 'faction' | 'quest';
  relationType?: string;
  attitude?: RelationAttitude;
  notes?: string;
  progression?: RelationMilestone[]; // Cronologia storica tra entità o fazioni
}

export interface EntitySecretItem {
  id: string;
  title: string;
  revelationCondition?: string;
  isRevealed?: boolean; // false = Custodito (Riservato DM), true = Svelato al party
  revealedAt?: string;
  revealedBy?: string;
}

export type MemoryCategory =
  | 'event'
  | 'discovery'
  | 'belief_shift'
  | 'relationship'
  | 'milestone'
  | 'trauma'
  | 'secret';

export interface TimelineMemoryEntry {
  id: string;
  sessionId?: string;
  sessionNumber?: number;
  sessionTitle?: string;
  loreDate?: string;
  loreStartDay?: number;
  loreMonth?: string;
  loreYear?: number;
  category: MemoryCategory;
  title: string;
  summary: string;
  impact?: 'major' | 'normal' | 'secret';
  involvedEntities?: string[];
  involvedPlayerNames?: string[];
  revealedAt?: string;
  isSecret?: boolean;
}

export type BeliefStatus =
  | 'active_theory'    // Teoria o sospetto attualmente ritenuto valido
  | 'proven_fact'      // Fatto accertato e verificato nella lore
  | 'shattered_belief' // Vecchia credenza o inganno smentito dalla realtà
  | 'suspicion'        // Forte sospetto in attesa di conferma
  | 'pact';            // Patto, giuramento o accordo vincolante

export interface EvolvingBelief {
  id: string;
  subject: string;                  // e.g. "Lord Soman", "Il Culto del Drago", "Origine dell'Amuleto"
  previousBelief?: string;          // e.g. "Credeva fosse un alleato fedele del Re"
  currentTruth: string;             // e.g. "Ha scoperto che finanziava i briganti in segreto"
  status: BeliefStatus;
  revealedInSessionId?: string;
  revealedInSessionNumber?: number;
  revealedLoreDate?: string;
  notes?: string;
}

export interface InterPartyRelation {
  targetPlayerId: string;
  targetCharacterName: string;
  relationType?: string;            // e.g. "Compagno fidato", "Rivale amichevole", "Sospetto"
  attitude: RelationAttitude;
  trustLevel?: number;              // Scala 1-10 o -5 a +5
  notes?: string;
  sharedSecrets?: string[];
  progression?: RelationMilestone[]; // Cronologia storica dei legami tra compagni
  updatedAt?: string;
  lastUpdatedLoreDate?: string;
}

export interface EntityAiConfig {
  enabled?: boolean;
  speechStyle?: string;
  currentStatus?: string; // Situazione attuale, dove si trova o cosa sta facendo nel presente della campagna
  knowledgeScope?: string;
  knownEntityIds?: string[];
  knownSessionIds?: string[];
  secrets?: EntitySecretItem[];
  secretsToProtect?: string;
  partyRelations?: Record<string, EntityPartyRelation>;
  entityRelations?: Record<string, EntityToEntityRelation>;
  timelineMemories?: TimelineMemoryEntry[]; // Registro storico dei ricordi per PNG
  evolvingBeliefs?: EvolvingBelief[];       // Credenze evolutive e rivelazioni storiche
  visibilityMode?: 'dm_only' | 'all_players' | 'custom';
  allowedViewPlayerIds?: string[];
  allowedEditPlayerIds?: string[];
}

export interface CampaignNotification {
  id: string;
  campaignCode: string;
  category: 'session' | 'note' | 'codex' | 'clarification';
  title: string;
  message: string;
  authorId?: string;
  authorName?: string;
  targetPlayerId?: string; // Optional if specific to one PG
  targetUrl?: string; // e.g. "/sessions", "/notes", "/codex/npc/123"
  createdAt: string;
  entityId?: string;
  sessionId?: string;
  noteId?: string;
}

// =============================================================================
// Session Memory Sync & Evolution Types (Step 2 & 3)
// =============================================================================

export interface PartyRelationUpdateProposal {
  playerId: string;
  characterName: string;
  previousAttitude?: RelationAttitude;
  newAttitude?: RelationAttitude;
  previousRelationType?: string;
  newRelationType?: string;
  previousNotes?: string;
  newNotes?: string;
  milestoneEvent?: string;          // Svolta saliente o fatto narrativo che ha cambiato il rapporto
  reason?: string;
  applied?: boolean;
}

export interface EntityRelationUpdateProposal {
  targetEntityId: string;
  targetEntityName: string;
  targetEntityType?: 'npc' | 'monster' | 'place' | 'item' | 'faction' | 'quest';
  previousAttitude?: RelationAttitude;
  newAttitude?: RelationAttitude;
  previousRelationType?: string;
  newRelationType?: string;
  previousNotes?: string;
  newNotes?: string;
  milestoneEvent?: string;
  reason?: string;
  applied?: boolean;
}

export interface InterPartyRelationUpdateProposal {
  targetPlayerId: string;
  targetCharacterName: string;
  previousAttitude?: RelationAttitude;
  newAttitude?: RelationAttitude;
  previousRelationType?: string;
  newRelationType?: string;
  previousTrust?: number;
  newTrust?: number;
  notes?: string;
  milestoneEvent?: string;
  reason?: string;
  applied?: boolean;
}

export interface PlayerMemoryProposal {
  playerId: string;
  characterName: string;
  involvementType: 'direct_participant' | 'indirect_observer' | 'mentioned';
  reason: string;
  currentStatusBefore?: string;
  suggestedCurrentStatus?: string;
  applyCurrentStatus?: boolean;
  timelineMemories: TimelineMemoryEntry[];
  applyTimelineMemories?: boolean;
  evolvingBeliefs: EvolvingBelief[];
  applyEvolvingBeliefs?: boolean;
  interPartyRelationUpdates: InterPartyRelationUpdateProposal[];
}

export interface EntityMemoryProposal {
  entityId: string;
  entityName: string;
  entityType: 'npc' | 'monster' | 'place' | 'item' | 'faction' | 'quest';
  involvementType: 'direct_participant' | 'indirect_observer' | 'mentioned';
  reason: string;
  currentStatusBefore?: string;
  suggestedCurrentStatus?: string;
  applyCurrentStatus?: boolean;
  partyRelationUpdates: PartyRelationUpdateProposal[];
  entityRelationUpdates: EntityRelationUpdateProposal[];
  timelineMemories?: TimelineMemoryEntry[];
  applyTimelineMemories?: boolean;
  evolvingBeliefs?: EvolvingBelief[];
  applyEvolvingBeliefs?: boolean;
  shouldAddSessionToMemory: boolean;
  applySessionToMemory?: boolean;
  suggestedNewKnowledge?: string;
  applyNewKnowledge?: boolean;
}

export interface SessionMemorySyncResult {
  sessionId: string;
  sessionNumber: number;
  sessionTitle: string;
  loreDate?: string;
  detectedEntities: EntityMemoryProposal[];
  playerProposals?: PlayerMemoryProposal[];
}

export interface Entity {
  _id: string;
  type: 'npc' | 'monster' | 'place' | 'item' | 'faction' | 'quest';
  name: string;
  description?: string;
  imageUrl?: string;
  aliases?: string[];
  status: 'alive' | 'dead' | 'unknown' | 'destroyed' | 'open' | 'completed' | 'failed';
  body?: any[];
  progressNote?: string;
  images?: string[];
  color?: string;
  // AI Persona & Sub-Codex config
  aiConfig?: EntityAiConfig;
  // Quest specific scopes
  questScope?: 'party' | 'personal';
  questPrivacy?: 'public' | 'private';
  assigneePlayerId?: string;
  assigneePlayerName?: string;
  sharedWithDm?: boolean;
  location?: string;
  mapId?: string; // Associated WorldMap ID
  pinId?: string; // Associated Pin ID on the map
  pinCategory?: 'city' | 'dungeon' | 'tavern' | 'ruins' | 'landmark' | 'danger' | 'quest' | 'faction';
  pinX?: number; // Pin X coordinate on map
  pinY?: number; // Pin Y coordinate on map
  isMap?: boolean; // If this place entity is also represented in the Atlas as a map
  mapImageUrl?: string; // Custom map image URL when isMap is true
  folderId?: string; // Associated MapFolder ID in the Atlas
  audioLogs?: AudioLog[];
  createdAt?: string;
  updatedAt?: string;
}

export interface DmResponse {
  text: string;
  answeredAt: string;
  answeredBy: string;
  isResolved?: boolean;
}

export interface Note {
  _id: string;
  _createdAt: string;
  _updatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
  title: string;
  content?: string;
  body?: any[];
  visibility: 'personal' | 'group';
  dmOnly: boolean;
  canonState: 'canon' | 'theory' | 'unknown';
  pinned: boolean;
  askDm: boolean;
  dmResponse?: DmResponse;
  hiddenForDm?: boolean;
  hiddenForPlayerIds?: string[];
  tags?: string[];
  author: Player;
  category?: Category;
  categoryId?: string;
  session?: Session;
  sessionId?: string;
  relatedEntities?: Entity[];
  images?: string[];
  coverImage?: any;
  loreDate?: string;
  audioLogs?: AudioLog[];
}

export interface CalendarMonth {
  id: string;
  name: string;
  days: number;
  season?: string;
  description?: string;
}

export interface CampaignCalendar {
  id: string;
  name: string;
  yearSuffix: string;
  currentYear: number;
  currentMonthIndex: number; // 0-indexed into months array
  currentDay: number;
  months: CalendarMonth[];
  daysOfWeek?: string[];
  specialHolidays?: {
    name: string;
    monthIndex: number;
    day: number;
    description?: string;
  }[];
}

export type RelationshipType =
  | 'parent'
  | 'ancestor'
  | 'sibling'
  | 'spouse'
  | 'child'
  | 'descendant'
  | 'mentor'
  | 'ally'
  | 'rival'
  | 'enemy'
  | 'companion'
  | 'custom';

export type GenerationCategory =
  | 'ancestors'
  | 'parents'
  | 'peers'
  | 'children'
  | 'descendants'
  | 'connections';

export type GenealogyRole =
  // Paternal Grandparents & Ancestors
  | 'paternal_grandfather' // Nonno Paterno (Padre del Padre)
  | 'paternal_grandmother' // Nonna Paterna (Madre del Padre)
  | 'paternal_ancestor' // Antenato / Avo Ramo Paterno
  // Maternal Grandparents & Ancestors
  | 'maternal_grandfather' // Nonno Materno (Padre della Madre)
  | 'maternal_grandmother' // Nonna Materna (Madre della Madre)
  | 'maternal_ancestor' // Antenato / Avo Ramo Materno
  // General Ancestor
  | 'ancestor' // Avo / Fondatore Casata
  // Parents
  | 'father' // Padre
  | 'mother' // Madre
  | 'guardian' // Tutore / Genitore Adottivo
  // Uncles & Aunts (Blood & In-Law)
  | 'paternal_uncle' // Zio Paterno (Fratello del Padre)
  | 'paternal_aunt' // Zia Paterna (Sorella del Padre)
  | 'paternal_uncle_in_law' // Zio Paterno Acquisito (Marito della Zia Paterna)
  | 'paternal_aunt_in_law' // Zia Paterna Acquisita (Moglie dello Zio Paterno)
  | 'maternal_uncle' // Zio Materno (Fratello della Madre)
  | 'maternal_aunt' // Zia Materna (Sorella della Madre)
  | 'maternal_uncle_in_law' // Zio Materno Acquisito (Marito della Zia Materna)
  | 'maternal_aunt_in_law' // Zia Materna Acquisita (Moglie dello Zio Materno)
  // Cousins
  | 'paternal_cousin' // Cugino/a (Ramo Paterno)
  | 'maternal_cousin' // Cugino/a (Ramo Materno)
  | 'cousin' // Cugino/a generico
  // Siblings & In-Laws
  | 'brother' // Fratello
  | 'sister' // Sorella
  | 'sibling' // Fratello / Sorella generico
  | 'sibling_in_law' // Cognato / Cognata
  // Spouse & Partner
  | 'spouse' // Coniuge / Consorte / Partner
  // Children & In-Laws
  | 'son' // Figlio
  | 'daughter' // Figlia
  | 'child' // Figlio / Figlia generico
  | 'child_in_law' // Genero / Nuora (Coniuge del Figlio/a)
  // Nephews & Nieces (Children of siblings)
  | 'nephew' // Nipote maschio (di zio)
  | 'niece' // Nipote femmina (di zia)
  | 'sibling_child' // Nipote (figlio/a di fratello/sorella)
  // Grandchildren (Children of children)
  | 'grandson' // Nipote maschio (di nonno)
  | 'granddaughter' // Nipote femmina (di nonno)
  | 'grandchild' // Nipote di 2a generazione (di nonno)
  | 'descendant'; // Discendente futuro / Pronipote

export interface CharacterRelationship {
  id: string;
  playerId: string; // The character this relation belongs to
  name: string;
  titleOrRole?: string; // e.g. "Matriarca della Casata", "Capitano dei Grifoni"
  relationshipType: RelationshipType;
  customRelationshipLabel?: string; // e.g. "Padrino di Battesimo", "Maestro di Spada"
  generationCategory: GenerationCategory;
  genealogyRole?: GenealogyRole; // Detailed genealogical node position
  sideOfFamily?: 'paternal' | 'maternal' | 'direct' | 'unspecified'; // Side of the bloodline
  status: 'alive' | 'deceased' | 'missing' | 'undead' | 'unknown';
  avatarUrl?: string;
  bio?: string; // Narrative background & history of this member or connection
  // Second parent / co-parent link (e.g. for children of Hero & Spouse)
  secondParentId?: string; // Link to spouse or other parent relationship
  otherParentName?: string; // Name of the other parent (e.g. Coniuge)
  // Cross-links
  linkedEntityId?: string; // Link to Codex Entity (NPC, place, etc.)
  linkedPlayerId?: string; // Link to fellow Player in party
  tags?: string[];
  order?: number;
  createdAt?: string;
  sharedWithParty?: boolean; // Visibility control for party members
  attitude?: 'friendly' | 'hostile' | 'neutral' | 'suspicious' | 'helpful' | 'devoted' | 'rival';
  trustLevel?: number; // 1 to 10
}

export interface CharacterSectionPrivacy {
  identity?: boolean;      // Anagrafica base: Titolo, Razza, Classe, Allineamento, Deità, Città, Nascita
  backstory?: boolean;     // Storia & Cronaca Personale (Markdown)
  traits?: boolean;        // Tratti della Personalità & Ideali
  bondsFlaws?: boolean;    // Legami & Debolezze
  secrets?: boolean;       // Segreti Personali & Scheletri nell'armadio
  appearance?: boolean;    // Aspetto Fisico & Segni Distintivi
  familyTree?: boolean;    // Albero Genealogico & Relazioni Familiari
  personalNotes?: boolean; // Note & Appunti personali del taccuino
  quests?: boolean;        // Obiettivi & Quest Personali
  memories?: boolean;      // Galleria Memorie & Ricordi
  timelineMemories?: boolean; // Timeline cronologica dei ricordi
  evolvingBeliefs?: boolean;  // Credenze, teorie e verità
  interPartyRelations?: boolean; // Relazioni con il party
  worldLore?: boolean;     // Conoscenze e nozioni del mondo apprese
}

export type WorldLoreCategory =
  | 'pantheon'          // Deità, Culti e Religioni
  | 'cosmology'         // Piani di Esistenza, Creazione, Origine del Cosmo
  | 'magic_laws'        // Principi dell'Arcano, Leggi della Magia, Trama
  | 'ancient_history'   // Ere Passate, Imperi Caduti, Cataclismi
  | 'customs_cultures'  // Tradizioni dei Popoli, Usanze, Lingue, Leggi
  | 'factions_orders'   // Ordini Cavallereschi, Gilde Segrete, Confraternite
  | 'geography_nature'  // Regioni Mistiche, Clima Magico, Terre Selvagge
  | 'general';          // Principi Generali & Miti

export type LoreBiteLevel =
  | 'public'            // Sapere Comune / Popolare (chiunque può saperlo)
  | 'specialized'       // Conoscenza Accademica / Iniziatica (studiosi, chierici, background specifici)
  | 'esoteric'          // Sapere Arcano / Mito Dimenticato (scoperto da tomi antichi o maestri)
  | 'secret';           // Verità Proibita / Segreto Cosmico (rivelazione del DM)

export interface LoreBiteAssignee {
  id: string;                      // Player ID or Entity ID
  name: string;
  type: 'player' | 'entity';
  acquisitionNote?: string;        // e.g. "Studiato nell'abbazia di Candlekeep", "Tramandato dal maestro"
  addedAt?: string;
}

export interface WorldLoreBite {
  id: string;
  title: string;
  content: string;
  level: LoreBiteLevel;
  category?: WorldLoreCategory;    // Categoria tematica specifica per la singola nozione
  customTag?: string;              // e.g. "Rito Sacro", "Formula Proibita", "Leggenda Orale"
  loreDate?: string;               // Eventuale data di lore associata all'evento
  linkedEntityIds?: string[];      // Collegamenti a PNG, Luoghi o Fazioni del compendio
  knownBy: LoreBiteAssignee[];     // Chi possiede questa specifica nozione nel party/PNG
}

export interface WorldLoreArticle {
  _id: string;
  _createdAt: string;
  _updatedAt?: string;
  title: string;
  subtitle?: string;
  category: WorldLoreCategory;
  customCategory?: string;
  summary?: string;
  fullContentMarkdown: string;
  bites: WorldLoreBite[];
  authorPlayerId?: string;
  authorName?: string;
  dmOnly?: boolean;
  tags?: string[];
  relatedEntityIds?: string[];     // Link to Codex entities (NPCs, places, items)
  images?: string[];
  order?: number;
}

export interface CharacterKnownLoreItem {
  articleId: string;
  biteId: string;
  articleTitle: string;
  biteTitle: string;
  biteLevel: LoreBiteLevel;
  note?: string;
  addedAt?: string;
}

export interface CharacterBio {
  playerId: string;
  email?: string;
  campaignCode?: string;
  characterName?: string;
  name?: string;
  avatarUrl?: string;
  color?: string;
  bio?: string;
  notes?: string;
  traits?: any;
  stats?: any;
  status?: string;
  characterTitle?: string;
  characterClass?: string;
  characterRace?: string;
  characterAlignment?: string;
  deityOrPatron?: string;
  hometown?: string;
  // Lore Birthday
  birthDateFormatted?: string;
  birthStartDay?: number;
  birthMonth?: string;
  birthYear?: number;
  // Detailed Lore & Backstory
  backstoryMarkdown?: string;
  personalityTraits?: string[];
  ideals?: string;
  bonds?: string;
  flaws?: string;
  secrets?: string;
  appearanceDescription?: string;
  // Dynamic Evolution & Temporal Memory (Step 1)
  currentStatus?: string;                   // Dove si trova o cosa sta facendo nel presente
  timelineMemories?: TimelineMemoryEntry[]; // Registro storico dei ricordi del PG ordinato per data di Lore
  evolvingBeliefs?: EvolvingBelief[];       // Teorie, credenze smentite e verità scoperte dal PG
  interPartyRelations?: Record<string, InterPartyRelation>; // Relazioni con gli altri compagni di squadra (PG ↔ PG)
  knownLoreBites?: CharacterKnownLoreItem[]; // Bagaglio di conoscenze e nozioni del mondo
  // Granular section privacy for party view
  privacySettings?: CharacterSectionPrivacy;
  updatedAt?: string;
}


