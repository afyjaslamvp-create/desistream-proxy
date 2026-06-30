export default async function handler(req, res) {
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const tmdbId = searchParams.get('tmdbId');
  const type = searchParams.get('type') || 'movie';

  if (!tmdbId) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ error: 'Missing tmdbId' });
  }

  const apis = [
    `https://streamprovider.byteful.me/?tmdbId=${tmdbId}`,
  ];

  for (const url of apis) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!r.ok) continue;
      const text = await r.text();
      try {
        const jd = JSON.parse(text);
        const u = jd.url || jd.stream || jd.hls || jd.src || jd.file;
        if (u && (u.includes('.m3u8') || u.includes('.mp4'))) {
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.json({ url: u, type: u.includes('.m3u8') ? 'hls' : 'mp4', from: url });
        }
      } catch {}
      if (text.startsWith('#EXTM3U')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.json({ url, type: 'hls', from: url });
      }
    } catch {}
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ error: 'No stream available' });
}
