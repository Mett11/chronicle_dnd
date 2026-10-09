import React, { useState, useRef, useMemo, useEffect } from 'react';
import { CampaignManager } from '../store/campaignStore';
import { isSupabaseConfigured } from '../lib/supabase';
import { SupabaseSyncService } from '../lib/supabaseSyncService';
import { WorldMap as WorldMapType, type MapPin, Entity, MapFolder, Session } from '../types';
import { useAuth } from '../components/AuthProvider';
import { SingleImageUploader } from '../components/SingleImageUploader';
import { ConfirmModal } from '../components/ConfirmModal';
import { LoreDateInput } from '../components/LoreDateInput';
import { Portal } from '../components/Portal';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Map as MapIcon,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Compass,
  MapPin as MapPinIcon,
  Castle,
  Skull,
  Beer,
  Landmark,
  AlertTriangle,
  Scroll,
  Shield,
  Trash2,
  Edit2,
  X,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  Search,
  FolderOpen,
  Folder as FolderIcon,
  FolderPlus,
  CheckCircle2,
  Crosshair,
  BookMarked,
  MoveRight,
  Layers,
  Sparkles,
  Navigation,
  Maximize2,
  Minimize2,
} from 'lucide-react';

const PIN_CATEGORIES = {
  city: { label: 'Città & Insediamenti', icon: Castle, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', markerBg: 'bg-amber-500' },
  dungeon: { label: 'Dungeon & Cripte', icon: Skull, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20', markerBg: 'bg-purple-500' },
  tavern: { label: 'Taverne & Locande', icon: Beer, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', markerBg: 'bg-emerald-500' },
  ruins: { label: 'Rovine & Antichità', icon: Landmark, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', markerBg: 'bg-orange-500' },
  landmark: { label: 'Punti di Riferimento', icon: Compass, color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', markerBg: 'bg-cyan-500' },
  danger: { label: 'Zone di Pericolo', icon: AlertTriangle, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', markerBg: 'bg-rose-500' },
  quest: { label: 'Obiettivi & Quest', icon: Scroll, color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', markerBg: 'bg-yellow-500' },
  faction: { label: 'Bastioni di Fazione', icon: Shield, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', markerBg: 'bg-indigo-500' },
};

const FOLDER_COLORS = [
  { label: 'Blu Araldico', value: '#3B82F6', bg: 'bg-blue-500' },
  { label: 'Smeraldo', value: '#10B981', bg: 'bg-emerald-500' },
  { label: 'Viola Arcano', value: '#8B5CF6', bg: 'bg-purple-500' },
  { label: 'Ambra Dorata', value: '#F59E0B', bg: 'bg-amber-500' },
  { label: 'Rubino', value: '#EF4444', bg: 'bg-rose-500' },
  { label: 'Indaco Notturno', value: '#6366F1', bg: 'bg-indigo-500' },
  { label: 'Ciano Costiero', value: '#06B6D4', bg: 'bg-cyan-500' },
];

export function WorldMap() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCampaignCode = CampaignManager.getActiveCampaignCode();
  const [canManageMaps, setCanManageMaps] = useState(() => CampaignManager.canUser('manage_maps', activeCampaignCode));
  const [maps, setMaps] = useState<WorldMapType[]>(() => CampaignManager.getMaps());
  const [folders, setFolders] = useState<MapFolder[]>(() => CampaignManager.getMapFolders());
  const [activeMapId, setActiveMapId] = useState<string>(() => maps[0]?.id || '');
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    const handleCampaignSync = () => {
      setCanManageMaps(CampaignManager.canUser('manage_maps', CampaignManager.getActiveCampaignCode()));
    };
    window.addEventListener('chronicle_campaign_updated', handleCampaignSync);
    window.addEventListener('chronicle_campaigns_updated', handleCampaignSync);
    window.addEventListener('chronicle_data_updated', handleCampaignSync);
    window.addEventListener('chronicle_campaign_changed', handleCampaignSync);
    window.addEventListener('chronicle_members_updated', handleCampaignSync);
    return () => {
      window.removeEventListener('chronicle_campaign_updated', handleCampaignSync);
      window.removeEventListener('chronicle_campaigns_updated', handleCampaignSync);
      window.removeEventListener('chronicle_data_updated', handleCampaignSync);
      window.removeEventListener('chronicle_campaign_changed', handleCampaignSync);
      window.removeEventListener('chronicle_members_updated', handleCampaignSync);
    };
  }, [activeCampaignCode]);

  const [sidebarTab, setSidebarTab] = useState<'maps' | 'pins' | 'codex'>('maps');
  const [selectedFolderFilter, setSelectedFolderFilter] = useState<string>('all');
  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});

  const handleSidebarTabChange = (tab: 'maps' | 'pins' | 'codex') => {
    if (tab === sidebarTab) return;
    setSidebarTab(tab);
  };

  const [mapSearchQuery, setMapSearchQuery] = useState('');
  const [codexSearchQuery, setCodexSearchQuery] = useState('');
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  // Transform / Zoom / Pan & Fullscreen
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mobileView, setMobileView] = useState<'map' | 'panel'>('map');
  const [touchStartDist, setTouchStartDist] = useState<number | null>(null);
  const [touchInitialScale, setTouchInitialScale] = useState<number>(1);

  // Adding Pin Mode & Repositioning
  const [isAddingPinMode, setIsAddingPinMode] = useState(false);
  const [isRepositioningPinId, setIsRepositioningPinId] = useState<string | null>(null);
  const [pendingPinCoords, setPendingPinCoords] = useState<{ x: number; y: number } | null>(null);

  // Modals
  const [isNewMapModalOpen, setIsNewMapModalOpen] = useState(false);
  const [isEditMapModalOpen, setIsEditMapModalOpen] = useState(false);
  const [isEditPinModalOpen, setIsEditPinModalOpen] = useState(false);
  const [isNewFolderModalOpen, setIsNewFolderModalOpen] = useState(false);
  const [isEditFolderModalOpen, setIsEditFolderModalOpen] = useState(false);
  const [mapToMove, setMapToMove] = useState<WorldMapType | null>(null);

  // New Map Form
  const [newMapTitle, setNewMapTitle] = useState('');
  const [newMapImageUrl, setNewMapImageUrl] = useState('');
  const [newMapDesc, setNewMapDesc] = useState('');
  const [newMapScale, setNewMapScale] = useState('');
  const [newMapFolderId, setNewMapFolderId] = useState('');
  const [newMapEntityId, setNewMapEntityId] = useState('');

  // Edit Map Form
  const [editMapId, setEditMapId] = useState('');
  const [editMapTitle, setEditMapTitle] = useState('');
  const [editMapImageUrl, setEditMapImageUrl] = useState('');
  const [editMapDesc, setEditMapDesc] = useState('');
  const [editMapScale, setEditMapScale] = useState('');
  const [editMapFolderId, setEditMapFolderId] = useState('');
  const [editMapEntityId, setEditMapEntityId] = useState('');

  // Folder Form
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState('');
  const [folderDesc, setFolderDesc] = useState('');
  const [folderColor, setFolderColor] = useState('#3B82F6');
  const [folderPlaceEntityId, setFolderPlaceEntityId] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<string | null>(null);

  // Pin form
  const [editingPinId, setEditingPinId] = useState<string | null>(null);
  const [pinTitle, setPinTitle] = useState('');
  const [pinDesc, setPinDesc] = useState('');
  const [pinCategory, setPinCategory] = useState<keyof typeof PIN_CATEGORIES>('city');
  const [pinEntityId, setPinEntityId] = useState<string>('');
  const [pinSessionId, setPinSessionId] = useState<string>('');
  const [pinLoreDate, setPinLoreDate] = useState('');
  const [pinDiscovered, setPinDiscovered] = useState(true);
  const [pinX, setPinX] = useState<number>(50);
  const [pinY, setPinY] = useState<number>(50);
  const [pinToDelete, setPinToDelete] = useState<string | null>(null);
  const [mapToDelete, setMapToDelete] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapImageRef = useRef<HTMLImageElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [entities, setEntities] = useState<Entity[]>(() => CampaignManager.getEntities());
  const [sessions, setSessions] = useState<Session[]>(() => CampaignManager.getSessions());
  const placeEntities = useMemo(() => entities.filter((e) => e.type === 'place'), [entities]);

  const refreshEntities = () => {
    setEntities(CampaignManager.getEntities());
  };

  const showToast = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => {
      setFeedbackToast(null);
    }, 3500);
  };

  const normalizedFolders = useMemo(() => {
    return folders.map((f, idx) => ({
      ...f,
      id: String(f.id || (f as any)._id || (f as any).folder_id || `folder_${idx}`),
      name: String(f.name || (f as any).title || (f as any).label || (f as any).folder_name || (f as any).folderName || `Cartella ${idx + 1}`).trim(),
      description: f.description || '',
      color: f.color || '#3B82F6',
      placeEntityId: f.placeEntityId || (f as any).place_entity_id || (f as any).entityId,
    }));
  }, [folders]);

  const activeMap = useMemo(() => {
    return maps.find((m) => m.id === activeMapId) || maps[0] || null;
  }, [maps, activeMapId]);

  const activeMapFolder = useMemo(() => {
    if (!activeMap?.folderId) return null;
    const tId = String(activeMap.folderId);
    return normalizedFolders.find((f) => f.id === tId) || null;
  }, [activeMap, normalizedFolders]);

  const activeMapLinkedEntity = useMemo(() => {
    if (!activeMap?.entityId) return null;
    return entities.find((e) => e._id === activeMap.entityId) || null;
  }, [activeMap, entities]);

  const knownFolderIds = useMemo(() => new Set(normalizedFolders.map((f) => f.id)), [normalizedFolders]);
  const unassignedMaps = useMemo(
    () => maps.filter((m) => !m.folderId || !knownFolderIds.has(String(m.folderId))),
    [maps, knownFolderIds]
  );

  // Listen to store updates
  useEffect(() => {
    const code = CampaignManager.getActiveCampaignCode();
    if (code && isSupabaseConfigured()) {
      SupabaseSyncService.fetchMapsOnly(code).then((remoteMaps) => {
        if (remoteMaps && Array.isArray(remoteMaps)) {
          if (remoteMaps.length > 0) {
            CampaignManager.saveMapsLocalOnly(remoteMaps);
            setMaps(remoteMaps);
          }
          setFolders(CampaignManager.getMapFolders());
        }
      }).catch((err) => {
        console.warn('[WorldMap] Failed fetching maps from Supabase:', err);
      });
    }

    const handleMapsUpdated = () => {
      setMaps(CampaignManager.getMaps());
    };
    const handleFoldersUpdated = (e?: any) => {
      if (e?.detail?.folders && Array.isArray(e.detail.folders)) {
        CampaignManager.saveMapFoldersLocalOnly(e.detail.folders);
      }
      setFolders(CampaignManager.getMapFolders());
    };
    const handleEntitiesUpdated = () => {
      setEntities(CampaignManager.getEntities());
    };
    const handleDataUpdated = () => {
      setMaps(CampaignManager.getMaps());
      setFolders(CampaignManager.getMapFolders());
      setEntities(CampaignManager.getEntities());
    };
    window.addEventListener('chronicle_maps_updated', handleMapsUpdated);
    window.addEventListener('chronicle_map_folders_updated', handleFoldersUpdated);
    window.addEventListener('chronicle_entities_updated', handleEntitiesUpdated);
    window.addEventListener('chronicle_data_updated', handleDataUpdated);
    return () => {
      window.removeEventListener('chronicle_maps_updated', handleMapsUpdated);
      window.removeEventListener('chronicle_map_folders_updated', handleFoldersUpdated);
      window.removeEventListener('chronicle_entities_updated', handleEntitiesUpdated);
      window.removeEventListener('chronicle_data_updated', handleDataUpdated);
    };
  }, []);

  useEffect(() => {
    if (maps.length > 0 && !maps.find((m) => m.id === activeMapId)) {
      setActiveMapId(maps[0].id);
    }
  }, [maps, activeMapId]);

  // Deep linking and URL queries from Codex
  useEffect(() => {
    const paramMapId = searchParams.get('mapId');
    const paramPinId = searchParams.get('pinId');
    const paramPlaceId = searchParams.get('placeId');
    const paramAction = searchParams.get('action');

    if (paramMapId && maps.some((m) => m.id === paramMapId)) {
      setActiveMapId(paramMapId);
    }

    if (paramPinId) {
      const allMaps = CampaignManager.getMaps();
      const targetMap = allMaps.find((m) => m.pins?.some((p) => p.id === paramPinId));
      if (targetMap) {
        setActiveMapId(targetMap.id);
        const pin = targetMap.pins.find((p) => p.id === paramPinId);
        if (pin) {
          setSelectedPin(pin);
          setSidebarTab('pins');
          showToast(`Punto d'interesse "${pin.title}" selezionato.`);
        }
      }
    } else if (paramPlaceId) {
      const allEnts = CampaignManager.getEntities();
      const place = allEnts.find((e) => e._id === paramPlaceId);
      if (place) {
        if (place.mapId) {
          setActiveMapId(place.mapId);
          if (place.pinId) {
            const allMaps = CampaignManager.getMaps();
            const targetMap = allMaps.find((m) => m.id === place.mapId);
            const pin = targetMap?.pins?.find((p) => p.id === place.pinId);
            if (pin) {
              setSelectedPin(pin);
              setSidebarTab('pins');
            }
          }
        }
        if (paramAction === 'place') {
          handleStartPlaceCodexEntity(place);
        }
      }
    }
  }, [searchParams]);

  const handleStartPlaceCodexEntity = (place: Entity) => {
    setEditingPinId(null);
    setSelectedPin(null);
    setPendingPinCoords(null);
    setPinTitle(place.name);
    setPinDesc(place.progressNote || '');
    setPinCategory((place.pinCategory as any) || 'city');
    setPinEntityId(place._id);
    setPinSessionId('');
    setPinLoreDate('');
    setPinDiscovered(true);
    setPinX(place.pinX ?? 50);
    setPinY(place.pinY ?? 50);
    setIsAddingPinMode(true);
    setIsRepositioningPinId(null);
    showToast(`Clicca sulla mappa per ancorare "${place.name}".`);
  };

  const filteredPins = useMemo(() => {
    if (!activeMap) return [];
    return (activeMap.pins || []).filter((pin) => {
      const matchesCat = filterCategory === 'all' || pin.category === filterCategory;
      const matchesSearch =
        !searchQuery ||
        pin.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pin.description && pin.description.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesCat && matchesSearch;
    });
  }, [activeMap, filterCategory, searchQuery]);

  const filteredMapsList = useMemo(() => {
    let result = maps;
    if (selectedFolderFilter !== 'all') {
      if (selectedFolderFilter === 'unassigned') {
        result = result.filter((m) => !m.folderId || !knownFolderIds.has(String(m.folderId)));
      } else {
        result = result.filter((m) => String(m.folderId || '') === selectedFolderFilter);
      }
    }
    if (!mapSearchQuery.trim()) return result;
    const query = mapSearchQuery.toLowerCase();
    return result.filter(
      (m) =>
        m.title.toLowerCase().includes(query) ||
        (m.description && m.description.toLowerCase().includes(query)) ||
        (m.scaleLabel && m.scaleLabel.toLowerCase().includes(query))
    );
  }, [maps, selectedFolderFilter, mapSearchQuery, knownFolderIds]);

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  const handleZoom = (delta: number) => {
    setScale((prev) => Math.min(Math.max(0.4, Number((prev + delta).toFixed(2))), 4));
  };

  const handleResetView = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Keyboard shortcut: Escape exits fullscreen or cancelling pin placement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isAddingPinMode) setIsAddingPinMode(false);
        if (isRepositioningPinId) setIsRepositioningPinId(null);
        if (isFullscreen) setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddingPinMode, isRepositioningPinId, isFullscreen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isAddingPinMode || isRepositioningPinId) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || isAddingPinMode || isRepositioningPinId) return;
    const nextX = e.clientX - dragStart.x;
    const nextY = e.clientY - dragStart.y;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      setPosition({ x: nextX, y: nextY });
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (isAddingPinMode || isRepositioningPinId) return;
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
      setTouchStartDist(null);
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      setTouchStartDist(dist);
      setTouchInitialScale(scale);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isAddingPinMode || isRepositioningPinId) return;
    if (e.touches.length === 1 && isDragging) {
      const nextX = e.touches[0].clientX - dragStart.x;
      const nextY = e.touches[0].clientY - dragStart.y;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      rafRef.current = requestAnimationFrame(() => {
        setPosition({ x: nextX, y: nextY });
      });
    } else if (e.touches.length === 2 && touchStartDist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const factor = dist / touchStartDist;
      const newScale = Math.min(Math.max(0.4, Number((touchInitialScale * factor).toFixed(2))), 4);
      setScale(newScale);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setTouchStartDist(null);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapImageRef.current || !activeMap) return;
    if (!isAddingPinMode && !isRepositioningPinId) return;

    const rect = mapImageRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xPercent = Math.max(0, Math.min(100, (clickX / rect.width) * 100));
    const yPercent = Math.max(0, Math.min(100, (clickY / rect.height) * 100));
    const newX = Number(xPercent.toFixed(1));
    const newY = Number(yPercent.toFixed(1));

    if (isRepositioningPinId) {
      CampaignManager.updatePin(activeMap.id, isRepositioningPinId, { x: newX, y: newY });
      const updatedMaps = CampaignManager.getMaps();
      setMaps(updatedMaps);
      const currentMap = updatedMaps.find((m) => m.id === activeMap.id);
      const updatedPin = currentMap?.pins.find((p) => p.id === isRepositioningPinId) || null;
      setSelectedPin(updatedPin);
      setIsRepositioningPinId(null);
      showToast(`Punto riposizionato con successo su ${newX}% X, ${newY}% Y!`);
      return;
    }

    if (isAddingPinMode) {
      setPendingPinCoords({ x: newX, y: newY });
      setPinX(newX);
      setPinY(newY);

      if (!editingPinId) {
        setPinTitle('');
        setPinDesc('');
        setPinCategory('city');
        setPinEntityId('');
        setPinSessionId('');
        setPinLoreDate('');
        setPinDiscovered(true);
      }

      setIsAddingPinMode(false);
      setIsEditPinModalOpen(true);
    }
  };

  const handleStartAddPin = () => {
    setEditingPinId(null);
    setSelectedPin(null);
    setPendingPinCoords(null);
    setPinTitle('');
    setPinDesc('');
    setPinCategory('city');
    setPinEntityId('');
    setPinSessionId('');
    setPinLoreDate('');
    setPinDiscovered(true);
    setPinX(50);
    setPinY(50);
    setIsAddingPinMode(true);
    setIsRepositioningPinId(null);
  };

  const handleOpenEditPinModal = (pin: MapPin) => {
    setEditingPinId(pin.id);
    setSelectedPin(pin);
    setPendingPinCoords(null);
    setPinTitle(pin.title);
    setPinDesc(pin.description || '');
    setPinCategory(pin.category);
    setPinEntityId(pin.entityId || '');
    setPinSessionId(pin.sessionId || '');
    setPinLoreDate(pin.loreDate || '');
    setPinDiscovered(pin.discovered);
    setPinX(pin.x);
    setPinY(pin.y);
    setIsEditPinModalOpen(true);
    setIsAddingPinMode(false);
    setIsRepositioningPinId(null);
  };

  const handlePickAnchorOnMap = () => {
    setIsEditPinModalOpen(false);
    setIsAddingPinMode(true);
    showToast('Clicca sulla mappa nel punto in cui desideri ancorare questo luogo.');
  };

  const handleSavePin = () => {
    if (!activeMap || !pinTitle.trim()) return;

    const validatedX = Math.max(0, Math.min(100, Number(pinX) || 50));
    const validatedY = Math.max(0, Math.min(100, Number(pinY) || 50));
    const selectedEntity = entities.find((e) => e._id === pinEntityId);

    let savedPin: MapPin | null = null;

    if (editingPinId) {
      savedPin = CampaignManager.updatePin(activeMap.id, editingPinId, {
        title: pinTitle.trim(),
        description: pinDesc.trim(),
        x: validatedX,
        y: validatedY,
        category: pinCategory,
        entityId: pinEntityId || undefined,
        entityType: selectedEntity?.type || (pinEntityId ? 'place' : undefined),
        sessionId: pinSessionId || undefined,
        loreDate: pinLoreDate.trim() || undefined,
        discovered: pinDiscovered,
      });
      showToast(`Punto d'interesse "${pinTitle.trim()}" aggiornato con successo!`);
    } else {
      savedPin = CampaignManager.addPinToMap(activeMap.id, {
        title: pinTitle.trim(),
        description: pinDesc.trim(),
        x: validatedX,
        y: validatedY,
        category: pinCategory,
        entityId: pinEntityId || undefined,
        entityType: selectedEntity?.type || (pinEntityId ? 'place' : undefined),
        sessionId: pinSessionId || undefined,
        loreDate: pinLoreDate.trim() || undefined,
        discovered: pinDiscovered,
      });
      showToast(`Punto d'interesse "${pinTitle.trim()}" ancorato alla mappa!`);
    }

    const updatedMaps = CampaignManager.getMaps();
    setMaps(updatedMaps);
    refreshEntities();

    const currentMap = updatedMaps.find((m) => m.id === activeMap.id);
    const targetPin = currentMap?.pins.find((p) => p.id === (savedPin?.id || editingPinId)) || null;

    setSelectedPin(targetPin);
    setEditingPinId(null);
    setPendingPinCoords(null);
    setIsEditPinModalOpen(false);
    setSidebarTab('pins');
  };

  const handleDeletePin = (pinId: string) => {
    setPinToDelete(pinId);
  };

  const confirmDeletePin = () => {
    if (!activeMap || !pinToDelete) return;
    CampaignManager.deletePin(activeMap.id, pinToDelete);
    const updated = CampaignManager.getMaps();
    setMaps(updated);
    if (selectedPin?.id === pinToDelete) setSelectedPin(null);
    setPinToDelete(null);
    showToast('Punto rimosso dalla mappa.');
  };

  const handleOpenNewMapModal = (targetFolderId?: string) => {
    setNewMapTitle('');
    setNewMapImageUrl('');
    setNewMapDesc('');
    setNewMapScale('');
    setNewMapFolderId(targetFolderId || (selectedFolderFilter !== 'all' && selectedFolderFilter !== 'unassigned' ? selectedFolderFilter : ''));
    setNewMapEntityId('');
    setIsNewMapModalOpen(true);
  };

  const handleCreateMap = () => {
    if (!newMapTitle.trim() || !newMapImageUrl.trim()) return;
    const created = CampaignManager.addMap({
      title: newMapTitle.trim(),
      imageUrl: newMapImageUrl.trim(),
      description: newMapDesc.trim(),
      scaleLabel: newMapScale.trim(),
      folderId: newMapFolderId || undefined,
      entityId: newMapEntityId || undefined,
    });
    const updated = CampaignManager.getMaps();
    setMaps(updated);
    refreshEntities();
    setActiveMapId(created.id);
    setIsNewMapModalOpen(false);
    setSidebarTab('maps');
    showToast(`Mappa "${created.title}" creata con successo!`);
  };

  const handleOpenEditMapModal = (mapToEdit: WorldMapType) => {
    setEditMapId(mapToEdit.id);
    setEditMapTitle(mapToEdit.title);
    setEditMapImageUrl(mapToEdit.imageUrl);
    setEditMapDesc(mapToEdit.description || '');
    setEditMapScale(mapToEdit.scaleLabel || '');
    setEditMapFolderId(mapToEdit.folderId || '');
    setEditMapEntityId(mapToEdit.entityId || '');
    setIsEditMapModalOpen(true);
  };

  const handleSaveEditedMap = () => {
    if (!editMapId || !editMapTitle.trim() || !editMapImageUrl.trim()) return;
    CampaignManager.updateMap(editMapId, {
      title: editMapTitle.trim(),
      imageUrl: editMapImageUrl.trim(),
      description: editMapDesc.trim(),
      scaleLabel: editMapScale.trim(),
      folderId: editMapFolderId || undefined,
      entityId: editMapEntityId || undefined,
    });
    setMaps(CampaignManager.getMaps());
    refreshEntities();
    setIsEditMapModalOpen(false);
    showToast('Mappa aggiornata con successo!');
  };

  const handleDeleteMap = (mapId: string) => {
    setMapToDelete(mapId);
  };

  const confirmDeleteMap = () => {
    if (!mapToDelete) return;
    CampaignManager.deleteMap(mapToDelete);
    const remaining = CampaignManager.getMaps();
    setMaps(remaining);
    refreshEntities();
    if (activeMapId === mapToDelete) {
      setActiveMapId(remaining[0]?.id || '');
    }
    setMapToDelete(null);
    showToast('Mappa eliminata.');
  };

  // Folder Operations
  const handleOpenNewFolderModal = (preselectedPlaceId?: string) => {
    setEditingFolderId(null);
    setFolderName('');
    setFolderDesc('');
    setFolderColor('#3B82F6');
    setFolderPlaceEntityId(preselectedPlaceId || '');
    setIsNewFolderModalOpen(true);
  };

  const handleOpenEditFolderModal = (f: MapFolder) => {
    setEditingFolderId(f.id);
    setFolderName(f.name);
    setFolderDesc(f.description || '');
    setFolderColor(f.color || '#3B82F6');
    setFolderPlaceEntityId(f.placeEntityId || '');
    setIsEditFolderModalOpen(true);
  };

  const handleSaveNewFolder = () => {
    if (!folderName.trim()) return;
    const newFolder = CampaignManager.addMapFolder({
      name: folderName.trim(),
      description: folderDesc.trim(),
      color: folderColor,
      placeEntityId: folderPlaceEntityId || undefined,
    });
    setFolders(CampaignManager.getMapFolders());
    refreshEntities();
    setIsNewFolderModalOpen(false);
    setSelectedFolderFilter(newFolder.id);
    showToast(`Cartella "${newFolder.name}" creata!`);
  };

  const handleSaveEditFolder = () => {
    if (!editingFolderId || !folderName.trim()) return;
    CampaignManager.updateMapFolder(editingFolderId, {
      name: folderName.trim(),
      description: folderDesc.trim(),
      color: folderColor,
      placeEntityId: folderPlaceEntityId || undefined,
    });
    setFolders(CampaignManager.getMapFolders());
    refreshEntities();
    setIsEditFolderModalOpen(false);
    showToast('Cartella aggiornata.');
  };

  const confirmDeleteFolder = () => {
    if (!folderToDelete) return;
    CampaignManager.deleteMapFolder(folderToDelete);
    setFolders(CampaignManager.getMapFolders());
    setMaps(CampaignManager.getMaps());
    refreshEntities();
    if (selectedFolderFilter === folderToDelete) {
      setSelectedFolderFilter('all');
    }
    setFolderToDelete(null);
    showToast('Cartella eliminata. Le mappe sono state spostate alla vista principale.');
  };

  const handleQuickMoveMapFolder = (mapId: string, newFolderId: string) => {
    CampaignManager.updateMap(mapId, {
      folderId: newFolderId || undefined,
    });
    setMaps(CampaignManager.getMaps());
    setMapToMove(null);
    showToast('Mappa spostata di cartella.');
  };

  const repositioningPin = useMemo(() => {
    if (!isRepositioningPinId || !activeMap) return null;
    return activeMap.pins.find((p) => p.id === isRepositioningPinId) || null;
  }, [isRepositioningPinId, activeMap]);

  return (
    <div
      className={`flex flex-col p-2.5 sm:p-4 gap-3 sm:gap-4 overflow-hidden bg-surface-0 ${
        isFullscreen
          ? 'fixed inset-0 z-50 p-2 sm:p-4 h-screen w-screen bg-surface-0'
          : 'flex-1 h-full min-h-0'
      }`}
    >
      {/* Toast Notification */}
      {feedbackToast && (
        <div className="fixed top-4 right-4 z-50 bg-surface-1 border border-primary/40 text-content-1 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-2.5 text-xs font-medium animate-in fade-in duration-200">
          <CheckCircle2 size={16} className="text-primary shrink-0" />
          <span>{feedbackToast}</span>
        </div>
      )}

      {/* Top Header & Map Context Bar (Hidden when in Fullscreen) */}
      {!isFullscreen && (
        <div className="bg-surface-1 border border-surface-2 rounded-2xl p-3 sm:px-5 sm:py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-surface-2 border border-surface-3 flex items-center justify-center text-primary shrink-0 shadow-inner">
              <Compass size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="font-heading font-semibold text-base text-content-1 truncate">
                  {activeMap?.title || 'Atlante Geografico'}
                </h1>
                {activeMap?.scaleLabel && (
                  <span className="text-[11px] font-mono text-content-3 px-2 py-0.5 rounded-md bg-surface-2 border border-surface-3 whitespace-nowrap">
                    {activeMap.scaleLabel}
                  </span>
                )}
                {activeMapFolder ? (
                  <button
                    onClick={() => setSelectedFolderFilter(activeMapFolder.id)}
                    style={{
                      borderColor: `${activeMapFolder.color || '#3B82F6'}50`,
                      color: activeMapFolder.color || '#3B82F6',
                    }}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-2 border flex items-center gap-1 whitespace-nowrap hover:bg-surface-3 transition-colors cursor-pointer"
                    title={`Filtra cartella: ${activeMapFolder.name}`}
                  >
                    <FolderIcon size={11} /> {activeMapFolder.name}
                  </button>
                ) : (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-surface-2 border border-surface-3 text-content-3 flex items-center gap-1 whitespace-nowrap">
                    <FolderOpen size={11} /> Mappa Principale (Senza Cartella)
                  </span>
                )}
                {activeMapLinkedEntity && (
                  <Link
                    to={`/entities/place/${activeMapLinkedEntity._id}`}
                    className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-colors flex items-center gap-1 whitespace-nowrap"
                    title="Apri scheda luogo collegata nel Codex"
                  >
                    <Landmark size={11} /> {activeMapLinkedEntity.name}
                    <ExternalLink size={10} />
                  </Link>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-content-3 flex-wrap">
                <span className="font-medium text-content-2">{maps.length} mappe</span>
                <span>&bull;</span>
                <span className="inline-flex items-center gap-1 font-medium text-content-1">
                  <FolderIcon size={12} className="text-primary" />
                  {normalizedFolders.length} cartelle geografiche
                </span>
                {activeMap?.description && (
                  <>
                    <span>&bull;</span>
                    <span className="truncate max-w-sm">{activeMap.description}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            {canManageMaps && (
              <>
                <button
                  onClick={() => handleOpenNewFolderModal()}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <FolderPlus size={14} className="text-primary" />
                  <span className="hidden sm:inline">Nuova Cartella</span>
                </button>

                <button
                  onClick={() => handleOpenNewMapModal()}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium bg-primary text-surface-0 hover:bg-primary-hover transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Nuova Mappa</span>
                </button>
              </>
            )}

            <button
              onClick={() => setIsFullscreen(true)}
              className="p-1.5 rounded-xl text-xs font-medium bg-surface-2 hover:bg-surface-3 text-content-2 hover:text-content-1 border border-surface-3 transition-colors flex items-center justify-center cursor-pointer"
              title="Schermo Intero"
            >
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Mode Switcher (only on small screens when not in fullscreen) */}
      {!isFullscreen && (
        <div className="lg:hidden flex items-center bg-surface-1 border border-surface-2 p-1 rounded-xl shrink-0">
          <button
            onClick={() => setMobileView('map')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileView === 'map'
                ? 'bg-surface-2 text-content-1 font-semibold shadow-sm'
                : 'text-content-3 hover:text-content-1'
            }`}
          >
            <MapIcon size={14} className={mobileView === 'map' ? 'text-primary' : ''} />
            <span>Mappa &amp; Punti ({filteredPins.length})</span>
          </button>
          <button
            onClick={() => setMobileView('panel')}
            className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
              mobileView === 'panel'
                ? 'bg-surface-2 text-content-1 font-semibold shadow-sm'
                : 'text-content-3 hover:text-content-1'
            }`}
          >
            <FolderOpen size={14} className={mobileView === 'panel' ? 'text-primary' : ''} />
            <span>Tomo &amp; Cartelle ({maps.length} mappe, {normalizedFolders.length} cartelle)</span>
          </button>
        </div>
      )}

      {/* Main Map Viewport & Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row gap-3 sm:gap-4 min-h-0 relative">
        {/* Map Canvas */}
        <div
          ref={containerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`flex-1 bg-surface-1 border border-surface-2 rounded-2xl relative overflow-hidden flex items-center justify-center select-none touch-none ${
            mobileView === 'panel' && !isFullscreen ? 'hidden lg:flex' : 'flex'
          } ${
            isAddingPinMode || isRepositioningPinId
              ? 'cursor-crosshair'
              : isDragging
              ? 'cursor-grabbing'
              : 'cursor-grab'
          }`}
        >
          {/* Active Placement / Repositioning Floating Notice */}
          {isAddingPinMode && (
            <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-40 bg-primary text-surface-0 px-3.5 py-2 rounded-xl font-medium text-xs flex items-center gap-2 shadow-xl border border-primary-hover animate-pulse max-w-[90%] text-center">
              <Crosshair size={15} className="shrink-0" />
              <span className="truncate">Tocca o clicca sulla mappa nel punto esatto</span>
              <button
                onClick={() => setIsAddingPinMode(false)}
                className="p-1 hover:bg-black/20 rounded-md transition-colors ml-1 cursor-pointer shrink-0"
                title="Annulla posizionamento"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {isRepositioningPinId && (
            <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2 z-40 bg-amber-500 text-surface-0 px-3.5 py-2 rounded-xl font-medium text-xs flex items-center gap-2 shadow-xl border border-amber-600 animate-pulse max-w-[90%] text-center">
              <Crosshair size={15} className="shrink-0" />
              <span className="truncate">
                Riposizionamento: Clicca per spostare "{repositioningPin?.title || 'il punto'}"
              </span>
              <button
                onClick={() => setIsRepositioningPinId(null)}
                className="p-1 hover:bg-black/20 rounded-md transition-colors ml-1 cursor-pointer shrink-0"
                title="Annulla"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Floating Exit Fullscreen / Restore Panels Header */}
          {isFullscreen && (
            <div className="absolute top-3 sm:top-4 left-3 sm:left-4 z-40 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-surface-1/95 hover:bg-surface-2 text-content-1 border border-surface-3 shadow-xl backdrop-blur-md transition-all flex items-center gap-2 cursor-pointer hover:border-primary/50 group"
                title="Torna alla vista normale con elenco mappe e punti (o premi Esc)"
              >
                <Minimize2 size={15} className="text-primary group-hover:scale-110 transition-transform" />
                <span>Ripristina Vista &amp; Pannelli</span>
                <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-surface-3 rounded text-content-3">Esc</kbd>
              </button>
            </div>
          )}

          {/* Zoom controls & Fullscreen */}
          <div
            className={`absolute ${
              isFullscreen ? 'top-16 sm:top-16' : 'top-3 sm:top-4'
            } left-3 sm:left-4 z-30 flex flex-col gap-1.5 bg-surface-2/95 border border-surface-3 p-1 rounded-xl shadow-lg backdrop-blur-md`}
          >
            <button
              onClick={() => handleZoom(0.25)}
              className="p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer"
              title="Ingrandisci"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={() => handleZoom(-0.25)}
              className="p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer"
              title="Riduci"
            >
              <ZoomOut size={16} />
            </button>
            <button
              onClick={handleResetView}
              className="p-1.5 rounded-lg text-content-3 hover:text-content-1 hover:bg-surface-3 transition-colors cursor-pointer"
              title="Centra Mappa"
            >
              <RotateCcw size={15} />
            </button>
            <div className="w-full h-px bg-surface-3/80 my-0.5" />
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                isFullscreen
                  ? 'bg-primary/20 text-primary hover:bg-primary/30'
                  : 'text-content-3 hover:text-content-1 hover:bg-surface-3'
              }`}
              title={isFullscreen ? 'Esci da schermo intero (Esc)' : 'Schermo Intero'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>

          {/* Place Pin Toggle */}
          {canManageMaps && (
            <div className="absolute top-3 sm:top-4 right-3 sm:right-4 z-30 flex items-center gap-2">
              <button
                onClick={() => {
                  if (isAddingPinMode) {
                    setIsAddingPinMode(false);
                  } else {
                    handleStartAddPin();
                  }
                }}
                className={`px-3 sm:px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors border shadow-md cursor-pointer ${
                  isAddingPinMode
                    ? 'bg-rose-500 text-white border-rose-600'
                    : 'bg-surface-2/95 text-content-1 border-surface-3 hover:bg-surface-3'
                }`}
              >
                <MapPinIcon size={14} />
                <span>{isAddingPinMode ? 'Annulla' : '+ Piazza Punto'}</span>
              </button>
            </div>
          )}

          {/* Floating Quick Folder Selector directly on the Map Viewport */}
          {normalizedFolders.length > 0 && (
            <div className="absolute top-3 sm:top-4 left-14 sm:left-16 right-36 sm:right-44 z-20 flex items-center justify-start pointer-events-none">
              <div className="pointer-events-auto bg-surface-1/90 backdrop-blur-md border border-surface-3/80 shadow-lg px-2.5 py-1 rounded-xl flex items-center gap-1.5 max-w-full overflow-x-auto custom-scrollbar">
                <span className="text-[10px] font-mono text-content-3 uppercase tracking-wider shrink-0 flex items-center gap-1">
                  <FolderIcon size={11} className="text-primary" />
                  <span className="hidden sm:inline">Cartelle:</span>
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedFolderFilter('all')}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                    selectedFolderFilter === 'all'
                      ? 'bg-primary text-surface-0 font-semibold'
                      : 'text-content-3 hover:text-content-1 hover:bg-surface-2'
                  }`}
                >
                  Tutte ({maps.length})
                </button>
                {normalizedFolders.map((f) => {
                  const folderMaps = maps.filter((m) => String(m.folderId || '') === f.id);
                  const isCurrentActive = activeMapFolder?.id === f.id;
                  const isFilterSelected = selectedFolderFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setSelectedFolderFilter(f.id);
                        if (folderMaps.length > 0 && (!activeMap || String(activeMap.folderId || '') !== f.id)) {
                          setActiveMapId(folderMaps[0].id);
                          setSelectedPin(null);
                          handleResetView();
                        }
                      }}
                      style={{
                        borderColor: isFilterSelected || isCurrentActive ? f.color || '#3B82F6' : undefined,
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-medium whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer border ${
                        isFilterSelected || isCurrentActive
                          ? 'bg-surface-2 text-content-1 font-semibold shadow-xs'
                          : 'border-transparent text-content-3 hover:text-content-1 hover:bg-surface-2/60'
                      }`}
                      title={`Cartella: ${f.name} (${folderMaps.length} mappe)`}
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: f.color || '#3B82F6' }}
                      />
                      <span className="truncate max-w-[120px]">{f.name}</span>
                      <span className="text-[9px] opacity-70">({folderMaps.length})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Scale label & settings badge */}
          <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 z-30 px-3 py-1.5 rounded-xl bg-surface-2/95 backdrop-blur-md border border-surface-3 text-xs font-mono text-content-2 flex items-center gap-2 shadow-lg max-w-[80%] overflow-hidden">
            <span className="text-primary font-semibold whitespace-nowrap">Scala: {Math.round(scale * 100)}%</span>
            {activeMap?.scaleLabel && (
              <>
                <span className="text-content-3">&bull;</span>
                <span className="truncate text-content-3">{activeMap.scaleLabel}</span>
              </>
            )}
            {activeMap && canManageMaps && (
              <button
                onClick={() => handleOpenEditMapModal(activeMap)}
                className="text-content-3 hover:text-content-1 ml-0.5 p-0.5 cursor-pointer shrink-0"
                title="Modifica impostazioni mappa"
              >
                <Edit2 size={12} />
              </button>
            )}
          </div>

          {/* Fullscreen Map Title Overlay */}
          {isFullscreen && activeMap && (
            <div className="absolute bottom-3 sm:bottom-4 right-3 sm:right-4 z-30 px-3 py-1.5 rounded-xl bg-surface-2/95 backdrop-blur-md border border-surface-3 text-xs font-heading font-medium text-content-1 shadow-lg hidden sm:flex items-center gap-2">
              <Compass size={13} className="text-primary" />
              <span>{activeMap.title}</span>
            </div>
          )}

          {/* Map Layer */}
          {activeMap ? (
            <div
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                transformOrigin: 'center center',
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
              className="relative max-w-none max-h-none flex items-center justify-center"
            >
              <div
                className="relative inline-block"
                onClick={handleMapClick}
              >
                {activeMap.imageUrl && activeMap.imageUrl.trim() ? (
                  <img
                    ref={mapImageRef}
                    src={activeMap.imageUrl}
                    alt={activeMap.title}
                    draggable={false}
                    className={`object-contain rounded-xl border border-surface-2 pointer-events-none select-none transition-all duration-150 ${
                      isFullscreen
                        ? 'max-w-[96vw] max-h-[92vh]'
                        : 'max-w-[92vw] sm:max-w-[85vw] max-h-[75vh] sm:max-h-[78vh]'
                    }`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1524654458049-e36be0721fa2?q=80&w=1600&auto=format&fit=crop';
                    }}
                  />
                ) : (
                  <div className="w-[500px] h-[350px] max-w-[85vw] max-h-[60vh] bg-surface-2/40 border border-dashed border-surface-3 rounded-xl flex flex-col items-center justify-center text-content-3 p-6 text-center">
                    <MapPinIcon size={36} className="text-primary/60 mb-2" />
                    <p className="text-sm font-semibold text-content-2">Nessuna immagine per questa mappa</p>
                    <p className="text-xs text-content-3 mt-1">Carica un'immagine per posizionare i punti d'interesse.</p>
                  </div>
                )}

                {/* Render All Pins on the Map */}
                {filteredPins.map((pin) => {
                  const c = PIN_CATEGORIES[pin.category] || PIN_CATEGORIES.city;
                  const Icon = c.icon;
                  const isSelected = selectedPin?.id === pin.id;
                  const isRepositioningThis = isRepositioningPinId === pin.id;

                  return (
                    <div
                      key={pin.id}
                      onClick={(e) => {
                        if (isAddingPinMode || isRepositioningPinId) return;
                        e.stopPropagation();
                        setSelectedPin(pin);
                        setSidebarTab('pins');
                      }}
                      style={{
                        left: `${pin.x}%`,
                        top: `${pin.y}%`,
                      }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 group ${
                        isAddingPinMode || isRepositioningPinId
                          ? 'pointer-events-none opacity-40'
                          : 'cursor-pointer'
                      }`}
                    >
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform duration-200 ${
                          c.markerBg
                        } text-surface-0 shadow-lg ${
                          isSelected
                            ? 'scale-125 ring-4 ring-primary ring-offset-2 ring-offset-surface-1'
                            : isRepositioningThis
                            ? 'scale-125 ring-4 ring-amber-400 animate-pulse'
                            : 'hover:scale-110'
                        }`}
                      >
                        <Icon size={14} />
                      </div>

                      {/* Tooltip on Hover */}
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
                        <div className="bg-surface-0/95 backdrop-blur-sm border border-surface-3 px-2.5 py-1 rounded-lg shadow-xl text-center whitespace-nowrap">
                          <span className="font-heading font-semibold text-xs text-content-1 block">
                            {pin.title}
                          </span>
                          <span className="text-[10px] text-content-3 font-mono">
                            {pin.x}% X &bull; {pin.y}% Y
                          </span>
                        </div>
                        <div className="w-1.5 h-1.5 bg-surface-0 rotate-45 -mt-0.5 border-r border-b border-surface-3"></div>
                      </div>
                    </div>
                  );
                })}

                {/* Temporary pending marker indicator */}
                {pendingPinCoords && (
                  <div
                    style={{
                      left: `${pendingPinCoords.x}%`,
                      top: `${pendingPinCoords.y}%`,
                    }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
                  >
                    <div className="w-9 h-9 rounded-full bg-rose-500 text-white flex items-center justify-center ring-4 ring-rose-400/50 animate-bounce shadow-xl">
                      <Crosshair size={18} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center p-8 text-content-3">
              <MapIcon size={40} className="mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Nessuna mappa presente nel tomo cartografico.</p>
              <button
                onClick={() => handleOpenNewMapModal()}
                className="mt-3 px-4 py-2 rounded-xl bg-primary text-surface-0 text-xs font-medium hover:bg-primary-hover cursor-pointer"
              >
                + Crea la Prima Mappa
              </button>
            </div>
          )}
        </div>

        {/* Sidebar Panel: Maps List & Folders, Pins & Details, Codex Places */}
        <div
          className={`w-full lg:w-88 flex flex-col gap-3 shrink-0 ${
            mobileView === 'map' && !isFullscreen ? 'hidden lg:flex' : 'flex flex-1 lg:flex-none'
          } ${isFullscreen ? 'hidden' : ''}`}
        >
          {/* Tab Switcher */}
          <div className="bg-surface-1 border border-surface-2 p-1 rounded-xl flex items-center gap-1">
            <button
              onClick={() => handleSidebarTabChange('maps')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                sidebarTab === 'maps'
                  ? 'bg-surface-2 text-content-1 shadow-sm font-semibold'
                  : 'text-content-3 hover:text-content-1'
              }`}
            >
              <FolderOpen size={13} className={sidebarTab === 'maps' ? 'text-primary' : ''} />
              <span>Mappe &amp; Cartelle ({maps.length}/{normalizedFolders.length})</span>
            </button>
            <button
              onClick={() => handleSidebarTabChange('pins')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                sidebarTab === 'pins'
                  ? 'bg-surface-2 text-content-1 shadow-sm font-semibold'
                  : 'text-content-3 hover:text-content-1'
              }`}
            >
              <MapPinIcon size={13} className={sidebarTab === 'pins' ? 'text-primary' : ''} />
              <span>Punti ({filteredPins.length})</span>
            </button>
            <button
              onClick={() => handleSidebarTabChange('codex')}
              className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer ${
                sidebarTab === 'codex'
                  ? 'bg-surface-2 text-content-1 shadow-sm font-semibold'
                  : 'text-content-3 hover:text-content-1'
              }`}
            >
              <BookMarked size={13} className={sidebarTab === 'codex' ? 'text-primary' : ''} />
              <span>Codex ({placeEntities.length})</span>
            </button>
          </div>

          <div key={sidebarTab} className="flex-1 flex flex-col min-h-0 animate-fadeIn">
            {/* TAB 1: MAPS & FOLDERS LIST */}
            {sidebarTab === 'maps' && (
              <div className="flex-1 bg-surface-1 border border-surface-2 rounded-2xl p-3.5 flex flex-col min-h-0 overflow-hidden space-y-3">
                {/* Search & Folder Filters */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
                    <input
                      type="text"
                      placeholder="Cerca per mappa o cartella..."
                      value={mapSearchQuery}
                      onChange={(e) => setMapSearchQuery(e.target.value)}
                      className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-1 outline-none transition-colors placeholder-content-3"
                    />
                  </div>

                  {/* Folder Category Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                    <button
                      onClick={() => setSelectedFolderFilter('all')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        selectedFolderFilter === 'all'
                          ? 'bg-primary text-surface-0 font-semibold'
                          : 'bg-surface-2 text-content-3 hover:text-content-1 border border-surface-3'
                      }`}
                    >
                      Tutte ({maps.length})
                    </button>
                    {normalizedFolders.map((f) => {
                      const count = maps.filter((m) => String(m.folderId || '') === f.id).length;
                      const isSelected = selectedFolderFilter === f.id;
                      return (
                        <button
                          key={f.id}
                          onClick={() => setSelectedFolderFilter(f.id)}
                          style={{
                            borderColor: isSelected ? f.color || '#3B82F6' : undefined,
                            backgroundColor: isSelected ? `${f.color || '#3B82F6'}20` : undefined,
                            color: isSelected ? f.color || '#3B82F6' : undefined,
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 border border-surface-3 cursor-pointer ${
                            !isSelected ? 'bg-surface-2 text-content-2 hover:text-content-1' : 'font-semibold'
                          }`}
                        >
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: f.color || '#3B82F6' }}
                          />
                          <span>{f.name}</span>
                          <span className="text-[10px] opacity-70">({count})</span>
                        </button>
                      );
                    })}
                    {unassignedMaps.length > 0 && normalizedFolders.length > 0 && (
                      <button
                        onClick={() => setSelectedFolderFilter('unassigned')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                          selectedFolderFilter === 'unassigned'
                            ? 'bg-surface-3 text-content-1 font-semibold border border-surface-4'
                            : 'bg-surface-2 text-content-3 hover:text-content-1 border border-surface-3'
                        }`}
                      >
                        Senza cartella ({unassignedMaps.length})
                      </button>
                    )}
                    <button
                      onClick={() => handleOpenNewFolderModal()}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1 bg-surface-2 text-content-3 hover:text-content-1 border border-surface-3 cursor-pointer"
                      title="Crea una nuova cartella per organizzare le mappe"
                    >
                      <Plus size={11} /> + Cartella
                    </button>
                  </div>
                </div>

                {/* Maps & Folders Tree / Accordion View */}
                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
                  {/* Folders Grouping */}
                  {normalizedFolders
                    .filter((f) => {
                      if (selectedFolderFilter !== 'all' && selectedFolderFilter !== f.id) return false;
                      if (!mapSearchQuery.trim()) return true;
                      const q = mapSearchQuery.toLowerCase();
                      const matchesFolder = f.name.toLowerCase().includes(q) || (f.description && f.description.toLowerCase().includes(q));
                      const folderMaps = maps.filter((m) => String(m.folderId || '') === f.id);
                      const matchesMaps = folderMaps.some((m) => m.title.toLowerCase().includes(q) || (m.description && m.description.toLowerCase().includes(q)));
                      return matchesFolder || matchesMaps;
                    })
                    .map((f) => {
                      const folderMaps = maps.filter((m) => String(m.folderId || '') === f.id);
                      const isCollapsed = !!collapsedFolders[f.id];
                      const linkedPlace = placeEntities.find((p) => p._id === f.placeEntityId);

                      return (
                        <div
                          key={f.id}
                          className="bg-surface-2/60 border border-surface-3 rounded-xl overflow-hidden"
                        >
                          {/* Folder Header */}
                          <div className="p-2.5 bg-surface-2 flex items-center justify-between gap-2 border-b border-surface-3/60">
                            <button
                              onClick={() => toggleFolderCollapse(f.id)}
                              className="flex items-center gap-2 min-w-0 text-left cursor-pointer flex-1"
                            >
                              <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-white shrink-0 shadow-sm"
                                style={{ backgroundColor: f.color || '#3B82F6' }}
                              >
                                <FolderIcon size={13} />
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-heading font-semibold text-xs text-content-1 truncate flex items-center gap-1.5">
                                  {f.name}
                                  <span className="text-[10px] font-mono text-content-3 font-normal">
                                    ({folderMaps.length})
                                  </span>
                                </h4>
                                {linkedPlace && (
                                  <p className="text-[10px] text-primary flex items-center gap-1 truncate">
                                    <Landmark size={10} /> Luogo Codex: {linkedPlace.name}
                                  </p>
                                )}
                              </div>
                              {isCollapsed ? (
                                <ChevronRight size={14} className="text-content-3 ml-auto shrink-0" />
                              ) : (
                                <ChevronDown size={14} className="text-content-3 ml-auto shrink-0" />
                              )}
                            </button>

                            {canManageMaps && (
                              <div className="flex items-center gap-0.5 shrink-0">
                                <button
                                  onClick={() => handleOpenNewMapModal(f.id)}
                                  className="p-1 text-content-3 hover:text-primary rounded hover:bg-surface-3 transition-colors cursor-pointer"
                                  title="Aggiungi Mappa a questa cartella"
                                >
                                  <Plus size={13} />
                                </button>
                                <button
                                  onClick={() => handleOpenEditFolderModal(f)}
                                  className="p-1 text-content-3 hover:text-content-1 rounded hover:bg-surface-3 transition-colors cursor-pointer"
                                  title="Modifica Cartella"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button
                                  onClick={() => setFolderToDelete(f.id)}
                                  className="p-1 text-content-3 hover:text-rose-400 rounded hover:bg-surface-3 transition-colors cursor-pointer"
                                  title="Elimina Cartella"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Folder Maps List */}
                          {!isCollapsed && (
                            <div className="p-2 space-y-1.5 bg-surface-1/40">
                              {folderMaps.length === 0 ? (
                                <div className="text-center py-3 text-content-3 text-[11px] italic">
                                  Nessuna mappa in questa cartella.
                                  {canManageMaps && (
                                    <button
                                      onClick={() => handleOpenNewMapModal(f.id)}
                                      className="block mx-auto mt-1 text-primary hover:underline font-medium not-italic cursor-pointer"
                                    >
                                      + Aggiungi mappa qui
                                    </button>
                                  )}
                                </div>
                              ) : (
                                folderMaps.map((m) => {
                                  const isActive = m.id === activeMapId;
                                  const mapPlace = placeEntities.find((p) => p._id === m.entityId);

                                  return (
                                    <div
                                      key={m.id}
                                      onClick={() => {
                                        setActiveMapId(m.id);
                                        setSelectedPin(null);
                                        handleResetView();
                                      }}
                                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 group ${
                                        isActive
                                          ? 'bg-surface-2 border-primary/50 shadow-sm'
                                          : 'bg-surface-2/40 border-surface-3 hover:bg-surface-2'
                                      }`}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        {m.imageUrl && m.imageUrl.trim() ? (
                                          <img
                                            src={m.imageUrl}
                                            alt={m.title}
                                            loading="lazy"
                                            decoding="async"
                                            className="w-9 h-9 rounded-lg object-cover border border-surface-3 shrink-0"
                                          />
                                        ) : (
                                          <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center text-content-3 border border-surface-3 shrink-0">
                                            <MapPinIcon size={16} />
                                          </div>
                                        )}
                                        <div className="min-w-0">
                                          <p
                                            className={`font-heading font-semibold text-xs truncate ${
                                              isActive ? 'text-primary' : 'text-content-1'
                                            }`}
                                          >
                                            {m.title}
                                          </p>
                                          <div className="flex items-center gap-2 text-[10px] text-content-3 font-mono">
                                            <span>{m.pins?.length || 0} Punti</span>
                                            {m.scaleLabel && <span>&bull; {m.scaleLabel}</span>}
                                            {mapPlace && (
                                              <span className="text-primary truncate">
                                                &bull; 🏛️ {mapPlace.name}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {canManageMaps && (
                                        <div
                                          className="flex items-center gap-1 shrink-0"
                                          onClick={(e) => e.stopPropagation()}
                                        >
                                          <button
                                            onClick={() => setMapToMove(m)}
                                            className="p-1 text-content-3 hover:text-primary rounded hover:bg-surface-3"
                                            title="Sposta in altra cartella"
                                          >
                                            <MoveRight size={12} />
                                          </button>
                                          <button
                                            onClick={() => handleOpenEditMapModal(m)}
                                            className="p-1 text-content-3 hover:text-content-1 rounded hover:bg-surface-3"
                                            title="Modifica Mappa"
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                          {maps.length > 1 && (
                                            <button
                                              onClick={() => handleDeleteMap(m.id)}
                                              className="p-1 text-content-3 hover:text-rose-400 rounded hover:bg-surface-3"
                                              title="Elimina Mappa"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                  {/* Root / Unassigned Maps (if any or when selected) */}
                  {(selectedFolderFilter === 'all' || selectedFolderFilter === 'unassigned') &&
                    unassignedMaps.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        {normalizedFolders.length > 0 && (
                          <div className="px-1 text-[10px] font-mono uppercase tracking-wider text-content-3 flex items-center justify-between">
                            <span>Mappe Principali (Senza Cartella)</span>
                            <span>({unassignedMaps.length})</span>
                          </div>
                        )}

                        {unassignedMaps
                          .map((m) => {
                            const isActive = m.id === activeMapId;
                            const mapPlace = placeEntities.find((p) => p._id === m.entityId);

                            return (
                              <div
                                key={m.id}
                                onClick={() => {
                                  setActiveMapId(m.id);
                                  setSelectedPin(null);
                                  handleResetView();
                                }}
                                className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 group ${
                                  isActive
                                    ? 'bg-surface-2 border-primary/50 shadow-sm'
                                    : 'bg-surface-2/40 border-surface-3 hover:bg-surface-2'
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  {m.imageUrl && m.imageUrl.trim() ? (
                                    <img
                                      src={m.imageUrl}
                                      alt={m.title}
                                      className="w-9 h-9 rounded-lg object-cover border border-surface-3 shrink-0"
                                    />
                                  ) : (
                                    <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center text-content-3 border border-surface-3 shrink-0">
                                      <MapPinIcon size={16} />
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <p
                                      className={`font-heading font-semibold text-xs truncate ${
                                        isActive ? 'text-primary' : 'text-content-1'
                                      }`}
                                    >
                                      {m.title}
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] text-content-3 font-mono">
                                      <span>{m.pins?.length || 0} Punti</span>
                                      {m.scaleLabel && <span>&bull; {m.scaleLabel}</span>}
                                      {mapPlace && (
                                        <span className="text-primary truncate">
                                          &bull; 🏛️ {mapPlace.name}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {canManageMaps && (
                                  <div
                                    className="flex items-center gap-1 shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => setMapToMove(m)}
                                      className="p-1 text-content-3 hover:text-primary rounded hover:bg-surface-3"
                                      title="Organizza in cartella"
                                    >
                                      <FolderPlus size={12} />
                                    </button>
                                    <button
                                      onClick={() => handleOpenEditMapModal(m)}
                                      className="p-1 text-content-3 hover:text-content-1 rounded hover:bg-surface-3"
                                      title="Modifica Mappa"
                                    >
                                      <Edit2 size={12} />
                                    </button>
                                    {maps.length > 1 && (
                                      <button
                                        onClick={() => handleDeleteMap(m.id)}
                                        className="p-1 text-content-3 hover:text-rose-400 rounded hover:bg-surface-3"
                                        title="Elimina Mappa"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}

                  {filteredMapsList.length === 0 && (
                    <div className="text-center py-8 text-content-3 text-xs">
                      <p>Nessuna mappa trovata con i filtri correnti.</p>
                    </div>
                  )}
                </div>

                {/* Quick Add Actions */}
                {canManageMaps && (
                  <div className="pt-2 border-t border-surface-2 flex items-center gap-2">
                    <button
                      onClick={() => handleOpenNewFolderModal()}
                      className="flex-1 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-1 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 border border-surface-3 cursor-pointer"
                    >
                      <FolderPlus size={13} className="text-primary" /> + Cartella
                    </button>
                    <button
                      onClick={() => handleOpenNewMapModal()}
                      className="flex-1 py-2 rounded-xl bg-primary text-surface-0 hover:bg-primary-hover text-xs font-medium transition-colors flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Plus size={13} /> + Mappa
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: PINS LIST & SELECTED PIN DETAIL */}
            {sidebarTab === 'pins' && (
              <div className="flex-1 bg-surface-1 border border-surface-2 rounded-2xl p-3.5 flex flex-col min-h-0 overflow-hidden space-y-3">
                {selectedPin ? (
                  // Selected Pin Inspector
                  <div className="space-y-3 flex-1 flex flex-col min-h-0 overflow-y-auto custom-scrollbar">
                    <div className="flex items-start justify-between gap-2 border-b border-surface-2 pb-2.5">
                      <div>
                        {(() => {
                          const c = PIN_CATEGORIES[selectedPin.category] || PIN_CATEGORIES.city;
                          const I = c.icon;
                          return (
                            <span className={`text-[10px] font-medium flex items-center gap-1 ${c.color} mb-1`}>
                              <I size={11} /> {c.label}
                            </span>
                          );
                        })()}
                        <h3 className="font-heading font-semibold text-sm text-content-1">{selectedPin.title}</h3>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {canManageMaps && (
                          <>
                            <button
                              onClick={() => handleOpenEditPinModal(selectedPin)}
                              className="p-1.5 text-content-3 hover:text-content-1 rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
                              title="Modifica Punto"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => {
                                setIsRepositioningPinId(selectedPin.id);
                                showToast(`Clicca sulla mappa per spostare "${selectedPin.title}".`);
                              }}
                              className="p-1.5 text-content-3 hover:text-primary rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
                              title="Riposiziona Punto sulla Mappa"
                            >
                              <Crosshair size={13} />
                            </button>
                            <button
                              onClick={() => handleDeletePin(selectedPin.id)}
                              className="p-1.5 text-content-3 hover:text-rose-400 rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
                              title="Elimina Punto"
                            >
                              <Trash2 size={13} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => setSelectedPin(null)}
                          className="p-1.5 text-content-3 hover:text-content-1 rounded-md hover:bg-surface-2 transition-colors cursor-pointer"
                          title="Chiudi Dettagli"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Anchor Point Box */}
                    <div className="bg-surface-2 p-2.5 rounded-xl border border-surface-3 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <Compass size={14} className="text-primary shrink-0" />
                        <div>
                          <p className="text-[11px] font-medium text-content-1">Punto di Ancoraggio</p>
                          <p className="text-[10px] font-mono text-content-3">
                            X: {selectedPin.x}% &bull; Y: {selectedPin.y}%
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setIsRepositioningPinId(selectedPin.id);
                          showToast('Clicca sul nuovo punto desiderato sulla mappa.');
                        }}
                        className="px-2 py-1 rounded-lg bg-surface-1 hover:bg-primary/10 hover:text-primary text-content-2 text-[11px] font-medium transition-colors border border-surface-3 flex items-center gap-1 cursor-pointer"
                      >
                        <Crosshair size={11} /> Sposta
                      </button>
                    </div>

                    {selectedPin.description ? (
                      <div className="bg-surface-2 p-3 rounded-xl border border-surface-3">
                        <p className="text-xs text-content-2 leading-relaxed whitespace-pre-line">
                          {selectedPin.description}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-content-3 italic">Nessuna descrizione o nota geografica.</p>
                    )}

                    {/* Rich Codex Linked Entity Section */}
                    {selectedPin.entityId && (() => {
                      const linkedEnt = entities.find((e) => e._id === selectedPin.entityId);
                      if (!linkedEnt) return null;

                      // Check if this linked place entity has its own dedicated Map in the Atlas
                      const dedicatedMap = maps.find((m) => m.id === linkedEnt.mapId || m.entityId === linkedEnt._id);
                      // Check if there are sub-maps in a folder linked to this place
                      const placeFolder = normalizedFolders.find((f) => f.placeEntityId === linkedEnt._id || (linkedEnt.folderId && f.id === String(linkedEnt.folderId)));
                      const folderMaps = placeFolder ? maps.filter((m) => String(m.folderId || '') === placeFolder.id) : [];

                      return (
                        <div className="p-3 rounded-xl bg-surface-2 border border-surface-3 space-y-2.5">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 truncate">
                              <Landmark size={13} className="text-primary shrink-0" />
                              <span className="font-semibold text-content-1 truncate">{linkedEnt.name}</span>
                            </div>
                            <Link
                              to={`/entities/${linkedEnt.type}/${linkedEnt._id}`}
                              className="text-primary hover:underline flex items-center gap-0.5 text-[11px] shrink-0 font-medium"
                            >
                              Scheda Codex <ExternalLink size={10} />
                            </Link>
                          </div>

                          {linkedEnt.progressNote && (
                            <p className="text-[11px] text-content-3 line-clamp-2 italic">
                              "{linkedEnt.progressNote}"
                            </p>
                          )}

                          {/* Sub-maps and Dedicated Map Navigation */}
                          {dedicatedMap && dedicatedMap.id !== activeMap?.id && (
                            <button
                              onClick={() => {
                                setActiveMapId(dedicatedMap.id);
                                setSelectedPin(null);
                                handleResetView();
                              }}
                              className="w-full py-1.5 px-2.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium transition-colors flex items-center justify-center gap-1.5 border border-primary/20 cursor-pointer"
                            >
                              <MapIcon size={12} />
                              <span>Apri Mappa Dettagliata di {linkedEnt.name}</span>
                            </button>
                          )}

                          {folderMaps.length > 0 && (
                            <div className="pt-1.5 border-t border-surface-3 space-y-1">
                              <span className="text-[10px] font-mono text-content-3 uppercase">
                                Mappe del Luogo ({folderMaps.length}):
                              </span>
                              <div className="space-y-1">
                                {folderMaps.map((fm) => (
                                  <button
                                    key={fm.id}
                                    onClick={() => {
                                      setActiveMapId(fm.id);
                                      setSelectedPin(null);
                                      handleResetView();
                                    }}
                                    className={`w-full text-left px-2 py-1 rounded text-[11px] flex items-center justify-between transition-colors ${
                                      fm.id === activeMap?.id
                                        ? 'bg-primary text-surface-0 font-medium'
                                        : 'bg-surface-1 hover:bg-surface-3 text-content-2'
                                    }`}
                                  >
                                    <span className="truncate">{fm.title}</span>
                                    <ChevronRight size={11} className="shrink-0 ml-1 opacity-70" />
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    <div className="mt-auto pt-2 border-t border-surface-2 text-[10px] font-mono text-content-3 flex justify-between">
                      <span>Mappa: {activeMap?.title}</span>
                      {selectedPin.loreDate && <span className="text-primary">{selectedPin.loreDate}</span>}
                    </div>
                  </div>
                ) : (
                  // Pins List View
                  <div className="flex-1 flex flex-col min-h-0 space-y-3">
                    {/* Pin search & Category filter */}
                    <div className="space-y-2">
                      <div className="relative">
                        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
                        <input
                          type="text"
                          placeholder="Cerca punti d'interesse..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-1 outline-none transition-colors placeholder-content-3"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
                        <button
                          onClick={() => setFilterCategory('all')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors cursor-pointer ${
                            filterCategory === 'all'
                              ? 'bg-surface-2 text-content-1 border border-surface-3 font-semibold'
                              : 'text-content-3 hover:text-content-1'
                          }`}
                        >
                          Tutti ({activeMap?.pins.length || 0})
                        </button>
                        {Object.entries(PIN_CATEGORIES).map(([catKey, catVal]) => {
                          const count = (activeMap?.pins || []).filter((p) => p.category === catKey).length;
                          if (count === 0 && filterCategory !== catKey) return null;
                          return (
                            <button
                              key={catKey}
                              onClick={() => setFilterCategory(catKey)}
                              className={`px-2 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
                                filterCategory === catKey
                                  ? `${catVal.bg} ${catVal.color} border ${catVal.border} font-semibold`
                                  : 'text-content-3 hover:text-content-1'
                              }`}
                            >
                              <span>{catVal.label}</span>
                              <span className="font-mono text-[10px]">({count})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pins Items Scroll Area */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
                      {filteredPins.length === 0 ? (
                        <div className="text-center py-8 text-content-3">
                          <MapPinIcon size={24} className="mx-auto mb-2 opacity-30" />
                          <p className="text-xs">Nessun punto d'interesse trovato.</p>
                          {canManageMaps && (
                            <button
                              onClick={handleStartAddPin}
                              className="mt-2 text-xs text-primary hover:underline font-medium cursor-pointer"
                            >
                              + Aggiungi un punto ora
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredPins.map((pin) => {
                          const c = PIN_CATEGORIES[pin.category] || PIN_CATEGORIES.city;
                          const Icon = c.icon;
                          return (
                            <div
                              key={pin.id}
                              onClick={() => setSelectedPin(pin)}
                              className="p-2.5 rounded-xl bg-surface-2 hover:bg-surface-3/70 border border-surface-3 cursor-pointer transition-colors flex items-center justify-between gap-2 group"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`w-6 h-6 rounded-lg ${c.bg} ${c.color} flex items-center justify-center shrink-0`}>
                                  <Icon size={13} />
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-xs text-content-1 truncate group-hover:text-primary transition-colors">
                                    {pin.title}
                                  </p>
                                  <p className="text-[10px] text-content-3 font-mono">
                                    {pin.x}% X &bull; {pin.y}% Y
                                  </p>
                                </div>
                              </div>
                              <ChevronRight size={14} className="text-content-3 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Add pin button */}
                    {canManageMaps && (
                      <button
                        onClick={handleStartAddPin}
                        className="w-full py-2 rounded-xl border border-dashed border-surface-3 hover:border-primary text-xs font-medium text-content-2 hover:text-primary transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Plus size={14} /> Piazza Nuovo Punto
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: CODEX PLACES */}
            {sidebarTab === 'codex' && (
              <div className="flex-1 bg-surface-1 border border-surface-2 rounded-2xl p-3.5 flex flex-col min-h-0 overflow-hidden space-y-3">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-content-3" />
                  <input
                    type="text"
                    placeholder="Cerca luoghi del Codex..."
                    value={codexSearchQuery}
                    onChange={(e) => setCodexSearchQuery(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl pl-8 pr-3 py-1.5 text-xs text-content-1 outline-none transition-colors placeholder-content-3"
                  />
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                  {placeEntities
                    .filter((p) =>
                      !codexSearchQuery.trim() ||
                      p.name.toLowerCase().includes(codexSearchQuery.toLowerCase()) ||
                      (p.progressNote && p.progressNote.toLowerCase().includes(codexSearchQuery.toLowerCase()))
                    )
                    .map((place) => {
                      const isPinnedOnActiveMap = place.mapId === activeMap?.id && place.pinId;
                      const linkedDedicatedMap = maps.find((m) => m.id === place.mapId || m.entityId === place._id);
                      const placeFolder = normalizedFolders.find((f) => f.placeEntityId === place._id || (place.folderId && f.id === String(place.folderId)));
                      const folderMaps = placeFolder ? maps.filter((m) => String(m.folderId || '') === placeFolder.id) : [];

                      return (
                        <div
                          key={place._id}
                          className={`p-3 rounded-xl border transition-all flex flex-col gap-2.5 ${
                            isPinnedOnActiveMap
                              ? 'bg-surface-2 border-primary/40 shadow-sm'
                              : 'bg-surface-2/40 border-surface-3 hover:bg-surface-2'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="font-heading font-semibold text-xs text-content-1 truncate flex items-center gap-1.5">
                                <Landmark size={12} className="text-primary shrink-0" />
                                {place.name}
                              </h4>
                              {place.progressNote && (
                                <p className="text-[11px] text-content-3 line-clamp-1 mt-0.5">
                                  {place.progressNote}
                                </p>
                              )}
                            </div>

                            <Link
                              to={`/entities/place/${place._id}`}
                              className="p-1 text-content-3 hover:text-primary rounded shrink-0"
                              title="Vedi nel Codex"
                            >
                              <ExternalLink size={12} />
                            </Link>
                          </div>

                          {/* Location details / Folder / Maps info */}
                          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
                            {placeFolder && (
                              <span
                                style={{ color: placeFolder.color || '#3B82F6', borderColor: `${placeFolder.color || '#3B82F6'}40` }}
                                className="px-1.5 py-0.5 rounded bg-surface-1 border font-medium flex items-center gap-1"
                              >
                                <FolderIcon size={9} /> Cartella: {placeFolder.name} ({folderMaps.length})
                              </span>
                            )}
                            {linkedDedicatedMap && (
                              <span className="px-1.5 py-0.5 rounded bg-surface-1 text-content-2 border border-surface-3 font-medium flex items-center gap-1">
                                <MapIcon size={9} className="text-primary" /> Mappa: {linkedDedicatedMap.title}
                              </span>
                            )}
                          </div>

                          {/* Quick Actions Footer */}
                          <div className="flex items-center justify-between pt-1 border-t border-surface-3 text-[10px]">
                            {isPinnedOnActiveMap ? (
                              <span className="text-emerald-400 font-medium flex items-center gap-1">
                                <CheckCircle2 size={11} /> Ancorato ({place.pinX}% X, {place.pinY}% Y)
                              </span>
                            ) : linkedDedicatedMap ? (
                              <button
                                onClick={() => {
                                  setActiveMapId(linkedDedicatedMap.id);
                                  handleResetView();
                                }}
                                className="text-primary hover:underline flex items-center gap-1 font-mono cursor-pointer"
                              >
                                <Compass size={10} /> Apri Mappa
                              </button>
                            ) : (
                              <span className="text-content-3 italic">Non ancora ancorato</span>
                            )}

                            <div className="flex items-center gap-1">
                              {!placeFolder && (
                                <button
                                  onClick={() => handleOpenNewFolderModal(place._id)}
                                  className="px-2 py-0.5 rounded-lg bg-surface-1 hover:bg-surface-3 text-content-2 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                                  title="Crea cartella mappe per questo luogo"
                                >
                                  <FolderPlus size={10} />
                                  <span>+ Cartella</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleStartPlaceCodexEntity(place)}
                                className="px-2 py-0.5 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-surface-0 transition-colors font-medium flex items-center gap-1 cursor-pointer"
                              >
                                <MapPinIcon size={10} />
                                <span>{isPinnedOnActiveMap ? 'Riposiziona' : 'Piazza qui'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  {placeEntities.length === 0 && (
                    <div className="text-center py-6 text-content-3 text-xs">
                      <p>Nessun luogo registrato nel Codex.</p>
                    </div>
                  )}
                </div>

                <Link
                  to="/entities/place"
                  className="w-full py-2 rounded-xl border border-dashed border-surface-3 hover:border-primary text-xs font-medium text-content-2 hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                >
                  <Plus size={14} /> Crea Luogo nel Codex
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CREATE NEW MAP MODAL */}
      {isNewMapModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-0/80 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-md bg-surface-1 border border-surface-2 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[calc(100dvh-1.5rem)] my-auto overflow-y-auto custom-scrollbar shrink-0">
              <div className="flex items-center justify-between border-b border-surface-2 pb-3">
                <h3 className="font-heading font-semibold text-base text-content-1 flex items-center gap-2">
                  <MapIcon size={18} className="text-primary" /> Nuova Mappa Cartografica
                </h3>
                <button onClick={() => setIsNewMapModalOpen(false)} className="text-content-3 hover:text-content-1 cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-content-2 mb-1">
                    Titolo Mappa <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Es: Costa della Spada, Mappa dei Sotterranei..."
                    value={newMapTitle}
                    onChange={(e) => setNewMapTitle(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  />
                </div>

                {/* Cartella / Raggruppamento */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-medium text-content-2">Cartella / Raggruppamento</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsNewMapModalOpen(false);
                        handleOpenNewFolderModal();
                      }}
                      className="text-primary hover:underline text-[11px] flex items-center gap-1 cursor-pointer"
                    >
                      <FolderPlus size={11} /> + Nuova Cartella
                    </button>
                  </div>
                  <select
                    value={newMapFolderId}
                    onChange={(e) => setNewMapFolderId(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  >
                    <option value="">-- Nessuna (Mappa Principale / Root) --</option>
                    {normalizedFolders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Relational Codex Link */}
                <div>
                  <label className="block font-medium text-content-2 mb-1">Collega a Luogo del Codex (Opzionale)</label>
                  <select
                    value={newMapEntityId}
                    onChange={(e) => {
                      setNewMapEntityId(e.target.value);
                      const ent = placeEntities.find((p) => p._id === e.target.value);
                      if (ent && !newMapTitle) setNewMapTitle(ent.name);
                    }}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  >
                    <option value="">-- Nessun Luogo Associato --</option>
                    {placeEntities.map((p) => (
                      <option key={p._id} value={p._id}>
                        🏛️ {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <SingleImageUploader
                  value={newMapImageUrl}
                  onChange={setNewMapImageUrl}
                  label="Immagine Cartografica"
                  aspectRatio="video"
                  previewHeightClass="h-32"
                  entityName={newMapTitle}
                  entityType="location"
                  contextDescription={newMapDesc || 'Mappa cartografica fantasy RPG di D&D'}
                />

                <div>
                  <label className="block font-medium text-content-2 mb-1">Scala / Legenda (Opzionale)</label>
                  <input
                    type="text"
                    placeholder="Es: 1 esagono = 10 miglia, 1 quadretto = 1.5m"
                    value={newMapScale}
                    onChange={(e) => setNewMapScale(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-content-2 mb-1">Descrizione Geografica</label>
                  <textarea
                    rows={2}
                    placeholder="Note sul regno, clima, confini..."
                    value={newMapDesc}
                    onChange={(e) => setNewMapDesc(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl p-2.5 text-content-1 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-2">
                <button
                  onClick={() => setIsNewMapModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-content-3 hover:text-content-1 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  onClick={handleCreateMap}
                  disabled={!newMapTitle.trim() || !newMapImageUrl.trim()}
                  className="px-4 py-2 rounded-xl bg-primary disabled:opacity-40 text-surface-0 text-xs font-medium transition-colors cursor-pointer"
                >
                  Crea Mappa
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* EDIT MAP MODAL */}
      {isEditMapModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-0/80 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-md bg-surface-1 border border-surface-2 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[calc(100dvh-1.5rem)] my-auto overflow-y-auto custom-scrollbar shrink-0">
              <div className="flex items-center justify-between border-b border-surface-2 pb-3">
                <h3 className="font-heading font-semibold text-base text-content-1">
                  Modifica Mappa
                </h3>
                <button onClick={() => setIsEditMapModalOpen(false)} className="text-content-3 hover:text-content-1 cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-content-2 mb-1">Titolo</label>
                  <input
                    type="text"
                    value={editMapTitle}
                    onChange={(e) => setEditMapTitle(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  />
                </div>

                {/* Cartella */}
                <div>
                  <label className="block font-medium text-content-2 mb-1">Cartella / Raggruppamento</label>
                  <select
                    value={editMapFolderId}
                    onChange={(e) => setEditMapFolderId(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  >
                    <option value="">-- Nessuna (Mappa Principale / Root) --</option>
                    {normalizedFolders.map((f) => (
                      <option key={f.id} value={f.id}>
                        📁 {f.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Relational Codex Link */}
                <div>
                  <label className="block font-medium text-content-2 mb-1">Collega a Luogo del Codex</label>
                  <select
                    value={editMapEntityId}
                    onChange={(e) => setEditMapEntityId(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  >
                    <option value="">-- Nessun Luogo Associato --</option>
                    {placeEntities.map((p) => (
                      <option key={p._id} value={p._id}>
                        🏛️ {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <SingleImageUploader
                  value={editMapImageUrl}
                  onChange={setEditMapImageUrl}
                  label="Immagine Cartografica"
                  aspectRatio="video"
                  previewHeightClass="h-32"
                  entityName={editMapTitle}
                  entityType="location"
                  contextDescription={editMapDesc || 'Mappa cartografica fantasy RPG di D&D'}
                />

                <div>
                  <label className="block font-medium text-content-2 mb-1">Scala</label>
                  <input
                    type="text"
                    value={editMapScale}
                    onChange={(e) => setEditMapScale(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-content-2 mb-1">Descrizione</label>
                  <textarea
                    rows={2}
                    value={editMapDesc}
                    onChange={(e) => setEditMapDesc(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl p-2.5 text-content-1 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-2">
                <button
                  onClick={() => setIsEditMapModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-content-3 hover:text-content-1 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  onClick={handleSaveEditedMap}
                  disabled={!editMapTitle.trim() || !editMapImageUrl.trim()}
                  className="px-4 py-2 rounded-xl bg-primary disabled:opacity-40 text-surface-0 text-xs font-medium transition-colors cursor-pointer"
                >
                  Salva Modifiche
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* CREATE / EDIT FOLDER MODAL */}
      {(isNewFolderModalOpen || isEditFolderModalOpen) && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-0/80 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-md bg-surface-1 border border-surface-2 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[calc(100dvh-1.5rem)] my-auto overflow-y-auto custom-scrollbar shrink-0">
              <div className="flex items-center justify-between border-b border-surface-2 pb-3">
                <h3 className="font-heading font-semibold text-base text-content-1 flex items-center gap-2">
                  <FolderPlus size={18} className="text-primary" />
                  {isEditFolderModalOpen ? 'Modifica Cartella Mappe' : 'Nuova Cartella Mappe'}
                </h3>
                <button
                  onClick={() => {
                    setIsNewFolderModalOpen(false);
                    setIsEditFolderModalOpen(false);
                  }}
                  className="text-content-3 hover:text-content-1 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-medium text-content-2 mb-1">
                    Nome Cartella / Luogo <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Es: Neverwinter, Costa della Spada, Miniera di Phandelver..."
                    value={folderName}
                    onChange={(e) => setFolderName(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  />
                </div>

                {/* Color Selector */}
                <div>
                  <label className="block font-medium text-content-2 mb-1.5">Colore Distintivo</label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {FOLDER_COLORS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        onClick={() => setFolderColor(c.value)}
                        style={{ backgroundColor: c.value }}
                        className={`w-7 h-7 rounded-lg transition-transform cursor-pointer ${
                          folderColor === c.value
                            ? 'scale-110 ring-2 ring-content-1 ring-offset-2 ring-offset-surface-1'
                            : 'opacity-70 hover:opacity-100 hover:scale-105'
                        }`}
                        title={c.label}
                      />
                    ))}
                    <div className="flex items-center gap-1.5 ml-1">
                      <input
                        type="color"
                        value={folderColor}
                        onChange={(e) => setFolderColor(e.target.value)}
                        className="w-7 h-7 rounded-lg border border-surface-3 cursor-pointer bg-transparent"
                      />
                      <span className="text-[10px] font-mono text-content-3 uppercase">{folderColor}</span>
                    </div>
                  </div>
                </div>

                {/* Link to Codex Place */}
                <div>
                  <label className="block font-medium text-content-2 mb-1">
                    Collega a Luogo del Codex (Relazione Bilaterale)
                  </label>
                  <select
                    value={folderPlaceEntityId}
                    onChange={(e) => {
                      setFolderPlaceEntityId(e.target.value);
                      const ent = placeEntities.find((p) => p._id === e.target.value);
                      if (ent && !folderName) setFolderName(ent.name);
                    }}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  >
                    <option value="">-- Nessun Luogo del Codex --</option>
                    {placeEntities.map((p) => (
                      <option key={p._id} value={p._id}>
                        🏛️ {p.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-content-3 mt-1">
                    Collegando questa cartella a un Luogo, tutte le mappe della cartella saranno consultabili direttamente dalla Scheda del Luogo nel Codex.
                  </p>
                </div>

                <div>
                  <label className="block font-medium text-content-2 mb-1">Descrizione / Note</label>
                  <textarea
                    rows={2}
                    placeholder="Informazioni sul raggruppamento di mappe..."
                    value={folderDesc}
                    onChange={(e) => setFolderDesc(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl p-2.5 text-content-1 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsNewFolderModalOpen(false);
                    setIsEditFolderModalOpen(false);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-content-3 hover:text-content-1 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={isEditFolderModalOpen ? handleSaveEditFolder : handleSaveNewFolder}
                  disabled={!folderName.trim()}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 text-surface-0 text-xs font-medium transition-colors cursor-pointer"
                >
                  {isEditFolderModalOpen ? 'Salva Modifiche' : 'Crea Cartella'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* QUICK MOVE MAP MODAL */}
      {mapToMove && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-0/80 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-sm bg-surface-1 border border-surface-2 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[calc(100dvh-1.5rem)] my-auto overflow-y-auto custom-scrollbar shrink-0">
              <div className="flex items-center justify-between border-b border-surface-2 pb-3">
                <h3 className="font-heading font-semibold text-sm text-content-1 flex items-center gap-2">
                  <MoveRight size={15} className="text-primary" /> Sposta "{mapToMove.title}"
                </h3>
                <button onClick={() => setMapToMove(null)} className="text-content-3 hover:text-content-1 cursor-pointer">
                  <X size={15} />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <p className="text-content-3">Seleziona la cartella di destinazione per questa mappa:</p>
                <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pt-1">
                  <button
                    type="button"
                    onClick={() => handleQuickMoveMapFolder(mapToMove.id, '')}
                    className={`w-full text-left p-2.5 rounded-xl border transition-colors flex items-center justify-between cursor-pointer ${
                      !mapToMove.folderId
                        ? 'bg-primary/10 text-primary border-primary/40 font-semibold'
                        : 'bg-surface-2 hover:bg-surface-3 text-content-2 border-surface-3'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Layers size={13} /> Mappa Principale (Senza Cartella)
                    </span>
                    {!mapToMove.folderId && <CheckCircle2 size={13} />}
                  </button>

                  {normalizedFolders.map((f) => {
                    const isCurrent = String(mapToMove.folderId || '') === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => handleQuickMoveMapFolder(mapToMove.id, f.id)}
                        className={`w-full text-left p-2.5 rounded-xl border transition-colors flex items-center justify-between cursor-pointer ${
                          isCurrent
                            ? 'bg-primary/10 text-primary border-primary/40 font-semibold'
                            : 'bg-surface-2 hover:bg-surface-3 text-content-2 border-surface-3'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <FolderIcon size={13} style={{ color: f.color || '#3B82F6' }} />
                          <span className="truncate">{f.name}</span>
                        </span>
                        {isCurrent && <CheckCircle2 size={13} />}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-surface-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setMapToMove(null)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-content-3 hover:text-content-1 cursor-pointer"
                >
                  Annulla
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* EDIT / CREATE PIN MODAL */}
      {isEditPinModalOpen && (
        <Portal>
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-surface-0/80 backdrop-blur-sm overflow-y-auto">
            <div className="w-full max-w-md bg-surface-1 border border-surface-2 rounded-2xl p-5 shadow-2xl space-y-4 max-h-[calc(100dvh-1.5rem)] my-auto overflow-y-auto custom-scrollbar shrink-0">
              <div className="flex items-center justify-between border-b border-surface-2 pb-3">
                <h3 className="font-heading font-semibold text-base text-content-1 flex items-center gap-2">
                  <MapPinIcon size={16} className="text-primary" /> {editingPinId ? 'Modifica Punto' : 'Nuovo Punto d\'Interesse'}
                </h3>
                <button onClick={() => setIsEditPinModalOpen(false)} className="text-content-3 hover:text-content-1 cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-3.5 text-xs">
                {/* ANCHOR POINT BOX */}
                <div className="bg-surface-2 border border-surface-3 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-content-1 flex items-center gap-1.5 text-xs">
                      <Crosshair size={13} className="text-primary" /> Punto di Ancoraggio Cartografico
                    </span>
                    <button
                      type="button"
                      onClick={handlePickAnchorOnMap}
                      className="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary font-medium text-[11px] transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Compass size={12} /> Scegli sulla mappa
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] text-content-3 mb-1 font-mono">Posizione X (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={pinX}
                        onChange={(e) => setPinX(Number(e.target.value))}
                        className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-content-1 font-mono outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-content-3 mb-1 font-mono">Posizione Y (%)</label>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={pinY}
                        onChange={(e) => setPinY(Number(e.target.value))}
                        className="w-full bg-surface-1 border border-surface-3 focus:border-primary rounded-lg px-2.5 py-1.5 text-content-1 font-mono outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-content-2 mb-1">
                    Nome del Luogo <span className="text-primary">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Es: Castello di Neverwinter..."
                    value={pinTitle}
                    onChange={(e) => setPinTitle(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-content-2 mb-1">Tipologia</label>
                  <select
                    value={pinCategory}
                    onChange={(e) => setPinCategory(e.target.value as any)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  >
                    {Object.entries(PIN_CATEGORIES).map(([catKey, catVal]) => (
                      <option key={catKey} value={catKey}>
                        {catVal.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-content-2 mb-1">Collega a Scheda Luogo (Codex)</label>
                  <select
                    value={pinEntityId}
                    onChange={(e) => {
                      setPinEntityId(e.target.value);
                      const ent = placeEntities.find((p) => p._id === e.target.value);
                      if (ent && !pinTitle) setPinTitle(ent.name);
                    }}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none"
                  >
                    <option value="">-- Nessuna (Solo punto mappa) --</option>
                    {placeEntities.map((ent) => (
                      <option key={ent._id} value={ent._id}>
                        🏛️ {ent.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-content-2 mb-1">Sessione di Scoperta</label>
                    <select
                      value={pinSessionId}
                      onChange={(e) => setPinSessionId(e.target.value)}
                      className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl px-3 py-2 text-content-1 outline-none cursor-pointer"
                    >
                      <option value="">-- Nessuna sessione --</option>
                      {sessions.map((s) => (
                        <option key={s._id} value={s._id}>
                          Sessione #{s.number} - {s.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <LoreDateInput
                      label="Data Lore Scoperta"
                      value={pinLoreDate}
                      onChange={setPinLoreDate}
                      sessionId={pinSessionId}
                      sessions={sessions}
                      placeholder="Es: 31 Kindolin 589 IV era"
                      inputClassName="rounded-xl px-3 py-2 border-surface-3"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-content-2 mb-1">Descrizione o Dicerie</label>
                  <textarea
                    rows={2}
                    placeholder="Informazioni geografiche o appunti..."
                    value={pinDesc}
                    onChange={(e) => setPinDesc(e.target.value)}
                    className="w-full bg-surface-2 border border-surface-3 focus:border-primary rounded-xl p-2.5 text-content-1 outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-surface-2">
                <button
                  type="button"
                  onClick={() => setIsEditPinModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-content-3 hover:text-content-1 cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSavePin}
                  disabled={!pinTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover disabled:opacity-40 text-surface-0 text-xs font-medium transition-colors cursor-pointer"
                >
                  {editingPinId ? 'Salva Modifiche' : 'Salva & Fissa Punto'}
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Confirm Pin Delete */}
      <ConfirmModal
        isOpen={!!pinToDelete}
        title="Elimina Punto d'Interesse"
        message="Sei sicuro di voler rimuovere questo punto dalla mappa?"
        confirmLabel="Elimina"
        onConfirm={confirmDeletePin}
        onCancel={() => setPinToDelete(null)}
      />

      {/* Confirm Map Delete */}
      <ConfirmModal
        isOpen={!!mapToDelete}
        title="Elimina Mappa Cartografica"
        message="Sei sicuro di voler eliminare questa mappa e tutti i suoi punti d'interesse associati?"
        confirmLabel="Elimina"
        onConfirm={confirmDeleteMap}
        onCancel={() => setMapToDelete(null)}
      />

      {/* Confirm Folder Delete */}
      <ConfirmModal
        isOpen={!!folderToDelete}
        title="Elimina Cartella Mappe"
        message="Sei sicuro di voler eliminare questa cartella? Le mappe all'interno rimarranno conservate e verranno spostate alla vista principale."
        confirmLabel="Elimina Cartella"
        onConfirm={confirmDeleteFolder}
        onCancel={() => setFolderToDelete(null)}
      />
    </div>
  );
}
