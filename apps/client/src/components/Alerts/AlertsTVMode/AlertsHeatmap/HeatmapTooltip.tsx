import { Alert } from '@OpsiMate/shared';
import React from 'react';
import { getAlertMetricValue } from './AlertsHeatmap.utils';

interface TooltipPayload {
	payload?: {
		name: string;
		value: number;
		nodeType: 'group' | 'leaf';
		alert?: Alert;
		metricValue?: number;
	};
}

interface HeatmapTooltipProps {
	active?: boolean;
	payload?: TooltipPayload[];
}

const formatDuration = (timestamp: string): string => {
	const now = Date.now();
	const alertTime = new Date(timestamp).getTime();
	const diffMs = now - alertTime;

	const minutes = Math.floor(diffMs / (1000 * 60));
	const hours = Math.floor(diffMs / (1000 * 60 * 60));
	const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	return `${days}d ago`;
};

export const HeatmapTooltip = ({ active, payload }: HeatmapTooltipProps) => {
	if (!active || !payload || payload.length === 0) return null;

	const data = payload[0].payload;
	if (!data) return null;

	if (data.nodeType === 'group') {
		return (
			<div className="bg-background/95 backdrop-blur-sm border border-border p-3 rounded-lg shadow-lg text-sm max-w-xs">
				<p className="font-bold text-foreground mb-1">{data.name.split(' (')[0]}</p>
				<p className="text-muted-foreground text-xs">
					{data.value} alert{data.value !== 1 ? 's' : ''} in this group
				</p>
			</div>
		);
	}

	if (data.nodeType === 'leaf' && data.alert) {
		const alert = data.alert;
		const metricValue = data.metricValue || getAlertMetricValue(alert);
		const status = alert.isDismissed ? 'Dismissed' : alert.status;

		return (
			<div className="bg-background/95 backdrop-blur-sm border border-border p-3 rounded-lg shadow-lg text-sm max-w-xs animate-in fade-in duration-150">
				<p className="font-bold text-foreground mb-2 leading-tight">{alert.alertName}</p>

				<div className="space-y-1 text-xs">
					<div className="flex justify-between">
						<span className="text-muted-foreground">Status:</span>
						<span className={`font-semibold ${
							status.toLowerCase().includes('firing') ? 'text-red-500' :
							status.toLowerCase().includes('dismissed') ? 'text-green-500' :
							'text-yellow-500'
						}`}>
							{status}
						</span>
					</div>

					<div className="flex justify-between">
						<span className="text-muted-foreground">Source:</span>
						<span className="text-foreground font-medium">{alert.type}</span>
					</div>

					<div className="flex justify-between">
						<span className="text-muted-foreground">Tag:</span>
						<span className="text-foreground font-medium">{alert.tag}</span>
					</div>

					{alert.summary && (
						<div className="pt-1 border-t border-border">
							<span className="text-muted-foreground block mb-0.5">Summary:</span>
							<p className="text-foreground text-xs leading-snug line-clamp-2">
								{alert.summary}
							</p>
						</div>
					)}

					<div className="pt-1 border-t border-border">
						<div className="flex justify-between">
							<span className="text-muted-foreground">Started:</span>
							<span className="text-foreground font-medium">
								{formatDuration(alert.startsAt)}
							</span>
						</div>
					</div>

					{metricValue > 1 && (
						<div className="flex justify-between">
							<span className="text-muted-foreground">Metric:</span>
							<span className="text-foreground font-medium">{metricValue}</span>
						</div>
					)}
				</div>

				<p className="text-[10px] text-muted-foreground mt-2 pt-1 border-t border-border">
					Click for details
				</p>
			</div>
		);
	}

	return null;
};
