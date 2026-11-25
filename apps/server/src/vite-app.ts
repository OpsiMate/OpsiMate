// src/vite-app.ts
import { initializeDb } from './dal/db';
import { createApp, AppMode } from './app';
import { moveLegacyCredentials, prepareInstanceSecrets } from './bootSecrets';

// Export the Express instance as viteNodeApp for vite-plugin-node
export const viteNodeApp = (async () => {
	// `pnpm dev` starts here, not in index.ts, so the same steps: settle the session and
	// encryption keys first, then move credentials off the old public key.
	prepareInstanceSecrets();

	// Initialize DB (you can reuse your production init if safe)
	const db = initializeDb();
	const app = await createApp(db, AppMode.SERVER);
	void moveLegacyCredentials(db);
	return app;
})();
