import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Filter, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActiveFiltersSection } from './FilterPanel/ActiveFiltersSection';
import { FilterSearchInput } from './FilterPanel/FilterSearchInput';
import { useFilterPanel } from './hooks/useFilterPanel';

export type FilterFacet = {
	value: string;
	count: number;
	displayValue?: string;
	disabled?: boolean;
};

export type FilterFacets = Record<string, FilterFacet[]>;
export type ActiveFilters = Record<string, string[]>;

export interface FilterPanelConfig {
	fields: readonly string[];
	fieldLabels: Record<string, string>;
	defaultOpen?: string[];
	allPossibleValues?: Record<string, string[]>;
}

interface FilterPanelProps {
	config: FilterPanelConfig;
	facets: FilterFacets;
	filters: ActiveFilters;
	onFilterChange: (filters: ActiveFilters) => void;
	collapsed?: boolean;
	onToggle?: () => void;
	className?: string;
}

const SEARCHABLE_THRESHOLD = 8;

export const FilterPanel = ({
	config,
	facets,
	filters,
	onFilterChange,
	collapsed = false,
	onToggle,
	className,
}: FilterPanelProps) => {
	const { searchTerms, getFilteredAndLimitedFacets, handleSearchChange, handleLoadMore, shouldShowSearch } =
		useFilterPanel();

	// Global search for all filter options
	const [globalSearch, setGlobalSearch] = useState('');

	const allSeenValuesRef = useRef<Record<string, Set<string>>>({});

	useEffect(() => {
		config.fields.forEach((field) => {
			if (!allSeenValuesRef.current[field]) {
				allSeenValuesRef.current[field] = new Set();
			}
		});
	}, [config.fields]);

	useEffect(() => {
		Object.entries(facets).forEach(([field, fieldFacets]) => {
			if (!allSeenValuesRef.current[field]) {
				allSeenValuesRef.current[field] = new Set();
			}
			fieldFacets.forEach((facet) => {
				allSeenValuesRef.current[field]?.add(facet.value);
			});
		});
	}, [facets]);

	useEffect(() => {
		Object.entries(filters).forEach(([field, values]) => {
			if (!allSeenValuesRef.current[field]) {
				allSeenValuesRef.current[field] = new Set();
			}
			values.forEach((value) => {
				allSeenValuesRef.current[field]?.add(value);
			});
		});
	}, [filters]);

	const allSeenValues = useMemo(() => {
		const result: Record<string, Set<string>> = {};
		config.fields.forEach((field) => {
			result[field] = allSeenValuesRef.current[field] || new Set();
		});
		return result;
	}, [config.fields]);

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

	const handleRemoveFilter = (field: string, value: string) => {
		const currentValues = filters[field] || [];
		const newValues = currentValues.filter((v) => v !== value);
		onFilterChange({
			...filters,
			[field]: newValues,
		});
	};

	const getDisplayValue = (field: string, value: string): string => {
		const fieldFacets = facets[field] || [];
		const facet = fieldFacets.find((f) => f.value === value);
		return facet?.displayValue || value;
	};

	const handleResetFilters = () => {
		onFilterChange({});
	};

	const activeFilterCount = Object.values(filters).reduce((count, values) => count + values.length, 0);

	const defaultOpenValues = useMemo(
		() => (config.defaultOpen !== undefined ? config.defaultOpen : [...config.fields]),
		[config.defaultOpen, config.fields]
	);

	const [openValues, setOpenValues] = useState<string[]>(defaultOpenValues);

	useEffect(() => {
		const allFields = [...config.fields];
		const newFields = allFields.filter((field) => !openValues.includes(field));
		if (newFields.length > 0) {
			setOpenValues((prev) => [...prev, ...newFields]);
		}
	}, [config.fields]);

	if (collapsed) {
		return (
			<div className={cn('flex flex-col items-center py-4 gap-4', className)}>
				<div className="relative">
					<Filter className="h-5 w-5 text-foreground" />
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
						className="h-6 w-6 text-foreground"
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
					<h3 className="text-sm font-semibold text-foreground">Filters</h3>
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
						className="h-6 w-6 text-foreground"
						onClick={handleResetFilters}
						title="Reset all filters"
					>
						<RotateCcw className="h-3 w-3" />
					</Button>
				)}
			</div>

			<FilterSearchInput value={globalSearch} onChange={setGlobalSearch} />

			<ActiveFiltersSection
				filters={filters}
				fieldLabels={config.fieldLabels}
				getDisplayValue={getDisplayValue}
				onRemoveFilter={handleRemoveFilter}
			/>
			<ScrollArea className="flex-1">
				<div className="px-2 py-2">
					<Accordion type="multiple" value={openValues} onValueChange={setOpenValues} className="w-full">
						{config.fields.map((field) => {
							const fieldFacets = facets[field] || [];
							const activeValues = filters[field] || [];
							const seenValues = allSeenValues[field] || new Set();

							const existingValues = new Set(fieldFacets.map((f) => f.value));
							const orphanedFilters = activeValues
								.filter((v) => !existingValues.has(v))
								.map((value) => ({ value, count: 0 }));

							// Apply global search filter
							const globalSearchLower = globalSearch.toLowerCase();
							const fieldLabel = config.fieldLabels[field] || field;
							const fieldMatchesSearch = fieldLabel.toLowerCase().includes(globalSearchLower);

							const matchesGlobalSearch = (facet: { value: string; displayValue?: string }) => {
								if (!globalSearch) return true;
								// If field name matches, show all facets in this section
								if (fieldMatchesSearch) return true;
								return (
									facet.value.toLowerCase().includes(globalSearchLower) ||
									(facet.displayValue?.toLowerCase().includes(globalSearchLower) ?? false)
								);
							};

							const missingSeenValues = Array.from(seenValues)
								.filter((v) => !existingValues.has(v) && !activeValues.includes(v))
								.map((value) => ({ value, count: 0 }));

							const allFacets = [...fieldFacets, ...orphanedFilters, ...missingSeenValues];

							// Filter by global search
							const filteredByGlobalSearch = allFacets.filter(matchesGlobalSearch);

							// Hide entire section if no matches in global search AND field name doesn't match
							if (globalSearch && filteredByGlobalSearch.length === 0 && !fieldMatchesSearch) {
								return null;
							}

							return (
								<AccordionItem key={field} value={field} className="border-b">
									<AccordionTrigger className="px-2 py-1.5 hover:no-underline hover:bg-muted/50 text-foreground">
										<div className="flex items-center justify-between w-full pr-2">
											<span className="text-xs font-medium text-foreground">
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
										<div className="space-y-1 px-2 w-full">
											{(() => {
												// Use global search filtered facets
												const facetsToShow = globalSearch ? filteredByGlobalSearch : allFacets;
												const { filteredAndLimitedFacets, hasMore, remaining, searchTerm } =
													getFilteredAndLimitedFacets(field, facetsToShow);

												if (filteredAndLimitedFacets.length === 0) {
													return (
														<div className="text-xs text-muted-foreground py-2 px-1">
															No options available
														</div>
													);
												}

												return (
													<>
														{filteredAndLimitedFacets.map(
															({ value, count, displayValue, disabled }) => {
																const isChecked = activeValues.includes(value);
																const label = displayValue || value;
																const isDisabled = disabled === true;
																return (
																	<label
																		key={value}
																		className={cn(
																			'flex items-center gap-2 py-1 px-1 rounded transition-colors w-full overflow-hidden',
																			isDisabled
																				? 'cursor-not-allowed opacity-50'
																				: 'cursor-pointer hover:bg-muted/50',
																			isChecked && 'bg-muted'
																		)}
																	>
																		<Checkbox
																			checked={isChecked}
																			disabled={isDisabled}
																			onCheckedChange={() =>
																				handleFilterToggle(field, value)
																			}
																			className="h-3 w-3 border-2 flex-shrink-0 data-[state=checked]:bg-primary data-[state=checked]:border-primary cursor-pointer hover:bg-primary/10 transition-colors disabled:cursor-not-allowed"
																		/>
																		<span
																			className="text-xs overflow-hidden text-ellipsis whitespace-nowrap block max-w-[100px] text-foreground"
																			title={label}
																		>
																			{label}
																		</span>
																		<Badge
																			variant="outline"
																			className="text-[10px] px-1 py-0 h-4 min-w-[20px] flex-shrink-0 flex items-center justify-center ml-auto"
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
																className="w-full text-xs mt-1 h-7 text-foreground"
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
