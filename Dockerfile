# ----------------------------
# Builder Stage
# ----------------------------
FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ bash

WORKDIR /app

RUN npm install -g pnpm

# Copy all files needed for build
COPY package.json pnpm-lock.yaml turbo.json pnpm-workspace.yaml ./
COPY apps ./apps
COPY packages ./packages

# Install all deps (dev + prod)
RUN pnpm install

# Build required packages
RUN pnpm turbo run build --filter=apps/server... --filter=apps/client...

# ----------------------------
# Production Stage
# ----------------------------
FROM node:20-alpine AS production

RUN apk add --no-cache bash curl

RUN addgroup -g 1001 -S nodejs && \
    adduser -S opsimate -u 1001 && \
    mkdir -p /app/data/database /app/data/private-keys /app/config

WORKDIR /app

# Copy only built dist + package files
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/client/dist ./apps/client/dist
COPY package.json pnpm-lock.yaml ./

# Install only production deps
RUN npm install -g pnpm serve && pnpm install --prod

# Copy runtime files
COPY --chown=opsimate:nodejs default-config.yml /app/config/default-config.yml
COPY --chown=opsimate:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh && \
    chown -R opsimate:nodejs /app/data /app/config

USER opsimate

EXPOSE 3001 8080
VOLUME ["/app/data/database", "/app/data/private-keys", "/app/config"]

ENV NODE_ENV=production
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["sh", "-c", "serve -s /app/apps/client/dist -l 8080 & pnpm run start"]
