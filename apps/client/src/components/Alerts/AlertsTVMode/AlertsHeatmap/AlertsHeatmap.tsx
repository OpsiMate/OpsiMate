import { groupAlerts } from '@/components/Alerts/AlertsTable/AlertsTable.utils';
import { Alert } from '@OpsiMate/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertDetailsModal } from './AlertDetailsModal';
import { D3Treemap } from './D3Treemap';
import { getNormalizedAlertValue, mapGroupToTreemap, normalizeGroupValue } from './AlertsHeatmap.utils';
import { HeatmapLegend } from './HeatmapLegend';

export interface AlertsHeatmapProps {
	alerts: Alert[];
	groupBy: string[];
	onDismiss?: (alertId: string) => void;
	onUndismiss?: (alertId: string) => void;
	customValueGetter?: (alert: Alert, field: string) => string;
}

export const AlertsHeatmap = ({
	alerts,
	groupBy,
	onDismiss,
	onUndismiss,
	customValueGetter,
}: AlertsHeatmapProps) => {
	const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
	const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
	const containerRef = useRef<HTMLDivElement>(null);

	const data = useMemo(() => {
		if (alerts.length === 0) return [];

		const effectiveGroupBy = groupBy.length > 0 ? groupBy : ['tag'];

		const normalizedValueGetter = (alert: Alert, field: string): string => {
			if (field === 'serviceName' && customValueGetter) {
				const serviceValue = customValueGetter(alert, field);
				return normalizeGroupValue(serviceValue);
			}
			return getNormalizedAlertValue(alert, field);
		};

		const groups = groupAlerts(alerts, effectiveGroupBy, normalizedValueGetter);
		const treemapData = mapGroupToTreemap(groups);

		if (treemapData.length === 0) return [];

		return treemapData;
	}, [alerts, groupBy, customValueGetter]);

	useEffect(() => {
		const updateSize = () => {
			if (containerRef.current) {
				const rect = containerRef.current.getBoundingClientRect();
				if (rect.width > 0 && rect.height > 0) {
					setDimensions({ width: rect.width, height: rect.height });
				}
			}
		};

		updateSize();
		const resizeObserver = new ResizeObserver(updateSize);
		if (containerRef.current) {
			resizeObserver.observe(containerRef.current);
		}
		window.addEventListener('resize', updateSize);
		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', updateSize);
		};
	}, []);

	const handleAlertClick = (alert: Alert) => {
		setSelectedAlert(alert);
	};

	const handleCloseModal = () => {
		setSelectedAlert(null);
	};

	if (!data || data.length === 0) {
		return (
			<div className="w-full h-full flex items-center justify-center min-h-[400px]">
				<p className="text-muted-foreground">No data to display</p>
			</div>
		);
	}

	return (
		<div className="w-full h-full flex flex-col">
			<div ref={containerRef} className="flex-1 overflow-hidden" style={{ minHeight: 400 }}>
				<D3Treemap
					data={data}
					width={dimensions.width}
					height={dimensions.height}
					onAlertClick={handleAlertClick}
				/>
			</div>

			<div className="flex-shrink-0">
				<HeatmapLegend />
			</div>

			<AlertDetailsModal
				alert={selectedAlert}
				open={!!selectedAlert}
				onClose={handleCloseModal}
				onDismiss={onDismiss}
				onUndismiss={onUndismiss}
			/>
		</div>
	);
};
