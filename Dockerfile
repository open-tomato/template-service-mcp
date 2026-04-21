# Minimal Dockerfile for an adopted MCP service.
#
# NOTE: most MCP clients launch the server as a subprocess over stdio,
# in which case this Dockerfile is only useful if you also adapt the
# server to listen over HTTP (remove `MCP_TRANSPORT=stdio`).

FROM oven/bun:1-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
WORKDIR /app

COPY tsconfig.json ./
COPY src ./src

RUN bun run check-types

FROM oven/bun:1-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY --from=build /app/src ./src

EXPOSE 8080

CMD ["bun", "src/index.ts"]
