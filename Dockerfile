FROM node:20-alpine

# Create app user and needed directories in one step
RUN addgroup -g 1001 -S nodejs && \
    adduser -S opsimate -u 1001 && \
    mkdir -p /app/data/database /app/data/private-keys /app/config

WORKDIR /app

# Copy project files
COPY --chown=opsimate:nodejs . .

# Install all dependencies (including dev for development mode) and turbo globally (matching project version), then clear npm cache to save space
RUN npm ci && \
    npm cache clean --force

# Build shared package first
RUN npm run build --workspace=@OpsiMate/shared

# Copy default config file
COPY --chown=opsimate:nodejs default-config.yml /app/config/default-config.yml

# Copy entrypoint script
COPY --chown=opsimate:nodejs docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create turbo cache directory and adjust permissions for all necessary directories
RUN mkdir -p /app/.turbo/cache && \
    chown -R opsimate:nodejs /app/data /app/config /app/node_modules /app/packages /app/apps /app/.turbo

USER opsimate

EXPOSE 3001 8080
VOLUME ["/app/data/database", "/app/data/private-keys", "/app/config"]

ENV NODE_ENV=development

ENTRYPOINT ["sh", "/app/docker-entrypoint.sh"]
CMD ["npm", "run", "dev"]