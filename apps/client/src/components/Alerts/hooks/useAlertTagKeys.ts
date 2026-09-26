import { useMemo } from 'react';
import { collectAlertTagKeys, AlertTagKeyInfo } from '@OpsiMate/shared';
import { Alert } from '@OpsiMate/shared';

export { extractTagKeyFromColumnId, getTagKeyColumnId, isTagKeyColumn } from '@/types';

export const useAlertTagKeys = (alerts: Alert[]): AlertTagKeyInfo[] => {
	return useMemo(() => collectAlertTagKeys(alerts), [alerts]);
};