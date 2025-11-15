import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Alert } from '@OpsiMate/shared';
import { ChevronLeft, ChevronRight, Filter, RotateCcw } from 'lucide-react';
import { useMemo } from 'react';
import { getIntegrationLabel, resolveAlertIntegration } from './IntegrationAvatar';

interface AlertsFilterPanelProps {
	alerts: Alert[];
	services: Array<{ id: string | number; name: string }>;
	filters: Record<string, string[]>;
	onFilterChange: (filters: Record<string, string[]>) => void;
	collapsed?: boolean;
	onToggle?: () => void;
	className?: string;
}

const FACET_FIELDS = ['status', 'type', 'tag', 'alertName'] as const;

const FIELD_LABELS: Record<string, string> = {
	status: 'Status',
	type: 'Type',
	tag: 'Tag',
	alertName: 'Alert Name',
};

export const AlertsFilterPanel = ({
	alerts,
	services,
	filters,
	onFilterChange,
	collapsed = false,
	onToggle,
	className,
}: AlertsFilterPanelProps) => {
	// Calculate facets
	const facets = useMemo(() => {
		const facetData: Record<string, Map<string, number>> = {};

		FACET_FIELDS.forEach((field) => {
			facetData[field] = new Map();
		});

		alerts.forEach((alert) => {
			// Status facet
			const status = alert.isDismissed ? 'Dismissed' : 'Firing';
			facetData.status.set(status, (facetData.status.get(status) || 0) + 1);

			// Type facet
			const type = getIntegrationLabel(resolveAlertIntegration(alert));
			facetData.type.set(type, (facetData.type.get(type) || 0) + 1);

			// Tag facet
			if (alert.tag) {
				facetData.tag.set(alert.tag, (facetData.tag.get(alert.tag) || 0) + 1);
			}

			// Alert Name facet
			if (alert.alertName) {
				facetData.alertName.set(alert.alertName, (facetData.alertName.get(alert.alertName) || 0) + 1);
			}
		});

		// Convert to sorted arrays
		const result: Record<string, Array<{ value: string; count: number }>> = {};
		Object.entries(facetData).forEach(([field, map]) => {
			result[field] = Array.from(map.entries())
				.map(([value, count]) => ({ value, count }))
				.sort((a, b) => {
					// Sort by count descending, then by value ascending
					if (b.count !== a.count) return b.count - a.count;
					return a.value.localeCompare(b.value);
				});
		});

		return result;
	}, [alerts]);

	// Handle filter change
	const handleFilterToggle = (field: string, value: string) => {
		const currentValues = filters[field] || [];
		const newValues = currentValues.includes(value)
			? currentValues.filter((v) => v !== value)
			: [...currentValues, value];

		onFilterChange({
			...filters,
			[field]: newValues,
		});
	};

	// Reset all filters
	const handleResetFilters = () => {
		onFilterChange({});
	};

	// Count active filters
	const activeFilterCount = Object.values(filters).reduce(
		(count, values) => count + values.length,
		0
	);

	if (collapsed) {
		return (
			<div className={cn('w-12 border-r border-border relative', className)}>
				<div className="flex flex-col items-center py-4 gap-4">
					<div className="relative">
						<Filter className="h-5 w-5 text-muted-foreground" />
						{activeFilterCount > 0 && (
							<Badge
								variant="destructive"
								className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
							>
								{activeFilterCount}
							</Badge>
						)}
					</div>
					{activeFilterCount > 0 && (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={handleResetFilters}
							title="Reset filters"
						>
							<RotateCcw className="h-3 w-3" />
						</Button>
					)}
				</div>
				{onToggle && (
					<Button
						onClick={onToggle}
						variant="ghost"
						size="icon"
						className="absolute top-1/2 -right-4 -translate-y-1/2 border bg-background hover:bg-muted rounded-full h-8 w-8 z-10"
						title="Expand filters"
					>
						<ChevronRight className="h-4 w-4" />
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className={cn('w-48 border-r border-border relative', className)}>
			<div className="h-full flex flex-col">
				<div className="flex items-center justify-between p-2 border-b border-border">
					<div className="flex items-center gap-2">
						<h3 className="text-sm font-semibold">Filters</h3>
						{activeFilterCount > 0 && (
							<Badge variant="secondary" className="text-xs px-1 py-0">
								{activeFilterCount}
							</Badge>
						)}
					</div>
					{activeFilterCount > 0 && (
						<Button
							variant="ghost"
							size="icon"
							className="h-6 w-6"
							onClick={handleResetFilters}
							title="Reset all filters"
						>
							<RotateCcw className="h-3 w-3" />
						</Button>
					)}
				</div>
				<ScrollArea className="flex-1">
					<Accordion type="multiple" defaultValue={FACET_FIELDS.map((f) => f)} className="w-full">
						{FACET_FIELDS.map((field) => {
							const fieldFacets = facets[field] || [];
							const activeValues = filters[field] || [];

							if (fieldFacets.length === 0) return null;

							return (
								<AccordionItem key={field} value={field} className="border-b">
									<AccordionTrigger className="px-2 py-1.5 hover:no-underline hover:bg-muted/50">
										<div className="flex items-center justify-between w-full pr-2">
											<span className="text-xs font-medium">{FIELD_LABELS[field]}</span>
											{activeValues.length > 0 && (
												<Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
													{activeValues.length}
												</Badge>
											)}
										</div>
									</AccordionTrigger>
									<AccordionContent className="pb-2">
										<div className="space-y-1 px-2">
											{fieldFacets.map(({ value, count }) => {
												const isChecked = activeValues.includes(value);
												return (
													<label
														key={value}
														className={cn(
															'flex items-center gap-2 py-1 px-1 rounded cursor-pointer transition-colors',
															'hover:bg-muted/50',
															isChecked && 'bg-muted'
														)}
													>
														<Checkbox
															checked={isChecked}
															onCheckedChange={() =>
																handleFilterToggle(field, value)
															}
															className="h-3 w-3 border-2 data-[state=checked]:bg-primary data-[state=checked]:border-primary cursor-pointer hover:bg-primary/10 transition-colors"
														/>
														<span className="text-xs flex-1 truncate" title={value}>
															{value}
														</span>
														<Badge
															variant="outline"
															className="text-[10px] px-1 py-0 h-4 min-w-[20px] flex items-center justify-center"
														>
															{count}
														</Badge>
													</label>
												);
											})}
										</div>
									</AccordionContent>
								</AccordionItem>
							);
						})}
					</Accordion>
				</ScrollArea>
			</div>
			{onToggle && (
				<Button
					onClick={onToggle}
					variant="ghost"
					size="icon"
					className="absolute top-1/2 -right-4 -translate-y-1/2 border bg-background hover:bg-muted rounded-full h-8 w-8 z-10"
					title="Collapse filters"
				>
					<ChevronLeft className="h-4 w-4" />
				</Button>
			)}
		</div>
	);
};
