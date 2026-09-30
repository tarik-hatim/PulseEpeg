import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

/**
 * Unwraps CSS Cascade Layers (@layer name { ... }) and converts modern CSS functions
 * (color-mix, logical properties, inset) so that Android 8/9/10 WebViews (Chromium 61–98)
 * render 100% of Tailwind v4 styles identically to Android 12/14+.
 */
function unwrapCssLayers(css: string): string {
  // Remove standalone @layer declarations like "@layer theme, base, components, utilities;"
  const out = css.replace(/@layer\s+[^{;]+;/g, '');

  // Unwrap "@layer <name> { ... }" blocks while preserving inner braces
  let result = '';
  let i = 0;
  const len = out.length;

  while (i < len) {
    const layerMatch = out.slice(i).match(/^@layer\s+[a-zA-Z0-9_-]*\s*\{/);
    if (layerMatch) {
      i += layerMatch[0].length;
      let depth = 1;
      const blockStart = i;
      while (i < len && depth > 0) {
        const ch = out[i];
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        i++;
      }
      const innerContent = out.slice(blockStart, i - 1);
      result += unwrapCssLayers(innerContent) + '\n';
    } else {
      const nextAt = out.indexOf('@layer', i + 1);
      if (nextAt === -1) {
        result += out.slice(i);
        break;
      } else {
        result += out.slice(i, nextAt);
        i = nextAt;
      }
    }
  }

  // Convert hex color-mix(in ..., #rrggbb XX%, transparent) to universal rgba(r, g, b, a)
  result = result.replace(
    /color-mix\(\s*in\s+[a-z0-9-]+\s*,\s*#([0-9a-fA-F]{6})\s+([0-9.]+)%\s*,\s*transparent\s*\)/g,
    (_m, hex: string, pctStr: string) => {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const alpha = Math.max(0, Math.min(1, parseFloat(pctStr) / 100));
      return `rgba(${r}, ${g}, ${b}, ${Number(alpha.toFixed(3))})`;
    }
  );

  // Add physical top/right/bottom/left fallback before "inset: 0px" / "inset: 0" for Chromium < 87
  result = result.replace(
    /([;{]\s*)inset:\s*0(px)?\s*([;}])/g,
    '$1top:0;right:0;bottom:0;left:0;inset:0$3'
  );

  // Add physical padding-left/right fallbacks for padding-inline-start/end
  result = result.replace(
    /([;{]\s*)padding-inline-start:\s*([^;}]+)([;}])/g,
    '$1padding-left:$2;padding-inline-start:$2$3'
  );
  result = result.replace(
    /([;{]\s*)padding-inline-end:\s*([^;}]+)([;}])/g,
    '$1padding-right:$2;padding-inline-end:$2$3'
  );
  result = result.replace(
    /([;{]\s*)inset-inline-start:\s*([^;}]+)([;}])/g,
    '$1left:$2;inset-inline-start:$2$3'
  );
  result = result.replace(
    /([;{]\s*)inset-inline-end:\s*([^;}]+)([;}])/g,
    '$1right:$2;inset-inline-end:$2$3'
  );

  return result;
}

function androidTvLegacyCssPlugin(): Plugin {
  return {
    name: 'android-tv-legacy-css',
    enforce: 'post',
    transform(code, id) {
      if (!id.includes('.css')) return null;

      // In Vite dev mode, vite:css-post wraps the compiled CSS inside a JS string literal:
      // const __vite__css = "..."
      if (code.includes('__vite__css')) {
        const replaced = code.replace(
          /(const\s+__vite__css\s*=\s*)("(?:\\.|[^"\\])*")/,
          (_full, prefix: string, jsonLiteral: string) => {
            try {
              const rawCss = JSON.parse(jsonLiteral) as string;
              const transformedCss = unwrapCssLayers(rawCss);
              return `${prefix}${JSON.stringify(transformedCss)}`;
            } catch {
              return _full;
            }
          }
        );
        return {
          code: replaced,
          map: null,
        };
      }

      return null;
    },
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        const chunk = bundle[fileName];
        if (
          chunk.type === 'asset' &&
          fileName.endsWith('.css') &&
          typeof chunk.source === 'string'
        ) {
          chunk.source = unwrapCssLayers(chunk.source);
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), androidTvLegacyCssPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2019',
      cssTarget: 'chrome61',
    },
    worker: {
      format: 'iife' as const,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
