import { Alert, AlertTagKeyInfo, collectAlertTagKeys } from '@OpsiMate/shared';
import { useMemo } from 'react';
export { extractTagKeyFromColumnId, getTagKeyColumnId, isTagKeyColumn } from '@/types';
export type { AlertTagKeyInfo as TagKeyInfo };

export const useAlertTagKeys = (alerts: Alert[]): AlertTagKeyInfo[] => {
	return useMemo(() => collectAlertTagKeys(alerts), [alerts]);
};
