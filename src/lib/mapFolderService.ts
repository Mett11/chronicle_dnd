import { MapFolder, WorldMap } from '../types';
import { CampaignManager } from '../store/campaignStore';
import { SupabaseSyncService } from './supabaseSyncService';

/**
 * MapFolderService
 * Central registry service for Map Folders, backed by campaigns.map_folders in Supabase
 * and kept strictly consistent with maps.folder_id (and entities.folder_id).
 */
export class MapFolderService {
  /**
   * Retrieves all map folders for the active campaign.
   */
  static getFolders(_campaignCode?: string): MapFolder[] {
    return CampaignManager.getMapFolders();
  }

  /**
   * Saves and broadcasts updated map folders.
   */
  static async saveFolders(folders: MapFolder[], _campaignCode?: string): Promise<void> {
    CampaignManager.saveMapFolders(folders);
  }

  /**
   * Adds a new map folder.
   */
  static addFolder(data: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    parentId?: string;
  }, _campaignCode?: string): MapFolder {
    return CampaignManager.addMapFolder(data);
  }

  /**
   * Updates an existing map folder.
   */
  static updateFolder(id: string, updates: Partial<MapFolder>, _campaignCode?: string): MapFolder | null {
    return CampaignManager.updateMapFolder(id, updates);
  }

  /**
   * Deletes a folder and safely reassigns all containing maps to root (folder_id: undefined / null)
   * or a designated default target folder without losing any maps.
   */
  static async deleteFolder(
    folderId: string,
    reassignTargetFolderId?: string,
    _campaignCode?: string
  ): Promise<void> {
    // 1. Remove folder from campaign.map_folders registry
    const existingFolders = this.getFolders();
    const updatedFolders = existingFolders.filter((f) => f.id !== folderId);
    this.saveFolders(updatedFolders);

    // 2. Safely reassign any maps referencing folderId
    const maps = CampaignManager.getMaps();
    let mapsModified = false;
    const targetFolderId = reassignTargetFolderId && updatedFolders.some(f => f.id === reassignTargetFolderId)
      ? reassignTargetFolderId
      : undefined;

    const updatedMaps: WorldMap[] = maps.map((map) => {
      if (map.folderId === folderId) {
        mapsModified = true;
        return {
          ...map,
          folderId: targetFolderId,
        };
      }
      return map;
    });

    if (mapsModified) {
      CampaignManager.saveMaps(updatedMaps);
    }

    // 3. Also reassign any place entities referencing this folder
    const entities = CampaignManager.getEntities();
    let entsModified = false;
    const updatedEnts = entities.map((ent) => {
      if (ent.folderId === folderId) {
        entsModified = true;
        return {
          ...ent,
          folderId: targetFolderId,
        };
      }
      return ent;
    });

    if (entsModified) {
      CampaignManager.saveEntities(updatedEnts);
    }
  }

  /**
   * Ensures all maps have valid folder references. If a map references an unknown/deleted folder,
   * it reassigns it to root (undefined).
   */
  static reconcileFolderReferences(_campaignCode?: string): void {
    const folders = this.getFolders();
    const validFolderIds = new Set(folders.map((f) => f.id));

    const maps = CampaignManager.getMaps();
    let modified = false;

    const reconciled = maps.map((m) => {
      if (m.folderId && !validFolderIds.has(m.folderId)) {
        modified = true;
        return { ...m, folderId: undefined };
      }
      return m;
    });

    if (modified) {
      CampaignManager.saveMaps(reconciled);
    }
  }
}
