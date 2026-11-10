import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { AlertSummarySection } from '@/components/Alerts/AlertDetails/AlertSummarySection';

// jsdom has no layout, so the scroll geometry is stubbed on the element: the hint must
// show while text sits below the fold and go away once the reader reaches the bottom.
const geometry = (el: HTMLElement, scrollHeight: number, clientHeight: number) => {
	Object.defineProperty(el, 'scrollHeight', { configurable: true, value: scrollHeight });
	Object.defineProperty(el, 'clientHeight', { configurable: true, value: clientHeight });
};

describe('AlertSummarySection scroll hint', () => {
	test('a summary that fits shows no hint', () => {
		render(<AlertSummarySection summary="short" />);
		expect(screen.queryByTestId('scroll-hint')).toBeNull();
	});

	test('an overflowing summary shows the hint until scrolled to the bottom', () => {
		const { rerender } = render(<AlertSummarySection summary="first" />);
		const box = screen.getByText('first').closest('.overflow-y-auto') as HTMLElement;
		geometry(box, 1200, 400);
		// A new summary re-measures.
		rerender(<AlertSummarySection summary="long" />);
		expect(screen.getByTestId('scroll-hint')).toBeInTheDocument();
		act(() => {
			box.scrollTop = 800;
			fireEvent.scroll(box);
		});
		expect(screen.queryByTestId('scroll-hint')).toBeNull();
		act(() => {
			box.scrollTop = 100;
			fireEvent.scroll(box);
		});
		expect(screen.getByTestId('scroll-hint')).toBeInTheDocument();
	});
});
