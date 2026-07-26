import { Logger } from '@OpsiMate/shared';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// Nunito Sans is self-hosted (bundled from @fontsource) so the app renders correctly in
// air-gapped deployments — a remote Google Fonts import blocks first paint when the CDN
// is unreachable. Imported here rather than in index.css so Vite's asset pipeline emits
// the font binaries; @tailwindcss/postcss would inline the CSS without them (see index.css).
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/600.css';
import '@fontsource/nunito-sans/700.css';
import './index.css';

const logger = new Logger('main');

async function startApp() {
	const envPlayground = import.meta.env.VITE_PLAYGROUND_MODE === 'true';
	const queryPlayground = new URLSearchParams(window.location.search).has('playground');
	const isPlayground = envPlayground || queryPlayground;

	logger.info(
		`Playground mode - env: ${import.meta.env.VITE_PLAYGROUND_MODE}, query: ${queryPlayground}, active: ${isPlayground}`
	);

	if (isPlayground) {
		const { worker } = await import('./mocks/browser');
		await worker.start({
			onUnhandledRequest: 'bypass',
		});
		logger.info('MSW worker started');
	}

	createRoot(document.getElementById('root')!).render(<App />);
}

startApp();
