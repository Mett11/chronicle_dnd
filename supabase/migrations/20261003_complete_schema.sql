-- =========================================================================
-- CHRONICLE DND - COMPLETE SUPABASE SCHEMA MIGRATION
-- Applies to: Supabase PostgreSQL
-- Date: 2026-10-03
-- =========================================================================

-- 1. CAMPAIGNS TABLE
CREATE TABLE IF NOT EXISTS public.campaigns (
    code text PRIMARY KEY,
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

-- 2. CHAPTERS TABLE
CREATE TABLE IF NOT EXISTS public.chapters (
    id text PRIMARY KEY,
    campaign_code text NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_chapters_campaign_code ON public.chapters(campaign_code);

-- 3. SESSIONS TABLE
CREATE TABLE IF NOT EXISTS public.sessions (
    id text PRIMARY KEY,
    campaign_code text NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_sessions_campaign_code ON public.sessions(campaign_code);
CREATE INDEX IF NOT EXISTS idx_sessions_number ON public.sessions(number);

-- 4. ENTITIES (CODEX) TABLE
CREATE TABLE IF NOT EXISTS public.entities (
    id text PRIMARY KEY,
    campaign_code text NOT NULL,
    name text NOT NULL,
    type text DEFAULT 'npc',
    description text DEFAULT '',
    image_url text,
    status text DEFAULT 'alive',
    attributes jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_entities_campaign_code ON public.entities(campaign_code);
CREATE INDEX IF NOT EXISTS idx_entities_type ON public.entities(type);

-- 5. NOTES TABLE
CREATE TABLE IF NOT EXISTS public.notes (
    id text PRIMARY KEY,
    campaign_code text NOT NULL,
    title text NOT NULL,
    content text DEFAULT '',
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
CREATE INDEX IF NOT EXISTS idx_notes_campaign_code ON public.notes(campaign_code);

-- 6. MAPS TABLE
CREATE TABLE IF NOT EXISTS public.maps (
    id text PRIMARY KEY,
    campaign_code text NOT NULL,
    title text NOT NULL,
    description text DEFAULT '',
    image_url text NOT NULL,
    scale_label text DEFAULT '',
    entity_id text,
    folder_id text,
    pins jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_maps_campaign_code ON public.maps(campaign_code);

-- 7. SCRAPBOOK TABLE
CREATE TABLE IF NOT EXISTS public.scrapbook (
    id text PRIMARY KEY,
    campaign_code text NOT NULL,
    title text NOT NULL,
    caption text DEFAULT '',
    image_url text NOT NULL,
    aspect_ratio text DEFAULT 'square',
    tags jsonb DEFAULT '[]'::jsonb,
    session_id text,
    lore_date text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_scrapbook_campaign_code ON public.scrapbook(campaign_code);

-- 8. AUDIO LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audio_logs (
    id text PRIMARY KEY,
    campaign_code text NOT NULL,
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
CREATE INDEX IF NOT EXISTS idx_audio_logs_campaign_code ON public.audio_logs(campaign_code);

-- 9. CHARACTER BIOS TABLE
CREATE TABLE IF NOT EXISTS public.character_bios (
    player_id text PRIMARY KEY,
    campaign_code text NOT NULL,
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
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_character_bios_campaign_code ON public.character_bios(campaign_code);

-- 10. FAMILY RELATIONS TABLE
CREATE TABLE IF NOT EXISTS public.family_relations (
    id text PRIMARY KEY,
    campaign_code text NOT NULL,
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

-- 11. WORLD LORE ARTICLES TABLE
CREATE TABLE IF NOT EXISTS public.world_lore_articles (
    id text PRIMARY KEY,
    campaign_code text NOT NULL,
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

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
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

-- Allow public read/write by anon/authenticated client keys for active campaign campaigns
-- (Authentication is validated via Firebase Auth at application gate layer)
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN (
        'campaigns', 'chapters', 'sessions', 'entities', 'notes',
        'maps', 'scrapbook', 'audio_logs', 'character_bios',
        'family_relations', 'world_lore_articles'
    )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Public access to %I" ON public.%I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "Public access to %I" ON public.%I FOR ALL USING (true) WITH CHECK (true);', tbl, tbl);
    END LOOP;
END $$;

-- =========================================================================
-- REALTIME REPLICATION PUBLICATION
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
