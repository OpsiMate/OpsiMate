import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Alert } from '@OpsiMate/shared';
import { FlatGroupItem } from '@/components/Alerts/AlertsTable/AlertsTable.types';

type GroupItem = Extract<FlatGroupItem, { type: 'group' }>;
const alerts = [{ id: 'a' }, { id: 'b' }, { id: 'c' }] as Alert[];
import { GroupHeader } from '@/components/Alerts/AlertsTable/GroupHeader/GroupHeader';
import { StickyGroupHeader } from '@/components/Alerts/AlertsTable/StickyGroupHeader/StickyGroupHeader';

const makeGroup = (isExpanded: boolean): GroupItem => ({
	type: 'group',
	key: 'status:firing',
	field: 'status',
	value: 'firing',
	count: 3,
	level: 0,
	isExpanded,
	groupStatus: 'firing',
	members: alerts,
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

describe('GroupHeader with only some of the group loaded', () => {
	const partial: GroupItem = { ...makeGroup(false), count: 57, members: alerts.slice(0, 2) };

	it('shows loaded/total and names the loaded alerts as the checkbox scope', () => {
		render(
			<GroupHeader item={partial} onToggle={vi.fn()} columnLabels={{ status: 'Status' }} selectionState="all" />
		);
		expect(screen.getByText('2/57')).toBeInTheDocument();
		const checkbox = screen.getByRole('checkbox', {
			name: 'Unselect the 2 loaded alerts of group Status: firing (57 in total)',
		});
		expect(checkbox).toHaveAttribute(
			'title',
			"Only 2 of this group's 57 alerts are loaded; the checkbox only affects those."
		);
	});
});
