/**
 * PWA Installation Helper & Service Worker Registration
 */

let deferredPrompt: any = null;
const listeners = new Set<() => void>();

export interface PwaStatus {
  isInstallable: boolean;
  isStandalone: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isWindows: boolean;
  platformName: string;
}

export function initPwa() {
  if (typeof window === 'undefined') return;

  // 1. Build Version Check: Purge stale CacheStorage if a new build is deployed
  try {
    const currentBuild = import.meta.env.VITE_APP_BUILD_TIME || 'v2';
    const savedBuild = localStorage.getItem('chronicle_app_build_version');

    if (savedBuild && savedBuild !== currentBuild) {
      console.log('[PWA] New build version detected:', currentBuild, '(was:', savedBuild, '). Purging stale asset cache...');
      localStorage.setItem('chronicle_app_build_version', currentBuild);
      
      // Clear static CacheStorage assets without touching user account credentials in LocalStorage or Firebase Auth
      if ('caches' in window) {
        caches.keys().then((keys) => {
          Promise.all(keys.map((k) => caches.delete(k))).then(() => {
            console.log('[PWA] Stale asset cache successfully purged. Reloading app assets...');
            window.location.reload();
          });
        });
        return;
      }
    } else if (!savedBuild) {
      localStorage.setItem('chronicle_app_build_version', currentBuild);
    }
  } catch (e) {
    console.warn('[PWA] Version check warning:', e);
  }

  // 2. Register Service Worker with Auto-Update on new version
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[PWA] ServiceWorker registered with scope:', reg.scope);

          // Force check for SW update on page load
          reg.update().catch(() => {});

          // Handle new SW installation
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] New version installed and ready. Skip waiting...');
                  installingWorker.postMessage({ type: 'SKIP_WAITING' });
                }
              };
            }
          };
        })
        .catch((err) => {
          console.warn('[PWA] ServiceWorker registration failed:', err);
        });

      // Reload page seamlessly when new SW activates (user stays logged in)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!refreshing) {
          refreshing = true;
          console.log('[PWA] Controller changed. Reloading page with fresh assets...');
          window.location.reload();
        }
      });
    });
  }

  // Capture beforeinstallprompt for Windows / Chrome / Android
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    notifyListeners();
    console.log('[PWA] beforeinstallprompt captured');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notifyListeners();
    console.log('[PWA] App successfully installed');
  });
}

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

export function subscribePwa(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function getPwaStatus(): PwaStatus {
  if (typeof window === 'undefined') {
    return {
      isInstallable: false,
      isStandalone: false,
      isIOS: false,
      isAndroid: false,
      isWindows: false,
      platformName: 'Browser',
    };
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  const isWindows = /windows|win32|win64/.test(ua);

  let platformName = 'Desktop / Browser';
  if (isWindows) platformName = 'Windows Desktop';
  else if (isAndroid) platformName = 'Android';
  else if (isIOS) platformName = 'Apple iOS (iPhone/iPad)';
  else if (/macintosh|mac os x/.test(ua)) platformName = 'macOS';

  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://');

  const isInstallable = Boolean(deferredPrompt) || (isIOS && !isStandalone);

  return {
    isInstallable,
    isStandalone,
    isIOS,
    isAndroid,
    isWindows,
    platformName,
  };
}

export async function promptPwaInstall(): Promise<'accepted' | 'dismissed' | 'manual_ios' | 'unsupported'> {
  if (deferredPrompt) {
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        deferredPrompt = null;
        notifyListeners();
        return 'accepted';
      }
      return 'dismissed';
    } catch (e) {
      console.warn('[PWA] Install prompt error:', e);
      return 'unsupported';
    }
  }

  const status = getPwaStatus();
  if (status.isIOS && !status.isStandalone) {
    return 'manual_ios';
  }

  return 'unsupported';
}
