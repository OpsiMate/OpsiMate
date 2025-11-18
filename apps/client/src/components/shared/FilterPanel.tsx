import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Filter, RotateCcw } from 'lucide-react';
import { useFilterPanel } from './hooks/useFilterPanel';

export type FilterFacet = {
	value: string;
	count: number;
	displayValue?: string;
};

export type FilterFacets = Record<string, FilterFacet[]>;
export type ActiveFilters = Record<string, string[]>;

export interface FilterPanelConfig {
	fields: readonly string[];
	fieldLabels: Record<string, string>;
	defaultOpen?: string[];
}

interface FilterPanelProps {
	config: FilterPanelConfig;
	facets: FilterFacets;
	filters: ActiveFilters;
	onFilterChange: (filters: ActiveFilters) => void;
	collapsed?: boolean;
	onToggle?: () => void;
	className?: string;
	variant?: 'default' | 'compact';
}

export const FilterPanel = ({
	config,
	facets,
	filters,
	onFilterChange,
	collapsed = false,
	onToggle,
	className,
	variant = 'default',
}: FilterPanelProps) => {
	const { searchTerms, getFilteredAndLimitedFacets, handleSearchChange, handleLoadMore, shouldShowSearch } =
		useFilterPanel();

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

	const handleResetFilters = () => {
		onFilterChange({});
	};

	const activeFilterCount = Object.values(filters).reduce((count, values) => count + values.length, 0);

	const defaultOpenValues = config.defaultOpen || config.fields.map((f) => f);

	if (collapsed) {
		return (
			<div className={cn('flex flex-col items-center py-4 gap-4', className)}>
				<div className="relative">
					<Filter className="h-5 w-5 text-muted-foreground" />
					{activeFilterCount > 0 && (
						<Badge
							variant="secondary"
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
		);
	}

	return (
		<div className={cn('h-full flex flex-col', className)}>
			<div className="flex items-center justify-between p-3 border-b border-border">
				<div className="flex items-center gap-2">
					<h3 className="text-sm font-semibold">Filters</h3>
					{activeFilterCount > 0 && (
						<Badge variant="outline" className="text-xs px-1.5 py-0 bg-muted/50 border-muted-foreground/20">
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
				<div className="px-2 py-2">
					<Accordion type="multiple" defaultValue={defaultOpenValues} className="w-full">
						{config.fields.map((field) => {
							const fieldFacets = facets[field] || [];
							const activeValues = filters[field] || [];

							if (fieldFacets.length === 0) return null;

							return (
								<AccordionItem key={field} value={field} className="border-b">
									<AccordionTrigger className="px-2 py-1.5 hover:no-underline hover:bg-muted/50">
										<div className="flex items-center justify-between w-full pr-2">
											<span className="text-xs font-medium">
												{config.fieldLabels[field] || field}
											</span>
											{activeValues.length > 0 && (
												<Badge
													variant="outline"
													className="text-[10px] px-1.5 py-0 h-4 bg-muted/50 border-muted-foreground/20"
												>
													{activeValues.length}
												</Badge>
											)}
										</div>
									</AccordionTrigger>
									<AccordionContent className="pb-2 overflow-hidden">
										{shouldShowSearch(fieldFacets) && (
											<div className="px-2 pb-2">
												<Input
													placeholder="Search..."
													value={searchTerms[field] || ''}
													onChange={(e) => handleSearchChange(field, e.target.value)}
													className="h-7 text-xs"
												/>
											</div>
										)}
										<div className="space-y-1 px-2 w-full">
											{(() => {
												const { filteredAndLimitedFacets, hasMore, remaining, searchTerm } =
													getFilteredAndLimitedFacets(field, fieldFacets);

												return (
													<>
														{filteredAndLimitedFacets.map(
															({ value, count, displayValue }) => {
																const isChecked = activeValues.includes(value);
																const label = displayValue || value;
																return (
																	<label
																		key={value}
																		className={cn(
																			'flex items-center gap-2 py-1 px-1 rounded cursor-pointer transition-colors w-full overflow-hidden',
																			'hover:bg-muted/50',
																			isChecked && 'bg-muted'
																		)}
																	>
																		<Checkbox
																			checked={isChecked}
																			onCheckedChange={() =>
																				handleFilterToggle(field, value)
																			}
																			className="h-3 w-3 border-2 flex-shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary cursor-pointer hover:bg-primary/10 transition-colors"
																		/>
																		<span
																			className="text-xs overflow-hidden text-ellipsis whitespace-nowrap block max-w-[100px]"
																			title={label}
																		>
																			{label}
																		</span>
																		<Badge
																			variant="outline"
																			className="text-[10px] px-1 py-0 h-4 min-w-[20px] flex-shrink-0 flex items-center justify-center"
																		>
																			{count}
																		</Badge>
																	</label>
																);
															}
														)}
														{hasMore && !searchTerm && (
															<Button
																variant="ghost"
																size="sm"
																onClick={() => handleLoadMore(field)}
																className="w-full text-xs mt-1 h-7"
															>
																Load {Math.min(5, remaining)} more...
															</Button>
														)}
													</>
												);
											})()}
										</div>
									</AccordionContent>
								</AccordionItem>
							);
						})}
					</Accordion>
				</div>
			</ScrollArea>
		</div>
	);
};
