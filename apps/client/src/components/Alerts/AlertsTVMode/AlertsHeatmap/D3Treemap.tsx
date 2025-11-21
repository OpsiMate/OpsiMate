import { Alert } from '@OpsiMate/shared';
import { hierarchy, HierarchyNode, treemap, treemapSquarify } from 'd3-hierarchy';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { resolveAlertIntegration } from '../../IntegrationAvatar.utils';
import { TreemapNode } from './AlertsHeatmap.types';
import { getAlertColor, getGroupColor } from './AlertsHeatmap.utils';

interface D3TreemapProps {
	data: TreemapNode[];
	onAlertClick?: (alert: Alert) => void;
}

interface BreadcrumbItem {
	name: string;
	data: TreemapNode;
}

interface LayoutNode extends HierarchyNode<TreemapNode> {
	x0: number;
	y0: number;
	x1: number;
	y1: number;
}

export const D3Treemap = ({ data, onAlertClick }: Omit<D3TreemapProps, 'width' | 'height'>) => {
	const svgRef = useRef<SVGSVGElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [hoveredNode, setHoveredNode] = useState<LayoutNode | null>(null);
	const [currentData, setCurrentData] = useState<TreemapNode[]>(data);
	const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
	const [tooltip, setTooltip] = useState<{ x: number; y: number; content: string } | null>(null);
	const nodesMapRef = useRef<Map<Element, TreemapNode>>(new Map());
	const [overflowAlerts, setOverflowAlerts] = useState<Alert[] | null>(null);
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

	useEffect(() => {
		if (!containerRef.current) return;

		const updateDimensions = () => {
			if (containerRef.current) {
				const rect = containerRef.current.getBoundingClientRect();
				console.log('Container dimensions:', rect.width, rect.height);
				if (rect.width > 0 && rect.height > 0) {
					setDimensions({ width: rect.width, height: rect.height });
				}
			}
		};

		setTimeout(updateDimensions, 0);

		const resizeObserver = new ResizeObserver(() => {
			updateDimensions();
		});

		resizeObserver.observe(containerRef.current);

		window.addEventListener('resize', updateDimensions);

		return () => {
			resizeObserver.disconnect();
			window.removeEventListener('resize', updateDimensions);
		};
	}, []);

	const totalValue = useMemo(() => {
		return data.reduce((sum, node) => sum + node.value, 0);
	}, [data]);

	const currentGroupPercentage = useMemo(() => {
		const currentValue = currentData.reduce((sum, node) => sum + node.value, 0);
		return ((currentValue / totalValue) * 100).toFixed(1);
	}, [currentData, totalValue]);

	const getIntegrationIcon = (alert: Alert): string => {
		const integration = resolveAlertIntegration(alert);
		switch (integration) {
			case 'grafana':
				return '🟠'; // Grafana orange
			case 'gcp':
				return '🔵'; // GCP blue
			default:
				return '🔔'; // Custom bell
		}
	};

	useEffect(() => {
		setCurrentData(data);
		setBreadcrumbs([]);
	}, [data]);

	const handleZoomToGroup = useCallback((groupData: TreemapNode) => {
		if (groupData.children && groupData.children.length > 0) {
			setBreadcrumbs(prev => [...prev, { name: groupData.name, data: groupData }]);
			setCurrentData(groupData.children);
		}
	}, []);

	const handleBreadcrumbClick = useCallback((index: number) => {
		if (index === -1) {
			setCurrentData(data);
			setBreadcrumbs([]);
		} else {
			const targetBreadcrumb = breadcrumbs[index];
			setBreadcrumbs(breadcrumbs.slice(0, index + 1));
			setCurrentData(targetBreadcrumb.data.children || []);
		}
	}, [data, breadcrumbs]);

	useEffect(() => {
		if (!svgRef.current || !currentData || currentData.length === 0 || dimensions.width === 0 || dimensions.height === 0) return;

		const svg = svgRef.current;
		svg.innerHTML = '';

		const rootData: TreemapNode = {
			name: 'root',
			value: currentData.reduce((sum, node) => sum + node.value, 0),
			children: currentData,
			nodeType: 'group',
		};

		const root = hierarchy(rootData)
			.sum((d) => (d as TreemapNode).value || 0)
			.sort((a, b) => (b.value || 0) - (a.value || 0));

		const treemapLayout = treemap<TreemapNode>()
			.size([dimensions.width, dimensions.height])
			.paddingInner(2)
			.paddingOuter(2)
			.paddingTop((node) => {
				// Root gets no top padding (we have external header)
				if (node.depth === 0) return 0;
				// Groups (depth 1) get header space for their label
				if (node.depth === 1) return 28;
				// Leaves/other don't need extra top padding
				return 0;
			})
			.round(true)
			.tile(treemapSquarify);

		treemapLayout(root);

		const nodes: LayoutNode[] = [];
		root.each((node) => {
			nodes.push(node as LayoutNode);
		});

		const totalValue = root.value || 1;

		const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
		nodesMapRef.current.clear();

		nodes.forEach((node) => {
			if (!node.parent) return;

			const isLeaf = !node.data.children || node.data.children.length === 0;
			const alert = (node.data as TreemapNode).alert;
			const isOverflowNode = isLeaf && !alert && (node.data as TreemapNode).overflowAlerts;
			const nodeWidth = node.x1 - node.x0;
			const nodeHeight = node.y1 - node.y0;
			const percentage = ((node.value || 0) / totalValue * 100).toFixed(1);
			const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');

			nodesMapRef.current.set(rect, node.data);
			rect.setAttribute('x', String(node.x0));
			rect.setAttribute('y', String(node.y0));
			rect.setAttribute('width', String(nodeWidth));
			rect.setAttribute('height', String(nodeHeight));

			if (isOverflowNode) {
				rect.setAttribute('fill', 'hsl(0, 0%, 45%)');
			} else {
				rect.setAttribute('fill', isLeaf && alert ? getAlertColor(alert) : getGroupColor(node.data.name));
			}

			rect.setAttribute('stroke', '#1f2937');
			rect.setAttribute('stroke-width', '2');
			rect.setAttribute('stroke-opacity', '0.8');
			rect.style.cursor = (isLeaf && alert && onAlertClick) || isOverflowNode ? 'pointer' : 'default';
			rect.style.transition = 'all 0.15s ease-out';

			if (isLeaf && alert && onAlertClick) {
				rect.addEventListener('click', (e) => {
					e.stopPropagation();
					onAlertClick(alert);
				});
			} else if (isOverflowNode) {
				rect.addEventListener('click', (e) => {
					e.stopPropagation();
					setOverflowAlerts((node.data as TreemapNode).overflowAlerts || null);
				});
			} else if (!isLeaf && node.data.children) {
				rect.addEventListener('click', (e) => {
					e.stopPropagation();
					handleZoomToGroup(node.data);
				});
			}

			rect.addEventListener('mouseenter', (e) => {
				setHoveredNode(node);
				rect.setAttribute('stroke', '#fff');
				rect.setAttribute('stroke-width', '3');
				rect.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))';
				rect.style.transform = 'scale(1.03)';
				rect.style.transformOrigin = `${node.x0 + nodeWidth / 2}px ${node.y0 + nodeHeight / 2}px`;

				let tooltipContent: string;
				if (isOverflowNode) {
					const overflowCount = (node.data as TreemapNode).overflowAlerts?.length || 0;
					tooltipContent = `+${overflowCount} more alerts\nClick to view all`;
				} else if (isLeaf && alert) {
					tooltipContent = `${alert.alertName}\nStatus: ${alert.isDismissed ? 'Dismissed' : alert.status}\nStarted: ${new Date(alert.startsAt).toLocaleString()}\nPercentage: ${percentage}%`;
				} else {
					tooltipContent = `${node.data.name}\n${node.data.children?.length || 0} items\nPercentage: ${percentage}%\nClick to zoom in`;
				}

				setTooltip({
					x: e.clientX + 10,
					y: e.clientY - 10,
					content: tooltipContent
				});
			});

			rect.addEventListener('mouseleave', () => {
				setHoveredNode(null);
				rect.setAttribute('stroke', '#1f2937');
				rect.setAttribute('stroke-width', '2');
				rect.style.filter = 'none';
				rect.style.transform = 'scale(1)';
				setTooltip(null);
			});

			rect.addEventListener('mousemove', (e) => {
				if (tooltip) {
					setTooltip(prev => prev ? { ...prev, x: e.clientX + 10, y: e.clientY - 10 } : null);
				}
			});

			g.appendChild(rect);

			if (nodeWidth > 30 && nodeHeight > 25) {
				const fontSize = Math.min(nodeWidth / 12, nodeHeight / 5, 16);
				const nameParts = node.data.name.split(' (');
				const displayName = nameParts[0];
				const count = nameParts[1]?.replace(')', '') || '';

				const foreignObject = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');

				// If it's a group (not leaf), position text in the top header area
				if (!isLeaf && node.data.children && node.data.children.length > 0) {
					foreignObject.setAttribute('x', String(node.x0));
					foreignObject.setAttribute('y', String(node.y0));
					foreignObject.setAttribute('width', String(nodeWidth));
					foreignObject.setAttribute('height', '28'); // Matches paddingTop

					const div = document.createElement('div');
					div.className = 'flex items-center justify-between px-2 h-full w-full overflow-hidden';

					const leftGroup = document.createElement('div');
					leftGroup.className = 'flex items-center gap-2 overflow-hidden';

					const nameSpan = document.createElement('span');
					nameSpan.className = 'font-bold text-white/90 text-xs uppercase tracking-wider drop-shadow-sm truncate';
					nameSpan.textContent = displayName;
					leftGroup.appendChild(nameSpan);

					if (count) {
						const countSpan = document.createElement('span');
						countSpan.className = 'text-[10px] text-white/70 font-medium bg-black/20 px-1.5 py-0.5 rounded-full flex-shrink-0';
						countSpan.textContent = count;
						leftGroup.appendChild(countSpan);
					}

					div.appendChild(leftGroup);

					const percentSpan = document.createElement('span');
					percentSpan.className = 'font-bold text-white/95 text-xs tracking-wide drop-shadow-sm flex-shrink-0 ml-2';
					percentSpan.textContent = `${percentage}%`;
					div.appendChild(percentSpan);

					foreignObject.appendChild(div);
				} else {
					// Leaf nodes (Alerts)
					foreignObject.setAttribute('x', String(node.x0));
					foreignObject.setAttribute('y', String(node.y0));
					foreignObject.setAttribute('width', String(nodeWidth));
					foreignObject.setAttribute('height', String(nodeHeight));
					foreignObject.style.pointerEvents = 'none';

					const container = document.createElement('div');
					container.className = 'relative h-full w-full overflow-hidden';

					if (!isOverflowNode && nodeWidth >= 60 && nodeHeight >= 35) {
						const percentSpan = document.createElement('div');
						percentSpan.className = 'absolute top-1 right-1 font-bold text-white/95 text-[10px] tracking-wide drop-shadow-sm';
						percentSpan.textContent = `${percentage}%`;
						container.appendChild(percentSpan);
					}

					const div = document.createElement('div');
					div.className = 'flex flex-col items-center justify-center h-full w-full p-1 text-center';
					div.style.display = 'flex';
					div.style.alignItems = 'center';
					div.style.justifyContent = 'center';
					div.style.textAlign = 'center';
					div.style.wordWrap = 'break-word';
					div.style.lineHeight = '1.2';
					div.style.gap = '2px';

					if (isOverflowNode) {
						const ellipsisSpan = document.createElement('span');
						ellipsisSpan.className = 'font-bold text-white drop-shadow-lg';
						ellipsisSpan.style.fontSize = `${Math.max(20, nodeHeight / 3)}px`;
						ellipsisSpan.textContent = '⋯';
						div.appendChild(ellipsisSpan);

						if (nodeHeight >= 35) {
							const textSpan = document.createElement('span');
							textSpan.className = 'text-xs font-semibold text-white/90 drop-shadow mt-1';
							textSpan.style.fontSize = `${Math.max(9, nodeHeight / 6)}px`;
							textSpan.textContent = `+${(node.data as TreemapNode).overflowAlerts?.length || 0}`;
							div.appendChild(textSpan);
						}
					} else {
						if (isLeaf && alert && nodeWidth >= 40 && nodeHeight >= 30) {
							const iconSpan = document.createElement('span');
							iconSpan.style.fontSize = `${Math.min(nodeWidth / 8, nodeHeight / 6, 14)}px`;
							iconSpan.style.marginBottom = '2px';
							iconSpan.textContent = getIntegrationIcon(alert);
							div.appendChild(iconSpan);
						}

						const nameSpan = document.createElement('span');
						nameSpan.className = 'font-bold text-white drop-shadow-lg';
						nameSpan.style.fontSize = `${Math.max(9, fontSize)}px`;
						nameSpan.style.maxWidth = '100%';
						nameSpan.style.overflow = 'hidden';
						nameSpan.style.textOverflow = 'ellipsis';
						nameSpan.style.whiteSpace = 'nowrap';
						nameSpan.textContent = displayName;
						div.appendChild(nameSpan);
					}

					if (count && nodeWidth >= 45 && nodeHeight >= 35) {
						const countSpan = document.createElement('span');
						countSpan.className = 'text-xs font-semibold text-white/90 drop-shadow';
						countSpan.style.fontSize = `${Math.max(8, fontSize * 0.75)}px`;
						countSpan.textContent = `${count} alert${count !== '1' ? 's' : ''}`;
						div.appendChild(countSpan);
					}

					container.appendChild(div);
					foreignObject.appendChild(container);
				}

				g.appendChild(foreignObject);
			}
		});

		svg.appendChild(g);

		const handleWheel = (e: WheelEvent) => {
			if (e.ctrlKey || e.metaKey) {
				e.preventDefault();

				if (e.deltaY < 0) {
					const target = e.target as Element;
					const nodeData = nodesMapRef.current.get(target);

					if (nodeData && nodeData.children && nodeData.children.length > 0) {
						handleZoomToGroup(nodeData);
					}
				} else if (e.deltaY > 0) {
					if (breadcrumbs.length > 0) {
						handleBreadcrumbClick(breadcrumbs.length - 2);
					}
				}
			}
		};

		svg.addEventListener('wheel', handleWheel, { passive: false });

		return () => {
			svg.removeEventListener('wheel', handleWheel);
		};
	}, [currentData, dimensions, onAlertClick, breadcrumbs, handleZoomToGroup]);

	const currentGroupName = breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1]?.name.split(' (')[0] : '';
	const currentGroupColor = currentGroupName ? getGroupColor(currentGroupName) : '';

	return (
		<div className="w-full h-full flex flex-col">
			{breadcrumbs.length > 0 && (
				<div
					className="h-7 border-b flex items-center justify-between px-3 flex-shrink-0 cursor-pointer hover:brightness-110 transition-all"
					style={{ backgroundColor: currentGroupColor }}
					onClick={() => handleBreadcrumbClick(breadcrumbs.length - 2)}
					title="Click to go back"
				>
					<div className="flex items-center gap-2 overflow-hidden">
						<span className="font-bold text-white/90 text-xs uppercase tracking-wider drop-shadow-sm truncate">
							{currentGroupName}
						</span>
						<span className="text-[10px] text-white/70 font-medium bg-black/20 px-1.5 py-0.5 rounded-full flex-shrink-0">
							{breadcrumbs[breadcrumbs.length - 1]?.name.split(' (')[1]?.replace(')', '')}
						</span>
					</div>
					<span className="font-bold text-white/95 text-xs tracking-wide drop-shadow-sm flex-shrink-0 ml-2">
						{currentGroupPercentage}%
					</span>
				</div>
			)}
			<div ref={containerRef} className="flex-1 w-full h-full overflow-hidden">
				<svg
					ref={svgRef}
					width="100%"
					height="100%"
					style={{ display: 'block' }}
				/>
			</div>

			{/* Tooltip */}
			{tooltip && (
				<div
					className="fixed z-50 bg-background/95 backdrop-blur-sm border rounded-lg p-2 shadow-lg text-xs max-w-xs pointer-events-none"
					style={{
						left: tooltip.x,
						top: tooltip.y,
						transform: 'translate(-50%, -100%)'
					}}
				>
					{tooltip.content.split('\n').map((line, index) => (
						<div key={index} className={index === 0 ? 'font-semibold' : 'text-muted-foreground'}>
							{line}
						</div>
					))}
				</div>
			)}

			{/* Overflow Alerts Modal */}
			{overflowAlerts && overflowAlerts.length > 0 && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
					onClick={() => setOverflowAlerts(null)}
				>
					<div
						className="bg-background border rounded-lg shadow-xl max-w-2xl max-h-[80vh] w-full mx-4 overflow-hidden flex flex-col"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="flex items-center justify-between p-4 border-b">
							<h3 className="text-lg font-semibold">Additional Alerts ({overflowAlerts.length})</h3>
							<button
								onClick={() => setOverflowAlerts(null)}
								className="text-muted-foreground hover:text-foreground transition-colors"
							>
								✕
							</button>
						</div>
						<div className="overflow-y-auto p-4 space-y-2">
							{overflowAlerts.map((alert, index) => (
								<div
									key={`${alert.id}-${index}`}
									className="group p-3 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
									onClick={() => {
										setOverflowAlerts(null);
										if (onAlertClick) {
											onAlertClick(alert);
										}
									}}
								>
									<div className="flex items-start justify-between gap-2">
										<div className="flex-1 min-w-0">
											<div className="font-semibold truncate group-hover:text-white transition-colors">{alert.alertName}</div>
											<div className="text-xs text-muted-foreground group-hover:text-white/90 mt-1 transition-colors">
												Status: {alert.isDismissed ? 'Dismissed' : alert.status}
											</div>
											{alert.summary && (
												<div className="text-xs text-muted-foreground group-hover:text-white/80 mt-1 line-clamp-2 transition-colors">
													{alert.summary}
												</div>
											)}
										</div>
										<div
											className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
											style={{ backgroundColor: getAlertColor(alert) }}
										/>
									</div>
								</div>
							))}
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
