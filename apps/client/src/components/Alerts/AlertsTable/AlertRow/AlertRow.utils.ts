import { COPY_VALUE_ATTR, ROW_INTERACTIVE_CONTROL_SELECTOR, SELECT_CELL_SELECTOR } from './AlertRow.constants';

// Selection modifiers. Cmd is the Mac convention; Ctrl works there too (see AlertRow's handleRowContextMenu).
export const isToggleModifier = (e: Pick<React.MouseEvent, 'metaKey' | 'ctrlKey'>) => e.metaKey || e.ctrlKey;

// A left-button press. Firefox on macOS reports Ctrl+left-click as button 2, but the
// held-buttons mask still says primary (bit 1); a real right-click holds only bit 2.
export const isPrimaryPress = (e: Pick<React.MouseEvent, 'button' | 'buttons' | 'ctrlKey'>) =>
	e.button === 0 || (e.ctrlKey && (e.buttons & 1) === 1);

// Events the row's selection handling must leave alone: those from portaled children (the
// owner picker's popover, the actions menu — React bubbles them through the row although
// they render elsewhere in the DOM), and presses on a control inside the row, which keeps
// its own modifier-click behavior.
export const isForeignTarget = (e: Pick<React.MouseEvent, 'currentTarget' | 'target'>) =>
	!e.currentTarget.contains(e.target as Node) || !!(e.target as Element).closest?.(ROW_INTERACTIVE_CONTROL_SELECTOR);

// A press on the checkbox cell, which its own mousedown handler takes care of.
export const isSelectCellTarget = (e: Pick<React.MouseEvent, 'target'>) =>
	!!(e.target as Element).closest?.(SELECT_CELL_SELECTOR);

// What a right-click on the row would copy: the clicked cell's full value, else its text.
// Nothing for the checkbox cell, cells with no text (icons, actions), or a click that did
// not land in a cell.
export const copyValueOf = (target: EventTarget | null): string | null => {
	const cell = (target as Element | null)?.closest?.('td');
	if (!cell || cell.matches(SELECT_CELL_SELECTOR)) return null;
	const value = cell.getAttribute(COPY_VALUE_ATTR) ?? cell.textContent ?? '';
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
};

// A one-line preview of a value for a menu item.
export const previewValue = (value: string, max: number): string => {
	const oneLine = value.replace(/\s+/g, ' ').trim();
	return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
};
