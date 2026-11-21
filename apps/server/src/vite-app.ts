// src/vite-app.ts
import { initializeDb } from './dal/db';
import { createApp, AppMode } from './app';
import { getJwtSecret } from './utils/jwtSecret';

// Export the Express instance as viteNodeApp for vite-plugin-node
export const viteNodeApp = (async () => {
	// `pnpm dev` starts here, not in index.ts, so the same check: no private JWT_SECRET,
	// no server, rather than a dev server whose logins fail.
	getJwtSecret();

	// Initialize DB (you can reuse your production init if safe)
	const db = initializeDb();
	return await createApp(db, AppMode.SERVER);
})();
