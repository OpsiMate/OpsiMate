import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { DashboardLayout } from '@/components/DashboardLayout';
import { fireEvent, render, screen } from './test-utils';

let originalSidebarCollapsed: string | null;

beforeEach(() => {
	originalSidebarCollapsed = localStorage.getItem('sidebarCollapsed');
	vi.stubGlobal('innerWidth', 1280);
	localStorage.removeItem('sidebarCollapsed');
});

afterEach(() => {
	vi.unstubAllGlobals();
	if (originalSidebarCollapsed === null) {
		localStorage.removeItem('sidebarCollapsed');
	} else {
		localStorage.setItem('sidebarCollapsed', originalSidebarCollapsed);
	}
});

describe('DashboardLayout sidebar preference', () => {
	test.each(['not json', 'false', null, '"yes"'])(
		'renders expanded without throwing when the saved preference is %s',
		(savedPreference) => {
			if (savedPreference !== null) {
				localStorage.setItem('sidebarCollapsed', savedPreference);
			}

			expect(() =>
				render(
					<DashboardLayout>
						<div />
					</DashboardLayout>
				)
			).not.toThrow();

			expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
		}
	);

	test('restores a saved collapsed preference', () => {
		localStorage.setItem('sidebarCollapsed', 'true');

		render(
			<DashboardLayout>
				<div />
			</DashboardLayout>
		);

		expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
	});

	test('updates the toggle label and persists the preference in both directions', () => {
		render(
			<DashboardLayout>
				<div />
			</DashboardLayout>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Collapse sidebar' }));
		expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument();
		expect(localStorage.getItem('sidebarCollapsed')).toBe('true');

		fireEvent.click(screen.getByRole('button', { name: 'Expand sidebar' }));
		expect(screen.getByRole('button', { name: 'Collapse sidebar' })).toBeInTheDocument();
		expect(localStorage.getItem('sidebarCollapsed')).toBe('false');
	});
});
