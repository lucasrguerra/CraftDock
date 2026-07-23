# Multi-stage: compile native deps on Debian (glibc) where leveldb-zlib's
# cmake-js build is well-supported, then ship a slim runtime.
#
# Why not Alpine? `leveldb-zlib` is a native addon that compiles from source via
# cmake-js. On Alpine/musl (esp. ARM64) that build repeatedly failed at the CMake
# configure step; Debian glibc is the reliable path for this toolchain.
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
# scripts/ must exist before npm ci: the postinstall hook runs the (no-op here)
# icon extraction. --ignore-scripts is NOT an option — leveldb-zlib compiles
# through its own install scripts.
COPY scripts ./scripts
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ cmake zlib1g-dev ca-certificates \
 && npm ci --omit=dev

# Item icons are generated at build time (not committed, not downloaded at
# runtime): install the versioned minecraft-assets package and extract the flat
# item PNGs. Bump ASSETS_VERSION (or rebuild) to pick up new game items.
FROM node:20-bookworm-slim AS assets
ARG ASSETS_VERSION=latest
WORKDIR /app
COPY scripts/extract-mc-assets.mjs scripts/
RUN npm install --no-save --ignore-scripts minecraft-assets@${ASSETS_VERSION} \
 && node scripts/extract-mc-assets.mjs --required

FROM node:20-bookworm-slim
WORKDIR /app
# Patch fixable OS CVEs in the base image at build time (trivy image scan).
RUN apt-get update \
 && apt-get upgrade -y \
 && rm -rf /var/lib/apt/lists/*
# The compiled node-leveldb.node links libz (zlib1g) and libstdc++6, both already
# present in the slim base image — so no extra runtime packages are needed.
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY scripts ./scripts
COPY --from=assets /app/src/public/assets/mc ./src/public/assets/mc
ENV NODE_ENV=production
EXPOSE 8081
# Composes may override with their own healthcheck block; this is the built-in
# default so the image is self-monitoring anywhere it runs (trivy DS-0026).
HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD ["node", "src/healthcheck.js"]
CMD ["node", "src/main.js"]
