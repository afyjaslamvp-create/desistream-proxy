FROM node:22-slim
WORKDIR /app
COPY package.json server.mjs ./
RUN npm install --omit=dev
EXPOSE 3000
CMD ["node", "server.mjs"]
