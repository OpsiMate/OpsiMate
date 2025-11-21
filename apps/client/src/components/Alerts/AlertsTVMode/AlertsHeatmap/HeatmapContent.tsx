import { Alert } from '@OpsiMate/shared';
import React, { useState } from 'react';
import { TREEMAP_STROKE } from './AlertsHeatmap.constants';
import { getAlertColor, getGroupColor } from './AlertsHeatmap.utils';

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
	[key: string]: any;
}

export const HeatmapContent = (props: HeatmapContentProps) => {
	const { x, y, width, height, name, alert, payload, onAlertClick } = props;
	const [isHovered, setIsHovered] = useState(false);

	if (!width || !height || width <= 0 || height <= 0 || !name) return null;

	const isLeaf = !payload?.children || payload.children.length === 0;
	const fontSize = Math.min(width / 12, height / 5, 16);
	const color = isLeaf && alert ? getAlertColor(alert) : getGroupColor(name);
	const isSmall = width < 60 || height < 40;

	const nameParts = name.split(' (');
	const displayName = nameParts[0];
	const count = nameParts[1]?.replace(')', '') || '';
	const metricValue = payload?.metricValue;

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isLeaf && alert && onAlertClick) {
			onAlertClick(alert);
		}
	};

	const scale = isHovered ? 1.03 : 1;
	const transformOrigin = `${x + width / 2}px ${y + height / 2}px`;

	return (
		<g
			onClick={handleClick}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			style={{
				cursor: isLeaf && onAlertClick ? 'pointer' : 'default',
				transition: 'transform 0.15s ease-out',
				transform: `scale(${scale})`,
				transformOrigin,
			}}
		>
			<rect
				x={x}
				y={y}
				width={width}
				height={height}
				style={{
					fill: color,
					stroke: isHovered ? '#fff' : TREEMAP_STROKE,
					strokeWidth: isHovered ? 3 : 2,
					strokeOpacity: isHovered ? 1 : 0.8,
					filter: isHovered ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' : 'none',
					transition: 'all 0.15s ease-out',
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
						{!isSmall && (
							<>
								{count && (
									<span className="text-xs font-semibold text-white/90 mt-0.5 drop-shadow">
										{count} alert{count !== '1' ? 's' : ''}
									</span>
								)}
								{metricValue && metricValue > 1 && (
									<span className="text-[10px] text-white/80 drop-shadow">
										{metricValue}
									</span>
								)}
							</>
						)}
					</div>
				</foreignObject>
			)}
		</g>
	);
};
