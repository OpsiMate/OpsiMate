import { Alert } from '@OpsiMate/shared';
import { HierarchyNode } from 'd3-hierarchy';
import { TreemapNode } from '../AlertsHeatmap.types';

export interface D3TreemapProps {
	data: TreemapNode[];
	onAlertClick?: (alert: Alert) => void;
}

export interface BreadcrumbItem {
	name: string;
	data: TreemapNode;
}

export interface LayoutNode extends HierarchyNode<TreemapNode> {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}
