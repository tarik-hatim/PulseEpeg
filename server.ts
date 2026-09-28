import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  EnrichedProgrammeResult,
  resolveOfficialFrenchMetadata,
} from './src/utils/metadataResolverCore.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_EPG_URL =
  'https://epgshare01.online/epgshare01/epg_ripper_PL1.xml.gz';

const serverMetadataCache = new Map<string, EnrichedProgrammeResult>();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Endpoint d'enrichissement TMDB / TVMaze / Catalogue Officiel FR + Traduction systématique (language=fr-FR)
  app.get('/api/metadata-enrich', async (req, res) => {
    const title = String(req.query.title || '').trim();
    const originalTitle = String(req.query.originalTitle || '').trim() || undefined;
    const subTitle = String(req.query.subTitle || '').trim() || undefined;
    const description = String(req.query.description || '').trim() || undefined;
    const icon = String(req.query.icon || '').trim() || undefined;
    const episodeNum = String(req.query.episodeNum || '').trim() || undefined;
    const year = String(req.query.year || '').trim() || undefined;
    const category = String(req.query.category || '').trim() || undefined;
    const rawCategory = String(req.query.rawCategory || '').trim() || undefined;
    const country = String(req.query.country || '').trim() || undefined;
    const xmlOriginCountry =
      String(req.query.xmlOriginCountry || '').trim() || undefined;
    const language =
      String(req.query.language || req.query.lang || 'fr-FR').trim() || 'fr-FR';

    if (!title && !originalTitle) {
      res.status(400).json({ error: 'Paramètre title ou originalTitle requis.' });
      return;
    }

    const cacheKey = `v6|${language}|${originalTitle || title}|${subTitle || ''}|${episodeNum || ''}|${year || ''}|${(description || '').slice(0, 32)}`.toLowerCase();
    const cached = serverMetadataCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    try {
      const result = await resolveOfficialFrenchMetadata(
        {
          title,
          originalTitle,
          subTitle,
          description,
          icon,
          episodeNum,
          year,
          category,
          rawCategory,
          country,
          xmlOriginCountry,
          lang: language,
        },
        process.env.TMDB_API_KEY
      );

      if (serverMetadataCache.size > 1500) {
        const firstKey = serverMetadataCache.keys().next().value;
        if (firstKey) serverMetadataCache.delete(firstKey);
      }
      serverMetadataCache.set(cacheKey, result);

      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.json(result);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur enrichissement métadonnées FR';
      res.status(500).json({ error: message });
    }
  });

  // Endpoint de résolution de Bande-annonce YouTube (TMDB / YouTube Trailer ID) pour le lecteur modal intégré
  app.get('/api/trailer-search', async (req, res) => {
    const query = String(req.query.q || '').trim();
    if (!query) {
      res.status(400).json({ error: 'Paramètre q requis.' });
      return;
    }

    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
        `${query} bande annonce VF trailer officiel`
      )}`;
      const ytRes = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });

      if (ytRes.ok) {
        const html = await ytRes.text();
        const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
        if (match && match[1]) {
          res.setHeader('Cache-Control', 'public, max-age=86400');
          res.json({ videoId: match[1] });
          return;
        }
      }
      res.status(404).json({ error: 'Aucune bande-annonce YouTube trouvée.' });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erreur recherche bande-annonce';
      res.status(500).json({ error: message });
    }
  });

  // Proxy streaming endpoint for Web environment (bypasses browser CORS while keeping raw .xml.gz stream for client Web Worker decompression)
  app.get('/api/epg-proxy', async (req, res) => {
    const rawUrl = (req.query.url as string) || DEFAULT_EPG_URL;

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
      if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
        res
          .status(400)
          .json({ error: 'Protocole URL invalide. Utilisez HTTP ou HTTPS.' });
        return;
      }
    } catch {
      res.status(400).json({ error: 'URL EPG invalide.' });
      return;
    }

    try {
      const controller = new AbortController();
      req.on('close', () => {
        if (!res.writableEnded) {
          controller.abort();
        }
      });

      const upstream = await fetch(parsedUrl.toString(), {
        headers: {
          'Accept-Encoding': 'identity',
          'User-Agent': 'PulseEPG-Capacitor/1.0 (Android; Mobile)',
        },
        signal: controller.signal,
      });

      if (!upstream.ok) {
        res.status(upstream.status).json({
          error: `Erreur serveur EPG source (${upstream.status} ${upstream.statusText})`,
        });
        return;
      }

      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'public, max-age=1800');

      const contentLength = upstream.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
        res.setHeader('X-EPG-Total-Bytes', contentLength);
      }

      const lastModified = upstream.headers.get('last-modified');
      if (lastModified) {
        res.setHeader('X-EPG-Last-Modified', lastModified);
      }

      if (!upstream.body) {
        res.status(502).json({ error: 'Flux EPG vide.' });
        return;
      }

      const nodeStream = Readable.fromWeb(
        upstream.body as import('stream/web').ReadableStream
      );
      nodeStream.on('error', (err) => {
        if (!res.headersSent) {
          res.status(502).json({ error: err.message });
        } else {
          res.end();
        }
      });
      nodeStream.pipe(res);
    } catch (err: unknown) {
      if (!res.headersSent) {
        const message =
          err instanceof Error
            ? err.message
            : 'Erreur réseau lors de la récupération EPG';
        res.status(500).json({ error: message });
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PulseEPG Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
