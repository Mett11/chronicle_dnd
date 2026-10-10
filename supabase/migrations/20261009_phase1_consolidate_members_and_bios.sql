-- =========================================================================
-- CHRONICLE DND - MIGRATION FASE 1: CONSOLIDAMENTO MEMBERS & CHARACTER BIOS
-- Date: 2026-10-09
-- =========================================================================

-- 1. AGGIORNAMENTO TABELLA public.campaign_members
-- Aggiunge le colonne necessarie per Step 1.2 e Step 1.4 (status, permissions, updated_at)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaign_members') THEN
    ALTER TABLE public.campaign_members ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';
    ALTER TABLE public.campaign_members ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE public.campaign_members ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

    -- Rimuove eventuali check constraint restrittivi sul ruolo (es. solo 'dm' o 'player')
    -- per consentire il nuovo ruolo standardizzato 'co_dm'
    ALTER TABLE public.campaign_members DROP CONSTRAINT IF EXISTS campaign_members_role_check;
    
    -- Normalizza i vecchi ruoli storici nel database al nuovo standard 'co_dm'
    UPDATE public.campaign_members
    SET role = 'co_dm'
    WHERE role IN ('co-dm', 'comaster', 'codm');

    -- Assicura che i membri espulsi o inattivi abbiano lo status corretto se indicato
    UPDATE public.campaign_members
    SET status = 'active'
    WHERE status IS NULL;
  END IF;
END $$;

-- 2. VERIFICA E COMPLETAMENTO COLONNE NATIVE SU public.character_bios (Step 1.3)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'character_bios') THEN
    -- Assicura tutte le colonne native necessarie per la de-duplicazione da extra_data
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS class_level text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS alignment text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS background text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS personality text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS ideals text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS bonds text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS flaws text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS timeline_memories jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS evolving_beliefs jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS inter_party_relations jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS character_race text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS character_title text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS deity_or_patron text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS hometown text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS birth_date_formatted text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS birth_start_day integer DEFAULT 1;
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS birth_month text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS birth_year integer DEFAULT 1492;
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS secrets text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS appearance_description text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS current_status text DEFAULT '';
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS known_lore_bites jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS privacy_settings jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS extra_data jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE public.character_bios ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());
  END IF;
END $$;

-- 3. ONE-OFF BACKFILL STORICO: RECUPERO CAMPI DA extra_data NELLE COLONNE NATIVE DI character_bios
-- Se una colonna nativa è vuota ma il valore è presente in extra_data, lo trasferisce nella colonna nativa
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'character_bios') THEN
    UPDATE public.character_bios
    SET 
      class_level = CASE 
        WHEN COALESCE(class_level, '') = '' AND extra_data ? 'characterClass' THEN extra_data->>'characterClass'
        WHEN COALESCE(class_level, '') = '' AND extra_data ? 'classLevel' THEN extra_data->>'classLevel'
        ELSE class_level 
      END,
      alignment = CASE 
        WHEN COALESCE(alignment, '') = '' AND extra_data ? 'characterAlignment' THEN extra_data->>'characterAlignment'
        ELSE alignment 
      END,
      character_race = CASE 
        WHEN COALESCE(character_race, '') = '' AND extra_data ? 'characterRace' THEN extra_data->>'characterRace'
        ELSE character_race 
      END,
      character_title = CASE 
        WHEN COALESCE(character_title, '') = '' AND extra_data ? 'characterTitle' THEN extra_data->>'characterTitle'
        ELSE character_title 
      END,
      deity_or_patron = CASE 
        WHEN COALESCE(deity_or_patron, '') = '' AND extra_data ? 'deityOrPatron' THEN extra_data->>'deityOrPatron'
        ELSE deity_or_patron 
      END,
      hometown = CASE 
        WHEN COALESCE(hometown, '') = '' AND extra_data ? 'hometown' THEN extra_data->>'hometown'
        ELSE hometown 
      END,
      current_status = CASE 
        WHEN COALESCE(current_status, '') = '' AND extra_data ? 'currentStatus' THEN extra_data->>'currentStatus'
        ELSE current_status 
      END,
      updated_at = NOW()
    WHERE extra_data IS NOT NULL AND extra_data != '{}'::jsonb;
  END IF;
END $$;

-- 4. RICARICA DELLA CACHE SCHEMA POSTGREST
NOTIFY pgrst, 'reload schema';
