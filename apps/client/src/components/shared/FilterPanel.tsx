import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CircleMinus, CirclePlus, Filter, RotateCcw } from 'lucide-react';
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

// Everything a field's accordion section needs, assembled once per facets/filters/
// search change instead of on every render — a facet can carry tens of thousands of
// values (alertName on large datasets), so this assembly IS the panel's render cost.
interface FieldSection {
	field: string;
	activeValues: string[];
	excludedValues: string[];
	// Facet values + orphaned filter values + previously-seen values (count 0),
	// narrowed by the global search box (unfiltered when the box is empty).
	filteredByGlobalSearch: FilterFacet[];
	fieldMatchesSearch: boolean;
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
		Object.entries(filters).forEach(([key, values]) => {
			// Exclusion keys ("!field") register their values under the plain field, so an
			// excluded value stays listed as an option even when no alert carries it anymore.
			const field = key.startsWith('!') ? key.slice(1) : key;
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

	// The seen-value Sets mutate in the effects above without changing identity, but
	// every mutation is driven by a facets or filters change — both deps here — so this
	// memo is never stale. What it buys: unrelated re-renders (sidebar toggles, parent
	// poll ticks with structurally-shared facets) skip the per-field Set builds and
	// full-list scans entirely.
	const fieldSections = useMemo<FieldSection[]>(() => {
		const globalSearchLower = globalSearch.toLowerCase();
		return config.fields.map((field) => {
			const fieldFacets = facets[field] || [];
			const activeValues = filters[field] || [];
			const excludedValues = filters[`!${field}`] || [];
			const seenValues = allSeenValues[field] || new Set<string>();

			const existingValues = new Set(fieldFacets.map((f) => f.value));

			// Active/excluded values no longer present in the facets stay listed (count 0)
			// so the user can still un-toggle them.
			const filteredValues = new Set([...activeValues, ...excludedValues]);
			const orphanedFilters: FilterFacet[] = [];
			filteredValues.forEach((value) => {
				if (!existingValues.has(value)) {
					orphanedFilters.push({ value, count: 0 });
				}
			});

			const fieldLabel = config.fieldLabels[field] || field;
			const fieldMatchesSearch = fieldLabel.toLowerCase().includes(globalSearchLower);

			const missingSeenValues: FilterFacet[] = [];
			seenValues.forEach((value) => {
				if (!existingValues.has(value) && !filteredValues.has(value)) {
					missingSeenValues.push({ value, count: 0 });
				}
			});

			const allFacets = [...fieldFacets, ...orphanedFilters, ...missingSeenValues];

			const matchesGlobalSearch = (facet: FilterFacet): boolean => {
				// If the field name matches, show all facets in this section.
				if (fieldMatchesSearch) return true;
				return (
					facet.value.toLowerCase().includes(globalSearchLower) ||
					(facet.displayValue?.toLowerCase().includes(globalSearchLower) ?? false)
				);
			};
			const filteredByGlobalSearch = globalSearch ? allFacets.filter(matchesGlobalSearch) : allFacets;

			return { field, activeValues, excludedValues, filteredByGlobalSearch, fieldMatchesSearch };
		});
	}, [config.fields, config.fieldLabels, facets, filters, allSeenValues, globalSearch]);

	const handleFilterToggle = (field: string, value: string) => {
		const currentValues = filters[field] || [];
		const newValues = currentValues.includes(value)
			? currentValues.filter((v) => v !== value)
			: [...currentValues, value];

		// Including a value always clears its exclusion — a value can't be filtered in
		// and out at the same time.
		const excludeKey = `!${field}`;
		const excluded = (filters[excludeKey] || []).filter((v) => v !== value);

		onFilterChange({
			...filters,
			[field]: newValues,
			...(filters[excludeKey] ? { [excludeKey]: excluded } : {}),
		});
	};

	// Toggle a value's "filter out" state. Exclusions live in the same filters record
	// under "!<field>" keys, so persistence needs no schema change. Excluding a value
	// also removes any include of it (mutually exclusive per value).
	const handleExcludeToggle = (field: string, value: string) => {
		const excludeKey = `!${field}`;
		const currentExcluded = filters[excludeKey] || [];
		const isExcluded = currentExcluded.includes(value);
		onFilterChange({
			...filters,
			[excludeKey]: isExcluded ? currentExcluded.filter((v) => v !== value) : [...currentExcluded, value],
			// Only rewrite the include list when one exists — no phantom empty keys.
			...(!isExcluded && filters[field] ? { [field]: filters[field].filter((v) => v !== value) } : {}),
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
				{/* w-0 + min-w-full: Radix ScrollArea's viewport child is display:table, which
				    grows to CONTENT width — one long option label would widen every row past
				    the visible panel and push the +/− controls and count badges out of view.
				    This pins the content to the viewport width so labels truncate and the
				    controls stay hugging the visible right edge. */}
				<div className="px-2 py-2 w-0 min-w-full">
					<Accordion type="multiple" value={openValues} onValueChange={setOpenValues} className="w-full">
						{fieldSections.map((section) => {
							const { field, activeValues, excludedValues, filteredByGlobalSearch, fieldMatchesSearch } =
								section;

							// Hide entire section if no matches in global search AND field name doesn't match
							if (globalSearch && filteredByGlobalSearch.length === 0 && !fieldMatchesSearch) {
								return null;
							}

							return (
								<AccordionItem key={field} value={field} className="border-b">
									{/* pr-3 (not px-2): the chevron's right edge then sits 20px from the panel
								    edge — same inset as the option rows' count badges (px-2 + px-1 + badge),
								    so the chevron and the counts form one aligned column. */}
									<AccordionTrigger className="pl-2 pr-3 py-1.5 hover:no-underline hover:bg-muted/50 text-foreground">
										<div className="flex items-center justify-between w-full pr-2">
											<span className="text-xs font-medium text-foreground">
												{config.fieldLabels[field] || field}
											</span>
											{activeValues.length + excludedValues.length > 0 && (
												<Badge
													variant="outline"
													className="text-[10px] px-1.5 py-0 h-4 bg-muted/50 border-muted-foreground/20"
												>
													{activeValues.length + excludedValues.length}
												</Badge>
											)}
										</div>
									</AccordionTrigger>
									<AccordionContent className="pb-2 overflow-hidden">
										<div className="space-y-1 px-2 w-full">
											{(() => {
												// filteredByGlobalSearch === allFacets when the search box is empty.
												const { filteredAndLimitedFacets, hasMore, remaining, searchTerm } =
													getFilteredAndLimitedFacets(field, filteredByGlobalSearch);

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
																const isIncluded = activeValues.includes(value);
																const isExcluded = excludedValues.includes(value);
																const label = displayValue || value;
																const isDisabled = disabled === true;
																return (
																	// Row click = include toggle (the biggest target,
																	// same gesture the old checkbox served); the +/−
																	// buttons are the explicit controls — hover-revealed
																	// when idle, pinned while their state is active.
																	<div
																		key={value}
																		onClick={() =>
																			!isDisabled &&
																			handleFilterToggle(field, value)
																		}
																		className={cn(
																			'group/row flex items-center gap-1.5 py-1 px-1 rounded transition-colors w-full overflow-hidden',
																			isDisabled
																				? 'cursor-not-allowed opacity-50'
																				: 'cursor-pointer hover:bg-muted/50',
																			isIncluded && 'bg-muted',
																			isExcluded && 'bg-destructive/10'
																		)}
																	>
																		<span
																			className={cn(
																				'text-xs flex-1 min-w-0 break-words line-clamp-2 text-foreground',
																				isIncluded &&
																					'font-medium text-primary',
																				isExcluded &&
																					'line-through text-destructive'
																			)}
																			title={label}
																		>
																			{label}
																		</span>
																		{/* Hover/focus swap: idle rows show only a pinned
																		    state icon + count so the label keeps the width;
																		    hovering (or tabbing in — sr-only keeps the
																		    buttons focusable) replaces them with the +/−
																		    pair in the same slot. */}
																		{!isDisabled && (
																			<span className="sr-only group-hover/row:not-sr-only group-focus-within/row:not-sr-only flex items-center gap-0.5 shrink-0">
																				<button
																					type="button"
																					onClick={(e) => {
																						e.stopPropagation();
																						handleFilterToggle(
																							field,
																							value
																						);
																					}}
																					aria-pressed={isIncluded}
																					className={cn(
																						'shrink-0 rounded p-0.5',
																						isIncluded
																							? 'text-primary'
																							: 'text-muted-foreground hover:text-primary'
																					)}
																					title={
																						isIncluded
																							? 'Remove filter'
																							: 'Filter'
																					}
																					aria-label={
																						isIncluded
																							? `Stop filtering ${label}`
																							: `Filter ${label}`
																					}
																				>
																					<CirclePlus className="h-3.5 w-3.5" />
																				</button>
																				<button
																					type="button"
																					onClick={(e) => {
																						e.stopPropagation();
																						handleExcludeToggle(
																							field,
																							value
																						);
																					}}
																					aria-pressed={isExcluded}
																					className={cn(
																						'shrink-0 rounded p-0.5',
																						isExcluded
																							? 'text-destructive'
																							: 'text-muted-foreground hover:text-destructive'
																					)}
																					title={
																						isExcluded
																							? 'Stop filtering out'
																							: 'Filter out'
																					}
																					aria-label={
																						isExcluded
																							? `Stop filtering out ${label}`
																							: `Filter out ${label}`
																					}
																				>
																					<CircleMinus className="h-3.5 w-3.5" />
																				</button>
																			</span>
																		)}
																		{isIncluded && !isDisabled && (
																			<CirclePlus
																				aria-hidden
																				className="h-3.5 w-3.5 shrink-0 text-primary group-hover/row:hidden group-focus-within/row:hidden"
																			/>
																		)}
																		{isExcluded && !isDisabled && (
																			<CircleMinus
																				aria-hidden
																				className="h-3.5 w-3.5 shrink-0 text-destructive group-hover/row:hidden group-focus-within/row:hidden"
																			/>
																		)}
																		<Badge
																			variant="outline"
																			className={cn(
																				'text-[10px] px-1 py-0 h-4 min-w-[20px] shrink-0 flex items-center justify-center',
																				!isDisabled &&
																					'group-hover/row:hidden group-focus-within/row:hidden'
																			)}
																		>
																			{count}
																		</Badge>
																	</div>
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
