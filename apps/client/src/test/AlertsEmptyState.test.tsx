import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useNavigate } from 'react-router-dom';
import { AllTheProviders } from './TestProviders';
import { AlertsEmptyState } from '@/components/Alerts/AlertsTable/AlertsEmptyState/AlertsEmptyState';

vi.mock('react-router-dom', async () => {
	const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

	return {
		...actual,
		useNavigate: vi.fn(),
	};
});

describe('AlertsEmptyState', () => {
	test('renders the empty state heading and explanatory copy', () => {
		render(
			<AllTheProviders>
				<AlertsEmptyState />
			</AllTheProviders>
		);

		expect(screen.getByRole('heading', { name: "You're All Set!" })).toBeInTheDocument();
		expect(
			screen.getByText("Everything's running smoothly. No alerts to worry about right now.")
		).toBeInTheDocument();
		expect(
			screen.getByText('Want to stay on top of issues? Connect your monitoring tools to receive alerts here.')
		).toBeInTheDocument();
	});

	test('navigates to alert integrations when the button is clicked', async () => {
		const navigate = vi.fn();
		vi.mocked(useNavigate).mockReturnValue(navigate);

		const user = userEvent.setup();

		render(
			<AllTheProviders>
				<AlertsEmptyState />
			</AllTheProviders>
		);

		const button = screen.getByRole('button', {
			name: 'Connect Alert Integration',
		});

		await user.click(button);

		expect(navigate).toHaveBeenCalledWith('/integrations?category=alerts');
	});
});
