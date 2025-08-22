# ----------------------------
# Builder Stage
# ----------------------------
FROM node:20-alpine AS builder

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S opsimate -u 1001

WORKDIR /app

# Install pnpm globally + build tools (for native modules)
RUN npm install -g pnpm && apk add --no-cache python3 make g++

# Copy root files
COPY package.json pnpm-lock.yaml turbo.json pnpm-workspace.yaml ./

# Copy all apps and packages
COPY apps ./apps
COPY packages ./packages

# Install dependencies
RUN pnpm install

# Build server + client packages
RUN pnpm turbo run build --filter=apps/server... --filter=apps/client...

# ----------------------------
# Production Stage
# ----------------------------
FROM node:20-alpine AS production

# Create app user & directories
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

# Adjust permissions
RUN chown -R opsimate:nodejs /app/data /app/config

USER opsimate

EXPOSE 3001 8080
VOLUME ["/app/data/database", "/app/data/private-keys", "/app/config"]

ENV NODE_ENV=production
ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["sh", "-c", "serve -s /app/apps/client/dist -l 8080 & pnpm run start"]
