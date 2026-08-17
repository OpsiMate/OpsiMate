import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import NotFound from '@/pages/NotFound';

// "Return to Home" must navigate through the router, not by handing the URL back to
// the browser. The distinction is invisible in the DOM (react-router's Link renders a
// plain <a href>), but it is exactly what this asserts: in jsdom a bare <a href="/">
// click cannot change the router's location — only a Link can. So this test fails
// against an anchor and passes against a Link, without mocking anything.

const renderAt = (path: string) =>
	render(
		<MemoryRouter initialEntries={[path]}>
			<Routes>
				<Route path="/" element={<div>home route rendered</div>} />
				<Route path="*" element={<NotFound />} />
			</Routes>
		</MemoryRouter>
	);

describe('NotFound', () => {
	test('renders the 404 state for an unknown route', () => {
		renderAt('/no-such-page');
		expect(screen.getByText('404')).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Return to Home' })).toBeInTheDocument();
	});

	test('"Return to Home" navigates in-app instead of reloading the document', async () => {
		const user = userEvent.setup();
		renderAt('/no-such-page');

		await user.click(screen.getByRole('link', { name: 'Return to Home' }));

		// The home route took over: only client-side routing can do this in jsdom.
		expect(screen.getByText('home route rendered')).toBeInTheDocument();
		expect(screen.queryByText('404')).not.toBeInTheDocument();
	});
});
