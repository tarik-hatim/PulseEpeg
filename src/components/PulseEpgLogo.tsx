import React, { useEffect, useState } from 'react';
import { Download, Monitor, Smartphone, Tablet, Tv } from 'lucide-react';
import { AppLanguage } from '../types/epg';

const PULSE_TEXT_PATHS =
  'M84 436V392H103C111.5 392 117 397.2 117 405.5C117 413.8 111.5 419 103 419H94V436H84ZM94 410.5H102.2C105.4 410.5 107.2 408.7 107.2 405.5C107.2 402.3 105.4 400.5 102.2 400.5H94V410.5Z M125 392H135V418.5C135 424.5 138.2 427.8 143 427.8C147.8 427.8 151 424.5 151 418.5V392H161V418.8C161 430.2 153.8 436.8 143 436.8C132.2 436.8 125 430.2 125 418.8V392Z M171 392H181V427H201V436H171V392Z M208 426.5L214.5 419.8C217.8 424.8 221.6 427.8 225.8 427.8C229.8 427.8 232 426.2 232 423.5C232 420.8 229.5 419.6 222.8 418C213.5 415.8 208.5 412 208.5 404.2C208.5 396.4 215 391.2 224.8 391.2C232.2 391.2 237.8 394.2 241.2 399.5L234.2 405.8C231.5 401.8 228.4 399.8 224.8 399.8C221.2 399.8 218.8 401.4 218.8 403.8C218.8 406.3 221.2 407.4 227.8 409C237.2 411.2 242.2 415.2 242.2 423C242.2 431.4 235.5 436.8 225.2 436.8C216.8 436.8 211.2 433.2 208 426.5Z M250 392H282V400.8H260V409.5H279V418.2H260V427.2H282V436H250V392Z M304 392H336V400.8H314V409.5H333V418.2H314V427.2H336V436H304V392Z M346 436V392H365C373.5 392 379 397.2 379 405.5C379 413.8 373.5 419 365 419H356V436H346ZM356 410.5H364.2C367.4 410.5 369.2 408.7 369.2 405.5C369.2 402.3 367.4 400.5 364.2 400.5H356V410.5Z M408.5 391.2C417.8 391.2 424.8 395.8 427.8 403.5L418.5 407.2C416.5 402.5 413 400.2 408.5 400.2C401.2 400.2 396.8 405.6 396.8 414C396.8 422.4 401.2 427.8 408.8 427.8C414.2 427.8 418.2 425.2 419.2 420.2H409V411.8H428.5V417.5C428.5 429.8 420.5 436.8 408.5 436.8C395.2 436.8 386.5 427.6 386.5 414C386.5 400.4 395.2 391.2 408.5 391.2Z';

interface PulseEpgLogoProps {
  /**
   * If true, automatically scales the icon according to the active terminal:
   * - Smartphone: 36x36px (w-9 h-9)
   * - Tablette (sm/md): 40x40px / 44x44px (sm:w-10 sm:h-10 md:w-11 md:h-11)
   * - Android TV & TV Box (xl/2xl): 48x48px / 52x52px (xl:w-12 xl:h-12 2xl:w-13 2xl:h-13)
   */
  adaptiveTerminalSize?: boolean;
  className?: string;
  showWordmarkInside?: boolean;
}

