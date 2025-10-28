#!/bin/bash

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
