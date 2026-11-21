#!/bin/bash

# Stop at the first failure, so a failed pull or start never ends in "OpsiMate is running!".
set -e

echo "Setting up OpsiMate local environment..."

# Create persistent data directories if missing
mkdir -p data/database data/private-keys
chmod -R 0777 data

# Download config.yml if not present
if [ ! -f config.yml ]; then
  echo "Downloading config.yml..."
  curl -fsSL https://raw.githubusercontent.com/OpsiMate/OpsiMate/main/default-config.yml -o config.yml
else
  echo "config.yml already exists."
fi

# Download docker-compose.yml if not present
if [ ! -f docker-compose.yml ]; then
  echo "Downloading docker-compose.yml..."
  curl -fsSL https://raw.githubusercontent.com/OpsiMate/OpsiMate/main/docker-compose.yml -o docker-compose.yml
else
  echo "docker-compose.yml already exists."
fi

# An existing install keeps its own docker-compose.yml, which may predate JWT_SECRET. The
# backend would then start without the secret and keep restarting, so stop here instead.
if ! grep -q 'JWT_SECRET' docker-compose.yml; then
  echo ""
  echo "Your docker-compose.yml was written before OpsiMate required JWT_SECRET."
  echo "Either add this line under services -> backend -> environment:"
  echo ""
  echo '      - JWT_SECRET=${JWT_SECRET:?JWT_SECRET must be set}'
  echo ""
  echo "or move the file away and run this script again to download the current one."
  exit 1
fi

# The backend signs login sessions with JWT_SECRET and refuses to start without it.
# docker compose reads it from the shell or from a .env file next to docker-compose.yml.
# It is not generated here on purpose: the secret is yours to create and keep.
if [ -z "${JWT_SECRET:-}" ] && ! grep -qE '^JWT_SECRET=.+' .env 2>/dev/null; then
  echo ""
  echo "JWT_SECRET is not set. OpsiMate needs a private secret to sign login sessions."
  echo "Create one in .env next to docker-compose.yml, then run this script again:"
  echo ""
  echo '  echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env'
  echo ""
  echo "Keep .env private, and keep the same value across restarts and upgrades:"
  echo "changing it signs everyone out."
  exit 1
fi

# Pull latest official images
echo "Pulling latest OpsiMate images (backend + frontend)..."
docker compose pull backend frontend

# Start containers in detached mode
echo "Starting OpsiMate containers..."
docker compose up -d

echo ""
echo "OpsiMate is running!"
echo "Frontend: http://localhost:8080"
echo "Backend API: http://localhost:3001"
echo ""
