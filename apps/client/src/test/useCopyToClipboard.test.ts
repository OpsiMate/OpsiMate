import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { COPIED_RESET_MS, useCopyToClipboard } from '@/hooks/useCopyToClipboard';

const { toast } = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast }) }));
const descriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const writeText = vi.fn();
beforeEach(() => {
	vi.useFakeTimers();
	toast.mockReset();
	writeText.mockReset().mockResolvedValue(undefined);
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
});
afterEach(() => {
	cleanup();
	vi.useRealTimers();
	if (descriptor) Object.defineProperty(navigator, 'clipboard', descriptor);
	else Reflect.deleteProperty(navigator, 'clipboard');
});

describe('clipboard dialog feedback', () => {
	test('shows caller-specific success text and resets after two seconds', async () => {
		const { result } = renderHook(() => useCopyToClipboard());
		expect(result.current.copied).toBe(false);
		await act(async () => {
			expect(
				await result.current.copy('payload', { successDescription: 'Example payload copied to clipboard' })
			).toBe(true);
		});
		expect(writeText).toHaveBeenCalledWith('payload');
		expect(result.current.copied).toBe(true);
		expect(toast).toHaveBeenCalledWith({
			title: 'Copied!',
			description: 'Example payload copied to clipboard',
			duration: 2000,
		});
		act(() => vi.advanceTimersByTime(COPIED_RESET_MS - 1));
		expect(result.current.copied).toBe(true);
		act(() => vi.advanceTimersByTime(1));
		expect(result.current.copied).toBe(false);
	});
	test.each(['rejected', 'missing'])('reports %s clipboard without success or timers', async (mode) => {
		if (mode === 'missing') Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
		else writeText.mockRejectedValue(new Error('Denied'));
		const { result } = renderHook(() => useCopyToClipboard());
		await act(async () => {
			expect(await result.current.copy('value', { failureDescription: 'Please copy the URL manually' })).toBe(
				false
			);
		});
		expect(result.current.copied).toBe(false);
		// textarea.select queues a zero-delay selection event in jsdom.
		act(() => vi.advanceTimersByTime(0));
		expect(vi.getTimerCount()).toBe(0);
		expect(toast).toHaveBeenCalledWith({
			title: 'Failed to copy',
			description: 'Please copy the URL manually',
			variant: 'destructive',
			duration: 3000,
		});
	});
});

describe('clipboard lifecycle', () => {
	test('cleans up the active reset on unmount', async () => {
		const { result, unmount } = renderHook(() => useCopyToClipboard());
		await act(async () => {
			await result.current.copy('one');
			await result.current.copy('two');
		});
		expect(vi.getTimerCount()).toBe(1);
		unmount();
		expect(vi.getTimerCount()).toBe(0);
		act(() => vi.advanceTimersByTime(2000));
	});
	test('ignores a clipboard promise that finishes after unmount', async () => {
		let finish!: () => void;
		writeText.mockReturnValue(
			new Promise<void>((resolve) => {
				finish = resolve;
			})
		);
		const { result, unmount } = renderHook(() => useCopyToClipboard());
		const pending = result.current.copy('value', { successDescription: 'Copied text' });
		unmount();
		finish();
		expect(await pending).toBe(false);
		expect(toast).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('consistent clipboard feedback', () => {
	test('restarts the default feedback deadline after another successful copy', async () => {
		const { result } = renderHook(() => useCopyToClipboard());
		await act(async () => {
			await result.current.copy('first');
		});
		act(() => vi.advanceTimersByTime(1000));
		await act(async () => {
			await result.current.copy('second');
		});
		act(() => vi.advanceTimersByTime(1000));
		expect(result.current.copied).toBe(true);
		expect(vi.getTimerCount()).toBe(1);
		act(() => vi.advanceTimersByTime(1000));
		expect(result.current.copied).toBe(false);
	});
	test.each(['rejected', 'missing'])('falls back by default for %s clipboard', async (mode) => {
		const previous = Object.getOwnPropertyDescriptor(document, 'execCommand');
		const legacy = vi.fn(() => true);
		Object.defineProperty(document, 'execCommand', { configurable: true, value: legacy });
		try {
			if (mode === 'missing')
				Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
			else writeText.mockRejectedValue(new Error('Denied'));
			const { result } = renderHook(() => useCopyToClipboard());
			await act(async () => {
				expect(await result.current.copy('fallback text')).toBe(true);
			});
			expect(legacy).toHaveBeenCalledWith('copy');
			expect(result.current.copied).toBe(true);
			expect(document.querySelector('textarea')).toBeNull();
		} finally {
			if (previous) Object.defineProperty(document, 'execCommand', previous);
			else Reflect.deleteProperty(document, 'execCommand');
		}
	});
});

test.each(['false', 'throws'])('cleans up after a fallback that %s and reports failure', async (mode) => {
	const previous = Object.getOwnPropertyDescriptor(document, 'execCommand');
	Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
	Object.defineProperty(document, 'execCommand', {
		configurable: true,
		value: () => {
			expect(document.querySelector('textarea')?.value).toBe('original payload');
			if (mode === 'throws') throw new Error('Copy denied');
			return false;
		},
	});
	try {
		const { result } = renderHook(() => useCopyToClipboard());
		await act(async () => {
			expect(await result.current.copy('original payload', { failureDescription: 'Copy manually' })).toBe(false);
		});
		expect(result.current.copied).toBe(false);
		expect(document.querySelector('textarea')).toBeNull();
		expect(toast).toHaveBeenCalledWith(
			expect.objectContaining({ title: 'Failed to copy', description: 'Copy manually' })
		);
	} finally {
		if (previous) Object.defineProperty(document, 'execCommand', previous);
		else Reflect.deleteProperty(document, 'execCommand');
	}
});
