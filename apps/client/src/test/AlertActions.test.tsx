import { beforeEach, describe, expect, test, vi } from 'vitest';
import { AlertStatus, AlertSeverity, type Action, type Alert } from '@OpsiMate/shared';
import { AlertActions } from '@/components/Alerts/AlertDetails/AlertActionsSection/AlertActions';
import { render, screen, fireEvent } from './test-utils';

const query = vi.hoisted(() => ({ data: [] as Action[], isLoading: false }));
vi.mock('@/hooks/queries/actions', () => ({
	useActions: () => query,
	usePreviewAction: () => ({ isPending: false, mutateAsync: vi.fn() }),
	useRunAction: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

const alert: Alert = {
	id: 'disk-full',
	alertName: 'Disk full',
	type: 'Custom',
	status: AlertStatus.FIRING,
	severity: AlertSeverity.CRITICAL,
	tags: { environment: 'production' },
	startsAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
	createdAt: new Date(0).toISOString(),
	alertUrl: '',
	isSilenced: false,
};
const action = (overrides: Partial<Action> = {}): Action => ({
	id: 1,
	name: 'Notify on-call',
	type: 'http',
	config: { url: 'https://example.com/hook', method: 'POST' },
	labelMatchers: [],
	createdAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
	...overrides,
});
const expand = () => fireEvent.click(screen.getByRole('button', { name: /^Actions/ }));

beforeEach(() => {
	query.data = [];
	query.isLoading = false;
});

describe('AlertActions empty states', () => {
	test('keeps the create prompt when no actions are configured', () => {
		render(<AlertActions alert={alert} />);
		expect(screen.queryByText(/No actions configured/)).not.toBeInTheDocument();
		expand();
		expect(screen.getByText(/No actions configured/)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Create one' })).toHaveAttribute('href', '/actions');
		expect(screen.queryByText(/No actions apply/)).not.toBeInTheDocument();
	});
	test('explains a name-filter mismatch and links to manage existing actions', () => {
		query.data = [action({ name: 'Database runbook', nameContainsAny: ['Database'] })];
		render(<AlertActions alert={alert} />);
		expand();
		expect(screen.getByText(/No actions apply to this alert/)).toBeInTheDocument();
		expect(screen.getByRole('link', { name: 'Manage actions' })).toHaveAttribute('href', '/actions');
		expect(screen.queryByText(/No actions configured/)).not.toBeInTheDocument();
		expect(screen.queryByRole('link', { name: 'Create one' })).not.toBeInTheDocument();
	});
	test('uses the same state for a label-filter mismatch', () => {
		query.data = [action({ labelMatchers: [{ key: 'environment', value: 'staging' }] })];
		render(<AlertActions alert={alert} />);
		expand();
		expect(screen.getByText(/No actions apply to this alert/)).toBeInTheDocument();
		expect(screen.queryByText(/No actions configured/)).not.toBeInTheDocument();
	});
	test('shows an unfiltered action without either empty message', () => {
		query.data = [action()];
		render(<AlertActions alert={alert} />);
		expand();
		expect(screen.getByRole('button', { name: 'Notify on-call' })).toBeInTheDocument();
		expect(screen.queryByText(/No actions configured|No actions apply/)).not.toBeInTheDocument();
	});
	test('lists only matching actions when matching and nonmatching actions coexist', () => {
		query.data = [action(), action({ id: 2, name: 'Database runbook', nameContainsAny: ['Database'] })];
		render(<AlertActions alert={alert} />);
		expand();
		expect(screen.getByRole('button', { name: 'Notify on-call' })).toBeInTheDocument();
		expect(screen.queryByRole('button', { name: 'Database runbook' })).not.toBeInTheDocument();
		expect(screen.queryByText(/No actions configured|No actions apply/)).not.toBeInTheDocument();
	});
	test('does not flash an empty state while actions load', () => {
		query.isLoading = true;
		render(<AlertActions alert={alert} />);
		expect(screen.queryByRole('button', { name: /^Actions/ })).not.toBeInTheDocument();
		expect(screen.queryByText(/No actions configured|No actions apply/)).not.toBeInTheDocument();
	});
});
