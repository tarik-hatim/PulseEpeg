import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ANDROID_RES_DIR = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');

/**
 * Geometric vector paths for "PULSE EPG" (centered at x = 256, y = 392..436 on a 512x512 canvas)
 * Designed with clean, bold, geometric sans-serif proportions (stroke width 10px, height 44px)
 * so that every renderer (Browser, Android VectorDrawable, ImageMagick, iOS, Android TV)
 * renders identical, razor-sharp typography without external font dependencies.
 */
export const PULSE_TEXT_PATHS = [
  // P (x: 84..116, y: 392..436)
  'M84 436V392H103C111.5 392 117 397.2 117 405.5C117 413.8 111.5 419 103 419H94V436H84ZM94 410.5H102.2C105.4 410.5 107.2 408.7 107.2 405.5C107.2 402.3 105.4 400.5 102.2 400.5H94V410.5Z',
  // U (x: 125..161, y: 392..436.8)
  'M125 392H135V418.5C135 424.5 138.2 427.8 143 427.8C147.8 427.8 151 424.5 151 418.5V392H161V418.8C161 430.2 153.8 436.8 143 436.8C132.2 436.8 125 430.2 125 418.8V392Z',
  // L (x: 171..201, y: 392..436)
  'M171 392H181V427H201V436H171V392Z',
  // S (x: 207..241, y: 391.2..436.8) - clean geometric S
  'M208 426.5L214.5 419.8C217.8 424.8 221.6 427.8 225.8 427.8C229.8 427.8 232 426.2 232 423.5C232 420.8 229.5 419.6 222.8 418C213.5 415.8 208.5 412 208.5 404.2C208.5 396.4 215 391.2 224.8 391.2C232.2 391.2 237.8 394.2 241.2 399.5L234.2 405.8C231.5 401.8 228.4 399.8 224.8 399.8C221.2 399.8 218.8 401.4 218.8 403.8C218.8 406.3 221.2 407.4 227.8 409C237.2 411.2 242.2 415.2 242.2 423C242.2 431.4 235.5 436.8 225.2 436.8C216.8 436.8 211.2 433.2 208 426.5Z',
  // E (x: 250..282, y: 392..436)
  'M250 392H282V400.8H260V409.5H279V418.2H260V427.2H282V436H250V392Z',
  // E (x: 304..336, y: 392..436)
  'M304 392H336V400.8H314V409.5H333V418.2H314V427.2H336V436H304V392Z',
  // P (x: 346..379, y: 392..436)
  'M346 436V392H365C373.5 392 379 397.2 379 405.5C379 413.8 373.5 419 365 419H356V436H346ZM356 410.5H364.2C367.4 410.5 369.2 408.7 369.2 405.5C369.2 402.3 367.4 400.5 364.2 400.5H356V410.5Z',
  // G (x: 387..428, y: 391.2..436.8)
  'M408.5 391.2C417.8 391.2 424.8 395.8 427.8 403.5L418.5 407.2C416.5 402.5 413 400.2 408.5 400.2C401.2 400.2 396.8 405.6 396.8 414C396.8 422.4 401.2 427.8 408.8 427.8C414.2 427.8 418.2 425.2 419.2 420.2H409V411.8H428.5V417.5C428.5 429.8 420.5 436.8 408.5 436.8C395.2 436.8 386.5 427.6 386.5 414C386.5 400.4 395.2 391.2 408.5 391.2Z',
].join(' ');

/**
 * Generates the master SVG launcher icon (either 'any' full-size or 'maskable' with safe-zone scaling,
 * or 'round' circular icon for Android roundIcon).
 */
