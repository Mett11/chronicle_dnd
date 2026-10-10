-- =========================================================================
-- CHRONICLE DND - MIGRATION PUNTI 3, 4 E 5: CONSOLIDAMENTO UNICHE FONTI DATI
-- Date: 2026-10-10
-- =========================================================================

-- PUNTO 3: campaign_members come UNICA fonte dei partecipanti della campagna
-- Depreca active_players in campaigns e assicura indici e integrità su campaign_members

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaign_members') THEN
    CREATE INDEX IF NOT EXISTS idx_campaign_members_user_camp ON public.campaign_members(campaign_code, user_id);
    CREATE INDEX IF NOT EXISTS idx_campaign_members_status ON public.campaign_members(status);
  END IF;
END $$;

-- Svuota il vecchio campo ridondante active_players nella tabella campaigns
UPDATE public.campaigns SET active_players = '[]'::jsonb WHERE active_players IS NOT NULL;


-- PUNTO 4: character_bios come UNICA fonte dei dati del personaggio giocante (PG)
-- Assicura che la tabella character_bios contenga tutte le colonne necessarie e gli indici

CREATE TABLE IF NOT EXISTS public.character_bios (
  player_id text NOT NULL,
  campaign_code text,
  name text,
  character_name text,
  avatar_url text,
  color text DEFAULT '#6366f1'::text,
  class_level text DEFAULT ''::text,
  alignment text DEFAULT ''::text,
  background text DEFAULT ''::text,
  personality text DEFAULT ''::text,
  ideals text DEFAULT ''::text,
  bonds text DEFAULT ''::text,
  flaws text DEFAULT ''::text,
  secrets text DEFAULT ''::text,
  character_race text DEFAULT ''::text,
  character_title text DEFAULT ''::text,
  deity_or_patron text DEFAULT ''::text,
  hometown text DEFAULT ''::text,
  birth_date_formatted text DEFAULT ''::text,
  birth_start_day integer DEFAULT 1,
  birth_month text DEFAULT ''::text,
  birth_year integer DEFAULT 1492,
  appearance_description text DEFAULT ''::text,
  current_status text DEFAULT ''::text,
  timeline_memories jsonb DEFAULT '[]'::jsonb,
  evolving_beliefs jsonb DEFAULT '[]'::jsonb,
  inter_party_relations jsonb DEFAULT '{}'::jsonb,
  known_lore_bites jsonb DEFAULT '[]'::jsonb,
  privacy_settings jsonb DEFAULT '{"isBioPublic": true, "isStatsPublic": true, "isBackgroundPublic": false, "isSecretsPublic": false}'::jsonb,
  extra_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT character_bios_pkey PRIMARY KEY (player_id)
);

CREATE INDEX IF NOT EXISTS idx_character_bios_camp_player ON public.character_bios(campaign_code, player_id);


-- PUNTO 5: user_preferences come UNICA fonte delle preferenze utente
-- Tabella dedicata per la sincronizzazione cloud multi-dispositivo delle preferenze utente

CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id text NOT NULL,
  preferences jsonb DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT user_preferences_pkey PRIMARY KEY (user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_preferences_updated ON public.user_preferences(updated_at);


-- RLS POLICIES & PERMESSI (Aggiunte policy aperte per consentire lettura/scrittura con RLS attivo)
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;

DO $$
DECLARE
  t text;
  candidate_tables text[] := ARRAY[
    'campaigns', 'campaign_members', 'sessions', 'entities', 'notes',
    'maps', 'scrapbook', 'scrapbook_items', 'audio_logs', 'character_bios',
    'user_accounts', 'chapters', 'family_relations', 'world_lore_articles', 'user_preferences'
  ];
BEGIN
  FOREACH t IN ARRAY candidate_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);

      EXECUTE format('DROP POLICY IF EXISTS "allow_all_select_%s" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "allow_all_insert_%s" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "allow_all_update_%s" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "allow_all_delete_%s" ON public.%I;', t, t);

      EXECUTE format('CREATE POLICY "allow_all_select_%s" ON public.%I FOR SELECT TO public USING (true);', t, t);
      EXECUTE format('CREATE POLICY "allow_all_insert_%s" ON public.%I FOR INSERT TO public WITH CHECK (true);', t, t);
      EXECUTE format('CREATE POLICY "allow_all_update_%s" ON public.%I FOR UPDATE TO public USING (true) WITH CHECK (true);', t, t);
      EXECUTE format('CREATE POLICY "allow_all_delete_%s" ON public.%I FOR DELETE TO public USING (true);', t, t);
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';

