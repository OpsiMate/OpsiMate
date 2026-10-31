import type { Action } from '@OpsiMate/shared';
import { describe, expect, test, vi } from 'vitest';
import { ActionFormDialog } from '@/components/Actions/ActionFormDialog';
import { render, screen } from './test-utils';

vi.mock('@/hooks/queries/alerts', () => ({ useAlerts: () => ({ data: [] }) }));
vi.mock('@/hooks/queries/actions', () => ({
	useCreateAction: () => ({ isPending: false }),
	useUpdateAction: () => ({ isPending: false }),
	useTestAction: () => ({ isPending: false }),
}));

const httpActionWithHeaders: Action = {
	id: 2,
	name: 'Call webhook',
	type: 'http',
	config: {
		url: 'https://example.com/hook',
		method: 'POST',
		headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
	},
	labelMatchers: [],
	createdAt: new Date(0).toISOString(),
	updatedAt: new Date(0).toISOString(),
};

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

	test('associates the Type label with its select trigger', () => {
		render(<ActionFormDialog open onOpenChange={vi.fn()} action={httpActionWithHeaders} />);
		const typeSelect = screen.getByRole('combobox', { name: 'Type' });
		expect(screen.getByLabelText('Type')).toBe(typeSelect);
		expect(typeSelect).toHaveTextContent('HTTP request');
	});

	test('names each HTTP header row by its number', () => {
		render(<ActionFormDialog open onOpenChange={vi.fn()} action={httpActionWithHeaders} />);
		expect(screen.getByRole('textbox', { name: 'Header 1 name' })).toHaveValue('Authorization');
		expect(screen.getByRole('textbox', { name: 'Header 1 value' })).toHaveValue('Bearer token');
		expect(screen.getByRole('textbox', { name: 'Header 2 name' })).toHaveValue('Content-Type');
		expect(screen.getByRole('textbox', { name: 'Header 2 value' })).toHaveValue('application/json');
		expect(screen.getByRole('button', { name: 'Remove header 1' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Remove header 2' })).toBeInTheDocument();
	});
});
