import type { Alert } from '@OpsiMate/shared';

type Dict = Record<string, unknown>;

export const getAlertServiceId = (a: Alert): number | undefined => {
	const rec = a as unknown as Dict;
	const sid = rec.serviceId;
	if (typeof sid === 'number') return sid as number;

	const parts = a.id.split(':');
	const n = Number(parts[1]);
	return Number.isFinite(n) ? n : undefined;
};
