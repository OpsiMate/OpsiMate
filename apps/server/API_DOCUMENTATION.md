# OpsiMate Dashboard - Integration API

This document describes the Integration Router API endpoints for managing cloud providers and their services.

## Base URL

```
http://localhost:3001/api/v1/integration
```

## Endpoints

### 1. Create Provider

**POST** `/providers`

Creates a new cloud provider integration.

**Request Body:**

```json
{
  "provider_name": "Azure VM",
  "provider_ip": "192.168.1.100",
  "username": "azureuser",
  "public_key": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...",
  "ssh_port": 22
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "provider_name": "Azure VM",
    "provider_ip": "192.168.1.100",
    "username": "azureuser",
    "public_key": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...",
    "ssh_port": 22,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### 2. Get All Providers

**GET** `/providers`

Retrieves all registered providers.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "provider_name": "Azure VM",
      "provider_ip": "192.168.1.100",
      "username": "azureuser",
      "public_key": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...",
      "ssh_port": 22,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 3. Get Provider Instances

**GET** `/providers/:providerId/instance`

Connects to the provider via SSH and retrieves running services.

**Response:**

```json
{
  "success": true,
  "data": {
    "provider": {
      "id": 1,
      "provider_name": "Azure VM",
      "provider_ip": "192.168.1.100",
      "username": "azureuser",
      "public_key": "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC...",
      "ssh_port": 22,
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    "services": [
      {
        "service_name": "nginx.service",
        "service_status": "running",
        "service_ip": "192.168.1.100"
      },
      {
        "service_name": "postgresql.service",
        "service_status": "running",
        "service_ip": "192.168.1.100"
      }
    ]
  }
}
```

### 4. Store Services in Bulk

**POST** `/providers/:providerId/instance/bulk`

Stores a list of service names for a specific provider.

**Request Body:**

```json
{
  "service_names": ["nginx", "postgresql", "redis"]
}
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "provider_id": 1,
      "service_name": "nginx",
      "service_ip": "192.168.1.100",
      "service_status": "unknown",
      "created_at": "2024-01-01T00:00:00.000Z"
    },
    {
      "id": 2,
      "provider_id": 1,
      "service_name": "postgresql",
      "service_ip": "192.168.1.100",
      "service_status": "unknown",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

### 5. Get Provider Services

**GET** `/providers/:providerId/services`

Retrieves all services stored for a specific provider.

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "provider_id": 1,
      "service_name": "nginx",
      "service_ip": "192.168.1.100",
      "service_status": "unknown",
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

## Error Responses

All endpoints return error responses in the following format:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details (optional)"
}
```

Common HTTP status codes:

- `400` - Bad Request (validation errors)
- `404` - Not Found (provider not found)
- `500` - Internal Server Error

## Database Schema

### Providers Table

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

### Services Table

```sql
CREATE TABLE services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  service_name TEXT NOT NULL,
  service_ip TEXT,
  service_status TEXT DEFAULT 'unknown',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES providers (id)
);
```

## Testing

Run the test script to verify all endpoints:

```bash
cd server
npm install
npm run dev  # Start the server in another terminal
node test-integration.js
```

## Notes

- The SSH connection uses the provided public key for authentication
- Service discovery uses `systemctl list-units` command (Linux systems)
- All data is stored locally in SQLite database (`opsimate.db`)
- The API includes input validation using Zod schemas
