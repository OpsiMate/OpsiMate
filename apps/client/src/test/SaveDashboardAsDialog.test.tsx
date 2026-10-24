import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DashboardHeader } from '@/components/Alerts/DashboardHeader';
import {
	SaveAsNamesStatus,
	SaveDashboardAsDialog,
	SaveDashboardAsValues,
	suggestCopyName,
} from '@/components/Alerts/SaveDashboardAsDialog';
import { render } from './test-utils';

// Changes made on an open dashboard could only be written back over it. "Save as new
// dashboard" writes the current view to a NEW dashboard instead and leaves the one it
// came from alone.

const noop = () => {};

interface RenderDialogOptions {
	existingNames?: string[];
	namesStatus?: SaveAsNamesStatus;
	onSubmit?: (values: SaveDashboardAsValues) => Promise<void>;
	onOpenChange?: (open: boolean) => void;
}

const dialog = ({ existingNames = ['Prod', 'Staging'], namesStatus, onSubmit, onOpenChange }: RenderDialogOptions) => (
	<SaveDashboardAsDialog
		open
		onOpenChange={onOpenChange ?? noop}
		sourceName="Prod"
		sourceDescription="Production alerts"
		existingNames={existingNames}
		namesStatus={namesStatus}
		onSubmit={onSubmit ?? (async () => {})}
	/>
);

const renderDialog = (options: RenderDialogOptions = {}) => render(dialog(options));

const nameInput = () => screen.getByLabelText('Name') as HTMLInputElement;
const submitButton = () => screen.getByRole('button', { name: 'Save as new' });

describe('suggestCopyName', () => {
	test('appends (copy), then counts up past names already taken', () => {
		expect(suggestCopyName('Prod', ['Prod'])).toBe('Prod (copy)');
		expect(suggestCopyName('Prod', ['Prod', 'prod (COPY)'])).toBe('Prod (copy 2)');
		expect(suggestCopyName('Prod', ['Prod (copy)', 'Prod (copy 2)'])).toBe('Prod (copy 3)');
	});

	test('a nameless draft is suggested as New Dashboard (copy)', () => {
		expect(suggestCopyName('   ', [])).toBe('New Dashboard (copy)');
	});
});

describe('SaveDashboardAsDialog: name validation', () => {
	test('opens with a free copy name and the source description', () => {
		renderDialog();

		expect(nameInput().value).toBe('Prod (copy)');
		expect((screen.getByLabelText('Description') as HTMLTextAreaElement).value).toBe('Production alerts');
		expect(submitButton()).toBeEnabled();
	});

	test('a name that is already taken (any case) cannot be submitted', () => {
		renderDialog();

		fireEvent.change(nameInput(), { target: { value: '  staging ' } });

		expect(screen.getByRole('alert')).toHaveTextContent('already exists');
		expect(submitButton()).toBeDisabled();
	});

	test('an empty name cannot be submitted', () => {
		renderDialog();

		fireEvent.change(nameInput(), { target: { value: '   ' } });

		expect(screen.getByRole('alert')).toHaveTextContent('Give the new dashboard a name');
		expect(submitButton()).toBeDisabled();
	});

	test('a suggestion made before the names arrived is replaced by a free one, unless the user typed', () => {
		const { rerender } = render(dialog({ existingNames: [], namesStatus: 'loading' }));
		expect(nameInput().value).toBe('Prod (copy)');

		rerender(dialog({ existingNames: ['Prod', 'Prod (copy)'], namesStatus: 'ready' }));
		expect(nameInput().value).toBe('Prod (copy 2)');
		expect(submitButton()).toBeEnabled();

		fireEvent.change(nameInput(), { target: { value: 'Mine' } });
		rerender(dialog({ existingNames: ['Prod', 'Prod (copy)', 'Prod (copy 2)'], namesStatus: 'ready' }));
		expect(nameInput().value).toBe('Mine');
	});
});

describe('SaveDashboardAsDialog: submit and close', () => {
	test('submitting hands over the trimmed name and description', async () => {
		const onSubmit = vi.fn(async () => {});
		renderDialog({ onSubmit });

		fireEvent.change(nameInput(), { target: { value: '  Prod (EU)  ' } });
		fireEvent.change(screen.getByLabelText('Description'), { target: { value: ' EU only ' } });
		fireEvent.click(submitButton());

		await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: 'Prod (EU)', description: 'EU only' }));
	});

	test.each([
		['loading', 'Loading dashboards…'],
		['error', 'Dashboard list unavailable'],
	] as const)(
		'cannot submit while the names list is %s (the duplicate check would pass anything)',
		(namesStatus, label) => {
			const onSubmit = vi.fn(async () => {});
			renderDialog({ existingNames: [], namesStatus, onSubmit });

			const button = screen.getByRole('button', { name: label });
			expect(button).toBeDisabled();
			fireEvent.submit(button.closest('form') as HTMLFormElement);
			expect(onSubmit).not.toHaveBeenCalled();
		}
	);

	test('Cancel closes without submitting', () => {
		const onSubmit = vi.fn(async () => {});
		const onOpenChange = vi.fn();
		renderDialog({ onSubmit, onOpenChange });

		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(onOpenChange).toHaveBeenCalledWith(false);
		expect(onSubmit).not.toHaveBeenCalled();
	});
});

describe('DashboardHeader save-as button', () => {
	interface HeaderOptions {
		onSaveAs?: () => void;
		onDashboardNameBlur?: () => void;
	}

	const renderHeader = ({ onSaveAs, onDashboardNameBlur = noop }: HeaderOptions = {}) =>
		render(
			<DashboardHeader
				dashboardName="Prod"
				onDashboardNameChange={noop}
				onDashboardNameBlur={onDashboardNameBlur}
				isDirty={false}
				onSave={noop}
				onSaveAs={onSaveAs}
				isRefreshing={false}
				onRefresh={noop}
			/>
		);

	const saveAsButton = () => screen.getByRole('button', { name: 'Save as new dashboard' });

	// The title becomes an input on click; leaving it hands the rename to the parent,
	// which auto-saves the whole view over the open dashboard.
	const startRenaming = () => {
		fireEvent.click(screen.getByTitle('Prod'));
		return screen.getByDisplayValue('Prod');
	};

	test('is offered when a handler is given (a saved dashboard is open), even with nothing to save', () => {
		const onSaveAs = vi.fn();
		renderHeader({ onSaveAs });

		fireEvent.click(saveAsButton());

		expect(onSaveAs).toHaveBeenCalledTimes(1);
	});

	test('pressing it does not steal focus: the inline name input must not blur-save the source', () => {
		renderHeader({ onSaveAs: vi.fn() });

		const defaultAllowed = fireEvent.mouseDown(saveAsButton());

		expect(defaultAllowed).toBe(false);
	});

	test('tabbing from the name input to it skips the blur-save; leaving for anything else commits', () => {
		const onDashboardNameBlur = vi.fn();
		renderHeader({ onSaveAs: vi.fn(), onDashboardNameBlur });

		fireEvent.blur(startRenaming(), { relatedTarget: saveAsButton() });
		expect(onDashboardNameBlur).not.toHaveBeenCalled();

		fireEvent.blur(startRenaming(), { relatedTarget: null });
		expect(onDashboardNameBlur).toHaveBeenCalledTimes(1);
	});

	test('is absent on a draft (no handler): Save already creates a dashboard there', () => {
		renderHeader();

		expect(screen.queryByRole('button', { name: 'Save as new dashboard' })).not.toBeInTheDocument();
	});
});
