#!/bin/bash

echo "Setting up OpsiMate local environment..."

# Create persistent data directories if missing
mkdir -p data/database data/private-keys
chmod -R 0777 data

# Download default-config.yml if not present
if [ ! -f default-config.yml ]; then
  echo "Downloading default-config.yml..."
  curl -fsSL https://raw.githubusercontent.com/KaranNegi20Feb/Karan-Fork-Opsimate/main/default-config.yml -o default-config.yml
else
  echo "default-config.yml already exists."
fi

# Copy config.yml from default-config.yml if missing or empty
if [ ! -s config.yml ]; then
  echo "config.yml not found or empty, copying from default-config.yml..."
  cp default-config.yml config.yml
else
  echo "config.yml found."
fi

# Download docker-compose.yml if not present
if [ ! -f docker-compose.yml ]; then
  echo "Downloading docker-compose.yml..."
  curl -fsSL https://raw.githubusercontent.com/KaranNegi20Feb/Karan-Fork-Opsimate/main/docker-compose.yml -o docker-compose.yml
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
echo "📧 Email Configuration:"
echo "Email functionality is disabled by default for security."
echo "To enable email features (password reset, notifications):"
echo "1. Edit config.yml in this directory"
echo "2. Set mailer.enabled: true"
echo "3. Configure your SMTP credentials"
echo "4. Restart OpsiMate with: docker compose restart backend"
echo ""
echo "For more details, see the mailer section in config.yml"
