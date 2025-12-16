export const DEFAULT_VISIBLE_COLUMNS = ['type', 'alertName', 'status', 'summary', 'owner', 'startsAt', 'actions'];

export const DEFAULT_COLUMN_ORDER = ['type', 'alertName', 'status', 'summary', 'owner', 'startsAt', 'actions'];

export const COLUMN_LABELS: Record<string, string> = {
	type: 'Type',
	alertName: 'Alert Name',
	status: 'Status',
	summary: 'Summary',
	owner: 'Owner',
	startsAt: 'Started At',
	actions: '',
};

export const COLUMN_WIDTHS: Record<string, string> = {
	select: 'w-10',
	type: 'w-[10%]',
	alertName: 'w-[20%]',
	status: 'w-[10%]',
	summary: 'w-auto',
	owner: 'w-[12%]',
	startsAt: 'w-[15%]',
	actions: 'w-20',
	// Default for tag keys
	default: 'w-[10%]',
};
