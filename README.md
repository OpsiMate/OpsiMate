# OpsiMate

A monorepo for the OpsiMate application built with Turbo.

## Structure

```
service-peek/
├── apps/
│   ├── client/          # React frontend (Vite + TypeScript)
│   └── server/          # Node.js backend (Express + TypeScript)
├── packages/
│   └── shared/          # Shared types and validation schemas
├── package.json         # Root workspace configuration
└── turbo.json          # Turbo build configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 10+

### Installation

1. Install dependencies for all workspaces:
```bash
npm install
```

2. Build all packages:
```bash
npm run build
```

3. Start development servers:
```bash
npm run dev
```

## Available Scripts

- `npm run build` - Build all packages and apps
- `npm run dev` - Start development servers for all apps
- `npm run lint` - Run linting for all packages
- `npm run clean` - Clean build outputs
- `npm run format` - Format code with Prettier

## Workspaces

### Apps

#### Client (`apps/client`)
React frontend application built with:
- Vite
- TypeScript
- Tailwind CSS
- Radix UI components
- React Router
- React Query

#### Server (`apps/server`)
Node.js backend application built with:
- Express
- TypeScript
- SQLite
- Node SSH
- Zod validation

### Packages

#### Shared (`packages/shared`)
Shared types and validation schemas used by both client and server:
- TypeScript interfaces
- Zod validation schemas
- Common utilities

## Development

Each workspace can be developed independently:

```bash
# Work on client only
cd apps/client
npm run dev

# Work on server only
cd apps/server
npm run dev

# Work on shared package
cd packages/shared
npm run dev
```

## Building for Production

```bash
# Build all workspaces
npm run build

# Start production server
cd apps/server
npm start
``` 