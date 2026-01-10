import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface ActiveFiltersSectionProps {
	filters: Record<string, string[]>;
	fieldLabels: Record<string, string>;
	getDisplayValue: (field: string, value: string) => string;
	onRemoveFilter: (field: string, value: string) => void;
}

export const ActiveFiltersSection = ({
	filters,
	fieldLabels,
	getDisplayValue,
	onRemoveFilter,
}: ActiveFiltersSectionProps) => {
	const activeFilterCount = Object.values(filters).reduce((count, values) => count + values.length, 0);

	if (activeFilterCount === 0) {
		return null;
	}

	return (
		<div className="px-3 py-2 border-b border-border bg-muted/30">
			<div className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
				Active Filters
			</div>
			<div className="flex flex-wrap gap-1">
				{Object.entries(filters).map(([field, values]) =>
					values.map((value) => (
						<Badge
							key={`${field}-${value}`}
							variant="outline"
							className="text-[10px] px-1.5 py-0.5 h-5 gap-1 cursor-pointer hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-colors group bg-background"
							onClick={() => onRemoveFilter(field, value)}
							title={`Remove ${fieldLabels[field]}: ${getDisplayValue(field, value)}`}
						>
							<span className="text-primary font-semibold">{fieldLabels[field]}:</span>
							<span className="max-w-[60px] truncate font-medium">{getDisplayValue(field, value)}</span>
							<X className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
						</Badge>
					))
				)}
			</div>
		</div>
	);
};
