# ----------------------------
# Builder Stage
# ----------------------------
FROM node:20-alpine AS builder

RUN addgroup -g 1001 -S nodejs && \
    adduser -S opsimate -u 1001

WORKDIR /app

# Install pnpm globally
RUN npm install -g pnpm

# Copy full repo for building
COPY . .

# Install dependencies
RUN pnpm install

# Build required packages
RUN pnpm turbo run build --filter=apps/server... --filter=apps/client...

# ----------------------------
# Production Stage
# ----------------------------
FROM node:20-alpine AS production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S opsimate -u 1001 && \
    mkdir -p /app/data/database /app/data/private-keys /app/config

WORKDIR /app

# Copy node_modules and built assets from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/client/dist ./apps/client/dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml

# Copy runtime files
COPY --chown=opsimate:nodejs default-config.yml /app/config/default-config.yml
COPY --chown=opsimate:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

RUN chown -R opsimate:nodejs /app/data /app/config

USER opsimate

EXPOSE 3001 8080
VOLUME ["/app/data/database", "/app/data/private-keys", "/app/config"]

ENV NODE_ENV=production

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["sh", "-c", "serve -s /app/apps/client/dist -l 8080 & pnpm run start"]

# ----------------------------
# Development Stage
# ----------------------------
FROM node:20-alpine AS development

RUN addgroup -g 1001 -S nodejs && \
    adduser -S opsimate -u 1001 && \
    mkdir -p /app/data/database /app/data/private-keys /app/config /app/.turbo/cache

WORKDIR /app

COPY package.json pnpm-lock.yaml turbo.json pnpm-workspace.yaml ./

RUN npm install -g pnpm

# Copy full repo
COPY --chown=opsimate:nodejs . .

# Install dependencies
RUN pnpm install

# Build shared package for dev
RUN pnpm turbo run build --filter=@OpsiMate/shared...

COPY --chown=opsimate:nodejs default-config.yml /app/config/default-config.yml
COPY --chown=opsimate:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

RUN chown -R opsimate:nodejs /app/data /app/config /app/node_modules /app/packages /app/apps /app/.turbo

USER opsimate

EXPOSE 3001 8080
VOLUME ["/app/data/database", "/app/data/private-keys", "/app/config", "/app/.turbo/cache"]

ENV NODE_ENV=development

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["pnpm", "run", "dev"]
