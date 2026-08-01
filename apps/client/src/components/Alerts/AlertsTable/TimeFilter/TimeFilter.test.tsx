import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/test-utils';
import { TimeFilter } from './TimeFilter';

const presetValue = { from: null, to: null, preset: 'today' as const };

describe('TimeFilter', () => {
	it('renders the clear control without nesting a <button> inside the trigger <button>', () => {
		const { container } = render(<TimeFilter value={presetValue} onChange={vi.fn()} />);

		// Invalid HTML nesting (button inside button) is what React 19 flags as a
		// hydration error — the clear control must not be a real <button>.
		expect(container.querySelectorAll('button button')).toHaveLength(0);

		const clear = screen.getByRole('button', { name: /clear filter/i });
		expect(clear.tagName).toBe('SPAN');
	});

	it('clears the range when the clear control is clicked', () => {
		const onChange = vi.fn();
		render(<TimeFilter value={presetValue} onChange={onChange} />);

		fireEvent.click(screen.getByRole('button', { name: /clear filter/i }));

		expect(onChange).toHaveBeenCalledWith({ from: null, to: null, preset: null });
	});

	it('clears the range when the clear control is activated from the keyboard', () => {
		const onChange = vi.fn();
		render(<TimeFilter value={presetValue} onChange={onChange} />);

		fireEvent.keyDown(screen.getByRole('button', { name: /clear filter/i }), { key: 'Enter' });

		expect(onChange).toHaveBeenCalledWith({ from: null, to: null, preset: null });
	});
});
