import React, { useEffect, useState } from 'react';
import { Check, Download, Share, X } from 'lucide-react';
import { AppLanguage } from '../types/epg';
import { getActiveLanguage, getTranslations } from '../utils/i18n';
import { PulseEpgLogo } from './PulseEpgLogo';

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
      <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#141a26] border border-[#1a202c] text-[#cbd5e1] text-xs font-medium">
        <Check className="w-3.5 h-3.5 text-emerald-400" />
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
        data-tv-focusable="true"
        className="tv-focusable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-[#e11d48] to-[#be123c] hover:from-[#ff0033] hover:to-[#e11d48] text-[#ffffff] border border-[#ff0033] shadow-[0_0_12px_rgba(225,29,72,0.4)] text-xs font-bold transition-all cursor-pointer shrink-0"
        title={tr.installApp}
      >
        <Download className="w-3.5 h-3.5 text-[#ffffff]" />
        <span className="inline">{tr.installApp}</span>
      </button>

      {showHelperModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0a0e17]/85 backdrop-blur-sm"
          onClick={() => setShowHelperModal(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-[#141a26] border border-[#1a202c] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <PulseEpgLogo adaptiveTerminalSize={false} className="w-11 h-11" />
                <div>
                  <h3 className="font-bold text-[#ffffff] text-base">
                    {tr.pwaModalTitle}
                  </h3>
                  <p className="text-[11px] text-[#38bdf8] font-medium">
                    Android Smartphone · Tablette · Android TV &amp; Box
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHelperModal(false)}
                data-tv-focusable="true"
                className="tv-focusable p-1.5 rounded-lg text-[#cbd5e1] hover:text-[#ffffff] hover:bg-[#1a202c] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#cbd5e1] leading-relaxed mb-4">
              {tr.pwaModalDesc}
            </p>

            <div className="space-y-2.5 text-xs text-[#cbd5e1] bg-[#0a0e17] p-3.5 rounded-lg border border-[#1a202c]">
              <div className="flex items-start gap-2">
                <span className="font-bold text-[#ffffff]">• Android / Chrome :</span>
                <span>{tr.pwaAndroidStep}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-[#ffffff]">• iOS / Safari :</span>
                <span className="inline-flex items-center gap-1 flex-wrap">
                  <Share className="w-3.5 h-3.5 text-[#0055ff] inline" />{' '}
                  {tr.pwaIosStep}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-[#ffffff]">• Android TV / Box :</span>
                <span>{tr.pwaPcStep}</span>
              </div>
            </div>

            <button
              onClick={() => setShowHelperModal(false)}
              data-tv-focusable="true"
              className="tv-focusable mt-4 w-full py-2.5 rounded-lg bg-[#e11d48] hover:bg-[#ff0033] border border-[#ff0033] text-[#ffffff] font-bold text-xs shadow-[0_0_12px_rgba(225,29,72,0.45)] transition-colors cursor-pointer"
            >
              {tr.understood}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
