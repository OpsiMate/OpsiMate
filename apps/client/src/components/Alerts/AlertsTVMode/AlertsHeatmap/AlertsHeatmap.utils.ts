import { GroupNode } from '@/components/Alerts/AlertsTable/AlertsTable.types';
import { Alert } from '@OpsiMate/shared';
import { FALLBACK_COLOR, SEVERITY_COLORS } from './AlertsHeatmap.constants';
import { TreemapNode } from './AlertsHeatmap.types';

export const getSeverityColor = (name: string, alert?: Alert): string => {
	if (alert?.isDismissed) return SEVERITY_COLORS.Dismissed;
	if (SEVERITY_COLORS[name]) return SEVERITY_COLORS[name];
	return FALLBACK_COLOR;
};

export const mapGroupToTreemap = (nodes: GroupNode[]): TreemapNode[] => {
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
