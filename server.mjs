import http from 'http';
import url from 'url';

const PORT = process.env.PORT || 3000;

async function fetchText(u) {
  const r = await fetch(u, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      'Referer': 'https://vidsrc.to/',
      'Accept': '*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  return r.text();
}

const PROVIDERS = [
  // Provider 1: vidsrc.vc (simple direct embeds)
  {
    name: 'VidSrcVC',
    extract: async (tmdbId, type) => {
      const t = type === 'movie' ? 'movie' : 'tv';
      const html = await fetchText(`https://vidsrc.vc/embed/${t}/${tmdbId}`);
      // Look for direct video URL in the page
      const m3u8 = html.match(/https?[^"'\s<>]+\.m3u8[^"'\s<>]*/);
      if (m3u8) return m3u8[0];
      // Look for iframe with source
      const iframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframe) {
        const iframeHtml = await fetchText(iframe[1]);
        const m = iframeHtml.match(/https?[^"'\s<>]+\.m3u8[^"'\s<>]*/);
        if (m) return m[0];
      }
      return null;
    }
  },

  // Provider 2: superembed (direct stream URLs in page source)
  {
    name: 'SuperEmbed',
    extract: async (tmdbId, type) => {
      const t = type === 'movie' ? 'movie' : 'tv';
      const html = await fetchText(`https://multiembed.mov/?video_id=${tmdbId}&tmdb=1`);
      const m3u8 = html.match(/https?[^"'\s<>]+\.m3u8[^"'\s<>]*/);
      if (m3u8) return m3u8[0];
      const mp4 = html.match(/https?[^"'\s<>]+\.mp4[^"'\s<>]*/);
      if (mp4) return mp4[0];
      return null;
    }
  },

  // Provider 3: embed.su (search for direct sources)
  {
    name: 'EmbedSu',
    extract: async (tmdbId, type) => {
      const t = type === 'movie' ? 'movie' : 'tv';
      const html = await fetchText(`https://embed.su/embed/${t}/${tmdbId}`);
      const m3u8 = html.match(/https?[^"'\s<>]+\.m3u8[^"'\s<>]*/);
      if (m3u8) return m3u8[0];
      const iframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframe) {
        try {
          const iframeHtml = await fetchText(iframe[1]);
          const m = iframeHtml.match(/https?[^"'\s<>]+\.m3u8[^"'\s<>]*/);
          if (m) return m[0];
        } catch {}
      }
      return null;
    }
  },

  // Provider 4: 2embed
  {
    name: '2Embed',
    extract: async (tmdbId, type) => {
      const t = type === 'movie' ? 'movie' : 'tv';
      const html = await fetchText(`https://www.2embed.cc/embed/${t}/${tmdbId}`);
      const m3u8 = html.match(/https?[^"'\s<>]+\.m3u8[^"'\s<>]*/);
      if (m3u8) return m3u8[0];
      return null;
    }
  },

  // Provider 5: vidsrc.to (complex - try to extract iframe source)
  {
    name: 'VidSrcTo',
    extract: async (tmdbId, type) => {
      const t = type === 'movie' ? 'movie' : 'tv';
      const html = await fetchText(`https://vidsrc.to/embed/${t}/${tmdbId}`);
      // Look for any video URL pattern
      const all = html.match(/https?[^"'\s<>]++\.(?:m3u8|mp4)[^"'\s<>]*/gi);
      if (all && all.length) return all[0];
      // Look for iframe
      const iframe = html.match(/<iframe[^>]+src=["']([^"']+)["']/i);
      if (iframe) {
        try {
          const iframeHtml = await fetchText(iframe[1]);
          const m = iframeHtml.match(/https?[^"'\s<>]+\.m3u8[^"'\s<>]*/);
          if (m) return m[0];
        } catch {}
      }
      return null;
    }
  },

  // Provider 6: 2embed.skin (another 2embed variant)
  {
    name: '2EmbedSkin',
    extract: async (tmdbId, type) => {
      const t = type === 'movie' ? 'movie' : 'tv';
      const html = await fetchText(`https://www.2embed.skin/embed/${t}/${tmdbId}`);
      const m3u8 = html.match(/https?[^"'\s<>]+\.m3u8[^"'\s<>]*/);
      if (m3u8) return m3u8[0];
      return null;
    }
  },
];

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.end();

  const p = url.parse(req.url, true);
  const m = p.pathname.match(/^\/api\/streams\/(movie|tv)\/(\d+)/i);

  if (!m) {
    if (p.pathname === '/api/health' || p.pathname === '/api/test') {
      return res.end(JSON.stringify({ ok: true }));
    }
    return res.writeHead(404).end(JSON.stringify({ error: 'use /api/streams/movie/:id' }));
  }

  const tmdbId = m[2];
  const type = m[1];
  const results = {};
  let foundAny = false;

  console.log(`\nExtract ${type}/${tmdbId}`);
  for (const prov of PROVIDERS) {
    try {
      const url = await prov.extract(tmdbId, type);
      if (url) {
        results[prov.name] = url;
        foundAny = true;
        console.log(`  ${prov.name}: FOUND ${url.substring(0, 80)}`);
      } else {
        console.log(`  ${prov.name}: no stream`);
      }
    } catch (e) {
      console.log(`  ${prov.name}: error ${e.message}`);
    }
  }

  res.end(JSON.stringify({
    success: foundAny,
    tmdbId, type,
    count: Object.keys(results).length,
    streams: results,
  }));
});

server.listen(PORT, () => console.log(`Direct fetch proxy on :${PORT}`));
