#!/bin/sh

# Docker entrypoint script for Opsimate
# Handles config file mounting and startup

set -e

echo "Starting Opsimate container..."

# Check if a custom config file is mounted
if [ -f "/app/config/config.yml" ]; then
    echo "Using mounted config file: /app/config/config.yml"
    export CONFIG_FILE="/app/config/config.yml"
elif [ -f "/app/config/default-config.yml" ]; then
    echo "Using default container config: /app/config/default-config.yml"
    export CONFIG_FILE="/app/config/default-config.yml"
else
    echo "No config file found, using project default"
    export CONFIG_FILE="/app/config.yml"
fi

# Print config file being used
echo "Config file: $CONFIG_FILE"

# Execute the main command
exec "$@"
