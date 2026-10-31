export const SELECT_COLUMN_WIDTH = '40px';
export const CELL_PADDING = 'py-1 px-2';
// Controls inside a row that keep their own Cmd/Ctrl+click instead of starting row selection.
export const ROW_INTERACTIVE_CONTROL_SELECTOR = 'button, a, input, textarea, [role="menuitem"]';
// The checkbox cell (marked data-select-cell): its own mousedown handles the press, so the row's skips it.
export const SELECT_CELL_SELECTOR = '[data-select-cell]';
