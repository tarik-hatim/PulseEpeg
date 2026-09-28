import React, { useEffect, useState } from 'react';
import { Check, Download, Share, Smartphone, X } from 'lucide-react';
import { AppLanguage } from '../types/epg';
import { getActiveLanguage, getTranslations } from '../utils/i18n';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

interface PWAInstallButtonProps {
  language?: AppLanguage;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  language,
}) => {
  const activeLang = language || getActiveLanguage();
  const tr = getTranslations(activeLang);

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showHelperModal, setShowHelperModal] = useState(false);

  useEffect(() => {
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true
    ) {
      setIsInstalled(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowHelperModal(false);
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
    return (
      <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 text-xs font-medium">
        <Check className="w-3.5 h-3.5" />
        <span>{tr.pwaActive}</span>
      </div>
    );
  }

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
      }
    } else {
      setShowHelperModal(true);
    }
  };

  return (
    <>
      <button
        onClick={handleInstallClick}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/35 text-xs font-semibold transition-all cursor-pointer shrink-0"
        title={tr.installApp}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{tr.installApp}</span>
      </button>

      {showHelperModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm"
          onClick={() => setShowHelperModal(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">
                  {tr.pwaModalTitle}
                </h3>
              </div>
              <button
                onClick={() => setShowHelperModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              {tr.pwaModalDesc}
            </p>

            <div className="space-y-2.5 text-xs text-slate-300 bg-slate-950/80 p-3.5 rounded-xl border border-slate-800">
              <div className="flex items-start gap-2">
                <span className="font-bold text-amber-400">• Android / Chrome :</span>
                <span>{tr.pwaAndroidStep}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-amber-400">• iOS / Safari :</span>
                <span className="inline-flex items-center gap-1 flex-wrap">
                  <Share className="w-3.5 h-3.5 text-sky-400 inline" />{' '}
                  {tr.pwaIosStep}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-amber-400">• PC / Mac :</span>
                <span>{tr.pwaPcStep}</span>
              </div>
            </div>

            <button
              onClick={() => setShowHelperModal(false)}
              className="mt-4 w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
            >
              {tr.understood}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
