// src/vite-app.ts
import { initializeDb } from './dal/db';
import { createApp } from './app';

// Export the Express instance as viteNodeApp for vite-plugin-node
export const viteNodeApp = (async () => {
  // Initialize DB (you can reuse your production init if safe)
  const db = initializeDb();
  return await createApp(db, { enableJobs: true });
})();
