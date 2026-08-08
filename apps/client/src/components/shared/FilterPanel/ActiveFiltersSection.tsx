import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
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
				{Object.entries(filters).map(([key, values]) => {
					// "!field" entries are exclusions — labelled with ≠ and tinted red.
					const isExclusion = key.startsWith('!');
					const field = isExclusion ? key.slice(1) : key;
					return values.map((value) => (
						<Badge
							key={`${key}-${value}`}
							variant="outline"
							className={cn(
								'text-[10px] px-1.5 py-0.5 h-5 gap-1 cursor-pointer hover:bg-destructive/10 hover:border-destructive hover:text-destructive transition-colors group bg-background',
								isExclusion && 'border-destructive/40 text-destructive'
							)}
							onClick={() => onRemoveFilter(key, value)}
							title={`Remove ${fieldLabels[field]} ${isExclusion ? '≠' : ':'} ${getDisplayValue(field, value)}`}
						>
							<span className={cn('font-semibold', isExclusion ? 'text-destructive' : 'text-primary')}>
								{fieldLabels[field]}
								{isExclusion ? ' ≠' : ':'}
							</span>
							<span className="max-w-[60px] truncate font-medium">{getDisplayValue(field, value)}</span>
							<X className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100" />
						</Badge>
					));
				})}
			</div>
		</div>
	);
};
