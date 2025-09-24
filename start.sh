#!/bin/bash

echo "Setting up OpsiMate local environment..."

# Create necessary data directories if they don't exist
echo "Creating persistent data directories..."
mkdir -p data/database data/private-keys

# Set permissions
echo "Setting directory permissions..."
chown -R 999:999 data || echo "Unable to chown, setting 777 permissions instead."
chmod -R 0777 data

# Check and create config.yml from default if missing or empty
if [ ! -s config.yml ]; then
  echo "config.yml not found or empty, copying from default-config.yml..."
  cp default-config.yml config.yml
else
  echo "config.yml found."
fi

# Pull latest image or build locally; here assuming local build for dev
echo "Building and starting Docker Compose stack..."
docker compose up --build -d

echo "OpsiMate should now be running:"
echo "Frontend: http://localhost:8080"
echo "Backend API: http://localhost:3001"
