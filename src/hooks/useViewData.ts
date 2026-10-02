import { useState, useEffect, useCallback, useRef } from 'react';
import { CampaignManager } from '../store/campaignStore';
import { SupabaseSyncService } from '../lib/supabaseSyncService';
import { isSupabaseConfigured } from '../lib/supabase';
import {
  CampaignCalendar,
  Session,
  CampaignChapter,
  Note,
  Entity,
  Category,
  ScrapbookItem,
} from '../types';

/**
 * On-Demand Stale-While-Revalidate Hook for Calendar Page
 * 1. Returns cached/local data immediately (zero blank screen)
 * 2. Fetches fresh calendar & sessions from Supabase in background
 * 3. Updates local cache and UI gracefully
 */
export function useCalendarData() {
  const [calendar, setCalendar] = useState<CampaignCalendar>(() => CampaignManager.getCalendar());
  const [sessions, setSessions] = useState<Session[]>(() => CampaignManager.getSessions());
  const [scrapbook, setScrapbook] = useState<ScrapbookItem[]>(() => CampaignManager.getScrapbookItems());
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    // Only true if local store is completely uninitialized
    const currentCal = CampaignManager.getCalendar();
    return !currentCal || !currentCal.months || currentCal.months.length === 0;
  });

  const activeCode = CampaignManager.getActiveCampaignCode();

  const syncFreshData = useCallback(async () => {
    if (!activeCode || !isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      const fresh = await SupabaseSyncService.fetchCalendarOnly(activeCode);
      if (fresh) {
        if (fresh.calendar && fresh.calendar.months && fresh.calendar.months.length > 0) {
          CampaignManager.saveCalendarLocalOnly(fresh.calendar);
          setCalendar(fresh.calendar);
        }
        if (fresh.sessions && fresh.sessions.length > 0) {
          CampaignManager.saveSessionsLocalOnly(fresh.sessions);
          setSessions(fresh.sessions);
        }
      }
    } catch (err) {
      console.warn('[useCalendarData] Background sync warning:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeCode]);

  const reloadFromStore = useCallback(() => {
    setCalendar(CampaignManager.getCalendar());
    setSessions(CampaignManager.getSessions());
    setScrapbook(CampaignManager.getScrapbookItems());
  }, []);

  useEffect(() => {
    reloadFromStore();
    syncFreshData();

    const handleCalUpdate = () => reloadFromStore();
    window.addEventListener('chronicle_calendar_updated', handleCalUpdate);
    window.addEventListener('chronicle_sessions_updated', handleCalUpdate);
    window.addEventListener('chronicle_scrapbook_updated', handleCalUpdate);
    window.addEventListener('chronicle_data_updated', handleCalUpdate);
    window.addEventListener('chronicle_campaign_changed', handleCalUpdate);

    return () => {
      window.removeEventListener('chronicle_calendar_updated', handleCalUpdate);
      window.removeEventListener('chronicle_sessions_updated', handleCalUpdate);
      window.removeEventListener('chronicle_scrapbook_updated', handleCalUpdate);
      window.removeEventListener('chronicle_data_updated', handleCalUpdate);
      window.removeEventListener('chronicle_campaign_changed', handleCalUpdate);
    };
  }, [reloadFromStore, syncFreshData]);

  return {
    calendar,
    sessions,
    scrapbook,
    isLoading,
    refresh: syncFreshData,
  };
}

/**
 * On-Demand Stale-While-Revalidate Hook for Sessions & Chapters Page
 */
export function useSessionsData() {
  const [sessions, setSessions] = useState<Session[]>(() => CampaignManager.getSessions());
  const [chapters, setChapters] = useState<CampaignChapter[]>(() => CampaignManager.getChapters());
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return CampaignManager.getSessions().length === 0 && CampaignManager.getChapters().length === 0;
  });

  const activeCode = CampaignManager.getActiveCampaignCode();

  const syncFreshData = useCallback(async () => {
    if (!activeCode || !isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      const fresh = await SupabaseSyncService.fetchSessionsOnly(activeCode);
      if (fresh) {
        if (fresh.chapters && fresh.chapters.length > 0) {
          CampaignManager.saveChaptersLocalOnly(fresh.chapters);
          setChapters(fresh.chapters);
        }
        if (fresh.sessions && fresh.sessions.length > 0) {
          CampaignManager.saveSessionsLocalOnly(fresh.sessions);
          setSessions(fresh.sessions);
        }
      }
    } catch (err) {
      console.warn('[useSessionsData] Background sync warning:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeCode]);

  const reloadFromStore = useCallback(() => {
    setSessions(CampaignManager.getSessions());
    setChapters(CampaignManager.getChapters());
  }, []);

  useEffect(() => {
    reloadFromStore();
    syncFreshData();

    const handleUpdate = () => reloadFromStore();
    window.addEventListener('chronicle_sessions_updated', handleUpdate);
    window.addEventListener('chronicle_chapters_updated', handleUpdate);
    window.addEventListener('chronicle_data_updated', handleUpdate);
    window.addEventListener('chronicle_campaign_changed', handleUpdate);

    return () => {
      window.removeEventListener('chronicle_sessions_updated', handleUpdate);
      window.removeEventListener('chronicle_chapters_updated', handleUpdate);
      window.removeEventListener('chronicle_data_updated', handleUpdate);
      window.removeEventListener('chronicle_campaign_changed', handleUpdate);
    };
  }, [reloadFromStore, syncFreshData]);

  return {
    sessions,
    chapters,
    isLoading,
    refresh: syncFreshData,
  };
}

/**
 * On-Demand Stale-While-Revalidate Hook for Notes & Home Page
 */
export function useNotesData() {
  const [notes, setNotes] = useState<Note[]>(() => CampaignManager.getNotes());
  const [categories, setCategories] = useState<Category[]>(() => CampaignManager.getCategories());
  const [sessions, setSessions] = useState<Session[]>(() => CampaignManager.getSessions());
  const [calendar, setCalendar] = useState<CampaignCalendar | null>(() => CampaignManager.getCalendar());
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    return CampaignManager.getNotes().length === 0;
  });

  const activeCode = CampaignManager.getActiveCampaignCode();

  const syncFreshData = useCallback(async () => {
    if (!activeCode || !isSupabaseConfigured()) {
      setIsLoading(false);
      return;
    }

    try {
      const freshNotes = await SupabaseSyncService.fetchNotesOnly(activeCode);
      if (freshNotes && freshNotes.length > 0) {
        CampaignManager.saveNotesLocalOnly(freshNotes);
        setNotes(freshNotes);
      }
    } catch (err) {
      console.warn('[useNotesData] Background sync warning:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeCode]);

  const reloadFromStore = useCallback(() => {
    setNotes(CampaignManager.getNotes());
    setCategories(CampaignManager.getCategories());
    setSessions(CampaignManager.getSessions());
    setCalendar(CampaignManager.getCalendar());
  }, []);

  useEffect(() => {
    reloadFromStore();
    syncFreshData();

    const handleUpdate = () => reloadFromStore();
    window.addEventListener('chronicle_notes_updated', handleUpdate);
    window.addEventListener('chronicle_categories_updated', handleUpdate);
    window.addEventListener('chronicle_sessions_updated', handleUpdate);
    window.addEventListener('chronicle_calendar_updated', handleUpdate);
    window.addEventListener('chronicle_data_updated', handleUpdate);
    window.addEventListener('chronicle_campaign_changed', handleUpdate);

    return () => {
      window.removeEventListener('chronicle_notes_updated', handleUpdate);
      window.removeEventListener('chronicle_categories_updated', handleUpdate);
      window.removeEventListener('chronicle_sessions_updated', handleUpdate);
      window.removeEventListener('chronicle_calendar_updated', handleUpdate);
      window.removeEventListener('chronicle_data_updated', handleUpdate);
      window.removeEventListener('chronicle_campaign_changed', handleUpdate);
    };
  }, [reloadFromStore, syncFreshData]);

  return {
    notes,
    categories,
    sessions,
    calendar,
    isLoading,
    refresh: syncFreshData,
  };
}
