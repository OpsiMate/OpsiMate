import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Alert, AlertFix, AlertSeverity, AlertStatus } from '@OpsiMate/shared';
import { StatusBadge } from '@/components/Alerts/StatusBadge';
import { SeverityBadge } from '@/components/Alerts/SeverityBadge';
import { FixBadge } from '@/components/Alerts/FixBadge';
import { TooltipProvider } from '@/components/ui/tooltip';

// The "silenced until" label is produced through formatShortDateTime; pin it so the
// assertion does not depend on the viewer's locale/timezone.
const { mockFormatShortDateTime } = vi.hoisted(() => ({
	mockFormatShortDateTime: vi.fn((value: string) => `Jul 19, 14:30 (${value})`),
}));
vi.mock('@/lib/datetime', () => ({
	formatShortDateTime: (value: unknown) => mockFormatShortDateTime(String(value)),
}));

const baseAlert = {
	status: AlertStatus.FIRING,
	isSilenced: false,
	isMuted: false,
	silencedUntil: null as string | null,
};
const alert = (over: Partial<Alert> = {}) => ({ ...baseAlert, ...over }) as unknown as Alert;

// The badges are icon-only and live their label in a Radix tooltip + aria-label, so
// wrap in a TooltipProvider (TestProviders does not include one) and read the trigger.
function renderBadge(ui: React.ReactNode) {
	return render(
		<TooltipProvider delayDuration={0}>
			{ui}
		</TooltipProvider>
	);
}

beforeEach(() => {
	mockFormatShortDateTime.mockReset();
});

describe('StatusBadge', () => {
	it('shows Firing for a firing, non-muted, non-silenced alert', () => {
		renderBadge(<StatusBadge alert={alert()} />);
		expect(screen.getByLabelText('Status: Firing')).toBeInTheDocument();
	});

	it('shows Resolved for a resolved, non-muted, non-silenced alert', () => {
		renderBadge(<StatusBadge alert={alert({ status: AlertStatus.RESOLVED })} />);
		expect(screen.getByLabelText('Status: Resolved')).toBeInTheDocument();
	});

	it('shows Muted when the alert is muted', () => {
		renderBadge(<StatusBadge alert={alert({ isMuted: true })} />);
		expect(screen.getByLabelText('Status: Muted')).toBeInTheDocument();
	});

	it('renders "Silenced until <formatted>" when a silencedUntil value is set', () => {
		const iso = '2026-07-19T14:30:00Z';
		renderBadge(<StatusBadge alert={alert({ isSilenced: true, silencedUntil: iso })} />);
		// label comes from formatShortDateTime, not a raw ISO string
		expect(mockFormatShortDateTime).toHaveBeenCalledWith(iso);
		expect(screen.getByLabelText('Status: Silenced until Jul 19, 14:30 (2026-07-19T14:30:00Z)')).toBeInTheDocument();
	});

	it('shows plain "Silenced" when silenced without a silencedUntil value', () => {
		renderBadge(<StatusBadge alert={alert({ isSilenced: true, silencedUntil: null })} />);
		expect(screen.getByLabelText('Status: Silenced')).toBeInTheDocument();
	});

	it('gives silenced precedence over muted and firing', () => {
		renderBadge(<StatusBadge alert={alert({ isSilenced: true, isMuted: true, silencedUntil: null })} />);
		expect(screen.getByLabelText('Status: Silenced')).toBeInTheDocument();
		// the muted marker must not also render just because isMuted is true
		expect(screen.queryByTestId('alert-status-muted')).toBeNull();
	});

	it('gives muted precedence over a firing lifecycle state', () => {
		renderBadge(<StatusBadge alert={alert({ isMuted: true, status: AlertStatus.FIRING })} />);
		expect(screen.getByLabelText('Status: Muted')).toBeInTheDocument();
		expect(screen.queryByLabelText('Status: Firing')).toBeNull();
	});

	it('only sets the muted test-id on muted alerts', () => {
		for (const state of [
			alert(),
			alert({ status: AlertStatus.RESOLVED }),
			alert({ isSilenced: true, silencedUntil: null }),
		]) {
			const { unmount } = renderBadge(<StatusBadge alert={state} />);
			expect(screen.queryByTestId('alert-status-muted')).toBeNull();
			unmount();
		}
		const { unmount } = renderBadge(<StatusBadge alert={alert({ isMuted: true })} />);
		expect(screen.getByTestId('alert-status-muted')).toBeInTheDocument();
		unmount();
	});
});

describe('SeverityBadge', () => {
	const cases: Array<[AlertSeverity, string]> = [
		[AlertSeverity.CRITICAL, 'Severity: Critical'],
		[AlertSeverity.WARNING, 'Severity: Warning'],
		[AlertSeverity.INFO, 'Severity: Info'],
	];

	it.each(cases)('exposes %s as a role="img" with aria-label "%s"', (severity, label) => {
		renderBadge(<SeverityBadge severity={severity} />);
		expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
	});
});

describe('FixBadge', () => {
	const cases: Array<[AlertFix, string]> = [
		[AlertFix.MANUAL, 'Fix: Manual fix'],
		[AlertFix.AUTO, 'Fix: Auto fix'],
	];

	it.each(cases)('exposes %s as a role="img" with aria-label "%s"', (fix, label) => {
		renderBadge(<FixBadge fix={fix} />);
		expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
	});
});
