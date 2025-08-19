# Build stage - includes all dependencies for building
FROM node:20-alpine AS builder

# Create app user and needed directories
RUN addgroup -g 1001 -S nodejs && \
    adduser -S opsimate -u 1001

WORKDIR /app

# Copy package files first for better caching
COPY package*.json turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (including dev for building)
RUN npm ci

# Copy source code
COPY . .

# Build all packages
RUN npm run build --workspace=@OpsiMate/shared && \
    npm run build --workspace=@OpsiMate/server && \
    npm run build --workspace=@OpsiMate/client

# Production stage - minimal runtime dependencies
FROM node:20-alpine AS production

# Create app user and needed directories
RUN addgroup -g 1001 -S nodejs && \
    adduser -S opsimate -u 1001 && \
    mkdir -p /app/data/database /app/data/private-keys /app/config

WORKDIR /app

# Copy package files
COPY package*.json turbo.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/
COPY packages/shared/package.json ./packages/shared/

# Install only production dependencies and serve for static files
RUN npm ci --omit=dev && \
    npm install -g serve && \
    npm cache clean --force

# Copy built assets from builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/client/dist ./apps/client/dist

# Copy runtime files
COPY --chown=opsimate:nodejs default-config.yml /app/config/default-config.yml
COPY --chown=opsimate:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Copy source files needed at runtime (for shared package)
COPY --chown=opsimate:nodejs packages/shared/package.json ./packages/shared/
COPY --chown=opsimate:nodejs apps/server/package.json ./apps/server/

# Adjust permissions
RUN chown -R opsimate:nodejs /app/data /app/config

USER opsimate

EXPOSE 3001 8080
VOLUME ["/app/data/database", "/app/data/private-keys", "/app/config"]

ENV NODE_ENV=production

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["sh", "-c", "serve -s /app/apps/client/dist -l 8080 & npm run start"]

# Development stage - includes dev dependencies for development workflow
FROM node:20-alpine AS development

# Create app user and needed directories
RUN addgroup -g 1001 -S nodejs && \
    adduser -S opsimate -u 1001 && \
    mkdir -p /app/data/database /app/data/private-keys /app/config

WORKDIR /app

# Copy project files
COPY --chown=opsimate:nodejs . .

# Install all dependencies (including dev)
RUN npm ci && \
    npm cache clean --force

# Build shared package for development
RUN npm run build --workspace=@OpsiMate/shared

# Copy config and entrypoint
COPY --chown=opsimate:nodejs default-config.yml /app/config/default-config.yml
COPY --chown=opsimate:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create turbo cache and adjust permissions
RUN mkdir -p /app/.turbo/cache && \
    chown -R opsimate:nodejs /app/data /app/config /app/node_modules /app/packages /app/apps /app/.turbo

USER opsimate

EXPOSE 3001 8080
VOLUME ["/app/data/database", "/app/data/private-keys", "/app/config"]

ENV NODE_ENV=development

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]