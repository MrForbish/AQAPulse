FROM node:22-bookworm-slim

WORKDIR /app

COPY aqa-pulse/package*.json ./aqa-pulse/
COPY aqa-pulse/tsconfig.json ./aqa-pulse/
COPY aqa-pulse/src ./aqa-pulse/src
COPY aqa-pulse/bin ./aqa-pulse/bin
COPY aqa-pulse/README.md ./aqa-pulse/README.md
COPY aqa-pulse/fixtures ./aqa-pulse/fixtures

COPY aqa-pulse-server/package*.json ./aqa-pulse-server/
COPY aqa-pulse-server/bin ./aqa-pulse-server/bin
COPY aqa-pulse-server/scripts ./aqa-pulse-server/scripts
COPY aqa-pulse-server/README.md ./aqa-pulse-server/README.md

RUN cd /app/aqa-pulse && npm ci && npm run compile
RUN cd /app/aqa-pulse-server && npm ci && npm run build

WORKDIR /app/aqa-pulse-server

ENV PORT=3000
ENV AQA_PULSE_DATA_ROOT=/data
ENV AQA_PULSE_STORAGE_DRIVER=file
ENV AQA_PULSE_ENABLE_DEV_BOOTSTRAP=false

EXPOSE 3000

CMD ["sh", "-lc", "npm run init && npm run start"]

