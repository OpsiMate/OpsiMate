# OpsiMate Dashboard - Project Documentation

This document provides an overview of the OpsiMate Dashboard project structure and functionality to help AI models understand the system without having to analyze the entire codebase every time.

## Project Overview

OpsiMate is a web-based dashboard for monitoring and managing cloud services across different providers. It allows users to:

- Register and manage cloud providers (e.g., Azure VM, AWS EC2)
- Monitor services running on these providers
- View service logs and status
- Start/stop services
- Create and manage custom views for organizing services

## Project Structure

The project is organized as a monorepo using Turborepo with the following structure:

```
service-peek/
├── apps/
│   ├── client/    # Frontend React application
│   └── server/    # Backend Express API server
└── packages/
    └── shared/    # Shared types and utilities
```

## Server (Backend)

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: SQLite
- **SSH Client**: node-ssh for connecting to remote servers
- **Validation**: Zod

### API Structure

The server exposes a RESTful API with the following main endpoints:

#### Base URL: `http://localhost:3001/api/v1`

#### Provider Endpoints

- `GET /providers` - Get all registered providers
- `POST /providers` - Create a new provider
- `GET /providers/:providerId/instance` - Get services running on a provider
- `POST /providers/:providerId/instance/bulk` - Store services in bulk for a provider
- `GET /providers/:providerId/services` - Get all services for a provider

#### Service Endpoints

- `GET /services` - Get all services with provider details
- `GET /services/:serviceId` - Get a specific service
- `POST /services` - Create a new service
- `PUT /services/:serviceId` - Update a service
- `DELETE /services/:serviceId` - Delete a service
- `POST /services/:serviceId/start` - Start a service
- `POST /services/:serviceId/stop` - Stop a service
- `GET /services/:serviceId/logs` - Get service logs

#### Views Endpoints

- `GET /views` - Get all saved views
- `GET /views/:viewId` - Get a specific view
- `POST /views` - Create or update a view
- `DELETE /views/:viewId` - Delete a view
- `POST /views/:viewId/active` - Set a view as active
- `GET /views/active` - Get the active view ID

### Database Schema

#### Providers Table
```sql
CREATE TABLE providers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_name TEXT NOT NULL,
  provider_ip TEXT NOT NULL,
  username TEXT NOT NULL,
  public_key TEXT NOT NULL,
  ssh_port INTEGER DEFAULT 22,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### Services Table
```sql
CREATE TABLE services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  service_name TEXT NOT NULL,
  service_ip TEXT,
  service_status TEXT DEFAULT 'unknown',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Client (Frontend)

### Technology Stack

- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **Routing**: React Router
- **State Management**: React Query
- **UI Components**: Custom components built with Radix UI primitives
- **Styling**: Tailwind CSS
- **Form Handling**: React Hook Form with Zod validation

### Main Components

#### Pages

- **Index**: Main dashboard showing all services
- **Providers**: Page for managing cloud providers
- **MyProviders**: Page for viewing provider details
- **NotFound**: 404 page

#### Key Components

- **ServiceTable**: Displays services with filtering and sorting
- **ServiceDetailsSheet**: Shows detailed information about a selected service
- **ServiceDetailsSheetWithLogs**: Extended version that also shows service logs
- **FilterPanel**: Allows filtering services by various criteria
- **SavedViewsManager**: Manages custom views for organizing services
- **ActionButtons**: Contains buttons for common actions (refresh, add service, etc.)
- **DashboardLayout**: Common layout for all dashboard pages

### API Client

The frontend communicates with the backend through a structured API client (`api.ts`) that provides functions for all API endpoints. The client handles error responses and provides type safety through shared types.

## Data Flow

1. **Provider Registration**:
   - User registers a cloud provider with connection details (IP, username, SSH key)
   - Backend stores provider information in the database

2. **Service Discovery**:
   - Backend connects to the provider via SSH
   - Retrieves running services information
   - Stores service data in the database

3. **Service Monitoring**:
   - Frontend periodically fetches service status from the backend
   - Backend connects to providers to get updated service status
   - UI updates to reflect current service states

4. **Service Management**:
   - User can start/stop services through the UI
   - Backend executes SSH commands on the provider to control services
   - Service status is updated in the database and reflected in the UI

5. **Log Viewing**:
   - When a user selects a service, the frontend requests logs from the backend
   - Backend retrieves logs via SSH from the provider
   - Logs are displayed in the UI

## Key Files

### Backend

- `server/src/index.ts`: Main server entry point
- `server/src/api/v1/v1.ts`: API router setup
- `server/src/api/v1/providers/router.ts`: Provider endpoints
- `server/src/api/v1/services/router.ts`: Service endpoints
- `server/src/dal/providerRepository.ts`: Database access for providers
- `server/src/dal/serviceRepository.ts`: Database access for services
- `server/src/bl/ssh.bl.ts`: Business logic for SSH connections

### Frontend

- `client/src/App.tsx`: Main application component with routing
- `client/src/pages/index.tsx`: Main dashboard page
- `client/src/lib/api.ts`: API client for backend communication
- `client/src/components/ServiceTable.tsx`: Service listing component
- `client/src/components/ServiceDetailsSheetWithLogs.tsx`: Service details with logs

## Shared Types

The project uses shared types between frontend and backend for consistency:

- `Provider`: Cloud provider information
- `Service`: Service information
- `ServiceWithProvider`: Service with provider details
- `ApiResponse`: Standard API response format

## Deployment

The application is designed to be run locally or deployed as a web service:

- **Development**: Run with `npm run dev` in the project root
- **Production**: Build with `npm run build` and serve the static files

---

*This documentation is designed to provide a high-level overview of the OpsiMate Dashboard project structure and functionality. It should be updated after major changes to the codebase.*
