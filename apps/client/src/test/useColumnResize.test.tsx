import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useColumnResize } from '@/components/Alerts/AlertsTable/hooks/useColumnResize';

// The gesture contract: live widths flow through local state while the mouse moves,
// the dashboard-facing callback fires exactly ONCE per gesture (on mouseup), values
// clamp to the column minimums, and double-click resets a column to automatic.

interface StartDragResult {
	headerCell: HTMLTableCellElement;
}

// A real <th> in the document, so startResize can measure a rendered width.
const mountHeaderCell = (width: number): StartDragResult => {
	const table = document.createElement('table');
	const row = document.createElement('tr');
	const headerCell = document.createElement('th');
	// jsdom has no layout: give getBoundingClientRect a real answer.
	headerCell.getBoundingClientRect = () =>
		({ width, height: 32, top: 0, left: 0, right: width, bottom: 32, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
	row.appendChild(headerCell);
	table.appendChild(row);
	document.body.appendChild(table);
	return { headerCell };
};

const mouseEventAt = (target: HTMLElement, clientX: number): React.MouseEvent =>
	({
		clientX,
		target,
		preventDefault: () => undefined,
		stopPropagation: () => undefined,
	}) as unknown as React.MouseEvent;

const documentMouse = (type: 'mousemove' | 'mouseup', clientX: number) => {
	document.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }));
};

afterEach(() => {
	document.body.innerHTML = '';
});

describe('useColumnResize', () => {
	test('drag commits once on mouseup with the moved width; live width tracks the pointer', () => {
		const onChange = vi.fn();
		const { headerCell } = mountHeaderCell(200);
		const { result } = renderHook(() => useColumnResize({ columnWidths: {}, onColumnWidthsChange: onChange }));

		act(() => {
			result.current.startResize('owner', mouseEventAt(headerCell, 500));
		});
		expect(result.current.resizingColumn).toBe('owner');

		act(() => {
			documentMouse('mousemove', 560);
		});
		expect(result.current.liveWidths.owner).toBe(260);
		expect(onChange).not.toHaveBeenCalled();

		act(() => {
			documentMouse('mouseup', 580);
		});
		expect(onChange).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith({ owner: 280 });
		expect(result.current.resizingColumn).toBeNull();
		expect(result.current.liveWidths).toEqual({});
	});

	test('widths clamp to the column minimum on the way down', () => {
		const onChange = vi.fn();
		const { headerCell } = mountHeaderCell(200);
		const { result } = renderHook(() => useColumnResize({ columnWidths: {}, onColumnWidthsChange: onChange }));

		act(() => {
			result.current.startResize('owner', mouseEventAt(headerCell, 500));
		});
		act(() => {
			documentMouse('mouseup', 0);
		});
		// COLUMN_MIN_WIDTHS.owner — dragging 500px left cannot go below it.
		const committed = onChange.mock.calls[0][0].owner;
		expect(committed).toBeGreaterThan(0);
		expect(committed).toBeLessThan(200);
		expect(onChange.mock.calls[0][0].owner).toBe(committed);
	});

	test('commit preserves other columns already in the saved map', () => {
		const onChange = vi.fn();
		const { headerCell } = mountHeaderCell(200);
		const { result } = renderHook(() =>
			useColumnResize({ columnWidths: { alertName: 300 }, onColumnWidthsChange: onChange })
		);

		act(() => {
			result.current.startResize('owner', mouseEventAt(headerCell, 500));
		});
		act(() => {
			documentMouse('mouseup', 550);
		});
		expect(onChange).toHaveBeenCalledWith({ alertName: 300, owner: 250 });
	});

	test('resetColumn removes only that column; a column with no manual width is a no-op', () => {
		const onChange = vi.fn();
		const { result } = renderHook(() =>
			useColumnResize({ columnWidths: { alertName: 300, owner: 250 }, onColumnWidthsChange: onChange })
		);

		act(() => {
			result.current.resetColumn('owner');
		});
		expect(onChange).toHaveBeenCalledWith({ alertName: 300 });

		onChange.mockClear();
		act(() => {
			result.current.resetColumn('summary');
		});
		expect(onChange).not.toHaveBeenCalled();
	});
});
