import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { isClickAway, useClickAwayDeselect } from '@/components/Alerts/hooks/useClickAwayDeselect';

// A press on empty space clears the selection; presses on the table, the panels, any
// control or any overlay do not.

const mount = () => {
	document.body.innerHTML = `
		<div id="empty">page background</div>
		<div id="table" data-selection-scope><span id="in-table">row</span></div>
		<div id="panel" data-selection-scope><p id="in-panel">details</p></div>
		<button id="toolbar-button">Filter</button>
		<div data-radix-popper-content-wrapper><div id="in-popover">menu item</div></div>
		<div role="dialog"><p id="in-dialog">dialog text</p></div>
		<ol><li role="status" id="toast">Copied!</li></ol>`;
	const byId = (id: string) => document.getElementById(id)!;
	return { byId };
};

afterEach(() => {
	document.body.innerHTML = '';
});

describe('isClickAway', () => {
	test('empty space is away; scoped regions, controls and overlays are not', () => {
		const { byId } = mount();
		expect(isClickAway(byId('empty'))).toBe(true);
		expect(isClickAway(document.body)).toBe(true);
		expect(isClickAway(byId('in-table'))).toBe(false);
		expect(isClickAway(byId('in-panel'))).toBe(false);
		expect(isClickAway(byId('toolbar-button'))).toBe(false);
		expect(isClickAway(byId('in-popover'))).toBe(false);
		expect(isClickAway(byId('in-dialog'))).toBe(false);
		expect(isClickAway(byId('toast'))).toBe(false);
		expect(isClickAway(null)).toBe(false);
		// Unmounted by the press itself (React can remove a menu item on mousedown).
		const detached = document.createElement('div');
		expect(isClickAway(detached)).toBe(false);
	});
});

describe('useClickAwayDeselect', () => {
	test('fires on a primary press on empty space while active, and only then', () => {
		const { byId } = mount();
		const onClickAway = vi.fn();
		const { rerender } = renderHook(
			(props: { active: boolean }) => useClickAwayDeselect({ ...props, onClickAway }),
			{
				initialProps: { active: true },
			}
		);
		fireEvent.mouseDown(byId('in-table'));
		fireEvent.mouseDown(byId('toolbar-button'));
		fireEvent.mouseDown(byId('empty'), { button: 2 });
		expect(onClickAway).not.toHaveBeenCalled();
		fireEvent.mouseDown(byId('empty'));
		expect(onClickAway).toHaveBeenCalledTimes(1);
		rerender({ active: false });
		fireEvent.mouseDown(byId('empty'));
		expect(onClickAway).toHaveBeenCalledTimes(1);
	});
});
