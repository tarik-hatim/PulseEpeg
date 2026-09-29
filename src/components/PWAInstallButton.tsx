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
      <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[rgba(255,255,255,0.03)] border border-[#2A324B] text-[#94A3B8] text-xs font-medium">
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
        className="tv-focusable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(255,255,255,0.03)] hover:bg-[#1E293B]/60 text-[#94A3B8] hover:text-white border border-[#2A324B] text-xs font-semibold transition-all cursor-pointer shrink-0"
        title={tr.installApp}
      >
        <Download className="w-3.5 h-3.5 text-[#94A3B8]" />
        <span className="hidden sm:inline">{tr.installApp}</span>
      </button>

      {showHelperModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0B0F17]/85 backdrop-blur-sm"
          onClick={() => setShowHelperModal(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-[#131927] border border-[#1E2638] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#0B0F17] border border-[#2A324B] text-white">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-white text-base">
                  {tr.pwaModalTitle}
                </h3>
              </div>
              <button
                onClick={() => setShowHelperModal(false)}
                data-tv-focusable="true"
                className="tv-focusable p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-[#1E293B] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#94A3B8] leading-relaxed mb-4">
              {tr.pwaModalDesc}
            </p>

            <div className="space-y-2.5 text-xs text-[#94A3B8] bg-[#0B0F17] p-3.5 rounded-lg border border-[#1E2638]">
              <div className="flex items-start gap-2">
                <span className="font-bold text-white">• Android / Chrome :</span>
                <span>{tr.pwaAndroidStep}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-white">• iOS / Safari :</span>
                <span className="inline-flex items-center gap-1 flex-wrap">
                  <Share className="w-3.5 h-3.5 text-[#3B82F6] inline" />{' '}
                  {tr.pwaIosStep}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-white">• PC / Mac / TV :</span>
                <span>{tr.pwaPcStep}</span>
              </div>
            </div>

            <button
              onClick={() => setShowHelperModal(false)}
              data-tv-focusable="true"
              className="tv-focusable mt-4 w-full py-2 rounded-lg bg-[#1E293B] border-[1.5px] border-[#3B82F6] text-white font-bold text-xs transition-colors cursor-pointer"
            >
              {tr.understood}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
