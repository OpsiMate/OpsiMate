import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { Alert } from '@OpsiMate/shared';
import { Virtualizer } from '@tanstack/react-virtual';
import { useAlertKeyboardNav } from '@/components/Alerts/AlertsTable/hooks/useAlertKeyboardNav';
import { FlatGroupItem } from '@/components/Alerts/AlertsTable/AlertsTable.types';

// Geometry (scroll pinning) is exercised in a real browser; what jsdom CAN pin down is
// the decision logic: which row a keypress selects, which guards swallow the event, and
// which table owns the keyboard when several are mounted (split-by-owner panes).

const alert = (id: string): Alert => ({ id }) as Alert;
const leaf = (id: string): FlatGroupItem => ({ type: 'leaf', alert: alert(id) });
const group = (key: string): FlatGroupItem =>
	({
		type: 'group',
		key,
		field: 'f',
		value: key,
		count: 1,
		level: 0,
		isExpanded: true,
		groupStatus: 'firing',
	}) as FlatGroupItem;

interface HookProps {
	activeAlertId: string | null;
}

interface HookSetup {
	onAlertClick: ReturnType<typeof vi.fn>;
	onSelectOnly: ReturnType<typeof vi.fn>;
	onExtendSelection: ReturnType<typeof vi.fn>;
	scrollToIndex: ReturnType<typeof vi.fn>;
	unmount: () => void;
	rerender: (next: HookProps) => void;
}

const setup = (rows: FlatGroupItem[], activeAlertId: string | null = null): HookSetup => {
	const onAlertClick = vi.fn();
	const onSelectOnly = vi.fn();
	const onExtendSelection = vi.fn();
	const scrollToIndex = vi.fn();
	const virtualizer = { scrollToIndex } as unknown as Virtualizer<HTMLDivElement, Element>;
	const scrollerRef = { current: document.createElement('div') };
	const view = renderHook(
		(props: HookProps) =>
			useAlertKeyboardNav({
				flatRows: rows,
				activeAlertId: props.activeAlertId,
				onAlertClick,
				onSelectOnly,
				onExtendSelection,
				virtualizer,
				scrollerRef,
			}),
		{ initialProps: { activeAlertId } }
	);
	return {
		onAlertClick,
		onSelectOnly,
		onExtendSelection,
		scrollToIndex,
		unmount: view.unmount,
		rerender: view.rerender,
	};
};

const press = (key: string, init: KeyboardEventInit = {}) =>
	act(() => {
		window.dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true, ...init }));
	});

afterEach(() => {
	document.body.innerHTML = '';
});

