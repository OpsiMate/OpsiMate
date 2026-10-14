import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { DashboardHeader } from '@/components/Alerts/DashboardHeader';
import {
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
	onSubmit?: (values: SaveDashboardAsValues) => Promise<void>;
	onOpenChange?: (open: boolean) => void;
}

const renderDialog = ({ existingNames = ['Prod', 'Staging'], onSubmit, onOpenChange }: RenderDialogOptions = {}) =>
	render(
		<SaveDashboardAsDialog
			open
			onOpenChange={onOpenChange ?? noop}
			sourceName="Prod"
			sourceDescription="Production alerts"
			existingNames={existingNames}
			onSubmit={onSubmit ?? (async () => {})}
		/>
	);

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

describe('SaveDashboardAsDialog', () => {
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

	test('cannot submit while the list of names is still loading (the duplicate check would pass anything)', () => {
		const onSubmit = vi.fn(async () => {});
		render(
			<SaveDashboardAsDialog
				open
				onOpenChange={noop}
				sourceName="Prod"
				sourceDescription=""
				existingNames={[]}
				namesLoading
				onSubmit={onSubmit}
			/>
		);

		const button = screen.getByRole('button', { name: 'Loading dashboards…' });
		expect(button).toBeDisabled();
		fireEvent.submit(button.closest('form') as HTMLFormElement);
		expect(onSubmit).not.toHaveBeenCalled();
	});

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
	const renderHeader = (onSaveAs?: () => void) =>
		render(
			<DashboardHeader
				dashboardName="Prod"
				onDashboardNameChange={noop}
				onDashboardNameBlur={noop}
				isDirty={false}
				onSave={noop}
				onSaveAs={onSaveAs}
				isRefreshing={false}
				onRefresh={noop}
			/>
		);

	test('is offered when a handler is given (a saved dashboard is open), even with nothing to save', () => {
		const onSaveAs = vi.fn();
		renderHeader(onSaveAs);

		fireEvent.click(screen.getByRole('button', { name: 'Save as new dashboard' }));

		expect(onSaveAs).toHaveBeenCalledTimes(1);
	});

	test('pressing it does not steal focus: the inline name input must not blur-save the source', () => {
		renderHeader(vi.fn());

		const defaultAllowed = fireEvent.mouseDown(screen.getByRole('button', { name: 'Save as new dashboard' }));

		expect(defaultAllowed).toBe(false);
	});

	test('is absent on a draft (no handler): Save already creates a dashboard there', () => {
		renderHeader();

		expect(screen.queryByRole('button', { name: 'Save as new dashboard' })).not.toBeInTheDocument();
	});
});
