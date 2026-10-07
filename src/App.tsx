/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './components/AuthProvider';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { Sessions } from './pages/Sessions';
import { Storyline } from './pages/Storyline';
import { CalendarPage } from './pages/Calendar';
import { Entities } from './pages/Entities';
import { Settings } from './pages/Settings';
import { WorldMap } from './pages/WorldMap';
import { CharacterProfile } from './pages/CharacterProfile';
import { Oracle } from './pages/Oracle';
import { WorldLore } from './pages/WorldLore';
import { Clarifications } from './pages/Clarifications';
import { Tutorial } from './pages/Tutorial';
import { SanityLogin } from './components/SanityLogin';
import { CampaignGate } from './components/CampaignGate';
import { CampaignManager } from './store/campaignStore';
import { CloudSyncService } from './lib/cloudSync';
import { PublicPresentationView } from './pages/PublicPresentationView';

import { Skeleton, SkeletonCard } from './components/Skeleton';
import { AtmosphericLoader } from './components/AtmosphericLoader';

function AppContent() {
  // Public standalone Presentation Routes (Zero Auth / Direct Guest Access)
  const isPresentationRoute = typeof window !== 'undefined' && (
    window.location.pathname.startsWith('/presentation') ||
    window.location.pathname.startsWith('/share') ||
    window.location.pathname.startsWith('/storyline/presentation')
  );

  if (isPresentationRoute) {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/presentation/:campaignName/:reversedCode" element={<PublicPresentationView />} />
          <Route path="/presentation/:campaignCode" element={<PublicPresentationView />} />
          <Route path="/presentation" element={<PublicPresentationView />} />
          <Route path="/share/:campaignName/:reversedCode" element={<PublicPresentationView />} />
          <Route path="/share/:campaignCode" element={<PublicPresentationView />} />
          <Route path="/share" element={<PublicPresentationView />} />
          <Route path="/storyline/presentation/:campaignName/:reversedCode" element={<PublicPresentationView />} />
          <Route path="/storyline/presentation/:campaignCode" element={<PublicPresentationView />} />
          <Route path="*" element={<PublicPresentationView />} />
        </Routes>
      </BrowserRouter>
    );
  }

  const { player, loading } = useAuth();
  // Always start on Campaign Portal list on boot/login
  const [campaignCode, setCampaignCode] = useState<string | null>(null);
  const [, setForceTick] = useState(0);

  // Capture invite link (?join=CODE or #join=CODE)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const pendingCode = searchParams.get('join') || searchParams.get('campaign') || hashParams.get('join');
      if (pendingCode) {
        const clean = pendingCode.trim().toUpperCase();
        localStorage.setItem('chronicle_pending_join_code', clean);
      }
    } catch {}
  }, []);

  // Pre-hydrate high-capacity IndexedDB cache on initial boot
  useEffect(() => {
    CampaignManager.hydrateFromIndexedDb().then(() => {
      setForceTick((p) => p + 1);
    });
  }, []);

  // Sync state if player or auth status changes (reset to Campaign Portal on login/logout)
  useEffect(() => {
    // Keep campaignCode as null on login to show the Campaign Portal list
  }, [player]);

  // Listen to campaign switch events (e.g. "Cambia Campagna", login, logout)
  useEffect(() => {
    const handleCampaignChange = (e: any) => {
      const code = e?.detail?.campaignCode !== undefined ? e.detail.campaignCode : CampaignManager.getActiveCampaignCode();
      setCampaignCode(code);
    };
    const handleCampaignsListUpdate = () => {
      setCampaignCode((current) => {
        if (!current) return null;
        const active = CampaignManager.getActiveCampaignCode();
        return current === active ? current : active;
      });
    };

    window.addEventListener('chronicle_campaign_changed', handleCampaignChange);
    window.addEventListener('chronicle_campaigns_updated', handleCampaignsListUpdate);
    window.addEventListener('chronicle_accounts_updated', handleCampaignsListUpdate);

    return () => {
      window.removeEventListener('chronicle_campaign_changed', handleCampaignChange);
      window.removeEventListener('chronicle_campaigns_updated', handleCampaignsListUpdate);
      window.removeEventListener('chronicle_accounts_updated', handleCampaignsListUpdate);
    };
  }, []);

  const [isCampaignHydrating, setIsCampaignHydrating] = useState(false);
  const lastHydratedCampaignRef = useRef<string | null>(null);

  // Initialize Real-Time Cloud Sync when a campaign is active
  useEffect(() => {
    let safetyTimer: any = null;
    if (campaignCode) {
      if (lastHydratedCampaignRef.current === campaignCode) {
        setIsCampaignHydrating(false);
        return;
      }
      lastHydratedCampaignRef.current = campaignCode;

      setIsCampaignHydrating(true);
      // Safety timeout: Never leave user stuck on loading spinner for more than 4 seconds
      safetyTimer = setTimeout(() => {
        setIsCampaignHydrating(false);
      }, 4000);

      CloudSyncService.init(() => {
        if (safetyTimer) clearTimeout(safetyTimer);
        setIsCampaignHydrating(false);
      });
    } else {
      lastHydratedCampaignRef.current = null;
      setIsCampaignHydrating(false);
      CloudSyncService.stop();
    }
    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
    };
  }, [campaignCode]);

  if (loading) {
    return (
      <AtmosphericLoader
        title="Cronache di Campagna"
        subtitle="Inizializzazione Grimorio Cloud..."
      />
    );
  }

  if (!player) {
    return <SanityLogin />;
  }

  if (!campaignCode) {
    return (
      <CampaignGate onEnter={(code) => {
        CampaignManager.setActiveCampaignCode(code);
        setCampaignCode(code);
        try {
          const uId = player?._id || (player as any)?.id || CampaignManager.getCurrentAccount()?.id || 'anon';
          const hasSeen = localStorage.getItem(`chronicle_tutorial_seen_${uId}`) === 'true';
          const target = hasSeen ? '/character' : '/tutorial';
          if (window.location.pathname === '/' || window.location.pathname === '/notes') {
            window.history.replaceState(null, '', target);
          }
        } catch {}
      }} />
    );
  }

  if (isCampaignHydrating) {
    return (
      <AtmosphericLoader
        title="Sincronizzazione della Campagna"
        subtitle="Risveglio Database Supabase in corso..."
      />
    );
  }

  const currentUId = player?._id || (player as any)?.id || CampaignManager.getCurrentAccount()?.id || 'anon';
  const hasSeenTutorial = typeof localStorage !== 'undefined' ? localStorage.getItem(`chronicle_tutorial_seen_${currentUId}`) === 'true' : true;
  const defaultEntryPath = hasSeenTutorial ? '/character' : '/tutorial';

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to={defaultEntryPath} replace />} />
          <Route path="/tutorial" element={<Tutorial />} />
          <Route path="/guida" element={<Tutorial />} />
          <Route path="/manuale" element={<Tutorial />} />
          <Route path="/notes" element={<Home />} />
          <Route path="/storyline" element={<Storyline />} />
          <Route path="/storyline/:chapterSlug" element={<Storyline />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/sessions" element={<Sessions />} />
          <Route path="/sessions/:id" element={<Sessions />} />
          <Route path="/map" element={<WorldMap />} />
          <Route path="/search" element={<Search />} />
          <Route path="/codex" element={<Entities />} />
          <Route path="/codex/:type" element={<Entities />} />
          <Route path="/codex/:type/:id" element={<Entities />} />
          <Route path="/entities" element={<Entities />} />
          <Route path="/entities/:type" element={<Entities />} />
          <Route path="/entities/:type/:id" element={<Entities />} />
          <Route path="/world-lore" element={<WorldLore />} />
          <Route path="/world-lore/:id" element={<WorldLore />} />
          <Route path="/lore" element={<Navigate to="/world-lore" replace />} />
          <Route path="/oracle" element={<Oracle />} />
          <Route path="/sendipietra" element={<Oracle />} />
          <Route path="/prismalink" element={<Oracle />} />
          <Route path="/oracolo" element={<Navigate to="/sendipietra" replace />} />
          <Route path="/clarifications" element={<Clarifications />} />
          <Route path="/chiarimenti" element={<Clarifications />} />
          <Route path="/character" element={<CharacterProfile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/presentation/:campaignName/:reversedCode" element={<PublicPresentationView />} />
          <Route path="/presentation/:campaignCode" element={<PublicPresentationView />} />
          <Route path="/presentation" element={<PublicPresentationView />} />
          <Route path="/share/:campaignName/:reversedCode" element={<PublicPresentationView />} />
          <Route path="/share/:campaignCode" element={<PublicPresentationView />} />
          <Route path="/storyline/presentation/:campaignName/:reversedCode" element={<PublicPresentationView />} />
          <Route path="/storyline/presentation/:campaignCode" element={<PublicPresentationView />} />
          <Route path="*" element={<Navigate to="/character" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
