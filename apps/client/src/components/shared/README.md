# Shared Components

This directory contains reusable components that are shared across multiple parts of the application.

## FilterPanel

A generic, reusable filter panel component that provides faceted filtering functionality.

### Features

- **Faceted Filtering**: Displays filter options grouped by category with counts
- **Collapsible**: Can be collapsed to save space
- **Active Filter Tracking**: Shows count of active filters
- **Reset Functionality**: Easy one-click reset of all filters
- **Responsive Design**: Adapts to different screen sizes
- **Variants**: Supports 'default' and 'compact' variants

### Usage

```typescript
import { FilterPanel, FilterFacets, ActiveFilters, FilterPanelConfig } from '@/components/shared';

// Define your filter configuration
const config: FilterPanelConfig = {
  fields: ['status', 'type', 'tag'],
  fieldLabels: {
    status: 'Status',
    type: 'Type',
    tag: 'Tag',
  },
  defaultOpen: ['status', 'type'], // Optional: fields open by default
};

// Compute facets from your data
const facets: FilterFacets = useMemo(() => {
  const result: FilterFacets = {};

  // Build facet data from your items
  // Each facet is an array of { value, count, displayValue? }
  result.status = [
    { value: 'active', count: 10, displayValue: 'Active' },
    { value: 'inactive', count: 5, displayValue: 'Inactive' },
  ];

  return result;
}, [data]);

// Track active filters
const [filters, setFilters] = useState<ActiveFilters>({});

// Use the component
<FilterPanel
  config={config}
  facets={facets}
  filters={filters}
  onFilterChange={setFilters}
  collapsed={false}
  onToggle={() => setCollapsed(!collapsed)}
  variant="compact"
/>
```

### Props

- **config**: `FilterPanelConfig` - Configuration for filter fields and labels
- **facets**: `FilterFacets` - Computed facet data with counts
- **filters**: `ActiveFilters` - Currently active filters
- **onFilterChange**: `(filters: ActiveFilters) => void` - Callback when filters change
- **collapsed**: `boolean` - Whether the panel is collapsed (optional)
- **onToggle**: `() => void` - Callback to toggle collapse state (optional)
- **className**: `string` - Additional CSS classes (optional)
- **variant**: `'default' | 'compact'` - Size variant (optional, default: 'default')

### Examples

#### Service Dashboard Filter

See: `components/Dashboard/FilterPanel/FilterPanel.tsx`

#### Alerts Dashboard Filter

See: `components/AlertsFilterPanel/AlertsFilterPanel.tsx`

### Types

```typescript
export type FilterFacet = {
	value: string;
	count: number;
	displayValue?: string; // Optional formatted display value
};

export type FilterFacets = Record<string, FilterFacet[]>;

export type ActiveFilters = Record<string, string[]>;

export interface FilterPanelConfig {
	fields: readonly string[];
	fieldLabels: Record<string, string>;
	defaultOpen?: string[]; // Optional: fields to open by default
}
```
