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
		const onCopied = vi.fn();
		const { result } = renderHook(() => useCopyToClipboard());
		await act(async () => {
			expect(
				await result.current.copy('value', { failureDescription: 'Please copy the URL manually', onCopied })
			).toBe(false);
		});
		expect(result.current.copied).toBe(false);
		expect(onCopied).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
		expect(toast).toHaveBeenCalledWith({
			title: 'Failed to copy',
			description: 'Please copy the URL manually',
			variant: 'destructive',
			duration: 3000,
		});
	});
});

describe('clipboard lifecycle and reset callbacks', () => {
	test('keeps independent scheduled resets for dialog copies', async () => {
		const first = vi.fn(),
			second = vi.fn();
		const { result } = renderHook(() => useCopyToClipboard());
		await act(async () => {
			await result.current.copy('first', { onReset: first });
		});
		act(() => vi.advanceTimersByTime(1000));
		await act(async () => {
			await result.current.copy('second', { onReset: second });
		});
		act(() => vi.advanceTimersByTime(1000));
		expect(first).toHaveBeenCalledOnce();
		expect(second).not.toHaveBeenCalled();
		act(() => vi.advanceTimersByTime(1000));
		expect(second).toHaveBeenCalledOnce();
	});
	test('cleans up every dialog reset on unmount', async () => {
		const onReset = vi.fn();
		const { result, unmount } = renderHook(() => useCopyToClipboard());
		await act(async () => {
			await result.current.copy('one', { onReset });
			await result.current.copy('two', { onReset });
		});
		expect(vi.getTimerCount()).toBe(2);
		unmount();
		expect(vi.getTimerCount()).toBe(0);
		act(() => vi.advanceTimersByTime(2000));
		expect(onReset).not.toHaveBeenCalled();
	});
	test('ignores a clipboard promise that finishes after unmount', async () => {
		let finish!: () => void;
		writeText.mockReturnValue(
			new Promise<void>((resolve) => {
				finish = resolve;
			})
		);
		const onCopied = vi.fn();
		const { result, unmount } = renderHook(() => useCopyToClipboard());
		const pending = result.current.copy('value', { successDescription: 'Copied text', onCopied });
		unmount();
		finish();
		expect(await pending).toBe(false);
		expect(onCopied).not.toHaveBeenCalled();
		expect(toast).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});
});
