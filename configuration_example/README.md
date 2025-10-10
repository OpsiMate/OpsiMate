# Configuration Examples

This folder contains example configuration files for different deployment scenarios.

## Available Configurations

### `config.yml`

- **Purpose**: Local development configuration
- **Database**: Uses local file system path
- **SSH Keys**: Uses local file system path
- **Usage**: Copy to project root as `config.yml` for local development

### `container-config.yml`

- **Purpose**: Docker container configuration with volume mounts
- **Database**: Container path with volume mount
- **SSH Keys**: Container path with volume mount
- **Usage**: Mount as volume in Docker container

### `docker-config.yml`

- **Purpose**: Alternative Docker configuration
- **Usage**: Alternative container configuration example

### `custom-docker-config.yml`

- **Purpose**: Example of custom Docker configuration
- **Features**: Shows how to customize database names and paths
- **Usage**: Template for creating environment-specific configs

## How to Use

### For Local Development

```bash
# Copy the local development config
cp configuration_example/config.yml ./config.yml

# Edit paths to match your local setup
# Then run: npm run dev
```

### For Docker

```bash
# Use the container config as a volume mount
docker run -d \
  --name OpsiMate-app \
  -p 3001:3001 -p 8080:8080 \
  -v $(pwd)/data/database:/app/data/database \
  -v $(pwd)/data/private-keys:/app/data/private-keys \
  -v $(pwd)/configuration_example/container-config.yml:/app/config/config.yml \
  OpsiMate
```

### For Custom Environments

```bash
# Create your own config based on examples
cp configuration_example/container-config.yml my-production-config.yml

# Edit as needed, then mount it
docker run -d \
  --name OpsiMate-prod \
  -p 3001:3001 -p 8080:8080 \
  -v $(pwd)/data/database:/app/data/database \
  -v $(pwd)/data/private-keys:/app/data/private-keys \
  -v $(pwd)/my-production-config.yml:/app/config/config.yml \
  OpsiMate
```
