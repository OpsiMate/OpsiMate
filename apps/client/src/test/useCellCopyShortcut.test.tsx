import { fireEvent, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import {
	browserOwnsCopy,
	isCopyShortcut,
	useCellCopyShortcut,
} from '@/components/Alerts/AlertsTable/hooks/useCellCopyShortcut';

// Click a cell, press Cmd/Ctrl+C, the cell is copied — the selection-free copy for a
// table whose rows drag when you drag across their text.

const writeText = vi.fn().mockResolvedValue(undefined);

const mount = () => {
	document.body.innerHTML = `
		<div id="scroller"><table><tbody><tr>
			<td data-select-cell>☐</td>
			<td data-copy-value="2026-11-04T10:44:48.000Z"><span>10:44:48</span></td>
			<td><span>Idan QA</span></td>
			<td data-copy-value="">-</td>
		</tr></tbody></table></div>
		<div id="outside"><input id="field" /><p>panel text</p></div>`;
	const scroller = document.getElementById('scroller') as HTMLDivElement;
	renderHook(() => useCellCopyShortcut({ scrollerRef: { current: scroller } }));
	const cells = scroller.querySelectorAll('td');
	return { cells, outside: document.getElementById('outside')!, field: document.getElementById('field')! };
};
const pressCopy = (target: Element | Document = document, init: KeyboardEventInit = { key: 'c', metaKey: true }) =>
	fireEvent.keyDown(target, init);

describe('useCellCopyShortcut', () => {
	beforeEach(() => {
		writeText.mockClear();
		Object.assign(navigator, { clipboard: { writeText } });
	});
	afterEach(() => {
		document.body.innerHTML = '';
	});

	test('copies the last pressed cell — its full value, or its text — on Cmd+C and Ctrl+C', async () => {
		const { cells } = mount();
		fireEvent.mouseDown(cells[1].firstElementChild!);
		pressCopy();
		await waitFor(() => expect(writeText).toHaveBeenCalledWith('2026-11-04T10:44:48.000Z'));
		fireEvent.mouseDown(cells[2]);
		pressCopy(document, { key: 'c', ctrlKey: true });
		await waitFor(() => expect(writeText).toHaveBeenCalledWith('Idan QA'));
	});

	test('nothing to copy: no press yet, the checkbox or a placeholder cell, or a press outside the table since', async () => {
		const { cells, outside } = mount();
		pressCopy();
		fireEvent.mouseDown(cells[0]);
		pressCopy();
		fireEvent.mouseDown(cells[3]);
		pressCopy();
		fireEvent.mouseDown(cells[2]);
		fireEvent.mouseDown(outside);
		pressCopy();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(writeText).not.toHaveBeenCalled();
	});

	test('leaves the shortcut to the browser in a field or with text highlighted', async () => {
		const { cells, field } = mount();
		fireEvent.mouseDown(cells[2]);
		pressCopy(field);
		const selection = vi.spyOn(window, 'getSelection').mockReturnValue({ toString: () => 'panel' } as Selection);
		pressCopy();
		selection.mockRestore();
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(writeText).not.toHaveBeenCalled();
	});
});

describe('isCopyShortcut / browserOwnsCopy', () => {
	const key = (init: Partial<KeyboardEvent>) =>
		({ key: 'c', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...init }) as KeyboardEvent;

	test('Cmd+C and Ctrl+C only — not with Shift or Alt, not other keys', () => {
		expect(isCopyShortcut(key({ metaKey: true }))).toBe(true);
		expect(isCopyShortcut(key({ ctrlKey: true, key: 'C' }))).toBe(true);
		expect(isCopyShortcut(key({ metaKey: true, shiftKey: true }))).toBe(false);
		expect(isCopyShortcut(key({ ctrlKey: true, altKey: true }))).toBe(false);
		expect(isCopyShortcut(key({ metaKey: true, key: 'v' }))).toBe(false);
		expect(isCopyShortcut(key({}))).toBe(false);
	});

	test('the browser owns copy inside editable fields', () => {
		document.body.innerHTML =
			'<textarea id="t"></textarea><div contenteditable="true" id="e"></div><div contenteditable="plaintext-only" id="p"></div><div contenteditable="false" id="f"></div><div id="d"></div>';
		expect(browserOwnsCopy(document.getElementById('t'))).toBe(true);
		expect(browserOwnsCopy(document.getElementById('e'))).toBe(true);
		expect(browserOwnsCopy(document.getElementById('p'))).toBe(true);
		expect(browserOwnsCopy(document.getElementById('f'))).toBe(false);
		expect(browserOwnsCopy(document.getElementById('d'))).toBe(false);
		expect(browserOwnsCopy(null)).toBe(false);
	});
});
