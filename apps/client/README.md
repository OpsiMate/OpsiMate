# OpsiMate Client

The OpsiMate client is the web console that brings your fleet data together. It gives operations teams a real‑time view of discovered servers, containers, and Kubernetes workloads, plus quick actions for handling incidents without leaving the dashboard. This package contains the front-end part of the monorepo that lives alongside the OpsiMate API and background workers.

## Architecture Snapshot

- **React 18 + TypeScript** served with Vite for fast local feedback.
- **TanStack Query** handles API caching, retries, and background refreshes.
- **React Router** (see `src/pages`) powers authenticated navigation across dashboard, providers, integrations, alerts, profile, and TV mode.
- **shadcn/ui + Tailwind CSS** provide the component system, backed by Radix primitives for accessibility.
- **App services** such as `src/lib/api.ts`, `src/lib/auth.ts`, and `src/hooks` centralize network concerns, auth helpers, and shared logic.

### Source Layout

```
src/
├── components/        # Reusable UI pieces (cards, dialogs, charts, tables)
├── pages/             # Route-level views and lazy bundles
├── hooks/             # Custom hooks shared across views
├── lib/               # API clients, auth utilities, app configuration
├── test/              # Vitest + React Testing Library utilities
├── types/             # Shared TypeScript contracts
└── utils/             # Formatting helpers and other pure utilities
```

The client expects the OpsiMate backend to be reachable on `http(s)://<host>:3001`. The default `API_BASE_URL` lives in `src/lib/api.ts` and derives its host from the browser location so the UI can run alongside a locally started server.

## Prerequisites

- Node.js 18 or newer
- [pnpm 9](https://pnpm.io/) (the workspace package manager)
- Access to an OpsiMate backend (run `pnpm --filter @OpsiMate/server dev` in another terminal if you are working locally)

## Getting Started

Run these commands from the root of the monorepo:

```bash
# Install shared dependencies for the whole workspace
pnpm install

# Start the client with hot reload
pnpm --filter @OpsiMate/client dev
```

The development server boots on [http://localhost:5173](http://localhost:5173) by default and proxies API calls to the backend running on port 3001.

### Production Build & Preview

```bash
# Generate the production bundle
pnpm --filter @OpsiMate/client build

# Serve the built assets locally for sanity checks
pnpm --filter @OpsiMate/client preview
```

### Quality Checks

```bash
# Lint the client codebase
pnpm --filter @OpsiMate/client lint

# Run the unit and component tests
pnpm --filter @OpsiMate/client test

# Collect coverage
pnpm --filter @OpsiMate/client test:coverage
```

## Development Notes

- API calls funnel through `src/lib/api.ts`; reuse the helpers there so requests inherit shared headers and error handling.
- Authentication state is stored in browser storage through utilities in `src/lib/auth.ts`. Use the exported helpers inside new hooks or route guards.
- The design system lives under `src/components/ui` and is generated via `components.json`. Follow the existing patterns when adding new primitives to keep styling consistent.
- TV mode (`/tv-mode`) is meant for wall displays—keep layouts responsive and high-contrast when introducing new widgets.

## Contributing

We track all issues, discussions, and release planning in the main repository: [github.com/OpsiMate/OpsiMate](https://github.com/OpsiMate/OpsiMate). To contribute to the client:

1. Fork or clone the main repo and create a branch off `main`.
2. Make changes inside `apps/client`, keeping tests and linting green.
3. Run any relevant commands from this README to verify your updates.
4. Open a pull request against `main`, referencing associated issues when possible.

Before sending a PR, skim the root `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` for expectations on commit style, reviews, and community guidelines.

---

Questions or ideas? Open an issue or join the conversation in the main project repo at [github.com/OpsiMate/OpsiMate](https://github.com/OpsiMate/OpsiMate). See you there!
