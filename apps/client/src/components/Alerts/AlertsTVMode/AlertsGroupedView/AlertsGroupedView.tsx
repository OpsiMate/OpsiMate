import { groupAlerts, getAlertValue } from '@/components/Alerts/AlertsTable/AlertsTable.utils';
import { GroupNode } from '@/components/Alerts/AlertsTable/AlertsTable.types';
import { GroupByControls } from '@/components/Alerts/AlertsTable/GroupByControls';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { ChevronRight, Home, AlertTriangle, Flame, Clock } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface AlertsGroupedViewProps {
	alerts: Alert[];
	groupBy: string[];
	onAlertClick: (alert: Alert) => void;
	customValueGetter?: (alert: Alert, field: string) => string;
	groupByColumns: string[];
	onGroupByChange: (columns: string[]) => void;
	availableColumns: string[];
}

interface TreemapRect {
	x: number;
	y: number;
	width: number;
	height: number;
	node: GroupNode;
}

interface BreadcrumbItem {
	label: string;
	node: GroupNode;
}

// Count all alerts in a node
const countAlerts = (node: GroupNode): number => {
	if (node.type === 'leaf') return 1;
	return node.children.reduce((sum, child) => sum + countAlerts(child), 0);
};

// Count active (firing) alerts only
const countActiveAlerts = (node: GroupNode): number => {
	if (node.type === 'leaf') {
		return !node.alert.isDismissed && node.alert.status === 'firing' ? 1 : 0;
	}
	return node.children.reduce((sum, child) => sum + countActiveAlerts(child), 0);
};

// Get severity level for sorting/coloring
const getSeverityLevel = (node: GroupNode): number => {
	if (node.type === 'leaf') {
		const severity = (node.alert.tags?.severity || node.alert.tags?.priority || '').toLowerCase();
		if (severity === 'critical' || severity === 'p1') return 3;
		if (severity === 'high' || severity === 'p2') return 2;
		if (severity === 'warning' || severity === 'medium' || severity === 'p3') return 1;
		return 0;
	}
	// For groups, return max severity of children
	return Math.max(0, ...node.children.map(getSeverityLevel));
};

// Filter to only keep active alerts
const filterActiveOnly = (nodes: GroupNode[]): GroupNode[] => {
	const filtered: GroupNode[] = [];
	
	for (const node of nodes) {
		if (node.type === 'leaf') {
			if (!node.alert.isDismissed && node.alert.status === 'firing') {
				filtered.push(node);
			}
		} else {
			const filteredChildren = filterActiveOnly(node.children);
			if (filteredChildren.length > 0) {
				filtered.push({
					...node,
					children: filteredChildren,
					count: filteredChildren.reduce((sum, c) => sum + (c.type === 'leaf' ? 1 : c.count), 0),
				});
			}
		}
	}
	
	return filtered;
};

// Check if alert is dismissed
const isDismissed = (node: GroupNode): boolean => {
	if (node.type === 'leaf') {
		return node.alert.isDismissed || node.alert.status !== 'firing';
	}
	// For groups, check if all children are dismissed
	return node.children.every(isDismissed);
};

// Color palette based on severity and status
const getColor = (node: GroupNode, depth: number): { bg: string; glow: string; text: string } => {
	// Dismissed alerts get gray color
	if (isDismissed(node)) {
		return { bg: 'from-slate-500 to-slate-400', glow: 'shadow-slate-400/40', text: 'text-white' };
	}
	
	const severity = getSeverityLevel(node);
	
	// Active alerts - vibrant colors based on severity
	if (severity >= 3) return { bg: 'from-red-600 to-red-500', glow: 'shadow-red-400/60', text: 'text-white' };
	if (severity >= 2) return { bg: 'from-orange-500 to-orange-400', glow: 'shadow-orange-400/60', text: 'text-white' };
	if (severity >= 1) return { bg: 'from-amber-500 to-amber-400', glow: 'shadow-amber-400/60', text: 'text-white' };
	
	// Default for active alerts
	return { bg: 'from-red-500 to-red-400', glow: 'shadow-red-400/50', text: 'text-white' };
};

