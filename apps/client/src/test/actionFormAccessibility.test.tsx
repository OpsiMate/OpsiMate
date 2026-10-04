import { describe, expect, test, vi } from 'vitest';
import { ActionFormDialog } from '@/components/Actions/ActionFormDialog';
import { render, screen } from './test-utils';

vi.mock('@/hooks/queries/alerts', () => ({ useAlerts: () => ({ data: [] }) }));
vi.mock('@/hooks/queries/actions', () => ({
	useCreateAction: () => ({ isPending: false }),
	useUpdateAction: () => ({ isPending: false }),
	useTestAction: () => ({ isPending: false }),
}));

describe('action form accessibility', () => {
	test('associates the HTTP method label with its select trigger', () => {
		render(
			<ActionFormDialog
				open
				onOpenChange={vi.fn()}
				action={{
					id: 1,
					name: 'Notify service',
					type: 'http',
					config: { url: 'https://example.com/hook', method: 'POST' },
					labelMatchers: [],
					createdAt: new Date(0).toISOString(),
					updatedAt: new Date(0).toISOString(),
				}}
			/>
		);
		expect(screen.getByLabelText('Method')).toBe(screen.getByRole('combobox', { name: 'Method' }));
		expect(screen.getByLabelText('Method')).toHaveTextContent('POST');
	});
});
