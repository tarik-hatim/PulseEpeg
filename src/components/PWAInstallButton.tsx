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
      <div className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#121824] border border-[#1f293d] text-[#cbd5e1] text-xs font-medium">
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
        className="tv-focusable inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#121824] hover:bg-[#172033] text-[#cbd5e1] hover:text-[#ffffff] border border-[#1f293d] text-xs font-semibold transition-all cursor-pointer shrink-0"
        title={tr.installApp}
      >
        <Download className="w-3.5 h-3.5 text-[#cbd5e1]" />
        <span className="hidden sm:inline">{tr.installApp}</span>
      </button>

      {showHelperModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#090d14]/85 backdrop-blur-sm"
          onClick={() => setShowHelperModal(false)}
        >
          <div
            className="w-full max-w-md rounded-lg bg-[#121824] border border-[#1f293d] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#090d14] border border-[#1f293d] text-[#ffffff]">
                  <Smartphone className="w-5 h-5" />
                </div>
                <h3 className="font-bold text-[#ffffff] text-base">
                  {tr.pwaModalTitle}
                </h3>
              </div>
              <button
                onClick={() => setShowHelperModal(false)}
                data-tv-focusable="true"
                className="tv-focusable p-1.5 rounded-lg text-[#cbd5e1] hover:text-[#ffffff] hover:bg-[#172033] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[#cbd5e1] leading-relaxed mb-4">
              {tr.pwaModalDesc}
            </p>

            <div className="space-y-2.5 text-xs text-[#cbd5e1] bg-[#090d14] p-3.5 rounded-lg border border-[#1f293d]">
              <div className="flex items-start gap-2">
                <span className="font-bold text-[#ffffff]">• Android / Chrome :</span>
                <span>{tr.pwaAndroidStep}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-[#ffffff]">• iOS / Safari :</span>
                <span className="inline-flex items-center gap-1 flex-wrap">
                  <Share className="w-3.5 h-3.5 text-[#3b82f6] inline" />{' '}
                  {tr.pwaIosStep}
                </span>
              </div>
              <div className="flex items-start gap-2">
                <span className="font-bold text-[#ffffff]">• PC / Mac / TV :</span>
                <span>{tr.pwaPcStep}</span>
              </div>
            </div>

            <button
              onClick={() => setShowHelperModal(false)}
              data-tv-focusable="true"
              className="tv-focusable mt-4 w-full py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] border border-[#60a5fa] text-[#ffffff] font-bold text-xs shadow-[0_0_12px_rgba(37,99,235,0.45)] transition-colors cursor-pointer"
            >
              {tr.understood}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
