import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from './test-utils';
import { FilterSidebar } from '@/components/shared/FilterSidebar';

const STORAGE_KEY = 'opsimate-alerts-filter-sidebar-width';

// The sidebar used to be a fixed w-48 with an arrow button that toggled an icon rail. It is
// now a drag-resizable panel, and these are the two things that changed for a user: the
// handle is where the toggle was, and dragging it sticks.
describe('FilterSidebar', () => {
	it('renders its children behind a resize handle, with no collapse toggle left', () => {
		render(
			<FilterSidebar>
				<span>Severity</span>
			</FilterSidebar>
		);

		expect(screen.getByText('Severity')).toBeInTheDocument();
		expect(screen.getByRole('separator', { name: 'Resize filter sidebar' })).toBeInTheDocument();
		expect(screen.queryByRole('button')).toBeNull();
	});

	it('opens at 192px, and a drag past the handle widens the panel and remembers it', () => {
		render(
			<FilterSidebar>
				<span>Severity</span>
			</FilterSidebar>
		);

		const handle = screen.getByRole('separator', { name: 'Resize filter sidebar' });
		const panel = handle.parentElement as HTMLElement;
		expect(panel.style.width).toBe('192px');

		fireEvent(handle, new MouseEvent('pointerdown', { bubbles: true }));
		fireEvent(window, new MouseEvent('pointermove', { clientX: 300 }));
		fireEvent(window, new MouseEvent('pointerup'));

		expect(panel.style.width).toBe('300px');
		expect(localStorage.getItem(STORAGE_KEY)).toBe('300');
	});
});
