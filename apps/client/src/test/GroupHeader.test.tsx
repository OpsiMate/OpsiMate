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
	members: [],
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

describe.each([
	['GroupHeader', GroupHeader],
	['StickyGroupHeader', StickyGroupHeader],
])('%s checkbox', (_name, Component) => {
	const labels = { status: 'Status' };

	it('is absent when the table has no selection', () => {
		render(<Component item={makeGroup(false)} onToggle={vi.fn()} columnLabels={labels} />);
		expect(screen.queryByRole('checkbox')).toBeNull();
	});

	it('reflects none / some / all of the group being selected, and names the group', () => {
		const { rerender } = render(
			<Component item={makeGroup(false)} onToggle={vi.fn()} columnLabels={labels} selectionState="none" />
		);
		expect(screen.getByRole('checkbox', { name: 'Select the alerts of group Status: firing' })).toHaveAttribute(
			'data-state',
			'unchecked'
		);
		rerender(<Component item={makeGroup(false)} onToggle={vi.fn()} columnLabels={labels} selectionState="some" />);
		expect(screen.getByRole('checkbox')).toHaveAttribute('data-state', 'indeterminate');
		rerender(<Component item={makeGroup(false)} onToggle={vi.fn()} columnLabels={labels} selectionState="all" />);
		expect(screen.getByRole('checkbox', { name: 'Unselect the alerts of group Status: firing' })).toHaveAttribute(
			'data-state',
			'checked'
		);
	});

	it('toggles the selection without expanding or collapsing the group', () => {
		const onToggle = vi.fn();
		const onToggleSelection = vi.fn();
		render(
			<Component
				item={makeGroup(false)}
				onToggle={onToggle}
				columnLabels={labels}
				selectionState="none"
				onToggleSelection={onToggleSelection}
			/>
		);
		fireEvent.click(screen.getByRole('checkbox'));
		expect(onToggleSelection).toHaveBeenCalledTimes(1);
		expect(onToggle).not.toHaveBeenCalled();
	});
});
