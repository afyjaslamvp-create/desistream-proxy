FROM ghcr.io/inside4ndroid/tmdb-embed-api:latest
EXPOSE 8787
ENV API_PORT=8787 BIND_HOST=0.0.0.0
