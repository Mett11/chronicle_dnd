import { UserAccount } from '../types';

/**
 * Service to synchronize user account profile data.
 * All persistence is handled by Supabase and local cache.
 */
export class UserProfileSyncService {
  /**
   * Synchronizes user account profile (Supabase handled)
   */
  static async syncUserProfile(_account: UserAccount, _explicitUid?: string): Promise<boolean> {
    return true;
  }

  /**
   * Fetches user profile data
   */
  static async getUserProfile(_uid?: string): Promise<any | null> {
    return null;
  }
}