// Squarified treemap algorithm for better aspect ratios
const squarify = (
	nodes: GroupNode[],
	x: number,
	y: number,
	width: number,
	height: number
): TreemapRect[] => {
	if (nodes.length === 0 || width <= 0 || height <= 0) return [];

	const totalValue = nodes.reduce((sum, n) => sum + Math.max(1, countAlerts(n)), 0);
	if (totalValue === 0) return [];

	const results: TreemapRect[] = [];
	const sortedNodes = [...nodes].sort((a, b) => countAlerts(b) - countAlerts(a));
	
	let currentX = x;
	let currentY = y;
	let remainingWidth = width;
	let remainingHeight = height;
	let remainingNodes = [...sortedNodes];
	let remainingValue = totalValue;

	while (remainingNodes.length > 0) {
		const isWide = remainingWidth >= remainingHeight;
		const side = isWide ? remainingHeight : remainingWidth;
		
		// Find best row
		let row: GroupNode[] = [];
		let rowValue = 0;
		let bestAspect = Infinity;
		
		for (let i = 0; i < remainingNodes.length; i++) {
			const testRow = remainingNodes.slice(0, i + 1);
			const testValue = testRow.reduce((s, n) => s + Math.max(1, countAlerts(n)), 0);
			const rowLength = (testValue / remainingValue) * (isWide ? remainingWidth : remainingHeight);
			
			let worstAspect = 0;
			for (const node of testRow) {
				const nodeValue = Math.max(1, countAlerts(node));
				const nodeSize = (nodeValue / testValue) * side;
				const aspect = Math.max(rowLength / nodeSize, nodeSize / rowLength);
				worstAspect = Math.max(worstAspect, aspect);
			}
			
			if (worstAspect <= bestAspect) {
				bestAspect = worstAspect;
				row = testRow;
				rowValue = testValue;
			} else {
				break;
			}
		}
		
		if (row.length === 0) row = [remainingNodes[0]];
		
		// Layout row
		const rowLength = (rowValue / remainingValue) * (isWide ? remainingWidth : remainingHeight);
		let offset = 0;
		
		for (const node of row) {
			const nodeValue = Math.max(1, countAlerts(node));
			const nodeSize = (nodeValue / rowValue) * side;
			
			const rect: TreemapRect = isWide
				? { x: currentX, y: currentY + offset, width: rowLength, height: nodeSize, node }
				: { x: currentX + offset, y: currentY, width: nodeSize, height: rowLength, node };
			
			results.push(rect);
			offset += nodeSize;
		}
		
		// Update remaining space
		if (isWide) {
			currentX += rowLength;
			remainingWidth -= rowLength;
		} else {
			currentY += rowLength;
			remainingHeight -= rowLength;
		}
		
		remainingNodes = remainingNodes.slice(row.length);
		remainingValue -= rowValue;
	}
	
	return results;
};

