import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../components/AuthProvider';
import { CampaignManager } from '../store/campaignStore';
import { ApiKeyManager, ApiKeysConfig, KeySourceMode } from '../lib/apiKeyManager';

export function useAiKeys() {
  const { account } = useAuth();
  const userId = account?.id || '';
  const campaignCode = CampaignManager.getActiveCampaignCode() || '';

  const [keyMode, setKeyModeState] = useState<KeySourceMode>(() => ApiKeyManager.getKeyMode());
  const [personalKeys, setPersonalKeys] = useState<ApiKeysConfig>(() => ApiKeyManager.getPersonalKeys(userId));
  const [campaignKeys, setCampaignKeys] = useState<ApiKeysConfig>(() => ApiKeyManager.getCampaignKeys());

  // Synchronize personal keys immediately when user account changes
  useEffect(() => {
    setPersonalKeys(ApiKeyManager.getPersonalKeys(userId));
  }, [userId]);

  useEffect(() => {
    // 1. Subscribe to personal keys in Firestore
    const unsubPersonal = ApiKeyManager.subscribePersonalKeys(userId, (keys) => {
      setPersonalKeys(keys);
    });

    // 2. Subscribe to campaign keys in Firestore
    const unsubCampaign = ApiKeyManager.subscribeCampaignKeys(campaignCode, (keys) => {
      setCampaignKeys(keys);
    });

    // 3. Listen for local mode/key updates
    const handleModeChange = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        setKeyModeState(customEv.detail);
      }
    };

    const handlePersonalKeysUpdated = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        setPersonalKeys(customEv.detail);
      }
    };

    const handleCampaignKeysUpdated = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        setCampaignKeys(customEv.detail);
      }
    };

    const handlePreload = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail) {
        if (customEv.detail.campaign) setCampaignKeys(customEv.detail.campaign);
        if (customEv.detail.personal) setPersonalKeys(customEv.detail.personal);
      }
    };

    window.addEventListener('chronicle_key_mode_changed', handleModeChange);
    window.addEventListener('chronicle_api_keys_updated', handlePersonalKeysUpdated);
    window.addEventListener('chronicle_campaign_keys_updated', handleCampaignKeysUpdated);
    window.addEventListener('chronicle_keys_preloaded', handlePreload);

    return () => {
      unsubPersonal();
      unsubCampaign();
      window.removeEventListener('chronicle_key_mode_changed', handleModeChange);
      window.removeEventListener('chronicle_api_keys_updated', handlePersonalKeysUpdated);
      window.removeEventListener('chronicle_campaign_keys_updated', handleCampaignKeysUpdated);
      window.removeEventListener('chronicle_keys_preloaded', handlePreload);
    };
  }, [userId, campaignCode]);

  const setKeyMode = useCallback((mode: KeySourceMode) => {
    ApiKeyManager.setKeyMode(mode);
    setKeyModeState(mode);
  }, []);

  const savePersonalKeys = useCallback(
    async (updates: Partial<ApiKeysConfig>) => {
      const result = await ApiKeyManager.savePersonalKeys(userId, updates);
      setPersonalKeys(result);
      return result;
    },
    [userId]
  );

  const saveCampaignKeys = useCallback(
    async (updates: Partial<ApiKeysConfig>) => {
      const updatedBy = account?.characterName || account?.email || 'Party Member';
      const result = await ApiKeyManager.saveCampaignKeys(campaignCode, updates, updatedBy);
      setCampaignKeys(result);
      return result;
    },
    [campaignCode, account?.characterName, account?.email]
  );

  // Derive active keys based on current mode with useMemo for stable reference
  const activeKeys = useMemo<ApiKeysConfig>(() => {
    if (keyMode === 'campaign') {
      return {
        geminiKey: campaignKeys.geminiKey || personalKeys.geminiKey || '',
        openrouterKey: campaignKeys.openrouterKey || personalKeys.openrouterKey || '',
        groqApiKey: campaignKeys.groqApiKey || personalKeys.groqApiKey || '',
        cloudflareAccountId: campaignKeys.cloudflareAccountId || personalKeys.cloudflareAccountId || '',
        cloudflareApiToken: campaignKeys.cloudflareApiToken || personalKeys.cloudflareApiToken || '',
      };
    }
    return {
      geminiKey: personalKeys.geminiKey || campaignKeys.geminiKey || '',
      openrouterKey: personalKeys.openrouterKey || campaignKeys.openrouterKey || '',
      groqApiKey: personalKeys.groqApiKey || campaignKeys.groqApiKey || '',
      cloudflareAccountId: personalKeys.cloudflareAccountId || campaignKeys.cloudflareAccountId || '',
      cloudflareApiToken: personalKeys.cloudflareApiToken || campaignKeys.cloudflareApiToken || '',
    };
  }, [keyMode, campaignKeys, personalKeys]);

  return {
    keyMode,
    setKeyMode,
    activeKeys,
    personalKeys,
    campaignKeys,
    savePersonalKeys,
    saveCampaignKeys,
    maskApiKey: ApiKeyManager.maskApiKey,
  };
}
