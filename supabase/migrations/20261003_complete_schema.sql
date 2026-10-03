-- =========================================================================
-- CHRONICLE DND - COMPLETE SUPABASE SCHEMA & RLS MIGRATION
-- Applies to: Supabase PostgreSQL with Firebase Auth JWT integration
-- Date: 2026-10-03
-- =========================================================================

-- Enable uuid extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- 1. BASE TABLES DEFINITION (CREATE IF NOT EXISTS)
-- =========================================================================

-- 1. CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS public.campaigns (
    code text PRIMARY KEY,
    id text,
    title text NOT NULL,
    subtitle text,
    description text,
    system text DEFAULT 'D&D 5e',
    dm_id text,
    calendar_system jsonb DEFAULT '{}'::jsonb,
    ai_config jsonb DEFAULT '{}'::jsonb,
    active_players jsonb DEFAULT '[]'::jsonb,
    dossier jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Ensure all columns exist on existing installations
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS id text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS subtitle text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS system text DEFAULT 'D&D 5e';
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS dm_id text;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS calendar_system jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS ai_config jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS active_players jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS dossier jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS created_at timestamp with time zone DEFAULT timezone('utc'::text, now());
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT timezone('utc'::text, now());

-- 2. CAMPAIGN MEMBERS TABLE (RBAC / Membership)
CREATE TABLE IF NOT EXISTS public.campaign_members (
    id text PRIMARY KEY,
    campaign_code text NOT NULL REFERENCES public.campaigns(code) ON DELETE CASCADE,
    user_id text NOT NULL,
    role text NOT NULL DEFAULT 'player', -- 'dm' or 'player'
    character_name text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(campaign_code, user_id)
);
CREATE INDEX IF NOT EXISTS idx_campaign_members_lookup ON public.campaign_members(campaign_code, user_id);

-- 3. CHAPTERS TABLE
CREATE TABLE IF NOT EXISTS public.chapters (
    id text PRIMARY KEY,
    campaign_code text NOT NULL REFERENCES public.campaigns(code) ON DELETE CASCADE,
    number integer DEFAULT 1,
    title text NOT NULL,
    synopsis text DEFAULT '',
    status text DEFAULT 'in_progress',
    order_index integer DEFAULT 0,
    cover_image_url text,
    color text DEFAULT '#6366f1',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS number integer DEFAULT 1;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS synopsis text DEFAULT '';
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS status text DEFAULT 'in_progress';
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE public.chapters ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1';
CREATE INDEX IF NOT EXISTS idx_chapters_campaign_code ON public.chapters(campaign_code);

-- 4. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.sessions (
    id text PRIMARY KEY,
    campaign_code text NOT NULL REFERENCES public.campaigns(code) ON DELETE CASCADE,
    number integer DEFAULT 1,
    title text NOT NULL,
    date_str text NOT NULL,
    chapter_id text,
    calendar_date text,
    plot_events jsonb DEFAULT '[]'::jsonb,
    recap jsonb DEFAULT '[]'::jsonb,
    summary text DEFAULT '',
    images jsonb DEFAULT '[]'::jsonb,
    cover_image_url text,
    audio_url text,
    session_type text DEFAULT 'mixed',
    quotes jsonb DEFAULT '[]'::jsonb,
    audio_logs jsonb DEFAULT '[]'::jsonb,
    excluded_player_ids jsonb DEFAULT '[]'::jsonb,
    attendees jsonb DEFAULT '[]'::jsonb,
    tags jsonb DEFAULT '[]'::jsonb,
    entities_extracted boolean DEFAULT false,
    entities_extracted_at timestamp with time zone,
    memory_synced boolean DEFAULT false,
    memory_synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS chapter_id text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS calendar_date text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS plot_events jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS recap jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS summary text DEFAULT '';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS cover_image_url text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS audio_url text;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS session_type text DEFAULT 'mixed';
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS quotes jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS audio_logs jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS excluded_player_ids jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS attendees jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS entities_extracted boolean DEFAULT false;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS entities_extracted_at timestamp with time zone;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS memory_synced boolean DEFAULT false;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS memory_synced_at timestamp with time zone;
CREATE INDEX IF NOT EXISTS idx_sessions_campaign_code ON public.sessions(campaign_code);
CREATE INDEX IF NOT EXISTS idx_sessions_number ON public.sessions(number);

-- 5. ENTITIES (CODEX) TABLE
CREATE TABLE IF NOT EXISTS public.entities (
    id text PRIMARY KEY,
    campaign_code text NOT NULL REFERENCES public.campaigns(code) ON DELETE CASCADE,
    name text NOT NULL,
    type text DEFAULT 'npc',
    description text DEFAULT '',
    image_url text,
    status text DEFAULT 'alive',
    attributes jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS type text DEFAULT 'npc';
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS status text DEFAULT 'alive';
ALTER TABLE public.entities ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS idx_entities_campaign_code ON public.entities(campaign_code);
CREATE INDEX IF NOT EXISTS idx_entities_type ON public.entities(type);

-- 6. NOTES TABLE
CREATE TABLE IF NOT EXISTS public.notes (
    id text PRIMARY KEY,
    campaign_code text NOT NULL REFERENCES public.campaigns(code) ON DELETE CASCADE,
    title text NOT NULL,
    content text DEFAULT '',
    category text,
    session_id text,
    lore_date text,
    visibility text DEFAULT 'group',
    is_dm_only boolean DEFAULT false,
    is_pinned boolean DEFAULT false,
    canon_state text DEFAULT 'canon',
    author_id text DEFAULT 'unknown',
    author_name text DEFAULT 'Giocatore',
    author_is_dm boolean DEFAULT false,
    ask_dm boolean DEFAULT false,
    dm_reply text,
    tags jsonb DEFAULT '[]'::jsonb,
    images jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS lore_date text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS visibility text DEFAULT 'group';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS is_dm_only boolean DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS is_pinned boolean DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS canon_state text DEFAULT 'canon';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS author_id text DEFAULT 'unknown';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS author_name text DEFAULT 'Giocatore';
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS author_is_dm boolean DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS ask_dm boolean DEFAULT false;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS dm_reply text;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS images jsonb DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS idx_notes_campaign_code ON public.notes(campaign_code);

-- 7. MAPS TABLE
CREATE TABLE IF NOT EXISTS public.maps (
    id text PRIMARY KEY,
    campaign_code text NOT NULL REFERENCES public.campaigns(code) ON DELETE CASCADE,
    title text NOT NULL,
    description text DEFAULT '',
    image_url text NOT NULL,
    scale_label text DEFAULT '',
    entity_id text,
    folder_id text,
    pins jsonb DEFAULT '[]'::jsonb,
    fog_of_war jsonb DEFAULT '{}'::jsonb,
    is_default boolean DEFAULT false,
    is_secret boolean DEFAULT false,
    shared_with_dm boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS description text DEFAULT '';
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS scale_label text DEFAULT '';
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS entity_id text;
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS folder_id text;
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS pins jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS fog_of_war jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS is_default boolean DEFAULT false;
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS is_secret boolean DEFAULT false;
ALTER TABLE public.maps ADD COLUMN IF NOT EXISTS shared_with_dm boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_maps_campaign_code ON public.maps(campaign_code);

-- 8. SCRAPBOOK TABLE
CREATE TABLE IF NOT EXISTS public.scrapbook (
    id text PRIMARY KEY,
    campaign_code text NOT NULL REFERENCES public.campaigns(code) ON DELETE CASCADE,
    title text NOT NULL,
    caption text DEFAULT '',
    image_url text NOT NULL,
    created_by text DEFAULT '',
    category text DEFAULT 'moment',
    aspect_ratio text DEFAULT 'square',
    tags jsonb DEFAULT '[]'::jsonb,
    session_id text,
    entity_id text,
    lore_date text,
    is_secret boolean DEFAULT false,
    shared_with_dm boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.scrapbook ADD COLUMN IF NOT EXISTS created_by text DEFAULT '';
ALTER TABLE public.scrapbook ADD COLUMN IF NOT EXISTS category text DEFAULT 'moment';
ALTER TABLE public.scrapbook ADD COLUMN IF NOT EXISTS aspect_ratio text DEFAULT 'square';
ALTER TABLE public.scrapbook ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.scrapbook ADD COLUMN IF NOT EXISTS session_id text;
ALTER TABLE public.scrapbook ADD COLUMN IF NOT EXISTS entity_id text;
ALTER TABLE public.scrapbook ADD COLUMN IF NOT EXISTS lore_date text;
ALTER TABLE public.scrapbook ADD COLUMN IF NOT EXISTS is_secret boolean DEFAULT false;
ALTER TABLE public.scrapbook ADD COLUMN IF NOT EXISTS shared_with_dm boolean DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_scrapbook_campaign_code ON public.scrapbook(campaign_code);

-- 9. AUDIO LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audio_logs (
    id text PRIMARY KEY,
    campaign_code text NOT NULL REFERENCES public.campaigns(code) ON DELETE CASCADE,
    title text NOT NULL,
    audio_url text NOT NULL,
    duration integer DEFAULT 0,
    recorded_by text DEFAULT '',
    lore_date text,
    associated_type text,
    associated_id text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.audio_logs ADD COLUMN IF NOT EXISTS duration integer DEFAULT 0;
ALTER TABLE public.audio_logs ADD COLUMN IF NOT EXISTS recorded_by text DEFAULT '';
ALTER TABLE public.audio_logs ADD COLUMN IF NOT EXISTS lore_date text;
ALTER TABLE public.audio_logs ADD COLUMN IF NOT EXISTS associated_type text;
ALTER TABLE public.audio_logs ADD COLUMN IF NOT EXISTS associated_id text;
CREATE INDEX IF NOT EXISTS idx_audio_logs_campaign_code ON public.audio_logs(campaign_code);

-- 10. CHARACTER BIOS TABLE (CAMPAIGN + PLAYER COMPOSITE KEY)
CREATE TABLE IF NOT EXISTS public.character_bios (
    campaign_code text NOT NULL REFERENCES public.campaigns(code) ON DELETE CASCADE,
    player_id text NOT NULL,
    name text DEFAULT '',
    avatar_url text DEFAULT '',
    color text DEFAULT '#6366f1',
    class_level text DEFAULT '',
    alignment text DEFAULT '',
    background text DEFAULT '',
    personality text DEFAULT '',
    ideals text DEFAULT '',
    bonds text DEFAULT '',
    flaws text DEFAULT '',
    timeline_memories jsonb DEFAULT '[]'::jsonb,
    evolving_beliefs jsonb DEFAULT '[]'::jsonb,
    inter_party_relations jsonb DEFAULT '{}'::jsonb,
    character_race text DEFAULT '',
    character_title text DEFAULT '',
    deity_or_patron text DEFAULT '',
    hometown text DEFAULT '',
    birth_date_formatted text DEFAULT '',
    birth_start_day integer DEFAULT 1,
    birth_month text DEFAULT '',
    birth_year integer DEFAULT 1492,
    secrets text DEFAULT '',
    appearance_description text DEFAULT '',
    current_status text DEFAULT '',
    known_lore_bites jsonb DEFAULT '[]'::jsonb,
    privacy_settings jsonb DEFAULT '{}'::jsonb,
    extra_data jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (campaign_code, player_id)
);

-- Upgrade existing character_bios table if it had only player_id as primary key
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.character_bios'::regclass
          AND contype = 'p'
          AND conname = 'character_bios_pkey'
    ) THEN
        -- If player_id alone was the PK, recreate constraint as composite (campaign_code, player_id)
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a
            JOIN pg_constraint c ON c.conrelid = a.attrelid AND a.attnum = ANY(c.conkey)
            WHERE c.conrelid = 'public.character_bios'::regclass
              AND c.contype = 'p'
              AND a.attname = 'campaign_code'
        ) THEN
            ALTER TABLE public.character_bios DROP CONSTRAINT character_bios_pkey;
            ALTER TABLE public.character_bios ADD PRIMARY KEY (campaign_code, player_id);
        END IF;
    END IF;
EXCEPTION WHEN OTHERS THEN
    NULL;
END $$;

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
CREATE INDEX IF NOT EXISTS idx_character_bios_campaign_code ON public.character_bios(campaign_code);

-- 11. FAMILY RELATIONS TABLE
CREATE TABLE IF NOT EXISTS public.family_relations (
    id text PRIMARY KEY,
    campaign_code text NOT NULL REFERENCES public.campaigns(code) ON DELETE CASCADE,
    source_entity_id text NOT NULL,
    target_entity_id text,
    relationship_type text DEFAULT 'family',
    description text DEFAULT '',
    is_secret boolean DEFAULT false,
    name text DEFAULT '',
    avatar_url text DEFAULT '',
    custom_relationship_label text DEFAULT '',
    title_or_role text DEFAULT '',
    generation_category text DEFAULT 'same_generation',
    genealogy_role text DEFAULT '',
    side_of_family text DEFAULT 'unspecified',
    status text DEFAULT 'alive',
    second_parent_id text,
    other_parent_name text DEFAULT '',
    linked_player_id text,
    tags jsonb DEFAULT '[]'::jsonb,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_family_relations_campaign_code ON public.family_relations(campaign_code);
CREATE INDEX IF NOT EXISTS idx_family_relations_source_entity ON public.family_relations(source_entity_id);

-- 12. WORLD LORE ARTICLES TABLE
CREATE TABLE IF NOT EXISTS public.world_lore_articles (
    id text PRIMARY KEY,
    campaign_code text NOT NULL REFERENCES public.campaigns(code) ON DELETE CASCADE,
    title text NOT NULL,
    subtitle text DEFAULT '',
    summary text DEFAULT '',
    content text DEFAULT '',
    category_id text DEFAULT 'general',
    images jsonb DEFAULT '[]'::jsonb,
    is_draft boolean DEFAULT false,
    bites jsonb DEFAULT '[]'::jsonb,
    author_player_id text DEFAULT '',
    author_name text DEFAULT '',
    tags jsonb DEFAULT '[]'::jsonb,
    related_entity_ids jsonb DEFAULT '[]'::jsonb,
    order_index integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_world_lore_campaign_code ON public.world_lore_articles(campaign_code);

-- 13. USER ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.user_accounts (
    id text PRIMARY KEY,
    email text UNIQUE NOT NULL,
    password text DEFAULT '',
    character_name text DEFAULT 'Avventuriero',
    is_dm boolean DEFAULT false,
    dm_campaigns jsonb DEFAULT '[]'::jsonb,
    joined_campaigns jsonb DEFAULT '[]'::jsonb,
    color text DEFAULT '#6366f1',
    avatar_url text DEFAULT '',
    campaign_profiles jsonb DEFAULT '{}'::jsonb,
    preferences jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS password text DEFAULT '';
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS character_name text DEFAULT 'Avventuriero';
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS is_dm boolean DEFAULT false;
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS dm_campaigns jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS joined_campaigns jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS color text DEFAULT '#6366f1';
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS avatar_url text DEFAULT '';
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS campaign_profiles jsonb DEFAULT '{}'::jsonb;
ALTER TABLE public.user_accounts ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb;

-- 14. USER PREFERENCES TABLE
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id text PRIMARY KEY,
    theme jsonb DEFAULT '{}'::jsonb,
    ai jsonb DEFAULT '{}'::jsonb,
    reading jsonb DEFAULT '{}'::jsonb,
    notifications jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 15. ORACLE CHATS TABLE
CREATE TABLE IF NOT EXISTS public.oracle_chats (
    id text PRIMARY KEY,
    campaign_code text NOT NULL REFERENCES public.campaigns(code) ON DELETE CASCADE,
    user_id text NOT NULL,
    messages jsonb DEFAULT '[]'::jsonb,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oracle_chats_lookup ON public.oracle_chats(campaign_code, user_id);

-- =========================================================================
-- 2. HELPER FUNCTIONS FOR FIREBASE AUTH & MEMBERSHIP CHECK
-- =========================================================================

-- Extracts the verified User UID from Firebase Auth JWT claims or Supabase Auth context
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'user_id'),
    auth.uid()::text
  );
$$;

-- Returns true if the requesting user is the DM of the campaign
CREATE OR REPLACE FUNCTION public.is_campaign_dm(target_campaign_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.code = target_campaign_code
      AND c.dm_id = public.requesting_user_id()
  ) OR EXISTS (
    SELECT 1 FROM public.campaign_members m
    WHERE m.campaign_code = target_campaign_code
      AND m.user_id = public.requesting_user_id()
      AND m.role = 'dm'
  );
$$;

-- Returns true if the requesting user is an active member or DM of the campaign
CREATE OR REPLACE FUNCTION public.is_campaign_member(target_campaign_code text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.code = target_campaign_code
      AND (
        c.dm_id = public.requesting_user_id()
        OR c.active_players @> jsonb_build_array(jsonb_build_object('id', public.requesting_user_id()))
      )
  ) OR EXISTS (
    SELECT 1 FROM public.campaign_members m
    WHERE m.campaign_code = target_campaign_code
      AND m.user_id = public.requesting_user_id()
  );
$$;

-- =========================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scrapbook ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.character_bios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_relations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.world_lore_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_chats ENABLE ROW LEVEL SECURITY;

-- Drop all legacy open policies
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'campaigns', 'campaign_members', 'chapters', 'sessions', 'entities', 'notes',
        'maps', 'scrapbook', 'audio_logs', 'character_bios',
        'family_relations', 'world_lore_articles', 'user_accounts', 'user_preferences', 'oracle_chats'
    )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public access to %I" ON public.%I;', tbl, tbl);
        EXECUTE format('DROP POLICY IF EXISTS "allow_all_%I" ON public.%I;', tbl, tbl);
    END LOOP;
END $$;

-- --- 3.1 CAMPAIGNS POLICIES ---
DROP POLICY IF EXISTS "campaigns_select" ON public.campaigns;
CREATE POLICY "campaigns_select" ON public.campaigns
    FOR SELECT USING (
        public.requesting_user_id() IS NOT NULL
        AND (
            dm_id = public.requesting_user_id()
            OR public.is_campaign_member(code)
            -- Allow lookup of campaign metadata when joining via code
            OR NOT (active_players @> jsonb_build_array(jsonb_build_object('id', public.requesting_user_id(), 'expelled', true)))
        )
    );

DROP POLICY IF EXISTS "campaigns_insert" ON public.campaigns;
CREATE POLICY "campaigns_insert" ON public.campaigns
    FOR INSERT WITH CHECK (
        public.requesting_user_id() IS NOT NULL
        AND (dm_id = public.requesting_user_id() OR dm_id IS NULL OR dm_id = '')
    );

DROP POLICY IF EXISTS "campaigns_update" ON public.campaigns;
CREATE POLICY "campaigns_update" ON public.campaigns
    FOR UPDATE USING (
        public.is_campaign_dm(code) OR dm_id = public.requesting_user_id()
    ) WITH CHECK (
        public.is_campaign_dm(code) OR dm_id = public.requesting_user_id()
    );

DROP POLICY IF EXISTS "campaigns_delete" ON public.campaigns;
CREATE POLICY "campaigns_delete" ON public.campaigns
    FOR DELETE USING (
        public.is_campaign_dm(code) OR dm_id = public.requesting_user_id()
    );

-- --- 3.2 CHAPTERS POLICIES ---
DROP POLICY IF EXISTS "chapters_select" ON public.chapters;
CREATE POLICY "chapters_select" ON public.chapters
    FOR SELECT USING (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "chapters_insert" ON public.chapters;
CREATE POLICY "chapters_insert" ON public.chapters
    FOR INSERT WITH CHECK (public.is_campaign_dm(campaign_code));

DROP POLICY IF EXISTS "chapters_update" ON public.chapters;
CREATE POLICY "chapters_update" ON public.chapters
    FOR UPDATE USING (public.is_campaign_dm(campaign_code))
    WITH CHECK (public.is_campaign_dm(campaign_code));

DROP POLICY IF EXISTS "chapters_delete" ON public.chapters;
CREATE POLICY "chapters_delete" ON public.chapters
    FOR DELETE USING (public.is_campaign_dm(campaign_code));

-- --- 3.3 SESSIONS POLICIES ---
DROP POLICY IF EXISTS "sessions_select" ON public.sessions;
CREATE POLICY "sessions_select" ON public.sessions
    FOR SELECT USING (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "sessions_insert" ON public.sessions;
CREATE POLICY "sessions_insert" ON public.sessions
    FOR INSERT WITH CHECK (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "sessions_update" ON public.sessions;
CREATE POLICY "sessions_update" ON public.sessions
    FOR UPDATE USING (public.is_campaign_member(campaign_code))
    WITH CHECK (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "sessions_delete" ON public.sessions;
CREATE POLICY "sessions_delete" ON public.sessions
    FOR DELETE USING (public.is_campaign_dm(campaign_code));

-- --- 3.4 ENTITIES (CODEX) POLICIES ---
DROP POLICY IF EXISTS "entities_select" ON public.entities;
CREATE POLICY "entities_select" ON public.entities
    FOR SELECT USING (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "entities_insert" ON public.entities;
CREATE POLICY "entities_insert" ON public.entities
    FOR INSERT WITH CHECK (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "entities_update" ON public.entities;
CREATE POLICY "entities_update" ON public.entities
    FOR UPDATE USING (public.is_campaign_member(campaign_code))
    WITH CHECK (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "entities_delete" ON public.entities;
CREATE POLICY "entities_delete" ON public.entities
    FOR DELETE USING (public.is_campaign_dm(campaign_code));

-- --- 3.5 NOTES POLICIES (PROTECTS PERSONAL & DM-ONLY NOTES) ---
DROP POLICY IF EXISTS "notes_select" ON public.notes;
CREATE POLICY "notes_select" ON public.notes
    FOR SELECT USING (
        public.is_campaign_member(campaign_code)
        -- DM can view everything
        AND (
            public.is_campaign_dm(campaign_code)
            OR (
                -- Non-DM players can only see non-DM-only notes
                NOT is_dm_only
                -- And group visibility or their own personal notes
                AND (visibility = 'group' OR author_id = public.requesting_user_id())
            )
        )
    );

DROP POLICY IF EXISTS "notes_insert" ON public.notes;
CREATE POLICY "notes_insert" ON public.notes
    FOR INSERT WITH CHECK (
        public.is_campaign_member(campaign_code)
        AND (author_id = public.requesting_user_id() OR public.is_campaign_dm(campaign_code))
    );

DROP POLICY IF EXISTS "notes_update" ON public.notes;
CREATE POLICY "notes_update" ON public.notes
    FOR UPDATE USING (
        public.is_campaign_member(campaign_code)
        AND (author_id = public.requesting_user_id() OR public.is_campaign_dm(campaign_code))
    ) WITH CHECK (
        public.is_campaign_member(campaign_code)
        AND (author_id = public.requesting_user_id() OR public.is_campaign_dm(campaign_code))
    );

DROP POLICY IF EXISTS "notes_delete" ON public.notes;
CREATE POLICY "notes_delete" ON public.notes
    FOR DELETE USING (
        public.is_campaign_member(campaign_code)
        AND (author_id = public.requesting_user_id() OR public.is_campaign_dm(campaign_code))
    );

-- --- 3.6 CHARACTER BIOS POLICIES (PROTECTS PRIVATE PG PROFILES) ---
DROP POLICY IF EXISTS "bios_select" ON public.character_bios;
CREATE POLICY "bios_select" ON public.character_bios
    FOR SELECT USING (
        public.is_campaign_member(campaign_code)
        AND (
            player_id = public.requesting_user_id()
            OR public.is_campaign_dm(campaign_code)
            OR (privacy_settings->>'entireBio')::boolean IS NOT TRUE
        )
    );

DROP POLICY IF EXISTS "bios_insert" ON public.character_bios;
CREATE POLICY "bios_insert" ON public.character_bios
    FOR INSERT WITH CHECK (
        public.is_campaign_member(campaign_code)
        AND (player_id = public.requesting_user_id() OR public.is_campaign_dm(campaign_code))
    );

DROP POLICY IF EXISTS "bios_update" ON public.character_bios;
CREATE POLICY "bios_update" ON public.character_bios
    FOR UPDATE USING (
        public.is_campaign_member(campaign_code)
        AND (player_id = public.requesting_user_id() OR public.is_campaign_dm(campaign_code))
    ) WITH CHECK (
        public.is_campaign_member(campaign_code)
        AND (player_id = public.requesting_user_id() OR public.is_campaign_dm(campaign_code))
    );

DROP POLICY IF EXISTS "bios_delete" ON public.character_bios;
CREATE POLICY "bios_delete" ON public.character_bios
    FOR DELETE USING (
        public.is_campaign_member(campaign_code)
        AND (player_id = public.requesting_user_id() OR public.is_campaign_dm(campaign_code))
    );

-- --- 3.7 FAMILY RELATIONS POLICIES ---
DROP POLICY IF EXISTS "relations_select" ON public.family_relations;
CREATE POLICY "relations_select" ON public.family_relations
    FOR SELECT USING (
        public.is_campaign_member(campaign_code)
        AND (
            NOT is_secret
            OR source_entity_id = public.requesting_user_id()
            OR public.is_campaign_dm(campaign_code)
        )
    );

DROP POLICY IF EXISTS "relations_insert" ON public.family_relations;
CREATE POLICY "relations_insert" ON public.family_relations
    FOR INSERT WITH CHECK (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "relations_update" ON public.family_relations;
CREATE POLICY "relations_update" ON public.family_relations
    FOR UPDATE USING (public.is_campaign_member(campaign_code))
    WITH CHECK (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "relations_delete" ON public.family_relations;
CREATE POLICY "relations_delete" ON public.family_relations
    FOR DELETE USING (
        public.is_campaign_member(campaign_code)
        AND (source_entity_id = public.requesting_user_id() OR public.is_campaign_dm(campaign_code))
    );

-- --- 3.8 WORLD LORE ARTICLES POLICIES ---
DROP POLICY IF EXISTS "lore_select" ON public.world_lore_articles;
CREATE POLICY "lore_select" ON public.world_lore_articles
    FOR SELECT USING (
        public.is_campaign_member(campaign_code)
        AND (
            NOT is_draft
            OR author_player_id = public.requesting_user_id()
            OR public.is_campaign_dm(campaign_code)
        )
    );

DROP POLICY IF EXISTS "lore_insert" ON public.world_lore_articles;
CREATE POLICY "lore_insert" ON public.world_lore_articles
    FOR INSERT WITH CHECK (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "lore_update" ON public.world_lore_articles;
CREATE POLICY "lore_update" ON public.world_lore_articles
    FOR UPDATE USING (
        public.is_campaign_member(campaign_code)
        AND (author_player_id = public.requesting_user_id() OR public.is_campaign_dm(campaign_code))
    ) WITH CHECK (
        public.is_campaign_member(campaign_code)
        AND (author_player_id = public.requesting_user_id() OR public.is_campaign_dm(campaign_code))
    );

DROP POLICY IF EXISTS "lore_delete" ON public.world_lore_articles;
CREATE POLICY "lore_delete" ON public.world_lore_articles
    FOR DELETE USING (
        public.is_campaign_member(campaign_code)
        AND (author_player_id = public.requesting_user_id() OR public.is_campaign_dm(campaign_code))
    );

-- --- 3.9 MAPS, SCRAPBOOK & AUDIO LOGS POLICIES ---
DROP POLICY IF EXISTS "maps_select" ON public.maps;
CREATE POLICY "maps_select" ON public.maps
    FOR SELECT USING (
        public.is_campaign_member(campaign_code)
        AND (NOT is_secret OR public.is_campaign_dm(campaign_code))
    );

DROP POLICY IF EXISTS "maps_insert" ON public.maps;
CREATE POLICY "maps_insert" ON public.maps
    FOR INSERT WITH CHECK (public.is_campaign_dm(campaign_code));

DROP POLICY IF EXISTS "maps_update" ON public.maps;
CREATE POLICY "maps_update" ON public.maps
    FOR UPDATE USING (public.is_campaign_dm(campaign_code))
    WITH CHECK (public.is_campaign_dm(campaign_code));

DROP POLICY IF EXISTS "maps_delete" ON public.maps;
CREATE POLICY "maps_delete" ON public.maps
    FOR DELETE USING (public.is_campaign_dm(campaign_code));

DROP POLICY IF EXISTS "scrapbook_select" ON public.scrapbook;
CREATE POLICY "scrapbook_select" ON public.scrapbook
    FOR SELECT USING (
        public.is_campaign_member(campaign_code)
        AND (NOT is_secret OR public.is_campaign_dm(campaign_code))
    );

DROP POLICY IF EXISTS "scrapbook_insert" ON public.scrapbook;
CREATE POLICY "scrapbook_insert" ON public.scrapbook
    FOR INSERT WITH CHECK (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "scrapbook_update" ON public.scrapbook;
CREATE POLICY "scrapbook_update" ON public.scrapbook
    FOR UPDATE USING (public.is_campaign_member(campaign_code))
    WITH CHECK (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "scrapbook_delete" ON public.scrapbook;
CREATE POLICY "scrapbook_delete" ON public.scrapbook
    FOR DELETE USING (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "audio_select" ON public.audio_logs;
CREATE POLICY "audio_select" ON public.audio_logs
    FOR SELECT USING (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "audio_insert" ON public.audio_logs;
CREATE POLICY "audio_insert" ON public.audio_logs
    FOR INSERT WITH CHECK (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "audio_update" ON public.audio_logs;
CREATE POLICY "audio_update" ON public.audio_logs
    FOR UPDATE USING (public.is_campaign_member(campaign_code))
    WITH CHECK (public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "audio_delete" ON public.audio_logs;
CREATE POLICY "audio_delete" ON public.audio_logs
    FOR DELETE USING (public.is_campaign_member(campaign_code));

-- --- 3.10 USER ACCOUNTS & PREFERENCES POLICIES ---
DROP POLICY IF EXISTS "accounts_select" ON public.user_accounts;
CREATE POLICY "accounts_select" ON public.user_accounts
    FOR SELECT USING (
        public.requesting_user_id() IS NOT NULL
    );

DROP POLICY IF EXISTS "accounts_insert" ON public.user_accounts;
CREATE POLICY "accounts_insert" ON public.user_accounts
    FOR INSERT WITH CHECK (id = public.requesting_user_id());

DROP POLICY IF EXISTS "accounts_update" ON public.user_accounts;
CREATE POLICY "accounts_update" ON public.user_accounts
    FOR UPDATE USING (id = public.requesting_user_id())
    WITH CHECK (id = public.requesting_user_id());

DROP POLICY IF EXISTS "accounts_delete" ON public.user_accounts;
CREATE POLICY "accounts_delete" ON public.user_accounts
    FOR DELETE USING (id = public.requesting_user_id());

DROP POLICY IF EXISTS "prefs_select" ON public.user_preferences;
CREATE POLICY "prefs_select" ON public.user_preferences
    FOR SELECT USING (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS "prefs_insert" ON public.user_preferences;
CREATE POLICY "prefs_insert" ON public.user_preferences
    FOR INSERT WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS "prefs_update" ON public.user_preferences;
CREATE POLICY "prefs_update" ON public.user_preferences
    FOR UPDATE USING (user_id = public.requesting_user_id())
    WITH CHECK (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS "prefs_delete" ON public.user_preferences;
CREATE POLICY "prefs_delete" ON public.user_preferences
    FOR DELETE USING (user_id = public.requesting_user_id());

DROP POLICY IF EXISTS "oracle_select" ON public.oracle_chats;
CREATE POLICY "oracle_select" ON public.oracle_chats
    FOR SELECT USING (user_id = public.requesting_user_id() AND public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "oracle_insert" ON public.oracle_chats;
CREATE POLICY "oracle_insert" ON public.oracle_chats
    FOR INSERT WITH CHECK (user_id = public.requesting_user_id() AND public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "oracle_update" ON public.oracle_chats;
CREATE POLICY "oracle_update" ON public.oracle_chats
    FOR UPDATE USING (user_id = public.requesting_user_id() AND public.is_campaign_member(campaign_code))
    WITH CHECK (user_id = public.requesting_user_id() AND public.is_campaign_member(campaign_code));

DROP POLICY IF EXISTS "oracle_delete" ON public.oracle_chats;
CREATE POLICY "oracle_delete" ON public.oracle_chats
    FOR DELETE USING (user_id = public.requesting_user_id());

-- =========================================================================
-- 4. REALTIME PUBLICATION
-- =========================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE
    public.campaigns,
    public.chapters,
    public.sessions,
    public.entities,
    public.notes,
    public.character_bios,
    public.family_relations,
    public.world_lore_articles;
