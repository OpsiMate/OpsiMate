# Worker Process Setup

This document explains the worker process architecture for running background jobs separately from the API server.

## Architecture

The server application is now split into two separate processes:

1. **API Server** (`src/index.ts`) - Handles HTTP requests, exposes REST API
2. **Worker Process** (`src/worker.ts`) - Runs background jobs (RefreshJob, PullGrafanaAlertsJob)

Both processes share the same database and configuration but run independently.

## Benefits

- **Cleaner Logs**: Job logs are separated from API request logs
- **Better Resource Management**: Scale API and workers independently
- **Improved Stability**: Job failures don't affect API availability
- **Easier Debugging**: Monitor and debug each process separately

## Development

### Running from Root (Recommended)

Start everything (client + API server + worker) with one command:

```bash
# From project root - starts full stack including worker
pnpm run dev
```

This uses Turbo to run all dev tasks in parallel:
- Client dev server
- API server
- Worker process

### Running Server Only (Targeted Development)

If you only want to work on the server:

```bash
# From apps/server directory
cd apps/server

# Option 1: Run API server only (no worker)
pnpm dev

# Option 2: Run worker only (no API)
pnpm dev:worker

# Option 3: Run both from server directory
# Terminal 1
pnpm dev

# Terminal 2
pnpm dev:worker
```

### Debugging

**From Root:**
```bash
# Debug API server (port 9229)
pnpm run debug

# Debug worker (port 9230)
pnpm run debug:worker
```

**From Server Directory:**
```bash
# Debug API server (port 9229)
cd apps/server
pnpm debug

# Debug worker (port 9230)  
cd apps/server
pnpm debug:worker
```

### Docker Compose (Development)

```bash
# Start all services including worker
docker-compose -f docker-compose.dev.yml up

# View worker logs
docker-compose -f docker-compose.dev.yml logs -f worker
```

## Production

### Building

```bash
# Build both entry points (index.js and worker.js)
pnpm --filter @OpsiMate/server build
```

This will generate:
- `dist/index.js` - API server entry point
- `dist/worker.js` - Worker process entry point

### Running

**From Root:**
```bash
# Terminal 1: API server
pnpm run start

# Terminal 2: Worker
pnpm run start:worker
```

**From Server Directory:**
```bash
# Terminal 1: API server
cd apps/server
pnpm start

# Terminal 2: Worker
cd apps/server
pnpm start:worker
```

### Docker Compose (Production)

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f backend  # API server logs
docker-compose logs -f worker   # Worker logs
```

The `docker-compose.yml` includes:
- `backend` service - Runs the API server
- `worker` service - Runs background jobs
- Both share the same Docker image but use different entry points

## Configuration

Both processes read from the same `config.yml` file and share:
- Database (`data/database/opsimate.db`)
- Private keys directory (`data/private-keys/`)
- Environment variables

## Jobs Overview

### RefreshJob
- **Interval**: Every 10 minutes
- **Purpose**: Refreshes provider services
- **Batch Size**: 10 providers at a time

### PullGrafanaAlertsJob
- **Interval**: Every 10 minutes
- **Purpose**: Pulls alerts from Grafana integration
- **Dependencies**: Requires active Grafana integration

## Monitoring

### Process Management

Use PM2, systemd, or Docker to ensure both processes stay running:

**PM2 Example:**
```json
{
  "apps": [
    {
      "name": "opsimate-api",
      "script": "dist/index.js",
      "cwd": "/app/apps/server"
    },
    {
      "name": "opsimate-worker",
      "script": "dist/worker.js",
      "cwd": "/app/apps/server"
    }
  ]
}
```

### Health Checks

- API Server: `GET /health`
- Worker: Monitor logs for job execution messages

## Troubleshooting

### Worker not starting
- Check if database is accessible
- Verify `config.yml` exists and is valid
- Check worker logs for initialization errors

### Jobs not running
- Confirm worker process is running
- Check worker logs for job execution messages
- Verify integrations are properly configured

### Database lock errors
- SQLite handles concurrent reads well
- If you see write lock errors, consider adding retry logic or switching to PostgreSQL for high-concurrency scenarios

## Future Improvements

- Add health check endpoint for worker
- Implement job queue (BullMQ, RabbitMQ) for better job management
- Add metrics and monitoring for job execution
- Support multiple worker instances with job coordination

