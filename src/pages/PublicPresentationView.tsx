import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CampaignManager } from '../store/campaignStore';
import { StorylineFullscreenViewer, StorylineSlide } from '../components/StorylineFullscreenViewer';
import { Film, Sparkles, Compass, AlertCircle, RefreshCw } from 'lucide-react';
import { Session, CampaignChapter } from '../types';
import { extractTextFromContent, safeString } from '../lib/sanitize';
import { generateCampaignShareToken, slugifyCampaignTitle } from '../lib/shareToken';
import { isSupabaseConfigured } from '../lib/supabase';
import { SupabaseSyncService } from '../lib/supabaseSyncService';

export function PublicPresentationView() {
  const { shareId, token, campaignCode: routeCode, code: altCode, campaignName, reversedCode } = useParams<{
    shareId?: string;
    token?: string;
    campaignCode?: string;
    code?: string;
    campaignName?: string;
    reversedCode?: string;
  }>();

  const originalFromReversed = reversedCode ? reversedCode.trim().split('').reverse().join('').toUpperCase() : '';
  const compositeSlug = campaignName && reversedCode ? `${slugifyCampaignTitle(campaignName)}__${reversedCode.toLowerCase()}` : '';
  const rawTarget = (compositeSlug || campaignName || shareId || token || routeCode || altCode || '').trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [chapters, setChapters] = useState<CampaignChapter[]>([]);
  const [campaignTitle, setCampaignTitle] = useState<string>('');

  useEffect(() => {
    if (!rawTarget && !campaignName && !routeCode) {
      setError('Nessun link di presentazione valido specificato.');
      setLoading(false);
      return;
    }

    let isMounted = true;

    async function loadPublicCampaign() {
      setLoading(true);
      setError(null);

      // Check if data is already available locally in memory or IndexedDB
      const localSessions = CampaignManager.getSessions();
      const localChapters = CampaignManager.getChapters();
      const activeCode = CampaignManager.getActiveCampaignCode();
      const localMeta = CampaignManager.getCampaignMeta();
      const activeShareToken = activeCode ? generateCampaignShareToken(activeCode) : '';
      const activeSlug = slugifyCampaignTitle(localMeta?.name || activeCode || '');

      const isLocalMatch = (
        (activeCode && activeCode.toUpperCase() === rawTarget.toUpperCase()) ||
        (activeCode && originalFromReversed && activeCode.toUpperCase() === originalFromReversed) ||
        (activeShareToken && activeShareToken === rawTarget.toLowerCase()) ||
        (activeSlug && (activeSlug === rawTarget.toLowerCase() || rawTarget.toLowerCase().startsWith(activeSlug))) ||
        (campaignName && localMeta?.name && slugifyCampaignTitle(localMeta.name) === slugifyCampaignTitle(campaignName)) ||
        (localMeta?.name && slugifyCampaignTitle(localMeta.name) === rawTarget.toLowerCase())
      );

      const localHasArtwork = Array.isArray(localSessions) && localSessions.some((s) => (s.images && s.images.length > 0) || s.coverImage);

      if (isLocalMatch && localSessions && localSessions.length > 0 && localHasArtwork) {
        if (isMounted) {
          setSessions(localSessions);
          setChapters(localChapters || []);
          setCampaignTitle(localMeta?.name || 'Cronaca di Campagna');
          setLoading(false);
        }
        return;
      }

      // Fetch from Supabase
      try {
        const upperCode = originalFromReversed || rawTarget.toUpperCase();
        const targetCode = upperCode || activeCode || rawTarget;
        const supaData = await SupabaseSyncService.fetchCampaignData(targetCode);
        if (supaData && supaData.sessions && supaData.sessions.length > 0) {
          if (isMounted) {
            setSessions(supaData.sessions);
            setChapters(supaData.chapters || []);
            setCampaignTitle(localMeta?.name || `Campagna ${targetCode}`);
            setLoading(false);
          }
          return;
        }
      } catch (supaErr) {
        console.warn('[PublicPresentationView] Supabase fetch error:', supaErr);
      }

      // Fallback to local sessions if available
      if (localSessions && localSessions.length > 0) {
        if (isMounted) {
          setSessions(localSessions);
          setChapters(localChapters || []);
          setCampaignTitle(localMeta?.name || 'Cronaca di Campagna');
          setLoading(false);
        }
        return;
      }

      if (isMounted) {
        setError('Nessuna presentazione trovata per questa campagna.');
        setLoading(false);
      }
    }

    loadPublicCampaign();

    return () => {
      isMounted = false;
    };
  }, [rawTarget]);

  // Construct sequential StorylineSlides for the presentation view
  const slides = useMemo<StorylineSlide[]>(() => {
    if (!sessions || sessions.length === 0) return [];

    const result: StorylineSlide[] = [];
    const sorted = [...sessions].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0));

    // Chapter lookup map
    const chapterMap = new Map<string, CampaignChapter>();
    (chapters || []).forEach((c) => {
      if (c.id) chapterMap.set(c.id, c);
      if (c.name) chapterMap.set(c.name.toLowerCase().trim(), c);
    });

    const seenChapters = new Set<string>();
    let globalIdx = 0;

    sorted.forEach((sess) => {
      // 1. Insert Chapter Cover Slide as opening element if new chapter encountered
      const chapterKey = (sess.chapterId || sess.chapterName || '').trim();
      const chapterObj = sess.chapterId
        ? chapterMap.get(sess.chapterId)
        : (sess.chapterName ? chapterMap.get(sess.chapterName.toLowerCase().trim()) : undefined);

      if (chapterKey && !seenChapters.has(chapterKey.toLowerCase())) {
        seenChapters.add(chapterKey.toLowerCase());

        const chapterName = chapterObj?.name || sess.chapterName || 'Capitolo';
        const chapterCoverUrl = chapterObj?.coverImageUrl || '';
        const chapterDesc = extractTextFromContent(chapterObj?.description || '') || `Presentazione e apertura del Capitolo: ${chapterName}`;
        const chapterLoreDate = safeString(sess.loreDate || sess.date || '');

        result.push({
          imageUrl: chapterCoverUrl,
          nodeId: `chapter_${chapterObj?.id || chapterKey}`,
          nodeTitle: `Capitolo: ${chapterName}`,
          nodeDescription: chapterDesc,
          nodeType: 'chapter',
          loreDate: chapterLoreDate,
          sessionNumber: Number(sess.number) || 1,
          sessionTitle: chapterName,
          chapterName,
          imageIndexInNode: 0,
          nodeTotalImages: 1,
          globalIndex: globalIdx++,
          totalGlobalImages: 0,
          isPlaceholder: !chapterCoverUrl,
          isChapterCover: true,
        });
      }

      // 2. Gather session artwork
      const rawImages: string[] = [];

      if (Array.isArray(sess.images)) {
        rawImages.push(...sess.images);
      }
      if (sess.coverImage) {
        if (typeof sess.coverImage === 'string') rawImages.push(sess.coverImage);
        else if ((sess.coverImage as any)?.asset?.url) rawImages.push((sess.coverImage as any).asset.url);
        else if ((sess.coverImage as any)?.url) rawImages.push((sess.coverImage as any).url);
      }
      if (Array.isArray(sess.events)) {
        sess.events.forEach((evt: any) => {
          if (Array.isArray(evt?.images)) {
            rawImages.push(...evt.images);
          }
        });
      }
      if (Array.isArray((sess as any).gallery)) {
        rawImages.push(...(sess as any).gallery);
      }
      if ((sess as any).imageUrl && typeof (sess as any).imageUrl === 'string') {
        rawImages.push((sess as any).imageUrl);
      }

      const validImages = Array.from(new Set(rawImages.filter(Boolean)));
      const sessionTitle = safeString(sess.title, `Sessione #${sess.number || 1}`);
      const chapterName = safeString(sess.chapterName);
      const chapterLabel = chapterName ? `Capitolo #${sess.number || 1} (${chapterName})` : `Capitolo #${sess.number || 1}`;
      const recapText = extractTextFromContent(sess.recap || (sess as any).synopsis || (sess as any).notes || '');
      const loreDate = safeString(sess.loreDate || sess.date || '');
      const sessionNodeId = `session_${sess._id || sess.number}`;
      const sessionLocation = safeString(((sess as any).locations && (sess as any).locations[0]) || (sess as any).location || '');

      if (validImages.length > 0) {
        validImages.forEach((imgUrl, imgIdx) => {
          result.push({
            imageUrl: typeof imgUrl === 'string' ? imgUrl : safeString(imgUrl),
            nodeId: sessionNodeId,
            nodeTitle: `${chapterLabel}: ${sessionTitle}`,
            nodeDescription: recapText,
            nodeType: 'session',
            loreDate,
            sessionNumber: Number(sess.number) || 1,
            sessionTitle,
            chapterName,
            location: sessionLocation || undefined,
            imageIndexInNode: imgIdx,
            nodeTotalImages: validImages.length,
            globalIndex: globalIdx++,
            totalGlobalImages: 0,
            sessionId: sess._id,
            sessionObj: sess,
            isPlaceholder: false,
          });
        });
      } else {
        // Placeholder slide if session has no artwork
        result.push({
          imageUrl: '',
          nodeId: sessionNodeId,
          nodeTitle: `${chapterLabel}: ${sessionTitle}`,
          nodeDescription: recapText,
          nodeType: 'session',
          loreDate,
          sessionNumber: Number(sess.number) || 1,
          sessionTitle,
          chapterName,
          location: sessionLocation || undefined,
          imageIndexInNode: 0,
          nodeTotalImages: 1,
          globalIndex: globalIdx++,
          totalGlobalImages: 0,
          sessionId: sess._id,
          sessionObj: sess,
          isPlaceholder: true,
        });
      }
    });

    return result.map((s) => ({ ...s, totalGlobalImages: result.length }));
  }, [sessions, chapters]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-cinzel font-bold text-content-1 mb-2 tracking-wide">
          Caricamento Cronaca della Campagna...
        </h2>
        <p className="text-xs font-mono uppercase tracking-wider text-content-3">
          Preparazione presentazione in corso
        </p>
      </div>
    );
  }

  if (error || slides.length === 0) {
    return (
      <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mb-4">
          <AlertCircle size={28} />
        </div>
        <h2 className="text-xl font-cinzel font-bold text-content-1 mb-2">
          {error || 'Nessun capitolo o immagine disponibile'}
        </h2>
        <p className="text-sm font-sans text-content-3 max-w-md mb-6">
          Non sono state trovate sessioni o illustrazioni pubbliche per questa presentazione.
        </p>
        <Link
          to="/"
          className="px-5 py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-content-1 border border-surface-3 text-xs font-semibold inline-flex items-center gap-2 transition-colors"
        >
          <Compass size={15} />
          <span>Accedi al Portale Chronicle</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 overflow-hidden">
      <StorylineFullscreenViewer
        slides={slides}
        initialSlideIndex={0}
        isOpen={true}
        onClose={() => {
          if (window.history.length > 1) {
            window.history.back();
          } else {
            window.location.href = '/';
          }
        }}
        isPublicShare={true}
        campaignCode={rawTarget}
      />
    </div>
  );
}

