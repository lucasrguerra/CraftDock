# Multi-stage: compile native deps on Debian (glibc) where leveldb-zlib's
# cmake-js build is well-supported, then ship a slim runtime.
#
# Why not Alpine? `leveldb-zlib` is a native addon that compiles from source via
# cmake-js. On Alpine/musl (esp. ARM64) that build repeatedly failed at the CMake
# configure step; Debian glibc is the reliable path for this toolchain.
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ cmake zlib1g-dev ca-certificates \
 && npm ci --omit=dev

FROM node:20-bookworm-slim
WORKDIR /app
# The compiled node-leveldb.node links libz (zlib1g) and libstdc++6, both already
# present in the slim base image — so no extra runtime packages are needed.
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY scripts ./scripts
ENV NODE_ENV=production
EXPOSE 8081
CMD ["node", "src/main.js"]