export const PulseEpgLogo: React.FC<PulseEpgLogoProps> = ({
  adaptiveTerminalSize = true,
  className = '',
  showWordmarkInside = true,
}) => {
  const uid = React.useId().replace(/:/g, '');
  const sizeClasses = adaptiveTerminalSize
    ? 'w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 xl:w-12 xl:h-12'
    : className || 'w-10 h-10';

  return (
    <svg
      viewBox="0 0 512 512"
      fill="none"
      className={`${sizeClasses} shrink-0 rounded-[22%] shadow-[0_0_18px_rgba(0,85,255,0.28)] ${className}`}
      aria-label="PulseEPG Launcher Icon"
    >
      <defs>
        <linearGradient id={`bg-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#060911" />
          <stop offset="48%" stopColor="#0a0e17" />
          <stop offset="100%" stopColor="#14132b" />
        </linearGradient>
        <radialGradient id={`blue-${uid}`} cx="30%" cy="38%" r="52%">
          <stop offset="0%" stopColor="#0055ff" stopOpacity="0.42" />
          <stop offset="100%" stopColor="#0055ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`crimson-${uid}`} cx="72%" cy="46%" r="52%">
          <stop offset="0%" stopColor="#e11d48" stopOpacity="0.40" />
          <stop offset="100%" stopColor="#e11d48" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`neon-${uid}`} x1="12%" y1="15%" x2="88%" y2="85%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="36%" stopColor="#0055ff" />
          <stop offset="68%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#e11d48" />
        </linearGradient>
        <linearGradient id={`pulse-${uid}`} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="32%" stopColor="#0055ff" />
          <stop offset="65%" stopColor="#ec4899" />
          <stop offset="100%" stopColor="#ff0033" />
        </linearGradient>
        <linearGradient id={`core-${uid}`} x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#e0f2fe" />
          <stop offset="45%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#ffe4e6" />
        </linearGradient>
      </defs>

      <rect width="512" height="512" rx="114" fill={`url(#bg-${uid})`} />
      <rect width="512" height="512" rx="114" fill={`url(#blue-${uid})`} />
      <rect width="512" height="512" rx="114" fill={`url(#crimson-${uid})`} />
      <rect
        x="16"
        y="16"
        width="480"
        height="480"
        rx="100"
        fill="none"
        stroke={`url(#neon-${uid})`}
        strokeWidth="6"
        strokeOpacity="0.65"
      />

      <g transform={showWordmarkInside ? 'translate(0, 0)' : 'translate(0, 36)'}>
        {/* Neon Halo */}
        <rect
          x="94"
          y="116"
          width="324"
          height="226"
          rx="50"
          fill="none"
          stroke={`url(#neon-${uid})`}
          strokeWidth="24"
          strokeOpacity="0.18"
        />

        {/* V-Shaped Antennas */}
        <path
          d="M188 64 L244 122"
          stroke={`url(#neon-${uid})`}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          d="M324 64 L268 122"
          stroke={`url(#neon-${uid})`}
          strokeWidth="14"
          strokeLinecap="round"
        />
        <circle cx="188" cy="64" r="8" fill="#38bdf8" />
        <circle cx="324" cy="64" r="8" fill="#ec4899" />

        {/* Antenna Base */}
        <rect
          x="228"
          y="112"
          width="56"
          height="16"
          rx="8"
          fill={`url(#neon-${uid})`}
        />

        {/* Retro-Modern TV Bezel */}
        <rect
          x="100"
          y="122"
          width="312"
          height="212"
          rx="44"
          fill="#070b14"
          stroke={`url(#neon-${uid})`}
          strokeWidth="18"
        />

        {/* Heartbeat / ECG Pulse Waveform */}
        <path
          d="M 136 230 H 184 L 202 256 L 233 162 L 265 298 L 295 192 L 315 246 L 330 230 H 376"
          fill="none"
          stroke={`url(#pulse-${uid})`}
          strokeWidth="28"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity="0.24"
        />
        <path
          d="M 136 230 H 184 L 202 256 L 233 162 L 265 298 L 295 192 L 315 246 L 330 230 H 376"
          fill="none"
          stroke={`url(#pulse-${uid})`}
          strokeWidth="15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M 136 230 H 184 L 202 256 L 233 162 L 265 298 L 295 192 L 315 246 L 330 230 H 376"
          fill="none"
          stroke={`url(#core-${uid})`}
          strokeWidth="5.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="136" cy="230" r="7" fill="#38bdf8" />
        <circle cx="376" cy="230" r="7" fill="#ff0033" />

        {/* TV Pedestal Stand */}
        <rect
          x="234"
          y="334"
          width="44"
          height="16"
          rx="4"
          fill={`url(#neon-${uid})`}
        />
        <rect
          x="186"
          y="346"
          width="140"
          height="12"
          rx="6"
          fill={`url(#neon-${uid})`}
        />

        {/* "PULSE EPG" Vector Logotype */}
        {showWordmarkInside && (
          <path d={PULSE_TEXT_PATHS} fill="#ffffff" />
        )}
      </g>
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
        ? 'أيقونة تشغيل التطبيق المتكيفة (هاتف، لوحي، Android TV، TV Box)'
        : language === 'en'
        ? 'Adaptive Launcher Icon (Smartphone, Tablet, Android TV, TV Box)'
        : 'Icône de Lancement Adaptative (Smartphone, Tablette, Android TV, TV Box)',
    subtitle:
      language === 'ar'
        ? 'تصميم متوافق مع الهوية البصرية (#0a0e17، #0055ff، #e11d48) وأحجام مخصصة لكل جهاز'
        : language === 'en'
        ? 'Styled to match the brand charter (#0a0e17, #0055ff, #e11d48) with terminal-specific sizes'
        : 'Respect strict de la charte graphique (#0a0e17, #0055ff, #e11d48) avec tailles adaptées par terminal',
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
          ? 'Icône Adaptive Android (Squircle MIUI / Samsung / Pixel) & iOS 180×180 px sans rognage.'
          : 'Android Adaptive Icon (Squircle / Circle) & iOS 180×180 px with safe-zone padding.',
    },
    {
      id: 'tablet' as const,
      label: language === 'fr' ? 'Tablette' : 'Tablet',
      icon: Tablet,
      sizes: '152×152 → 512×512 px (Vectorielle & Haute Densité xxxhdpi)',
      desc:
        language === 'fr'
          ? 'Grille large tablette Android & iPadOS Retina avec rendu vectoriel sans perte.'
          : 'Large tablet launcher grid & Retina iPadOS with lossless vector rendering.',
    },
    {
      id: 'android_tv' as const,
      label: 'Android TV',
      icon: Tv,
      sizes: '320×180 dp / 640×360 px (Bannière Leanback 16:9)',
      desc:
        language === 'fr'
          ? 'Bannière horizontale officielle Leanback (@drawable/tv_banner) pour Google TV / Android TV.'
          : 'Official 16:9 Leanback horizontal banner (@drawable/tv_banner) for Android TV.',
    },
    {
      id: 'tv_box' as const,
      label: 'TV Box',
      icon: Monitor,
      sizes: '192×192 px + 320×180 px (Hybride AOSP & Leanback)',
      desc:
        language === 'fr'
          ? 'Double support icône carrée/ronde HD (@mipmap/ic_launcher) et bannière TV Box.'
          : 'Dual support for AOSP square/round HD tile and Leanback TV Box launcher.',
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
                  ? 'bg-[#0055ff]/20 border-[#0055ff] text-[#ffffff] shadow-[0_0_12px_rgba(0,85,255,0.25)]'
                  : 'bg-[#141a26] border-[#1a202c] text-[#cbd5e1] hover:border-[#0055ff]/50'
              }`}
            >
              <IconComp
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-[#38bdf8]' : 'text-[#94a3b8]'
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
              {/* Squircle Smartphone Preview (MIUI / OneUI style) */}
              <div className="flex flex-col items-center gap-1">
                <img
                  src="/pwa-192x192.png"
                  alt="Icône Smartphone Squircle"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-[22%] border border-[#0055ff]/40 shadow-[0_0_16px_rgba(225,29,72,0.25)]"
                />
                <span className="text-[10px] font-medium text-[#cbd5e1]">
                  PulseEPG
                </span>
              </div>
              {/* Round Android Pixel Preview */}
              <div className="flex flex-col items-center gap-1">
                <img
                  src="/pwa-maskable-192x192.png"
                  alt="Icône Smartphone Ronde Adaptive"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full border border-[#ec4899]/40 shadow-[0_0_16px_rgba(0,85,255,0.25)]"
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
                src="/pwa-512x512.png"
                alt="Icône Tablette HD"
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-[22%] border border-[#0055ff]/50 shadow-[0_0_20px_rgba(0,85,255,0.3)]"
              />
              <span className="text-[11px] font-semibold text-[#ffffff]">
                PulseEPG HD (Tablette)
              </span>
            </div>
          )}

          {activeTerminal === 'android_tv' && (
            <div className="flex flex-col items-center gap-1.5">
              <img
                src="/tv-banner-320x180.png"
                alt="Bannière Android TV Leanback 16:9"
                referrerPolicy="no-referrer"
                className="w-40 h-[90px] rounded-lg border-2 border-[#ec4899] shadow-[0_0_18px_rgba(236,72,153,0.4)] object-cover"
              />
              <span className="text-[10px] font-semibold text-[#38bdf8]">
                Leanback Banner 320×180 dp (16:9)
              </span>
            </div>
          )}

          {activeTerminal === 'tv_box' && (
            <div className="flex items-center gap-3">
              <img
                src="/pwa-192x192.png"
                alt="Icône TV Box AOSP"
                referrerPolicy="no-referrer"
                className="w-16 h-16 rounded-2xl border-2 border-[#0055ff] shadow-[0_0_16px_rgba(0,85,255,0.35)]"
              />
              <img
                src="/tv-banner-320x180.png"
                alt="Bannière TV Box Leanback"
                referrerPolicy="no-referrer"
                className="w-32 h-[72px] rounded-lg border border-[#e11d48]/60 shadow-[0_0_16px_rgba(225,29,72,0.3)] object-cover"
              />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 text-center sm:text-left space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-[#0055ff]/15 border border-[#0055ff]/40 text-[10px] font-mono text-[#38bdf8]">
            {currentSpec.sizes}
          </div>
          <p className="text-xs text-[#e2e8f0] leading-relaxed">
            {currentSpec.desc}
          </p>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1 text-[10px] text-[#94a3b8]">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#0a0e17] border border-[#38bdf8]" />
              #0a0e17 Navy
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#0055ff]" />
              #0055ff Royal Blue
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#e11d48]" />
              #e11d48 Crimson
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
