import { doc, setDoc, getDoc } from 'firebase/firestore';
import { db, auth } from './firebase';
import { isSupabaseConfigured } from './supabase';
import { UserAccount } from '../types';

/**
 * Service to synchronize user account profile data to /users/{userId} in Firestore.
 * When Supabase is configured, Firebase is used strictly for Auth (Google Sign-In),
 * and Firestore profile sync is bypassed.
 */
export class UserProfileSyncService {
  /**
   * Synchronizes the user account to /users/{uid} in Firestore
   */
  static async syncUserProfile(account: UserAccount, explicitUid?: string): Promise<boolean> {
    if (isSupabaseConfigured()) {
      return true;
    }

    const uid = explicitUid || auth.currentUser?.uid;
    if (!uid) {
      return false;
    }

    try {
      const userDocRef = doc(db, 'users', uid);
      const cleanJoined = Array.from(
        new Set((account.joinedCampaigns || []).map((c) => c.trim().toUpperCase()))
      ).filter(Boolean);

      const cleanDm = Array.from(
        new Set((account.dmCampaigns || []).map((c) => c.trim().toUpperCase()))
      ).filter(Boolean);

      const payload = {
        uid,
        id: account.id,
        email: account.email || auth.currentUser?.email || '',
        characterName: account.characterName || 'Giocatore',
        joinedCampaigns: cleanJoined,
        dmCampaigns: cleanDm,
        avatarUrl: account.avatarUrl || '',
        color: account.color || '#6366f1',
        updatedAt: new Date().toISOString(),
      };

      await setDoc(userDocRef, payload, { merge: true });
      return true;
    } catch (err) {
      console.warn('UserProfileSyncService: Could not sync user profile to Firestore:', err);
      return false;
    }
  }

  /**
   * Fetches user profile data from /users/{uid} in Firestore
   */
  static async getUserProfile(uid?: string): Promise<any | null> {
    if (isSupabaseConfigured()) {
      return null;
    }

    const targetUid = uid || auth.currentUser?.uid;
    if (!targetUid) return null;

    try {
      const userDocRef = doc(db, 'users', targetUid);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        return snap.data();
      }
      return null;
    } catch (err) {
      console.warn('UserProfileSyncService: Could not fetch user profile:', err);
      return null;
    }
  }
}
