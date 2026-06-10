import { cn } from '@/lib/utils';
import { ReactNode, useCallback, useRef, useState } from 'react';

interface VerticalSplitProps {
	top: ReactNode;
	bottom: ReactNode;
	/** Top pane's initial share of the height, 0..1. */
	defaultRatio?: number;
	/** Smallest share either pane can shrink to. */
	minRatio?: number;
	className?: string;
}

// A two-pane vertical layout with a draggable divider. No external dependency — the divider
// updates a flex ratio on pointer drag, and each pane keeps its own internal scroll.
export const VerticalSplit = ({ top, bottom, defaultRatio = 0.5, minRatio = 0.15, className }: VerticalSplitProps) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const draggingRef = useRef(false);
	const [ratio, setRatio] = useState(defaultRatio);

	const onPointerMove = useCallback(
		(e: PointerEvent) => {
			if (!draggingRef.current || !containerRef.current) return;
			const rect = containerRef.current.getBoundingClientRect();
			if (rect.height === 0) return;
			const next = (e.clientY - rect.top) / rect.height;
			setRatio(Math.min(1 - minRatio, Math.max(minRatio, next)));
		},
		[minRatio]
	);

	const stopDragging = useCallback(() => {
		draggingRef.current = false;
		window.removeEventListener('pointermove', onPointerMove);
		window.removeEventListener('pointerup', stopDragging);
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
	}, [onPointerMove]);

	const startDragging = useCallback(
		(e: React.PointerEvent) => {
			e.preventDefault();
			draggingRef.current = true;
			window.addEventListener('pointermove', onPointerMove);
			window.addEventListener('pointerup', stopDragging);
			document.body.style.userSelect = 'none';
			document.body.style.cursor = 'row-resize';
		},
		[onPointerMove, stopDragging]
	);

	return (
		<div ref={containerRef} className={cn('flex flex-col min-h-0', className)}>
			<div className="min-h-0" style={{ flex: `${ratio} 1 0%` }}>
				{top}
			</div>
			<div
				role="separator"
				aria-orientation="horizontal"
				onPointerDown={startDragging}
				className="group flex-shrink-0 h-2 my-0.5 flex items-center justify-center cursor-row-resize"
				title="Drag to resize"
			>
				<div className="h-1 w-12 rounded-full bg-border group-hover:bg-primary/60 transition-colors" />
			</div>
			<div className="min-h-0" style={{ flex: `${1 - ratio} 1 0%` }}>
				{bottom}
			</div>
		</div>
	);
};