// Format time ago
const timeAgo = (date: string): string => {
	const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
	if (seconds < 60) return `${seconds}s`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h`;
	const days = Math.floor(hours / 24);
	return `${days}d`;
};

// Individual tile component - clean stock market style
interface TileProps {
	rect: TreemapRect;
	onAlertClick: (alert: Alert) => void;
	onDrillDown: (node: GroupNode) => void;
	totalAlerts: number;
}

const Tile = ({ rect, onAlertClick, onDrillDown, totalAlerts }: TileProps) => {
	const { node, x, y, width, height } = rect;
	const color = getColor(node, 0);
	const isLeaf = node.type === 'leaf';
	const alertCount = countAlerts(node);
	const severity = getSeverityLevel(node);
	
	// Size thresholds
	const isLarge = width > 120 && height > 80;
	const isMedium = width > 60 && height > 40;
	
	const label = isLeaf ? node.alert.alertName : node.value || 'Unknown';

	const handleClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (isLeaf) {
			onAlertClick(node.alert);
		} else {
			onDrillDown(node);
		}
	};

	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.98 }}
			animate={{ opacity: 1, scale: 1 }}
			exit={{ opacity: 0, scale: 0.98 }}
			transition={{ duration: 0.2 }}
			className={cn(
				'absolute overflow-hidden cursor-pointer',
				'bg-gradient-to-br transition-all duration-150',
				color.bg,
				'hover:brightness-110 hover:z-10',
				severity >= 3 && isLeaf && 'animate-pulse'
			)}
			style={{
				left: x + 1,
				top: y + 1,
				width: Math.max(0, width - 2),
				height: Math.max(0, height - 2),
			}}
			onClick={handleClick}
		>
			{/* Content */}
			<div className="w-full h-full flex flex-col justify-between p-2 overflow-hidden">
				{/* Top: Label */}
				<div className="flex items-start justify-between gap-1">
					<span className={cn(
						'font-bold truncate flex-1',
						isLarge ? 'text-sm' : isMedium ? 'text-xs' : 'text-[10px]',
						color.text
					)}>
						{label}
					</span>
					{!isLeaf && (
						<span className="text-xs bg-black/20 px-1.5 py-0.5 rounded text-white font-semibold shrink-0">
							{alertCount}
						</span>
					)}
				</div>
				
				{/* Bottom: Additional info for large tiles */}
				{isLarge && (
					<div className="mt-auto">
						{isLeaf ? (
							<div className="flex items-center justify-between">
								<span className="text-[10px] text-white/70 truncate">
									{node.alert.summary?.substring(0, 40) || ''}
								</span>
								<span className="text-[10px] text-white/60 flex items-center gap-1 shrink-0 ml-2">
									<Clock className="w-3 h-3" />
									{timeAgo(node.alert.startsAt)}
								</span>
							</div>
						) : (
							<div className="flex items-center gap-1 text-white/70">
								<ChevronRight className="w-3 h-3" />
								<span className="text-[10px]">Click to drill down</span>
							</div>
						)}
					</div>
				)}
				
				{/* Medium tile - just show chevron for groups */}
				{!isLarge && isMedium && !isLeaf && (
					<div className="mt-auto flex items-center text-white/60">
						<ChevronRight className="w-3 h-3" />
					</div>
				)}
			</div>
		</motion.div>
	);
};

export const AlertsGroupedView = ({
	alerts,
	groupBy,
	onAlertClick,
	customValueGetter,
	groupByColumns,
	onGroupByChange,
	availableColumns,
}: AlertsGroupedViewProps) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
	const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);

	const effectiveGroupBy = groupBy.length > 0 ? groupBy : ['type'];

	const valueGetter = useCallback(
		(alert: Alert, field: string): string => {
			if (field === 'serviceName' && customValueGetter) {
				return customValueGetter(alert, field);
			}
			return getAlertValue(alert, field);
		},
		[customValueGetter]
	);

	// Group alerts (show all including dismissed)
	const groupedData = useMemo(() => {
		return groupAlerts(alerts, effectiveGroupBy, valueGetter);
	}, [alerts, effectiveGroupBy, valueGetter]);

	// Get current view based on breadcrumbs
	const currentData = useMemo(() => {
		if (breadcrumbs.length === 0) return groupedData;
		const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
		if (lastBreadcrumb.node.type === 'group') {
			return lastBreadcrumb.node.children;
		}
		return [];
	}, [groupedData, breadcrumbs]);

	// Calculate treemap
	const tiles = useMemo(() => {
		if (dimensions.width === 0 || dimensions.height === 0) return [];
		return squarify(currentData, 0, 0, dimensions.width, dimensions.height);
	}, [currentData, dimensions]);

	// Total alerts for percentage
	const totalAlerts = useMemo(() => {
		return currentData.reduce((sum, node) => sum + countAlerts(node), 0);
	}, [currentData]);

	// Total active for display
	const totalActiveAlerts = useMemo(() => {
		return groupedData.reduce((sum, node) => sum + countActiveAlerts(node), 0);
	}, [groupedData]);

	// Handle dimension updates with fallbacks
	useEffect(() => {
		const updateDimensions = () => {
			if (containerRef.current) {
				const rect = containerRef.current.getBoundingClientRect();
				let width = rect.width;
				let height = rect.height;
				
				// Fallback to parent dimensions
				if (height <= 0 && containerRef.current.parentElement) {
					const parentRect = containerRef.current.parentElement.getBoundingClientRect();
					height = parentRect.height - 50; // Account for header
					width = parentRect.width;
				}
				
				// Fallback to window dimensions
				if (height <= 0) {
					height = window.innerHeight - 150;
					width = window.innerWidth - 20;
				}
				
				if (width > 0 && height > 0) {
					setDimensions(prev => {
						// Only update if dimensions actually changed
						if (prev.width !== width || prev.height !== height) {
							return { width, height };
						}
						return prev;
					});
				}
			}
		};

		updateDimensions();
		const timer1 = setTimeout(updateDimensions, 50);
		const timer2 = setTimeout(updateDimensions, 150);
		const timer3 = setTimeout(updateDimensions, 300);
		
		const resizeObserver = new ResizeObserver(updateDimensions);
		if (containerRef.current) {
			resizeObserver.observe(containerRef.current);
		}
		
		window.addEventListener('resize', updateDimensions);
		
		return () => {
			clearTimeout(timer1);
			clearTimeout(timer2);
			clearTimeout(timer3);
			resizeObserver.disconnect();
			window.removeEventListener('resize', updateDimensions);
		};
	}, []); // Empty dependency array - only run on mount

	// Drill down handler
	const handleDrillDown = useCallback((node: GroupNode) => {
		if (node.type === 'group' && node.children.length > 0) {
			setBreadcrumbs(prev => [...prev, { label: node.value, node }]);
		}
	}, []);

	// Reset breadcrumbs when groupBy changes
	useEffect(() => {
		setBreadcrumbs([]);
	}, [groupBy]);

	// No active alerts
	if (totalActiveAlerts === 0) {
		return (
			<div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
				<motion.div 
					initial={{ opacity: 0, y: 20 }}
					animate={{ opacity: 1, y: 0 }}
					className="text-center"
				>
					<div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
						<AlertTriangle className="w-10 h-10 text-green-500" />
					</div>
					<p className="text-green-400 font-semibold text-lg">All Clear</p>
					<p className="text-zinc-500 text-sm mt-1">No active alerts</p>
				</motion.div>
			</div>
		);
	}

	return (
		<div className="w-full h-full flex flex-col bg-gradient-to-br from-slate-100 to-slate-200">
			{/* Header */}
			<div className="flex-shrink-0 flex items-center justify-between px-3 py-2 bg-white/80 backdrop-blur-sm border-b border-slate-200">
				<div className="flex items-center gap-3">
					<GroupByControls
						groupByColumns={groupByColumns}
						onGroupByChange={onGroupByChange}
						availableColumns={availableColumns}
					/>
					
					{/* Breadcrumbs */}
					{breadcrumbs.length > 0 && (
						<div className="flex items-center gap-1 text-sm">
							<button
								onClick={() => setBreadcrumbs([])}
								className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors"
							>
								<Home className="w-3.5 h-3.5" />
								<span>All</span>
							</button>
							{breadcrumbs.map((crumb, idx) => (
								<div key={idx} className="flex items-center">
									<ChevronRight className="w-4 h-4 text-slate-400" />
									<button
										onClick={() => setBreadcrumbs(prev => prev.slice(0, idx + 1))}
										className={cn(
											'px-2 py-1 rounded transition-colors',
											idx === breadcrumbs.length - 1 
												? 'bg-slate-200 text-slate-900 font-medium' 
												: 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
										)}
									>
										{crumb.label}
									</button>
								</div>
							))}
						</div>
					)}
				</div>
				
				<div className="flex items-center gap-3">
					<div className="text-sm flex items-center gap-3">
						<div>
							<span className="text-red-600 font-bold">{totalActiveAlerts}</span>
							<span className="text-slate-500 ml-1">active</span>
						</div>
						<span className="text-slate-300">|</span>
						<div>
							<span className="text-slate-600 font-bold">{totalAlerts}</span>
							<span className="text-slate-500 ml-1">total</span>
						</div>
					</div>
				</div>
			</div>

			{/* Treemap */}
			<div ref={containerRef} className="flex-1 relative m-1" style={{ minHeight: 'calc(100vh - 200px)' }}>
				<AnimatePresence mode="wait">
					{dimensions.width === 0 || dimensions.height === 0 ? (
						<motion.div 
							key="loading"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="absolute inset-0 flex items-center justify-center"
						>
							<div className="text-center">
								<div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
								<p className="text-slate-500 text-sm">Loading...</p>
							</div>
						</motion.div>
					) : tiles.length === 0 ? (
						<motion.div 
							key="empty"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="absolute inset-0 flex items-center justify-center"
						>
							<p className="text-slate-500">No data to display</p>
						</motion.div>
					) : (
						<motion.div 
							key="tiles"
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							className="absolute inset-0"
						>
							{tiles.map((rect, idx) => (
								<Tile
									key={rect.node.type === 'group' ? rect.node.key : 
										(rect.node.type === 'leaf' ? rect.node.alert.id : idx)}
									rect={rect}
									onAlertClick={onAlertClick}
									onDrillDown={handleDrillDown}
									totalAlerts={totalAlerts}
								/>
							))}
						</motion.div>
					)}
				</AnimatePresence>
			</div>
		</div>
	);
};
