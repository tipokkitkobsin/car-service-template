FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY web/core ./web/core
COPY bot/package.json bot/package-lock.json ./bot/
RUN cd bot && npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
    --fetch-retries=5 --fetch-retry-maxtimeout=120000 --fetch-timeout=300000 --maxsockets=4
COPY bot/src ./bot/src
USER node
CMD ["node", "bot/src/index.mjs"]
