import fs from 'node:fs';
import path from 'node:path';
import { Resvg } from '@resvg/resvg-js';

const ROOT_DIR = process.cwd();
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const ANDROID_RES_DIR = path.join(ROOT_DIR, 'android', 'app', 'src', 'main', 'res');

/**
 * Geometric vector paths for "PULSE EPG" (used exclusivamente on the 16:9 Android TV Leanback horizontal banner).
 * The square/round/adaptive phone & tablet launcher icon uses a pure, bold Netflix-style 3D folded ribbon monogram
 * with zero small text for maximum legibility on mobile home screens.
 */
export const PULSE_TEXT_PATHS = [
  // P (x: 84..116, y: 392..436)
  'M84 436V392H103C111.5 392 117 397.2 117 405.5C117 413.8 111.5 419 103 419H94V436H84ZM94 410.5H102.2C105.4 410.5 107.2 408.7 107.2 405.5C107.2 402.3 105.4 400.5 102.2 400.5H94V410.5Z',
  // U (x: 125..161, y: 392..436.8)
  'M125 392H135V418.5C135 424.5 138.2 427.8 143 427.8C147.8 427.8 151 424.5 151 418.5V392H161V418.8C161 430.2 153.8 436.8 143 436.8C132.2 436.8 125 430.2 125 418.8V392Z',
  // L (x: 171..201, y: 392..436)
  'M171 392H181V427H201V436H171V392Z',
  // S (x: 207..241, y: 391.2..436.8)
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
 * Generates the Netflix-inspired ("Netfly") 3D Folded Ribbon Master SVG Launcher Icon
 * strictly respecting the PulseEPG color charter:
 * - Deep Studio Midnight Navy Canvas (#05070d -> #0a0e17 -> #101729)
 * - Hero Crimson Red 3D Ribbon Fold (#ff0033 -> #e11d48 -> #be123c)
 * - Royal Blue & Electric Cyan Structural Pillar & Under-Fold (#38bdf8 -> #0055ff -> #1d4ed8)
 * - Realistic 3D cast shadows at ribbon overlaps + dynamic Pulse accent in the lower-right counter.
 */
export function buildLauncherSvg({
  mode = 'any', // 'any' | 'maskable' | 'round' | 'foreground'
} = {}) {
  const isMaskable = mode === 'maskable';
  const isRound = mode === 'round';
  const isForegroundOnly = mode === 'foreground';

  // For Android Adaptive / Maskable icons, scale around (256, 256) so 100% of the 3D ribbon
  // sits comfortably inside the 66dp/108dp circle/squircle safe zone across all Android launchers.
  const contentTransform =
    isMaskable || isForegroundOnly
      ? 'translate(256, 256) scale(0.76) translate(-256, -256)'
      : isRound
      ? 'translate(256, 256) scale(0.86) translate(-256, -256)'
      : 'translate(0, 0)';

  const outerRx = isMaskable ? 0 : isRound ? 256 : 114;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <!-- Deep Studio Matte-Dark Navy Background (#05070d -> #0a0e17 -> #111827) -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#05070d" />
      <stop offset="50%" stop-color="#0a0e17" />
      <stop offset="100%" stop-color="#0f1524" />
    </linearGradient>

    <!-- Subtle Netflix-style Center-Top Crimson Studio Spotlight (#e11d48 / #ff0033) -->
    <radialGradient id="crimsonSpotlight" cx="56%" cy="34%" r="54%">
      <stop offset="0%" stop-color="#e11d48" stop-opacity="0.34" />
      <stop offset="55%" stop-color="#e11d48" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#e11d48" stop-opacity="0" />
    </radialGradient>

    <!-- Subtle Bottom-Left Royal Blue Studio Backlight (#0055ff / #38bdf8) -->
    <radialGradient id="blueBacklight" cx="32%" cy="72%" r="54%">
      <stop offset="0%" stop-color="#0055ff" stop-opacity="0.36" />
      <stop offset="55%" stop-color="#0055ff" stop-opacity="0.10" />
      <stop offset="100%" stop-color="#0055ff" stop-opacity="0" />
    </radialGradient>

    <!-- Ribbon 1 (Left Vertical Stem): Deep Royal Blue to Midnight Indigo (#38bdf8 -> #0055ff -> #1e3a8a) -->
    <linearGradient id="stemBlueGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="28%" stop-color="#0055ff" />
      <stop offset="72%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0f2361" />
    </linearGradient>

    <!-- Ribbon 2 (Under-Fold Return Loop): Crimson-Rose to Royal Blue Shadow (#e11d48 -> #ec4899 -> #0055ff -> #172554) -->
    <linearGradient id="underLoopGrad" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#e11d48" />
      <stop offset="32%" stop-color="#be123c" />
      <stop offset="68%" stop-color="#0055ff" />
      <stop offset="100%" stop-color="#172554" />
    </linearGradient>

    <!-- Ribbon 3 (Hero Foreground Diagonal/Curved Fold): Netflix-Style Vivid Crimson (#ff2a55 -> #ff0033 -> #e11d48 -> #9f1239) -->
    <linearGradient id="heroCrimsonGrad" x1="0%" y1="0%" x2="95%" y2="90%">
      <stop offset="0%" stop-color="#ff335c" />
      <stop offset="34%" stop-color="#ff0033" />
      <stop offset="72%" stop-color="#e11d48" />
      <stop offset="100%" stop-color="#9f1239" />
    </linearGradient>

    <!-- Cast Shadow Gradient (Top-Left Stem Fold Shadow) -->
    <linearGradient id="topFoldShadow" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#020409" stop-opacity="0.82" />
      <stop offset="55%" stop-color="#020409" stop-opacity="0.38" />
      <stop offset="100%" stop-color="#020409" stop-opacity="0" />
    </linearGradient>

    <!-- Cast Shadow Gradient (Waist Under-Fold Shadow) -->
    <linearGradient id="waistFoldShadow" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#020409" stop-opacity="0.80" />
      <stop offset="65%" stop-color="#020409" stop-opacity="0.42" />
      <stop offset="100%" stop-color="#020409" stop-opacity="0" />
    </linearGradient>

    <!-- Specular Edge Highlight on Hero Ribbon -->
    <linearGradient id="edgeHighlight" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.65" />
      <stop offset="45%" stop-color="#ffe4e6" stop-opacity="0.25" />
      <stop offset="100%" stop-color="#38bdf8" stop-opacity="0" />
    </linearGradient>

    <!-- Signature Pulse Wave Accent Gradient (#38bdf8 -> #0055ff -> #ec4899 -> #ff0033) -->
    <linearGradient id="pulseWaveGrad" x1="0%" y1="50%" x2="100%" y2="50%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="35%" stop-color="#0055ff" />
      <stop offset="70%" stop-color="#ec4899" />
      <stop offset="100%" stop-color="#ff0033" />
    </linearGradient>

    <!-- Outer Studio Bevel Rim -->
    <linearGradient id="rimGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ff0033" stop-opacity="0.55" />
      <stop offset="50%" stop-color="#0055ff" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#e11d48" stop-opacity="0.55" />
    </linearGradient>
  </defs>

  ${
    !isForegroundOnly
      ? `<!-- Studio Dark Background -->
  <rect width="512" height="512" rx="${outerRx}" fill="url(#bgGrad)" />
  <rect width="512" height="512" rx="${outerRx}" fill="url(#crimsonSpotlight)" />
  <rect width="512" height="512" rx="${outerRx}" fill="url(#blueBacklight)" />`
      : ''
  }

  ${
    !isForegroundOnly && !isMaskable
      ? `<!-- Subtle Studio Squircle Bevel Rim -->
  <rect x="14" y="14" width="484" height="484" rx="${
    isRound ? 242 : 102
  }" fill="none" stroke="url(#rimGrad)" stroke-width="4" />`
      : ''
  }

  <g transform="${contentTransform}">
    <!-- Soft Ambient Drop-Glow Behind the 3D Ribbon Monogram -->
    <path
      d="M 128 84 H 254 C 348 84, 404 134, 404 206 C 404 278, 344 330, 236 330 H 218 V 432 Q 173 424, 128 438 Z"
      fill="#e11d48"
      fill-opacity="0.12"
      transform="translate(0, 8)"
    />

    <!-- =======================================================================
         PLANE 1: LEFT VERTICAL RIBBON STEM (Royal Blue #38bdf8 -> #0055ff -> #1d4ed8)
         With Netflix-style curved bottom baseline arch (Q 173 424, 218 430)
         ======================================================================= -->
    <path
      d="M 128 92 C 128 81, 136 74, 147 74 H 200 C 210 74, 218 81, 218 92 V 430 Q 173 422, 128 438 Z"
      fill="url(#stemBlueGrad)"
    />

    <!-- =======================================================================
         PLANE 2: LOWER RETURN RIBBON OF THE "P" BOWL (Under-Fold Ribbon)
         Sweeps from the right outer loop (404, 204) back into the vertical stem (176, 330)
         ======================================================================= -->
    <path
      d="M 314 184 H 404 C 404 274, 338 332, 232 332 H 176 V 248 H 232 C 284 248, 314 224, 314 196 Z"
      fill="url(#underLoopGrad)"
    />

    <!-- Cast Shadow where Under-Fold Tucks Behind/Into the Vertical Stem -->
    <path
      d="M 218 248 H 268 L 244 332 H 218 Z"
      fill="url(#waistFoldShadow)"
    />

    <!-- Cast Shadow on Vertical Stem under the Top-Left Hero Fold -->
    <path
      d="M 128 148 L 218 112 V 224 L 128 246 Z"
      fill="url(#topFoldShadow)"
    />

    <!-- Cast Shadow on Right Loop under the Hero Foreground Fold -->
    <path
      d="M 312 194 L 404 218 C 401 242, 391 264, 375 282 L 298 232 Z"
      fill="#020409"
      fill-opacity="0.58"
    />

    <!-- =======================================================================
         PLANE 3: HERO FOREGROUND 3D FOLDED RIBBON (Netflix Crimson #ff0033 -> #e11d48)
         Folds diagonally from top-left (128, 74) across the upper arch to the right apex (404, 216)
         ======================================================================= -->
    <path
      d="M 128 92 C 128 81, 136 74, 147 74 H 242 C 344 74, 404 126, 404 202 C 404 214, 402 226, 397 238 L 308 198 C 312 191, 314 183, 314 174 C 314 149, 284 134, 232 134 H 206 L 128 168 Z"
      fill="url(#heroCrimsonGrad)"
    />

    <!-- Crisp 3D Diagonal Fold Crease & Specular Edge on Hero Ribbon -->
    <path
      d="M 130 92 C 130 82, 137 76, 147 76 H 242 C 340 76, 399 125, 401 198"
      fill="none"
      stroke="url(#edgeHighlight)"
      stroke-width="3.5"
      stroke-linecap="round"
    />

    <!-- =======================================================================
         PLANE 4: SIGNATURE "PULSE" ENERGY WAVE IN LOWER-RIGHT COUNTER
         Balances the monumental "P" ribbon with our unmistakable EPG Pulse identity
         ======================================================================= -->
    <!-- Outer Neon Halo -->
    <path
      d="M 248 386 H 284 L 302 346 L 326 420 L 348 366 L 362 386 H 398"
      fill="none"
      stroke="url(#pulseWaveGrad)"
      stroke-width="22"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-opacity="0.28"
    />
    <!-- Main Pulse Gradient Ribbon Stroke -->
    <path
      d="M 248 386 H 284 L 302 346 L 326 420 L 348 366 L 362 386 H 398"
      fill="none"
      stroke="url(#pulseWaveGrad)"
      stroke-width="13"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- Bright White-Hot Specular Core -->
    <path
      d="M 248 386 H 284 L 302 346 L 326 420 L 348 366 L 362 386 H 398"
      fill="none"
      stroke="#ffffff"
      stroke-width="4"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-opacity="0.92"
    />
    <circle cx="248" cy="386" r="6.5" fill="#38bdf8" />
    <circle cx="398" cy="386" r="6.5" fill="#ff0033" />
  </g>
</svg>`;
}

/**
 * Generates the 16:9 Android TV / Google TV / TV Box Leanback Banner (640x360 viewBox)
 * featuring the same Netflix-style 3D Folded Ribbon emblem on the left and bold "PULSE EPG" logotype on the right.
 */
export function buildTvBannerSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360" width="640" height="360">
  <defs>
    <linearGradient id="tvBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#05070d" />
      <stop offset="50%" stop-color="#0a0e17" />
      <stop offset="100%" stop-color="#111827" />
    </linearGradient>
    <radialGradient id="tvCrimsonGlow" cx="28%" cy="42%" r="55%">
      <stop offset="0%" stop-color="#e11d48" stop-opacity="0.36" />
      <stop offset="100%" stop-color="#e11d48" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="tvBlueGlow" cx="75%" cy="58%" r="55%">
      <stop offset="0%" stop-color="#0055ff" stop-opacity="0.34" />
      <stop offset="100%" stop-color="#0055ff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="tvStemBlue" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="30%" stop-color="#0055ff" />
      <stop offset="75%" stop-color="#1d4ed8" />
      <stop offset="100%" stop-color="#0f2361" />
    </linearGradient>
    <linearGradient id="tvUnderLoop" x1="100%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#e11d48" />
      <stop offset="35%" stop-color="#be123c" />
      <stop offset="70%" stop-color="#0055ff" />
      <stop offset="100%" stop-color="#172554" />
    </linearGradient>
    <linearGradient id="tvHeroCrimson" x1="0%" y1="0%" x2="95%" y2="90%">
      <stop offset="0%" stop-color="#ff335c" />
      <stop offset="35%" stop-color="#ff0033" />
      <stop offset="72%" stop-color="#e11d48" />
      <stop offset="100%" stop-color="#9f1239" />
    </linearGradient>
    <linearGradient id="tvBrandGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff0033" />
      <stop offset="45%" stop-color="#e11d48" />
      <stop offset="75%" stop-color="#0055ff" />
      <stop offset="100%" stop-color="#38bdf8" />
    </linearGradient>
  </defs>

  <!-- 16:9 Studio Dark Background for Android TV / TV Box Leanback -->
  <rect width="640" height="360" rx="28" fill="url(#tvBgGrad)" />
  <rect width="640" height="360" rx="28" fill="url(#tvCrimsonGlow)" />
  <rect width="640" height="360" rx="28" fill="url(#tvBlueGlow)" />
  <rect x="8" y="8" width="624" height="344" rx="22" fill="none" stroke="url(#tvBrandGrad)" stroke-width="3" stroke-opacity="0.55" />

  <!-- Left Side: Netflix-Style 3D Folded Ribbon "P" Emblem -->
  <g transform="translate(26, 8) scale(0.67)">
    <path
      d="M 128 92 C 128 81, 136 74, 147 74 H 200 C 210 74, 218 81, 218 92 V 430 Q 173 422, 128 438 Z"
      fill="url(#tvStemBlue)"
    />
    <path
      d="M 314 184 H 404 C 404 274, 338 332, 232 332 H 176 V 248 H 232 C 284 248, 314 224, 314 196 Z"
      fill="url(#tvUnderLoop)"
    />
    <path
      d="M 128 148 L 218 112 V 224 L 128 246 Z"
      fill="#020409"
      fill-opacity="0.68"
    />
    <path
      d="M 128 92 C 128 81, 136 74, 147 74 H 242 C 344 74, 404 126, 404 202 C 404 214, 402 226, 397 238 L 308 198 C 312 191, 314 183, 314 174 C 314 149, 284 134, 232 134 H 206 L 128 168 Z"
      fill="url(#tvHeroCrimson)"
    />
    <path
      d="M 248 386 H 284 L 302 346 L 326 420 L 348 366 L 362 386 H 398"
      fill="none"
      stroke="url(#tvBrandGrad)"
      stroke-width="14"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <path
      d="M 248 386 H 284 L 302 346 L 326 420 L 348 366 L 362 386 H 398"
      fill="none"
      stroke="#ffffff"
      stroke-width="4"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </g>

  <!-- Right Side: Bold "PULSE EPG" Vector Logotype + Netflix-Style Crimson Ribbon Bar -->
  <g transform="translate(238, -200) scale(0.90)">
    <path d="${PULSE_TEXT_PATHS}" fill="#e11d48" opacity="0.45" transform="translate(0, 4)" />
    <path d="${PULSE_TEXT_PATHS}" fill="#ffffff" />
  </g>

  <!-- Crimson & Royal Blue Signature Ribbon Accent on Right Side -->
  <rect x="314" y="206" width="260" height="7" rx="3.5" fill="url(#tvBrandGrad)" />
  <circle cx="326" cy="242" r="6.5" fill="#ff0033" />
  <rect x="342" y="237" width="96" height="10" rx="5" fill="#e11d48" />
  <rect x="448" y="237" width="126" height="10" rx="5" fill="#0055ff" fill-opacity="0.85" />
</svg>`;
}

/**
 * Generates Android Adaptive Icon VectorDrawables (API 26+)
 * - drawable/ic_launcher_background.xml (108dp x 108dp studio dark background with crimson/blue glow)
 * - drawable/ic_launcher_foreground.xml (108dp x 108dp Netflix-style 3D folded ribbon monogram)
 * - drawable/ic_launcher_monochrome.xml (108dp x 108dp Android 13+ Material You themed icon silhouette)
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
                <item android:offset="0.0" android:color="#FF05070D" />
                <item android:offset="0.5" android:color="#FF0A0E17" />
                <item android:offset="1.0" android:color="#FF0F1524" />
            </gradient>
        </aapt:attr>
    </path>
    <path android:pathData="M0,0h512v512h-512z">
        <aapt:attr name="android:fillColor">
            <gradient
                android:centerX="286"
                android:centerY="174"
                android:gradientRadius="270"
                android:type="radial">
                <item android:offset="0.0" android:color="#55E11D48" />
                <item android:offset="1.0" android:color="#00E11D48" />
            </gradient>
        </aapt:attr>
    </path>
    <path android:pathData="M0,0h512v512h-512z">
        <aapt:attr name="android:fillColor">
            <gradient
                android:centerX="164"
                android:centerY="368"
                android:gradientRadius="270"
                android:type="radial">
                <item android:offset="0.0" android:color="#550055FF" />
                <item android:offset="1.0" android:color="#000055FF" />
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
    <!-- Adaptive Icon Safe Zone Group (66dp / 108dp centered across all Android launchers) -->
    <group
        android:pivotX="256"
        android:pivotY="256"
        android:scaleX="0.68"
        android:scaleY="0.68">

        <!-- Plane 1: Left Vertical Stem (Royal Blue #38bdf8 -> #0055ff -> #1d4ed8) -->
        <path
            android:pathData="M 128 92 C 128 81, 136 74, 147 74 H 200 C 210 74, 218 81, 218 92 V 430 Q 173 422, 128 438 Z">
            <aapt:attr name="android:fillColor">
                <gradient
                    android:startX="173"
                    android:startY="74"
                    android:endX="173"
                    android:endY="438"
                    android:type="linear">
                    <item android:offset="0.0" android:color="#FF38BDF8" />
                    <item android:offset="0.28" android:color="#FF0055FF" />
                    <item android:offset="0.72" android:color="#FF1D4ED8" />
                    <item android:offset="1.0" android:color="#FF0F2361" />
                </gradient>
            </aapt:attr>
        </path>

        <!-- Plane 2: Lower Return Ribbon of the "P" Bowl -->
        <path
            android:pathData="M 314 184 H 404 C 404 274, 338 332, 232 332 H 176 V 248 H 232 C 284 248, 314 224, 314 196 Z">
            <aapt:attr name="android:fillColor">
                <gradient
                    android:startX="404"
                    android:startY="184"
                    android:endX="176"
                    android:endY="332"
                    android:type="linear">
                    <item android:offset="0.0" android:color="#FFE11D48" />
                    <item android:offset="0.35" android:color="#FFBE123C" />
                    <item android:offset="0.70" android:color="#FF0055FF" />
                    <item android:offset="1.0" android:color="#FF172554" />
                </gradient>
            </aapt:attr>
        </path>

        <!-- 3D Cast Shadow on Vertical Stem under Top-Left Fold -->
        <path
            android:pathData="M 128 148 L 218 112 V 224 L 128 246 Z"
            android:fillColor="#B0020409" />

        <!-- 3D Cast Shadow on Right Loop under Hero Foreground Fold -->
        <path
            android:pathData="M 312 194 L 404 218 C 401 242, 391 264, 375 282 L 298 232 Z"
            android:fillColor="#94020409" />

        <!-- Plane 3: Hero Foreground 3D Folded Ribbon (Netflix-Style Vivid Crimson #ff0033 -> #e11d48) -->
        <path
            android:pathData="M 128 92 C 128 81, 136 74, 147 74 H 242 C 344 74, 404 126, 404 202 C 404 214, 402 226, 397 238 L 308 198 C 312 191, 314 183, 314 174 C 314 149, 284 134, 232 134 H 206 L 128 168 Z">
            <aapt:attr name="android:fillColor">
                <gradient
                    android:startX="128"
                    android:startY="74"
                    android:endX="404"
                    android:endY="238"
                    android:type="linear">
                    <item android:offset="0.0" android:color="#FFFF335C" />
                    <item android:offset="0.35" android:color="#FFFF0033" />
                    <item android:offset="0.72" android:color="#FFE11D48" />
                    <item android:offset="1.0" android:color="#FF9F1239" />
                </gradient>
            </aapt:attr>
        </path>

        <!-- Plane 4: Signature Pulse Energy Wave in Lower-Right Counter -->
        <path
            android:pathData="M 248 386 H 284 L 302 346 L 326 420 L 348 366 L 362 386 H 398"
            android:strokeWidth="15"
            android:strokeLineCap="round"
            android:strokeLineJoin="round">
            <aapt:attr name="android:strokeColor">
                <gradient
                    android:startX="248"
                    android:startY="386"
                    android:endX="398"
                    android:endY="386"
                    android:type="linear">
                    <item android:offset="0.0" android:color="#FF38BDF8" />
                    <item android:offset="0.35" android:color="#FF0055FF" />
                    <item android:offset="0.70" android:color="#FFEC4899" />
                    <item android:offset="1.0" android:color="#FFFF0033" />
                </gradient>
            </aapt:attr>
        </path>
        <path
            android:pathData="M 248 386 H 284 L 302 346 L 326 420 L 348 366 L 362 386 H 398"
            android:strokeWidth="4.5"
            android:strokeColor="#FFFFFFFF"
            android:strokeLineCap="round"
            android:strokeLineJoin="round" />
    </group>
</vector>
`;
}

export function buildAndroidMonochromeVectorXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="512"
    android:viewportHeight="512">
    <group
        android:pivotX="256"
        android:pivotY="256"
        android:scaleX="0.68"
        android:scaleY="0.68">
        <path
            android:pathData="M 128 92 C 128 81, 136 74, 147 74 H 200 C 210 74, 218 81, 218 92 V 430 Q 173 422, 128 438 Z"
            android:fillColor="#FFFFFFFF"
            android:fillAlpha="0.78" />
        <path
            android:pathData="M 314 184 H 404 C 404 274, 338 332, 232 332 H 176 V 248 H 232 C 284 248, 314 224, 314 196 Z"
            android:fillColor="#FFFFFFFF"
            android:fillAlpha="0.88" />
        <path
            android:pathData="M 128 92 C 128 81, 136 74, 147 74 H 242 C 344 74, 404 126, 404 202 C 404 214, 402 226, 397 238 L 308 198 C 312 191, 314 183, 314 174 C 314 149, 284 134, 232 134 H 206 L 128 168 Z"
            android:fillColor="#FFFFFFFF" />
        <path
            android:pathData="M 248 386 H 284 L 302 346 L 326 420 L 348 366 L 362 386 H 398"
            android:strokeWidth="15"
            android:strokeColor="#FFFFFFFF"
            android:strokeLineCap="round"
            android:strokeLineJoin="round" />
    </group>
</vector>
`;
}

export function buildAndroidTvBannerVectorXml() {
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:aapt="http://schemas.android.com/aapt"
    android:width="320dp"
    android:height="180dp"
    android:viewportWidth="640"
    android:viewportHeight="360">
    <path android:pathData="M0,0h640v360h-640z">
        <aapt:attr name="android:fillColor">
            <gradient
                android:startX="0"
                android:startY="0"
                android:endX="640"
                android:endY="360"
                android:type="linear">
                <item android:offset="0.0" android:color="#FF05070D" />
                <item android:offset="0.5" android:color="#FF0A0E17" />
                <item android:offset="1.0" android:color="#FF111827" />
            </gradient>
        </aapt:attr>
    </path>
    <group
        android:translateX="26"
        android:translateY="8"
        android:scaleX="0.67"
        android:scaleY="0.67">
        <path
            android:pathData="M 128 92 C 128 81, 136 74, 147 74 H 200 C 210 74, 218 81, 218 92 V 430 Q 173 422, 128 438 Z"
            android:fillColor="#FF0055FF" />
        <path
            android:pathData="M 314 184 H 404 C 404 274, 338 332, 232 332 H 176 V 248 H 232 C 284 248, 314 224, 314 196 Z"
            android:fillColor="#FF1D4ED8" />
        <path
            android:pathData="M 128 148 L 218 112 V 224 L 128 246 Z"
            android:fillColor="#B0020409" />
        <path
            android:pathData="M 128 92 C 128 81, 136 74, 147 74 H 242 C 344 74, 404 126, 404 202 C 404 214, 402 226, 397 238 L 308 198 C 312 191, 314 183, 314 174 C 314 149, 284 134, 232 134 H 206 L 128 168 Z"
            android:fillColor="#FFE11D48" />
        <path
            android:pathData="M 248 386 H 284 L 302 346 L 326 420 L 348 366 L 362 386 H 398"
            android:strokeWidth="14"
            android:strokeColor="#FFFF0033"
            android:strokeLineCap="round"
            android:strokeLineJoin="round" />
    </group>
    <group
        android:translateX="238"
        android:translateY="-200"
        android:scaleX="0.90"
        android:scaleY="0.90">
        <path
            android:pathData="${PULSE_TEXT_PATHS}"
            android:fillColor="#FFFFFFFF" />
    </group>
    <path
        android:pathData="M314,206 h260 v7 h-260 z"
        android:fillColor="#FFE11D48" />
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
  //    Covers Smartphone (72, 96, 144, 180, 192), Tablette (128, 152, 384, 512),
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
    <monochrome android:drawable="@drawable/ic_launcher_monochrome" />
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
  fs.writeFileSync(
    path.join(drawableMainDir, 'ic_launcher_monochrome.xml'),
    buildAndroidMonochromeVectorXml(),
    'utf8'
  );
  fs.writeFileSync(
    path.join(drawableMainDir, 'tv_banner.xml'),
    buildAndroidTvBannerVectorXml(),
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

  console.log('Successfully generated Netflix-style PulseEPG launcher icons & TV banners for all Android devices.');
}

main();
