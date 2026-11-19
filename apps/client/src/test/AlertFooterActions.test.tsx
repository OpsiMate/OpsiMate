import { Alert, AlertSeverity, AlertStatus } from '@OpsiMate/shared';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { AlertFooterActions } from '@/components/Alerts/AlertDetails/AlertFooterActions/AlertFooterActions';
import { render, screen } from './test-utils';

// The details panel's Resolve button: disabled, with the reason on hover, for an alert
// its source fixes on its own; a plain button otherwise.

const alert = (fix?: string): Alert => ({
	id: 'alert-1',
	type: 'Custom',
	status: AlertStatus.FIRING,
	severity: AlertSeverity.WARNING,
	tags: fix ? { fix } : {},
	startsAt: '2026-10-19T00:00:00.000Z',
	updatedAt: '2026-10-19T00:00:00.000Z',
	alertUrl: '',
	alertName: 'Test alert',
	createdAt: '2026-10-19T00:00:00.000Z',
	isSilenced: false,
});

describe('AlertFooterActions', () => {
	test('an auto-fixed alert: Resolve is disabled and explains itself on hover', async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(<AlertFooterActions alert={alert('auto')} isActive onDelete={onDelete} onSilence={vi.fn()} />);
		const resolve = screen.getByRole('button', { name: 'Resolve' });
		expect(resolve).toBeDisabled();
		await user.click(resolve);
		expect(onDelete).not.toHaveBeenCalled();
		await user.hover(resolve.parentElement as HTMLElement);
		expect(await screen.findByRole('tooltip')).toHaveTextContent(
			'This alert is fixed automatically; only its source can resolve it'
		);
		expect(screen.getByRole('button', { name: 'Silence' })).toBeEnabled();
	});

	test('a manual-fix or unclassified alert resolves as before', async () => {
		const user = userEvent.setup();
		const onDelete = vi.fn();
		render(<AlertFooterActions alert={alert('manual')} isActive onDelete={onDelete} onSilence={vi.fn()} />);
		await user.click(screen.getByRole('button', { name: 'Resolve' }));
		expect(onDelete).toHaveBeenCalledWith('alert-1');
	});
});
