import { Alert } from '@OpsiMate/shared';

export interface TreemapNode {
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
	data?: unknown;
	parent?: TreemapNode;
	[key: string]: unknown;
}
