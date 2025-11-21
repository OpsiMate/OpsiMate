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

	if (!width || !height || width <= 0 || height <= 0 || !name) return null;

	const isLeaf = !payload?.children || payload.children.length === 0;
	const fontSize = Math.min(width / 12, height / 5, 16);
	const color = getSeverityColor(name, alert);
	const isSmall = width < 60 || height < 40;

	const nameParts = name.split(' (');
	const displayName = nameParts[0];
	const count = nameParts[1]?.replace(')', '') || payload?.value?.toString() || '';

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
					strokeWidth: 2,
					strokeOpacity: 0.8,
				}}
			/>
			{width > 30 && height > 25 && (
				<foreignObject x={x} y={y} width={width} height={height} style={{ pointerEvents: 'none' }}>
					<div className="flex flex-col items-center justify-center h-full w-full p-2 text-center overflow-hidden">
						<span
							className="font-bold text-white drop-shadow-lg whitespace-nowrap overflow-hidden text-ellipsis max-w-full"
							style={{ fontSize: `${Math.max(11, fontSize)}px` }}
						>
							{displayName}
						</span>
						{count && !isSmall && (
							<span className="text-xs font-semibold text-white/90 mt-0.5 drop-shadow">
								{count} alert{count !== '1' ? 's' : ''}
							</span>
						)}
					</div>
				</foreignObject>
			)}
		</g>
	);
};
