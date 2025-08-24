---
sidebar_position: 10
---

# Development

Learn how to set up and run the OpsiMate project locally for development.

## Prerequisites

- **Node.js** (v18 or higher)
- **npm** (v8 or higher)
- **Git**

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/opsimate/opsimate.git
cd opsimate
```

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Build the Project

```bash
pnpm run build
```

### 4. Start client and server

```bash
pnpm run dev
```

The Client will be available at `http://localhost:8080`
The Server will be available at `http://localhost:3001`

## Development Commands

- `pnpm run test` - Run test suite
- `pnpm run lint` - Check code quality
