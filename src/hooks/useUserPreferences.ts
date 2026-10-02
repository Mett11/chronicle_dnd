import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../components/AuthProvider';
import { UserPreferences } from '../types';
import { UserPreferencesService, DEFAULT_USER_PREFERENCES } from '../lib/userPreferencesService';

// Module-level cache for active user preferences to share across all hook consumers
let cachedUserId = '';
let cachedPreferences: UserPreferences = DEFAULT_USER_PREFERENCES;
const listeners = new Set<(prefs: UserPreferences) => void>();

function notifyAll(prefs: UserPreferences) {
  cachedPreferences = prefs;
  listeners.forEach((fn) => fn(prefs));
}

export function useUserPreferences() {
  const { account } = useAuth();
  const userId = account?.id || '';

  const [preferences, setPreferences] = useState<UserPreferences>(() => {
    if (!userId) return DEFAULT_USER_PREFERENCES;
    if (cachedUserId === userId) return cachedPreferences;
    const initial = UserPreferencesService.getLocalPreferences(userId);
    cachedUserId = userId;
    cachedPreferences = initial;
    return initial;
  });

  useEffect(() => {
    if (!userId) {
      setPreferences(DEFAULT_USER_PREFERENCES);
      return;
    }

    if (cachedUserId !== userId) {
      cachedUserId = userId;
      cachedPreferences = UserPreferencesService.getLocalPreferences(userId);
    }
    setPreferences(cachedPreferences);

    const listener = (updated: UserPreferences) => {
      setPreferences(updated);
    };
    listeners.add(listener);

    const unsubService = UserPreferencesService.subscribeUserPreferences(userId, (updated) => {
      notifyAll(updated);
    });

    return () => {
      listeners.delete(listener);
      unsubService();
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
      notifyAll(updated);
      return updated;
    },
    [userId]
  );

  return {
    preferences,
    updatePreferences,
  };
}

