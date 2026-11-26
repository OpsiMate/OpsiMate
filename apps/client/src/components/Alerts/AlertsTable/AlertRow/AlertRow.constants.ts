export const SELECT_COLUMN_WIDTH = '40px';
export const CELL_PADDING = 'py-1 px-2';
// Controls inside a row that keep their own Cmd/Ctrl+click instead of starting row selection.
export const ROW_INTERACTIVE_CONTROL_SELECTOR = 'button, a, input, textarea, [role="menuitem"]';
// The checkbox cell (marked data-select-cell): its own mousedown handles the press, so the row's skips it.
export const SELECT_CELL_SELECTOR = '[data-select-cell]';
// A cell's full underlying value for copying (the display text may be truncated or
// reformatted); cells without it copy their text.
export const COPY_VALUE_ATTR = 'data-copy-value';
// Full-row tint for a silenced alert, so that when the toolbar's Silenced toggle lets them
// into the table they read as "set aside" at a glance instead of blending in with firing
// rows. Violet is used by nothing else in the table (severity tints are red, amber and sky;
// muted is amber), and opacity-based so it works in both themes. Layered above the severity
// tint and below selection and the active row, which still win.
export const SILENCED_ROW_CLASSES = 'bg-violet-500/10 hover:bg-violet-500/20';
