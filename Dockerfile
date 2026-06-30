FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install && npx playwright install --with-deps chromium
COPY server.mjs ./
EXPOSE 3000
CMD ["node", "server.mjs"]
