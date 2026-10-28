import { ROW_INTERACTIVE_CONTROL_SELECTOR } from './AlertRow.constants';

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
