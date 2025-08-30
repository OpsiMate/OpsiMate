import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Service } from "./ServiceTable"
import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { SlidersHorizontal } from "lucide-react"

export type Filters = Record<string, string[]>

interface FilterPanelProps {
  services: Service[]
  filters: Filters
  onFilterChange: (filters: Filters) => void
  collapsed: boolean
}

// Define all possible filter fields
const FACET_FIELDS = [
  'serviceStatus',
  'serviceType', 
  'providerType',
  'providerName',
  'containerNamespace',
  'tags'
] as const;

const FIELD_LABELS: Record<string, string> = {
  serviceStatus: 'Status',
  serviceType: 'Service Type',
  providerType: 'Provider Type',
  providerName: 'Provider Name',
  containerNamespace: 'Container Namespace',
  tags: 'Tags'
};

export function FilterPanel({ services, filters, onFilterChange, collapsed }: FilterPanelProps) {
  const facets = useMemo(() => {
    const newFacets: Record<string, Record<string, number>> = {};
    
    // Initialize all facet fields
    FACET_FIELDS.forEach(field => {
      newFacets[field] = {};
    });

    services.forEach(service => {
      // Service status
      if (service.serviceStatus) {
        const value = String(service.serviceStatus);
        newFacets.serviceStatus[value] = (newFacets.serviceStatus[value] || 0) + 1;
      }

      // Service type
      if (service.serviceType) {
        const value = String(service.serviceType);
        newFacets.serviceType[value] = (newFacets.serviceType[value] || 0) + 1;
      }

      // Provider type
      if (service.provider?.providerType) {
        const value = String(service.provider.providerType);
        newFacets.providerType[value] = (newFacets.providerType[value] || 0) + 1;
      }

      // Provider name
      if (service.provider?.name) {
        const value = String(service.provider.name);
        newFacets.providerName[value] = (newFacets.providerName[value] || 0) + 1;
      }

      // Container namespace
      if (service.containerDetails?.namespace) {
        const value = String(service.containerDetails.namespace);
        newFacets.containerNamespace[value] = (newFacets.containerNamespace[value] || 0) + 1;
      }

      // Tags
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
    const newFilters = currentFilters.includes(value)
      ? currentFilters.filter(v => v !== value)
      : [...currentFilters, value];
    onFilterChange({
      ...filters,
      [field]: newFilters,
    });
  };

  const resetFilters = () => {
    onFilterChange({});
  };
  
  const activeFilterCount = Object.values(filters).flat().length;

  return (
    <div className={cn("flex flex-col h-full overflow-y-auto", collapsed && "items-center")}>
        <div className={cn("flex justify-between items-center px-4 py-3 sticky top-0 bg-card z-10 border-b border-border", collapsed && "px-0 py-4 border-b-0")}>
            <h3 className={cn("text-md font-semibold text-foreground", collapsed && "sr-only")}>Filters</h3>
            {collapsed && <SlidersHorizontal className="h-6 w-6" />}
            <Button variant="outline" size="sm" onClick={resetFilters} disabled={activeFilterCount === 0} className={cn(collapsed && "sr-only")}>
                Reset
            </Button>
        </div>
      <div className={cn("px-2 py-2", collapsed && "sr-only")}>
        <Accordion type="multiple" className="w-full" defaultValue={FACET_FIELDS.map(f => String(f))}>
          {FACET_FIELDS.map(field => {
            const fieldFacets = facets[field] || {};
            const hasValues = Object.keys(fieldFacets).length > 0;
            
            // Only show fields that have values
            if (!hasValues) return null;
            
            return (
              <AccordionItem value={String(field)} key={field} className="border-b border-border">
                <AccordionTrigger className="text-sm font-medium capitalize py-3 px-2 hover:bg-muted/50 rounded-md">
                  {FIELD_LABELS[field]}
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2 pl-2 py-1">
                    {Object.entries(fieldFacets).sort(([a], [b]) => a.localeCompare(b)).map(([value, count]) => (
                      <div key={value} className="flex items-center justify-between py-1">
                        <label className="flex items-center gap-2 text-sm font-normal cursor-pointer hover:text-foreground">
                          <Checkbox
                            checked={(filters[field] || []).includes(value)}
                            onCheckedChange={() => handleCheckboxChange(field, value)}
                          />
                          <span className="truncate max-w-[150px]" title={value}>
                            {value}
                          </span>
                        </label>
                        <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground flex-shrink-0">
                          {count}
                        </span>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  )
} 