import { cn } from '@/lib/utils';
import { ReactNode } from 'react';
import { PanelResizeHandle } from './PanelResizeHandle';
import { useResizablePanelWidth } from './hooks/useResizablePanelWidth';

// w-48 was the sidebar's only width before it could be dragged, so it stays both the
// default and the floor. The ceiling keeps it from swallowing the table it filters.
const SIDEBAR_DEFAULT_WIDTH = 192;
const SIDEBAR_MIN_WIDTH = 192;
const SIDEBAR_MAX_WIDTH = 480;
const SIDEBAR_STORAGE_KEY = 'opsimate-alerts-filter-sidebar-width';

interface FilterSidebarProps {
	children: ReactNode;
	className?: string;
}

export const FilterSidebar = ({ children, className }: FilterSidebarProps) => {
	const { width, minWidth, maxWidth, panelRef, startResizing, resetWidth, setWidth } = useResizablePanelWidth({
		dock: 'left',
		defaultWidth: SIDEBAR_DEFAULT_WIDTH,
		minWidth: SIDEBAR_MIN_WIDTH,
		maxWidth: SIDEBAR_MAX_WIDTH,
		storageKey: SIDEBAR_STORAGE_KEY,
	});

	return (
		// No width transition: the animation would chase every pointermove and the drag
		// would feel like it lags a step behind the cursor.
		<div ref={panelRef} style={{ width }} className={cn('border-r border-border shrink-0 relative', className)}>
			<div className="h-full flex flex-col pr-4">{children}</div>
			<PanelResizeHandle
				side="right"
				ariaLabel="Resize filter sidebar"
				onPointerDown={startResizing}
				onDoubleClick={resetWidth}
				value={width}
				minValue={minWidth}
				maxValue={maxWidth}
				onSetValue={setWidth}
			/>
		</div>
	);
};
