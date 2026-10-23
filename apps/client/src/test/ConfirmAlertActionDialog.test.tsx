import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { ConfirmAlertActionDialog, type PendingAlertAction } from '@/components/Alerts/ConfirmAlertActionDialog';
import { render, screen, fireEvent } from '@/test/test-utils';

const pending = (overrides: Partial<PendingAlertAction> = {}): PendingAlertAction => ({
	title: 'Silence alert',
	description: 'Are you sure?',
	confirmLabel: 'Confirm',
	run: vi.fn(),
	destructive: false,
	withComment: false,
	requireComment: false,
	commentLabel: undefined,
	commentPlaceholder: undefined,
	withSilenceDuration: false,
	...overrides,
});

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-23T10:00:00Z'));
});

afterEach(() => {
	vi.useRealTimers();
});

const commentBox = () => screen.getByLabelText(/Comment/);

describe('ConfirmAlertActionDialog', () => {
	test('renders nothing when pending is null', () => {
		render(<ConfirmAlertActionDialog pending={null} onClose={vi.fn()} />);
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
	});

	test('shows title, description and confirm label when pending is set', () => {
		render(<ConfirmAlertActionDialog pending={pending()} onClose={vi.fn()} />);
		expect(screen.getByRole('alertdialog')).toBeInTheDocument();
		expect(screen.getByText('Silence alert')).toBeInTheDocument();
		expect(screen.getByText('Are you sure?')).toBeInTheDocument();
		expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
	});

	test('plain confirm calls run(undefined, undefined) then onClose', () => {
		const run = vi.fn();
		const onClose = vi.fn();
		render(<ConfirmAlertActionDialog pending={pending({ run })} onClose={onClose} />);
		fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
		expect(run).toHaveBeenCalledTimes(1);
		expect(run).toHaveBeenCalledWith(undefined, undefined);
		expect(onClose).toHaveBeenCalledTimes(2);
	});

	test('does not call run when the confirm button is disabled', () => {
		const run = vi.fn();
		const p = pending({ withComment: true, requireComment: true });
		p.run = run;
		render(<ConfirmAlertActionDialog pending={p} onClose={vi.fn()} />);
		const button = screen.getByRole('button', { name: 'Confirm' });
		expect(button).toBeDisabled();
		fireEvent.click(button);
		expect(run).not.toHaveBeenCalled();
	});

	test('withComment shows optional label and placeholder by default', () => {
		render(<ConfirmAlertActionDialog pending={pending({ withComment: true })} onClose={vi.fn()} />);
		expect(commentBox()).toBeInTheDocument();
		expect(screen.getByText('(optional)')).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Add a note for your team')).toBeInTheDocument();
	});

	test('withComment uses commentLabel and commentPlaceholder when given', () => {
		const p = pending({
			withComment: true,
			commentLabel: 'Reason',
			commentPlaceholder: 'Why are you silencing this?',
		});
		render(<ConfirmAlertActionDialog pending={p} onClose={vi.fn()} />);
		expect(screen.getByLabelText(/Reason/)).toBeInTheDocument();
		expect(screen.getByPlaceholderText('Why are you silencing this?')).toBeInTheDocument();
	});

	test('trims a typed note before submission', () => {
		const run = vi.fn();
		const p = pending({ withComment: true });
		p.run = run;
		render(<ConfirmAlertActionDialog pending={p} onClose={vi.fn()} />);
		fireEvent.change(commentBox(), { target: { value: ' looks fine ' } });
		fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
		expect(run).toHaveBeenCalledWith('looks fine', undefined);
	});

	test('whitespace-only comment is treated as empty when required', () => {
		const run = vi.fn();
		const p = pending({ withComment: true, requireComment: true });
		p.run = run;
		render(<ConfirmAlertActionDialog pending={p} onClose={vi.fn()} />);
		fireEvent.change(commentBox(), { target: { value: '   ' } });
		const button = screen.getByRole('button', { name: 'Confirm' });
		expect(button).toBeDisabled();
		fireEvent.click(button);
		expect(run).not.toHaveBeenCalled();
	});

	test('requireComment disables confirm until text is typed, no (optional)', () => {
		const p = pending({ withComment: true, requireComment: true });
		render(<ConfirmAlertActionDialog pending={p} onClose={vi.fn()} />);
		expect(screen.getByRole('button', { name: 'Confirm' })).toBeDisabled();
		expect(screen.queryByText('(optional)')).not.toBeInTheDocument();
		fireEvent.change(commentBox(), { target: { value: 'note' } });
		expect(screen.getByRole('button', { name: 'Confirm' })).not.toBeDisabled();
	});

	test('Enter in the textarea confirms the action', () => {
		const run = vi.fn();
		const p = pending({ withComment: true });
		p.run = run;
		render(<ConfirmAlertActionDialog pending={p} onClose={vi.fn()} />);
		fireEvent.change(commentBox(), { target: { value: 'note' } });
		fireEvent.keyDown(commentBox(), {
			key: 'Enter',
			shiftKey: false,
			nativeEvent: { isComposing: false },
		});
		expect(run).toHaveBeenCalledTimes(1);
		expect(run).toHaveBeenCalledWith('note', undefined);
	});

	test('Shift+Enter does not call run', () => {
		const run = vi.fn();
		const p = pending({ withComment: true });
		p.run = run;
		render(<ConfirmAlertActionDialog pending={p} onClose={vi.fn()} />);
		fireEvent.change(commentBox(), { target: { value: 'note' } });
		fireEvent.keyDown(commentBox(), {
			key: 'Enter',
			shiftKey: true,
			nativeEvent: { isComposing: false },
		});
		expect(run).not.toHaveBeenCalled();
	});

	test('Enter during IME composition does not call run', () => {
		const run = vi.fn();
		const p = pending({ withComment: true });
		p.run = run;
		render(<ConfirmAlertActionDialog pending={p} onClose={vi.fn()} />);
		fireEvent.change(commentBox(), { target: { value: 'note' } });
		fireEvent.keyDown(commentBox(), {
			key: 'Enter',
			shiftKey: false,
			isComposing: true,
		});
		expect(run).not.toHaveBeenCalled();
	});

	test('Enter submits once and closing the dialog prevents resubmission', () => {
		const run = vi.fn();
		const onClose = vi.fn();
		let current: PendingAlertAction | null = pending({ withComment: true, run });
		const { rerender } = render(
			<ConfirmAlertActionDialog
				pending={current}
				onClose={() => {
					onClose();
					current = null;
					rerender(<ConfirmAlertActionDialog pending={null} onClose={onClose} />);
				}}
			/>
		);
		fireEvent.change(commentBox(), { target: { value: 'note' } });
		fireEvent.keyDown(commentBox(), {
			key: 'Enter',
			shiftKey: false,
			isComposing: false,
		});
		expect(run).toHaveBeenCalledTimes(1);
		expect(onClose).toHaveBeenCalled();
		expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
	});

	test('silence duration default passes local midnight to run', () => {
		const run = vi.fn();
		const p = pending({ withSilenceDuration: true });
		p.run = run;
		render(<ConfirmAlertActionDialog pending={p} onClose={vi.fn()} />);
		expect(screen.getByRole('combobox', { name: /silence for/i })).toHaveTextContent('Until midnight');
		fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
		const expectedMidnight = new Date();
		expectedMidnight.setHours(24, 0, 0, 0);
		expect(run).toHaveBeenCalledWith(undefined, expectedMidnight.toISOString());
	});

	test('selecting 15 minutes passes now + 15 minutes to run', () => {
		const run = vi.fn();
		const p = pending({ withSilenceDuration: true });
		p.run = run;
		render(<ConfirmAlertActionDialog pending={p} onClose={vi.fn()} />);
		const trigger = screen.getByRole('combobox', { name: /silence for/i });
		fireEvent.click(trigger);
		fireEvent.click(screen.getByRole('option', { name: '15 minutes' }));
		expect(trigger).toHaveTextContent('15 minutes');
		fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
		const expected = new Date(Date.now() + 15 * 60 * 1000);
		expect(run).toHaveBeenCalledWith(undefined, expected.toISOString());
	});

	test('reopening with a new pending resets comment and duration', () => {
		const run = vi.fn();
		const first = pending({ withComment: true, withSilenceDuration: true, run });
		const second = pending({ withComment: true, withSilenceDuration: true, run });
		const { rerender } = render(<ConfirmAlertActionDialog pending={first} onClose={vi.fn()} />);
		fireEvent.change(commentBox(), { target: { value: 'a note' } });
		const trigger = screen.getByRole('combobox', { name: /silence for/i });
		fireEvent.click(trigger);
		fireEvent.click(screen.getByRole('option', { name: '15 minutes' }));

		rerender(<ConfirmAlertActionDialog pending={second} onClose={vi.fn()} />);
		expect(commentBox()).toHaveValue('');
		expect(screen.getByRole('combobox', { name: /silence for/i })).toHaveTextContent('Until midnight');
		expect(run).not.toHaveBeenCalled();
	});

	test('destructive confirm button has the destructive class', () => {
		const p = pending({ destructive: true });
		render(<ConfirmAlertActionDialog pending={p} onClose={vi.fn()} />);
		const button = screen.getByRole('button', { name: 'Confirm' });
		expect(button.className).toContain('bg-destructive');
	});

	test('cancel calls onClose and never run', () => {
		const run = vi.fn();
		const onClose = vi.fn();
		render(<ConfirmAlertActionDialog pending={pending({ run })} onClose={onClose} />);
		fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
		expect(onClose).toHaveBeenCalledTimes(1);
		expect(run).not.toHaveBeenCalled();
	});
});
