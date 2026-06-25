import { useEffect, useState } from 'react';
import { alertsApi } from '@/lib/api';
import { AlertHistory, Logger } from '@OpsiMate/shared';

const logger = new Logger('useAlertHistory');

// `version` is an opaque value that changes whenever the alert mutates (e.g. its updatedAt).
// Passing it makes the history refetch after ownership/dismiss/comment actions so newly
// recorded events appear without reopening the panel.
export const useAlertHistory = (alertId: string | undefined, version?: string) => {
	const [historyData, setHistoryData] = useState<AlertHistory | null>(null);

	useEffect(() => {
		const fetchHistory = async () => {
			if (alertId) {
				try {
					const alertHistoryResponse = await alertsApi.getAlertHistory(alertId);

					if (!alertHistoryResponse.success) {
						throw new Error(alertHistoryResponse.error || 'Failed to fetch alert history');
					}

					setHistoryData(alertHistoryResponse.data);
				} catch (error) {
					logger.error('Failed to fetch alert history:', error);
				}
			}
		};

		fetchHistory();
	}, [alertId, version]);

	return historyData;
};
