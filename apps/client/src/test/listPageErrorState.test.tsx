import { Action, MutePolicy } from '@OpsiMate/shared';
import { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import MutePolicies from '@/pages/MutePolicies';
import Actions from '@/pages/Actions';
import { render, screen } from './test-utils';

// A failed first load on a rules list page used to read as "No … yet" with a
// create button, which invites the user to add an entry they already have. These
// pins check that a failed load shows an error instead, that an empty list still
// shows the empty state, that a loaded list is unaffected, and that a background
// refetch failing while a list is showing keeps the list.

// DashboardLayout carries the app chrome (sidebar, top bar) that pulls in the auth
// and settings queries; none of it matters here, so the page is rendered in a plain
// wrapper as the issue specifies.
interface LayoutProps {
	children: ReactNode;
}

vi.mock('@/components/DashboardLayout', () => ({
	DashboardLayout: ({ children }: LayoutProps) => <div>{children}</div>,
}));

interface ListQueryState {
	data: unknown;
	isLoading: boolean;
	isError: boolean;
	isLoadingError: boolean;
	error: unknown;
}

// Read at render time, so each test can set the state the mocked list hook returns
// without re-registering the mock. isLoadingError mirrors react-query: true only on a
// failed initial load with no data; a background refetch failure keeps it false while
// data is still showing.
const actionsState: ListQueryState = {
	data: undefined,
	isLoading: false,
	isError: false,
	isLoadingError: false,
	error: null,
};
const mutePoliciesState: ListQueryState = {
	data: undefined,
	isLoading: false,
	isError: false,
	isLoadingError: false,
	error: null,
};

vi.mock('@/hooks/queries/actions', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/hooks/queries/actions')>()),
	useActions: () => actionsState,
}));

vi.mock('@/hooks/queries/mute-policies', async (importOriginal) => ({
	...(await importOriginal<typeof import('@/hooks/queries/mute-policies')>()),
	useMutePolicies: () => mutePoliciesState,
}));

const action = (id: number, name: string): Action => ({
	id,
	name,
	type: 'http',
	config: { url: `https://example.com/${id}`, method: 'POST' },
	labelMatchers: [],
	createdAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
});

const mutePolicy = (id: number, name: string): MutePolicy => ({
	id,
	name,
	labelMatchers: [],
	createdAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
});

beforeEach(() => {
	actionsState.data = undefined;
	actionsState.isLoading = false;
	actionsState.isError = false;
	actionsState.isLoadingError = false;
	actionsState.error = null;
	mutePoliciesState.data = undefined;
	mutePoliciesState.isLoading = false;
	mutePoliciesState.isError = false;
	mutePoliciesState.isLoadingError = false;
	mutePoliciesState.error = null;
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe('list page error state', () => {
	test('Actions: a failed load shows the error, not the empty state', () => {
		actionsState.isError = true;
		actionsState.isLoadingError = true;
		actionsState.error = new Error('Failed to fetch actions');

		render(<Actions />);

		expect(screen.getByText('Failed to fetch actions')).toBeInTheDocument();
		expect(screen.queryByText('No actions yet')).not.toBeInTheDocument();
		// The in-table create button is gone; only the header button (one match).
		expect(screen.getAllByText(/new action/i)).toHaveLength(1);
	});

	test('Actions: an empty list with no error keeps the empty state and its button', () => {
		actionsState.data = [];

		render(<Actions />);

		expect(screen.getByText('No actions yet')).toBeInTheDocument();
		expect(screen.getAllByText(/new action/i)).toHaveLength(2);
	});

	test('Actions: a loaded list shows the rows and no error text', () => {
		actionsState.data = [action(1, 'Notify the channel')];

		render(<Actions />);

		expect(screen.getByText('Notify the channel')).toBeInTheDocument();
		expect(screen.queryByText('No actions yet')).not.toBeInTheDocument();
	});

	test('MutePolicies: a background refetch error keeps the loaded list', () => {
		// data is present (the first load succeeded) and a background poll then fails:
		// react-query keeps the old data and leaves isLoadingError false, so the list
		// must stay and the error row must not appear.
		mutePoliciesState.data = [mutePolicy(1, 'Maintenance window')];
		mutePoliciesState.isError = true;
		mutePoliciesState.error = new Error('Failed to fetch mute policies');

		render(<MutePolicies />);

		expect(screen.getByText('Maintenance window')).toBeInTheDocument();
		expect(screen.queryByText('Could not load mute policies')).not.toBeInTheDocument();
	});
});
