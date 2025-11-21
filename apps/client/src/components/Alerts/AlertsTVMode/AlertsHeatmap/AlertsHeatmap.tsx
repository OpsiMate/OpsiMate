import { groupAlerts } from '@/components/Alerts/AlertsTable/AlertsTable.utils';
import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { mapGroupToTreemap } from './AlertsHeatmap.utils';
import { HeatmapContent } from './HeatmapContent';
import { HeatmapTooltip } from './HeatmapTooltip';

export interface AlertsHeatmapProps {
	alerts: Alert[];
	groupBy: string[];
	onAlertClick?: (alert: Alert) => void;
	customValueGetter?: (alert: Alert, field: string) => string;
}

export const AlertsHeatmap = ({
	alerts,
	groupBy,
	onAlertClick,
	customValueGetter,
}: AlertsHeatmapProps) => {
	const data = useMemo(() => {
		if (alerts.length === 0) return [];

		const effectiveGroupBy = groupBy.length > 0 ? groupBy : ['tag'];
		const groups = groupAlerts(alerts, effectiveGroupBy, customValueGetter);
		const treemapData = mapGroupToTreemap(groups);

		if (treemapData.length === 0) return [];

		return treemapData;
	}, [alerts, groupBy, customValueGetter]);

	if (data.length === 0) {
		return (
			<div className="w-full h-full flex items-center justify-center min-h-[400px]">
				<p className="text-muted-foreground">No data to display</p>
			</div>
		);
	}

	return (
		<div className="w-full h-full" style={{ minHeight: 'calc(100vh - 200px)' }}>
			<ResponsiveContainer width="100%" height="100%" minHeight={400}>
				<Treemap
					data={data}
					dataKey="value"
					stroke="#fff"
					fill="#8884d8"
					content={<HeatmapContent onAlertClick={onAlertClick} />}
					isAnimationActive={false}
				>
					<Tooltip content={<HeatmapTooltip />} />
				</Treemap>
			</ResponsiveContainer>
		</div>
	);
};
