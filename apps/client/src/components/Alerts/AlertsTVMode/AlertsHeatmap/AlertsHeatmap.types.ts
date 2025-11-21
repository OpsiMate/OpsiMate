import { Alert } from '@OpsiMate/shared';

export interface TreemapNode {
	name: string;
	value: number;
	children?: TreemapNode[];
	nodeType: 'group' | 'leaf';
	alert?: Alert;
	metricValue?: number;
	overflowAlerts?: Alert[];
	depth?: number;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	index?: number;
	[key: string]: any;
}
