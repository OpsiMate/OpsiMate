export const ACTIONS_COLUMN = 'actions';

export const SELECT_COLUMN_WIDTH = '40px';
// Sized for the group-by header button: 28px + 16px cell padding. When the
// column-settings button is also shown the header needs a second button, so the table
// switches to the wider constant — with only 44px the buttons overflow the fixed <th>
// and sit on top of the neighboring column's header text.
export const ACTIONS_COLUMN_WIDTH = '44px';
export const ACTIONS_COLUMN_WIDTH_WITH_SETTINGS = '80px';
export const TABLE_HEAD_CLASSES = 'h-8 py-1 px-2';

export const DEFAULT_VISIBLE_COLUMNS = ['type', 'severity', 'status', 'alertName', 'summary', 'owner', 'startsAt'];

export const DEFAULT_COLUMN_ORDER = [
	'type',
	'severity',
	'status',
	'alertName',
	'summary',
	'owner',
	'startsAt',
	'updatedAt',
];

export const COLUMN_LABELS: Record<string, string> = {
	type: 'Type',
	alertName: 'Alert Name',
	severity: 'Severity',
	status: 'Status',
	summary: 'Summary',
	owner: 'Owner',
	startsAt: 'Started At',
	updatedAt: 'Last Update',
};

// Every column except summary has a fixed width; summary alone absorbs the leftover
// space (the table is layout-fixed). Exactly ONE flexible column, on purpose: with two
// w-auto columns the leftover was split equally, so on wide screens the name column
// ballooned with whitespace while summary — the column with the long content — couldn't
// use it. When summary is hidden, an empty filler column (rendered before ACTIONS in
// both the header and the rows) takes the flexible role, so the leftover stays as blank
// space instead of inflating a data column. Percentage widths are deliberately avoided:
// with enough columns visible their sum exceeded the table's width and the auto-width
// summary column silently collapsed to 0px, letting neighbors paint over it.
export const COLUMN_WIDTHS: Record<string, string> = {
	select: 'w-10 min-w-10 max-w-10',
	// Type, severity and status are icon-only columns (icon-only headers too, names in
	// tooltips).
	type: 'w-12 min-w-12 max-w-12',
	alertName: 'w-[240px]',
	severity: 'w-12 min-w-12 max-w-12',
	status: 'w-12 min-w-12 max-w-12',
	summary: 'w-auto',
	owner: 'w-[120px]',
	startsAt: 'w-[150px]',
	updatedAt: 'w-[150px]',
	[ACTIONS_COLUMN]: 'w-14 min-w-14 max-w-14',
	default: 'w-[150px]',
};

// Per-column minimums (px) summed into the table's floor width: the table never renders
// narrower than its visible columns' minimums — below that the whole table (header and
// body together) scrolls horizontally instead of crushing a column.
export const COLUMN_MIN_WIDTHS: Record<string, number> = {
	select: 40,
	type: 48,
	severity: 48,
	status: 48,
	// Shrink floor; the rendered width is content-aware (useContentColumnWidths).
	alertName: 170,
	summary: 170,
	owner: 120,
	startsAt: 150,
	updatedAt: 150,
	// Rendered at ACTIONS_COLUMN_WIDTH (inline style), not COLUMN_WIDTHS.
	[ACTIONS_COLUMN]: 80,
	default: 110,
};
