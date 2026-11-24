// Regions that keep the selection when clicked: the table's rows (alert, folder, group and
// header rows — not the table's empty background), the details and incident panels, the
// selection bar, the drop tray. Marked with this attribute.
export const SELECTION_SCOPE_ATTR = 'data-selection-scope';
export const SELECTION_SCOPE_SELECTOR = `[${SELECTION_SCOPE_ATTR}]`;
// Overlays that render in portals (menus, dialogs, popovers, toasts) and interactive
// controls anywhere on the page: clicking them acts on something, it is not "clicking away".
export const KEEP_SELECTION_SELECTOR = [
	'[data-radix-popper-content-wrapper]',
	'[role="dialog"]',
	'[role="alertdialog"]',
	'[role="menu"]',
	'[role="listbox"]',
	'[role="combobox"]',
	'[role="status"]',
	'button',
	'a',
	'input',
	'textarea',
	'select',
	'label',
	'[role="checkbox"]',
	'[role="tab"]',
	'[contenteditable]:not([contenteditable="false"])',
].join(', ');
