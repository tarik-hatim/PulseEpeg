import React, { useEffect, useState } from 'react';
import { Download, Monitor, Smartphone, Tablet, Tv } from 'lucide-react';
import { AppLanguage } from '../types/epg';

interface PulseEpgLogoProps {
  /**
   * If true, automatically scales the icon according to the active terminal:
   * - Smartphone: 36x36px (w-9 h-9)
   * - Tablette (sm/md): 40x40px / 44x44px (sm:w-10 sm:h-10 md:w-11 md:h-11)
   * - Android TV & TV Box (xl/2xl): 48x48px (xl:w-12 xl:h-12)
   */
  adaptiveTerminalSize?: boolean;
  className?: string;
  showWordmarkInside?: boolean;
}

/**
 * Netflix-inspired ("Netfly") 3D Folded Ribbon Emblem strictly respecting the PulseEPG color charter:
 * - Deep Studio Midnight Navy (#05070d -> #0a0e17)
 * - Hero Foreground 3D Folded Crimson Ribbon (#ff0033 -> #e11d48 -> #9f1239)
 * - Left Vertical Stem & Under-Fold in Royal Blue (#38bdf8 -> #0055ff -> #1d4ed8)
 * - Signature Pulse Wave in the lower-right counter
 */
export const PulseEpgLogo: React.FC<PulseEpgLogoProps> = ({
  adaptiveTerminalSize = true,
  className = '',
}) => {
  const uid = React.useId().replace(/:/g, '');
  const sizeClasses = adaptiveTerminalSize
    ? 'w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 xl:w-12 xl:h-12'
    : className || 'w-10 h-10';

  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 512 512"
      fill="none"
      style={{
        maxWidth: '200px',
        maxHeight: '200px',
        objectFit: 'contain',
        flexShrink: 0,
      }}
      className={`pulse-epg-logo-svg ${sizeClasses} shrink-0 rounded-[22%] shadow-[0_0_18px_rgba(225,29,72,0.32)] ${className}`}
      aria-label="PulseEPG Launcher Icon"
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#05070d" />
          <stop offset="50%" stopColor="#0a0e17" />
          <stop offset="100%" stopColor="#0f1524" />
        </linearGradient>
        <radialGradient id={`crimson-${uid}`} cx="56%" cy="34%" r="54%">
          <stop offset="0%" stopColor="#e11d48" stopOpacity="0.34" />
          <stop offset="100%" stopColor="#e11d48" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`blue-${uid}`} cx="32%" cy="72%" r="54%">
          <stop offset="0%" stopColor="#0055ff" stopOpacity="0.36" />
          <stop offset="100%" stopColor="#0055ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`stem-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="28%" stopColor="#0055ff" />
          <stop offset="72%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#0f2361" />
        </linearGradient>
        <linearGradient id={`under-${uid}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#e11d48" />
          <stop offset="32%" stopColor="#be123c" />
          <stop offset="68%" stopColor="#0055ff" />
          <stop offset="100%" stopColor="#172554" />
        </linearGradient>
        <linearGradient id={`hero-${uid}`} x1="0%" y1="0%" x2="95%" y2="90%">
          <stop offset="0%" stopColor="#ff335c" />
          <stop offset="34%" stopColor="#ff0033" />
          <stop offset="72%" stopColor="#e11d48" />
          <stop offset="100%" stopColor="#9f1239" />
        </linearGradient>
        <linearGradient id={`shadowTop-${uid}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#020409" stopOpacity="0.82" />
          <stop offset="55%" stopColor="#020409" stopOpacity="0.38" />
          <stop offset="100%" stopColor="#020409" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`shadowWaist-${uid}`} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#020409" stopOpacity="0.80" />
          <stop offset="65%" stopColor="#020409" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#020409" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`pulse-${uid}`} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="35%" stopColor="#0055ff" />
          <stop offset="70%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#ff0033" />
        </linearGradient>
        <linearGradient id={`rim-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff0033" stopOpacity="0.55" />
          <stop offset="50%" stopColor="#0055ff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#e11d48" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="114" fill={`url(#bg-${uid})`} />
      <rect width="512" height="512" rx="114" fill={`url(#crimson-${uid})`} />
      <rect width="512" height="512" rx="114" fill={`url(#blue-${uid})`} />
      <rect
        x="14"
        y="14"
        width="484"
        height="484"
        rx="102"
        fill="none"
        stroke={`url(#rim-${uid})`}
        strokeWidth="5"
      />

      {/* Plane 1: Left Vertical Stem (Royal Blue with Netflix-style curved bottom arch) */}
      <path
        d="M 128 92 C 128 81, 136 74, 147 74 H 200 C 210 74, 218 81, 218 92 V 430 Q 173 422, 128 438 Z"
        fill={`url(#stem-${uid})`}
      />

      {/* Plane 2: Lower Return Ribbon of the "P" Bowl (Under-Fold) */}
      <path
        d="M 314 184 H 404 C 404 274, 338 332, 232 332 H 176 V 248 H 232 C 284 248, 314 224, 314 196 Z"
        fill={`url(#under-${uid})`}
      />

      {/* 3D Cast Shadows at Ribbon Overlaps */}
      <path d="M 218 248 H 268 L 244 332 H 218 Z" fill={`url(#shadowWaist-${uid})`} />
      <path d="M 128 148 L 218 112 V 224 L 128 246 Z" fill={`url(#shadowTop-${uid})`} />
      <path
        d="M 312 194 L 404 218 C 401 242, 391 264, 375 282 L 298 232 Z"
        fill="#020409"
        fillOpacity="0.58"
      />

      {/* Plane 3: Hero Foreground 3D Folded Ribbon (Vivid Crimson #ff0033 -> #e11d48) */}
      <path
        d="M 128 92 C 128 81, 136 74, 147 74 H 242 C 344 74, 404 126, 404 202 C 404 214, 402 226, 397 238 L 308 198 C 312 191, 314 183, 314 174 C 314 149, 284 134, 232 134 H 206 L 128 168 Z"
        fill={`url(#hero-${uid})`}
      />

      {/* Plane 4: Signature Pulse Wave in Lower-Right Counter */}
      <path
        d="M 248 386 H 284 L 302 346 L 326 420 L 348 366 L 362 386 H 398"
        fill="none"
        stroke={`url(#pulse-${uid})`}
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeOpacity="0.28"
      />
      <path
        d="M 248 386 H 284 L 302 346 L 326 420 L 348 366 L 362 386 H 398"
        fill="none"
        stroke="#e11d48"
        strokeWidth="14"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M 248 386 H 284 L 302 346 L 326 420 L 348 366 L 362 386 H 398"
        fill="none"
        stroke="#ffffff"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export const LauncherIconsPreviewCard: React.FC<{ language: AppLanguage }> = ({
  language,
}) => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [activeTerminal, setActiveTerminal] = useState<
    'smartphone' | 'tablet' | 'android_tv' | 'tv_box'
  >('smartphone');

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
  };

  const labels = {
    title:
      language === 'ar'
        ? 'أيقونة تشغيل بتصميم شريطي ثلاثي الأبعاد على جميع أجهزة Android'
        : language === 'en'
        ? '3D Ribbon Streaming Launcher Icon (Unified across all Android devices)'
        : 'Icône de Lancement Ruban 3D Cinéma (Généralisée sur tous les appareils Android)',
    subtitle:
      language === 'ar'
        ? 'مونوغرام ثلاثي الأبعاد مستوحى من منصات البث الكبرى بهويتنا البصرية (#0a0e17، #e11d48، #0055ff)'
        : language === 'en'
        ? 'Folded 3D ribbon monogram in our brand palette (#0a0e17, #e11d48, #0055ff) for Phone, Tablet, Android TV & Box'
        : 'Monogramme ruban 3D plié respectant notre palette (#0a0e17, #e11d48, #0055ff) sur Smartphone, Tablette, Android TV & Box',
    installBtn:
      language === 'ar'
        ? 'تثبيت على الشاشة الرئيسية'
        : language === 'en'
        ? 'Install on Home Screen'
        : "Installer sur l'écran d'accueil",
  };

  const terminalSpecs = [
    {
      id: 'smartphone' as const,
      label: 'Smartphone',
      icon: Smartphone,
      sizes: '48×48 → 192×192 px (Adaptive 108dp / Safe Zone 66dp)',
      desc:
        language === 'fr'
          ? 'Monogramme ruban 3D plié plein contraste (Samsung OneUI, Xiaomi HyperOS, Pixel, PWA) sans texte minuscule.'
          : 'High-contrast 3D folded ribbon monogram (OneUI, Xiaomi, Pixel, PWA) with zero cluttered small text.',
    },
    {
      id: 'tablet' as const,
      label: language === 'fr' ? 'Tablette' : 'Tablet',
      icon: Tablet,
      sizes: '152×152 → 512×512 px (Vectorielle & Haute Densité xxxhdpi)',
      desc:
        language === 'fr'
          ? 'Rendu vectoriel studio sur grille tablette Android & iPadOS avec ombres portées 3D du ruban Crimson/Bleu.'
          : 'Lossless studio vector rendering on Android Tablet & iPadOS grids with 3D crimson/blue ribbon folds.',
    },
    {
      id: 'android_tv' as const,
      label: 'Android TV',
      icon: Tv,
      sizes: '320×180 dp / 640×360 px (Bannière Leanback 16:9)',
      desc:
        language === 'fr'
          ? 'Bannière Leanback officielle (@drawable/tv_banner) associant le ruban 3D et le logotype PULSE EPG.'
          : 'Official 16:9 Leanback banner (@drawable/tv_banner) combining the 3D ribbon emblem and PULSE EPG logotype.',
    },
    {
      id: 'tv_box' as const,
      label: 'TV Box',
      icon: Monitor,
      sizes: '192×192 px + 320×180 px (Hybride AOSP & Leanback)',
      desc:
        language === 'fr'
          ? 'Généralisé sur toutes les Box Android (Echolink Atomo, Xiaomi Box, Nvidia Shield) en icône Adaptive et bannière.'
          : 'Generalized across all Android TV Boxes (AOSP square/round adaptive icon + 16:9 Leanback banner).',
    },
  ];

  const currentSpec =
    terminalSpecs.find((t) => t.id === activeTerminal) || terminalSpecs[0];

  return (
    <div className="p-3.5 rounded-xl bg-[#0a0e17] border border-[#1a202c] space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-bold text-[#ffffff] flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#e11d48] shadow-[0_0_8px_#e11d48]" />
            {labels.title}
          </h4>
          <p className="text-[11px] text-[#94a3b8] mt-0.5">{labels.subtitle}</p>
        </div>

        {deferredPrompt && (
          <button
            type="button"
            onClick={handleInstall}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-[#e11d48] text-[#ffffff] border border-[#ff0033] hover:bg-[#be123c] transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{labels.installBtn}</span>
          </button>
        )}
      </div>

      {/* Terminal Selector Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
        {terminalSpecs.map((spec) => {
          const IconComp = spec.icon;
          const isActive = activeTerminal === spec.id;
          return (
            <button
              key={spec.id}
              type="button"
              onClick={() => setActiveTerminal(spec.id)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#e11d48]/20 border-[#e11d48] text-[#ffffff] shadow-[0_0_12px_rgba(225,29,72,0.25)]'
                  : 'bg-[#141a26] border-[#1a202c] text-[#cbd5e1] hover:border-[#0055ff]/50'
              }`}
            >
              <IconComp
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-[#e11d48]' : 'text-[#94a3b8]'
                }`}
              />
              <span className="text-xs font-semibold truncate">{spec.label}</span>
            </button>
          );
        })}
      </div>

      {/* Live Visual Preview of Selected Terminal Format */}
      <div className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-lg bg-[#141a26]/90 border border-[#1e293b]">
        <div className="flex items-center justify-center shrink-0">
          {activeTerminal === 'smartphone' && (
            <div className="flex items-center gap-3">
              {/* Squircle Smartphone Preview (OneUI / HyperOS style) */}
              <div className="flex flex-col items-center gap-1">
                <img
                  src="/pwa-192x192.png?v=nx1"
                  alt="Icône Smartphone Squircle"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-[22%] border border-[#e11d48]/50 shadow-[0_0_16px_rgba(225,29,72,0.35)]"
                />
                <span className="text-[10px] font-medium text-[#cbd5e1]">
                  PulseEPG
                </span>
              </div>
              {/* Round Android Pixel Preview */}
              <div className="flex flex-col items-center gap-1">
                <img
                  src="/pwa-maskable-192x192.png?v=nx1"
                  alt="Icône Smartphone Ronde Adaptive"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full border border-[#0055ff]/50 shadow-[0_0_16px_rgba(0,85,255,0.3)]"
                />
                <span className="text-[10px] font-medium text-[#94a3b8]">
                  Adaptive
                </span>
              </div>
            </div>
          )}

          {activeTerminal === 'tablet' && (
            <div className="flex flex-col items-center gap-1.5">
              <img
                src="/pwa-512x512.png?v=nx1"
                alt="Icône Tablette HD"
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-[22%] border border-[#e11d48]/50 shadow-[0_0_20px_rgba(225,29,72,0.35)]"
              />
              <span className="text-[11px] font-semibold text-[#ffffff]">
                PulseEPG HD (Tablette)
              </span>
            </div>
          )}

          {activeTerminal === 'android_tv' && (
            <div className="flex flex-col items-center gap-1.5">
              <img
                src="/tv-banner-320x180.png?v=nx1"
                alt="Bannière Android TV Leanback 16:9"
                referrerPolicy="no-referrer"
                className="w-40 h-[90px] rounded-lg border-2 border-[#e11d48] shadow-[0_0_18px_rgba(225,29,72,0.4)] object-cover"
              />
              <span className="text-[10px] font-semibold text-[#38bdf8]">
                Leanback Banner 320×180 dp (16:9)
              </span>
            </div>
          )}

          {activeTerminal === 'tv_box' && (
            <div className="flex items-center gap-3">
              <img
                src="/pwa-192x192.png?v=nx1"
                alt="Icône TV Box AOSP"
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl border-2 border-[#e11d48] shadow-[0_0_16px_rgba(225,29,72,0.35)]"
              />
              <img
                src="/tv-banner-320x180.png?v=nx1"
                alt="Bannière TV Box Leanback"
                referrerPolicy="no-referrer"
                className="w-32 h-[72px] rounded-lg border border-[#0055ff]/60 shadow-[0_0_16px_rgba(0,85,255,0.3)] object-cover"
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#e11d48]/15 border border-[#e11d48]/40 text-[10px] font-mono text-[#fda4af]">
            {currentSpec.sizes}
          </div>
          <p className="text-xs text-[#e2e8f0] leading-relaxed">
            {currentSpec.desc}
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-[10px] text-[#94a3b8]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#0a0e17] border border-[#38bdf8]" />
              #0a0e17 Studio Dark
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#e11d48]" />
              #e11d48 / #ff0033 Ruban Crimson
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#0055ff]" />
              #0055ff / #38bdf8 Pilier Bleu Royal
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
