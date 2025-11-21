import { Alert } from '@OpsiMate/shared';
import { useMemo } from 'react';
import { ResponsiveContainer, Tooltip, Treemap } from 'recharts';
import { GroupNode } from './AlertsTable/AlertsTable.types';
import { groupAlerts } from './AlertsTable/AlertsTable.utils';

interface AlertsHeatmapProps {
	alerts: Alert[];
	groupBy: string[];
	onAlertClick?: (alert: Alert) => void;
	customValueGetter?: (alert: Alert, field: string) => string;
}

interface TreemapNode {
	name: string;
	value: number;
	children?: TreemapNode[];
	nodeType: 'group' | 'leaf';
	alert?: Alert;
	depth?: number;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	index?: number;
	[key: string]: any;
}

const COLORS: Record<string, string> = {
	Critical: '#ef4444',
	High: '#f97316',
	Warning: '#eab308',
	Info: '#3b82f6',
	Low: '#22c55e',
	Dismissed: '#9ca3af',
	Unknown: '#6b7280',
	Firing: '#ef4444',
};

const getSeverityColor = (name: string, alert?: Alert): string => {
	if (alert?.isDismissed) return COLORS.Dismissed;
	if (COLORS[name]) return COLORS[name];
	return '#374151';
};

const mapGroupToTreemap = (nodes: GroupNode[]): TreemapNode[] => {
	return nodes.map((node) => {
		if (node.type === 'leaf') {
			return {
				name: node.alert.alertName,
				value: 1,
				nodeType: 'leaf',
				alert: node.alert,
			};
		} else {
			const children = mapGroupToTreemap(node.children);
			const totalValue = children.reduce((sum, child) => sum + (child.value || 0), 0);
			return {
				name: node.value,
				value: totalValue || node.count,
				children,
				nodeType: 'group',
			};
		}
	});
};

const CustomContent = (props: any) => {
	const { x, y, width, height, name, nodeType, alert, payload } = props;

	if (!width || !height || width <= 0 || height <= 0) return null;

	const isLeaf = !payload?.children || payload.children.length === 0;
	const fontSize = Math.min(width / 10, height / 4, 14);
	const color = getSeverityColor(name, alert);
	const isSmall = width < 50 || height < 30;

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isLeaf && alert && props.onAlertClick) {
			props.onAlertClick(alert);
		}
	};

	return (
		<g onClick={handleClick} style={{ cursor: isLeaf && props.onAlertClick ? 'pointer' : 'default' }}>
			<rect
				x={x}
				y={y}
				width={width}
				height={height}
				style={{
					fill: color,
					stroke: '#1f2937',
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

const CustomTooltip = ({ active, payload }: any) => {
	if (active && payload && payload.length) {
		const data = payload[0].payload;
		return (
			<div className="bg-background border border-border p-2 rounded shadow-md text-sm">
				<p className="font-semibold">{data.name}</p>
				{data.nodeType === 'leaf' && data.alert && (
					<>
						<p>Status: {data.alert.isDismissed ? 'Dismissed' : 'Firing'}</p>
						<p>Tag: {data.alert.tag}</p>
						{data.alert.summary && <p>Summary: {data.alert.summary}</p>}
						<p className="text-xs text-muted-foreground mt-1">
							Started: {new Date(data.alert.startsAt).toLocaleString()}
						</p>
					</>
				)}
				{data.nodeType === 'group' && <p>Count: {data.value}</p>}
			</div>
		);
	}
	return null;
};

export const AlertsHeatmap = ({ alerts, groupBy, onAlertClick, customValueGetter }: AlertsHeatmapProps) => {
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
		<div className="w-full h-full min-h-[400px]">
			<ResponsiveContainer width="100%" height="100%">
				<Treemap
					data={data}
					dataKey="value"
					stroke="#fff"
					fill="#8884d8"
					content={<CustomContent onAlertClick={onAlertClick} />}
					isAnimationActive={false}
				>
					<Tooltip content={<CustomTooltip />} />
				</Treemap>
			</ResponsiveContainer>
		</div>
	);
};
