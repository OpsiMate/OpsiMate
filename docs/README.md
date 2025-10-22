# OpsiMate Documentation

Welcome to the OpsiMate documentation. This guide will help you understand and use OpsiMate effectively for monitoring and managing your cloud services.

## Getting Started

- [Installation Guide](#installation-guide)
- [Quick Start](#quick-start)
- [Configuration](#configuration)

## Core Features

### Interface
- [TV Mode](./tv-mode.md) - Optimized dashboard view for large displays and monitoring rooms

### Service Management
- [Providers](./providers.md) - Managing cloud providers
- [Services](./services.md) - Monitoring and controlling services
- [Alerts](./alerts.md) - Alert management and notifications

### Advanced Features
- [Custom Views](./custom-views.md) - Creating and managing custom service views
- [Integrations](./integrations.md) - Third-party service integrations
- [API Reference](./api-reference.md) - Complete API documentation

## User Guides

- [User Management](./user-management.md) - User roles and permissions
- [Security](./security.md) - Security best practices
- [Troubleshooting](./troubleshooting.md) - Common issues and solutions

## Development

- [Contributing](./contributing.md) - How to contribute to OpsiMate
- [Architecture](./architecture.md) - System architecture overview
- [Testing](./testing.md) - Testing guidelines and setup

---

## Installation Guide

### Prerequisites

- Node.js 18+ and npm/pnpm
- Docker (optional, for containerized deployment)
- SSH access to your cloud providers

### Quick Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/opsimate.git
cd opsimate
```

2. Install dependencies:
```bash
pnpm install
```

3. Start the development server:
```bash
pnpm dev
```

4. Access OpsiMate at `http://localhost:3000`

### Docker Installation

1. Use the provided Docker Compose configuration:
```bash
docker-compose up -d
```

2. Access OpsiMate at `http://localhost:3000`

## Quick Start

1. **Register a Provider**: Add your first cloud provider with SSH credentials
2. **Discover Services**: Let OpsiMate automatically discover running services
3. **Monitor Status**: View service health and status in real-time
4. **Manage Services**: Start, stop, or restart services as needed
5. **Set Up Alerts**: Configure alerts for critical service events

## Configuration

### Environment Variables

Key environment variables for OpsiMate configuration:

- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3001)
- `DATABASE_URL`: Database connection string
- `JWT_SECRET`: Secret for JWT token generation

### Configuration File

OpsiMate supports YAML configuration files. See `default-config.yml` for available options.

---

*For more detailed information, explore the specific documentation sections above.*
