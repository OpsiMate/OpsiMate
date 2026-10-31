import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FlatGroupItem } from '@/components/Alerts/AlertsTable/AlertsTable.types';
import { GroupHeader } from '@/components/Alerts/AlertsTable/GroupHeader/GroupHeader';
import { StickyGroupHeader } from '@/components/Alerts/AlertsTable/StickyGroupHeader/StickyGroupHeader';

const makeGroup = (isExpanded: boolean): FlatGroupItem => ({
	type: 'group',
	key: 'status:firing',
	field: 'status',
	value: 'firing',
	count: 3,
	level: 0,
	isExpanded,
	groupStatus: 'firing',
});

describe.each([
	['GroupHeader', GroupHeader],
	['StickyGroupHeader', StickyGroupHeader],
])('%s chevron button', (_name, Component) => {
	it('is labelled and reports aria-expanded="false" when collapsed', () => {
		render(<Component item={makeGroup(false)} onToggle={vi.fn()} columnLabels={{ status: 'Status' }} />);
		const button = screen.getByRole('button', { name: 'Expand group Status: firing' });
		expect(button).toHaveAttribute('aria-expanded', 'false');
	});

	it('reports aria-expanded="true" when expanded', () => {
		render(<Component item={makeGroup(true)} onToggle={vi.fn()} columnLabels={{ status: 'Status' }} />);
		const button = screen.getByRole('button', { name: 'Collapse group Status: firing' });
		expect(button).toHaveAttribute('aria-expanded', 'true');
	});

	it('calls onToggle once with the group key when clicked', () => {
		const onToggle = vi.fn();
		render(<Component item={makeGroup(false)} onToggle={onToggle} columnLabels={{ status: 'Status' }} />);
		fireEvent.click(screen.getByRole('button'));
		expect(onToggle).toHaveBeenCalledTimes(1);
		expect(onToggle).toHaveBeenCalledWith('status:firing');
	});
});
