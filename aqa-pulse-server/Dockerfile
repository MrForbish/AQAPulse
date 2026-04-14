FROM node:22-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY bin ./bin
COPY dist ./dist
COPY README.md ./README.md

ENV PORT=3000
ENV AQA_PULSE_DATA_ROOT=/data
ENV AQA_PULSE_STORAGE_DRIVER=file
ENV AQA_PULSE_ENABLE_DEV_BOOTSTRAP=false

EXPOSE 3000

CMD ["sh", "-lc", "node ./bin/aqa-pulse-server.js init && node ./bin/aqa-pulse-server.js start"]

