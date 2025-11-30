'use client';

import { useEffect, useState, useCallback } from 'react';
import { Download, X, Smartphone, Share, Plus, ExternalLink, Chrome, ArrowUp } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type BrowserType = 'chrome' | 'firefox' | 'safari' | 'edge' | 'samsung' | 'opera' | 'other';
type PlatformType = 'ios' | 'android' | 'desktop' | 'other';

interface DeviceInfo {
  browser: BrowserType;
  platform: PlatformType;
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isStandalone: boolean;
  supportsInstall: boolean;
}

function detectDevice(): DeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      browser: 'other',
      platform: 'other',
      isIOS: false,
      isAndroid: false,
      isMobile: false,
      isStandalone: false,
      supportsInstall: false,
    };
  }

  const ua = navigator.userAgent.toLowerCase();
  const vendor = navigator.vendor?.toLowerCase() || '';

  // Platform detection
  const isIOS = /iphone|ipad|ipod/.test(ua) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(ua);
  const isMobile = isIOS || isAndroid || /mobile/.test(ua);
  
  // Browser detection
  let browser: BrowserType = 'other';
  if (/edg/.test(ua)) browser = 'edge';
  else if (/opr|opera|opios/.test(ua)) browser = 'opera';
  else if (/samsungbrowser/.test(ua)) browser = 'samsung';
  else if (/firefox|fxios/.test(ua)) browser = 'firefox';
  else if (/safari/.test(ua) && !/chrome/.test(ua)) browser = 'safari';
  else if (/chrome|crios/.test(ua) || vendor.includes('google')) browser = 'chrome';
  
  // Check if Opera Mini (limited PWA support)
  const isOperaMini = /opera mini/i.test(ua);

  // Platform type
  const platform: PlatformType = isIOS ? 'ios' : isAndroid ? 'android' : isMobile ? 'other' : 'desktop';

  // Standalone detection
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://') ||
    new URLSearchParams(window.location.search).get('source') === 'pwa';

  // Check if browser supports install prompt
  const supportsInstall = 'BeforeInstallPromptEvent' in window || 
    (browser === 'chrome' && !isIOS) || 
    (browser === 'edge' && !isIOS) ||
    (browser === 'opera' && !isIOS && !isOperaMini) ||
    (browser === 'samsung');

  return {
    browser,
    platform,
    isIOS,
    isAndroid,
    isMobile,
    isStandalone,
    supportsInstall,
  };
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [showExpandedInstructions, setShowExpandedInstructions] = useState(false);

  useEffect(() => {
    const info = detectDevice();
    setDeviceInfo(info);

    // If already installed, don't show anything
    if (info.isStandalone) {
      return;
    }

    // Check if user recently dismissed
    try {
      const dismissedTime = localStorage.getItem('pwa-prompt-dismissed');
      if (dismissedTime) {
        const parsedTime = parseInt(dismissedTime, 10);
        if (!isNaN(parsedTime)) {
          const timeSinceDismissed = Date.now() - parsedTime;
          const fourHours = 4 * 60 * 60 * 1000;
          if (timeSinceDismissed < fourHours) {
            return;
          }
        }
      }
    } catch {
      // localStorage access failed, continue showing prompt
    }

    // Handle native install prompt (Chrome, Edge, Samsung, Opera on Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after a short delay
      setTimeout(() => setShowPrompt(true), 2000);
    };

    // Listen for the beforeinstallprompt event
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for app installed event
    const handleAppInstalled = () => {
      setShowPrompt(false);
      setDeferredPrompt(null);
      localStorage.removeItem('pwa-prompt-dismissed');
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    // For browsers that don't fire beforeinstallprompt (like Safari iOS), show manual instructions
    // Only show if: not standalone, doesn't support native install, and is on iOS/Safari
    const fallbackTimer = setTimeout(() => {
      if (!deferredPrompt && !info.supportsInstall) {
        // Only show manual install instructions for browsers that don't support native prompt
        // This includes Safari on iOS, Opera Mini, and Firefox on desktop
        if (info.isIOS || (info.browser === 'firefox' && !info.isAndroid) || info.browser === 'opera') {
          setShowPrompt(true);
        }
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        
        if (outcome === 'accepted') {
          setShowPrompt(false);
        }
      } catch (e) {
        console.error('[PWA] Install prompt failed:', e);
      }
      setDeferredPrompt(null);
    } else {
      // Show expanded instructions for manual install
      setShowExpandedInstructions(true);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    setShowExpandedInstructions(false);
    try {
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString());
    } catch {
      // Storage access failed, dismiss without persisting
    }
  }, []);

  // Don't render if already installed or info not loaded
  if (!deviceInfo || deviceInfo.isStandalone || !showPrompt) {
    return null;
  }

  // Render expanded installation instructions
  if (showExpandedInstructions) {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          <div className="bg-gradient-to-r from-violet-600 to-purple-600 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-bold text-white">Install EduDash Pro</h3>
              </div>
              <button
                onClick={handleDismiss}
                className="p-2 hover:bg-white/20 rounded-full transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>
          </div>
          
          <div className="p-5 space-y-4">
            {/* iOS Safari Instructions */}
            {deviceInfo.isIOS && deviceInfo.browser === 'safari' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">1</div>
                  <div className="flex items-center gap-2">
                    <span>Tap the</span>
                    <div className="inline-flex items-center justify-center w-7 h-7 bg-slate-700 rounded">
                      <Share className="w-4 h-4" />
                    </div>
                    <span>Share button</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">2</div>
                  <span>Scroll down and tap &quot;Add to Home Screen&quot;</span>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">3</div>
                  <span>Tap &quot;Add&quot; in the top right</span>
                </div>
              </div>
            )}

            {/* iOS Chrome Instructions */}
            {deviceInfo.isIOS && deviceInfo.browser === 'chrome' && (
              <div className="space-y-3">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-300 text-sm">
                  <strong>Tip:</strong> For the best experience on iOS, open this page in Safari
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">1</div>
                  <div className="flex items-center gap-2">
                    <span>Tap the</span>
                    <div className="inline-flex items-center justify-center w-7 h-7 bg-slate-700 rounded">
                      <ExternalLink className="w-4 h-4" />
                    </div>
                    <span>Share button</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">2</div>
                  <span>Select &quot;Open in Safari&quot;</span>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">3</div>
                  <span>Then follow the Safari instructions</span>
                </div>
              </div>
            )}

            {/* Android Chrome/Edge Instructions */}
            {deviceInfo.isAndroid && (deviceInfo.browser === 'chrome' || deviceInfo.browser === 'edge') && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">1</div>
                  <div className="flex items-center gap-2">
                    <span>Tap the menu</span>
                    <div className="inline-flex items-center justify-center w-7 h-7 bg-slate-700 rounded font-bold">⋮</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">2</div>
                  <span>Tap &quot;Install app&quot; or &quot;Add to Home screen&quot;</span>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">3</div>
                  <span>Tap &quot;Install&quot; to confirm</span>
                </div>
              </div>
            )}

            {/* Android Firefox Instructions */}
            {deviceInfo.isAndroid && deviceInfo.browser === 'firefox' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">1</div>
                  <div className="flex items-center gap-2">
                    <span>Tap the menu</span>
                    <div className="inline-flex items-center justify-center w-7 h-7 bg-slate-700 rounded font-bold">⋮</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">2</div>
                  <span>Tap &quot;Install&quot;</span>
                </div>
              </div>
            )}

            {/* Samsung Internet Instructions */}
            {deviceInfo.browser === 'samsung' && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">1</div>
                  <div className="flex items-center gap-2">
                    <span>Tap the menu</span>
                    <div className="inline-flex items-center justify-center w-7 h-7 bg-slate-700 rounded">☰</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">2</div>
                  <span>Tap &quot;Add page to&quot; → &quot;Home screen&quot;</span>
                </div>
              </div>
            )}

            {/* Opera / Opera Mini Instructions */}
            {deviceInfo.browser === 'opera' && (
              <div className="space-y-3">
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-amber-300 text-sm">
                  <strong>Note:</strong> Opera Mini has limited PWA support. For the best experience, use Chrome or the standard Opera browser.
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">1</div>
                  <div className="flex items-center gap-2">
                    <span>Tap the menu</span>
                    <div className="inline-flex items-center justify-center w-7 h-7 bg-slate-700 rounded font-bold">⋮</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">2</div>
                  <span>Tap &quot;Add to Home screen&quot; or &quot;Add to...&quot;</span>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">3</div>
                  <span>Tap &quot;Add&quot; to confirm</span>
                </div>
              </div>
            )}

            {/* Desktop Chrome/Edge Instructions */}
            {deviceInfo.platform === 'desktop' && (deviceInfo.browser === 'chrome' || deviceInfo.browser === 'edge') && (
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">1</div>
                  <div className="flex items-center gap-2">
                    <span>Look for the install icon</span>
                    <div className="inline-flex items-center justify-center w-7 h-7 bg-slate-700 rounded">
                      <Plus className="w-4 h-4" />
                    </div>
                    <span>in the address bar</span>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-200">
                  <div className="w-8 h-8 bg-violet-500/20 rounded-lg flex items-center justify-center text-sm font-bold text-violet-400">2</div>
                  <span>Click &quot;Install&quot; in the popup</span>
                </div>
              </div>
            )}

            {/* Generic fallback instructions */}
            {!deviceInfo.isIOS && !deviceInfo.isAndroid && deviceInfo.browser !== 'chrome' && deviceInfo.browser !== 'edge' && (
              <div className="space-y-3">
                <div className="bg-slate-800 rounded-lg p-3 text-slate-300 text-sm">
                  <p>Look for an &quot;Install&quot; or &quot;Add to Home Screen&quot; option in your browser menu.</p>
                </div>
              </div>
            )}

            {/* Benefits section */}
            <div className="pt-3 border-t border-slate-700">
              <p className="text-sm text-slate-400 mb-2">Installing gives you:</p>
              <ul className="space-y-1 text-sm text-slate-300">
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Instant access from home screen
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Push notifications for messages
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Offline access to cached content
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-green-400">✓</span> Native app-like experience
                </li>
              </ul>
            </div>
          </div>

          <div className="p-4 pt-0">
            <button
              onClick={handleDismiss}
              className="w-full py-3 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors text-sm"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Compact install prompt banner
  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-slide-up">
      <div className="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl shadow-2xl p-4 text-white max-w-lg mx-auto">
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Smartphone className="w-6 h-6" />
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-base sm:text-lg">Install EduDash Pro</h3>
            <p className="text-sm text-violet-200 truncate">
              {deviceInfo.isIOS 
                ? 'Add to Home Screen for the best experience' 
                : 'Get notifications & quick access'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInstallClick}
              className="px-5 py-2.5 bg-white text-violet-700 font-bold rounded-xl hover:bg-violet-100 transition-colors text-sm whitespace-nowrap shadow-lg shadow-black/20 border-2 border-white/50"
            >
              {deferredPrompt ? 'Install' : 'How'}
            </button>
            <button
              onClick={handleDismiss}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.4s ease-out;
        }
      `}</style>
    </div>
  );
}
