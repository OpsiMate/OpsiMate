import { Alert } from '@OpsiMate/shared';
import { hierarchy, HierarchyNode, treemap, treemapSquarify } from 'd3-hierarchy';
import { useEffect, useRef, useState } from 'react';
import { getAlertColor, getGroupColor } from './AlertsHeatmap.utils';
import { TreemapNode } from './AlertsHeatmap.types';

interface D3TreemapProps {
	data: TreemapNode[];
	width: number;
	height: number;
	onAlertClick?: (alert: Alert) => void;
}

interface LayoutNode extends HierarchyNode<TreemapNode> {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export const D3Treemap = ({ data, width, height, onAlertClick }: D3TreemapProps) => {
	const svgRef = useRef<SVGSVGElement>(null);
	const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);

	useEffect(() => {
		if (!svgRef.current || !data || data.length === 0 || width === 0 || height === 0) return;

		const svg = svgRef.current;
		svg.innerHTML = '';

		const rootData = {
			name: 'root',
			value: data.reduce((sum, node) => sum + node.value, 0),
			children: data,
		};

		const root = hierarchy(rootData)
			.sum((d) => (d as TreemapNode).value || 0)
			.sort((a, b) => (b.value || 0) - (a.value || 0));

		const treemapLayout = treemap<TreemapNode>()
			.size([width, height])
			.paddingInner(2)
			.paddingOuter(2)
			.paddingTop(2)
			.round(true)
			.tile(treemapSquarify);

		treemapLayout(root);

		const nodes: LayoutNode[] = [];
		root.each((node) => {
			nodes.push(node as LayoutNode);
		});

		const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

		nodes.forEach((node) => {
			if (!node.parent) return;

			const isLeaf = !node.data.children || node.data.children.length === 0;
			const alert = (node.data as TreemapNode).alert;
			const nodeWidth = node.x1 - node.x0;
			const nodeHeight = node.y1 - node.y0;

			const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
			rect.setAttribute('x', String(node.x0));
			rect.setAttribute('y', String(node.y0));
			rect.setAttribute('width', String(nodeWidth));
			rect.setAttribute('height', String(nodeHeight));
			rect.setAttribute('fill', isLeaf && alert ? getAlertColor(alert) : getGroupColor(node.data.name));
			rect.setAttribute('stroke', '#1f2937');
			rect.setAttribute('stroke-width', '2');
			rect.setAttribute('stroke-opacity', '0.8');
			rect.style.cursor = isLeaf && alert && onAlertClick ? 'pointer' : 'default';
			rect.style.transition = 'all 0.15s ease-out';

			if (isLeaf && alert && onAlertClick) {
				rect.addEventListener('click', (e) => {
					e.stopPropagation();
					onAlertClick(alert);
				});
			}

			rect.addEventListener('mouseenter', () => {
				setHoveredNode(node);
				rect.setAttribute('stroke', '#fff');
				rect.setAttribute('stroke-width', '3');
				rect.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';
				rect.style.transform = 'scale(1.03)';
				rect.style.transformOrigin = `${node.x0 + nodeWidth / 2}px ${node.y0 + nodeHeight / 2}px`;
			});

			rect.addEventListener('mouseleave', () => {
				setHoveredNode(null);
				rect.setAttribute('stroke', '#1f2937');
				rect.setAttribute('stroke-width', '2');
				rect.style.filter = 'none';
				rect.style.transform = 'scale(1)';
			});

			g.appendChild(rect);

			if (nodeWidth > 30 && nodeHeight > 25) {
				const fontSize = Math.min(nodeWidth / 12, nodeHeight / 5, 16);
				const nameParts = node.data.name.split(' (');
				const displayName = nameParts[0];
				const count = nameParts[1]?.replace(')', '') || '';

				const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
				foreignObject.setAttribute('x', String(node.x0));
				foreignObject.setAttribute('y', String(node.y0));
				foreignObject.setAttribute('width', String(nodeWidth));
				foreignObject.setAttribute('height', String(nodeHeight));
				foreignObject.style.pointerEvents = 'none';

				const div = document.createElement('div');
				div.className = 'flex flex-col items-center justify-center h-full w-full p-2 text-center overflow-hidden';
				div.innerHTML = `
					<span class="font-bold text-white drop-shadow-lg whitespace-nowrap overflow-hidden text-ellipsis max-w-full" style="font-size: ${Math.max(11, fontSize)}px">
						${displayName}
					</span>
					${count && nodeWidth >= 60 && nodeHeight >= 40 ? `
						<span class="text-xs font-semibold text-white/90 mt-0.5 drop-shadow">
							${count} alert${count !== '1' ? 's' : ''}
						</span>
					` : ''}
				`;

				foreignObject.appendChild(div);
				g.appendChild(foreignObject);
			}
		});

		svg.appendChild(g);
	}, [data, width, height, onAlertClick]);

	return <svg ref={svgRef} width={width} height={height} />;
};
