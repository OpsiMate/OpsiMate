# Build stage
FROM node:20-alpine AS builder

# Install build tools and clean up in same layer
RUN npm install -g pnpm typescript && \
    npm cache clean --force

WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/
COPY packages/shared/package.json ./packages/shared/
COPY packages/custom-actions/package.json ./packages/custom-actions/

# Install dependencies with cleanup in same layer
RUN pnpm install --frozen-lockfile && \
    if [ "$(uname -m)" = "aarch64" ]; then pnpm add @rollup/rollup-linux-arm64-musl --save-dev --filter @OpsiMate/client; fi && \
    pnpm store prune

# Copy source code and build
COPY . .
RUN pnpm run build && \
    pnpm prune --prod && \
    pnpm store prune && \
    rm -rf .pnpm-store node_modules/.cache

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
COPY --from=builder /app/packages/custom-actions/dist ./packages/custom-actions/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/client/dist ./apps/client/dist

# Copy package files for production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/custom-actions/package.json ./packages/custom-actions/

# Install production dependencies using the actual package.json files
RUN npm install -g pnpm && \
    pnpm install --prod --frozen-lockfile && \
    pnpm store prune && \
    npm cache clean --force && \
    rm -rf /tmp/* /var/cache/apk/* /root/.npm

# Create workspace linking for shared package
RUN mkdir -p node_modules/@OpsiMate && \
    ln -sf /app/packages/shared node_modules/@OpsiMate/shared && \
    ln -sf /app/packages/custom-actions node_modules/@OpsiMate/custom-actions

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
CMD ["sh", "-c", "serve -s /app/apps/client/dist -l 8080 & cd /app/apps/server && node dist/index.js"]