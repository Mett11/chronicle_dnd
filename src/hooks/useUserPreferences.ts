import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthProvider';
import { UserPreferences } from '../types';
import { UserPreferencesService, DEFAULT_USER_PREFERENCES } from '../lib/userPreferencesService';

export function useUserPreferences() {
  const { account } = useAuth();
  const userId = account?.id || '';

  const [preferences, setPreferences] = useState<UserPreferences>(() =>
    UserPreferencesService.getLocalPreferences(userId)
  );

  useEffect(() => {
    if (!userId) {
      setPreferences(DEFAULT_USER_PREFERENCES);
      return;
    }

    // Set initial
    setPreferences(UserPreferencesService.getLocalPreferences(userId));

    // Subscribe to Firestore changes
    const unsub = UserPreferencesService.subscribeUserPreferences(userId, (updated) => {
      setPreferences(updated);
    });

    // Also listen to local window event
    const handleLocalUpdate = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail?.userId === userId && customEv.detail?.preferences) {
        setPreferences(customEv.detail.preferences);
      }
    };

    window.addEventListener('chronicle_user_preferences_updated', handleLocalUpdate);

    return () => {
      unsub();
      window.removeEventListener('chronicle_user_preferences_updated', handleLocalUpdate);
    };
  }, [userId]);

  const updatePreferences = useCallback(
    async (updates: {
      theme?: Partial<UserPreferences['theme']>;
      ai?: Partial<UserPreferences['ai']>;
      reading?: Partial<UserPreferences['reading']>;
    }) => {
      if (!userId) return;
      const updated = await UserPreferencesService.saveUserPreferences(userId, updates);
      setPreferences(updated);
      return updated;
    },
    [userId]
  );

  return {
    preferences,
    updatePreferences,
  };
}
