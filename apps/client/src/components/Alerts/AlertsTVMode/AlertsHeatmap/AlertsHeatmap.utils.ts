import { GroupNode } from '@/components/Alerts/AlertsTable/AlertsTable.types';
import { Alert } from '@OpsiMate/shared';
import { FALLBACK_COLOR, SEVERITY_COLORS } from './AlertsHeatmap.constants';
import { TreemapNode } from './AlertsHeatmap.types';

const generateColorFromString = (str: string): string => {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = str.charCodeAt(i) + ((hash << 5) - hash);
	}

	const hue = Math.abs(hash % 360);
	const saturation = 60 + (Math.abs(hash) % 20);
	const lightness = 45 + (Math.abs(hash) % 15);

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export const getSeverityColor = (name: string, alert?: Alert): string => {
	if (alert?.isDismissed) return SEVERITY_COLORS.Dismissed;

	if (!name) return FALLBACK_COLOR;

	const cleanName = name.split(' (')[0].trim();

	if (SEVERITY_COLORS[cleanName]) return SEVERITY_COLORS[cleanName];

	if (cleanName === 'Grafana') return '#ff6b6b';
	if (cleanName === 'GCP') return '#4ecdc4';
	if (cleanName === 'Custom') return '#95e1d3';
	if (cleanName === 'production') return '#ef4444';
	if (cleanName === 'staging') return '#f97316';
	if (cleanName === 'development') return '#eab308';
	if (cleanName === 'critical') return '#dc2626';
	if (cleanName === 'warning') return '#f59e0b';
	if (cleanName === 'info') return '#3b82f6';

	return generateColorFromString(cleanName);
};

export const mapGroupToTreemap = (nodes: GroupNode[], maxDepth: number = 2): TreemapNode[] => {
	return nodes
		.filter((node) => node.type === 'group')
		.map((node) => {
			if (node.type === 'group') {
				const groupChildren = node.children.filter((child) => child.type === 'group');
				const shouldIncludeChildren = groupChildren.length > 0 && node.level < maxDepth - 1;

				const children = shouldIncludeChildren
					? mapGroupToTreemap(groupChildren, maxDepth)
					: undefined;

				const totalValue = node.count || (children
					? children.reduce((sum, child) => sum + (child.value || 0), 0)
					: 0);

				return {
					name: `${node.value} (${totalValue})`,
					value: totalValue,
					children,
					nodeType: 'group' as const,
				};
			}
			return null;
		})
		.filter((node): node is TreemapNode => node !== null);
};
