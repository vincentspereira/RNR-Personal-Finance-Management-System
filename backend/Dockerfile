# syntax=docker/dockerfile:1.6
# Multi-stage build for the PFMS backend.
# Final image carries only production dependencies + compiled JS.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.json ./
COPY src ./src
COPY migrations ./migrations
COPY package*.json ./
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# Re-install production deps only (no dev deps in the final image)
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY --from=build /app/migrations ./migrations
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 5000
# Healthcheck pings /api/health.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget --quiet --spider http://127.0.0.1:5000/api/health || exit 1
CMD ["node", "dist/server.js"]
