# DesiStream Proxy — Free Forever Setup

## Option A: Vercel (easiest, no Docker)
1. Go to https://vercel.com → Sign up (GitHub account, free, no credit card)
2. Click "Add New" → "Project"
3. Import this `desistream-proxy` folder from your computer
4. Click "Deploy" — done in 30 seconds
5. Copy your `*.vercel.app` URL
6. Paste it into DesiStream Pro's Settings → Proxy URL

The proxy is now live, free forever. Vercel free tier: 100GB bandwidth/month.

## Option B: Render.com (Docker, free, ~30s cold start)
1. Go to https://render.com → Sign up (free, no credit card)
2. Dashboard → "New +" → "Web Service"
3. Select "Deploy an existing image from a registry"
4. Image URL: `ghcr.io/inside4ndroid/tmdb-embed-api:latest`
5. Add env variable: `TMDB_API_KEY` = `b403bac81ca2635d0183091c867efd81`
6. Plan: **Free** ($0/month)
7. Click "Create Web Service" → wait ~2 min for deploy
8. Copy your `*.onrender.com` URL
9. Paste it into DesiStream Pro's Settings → Proxy URL

⚠️ **Free tier sleeps after 15 min idle** → first click on "Direct HD" takes ~30s to wake up. After that, streaming is smooth. Next movie = another cold start.

## Option C: Belmo.io (Docker, never sleeps)
1. Go to https://belmo.io → Sign up (free, no credit card)
2. Push this `desistream-proxy` folder to a **GitHub repo** (it has a `Dockerfile`)
3. In Belmo dashboard → "New Service" → connect your GitHub repo
4. Belmo detects the Dockerfile automatically → click **Deploy**
5. Add env variable: `TMDB_API_KEY` = `b403bac81ca2635d0183091c867efd81`
6. Wait ~2 min → copy your `*.belmo.io` URL
7. Paste it into DesiStream Pro's Settings → Proxy URL

✅ Best option. Free forever, **never sleeps**, no cold start, no credit card.

## Fallback
If your proxy is down, the app still uses iframe embedding (SuperEmbed, Embed.su, VidCore) — movies play in iframe mode.
