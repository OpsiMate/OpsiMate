import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Service } from '../../ServiceTable';
import { FilterPanel } from './FilterPanel';

interface FilterSidebarProps {
	services: Service[];
	filters: Record<string, string[]>;
	onFilterChange: (filters: Record<string, string[]>) => void;
	collapsed: boolean;
	onToggle: () => void;
}

export const FilterSidebar = ({ services, filters, onFilterChange, collapsed, onToggle }: FilterSidebarProps) => {
	return (
		<div
			className={cn(
				'border-r border-border transition-all duration-300 ease-in-out flex-shrink-0 relative',
				collapsed ? 'w-12' : 'w-48'
			)}
		>
			<div className={cn('h-full flex flex-col', !collapsed ? 'px-4' : '')}>
				<div className="flex items-center justify-between p-2 border-b border-border">
					{!collapsed && <h3 className="text-sm font-semibold text-foreground">Filters</h3>}
				</div>
				<div className="flex-1 overflow-hidden">
					<FilterPanel
						services={services}
						filters={filters}
						onFilterChange={onFilterChange}
						collapsed={collapsed}
					/>
				</div>
			</div>
			<Button
				onClick={onToggle}
				variant="ghost"
				size="icon"
				className="z-10 absolute top-1/2 -right-4 -translate-y-1/2 border bg-background hover:bg-muted rounded-full h-8 w-8"
				title={collapsed ? 'Expand filters' : 'Collapse filters'}
			>
				{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
			</Button>
		</div>
	);
};
