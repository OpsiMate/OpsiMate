import { fireEvent, render, screen } from '@/test/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { TimeFilter } from './TimeFilter';

describe('TimeFilter', () => {
	it('keeps the clear control outside the popover trigger button', () => {
		const onChange = vi.fn();
		const { container } = render(
			<TimeFilter
				value={{
					from: new Date('2026-08-01T10:00:00Z'),
					to: new Date('2026-08-01T11:00:00Z'),
					preset: 'custom',
				}}
				onChange={onChange}
			/>
		);

		expect(container.querySelectorAll('button button')).toHaveLength(0);
		expect(screen.getByRole('button', { name: 'Clear time filter' })).toBeInTheDocument();
	});

	it('clears the active range without opening the popover', () => {
		const onChange = vi.fn();
		render(
			<TimeFilter
				value={{
					from: new Date('2026-08-01T10:00:00Z'),
					to: new Date('2026-08-01T11:00:00Z'),
					preset: 'custom',
				}}
				onChange={onChange}
			/>
		);

		fireEvent.click(screen.getByRole('button', { name: 'Clear time filter' }));

		expect(onChange).toHaveBeenCalledWith({ from: null, to: null, preset: null });
		expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
	});
});
