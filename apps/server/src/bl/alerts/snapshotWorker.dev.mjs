// Development-only bootstrap for the snapshot worker thread. In a source checkout
// (vite dev, vitest) the worker's code is TypeScript; a worker thread does not
// inherit the parent's loaders, and `--import tsx` in the worker's execArgv only
// covers the entry file. tsImport registers tsx for the whole module graph beneath it.
// The production bundle has no TypeScript and starts dist/snapshotWorker.js directly.
import { tsImport } from 'tsx/esm/api';

await tsImport('./snapshotWorker.ts', import.meta.url);