export function buildLauncherSvg({
  mode = 'any', // 'any' | 'maskable' | 'round' | 'foreground'
} = {}) {
  const isMaskable = mode === 'maskable';
  const isRound = mode === 'round';
  const isForegroundOnly = mode === 'foreground';

  // For maskable/adaptive icons, Android crops to the inner 66/108 (61.1%) circle/squircle.
  // Scaling the emblem by 0.72 around center (256, 256) keeps 100% of the antennas and "PULSE EPG"
  // comfortably inside the safe zone on all smartphones, tablets, and TV boxes.
  const contentTransform =
    isMaskable || isForegroundOnly
      ? 'translate(256, 252) scale(0.72) translate(-256, -256)'
      : isRound
      ? 'translate(256, 252) scale(0.84) translate(-256, -256)'
      : 'translate(0, 0)';

  const outerRx = isMaskable ? 0 : isRound ? 256 : 114;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Deep Midnight Navy Background Gradient (Charte Graphique #0a0e17 -> #111827 -> #1a1635) -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060911" />
      <stop offset="48%" stop-color="#0a0e17" />
      <stop offset="100%" stop-color="#14132b" />
    </linearGradient>

    <!-- Ambient Royal Blue Left Glow (#0055ff / #38bdf8) -->
    <radialGradient id="blueGlow" cx="30%" cy="38%" r="52%">
      <stop offset="0%" stop-color="#0055ff" stop-opacity="0.42" />
      <stop offset="55%" stop-color="#0055ff" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#0055ff" stop-opacity="0" />
    </radialGradient>

    <!-- Ambient Crimson / Rose Right Glow (#e11d48 / #ec4899) -->
    <radialGradient id="crimsonGlow" cx="72%" cy="46%" r="52%">
      <stop offset="0%" stop-color="#e11d48" stop-opacity="0.40" />
      <stop offset="55%" stop-color="#ec4899" stop-opacity="0.12" />
      <stop offset="100%" stop-color="#e11d48" stop-opacity="0" />
    </radialGradient>

    <!-- Brand Signature Gradient: Electric Cyan / Royal Blue (#38bdf8 -> #0055ff) to Neon Rose / Crimson (#ec4899 -> #e11d48) -->
    <linearGradient id="brandNeonGrad" x1="12%" y1="15%" x2="88%" y2="85%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="36%" stop-color="#0055ff" />
      <stop offset="68%" stop-color="#ec4899" />
      <stop offset="100%" stop-color="#e11d48" />
    </linearGradient>

    <!-- Horizontal Pulse Waveform Gradient -->
    <linearGradient id="pulseWaveGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="32%" stop-color="#0055ff" />
      <stop offset="65%" stop-color="#ec4899" />
      <stop offset="100%" stop-color="#ff0033" />
    </linearGradient>

    <!-- Inner Bright Core Gradient for ECG Pulse -->
    <linearGradient id="pulseCoreGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#e0f2fe" />
      <stop offset="45%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#ffe4e6" />
    </linearGradient>

    <!-- TV Screen Interior Dark Gloss Gradient -->
    <linearGradient id="tvScreenFill" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0d1526" />
      <stop offset="50%" stop-color="#070b14" />
      <stop offset="100%" stop-color="#0f1424" />
    </linearGradient>

    <!-- Subtle Rim Border Gradient -->
    <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" stop-opacity="0.65" />
      <stop offset="50%" stop-color="#0055ff" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#e11d48" stop-opacity="0.65" />
    </linearGradient>
  </defs>

  ${
    !isForegroundOnly
      ? `<!-- Base Background -->
  <rect width="512" height="512" rx="${outerRx}" fill="url(#bgGrad)" />
  <rect width="512" height="512" rx="${outerRx}" fill="url(#blueGlow)" />
  <rect width="512" height="512" rx="${outerRx}" fill="url(#crimsonGlow)" />`
      : ''
  }

  ${
    !isForegroundOnly && !isMaskable
      ? `<!-- Sleek Inner Charte Graphique Border -->
  <rect x="18" y="18" width="476" height="476" rx="${
    isRound ? 238 : 98
  }" fill="none" stroke="url(#rimGrad)" stroke-width="5" />`
      : ''
  }

  <g transform="${contentTransform}">
    <!-- Soft Neon Halo Behind TV & Antenna -->
    <rect x="94" y="116" width="324" height="226" rx="50" fill="none" stroke="url(#brandNeonGrad)" stroke-width="26" stroke-opacity="0.16" />

    <!-- V-Shaped Retro-Modern TV Antennas -->
    <path d="M188 64 L244 122" stroke="#38bdf8" stroke-width="20" stroke-linecap="round" stroke-opacity="0.25" />
    <path d="M324 64 L268 122" stroke="#ec4899" stroke-width="20" stroke-linecap="round" stroke-opacity="0.25" />
    <path d="M188 64 L244 122" stroke="url(#brandNeonGrad)" stroke-width="13" stroke-linecap="round" />
    <path d="M324 64 L268 122" stroke="url(#brandNeonGrad)" stroke-width="13" stroke-linecap="round" />
    <circle cx="188" cy="64" r="8" fill="#38bdf8" />
    <circle cx="324" cy="64" r="8" fill="#ec4899" />

    <!-- Antenna Base Node -->
    <rect x="228" y="112" width="56" height="16" rx="8" fill="url(#brandNeonGrad)" />

    <!-- Main TV Outer Frame (Rounded Retro-Modern Bezel) -->
    <rect x="100" y="122" width="312" height="212" rx="44" fill="url(#tvScreenFill)" stroke="url(#brandNeonGrad)" stroke-width="18" />

    <!-- Inner Screen Bevel Highlight -->
    <rect x="118" y="140" width="276" height="176" rx="28" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2.5" />

    <!-- Subtle Screen Grid / Broadcast Scanline Accent -->
    <line x1="132" y1="230" x2="380" y2="230" stroke="#1e293b" stroke-width="2" stroke-dasharray="6 6" />

    <!-- Heartbeat / ECG Pulse Waveform (3-Layer Neon Glow) -->
    <!-- Layer 1: Wide Neon Outer Glow -->
    <path
      d="M 136 230 H 184 L 202 256 L 233 162 L 265 298 L 295 192 L 315 246 L 330 230 H 376"
      fill="none"
      stroke="url(#pulseWaveGrad)"
      stroke-width="28"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-opacity="0.24"
    />
    <!-- Layer 2: Primary Brand Neon Gradient Stroke -->
    <path
      d="M 136 230 H 184 L 202 256 L 233 162 L 265 298 L 295 192 L 315 246 L 330 230 H 376"
      fill="none"
      stroke="url(#pulseWaveGrad)"
      stroke-width="15"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- Layer 3: Intense White-Hot Center Core -->
    <path
      d="M 136 230 H 184 L 202 256 L 233 162 L 265 298 L 295 192 L 315 246 L 330 230 H 376"
      fill="none"
      stroke="url(#pulseCoreGrad)"
      stroke-width="5.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />

    <!-- Glowing Pulse Endpoints -->
    <circle cx="136" cy="230" r="7" fill="#38bdf8" />
    <circle cx="376" cy="230" r="7" fill="#ff0033" />

    <!-- TV Pedestal Neck & Base Stand -->
    <rect x="234" y="334" width="44" height="16" rx="4" fill="url(#brandNeonGrad)" />
    <rect x="186" y="346" width="140" height="12" rx="6" fill="url(#brandNeonGrad)" />

    <!-- "PULSE EPG" Typography with Subtle Neon Halo -->
    <path d="${PULSE_TEXT_PATHS}" fill="url(#brandNeonGrad)" opacity="0.35" transform="translate(0, 3)" />
    <path d="${PULSE_TEXT_PATHS}" fill="#ffffff" />
  </g>
</svg>`;
}

/**
 * Generates the 16:9 Android TV / TV Box Leanback Banner (640x360 viewBox, scaled to 320x180 xhdpi & 640x360 xxxhdpi)
 */
export function buildTvBannerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <defs>
    <linearGradient id="tvBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#060911" />
      <stop offset="50%" stop-color="#0a0e17" />
      <stop offset="100%" stop-color="#15132d" />
    </linearGradient>
    <radialGradient id="tvBlueGlow" cx="25%" cy="45%" r="55%">
      <stop offset="0%" stop-color="#0055ff" stop-opacity="0.40" />
      <stop offset="100%" stop-color="#0055ff" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="tvCrimsonGlow" cx="78%" cy="55%" r="55%">
      <stop offset="0%" stop-color="#e11d48" stop-opacity="0.36" />
      <stop offset="100%" stop-color="#e11d48" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="tvBrandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="38%" stop-color="#0055ff" />
      <stop offset="70%" stop-color="#ec4899" />
      <stop offset="100%" stop-color="#e11d48" />
    </linearGradient>
    <linearGradient id="tvPulseCore" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#e0f2fe" />
      <stop offset="50%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#ffe4e6" />
    </linearGradient>
  </defs>

  <!-- 16:9 Background for Android TV / TV Box Leanback -->
  <rect width="640" height="360" rx="28" fill="url(#tvBgGrad)" />
  <rect width="640" height="360" rx="28" fill="url(#tvBlueGlow)" />
  <rect width="640" height="360" rx="28" fill="url(#tvCrimsonGlow)" />
  <rect x="8" y="8" width="624" height="344" rx="22" fill="none" stroke="url(#tvBrandGrad)" stroke-width="3" stroke-opacity="0.55" />

  <!-- Left Side: Neon TV + Heartbeat Pulse Emblem -->
  <g transform="translate(22, 16) scale(0.64)">
    <rect x="94" y="116" width="324" height="226" rx="50" fill="none" stroke="url(#tvBrandGrad)" stroke-width="26" stroke-opacity="0.16" />
    <path d="M188 64 L244 122" stroke="url(#tvBrandGrad)" stroke-width="14" stroke-linecap="round" />
    <path d="M324 64 L268 122" stroke="url(#tvBrandGrad)" stroke-width="14" stroke-linecap="round" />
    <circle cx="188" cy="64" r="8" fill="#38bdf8" />
    <circle cx="324" cy="64" r="8" fill="#ec4899" />
    <rect x="228" y="112" width="56" height="16" rx="8" fill="url(#tvBrandGrad)" />
    <rect x="100" y="122" width="312" height="212" rx="44" fill="#070b14" stroke="url(#tvBrandGrad)" stroke-width="18" />
    <path
      d="M 136 230 H 184 L 202 256 L 233 162 L 265 298 L 295 192 L 315 246 L 330 230 H 376"
      fill="none"
      stroke="url(#tvBrandGrad)"
      stroke-width="26"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-opacity="0.25"
    />
    <path
      d="M 136 230 H 184 L 202 256 L 233 162 L 265 298 L 295 192 L 315 246 L 330 230 H 376"
      fill="none"
      stroke="url(#tvBrandGrad)"
      stroke-width="15"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M 136 230 H 184 L 202 256 L 233 162 L 265 298 L 295 192 L 315 246 L 330 230 H 376"
      fill="none"
      stroke="url(#tvPulseCore)"
      stroke-width="5.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <rect x="234" y="334" width="44" height="16" rx="4" fill="url(#tvBrandGrad)" />
    <rect x="186" y="346" width="140" height="12" rx="6" fill="url(#tvBrandGrad)" />
  </g>

  <!-- Right Side: Bold "PULSE EPG" Vector Logotype + Accent Bar -->
  <g transform="translate(248, -195) scale(0.88)">
    <path d="${PULSE_TEXT_PATHS}" fill="url(#tvBrandGrad)" opacity="0.35" transform="translate(0, 3)" />
    <path d="${PULSE_TEXT_PATHS}" fill="#ffffff" />
  </g>

  <!-- Neon Divider Pill & Live Pulse Accent on Right Side -->
  <rect x="322" y="210" width="248" height="6" rx="3" fill="url(#tvBrandGrad)" />
  <circle cx="334" cy="244" r="6" fill="#e11d48" />
  <rect x="350" y="239" width="90" height="10" rx="5" fill="#38bdf8" fill-opacity="0.85" />
  <rect x="450" y="239" width="118" height="10" rx="5" fill="#cbd5e1" fill-opacity="0.45" />
</svg>`;
}

/**
 * Generates Android Adaptive Icon VectorDrawables (API 26+)
 * - drawable/ic_launcher_background.xml (108dp x 108dp)
 * - drawable/ic_launcher_foreground.xml (108dp x 108dp, scaled to 512x512 viewport with safe zone)
 * - drawable/tv_banner.xml (320dp x 180dp Leanback TV banner vector)
 */
export function buildAndroidBackgroundVectorXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="512"
    android:viewportHeight="512">
    <path android:pathData="M0,0h512v512h-512z">
        <aapt:attr name="android:fillColor">
            <gradient
                android:startX="0"
                android:startY="0"
                android:endX="512"
                android:endY="512"
                android:type="linear">
                <item android:offset="0.0" android:color="#FF060911" />
                <item android:offset="0.5" android:color="#FF0A0E17" />
                <item android:offset="1.0" android:color="#FF14132B" />
            </gradient>
        </aapt:attr>
    </path>
    <path android:pathData="M0,0h512v512h-512z">
        <aapt:attr name="android:fillColor">
            <gradient
                android:centerX="160"
                android:centerY="195"
                android:gradientRadius="260"
                android:type="radial">
                <item android:offset="0.0" android:color="#550055FF" />
                <item android:offset="1.0" android:color="#000055FF" />
            </gradient>
        </aapt:attr>
    </path>
    <path android:pathData="M0,0h512v512h-512z">
        <aapt:attr name="android:fillColor">
            <gradient
                android:centerX="365"
                android:centerY="235"
                android:gradientRadius="260"
                android:type="radial">
                <item android:offset="0.0" android:color="#50E11D48" />
                <item android:offset="1.0" android:color="#00E11D48" />
            </gradient>
        </aapt:attr>
    </path>
</vector>
`;
}

export function buildAndroidForegroundVectorXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="512"
    android:viewportHeight="512">
    <!-- Adaptive Icon Safe Zone Group (66dp / 108dp centered) -->
    <group
        android:pivotX="256"
        android:pivotY="256"
        android:scaleX="0.64"
        android:scaleY="0.64"
        android:translateY="-4">

        <!-- V-Shaped Antennas -->
        <path
            android:pathData="M188,64 L244,122"
            android:strokeWidth="14"
            android:strokeLineCap="round"
            android:strokeColor="#FF38BDF8" />
        <path
            android:pathData="M324,64 L268,122"
            android:strokeWidth="14"
            android:strokeLineCap="round"
            android:strokeColor="#FFEC4899" />

        <!-- Antenna Base -->
        <path
            android:pathData="M236,112 L276,112 A8,8 0 0,1 284,120 L284,120 A8,8 0 0,1 276,128 L236,128 A8,8 0 0,1 228,120 L228,120 A8,8 0 0,1 236,112 Z"
            android:fillColor="#FF0055FF" />

        <!-- TV Screen Frame -->
        <path
            android:pathData="M144,122 L368,122 A44,44 0 0,1 412,166 L412,290 A44,44 0 0,1 368,334 L144,334 A44,44 0 0,1 100,290 L100,166 A44,44 0 0,1 144,122 Z"
            android:fillColor="#FF070B14"
            android:strokeWidth="18">
            <aapt:attr name="android:strokeColor">
                <gradient
                    android:startX="100"
                    android:startY="122"
                    android:endX="412"
                    android:endY="334"
                    android:type="linear">
                    <item android:offset="0.0" android:color="#FF38BDF8" />
                    <item android:offset="0.36" android:color="#FF0055FF" />
                    <item android:offset="0.68" android:color="#FFEC4899" />
                    <item android:offset="1.0" android:color="#FFE11D48" />
                </gradient>
            </aapt:attr>
        </path>

        <!-- Heartbeat Pulse Glow Layer -->
        <path
            android:pathData="M 136 230 H 184 L 202 256 L 233 162 L 265 298 L 295 192 L 315 246 L 330 230 H 376"
            android:strokeWidth="26"
            android:strokeAlpha="0.26"
            android:strokeLineCap="round"
            android:strokeLineJoin="round">
            <aapt:attr name="android:strokeColor">
                <gradient
                    android:startX="136"
                    android:startY="230"
                    android:endX="376"
                    android:endY="230"
                    android:type="linear">
                    <item android:offset="0.0" android:color="#FF38BDF8" />
                    <item android:offset="0.5" android:color="#FF0055FF" />
                    <item android:offset="1.0" android:color="#FFE11D48" />
                </gradient>
            </aapt:attr>
        </path>

        <!-- Heartbeat Pulse Main Neon Stroke -->
        <path
            android:pathData="M 136 230 H 184 L 202 256 L 233 162 L 265 298 L 295 192 L 315 246 L 330 230 H 376"
            android:strokeWidth="15"
            android:strokeLineCap="round"
            android:strokeLineJoin="round">
            <aapt:attr name="android:strokeColor">
                <gradient
                    android:startX="136"
                    android:startY="230"
                    android:endX="376"
                    android:endY="230"
                    android:type="linear">
                    <item android:offset="0.0" android:color="#FF38BDF8" />
                    <item android:offset="0.35" android:color="#FF0055FF" />
                    <item android:offset="0.7" android:color="#FFEC4899" />
                    <item android:offset="1.0" android:color="#FFFF0033" />
                </gradient>
            </aapt:attr>
        </path>

        <!-- Heartbeat Pulse White Core -->
        <path
            android:pathData="M 136 230 H 184 L 202 256 L 233 162 L 265 298 L 295 192 L 315 246 L 330 230 H 376"
            android:strokeWidth="5"
            android:strokeColor="#FFFFFFFF"
            android:strokeLineCap="round"
            android:strokeLineJoin="round" />

        <!-- TV Stand Base -->
        <path
            android:pathData="M234,334 h44 v14 h-44 z"
            android:fillColor="#FF0055FF" />
        <path
            android:pathData="M192,346 L320,346 A6,6 0 0,1 326,352 L326,352 A6,6 0 0,1 320,358 L192,358 A6,6 0 0,1 186,352 L186,352 A6,6 0 0,1 192,346 Z">
            <aapt:attr name="android:fillColor">
                <gradient
                    android:startX="186"
                    android:startY="352"
                    android:endX="326"
                    android:endY="352"
                    android:type="linear">
                    <item android:offset="0.0" android:color="#FF38BDF8" />
                    <item android:offset="0.5" android:color="#FF0055FF" />
                    <item android:offset="1.0" android:color="#FFE11D48" />
                </gradient>
            </aapt:attr>
        </path>

        <!-- "PULSE EPG" Bold Geometric Logotype -->
        <path
            android:pathData="${PULSE_TEXT_PATHS}"
            android:fillColor="#FFFFFFFF" />
    </group>
</vector>
`;
}

function rasterizeSvgToPng(svgContent, outputPath, width, _height) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: width,
    },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();
  fs.writeFileSync(outputPath, pngBuffer);
}

function main() {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });

  const svgAny = buildLauncherSvg({ mode: 'any' });
  const svgMaskable = buildLauncherSvg({ mode: 'maskable' });
  const svgRound = buildLauncherSvg({ mode: 'round' });
  const svgForeground = buildLauncherSvg({ mode: 'foreground' });
  const svgTvBanner = buildTvBannerSvg();

  // 1. Save master SVGs in /public
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon.svg'), svgAny, 'utf8');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'icon-maskable.svg'), svgMaskable, 'utf8');
  fs.writeFileSync(path.join(PUBLIC_DIR, 'tv-banner.svg'), svgTvBanner, 'utf8');

  // 2. Generate PWA & Multi-Terminal PNG icons in /public
  //    Covers Smartphone (72, 96, 144, 180, 192), Tablette (128, 152, 167, 384, 512),
  //    and Android TV / TV Box (tv-banner 320x180 & 640x360)
  const publicPngTargets = [
    { file: 'pwa-72x72.png', svg: svgAny, w: 72, h: 72 },
    { file: 'pwa-96x96.png', svg: svgAny, w: 96, h: 96 },
    { file: 'pwa-128x128.png', svg: svgAny, w: 128, h: 128 },
    { file: 'pwa-144x144.png', svg: svgAny, w: 144, h: 144 },
    { file: 'pwa-152x152.png', svg: svgAny, w: 152, h: 152 },
    { file: 'apple-touch-icon.png', svg: svgMaskable, w: 180, h: 180 },
    { file: 'pwa-192x192.png', svg: svgAny, w: 192, h: 192 },
    { file: 'pwa-384x384.png', svg: svgAny, w: 384, h: 384 },
    { file: 'pwa-512x512.png', svg: svgAny, w: 512, h: 512 },
    { file: 'pwa-maskable-192x192.png', svg: svgMaskable, w: 192, h: 192 },
    { file: 'pwa-maskable-512x512.png', svg: svgMaskable, w: 512, h: 512 },
    { file: 'tv-banner-320x180.png', svg: svgTvBanner, w: 320, h: 180 },
    { file: 'tv-banner-640x360.png', svg: svgTvBanner, w: 640, h: 360 },
  ];

  for (const t of publicPngTargets) {
    rasterizeSvgToPng(t.svg, path.join(PUBLIC_DIR, t.file), t.w, t.h);
  }

  // 3. Generate Native Android Mipmap & Drawable resources for Smartphone, Tablette, Android TV & TV Box
  //    Standard launcher icon sizes (48..192px), Adaptive foregrounds (108..432px), and Leanback TV banners (160x90..640x360px)
  const androidDensities = [
    { name: 'mdpi', launcher: 48, foreground: 108, bannerW: 160, bannerH: 90 },
    { name: 'hdpi', launcher: 72, foreground: 162, bannerW: 240, bannerH: 135 },
    { name: 'xhdpi', launcher: 96, foreground: 216, bannerW: 320, bannerH: 180 },
    { name: 'xxhdpi', launcher: 144, foreground: 324, bannerW: 480, bannerH: 270 },
    { name: 'xxxhdpi', launcher: 192, foreground: 432, bannerW: 640, bannerH: 360 },
  ];

  for (const d of androidDensities) {
    const mipmapDir = path.join(ANDROID_RES_DIR, `mipmap-${d.name}`);
    rasterizeSvgToPng(svgAny, path.join(mipmapDir, 'ic_launcher.png'), d.launcher, d.launcher);
    rasterizeSvgToPng(svgRound, path.join(mipmapDir, 'ic_launcher_round.png'), d.launcher, d.launcher);
    rasterizeSvgToPng(
      svgForeground,
      path.join(mipmapDir, 'ic_launcher_foreground.png'),
      d.foreground,
      d.foreground
    );

    const drawableDir = path.join(ANDROID_RES_DIR, `drawable-${d.name}`);
    rasterizeSvgToPng(svgTvBanner, path.join(drawableDir, 'tv_banner.png'), d.bannerW, d.bannerH);
  }

  // 4. Write Android Adaptive Icon XMLs (mipmap-anydpi-v26 & drawable vectors)
  const anyDpiDir = path.join(ANDROID_RES_DIR, 'mipmap-anydpi-v26');
  fs.mkdirSync(anyDpiDir, { recursive: true });
  const adaptiveLauncherXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@drawable/ic_launcher_foreground" />
    <monochrome android:drawable="@drawable/ic_launcher_foreground" />
</adaptive-icon>
`;
  fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher.xml'), adaptiveLauncherXml, 'utf8');
  fs.writeFileSync(path.join(anyDpiDir, 'ic_launcher_round.xml'), adaptiveLauncherXml, 'utf8');

  const drawableMainDir = path.join(ANDROID_RES_DIR, 'drawable');
  fs.mkdirSync(drawableMainDir, { recursive: true });
  fs.writeFileSync(
    path.join(drawableMainDir, 'ic_launcher_background.xml'),
    buildAndroidBackgroundVectorXml(),
    'utf8'
  );
  fs.writeFileSync(
    path.join(drawableMainDir, 'ic_launcher_foreground.xml'),
    buildAndroidForegroundVectorXml(),
    'utf8'
  );

  const valuesDir = path.join(ANDROID_RES_DIR, 'values');
  fs.mkdirSync(valuesDir, { recursive: true });
  fs.writeFileSync(
    path.join(valuesDir, 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0A0E17</color>
</resources>
`,
    'utf8'
  );

  console.log('Successfully generated PulseEPG launcher icons & TV banners for all terminals.');
}

main();
