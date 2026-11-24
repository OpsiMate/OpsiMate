// The right-click menu on a row: copy what was clicked, or the alert's headline fields.
export const CELL_COPY_LABELS = {
	value: 'Copy value',
	alertName: 'Copy alert name',
	summary: 'Copy summary',
};
// What the "Copied!" toast names.
export const COPY_SUBJECTS = {
	alertName: 'Alert name',
	summary: 'Summary',
	copied: (what: string) => `${what} copied`,
};
// How much of the value the menu item previews.
export const COPY_PREVIEW_MAX_CHARS = 40;
