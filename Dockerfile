FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache git && \
    git clone --depth 1 https://github.com/Inside4ndroid/TMDB-Embed-API.git . && \
    npm install --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production API_PORT=8787 BIND_HOST=0.0.0.0
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apiServer.js ./
COPY --from=build /app/public ./public
COPY --from=build /app/providers ./providers
COPY --from=build /app/proxy ./proxy
COPY --from=build /app/utils ./utils
COPY --from=build /app/package.json ./
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://localhost:8787/api/health || exit 1
CMD ["node","apiServer.js"]
