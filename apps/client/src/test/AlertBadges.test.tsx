import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Alert, AlertFix, AlertSeverity, AlertStatus, FIX_LABELS, SEVERITY_LABELS } from '@OpsiMate/shared';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StatusBadge } from '@/components/Alerts/StatusBadge';
import { SeverityBadge } from '@/components/Alerts/SeverityBadge';
import { FixBadge } from '@/components/Alerts/FixBadge';
import { formatShortDateTime } from '@/lib/datetime';

interface CreateAlertOptions {
	status?: AlertStatus;
	isSilenced?: boolean;
	silencedUntil?: string | null;
	isMuted?: boolean;
}

const createMockAlert = (options: CreateAlertOptions = {}): Alert => ({
	id: 'alert-1',
	type: 'Custom',
	status: options.status ?? AlertStatus.FIRING,
	severity: AlertSeverity.WARNING,
	tags: {},
	startsAt: '2026-10-01T00:00:00.000Z',
	updatedAt: '2026-10-01T00:00:00.000Z',
	createdAt: '2026-10-01T00:00:00.000Z',
	alertUrl: 'https://example.test/alerts/alert-1',
	alertName: 'Mock Alert',
	isSilenced: options.isSilenced ?? false,
	silencedUntil: options.silencedUntil ?? null,
	isMuted: options.isMuted ?? false,
});

const renderWithTooltip = (ui: React.ReactElement) => {
	return render(<TooltipProvider>{ui}</TooltipProvider>);
};

describe('StatusBadge precedence: silenced and muted overrides', () => {
	test('silenced state takes precedence over muted and firing', () => {
		const alert = createMockAlert({
			isSilenced: true,
			isMuted: true,
			status: AlertStatus.FIRING,
		});
		renderWithTooltip(<StatusBadge alert={alert} />);

		expect(screen.getByLabelText('Status: Silenced')).toBeInTheDocument();
		expect(screen.queryByTestId('alert-status-muted')).not.toBeInTheDocument();
	});

	test('muted state takes precedence over firing and resolved', () => {
		const firingMutedAlert = createMockAlert({
			isSilenced: false,
			isMuted: true,
			status: AlertStatus.FIRING,
		});
		const { unmount } = renderWithTooltip(<StatusBadge alert={firingMutedAlert} />);

		expect(screen.getByLabelText('Status: Muted')).toBeInTheDocument();
		expect(screen.getByTestId('alert-status-muted')).toBeInTheDocument();
		unmount();

		const resolvedMutedAlert = createMockAlert({
			isSilenced: false,
			isMuted: true,
			status: AlertStatus.RESOLVED,
		});
		renderWithTooltip(<StatusBadge alert={resolvedMutedAlert} />);

		expect(screen.getByLabelText('Status: Muted')).toBeInTheDocument();
		expect(screen.getByTestId('alert-status-muted')).toBeInTheDocument();
	});
});

describe('StatusBadge lifecycle states: firing and resolved', () => {
	test('renders firing status when not silenced or muted', () => {
		const alert = createMockAlert({
			isSilenced: false,
			isMuted: false,
			status: AlertStatus.FIRING,
		});
		renderWithTooltip(<StatusBadge alert={alert} />);

		expect(screen.getByLabelText('Status: Firing')).toBeInTheDocument();
		expect(screen.queryByTestId('alert-status-muted')).not.toBeInTheDocument();
	});

	test('renders resolved status when resolved and neither silenced nor muted', () => {
		const alert = createMockAlert({
			isSilenced: false,
			isMuted: false,
			status: AlertStatus.RESOLVED,
		});
		renderWithTooltip(<StatusBadge alert={alert} />);

		expect(screen.getByLabelText('Status: Resolved')).toBeInTheDocument();
		expect(screen.queryByTestId('alert-status-muted')).not.toBeInTheDocument();
	});
});

describe('StatusBadge silencedUntil formatting and testid presence', () => {
	test('formats silencedUntil date using formatShortDateTime', () => {
		const silencedUntilIso = '2026-11-20T14:30:00.000Z';
		const alert = createMockAlert({
			isSilenced: true,
			silencedUntil: silencedUntilIso,
		});
		renderWithTooltip(<StatusBadge alert={alert} />);

		const expectedLabel = `Status: Silenced until ${formatShortDateTime(silencedUntilIso)}`;
		expect(screen.getByLabelText(expectedLabel)).toBeInTheDocument();
		expect(screen.queryByTestId('alert-status-muted')).not.toBeInTheDocument();
	});

	test('renders Status: Silenced when silencedUntil is null', () => {
		const alert = createMockAlert({
			isSilenced: true,
			silencedUntil: null,
		});
		renderWithTooltip(<StatusBadge alert={alert} />);

		expect(screen.getByLabelText('Status: Silenced')).toBeInTheDocument();
		expect(screen.queryByTestId('alert-status-muted')).not.toBeInTheDocument();
	});

	test('alert-status-muted testid is present only for muted alerts', () => {
		const mutedAlert = createMockAlert({ isMuted: true, isSilenced: false });
		const { unmount } = renderWithTooltip(<StatusBadge alert={mutedAlert} />);
		expect(screen.getByTestId('alert-status-muted')).toBeInTheDocument();
		unmount();

		const firingAlert = createMockAlert({ isMuted: false, isSilenced: false });
		renderWithTooltip(<StatusBadge alert={firingAlert} />);
		expect(screen.queryByTestId('alert-status-muted')).not.toBeInTheDocument();
	});
});

describe('SeverityBadge', () => {
	const severities: AlertSeverity[] = [AlertSeverity.CRITICAL, AlertSeverity.WARNING, AlertSeverity.INFO];

	test.each(severities)('renders role="img" and aria-label for %s', (severity) => {
		const expectedLabel = `Severity: ${SEVERITY_LABELS[severity]}`;
		const { unmount } = renderWithTooltip(<SeverityBadge severity={severity} />);

		const badge = screen.getByRole('img', { name: expectedLabel });
		expect(badge).toBeInTheDocument();
		expect(badge).toHaveAttribute('aria-label', expectedLabel);
		unmount();
	});
});

describe('FixBadge', () => {
	const fixes: AlertFix[] = [AlertFix.MANUAL, AlertFix.AUTO];

	test.each(fixes)('renders role="img" and aria-label for %s', (fix) => {
		const expectedLabel = `Fix: ${FIX_LABELS[fix]}`;
		const { unmount } = renderWithTooltip(<FixBadge fix={fix} />);

		const badge = screen.getByRole('img', { name: expectedLabel });
		expect(badge).toBeInTheDocument();
		expect(badge).toHaveAttribute('aria-label', expectedLabel);
		unmount();
	});
});
