import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { CopyCellButton } from '@/components/Alerts/AlertsTable/AlertRow/CopyCellButton';

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const execDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');
const writeText = vi.fn();
const execCommand = vi.fn();

beforeEach(() => {
	vi.useFakeTimers();
	writeText.mockReset().mockResolvedValue(undefined);
	execCommand.mockReset().mockReturnValue(true);
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
	Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
	if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor);
	else Reflect.deleteProperty(navigator, 'clipboard');
	if (execDescriptor) Object.defineProperty(document, 'execCommand', execDescriptor);
	else Reflect.deleteProperty(document, 'execCommand');
});

async function copy() {
	await act(async () => {
		fireEvent.click(screen.getByRole('button', { name: 'Copy value' }));
	});
}

describe('table clipboard feedback', () => {
	test('copies the complete value without opening the parent and resets after 1500 ms', async () => {
		const onClick = vi.fn();
		const onMouseDown = vi.fn();
		render(
			<div onClick={onClick} onMouseDown={onMouseDown}>
				<CopyCellButton value="full, untruncated value" />
			</div>
		);
		fireEvent.mouseDown(screen.getByRole('button'));
		await copy();
		expect(writeText).toHaveBeenCalledWith('full, untruncated value');
		expect(onClick).not.toHaveBeenCalled();
		expect(onMouseDown).not.toHaveBeenCalled();
		expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
		act(() => vi.advanceTimersByTime(1499));
		expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
		act(() => vi.advanceTimersByTime(1));
		expect(screen.getByRole('button', { name: 'Copy value' })).toBeInTheDocument();
	});
	test('restarts the feedback duration after a second copy', async () => {
		render(<CopyCellButton value="value" />);
		await copy();
		act(() => vi.advanceTimersByTime(1000));
		await act(async () => {
			fireEvent.click(screen.getByRole('button', { name: 'Copied' }));
		});
		act(() => vi.advanceTimersByTime(500));
		expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
		act(() => vi.advanceTimersByTime(1000));
		expect(screen.getByRole('button', { name: 'Copy value' })).toBeInTheDocument();
	});
	test('clears its pending feedback timer on unmount', async () => {
		const { unmount } = render(<CopyCellButton value="value" />);
		const initial = vi.getTimerCount();
		await copy();
		expect(vi.getTimerCount()).toBe(initial + 1);
		unmount();
		expect(vi.getTimerCount()).toBe(initial);
	});
});

describe('table clipboard fallback', () => {
	test.each(['unavailable', 'rejected'])('uses the legacy path when Clipboard API is %s', async (mode) => {
		if (mode === 'unavailable')
			Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
		else writeText.mockRejectedValue(new Error('Permission denied'));
		execCommand.mockImplementation((command) => {
			expect(command).toBe('copy');
			expect(document.querySelector('textarea')?.value).toBe('fallback value');
			return true;
		});
		render(<CopyCellButton value="fallback value" />);
		await copy();
		expect(execCommand).toHaveBeenCalledOnce();
		expect(document.querySelector('textarea')).toBeNull();
		expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument();
	});
	test('does not show success when the fallback returns false', async () => {
		writeText.mockRejectedValue(new Error('Permission denied'));
		execCommand.mockReturnValue(false);
		render(<CopyCellButton value="value" />);
		await copy();
		expect(document.querySelector('textarea')).toBeNull();
		expect(screen.getByRole('button', { name: 'Copy value' })).toBeInTheDocument();
	});
});
