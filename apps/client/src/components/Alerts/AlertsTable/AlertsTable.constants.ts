export const ACTIONS_COLUMN = 'actions';

export const SELECT_COLUMN_WIDTH = '40px';
export const ACTIONS_COLUMN_WIDTH = '80px';
export const TABLE_HEAD_CLASSES = 'h-8 py-1 px-2';

export const DEFAULT_VISIBLE_COLUMNS = ['type', 'severity', 'status', 'alertName', 'summary', 'owner', 'startsAt'];

export const DEFAULT_COLUMN_ORDER = ['type', 'severity', 'status', 'alertName', 'summary', 'owner', 'startsAt'];

export const COLUMN_LABELS: Record<string, string> = {
	type: 'Type',
	alertName: 'Alert Name',
	severity: 'Severity',
	status: 'Status',
	summary: 'Summary',
	owner: 'Owner',
	startsAt: 'Started At',
};

// Every column except alertName and summary has a fixed width; those two share the
// leftover space equally (the table is layout-fixed). Percentage widths are deliberately
// avoided: with enough columns visible their sum exceeded the table's width and the
// auto-width summary column silently collapsed to 0px, letting neighbors paint over it.
export const COLUMN_WIDTHS: Record<string, string> = {
	select: 'w-10 min-w-10 max-w-10',
	// Type, severity and status are icon-only columns (icon-only headers too, names in
	// tooltips).
	type: 'w-12 min-w-12 max-w-12',
	alertName: 'w-auto',
	severity: 'w-12 min-w-12 max-w-12',
	status: 'w-12 min-w-12 max-w-12',
	summary: 'w-auto',
	owner: 'w-[120px]',
	startsAt: 'w-[150px]',
	[ACTIONS_COLUMN]: 'w-14 min-w-14 max-w-14',
	default: 'w-[110px]',
};

// Per-column minimums (px) summed into the table's floor width: the table never renders
// narrower than its visible columns' minimums — below that the whole table (header and
// body together) scrolls horizontally instead of crushing a column.
export const COLUMN_MIN_WIDTHS: Record<string, number> = {
	select: 40,
	type: 48,
	severity: 48,
	status: 48,
	// The two flexible (w-auto) columns split leftover space equally, so they share
	// one minimum — declaring different ones would be unenforceable.
	alertName: 170,
	summary: 170,
	owner: 120,
	startsAt: 150,
	// Rendered at ACTIONS_COLUMN_WIDTH (inline style), not COLUMN_WIDTHS.
	[ACTIONS_COLUMN]: 80,
	default: 110,
};
