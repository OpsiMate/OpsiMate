import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from './test-utils';
import { FilterSidebar } from '@/components/shared/FilterSidebar';

const STORAGE_KEY = 'opsimate-alerts-filter-sidebar-width';

const renderSidebar = () => {
	render(
		<FilterSidebar>
			<span>Severity</span>
		</FilterSidebar>
	);
	const handle = screen.getByRole('separator', { name: 'Resize filter sidebar' });
	return { handle, panel: handle.parentElement as HTMLElement };
};

// The sidebar used to be a fixed w-48 with an arrow button that toggled an icon rail. It is
// now a drag-resizable panel, and these are the two things that changed for a user: the
// handle is where the toggle was, and dragging it sticks.
describe('FilterSidebar', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('renders its children behind a resize handle, with no collapse toggle left', () => {
		const { handle } = renderSidebar();

		expect(screen.getByText('Severity')).toBeInTheDocument();
		expect(handle).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('opens at 192px, and a drag past the handle widens the panel and remembers it', () => {
		const { handle, panel } = renderSidebar();
		expect(panel.style.width).toBe('192px');

		fireEvent(handle, new MouseEvent('pointerdown', { bubbles: true }));
		fireEvent(window, new MouseEvent('pointermove', { clientX: 300 }));
		fireEvent(window, new MouseEvent('pointerup'));

		expect(panel.style.width).toBe('300px');
		expect(localStorage.getItem(STORAGE_KEY)).toBe('300');
	});
});

// The handle is also a tab stop, because a drag is a gesture a keyboard has no equivalent
// of — arrow keys are the resize, and they move the panel the separators' own width reports.
describe('FilterSidebar keyboard resize', () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it('is a focusable separator that reports the width and the range it can travel', () => {
		const { handle } = renderSidebar();

		expect(handle).toHaveAttribute('tabindex', '0');
		expect(handle).toHaveAttribute('aria-valuemin', '192');
		expect(handle).toHaveAttribute('aria-valuemax', '480');
		expect(handle).toHaveAttribute('aria-valuenow', '192');
	});

	it('steps 16px per arrow key and 64px with Shift, following aria-valuenow', () => {
		const { handle, panel } = renderSidebar();

		fireEvent.keyDown(handle, { key: 'ArrowRight' });
		expect(panel.style.width).toBe('208px');
		fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
		expect(panel.style.width).toBe('272px');
		fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
		expect(panel.style.width).toBe('208px');
		expect(handle).toHaveAttribute('aria-valuenow', '208');
	});

	it('keeps a keyboard resize inside the panel bounds', () => {
		const { handle, panel } = renderSidebar();

		// w-48 was the sidebar's only width before it could be resized, so it stays the floor
		// no number of steps goes under.
		for (let i = 0; i < 4; i++) fireEvent.keyDown(handle, { key: 'ArrowLeft', shiftKey: true });
		expect(panel.style.width).toBe('192px');
		expect(handle).toHaveAttribute('aria-valuenow', '192');

		for (let i = 0; i < 8; i++) fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true });
		expect(panel.style.width).toBe('480px');
		expect(handle).toHaveAttribute('aria-valuenow', '480');
	});

	it('Home and End take the ends of the range, and each step is remembered at once', () => {
		const { handle, panel } = renderSidebar();

		fireEvent.keyDown(handle, { key: 'End' });
		expect(panel.style.width).toBe('480px');
		expect(localStorage.getItem(STORAGE_KEY)).toBe('480');

		fireEvent.keyDown(handle, { key: 'Home' });
		expect(panel.style.width).toBe('192px');
		expect(localStorage.getItem(STORAGE_KEY)).toBe('192');
	});
});
