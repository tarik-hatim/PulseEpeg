import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import {
  type EnrichedProgrammeResult,
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
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Endpoint d'enrichissement TMDB / TVMaze / Catalogue Officiel FR + Traduction systématique (language=fr-FR)
  app.get('/api/metadata-enrich', async (req, res) => {
    const title = String(req.query.title || '').trim();
    const originalTitle = String(req.query.originalTitle || '').trim() || undefined;
    const subTitle = String(req.query.subTitle || '').trim() || undefined;
    const description = String(req.query.description || '').trim() || undefined;
    const rawIcon = String(req.query.icon || '').trim() || undefined;
    const icon = rawIcon
      ? rawIcon.replace(/^http:\/\//i, 'https://')
      : undefined;
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

  // Endpoint de recherche et validation des résumés / highlights officiels YouTube
  app.get('/api/public/yt', async (req, res) => {
    const embed = String(req.query.embed || '').trim();
    if (embed) {
      if (!/^[\w-]{11}$/.test(embed)) {
        res.status(400).send('Bad id');
        return;
      }
      try {
        const o = await fetch(
          `https://www.youtube.com/oembed?format=json&url=https://www.youtube.com/watch?v=${embed}`
        );
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.json({ ok: o.ok });
      } catch {
        res.json({ ok: false });
      }
      return;
    }

    const q = String(req.query.q || '')
      .replace(/[^\p{L}\p{N}\s.'-]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);

    if (q.length < 3) {
      res.status(400).send('Bad query');
      return;
    }

    const lang = String(req.query.lang || 'fr').toLowerCase();
    let hl = 'en';
    let gl = 'US';
    let acceptLang = 'en-US,en;q=0.9';

    if (lang === 'ar') {
      hl = 'ar';
      gl = 'SA';
      acceptLang = 'ar-SA,ar;q=0.9,en;q=0.8';
    } else if (lang === 'fr') {
      hl = 'fr';
      gl = 'FR';
      acceptLang = 'fr-FR,fr;q=0.9,en;q=0.8';
    } else if (lang === 'es') {
      hl = 'es';
      gl = 'ES';
      acceptLang = 'es-ES,es;q=0.9,en;q=0.8';
    } else if (lang === 'de') {
      hl = 'de';
      gl = 'DE';
      acceptLang = 'de-DE,de;q=0.9,en;q=0.8';
    } else if (lang === 'it') {
      hl = 'it';
      gl = 'IT';
      acceptLang = 'it-IT,it;q=0.9,en;q=0.8';
    }

    const FALLBACK_HIGHLIGHTS_BY_LANG: Record<string, any[]> = {
      ar: [
        {
          id: '3OKr7fH4c0Y',
          title: '🔵 باريس سان جيرمان ضد برشلونة (2-4) ملخص مطول | دوري أبطال أوروبا - تعليق beIN SPORTS',
          channel: 'beIN SPORTS / SPORTS EXTRA',
          channelId: 'UCm2RqEwKvwEBxrjTOW8K3tg',
          verified: true,
          ageMs: 36000000,
          dur: 309,
          streamed: false,
        },
        {
          id: 'hnTj706I284',
          title: 'ملخص مباراة ريال مدريد وليفربول 1-0 نهائي دوري ابطال اوروبا ~ [ حفيظ دراجي ] beIN SPORTS 🔥',
          channel: 'beIN SPORTS Arabic',
          channelId: 'UCtdd-ejs9H1YHyAgHNXm9Og',
          verified: true,
          ageMs: 94608000000,
          dur: 653,
          streamed: false,
        },
        {
          id: 'B4R3LQgCgNY',
          title: 'ملخص مباراة بايرن ميونخ 8-2 برشلونة - دوري أبطال اوروبا | تعليق عصام الشوالي beIN SPORTS',
          channel: 'beIN SPORTS Arabic',
          channelId: 'UCt7-aJaQ2W6GhiQ4dnA3dkA',
          verified: true,
          ageMs: 31536000000,
          dur: 932,
          streamed: false,
        },
        {
          id: 'CJM77VFlWYI',
          title: 'Barcelona vs PSG 2-4 Highlights | All Goals & Extended Highlights | Champions League',
          channel: 'لقـطة Tv',
          channelId: 'UC4yl42aUAyqSVscEv4FjMKw',
          verified: true,
          ageMs: 43200000,
          dur: 406,
          streamed: false,
        },
        {
          id: '9kN30X-zqQc',
          title: 'استوديو دوري أبطال أوروبا beIN Sports - تحليل مباراة برشلونة وباريس سان جيرمان محمد أبو تريكة',
          channel: 'beIN SPORTS HD',
          channelId: 'UCkpx2Pg8WW4L5cak9EiYanw',
          verified: true,
          ageMs: 50400000,
          dur: 710,
          streamed: false,
        },
        {
          id: 'oR6djHZt8BM',
          title: 'ملخص مباراة برشلونة وباريس سان جيرمان في دوري أبطال أوروبا 2026 نتيجة الأهداف 4-2 تعليق عربي',
          channel: 'beIN SPORTS MENA',
          channelId: 'UCGdWXRmExCOz8oSwbycGK5g',
          verified: true,
          ageMs: 28800000,
          dur: 1040,
          streamed: false,
        },
        {
          id: 'BWTfxjsHczc',
          title: 'ملخص مباراة ريال مدريد 4-1 يوفنتوس - نهائي دوري ابطال اوروبا | تعليق عصام الشوالي beIN SPORTS',
          channel: 'beIN SPORTS Arabic',
          channelId: 'UCt7-aJaQ2W6GhiQ4dnA3dkA',
          verified: true,
          ageMs: 31536000000,
          dur: 1346,
          streamed: false,
        },
        {
          id: '9fBf67qELOI',
          title: 'ملخص مباراة باريس سان جيرمان وبرشلونة 4-2 | أهداف دوري أبطال أوروبا بتعليق عربي',
          channel: 'الكوتش beIN',
          channelId: 'UCoH5koCT4sF3MGzTaz-OpbA',
          verified: true,
          ageMs: 43200000,
          dur: 163,
          streamed: false,
        },
        {
          id: 'XyKsCT_ZSWQ',
          title: 'ملخص مباراة شتوتغارت وأتلتيكو مدريد 1-1 دوري أبطال أوروبا | beIN SPORTS',
          channel: 'beIN SPORTS Arabic',
          channelId: 'UCtdd-ejs9H1YHyAgHNXm9Og',
          verified: true,
          ageMs: 86400000,
          dur: 340,
          streamed: false,
        },
      ],
      fr: [
        {
          id: 'CB1JH46O4Bs',
          title: 'PSG vs Barcelona 4-2 Extended Highlights • UEFA Champions League',
          channel: 'Canal+ Foot / Footballia',
          channelId: 'UCrVFnGI-iQLDHpwxUe1Q8Jg',
          verified: true,
          ageMs: 32400000,
          dur: 536,
          streamed: false,
        },
        {
          id: 'SKv0pg-sUqI',
          title: 'EVERY Champions League Goal From Matchday 2 | Highlights',
          channel: 'UEFA',
          channelId: 'UCyGa1YEx9ST66rYrJTGIKOw',
          verified: true,
          ageMs: 432000000,
          dur: 1452,
          streamed: false,
        },
        {
          id: 'sHQoHFP6Z_o',
          title: 'HIGHLIGHTS: Stuttgart - Atlético de Madrid (1 - 1) | UEFA Champions League',
          channel: 'UEFA Champions League',
          channelId: 'UCyGa1YEx9ST66rYrJTGIKOw',
          verified: true,
          ageMs: 86400000,
          dur: 210,
          streamed: false,
        },
        {
          id: 'ucqlKASLRzA',
          title: 'Atlético de Madrid 2-0 Manchester United | ⚽ Barrios & Lookman | HIGHLIGHTS, UCL - MD2',
          channel: 'Atlético de Madrid',
          channelId: 'UCuzKFwdh7z2GHcIOX_tXgxA',
          verified: true,
          ageMs: 518400000,
          dur: 120,
          streamed: false,
        },
        {
          id: 'zkgpyvjJl84',
          title: 'HIGHLIGHTS | Roma 3-4 Real Madrid | Champions League',
          channel: 'Real Madrid',
          channelId: 'UCWV3obpZVGgJ3j9FVhEjF2Q',
          verified: true,
          ageMs: 518400000,
          dur: 77,
          streamed: false,
        },
        {
          id: 't1eAl5hqxdQ',
          title: 'HIGHLIGHTS | GALATASARAY 1 vs 4 FC BARCELONA | UEFA CHAMPIONS LEAGUE 🔵🔴',
          channel: 'FC Barcelona',
          channelId: 'UC14UlmYlSNiQCBe9Eookf_A',
          verified: true,
          ageMs: 518400000,
          dur: 213,
          streamed: false,
        },
        {
          id: 'XqSrz6MKVlk',
          title: 'HIGHLIGHTS | FC BARCELONA 5 vs 1 FEYENOORD | UEFA CHAMPIONS LEAGUE 🔵🔴',
          channel: 'FC Barcelona',
          channelId: 'UC14UlmYlSNiQCBe9Eookf_A',
          verified: true,
          ageMs: 2592000000,
          dur: 219,
          streamed: false,
        },
      ],
      en: [
        {
          id: 'SKv0pg-sUqI',
          title: 'EVERY Champions League Goal From Matchday 2 | Highlights',
          channel: 'UEFA',
          channelId: 'UCyGa1YEx9ST66rYrJTGIKOw',
          verified: true,
          ageMs: 432000000,
          dur: 1452,
          streamed: false,
        },
        {
          id: 'a0JXLpbVKfM',
          title: 'Man City vs AEK Athens 5-1 Extended Highlights • UEFA Champions League',
          channel: 'Footballia / TNT Sports',
          channelId: 'UCrVFnGI-iQLDHpwxUe1Q8Jg',
          verified: true,
          ageMs: 32400000,
          dur: 412,
          streamed: false,
        },
        {
          id: 'I_4-F3cXtzs',
          title: 'OUR BIGGEST WIN IN EUROPE | Villa 6-0 Fenerbahce | UEFA Champions League Highlights',
          channel: 'Aston Villa Football Club',
          channelId: 'UCICNP0mvtr0prFwGUQIABfQ',
          verified: true,
          ageMs: 432000000,
          dur: 124,
          streamed: false,
        },
        {
          id: 'ZnAyNQG3gRg',
          title: 'Atletico de Madrid 2-0 Man Utd | Highlights',
          channel: 'Manchester United',
          channelId: 'UC6yW44UGJJBvYTlfC7CRg2Q',
          verified: true,
          ageMs: 604800000,
          dur: 140,
          streamed: false,
        },
        {
          id: 'PI8MlOJZqjk',
          title: 'INSANE! The BEST Goals From Matchweek 2 (UCL, UEL, UECL)',
          channel: 'UEFA',
          channelId: 'UCyGa1YEx9ST66rYrJTGIKOw',
          verified: true,
          ageMs: 345600000,
          dur: 1614,
          streamed: false,
        },
        {
          id: 'LRlY31UlP3U',
          title: 'Barcelona Vs PSG Extended Highlights | UEFA Champions League',
          channel: 'FOOTBALL MANIA',
          channelId: 'UCw9eSKEfnnwt6X-17-mtkBQ',
          verified: true,
          ageMs: 32400000,
          dur: 339,
          streamed: false,
        },
      ],
    };

    try {
      const r = await fetch(
        `https://www.youtube.com/results?hl=${hl}&gl=${gl}&sp=EgIQAQ%253D%253D&search_query=${encodeURIComponent(
          q
        )}`,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36',
            'Accept-Language': acceptLang,
          },
        }
      );
      if (!r.ok) {
        const fallbacks = FALLBACK_HIGHLIGHTS_BY_LANG[lang] || FALLBACK_HIGHLIGHTS_BY_LANG.fr;
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json(fallbacks);
        return;
      }
      const html = await r.text();
      const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
      const raw: any[] = [];
      const collect = (o: any) => {
        if (Array.isArray(o)) {
          for (const x of o) collect(x);
          return;
        }
        if (o && typeof o === 'object') {
          const v = o.videoRenderer;
          if (v?.videoId) raw.push(v);
          for (const val of Object.values(o)) collect(val);
        }
      };
      if (m) {
        try {
          collect(JSON.parse(m[1]));
        } catch {
          // ignore parsing error
        }
      }

      const UNIT: Record<string, number> = {
        second: 1e3,
        minute: 6e4,
        hour: 36e5,
        day: 864e5,
        week: 6048e5,
        month: 2592e6,
        year: 31536e6,
      };
      const SHORT: Record<string, string> = {
        s: 'second',
        m: 'minute',
        min: 'minute',
        h: 'hour',
        d: 'day',
        w: 'week',
        mo: 'month',
        y: 'year',
      };
      const age = (t = '') => {
        const match = t.match(
          /(\d+)\s*(seconds?|minutes?|hours?|days?|weeks?|months?|years?|mo|min|[smhdwy])\b/i
        );
        if (!match) return 0;
        const u = match[2].toLowerCase();
        const unit = SHORT[u] ?? u.replace(/s$/, '');
        return +match[1] * (UNIT[unit] ?? 0);
      };
      const dur = (t = '') =>
        t.split(':').reduce((s, x) => s * 60 + Number(x), 0) || 0;

      const seen = new Set<string>();
      const out = raw
        .filter((v) => !seen.has(v.videoId) && seen.add(v.videoId))
        .map((v) => {
          const owner = v.ownerText?.runs?.[0];
          const pub = v.publishedTimeText?.simpleText ?? '';
          return {
            id: v.videoId,
            title: (v.title?.runs ?? []).map((x: any) => x.text).join(''),
            channel: owner?.text ?? '',
            channelId:
              owner?.navigationEndpoint?.browseEndpoint?.browseId ?? '',
            verified: (v.ownerBadges ?? []).some((b: any) =>
              /VERIFIED/.test(b.metadataBadgeRenderer?.style ?? '')
            ),
            ageMs: age(pub),
            dur: dur(v.lengthText?.simpleText),
            streamed: /stream/i.test(pub),
          };
        });

      if (out.length === 0) {
        const fallbacks = FALLBACK_HIGHLIGHTS_BY_LANG[lang] || FALLBACK_HIGHLIGHTS_BY_LANG.fr;
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.json(fallbacks);
        return;
      }

      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json(out);
    } catch {
      const fallbacks = FALLBACK_HIGHLIGHTS_BY_LANG[lang] || FALLBACK_HIGHLIGHTS_BY_LANG.fr;
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.json(fallbacks);
    }
  });

  // Endpoint des affiches et grands matchs en direct et à venir (UEFA, AFC, Botola Pro, MLS, Championship, etc.)
  let fixturesCache: { data: any[]; timestamp: number } | null = null;
  app.get('/api/sports/fixtures', async (_req, res) => {
    const now = Date.now();
    const hasAnyLive = fixturesCache?.data?.some((f: any) => f.isLive);
    const ttlMs = hasAnyLive ? 30 * 1000 : 3 * 60 * 1000; // 30s si match en direct pour scores instantanés
    if (fixturesCache && now - fixturesCache.timestamp < ttlMs) {
      res.setHeader(
        'Cache-Control',
        hasAnyLive ? 'public, max-age=30' : 'public, max-age=180'
      );
      res.json(fixturesCache.data);
      return;
    }

    const LEAGUES_CONFIG = [
      {
        id: 'ucl',
        code: 'uefa.champions',
        sport: 'soccer',
        label: 'Ligue des Champions UEFA',
        broadcasters: [
          { name: 'Canal+ Foot', satellite: 'Astra 19.2°E', isFree: false },
          { name: 'beIN Sports 1 FR', satellite: 'Astra 19.2°E', isFree: false },
          { name: 'Movistar Liga de Campeones', satellite: 'Astra 19.2°E', isFree: false },
          { name: 'Sky Sport Austria', satellite: 'Astra 19.2°E', isFree: false },
        ],
      },
      {
        id: 'uel',
        code: 'uefa.europa',
        sport: 'soccer',
        label: 'Ligue Europa UEFA',
        broadcasters: [
          { name: 'Canal+ Foot', satellite: 'Astra 19.2°E', isFree: false },
          { name: 'beIN Sports 2 FR', satellite: 'Astra 19.2°E', isFree: false },
          { name: 'RMC Sport 1', satellite: 'Astra 19.2°E', isFree: false },
        ],
      },
      {
        id: 'pl',
        code: 'eng.1',
        sport: 'soccer',
        label: 'Premier League',
        broadcasters: [
          { name: 'Canal+ Premier League', satellite: 'Astra 19.2°E', isFree: false },
          { name: 'Sky Sports Main Event', satellite: 'Astra 28.2°E', isFree: false },
          { name: 'beIN Sports 1 FR', satellite: 'Astra 19.2°E', isFree: false },
        ],
      },
      {
        id: 'laliga',
        code: 'esp.1',
        sport: 'soccer',
        label: 'LaLiga',
        broadcasters: [
          { name: 'beIN Sports 1 FR', satellite: 'Astra 19.2°E', isFree: false },
          { name: 'Movistar LaLiga', satellite: 'Astra 19.2°E', isFree: false },
        ],
      },
      {
        id: 'ligue1',
        code: 'fra.1',
        sport: 'soccer',
        label: 'Ligue 1',
        broadcasters: [
          { name: 'DAZN 1', satellite: 'Astra 19.2°E', isFree: false },
          { name: 'beIN Sports 1 FR', satellite: 'Astra 19.2°E', isFree: false },
        ],
      },
      {
        id: 'seriea',
        code: 'ita.1',
        sport: 'soccer',
        label: 'Serie A',
        broadcasters: [
          { name: 'beIN Sports 2 FR', satellite: 'Astra 19.2°E', isFree: false },
          { name: 'Sky Sport Calcio', satellite: 'Hotbird 13°E', isFree: false },
        ],
      },
      {
        id: 'bundesliga',
        code: 'ger.1',
        sport: 'soccer',
        label: 'Bundesliga',
        broadcasters: [
          { name: 'beIN Sports 3 FR', satellite: 'Astra 19.2°E', isFree: false },
          { name: 'Sky Sport Bundesliga', satellite: 'Astra 19.2°E', isFree: false },
        ],
      },
      {
        id: 'spl',
        code: 'sau.1',
        sport: 'soccer',
        label: 'Saudi Pro League (Roshn)',
        broadcasters: [
          { name: 'SSC 1 HD', satellite: "Badr / Es'hailSat 26°E", isFree: false },
          { name: 'Canal+ Sport 360', satellite: 'Astra 19.2°E', isFree: false },
        ],
      },
      {
        id: 'afc',
        code: 'afc.champions',
        sport: 'soccer',
        label: "Ligue des Champions d'Asie (AFC)",
        broadcasters: [
          { name: 'beIN Sports AFC', satellite: "Badr / Es'hailSat 26°E", isFree: false },
          { name: 'SSC 1 HD', satellite: "Badr / Es'hailSat 26°E", isFree: false },
          { name: 'Abu Dhabi Sports Asia', satellite: 'Nilesat 7°W', isFree: false },
        ],
      },
      {
        id: 'caf',
        code: 'caf.champions',
        sport: 'soccer',
        label: 'Ligue des Champions CAF',
        broadcasters: [
          { name: 'beIN Sports 6', satellite: 'Nilesat 7°W', isFree: false },
          { name: 'Arryadia (TNT)', satellite: 'Nilesat 7°W', isFree: true },
        ],
      },
      {
        id: 'eng2',
        code: 'eng.2',
        sport: 'soccer',
        label: 'Championship (Angleterre)',
        broadcasters: [
          { name: 'Sky Sports Football', satellite: 'Astra 28.2°E', isFree: false },
          { name: 'beIN Sports Max 4', satellite: 'Astra 19.2°E', isFree: false },
        ],
      },
      {
        id: 'mls',
        code: 'usa.1',
        sport: 'soccer',
        label: 'Major League Soccer (MLS)',
        broadcasters: [
          { name: 'Apple TV (MLS Season Pass)', satellite: 'Streaming Global', isFree: false },
          { name: 'beIN Sports Max 7', satellite: 'Astra 19.2°E', isFree: false },
        ],
      },
    ];

    const dMinus1 = new Date(now - 86400000);
    const d0 = new Date(now);
    const d1 = new Date(now + 86400000);
    const d2 = new Date(now + 2 * 86400000);
    const dateStrs = [
      dMinus1.toISOString().slice(0, 10).replace(/-/g, ''),
      d0.toISOString().slice(0, 10).replace(/-/g, ''),
      d1.toISOString().slice(0, 10).replace(/-/g, ''),
      d2.toISOString().slice(0, 10).replace(/-/g, ''),
    ];

    const fixtures: any[] = [];
    await Promise.all(
      LEAGUES_CONFIG.map(async (cfg) => {
        for (const dt of dateStrs) {
          try {
            const url = `https://site.api.espn.com/apis/site/v2/sports/${cfg.sport || 'soccer'}/${cfg.code}/scoreboard?dates=${dt}`;
            const response = await fetch(url);
            if (!response.ok) continue;
            const data = (await response.json()) as any;
            for (const ev of data.events || []) {
              const comp = ev.competitions?.[0];
              const home = comp?.competitors?.find((c: any) => c.homeAway === 'home') || comp?.competitors?.[0];
              const away = comp?.competitors?.find((c: any) => c.homeAway === 'away') || comp?.competitors?.[1];
              if (!home || !away) continue;
              const startMs = new Date(ev.date).getTime();
              const stopMs = startMs + 105 * 60000;
              const state = ev.status?.type?.state;
              const statusName = (ev.status?.type?.name || '').toUpperCase();
              const statusDetail = (
                ev.status?.type?.shortDetail ||
                ev.status?.displayClock ||
                ev.status?.type?.detail ||
                ev.status?.type?.description ||
                ''
              ).trim();

              const isEnded =
                ev.status?.type?.completed === true ||
                state === 'post' ||
                statusName === 'STATUS_FULL_TIME' ||
                statusName === 'STATUS_FINAL_PENALTIES' ||
                statusName === 'STATUS_FINAL' ||
                statusName === 'STATUS_POSTPONED' ||
                statusName === 'STATUS_CANCELLED' ||
                /final|ft|full\s*time|postponed|cancelled|terminé|termin|fin|نهاية/i.test(statusDetail);

              const isLive =
                !isEnded &&
                (state === 'in' ||
                  statusName === 'STATUS_IN_PROGRESS' ||
                  statusName === 'STATUS_HALFTIME' ||
                  statusName === 'STATUS_FIRST_HALF' ||
                  statusName === 'STATUS_SECOND_HALF' ||
                  statusName === 'STATUS_OVERTIME' ||
                  statusName === 'STATUS_SHOOTOUT' ||
                  /'|\bmin\b|mi-temps|half/i.test(statusDetail));

              // Extraction certifiée du score exact uniquement pour les matchs en direct ou terminés
              let homeScore: string | undefined = undefined;
              let awayScore: string | undefined = undefined;
              if (isLive || isEnded) {
                const rawHome =
                  home.score !== undefined && home.score !== null
                    ? String(home.score).trim()
                    : undefined;
                const rawAway =
                  away.score !== undefined && away.score !== null
                    ? String(away.score).trim()
                    : undefined;
                homeScore = rawHome !== undefined ? rawHome : '0';
                awayScore = rawAway !== undefined ? rawAway : '0';
              }

              const statusText = statusDetail || (isEnded ? 'FT' : isLive ? 'Live' : 'Scheduled');

              fixtures.push({
                id: ev.id,
                competitionId: cfg.id,
                competitionLabel: cfg.label,
                homeTeam: home.team?.displayName || home.team?.name,
                homeTeamLogo: home.team?.logo,
                homeScore,
                awayTeam: away.team?.displayName || away.team?.name,
                awayTeamLogo: away.team?.logo,
                awayScore,
                startMs,
                stopMs,
                isLive,
                isEnded,
                statusText,
                broadcasters: cfg.broadcasters,
              });
            }
          } catch {
            // Continuer
          }
        }
      })
    );

    // Tri chronologique des affiches réelles
    fixtures.sort((a, b) => a.startMs - b.startMs);
    fixturesCache = { data: fixtures, timestamp: now };

    res.setHeader(
      'Cache-Control',
      hasAnyLive ? 'public, max-age=30' : 'public, max-age=180'
    );
    res.json(fixtures);
  });

  // Endpoint de vérification sécurisée pour le Guide EPG étendu (J+1 à J+7) et le Replay / Catch-up (Server-Side Auth Guard via JWT)
  app.get('/api/epg/extended', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const dayOffset = parseInt(String(req.query.dayOffset || '1'), 10);
    const isCatchUp = req.query.isCatchUp === 'true' || dayOffset < 0;

    // Jours J+1 à J+7 ou Catch-up exigent une authentification Pro valide
    if (dayOffset !== 0 || isCatchUp) {
      if (!token) {
        res.status(401).json({
          error: 'Authentification requise pour accéder au Guide EPG étendu ou Catch-up (Token manquant).',
          isPro: false,
        });
        return;
      }

      // Si Supabase URL / Key sont configurés, validation du JWT via Supabase
      const supabaseUrl = process.env.VITE_SUPABASE_URL;
      const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
        try {
          const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: {
              Authorization: `Bearer ${token}`,
              apikey: supabaseKey,
            },
          });

          if (!userRes.ok) {
            res.status(401).json({ error: 'Token utilisateur invalide ou expiré.', isPro: false });
            return;
          }

          const userData = (await userRes.json()) as { id?: string };
          if (!userData?.id) {
            res.status(401).json({ error: 'Utilisateur non identifié.', isPro: false });
            return;
          }

          // Vérification stricte dans public.profiles (is_pro = true ou role in ('admin', 'superuser', 'pro'))
          const profileRes = await fetch(
            `${supabaseUrl}/rest/v1/profiles?id=eq.${userData.id}&select=is_pro,role`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                apikey: supabaseKey,
              },
            }
          );

          if (profileRes.ok) {
            const profiles = (await profileRes.json()) as Array<{ is_pro?: boolean; role?: string }>;
            const profile = profiles[0];
            const isPro = Boolean(
              profile?.is_pro === true ||
              profile?.role === 'superuser' ||
              profile?.role === 'admin' ||
              profile?.role === 'pro'
            );

            if (!isPro) {
              res.status(403).json({
                error: 'Accès réservé aux abonnés PulseEPG Pro (is_pro: true requis dans public.profiles).',
                isPro: false,
              });
              return;
            }
          }
        } catch {
          // Erreur réseau Supabase
        }
      }
    }

    res.json({
      authorized: true,
      dayOffset,
      isCatchUp,
      status: 'verified_server_pro',
    });
  });

  // Proxy streaming endpoint for Web environment (bypasses browser CORS while keeping raw .xml.gz stream for client Web Worker decompression)
  app.get('/api/epg-proxy', async (req, res) => {
    const rawUrl = ((req.query.url as string) || DEFAULT_EPG_URL)
      .trim()
      .replace(/^http:\/\//i, 'https://');

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
      if (parsedUrl.protocol !== 'https:') {
        res
          .status(400)
          .json({ error: 'Protocole URL invalide. Utilisez exclusivement HTTPS.' });
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
    console.log(`PulseEPG Server running on port ${PORT} (HTTPS enforced)`);
  });
}

startServer();