describe('useAlertKeyboardNav', () => {
	test('ArrowDown with nothing active selects the first alert row, skipping a leading group header', () => {
		const h = setup([group('g1'), leaf('a'), leaf('b')]);
		press('ArrowDown');
		expect(h.onAlertClick).toHaveBeenCalledTimes(1);
		expect(h.onAlertClick.mock.calls[0][0].id).toBe('a');
		// Scrolls to the flatRows index of the row, not its position among alerts only.
		expect(h.scrollToIndex).toHaveBeenCalledWith(1, { align: 'auto' });
		h.unmount();
	});

	test('ArrowUp with nothing active starts from the LAST row', () => {
		const h = setup([leaf('a'), leaf('b'), leaf('c')]);
		press('ArrowUp');
		expect(h.onAlertClick.mock.calls[0][0].id).toBe('c');
		h.unmount();
	});

	test('ArrowDown steps over group headers between alerts', () => {
		const h = setup([leaf('a'), group('g'), leaf('b')], 'a');
		press('ArrowDown');
		expect(h.onAlertClick.mock.calls[0][0].id).toBe('b');
		h.unmount();
	});

	test('a boundary press never re-clicks the active alert (onAlertClick toggles closed)', () => {
		const h = setup([leaf('a'), leaf('b')], 'a');
		press('ArrowUp');
		expect(h.onAlertClick).not.toHaveBeenCalled();
		h.unmount();
	});

	test('typing targets and Alt/Shift-modified arrows are left alone', () => {
		const h = setup([leaf('a'), leaf('b')]);
		const input = document.createElement('input');
		document.body.appendChild(input);
		act(() => {
			input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
		});
		press('ArrowDown', { altKey: true });
		press('ArrowDown', { shiftKey: true });
		expect(h.onAlertClick).not.toHaveBeenCalled();
		expect(h.onSelectOnly).not.toHaveBeenCalled();
		h.unmount();
	});

	test('the checkbox follows the cursor: a plain arrow selects just the row it lands on', () => {
		const h = setup([leaf('a'), leaf('b'), leaf('c')], 'a');
		press('ArrowDown');
		expect(h.onSelectOnly).toHaveBeenCalledTimes(1);
		expect(h.onSelectOnly.mock.calls[0][0].id).toBe('b');
		expect(h.onExtendSelection).not.toHaveBeenCalled();
		expect(h.onAlertClick.mock.calls[0][0].id).toBe('b');
		h.unmount();
	});

	test('Cmd/Ctrl+arrow adds the row to the selection instead, and still opens it', () => {
		const h = setup([leaf('a'), leaf('b'), leaf('c')], 'a');
		press('ArrowDown', { metaKey: true });
		h.rerender({ activeAlertId: 'b' });
		press('ArrowDown', { ctrlKey: true });
		expect(h.onExtendSelection.mock.calls.map((c) => c[0].id)).toEqual(['b', 'c']);
		expect(h.onSelectOnly).not.toHaveBeenCalled();
		expect(h.onAlertClick.mock.calls.map((c) => c[0].id)).toEqual(['b', 'c']);
		h.unmount();
	});

	test('Cmd/Ctrl+arrow hands over the row the cursor left, so backing up can un-select it', () => {
		const h = setup([leaf('a'), leaf('b'), leaf('c')], 'c');
		press('ArrowUp', { metaKey: true });
		expect(h.onExtendSelection).toHaveBeenCalledTimes(1);
		const [landedOn, leftBehind] = h.onExtendSelection.mock.calls[0];
		expect(landedOn.id).toBe('b');
		expect(leftBehind.id).toBe('c');
		h.unmount();
	});

	test('the first Cmd/Ctrl+arrow with nothing active has no row left behind', () => {
		const h = setup([leaf('a'), leaf('b')]);
		press('ArrowDown', { metaKey: true });
		expect(h.onExtendSelection.mock.calls[0][0].id).toBe('a');
		expect(h.onExtendSelection.mock.calls[0][1]).toBeNull();
		h.unmount();
	});

	test('a boundary press moves neither the cursor nor the checkbox', () => {
		const h = setup([leaf('a'), leaf('b')], 'b');
		press('ArrowDown');
		press('ArrowDown', { metaKey: true });
		expect(h.onSelectOnly).not.toHaveBeenCalled();
		expect(h.onExtendSelection).not.toHaveBeenCalled();
		expect(h.onAlertClick).not.toHaveBeenCalled();
		h.unmount();
	});

	test('arrows inside an overlay (dialog/menu) are left alone', () => {
		const h = setup([leaf('a'), leaf('b')]);
		const dialog = document.createElement('div');
		dialog.setAttribute('role', 'dialog');
		const button = document.createElement('button');
		dialog.appendChild(button);
		document.body.appendChild(dialog);
		act(() => {
			button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
		});
		expect(h.onAlertClick).not.toHaveBeenCalled();
		h.unmount();
	});

	test('with two mounted tables, the one holding the active alert owns the keyboard', () => {
		// Split-by-owner: pane A does not contain the active alert, pane B does. A naive
		// per-instance listener would move BOTH panes on one keypress.
		const paneA = setup([leaf('a1'), leaf('a2')], 'b1');
		const paneB = setup([leaf('b1'), leaf('b2')], 'b1');
		press('ArrowDown');
		expect(paneA.onAlertClick).not.toHaveBeenCalled();
		expect(paneB.onAlertClick).toHaveBeenCalledTimes(1);
		expect(paneB.onAlertClick.mock.calls[0][0].id).toBe('b2');
		paneA.unmount();
		paneB.unmount();
	});

	test('the window listener is gone after the last table unmounts', () => {
		const h = setup([leaf('a')]);
		h.unmount();
		press('ArrowDown');
		expect(h.onAlertClick).not.toHaveBeenCalled();
	});
});
