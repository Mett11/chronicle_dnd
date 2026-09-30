import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CampaignManager } from '../store/campaignStore';
import { StorylineFullscreenViewer, StorylineSlide } from '../components/StorylineFullscreenViewer';
import { Film, Sparkles, Compass, AlertCircle, RefreshCw } from 'lucide-react';
import { Session, CampaignChapter } from '../types';
import { extractTextFromContent, safeString } from '../lib/sanitize';
import { generateCampaignShareToken, slugifyCampaignTitle } from '../lib/shareToken';

function withTimeout<T>(promise: Promise<T>, timeoutMs = 4000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout caricamento presentazione.')), timeoutMs)),
  ]);
}

async function extractPresentationFromSnap(publicSnap: any, targetDocId: string) {
  const publicData = publicSnap.data();
  let pSessions = Array.isArray(publicData?.sessions) ? publicData.sessions : [];
  const pChapters = Array.isArray(publicData?.chapters) ? publicData.chapters : [];
  const chunkCount = publicData?._mediaChunkCount || 0;
  const primaryDocId = publicData?.slug || targetDocId;

  if (chunkCount > 0) {
    try {
      const chunkPromises: Promise<any>[] = [];
      for (let i = 0; i < chunkCount; i++) {
        chunkPromises.push(withTimeout(getDoc(doc(db, 'public_presentations', `${primaryDocId}__chunk_${i}`)), 3000));
        if (targetDocId && targetDocId !== primaryDocId) {
          chunkPromises.push(withTimeout(getDoc(doc(db, 'public_presentations', `${targetDocId}__chunk_${i}`)), 3000));
        }
      }
      const chunkSnaps = await Promise.allSettled(chunkPromises);
      const aggregatedSessionMedia: Record<string, string[]> = {};

      chunkSnaps.forEach((res) => {
        if (res.status === 'fulfilled' && res.value.exists()) {
          const cData = res.value.data();
          if (cData.sessionMedia) {
            Object.assign(aggregatedSessionMedia, cData.sessionMedia);
          }
        }
      });

      pSessions = pSessions.map((s: any) => {
        const chunkImgs = aggregatedSessionMedia[s._id];
        const combinedImgs = (chunkImgs && chunkImgs.length > 0)
          ? chunkImgs
          : (s.images || []);
        return {
          ...s,
          images: combinedImgs,
          coverImage: s.coverImage || combinedImgs[0] || '',
        };
      });
    } catch (chunkErr) {
      console.warn('[PublicPresentation] Chunk restore warn:', chunkErr);
    }
  }

  return {
    sessions: pSessions,
    chapters: pChapters,
    campaignTitle: publicData?.campaignTitle || 'Cronaca di Campagna',
  };
}

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

      // Fetch from Firestore
      try {
        const slugLower = rawTarget.toLowerCase();
        const upperCode = originalFromReversed || rawTarget.toUpperCase();

        // 1. Try public presentation document by composite slug or slug
        let slugSnap: any = null;
        const candidateDocIds = Array.from(new Set([
          compositeSlug,
          slugLower,
          campaignName ? slugifyCampaignTitle(campaignName) : '',
          originalFromReversed,
          upperCode,
        ].filter(Boolean)));

        for (const docId of candidateDocIds) {
          try {
            const snap = await withTimeout(getDoc(doc(db, 'public_presentations', docId)), 3000);
            if (snap && snap.exists()) {
              slugSnap = snap;
              break;
            }
          } catch {}
        }

        if (slugSnap && slugSnap.exists()) {
          const res = await extractPresentationFromSnap(slugSnap, slugLower);
          const resHasArtwork = res.sessions.some((s: any) => (s.images && s.images.length > 0) || s.coverImage);

          if (isMounted) {
            if (!resHasArtwork && localSessions && localSessions.length > 0 && localHasArtwork) {
              setSessions(localSessions);
              setChapters(localChapters || res.chapters);
              setCampaignTitle(localMeta?.name || res.campaignTitle);
            } else {
              setSessions(res.sessions);
              setChapters(res.chapters);
              setCampaignTitle(res.campaignTitle);
            }
            setLoading(false);
          }
          return;
        }

        // 1b. Try raw target as-is (e.g. legacy token p_...)
        if (rawTarget !== slugLower) {
          const rawDocRef = doc(db, 'public_presentations', rawTarget);
          let rawSnap: any = null;
          try {
            rawSnap = await withTimeout(getDoc(rawDocRef), 3500);
          } catch {}

          if (rawSnap && rawSnap.exists()) {
            const res = await extractPresentationFromSnap(rawSnap, rawTarget);
            if (isMounted) {
              setSessions(res.sessions);
              setChapters(res.chapters);
              setCampaignTitle(res.campaignTitle);
              setLoading(false);
            }
            return;
          }
        }

        // 1c. Try uppercase code or generated token
        const computedToken = generateCampaignShareToken(upperCode);
        if (computedToken) {
          const altDocRef = doc(db, 'public_presentations', computedToken);
          let altSnap: any = null;
          try {
            altSnap = await withTimeout(getDoc(altDocRef), 3500);
          } catch {}

          if (altSnap && altSnap.exists()) {
            const res = await extractPresentationFromSnap(altSnap, computedToken);
            if (isMounted) {
              setSessions(res.sessions);
              setChapters(res.chapters);
              setCampaignTitle(res.campaignTitle);
              setLoading(false);
            }
            return;
          }
        }

        // 2. Fallback to local sessions if available
        if (localSessions && localSessions.length > 0) {
          if (isMounted) {
            setSessions(localSessions);
            setChapters(localChapters || []);
            setCampaignTitle(localMeta?.name || 'Cronaca di Campagna');
            setLoading(false);
          }
          return;
        }

        // 2. Fallback to dnd_campaigns if accessible
        const docRef = doc(db, 'dnd_campaigns', upperCode);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const data = snap.data();
          let loadedSessions: Session[] = Array.isArray(data?.sessions) ? data.sessions : [];
          const meta = data?.campaignMeta;

          // Restore media and historical sessions from chunks if present
          if (data?._mediaChunkCount && data._mediaChunkCount > 0) {
            try {
              const chunkPromises: Promise<any>[] = [];
              for (let i = 0; i < data._mediaChunkCount; i++) {
                chunkPromises.push(getDoc(doc(db, 'dnd_campaigns', `${upperCode}__chunk_${i}`)));
              }
              const chunkSnaps = await Promise.all(chunkPromises);
              const chunkHistoricalSessions: any[] = [];
              const chunkSessionMedia: Record<string, any> = {};

              chunkSnaps.forEach((cSnap) => {
                if (cSnap.exists()) {
                  const cData = cSnap.data();
                  if (cData.sessionMedia) Object.assign(chunkSessionMedia, cData.sessionMedia);
                  if (Array.isArray(cData.historicalSessions)) chunkHistoricalSessions.push(...cData.historicalSessions);
                  if (Array.isArray(cData.sessions)) chunkHistoricalSessions.push(...cData.sessions);
                }
              });

              // Combine recent + historical sessions
              const sessionMap = new Map<string, any>();
              [...loadedSessions, ...chunkHistoricalSessions].forEach((s) => {
                if (s && s._id) sessionMap.set(s._id, s);
              });
              loadedSessions = Array.from(sessionMap.values());

              // Reattach images, coverImage, and event images
              loadedSessions = loadedSessions.map((s) => {
                const media = chunkSessionMedia[s._id];
                const sImages = (media && Array.isArray(media.images) && media.images.length > 0)
                  ? media.images
                  : (s.images || []);
                const sCover = media?.coverImage || s.coverImage;
                const sEvents = (s.events || []).map((evt: any) => {
                  const evtImgs = media?.eventImages?.[evt.id];
                  return {
                    ...evt,
                    images: (evtImgs && evtImgs.length > 0) ? evtImgs : (evt.images || []),
                  };
                });

                return {
                  ...s,
                  images: sImages,
                  coverImage: sCover,
                  events: sEvents,
                };
              });
            } catch (chunkErr) {
              console.warn('[PublicPresentation] Chunk fetch warn:', chunkErr);
            }
          }

          if (isMounted) {
            setSessions(loadedSessions);
            setCampaignTitle(meta?.name || 'Cronaca di Campagna');
            setLoading(false);
          }
          return;
        }

        if (isMounted) {
          setError('Nessuna cronaca pubblica trovata per questo link.');
          setLoading(false);
        }
      } catch (err: any) {
        console.error('[PublicPresentation] Fetch error:', err);
        if (isMounted) {
          setError(err?.message || 'Si è verificato un errore nel caricamento della cronaca.');
          setLoading(false);
        }
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

