import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Service } from '../../ServiceTable';
import { useMemo } from 'react';
import { SlidersHorizontal } from 'lucide-react';

export type Filters = Record<string, string[]>;

interface FilterPanelProps {
	services: Service[];
	filters: Filters;
	onFilterChange: (filters: Filters) => void;
	collapsed: boolean;
}

const FACET_FIELDS = [
	'serviceStatus',
	'serviceType',
	'providerType',
	'providerName',
	'containerNamespace',
	'tags',
] as const;

const FIELD_LABELS: Record<string, string> = {
	serviceStatus: 'Status',
	serviceType: 'Service Type',
	providerType: 'Provider Type',
	providerName: 'Provider Name',
	containerNamespace: 'Container Namespace',
	tags: 'Tags',
};

const formatFilterValue = (value: string): string => {
	const uppercaseValues: Record<string, string> = {
		vm: 'VM',
		k8s: 'K8S',
		kubernetes: 'K8S',
		ssh: 'SSH',
		docker: 'Docker',
		systemd: 'Systemd',
		manual: 'Manual',
	};

	const lowerValue = value.toLowerCase();
	if (uppercaseValues[lowerValue]) {
		return uppercaseValues[lowerValue];
	}

	return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
};

export const FilterPanel = ({ services, filters, onFilterChange, collapsed }: FilterPanelProps) => {
	const facets = useMemo(() => {
		const newFacets: Record<string, Record<string, number>> = {};

		FACET_FIELDS.forEach(field => {
			newFacets[field] = {};
		});

		services.forEach(service => {
			if (service.serviceStatus) {
				const value = String(service.serviceStatus.toLowerCase());
				newFacets.serviceStatus[value] = (newFacets.serviceStatus[value] || 0) + 1;
			}

			if (service.serviceType) {
				const value = String(service.serviceType);
				newFacets.serviceType[value] = (newFacets.serviceType[value] || 0) + 1;
			}

			if (service.provider?.providerType) {
				const value = String(service.provider.providerType);
				newFacets.providerType[value] = (newFacets.providerType[value] || 0) + 1;
			}

			if (service.provider?.name) {
				const value = String(service.provider.name);
				newFacets.providerName[value] = (newFacets.providerName[value] || 0) + 1;
			}

			if (service.containerDetails?.namespace) {
				const value = String(service.containerDetails.namespace);
				newFacets.containerNamespace[value] = (newFacets.containerNamespace[value] || 0) + 1;
			}

			if (service.tags && service.tags.length > 0) {
				service.tags.forEach(tag => {
					const value = String(tag.name);
					newFacets.tags[value] = (newFacets.tags[value] || 0) + 1;
				});
			}
		});

		return newFacets;
	}, [services]);

	const handleCheckboxChange = (field: string, value: string) => {
		const currentFilters = filters[field] || [];
		const newFilters = currentFilters.includes(value.toLowerCase())
			? currentFilters.filter(v => v.toLowerCase() !== value.toLowerCase())
			: [...currentFilters, value.toLowerCase()];
		onFilterChange({
			...filters,
			[field]: newFilters,
		});
	};

	const resetFilters = () => {
		onFilterChange({});
	};

	const activeFilterCount = Object.values(filters).flat().length;

	if (collapsed) {
		return (
			<div className='flex flex-col h-full items-center py-2'>
				<div className='relative'>
					<SlidersHorizontal className='h-5 w-5 text-muted-foreground' />
					{activeFilterCount > 0 && (
						<div className='absolute -top-1 -right-1 h-4 w-4 bg-primary text-primary-foreground text-xs font-medium rounded-full flex items-center justify-center'>
							{activeFilterCount}
						</div>
					)}
				</div>
				{activeFilterCount > 0 && (
					<Button
						variant='ghost'
						size='sm'
						onClick={resetFilters}
						className='mt-2 h-6 w-6 p-0 hover:bg-muted text-xs'
						title='Reset all filters'
					>
						×
					</Button>
				)}
			</div>
		);
	}

	return (
		<div className='flex flex-col h-full overflow-y-auto'>
			<div className='px-2 py-2 border-b border-border'>
				<div className='flex justify-between items-center'>
					<span className='text-xs text-muted-foreground'>
						{activeFilterCount > 0
							? `${activeFilterCount} active filter${activeFilterCount === 1 ? '' : 's'}`
							: 'No filters'}
					</span>
					<Button
						variant='outline'
						size='sm'
						onClick={resetFilters}
						disabled={activeFilterCount === 0}
						className='h-6 px-2 text-xs'
					>
						Reset
					</Button>
				</div>
			</div>
			<div className='px-1 py-1 flex-1 overflow-y-auto'>
				<Accordion type='multiple' className='w-full' defaultValue={FACET_FIELDS.map(f => String(f))}>
					{FACET_FIELDS.map(field => {
						const fieldFacets = facets[field] || {};
						const hasValues = Object.keys(fieldFacets).length > 0;

						if (!hasValues) return null;

						return (
							<AccordionItem value={String(field)} key={field} className='border-b border-border'>
								<AccordionTrigger className='text-xs font-medium capitalize py-2 px-1 hover:bg-muted/50 rounded-md'>
									{FIELD_LABELS[field]}
								</AccordionTrigger>
								<AccordionContent>
									<div className='space-y-1 pl-1 py-0.5'>
										{Object.entries(fieldFacets)
											.sort(([a], [b]) => a.localeCompare(b))
											.map(([value, count]) => {
												const displayValue = formatFilterValue(value);
												return (
													<div
														key={value}
														className='flex items-center justify-between py-0.5'
													>
														<label className='flex items-center gap-1.5 text-xs font-normal cursor-pointer hover:text-foreground'>
															<Checkbox
																checked={(filters[field] || []).includes(
																	value.toLowerCase()
																)}
																onCheckedChange={() =>
																	handleCheckboxChange(field, value)
																}
															/>
															<span
																className='truncate max-w-[100px]'
																title={displayValue}
															>
																{displayValue}
															</span>
														</label>
														<span className='text-xs font-medium px-1 py-0.5 rounded-full bg-primary text-primary-foreground flex-shrink-0'>
															{count}
														</span>
													</div>
												);
											})}
									</div>
								</AccordionContent>
							</AccordionItem>
						);
					})}
				</Accordion>
			</div>
		</div>
	);
};
