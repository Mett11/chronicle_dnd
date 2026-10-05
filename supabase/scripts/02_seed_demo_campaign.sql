-- ==============================================================================
-- CHRONICLE D&D - SCRIPT DI SEED / POPOLAMENTO COMPLETO DI TEST
-- ==============================================================================
-- Allineato al 100% con lo schema reale di Supabase:
-- - campaigns (colonna 'title')
-- - campaign_members (PK campaign_code, user_id; joined_at, status)
-- - campaign_chapters (tabella campaign_chapters)
-- - character_bios (colonna 'character_name', 'personality_traits' JSONB)
-- - scrapbook_items (tabella scrapbook_items)
-- ==============================================================================

DO $$
DECLARE
    v_user_id text := (SELECT id::text FROM auth.users ORDER BY created_at ASC LIMIT 1);
    v_campaign_code text := 'DEMO2026';
    v_companion_id text := 'player_companion_elias';
    v_npc_id text := 'ent_npc_corvus_01';
    v_chapter_id text := 'chap_silverymoon_01';
    v_session_id text := 'sess_notte_campana_01';
    v_map_id text := 'map_costa_spada_01';
    v_folder_id text := 'folder_nord_01';
    v_article_id text := 'art_tessitura_01';
BEGIN
    IF v_user_id IS NULL THEN
        v_user_id := '00000000-0000-0000-0000-000000000001';
    END IF;

    RAISE NOTICE 'Inizio popolamento per campagna % e utente %', v_campaign_code, v_user_id;

    -- ==========================================================================
    -- 1. CAMPAGNA (public.campaigns)
    -- ==========================================================================
    INSERT INTO public.campaigns (
        code,
        title,
        subtitle,
        description,
        system,
        dm_id,
        calendar_system,
        active_players,
        dossier,
        created_at,
        updated_at
    ) VALUES (
        v_campaign_code,
        'I Guardiani di Neverwinter',
        'Cronache della Costa della Spada',
        'Campagna epica lungo la Costa della Spada contro le vestigia magiche dell''antico impero Netherese.',
        'D&D 5e',
        v_user_id,
        jsonb_build_object(
            'system_name', 'Harptos',
            'currentYear', 1492,
            'yearSuffix', 'CV',
            'currentMonthIndex', 4,
            'currentDay', 15,
            'months', jsonb_build_array(
                jsonb_build_object('name', 'Hammer', 'days', 30),
                jsonb_build_object('name', 'Alturiak', 'days', 30),
                jsonb_build_object('name', 'Ches', 'days', 30),
                jsonb_build_object('name', 'Tarsakh', 'days', 30),
                jsonb_build_object('name', 'Mirtul', 'days', 30),
                jsonb_build_object('name', 'Kythorn', 'days', 30),
                jsonb_build_object('name', 'Flamerule', 'days', 30),
                jsonb_build_object('name', 'Eleasis', 'days', 30),
                jsonb_build_object('name', 'Eleint', 'days', 30),
                jsonb_build_object('name', 'Marpenoth', 'days', 30),
                jsonb_build_object('name', 'Uktar', 'days', 30),
                jsonb_build_object('name', 'Nightal', 'days', 30)
            )
        ),
        jsonb_build_array(
            jsonb_build_object('_id', v_user_id, 'characterName', 'Valerius il Grigio', 'isDm', true, 'color', '#6366f1'),
            jsonb_build_object('_id', v_companion_id, 'characterName', 'Elias Lamaombra', 'isDm', false, 'color', '#10b981')
        ),
        jsonb_build_object(
            'mapFolders', jsonb_build_array(
                jsonb_build_object('id', v_folder_id, 'name', 'Regione del Nord', 'color', '#38bdf8')
            ),
            'activePlayers', jsonb_build_array(
                jsonb_build_object('_id', v_user_id, 'characterName', 'Valerius il Grigio', 'isDm', true, 'color', '#6366f1'),
                jsonb_build_object('_id', v_companion_id, 'characterName', 'Elias Lamaombra', 'isDm', false, 'color', '#10b981')
            )
        ),
        NOW(),
        NOW()
    )
    ON CONFLICT (code) DO UPDATE SET
        title = EXCLUDED.title,
        subtitle = EXCLUDED.subtitle,
        description = EXCLUDED.description,
        dm_id = EXCLUDED.dm_id,
        calendar_system = EXCLUDED.calendar_system,
        active_players = EXCLUDED.active_players,
        dossier = EXCLUDED.dossier,
        updated_at = NOW();

    -- ==========================================================================
    -- 2. CALENDARIO RELAZIONALE (public.calendars)
    -- ==========================================================================
    INSERT INTO public.calendars (
        campaign_code,
        system_name,
        months,
        current_day,
        current_month,
        current_year,
        events,
        updated_at
    ) VALUES (
        v_campaign_code,
        'Harptos',
        jsonb_build_array(
            jsonb_build_object('name', 'Hammer', 'days', 30),
            jsonb_build_object('name', 'Alturiak', 'days', 30),
            jsonb_build_object('name', 'Ches', 'days', 30),
            jsonb_build_object('name', 'Tarsakh', 'days', 30),
            jsonb_build_object('name', 'Mirtul', 'days', 30),
            jsonb_build_object('name', 'Kythorn', 'days', 30),
            jsonb_build_object('name', 'Flamerule', 'days', 30),
            jsonb_build_object('name', 'Eleasis', 'days', 30),
            jsonb_build_object('name', 'Eleint', 'days', 30),
            jsonb_build_object('name', 'Marpenoth', 'days', 30),
            jsonb_build_object('name', 'Uktar', 'days', 30),
            jsonb_build_object('name', 'Nightal', 'days', 30)
        ),
        15,
        5,
        1492,
        jsonb_build_array(
            jsonb_build_object('name', 'Festa della Primavera', 'monthIndex', 4, 'day', 1)
        ),
        NOW()
    )
    ON CONFLICT (campaign_code) DO UPDATE SET
        system_name = EXCLUDED.system_name,
        months = EXCLUDED.months,
        current_day = EXCLUDED.current_day,
        current_month = EXCLUDED.current_month,
        current_year = EXCLUDED.current_year,
        updated_at = NOW();

    -- ==========================================================================
    -- 3. MEMBRI DELLA CAMPAGNA (public.campaign_members)
    -- ==========================================================================
    INSERT INTO public.campaign_members (
        campaign_code,
        user_id,
        role,
        status,
        character_name,
        joined_at,
        updated_at
    ) VALUES 
        (v_campaign_code, v_user_id, 'dm', 'active', 'Valerius il Grigio', NOW(), NOW()),
        (v_campaign_code, v_companion_id, 'player', 'active', 'Elias Lamaombra', NOW(), NOW())
    ON CONFLICT (campaign_code, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        status = EXCLUDED.status,
        character_name = EXCLUDED.character_name,
        updated_at = NOW();

    -- ==========================================================================
    -- 4. PROFILO PERSONAGGIO COMPLETO (public.character_bios)
    -- ==========================================================================
    INSERT INTO public.character_bios (
        campaign_code,
        player_id,
        character_name,
        color,
        character_class,
        character_race,
        character_title,
        character_alignment,
        deity_or_patron,
        hometown,
        birth_date_formatted,
        birth_start_day,
        birth_month,
        birth_year,
        background,
        personality_traits,
        ideals,
        bonds,
        flaws,
        secrets,
        appearance_description,
        current_status,
        timeline_memories,
        evolving_beliefs,
        inter_party_relations,
        known_lore_bites,
        privacy_settings,
        stats,
        traits,
        updated_at
    ) VALUES (
        v_campaign_code,
        v_user_id,
        'Valerius il Grigio',
        '#6366f1',
        'Mago (Evocatore) 3',
        'Umano',
        'Accademico di Silverymoon',
        'Neutrale Buono',
        'Oghma (Dio della Conoscenza)',
        'Silverymoon',
        '12 Ches 1468 CV',
        12,
        'Ches',
        1468,
        'Cresciuto tra le biblioteche della città della volta d''argento, Valerius ha dedicato la giovinezza allo studio delle faglie arcane netheresi.',
        jsonb_build_array('Curioso fino all''imprudenza', 'Parla spesso con metafore arcane', 'Metodico nelle indagini'),
        'La conoscenza appartiene a chi ha il coraggio di cercarla e preservarla.',
        'Un antico tomo di evocazione cifrato ereditato da mio nonno.',
        'Sottovaluto costantemente i pericoli fisici se c''è un mistero magico da svelare.',
        'Ho trafugato un frammento di pergamena proibita dagli archivi della Torre di Magia.',
        'Alto, corporatura snella, vesti di lana grigia con ricami d''argento e occhiali cerchiati di ottone.',
        'Presso la Taverna del Cigno Nero a studiare la mappa delle faglie.',
        jsonb_build_array(
            jsonb_build_object(
                'id', 'mem_01',
                'category', 'discovery',
                'title', 'Ritrovamento della Scheggia di Notte',
                'summary', 'Nelle rovine sotterranee abbiamo rinvenuto un cristallo che pulsa di magia di Abiurazione antica.',
                'impact', 'high',
                'loreDate', '15 Mirtul 1492 CV',
                'sessionId', v_session_id
            )
        ),
        jsonb_build_array(
            jsonb_build_object(
                'id', 'bel_01',
                'subject', 'Origine della Pietra Pulsante',
                'previousBelief', 'Credevo fosse una reliquia elfica.',
                'currentTruth', 'È una chiave di confinamento forgiata dagli Arcanisti di Netheril.',
                'status', 'proven_fact',
                'revealedLoreDate', '15 Mirtul 1492 CV'
            ),
            jsonb_build_object(
                'id', 'bel_02',
                'subject', 'Il Culto della Mezzanotte',
                'previousBelief', '',
                'currentTruth', 'Sospetto che il locandiere sia una spia infiltrata nel villaggio.',
                'status', 'active_theory',
                'revealedLoreDate', '15 Mirtul 1492 CV'
            )
        ),
        jsonb_build_object(
            v_companion_id, jsonb_build_object(
                'targetPlayerId', v_companion_id,
                'targetCharacterName', 'Elias Lamaombra',
                'attitude', 'friendly',
                'trustLevel', 8,
                'relationType', 'Compagno d''armi fidato',
                'notes', 'Ha protetto le mie spalle durante l''imboscata alle rovine.',
                'progression', jsonb_build_array(
                    jsonb_build_object(
                        'loreDate', '15 Mirtul 1492 CV',
                        'note', 'Ha salvato i miei appunti dalle fiamme.'
                    )
                )
            )
        ),
        jsonb_build_array(
            jsonb_build_object(
                'articleId', v_article_id,
                'biteId', 'bite_netheril_02',
                'articleTitle', 'La Tessitura e le Sue Fenditure',
                'biteTitle', 'Risonanza delle Faglie Netheresi',
                'biteLevel', 'specialized',
                'note', 'Appreso durante gli studi giovanili a Silverymoon',
                'addedAt', NOW()::text
            )
        ),
        jsonb_build_object(
            'identity', true,
            'backstory', true,
            'traits', true,
            'bondsFlaws', true,
            'secrets', false,
            'appearance', true,
            'familyTree', true,
            'personalNotes', false,
            'quests', true,
            'memories', true,
            'timelineMemories', true,
            'evolvingBeliefs', true,
            'interPartyRelations', true,
            'worldLore', true
        ),
        jsonb_build_object('for', 9, 'des', 14, 'cos', 13, 'int', 17, 'sag', 13, 'car', 10),
        jsonb_build_array('Scurovisione', 'Linguaggi Arcani'),
        NOW()
    )
    ON CONFLICT (campaign_code, player_id) DO UPDATE SET
        character_name = EXCLUDED.character_name,
        character_class = EXCLUDED.character_class,
        background = EXCLUDED.background,
        personality_traits = EXCLUDED.personality_traits,
        secrets = EXCLUDED.secrets,
        timeline_memories = EXCLUDED.timeline_memories,
        evolving_beliefs = EXCLUDED.evolving_beliefs,
        inter_party_relations = EXCLUDED.inter_party_relations,
        known_lore_bites = EXCLUDED.known_lore_bites,
        updated_at = NOW();

    -- ==========================================================================
    -- 5. CAPITOLO STORYLINE (public.campaign_chapters)
    -- ==========================================================================
    INSERT INTO public.campaign_chapters (
        id,
        campaign_code,
        number,
        title,
        name,
        synopsis,
        description,
        status,
        order_index,
        color,
        cover_image_url,
        created_at,
        updated_at
    ) VALUES (
        v_chapter_id,
        v_campaign_code,
        1,
        'Atto I: L''Ombra su Silverymoon',
        'Atto I: L''Ombra su Silverymoon',
        'I primi presagi dell''apertura di antiche faglie sotterranee e l''indagine del gruppo alla locanda.',
        'I primi presagi dell''apertura di antiche faglie sotterranee e l''indagine del gruppo alla locanda.',
        'in_progress',
        1,
        '#6366f1',
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        name = EXCLUDED.name,
        synopsis = EXCLUDED.synopsis,
        order_index = EXCLUDED.order_index,
        updated_at = NOW();

    -- ==========================================================================
    -- 6. SESSIONE ASSOCIATA AL CAPITOLO (public.sessions)
    -- ==========================================================================
    INSERT INTO public.sessions (
        id,
        campaign_code,
        chapter_id,
        chapter_name,
        number,
        title,
        date,
        calendar_date,
        lore_date,
        lore_day,
        lore_month,
        lore_year,
        lore_formatted,
        session_type,
        linked_entity_ids,
        summary,
        recap,
        events,
        plot_events,
        created_at,
        updated_at
    ) VALUES (
        v_session_id,
        v_campaign_code,
        v_chapter_id,
        'Atto I: L''Ombra su Silverymoon',
        1,
        'Sessione 1: La Notte della Campana Infranta',
        CURRENT_DATE::text,
        CURRENT_DATE::text,
        jsonb_build_object('formatted', '15 Mirtul 1492 CV', 'day', 15, 'month', 5, 'year', 1492),
        15,
        5,
        1492,
        '15 Mirtul 1492 CV',
        'mixed',
        jsonb_build_array(v_npc_id),
        'Il party si riunisce alla locanda del Cigno Nero, affronta un''incursione di creature d''ombra e incontra Mastro Corvus.',
        'Arrivo a Silverymoon e primo scambio di informazioni. Combattimento contro le ombre nella piazza. Incontro con Mastro Corvus.',
        jsonb_build_array('Incontro iniziale alla taverna', 'Attacco delle ombre nel vicolo', 'Esplorazione sotterranei'),
        jsonb_build_array('Incontro iniziale alla taverna', 'Attacco delle ombre nel vicolo', 'Esplorazione sotterranei'),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        recap = EXCLUDED.recap,
        summary = EXCLUDED.summary,
        chapter_id = EXCLUDED.chapter_id,
        updated_at = NOW();

    -- ==========================================================================
    -- 7. LE 6 COMBINAZIONI DI NOTE (public.notes)
    -- ==========================================================================
    -- 1) Nota Personale PG
    INSERT INTO public.notes (
        id, campaign_code, title, content, visibility, is_dm_only, is_pinned, canon_state,
        author_id, author_name, author_is_dm, ask_dm, dm_reply, tags, created_at, updated_at
    ) VALUES (
        'note_personal_01', v_campaign_code, 'Diario Intimo: Ricerche sulle Rune Proibite',
        'Ho nascosto gli appunti sulla runa di confinamento sotto l''asse del pavimento della mia stanza. Nessuno deve vederli.',
        'personal', false, false, 'canon', v_user_id, 'Valerius il Grigio', false, false, NULL,
        jsonb_build_array('segreto', 'personale'), NOW() - interval '3 hours', NOW()
    ) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

    -- 2) Nota Condivisa Party
    INSERT INTO public.notes (
        id, campaign_code, title, content, visibility, is_dm_only, is_pinned, canon_state,
        author_id, author_name, author_is_dm, ask_dm, dm_reply, tags, session_id, created_at, updated_at
    ) VALUES (
        'note_shared_01', v_campaign_code, 'Rapporto: Indizi sulle Ombre dei Sotterranei',
        'Le creature ombra temono la luce incanalata da simboli sacri. Abbiamo raccolto 3 frammenti di ossidiana incantata da analizzare.',
        'group', false, false, 'canon', v_user_id, 'Valerius il Grigio', false, false, NULL,
        jsonb_build_array('mostri', 'indizi'), v_session_id, NOW() - interval '2 hours', NOW()
    ) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

    -- 3) Nota DM-Only / Segreto Master
    INSERT INTO public.notes (
        id, campaign_code, title, content, visibility, is_dm_only, is_pinned, canon_state,
        author_id, author_name, author_is_dm, ask_dm, dm_reply, tags, created_at, updated_at
    ) VALUES (
        'note_dm_secret_01', v_campaign_code, '[MASTER ONLY] La Vera Identità del Locandiere',
        'Il locandiere Thorne è sotto ricatto dal Culto di Netheril: sua figlia è tenuta prigioniera nei cunicoli inferiori.',
        'group', true, false, 'canon', v_user_id, 'Dungeon Master', true, false, NULL,
        jsonb_build_array('trama', 'dm_secrets'), NOW() - interval '1 hour', NOW()
    ) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

    -- 4) Domanda al DM in Sospeso (ask_dm = true, dm_reply = NULL)
    INSERT INTO public.notes (
        id, campaign_code, title, content, visibility, is_dm_only, is_pinned, canon_state,
        author_id, author_name, author_is_dm, ask_dm, dm_reply, tags, session_id, created_at, updated_at
    ) VALUES (
        'note_ask_dm_pending_01', v_campaign_code, 'Dubbio sulle Rune di Protezione della Porta',
        'Master, quando ho lanciato Individuazione del Magico sulle cerniere della porta di ferro, che scuola di magia ho percepito esattamente?',
        'group', false, false, 'canon', v_user_id, 'Valerius il Grigio', false, true, NULL,
        jsonb_build_array('domanda_dm', 'regole'), v_session_id, NOW() - interval '45 minutes', NOW()
    ) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, ask_dm = true, dm_reply = NULL;

    -- 5) Domanda al DM Risolta (ask_dm = true con Risposta del Master)
    INSERT INTO public.notes (
        id, campaign_code, title, content, visibility, is_dm_only, is_pinned, canon_state,
        author_id, author_name, author_is_dm, ask_dm, dm_reply, tags, session_id, created_at, updated_at
    ) VALUES (
        'note_ask_dm_answered_01', v_campaign_code, 'Natura dell''Amuleto Trovato sul Cultista',
        'Il simbolo di metallo scuro reca incisioni a spirale. È compatibile con i culti di Shar?',
        'group', false, false, 'canon', v_user_id, 'Valerius il Grigio', false, true,
        'Sì, hai riconosciuto il glifo dell''Oscura Signora. L''amuleto funge da catalizzatore per incantesimi di illusione minore.',
        jsonb_build_array('domanda_dm', 'lore'), v_session_id, NOW() - interval '30 minutes', NOW()
    ) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, dm_reply = EXCLUDED.dm_reply;

    -- 6) Nota Fissata in Alto (Pinned con Tag & Immagine)
    INSERT INTO public.notes (
        id, campaign_code, title, content, visibility, is_dm_only, is_pinned, canon_state,
        author_id, author_name, author_is_dm, ask_dm, dm_reply, tags, images, created_at, updated_at
    ) VALUES (
        'note_pinned_01', v_campaign_code, '📌 OBIETTIVO PRINCIPALE: Sigillare la Faglia di Mirtul',
        'Priorità assoluta del gruppo: trovare la seconda metà della chiave prima della prossima luna nuova per impedire l''avanzata delle ombre.',
        'group', false, true, 'canon', v_user_id, 'Valerius il Grigio', false, false, NULL,
        jsonb_build_array('quest_principale', 'urgente'),
        jsonb_build_array('https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600&auto=format&fit=crop&q=80'),
        NOW() - interval '15 minutes', NOW()
    ) ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content, is_pinned = true;

    -- ==========================================================================
    -- 8. MAPPA CON CARTELLA E PIN (public.maps)
    -- ==========================================================================
    INSERT INTO public.maps (
        id,
        campaign_code,
        title,
        description,
        image_url,
        scale_label,
        folder_id,
        is_default,
        shared_with_dm,
        pins,
        created_at,
        updated_at
    ) VALUES (
        v_map_id,
        v_campaign_code,
        'Costa della Spada Settentrionale',
        'Mappa regionale che illustra il percorso da Silverymoon a Neverwinter e le rovine montane circostanti.',
        'https://images.unsplash.com/photo-1524654458049-e36be0721fa2?w=1200&auto=format&fit=crop&q=80',
        '1 esagono = 24 miglia',
        v_folder_id,
        true,
        true,
        jsonb_build_array(
            jsonb_build_object(
                'id', 'pin_silverymoon_01',
                'x', 38.5,
                'y', 42.0,
                'title', 'Accademia & Dimora di Mastro Corvus',
                'description', 'Luogo di incontro con il mentore e archivio di ricerca arcanistica.',
                'entityId', v_npc_id,
                'color', '#6366f1',
                'icon', 'landmark'
            ),
            jsonb_build_object(
                'id', 'pin_rovine_02',
                'x', 62.0,
                'y', 55.4,
                'title', 'Rovine Netheresi della Faglia',
                'description', 'Punto di origine delle ombre affrontate nella Sessione 1.',
                'color', '#ef4444',
                'icon', 'skull'
            )
        ),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        folder_id = EXCLUDED.folder_id,
        pins = EXCLUDED.pins,
        updated_at = NOW();

    -- ==========================================================================
    -- 9. NPC CODEX & AI CONFIG (public.entities)
    -- ==========================================================================
    INSERT INTO public.entities (
        id,
        campaign_code,
        name,
        type,
        description,
        image_url,
        status,
        color,
        aliases,
        attributes,
        created_at,
        updated_at
    ) VALUES (
        v_npc_id,
        v_campaign_code,
        'Mastro Corvus',
        'npc',
        'Anziano studioso della Volta d''Argento, maestro di arcanistica teorica e primo mentore di Valerius.',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
        'alive',
        '#6366f1',
        jsonb_build_array('Il Custode delle Fenditure', 'Professore Corvus'),
        jsonb_build_object(
            'status', 'alive',
            'category', 'npc',
            'location', 'Torre della Conoscenza, Silverymoon',
            'progressNote', 'Ha affidato al gruppo il compito di monitorare la stabilità della pietra di confinamento.',
            'aiConfig', jsonb_build_object(
                'enabled', true,
                'speechStyle', 'Parla con tono saggio, calmo ed erudito. Usa metafore legate all''intreccio della trama magica.',
                'currentStatus', 'Nel suo studio a decifrare le iscrizioni runiche recuperate dal party.',
                'knowledgeScope', 'Massimo esperto di storia Netherese e cosmologia dei Piani.',
                'partyRelations', jsonb_build_object(
                    v_user_id, jsonb_build_object(
                        'playerId', v_user_id,
                        'characterName', 'Valerius il Grigio',
                        'attitude', 'friendly',
                        'relationType', 'Mentore premuroso',
                        'notes', 'Ripone grandi aspettative nel talento e nella disciplina del suo allievo.'
                    )
                )
            )
        ),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        attributes = EXCLUDED.attributes,
        updated_at = NOW();

    -- ==========================================================================
    -- 10. RELAZIONI SOCIALI & PNG (public.family_relations)
    -- ==========================================================================
    INSERT INTO public.family_relations (
        id,
        campaign_code,
        source_entity_id,
        target_entity_id,
        relationship_type,
        description,
        name,
        avatar_url,
        custom_relationship_label,
        title_or_role,
        generation_category,
        genealogy_role,
        status,
        attitude,
        trust_level,
        is_secret,
        created_at,
        updated_at
    ) VALUES (
        'rel_valerius_corvus_01',
        v_campaign_code,
        v_user_id,
        v_npc_id,
        'mentor',
        'Mastro Corvus ha guidato Valerius nei primi tre circoli di magia trasmettendogli il rigore metodologico.',
        'Mastro Corvus',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&auto=format&fit=crop&q=80',
        'Vecchio Precettore di Magia',
        'Arcimago Emerito di Silverymoon',
        'older_generation',
        'mentor',
        'alive',
        'friendly',
        9,
        false,
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        description = EXCLUDED.description,
        custom_relationship_label = EXCLUDED.custom_relationship_label,
        updated_at = NOW();

    -- ==========================================================================
    -- 11. WORLD LORE & NOZIONI (public.world_lore_articles)
    -- ==========================================================================
    INSERT INTO public.world_lore_articles (
        id,
        campaign_code,
        title,
        content,
        category_id,
        is_draft,
        bites,
        created_at,
        updated_at
    ) VALUES (
        v_article_id,
        v_campaign_code,
        'La Tessitura e le Sue Fenditure',
        'La magia nei Forgotten Realms fluisce attraverso la Tessitura creata da Mystra. Quando potenti cataclismi (come la caduta di Netheril) lacerano questo tessuto cosmico, si generano zone di magia morta o faglie da cui scaturiscono energie del Piano delle Ombre.',
        'magic_arcana',
        false,
        jsonb_build_array(
            jsonb_build_object(
                'id', 'bite_tessitura_01',
                'title', 'I Pilastri della Tessitura Divina',
                'content', 'Ogni incantesimo lanciato attinge fili dalla Tessitura, riordinandoli secondo la volontà dell''incantatore.',
                'level', 'public',
                'knownBy', jsonb_build_array(
                    jsonb_build_object('id', v_user_id, 'name', 'Valerius il Grigio', 'type', 'player', 'acquisitionNote', 'Sapere comune del gruppo'),
                    jsonb_build_object('id', v_companion_id, 'name', 'Elias Lamaombra', 'type', 'player', 'acquisitionNote', 'Sapere comune del gruppo')
                )
            ),
            jsonb_build_object(
                'id', 'bite_netheril_02',
                'title', 'Risonanza delle Faglie Netheresi',
                'content', 'I cristalli di confinamento netheresi vibrano a frequenze di abiurazione quando un varco planare si indebolisce.',
                'level', 'specialized',
                'knownBy', jsonb_build_array(
                    jsonb_build_object('id', v_user_id, 'name', 'Valerius il Grigio', 'type', 'player', 'acquisitionNote', 'Appreso durante gli studi giovanili a Silverymoon')
                )
            )
        ),
        NOW(),
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        content = EXCLUDED.content,
        bites = EXCLUDED.bites,
        updated_at = NOW();

    -- ==========================================================================
    -- 12. SCRAPBOOK / MEMORIA VISIVA (public.scrapbook_items)
    -- ==========================================================================
    INSERT INTO public.scrapbook_items (
        id,
        campaign_code,
        title,
        description,
        image_url,
        created_by,
        author_name,
        category,
        tags,
        session_id,
        entity_id,
        lore_date,
        is_secret,
        shared_with_dm,
        created_at
    ) VALUES (
        'scr_campana_01',
        v_campaign_code,
        'La Campana di Silverymoon dopo l''Incursione',
        'La campana di bronzo della piazza centrale fessurata dal tocco delle creature d''ombra.',
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&auto=format&fit=crop&q=80',
        'Valerius il Grigio',
        'Valerius il Grigio',
        'moment',
        jsonb_build_array('silverymoon', 'battaglia'),
        v_session_id,
        v_npc_id,
        '15 Mirtul 1492 CV',
        false,
        true,
        NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description;

    RAISE NOTICE 'Seed completato con successo per la campagna %!', v_campaign_code;
END $$;
