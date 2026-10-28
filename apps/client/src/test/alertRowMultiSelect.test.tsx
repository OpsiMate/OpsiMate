import { Alert } from '@OpsiMate/shared';
import { act, cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { AlertRow } from '@/components/Alerts/AlertsTable/AlertRow';
import { useAlertSelection } from '@/components/Alerts/AlertsTable/hooks/useAlertSelection';
import { useDragSelection } from '@/components/Alerts/AlertsTable/hooks/useDragSelection';

const makeAlert = (id: string) => ({ id, alertName: `alert ${id}`, tags: {} }) as unknown as Alert;
const alerts = ['a', 'b', 'c', 'd', 'e'].map(makeAlert);

// The hook against real selection state, the way AlertsTable's parent owns it.
const renderSelection = (initial: Alert[] = [], visibleAlerts = alerts) =>
	renderHook(() => {
		const [selected, setSelected] = useState<Alert[]>(initial);
		const selection = useAlertSelection({
			sortedAlerts: alerts,
			visibleAlerts,
			selectedAlerts: selected,
			onSelectAlerts: setSelected,
		});
		return { selectedIds: selected.map((a) => a.id).sort(), ...selection };
	});

afterEach(cleanup);

describe('useAlertSelection range select', () => {
	test('shift-click selects from the anchor down to the clicked row', () => {
		const { result } = renderSelection();
		act(() => result.current.handleSelectAlert(alerts[1]));
		act(() => result.current.handleSelectRange(alerts[3]));
		expect(result.current.selectedIds).toEqual(['b', 'c', 'd']);
	});

	test('works upwards too', () => {
		const { result } = renderSelection();
		act(() => result.current.handleSelectAlert(alerts[4]));
		act(() => result.current.handleSelectRange(alerts[2]));
		expect(result.current.selectedIds).toEqual(['c', 'd', 'e']);
	});

	test('adds to the existing selection instead of replacing it', () => {
		const { result } = renderSelection([alerts[0]]);
		act(() => result.current.handleSelectAlert(alerts[3]));
		act(() => result.current.handleSelectRange(alerts[4]));
		expect(result.current.selectedIds).toEqual(['a', 'd', 'e']);
	});

	test('without an anchor it falls back to a single toggle', () => {
		const { result } = renderSelection();
		act(() => result.current.handleSelectRange(alerts[2]));
		expect(result.current.selectedIds).toEqual(['c']);
	});

	test('the range skips rows not visible (collapsed groups)', () => {
		const visible = [alerts[0], alerts[3], alerts[4]];
		const { result } = renderSelection([], visible);
		act(() => result.current.handleSelectAlert(alerts[0]));
		act(() => result.current.handleSelectRange(alerts[4]));
		expect(result.current.selectedIds).toEqual(['a', 'd', 'e']);
	});
});

describe('useDragSelection from a Cmd/Ctrl-pressed row', () => {
	const renderDrag = () =>
		renderHook(() => {
			const [selected, setSelected] = useState<Alert[]>([]);
			const drag = useDragSelection({ selectedAlerts: selected, onSelectAlerts: setSelected });
			return { selectedIds: selected.map((a) => a.id).sort(), ...drag };
		});
	const press = { preventDefault: () => {} } as React.MouseEvent;

	test('press and drag over rows selects all of them', () => {
		const { result } = renderDrag();
		act(() => result.current.handleDragStart(alerts[0], press));
		act(() => result.current.handleDragEnter(alerts[1]));
		act(() => result.current.handleDragEnter(alerts[2]));
		act(() => result.current.handleDragEnd());
		expect(result.current.selectedIds).toEqual(['a', 'b', 'c']);
	});

	test('press and release in place toggles just that row', () => {
		const { result } = renderDrag();
		const toggle = vi.fn();
		act(() => result.current.handleDragStart(alerts[3], press));
		act(() => result.current.handleDragEnd(toggle));
		expect(toggle).toHaveBeenCalledWith(alerts[3]);
		expect(result.current.selectedIds).toEqual([]);
	});
});

const renderRow = ({ withDrag = true } = {}) => {
	const props = {
		onSelectAlert: vi.fn(),
		onSelectRange: vi.fn(),
		onAlertClick: vi.fn(),
		onSelectAlerts: vi.fn(),
		onDragStart: withDrag ? vi.fn() : undefined,
	};
	const { container } = render(
		<table>
			<tbody>
				<AlertRow alert={alerts[0]} isSelected={false} orderedColumns={[]} {...props} />
			</tbody>
		</table>
	);
	return {
		row: container.querySelector('tr') as HTMLTableRowElement,
		checkboxCell: container.querySelector('td') as HTMLTableCellElement,
		...props,
	};
};

describe('AlertRow modifier clicks', () => {
	test('a plain click opens the details panel', () => {
		const { row, onAlertClick, onSelectAlert, onDragStart } = renderRow();
		fireEvent.mouseDown(row);
		fireEvent.click(row);
		expect(onAlertClick).toHaveBeenCalledWith(alerts[0]);
		expect(onSelectAlert).not.toHaveBeenCalled();
		expect(onDragStart).not.toHaveBeenCalled();
	});

	test.each([{ metaKey: true }, { ctrlKey: true }])('%o + press on a row starts drag selection', (modifier) => {
		const { row, onAlertClick, onSelectAlert, onDragStart } = renderRow();
		fireEvent.mouseDown(row, modifier);
		fireEvent.click(row, modifier);
		expect(onDragStart).toHaveBeenCalledTimes(1);
		expect(onDragStart.mock.calls[0][0]).toBe(alerts[0]);
		// The drag hook toggles on mouseup; the click must not toggle a second time.
		expect(onSelectAlert).not.toHaveBeenCalled();
		expect(onAlertClick).not.toHaveBeenCalled();
	});

	test.each([{ metaKey: true }, { ctrlKey: true }])(
		'without a drag hook, %o + click toggles directly',
		(modifier) => {
			const { row, onAlertClick, onSelectAlert } = renderRow({ withDrag: false });
			fireEvent.click(row, modifier);
			expect(onSelectAlert).toHaveBeenCalledWith(alerts[0]);
			expect(onAlertClick).not.toHaveBeenCalled();
		}
	);
});

describe('AlertRow right-click and checkbox presses', () => {
	test('macOS Ctrl+click (a contextmenu event) suppresses the menu and leaves the toggle to the drag', () => {
		const { row, onSelectAlert, onDragStart } = renderRow();
		fireEvent.mouseDown(row, { ctrlKey: true });
		expect(fireEvent.contextMenu(row, { ctrlKey: true, button: 0 })).toBe(false);
		expect(onDragStart).toHaveBeenCalledTimes(1);
		expect(onSelectAlert).not.toHaveBeenCalled();
	});

	test('a real right-click keeps its context menu and selects nothing', () => {
		const { row, onSelectAlert, onDragStart } = renderRow();
		fireEvent.mouseDown(row, { button: 2, ctrlKey: true });
		expect(fireEvent.contextMenu(row, { button: 2 })).toBe(true);
		expect(fireEvent.contextMenu(row, { ctrlKey: true, button: 2 })).toBe(true);
		expect(onSelectAlert).not.toHaveBeenCalled();
		expect(onDragStart).not.toHaveBeenCalled();
	});

	test('Cmd+press on the checkbox starts one drag, not two', () => {
		const { checkboxCell, onDragStart } = renderRow();
		fireEvent.mouseDown(checkboxCell, { metaKey: true });
		expect(onDragStart).toHaveBeenCalledTimes(1);
	});

	test('shift + click selects a range only', () => {
		const { row, onAlertClick, onSelectRange } = renderRow();
		fireEvent.click(row, { shiftKey: true });
		expect(onSelectRange).toHaveBeenCalledWith(alerts[0]);
		expect(onAlertClick).not.toHaveBeenCalled();
	});
});
