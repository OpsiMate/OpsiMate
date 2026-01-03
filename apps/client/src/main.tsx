import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

async function startApp() {
	const envPlayground = import.meta.env.VITE_PLAYGROUND_MODE === 'true';
	const queryPlayground = new URLSearchParams(window.location.search).has('playground');
	const isPlayground = envPlayground || queryPlayground;

	console.log(
		'[Playground] env:',
		import.meta.env.VITE_PLAYGROUND_MODE,
		'| query:',
		queryPlayground,
		'| active:',
		isPlayground
	);

	if (isPlayground) {
		const { worker } = await import('./mocks/browser');
		await worker.start({
			onUnhandledRequest: 'bypass',
		});
		console.log('[Playground] MSW worker started');
	}

	createRoot(document.getElementById('root')!).render(<App />);
}

startApp();
