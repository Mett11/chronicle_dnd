import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import {
  Globe,
  Compass,
  BookOpen,
  Sparkles,
  Search,
  Plus,
  Filter,
  Check,
  CheckCircle2,
  X,
  Edit3,
  Trash2,
  Users,
  Shield,
  Lock,
  Unlock,
  Eye,
  AlertCircle,
  HelpCircle,
  Clock,
  Layers,
  ChevronRight,
  ArrowRight,
  Share2,
  ExternalLink,
  Tag,
  Zap,
  RotateCcw,
  User,
  Info,
  Cpu,
  Key,
  Loader2,
  ChevronDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { Portal } from '../components/Portal';
import { ApiKeyManager } from '../lib/apiKeyManager';
import { cleanOpenRouterModelId } from '../lib/openrouterUtils';
import { UserPreferencesService } from '../lib/userPreferencesService';
import { LlmCatalogModal, LlmProviderType } from '../components/OpenRouterCatalogModal';
import { isSupabaseConfigured } from '../lib/supabase';
import { SupabaseSyncService } from '../lib/supabaseSyncService';
import {
  WorldLoreArticle,
  WorldLoreBite,
  WorldLoreCategory,
  LoreBiteLevel,
  Player,
  Entity,
} from '../types';
import { WorldLoreService, DecomposedBiteSuggestion } from '../lib/worldLoreService';

export const WORLD_LORE_CATEGORIES: {
  id: WorldLoreCategory;
  label: string;
  icon: string;
  color: string;
  description: string;
}[] = [
  {
    id: 'pantheon',
    label: 'Deità & Religioni',
    icon: '⚡',
    color: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    description: 'Dei, culti divini, dogmi sacri, ordini sacerdotali e poteri celesti',
  },
  {
    id: 'cosmology',
    label: 'Cosmologia & Piani',
    icon: '🌌',
    color: 'text-indigo-400 border-indigo-500/30 bg-indigo-500/10',
    description: 'Origine del cosmo, piani di esistenza, il Piano Astrale e le sfere celesti',
  },
  {
    id: 'magic_laws',
    label: 'Leggi della Magia',
    icon: '✨',
    color: 'text-sky-400 border-sky-500/30 bg-sky-500/10',
    description: 'La Trama magica, scuole d\'arcano, formule proibite e flussi di mana',
  },
  {
    id: 'ancient_history',
    label: 'Storia Antica & Ere',
    icon: '⏳',
    color: 'text-rose-400 border-rose-500/30 bg-rose-500/10',
    description: 'Imperi caduti, cataclismi leggendari, ere passate e cronache dimenticate',
  },
  {
    id: 'customs_cultures',
    label: 'Usanze & Popoli',
    icon: '📜',
    color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    description: 'Tradizioni culturali, lingue, tabù popolari, feste e leggi dei regni',
  },
  {
    id: 'factions_orders',
    label: 'Ordini & Fazioni',
    icon: '🛡️',
    color: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
    description: 'Ordini cavallereschi, confraternite segrete e gilde che plasmano il mondo',
  },
  {
    id: 'geography_nature',
    label: 'Terre & Natura Mistica',
    icon: '🏔️',
    color: 'text-teal-400 border-teal-500/30 bg-teal-500/10',
    description: 'Regioni mistiche, terre selvagge, anomalie ambientali e climi magici',
  },
  {
    id: 'general',
    label: 'Principi Fondamentali',
    icon: '📖',
    color: 'text-content-2 border-surface-3 bg-surface-2/60',
    description: 'Miti fondativi, concetti universali e primer generale della campagna',
  },
];

export const LORE_LEVEL_CONFIG: Record<
  LoreBiteLevel,
  { label: string; badgeClass: string; icon: string; description: string }
> = {
  public: {
    label: 'Sapere Popolare',
    badgeClass: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    icon: '👥',
    description: 'Conoscenza comune diffusa tra la gente del continente',
  },
  specialized: {
    label: 'Conoscenza Iniziatica',
    badgeClass: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
    icon: '🎓',
    description: 'Appannaggio di studiosi, sacerdoti, chierici o background specifici',
  },
  esoteric: {
    label: 'Mito Arcano / Dimenticato',
    badgeClass: 'bg-purple-500/10 text-purple-300 border-purple-500/30',
    icon: '🔮',
    description: 'Verità accessibile solo tramite tomi antichi, maestri o indagini profonde',
  },
  secret: {
    label: 'Verità Proibita',
    badgeClass: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
    icon: '🗝️',
    description: 'Segreto del Master o rivelazione sconvolgente scoperta nel corso della trama',
  },
};

export function WorldLore() {
  const { player } = useAuth();
  const navigate = useNavigate();
  const { id: routeArticleId } = useParams();

  const [articles, setArticles] = useState<WorldLoreArticle[]>(() => CampaignManager.getWorldLoreArticles());
  const [allPlayers, setAllPlayers] = useState<Player[]>(() => CampaignManager.getPlayers());
  const [allEntities, setAllEntities] = useState<Entity[]>(() => CampaignManager.getEntities());

  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(routeArticleId || null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [characterFilter, setCharacterFilter] = useState<string>('all');

  // Modal State for creation/edit
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingArticle, setEditingArticle] = useState<WorldLoreArticle | null>(null);
  const [articleToDelete, setArticleToDelete] = useState<WorldLoreArticle | null>(null);

  // Assignee modal / popup for a specific bite
  const [managingBite, setManagingBite] = useState<{ article: WorldLoreArticle; bite: WorldLoreBite } | null>(null);

  const isDm = Boolean(player?.isDm);

  // Reload store when events fire
  useEffect(() => {
    const code = CampaignManager.getActiveCampaignCode();
    if (code && isSupabaseConfigured() && CampaignManager.getWorldLoreArticles().length === 0) {
      SupabaseSyncService.fetchWorldLoreOnly(code).then((remoteArticles) => {
        if (remoteArticles && Array.isArray(remoteArticles) && remoteArticles.length > 0) {
          CampaignManager.saveAllWorldLoreArticlesLocalOnly(remoteArticles);
          setArticles(remoteArticles);
        }
      }).catch(() => {});
    }

    const handleUpdate = () => {
      setArticles(CampaignManager.getWorldLoreArticles());
      setAllPlayers(CampaignManager.getPlayers());
      setAllEntities(CampaignManager.getEntities());
    };
    window.addEventListener('chronicle_world_lore_updated', handleUpdate);
    window.addEventListener('chronicle_data_updated', handleUpdate);
    window.addEventListener('chronicle_accounts_updated', handleUpdate);
    return () => {
      window.removeEventListener('chronicle_world_lore_updated', handleUpdate);
      window.removeEventListener('chronicle_data_updated', handleUpdate);
      window.removeEventListener('chronicle_accounts_updated', handleUpdate);
    };
  }, []);

  // Sync selected article with route if URL has ID
  useEffect(() => {
    if (routeArticleId) {
      setSelectedArticleId(routeArticleId);
    }
  }, [routeArticleId]);

  // Set default selection if none selected and articles exist
  useEffect(() => {
    if (!selectedArticleId && articles.length > 0) {
      setSelectedArticleId(articles[0]._id);
    }
  }, [articles, selectedArticleId]);

  // Filtered articles
  const filteredArticles = useMemo(() => {
    return articles.filter((art) => {
      // DM only check
      if (art.dmOnly && !isDm) return false;

      // Category filter
      if (selectedCategory !== 'all' && art.category !== selectedCategory) {
        return false;
      }

      // Character / Assignee filter
      if (characterFilter !== 'all') {
        const hasKnowledge = art.bites.some((b) =>
          b.knownBy.some((k) => k.id === characterFilter && k.type === 'player')
        );
        if (!hasKnowledge) return false;
      }

      // Level filter
      if (levelFilter !== 'all') {
        const hasLevel = art.bites.some((b) => b.level === levelFilter);
        if (!hasLevel) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const inTitle = art.title.toLowerCase().includes(q);
        const inSubtitle = art.subtitle?.toLowerCase().includes(q);
        const inSummary = art.summary?.toLowerCase().includes(q);
        const inContent = art.fullContentMarkdown.toLowerCase().includes(q);
        const inTags = art.tags?.some((t) => t.toLowerCase().includes(q));
        const inBites = art.bites.some(
          (b) => b.title.toLowerCase().includes(q) || b.content.toLowerCase().includes(q)
        );
        if (!inTitle && !inSubtitle && !inSummary && !inContent && !inTags && !inBites) {
          return false;
        }
      }

      return true;
    });
  }, [articles, selectedCategory, characterFilter, levelFilter, searchQuery, isDm]);

  const selectedArticle = useMemo(() => {
    if (!selectedArticleId) return filteredArticles[0] || null;
    return articles.find((a) => a._id === selectedArticleId) || filteredArticles[0] || null;
  }, [articles, selectedArticleId, filteredArticles]);

  const handleOpenCreateModal = () => {
    setEditingArticle(null);
    setIsEditorOpen(true);
  };

  const handleOpenEditModal = (article: WorldLoreArticle) => {
    setEditingArticle(article);
    setIsEditorOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!articleToDelete) return;
    CampaignManager.deleteWorldLoreArticle(articleToDelete._id);
    setArticles(CampaignManager.getWorldLoreArticles());
    if (selectedArticleId === articleToDelete._id) {
      setSelectedArticleId(null);
    }
    setArticleToDelete(null);
  };

  // Quick toggle all party for a bite
  const handleToggleAllPartyForBite = (article: WorldLoreArticle, bite: WorldLoreBite) => {
    const allKnown = allPlayers.every((p) =>
      bite.knownBy.some((k) => k.id === p._id && k.type === 'player')
    );

    if (allKnown) {
      // Remove all party
      allPlayers.forEach((p) => {
        CampaignManager.removeLoreBiteFromPlayer(article._id, bite.id, p._id);
      });
    } else {
      // Add all party
      allPlayers.forEach((p) => {
        CampaignManager.assignLoreBiteToPlayer(
          article._id,
          bite.id,
          p._id,
          p.characterName || (p as any).username || 'Avventuriero',
          'Sapere diffuso del gruppo'
        );
      });
    }
    setArticles(CampaignManager.getWorldLoreArticles());
  };

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-surface-0 overflow-hidden">
      {/* Top Header Bar */}
      <header className="px-4 sm:px-6 py-3.5 border-b border-surface-2 bg-surface-1/80 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/25 flex items-center justify-center shrink-0 shadow-xs">
            <Globe size={20} />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-cinzel font-bold text-content-1 tracking-wide truncate flex items-center gap-2">
              <span>World Lore &amp; Principi del Mondo</span>
            </h1>
            <p className="text-xs text-content-3 truncate">
              Cosmogonia, panteon, leggi dell'arcano e bagaglio di conoscenze del party
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-3.5 py-1.5 rounded-xl bg-primary text-surface-0 hover:bg-primary-hover font-sans text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <Plus size={15} />
            <span>Nuovo Articolo di Lore</span>
          </button>
        </div>
      </header>

      {/* Filter and Category Strip */}
      <div className="px-4 sm:px-6 py-2.5 border-b border-surface-2/70 bg-surface-1/40 flex items-center gap-2 overflow-x-auto custom-scrollbar shrink-0">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-primary text-surface-0 font-semibold shadow-xs'
              : 'bg-surface-2 text-content-2 hover:bg-surface-3 hover:text-content-1'
          }`}
        >
          Tutte le Voci ({articles.length})
        </button>

        {WORLD_LORE_CATEGORIES.map((cat) => {
          const count = articles.filter((a) => a.category === cat.id).length;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-primary text-surface-0 font-semibold shadow-xs'
                  : 'bg-surface-2 text-content-2 hover:bg-surface-3 hover:text-content-1'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
              {count > 0 && <span className="text-[10px] opacity-80">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Main Two-Pane View */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Sidebar: Article Search & List */}
        <aside
          className={`w-full lg:w-80 xl:w-96 border-r border-surface-2 bg-surface-1/30 flex flex-col shrink-0 ${
            selectedArticle ? 'hidden lg:flex' : 'flex'
          }`}
        >
          {/* Search and Secondary Filter Bar */}
          <div className="p-3 border-b border-surface-2 space-y-2 bg-surface-1/50">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cerca per titolo, nozione o tag..."
                className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface-2 border border-surface-3 text-xs text-content-1 placeholder:text-content-3 focus:outline-none focus:border-primary transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-content-3 hover:text-content-1"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {/* Level Filter */}
              <select
                value={levelFilter}
                onChange={(e) => setLevelFilter(e.target.value)}
                className="px-2 py-1 rounded-md bg-surface-2 border border-surface-3 text-content-2 focus:outline-none focus:border-primary"
              >
                <option value="all">Tutti i Livelli</option>
                <option value="public">👥 Sapere Popolare</option>
                <option value="specialized">🎓 Iniziatica</option>
                <option value="esoteric">🔮 Mito Arcano</option>
                <option value="secret">🗝️ Verità Proibita</option>
              </select>

              {/* Character Known Filter */}
              <select
                value={characterFilter}
                onChange={(e) => setCharacterFilter(e.target.value)}
                className="px-2 py-1 rounded-md bg-surface-2 border border-surface-3 text-content-2 focus:outline-none focus:border-primary truncate"
              >
                <option value="all">Tutti i PG</option>
                {allPlayers.map((p) => (
                  <option key={p._id} value={p._id}>
                    Conosciuto da {p.characterName || (p as any).username || 'PG'}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Article List Cards */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1.5">
            {filteredArticles.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="w-10 h-10 rounded-full bg-surface-2 text-content-3 flex items-center justify-center mx-auto">
                  <Compass size={20} />
                </div>
                <p className="text-xs text-content-3">
                  Nessun articolo di World Lore corrisponde ai filtri selezionati.
                </p>
                {articles.length === 0 && (
                  <button
                    type="button"
                    onClick={handleOpenCreateModal}
                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-semibold hover:bg-primary/20 transition-colors inline-flex items-center gap-1.5"
                  >
                    <Plus size={13} />
                    <span>Incolla il primo estratto del Master</span>
                  </button>
                )}
              </div>
            ) : (
              filteredArticles.map((art) => {
                const isSelected = selectedArticle?._id === art._id;
                const catDef = WORLD_LORE_CATEGORIES.find((c) => c.id === art.category) || WORLD_LORE_CATEGORIES[7];
                const totalBites = art.bites.length;
                const publicBites = art.bites.filter((b) => b.level === 'public').length;
                const esotericBites = art.bites.filter((b) => b.level === 'esoteric' || b.level === 'secret').length;

                return (
                  <button
                    key={art._id}
                    type="button"
                    onClick={() => {
                      setSelectedArticleId(art._id);
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                      isSelected
                        ? 'bg-surface-2 border-primary/40 shadow-xs'
                        : 'bg-surface-1/60 border-surface-2/80 hover:bg-surface-2/60 hover:border-surface-3'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border font-medium ${catDef.color}`}>
                        {catDef.icon} {catDef.label}
                      </span>
                      {art.dmOnly && (
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                          <Lock size={10} />
                          <span>DM Only</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-xs font-semibold text-content-1 font-serif leading-snug truncate">
                      {art.title}
                    </h3>

                    {art.subtitle && (
                      <p className="text-[11px] text-content-3 truncate">{art.subtitle}</p>
                    )}

                    {/* Footer stats: Bites and known by indicator */}
                    <div className="flex items-center justify-between pt-1 border-t border-surface-3/50 text-[10px] text-content-3 font-mono">
                      <span>
                        🧩 {totalBites} {totalBites === 1 ? 'nozione' : 'nozioni'}
                      </span>
                      {esotericBites > 0 && (
                        <span className="text-purple-400">🔮 {esotericBites} arcani/segreti</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        {/* Right Pane: Full Article Reader & Granular Lore Bites */}
        <main className={`flex-1 flex flex-col min-w-0 bg-surface-0 overflow-y-auto custom-scrollbar ${
          selectedArticle ? 'flex' : 'hidden lg:flex'
        }`}>
          {selectedArticle ? (
            <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full space-y-8">
              {/* Back to List on mobile */}
              <div className="lg:hidden flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedArticleId(null)}
                  className="px-3 py-1.5 rounded-lg bg-surface-2 text-content-2 text-xs font-medium flex items-center gap-1.5"
                >
                  <ChevronRight size={14} className="rotate-180" />
                  <span>Torna all'Elenco Articoli</span>
                </button>
              </div>

              {/* Article Header Card */}
              <div className="p-5 sm:p-6 rounded-2xl bg-surface-1 border border-surface-2 space-y-4 shadow-sm relative overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(() => {
                      const catDef = WORLD_LORE_CATEGORIES.find((c) => c.id === selectedArticle.category) || WORLD_LORE_CATEGORIES[7];
                      return (
                        <span className={`text-xs font-mono px-2.5 py-1 rounded-lg border font-semibold ${catDef.color}`}>
                          {catDef.icon} {catDef.label}
                        </span>
                      );
                    })()}

                    {selectedArticle.dmOnly && (
                      <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center gap-1.5">
                        <Lock size={12} />
                        <span>Riservato al Master</span>
                      </span>
                    )}

                    {selectedArticle.tags && selectedArticle.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {selectedArticle.tags.map((t, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-content-3 border border-surface-3"
                          >
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions (Edit / Delete) */}
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(selectedArticle)}
                      className="p-2 rounded-lg bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Modifica articolo e nozioni"
                    >
                      <Edit3 size={14} />
                      <span className="hidden sm:inline">Modifica</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setArticleToDelete(selectedArticle)}
                      className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                      title="Elimina articolo di lore"
                    >
                      <Trash2 size={14} />
                      <span className="hidden sm:inline">Elimina</span>
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-cinzel font-bold text-content-1 leading-tight">
                    {selectedArticle.title}
                  </h2>
                  {selectedArticle.subtitle && (
                    <p className="text-sm font-serif italic text-primary/90">
                      {selectedArticle.subtitle}
                    </p>
                  )}
                </div>

                {selectedArticle.summary && (
                  <div className="p-3.5 rounded-xl bg-surface-2/60 border border-surface-3/80 text-xs text-content-2 leading-relaxed font-sans">
                    <span className="font-semibold text-content-1 font-mono uppercase tracking-wider text-[10px] block mb-1">
                      Sommario Sintetico
                    </span>
                    {selectedArticle.summary}
                  </div>
                )}
              </div>

              {/* Granular Knowledge & Lore Bites Section */}
              <section className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Sparkles size={14} />
                    </div>
                    <h3 className="text-sm font-cinzel font-bold text-content-1 uppercase tracking-wider">
                      Nozioni Granulari &amp; Chi le Conosce nel Party ({selectedArticle.bites.length})
                    </h3>
                  </div>
                  <span className="text-[11px] text-content-3 font-mono">
                    Livelli di profondità cosmica
                  </span>
                </div>

                {selectedArticle.bites.length === 0 ? (
                  <div className="p-4 rounded-xl bg-surface-1 border border-surface-2 text-center text-xs text-content-3 italic">
                    Nessuna nozione granulare estratta. Clicca su Modifica per aggiungerne con o senza l'IA.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {selectedArticle.bites.map((bite) => {
                      const levelConf = LORE_LEVEL_CONFIG[bite.level] || LORE_LEVEL_CONFIG.public;
                      const knownPlayers = bite.knownBy.filter((k) => k.type === 'player');
                      const knownEntities = bite.knownBy.filter((k) => k.type === 'entity');
                      const isKnownByAllParty = allPlayers.length > 0 && allPlayers.every((p) =>
                        knownPlayers.some((kp) => kp.id === p._id)
                      );

                      return (
                        <div
                          key={bite.id}
                          className="p-4 rounded-xl bg-surface-1 border border-surface-2 hover:border-surface-3 transition-colors space-y-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="space-y-1 flex-1 min-w-[240px]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${levelConf.badgeClass}`}>
                                  {levelConf.icon} {levelConf.label}
                                </span>

                                {bite.customTag && (
                                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-2 text-content-2 border border-surface-3">
                                    {bite.customTag}
                                  </span>
                                )}
                              </div>

                              <h4 className="text-xs sm:text-sm font-semibold text-content-1 font-serif">
                                {bite.title}
                              </h4>
                            </div>

                            {/* Quick Assign Buttons */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleAllPartyForBite(selectedArticle, bite)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors flex items-center gap-1 cursor-pointer ${
                                  isKnownByAllParty
                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                    : 'bg-surface-2 text-content-2 hover:text-content-1 border-surface-3'
                                }`}
                                title={isKnownByAllParty ? 'Rimuovi da tutto il party' : 'Assegna a tutti i membri del party'}
                              >
                                <Users size={12} />
                                <span>{isKnownByAllParty ? 'Noto a tutto il Party' : 'Assegna a tutto il Party'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setManagingBite({ article: selectedArticle, bite })}
                                className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 text-[11px] font-medium border border-surface-3 transition-colors flex items-center gap-1 cursor-pointer"
                                title="Gestisci chi conosce questa nozione in dettaglio"
                              >
                                <Edit3 size={11} />
                                <span>Portatori ({bite.knownBy.length})</span>
                              </button>
                            </div>
                          </div>

                          <p className="text-xs text-content-2 leading-relaxed font-sans">
                            {bite.content}
                          </p>

                          {/* Chips of characters who know this */}
                          {bite.knownBy.length > 0 && (
                            <div className="pt-2 border-t border-surface-2/60 flex items-center gap-1.5 flex-wrap text-[11px]">
                              <span className="text-content-3 text-[10px] font-mono shrink-0 mr-1">
                                Portatori di questo Sapere:
                              </span>
                              {knownPlayers.map((kp) => (
                                <span
                                  key={kp.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 text-[10px] font-medium"
                                  title={kp.acquisitionNote || 'Conoscenza acquisita'}
                                >
                                  <User size={10} />
                                  <span>{kp.name}</span>
                                </span>
                              ))}
                              {knownEntities.map((ke) => (
                                <span
                                  key={ke.id}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-2 text-content-2 border border-surface-3 text-[10px]"
                                  title="PNG / Entità del Compendio"
                                >
                                  <Shield size={10} className="text-amber-400" />
                                  <span>{ke.name}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Full Markdown Text Content */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <BookOpen size={14} />
                  </div>
                  <h3 className="text-sm font-cinzel font-bold text-content-1 uppercase tracking-wider">
                    Cronaca &amp; Trattato Integrale
                  </h3>
                </div>

                <div className="p-5 sm:p-7 rounded-2xl bg-surface-1 border border-surface-2 text-sm text-content-2 leading-relaxed">
                  <MarkdownRenderer content={selectedArticle.fullContentMarkdown || selectedArticle.summary || ''} />
                </div>
              </section>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-surface-1 border border-surface-2 text-primary flex items-center justify-center shadow-inner">
                <Globe size={28} />
              </div>
              <div className="space-y-1 max-w-md">
                <h3 className="text-base font-cinzel font-bold text-content-1">
                  Nessun Articolo Selezionato
                </h3>
                <p className="text-xs text-content-3">
                  Seleziona una voce dal menu a sinistra oppure incolla un estratto o documento del Master per generare il tuo archivio di World Lore.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreateModal}
                className="px-4 py-2 rounded-xl bg-primary text-surface-0 hover:bg-primary-hover text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Plus size={15} />
                <span>Crea o Scomponi con IA</span>
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Editor Modal (Create / Edit with AI Decompose) */}
      {isEditorOpen && (
        <WorldLoreEditorModal
          isOpen={isEditorOpen}
          initialArticle={editingArticle}
          allPlayers={allPlayers}
          allEntities={allEntities}
          onClose={() => setIsEditorOpen(false)}
          onSaved={(saved) => {
            setArticles(CampaignManager.getWorldLoreArticles());
            setSelectedArticleId(saved._id);
            setIsEditorOpen(false);
          }}
        />
      )}

      {/* Bite Assignee Management Modal */}
      {managingBite && (
        <BiteAssigneeModal
          isOpen={Boolean(managingBite)}
          article={managingBite.article}
          bite={managingBite.bite}
          allPlayers={allPlayers}
          allEntities={allEntities}
          onClose={() => setManagingBite(null)}
          onUpdated={() => {
            setArticles(CampaignManager.getWorldLoreArticles());
            setManagingBite(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {articleToDelete && (
        <Portal>
          <div className="fixed inset-0 z-50 bg-surface-0/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface-1 border border-surface-3 rounded-2xl p-6 space-y-4 shadow-2xl">
              <div className="flex items-center gap-3 text-rose-400">
                <Trash2 size={24} />
                <h3 className="text-base font-cinzel font-bold text-content-1">
                  Elimina Articolo di Lore
                </h3>
              </div>
              <p className="text-xs text-content-2 leading-relaxed">
                Sei sicuro di voler eliminare <strong>"{articleToDelete.title}"</strong>? Le nozioni associate verranno rimosse anche dal bagaglio di conoscenze dei singoli PG.
              </p>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-2">
                <button
                  type="button"
                  onClick={() => setArticleToDelete(null)}
                  className="px-3.5 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-2 text-xs font-medium cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleDeleteConfirm}
                  className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Elimina Definitivamente
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}

// ==========================================
// EDITOR & AI SCOMPOSITION MODAL COMPONENT
// ==========================================
interface WorldLoreEditorModalProps {
  isOpen: boolean;
  initialArticle: WorldLoreArticle | null;
  allPlayers: Player[];
  allEntities: Entity[];
  onClose: () => void;
  onSaved: (article: WorldLoreArticle) => void;
}

export type LoreProviderType = 'gemini' | 'openrouter' | 'cloudflare';

function WorldLoreEditorModal({
  isOpen,
  initialArticle,
  allPlayers,
  allEntities,
  onClose,
  onSaved,
}: WorldLoreEditorModalProps) {
  const { player } = useAuth();
  const [activeTab, setActiveTab] = useState<'ai' | 'manual'>(initialArticle ? 'manual' : 'ai');

  // Provider & Model State
  const [provider, setProvider] = useState<LoreProviderType>(() => {
    const prefs = UserPreferencesService.getLocalPreferences();
    return (prefs.ai?.loreProvider || prefs.ai?.preferredProvider || 'gemini') as LoreProviderType;
  });

  const [geminiModel, setGeminiModel] = useState<string>(() => {
    const prefs = UserPreferencesService.getLocalPreferences();
    return prefs.ai?.loreGeminiModel || prefs.ai?.oracleGeminiModel || 'gemini-2.5-flash';
  });

  const [openrouterModel, setOpenrouterModel] = useState<string>(() => {
    const prefs = UserPreferencesService.getLocalPreferences();
    return cleanOpenRouterModelId(prefs.ai?.loreOpenrouterModel || prefs.ai?.oracleOpenrouterModel || 'openrouter/free');
  });

  const [cloudflareModel, setCloudflareModel] = useState<string>(() => {
    const prefs = UserPreferencesService.getLocalPreferences();
    return prefs.ai?.loreCloudflareModel || prefs.ai?.oracleCloudflareModel || '@cf/meta/llama-3.3-70b-instruct-fp8';
  });

  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);
  const [keysConfig, setKeysConfig] = useState(() => ApiKeyManager.getKeys());

  // Listen to keys and preferences update reactively
  useEffect(() => {
    const handleKeysUpdate = () => {
      setKeysConfig(ApiKeyManager.getKeys());
    };

    const handlePrefsUpdate = (e: any) => {
      const p = e?.detail?.preferences?.ai;
      if (p) {
        if (p.loreProvider) setProvider(p.loreProvider);
        if (p.loreGeminiModel) setGeminiModel(p.loreGeminiModel);
        if (p.loreOpenrouterModel) setOpenrouterModel(cleanOpenRouterModelId(p.loreOpenrouterModel));
        if (p.loreCloudflareModel) setCloudflareModel(p.loreCloudflareModel);
      }
    };

    // Preload keys in background and update immediately upon completion
    ApiKeyManager.preloadAllKeys().then(handleKeysUpdate);

    window.addEventListener('chronicle_api_keys_updated', handleKeysUpdate);
    window.addEventListener('chronicle_campaign_keys_updated', handleKeysUpdate);
    window.addEventListener('chronicle_keys_preloaded', handleKeysUpdate);
    window.addEventListener('chronicle_key_mode_changed', handleKeysUpdate);
    window.addEventListener('chronicle_accounts_updated', handleKeysUpdate);
    window.addEventListener('chronicle_data_updated', handleKeysUpdate);
    window.addEventListener('chronicle_user_preferences_updated', handlePrefsUpdate);
    window.addEventListener('storage', handleKeysUpdate);

    return () => {
      window.removeEventListener('chronicle_api_keys_updated', handleKeysUpdate);
      window.removeEventListener('chronicle_campaign_keys_updated', handleKeysUpdate);
      window.removeEventListener('chronicle_keys_preloaded', handleKeysUpdate);
      window.removeEventListener('chronicle_key_mode_changed', handleKeysUpdate);
      window.removeEventListener('chronicle_accounts_updated', handleKeysUpdate);
      window.removeEventListener('chronicle_data_updated', handleKeysUpdate);
      window.removeEventListener('chronicle_user_preferences_updated', handlePrefsUpdate);
      window.removeEventListener('storage', handleKeysUpdate);
    };
  }, []);

  const campKeys = ApiKeyManager.getCampaignKeys();
  const persKeys = ApiKeyManager.getPersonalKeys();

  const hasGeminiKey = Boolean(
    keysConfig.geminiKey ||
    campKeys.geminiKey ||
    persKeys.geminiKey ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('chronicle_gemini_api_key'))
  );
  const hasOpenRouterKey = Boolean(keysConfig.openrouterKey || campKeys.openrouterKey || persKeys.openrouterKey);
  const hasCloudflareKey = Boolean(
    (keysConfig.cloudflareAccountId || campKeys.cloudflareAccountId || persKeys.cloudflareAccountId) &&
    (keysConfig.cloudflareApiToken || campKeys.cloudflareApiToken || persKeys.cloudflareApiToken)
  );

  const hasKeyForActiveProvider =
    provider === 'gemini' ? hasGeminiKey :
    provider === 'openrouter' ? hasOpenRouterKey :
    hasCloudflareKey;

  const activeModelId = useMemo(() => {
    if (provider === 'openrouter') return openrouterModel;
    if (provider === 'cloudflare') return cloudflareModel;
    return geminiModel;
  }, [provider, openrouterModel, cloudflareModel, geminiModel]);

  const handleProviderSelect = (p: LoreProviderType) => {
    setProvider(p);
    UserPreferencesService.saveAiPreferences({ loreProvider: p });
  };

  const handleGeminiModelChange = (m: string) => {
    setGeminiModel(m);
    UserPreferencesService.saveAiPreferences({ loreGeminiModel: m });
  };

  const handleOpenRouterModelChange = (m: string) => {
    const clean = cleanOpenRouterModelId(m);
    setOpenrouterModel(clean);
    UserPreferencesService.saveAiPreferences({ loreOpenrouterModel: clean });
  };

  const handleCloudflareModelChange = (m: string) => {
    setCloudflareModel(m);
    UserPreferencesService.saveAiPreferences({ loreCloudflareModel: m });
  };

  // Form Fields
  const [title, setTitle] = useState(initialArticle?.title || '');
  const [subtitle, setSubtitle] = useState(initialArticle?.subtitle || '');
  const [category, setCategory] = useState<WorldLoreCategory>(initialArticle?.category || 'pantheon');
  const [summary, setSummary] = useState(initialArticle?.summary || '');
  const [fullContentMarkdown, setFullContentMarkdown] = useState(initialArticle?.fullContentMarkdown || '');
  const [tagsInput, setTagsInput] = useState((initialArticle?.tags || []).join(', '));
  const [dmOnly, setDmOnly] = useState(Boolean(initialArticle?.dmOnly));
  const [bites, setBites] = useState<WorldLoreBite[]>(initialArticle?.bites || []);

  // AI State
  const [rawAiText, setRawAiText] = useState('');
  const [aiTitleHint, setAiTitleHint] = useState('');
  const [aiCategoryHint, setAiCategoryHint] = useState<string>('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<DecomposedBiteSuggestion[]>([]);

  // Save State
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleRunAiDecompose = async () => {
    if (!rawAiText.trim()) {
      setAiError('Incolla il testo del documento o estratto prima di procedere.');
      return;
    }

    if (!hasKeyForActiveProvider) {
      setAiError(`Chiave API mancante per ${provider.toUpperCase()}. Configura le credenziali nelle Impostazioni per avviare l'analisi.`);
      return;
    }

    setAiError(null);
    setIsAiLoading(true);

    try {
      const resp = await WorldLoreService.decomposeLoreDocument({
        rawText: rawAiText,
        partyMembers: allPlayers,
        entities: allEntities,
        titleHint: aiTitleHint,
        categoryHint: aiCategoryHint,
        provider,
        model: activeModelId,
      });

      if (resp.success && resp.article) {
        setTitle(resp.article.title);
        setSubtitle(resp.article.subtitle || '');
        setCategory(resp.article.category || 'general');
        setSummary(resp.article.summary || '');
        setFullContentMarkdown(resp.article.fullContentMarkdown || rawAiText);
        setTagsInput((resp.article.tags || []).join(', '));
        setAiSuggestions(resp.bites || []);

        // Convert suggested bites to actual WorldLoreBite with initial assignees
        const convertedBites: WorldLoreBite[] = resp.bites.map((b) => {
          const knownBy: WorldLoreBite['knownBy'] = [];

          if (b.suggestAllParty) {
            allPlayers.forEach((p) => {
              knownBy.push({
                id: p._id,
                name: p.characterName || (p as any).username || 'PG',
                type: 'player',
                acquisitionNote: 'Sapere diffuso del mondo',
                addedAt: new Date().toISOString(),
              });
            });
          } else if (b.suggestedAssigneeIds && b.suggestedAssigneeIds.length > 0) {
            b.suggestedAssigneeIds.forEach((assigneeId) => {
              const matchedPlayer = allPlayers.find((p) => p._id === assigneeId);
              if (matchedPlayer) {
                knownBy.push({
                  id: matchedPlayer._id,
                  name: matchedPlayer.characterName || (matchedPlayer as any).username || 'PG',
                  type: 'player',
                  acquisitionNote: b.assignmentReason || 'Competenza di classe/background',
                  addedAt: new Date().toISOString(),
                });
              }
              const matchedEnt = allEntities.find((e) => e._id === assigneeId);
              if (matchedEnt) {
                knownBy.push({
                  id: matchedEnt._id,
                  name: matchedEnt.name,
                  type: 'entity',
                  acquisitionNote: b.assignmentReason || 'Custode del sapere',
                  addedAt: new Date().toISOString(),
                });
              }
            });
          }

          return {
            id: b.id,
            title: b.title,
            content: b.content,
            level: b.level,
            category: b.category,
            customTag: b.customTag,
            knownBy,
          };
        });

        setBites(convertedBites);
        setActiveTab('manual'); // Switch to manual tab to let user inspect and fine-tune
      }
    } catch (err: any) {
      setAiError(err?.message || 'Errore durante la scomposizione AI del documento.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleAddManualBite = () => {
    const newBite: WorldLoreBite = {
      id: `bite_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: 'Nuova Nozione Granulare',
      content: '',
      level: 'public',
      knownBy: [],
    };
    setBites([...bites, newBite]);
  };

  const handleUpdateBite = (index: number, updated: Partial<WorldLoreBite>) => {
    const newBites = [...bites];
    newBites[index] = { ...newBites[index], ...updated };
    setBites(newBites);
  };

  const handleRemoveBite = (index: number) => {
    setBites(bites.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!title.trim()) {
      setSaveError('Inserisci un titolo per l\'articolo di lore prima di salvare.');
      return;
    }

    setSaveError(null);
    setIsSaving(true);

    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const articleToSave: WorldLoreArticle = {
        _id: initialArticle?._id || `lore_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        _createdAt: initialArticle?._createdAt || new Date().toISOString(),
        _updatedAt: new Date().toISOString(),
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        category,
        summary: summary.trim() || undefined,
        fullContentMarkdown: fullContentMarkdown.trim() || summary.trim() || title.trim(),
        bites: (bites || []).map((b, idx) => ({
          ...b,
          id: b.id || `bite_${Date.now()}_${idx + 1}`,
          title: b.title?.trim() || `Nozione ${idx + 1}`,
          content: b.content?.trim() || '',
          level: b.level || 'public',
          category: b.category || category,
          customTag: b.customTag?.trim() || undefined,
          knownBy: Array.isArray(b.knownBy) ? b.knownBy : [],
        })),
        tags,
        dmOnly,
        authorPlayerId: player?._id || undefined,
        authorName: player?.characterName || (player as any)?.username || 'Archivista',
      };

      const saved = CampaignManager.saveWorldLoreArticle(articleToSave);

      // Sync all bites to assigned character bios in one atomic batch pass
      try {
        CampaignManager.batchSyncArticleBitesToBios(saved);
      } catch (bioErr) {
        console.warn('[WorldLore] Character bio sync warning:', bioErr);
      }

      onSaved(saved);
    } catch (err: any) {
      console.error('[WorldLore] Save error:', err);
      setSaveError(err?.message || 'Si è verificato un errore durante il salvataggio.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 bg-surface-0/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
        <div className="w-full max-w-4xl bg-surface-1 border border-surface-2 rounded-2xl shadow-2xl flex flex-col max-h-[92dvh] overflow-hidden">
          {/* Modal Header */}
          <div className="px-5 py-4 border-b border-surface-2 flex items-center justify-between bg-surface-1 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <Globe size={18} />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-cinzel font-bold text-content-1">
                  {initialArticle ? 'Modifica Voce di World Lore' : 'Nuova Voce di World Lore'}
                </h3>
                <p className="text-[11px] text-content-3 font-sans">
                  Scomponi documenti e assegna singole nozioni al gruppo
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-content-3 hover:text-content-1 rounded-lg hover:bg-surface-2 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="px-5 py-2 border-b border-surface-2 bg-surface-1/50 flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-primary text-surface-0 font-semibold shadow-xs'
                  : 'bg-surface-2 text-content-2 hover:bg-surface-3 hover:text-content-1'
              }`}
            >
              <Sparkles size={13} />
              <span>Scomposizione AI da PDF/Testo</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('manual')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-primary text-surface-0 font-semibold shadow-xs'
                  : 'bg-surface-2 text-content-2 hover:bg-surface-3 hover:text-content-1'
              }`}
            >
              <Edit3 size={13} />
              <span>Compilazione Manuale &amp; Nozioni ({bites.length})</span>
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
            {activeTab === 'ai' ? (
              <div className="space-y-4">
                {/* Provider, Model & Key Status Toolbar */}
                <div className="p-3.5 rounded-xl bg-surface-2/60 border border-surface-3 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    {/* Provider Toggle Buttons */}
                    <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-1 border border-surface-3">
                      <button
                        type="button"
                        onClick={() => handleProviderSelect('gemini')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          provider === 'gemini'
                            ? 'bg-primary text-surface-0 font-bold shadow-xs'
                            : 'text-content-3 hover:text-content-1'
                        }`}
                      >
                        <Sparkles size={12} className={provider === 'gemini' ? 'text-surface-0' : 'text-primary'} />
                        <span>Gemini</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleProviderSelect('openrouter')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          provider === 'openrouter'
                            ? 'bg-indigo-600 text-white font-bold shadow-xs'
                            : 'text-content-3 hover:text-content-1'
                        }`}
                      >
                        <Zap size={12} className={provider === 'openrouter' ? 'text-white' : 'text-indigo-400'} />
                        <span>OpenRouter</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleProviderSelect('cloudflare')}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                          provider === 'cloudflare'
                            ? 'bg-amber-600 text-white font-bold shadow-xs'
                            : 'text-content-3 hover:text-content-1'
                        }`}
                      >
                        <Cpu size={12} className={provider === 'cloudflare' ? 'text-white' : 'text-amber-400'} />
                        <span>Cloudflare</span>
                      </button>
                    </div>

                    {/* Model Selector Trigger Button */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsCatalogModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-1 hover:bg-surface-2 border border-surface-3 hover:border-primary/40 text-xs font-mono text-content-1 transition-all cursor-pointer shadow-xs"
                      >
                        <span className="text-[10px] uppercase text-content-3">Modello:</span>
                        <span className="font-bold text-primary truncate max-w-[150px] sm:max-w-[220px]">
                          {activeModelId}
                        </span>
                        <ChevronDown size={12} className="text-content-3 shrink-0" />
                      </button>
                    </div>
                  </div>

                  {/* Key Status & Connection Health */}
                  <div className="pt-2 border-t border-surface-3/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Key size={12} className={hasKeyForActiveProvider ? 'text-emerald-400' : 'text-amber-400'} />
                      <span className="text-content-3 font-mono text-[11px]">Stato Chiavi:</span>
                      {hasKeyForActiveProvider ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/25 flex items-center gap-1">
                          <Check size={10} />
                          <span>Chiave {provider.toUpperCase()} Configurata</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/25 flex items-center gap-1">
                          <AlertCircle size={10} />
                          <span>Chiave Mancante (Configura in Impostazioni)</span>
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-content-3">
                      Esecuzione sicura diretta client &amp; multi-modello
                    </span>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-2/40 border border-surface-3 text-xs text-content-2 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-primary">
                    <Sparkles size={13} />
                    <span>Come Funziona l'Archivista AI</span>
                  </div>
                  <p className="leading-relaxed">
                    Incolla l'estratto del documento del Master (cosmogonia, dei, fazioni o leggi magiche). L'IA creerà l'articolo strutturato, estrarrà le <strong>nozioni granulari</strong> divise per livello (comune, iniziatico, arcano, proibito) e suggerirà a quali membri del party assegnarle in base alle loro classi e divinità.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono font-medium text-content-3 uppercase mb-1">
                      Titolo Suggerito (Opzionale)
                    </label>
                    <input
                      type="text"
                      value={aiTitleHint}
                      onChange={(e) => setAiTitleHint(e.target.value)}
                      placeholder="Es. Il Panteon Solare di Dawnspire"
                      className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-surface-3 text-xs text-content-1 focus:outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono font-medium text-content-3 uppercase mb-1">
                      Categoria Tematica (Opzionale)
                    </label>
                    <select
                      value={aiCategoryHint}
                      onChange={(e) => setAiCategoryHint(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-surface-3 text-xs text-content-1 focus:outline-none focus:border-primary"
                    >
                      <option value="">Rileva Automaticamente</option>
                      {WORLD_LORE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono font-medium text-content-3 uppercase mb-1">
                    Testo / Estratto del Documento del Master
                  </label>
                  <textarea
                    rows={10}
                    value={rawAiText}
                    onChange={(e) => setRawAiText(e.target.value)}
                    placeholder="Incolla qui il testo del PDF o del documento consegnato dal DM..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-surface-3 text-xs text-content-1 font-sans focus:outline-none focus:border-primary transition-colors leading-relaxed"
                  />
                </div>

                {aiError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{aiError}</span>
                  </div>
                )}

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={handleRunAiDecompose}
                    disabled={isAiLoading || !rawAiText.trim()}
                    className="px-5 py-2 rounded-xl bg-primary text-surface-0 hover:bg-primary-hover font-semibold text-xs flex items-center gap-2 shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isAiLoading ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-surface-0 border-t-transparent rounded-full animate-spin" />
                        <span>Scomposizione e Analisi in corso...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={14} />
                        <span>Scomponi ed Estrai Nozioni con IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Basic Metadata Row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-mono font-medium text-content-3 uppercase mb-1">
                      Titolo dell'Articolo *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Es. Il Panteon dei Nove Cerchi"
                      className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-surface-3 text-xs text-content-1 focus:outline-none focus:border-primary font-serif font-semibold"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono font-medium text-content-3 uppercase mb-1">
                      Categoria *
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as WorldLoreCategory)}
                      className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-surface-3 text-xs text-content-1 focus:outline-none focus:border-primary"
                    >
                      {WORLD_LORE_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.icon} {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono font-medium text-content-3 uppercase mb-1">
                      Sottotitolo / Epiteto
                    </label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="Es. Le divinità della luce e dell'acciaio"
                      className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-surface-3 text-xs text-content-1 focus:outline-none focus:border-primary"
                    />
                  </div>

                </div>

                <div>
                  <label className="block text-[11px] font-mono font-medium text-content-3 uppercase mb-1">
                    Sommario Sintetico
                  </label>
                  <textarea
                    rows={2}
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Breve riepilogo in 2-3 frasi..."
                    className="w-full px-3 py-2 rounded-lg bg-surface-2 border border-surface-3 text-xs text-content-1 focus:outline-none focus:border-primary"
                  />
                </div>

                {/* Granular Bites Editor Section */}
                <div className="space-y-3 pt-2 border-t border-surface-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-content-1 uppercase tracking-wider font-mono flex items-center gap-1.5">
                        <Sparkles size={13} className="text-primary" />
                        <span>Nozioni Granulari (Lore Bites) ({bites.length})</span>
                      </h4>
                      <p className="text-[10px] text-content-3">
                        Pillole di conoscenza da assegnare ai singoli PG o al gruppo
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAddManualBite}
                      className="px-2.5 py-1 rounded-lg bg-surface-2 hover:bg-surface-3 text-content-1 text-xs font-medium flex items-center gap-1 border border-surface-3 cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Aggiungi Nozione</span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {bites.map((bite, bIdx) => (
                      <div
                        key={bite.id || bIdx}
                        className="p-3.5 rounded-xl bg-surface-2/70 border border-surface-3 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-mono font-bold text-content-3">
                            #{bIdx + 1}
                          </span>

                          <div className="flex items-center gap-2">
                            <select
                              value={bite.level}
                              onChange={(e) =>
                                handleUpdateBite(bIdx, { level: e.target.value as LoreBiteLevel })
                              }
                              className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-1 border border-surface-3 text-content-1"
                            >
                              <option value="public">👥 Sapere Popolare</option>
                              <option value="specialized">🎓 Iniziatica</option>
                              <option value="esoteric">🔮 Mito Arcano</option>
                              <option value="secret">🗝️ Verità Proibita</option>
                            </select>

                            <button
                              type="button"
                              onClick={() => handleRemoveBite(bIdx)}
                              className="p-1 text-content-3 hover:text-rose-400 rounded transition-colors"
                              title="Rimuovi questa nozione"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={bite.title}
                            onChange={(e) => handleUpdateBite(bIdx, { title: e.target.value })}
                            placeholder="Titolo nozione..."
                            className="w-full px-2.5 py-1.5 rounded-lg bg-surface-1 border border-surface-3 text-xs text-content-1 font-semibold"
                          />
                        </div>

                        <textarea
                          rows={2}
                          value={bite.content}
                          onChange={(e) => handleUpdateBite(bIdx, { content: e.target.value })}
                          placeholder="Dettagli e spiegazione approfondita della nozione..."
                          className="w-full px-2.5 py-1.5 rounded-lg bg-surface-1 border border-surface-3 text-xs text-content-2 leading-relaxed"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Markdown Full Text Editor */}
                <div className="space-y-1.5 pt-2 border-t border-surface-2">
                  <label className="block text-[11px] font-mono font-medium text-content-3 uppercase">
                    Testo Completo dell'Articolo (Markdown)
                  </label>
                  <textarea
                    rows={8}
                    value={fullContentMarkdown}
                    onChange={(e) => setFullContentMarkdown(e.target.value)}
                    placeholder="Il trattato completo in formato markdown..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-surface-2 border border-surface-3 text-xs text-content-1 font-mono focus:outline-none focus:border-primary leading-relaxed"
                  />
                </div>

                {/* DM Only Toggle */}
                <div className="pt-2 flex items-center justify-between border-t border-surface-2 text-xs">
                  <label className="flex items-center gap-2 text-content-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={dmOnly}
                      onChange={(e) => setDmOnly(e.target.checked)}
                      className="rounded border-surface-3 text-primary focus:ring-primary"
                    />
                    <span className="flex items-center gap-1.5">
                      <Lock size={13} className="text-amber-400" />
                      <span>Articolo Riservato al Master (invisibile ai PG)</span>
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-4 sm:p-5 border-t border-surface-2 bg-surface-1 flex flex-col gap-2.5 shrink-0">
            {saveError && (
              <div className="px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{saveError}</span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-content-2 hover:text-content-1 bg-surface-2 hover:bg-surface-3 border border-surface-3 transition-colors cursor-pointer"
              >
                Annulla
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-primary text-surface-0 hover:bg-primary-hover font-semibold text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Check size={14} />
                <span>{isSaving ? 'Salvataggio...' : 'Salva nel Compendio'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Full Live Multi-Provider LLM Catalog Modal */}
      <LlmCatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => setIsCatalogModalOpen(false)}
        activeProvider={provider === 'openrouter' ? 'openrouter' : 'gemini'}
        onSelectProvider={(p) => handleProviderSelect(p)}
        currentModelId={activeModelId}
        onSelectModel={(selectedId, selectedProvider) => {
          const targetProv = selectedProvider || (provider === 'cloudflare' ? 'cloudflare' : provider);
          handleProviderSelect(targetProv as LoreProviderType);
          if (targetProv === 'openrouter') {
            handleOpenRouterModelChange(selectedId);
          } else if (targetProv === 'cloudflare') {
            handleCloudflareModelChange(selectedId);
          } else {
            handleGeminiModelChange(selectedId);
          }
          setIsCatalogModalOpen(false);
        }}
      />
    </Portal>
  );
}

// ==========================================
// BITE ASSIGNEE MODAL (WHO KNOWS WHAT)
// ==========================================
interface BiteAssigneeModalProps {
  isOpen: boolean;
  article: WorldLoreArticle;
  bite: WorldLoreBite;
  allPlayers: Player[];
  allEntities: Entity[];
  onClose: () => void;
  onUpdated: () => void;
}

function BiteAssigneeModal({
  isOpen,
  article,
  bite,
  allPlayers,
  allEntities,
  onClose,
  onUpdated,
}: BiteAssigneeModalProps) {
  const [assignees, setAssignees] = useState<WorldLoreBite['knownBy']>(bite.knownBy || []);

  const handleTogglePlayer = (player: Player) => {
    const exists = assignees.some((a) => a.id === player._id && a.type === 'player');
    if (exists) {
      CampaignManager.removeLoreBiteFromPlayer(article._id, bite.id, player._id);
      setAssignees(assignees.filter((a) => !(a.id === player._id && a.type === 'player')));
    } else {
      CampaignManager.assignLoreBiteToPlayer(
        article._id,
        bite.id,
        player._id,
        player.characterName || (player as any).username || 'PG',
        'Conoscenza appresa nella campagna'
      );
      setAssignees([
        ...assignees,
        {
          id: player._id,
          name: player.characterName || (player as any).username || 'PG',
          type: 'player',
          acquisitionNote: 'Conoscenza appresa nella campagna',
          addedAt: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleToggleEntity = (entity: Entity) => {
    const exists = assignees.some((a) => a.id === entity._id && a.type === 'entity');
    if (exists) {
      CampaignManager.removeLoreBiteFromEntity(article._id, bite.id, entity._id);
      setAssignees(assignees.filter((a) => !(a.id === entity._id && a.type === 'entity')));
    } else {
      CampaignManager.assignLoreBiteToEntity(
        article._id,
        bite.id,
        entity._id,
        entity.name,
        'Conoscenza del PNG'
      );
      setAssignees([
        ...assignees,
        {
          id: entity._id,
          name: entity.name,
          type: 'entity',
          acquisitionNote: 'Conoscenza del PNG',
          addedAt: new Date().toISOString(),
        },
      ]);
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 bg-surface-0/80 backdrop-blur-md flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-surface-1 border border-surface-2 rounded-2xl p-5 sm:p-6 space-y-4 shadow-2xl">
          <div className="flex items-center justify-between border-b border-surface-2 pb-3">
            <div>
              <h3 className="text-sm font-cinzel font-bold text-content-1">
                Portatori di questo Sapere
              </h3>
              <p className="text-xs text-primary truncate max-w-sm">{bite.title}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-content-3 hover:text-content-1 rounded-lg"
            >
              <X size={18} />
            </button>
          </div>

          {/* Party Members Selector */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-content-3 font-mono uppercase tracking-wider">
              Avventurieri del Party (PG)
            </h4>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar pr-1">
              {allPlayers.map((p) => {
                const isKnown = assignees.some((a) => a.id === p._id && a.type === 'player');
                return (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => handleTogglePlayer(p)}
                    className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-colors cursor-pointer text-xs ${
                      isKnown
                        ? 'bg-primary/10 border-primary/30 text-primary font-semibold'
                        : 'bg-surface-2 border-surface-3 text-content-2 hover:bg-surface-3'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <User size={13} />
                      <span>{p.characterName || (p as any).username || 'PG'}</span>
                    </div>
                    {isKnown ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-primary text-surface-0 font-bold flex items-center gap-1">
                        <Check size={10} />
                        <span>Conosce</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-content-3">Ignora</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* NPC & Codex Entities Selector */}
          <div className="space-y-2 pt-2 border-t border-surface-2">
            <h4 className="text-xs font-semibold text-content-3 font-mono uppercase tracking-wider">
              PNG &amp; Compendio
            </h4>
            <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
              {allEntities.slice(0, 15).map((e) => {
                const isKnown = assignees.some((a) => a.id === e._id && a.type === 'entity');
                return (
                  <button
                    key={e._id}
                    type="button"
                    onClick={() => handleToggleEntity(e)}
                    className={`w-full p-2 rounded-lg border text-left flex items-center justify-between transition-colors cursor-pointer text-xs ${
                      isKnown
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-300 font-semibold'
                        : 'bg-surface-2 border-surface-3 text-content-2 hover:bg-surface-3'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Shield size={12} className="text-amber-400" />
                      <span>{e.name}</span>
                    </div>
                    {isKnown ? (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold flex items-center gap-1">
                        <Check size={10} />
                        <span>Conosce</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-content-3">Ignora</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-surface-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                onUpdated();
                onClose();
              }}
              className="px-4 py-1.5 rounded-xl bg-primary text-surface-0 hover:bg-primary-hover font-semibold text-xs shadow-sm transition-all"
            >
              Fatto
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
}
