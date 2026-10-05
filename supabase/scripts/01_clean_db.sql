-- ==============================================================================
-- CHRONICLE D&D - SCRIPT DI RESET / SVUOTAMENTO DATABASE (SCHEMA EXACT MATCH)
-- ==============================================================================
BEGIN;

SET CONSTRAINTS ALL DEFERRED;

TRUNCATE TABLE public.family_relations CASCADE;
TRUNCATE TABLE public.world_lore_articles CASCADE;
TRUNCATE TABLE public.character_bios CASCADE;
TRUNCATE TABLE public.audio_logs CASCADE;
TRUNCATE TABLE public.scrapbook_items CASCADE;
TRUNCATE TABLE public.notes CASCADE;
TRUNCATE TABLE public.entities CASCADE;
TRUNCATE TABLE public.sessions CASCADE;
TRUNCATE TABLE public.campaign_chapters CASCADE;
TRUNCATE TABLE public.maps CASCADE;
TRUNCATE TABLE public.calendars CASCADE;
TRUNCATE TABLE public.campaign_members CASCADE;
TRUNCATE TABLE public.campaigns CASCADE;

COMMIT;

SELECT 
    (SELECT count(*) FROM public.campaigns) AS campaigns_count,
    (SELECT count(*) FROM public.campaign_members) AS members_count,
    (SELECT count(*) FROM public.sessions) AS sessions_count,
    (SELECT count(*) FROM public.notes) AS notes_count,
    (SELECT count(*) FROM public.entities) AS entities_count,
    (SELECT count(*) FROM public.character_bios) AS bios_count;
