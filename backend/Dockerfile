# ── Stage 1: Dependencies ─────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# ── Stage 2: Production ──────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

# Install tini for proper PID 1 signal handling
RUN apk add --no-cache tini curl

ENV NODE_ENV=production

# Non-root user
RUN addgroup --system --gid 1001 appgroup && \
    adduser --system --uid 1001 appuser

COPY --from=deps --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --chown=appuser:appgroup package.json ./
COPY --chown=appuser:appgroup src/ ./src/
COPY --chown=appuser:appgroup migrations/ ./migrations/

USER appuser

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3002/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
