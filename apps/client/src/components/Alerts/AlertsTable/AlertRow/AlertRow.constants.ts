export const SELECT_COLUMN_WIDTH = '40px';
export const CELL_PADDING = 'py-1 px-2';
// Controls inside a row that keep their own Cmd/Ctrl+click instead of starting row selection.
export const ROW_INTERACTIVE_CONTROL_SELECTOR = 'button, a, input, textarea, [role="menuitem"]';
// The checkbox cell (marked data-select-cell): its own mousedown handles the press, so the row's skips it.
export const SELECT_CELL_SELECTOR = '[data-select-cell]';
// A cell's full underlying value for copying (the display text may be truncated or
// reformatted); cells without it copy their text.
export const COPY_VALUE_ATTR = 'data-copy-value';
// The right-click menu on a row: copy what was clicked, or the alert's headline fields.
export const CELL_COPY_LABELS = {
	value: 'Copy value',
	alertName: 'Copy alert name',
	summary: 'Copy summary',
	copied: (what: string) => `${what} copied`,
};
// How much of the value the menu item previews.
export const COPY_PREVIEW_MAX_CHARS = 40;
