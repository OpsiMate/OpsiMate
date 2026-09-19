import { renderHook, render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MOBILE_BREAKPOINT, useIsMobile } from '@/hooks/use-mobile';
import { MobileWebOverlay } from '@/components/MobileWebOverlay';

describe('use-mobile hook & MOBILE_BREAKPOINT', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('exports MOBILE_BREAKPOINT equal to 768', () => {
		expect(MOBILE_BREAKPOINT).toBe(768);
	});

	it('queries matchMedia with (max-width: ${MOBILE_BREAKPOINT - 1}px)', () => {
		const matchMediaSpy = vi.spyOn(window, 'matchMedia');
		renderHook(() => useIsMobile());

		expect(matchMediaSpy).toHaveBeenCalledWith(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
	});

	it('returns true when window.innerWidth is less than MOBILE_BREAKPOINT', () => {
		window.innerWidth = MOBILE_BREAKPOINT - 100;
		const { result } = renderHook(() => useIsMobile());
		expect(result.current).toBe(true);
	});

	it('returns false when window.innerWidth is greater than or equal to MOBILE_BREAKPOINT', () => {
		window.innerWidth = MOBILE_BREAKPOINT + 100;
		const { result } = renderHook(() => useIsMobile());
		expect(result.current).toBe(false);
	});
});

describe('MobileWebOverlay', () => {
	it('renders dynamic breakpoint text in overlay copy when on mobile screen', () => {
		window.innerWidth = MOBILE_BREAKPOINT - 100;
		render(<MobileWebOverlay />);

		expect(screen.getByText(`Minimum recommended width: ${MOBILE_BREAKPOINT}px`)).toBeInTheDocument();
	});

	it('renders nothing when on desktop screen', () => {
		window.innerWidth = MOBILE_BREAKPOINT + 100;
		const { container } = render(<MobileWebOverlay />);
		expect(container.firstChild).toBeNull();
	});
});
