-- =========================================================================
-- CHRONICLE DND - SAFE UNIVERSAL REPAIR SCRIPT (DYNAMIC TABLE CHECK)
-- Date: 2026-10-04
-- =========================================================================

-- 1. Ensure required columns on campaigns table if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'campaigns') THEN
    ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS dossier jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS active_players jsonb DEFAULT '[]'::jsonb;
    ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS dm_id text;
    ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS calendar_system jsonb DEFAULT '{}'::jsonb;
    ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS ai_config jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- 2. Concedi permessi completi di lettura/scrittura su tutte le tabelle pubbliche
GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated, anon, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, anon, service_role;

-- 3. Applica policy aperte SOLO alle tabelle effettivamente presenti nel database
DO $$
DECLARE
  t text;
  candidate_tables text[] := ARRAY[
    'campaigns', 'campaign_members', 'sessions', 'entities', 'notes',
    'maps', 'scrapbook', 'scrapbook_items', 'audio_logs', 'character_bios',
    'user_accounts', 'chapters', 'campaign_chapters', 'family_relations', 'world_lore_articles'
  ];
BEGIN
  FOREACH t IN ARRAY candidate_tables LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
      -- Drop existing select/insert/update/delete policies to prevent duplicates or restrictive checks
      EXECUTE format('DROP POLICY IF EXISTS "%s_select" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_insert" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_update" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "%s_delete" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "allow_all_select_%s" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "allow_all_insert_%s" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "allow_all_update_%s" ON public.%I;', t, t);
      EXECUTE format('DROP POLICY IF EXISTS "allow_all_delete_%s" ON public.%I;', t, t);

      -- Create open read and write policies (including DELETE)
      EXECUTE format('CREATE POLICY "allow_all_select_%s" ON public.%I FOR SELECT TO public USING (true);', t, t);
      EXECUTE format('CREATE POLICY "allow_all_insert_%s" ON public.%I FOR INSERT TO public WITH CHECK (true);', t, t);
      EXECUTE format('CREATE POLICY "allow_all_update_%s" ON public.%I FOR UPDATE TO public USING (true) WITH CHECK (true);', t, t);
      EXECUTE format('CREATE POLICY "allow_all_delete_%s" ON public.%I FOR DELETE TO public USING (true);', t, t);
    END IF;
  END LOOP;
END $$;

-- 4. Ricarica la cache dello schema PostgREST
NOTIFY pgrst, 'reload schema';
