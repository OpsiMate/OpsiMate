import { useEffect, useState } from 'react';
import { alertsApi } from '@/lib/api';
import { AlertHistory, Logger } from '@OpsiMate/shared';

const logger = new Logger('useAlertHistory');

export const useAlertHistory = (alertId: string | undefined) => {
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
	}, [alertId]);

	return historyData;
};
