import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ReactNode } from 'react';

interface FilterSidebarProps {
	children: ReactNode;
	collapsed: boolean;
	onToggle: () => void;
	className?: string;
}

export const FilterSidebar = ({ children, collapsed, onToggle, className }: FilterSidebarProps) => {
	return (
		<div
			className={cn(
				'border-r border-border transition-all duration-300 ease-in-out flex-shrink-0 relative',
				collapsed ? 'w-12' : 'w-48',
				className
			)}
		>
			<div className={cn('h-full flex flex-col', !collapsed && 'pr-4')}>{children}</div>
			<Button
				onClick={onToggle}
				variant="ghost"
				size="icon"
				className="z-10 absolute top-1/2 -right-4 -translate-y-1/2 border bg-background hover:bg-muted rounded-full h-8 w-8 flex items-center justify-center !p-0"
				title={collapsed ? 'Expand filters' : 'Collapse filters'}
			>
				{collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
			</Button>
		</div>
	);
};
