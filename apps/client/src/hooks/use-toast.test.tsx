import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, render, screen, act } from '@testing-library/react';
import { useToast, reducer } from './use-toast';
import { Toaster } from '@/components/ui/toaster';

describe('useToast Hook', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		// Dismiss and clear any existing toasts from module memoryState to ensure clean tests
		const { result, unmount } = renderHook(() => useToast());
		act(() => {
			result.current.dismiss();
		});
		act(() => {
			vi.runAllTimers();
		});
		unmount();
		vi.useRealTimers();
	});

	it('creates toast notifications with correct properties', () => {
		const { result } = renderHook(() => useToast());
		let toastResult: ReturnType<typeof result.current.toast>;

		act(() => {
			toastResult = result.current.toast({
				title: 'Test Title',
				description: 'Test Description',
				variant: 'default',
			});
		});

		expect(result.current.toasts.length).toBe(1);
		expect(result.current.toasts[0]).toEqual(
			expect.objectContaining({
				id: toastResult!.id,
				title: 'Test Title',
				description: 'Test Description',
				variant: 'default',
				open: true,
			})
		);
		expect(typeof result.current.toasts[0].onOpenChange).toBe('function');
	});

	it('handles different toast types', () => {
		const { result } = renderHook(() => useToast());

		// Test default / implicitly info/success
		act(() => {
			result.current.toast({
				title: 'Info Toast',
				description: 'This is an info toast',
			});
		});
		expect(result.current.toasts[0].variant).toBeUndefined();

		// Test destructive (error) variant
		act(() => {
			result.current.toast({
				title: 'Error Toast',
				description: 'This is an error toast',
				variant: 'destructive',
			});
		});
		expect(result.current.toasts[0].variant).toBe('destructive');
	});

	it('manages toast queue and display limits (TOAST_LIMIT = 1)', () => {
		const { result } = renderHook(() => useToast());

		act(() => {
			result.current.toast({ title: 'First Toast' });
		});
		expect(result.current.toasts.length).toBe(1);
		expect(result.current.toasts[0].title).toBe('First Toast');

		act(() => {
			result.current.toast({ title: 'Second Toast' });
		});

		// Queue size should still be 1, and the active toast should be the most recently added one
		expect(result.current.toasts.length).toBe(1);
		expect(result.current.toasts[0].title).toBe('Second Toast');
	});

	it('handles manual toast dismissal by id', () => {
		const { result } = renderHook(() => useToast());
		let toastResult: ReturnType<typeof result.current.toast>;

		act(() => {
			toastResult = result.current.toast({ title: 'Dismiss Me' });
		});
		expect(result.current.toasts[0].open).toBe(true);

		act(() => {
			result.current.dismiss(toastResult.id);
		});

		expect(result.current.toasts[0].open).toBe(false);
	});

	it('handles manual dismissal of all toasts', () => {
		const { result } = renderHook(() => useToast());

		act(() => {
			result.current.toast({ title: 'Dismiss All' });
		});
		expect(result.current.toasts[0].open).toBe(true);

		act(() => {
			result.current.dismiss();
		});

		expect(result.current.toasts[0].open).toBe(false);
	});

	it('removes toast from state after TOAST_REMOVE_DELAY following dismissal', () => {
		vi.useFakeTimers();
		const { result } = renderHook(() => useToast());
		let toastResult: ReturnType<typeof result.current.toast>;

		act(() => {
			toastResult = result.current.toast({ title: 'Timers test' });
		});
		expect(result.current.toasts.length).toBe(1);

		act(() => {
			toastResult.dismiss();
		});
		expect(result.current.toasts[0].open).toBe(false);

		// Fast forward time just before the removal delay (1000000ms - 1ms)
		act(() => {
			vi.advanceTimersByTime(1000000 - 1);
		});
		expect(result.current.toasts.length).toBe(1);

		// Fast forward remaining 1ms
		act(() => {
			vi.advanceTimersByTime(1);
		});
		expect(result.current.toasts.length).toBe(0);

		vi.useRealTimers();
	});

	it('dismisses toast when onOpenChange is called with false', () => {
		vi.useFakeTimers();
		const { result } = renderHook(() => useToast());

		act(() => {
			result.current.toast({ title: 'onOpenChange test' });
		});
		expect(result.current.toasts[0].open).toBe(true);

		// Trigger onOpenChange(false) which is what Radix UI components do internally when closing
		act(() => {
			result.current.toasts[0].onOpenChange?.(false);
		});
		expect(result.current.toasts[0].open).toBe(false);

		// Fast forward to complete the removal queue
		act(() => {
			vi.advanceTimersByTime(1000000);
		});
		expect(result.current.toasts.length).toBe(0);

		vi.useRealTimers();
	});

	it('manages toast state updates correctly', () => {
		const { result } = renderHook(() => useToast());
		let toastResult: ReturnType<typeof result.current.toast>;

		act(() => {
			toastResult = result.current.toast({
				title: 'Initial Title',
				description: 'Initial Description',
			});
		});

		expect(result.current.toasts[0].title).toBe('Initial Title');
		expect(result.current.toasts[0].description).toBe('Initial Description');

		act(() => {
			toastResult.update({
				id: toastResult.id,
				title: 'Updated Title',
				description: 'Updated Description',
			});
		});

		expect(result.current.toasts[0].title).toBe('Updated Title');
		expect(result.current.toasts[0].description).toBe('Updated Description');
	});

	it('cleans up and removes listener on unmount', () => {
		const { result: result1, unmount: unmount1 } = renderHook(() => useToast());
		const { result: result2 } = renderHook(() => useToast());

		act(() => {
			unmount1();
		});

		act(() => {
			result2.current.toast({ title: 'New Toast After Unmount' });
		});

		// The active hook (result2) should receive the state change
		expect(result2.current.toasts.length).toBe(1);
		expect(result2.current.toasts[0].title).toBe('New Toast After Unmount');

		// The unmounted hook (result1) should not update and remains with its previous/cleared state
		expect(result1.current.toasts.length).toBe(0);
	});

	it('provides accessible toast elements (aria-live / role) when rendered', async () => {
		const TestComponent = () => {
			const { toast } = useToast();
			return (
				<>
					<Toaster />
					<button onClick={() => toast({ title: 'Accessible Toast', description: 'Hello accessibility' })}>
						Trigger
					</button>
				</>
			);
		};

		render(<TestComponent />);

		const button = screen.getByText('Trigger');
		act(() => {
			button.click();
		});

		// Verify title and description are in the document
		expect(await screen.findByText('Accessible Toast')).toBeInTheDocument();
		expect(screen.getByText('Hello accessibility')).toBeInTheDocument();

		// Verify that a live region/announcer is present in the document
		const liveRegion = document.querySelector('[aria-live]');
		expect(liveRegion).toBeInTheDocument();
		expect(liveRegion).toHaveAttribute('aria-live');
	});

	it('renders destructive toast with alert role', async () => {
		const TestDestructiveComponent = () => {
			const { toast } = useToast();
			return (
				<>
					<Toaster />
					<button onClick={() => toast({ title: 'Destructive Toast', variant: 'destructive' })}>
						Trigger Destructive
					</button>
				</>
			);
		};

		render(<TestDestructiveComponent />);

		const destructiveBtn = screen.getByText('Trigger Destructive');
		act(() => {
			destructiveBtn.click();
		});

		expect(await screen.findByText('Destructive Toast')).toBeInTheDocument();

		// Verify the toast element has the correct class name for styling
		const toastLi = screen.getByText('Destructive Toast').closest('li');
		expect(toastLi).toBeInTheDocument();
		expect(toastLi?.className).toContain('destructive');

		// Verify that a live region/announcer is present and is assertive for destructive toasts
		const liveRegion = document.querySelector('[aria-live]');
		expect(liveRegion).toBeInTheDocument();
		expect(liveRegion).toHaveAttribute('aria-live', 'assertive');
	});

	it('shares toast state across multiple hook instances (persistence)', () => {
		const { result: resultA } = renderHook(() => useToast());
		const { result: resultB } = renderHook(() => useToast());

		act(() => {
			resultA.current.toast({ title: 'Shared Toast' });
		});

		// resultB should see the toast created by resultA
		expect(resultB.current.toasts.length).toBe(1);
		expect(resultB.current.toasts[0].title).toBe('Shared Toast');
	});
});

describe('useToast reducer', () => {
	it('REMOVE_TOAST with no id clears all toasts', () => {
		const initialState = {
			toasts: [
				{ id: '1', title: 'Toast 1', open: true },
				{ id: '2', title: 'Toast 2', open: true },
			],
		};
		const nextState = reducer(initialState, { type: 'REMOVE_TOAST' });
		expect(nextState.toasts).toEqual([]);
	});
});
