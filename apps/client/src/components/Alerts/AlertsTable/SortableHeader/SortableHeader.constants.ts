// Must stay in sync with the header whitelist in AlertsTable.tsx and AlertRow's column
// switch — a base column missing here renders a header whose sort click silently no-ops.
export const BASE_SORT_FIELDS = [
	'alertName',
	'severity',
	'fix',
	'status',
	'startsAt',
	'updatedAt',
	'summary',
	'lastComment',
	'type',
	'owner',
] as const;
