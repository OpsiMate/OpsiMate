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

# Stop with Compose's own message when the file does not resolve (a typo, a bad override),
# rather than at the pull or start below.
if ! compose_error=$(docker compose config --quiet 2>&1); then
  echo ""
  echo "$compose_error"
  # A docker-compose.yml kept from the short-lived version that required JWT_SECRET: the
  # variable is optional now (the backend generates its own), but that file still demands it.
  if echo "$compose_error" | grep -q 'JWT_SECRET'; then
    echo ""
    echo "Your docker-compose.yml is from a version that required JWT_SECRET; it is optional now."
    echo "Either move it aside and run the installer again, which downloads the current one"
    echo "(your data/ and config.yml are kept):"
    echo "  mv docker-compose.yml docker-compose.yml.old"
    echo "  curl -fsSL https://raw.githubusercontent.com/OpsiMate/OpsiMate/main/scripts/start-docker.sh | sh"
    echo "or keep the file and give it a value in .env:"
    echo '  touch .env && chmod 600 .env && echo "JWT_SECRET=$(openssl rand -hex 32)" >> .env'
  fi
  exit 1
fi

# Nothing to generate here: on first start the backend creates its own login-session and
# encryption keys in data/database, next to the database. Back that directory up as a whole.
# To manage the keys yourself instead, set JWT_SECRET and ENCRYPTION_KEY in a .env file.

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
