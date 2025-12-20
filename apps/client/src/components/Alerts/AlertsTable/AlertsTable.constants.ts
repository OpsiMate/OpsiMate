export const ACTIONS_COLUMN = 'actions';

export const SELECT_COLUMN_WIDTH = '40px';
export const ACTIONS_COLUMN_WIDTH = '56px';
export const TABLE_HEAD_CLASSES = 'h-8 py-1 px-2';

export const DEFAULT_VISIBLE_COLUMNS = ['type', 'alertName', 'status', 'summary', 'owner', 'startsAt'];

export const DEFAULT_COLUMN_ORDER = ['type', 'alertName', 'status', 'summary', 'owner', 'startsAt'];

export const COLUMN_LABELS: Record<string, string> = {
	type: 'Type',
	alertName: 'Alert Name',
	status: 'Status',
	summary: 'Summary',
	owner: 'Owner',
	startsAt: 'Started At',
};

export const COLUMN_WIDTHS: Record<string, string> = {
	select: 'w-10 min-w-10 max-w-10',
	type: 'w-[10%]',
	alertName: 'w-[20%]',
	status: 'w-[10%]',
	summary: 'w-auto',
	owner: 'w-[12%]',
	startsAt: 'w-[15%]',
	[ACTIONS_COLUMN]: 'w-14 min-w-14 max-w-14',
	default: 'w-[10%]',
};
