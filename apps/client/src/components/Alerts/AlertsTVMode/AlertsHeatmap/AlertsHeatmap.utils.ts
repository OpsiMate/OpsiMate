import { GroupNode } from '@/components/Alerts/AlertsTable/AlertsTable.types';
import { extractTagKeyFromColumnId, isTagKeyColumn } from '@/types';
import { Alert } from '@OpsiMate/shared';
import { LIGHTNESS_RANGE, RECENCY_BUCKETS, STATUS_HUES, STATUS_SATURATION } from './AlertsHeatmap.constants';
import { TreemapNode } from './AlertsHeatmap.types';

export const normalizeGroupValue = (value: string | null | undefined): string => {
	if (!value) return 'Unknown';
	const normalized = value.trim().toLowerCase();
	return normalized || 'Unknown';
};

export const getNormalizedAlertValue = (alert: Alert, field: string): string => {
	if (isTagKeyColumn(field)) {
		const tagKey = extractTagKeyFromColumnId(field);
		if (tagKey) {
			return normalizeGroupValue(alert.tags?.[tagKey]);
		}
		return 'Unknown';
	}

	switch (field) {
		case 'status': {
			return alert.isDismissed ? 'Dismissed' : 'Firing';
		}
		case 'alertName': {
			return alert.alertName || 'Unknown';
		}
		case 'type': {
			return normalizeGroupValue(alert.type);
		}
		case 'serviceName': {
			const alertWithService = alert as Alert & { serviceName?: string };
			return normalizeGroupValue(alertWithService.serviceName);
		}
		default: {
			const alertWithField = alert as Alert & Record<string, unknown>;
			const value = alertWithField[field];
			return normalizeGroupValue(typeof value === 'string' ? value : String(value));
		}
	}
};

const getStatusKey = (alert: Alert): keyof typeof STATUS_HUES => {
	if (alert.isDismissed) return 'DISMISSED';

	const status = alert.status.toUpperCase();
	if (status.includes('FIRING') || status.includes('ACTIVE')) return 'FIRING';
	if (status.includes('PENDING')) return 'PENDING';
	if (status.includes('ACKNOWLEDGED') || status.includes('ACK')) return 'ACKNOWLEDGED';
	if (status.includes('RESOLVED')) return 'RESOLVED';
	if (status.includes('SUPPRESSED')) return 'SUPPRESSED';

	return 'UNKNOWN';
};

const getRecencyWeight = (alert: Alert): number => {
	const timestamp = alert.startsAt || alert.updatedAt;
	if (!timestamp) return 1.0;

	const now = Date.now();
	const alertTime = new Date(timestamp).getTime();
	const minutesAgo = (now - alertTime) / (1000 * 60);

	for (const bucket of RECENCY_BUCKETS) {
		if (minutesAgo < bucket.maxMinutes) {
			return bucket.weight;
		}
	}

	return 0.1;
};

export const getAlertColor = (alert: Alert): string => {
	const statusKey = getStatusKey(alert);
	const hue = STATUS_HUES[statusKey];
	const saturation = STATUS_SATURATION[statusKey];
	const recencyWeight = getRecencyWeight(alert);

	if (statusKey === 'UNKNOWN') {
		const lightness = 40 + recencyWeight * 20;
		return `hsl(0, 0%, ${lightness}%)`;
	}

	const lightness = LIGHTNESS_RANGE.MIN + recencyWeight * (LIGHTNESS_RANGE.MAX - LIGHTNESS_RANGE.MIN);

	return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export const getGroupColor = (name: string): string => {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = name.charCodeAt(i) + ((hash << 5) - hash);
	}
	const hue = Math.abs(hash % 360);
	return `hsl(${hue}, 40%, 45%)`;
};

export const getAlertMetricValue = (alert: Alert): number => {
	const alertWithMetrics = alert as Alert & {
		occurrencesLastHour?: number;
		durationSeconds?: number;
	};

	const occurrences = alertWithMetrics.occurrencesLastHour;
	if (occurrences && typeof occurrences === 'number' && occurrences > 0) {
		return occurrences;
	}

	const durationSeconds = alertWithMetrics.durationSeconds;
	if (durationSeconds && typeof durationSeconds === 'number' && durationSeconds > 0) {
		return durationSeconds;
	}

	return 1;
};

const calculateMaxVisibleAlerts = (totalAlerts: number, groupCount: number): number => {
	const totalNodes = totalAlerts + groupCount;

	if (totalNodes <= 30) return totalAlerts;
	if (totalNodes <= 60) return Math.floor(totalAlerts * 0.8);
	if (totalNodes <= 100) return Math.floor(totalAlerts * 0.6);
	if (totalNodes <= 200) return Math.floor(totalAlerts * 0.4);

	return Math.floor(totalAlerts * 0.3);
};

const mapGroupNodeToTreemap = (node: GroupNode, siblingCount: number = 1): TreemapNode | null => {
	if (node.type === 'leaf') {
		return {
			name: node.alert.alertName,
			value: 1,
			nodeType: 'leaf' as const,
			alert: node.alert,
			metricValue: 1,
		};
	}

	if (node.type === 'group') {
		let children: TreemapNode[] = node.children
			.map((child) => mapGroupNodeToTreemap(child, node.children.length))
			.filter((child): child is TreemapNode => child !== null);

		if (children.length === 0) return null;

		const leafChildren = children.filter((c) => c.nodeType === 'leaf');
		const groupChildren = children.filter((c) => c.nodeType === 'group');

		const maxVisible = calculateMaxVisibleAlerts(leafChildren.length, groupChildren.length);

		if (leafChildren.length > maxVisible && maxVisible > 0) {
			const visibleLeafs = leafChildren.slice(0, maxVisible);
			const overflowLeafs = leafChildren.slice(maxVisible);
			const overflowCount = overflowLeafs.length;
			const overflowAlerts = overflowLeafs
				.map((leaf) => leaf.alert)
				.filter((alert): alert is Alert => alert !== undefined);

			const overflowNode: TreemapNode = {
				name: `+${overflowCount} more`,
				value: 2,
				nodeType: 'leaf' as const,
				metricValue: 2,
				overflowAlerts,
			};

			children = [...groupChildren, ...visibleLeafs, overflowNode];
		}

		const totalValue = children.reduce((sum, child) => sum + child.value, 0);
		const normalizedValue = normalizeGroupValue(node.value);
		const displayValue =
			normalizedValue === 'unknown'
				? 'Unknown'
				: normalizedValue.charAt(0).toUpperCase() + normalizedValue.slice(1);

		return {
			name: `${displayValue} (${node.count})`,
			value: totalValue,
			children,
			nodeType: 'group' as const,
		};
	}

	return null;
};

export const mapGroupToTreemap = (nodes: GroupNode[]): TreemapNode[] => {
	return nodes
		.map((node) => mapGroupNodeToTreemap(node, nodes.length))
		.filter((node): node is TreemapNode => node !== null);
};
