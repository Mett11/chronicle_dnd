import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { initTheme } from './lib/theme';
import { initPwa } from './lib/pwa';
import { CampaignManager } from './store/campaignStore';
import { SessionMemorySyncService } from './lib/sessionMemorySyncService';
import { LocalStorageMigrationService } from './lib/localStorageMigrationService';
import { MapFolderService } from './lib/mapFolderService';

// Run deduplication & migration of legacy localStorage keys at app boot
LocalStorageMigrationService.runMigrations();

// Expose on window for easy inspection and console debugging.
if (typeof window !== 'undefined') {
  (window as any).CampaignManager = CampaignManager;
  (window as any).SessionMemorySyncService = SessionMemorySyncService;
  (window as any).MapFolderService = MapFolderService;
}

// Initialize class theme & PWA service worker
initTheme();
initPwa();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);


