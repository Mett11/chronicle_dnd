-- =========================================================================
-- CHRONICLE DND - MIGRATION PUNTI 1 E 2: ON DELETE CASCADE & FK SECONDARIE
-- Date: 2026-10-10
-- =========================================================================

-- PUNTO 1: Definire ON DELETE CASCADE sulle chiavi esterne campaign_code per tutte le tabelle dipendenti

-- 1.1 campaign_members
ALTER TABLE IF EXISTS public.campaign_members
  DROP CONSTRAINT IF EXISTS campaign_members_campaign_code_fkey,
  ADD CONSTRAINT campaign_members_campaign_code_fkey
    FOREIGN KEY (campaign_code)
    REFERENCES public.campaigns(code)
    ON DELETE CASCADE;

-- 1.2 chapters
ALTER TABLE IF EXISTS public.chapters
  DROP CONSTRAINT IF EXISTS chapters_campaign_code_fkey,
  ADD CONSTRAINT chapters_campaign_code_fkey
    FOREIGN KEY (campaign_code)
    REFERENCES public.campaigns(code)
    ON DELETE CASCADE;

-- 1.3 sessions
ALTER TABLE IF EXISTS public.sessions
  DROP CONSTRAINT IF EXISTS sessions_campaign_code_fkey,
  ADD CONSTRAINT sessions_campaign_code_fkey
    FOREIGN KEY (campaign_code)
    REFERENCES public.campaigns(code)
    ON DELETE CASCADE;

-- 1.4 entities
ALTER TABLE IF EXISTS public.entities
  DROP CONSTRAINT IF EXISTS entities_campaign_code_fkey,
  ADD CONSTRAINT entities_campaign_code_fkey
    FOREIGN KEY (campaign_code)
    REFERENCES public.campaigns(code)
    ON DELETE CASCADE;

-- 1.5 notes
ALTER TABLE IF EXISTS public.notes
  DROP CONSTRAINT IF EXISTS notes_campaign_code_fkey,
  ADD CONSTRAINT notes_campaign_code_fkey
    FOREIGN KEY (campaign_code)
    REFERENCES public.campaigns(code)
    ON DELETE CASCADE;

-- 1.6 world_lore_articles
ALTER TABLE IF EXISTS public.world_lore_articles
  DROP CONSTRAINT IF EXISTS world_lore_articles_campaign_code_fkey,
  ADD CONSTRAINT world_lore_articles_campaign_code_fkey
    FOREIGN KEY (campaign_code)
    REFERENCES public.campaigns(code)
    ON DELETE CASCADE;

-- 1.7 audio_logs
ALTER TABLE IF EXISTS public.audio_logs
  DROP CONSTRAINT IF EXISTS audio_logs_campaign_code_fkey,
  ADD CONSTRAINT audio_logs_campaign_code_fkey
    FOREIGN KEY (campaign_code)
    REFERENCES public.campaigns(code)
    ON DELETE CASCADE;


-- PUNTO 2: Aggiungere FK secondarie con ON DELETE SET NULL

-- 2.1 sessions.chapter_id -> chapters.id (ON DELETE SET NULL)
ALTER TABLE IF EXISTS public.sessions
  DROP CONSTRAINT IF EXISTS sessions_chapter_id_fkey,
  ADD CONSTRAINT sessions_chapter_id_fkey
    FOREIGN KEY (chapter_id)
    REFERENCES public.chapters(id)
    ON DELETE SET NULL;

-- 2.2 notes.session_id -> sessions.id (ON DELETE SET NULL)
ALTER TABLE IF EXISTS public.notes
  DROP CONSTRAINT IF EXISTS notes_session_id_fkey,
  ADD CONSTRAINT notes_session_id_fkey
    FOREIGN KEY (session_id)
    REFERENCES public.sessions(id)
    ON DELETE SET NULL;
