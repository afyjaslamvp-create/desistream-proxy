import http from 'http';
import https from 'https';
import url from 'url';
const PORT = process.env.PORT || 3000;

function fetch(u) {
  const mod = u.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    const req = mod.get(u, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 15000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data, headers: res.headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function tryEmbedSu(tmdbId, type) {
  try {
    const ep = type === 'movie' ? `movie/${tmdbId}` : `tv/${tmdbId}/1/1`;
    const r = await fetch(`https://embed.su/api/embed/${ep}`);
    if (r.status === 200) {
      const d = JSON.parse(r.data);
      if (d?.url) return { url: d.url, type: d.url.includes('.m3u8') ? 'hls' : 'mp4' };
    }
  } catch {}
  return null;
}

async function tryMultiEmbed(tmdbId, type) {
  try {
    const r = await fetch(`https://multiembed.mov/api/stream?tmdbId=${tmdbId}&type=${type}`);
    if (r.status === 200) {
      const d = JSON.parse(r.data);
      if (d?.url) return { url: d.url, type: d.url.includes('.m3u8') ? 'hls' : 'mp4' };
    }
  } catch {}
  return null;
}

async function tryVidSrc(tmdbId, type) {
  try {
    const t = type === 'movie' ? 'movie' : 'tv';
    const r = await fetch(`https://vidsrc.to/embed/${t}/${tmdbId}`);
    if (r.status === 200) {
      const m = r.data.match(/(https?:\/\/[^"']*\.(?:m3u8|mp4)[^"']*)/);
      if (m) return { url: m[1], type: m[1].includes('.m3u8') ? 'hls' : 'mp4' };
    }
  } catch {}
  return null;
}

const providers = [tryEmbedSu, tryMultiEmbed, tryVidSrc];

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.end();

  const p = url.parse(req.url, true);
  const m = p.pathname.match(/^\/api\/streams\/(movie|tv)\/(\d+)/i);
  if (!m) return res.writeHead(404).end(JSON.stringify({ error: 'Use /api/streams/movie/:id or /api/streams/tv/:id' }));

  const type = m[1];
  const tmdbId = m[2];

  for (const provider of providers) {
    const result = await provider(tmdbId, type);
    if (result) return res.end(JSON.stringify({ streams: { proxy: result } }));
  }

  res.end(JSON.stringify({ error: 'No stream available' }));
});

server.listen(PORT, () => console.log(`DesiStream proxy on :${PORT}`));
