#!/bin/bash

# Stop at the first failure, so a failed pull or start never ends in "OpsiMate is running!".
set -e

echo "Setting up OpsiMate local environment..."

# Create persistent data directories if missing, owner-only: data/database holds the database
# and the keys the backend generates for itself (login sessions, stored credentials), and
# anyone who can write to a directory can replace the files in it. The backend container
# runs as root, which needs no group or world access to these. Installs made by an older
# version of this script left them world-writable (0777); this closes them again. Only the
# directories are changed, never the files inside (the backend keeps its own files private).
mkdir -p data/database data/private-keys
if ! chmod 700 data data/database data/private-keys 2>/dev/null; then
  echo ""
  echo "Could not make data/ owner-only: it belongs to another user. While other users can write"
  echo "there they can replace the keys OpsiMate keeps in it, so the install stops here. Fix it with:"
  echo "  sudo chown -R \"\$(id -u):\$(id -g)\" data && chmod 700 data data/database data/private-keys"
  echo "then run this script again."
  exit 1
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

# A key set in .env only reaches a container through that service's `environment` entry
# (Compose reads .env for substitution, it does not inject it). Files kept from older
# versions have no such entry, and a key that silently never arrives is how saved
# credentials get lost: stop instead. JWT_SECRET is needed by backend, ENCRYPTION_KEY by
# backend and worker.

# The value .env gives a key, as Compose reads it: the last assignment (KEY=value or
# KEY: value), `export` allowed, surrounding quotes and a trailing comment removed. Empty when
# unset or set to nothing.
env_file_value() {
  grep -E "^[[:space:]]*(export[[:space:]]+)?$1[[:space:]]*[=:]" .env | tail -n 1 |
    sed -E "s/^[[:space:]]*(export[[:space:]]+)?$1[[:space:]]*[=:][[:space:]]*//; s/[[:space:]]+#.*$//; s/[[:space:]]+$//; s/^\"(.*)\"$/\1/; s/^'(.*)'$/\1/"
}

# Whether service $1 has an `environment` entry named $2 in the configuration Compose
# resolves (comments gone, every file and override merged).
service_has_env() {
  printf '%s\n' "$compose_config" | awk -v svc="$1" -v key="$2" '
    /^services:/ { in_services = 1; next }
    in_services && /^[^ ]/ { in_services = 0 }
    in_services && /^  [^ ]/ { current = $1; sub(/:$/, "", current); in_env = 0; next }
    in_services && current == svc && /^    environment:/ { in_env = 1; next }
    in_services && current == svc && in_env && /^    [^ ]/ { in_env = 0 }
    in_services && current == svc && in_env && index($0, "      " key ":") == 1 { found = 1 }
    END { exit found ? 0 : 1 }'
}

if [ -f .env ]; then
  compose_config=$(docker compose config 2>/dev/null)
  for key in JWT_SECRET ENCRYPTION_KEY; do
    [ -n "$(env_file_value "$key")" ] || continue
    services="backend"
    [ "$key" = "ENCRYPTION_KEY" ] && services="backend worker"
    for service in $services; do
      if ! service_has_env "$service" "$key"; then
        echo ""
        echo ".env sets ${key}, but your docker-compose.yml does not pass it to ${service}, so it"
        echo "would be ignored there. Move the file aside and run the installer again to get the"
        echo "current one (your data/, config.yml and .env are kept):"
        echo "  mv docker-compose.yml docker-compose.yml.old"
        echo "  curl -fsSL https://raw.githubusercontent.com/OpsiMate/OpsiMate/main/scripts/start-docker.sh | sh"
        echo "or add  - ${key}=\${${key}:-}  under environment: for ${service}."
        exit 1
      fi
    done
  done
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
