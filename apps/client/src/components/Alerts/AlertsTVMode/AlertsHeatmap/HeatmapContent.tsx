import { Alert } from '@OpsiMate/shared';
import React from 'react';
import { TREEMAP_STROKE } from './AlertsHeatmap.constants';
import { getSeverityColor } from './AlertsHeatmap.utils';

interface HeatmapContentProps {
	depth: number;
	x: number;
	y: number;
	width: number;
	height: number;
	index: number;
	name: string;
	nodeType: 'group' | 'leaf';
	alert?: Alert;
	payload?: any;
	onAlertClick?: (alert: Alert) => void;
	// Recharts passes other props we might ignore
	[key: string]: any;
}

export const HeatmapContent = (props: HeatmapContentProps) => {
	const { x, y, width, height, name, alert, payload, onAlertClick } = props;

	if (!width || !height || width <= 0 || height <= 0) return null;

	const isLeaf = !payload?.children || payload.children.length === 0;
	const fontSize = Math.min(width / 10, height / 4, 14);
	const color = getSeverityColor(name, alert);
	const isSmall = width < 50 || height < 30;

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isLeaf && alert && onAlertClick) {
			onAlertClick(alert);
		}
	};

	return (
		<g onClick={handleClick} style={{ cursor: isLeaf && onAlertClick ? 'pointer' : 'default' }}>
			<rect
				x={x}
				y={y}
				width={width}
				height={height}
				style={{
					fill: color,
					stroke: TREEMAP_STROKE,
					strokeWidth: 1,
					strokeOpacity: 1,
				}}
			/>
			{width > 20 && height > 20 && (
				<foreignObject x={x} y={y} width={width} height={height} style={{ pointerEvents: 'none' }}>
					<div className="flex flex-col items-center justify-center h-full w-full p-1 text-center overflow-hidden">
						<span
							className="font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis max-w-full"
							style={{ fontSize: `${Math.max(10, fontSize)}px` }}
						>
							{name}
						</span>
						{!isSmall && isLeaf && (
							<span className="text-xs text-white/80 mt-1">{alert?.tag}</span>
						)}
						{!isLeaf && payload?.value && (
							<span className="text-xs text-white/80 mt-1">({payload.value})</span>
						)}
					</div>
				</foreignObject>
			)}
		</g>
	);
};
