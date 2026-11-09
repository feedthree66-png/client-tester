import React, { useEffect, useState } from 'react';
import { Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const PWAInstallButton: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled) {
    return null;
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
      return;
    }
    setShowGuide(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-xl hover:bg-emerald-500/20 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
        <span>Add to Home Screen</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-mono font-bold text-xs">
                $X
              </div>
              <div>
                <h3 className="text-base font-bold text-white font-display">
                  Pasang Aplikasi "DollarX"
                </h3>
                <span className="text-[11px] text-emerald-400 font-mono font-semibold">
                  PWA Home Screen Shortcut
                </span>
              </div>
            </div>

            <div className="text-xs text-slate-300 space-y-2 leading-relaxed bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <p>
                <strong className="text-white">iPhone / iOS (Safari):</strong>{' '}
                Tekan ikon <strong className="text-emerald-400">Share</strong> di
                bar bawah Safari, kemudian pilih{' '}
                <strong className="text-emerald-400">
                  "Add to Home Screen"
                </strong>
                . Nama aplikasi akan terpapar secara automatik sebagai{' '}
                <strong className="text-white">DollarX</strong>.
              </p>
              <p>
                <strong className="text-white">Android (Chrome):</strong> Tekan
                menu 3 titik di penjuru atas pelayar dan pilih{' '}
                <strong className="text-emerald-400">
                  "Add to Home screen"
                </strong>{' '}
                atau <strong className="text-emerald-400">"Install app"</strong>.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors cursor-pointer"
            >
              Faham & Tutup
            </button>
          </div>
        </div>
      )}
    </>
  );
};
