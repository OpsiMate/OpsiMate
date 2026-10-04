import express, { Request, Response, Router } from 'express';
import { createRequire } from 'node:module';
import { buildOpenApiDocument } from './document';

// Serves the API reference:
//   GET /api/openapi.json — the OpenAPI 3.1 document (import into Postman, generate clients…)
//   GET /api/docs         — Swagger UI over it, with "Try it out" against this server
// Swagger UI's files are served from the swagger-ui-dist package, not a CDN, so the page
// also works on installs without internet access. Set API_DOCS_ENABLED=false to turn both
// off. Public on purpose: the document lists routes and shapes, never data, and every
// "Try it out" call still needs a valid token.

export const apiDocsEnabled = (env: NodeJS.ProcessEnv = process.env): boolean =>
	(env.API_DOCS_ENABLED ?? '').trim().toLowerCase() !== 'false';

interface SwaggerUiDist {
	getAbsoluteFSPath(): string;
}

const swaggerUiAssetsDir = (): string => {
	const require = createRequire(import.meta.url);
	return (require('swagger-ui-dist') as SwaggerUiDist).getAbsoluteFSPath();
};

const DOCS_HTML = `<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>OpsiMate API</title>
	<link rel="stylesheet" href="assets/swagger-ui.css" />
	<style>body { margin: 0; } .swagger-ui .topbar { display: none; }</style>
</head>
<body>
	<div id="swagger-ui"></div>
	<script src="assets/swagger-ui-bundle.js"></script>
	<script>
		window.ui = SwaggerUIBundle({
			url: '../openapi.json',
			dom_id: '#swagger-ui',
			deepLinking: true,
			persistAuthorization: true,
			displayRequestDuration: true,
			docExpansion: 'list',
			tryItOutEnabled: false,
		});
	</script>
</body>
</html>`;

export const createApiDocsRouter = (version: string): Router => {
	// strict: /api/docs (redirect) and /api/docs/ (the page) are different routes.
	const router = Router({ strict: true });
	let document: string | null = null;

	router.get('/api/openapi.json', (_req: Request, res: Response) => {
		// Built once: the routes and schemas are fixed for the life of the process.
		document ??= JSON.stringify(buildOpenApiDocument({ version }));
		res.type('application/json').send(document);
	});

	// The page uses relative asset URLs, so it must be served at a trailing-slash path.
	router.get('/api/docs', (_req: Request, res: Response) => res.redirect(301, '/api/docs/'));
	router.get('/api/docs/', (_req: Request, res: Response) => res.type('html').send(DOCS_HTML));
	router.use('/api/docs/assets', express.static(swaggerUiAssetsDir(), { index: false, maxAge: '7d' }));

	return router;
};
