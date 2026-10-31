import { describe, expect, test, vi } from 'vitest';
import type { Action, AlertEnrichment, MutePolicy, OncallTeam } from '@OpsiMate/shared';
import Actions from '@/pages/Actions';
import MutePolicies from '@/pages/MutePolicies';
import Enrichments from '@/pages/Enrichments';
import Oncall from '@/pages/Oncall';
import { render, screen, within } from './test-utils';

interface LayoutProps {
	children: React.ReactNode;
}

interface QueryResult<T> {
	data: T;
	isLoading: boolean;
}

interface MutationResult {
	mutate: ReturnType<typeof vi.fn>;
	mutateAsync: ReturnType<typeof vi.fn>;
	isPending: boolean;
}

interface OncallTeamMutationsResult {
	createTeam: ReturnType<typeof vi.fn>;
	updateTeam: ReturnType<typeof vi.fn>;
	deleteTeam: ReturnType<typeof vi.fn>;
	setTeamMembers: ReturnType<typeof vi.fn>;
}

class ResizeObserverStub {
	observe() {}
	unobserve() {}
	disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const actionsFixture: Action[] = [
	{
		id: 1,
		name: 'Hook 1',
		type: 'http',
		config: { url: 'https://example.com/1', method: 'POST' },
		labelMatchers: [],
		createdAt: new Date(0).toISOString(),
		updatedAt: new Date(0).toISOString(),
	},
	{
		id: 2,
		name: 'Hook 2',
		type: 'http',
		config: { url: 'https://example.com/2', method: 'POST' },
		labelMatchers: [],
		createdAt: new Date(0).toISOString(),
		updatedAt: new Date(0).toISOString(),
	},
];

const mutePoliciesFixture: MutePolicy[] = [
	{
		id: 1,
		name: 'Mute Staging',
		labelMatchers: [],
		createdAt: new Date(0).toISOString(),
		updatedAt: new Date(0).toISOString(),
	},
	{
		id: 2,
		name: 'Mute Prod',
		labelMatchers: [],
		createdAt: new Date(0).toISOString(),
		updatedAt: new Date(0).toISOString(),
	},
];

const enrichmentsFixture: AlertEnrichment[] = [
	{
		id: 1,
		name: 'Enrich Staging',
		labelMatchers: [],
		addFields: [],
		priority: 1,
		createdAt: new Date(0).toISOString(),
		updatedAt: new Date(0).toISOString(),
	},
	{
		id: 2,
		name: 'Enrich Prod',
		labelMatchers: [],
		addFields: [],
		priority: 2,
		createdAt: new Date(0).toISOString(),
		updatedAt: new Date(0).toISOString(),
	},
];

const oncallTeamsFixture: OncallTeam[] = [
	{
		id: 1,
		name: 'SRE Team',
		rotationIntervalDays: 7,
		rotationAnchor: new Date(0).toISOString(),
		members: [],
		nextRotationAt: new Date(0).toISOString(),
	},
	{
		id: 2,
		name: 'Platform Team',
		rotationIntervalDays: 7,
		rotationAnchor: new Date(0).toISOString(),
		members: [],
		nextRotationAt: new Date(0).toISOString(),
	},
];

vi.mock('@/components/DashboardLayout', () => ({
	DashboardLayout: ({ children }: LayoutProps) => <div>{children}</div>,
}));

vi.mock('@/lib/auth', () => ({
	isAdmin: () => true,
}));

vi.mock('@/hooks/queries/alerts', () => ({
	useAlerts: (): QueryResult<unknown[]> => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/queries/actions', () => ({
	useActions: (): QueryResult<Action[]> => ({ data: actionsFixture, isLoading: false }),
	useDeleteAction: (): MutationResult => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
	useTestAction: (): MutationResult => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
	useCreateAction: (): MutationResult => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
	useUpdateAction: (): MutationResult => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
	usePreviewAction: (): MutationResult => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
	useRunAction: (): MutationResult => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/queries/mute-policies', () => ({
	useMutePolicies: (): QueryResult<MutePolicy[]> => ({ data: mutePoliciesFixture, isLoading: false }),
	useDeleteMutePolicy: (): MutationResult => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
	useCreateMutePolicy: (): MutationResult => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
	useUpdateMutePolicy: (): MutationResult => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/hooks/queries/enrichments', () => ({
	useEnrichments: (): QueryResult<AlertEnrichment[]> => ({ data: enrichmentsFixture, isLoading: false }),
	useDeleteEnrichment: (): MutationResult => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
	useCreateEnrichment: (): MutationResult => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
	useUpdateEnrichment: (): MutationResult => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false }),
	useEnrichmentHistory: (): QueryResult<unknown[]> => ({ data: [], isLoading: false }),
}));

vi.mock('@/hooks/queries/oncall', () => ({
	useOncallTeams: (): QueryResult<OncallTeam[]> => ({ data: oncallTeamsFixture, isLoading: false }),
	useOncallTeamMutations: (): OncallTeamMutationsResult => ({
		createTeam: vi.fn(),
		updateTeam: vi.fn(),
		deleteTeam: vi.fn(),
		setTeamMembers: vi.fn(),
	}),
}));

vi.mock('@/hooks/queries/users', () => ({
	useUsers: (): QueryResult<unknown[]> => ({ data: [], isLoading: false }),
}));

const expectTableButtonsNamed = () => {
	const table = screen.getByRole('table');
	for (const button of within(table).getAllByRole('button')) {
		expect(button).toHaveAccessibleName();
	}
};

describe('list page search and row button accessibility', () => {
	test('Actions page search box and row buttons are accessible', () => {
		render(<Actions />);

		expect(screen.getByRole('textbox', { name: /search/i })).toHaveAccessibleName('Search actions');

		for (const name of ['Hook 1', 'Hook 2']) {
			expect(screen.getByRole('button', { name: `Test action "${name}"` })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: `Edit action "${name}"` })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: `Delete action "${name}"` })).toBeInTheDocument();
		}

		expectTableButtonsNamed();
	});

	test('Mute policies page search box and row buttons are accessible', () => {
		render(<MutePolicies />);

		expect(screen.getByRole('textbox', { name: /search/i })).toHaveAccessibleName('Search mute policies');

		for (const name of ['Mute Staging', 'Mute Prod']) {
			expect(screen.getByRole('button', { name: `Edit mute policy "${name}"` })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: `Delete mute policy "${name}"` })).toBeInTheDocument();
		}

		expectTableButtonsNamed();
	});

	test('Enrichments page search box and row buttons are accessible', () => {
		render(<Enrichments />);

		expect(screen.getByRole('textbox', { name: /search/i })).toHaveAccessibleName('Search enrichments');

		for (const name of ['Enrich Staging', 'Enrich Prod']) {
			expect(screen.getByRole('button', { name: `Duplicate enrichment "${name}"` })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: `View history of enrichment "${name}"` })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: `Edit enrichment "${name}"` })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: `Delete enrichment "${name}"` })).toBeInTheDocument();
		}

		expectTableButtonsNamed();
	});

	test('On-call page search box and row buttons are accessible', () => {
		render(<Oncall />);

		expect(screen.getByRole('textbox', { name: /search/i })).toHaveAccessibleName('Search on-call teams');

		for (const name of ['SRE Team', 'Platform Team']) {
			expect(screen.getByRole('button', { name: `Edit team "${name}"` })).toBeInTheDocument();
			expect(screen.getByRole('button', { name: `Delete team "${name}"` })).toBeInTheDocument();
		}

		expectTableButtonsNamed();
	});
});
