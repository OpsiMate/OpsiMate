import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, test } from 'vitest';
import { PreserveQueryLink } from '@/components/PreserveQueryLink/PreserveQueryLink';

// The sidebar links use this wrapper so query flags like ?playground survive navigation.
// Rendered with a bare MemoryRouter (not test-utils) so the starting URL can carry a search.
const renderAt = (url: string, ui: JSX.Element) => render(<MemoryRouter initialEntries={[url]}>{ui}</MemoryRouter>);

describe('PreserveQueryLink', () => {
	test('appends the current search to a string `to`', () => {
		renderAt('/x?a=1', <PreserveQueryLink to="/alerts">Alerts</PreserveQueryLink>);
		expect(screen.getByRole('link', { name: 'Alerts' })).toHaveAttribute('href', '/alerts?a=1');
	});

	test('merges the current search into an object `to` and keeps pathname and hash', () => {
		renderAt(
			'/x?a=1',
			<PreserveQueryLink to={{ pathname: '/dashboards', hash: '#top' }}>Dashboards</PreserveQueryLink>
		);
		expect(screen.getByRole('link', { name: 'Dashboards' })).toHaveAttribute('href', '/dashboards?a=1#top');
	});

	test('passes `to` through unchanged when there is no search', () => {
		renderAt('/x', <PreserveQueryLink to="/alerts">Alerts</PreserveQueryLink>);
		expect(screen.getByRole('link', { name: 'Alerts' })).toHaveAttribute('href', '/alerts');
	});

	test('forwards other link props to the anchor', () => {
		renderAt(
			'/x?a=1',
			<PreserveQueryLink to="/alerts" className="nav-item" aria-label="Go to alerts">
				Alerts
			</PreserveQueryLink>
		);
		const link = screen.getByRole('link', { name: 'Go to alerts' });
		expect(link).toHaveClass('nav-item');
		expect(link).toHaveAttribute('href', '/alerts?a=1');
	});
});
