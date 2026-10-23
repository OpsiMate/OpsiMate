import { afterEach, beforeEach, describe, expect, Mock, test, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { ConfirmAlertActionDialog, PendingAlertAction } from '@/components/Alerts/ConfirmAlertActionDialog';
import { fireEvent, render, screen } from './test-utils';

// ConfirmAlertActionDialog is the single confirmation gate for silence, resolve, bulk
// comment and permanent delete on the Alerts page. These tests pin what it passes to
// `pending.run` (trimmed note, computed silence expiry) and when it lets confirm through.

type RunFn = PendingAlertAction['run'];

interface RenderDialogResult {
	run: Mock<RunFn>;
	onClose: Mock<() => void>;
}

const makePending = (overrides: Partial<PendingAlertAction> = {}): PendingAlertAction => ({
	title: 'Resolve alert?',
	description: 'The alert will be marked as resolved.',
	confirmLabel: 'Resolve',
	run: vi.fn<RunFn>(),
	...overrides,
});

const renderDialog = (overrides: Partial<PendingAlertAction> = {}): RenderDialogResult => {
	const run = vi.fn<RunFn>();
	const onClose = vi.fn<() => void>();
	const pending = makePending({ ...overrides, run });
	render(<ConfirmAlertActionDialog pending={pending} onClose={onClose} />);
	return { run, onClose };
};

const confirmButton = (name: string = 'Resolve') => screen.getByRole('button', { name });
const noteInput = () => screen.getByRole('textbox') as HTMLTextAreaElement;
const durationTrigger = () => screen.getByRole('combobox');

describe('ConfirmAlertActionDialog: rendering', () => {
	test('renders nothing when there is no pending action', () => {
		render(<ConfirmAlertActionDialog pending={null} onClose={vi.fn()} />);

		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
		expect(screen.queryByRole('button')).not.toBeInTheDocument();
	});

	test('shows the title, description and confirm label of the pending action', () => {
		renderDialog();

		expect(screen.getByRole('alertdialog')).toBeInTheDocument();
		expect(screen.getByText('Resolve alert?')).toBeInTheDocument();
		expect(screen.getByText('The alert will be marked as resolved.')).toBeInTheDocument();
		expect(confirmButton()).toBeInTheDocument();
	});
});

describe('ConfirmAlertActionDialog: confirm and cancel', () => {
	test('a plain confirm runs once with no note and no expiry, then closes', () => {
		const { run, onClose } = renderDialog();

		fireEvent.click(confirmButton());

		expect(run).toHaveBeenCalledTimes(1);
		expect(run).toHaveBeenCalledWith(undefined, undefined);
		// confirm() calls onClose, and the Radix AlertDialogAction then closes the dialog
		// through onOpenChange(false) as well, so onClose fires on both paths. Only pin
		// that it is called, and never before run.
		expect(onClose).toHaveBeenCalled();
		expect(run.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
	});

	test('Cancel closes the dialog without running the action', () => {
		const { run, onClose } = renderDialog();

		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

		expect(onClose).toHaveBeenCalledTimes(1);
		expect(run).not.toHaveBeenCalled();
	});

	test('a destructive action gets the red confirm button', () => {
		renderDialog({ destructive: true, confirmLabel: 'Delete' });

		expect(confirmButton('Delete')).toHaveClass('bg-destructive');
	});

	test('a non-destructive action does not get the red confirm button', () => {
		renderDialog();

		expect(confirmButton()).not.toHaveClass('bg-destructive');
	});
});

describe('ConfirmAlertActionDialog: comment', () => {
	test('a typed note is trimmed before it is passed to run', () => {
		const { run } = renderDialog({ withComment: true });

		fireEvent.change(noteInput(), { target: { value: '  looks fine  ' } });
		fireEvent.click(confirmButton());

		expect(run).toHaveBeenCalledWith('looks fine', undefined);
	});

	test('a whitespace-only note is passed as undefined', () => {
		const { run } = renderDialog({ withComment: true });

		fireEvent.change(noteInput(), { target: { value: '   ' } });
		fireEvent.click(confirmButton());

		expect(run).toHaveBeenCalledWith(undefined, undefined);
	});

	test('the label falls back to "Comment (optional)" with the default placeholder', () => {
		renderDialog({ withComment: true });

		expect(screen.getByText('Comment')).toBeInTheDocument();
		expect(screen.getByText('(optional)')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Add a note for your team')).toBeInTheDocument();
	});

	test('uses commentLabel and commentPlaceholder when given', () => {
		renderDialog({
			withComment: true,
			commentLabel: 'Resolution note',
			commentPlaceholder: 'What fixed it?',
		});

		expect(screen.getByText('Resolution note')).toBeInTheDocument();
		expect(screen.queryByText('Comment')).not.toBeInTheDocument();
		expect(screen.getByPlaceholderText('What fixed it?')).toBeInTheDocument();
	});
});

describe('ConfirmAlertActionDialog: required comment', () => {
	test('confirm is disabled and Enter does nothing until a note is typed', () => {
		const { run, onClose } = renderDialog({ withComment: true, requireComment: true, confirmLabel: 'Comment' });

		expect(confirmButton('Comment')).toBeDisabled();
		fireEvent.keyDown(noteInput(), { key: 'Enter' });
		expect(run).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();

		fireEvent.change(noteInput(), { target: { value: '   ' } });
		expect(confirmButton('Comment')).toBeDisabled();

		fireEvent.change(noteInput(), { target: { value: 'checked the logs' } });
		expect(confirmButton('Comment')).toBeEnabled();
		fireEvent.keyDown(noteInput(), { key: 'Enter' });
		expect(run).toHaveBeenCalledWith('checked the logs', undefined);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	test('the "(optional)" hint is not shown', () => {
		renderDialog({ withComment: true, requireComment: true });

		expect(screen.queryByText('(optional)')).not.toBeInTheDocument();
	});
});

describe('ConfirmAlertActionDialog: keyboard', () => {
	test('Enter in the textarea confirms with the typed note', () => {
		const { run, onClose } = renderDialog({ withComment: true });

		fireEvent.change(noteInput(), { target: { value: 'on it' } });
		fireEvent.keyDown(noteInput(), { key: 'Enter' });

		expect(run).toHaveBeenCalledWith('on it', undefined);
		expect(onClose).toHaveBeenCalledTimes(1);
	});

	test('Shift+Enter does not confirm', () => {
		const { run, onClose } = renderDialog({ withComment: true });

		fireEvent.change(noteInput(), { target: { value: 'line one' } });
		fireEvent.keyDown(noteInput(), { key: 'Enter', shiftKey: true });

		expect(run).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});

	test('Enter during IME composition does not confirm', () => {
		const { run, onClose } = renderDialog({ withComment: true });

		fireEvent.change(noteInput(), { target: { value: 'にほん' } });
		fireEvent.keyDown(noteInput(), { key: 'Enter', isComposing: true });

		expect(run).not.toHaveBeenCalled();
		expect(onClose).not.toHaveBeenCalled();
	});
});

describe('ConfirmAlertActionDialog: silence duration', () => {
	const NOW = new Date(2025, 5, 15, 10, 30, 0);

	beforeEach(() => {
		// Radix Select relies on pointer-capture and scrollIntoView, which jsdom lacks.
		window.HTMLElement.prototype.scrollIntoView = vi.fn();
		window.HTMLElement.prototype.hasPointerCapture = vi.fn();
		window.HTMLElement.prototype.releasePointerCapture = vi.fn();
		// Only Date is faked, so user-event's internal timers keep running.
		vi.useFakeTimers({ toFake: ['Date'] });
		vi.setSystemTime(NOW);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test('defaults to "Until midnight" and passes local midnight as the expiry', () => {
		const { run } = renderDialog({ withSilenceDuration: true, confirmLabel: 'Silence' });

		expect(durationTrigger()).toHaveTextContent('Until midnight');
		fireEvent.click(confirmButton('Silence'));

		const midnight = new Date();
		midnight.setHours(24, 0, 0, 0);
		expect(run).toHaveBeenCalledWith(undefined, midnight.toISOString());
	});

	test('picking 15 minutes passes now + 15 minutes as the expiry', async () => {
		const user = userEvent.setup();
		const { run } = renderDialog({ withSilenceDuration: true, confirmLabel: 'Silence' });

		await user.click(durationTrigger());
		await user.click(await screen.findByRole('option', { name: '15 minutes' }));
		expect(durationTrigger()).toHaveTextContent('15 minutes');
		await user.click(confirmButton('Silence'));

		expect(run).toHaveBeenCalledWith(undefined, new Date(NOW.getTime() + 15 * 60 * 1000).toISOString());
	});

	test('a non-silence action passes no expiry', () => {
		const { run } = renderDialog();

		expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
		fireEvent.click(confirmButton());

		expect(run).toHaveBeenCalledWith(undefined, undefined);
	});
});

describe('ConfirmAlertActionDialog: reset per pending action', () => {
	beforeEach(() => {
		window.HTMLElement.prototype.scrollIntoView = vi.fn();
		window.HTMLElement.prototype.hasPointerCapture = vi.fn();
		window.HTMLElement.prototype.releasePointerCapture = vi.fn();
	});

	test('a new pending action clears the note and resets the duration', async () => {
		const user = userEvent.setup();
		const onClose = vi.fn<() => void>();
		const first = makePending({ withComment: true, withSilenceDuration: true, confirmLabel: 'Silence' });
		const { rerender } = render(<ConfirmAlertActionDialog pending={first} onClose={onClose} />);

		await user.type(noteInput(), 'first note');
		await user.click(durationTrigger());
		await user.click(await screen.findByRole('option', { name: '1 hour' }));
		expect(noteInput().value).toBe('first note');
		expect(durationTrigger()).toHaveTextContent('1 hour');

		const second = makePending({ withComment: true, withSilenceDuration: true, confirmLabel: 'Silence' });
		rerender(<ConfirmAlertActionDialog pending={second} onClose={onClose} />);

		expect(noteInput().value).toBe('');
		expect(durationTrigger()).toHaveTextContent('Until midnight');
	});
});
