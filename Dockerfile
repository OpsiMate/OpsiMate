# Build stage
FROM node:20-alpine AS builder

# Install build tools
RUN npm install -g pnpm typescript

WORKDIR /app

# Copy source and build
COPY . .
RUN pnpm install --frozen-lockfile && \
    if [ "$(uname -m)" = "aarch64" ]; then pnpm add @rollup/rollup-linux-arm64-musl --save-dev --filter @OpsiMate/client; fi && \
    pnpm run build && \
    pnpm prune --prod && \
    pnpm store prune

# Production stage - minimal runtime
FROM node:20-alpine

# Install only runtime essentials
RUN npm install -g serve && \
    apk add --no-cache dumb-init

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S opsimate -u 1001 && \
    mkdir -p /app/data/database /app/data/private-keys /app/config

WORKDIR /app

# Copy only built assets and runtime files
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/client/dist ./apps/client/dist

# Install only the essential runtime dependencies manually
RUN npm install --no-save --no-package-lock \
    better-sqlite3@12.2.0 \
    express@4.19.2 \
    cors@2.8.5 \
    js-yaml@4.1.0 \
    jsonwebtoken@9.0.2 \
    bcrypt@5.1.0 \
    zod@3.23.8 \
    express-promise-router@4.1.1 \
    node-ssh@13.1.0 \
    @kubernetes/client-node@1.3.0 && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/cache/apk/* /root/.npm

# Copy only package.json files for runtime info
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Create workspace linking for shared package
RUN mkdir -p node_modules/@OpsiMate && \
    ln -sf /app/packages/shared node_modules/@OpsiMate/shared

# Copy config files
COPY --chown=opsimate:nodejs default-config.yml /app/config/default-config.yml
COPY --chown=opsimate:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Adjust permissions
RUN chown -R opsimate:nodejs /app

USER opsimate

EXPOSE 3001 8080
VOLUME ["/app/data/database", "/app/data/private-keys", "/app/config"]

ENV NODE_ENV=production

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["sh", "-c", "serve -s /app/apps/client/dist -l 8080 & cd /app/apps/server && node dist/src/index.js"]