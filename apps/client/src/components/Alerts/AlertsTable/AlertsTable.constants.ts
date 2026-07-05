export const ACTIONS_COLUMN = 'actions';

export const SELECT_COLUMN_WIDTH = '40px';
export const ACTIONS_COLUMN_WIDTH = '80px';
export const TABLE_HEAD_CLASSES = 'h-8 py-1 px-2';

export const DEFAULT_VISIBLE_COLUMNS = ['type', 'severity', 'alertName', 'status', 'summary', 'owner', 'startsAt'];

export const DEFAULT_COLUMN_ORDER = ['type', 'severity', 'alertName', 'status', 'summary', 'owner', 'startsAt'];

export const COLUMN_LABELS: Record<string, string> = {
	type: 'Type',
	alertName: 'Alert Name',
	severity: 'Severity',
	status: 'Status',
	summary: 'Summary',
	owner: 'Owner',
	startsAt: 'Started At',
};

export const COLUMN_WIDTHS: Record<string, string> = {
	select: 'w-10 min-w-10 max-w-10',
	// Type and severity are icon-only columns (icon-only headers too, names in tooltips).
	type: 'w-12 min-w-12 max-w-12',
	alertName: 'w-[24%]',
	severity: 'w-12 min-w-12 max-w-12',
	status: 'w-[10%]',
	summary: 'w-auto',
	owner: 'w-[12%]',
	startsAt: 'w-[15%]',
	[ACTIONS_COLUMN]: 'w-14 min-w-14 max-w-14',
	default: 'w-[10%]',
};
