#!/bin/bash

# Stop at the first failure, so a failed pull or start never ends in "OpsiMate is running!".
set -e

echo "Setting up OpsiMate local environment..."

# Create persistent data directories if missing
mkdir -p data/database data/private-keys
# On an existing install, files the backend container created belong to root (it runs as
# root), and a normal user cannot change them. That is expected and must not stop the
# checks or the upgrade below: chmod still updates everything it owns, and only the
# failure is passed over.
if ! chmod -R 0777 data 2>/dev/null; then
  echo "Note: some files under data/ belong to another user (usually the container); left as they are."
fi

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

# The backend signs login sessions with JWT_SECRET and refuses to start without it. Ask
# Compose itself whether it can resolve the file: it reads the shell and .env exactly as
# `up` will (spaces around =, export, quotes), and the file's ${JWT_SECRET:?...} fails
# when the secret is missing or empty. It is not generated here on purpose: the secret is
# yours to create and keep.
if ! compose_error=$(docker compose config --quiet 2>&1); then
  echo ""
  echo "$compose_error"
  if echo "$compose_error" | grep -q 'JWT_SECRET'; then
    echo ""
    echo "OpsiMate needs a private secret to sign login sessions."
    echo "Create one in a .env next to docker-compose.yml, then run this script again:"
    echo ""
    echo '  touch .env && chmod 600 .env'
    echo '  echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env'
    echo ""
    echo "Keep .env private, and keep the same value across restarts and upgrades:"
    echo "changing it signs everyone out."
  fi
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
